// ============================================================
//  InnateCodeManager — 固有能力：AIが「能力の原理」と「戦闘中に動くコード」を書く
// ------------------------------------------------------------
//  ・create : 「水を操る能力にしたい」のような一言から、原理＋基本能力1つ＋応用能力3つ（それぞれ動くコード付き）を作る
//  ・extend : 後から「こういう応用能力がほしい」と伝え、能力の原理と合っていれば（制約つきで）追加の応用能力を作る
//
//  安全のしくみ（AIのコードは、プレイヤーの文章に影響されて書かれる＝信用しない前提）：
//   1. このサーバーでは、AIのコードを【実行しない】。構文チェック（コンパイルのみ）と、危険な語の検査だけ行う
//   2. 実際に動くのはプレイヤーのブラウザの「隔離iframe」の中だけ（client/js/innate-runtime.js）。
//      親ページ・保存データ・通信には触れず、出せる命令もゲームが決めたものだけ。威力は階級(tier)・制約・習熟度で決まり、コードでは決まらない
//   3. 強さの数字（消費・クールタイム・威力の上限）は、AIではなくゲーム側の表（action-skills.js の INNATE_TIERS / INNATE_CONSTRAINTS）が決める
//
//  環境変数：GEMINI_API_KEY（Google AI Studio）または ANTHROPIC_API_KEY（どちらも無いと、定型のコードを使う簡易版になる）
//            GEMINI_MODEL / GEMINI_INNATE_MODEL（Gemini のモデル。既定 gemini-2.5-flash） / INNATE_AI_MODEL（Claude のモデル。既定 claude-sonnet-5-5）
//            INNATE_CREATE_LIMIT（1人1日の作成回数 既定6） / INNATE_EXTEND_LIMIT（追加の応用能力 既定20）
// ============================================================
const vm = require("vm");
const { AS } = require("./SkillAIManager");
const AiClient = require("./AiClient");

const MODEL = process.env.INNATE_AI_MODEL || "claude-sonnet-5-5";
const CREATE_LIMIT = Math.max(1, parseInt(process.env.INNATE_CREATE_LIMIT, 10) || 6);
const EXTEND_LIMIT = Math.max(1, parseInt(process.env.INNATE_EXTEND_LIMIT, 10) || 20);
const MIN_GAP_MS = 3000;
const MAX_TEXT = 300;
const CONSTRAINTS = AS.INNATE_CONSTRAINTS;
const TIERS = AS.INNATE_TIERS;
const ELEM_IDS = ["fire", "water", "wind", "earth", "thunder", "ice", "venom"];
const EFF_BY_ELEM = { fire: ["burn"], water: ["knockback"], wind: ["knockback"], earth: ["shatter"], thunder: ["stun"], ice: ["freeze"], venom: ["poison"] };
const COLOR_BY_ELEM = { fire: "#ff7a3d", water: "#4aa8ff", wind: "#9dffd2", earth: "#c9a15a", thunder: "#ffe14a", ice: "#bfeaff", venom: "#b46bff" };
const KW_ELEM = [[/炎|火|燃|焔/, "fire"], [/水|雨|海|波|流/, "water"], [/風|嵐|空気/, "wind"], [/土|岩|大地|砂/, "earth"], [/雷|電|稲妻/, "thunder"], [/氷|雪|冷/, "ice"], [/毒/, "venom"]];

// ---------- 利用回数の制限 ----------
const usage = new Map();
const today = () => new Date().toISOString().slice(0, 10);
function checkQuota(pid, kind, limit) {
    const k = pid + ":" + kind;
    const u = usage.get(k) || { day: today(), count: 0, lastAt: 0, busy: false };
    if (u.day !== today()) { u.day = today(); u.count = 0; }
    usage.set(k, u);
    if (u.busy) return { ok: false, reason: "busy" };
    if (Date.now() - u.lastAt < MIN_GAP_MS) return { ok: false, reason: "too_fast" };
    if (u.count >= limit) return { ok: false, reason: "daily_limit", limit: limit };
    return { ok: true, u: u };
}

// ---------- コードの検査（実行はしない）----------
const FORBIDDEN = /\b(window|document|globalThis|self|parent|top|frames|opener|eval|Function|constructor|prototype|__proto__|__defineGetter__|import|require|process|module|exports|fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|caches|navigator|location|history|postMessage|setTimeout|setInterval|setImmediate|requestAnimationFrame|Worker|SharedWorker|Proxy|Reflect|Symbol|WebAssembly|importScripts|Atomics|SharedArrayBuffer|Intl|Date|performance|crypto)\b/;
const ENDLESS = /while\s*\(\s*(true|1|!0)\s*\)|for\s*\(\s*;\s*;\s*\)|do\s*\{[\s\S]*\}\s*while\s*\(\s*(true|1)\s*\)/;
// コードが呼んでよい api の名前（これ以外は「存在しない機能」。AIが作り話の機能を呼ぶコードを書いても、ここで止める）
const API_NAMES = new Set(["aim", "rangeMul", "tier", "me", "enemies", "nearest", "time", "rand", "wait", "on", "end", "store", "render", "passive", "shot", "hit", "area", "line", "status", "heal", "dash", "popup"]);
function checkCode(code) {
    if (typeof code !== "string") return "コードがありません";
    const c = code.trim();
    if (c.length < 20) return "コードが短すぎます";
    if (c.length > 5500) return "コードが長すぎます（5500文字まで）";
    const m = c.match(FORBIDDEN); if (m) return "使えない語が含まれています：" + m[0];
    if (/\[\s*['"`][^\]]*['"`]\s*\+|\bin\s+api\b/.test(c)) return "文字列でプロパティ名を組み立てる書き方は使えません";
    if (/\bapi\s*\[/.test(c)) return "api[...] の書き方は使えません";
    const bad = (c.match(/\bapi\s*\.\s*([A-Za-z_$][\w$]*)/g) || []).map(x => x.replace(/^api\s*\.\s*/, "")).find(n => !API_NAMES.has(n));
    if (bad) return "存在しない機能です：api." + bad;
    if (ENDLESS.test(c)) return "終わらないループは使えません（await api.wait を挟んだ有限の繰り返しにしてください）";
    if (!/api\.(shot|hit|area|line|heal|dash|popup|status|render|on)\s*\(/.test(c)) return "攻撃・描画・反応などの命令が1つもありません";
    try { new vm.Script("(async function(api){" + c + "\n})", { filename: "innate-skill" }); }      // コンパイルだけ。実行はしない
    catch (e) { return "構文エラー：" + String(e.message).slice(0, 80); }
    return null;
}

// ---------- 整形（AIの出力を、ゲームが受け入れる形にする）----------
const clipStr = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, n);
const clipList = (v, n, len) => (Array.isArray(v) ? v : []).map(x => clipStr(x, len)).filter(Boolean).slice(0, n);
function weightOf(list) { return list.reduce((a, k) => a + (CONSTRAINTS[k] ? CONSTRAINTS[k].w : 0), 0); }
function fixConstraints(list, need) {
    const used = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(k => { const d = CONSTRAINTS[k]; if (d && !used[d.group]) { used[d.group] = true; out.push(k); } });
    // 制約が足りなければ、ゲーム側で足す（制約は「少し厳しめ」が基本）
    const fill = ["slow", "heavy", "narrow", "veryslow", "veryheavy"];
    for (let i = 0; i < fill.length && weightOf(out) < need; i++) {
        const k = fill[i], g = CONSTRAINTS[k].group;
        if (!out.includes(k)) {
            const same = out.findIndex(x => CONSTRAINTS[x].group === g);
            if (same >= 0) { if (CONSTRAINTS[out[same]].w < CONSTRAINTS[k].w) out[same] = k; } else out.push(k);
        }
    }
    if (weightOf(out) < need) { out.length = 0; out.push("veryslow", "heavy", "narrow"); }
    return out;
}
function sanitizeSkill(raw, role, ctx) {
    if (!raw || typeof raw !== "object") return null;
    const err = checkCode(raw.code); if (err) return { error: err };
    const maxTier = role === "base" ? 2 : 4;
    return {
        skill: {
            name: scrub(clipStr(raw.name, 14), role === "base" ? "基本の術" : "応用の術") || (role === "base" ? "基本能力" : "応用能力"),
            desc: scrub(clipStr(raw.desc, 80), ""),
            lore: scrub(clipStr(raw.lore, 80), "古い誓約が、この術に重い代償を課している。"),
            passive: raw.passive === true,
            tier: Math.max(1, Math.min(maxTier, Math.round(Number(raw.tier) || (role === "base" ? 1 : 2)))),
            constraints: fixConstraints(raw.constraints, role === "base" ? 2 : 3),
            code: raw.code.trim(),
            element: ctx && ctx.element ? ctx.element : undefined
        }
    };
}
function sanitizeAbility(raw, concept) {
    const element = ELEM_IDS.includes(raw && raw.element) ? raw.element : undefined;
    return {
        concept: clipStr(concept, MAX_TEXT),
        name: scrub(clipStr(raw && raw.name, 14), "異能") || "固有能力",
        principle: scrub(clipStr(raw && raw.principle, 120), safeConcept(concept)),
        can: clipList(raw && raw.can, 5, 30).map(x => scrub(x, "原理に沿った術")), cannot: clipList(raw && raw.cannot, 4, 30).map(x => scrub(x, "原理に無い力")),
        keywords: clipList(raw && raw.keywords, 10, 12).filter(x => !IP_NAMES.test(x)),
        lore: scrub(clipStr(raw && raw.lore, 120), "この力を得る代わりに、重い代償を負った。"), element: element
    };
}

// ---------- 既存作品の固有名詞を使わせない ----------
//  AIへの指示（IP_RULE）が本命。念のため、出力に有名な作品名・技名・キャラ名が混ざっていたら、独自の名前に差し替える（完全な一覧ではない）
const IP_RULE = `
【再現できないことの扱い（重要）】
・上の api でできないこと（例：時間停止、地形を作る、画面全体の演出、敵の行動の書き換え、存在しない命令）は、できるふりをしない。api にない関数を呼ぶコードは、そのスキルごと却下される。
・できない部分は、api でできる近い動きで代用する。代用した・省いた内容は、skill の "unsupported"（短い文の配列）に必ず書く。
・"desc"（説明文）には、書いたコードが実際にやることだけを書く。コードに無い効果を、説明文や物語でほのめかさない。
・要望のほとんどが再現できない場合は、無理に作らない（応用能力の追加では fits=false にする）。

【名前・設定のルール（重要）】
・アニメ・漫画・ゲーム・小説・映画など、既存の作品の固有名詞（作品名・キャラクター名・技名・能力名・組織名・用語）を、能力名・技名・説明・物語に一切使わない。似せた名前（もじり・音だけ変えたもの）も避ける。
・プレイヤーの要望が既存作品の能力やキャラを指している場合は、その作品名や名前は出さず、「核になる発想」だけを取り出して、独自のファンタジー／SF的な世界観の、オリジナルの能力として作り直す。
・能力名・技名・原理の説明・フレーバーテキスト（lore）は、すべて独自に考えた名称と文章にする（例：「蒼流の環」「星屑の残響」「位相ずらし」のような、造語や一般的な言葉の組み合わせ）。
・能力者の設定は、特定の作品を連想させない、オリジナルの世界観（古い誓約・失われた技術・異界の法則など）で書く。`;
const IP_NAMES = /ワンピース|ONE\s*PIECE|ナルト|NARUTO|ドラゴンボール|ドラゴンボ|かめはめ波|元気玉|超サイヤ|サイヤ人|鬼滅|呼吸法?の型|ジョジョ|スタンド能力|ハンター[×xX]ハンター|ハンターハンター|念能力|発[・·]?絶[・·]?円|呪術廻戦|領域展開|無量空処|BLEACH|ブリーチ|卍解|斬魄刀|僕のヒーローアカデミア|ヒロアカ|ワンフォーオール|エヴァ|使徒|ポケモン|ポケットモンスター|ピカチュウ|ガンダム|ドラえもん|セーラームーン|プリキュア|進撃の巨人|巨人化|チェンソーマン|スラムダンク|鋼の錬金術師|錬金術師.{0,4}等価交換|フェアリーテイル|Fate|ブラックラグーン|とある魔術|レールガン|ソードアート|SAO|リゼロ|ドクターストーン|ハリー[・·]?ポッター|ホグワーツ|ロード[・·]?オブ|ジェダイ|フォース[のを]|ライトセーバー|スパイダーマン|アイアンマン|バットマン|スーパーマン|マーベル|ディズニー|ゼルダ|マリオ|ソニック|ファイナルファンタジー|ドラクエ|ドラゴンクエスト|メラゾーマ|ギガデイン|ホイミ|エクスカリバー|ミョルニル|グングニル/i;
const safeConcept = (t) => (IP_NAMES.test(String(t)) ? "要望を独自に再解釈した、オリジナルの異能" : clipStr(t, 60));
function scrub(v, fb) { const t = String(v == null ? "" : v); return IP_NAMES.test(t) ? fb : t; }

// ---------- AIへのお願い ----------
const API_DOC = `
【基本の考え方】
固有能力は「自分専用の小さな世界を、自分のコードで作る」ものです。ゲームが用意した部品を選ぶのではなく、変数・配列・オブジェクト・タイマーを使って、仕組み（魂のストック、召喚体、設置物、連鎖、状態異常…）をコードの中で自由に作ってください。
ゲーム本体に影響を与えられるのは、下の「命令」だけです（威力の合計には、階級ごとの上限があります）。

【コードの書き方】
各スキルの "code" は「async 関数の中身」だけを書く（function や () => {} で包まない。末尾で return しない）。引数 api だけが使える。
 ■ 情報
  api.aim … 狙った向き（ラジアン）／ api.rangeMul … 範囲の倍率（制約で縮む。自分でかけなくてよい）
  api.me() … { x, y, hp, maxHp, ang }（自分）／ api.enemies() … 敵の配列 [{ id, x, y, r, hp, maxHp, boss }]
  api.nearest(x, y, maxDist) … いちばん近い敵（いなければ null）。x,y を省略すると自分から
  api.time() … 発動してからの秒数／ api.rand() … 0〜1の乱数
 ■ 時間・反応
  await api.wait(秒) … 待つ（最大5秒）。連射・時間差・持続はこれで書く
  api.on(出来事, 関数) … 出来事に反応する：'kill'（敵を倒した。引数 {id,x,y,r,name,icon,color,maxHp,boss}）／ 'hurt'（攻撃を受けた。{amount,frac}）／ 'press'（そのスキルのキーを押した。{slot,ang}）／ 'tick'（毎フレーム。引数 dt 秒）
  api.end() … この発動を終える（持続する発動は、終わるとき必ず呼ぶ。呼ばなくても約12秒で終わる。常時スクリプトは戦闘の間ずっと続く）
 ■ 覚えておく入れ物
  api.store … 同じ固有能力のすべてのスキルで共有される、ふつうのオブジェクト（戦闘が終わると消える。20KBまで）。魂のストックなど、発動をまたぐ状態はここに置く
 ■ 描画（自由に絵を描ける）
  api.render(function (ctx, t) { ... }) … 毎フレーム呼ばれる。ctx は Canvas2D とほぼ同じ（座標はゲーム世界の座標。api.me() などの位置にそのまま描ける）。
   使える：save restore translate rotate scale beginPath closePath moveTo lineTo arc ellipse rect quadraticCurveTo bezierCurveTo fill stroke fillRect strokeRect fillText strokeText createLinearGradient createRadialGradient
   fillStyle strokeStyle lineWidth globalAlpha lineCap lineJoin font('bold 20px sans-serif' の形) textAlign shadowBlur shadowColor globalCompositeOperation('lighter' など)
   文字は16文字まで、命令は1回の描画で800個まで。画像は使えない（図形・線・色・数式で描く）。重すぎると描画を止められる
 ■ ゲームに影響する命令
  api.shot({ x, y, angle, speed, r, life, pierce, homing, mult, color, eff }) … 弾（speed 120〜900 / r 4〜30 / life 0.2〜3秒 / pierce 0〜4）
  api.hit(敵のid, mult, { eff }) … 敵1体を直接攻撃
  api.area(x, y, r, mult, { color, eff }) … 円の範囲攻撃（r 20〜260）
  api.line(x1, y1, x2, y2, 太さ, mult, { color, eff }) … 直線攻撃（長さ700まで・太さ8〜70）
  api.status(敵のid, { stun, slow, weaken, blind, curse }) … 敵にかける状態異常の秒数（stun最大3 / slow最大5 / weaken最大5 / blind最大4 / curse最大5。ボスには効きにくい。長いほど予算を使う）
  api.heal(割合) … 自分を回復（0〜0.12。1回の発動で合計25%まで）
  api.dash(dx, dy, 距離) … その向きに移動（1回の発動で合計520pxまで）
  api.popup(文字, 色) … 短い文字（12文字まで）を出す
・mult は「普通の攻撃何発分の威力か」。0.02〜2.5。1回の発動で使える mult の合計には、階級ごとの上限がある（超えた攻撃は無視される）。
  目安：階級1＝合計1.4 / 階級2＝2.2 / 階級3＝3.2 / 階級4＝4.6（弾は mult×(1+貫通数)、api.area は mult×3、api.line は mult×2.5 で消費）。上限を超えないよう、細かく何度も当てる設計にする。
・常時スクリプト（"passive": true）は、戦闘が始まると自動で始まり、戦闘が終わるまで続く（キーを押しても消費なし。'press' の出来事だけ届く）。攻撃の予算は約8秒ごとに満タンまで回復する。魂を溜める・周りを回る護衛を出し続ける、のような「常に働く仕組み」に使う。
・eff は敵にかかる状態：burn(燃焼) freeze(凍結) knockback(吹き飛ばし) stun(麻痺) poison(毒) weaken(弱体) shatter(防御破壊) blind(目眩) gravity(引き寄せ) など。最大3つ。
・使ってはいけないもの：window / document / fetch / setTimeout / eval / Function / constructor / import / Date など（ブラウザの機能は何も無い隔離環境で動く）。
  終わらないループ（while(true) や for(;;)）は禁止。繰り返しは回数を決め、間に await api.wait() を入れる。
・敵がいないときも壊れないこと（api.nearest が null のことがある）。
・色は '#rrggbb'。コードは読みやすく（1つ60〜2500文字くらい）。

【例：魂を溜めて、あとで召喚する（2つのスキルが api.store を共有する）】
 passive（魂を溜め、周りに描く）：
  api.store.souls = api.store.souls || [];
  api.on('kill', function (e) { if (api.store.souls.length < 5) api.store.souls.push({ icon: e.icon, color: e.color, r: e.r }); api.popup('魂+' + api.store.souls.length, '#cfa8ff'); });
  api.render(function (ctx, t) { api.store.souls.forEach(function (s, i) { const m = api.me(); ctx.fillStyle = s.color; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(m.x + Math.cos(t + i) * 40, m.y + Math.sin(t + i) * 40, 6, 0, 6.3); ctx.fill(); }); });
 active（魂を1つ使って召喚し、攻撃させる）：
  const s = (api.store.souls || []).shift(); if (!s) { api.popup('魂が無い', '#ff8a8a'); return; }
  api.render(function (ctx) { const m = api.me(); ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(m.x + 60, m.y, s.r, 0, 6.3); ctx.fill(); ctx.font = '20px sans-serif'; ctx.fillText(s.icon, m.x + 50, m.y); });
  for (let i = 0; i < 4; i++) { const t = api.nearest(); if (t) api.hit(t.id, 0.3); await api.wait(0.3); }
  api.end();`;

const CONSTRAINT_DOC = Object.keys(CONSTRAINTS).map(k => `  - ${k}（${CONSTRAINTS[k].name}・重さ${CONSTRAINTS[k].w}）：${CONSTRAINTS[k].desc}`).join("\n");

function createPrompt() {
    return `あなたは、クイズ×RPG「SchoolBattle」の「固有能力」を設計し、戦闘中に動くコードまで書くゲームデザイナーです。
プレイヤーが望む「能力の原理」（例：水を操る能力）から、1人1つだけの固有能力を作ります。
・1つの原理から、基本能力1つ（基本の使い方）と応用能力3つ（原理を別の形に広げたもの。それぞれ動きがはっきり違う）を作る。
・原理はゲームのバランスを壊さない範囲にする。「何でもできる」「時間を止める」「無敵」「即死」のような万能・無制限な原理は、近い形に丸める（できること／できないことを明記する）。
・「制約」が強いほど威力が上がる仕組み。制約は下の一覧から選ぶ（それ以外は不可）。基本能力は重さ合計2以上、応用能力は重さ合計3以上（同じ系統は1つだけ）。制約の理由を "lore"（1文）で物語にする。
・階級(tier)：基本能力は1か2、応用能力は2〜4。強い動きほど階級を上げる。
・「常時スクリプト」（"passive": true）は、戦闘の間ずっと働く仕組み（魂を溜める・護衛を出し続ける等）。能力のテーマに合うときだけ使い、4つのうち多くても2つまで。キーで発動するスキル（passive でない）を、必ず2つ以上は入れる。
・能力のテーマに合う独自の仕組みを、api.store・api.on・api.render で、できるだけ自由に作る。ゲーム側に無い仕組み（魂のストック、召喚体、設置物、独自の状態異常など）は、コードの中で自分で作ってよい。
${IP_RULE}
${API_DOC}

【制約の一覧】
${CONSTRAINT_DOC}

【出力】JSONだけを出力（前置き・コードフェンス禁止）。
{
 "name": "能力名（10字以内）",
 "principle": "この能力の原理（60字以内）",
 "can": ["できること", ... 3〜5個],
 "cannot": ["できないこと", ... 2〜4個],
 "keywords": ["原理に関わる単語", ... 5〜10個（後から応用能力を足すときの判定に使う）],
 "element": "fire|water|wind|earth|thunder|ice|venom のどれか。当てはまらなければ null",
 "lore": "この能力者の誓約の物語（1〜2文）",
 "skills": [
   { "role": "base", "name": "技名", "desc": "効果の説明（40字）", "tier": 1, "passive": false, "constraints": ["slow","heavy"], "lore": "制約の理由", "unsupported": [], "code": "…" },
   { "role": "app", ... }, { "role": "app", ... }, { "role": "app", ... }
 ]
}
"code" は JSON の文字列なので、改行は \\n、引用符は \\" とエスケープすること。`;
}
function extendPrompt(ab) {
    return `あなたは、クイズ×RPG「SchoolBattle」の「固有能力」の応用能力を追加で設計し、戦闘中に動くコードまで書くゲームデザイナーです。
次の固有能力に、プレイヤーが「応用能力」を1つ追加したいと言っています。
【この固有能力】名前：${ab.name}／原理：${ab.principle}
できること：${(ab.can || []).join("、")}
できないこと：${(ab.cannot || []).join("、")}
すでにある技：${(ab.existing || []).join("、")}
・まず、要望が「この原理から自然に導ける応用」かを厳しめに判定する。原理の範囲を越える（できないことに触れる／別の原理が必要）なら fits=false とし、理由を一言で述べる。
・fits=true のときだけ、skill を作る。制約は下の一覧から、重さ合計3以上（同じ系統は1つだけ）。階級は2〜4。すでにある技と動きが被らないようにする。
${IP_RULE}
${API_DOC}

【制約の一覧】
${CONSTRAINT_DOC}

【出力】JSONだけを出力。
{ "fits": true または false, "reason": "判定の理由（40字）", "skill": { "name": "技名", "desc": "効果の説明（40字）", "tier": 3, "passive": false, "constraints": ["veryslow","narrow"], "lore": "制約の理由", "unsupported": [], "code": "…" } }
fits=false のときは skill を省略する。`;
}

function extractJson(text) {
    const t = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}
async function callClaude(system, user, maxTokens) {
    // Gemini（Google AI Studio）か Claude のうち、キーがある方を使う（AiClient）。どちらも無ければ null → 呼び出し側が簡易版で作る
    const text = await AiClient.callText({ system: system, user: user, maxTokens: maxTokens, timeoutMs: 60000, claudeModel: MODEL, geminiModelEnv: "GEMINI_INNATE_MODEL", tag: "Innate" });
    return text == null ? null : extractJson(text);
}

// ---------- APIキーが無い／コードが検査を通らなかったときの、定型コード ----------
function pickElement(text) { for (const [re, el] of KW_ELEM) if (re.test(text)) return el; return undefined; }
function stemOf(text) { const r = stemRaw(text); return IP_NAMES.test(r) ? "異能" : r; }
function stemRaw(text) { return clipStr(String(text).replace(/(を操る|を使う|を扱う|を司る|の)?(能力|力|チカラ)?(にしたい|が欲しい|がほしい|にする|です|だ)?[。、\s].*$/, "").replace(/(を操る|を使う|を扱う|を司る|の)?(能力|力|チカラ)?(にしたい|が欲しい|がほしい|にする)?$/, ""), 6) || "異能"; }
function T(code, color, eff) { return code.replace(/__COLOR__/g, color).replace(/__EFF__/g, JSON.stringify(eff)); }
const TEMPLATES = {
    volley: `const eff = __EFF__;
for (let i = 0; i < 4; i++) {
  const t = api.nearest();
  const a = t ? Math.atan2(t.y - api.me().y, t.x - api.me().x) : api.aim;
  api.shot({ angle: a + (i - 1.5) * 0.12, speed: 460, r: 11, life: 1.4, homing: true, mult: 0.26, color: '__COLOR__', eff: eff });
  await api.wait(0.14);
}`,
    pulse: `const eff = __EFF__;
const m = api.me();
for (let i = 0; i < 3; i++) {
  api.area(m.x, m.y, 90 + i * 45, 0.28, { color: '__COLOR__', eff: eff });
  await api.wait(0.28);
}
api.popup('波動', '__COLOR__');`,
    chain: `const eff = __EFF__;
const hitIds = [];
let from = api.me();
for (let i = 0; i < 4; i++) {
  const cand = api.enemies().filter(e => !hitIds.includes(e.id));
  let best = null, bd = 420;
  cand.forEach(e => { const d = Math.hypot(e.x - from.x, e.y - from.y); if (d < bd) { bd = d; best = e; } });
  if (!best) break;
  hitIds.push(best.id);
  api.line(from.x, from.y, best.x, best.y, 18, 0.3, { color: '__COLOR__', eff: eff });
  from = best;
  await api.wait(0.16);
}`,
    rush: `const eff = __EFF__;
const a = api.aim, c = Math.cos(a), s = Math.sin(a);
const m = api.me();
api.dash(c, s, 200);
await api.wait(0.1);
const n = api.me();
api.line(m.x, m.y, n.x + c * 80, n.y + s * 80, 46, 0.5, { color: '__COLOR__', eff: eff });
api.heal(0.04);
api.popup('突進', '__COLOR__');`,
    rain: `const eff = __EFF__;
const t = api.nearest();
const cx = t ? t.x : api.me().x + Math.cos(api.aim) * 240;
const cy = t ? t.y : api.me().y + Math.sin(api.aim) * 240;
for (let i = 0; i < 6; i++) {
  api.area(cx + (api.rand() - 0.5) * 170, cy + (api.rand() - 0.5) * 170, 60, 0.2, { color: '__COLOR__', eff: eff });
  await api.wait(0.2);
}`
};
TEMPLATES.soulsCollect = `api.store.souls = api.store.souls || [];
api.on('kill', function (e) {
  if (api.store.souls.length < 5) api.store.souls.push({ icon: e.icon, color: e.color, r: Math.min(26, e.r) });
  api.popup('魂+' + api.store.souls.length, '__COLOR__');
});
api.render(function (ctx, t) {
  const m = api.me();
  api.store.souls.forEach(function (s, i) {
    ctx.globalAlpha = 0.7; ctx.fillStyle = s.color; ctx.beginPath();
    ctx.arc(m.x + Math.cos(t * 1.6 + i * 1.26) * 44, m.y + Math.sin(t * 1.6 + i * 1.26) * 44, 6, 0, 6.3); ctx.fill();
  });
});`;
TEMPLATES.soulsSummon = `const eff = __EFF__;
const s = (api.store.souls || []).shift();
if (!s) { api.popup('魂が無い', '#ff8a8a'); return; }
api.render(function (ctx, t) {
  const m = api.me();
  ctx.globalAlpha = 0.85; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(m.x + 60, m.y + Math.sin(t * 6) * 6, s.r, 0, 6.3); ctx.fill();
  ctx.globalAlpha = 1; ctx.font = '20px sans-serif'; ctx.fillText(s.icon || '', m.x + 50, m.y + 6);
});
for (let i = 0; i < 4; i++) {
  const t = api.nearest();
  if (t) api.hit(t.id, 0.3, { eff: eff });
  await api.wait(0.3);
}
api.end();`;
const APP_ORDER = ["pulse", "chain", "rush", "rain"];
const NAME_SUFFIX = { volley: "弾", pulse: "波", chain: "連鎖", rush: "突進", rain: "雨", soulsCollect: "の魂集め", soulsSummon: "の呼び戻し" };
function templateSkill(kind, role, stem, element, loreHint) {
    const color = COLOR_BY_ELEM[element] || "#8fd3ff", eff = EFF_BY_ELEM[element] || [];
    const tier = role === "base" ? 1 : (kind === "rain" ? 4 : (kind === "chain" || kind === "soulsSummon") ? 3 : 2);
    return { passive: kind === "soulsCollect", name: stem + NAME_SUFFIX[kind], desc: { soulsCollect: "倒した敵の魂を溜める（最大5）", soulsSummon: "魂を1つ使い、その姿の召喚体が攻撃する", volley: "追尾する弾を4連射", pulse: "自分の周りに3連の波動", chain: "近くの敵へ連鎖して攻撃", rush: "前方へ突進して斬り、少し回復", rain: "敵の頭上に範囲攻撃を降らせる" }[kind], tier: tier, constraints: role === "base" ? ["slow", "heavy"] : ["veryslow", "heavy", "narrow"], lore: loreHint || "強い力には、重い代償がつきまとう。", code: T(TEMPLATES[kind], color, eff) };
}
function localCreate(concept) {
    const element = pickElement(concept), stem = stemOf(concept);
    if (/魂|霊|召喚|死者|使い魔|ゴースト|屍/.test(concept)) {        // 魂を溜めて召喚する、のようなテーマは、専用の定型にする
        return {
            name: stem + "の力", principle: safeConcept(concept) + "（簡易版：AIが使えないため、定型の動きで作りました）",
            can: ["倒した敵の魂を溜める", "溜めた魂で召喚体を呼ぶ"], cannot: ["魂は戦闘が終わると消える", "無制限の召喚"],
            keywords: ["魂", "霊", "召喚", "死者"], element: element, lore: "失われたものを呼び戻す代わりに、重い代償を負った。",
            skills: [templateSkill("soulsCollect", "base", stem, element), templateSkill("soulsSummon", "app", stem, element), templateSkill("pulse", "app", stem, element), templateSkill("chain", "app", stem, element)]
        };
    }
    return {
        name: stem + "の力", principle: safeConcept(concept) + "（簡易版：AIが使えないため、定型の動きで作りました）",
        can: [stem + "に関わる攻撃", "近距離〜中距離の操作"], cannot: ["原理に無い力は使えない", "無制限・即死のような力"],
        keywords: [stem].concat((EFF_BY_ELEM[element] || [])).slice(0, 5), element: element, lore: "この力を得る代わりに、重い代償を負った。",
        skills: [templateSkill("volley", "base", stem, element)].concat(APP_ORDER.slice(0, 3).map(k => templateSkill(k, "app", stem, element)))
    };
}
function localExtend(text, ab) {
    const t = String(text);
    const kws = (ab.keywords || []).concat(ab.can || []).map(x => String(x)).filter(x => x.length >= 1);
    const el = ab.element, elRe = (KW_ELEM.find(x => x[1] === el) || [null])[0];
    const fits = kws.some(k => t.includes(k)) || (elRe && elRe.test(t));
    if (!fits) return { fits: false, reason: "原理（" + clipStr(ab.principle, 24) + "）と関係が薄い要望です" };
    const kind = /突進|ダッシュ|移動|駆け|瞬間/.test(t) ? "rush" : /連鎖|雷|つなが|飛び移/.test(t) ? "chain" : /雨|降|降ら|上から/.test(t) ? "rain" : /弾|撃|飛ばす|発射/.test(t) ? "volley" : "pulse";
    const sk = templateSkill(kind, "app", clipStr(t, 4) || stemOf(ab.name), el, "要望に合わせて、原理の範囲で形にした。");
    sk.name = clipStr(t.replace(/[。、\s].*$/, ""), 8) || sk.name;
    return { fits: true, reason: "原理の範囲で作れます（簡易版）", skill: sk };
}

// ---------- 窓口 ----------
function pidOf(m) { const pid = String((m && m.playerId) || ""); return /^[A-Za-z0-9]{4,12}$/.test(pid) ? pid.toUpperCase() : null; }
function cleanText(v) { return String(v || "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, MAX_TEXT); }

async function create(m) {
    const pid = pidOf(m); if (!pid) return { ok: false, reason: "invalid" };
    const text = cleanText(m.text); if (text.length < 4) return { ok: false, reason: "too_short" };
    const q = checkQuota(pid, "create", CREATE_LIMIT); if (!q.ok) return q;
    const u = q.u; u.busy = true; u.lastAt = Date.now();
    // Debug: Check if API keys are available
    console.log("[Innate] GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
    console.log("[Innate] ANTHROPIC_API_KEY exists:", !!process.env.ANTHROPIC_API_KEY);
    console.log("[Innate] AI Provider:", AiClient.provider());
    try {
        const raw = await callClaude(createPrompt(), "プレイヤーが望む能力の原理：\n" + text, 6000);
        const viaAI = !!raw;
        console.log("[Innate] AI result:", viaAI ? "SUCCESS" : "FAILED (using local)");
        const src = raw || localCreate(text);
        const ab = sanitizeAbility(src, text);
        if (!ab.element) ab.element = pickElement(text);
        if (!ab.principle) ab.principle = safeConcept(text);
        const local = localCreate(text), stem = stemOf(text);
        const list = Array.isArray(src.skills) ? src.skills : [];
        const notes = [];
        const skills = [];
        const want = ["base", "app", "app", "app"];
        for (let i = 0; i < 4; i++) {
            const r = sanitizeSkill(list[i], want[i], ab);
            if (r && r.skill) {
                skills.push(r.skill);
                const un = clipList(list[i].unsupported, 3, 40);
                if (un.length) notes.push((want[i] === "base" ? "基本能力" : "応用能力" + i) + "「" + r.skill.name + "」で再現できなかった部分：" + un.join("／"));
            }
            else {
                const sk = sanitizeSkill(local.skills[i], want[i], ab);
                skills.push(sk.skill);
                if (viaAI) notes.push((want[i] === "base" ? "基本能力" : "応用能力" + i) + "：AIのコードが検査を通らなかった（" + ((r && r.error) || "形式エラー") + "）ので、定型の動きに差し替えました");
            }
        }
        u.count += 1;
        return { ok: true, ai: viaAI, ability: Object.assign(ab, { base: skills[0], apps: skills.slice(1) }), notes: notes, left: Math.max(0, CREATE_LIMIT - u.count) };
    } catch (e) {
        console.error("[Innate] create failed:", e);
        return { ok: false, reason: "server_error" };
    } finally { u.busy = false; }
}

async function extend(m) {
    const pid = pidOf(m); if (!pid) return { ok: false, reason: "invalid" };
    const text = cleanText(m.text); if (text.length < 4) return { ok: false, reason: "too_short" };
    const a = m.ability && typeof m.ability === "object" ? m.ability : null; if (!a) return { ok: false, reason: "invalid" };
    const ab = { name: clipStr(a.name, 14), principle: clipStr(a.principle, 120), can: clipList(a.can, 5, 30), cannot: clipList(a.cannot, 4, 30), keywords: clipList(a.keywords, 10, 12), existing: clipList(a.existing, 6, 14), element: ELEM_IDS.includes(a.element) ? a.element : undefined };
    if (!ab.principle) return { ok: false, reason: "invalid" };
    const q = checkQuota(pid, "extend", EXTEND_LIMIT); if (!q.ok) return q;
    const u = q.u; u.busy = true; u.lastAt = Date.now();
    try {
        let raw = await callClaude(extendPrompt(ab), "追加したい応用能力：\n" + text, 3500), viaAI = !!raw;
        if (!raw) raw = localExtend(text, ab);
        u.count += 1;
        if (!raw.fits) return { ok: true, ai: viaAI, fits: false, reason: clipStr(raw.reason, 80) || "原理に合いません", left: Math.max(0, EXTEND_LIMIT - u.count) };
        let r = sanitizeSkill(raw.skill, "app", ab), note = "";
        if (!r || !r.skill) {
            const l = localExtend(text, ab);       // AIのコードが検査を通らないときは、定型の動きで作る
            r = l.skill ? sanitizeSkill(l.skill, "app", ab) : null;
            note = "AIのコードが検査を通らなかったので、定型の動きにしました";
            if (!r || !r.skill) return { ok: true, ai: viaAI, fits: false, reason: "うまく作れませんでした。言い方を変えてもう一度", left: Math.max(0, EXTEND_LIMIT - u.count) };
        }
        const un = clipList(raw.skill && raw.skill.unsupported, 3, 40);
        if (un.length) note = (note ? note + "／" : "") + "再現できなかった部分：" + un.join("／");
        return { ok: true, ai: viaAI, fits: true, reason: clipStr(raw.reason, 80), skill: r.skill, note: note, left: Math.max(0, EXTEND_LIMIT - u.count) };
    } catch (e) {
        console.error("[Innate] extend failed:", e);
        return { ok: false, reason: "server_error" };
    } finally { u.busy = false; }
}

module.exports = { create, extend, checkCode, sanitizeSkill, localCreate, localExtend, CREATE_LIMIT, EXTEND_LIMIT, MODEL };
