// ============================================================
// ArtifactManager.js ― 神器（サバイバルエリアだけで使える、7つの特別な武器）
//   ・神器は全部で7つ。それぞれ世界に1つだけ（持っている人の分も含めて）
//   ・最初は地図の外側の神殿に安置されていて、守護者を倒すと地面に落ちる → 拾った人のもの
//   ・持ち主が倒されると、その場に落とす。ログアウト／退出すると神殿へ戻る
//   ・国は、神器を城に「奉納」して国宝にできる。国宝を持つ国は、保護期間が無視され、費用なしで宣戦布告される（戦争のきっかけ）
//   ・R キーで、強力な技を撃てる（技そのものは SurvivalCombat）
//  状態は server/data/artifacts.json に保存
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const SW = require("../../client/js/survival-world.js");

const FILE = path.join(__dirname, "..", "data", "artifacts.json");

const ARTS = [
    { id: "phoenix", name: "フェニックスの翼", icon: "🔥", cd: 30, desc: "敵に超特大の火球を放つ。当たると大爆発を起こし、燃やし尽くす" },
    { id: "thunder", name: "雷神の槌", icon: "⚡", cd: 35, desc: "空から無数の雷を落とし、敵を痺れさせる" },
    { id: "frost", name: "氷結の王冠", icon: "❄️", cd: 35, desc: "周囲を一瞬で凍らせる超広範囲の冷気。二度、波が走る" },
    { id: "earth", name: "大地の心臓", icon: "🌋", cd: 32, desc: "前方へ大地の衝撃波を連続で走らせ、敵を吹き飛ばして気絶させる" },
    { id: "void", name: "虚空の鏡", icon: "🌀", cd: 40, desc: "敵を引きずり込む漆黒の渦を作り、最後に爆縮させる" },
    { id: "grail", name: "生命の聖杯", icon: "🏆", cd: 45, desc: "味方全員を回復し、障壁で守る" },
    { id: "hourglass", name: "時の砂時計", icon: "⏳", cd: 50, desc: "周囲の時を止めて敵を動けなくする。自分は加速する" }
];
const DROP_RETURN_S = 1800;       // 拾われないまま30分たつと、神殿へ戻る
<<<<<<< HEAD
const PICKUP_R = 100, VAULT_R = 560;
=======
const PICKUP_R = 100, VAULT_R = 220;
>>>>>>> 95e03e4fbafbcb50b95ec212225dec0e225cd2d3

let db = { arts: {} };
try { const j = JSON.parse(fs.readFileSync(FILE, "utf-8")); if (j && j.arts) db = j; } catch (e) { /* 初回 */ }
ARTS.forEach(a => { if (!db.arts[a.id]) db.arts[a.id] = { state: "shrine" }; });
// サーバーが止まっていた間、持ち主は全員いなくなっている → 神殿へ戻す
ARTS.forEach(a => { if (db.arts[a.id].state === "held") db.arts[a.id] = { state: "shrine" }; });

let timer = null, ctx = null, version = 1;
function save() {
    version++;
    if (timer) return;
    timer = setTimeout(flush, 1500); if (timer.unref) timer.unref();
}
function flush() {
    timer = null;
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE + ".tmp", JSON.stringify(db), "utf-8"); fs.renameSync(FILE + ".tmp", FILE); }
    catch (e) { console.error("[Artifact] save failed:", e.message); }
}
["exit", "SIGINT", "SIGTERM"].forEach(sig => process.on(sig, () => { try { if (timer) { clearTimeout(timer); flush(); } } catch (e) { /* 終了時のみ */ } if (sig !== "exit") process.exit(0); }));

const now = () => Date.now() / 1000;
const idx = (id) => ARTS.findIndex(a => a.id === id);
const def = (id) => ARTS.find(a => a.id === id);
const st = (id) => db.arts[id];
const hyp = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function init(c) { ctx = c; }

// 状態の一覧（画面用）：[番号, 状態, x, y, 国ID, 持ち主の名前]  状態：0=神殿 1=持ち主あり 2=落ちている 3=国宝
function publicList() {
    return ARTS.map((a, i) => {
        const s = st(a.id), sh = SW.SHRINES[i] || { x: 0, y: 0 };
        if (s.state === "held") return [i, 1, Math.round(s.x || 0), Math.round(s.y || 0), s.nid || 0, s.name || ""];
        if (s.state === "dropped") return [i, 2, Math.round(s.x), Math.round(s.y), 0, ""];
        if (s.state === "vault") return [i, 3, 0, 0, s.nid || 0, ""];
        return [i, 0, sh.x, sh.y, 0, ""];
    });
}
function summary() {
    return ARTS.map((a, i) => Object.assign({ idx: i, id: a.id, name: a.name, icon: a.icon, desc: a.desc, cd: a.cd }, { state: st(a.id).state, holder: st(a.id).name || "", nid: st(a.id).nid || 0 }));
}
function setHeld(P, id) {
    st(id).state = "held"; st(id).pid = P.pid; st(id).name = P.name; st(id).nid = P.nid || 0; st(id).x = P.x; st(id).y = P.y;
    P.art = id; P.artCd = P.artCd || 0;
    save();
}
function trackHolder(P) { if (P.art && st(P.art)) { st(P.art).x = P.x; st(P.art).y = P.y; st(P.art).nid = P.nid || 0; } }

// 「使う」キー：拾う／奉納／取り出す
function useAt(P, t, nationOf, capitalOf) {
    // 落ちている神器を拾う
    if (!P.art) {
        for (const a of ARTS) {
            const s = st(a.id);
            if (s.state === "dropped" && t >= (s.freeAt || 0) && hyp(P, s) < PICKUP_R) {
                setHeld(P, a.id);
                ctx.feed("✨ " + P.name + " が「" + a.name + "」を手にした！");
                ctx.notice(P, "✨ 「" + a.name + "」を手に入れた！ R キーで使える");
                return true;
            }
        }
    }
    const n = P.nid && nationOf ? nationOf(P.nid) : null;
    if (!n) return false;
    const cap = capitalOf(n);
    if (hyp(P, cap) > VAULT_R) return false;
    if (P.art) {                                                    // 自分の国の城に奉納
        const a = def(P.art), s = st(P.art);
        s.state = "vault"; s.nid = n.id; delete s.pid; delete s.name;
        P.art = null; save();
        ctx.feed("🏰 「" + n.name + "」が神器「" + a.name + "」を国宝として奉納した！");
        ctx.notice(P, "🏰 奉納しました。他国から狙われます");
        return true;
    }
    const mine = ARTS.find(a => st(a.id).state === "vault" && st(a.id).nid === n.id);   // 国宝を借りる
    if (mine) {
        setHeld(P, mine.id);
        ctx.notice(P, "👑 国宝「" + mine.name + "」を持ち出した。奉納し直すと国宝に戻る");
        return true;
    }
    return false;
}
function onDeath(P, t) {
    if (!P.art) return;
    const a = def(P.art), s = st(P.art);
    s.state = "dropped"; s.x = P.x; s.y = P.y; s.freeAt = t + 3; s.at = t; delete s.pid; delete s.name; delete s.nid;
    P.art = null; save();
    ctx.feed("💥 " + P.name + " が倒され、「" + a.name + "」を落とした！");
}
function onLeave(P) {
    if (!P.art) return;
    const a = def(P.art);
    db.arts[P.art] = { state: "shrine" }; P.art = null; save();
    ctx.feed("🕊 「" + a.name + "」は神殿へ戻っていった");
}
// 守護者が倒された
function guardianKilled(idx0, x, y) {
    const a = ARTS[idx0]; if (!a || st(a.id).state !== "shrine") return;
    db.arts[a.id] = { state: "dropped", x: x, y: y, freeAt: now() + 1, at: now() };
    save();
    ctx.feed("🌟 「" + a.name + "」の守護者が倒れ、神器が姿を現した！");
}
const shrineOpen = (i) => !!ARTS[i] && st(ARTS[i].id).state === "shrine";
function vaultOf(nid) { return ARTS.filter(a => st(a.id).state === "vault" && st(a.id).nid === nid).map(a => a.id); }
// 国が滅びたとき：国宝は征服国へ（いなければ神殿へ）
function transferVault(fromNid, toNid) {
    vaultOf(fromNid).forEach(id => {
        if (toNid) { db.arts[id] = { state: "vault", nid: toNid }; } else db.arts[id] = { state: "shrine" };
    });
    save();
}
function holderPids() { return ARTS.filter(a => st(a.id).state === "held").map(a => st(a.id).pid); }
function tick(t) {
    ARTS.forEach(a => { const s = st(a.id); if (s.state === "dropped" && t - (s.at || t) > DROP_RETURN_S) { db.arts[a.id] = { state: "shrine" }; save(); ctx.feed("🕊 地に落ちていた「" + a.name + "」は神殿へ戻っていった"); } });
}

module.exports = { ARTS, def, idx, init, publicList, summary, useAt, onDeath, onLeave, guardianKilled, shrineOpen, vaultOf, transferVault, trackHolder, tick, holderPids, version: () => version, flush };
