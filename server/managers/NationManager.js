// ============================================================
// NationManager.js ― サバイバルエリアの「国」のしくみ（建国・領地・税・店・貿易船・同盟・戦争）
//
//  ・国のデータは server/data/nations.json に保存する（サーバーが再起動しても国は残る＝半永久）
//  ・戦闘・移動・ダメージの計算は SurvivalManager（サーバー）が行う。ここは「誰が誰の味方か」「領地の持ち主」
//    「国庫」「貿易船」「侵略度」などの状態を持ち、毎秒 tick() で進める
//  ・コインの正本は端末（市場と同じ）。建国・建築・寄付・購入は、端末が申告したコインで足りるか確認して OK を返し、
//    端末が OK を受け取ってからコインを引く。売上・戻りアイテムは、市場と同じ「受け取り箱（メール）」へ届く
//  ・SurvivalManager とは ctx（players / monsters / io / spawnUnit / feed / giveCoins）でつながる
// ============================================================
const fs = require("fs");
const path = require("path");
/* Survival removed - dummy SW object to prevent startup errors */
const SW = {
    POINTS: [],
    SITES: [],
    CX: 800,
    CY: 800,
    SAFE_R: 200,
    cellIdx: () => -1,
    inSafe: () => true,
    obstaclesNear: () => [],
    CELL_SITE: [],
    POINT_CELLS: {}
};
const Market = require("./MarketManager");
const Arts = require("./ArtifactManager");

const FILE = path.join(__dirname, "..", "data", "nations.json");

// ---------- 調整できる数値 ----------
const CFG = {
    FOUND_COST: 5000000,        // 建国
    PLOT_COST: 100000,          // 拠点・店（領地内）。国庫に入る
    PLOT_COSTS: { base: 100000, shop: 100000, inn: 100000, tavern: 100000, buyback: 100000, casino: 300000 },
    PLOT_KINDS: { base: '拠点', shop: 'ショップ', casino: 'ギャンブル場', buyback: '買取所', inn: '宿屋', tavern: '酒場' },
    MAX_PLOTS_PER_PLAYER: 5,
    MAX_TAX: 30,                // 税率の上限（%）
    NAME_MIN: 2, NAME_MAX: 12,
    WAR_COST: 50000,            // 宣戦布告（国庫から）
    WAR_HOURS: 48,              // 戦争は自動で終わる（停戦合意でも終わる）
    PROTECT_S: 3 * 3600,        // 建国直後の保護（宣戦布告されない）
    PROPOSAL_TTL_S: 24 * 3600,
    TRADE_EVERY_S: 300,         // 貿易船を出す間隔
    TRADE_BONUS: 0.3,           // 無事に着いた積み荷への上乗せ（システムが出す利益）
    TRADE_MIN: 5000, TRADE_MAX: 200000,
    SHIP_SPEED: 220,            // 貿易船の速さ（地図が広いので速め。遠い国どうしでも数分で着く）
    TRAVEL_CD_S: 20,            // 首都へ移動／安全地帯へ戻る の間隔
    ESCORT_COST: 20000, ESCORT_MAX: 3,
    GUARD: { castle: { cost: 30000, max: 8, name: "城の衛兵" }, town: { cost: 15000, max: 12, name: "城下町の衛兵" } },
    CAP_GAIN: 5,                // 拠点の占領：攻める人1人あたり、毎秒の進み（%）
    CAP_DEF: 4,                 // 守る人1人あたり（守備兵は2人ぶん）、毎秒の戻し
    CAP_DECAY: 3,               // 誰もいないとき、毎秒の戻り
    CAP_REACH: 8000,            // 領土は、自分の拠点からこの距離までつなげて広げられる
    INVADE_GAIN: 3,             // （旧）
    INVADE_DEF: 2.5,            // 防衛側（プレイヤー1人／衛兵は2人ぶん）1人あたりの減少
    INVADE_DECAY: 4,            // 誰もいないとき毎秒の減少
    PROV_S: 25,                 // 手を出した相手を衛兵が敵とみなす秒数
    SHOP_MAX_ITEMS: 20,
    PALETTE: ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#ff6fa8"]
};

// ---------- 保存 ----------
let db = { seq: 1, nations: {}, cellOwner: {}, wars: [], trades: [], props: [], ships: [], inv: {}, free: [], pts: {} };
try {
    const j = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    if (j && typeof j === "object") db = Object.assign(db, j);
} catch (e) { /* 初回 */ }
SW.POINTS.forEach(p => { if (!db.pts[p.id]) db.pts[p.id] = { owner: 0, by: 0, v: 0 }; });
let saveTimer = null, saveDue = 0, lastIncome = 0;
const ptGuardAt = {};
function schedule(ms) {
    const due = Date.now() + (ms || 1500);
    if (saveTimer && saveDue <= due) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveDue = due;
    saveTimer = setTimeout(flush, Math.max(0, due - Date.now()));
    if (saveTimer.unref) saveTimer.unref();
}
function flush() {
    saveTimer = null; saveDue = 0;
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE + ".tmp", JSON.stringify(db), "utf-8");
        fs.renameSync(FILE + ".tmp", FILE);
    } catch (e) { console.error("[Nation] save failed:", e.message); }
}
["exit", "SIGINT", "SIGTERM"].forEach(sig => process.on(sig, () => { try { if (saveTimer) { clearTimeout(saveTimer); flush(); } } catch (e) { /* 終了時のみ */ } if (sig !== "exit") process.exit(0); }));

// ---------- ctx（SurvivalManager から渡される） ----------
let ctx = null;
const logFeed = (text) => { db.log = (db.log || []).concat([{ t: Math.floor(Date.now() / 1000), x: text }]).slice(-40); ctx.feed(text); };
const now = () => Date.now() / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fail = (reason, extra) => Object.assign({ ok: false, reason: reason }, extra || {});
const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString("ja-JP");
let dirtyView = true, lastBroadcast = 0, secAcc = 0;

const N = (id) => db.nations[id] || null;
// 無所属（国の外）の建物。国民でなくても、国の領地の外なら店を開ける。税金はかからない
const FREE = { id: 0, name: "無所属", shopTax: 0, treasury: 0, ruler: "", members: {}, get plots() { return db.free; } };
const nationOfPid = (pid) => { for (const id in db.nations) { if (db.nations[id].members[pid]) return db.nations[id]; } return null; };
const count = () => Object.keys(db.nations).length;
const siteOf = (n) => SW.SITES[n.siteId] || { id: -1, x: SW.CX, y: SW.CY, name: "（不明な土地）" };
const capitalCell = (n) => SW.cellIdx(siteOf(n).x, siteOf(n).y);
const cellsOf = (nid) => Object.keys(db.cellOwner).filter(k => db.cellOwner[k] === nid).map(Number);
const allied = (a, b) => !!(a && b && N(a) && N(b) && N(a).allies.indexOf(b) >= 0);
const friendlyNid = (a, b) => !!(a && b && (a === b || allied(a, b)));
const atWar = (a, b) => db.wars.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
const pidOf = (P) => P && P.pid;
const cleanText = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f<>&"]/g, "").trim().slice(0, max);

function setPlayerNation(pid, nid) {
    if (!ctx) return;
    ctx.players.forEach(P => { if (P.pid === pid) P.nid = nid || 0; });
}
function say(P, text) {
    const s = ctx && ctx.io && ctx.io.sockets.sockets.get(P.sid);
    if (s) s.emit("nation:note", text);
}
function notifyNation(nid, text) {
    if (!ctx) return;
    ctx.players.forEach(P => { if (P.nid === nid) say(P, text); });
}
function markView() { dirtyView = true; }
function save() { schedule(1500); markView(); }

// ---------- 起動 ----------
function init(c) {
    ctx = c;
    // 保存されていた貿易船を、世界に戻す
    db.ships.forEach(sh => {
        const M = ctx.spawnUnit("ship", sh.from, sh.x, sh.y, { shipId: sh.id, cargo: sh.cargo, tx: sh.tx, ty: sh.ty });
        if (M) { sh.mid = M.id; }
        for (let i = 0; i < (sh.esc || 0); i++) ctx.spawnUnit("escort", sh.from, sh.x + (i - 1) * 30, sh.y + 30, { shipId: sh.id });
    });
}

// ---------- 見た目用のデータ ----------
function tableForClient() {
    const out = {};
    for (const id in db.nations) {
        const n = db.nations[id];
        out[id] = { name: n.name, color: n.color, site: n.siteId, ruler: n.rulerName, allies: n.allies.slice(), wars: db.wars.filter(w => w.a === n.id || w.b === n.id).map(w => (w.a === n.id ? w.b : w.a)), vault: Arts.vaultOf(n.id).length };
    }
    return out;
}
function cellsForClient() { return db.cellOwner; }
function broadcastView(force) {
    if (!ctx || !ctx.io) return;
    const t = now();
    if (!force && (!dirtyView || t - lastBroadcast < 1)) return;
    dirtyView = false; lastBroadcast = t;
    ctx.io.to("survival").emit("nation:view", { table: tableForClient(), cells: cellsForClient(), pts: SW.POINTS.map(p => db.pts[p.id].owner) });
}
function plotsNear(x, y, rad) {
    const out = [];
    for (const id in db.nations) {
        db.nations[id].plots.forEach(p => {
            if (Math.abs(p.x - x) < rad && Math.abs(p.y - y) < rad) out.push([p.id, p.kind, p.x, p.y, +id, p.name]);
        });
    }
    db.free.forEach(p => { if (Math.abs(p.x - x) < rad && Math.abs(p.y - y) < rad) out.push([p.id, p.kind, p.x, p.y, 0, p.name]); });
    return out;
}
function cellOwnerAt(x, y) { const i = SW.cellIdx(x, y); return i < 0 ? 0 : (db.cellOwner[i] || 0); }
function cellInfo(P) {
    const i = SW.cellIdx(P.x, P.y);
    if (i < 0) return { o: 0, iv: 0, by: 0, lk: 0, pt: -1, po: 0 };
    const o = db.cellOwner[i] || 0;
    let q = null;
    for (const p of SW.POINTS) { if (Math.abs(p.x - P.x) < p.r + 40 && Math.abs(p.y - P.y) < p.r + 40 && Math.hypot(p.x - P.x, p.y - P.y) < p.r + 40) { q = p; break; } }
    if (!q) return { o: o, iv: 0, by: 0, lk: 0, pt: -1, po: 0 };
    const st = db.pts[q.id];
    // lk：0=占領できる 1=王城は最後 2=建国直後の保護 3=自分の拠点から遠い 4=まだ国がない土地 5=国に入っていない
    return { o: o, iv: Math.round(st.v), by: st.by, lk: st.owner === P.nid ? 0 : (P.nid ? captureBlock(q, P.nid) : 5), pt: q.id, po: st.owner };
}
function pointProgress() { return SW.POINTS.filter(p => db.pts[p.id].v > 0).map(p => [p.id, db.pts[p.id].by, Math.round(db.pts[p.id].v)]); }

// ---------- 味方・敵の判定（SurvivalManager が使う） ----------
function friendly(A, B) { return !!(A && B && friendlyNid(A.nid, B.nid)); }
function friendlyUnit(P, nid) { return friendlyNid(P.nid, nid); }
function provoke(P, nid, t) {
    if (!P || !nid || friendlyNid(P.nid, nid)) return;
    P.prov = P.prov || {};
    P.prov[nid] = t + CFG.PROV_S;
}
// 衛兵(nid の国)が、プレイヤー P を敵とみなすか
function hostileTo(nid, P, t) {
    if (!P || friendlyNid(P.nid, nid)) return false;
    if (P.nid && atWar(P.nid, nid)) return true;
    return !!(P.prov && P.prov[nid] > t);
}
// 国民が稼いだコインから、国税を引く
function taxOf(P, coins) {
    const n = P && P.nid ? N(P.nid) : null;
    if (!n || !n.citizenTax) return 0;
    const t = Math.floor(coins * n.citizenTax / 100);
    if (t > 0) { n.treasury += t; schedule(5000); }
    return Math.max(0, t);
}
// 倒れたときの復活地点（自分の拠点 → 首都の城）
function respawnPoint(P) {
    const n = P.nid ? N(P.nid) : null;
    if (!n) return null;
    let best = null, bd = 1e9;
    n.plots.forEach(p => { if (p.kind === "base" && p.owner === P.pid) { const d = Math.hypot(p.x - P.x, p.y - P.y); if (d < bd) { bd = d; best = p; } } });
    if (best) return { x: best.x + 40, y: best.y + 40 };
    const s = siteOf(n), a = Math.random() * 6.28;
    return { x: s.x + Math.cos(a) * 320, y: s.y + Math.sin(a) * 320 };
}

// ---------- 画面用の状態 ----------
function publicNation(n) {
    return {
        id: n.id, name: n.name, color: n.color, ruler: n.rulerName, site: siteOf(n).name, siteId: n.siteId,
        members: Object.keys(n.members).length, cells: cellsOf(n.id).length, points: SW.POINTS.filter(p => db.pts[p.id].owner === n.id).length, open: !!n.open,
        citizenTax: n.citizenTax, shopTax: n.shopTax, allies: n.allies.slice(),
        wars: db.wars.filter(w => w.a === n.id || w.b === n.id).map(w => (w.a === n.id ? w.b : w.a)),
        protectedUntil: n.createdAt + CFG.PROTECT_S, createdAt: n.createdAt, vault: Arts.vaultOf(n.id).length
    };
}
function state(P) {
    const mine = P.nid ? N(P.nid) : null;
    const out = {
        ok: true, nid: mine ? mine.id : 0, pid: P.pid, cfg: CFG,
        nations: Object.keys(db.nations).map(id => publicNation(db.nations[id])),
        totalSites: SW.SITES.length,
        arts: Arts.summary(),
        pts: SW.POINTS.map(p => ({ id: p.id, owner: db.pts[p.id].owner, v: Math.round(db.pts[p.id].v), by: db.pts[p.id].by })),
        log: db.log || [],
        myPlots: [].concat(db.free.filter(p => p.owner === P.pid).map(p => ({ id: p.id, kind: p.kind, name: p.name, owner: p.owner, free: true, stock: (p.stock || []).length, bank: Math.floor(p.bank || 0) })), P.nid && N(P.nid) ? N(P.nid).plots.filter(p => p.owner === P.pid).map(p => ({ id: p.id, kind: p.kind, name: p.name, owner: p.owner, free: false, stock: (p.stock || []).length, bank: Math.floor(p.bank || 0) })) : []),
        freeSites: SW.SITES.filter(s => !Object.keys(db.nations).some(id => db.nations[id].siteId === s.id)).length,
        mine: null
    };
    if (mine) {
        const t = now();
        out.mine = Object.assign(publicNation(mine), {
            isRuler: mine.ruler === P.pid, treasury: Math.floor(mine.treasury), escortPref: mine.escortPref,
            guards: mine.guards, memberList: Object.keys(mine.members).map(pid => ({ pid: pid, name: mine.members[pid].name, ruler: pid === mine.ruler })),
            plots: mine.plots.map(p => ({ id: p.id, kind: p.kind, name: p.name, owner: p.owner, ownerName: p.ownerName, x: Math.round(p.x), y: Math.round(p.y), stock: (p.stock || []).length, sale: p.sale || 0, bank: Math.floor(p.bank || 0) })),
            trades: db.trades.filter(tr => tr.a === mine.id || tr.b === mine.id).map(tr => ({ id: tr.id, other: tr.a === mine.id ? tr.b : tr.a, mine: tr.a === mine.id ? tr.vol.a : tr.vol.b, theirs: tr.a === mine.id ? tr.vol.b : tr.vol.a })),
            incoming: db.props.filter(p => p.to === mine.id && p.until > t).map(p => ({ id: p.id, type: p.type, from: p.from, vol: p.vol })),
            outgoing: db.props.filter(p => p.from === mine.id && p.until > t).map(p => ({ id: p.id, type: p.type, to: p.to })),
            warList: db.wars.filter(w => w.a === mine.id || w.b === mine.id).map(w => ({ id: w.id, enemy: w.a === mine.id ? w.b : w.a, until: w.until })),
            ships: db.ships.filter(s => s.from === mine.id || s.to === mine.id).length
        });
    }
    return out;
}

// ---------- 建国・加入・脱退 ----------
function needCoins(a, cost) { return Math.floor(Number(a && a.coins)) >= cost; }
function create(P, a) {
    if (P.nid) return fail("already_member");
    const name = cleanText(a.name, CFG.NAME_MAX);
    if (name.length < CFG.NAME_MIN) return fail("bad_name");
    if (/(運営|管理|admin)/i.test(name)) return fail("bad_name");
    if (Object.keys(db.nations).some(id => db.nations[id].name.toLowerCase() === name.toLowerCase())) return fail("name_taken");
    if (!needCoins(a, CFG.FOUND_COST)) return fail("no_coins", { need: CFG.FOUND_COST });
    const used = new Set(Object.keys(db.nations).map(id => db.nations[id].siteId));
    const free = SW.SITES.filter(s => !used.has(s.id) && SW.POINTS.every(p => p.site !== s.id || !db.pts[p.id].owner));
    if (!free.length) return fail("no_land");
    const site = free[Math.floor(Math.random() * free.length)];        // 領地は自動で割り振られる
    const color = /^#[0-9a-fA-F]{6}$/.test(String(a.color || "")) ? String(a.color).toLowerCase() : CFG.PALETTE[db.seq % CFG.PALETTE.length];
    const id = db.seq++;
    db.nations[id] = {
        id: id, name: name, color: color, ruler: P.pid, rulerName: P.name, createdAt: now(), siteId: site.id,
        treasury: 0, citizenTax: 5, shopTax: 5, open: true, escortPref: 0, allies: [],
        members: {}, guards: { castle: 0, town: 0 }, plots: []
    };
    db.nations[id].members[P.pid] = { name: P.name, at: now() };
    SW.POINTS.forEach(p => { if (p.site === site.id) setPointOwner(p.id, id); });      // 王城と5つの砦が、自分の拠点になる
    P.nid = id;
    P.x = site.x + 380; P.y = site.y + 380;                              // 新しい国の城へ移動
    logFeed("🏰 " + P.name + " が「" + name + "」を建国した！（" + site.name + "）");
    save(); broadcastView(true);
    return { ok: true, cost: CFG.FOUND_COST, nid: id, site: site.name };
}
function join(P, a) {
    if (P.nid) return fail("already_member");
    const n = N(Number(a.nid));
    if (!n) return fail("not_found");
    if (!n.open) return fail("closed");
    n.members[P.pid] = { name: P.name, at: now() };
    P.nid = n.id;
    notifyNation(n.id, "👥 " + P.name + " が入国した");
    save();
    return { ok: true };
}
function removePlotsOf(n, pid, why) {
    const keep = [];
    n.plots.forEach(p => {
        if (p.owner !== pid) { keep.push(p); return; }
        returnStock(p, why);
    });
    n.plots = keep;
}
function returnStock(p, why) {
    if (p.bank >= 1) { Market.pushCoinsMail(p.owner, Math.floor(p.bank), "閉店した「" + p.name + "」の元手が戻ってきました"); p.bank = 0; }
    if (p.stock && p.stock.length) {
        Market.returnItems(p.owner, p.stock.map(s => ({ kind: s.kind, data: s.data, eq: null })), why || "閉店した店の在庫が戻ってきました");
        p.stock = [];
    }
}
function leave(P) {
    const n = P.nid ? N(P.nid) : null;
    if (!n) return fail("no_nation");
    if (n.ruler === P.pid) {
        if (Object.keys(n.members).length > 1) return fail("ruler_must_transfer");
        if (n.treasury >= 1) Market.pushCoinsMail(P.pid, Math.floor(n.treasury), "解散した「" + n.name + "」の国庫が戻ってきました");
        destroyNation(n, 0, "解散");
        return { ok: true, disbanded: true };
    }
    removePlotsOf(n, P.pid, "出国したため、店の在庫が戻ってきました");
    delete n.members[P.pid];
    P.nid = 0;
    notifyNation(n.id, "👋 " + P.name + " が出国した");
    save();
    return { ok: true };
}
function ruling(P) { const n = P.nid ? N(P.nid) : null; return n && n.ruler === P.pid ? n : null; }
function kick(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    const pid = String(a.pid || "");
    if (pid === P.pid || !n.members[pid]) return fail("not_found");
    removePlotsOf(n, pid, "国を追放されたため、店の在庫が戻ってきました");
    delete n.members[pid]; setPlayerNation(pid, 0);
    save(); return { ok: true };
}
function transfer(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    const pid = String(a.pid || "");
    if (pid === P.pid || !n.members[pid]) return fail("not_found");
    n.ruler = pid; n.rulerName = n.members[pid].name;
    notifyNation(n.id, "👑 新しい国王：" + n.rulerName);
    save(); return { ok: true };
}
function setPolicy(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    if (a.citizenTax != null) n.citizenTax = clamp(Math.floor(Number(a.citizenTax) || 0), 0, CFG.MAX_TAX);
    if (a.shopTax != null) n.shopTax = clamp(Math.floor(Number(a.shopTax) || 0), 0, CFG.MAX_TAX);
    if (a.open != null) n.open = !!a.open;
    if (a.escortPref != null) n.escortPref = clamp(Math.floor(Number(a.escortPref) || 0), 0, CFG.ESCORT_MAX);
    save(); return { ok: true };
}
function donate(P, a) {
    const n = P.nid ? N(P.nid) : null; if (!n) return fail("no_nation");
    const amt = Math.floor(Number(a.amount));
    if (!(amt >= 1) || amt > 1e9) return fail("bad_amount");
    if (!needCoins(a, amt)) return fail("no_coins", { need: amt });
    n.treasury += amt; save();
    return { ok: true, cost: amt };
}

// ---------- 移動（広い地図で、自分の国と安全地帯のあいだを行き来する） ----------
//  ・首都へ移動：安全地帯にいるときだけ。自国の城へ
//  ・安全地帯へ戻る：自国・同盟国の領地にいるときだけ（戦闘中は不可）
function travel(P, a) {
    const t = now();
    if (P.dead) return fail("dead");
    if (P.travelAt && t < P.travelAt) return fail("travel_cd", { sec: Math.ceil(P.travelAt - t) });
    if (ctx.inCombat(P)) return fail("in_combat");
    if (a.to === "capital") {
        const n = P.nid ? N(P.nid) : null; if (!n) return fail("no_nation");
        if (!SW.inSafe(P.x, P.y)) return fail("need_safe_zone");
        const s = siteOf(n), an = Math.random() * 6.28;
        P.x = s.x + Math.cos(an) * 450; P.y = s.y + Math.sin(an) * 450;
    } else if (a.to === "safe") {
        const o = cellOwnerAt(P.x, P.y);
        if (!o || !friendlyNid(P.nid, o)) return fail("need_friendly_land");
        const an = Math.random() * 6.28, r = Math.random() * SW.SAFE_R * 0.6;
        P.x = SW.CX + Math.cos(an) * r; P.y = SW.CY + Math.sin(an) * r;
    } else return fail("bad_type");
    P.travelAt = t + CFG.TRAVEL_CD_S;
    return { ok: true };
}

// ---------- 外交：同盟・停戦・貿易・宣戦布告 ----------
function propose(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    const to = N(Number(a.to)); if (!to || to.id === n.id) return fail("not_found");
    const type = String(a.type);
    if (["ally", "peace", "trade"].indexOf(type) < 0) return fail("bad_type");
    if (type === "ally") { if (allied(n.id, to.id)) return fail("already"); if (atWar(n.id, to.id)) return fail("at_war"); }
    if (type === "peace" && !atWar(n.id, to.id)) return fail("not_at_war");
    let vol = 0;
    if (type === "trade") {
        if (atWar(n.id, to.id)) return fail("at_war");
        if (db.trades.some(tr => (tr.a === n.id && tr.b === to.id) || (tr.a === to.id && tr.b === n.id))) return fail("already");
        vol = clamp(Math.floor(Number(a.vol) || 0), CFG.TRADE_MIN, CFG.TRADE_MAX);
    }
    if (db.props.some(p => p.type === type && p.from === n.id && p.to === to.id && p.until > now())) return fail("already");
    db.props.push({ id: db.seq++, type: type, from: n.id, to: to.id, vol: vol, until: now() + CFG.PROPOSAL_TTL_S });
    notifyNation(to.id, "📨 「" + n.name + "」から " + ({ ally: "同盟", peace: "停戦", trade: "貿易" }[type]) + "の申し込みが届いた");
    save(); return { ok: true };
}
function respond(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    const idx = db.props.findIndex(p => p.id === Number(a.id) && p.to === n.id && p.until > now());
    if (idx < 0) return fail("not_found");
    const pr = db.props[idx]; db.props.splice(idx, 1);
    const from = N(pr.from);
    if (!from || !a.accept) { save(); return { ok: true, accepted: false }; }
    if (pr.type === "ally") {
        if (atWar(n.id, from.id)) return fail("at_war");
        if (n.allies.indexOf(from.id) < 0) n.allies.push(from.id);
        if (from.allies.indexOf(n.id) < 0) from.allies.push(n.id);
        logFeed("🤝 「" + n.name + "」と「" + from.name + "」が同盟を結んだ！");
    } else if (pr.type === "peace") {
        db.wars = db.wars.filter(w => !((w.a === n.id && w.b === from.id) || (w.a === from.id && w.b === n.id)));
        logFeed("🕊 「" + n.name + "」と「" + from.name + "」が停戦した");
    } else if (pr.type === "trade") {
        if (atWar(n.id, from.id)) return fail("at_war");
        const myVol = clamp(Math.floor(Number(a.vol) || pr.vol), CFG.TRADE_MIN, CFG.TRADE_MAX), t = now();
        db.trades.push({ id: db.seq++, a: from.id, b: n.id, vol: { a: pr.vol, b: myVol }, next: { a: t + 20, b: t + 50 } });
        ctx.feed("⚓ 「" + from.name + "」と「" + n.name + "」が貿易を始めた！");
    }
    save(); return { ok: true, accepted: true };
}
function breakAlly(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    const o = N(Number(a.to)); if (!o || !allied(n.id, o.id)) return fail("not_found");
    n.allies = n.allies.filter(x => x !== o.id); o.allies = o.allies.filter(x => x !== n.id);
    notifyNation(o.id, "💔 「" + n.name + "」が同盟を破棄した");
    save(); return { ok: true };
}
function declareWar(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    const o = N(Number(a.to)); if (!o || o.id === n.id) return fail("not_found");
    if (allied(n.id, o.id)) return fail("allied");
    if (atWar(n.id, o.id)) return fail("already");
    // 神器（国宝）を持つ国は狙われる：保護期間が無視され、費用なしで宣戦布告できる
    const prize = Arts.vaultOf(o.id).length > 0;
    if (!prize && now() < o.createdAt + CFG.PROTECT_S) return fail("protected", { until: o.createdAt + CFG.PROTECT_S });
    if (!prize && n.treasury < CFG.WAR_COST) return fail("no_treasury", { need: CFG.WAR_COST });
    if (!prize) n.treasury -= CFG.WAR_COST;
    db.trades = db.trades.filter(tr => !((tr.a === n.id && tr.b === o.id) || (tr.a === o.id && tr.b === n.id)));
    db.wars.push({ id: db.seq++, a: n.id, b: o.id, since: now(), until: now() + CFG.WAR_HOURS * 3600 });
    logFeed("⚔ 「" + n.name + "」が「" + o.name + "」に宣戦布告した！");
    save(); return { ok: true };
}
function cancelTrade(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    const i = db.trades.findIndex(tr => tr.id === Number(a.id) && (tr.a === n.id || tr.b === n.id));
    if (i < 0) return fail("not_found");
    db.trades.splice(i, 1); save(); return { ok: true };
}
function setTradeVol(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    const tr = db.trades.find(x => x.id === Number(a.id) && (x.a === n.id || x.b === n.id));
    if (!tr) return fail("not_found");
    tr.vol[tr.a === n.id ? "a" : "b"] = clamp(Math.floor(Number(a.vol) || 0), CFG.TRADE_MIN, CFG.TRADE_MAX);
    save(); return { ok: true };
}

// ---------- 護衛（CPU）を雇う ----------
function hire(P, a) {
    const n = ruling(P); if (!n) return fail("not_ruler");
    const g = CFG.GUARD[String(a.post)]; if (!g) return fail("bad_post");
    const k = clamp(Math.floor(Number(a.n) || 1), 1, 5), post = String(a.post);
    const room = g.max - n.guards[post];
    if (room <= 0) return fail("max");
    const num = Math.min(k, room), cost = num * g.cost;
    if (n.treasury < cost) return fail("no_treasury", { need: cost });
    n.treasury -= cost; n.guards[post] += num;
    save(); return { ok: true, n: num, cost: cost };
}

// ---------- 拠点・店 ----------
function build(P, a) {
    const n = P.nid ? N(P.nid) : null;
    const kind = CFG.PLOT_KINDS[a.kind] ? a.kind : null; if (!kind) return fail("bad_kind");
    const cost = CFG.PLOT_COSTS[kind];
    const here = cellOwnerAt(P.x, P.y), ci = SW.cellIdx(P.x, P.y);
    if (kind === "base" && !(n && cellOwnerAt(P.x, P.y) === n.id)) return fail("base_nation_only");   // 拠点（復活地点）は、自分の国の領地の中だけ
    let list, own;
    if (n && here === n.id) {                                             // 自分の国の領地の中
        if (Math.hypot(P.x - siteOf(n).x, P.y - siteOf(n).y) < 340) return fail("too_close_castle");
        list = n.plots; own = true;
    } else if (here === 0 && ci >= 0 && SW.CELL_SITE[ci] < 0) {          // どの国にも属さない土地（無所属の店）
        list = db.free; own = false;
    } else if (here) return fail("not_my_land");
    else return fail("reserved_land");                                    // 建国候補地の周り（将来の国の領地）
    let count = db.free.filter(p => p.owner === P.pid).length;
    for (const id in db.nations) count += db.nations[id].plots.filter(p => p.owner === P.pid).length;
    if (count >= CFG.MAX_PLOTS_PER_PLAYER) return fail("plot_limit", { max: CFG.MAX_PLOTS_PER_PLAYER });
    const near = (p) => Math.hypot(p.x - P.x, p.y - P.y) < 110;
    if (db.free.some(near) || Object.keys(db.nations).some(id => db.nations[id].plots.some(near))) return fail("too_near");
    if (SW.obstaclesNear(P.x, P.y, 90).some(o => Math.hypot(o.x - P.x, o.y - P.y) < o.r + 50)) return fail("blocked");
    if (!needCoins(a, cost)) return fail("no_coins", { need: cost });
    const name = cleanText(a.name, 16) || (P.name + "の" + CFG.PLOT_KINDS[kind]);
    const plot = { id: "p" + db.seq++, kind: kind, owner: P.pid, ownerName: P.name, x: Math.round(P.x), y: Math.round(P.y), name: name, stock: [] };
    if (kind === "casino") { plot.bank = 0; plot.games = { coin: { on: true, min: 100, max: 50000 }, dice: { on: true, min: 100, max: 50000 }, slot: { on: true, min: 100, max: 20000 } }; }
    if (kind === "buyback") { plot.bank = 0; plot.offers = {}; }
    if (kind === "inn") plot.price = 500;
    if (kind === "tavern") plot.prices = { regen: 300, power: 800, guard: 800, speed: 500 };
    list.push(plot);
    if (own) n.treasury += cost;                                          // 国の土地代は国庫へ（無所属の土地代は、だれにも入らない）
    save(); return { ok: true, cost: cost, free: !own };
}
function findPlot(id) {
    for (const nid in db.nations) { const p = db.nations[nid].plots.find(x => x.id === id); if (p) return { n: db.nations[nid], p: p }; }
    const q = db.free.find(x => x.id === id);
    return q ? { n: FREE, p: q } : null;
}
function demolish(P, a) {
    const f = findPlot(String(a.id)); if (!f) return fail("not_found");
    if (f.p.owner !== P.pid && !(f.n.ruler === P.pid)) return fail("forbidden");
    returnStock(f.p, "取り壊した店の在庫が戻ってきました");
    f.n.plots = f.n.plots.filter(x => x !== f.p);
    save(); return { ok: true };
}
function shopView(P, a) {
    const f = findPlot(String(a.id)); if (!f || f.p.kind !== "shop") return fail("not_found");
    if (Math.hypot(f.p.x - P.x, f.p.y - P.y) > 260) return fail("too_far");
    return {
        ok: true, kind: "shop", id: f.p.id, name: f.p.name, owner: f.p.ownerName, mine: f.p.owner === P.pid, nation: f.n.name, nid: f.n.id, tax: f.n.shopTax,
        sale: f.p.sale || 0,
        items: f.p.stock.map(s => ({ id: s.data.id, kind: s.kind, data: s.data, price: s.price, sale: s.sale || 0, eff: effPrice(f.p, s) }))
    };
}
// 店の値付け：商品ごとの割引と、店全体のセールのうち、大きいほうが適用される（最大90%引き）
function effPrice(p, s) {
    const off = Math.max(s.sale || 0, p.sale || 0);
    return Math.max(1, Math.floor(s.price * (100 - off) / 100));
}
const cleanPrice = (v) => { v = Math.floor(Number(v)); return v >= 1 && v <= Market.CONFIG.MAX_PRICE ? v : 0; };
const cleanSale = (v) => clamp(Math.floor(Number(v) || 0), 0, 90);
function stockedIds() {
    const s = new Set();
    for (const nid in db.nations) db.nations[nid].plots.forEach(p => (p.stock || []).forEach(it => s.add(it.data.id)));
    return s;
}
function shopStock(P, a) {
    const f = findPlot(String(a.id)); if (!f || f.p.kind !== "shop") return fail("not_found");
    if (f.p.owner !== P.pid) return fail("forbidden");
    if (Math.hypot(f.p.x - P.x, f.p.y - P.y) > 260) return fail("too_far");
    const raw = Array.isArray(a.items) ? a.items.slice(0, CFG.SHOP_MAX_ITEMS) : [];
    const taken = stockedIds(); Market.escrowedIds().forEach(id => taken.add(id));
    ctx.players.forEach(O => (O.carry || []).forEach(it => taken.add(it.data.id)));
    const ids = [];
    for (const r of raw) {
        if (f.p.stock.length >= CFG.SHOP_MAX_ITEMS) break;
        const it = Market.validateItem(r);
        if (!it || taken.has(it.data.id)) continue;
        const price = cleanPrice(r.price);
        if (!price) continue;
        taken.add(it.data.id);
        f.p.stock.push({ kind: it.kind, data: it.data, price: price, sale: cleanSale(r.sale) });
        ids.push(it.data.id);
    }
    if (!ids.length) return fail("nothing");
    save(); return { ok: true, ids: ids };
}
function shopSetPrice(P, a) {
    const f = findPlot(String(a.id)); if (!f || f.p.kind !== "shop" || f.p.owner !== P.pid) return fail("forbidden");
    const s = f.p.stock.find(x => x.data.id === String(a.itemId));
    if (!s) return fail("not_found");
    const price = cleanPrice(a.price);
    if (!price) return fail("bad_price");
    s.price = price; s.sale = cleanSale(a.sale);
    save(); return { ok: true };
}
function shopSetShop(P, a) {
    const f = findPlot(String(a.id)); if (!f || f.p.kind !== "shop" || f.p.owner !== P.pid) return fail("forbidden");
    if (a.sale != null) f.p.sale = cleanSale(a.sale);
    if (a.name != null) { const nm = cleanText(a.name, 16); if (nm) f.p.name = nm; }
    save(); return { ok: true, sale: f.p.sale || 0, name: f.p.name };
}
function shopUnstock(P, a) {
    const f = findPlot(String(a.id)); if (!f || f.p.owner !== P.pid) return fail("forbidden");
    const i = f.p.stock.findIndex(s => s.data.id === String(a.itemId));
    if (i < 0) return fail("not_found");
    const s = f.p.stock.splice(i, 1)[0];
    Market.returnItems(P.pid, [{ kind: s.kind, data: s.data, eq: null }], "店から引き上げた商品");
    save(); return { ok: true };
}
function shopBuy(P, a) {
    const f = findPlot(String(a.id)); if (!f || f.p.kind !== "shop") return fail("not_found");
    if (f.p.owner === P.pid) return fail("own");
    if (Math.hypot(f.p.x - P.x, f.p.y - P.y) > 260) return fail("too_far");
    const i = f.p.stock.findIndex(s => s.data.id === String(a.itemId));
    if (i < 0) return fail("gone");
    const s = f.p.stock[i], price = effPrice(f.p, s);
    if (a.price != null && Math.floor(Number(a.price)) !== price) return fail("price_changed", { price: price });
    if (!needCoins(a, price)) return fail("no_coins", { need: price });
    f.p.stock.splice(i, 1);
    const tax = Math.floor(price * f.n.shopTax / 100), gain = price - tax;
    f.n.treasury += tax;
    Market.returnItems(P.pid, [{ kind: s.kind, data: s.data, eq: null }], "「" + f.p.name + "」で購入した商品");
    if (gain > 0) Market.pushCoinsMail(f.p.owner, gain, "「" + f.p.name + "」の商品が " + fmt(price) + " コインで売れました（営業税 " + fmt(tax) + "）");
    ctx.players.forEach(O => { if (O.pid === f.p.owner) say(O, "🛒 「" + f.p.name + "」の商品が売れた！ +" + fmt(gain) + "（町へ戻ると受け取れます）"); });
    save(); return { ok: true, cost: price };
}


// ---------- 建物の種類（ギャンブル場・買取所・宿屋・酒場） ----------
const DRINKS = {
    regen: { name: "回復の酒", icon: "🍶", secs: 90, buf: "regen" },
    power: { name: "力の酒", icon: "🍺", secs: 120, buf: "empower" },
    guard: { name: "守りの酒", icon: "🥃", secs: 120, buf: "fortify" },
    speed: { name: "俊足の酒", icon: "🍷", secs: 120, buf: "haste" }
};
// ギャンブルの遊び方（どれも店側が少し有利。確率はサーバーで決める）
const SLOT = [{ p: 0.01, m: 25 }, { p: 0.04, m: 6 }, { p: 0.13, m: 2 }, { p: 0.19, m: 1 }];     // 残りは外れ
const GAME_NAMES = { coin: "コイントス", dice: "サイコロ", slot: "スロット" };
function findPlotNear(P, id, kind, rng) {
    const f = findPlot(String(id)); if (!f || (kind && f.p.kind !== kind)) return null;
    if (Math.hypot(f.p.x - P.x, f.p.y - P.y) > (rng || 260)) return null;
    return f;
}
function plotView(P, a) {
    const f = findPlot(String(a.id)); if (!f) return fail("not_found");
    if (Math.hypot(f.p.x - P.x, f.p.y - P.y) > 260) return fail("too_far");
    const p = f.p, mine = p.owner === P.pid, base = { ok: true, kind: p.kind, id: p.id, name: p.name, owner: p.ownerName, mine: mine, nation: f.n.name, nid: f.n.id, tax: f.n.shopTax };
    if (p.kind === "shop") return shopView(P, a);
    if (p.kind === "casino") return Object.assign(base, { bank: Math.floor(p.bank || 0), games: p.games, names: GAME_NAMES });
    if (p.kind === "buyback") return Object.assign(base, { bank: Math.floor(p.bank || 0), offers: p.offers });
    if (p.kind === "inn") return Object.assign(base, { price: p.price });
    if (p.kind === "tavern") return Object.assign(base, { prices: p.prices, drinks: DRINKS });
    return fail("bad_kind");
}
// 店主が出す売上（営業税を引いて、受け取り箱へ）
function payOwner(f, gross, note) {
    const tax = Math.floor(gross * f.n.shopTax / 100), gain = gross - tax;
    f.n.treasury += tax;
    if (gain > 0) Market.pushCoinsMail(f.p.owner, gain, note + "（営業税 " + fmt(tax) + "）");
    return { tax: tax, gain: gain };
}
function plotConfig(P, a) {
    const f = findPlot(String(a.id)); if (!f || f.p.owner !== P.pid) return fail("forbidden");
    const p = f.p;
    if (a.name != null) { const nm = cleanText(a.name, 16); if (nm) p.name = nm; }
    if (p.kind === "casino" && a.games && typeof a.games === "object") {
        Object.keys(GAME_NAMES).forEach(g => {
            const c = a.games[g]; if (!c) return;
            p.games[g] = { on: !!c.on, min: clamp(Math.floor(Number(c.min) || 100), 10, 1e6), max: clamp(Math.floor(Number(c.max) || 1000), 10, 1e6) };
            if (p.games[g].max < p.games[g].min) p.games[g].max = p.games[g].min;
        });
    }
    if (p.kind === "buyback" && a.offers && typeof a.offers === "object") {
        const out = {};
        Object.keys(a.offers).slice(0, 40).forEach(mat => {
            if (!/^[a-z0-9_]{2,40}$/.test(mat)) return;
            const o = a.offers[mat], price = Math.floor(Number(o && o.price)), max = Math.floor(Number(o && o.max));
            if (price >= 1 && price <= 1e7 && max >= 1) out[mat] = { price: price, max: Math.min(max, 99999) };
        });
        p.offers = out;
    }
    if (p.kind === "inn" && a.price != null) p.price = clamp(Math.floor(Number(a.price) || 0), 0, 1e6);
    if (p.kind === "tavern" && a.prices && typeof a.prices === "object") Object.keys(DRINKS).forEach(k => { if (a.prices[k] != null) p.prices[k] = clamp(Math.floor(Number(a.prices[k]) || 0), 0, 1e6); });
    save(); return { ok: true };
}
// 元手（銀行）：ギャンブル場の賞金や、買取所の買い取り代金に使う
function plotDeposit(P, a) {
    const f = findPlot(String(a.id)); if (!f || f.p.owner !== P.pid || f.p.bank == null) return fail("forbidden");
    const amt = Math.floor(Number(a.amount));
    if (!(amt >= 1) || amt > 1e9) return fail("bad_amount");
    if (!needCoins(a, amt)) return fail("no_coins", { need: amt });
    f.p.bank += amt; save(); return { ok: true, cost: amt };
}
function plotWithdraw(P, a) {
    const f = findPlot(String(a.id)); if (!f || f.p.owner !== P.pid || f.p.bank == null) return fail("forbidden");
    const amt = Math.min(Math.floor(Number(a.amount)), Math.floor(f.p.bank));
    if (!(amt >= 1)) return fail("bad_amount");
    f.p.bank -= amt; Market.pushCoinsMail(f.p.owner, amt, "「" + f.p.name + "」の元手の引き出し"); save();
    return { ok: true, amount: amt };
}
function casinoBet(P, a) {
    const f = findPlotNear(P, a.id, "casino"); if (!f) return fail("too_far");
    const p = f.p, g = String(a.game), cfg = p.games[g];
    if (!cfg || !cfg.on) return fail("closed_game");
    if (p.owner === P.pid) return fail("own");
    const t = now();
    if (P.betAt && t - P.betAt < 0.6) return fail("rate_limit");
    const bet = Math.floor(Number(a.bet));
    if (!(bet >= cfg.min) || bet > cfg.max) return fail("bad_bet", { min: cfg.min, max: cfg.max });
    if (!needCoins(a, bet)) return fail("no_coins", { need: bet });
    let mult = 0, result = {};
    if (g === "coin") {
        const pick = a.pick === "tails" ? "tails" : "heads", win = Math.random() < 0.485;
        mult = win ? 2 : 0; result = { pick: pick, face: win ? pick : (pick === "heads" ? "tails" : "heads") };
    } else if (g === "dice") {
        const pick = clamp(Math.floor(Number(a.pick) || 1), 1, 6), roll = 1 + Math.floor(Math.random() * 6), hit = Math.random() < 0.1667;
        const face = hit ? pick : ((pick - 1 + 1 + Math.floor(Math.random() * 5)) % 6) + 1;       // 当たりは1/6、外れの目はそれ以外から
        mult = hit ? 5.7 : 0; result = { pick: pick, face: face }; void roll;
    } else if (g === "slot") {
        let r = Math.random(), acc = 0; mult = 0;
        for (const o of SLOT) { acc += o.p; if (r < acc) { mult = o.m; break; } }
        const sym = ["🍒", "🔔", "💎", "7️⃣", "🍋"];
        const pickSym = () => sym[Math.floor(Math.random() * sym.length)];
        result = { reels: mult >= 25 ? ["7️⃣", "7️⃣", "7️⃣"] : mult >= 6 ? ["💎", "💎", "💎"] : mult >= 2 ? ["🔔", "🔔", "🔔"] : mult === 1 ? ["🍒", "🍒", pickSym() === "🍒" ? "🍋" : pickSym()] : ["🍋", "🍒", "🔔"] };
    } else return fail("closed_game");
    const payout = Math.floor(bet * mult), net = payout - bet;
    if (net > 0 && (p.bank || 0) < net) return fail("bank_short", { bank: Math.floor(p.bank || 0) });   // 元手が足りないときは賭けられない
    P.betAt = t;
    if (net > 0) p.bank -= net;
    else { const tax = Math.floor(bet * f.n.shopTax / 100); f.n.treasury += tax; p.bank += bet - tax; }
    save();
    return { ok: true, game: g, result: result, mult: mult, payout: payout, net: net, bank: Math.floor(p.bank) };
}
function buybackSell(P, a) {
    const f = findPlotNear(P, a.id, "buyback"); if (!f) return fail("too_far");
    const p = f.p, mat = String(a.mat), o = p.offers[mat];
    if (!o) return fail("not_wanted");
    if (p.owner === P.pid) return fail("own");
    const count = Math.floor(Number(a.count));
    if (!(count >= 1) || count > o.max) return fail("bad_count", { max: o.max });
    const total = o.price * count;
    if ((p.bank || 0) < total) return fail("bank_short", { bank: Math.floor(p.bank || 0) });
    p.bank -= total; o.max -= count; if (o.max <= 0) delete p.offers[mat];
    Market.returnItems(p.owner, [{ kind: "material", data: { id: "mat_" + mat + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), mat: mat, count: count, name: String(a.name || mat).replace(/[<>&"]/g, "").slice(0, 20) }, eq: null }], "「" + p.name + "」で買い取った素材");
    save(); return { ok: true, gain: total, count: count };
}
function innRest(P, a) {
    const f = findPlotNear(P, a.id, "inn"); if (!f) return fail("too_far");
    const p = f.p, t = now();
    if (p.owner === P.pid) return fail("own");
    if (ctx.inCombat(P)) return fail("in_combat");
    if (P.innAt && t - P.innAt < 20) return fail("travel_cd", { sec: Math.ceil(20 - (t - P.innAt)) });
    if (p.price > 0 && !needCoins(a, p.price)) return fail("no_coins", { need: p.price });
    P.innAt = t; P.hp = P.maxHp; if (P.enMax) P.en = P.enMax;
    if (p.price > 0) payOwner(f, p.price, "「" + p.name + "」の宿泊代");
    save(); return { ok: true, cost: p.price };
}
function tavernBuy(P, a) {
    const f = findPlotNear(P, a.id, "tavern"); if (!f) return fail("too_far");
    const p = f.p, k = String(a.drink), d = DRINKS[k];
    if (!d || !(p.prices[k] > 0)) return fail("not_wanted");
    if (p.owner === P.pid) return fail("own");
    if (!needCoins(a, p.prices[k])) return fail("no_coins", { need: p.prices[k] });
    const t = now(); P.buf = P.buf || {}; P.buf[d.buf] = Math.max(P.buf[d.buf] || 0, t + d.secs);
    payOwner(f, p.prices[k], "「" + p.name + "」の" + d.name);
    save(); return { ok: true, cost: p.prices[k], secs: d.secs };
}

// ---------- 国の滅亡 ----------
function destroyNation(n, byNid, why) {
    const conq = byNid ? N(byNid) : null;
    SW.POINTS.forEach(p => { if (db.pts[p.id].owner === n.id) setPointOwner(p.id, conq ? conq.id : 0); });      // 拠点と領土は、征服した国のものに
    n.plots.forEach(p => returnStock(p, "国が滅びたため、店の在庫が戻ってきました"));
    if (conq && n.treasury > 0) conq.treasury += Math.floor(n.treasury / 2);
    Arts.transferVault(n.id, conq ? conq.id : 0);                    // 国宝（神器）は征服した国のものに
    Object.keys(n.members).forEach(pid => setPlayerNation(pid, 0));
    for (const id in db.nations) { db.nations[id].allies = db.nations[id].allies.filter(x => x !== n.id); }
    db.wars = db.wars.filter(w => w.a !== n.id && w.b !== n.id);
    db.trades = db.trades.filter(tr => tr.a !== n.id && tr.b !== n.id);
    db.props = db.props.filter(p => p.from !== n.id && p.to !== n.id);
    db.ships = db.ships.filter(sh => {
        if (sh.from !== n.id && sh.to !== n.id) return true;
        ctx.monsters.forEach(M => { if ((M.shipId === sh.id) && M.nid) ctx.monsters.delete(M.id); });
        return false;
    });
    ctx.monsters.forEach(M => { if (M.nid === n.id) ctx.monsters.delete(M.id); });
    delete db.nations[n.id];
    logFeed(conq ? "💥 「" + n.name + "」は「" + conq.name + "」に征服され、滅びた…" : "🏚 「" + n.name + "」は" + (why || "滅びた"));
    save(); broadcastView(true);
}

// ---------- 毎秒の処理 ----------
function ensureGuardsPoints() {
    const t = now();
    SW.POINTS.forEach(q => {
        const owner = db.pts[q.id].owner; if (!owner || q.cap || !N(owner)) return;
        let have = 0; ctx.monsters.forEach(M => { if (M.ptId === q.id && M.nid === owner) have++; });
        if (have < 2 && t >= (ptGuardAt[q.id] || 0)) {
            ptGuardAt[q.id] = t + 40; const a = Math.random() * 6.28, d = 60 + Math.random() * 140;
            ctx.spawnUnit("guard", owner, q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, { post: "point", hx: q.x, hy: q.y, ptId: q.id });
        }
    });
}
function ensureGuards() {
    ensureGuardsPoints();
    for (const id in db.nations) {
        const n = db.nations[id], s = siteOf(n);
        ["castle", "town"].forEach(post => {
            let have = 0;
            ctx.monsters.forEach(M => { if (M.nid === n.id && M.kind === "guard" && M.post === post) have++; });
            if (have < n.guards[post]) {
                const a = Math.random() * 6.28, d = post === "castle" ? 150 + Math.random() * 350 : 450 + Math.random() * 450;
                ctx.spawnUnit("guard", n.id, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, { post: post, hx: s.x, hy: s.y });
            }
        });
    }
}
function secondly(t) {
    // 期限切れ
    db.props = db.props.filter(p => p.until > t);
    db.wars = db.wars.filter(w => { if (w.until > t) return true; if (N(w.a) && N(w.b)) logFeed("🕊 「" + N(w.a).name + "」と「" + N(w.b).name + "」の戦争は自然に終わった"); return false; });
    // 貿易船を出す
    db.trades.forEach(tr => {
        const A = N(tr.a), B = N(tr.b);
        if (!A || !B || atWar(tr.a, tr.b)) return;
        ["a", "b"].forEach(side => {
            if (t < tr.next[side]) return;
            const S = side === "a" ? A : B, R = side === "a" ? B : A, vol = tr.vol[side];
            const esc = S.escortPref, total = vol + esc * CFG.ESCORT_COST;
            if (S.treasury < total) { tr.next[side] = t + 60; return; }       // 国庫が足りないので1分後にもう一度
            S.treasury -= total; tr.next[side] = t + CFG.TRADE_EVERY_S;
            launchShip(S, R, vol, esc);
        });
    });
    ensureGuards();
    pointTick(t);
}
function launchShip(S, R, cargo, esc) {
    const a = siteOf(S), b = siteOf(R), ang = Math.atan2(b.y - a.y, b.x - a.x);
    const sh = { id: db.seq++, from: S.id, to: R.id, cargo: cargo, esc: esc, x: a.x + Math.cos(ang) * 1000, y: a.y + Math.sin(ang) * 1000, tx: b.x - Math.cos(ang) * 1000, ty: b.y - Math.sin(ang) * 1000 };
    db.ships.push(sh);
    const M = ctx.spawnUnit("ship", S.id, sh.x, sh.y, { shipId: sh.id, cargo: cargo, tx: sh.tx, ty: sh.ty });
    if (M) sh.mid = M.id;
    for (let i = 0; i < esc; i++) ctx.spawnUnit("escort", S.id, sh.x + (i - 1) * 30, sh.y + 30, { shipId: sh.id });
    ctx.feed("🚢 「" + S.name + "」の貿易船が「" + R.name + "」へ出航した！（積み荷 " + fmt(cargo) + "）");
    schedule(3000);
}
function removeShipUnits(shipId) {
    ctx.monsters.forEach(M => { if (M.nid && M.shipId === shipId) ctx.monsters.delete(M.id); });
}
// 貿易船が目的地に着いた
function shipArrived(M) {
    const i = db.ships.findIndex(s => s.id === M.shipId);
    if (i < 0) { ctx.monsters.delete(M.id); return; }
    const sh = db.ships[i], R = N(sh.to), S = N(sh.from);
    db.ships.splice(i, 1);
    removeShipUnits(sh.id);
    if (R) {
        const gain = Math.floor(sh.cargo * (1 + CFG.TRADE_BONUS));
        R.treasury += gain;
        ctx.feed("⚓ 「" + (S ? S.name : "？") + "」の貿易船が「" + R.name + "」に到着！（+" + fmt(gain) + "）");
        notifyNation(R.id, "💰 貿易の品が届き、国庫に " + fmt(gain) + " コイン入った");
    }
    save();
}
// 貿易船・衛兵が倒されたとき（SurvivalManager.killMonster から）
function unitKilled(M) {
    const n = N(M.nid);
    if (M.kind === "guard") {
        if (n && n.guards[M.post] > 0) { n.guards[M.post]--; schedule(3000); markView(); }
        return;
    }
    if (M.kind === "ship") {
        const i = db.ships.findIndex(s => s.id === M.shipId);
        if (i < 0) return;
        const sh = db.ships[i]; db.ships.splice(i, 1); removeShipUnits(sh.id);
        const total = Object.values(M.dmgBy || {}).reduce((x, y) => x + y, 0) || 0;
        let paid = 0, names = [];
        if (total > 0) ctx.players.forEach(P => {
            const share = (M.dmgBy[P.eid] || 0) / total;
            if (share < 0.1) return;
            const c = Math.max(1, Math.floor(sh.cargo * share));
            paid += c; names.push(P.name);
            ctx.giveCoins(P, c, "🏴‍☠️ 貿易船の積み荷を奪った！");
        });
        ctx.feed("🏴‍☠️ " + (names.join("・") || "何者か") + " が「" + (n ? n.name : "？") + "」の貿易船を沈めた！（積み荷 " + fmt(sh.cargo) + (paid ? "／奪取 " + fmt(paid) : "／海の藻屑") + "）");
        if (n) notifyNation(n.id, "🚢💥 貿易船が襲われた！積み荷 " + fmt(sh.cargo) + " を失った");
        save();
    }
}

// ---------- 拠点（MOBA のような占領ポイント。戦争中でなくても占領できる） ----------
//  ・拠点の円の中に立つと占領が進む。守る人（持ち主・同盟）がいると押し戻される
//  ・他国の拠点を攻め始めると、そのまま戦争になる。王城は、ほかの拠点を全部奪われるまで落ちない
//  ・拠点は、持ち主に毎分の収入をもたらす。砦には、持ち主の守備兵が2人つく
const ptOwner = (id) => db.pts[id].owner;
const pointsOf = (nid) => SW.POINTS.filter(p => db.pts[p.id].owner === nid);
function setPointOwner(id, nid) {
    const st = db.pts[id]; st.owner = nid || 0; st.v = 0; st.by = 0;
    (SW.POINT_CELLS[id] || []).forEach(ci => { if (nid) db.cellOwner[ci] = nid; else delete db.cellOwner[ci]; });
}
// nid の国が、この拠点を攻められるか。0=できる 1=王城は最後 2=建国直後の保護 3=自分の拠点から遠い 4=まだ国がない土地
function captureBlock(q, nid) {
    const owner = ptOwner(q.id);
    if (!owner && q.site >= 0 && !Object.keys(db.nations).some(k => db.nations[k].siteId === q.site)) return 4;
    if (owner && owner !== nid) {
        const o = N(owner);
        if (o && now() < o.createdAt + CFG.PROTECT_S) return 2;
        if (q.cap && pointsOf(owner).length > 1) return 1;
        if (!o) return 0;
    }
    if (owner !== nid) {
        const mine = pointsOf(nid);
        if (!mine.some(p => Math.hypot(p.x - q.x, p.y - q.y) < CFG.CAP_REACH)) return 3;
    }
    return 0;
}
function autoWar(a, b, q) {
    const A = N(a), B = N(b); if (!A || !B || atWar(a, b)) return;
    db.wars.push({ id: db.seq++, a: a, b: b, since: now(), until: now() + CFG.WAR_HOURS * 3600 });
    db.trades = db.trades.filter(tr => !((tr.a === a && tr.b === b) || (tr.a === b && tr.b === a)));
    logFeed("⚔ 「" + A.name + "」が「" + B.name + "」の拠点「" + q.name + "」を攻撃した！ 戦争が始まった！");
    save();
}
function pointTick(t) {
    const near = new Map();
    const slot = (id) => { let r = near.get(id); if (!r) near.set(id, r = { p: {}, g: {} }); return r; };
    ctx.players.forEach(P => {
        if (P.dead || P.ghost || !P.nid) return;
        for (const q of SW.POINTS) { if (Math.abs(q.x - P.x) < q.r && Math.abs(q.y - P.y) < q.r && Math.hypot(q.x - P.x, q.y - P.y) < q.r) { const r = slot(q.id); r.p[P.nid] = (r.p[P.nid] || 0) + 1; break; } }
    });
    ctx.monsters.forEach(M => { if (M.nid && M.kind === "guard" && M.ptId != null) { const q = SW.POINTS[M.ptId]; if (q && Math.hypot(q.x - M.x, q.y - M.y) < q.r + 80) { const r = slot(q.id); r.g[M.nid] = (r.g[M.nid] || 0) + 1; } } });
    SW.POINTS.forEach(q => {
        const st = db.pts[q.id], r = near.get(q.id), owner = st.owner;
        let att = 0, def = 0, by = 0; const credit = {};
        if (r) {
            Object.keys(r.p).forEach(k => {
                const nid = Number(k), c = r.p[k];
                if (owner && friendlyNid(nid, owner)) { def += c; return; }
                if (captureBlock(q, nid) !== 0) return;
                att += c; credit[nid] = (credit[nid] || 0) + c;
            });
            Object.keys(r.g).forEach(k => { if (owner && friendlyNid(Number(k), owner)) def += 2 * r.g[k]; });
            let best = 0; Object.keys(credit).forEach(k => { if (credit[k] > best) { best = credit[k]; by = Number(k); } });
        }
        if (att > 0) {
            const gain = att * CFG.CAP_GAIN - def * CFG.CAP_DEF;
            if (gain > 0) {
                if (st.v <= 0) { st.by = by; if (owner && owner !== by && !atWar(owner, by)) autoWar(by, owner, q); }
                if (st.by !== by) { st.v -= gain; if (st.v <= 0) { st.by = by; st.v = 0; } } else st.v = Math.min(100, st.v + gain);
            } else st.v = Math.max(0, st.v + gain * 0.5);
            if (st.v >= 100) capturePoint(q, st.by || by);
        } else if (st.v > 0) { st.v = Math.max(0, st.v - CFG.CAP_DECAY); if (st.v <= 0) st.by = 0; }
    });
    if (t - lastIncome >= 60) {                                   // 拠点の収入（1分ごと）
        lastIncome = t;
        for (const id in db.nations) { let g = 0; pointsOf(db.nations[id].id).forEach(p => { g += p.cap ? 400 : 250; }); db.nations[id].treasury += g; }
        schedule(5000);
    }
}
function capturePoint(q, byNid) {
    const st = db.pts[q.id], prev = st.owner, by = N(byNid), o = prev ? N(prev) : null;
    if (!by) { st.v = 0; return; }
    if (o && q.cap) { destroyNation(o, byNid); return; }          // 王城が落ちたら、国は滅びる（残りの拠点も奪われる）
    if (o) o.plots = o.plots.filter(p => {                        // 拠点の周りの建物は壊れる（在庫は持ち主へ）
        if (SW.CELL_POINT[SW.cellIdx(p.x, p.y)] !== q.id) return true;
        returnStock(p, "拠点が占領されたため、店の在庫が戻ってきました");
        return false;
    });
    setPointOwner(q.id, byNid);
    ctx.monsters.forEach(M => { if (M.ptId === q.id && M.nid) ctx.monsters.delete(M.id); });     // 守備兵は入れ替わる
    logFeed("🚩 「" + by.name + "」が拠点「" + q.name + "」を占領した！" + (o ? "（「" + o.name + "」から奪った）" : "（領土が広がった）"));
    if (o) notifyNation(o.id, "🚩 拠点「" + q.name + "」を奪われた！");
    save(); broadcastView(true);
}

// 毎 tick（SurvivalManager から）
function tick(t, dt) {
    if (!ctx) return;
    secAcc += dt;
    if (secAcc >= 1) { secAcc = 0; secondly(t); }
    broadcastView(false);
}

// 貿易船の現在位置の保存（頻繁には書かない）
function shipMoved(M) {
    const sh = db.ships.find(s => s.id === M.shipId);
    if (sh) { sh.x = M.x; sh.y = M.y; schedule(30000); }
}

// ---------- 古い保存データを、いまの版に合わせて直す ----------
//  建国できる土地の数や並びが変わっても、国・拠点・建物が壊れないようにする
function migrate() {
    const ptsVer = SW.POINTS.length + ":" + SW.POINTS.reduce((a, p) => (a * 31 + p.x * 7 + p.y) % 1000003, 7);
    let changed = false;
    const ids = Object.keys(db.nations);
    // 1) 存在しない土地に建っていた国は、空いている土地へ移す（なければ解散して国庫を返す）
    const used = new Set(ids.filter(id => SW.SITES[db.nations[id].siteId]).map(id => db.nations[id].siteId));
    ids.forEach(id => {
        const n = db.nations[id];
        n.members = n.members || {}; n.plots = n.plots || []; n.allies = n.allies || []; n.guards = n.guards || { castle: 0, town: 0 };
        if (SW.SITES[n.siteId]) return;
        const free = SW.SITES.find(st => !used.has(st.id));
        changed = true;
        if (free) { n.siteId = free.id; used.add(free.id); return; }
        if (n.treasury >= 1) Market.pushCoinsMail(n.ruler, Math.floor(n.treasury), "土地が無くなった「" + n.name + "」の国庫が戻ってきました");
        n.plots.forEach(p => returnStock(p, "国が無くなったため、店の在庫が戻ってきました"));
        delete db.nations[id];
    });
    // 2) 拠点の持ち主を整える（拠点の並びが変わったときは、中立の拠点は未占領に戻す）
    if (db.ptsVer !== ptsVer) { db.pts = {}; changed = true; }
    SW.POINTS.forEach(q => { if (!db.pts[q.id]) db.pts[q.id] = { owner: 0, by: 0, v: 0 }; });
    SW.POINTS.forEach(q => {
        const st = db.pts[q.id], home = q.site >= 0 ? Object.keys(db.nations).map(k => db.nations[k]).find(n => n.siteId === q.site) : null;
        if (st.owner && !db.nations[st.owner]) { st.owner = 0; changed = true; }          // 持ち主の国が無い
        if (home && !st.owner) { st.owner = home.id; changed = true; }                      // 建国済みの土地の拠点は、その国のもの
        if (q.site >= 0 && !home && !st.owner) st.owner = 0;
        st.v = 0; st.by = 0;
    });
    db.ptsVer = ptsVer;
    // 3) 領地の持ち主は、拠点から作り直す
    db.cellOwner = {};
    SW.POINTS.forEach(q => { const o = db.pts[q.id].owner; if (o) (SW.POINT_CELLS[q.id] || []).forEach(ci => { db.cellOwner[ci] = o; }); });
    // 4) 自分の領地の外に残った国の建物は、片づける（在庫は持ち主へ）
    Object.keys(db.nations).forEach(id => {
        const n = db.nations[id];
        n.plots = n.plots.filter(p => { if (db.cellOwner[SW.cellIdx(p.x, p.y)] === n.id) return true; returnStock(p, "領地が変わったため、店の在庫が戻ってきました"); changed = true; return false; });
    });
    // 5) 国が無くなった外交・貿易・船は消す
    const has = (id) => !!db.nations[id];
    db.wars = (db.wars || []).filter(w => has(w.a) && has(w.b));
    db.trades = (db.trades || []).filter(t => has(t.a) && has(t.b));
    db.props = (db.props || []).filter(p => has(p.from) && has(p.to));
    db.ships = (db.ships || []).filter(sh => has(sh.from) && has(sh.to));
    Object.keys(db.nations).forEach(id => { db.nations[id].allies = db.nations[id].allies.filter(has); });
    db.free = db.free || []; db.log = db.log || [];
    try { Arts.purgeVault(Object.keys(db.nations).map(Number)); } catch (e) { /* 神器は別ファイル */ }
    if (changed && Object.keys(db.nations).length) { schedule(500); console.log("[Nation] 古い保存データを新しい版に合わせて直しました"); }
}
migrate();

module.exports = {
    CFG, init, tick, count, flush,
    state, travel, create, join, leave, kick, transfer, setPolicy, donate,
    propose, respond, breakAlly, declareWar, cancelTrade, setTradeVol,
    hire, build, demolish, plotView, plotConfig, plotDeposit, plotWithdraw, casinoBet, buybackSell, innRest, tavernBuy, shopView, shopStock, shopSetPrice, shopSetShop, shopUnstock, shopBuy,
    friendly, friendlyUnit, friendlyNid, hostileTo, provoke, taxOf, respawnPoint,
    cellOwnerAt, cellInfo, pointProgress, plotsNear, tableForClient, cellsForClient, broadcastView,
    shipArrived, shipMoved, unitKilled, nationOfPid, stockedIds,
    nationById: (id) => N(id), capitalOf: (n) => siteOf(n),
    onJoin: (P) => { const n = nationOfPid(P.pid); P.nid = n ? n.id : 0; }
};
