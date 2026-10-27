// ============================================================
// SkillAIManager.js ― 「効果を文章で書くと、AIがスキルを作ってくれる」ための窓口
//
//  【設計の考え方】
//   AIに「JavaScriptのコード」を書かせて実行するのではなく、ゲームがすでに持っている
//   スキルの部品（形 / 効果 / 強化 / 属性 / 自由配置）を組み合わせた「設計図(JSON)」を作らせる。
//   ・設計図は action-skills.js の normalize() で必ず範囲内に丸められる（数・大きさ・強化の上限など）
//   ・エネルギー消費とクールタイムも compute() が自動で決める → 強すぎるスキルは重くなる
//   ・実行エンジン（action-battle.js）は今までと同じなので、遠隔地のAIが書いたコードを
//     全員のブラウザで動かす危険（改ざん・乗っ取り・不正）がない
//   部品で表せない効果は「unsupported」として正直に返し、いちばん近いスキルにする。
//
//  部品の定義はクライアントの action-skills.js / elements.js を読み込んで使う（定義が二重にならない）。
//
//  環境変数
//   ANTHROPIC_API_KEY   … 無いとAIは使わず、キーワード判定の簡易版で作る
//   SKILL_AI_MODEL      … 使うモデル（既定 claude-haiku-5-5）
//   SKILL_AI_DAILY_LIMIT… 1人が1日に作れる回数（既定 30）
// ============================================================
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const CLIENT_JS = path.join(__dirname, "..", "..", "client", "js");
const MODEL = process.env.SKILL_AI_MODEL || "claude-haiku-5-5";
const DAILY_LIMIT = Math.max(1, parseInt(process.env.SKILL_AI_DAILY_LIMIT, 10) || 30);
const MIN_GAP_MS = 4000;
const MAX_TEXT = 300;

// ---------- 部品の定義を読み込む ----------
const sb = { localStorage: { getItem: () => null, setItem() {} }, console: { log() {}, warn() {}, error() {} } };
sb.window = sb;                                        // ブラウザの window ＝ グローバル、と同じ形にする
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(CLIENT_JS, "elements.js"), "utf8"), sb);
vm.runInContext(fs.readFileSync(path.join(CLIENT_JS, "action-skills.js"), "utf8"), sb);
const AS = sb.ActionSkills;
const ELEMS = sb.SBElem.ELEMS;

// ---------- 利用回数の制限 ----------
const usage = new Map();       // playerId -> { day, count, lastAt, busy }
const today = () => new Date().toISOString().slice(0, 10);
function checkQuota(pid) {
    const u = usage.get(pid) || { day: today(), count: 0, lastAt: 0, busy: false };
    if (u.day !== today()) { u.day = today(); u.count = 0; }
    usage.set(pid, u);
    if (u.busy) return { ok: false, reason: "busy" };
    if (Date.now() - u.lastAt < MIN_GAP_MS) return { ok: false, reason: "too_fast" };
    if (u.count >= DAILY_LIMIT) return { ok: false, reason: "daily_limit", limit: DAILY_LIMIT };
    return { ok: true, u: u };
}

// ---------- プロンプト ----------
function buildSystemPrompt(allowForms, allowEffects, maxEffects) {
    const forms = allowForms.map(k => `- ${k}（${AS.FORMS[k].name}）：${AS.FORMS[k].desc}`).join("\n");
    const effects = allowEffects.map(k => `- ${k}（${AS.EFFECTS[k].name}${AS.EFFECTS[k].self ? "・自分にかかる" : ""}）：${AS.EFFECTS[k].desc}`).join("\n");
    const augs = Object.keys(AS.AUGMENTS).map(k => {
        const a = AS.AUGMENTS[k];
        return `- ${k}（${a.name}）：${a.desc}／最大${a.stack}回まで重ねがけ${a.forms.length ? "／" + a.forms.join(",") + " のみ" : ""}`;
    }).join("\n");
    const elems = Object.keys(ELEMS).map(k => `${k}(${ELEMS[k].name})`).join(", ");
    return [
        "あなたは、クイズ×アクションRPG「SchoolBattle」のスキル設計係です。",
        "プレイヤーが日本語で書いた「やりたいスキルの説明」を、ゲームにある部品の組み合わせ（設計図）に変換します。",
        "新しい仕組みや新しいコードは作れません。部品だけで、できるだけ説明に近いものを作ってください。",
        "",
        "## 使える部品",
        "### 形（form）…ちょうど1つ選ぶ",
        forms,
        "### 効果（effects）…最大" + maxEffects + "個。通常は \"damage\" を含める（回復や強化だけのスキルなら含めなくてよい）",
        effects,
        "### 強化（augments）…最大4個。同じものを重ねられる",
        augs,
        "### 属性（element）…任意。説明に属性（炎・氷・雷など）があるときだけ付ける",
        elems,
        "",
        "## 自由配置（layout）…任意。本数・並べ方・図形・向きの指定があるときだけ使う（無ければ null）",
        "1つの配置 = {\"fw\":前後(px),\"sd\":左右(px。+が右),\"a\":向き(度。0=狙った方向),\"s\":大きさ(0.5〜2.5)}。最大8個。",
        "範囲：fw -150〜450 / sd -300〜300 / a -180〜180 / s 0.5〜2.5。位置と向きは「撃った瞬間の自分の位置と狙った方向」が基準。",
        "layout を使うと「強化のmulti(増殖)」は使えなくなり、数は配置の個数で決まる。大きく・多くするほどエネルギー消費が増える。",
        "例：扇状に3本 → a が -25,0,25／全方位に6本 → a が 0,60,120,180,-120,-60（fw=0）／",
        "　　前に横並び3発 → fw=200 で sd が -120,0,120／ V字 → sd と a を左右対称にずらす／ 自分の前後に1つずつ → fw が 250 と -100。",
        "",
        "## ルール",
        "- 説明に最も近い形を1つ選ぶ。迷ったら projectile / nova / slash のような基本形にする。",
        "- 説明を満たしつつ、必要以上に強化や配置を盛らない（強いほどエネルギーを食う）。",
        "- 部品で表せない要素（例：敵を複製する、時間を巻き戻す、画面外から召喚する）は無理に再現せず、近い部品で代用し、\"unsupported\" に日本語で短く書く。",
        "- name は日本語20文字以内。説明に名前があればそれを使う。",
        "- 出力は次のJSONだけ。前置き・説明・コードブロックの記号は書かない。",
        "{\"name\":\"\",\"form\":\"\",\"effects\":[],\"augments\":[],\"element\":null,\"layout\":null,\"summary\":\"どう作ったかを1文で\",\"unsupported\":[]}"
    ].join("\n");
}

// ---------- 返事のJSONを取り出す ----------
function extractJson(text) {
    if (!text) return null;
    let t = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

// ---------- 設計図を、ルールの範囲に丸める ----------
function sanitize(spec, ctx) {
    const s = spec && typeof spec === "object" ? spec : {};
    const form = ctx.allowForms.includes(s.form) ? s.form : (ctx.allowForms.includes("projectile") ? "projectile" : ctx.allowForms[0]);
    const effects = (Array.isArray(s.effects) ? s.effects : []).filter(e => ctx.allowEffects.includes(e));
    const out = {
        name: String(s.name || "オリジナルスキル").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 20) || "オリジナルスキル",
        form: form,
        effects: effects.length || s.effects === undefined ? effects : ["damage"],
        augments: Array.isArray(s.augments) ? s.augments.filter(a => AS.AUGMENTS[a]).slice(0, 8) : [],
        element: s.element && ELEMS[s.element] ? s.element : undefined,
        layout: Array.isArray(s.layout) && s.layout.length ? s.layout.slice(0, AS.MAX_PIECES) : undefined
    };
    if (!out.effects.length) out.effects = ["damage"];
    // 特殊ステータスに合わせたグリフ枠で丸める（normalize が getPlayerData の special を見る）
    sb.getPlayerData = () => ({ special: ctx.special });
    const norm = AS.normalize(out, false);
    delete sb.getPlayerData;
    delete norm.id;
    return norm;
}

// ---------- AI呼び出し ----------
async function callClaude(text, ctx) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
                model: MODEL, max_tokens: 900,
                system: buildSystemPrompt(ctx.allowForms, ctx.allowEffects, AS.maxEffectsFor(ctx.special)),
                messages: [{ role: "user", content: "スキルの説明：\n" + text }]
            }),
            signal: ctrl.signal
        });
        if (!res.ok) { console.error("[SkillAI] API error", res.status); return null; }
        const j = await res.json();
        const out = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
        return extractJson(out);
    } catch (e) {
        console.error("[SkillAI] request failed:", e.message);
        return null;
    } finally { clearTimeout(timer); }
}

// ---------- APIキーが無い／失敗したときの、キーワード判定の簡易版 ----------
const KW_FORM = [
    [/瞬間移動|テレポ|一閃|ワープ|駆け抜/, "flash"], [/召喚|ミニオン|使い魔/, "summon"], [/領域|フィールド|結界|ゾーン/, "domain"],
    [/隕石|流星|メテオ|降らせ|降り注/, "meteor"], [/回る|回転|旋回|周り?を回|ぐるぐる/, "orbit"], [/突き|刺す|槍|貫く突/, "thrust"],
    [/レーザー|光線|ビーム|閃光/, "laser"], [/斬|切り|斬撃|刃|剣/, "slash"], [/衝撃波|爆発|周囲|全方位|波動|ノヴァ/, "nova"],
    [/弾幕|包囲/, "barrage"], [/弾|玉|球|ボール|矢|撃/, "projectile"]
];
const KW_EFFECT = [
    [/燃|炎|火|焼/, "burn"], [/凍|氷|冷/, "freeze"], [/吹き?飛|ふっ?とば|衝撃/, "knockback"], [/吸収|吸い取|ドレイン/, "drain"],
    [/麻痺|しびれ|スタン|気絶/, "stun"], [/毒/, "poison"], [/弱体|弱く|攻撃力.*下/, "weaken"], [/防御.*(無視|破)|砕/, "shatter"],
    [/目眩|盲目|暗闇/, "blind"], [/石化/, "petrify"], [/爆発|爆破/, "explosion"], [/引き寄せ|重力|吸い込/, "gravity"],
    [/防御.*(上|アップ|強化)|鉄壁/, "fortify"], [/移動.*(上|速|アップ)|疾風|加速/, "haste"], [/回復|再生|ヒール/, "regenerate"],
    [/攻撃力.*(上|アップ|強化)|剛力/, "empower"], [/バリア|障壁|シールド/, "barrier"]
];
const KW_ELEM = [[/炎|火|燃/, "fire"], [/水|雨/, "water"], [/風|嵐/, "wind"], [/土|岩|大地/, "earth"], [/雷|電|稲妻/, "thunder"], [/氷/, "ice"], [/毒/, "venom"]];
function zenToHan(s) { return s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)); }

function localGenerate(textRaw, ctx) {
    const text = zenToHan(textRaw);
    let form = "projectile";
    for (const [re, f] of KW_FORM) if (re.test(text) && ctx.allowForms.includes(f)) { form = f; break; }
    const effects = ["damage"];
    KW_EFFECT.forEach(([re, e]) => { if (re.test(text) && ctx.allowEffects.includes(e) && !effects.includes(e)) effects.push(e); });
    const augments = [];
    if (/大き|広|巨大|でかい|ひろい/.test(text)) augments.push("extend", "extend");
    if (/強力|威力|強い|つよい|超|最強/.test(text)) augments.push("amplify", "amplify");
    if (/速|早|すばや|素早/.test(text)) augments.push("swift");
    if (/貫通|貫く|突き抜/.test(text) && form === "projectile") augments.push("pierce");
    let element;
    for (const [re, el] of KW_ELEM) if (re.test(text) && ELEMS[el]) { element = el; break; }
    // 本数・配置
    let layout;
    const n = (text.match(/(\d+)\s*(本|発|個|つ|体|回|方向)/) || [])[1];
    const count = Math.max(1, Math.min(AS.MAX_PIECES, parseInt(n, 10) || 1));
    if (/全方位|周囲|円状|ぐるっと|放射/.test(text) && form !== "nova") {
        const k = Math.max(3, count > 1 ? count : 6);
        layout = Array.from({ length: Math.min(AS.MAX_PIECES, k) }, (_, i) => ({ fw: 0, sd: 0, a: Math.round(-180 + (360 / Math.min(AS.MAX_PIECES, k)) * i) , s: 1 }));
    } else if (count > 1) {
        const k = count, step = 18;
        layout = Array.from({ length: k }, (_, i) => ({ fw: 0, sd: 0, a: Math.round((i - (k - 1) / 2) * step), s: 1 }));
    }
    const spec = { name: textRaw.replace(/[。、\s].*$/, "").slice(0, 12) || "オリジナルスキル", form: form, effects: effects, augments: augments, element: element, layout: layout };
    return { spec: spec, summary: "キーワードから簡易的に作成しました（AIが使えない状態です）", unsupported: [] };
}

// ---------- 窓口 ----------
async function generate(m) {
    m = m || {};
    const pid = String(m.playerId || "");
    if (!/^[A-Za-z0-9]{4,12}$/.test(pid)) return { ok: false, reason: "invalid" };
    const text = String(m.text || "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, MAX_TEXT);
    if (text.length < 4) return { ok: false, reason: "too_short" };

    const q = checkQuota(pid.toUpperCase());
    if (!q.ok) return q;

    const allowForms = (Array.isArray(m.allowForms) ? m.allowForms : Object.keys(AS.FORMS)).filter(k => AS.FORMS[k]);
    const allowEffects = (Array.isArray(m.allowEffects) ? m.allowEffects : Object.keys(AS.EFFECTS)).filter(k => AS.EFFECTS[k]);
    if (!allowForms.length || !allowEffects.length) return { ok: false, reason: "invalid" };
    const special = Math.max(0, Math.min(1e7, Number(m.special) || 0));
    const ctx = { allowForms, allowEffects, special };

    const u = q.u; u.busy = true; u.lastAt = Date.now();
    try {
        let raw = await callClaude(text, ctx), viaAI = !!raw, summary = "", unsupported = [];
        if (raw) { summary = String(raw.summary || "").slice(0, 120); unsupported = (Array.isArray(raw.unsupported) ? raw.unsupported : []).map(x => String(x).slice(0, 80)).slice(0, 5); }
        else { const l = localGenerate(text, ctx); raw = l.spec; summary = l.summary; }
        u.count += 1;
        return { ok: true, ai: viaAI, spec: sanitize(raw, ctx), summary: summary, unsupported: unsupported, left: Math.max(0, DAILY_LIMIT - u.count) };
    } catch (e) {
        console.error("[SkillAI] generate failed:", e);
        return { ok: false, reason: "server_error" };
    } finally { u.busy = false; }
}

module.exports = { generate, AS, DAILY_LIMIT, MODEL };
