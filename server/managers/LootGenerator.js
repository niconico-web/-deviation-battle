// ============================================================
// LootGenerator.js ― サバイバルエリアの宝箱・ボスが落とす装備を作る
//  装備の作り方（武器・防具・アクセサリー・オーブ）は、クライアントの hw-weapons.js / armor.js /
//  accessories.js / weapons.js にある。同じ関数をそのまま読み込んで使う（作り方が二重にならず、
//  できあがる装備は普通のドロップと同じ形式になる）。
// ============================================================
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const CLIENT_JS = path.join(__dirname, "..", "..", "client", "js");

const sb = { localStorage: { getItem: () => null, setItem() {} }, console: { log() {}, warn() {}, error() {} }, document: { getElementById: () => null, addEventListener() {} }, navigator: {}, setTimeout: setTimeout, setInterval: () => 0 };
sb.window = sb; vm.createContext(sb);
let ok = true;
["elements.js", "hw-weapons.js", "armor.js", "accessories.js", "weapons.js"].forEach((f) => {
    try { vm.runInContext(fs.readFileSync(path.join(CLIENT_JS, f), "utf8"), sb); }
    catch (e) { ok = false; console.warn("[Loot] failed to load " + f + ": " + e.message); }
});

const ILVL = { 1: 16, 2: 20, 3: 24 };                       // ゾーンの危険度ごとの装備レベルの目安
const RAR_ORDER = ["normal", "magic", "rare", "epic", "legendary"];
const ORB_BY_TIER = { 1: ["tier1", "tier2"], 2: ["tier2", "tier3"], 3: ["tier3", "tier4"] };

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// opts: { tier(1-3), minRarity, legend(0〜1: レジェンドを確定で出す確率), kinds: {weapon,armor,acc,orb の重み} }
function rollItem(opts) {
    opts = opts || {};
    if (!ok || !sb.HW) return null;
    const tier = Math.max(1, Math.min(3, opts.tier | 0 || 1));
    const ilvl = ILVL[tier] + Math.floor(Math.random() * 3);
    const w = Object.assign({ weapon: 0.35, armor: 0.3, acc: 0.2, orb: 0.15 }, opts.kinds || {});
    let r = Math.random() * (w.weapon + w.armor + w.acc + w.orb), kind = "orb";
    if ((r -= w.weapon) < 0) kind = "weapon"; else if ((r -= w.armor) < 0) kind = "armor"; else if ((r -= w.acc) < 0) kind = "acc";
    const minRarity = opts.minRarity || "normal";
    const forceLegend = opts.legend && Math.random() < opts.legend;
    try {
        if (kind === "weapon") return { kind: kind, data: sb.HW.roll({ ilvl: ilvl, minRarity: forceLegend ? "legendary" : minRarity, luck: tier * 0.25, source: "survival" }) };
        if (kind === "armor") return { kind: kind, data: sb.SBArmor.roll({ ilvl: ilvl, minRarity: forceLegend ? "legendary" : minRarity, luck: tier * 0.25 }) };
        if (kind === "acc") return { kind: kind, data: sb.SBAcc.roll({ ilvl: ilvl, minRarity: forceLegend ? "legendary" : minRarity, luck: tier * 0.25 }) };
        const t = Math.random() < (opts.legend ? 0.06 : 0.01) ? "tier5" : (opts.minRarity && RAR_ORDER.indexOf(opts.minRarity) >= 3 ? pick(["tier3", "tier4"]) : pick(ORB_BY_TIER[tier]));
        const orb = sb.createOrb(t);
        return orb ? { kind: "orb", data: orb } : null;
    } catch (e) { console.warn("[Loot] roll failed:", e.message); return null; }
}
// 神話の武器をそのまま作る（id 省略時は、専用のもの以外からランダム）
function makeMythic(id) {
    if (!ok || !sb.HW || !sb.HW.MYTHICS) return null;
    if (!id) { const ids = Object.keys(sb.HW.MYTHICS).filter((k) => !sb.HW.MYTHICS[k].exclusive && k !== "legend_unbreakable"); id = ids[Math.floor(Math.random() * ids.length)]; }
    const w = sb.HW.makeMythic(id); if (!w) return null;
    w.source = "survival";
    return { kind: "weapon", data: w };
}
module.exports = { rollItem, makeMythic, mythicIds: () => (sb.HW && sb.HW.MYTHICS) ? Object.keys(sb.HW.MYTHICS) : [], ready: () => ok && !!sb.HW };
