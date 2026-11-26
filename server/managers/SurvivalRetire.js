// SurvivalRetire.js ― サバイバルエリア（と、その中の「国」「神器」）を廃止したときの、一度きりの後始末
//   【なぜ】サバイバルエリアは、装備の預かり・国庫・店の在庫と元手・貿易船の積み荷など、プレイヤーの持ち物を抱えていた。
//           機能を消しても、それらが消えてしまわないように、サーバーの起動時に、持ち主の「受け取り箱」へ返す。
//   【しくみ】survival.json / nations.json / artifacts.json を読む → 返す → 空にして保存する（空にした状態が Supabase にも同期される）。
//           空になったあとは何もしない（何度起動しても、二重に返すことはない）。
"use strict";
const fs = require("fs");
const path = require("path");
const Market = require("./MarketManager");

const DIR = path.join(__dirname, "..", "data");
const f = n => path.join(DIR, n);
function readJson(n) { try { return JSON.parse(fs.readFileSync(f(n), "utf-8")); } catch (e) { return null; } }
function writeJson(n, v) {
    try { fs.writeFileSync(f(n) + ".tmp", JSON.stringify(v), "utf-8"); fs.renameSync(f(n) + ".tmp", f(n)); }
    catch (e) { console.error("[SurvivalRetire] write failed:", n, e.message); return false; }
    return true;
}
const isPid = p => typeof p === "string" && p.length > 0;

function returnCarried() {      // 預かり中の装備
    const j = readJson("survival.json"); let n = 0;
    if (j && j.sessions) Object.keys(j.sessions).forEach(pid => {
        if (Market.returnItems(pid, j.sessions[pid].items, "サバイバルエリアの廃止にともない、預かっていた装備をお返しします")) n++;
    });
    if (j) writeJson("survival.json", { sessions: {} });
    return n;
}
function refundPlot(p, why) {      // 店・拠点：元手のコインと、在庫の商品
    if (!p || !isPid(p.owner)) return 0; let n = 0;
    if (p.bank >= 1 && Market.pushCoinsMail(p.owner, Math.floor(p.bank), "サバイバルエリアの廃止：「" + (p.name || "店") + "」の元手をお返しします")) n++;
    if (Array.isArray(p.stock) && p.stock.length) {
        if (Market.returnItems(p.owner, p.stock.map(s => ({ kind: s.kind, data: s.data, eq: null })), "サバイバルエリアの廃止：「" + (p.name || "店") + "」の在庫をお返しします")) n++;
    }
    return n;
}
function refundNations() {      // 国庫（王へ）・店の元手と在庫（持ち主へ）・航行中の貿易船の積み荷（出した国の王へ）
    const j = readJson("nations.json"); if (!j || typeof j !== "object") return 0; let n = 0;
    const nations = j.nations || {};
    Object.keys(nations).forEach(id => {
        const nt = nations[id];
        if (nt && isPid(nt.ruler) && nt.treasury >= 1 && Market.pushCoinsMail(nt.ruler, Math.floor(nt.treasury), "サバイバルエリアの廃止：「" + (nt.name || "国") + "」の国庫をお返しします")) n++;
        ((nt && nt.plots) || []).forEach(p => { n += refundPlot(p); });
    });
    (j.free || []).forEach(p => { n += refundPlot(p); });
    (j.ships || []).forEach(sh => {
        const nt = nations[sh.from];
        if (nt && isPid(nt.ruler) && sh.cargo >= 1 && Market.pushCoinsMail(nt.ruler, Math.floor(sh.cargo), "サバイバルエリアの廃止：航行中だった貿易船の積み荷をお返しします")) n++;
    });
    writeJson("nations.json", {});
    return n;
}
function run() {
    try {
        const a = returnCarried(), b = refundNations();
        if (fs.existsSync(f("artifacts.json"))) writeJson("artifacts.json", {});      // 神器は、サバイバルエリアの中だけの物（持ち主の持ち物ではない）
        if (a || b) console.log("[SurvivalRetire] returned carried gear to " + a + " players, refunded " + b + " nation/shop items");
    } catch (e) { console.error("[SurvivalRetire] failed:", e.message); }
}
module.exports = { run };
