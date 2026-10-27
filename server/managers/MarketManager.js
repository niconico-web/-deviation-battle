// ============================================================
// MarketManager.js  ―  プレイヤー同士で売り買いする「市場」（メルカリ風）
//
//  ・出品されたアイテムはサーバーが預かる（エスクロー）。出品者は出品した瞬間に手元から消え、
//    売れたらコイン（手数料を引いた額）が「受け取り箱（mail）」に入る。取り下げたらアイテムが受け取り箱に戻る。
//  ・購入は2段階：reserve（予約）→ ack（受け取り確認）。
//      1) buyer が reserve → サーバーは出品を「予約中」にして、アイテムを返す
//      2) buyer の端末が「コインを引いてアイテムを入れた」あとに ack → ここで初めて売却成立＆出品者へ代金
//    間でクライアントが落ちても、アイテムだけ増える／コインだけ消えるが起きにくい。
//  ・最低出品価格はレア度で決まる（まとめ売りは、入れたアイテムの最低価格の合計）。サーバー側の表が正本。
//  ・データは server/data/market.json。【注意】無料プランのRenderは再起動のたびに消えるので、
//    預かり中のアイテムも消える。永続ディスクを付けるか、外部DBに置き換えること（render.yaml 参照）。
// ============================================================
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DIR, "market.json");
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

// ---------- 調整できる数値（ここだけ変えればバランスを変えられる） ----------
const CONFIG = {
    FEE_RATE: 0.05,                       // 売れたときの手数料（コインの回収）。0にすれば手数料なし
    MAX_ITEMS_PER_LISTING: 20,            // まとめ売り1件に入れられる数
    MAX_ACTIVE_PER_SELLER: 30,            // 1人が同時に出せる件数
    MAX_PRICE: 1000000000,
    RESERVE_TTL_MS: 24 * 60 * 60 * 1000,  // 予約したまま確認が来ない場合に出品へ戻すまでの時間
    LISTING_TTL_MS: 14 * 24 * 60 * 60 * 1000, // 売れ残りは14日で自動的に取り下げ（受け取り箱へ戻る）
    MAX_ITEM_BYTES: 8 * 1024,
    MAIL_KEEP: 200
};

// ---------- レア度ごとの最低出品価格 ----------
//  武器・防具・アクセサリーは同じ表（作成コストの半額が目安：ノーマル100→50 … レジェンド100000→50000）
const EQUIP_MIN = { normal: 50, magic: 500, rare: 2500, epic: 12500, legendary: 50000 };
const ORB_MIN = { tier1: 30, tier2: 200, tier3: 1000, tier4: 6000, tier5: 40000 };
const KINDS = ["weapon", "armor", "acc", "orb"];

function minPriceOfItem(kind, data) {
    if (kind === "orb") return ORB_MIN[data.tier] || 0;
    return EQUIP_MIN[data.rarity] || 0;
}

// ---------- 保存 ----------
let db = { seq: 0, listings: {}, mail: {}, ops: {} };
try {
    const j = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    if (j && typeof j === "object") db = Object.assign(db, j);
} catch (e) { /* 初回 */ }
let timer = null;
function schedule() { if (timer) return; timer = setTimeout(flush, 1500); if (timer.unref) timer.unref(); }
function flush() {
    timer = null;
    try { fs.writeFileSync(FILE + ".tmp", JSON.stringify(db), "utf-8"); fs.renameSync(FILE + ".tmp", FILE); }
    catch (e) { console.error("[Market] save failed:", e.message); }
}
function flushNow() { if (timer) { clearTimeout(timer); flush(); } }
["exit", "SIGINT", "SIGTERM"].forEach(sig => process.on(sig, () => { try { flushNow(); } catch (e) { /* 終了時のみ */ } if (sig !== "exit") process.exit(0); }));

const ID_RE = /^[A-Za-z0-9]{4,12}$/;
const isPid = (id) => ID_RE.test(String(id || ""));
const PID = (id) => String(id).toUpperCase();
const now = () => Date.now();
const fail = (reason, extra) => Object.assign({ ok: false, reason: reason }, extra || {});

// ---------- アイテムの検査 ----------
function cleanItem(raw, allowMythic) {
    if (!raw || typeof raw !== "object" || !KINDS.includes(raw.kind) || !raw.data || typeof raw.data !== "object") return null;
    let json;
    try { json = JSON.stringify(raw.data); } catch (e) { return null; }
    if (!json || json.length > CONFIG.MAX_ITEM_BYTES || json.indexOf("__proto__") !== -1) return null;
    const data = JSON.parse(json);
    if (typeof data.id !== "string" || !data.id || data.id.length > 80) return null;
    const mythic = data.rarity === "mythic" || !!data.mythicId;
    if (mythic) { if (!allowMythic || raw.kind !== "weapon") return null; }       // 神話は市場には出せない（サバイバルの預かりだけ、許可して通す）
    else if (data.locked) return null;                                           // ロック中（実績の報酬など）は出せない
    if (!mythic) { if (raw.kind === "orb") { if (!ORB_MIN[data.tier]) return null; } else { if (!EQUIP_MIN[data.rarity]) return null; } }
    return { kind: raw.kind, data: data, min: minPriceOfItem(raw.kind, data) };
}

function escrowedIds() {
    const s = new Set();
    Object.values(db.listings).forEach(l => l.items.forEach(it => s.add(it.data.id)));
    return s;
}

function itemName(it) {
    const d = it.data;
    return String(d.name || d.baseName || (it.kind === "orb" ? ("オーブ(" + (d.tier || "") + ")") : "アイテム")).slice(0, 30);
}

function pushMail(pid, mail) {
    const key = PID(pid);
    const list = db.mail[key] || (db.mail[key] = []);
    db.seq += 1;
    list.push(Object.assign({ id: "m" + db.seq + "_" + now().toString(36), at: now() }, mail));
    if (list.length > CONFIG.MAIL_KEEP) list.splice(0, list.length - CONFIG.MAIL_KEEP);
}

// ---------- 期限切れの掃除 ----------
function sweep() {
    const t = now();
    let changed = false;
    Object.values(db.listings).forEach(l => {
        if (l.status === "reserved" && t - l.reservedAt > CONFIG.RESERVE_TTL_MS) { l.status = "active"; delete l.reservedBy; delete l.reservedAt; changed = true; }
        if (l.status === "active" && t - l.createdAt > CONFIG.LISTING_TTL_MS) {
            pushMail(l.sellerId, { type: "items", items: l.items, note: "「" + l.title + "」は売れ残ったため、出品期間が終わって戻ってきました" });
            delete db.listings[l.id]; changed = true;
        }
    });
    // 古い冪等キーを捨てる
    Object.keys(db.ops).forEach(k => { if (t - db.ops[k].at > 3 * 24 * 60 * 60 * 1000) { delete db.ops[k]; changed = true; } });
    if (changed) schedule();
}
setInterval(sweep, 10 * 60 * 1000).unref();
sweep();

// opId を使った冪等化：同じ操作が再送されても、2回は実行しない（通信が切れて再送されたとき用）
function once(opId, fn) {
    if (opId && db.ops[opId]) return db.ops[opId].res;
    const res = fn();
    if (opId && res && res.ok) { db.ops[opId] = { at: now(), res: res }; schedule(); }
    return res;
}

// ---------- 出品 ----------
function list(m) {
    m = m || {};
    if (!isPid(m.playerId)) return fail("invalid");
    return once(m.opId, () => {
        const sellerId = PID(m.playerId);
        const rawItems = Array.isArray(m.items) ? m.items : [];
        if (!rawItems.length) return fail("empty");
        if (rawItems.length > CONFIG.MAX_ITEMS_PER_LISTING) return fail("too_many", { max: CONFIG.MAX_ITEMS_PER_LISTING });
        const mine = Object.values(db.listings).filter(l => l.sellerId === sellerId).length;
        if (mine >= CONFIG.MAX_ACTIVE_PER_SELLER) return fail("seller_limit", { max: CONFIG.MAX_ACTIVE_PER_SELLER });

        const taken = escrowedIds();
        const seen = new Set();
        const items = [];
        let minTotal = 0;
        for (const r of rawItems) {
            const it = cleanItem(r);
            if (!it) return fail("bad_item");
            if (seen.has(it.data.id) || taken.has(it.data.id)) return fail("duplicate_item");
            seen.add(it.data.id);
            minTotal += it.min;
            items.push({ kind: it.kind, data: it.data });
        }
        const price = Math.floor(Number(m.price));
        if (!isFinite(price) || price < 1) return fail("bad_price");
        if (price < minTotal) return fail("below_min", { min: minTotal });
        if (price > CONFIG.MAX_PRICE) return fail("above_max", { max: CONFIG.MAX_PRICE });

        let title = String(m.title || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 30);
        const filterOk = !title || titleAllowed(title);
        if (!filterOk) return fail("bad_title");
        if (!title) title = items.length === 1 ? itemName(items[0]) : (itemName(items[0]) + " ほか" + (items.length - 1) + "点");

        db.seq += 1;
        const id = "L" + db.seq.toString(36) + now().toString(36).slice(-4);
        db.listings[id] = {
            id: id, sellerId: sellerId, sellerName: String(m.sellerName || "名無し").slice(0, 20), title: title,
            items: items, price: price, minPrice: minTotal, createdAt: now(), status: "active"
        };
        schedule();
        return { ok: true, id: id, min: minTotal };
    });
}

let ContentFilter = null;
try { ContentFilter = require("./ContentFilter"); } catch (e) { /* フィルター無しでも動く */ }
function titleAllowed(text) {
    if (!ContentFilter) return true;
    try { const r = ContentFilter.validateText(text); return !(r && r.valid === false); }
    catch (e) { return true; }
}

// ---------- 取り下げ ----------
function cancel(m) {
    m = m || {};
    if (!isPid(m.playerId)) return fail("invalid");
    const l = db.listings[m.listingId];
    if (!l || l.sellerId !== PID(m.playerId)) return fail("not_found");
    if (l.status === "reserved") return fail("reserved");
    pushMail(l.sellerId, { type: "items", items: l.items, note: "「" + l.title + "」の出品を取り下げました" });
    delete db.listings[l.id];
    schedule();
    return { ok: true };
}

// ---------- 閲覧 ----------
function publicView(l, viewerId) {
    return {
        id: l.id, title: l.title, price: l.price, minPrice: l.minPrice, sellerName: l.sellerName, createdAt: l.createdAt,
        status: l.status, mine: !!viewerId && l.sellerId === viewerId,
        count: l.items.length, kinds: Array.from(new Set(l.items.map(i => i.kind))),
        top: topRarity(l), items: l.items
    };
}
const RANK = { normal: 0, tier1: 0, magic: 1, tier2: 1, rare: 2, tier3: 2, epic: 3, tier4: 3, legendary: 4, tier5: 4 };
function topRarity(l) {
    let best = 0, key = "normal";
    l.items.forEach(i => { const k = i.kind === "orb" ? i.data.tier : i.data.rarity; const r = RANK[k] || 0; if (r >= best) { best = r; key = k; } });
    return key;
}

function browse(m) {
    m = m || {};
    const viewer = isPid(m.playerId) ? PID(m.playerId) : null;
    const q = String(m.q || "").trim().toLowerCase().slice(0, 30);
    const kind = KINDS.includes(m.kind) ? m.kind : null;
    const rarity = m.rarity ? String(m.rarity) : null;
    let rows = Object.values(db.listings).filter(l => l.status === "active" || l.status === "reserved");
    if (kind) rows = rows.filter(l => l.items.some(i => i.kind === kind));
    if (rarity) rows = rows.filter(l => l.items.some(i => (i.kind === "orb" ? i.data.tier : i.data.rarity) === rarity));
    if (q) rows = rows.filter(l => l.title.toLowerCase().indexOf(q) !== -1 || l.items.some(i => itemName(i).toLowerCase().indexOf(q) !== -1));
    if (m.maxPrice > 0) rows = rows.filter(l => l.price <= m.maxPrice);
    const sort = m.sort || "new";
    rows.sort((a, b) => sort === "cheap" ? a.price - b.price : sort === "pricey" ? b.price - a.price : b.createdAt - a.createdAt);
    const pageSize = Math.max(1, Math.min(30, Math.floor(m.pageSize) || 12));
    const page = Math.max(0, Math.floor(m.page) || 0);
    return { ok: true, total: rows.length, page: page, pageSize: pageSize, rows: rows.slice(page * pageSize, page * pageSize + pageSize).map(l => publicView(l, viewer)) };
}

function mine(m) {
    if (!m || !isPid(m.playerId)) return fail("invalid");
    const id = PID(m.playerId);
    return { ok: true, rows: Object.values(db.listings).filter(l => l.sellerId === id).sort((a, b) => b.createdAt - a.createdAt).map(l => publicView(l, id)) };
}

// ---------- 購入（予約 → 確認） ----------
function reserve(m) {
    m = m || {};
    if (!isPid(m.playerId)) return fail("invalid");
    const buyerId = PID(m.playerId);
    const l = db.listings[m.listingId];
    if (!l) return fail("gone");                                       // 売り切れ／取り下げ
    if (l.sellerId === buyerId) return fail("own");
    if (l.status === "reserved") {
        if (l.reservedBy === buyerId) return { ok: true, listing: publicView(l, buyerId), resumed: true };   // 自分の予約の再送
        return fail("reserved");
    }
    if (Math.floor(Number(m.coins)) < l.price) return fail("no_coins");   // 端末の所持コイン（最終確認は端末側のack時）
    l.status = "reserved"; l.reservedBy = buyerId; l.reservedAt = now();
    schedule();
    return { ok: true, listing: publicView(l, buyerId), fee: feeOf(l.price) };
}
function feeOf(price) { return Math.floor(price * CONFIG.FEE_RATE); }

// 端末が「コインを引いてアイテムを入れた」あとに呼ぶ。ここで売却が確定し、出品者に代金が入る
function ack(m) {
    m = m || {};
    if (!isPid(m.playerId)) return fail("invalid");
    return once(m.opId || ("ack:" + m.listingId), () => {
        const buyerId = PID(m.playerId);
        const l = db.listings[m.listingId];
        if (!l) return { ok: true, already: true };                       // もう確定済み（再送）
        if (l.status !== "reserved" || l.reservedBy !== buyerId) return fail("not_yours");
        const fee = feeOf(l.price), gain = l.price - fee;
        pushMail(l.sellerId, { type: "coins", amount: gain, note: "「" + l.title + "」が " + l.price.toLocaleString("ja-JP") + " コインで売れました（手数料 " + fee.toLocaleString("ja-JP") + "）" });
        delete db.listings[l.id];
        schedule();
        return { ok: true, gain: gain };
    });
}

// 購入をやめる（コインが足りなかった・画面を閉じたなど）。予約を解く
function release(m) {
    m = m || {};
    if (!isPid(m.playerId)) return fail("invalid");
    const l = db.listings[m.listingId];
    if (!l || l.status !== "reserved" || l.reservedBy !== PID(m.playerId)) return { ok: true };
    l.status = "active"; delete l.reservedBy; delete l.reservedAt;
    schedule();
    return { ok: true };
}

// 自分が予約したまま確認していないもの（通信が切れたときの復旧用）
function pendingFor(m) {
    if (!m || !isPid(m.playerId)) return fail("invalid");
    const id = PID(m.playerId);
    return { ok: true, rows: Object.values(db.listings).filter(l => l.status === "reserved" && l.reservedBy === id).map(l => publicView(l, id)) };
}

// ---------- 受け取り箱 ----------
function mailbox(m) {
    if (!m || !isPid(m.playerId)) return fail("invalid");
    return { ok: true, mail: (db.mail[PID(m.playerId)] || []).slice() };
}
// 端末が受け取りを終えたメールを消す（ids はメールID）
function mailDone(m) {
    if (!m || !isPid(m.playerId) || !Array.isArray(m.ids)) return fail("invalid");
    const key = PID(m.playerId), ids = new Set(m.ids.map(String));
    if (db.mail[key]) { db.mail[key] = db.mail[key].filter(x => !ids.has(x.id)); if (!db.mail[key].length) delete db.mail[key]; schedule(); }
    return { ok: true };
}

function info() {
    return { feeRate: CONFIG.FEE_RATE, maxItems: CONFIG.MAX_ITEMS_PER_LISTING, maxPrice: CONFIG.MAX_PRICE, equipMin: EQUIP_MIN, orbMin: ORB_MIN, maxActive: CONFIG.MAX_ACTIVE_PER_SELLER };
}

// ---- サバイバルエリアなど、他の機能が「預かり・返却」に使う窓口 ----
function validateItem(raw, allowMythic) { const it = cleanItem(raw, !!allowMythic); return it ? { kind: it.kind, data: it.data } : null; }
// 預かっていたアイテムを持ち主の受け取り箱へ返す（サーバーが落ちても、受け取り箱に残る）
function returnItems(pid, items, note) {
    if (!isPid(pid) || !Array.isArray(items) || !items.length) return false;
    pushMail(pid, { type: "items", items: items, note: note || "預かっていたアイテムが戻ってきました" });
    schedule(); return true;
}

module.exports = { validateItem, escrowedIds, returnItems, CONFIG, EQUIP_MIN, ORB_MIN, minPriceOfItem, list, cancel, browse, mine, reserve, ack, release, pendingFor, mailbox, mailDone, info, flushNow };
