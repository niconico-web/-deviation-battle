// ============================================================
// SurvivalManager.js ― サバイバルエリア（完全PvPのオープンワールド）をサーバーが動かす
//
//  ・移動・攻撃・ダメージ・敵・ボス・弾はすべてサーバーが計算し、20回/秒で「見える範囲」のぶんを各自へ配る
//    （町のように位置を中継するだけだと、PvPで不正がそのまま通ってしまうため）
//  ・クライアントが送るのは「どちらへ動くか／どちらを向いて攻撃しているか」だけ
//  ・ステータスは参加時に端末から申告される（第1段階）。そのため上限で丸め、PvPは「相手の最大HPに対する割合」
//    で計算して、極端な申告でも一撃必殺にならないようにしている。
//    → 第2段階で、装備をサーバーが預かる方式にして、申告に頼らないようにする
//  ・敵は「プレイヤーの近く」にだけ湧かせる（誰もいない場所は計算しない）ので、広大なマップでも軽い
// ============================================================
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SW = require("../../client/js/survival-world.js");
const Market = require("./MarketManager");
const Loot = require("./LootGenerator");

// ---------- 預かり中の装備の保存（サーバーが落ちても、持ち主へ返せるように） ----------
const SESS_FILE = path.join(__dirname, "..", "data", "survival.json");
let sessTimer = null;
function saveSessions() {
    if (sessTimer) return;
    sessTimer = setTimeout(() => {
        sessTimer = null;
        const out = {};
        players.forEach(P => { if (P.pid && P.carry.length) out[P.pid] = { items: P.carry, at: Date.now() }; });
        try { fs.writeFileSync(SESS_FILE + ".tmp", JSON.stringify({ sessions: out }), "utf-8"); fs.renameSync(SESS_FILE + ".tmp", SESS_FILE); }
        catch (e) { console.error("[Survival] session save failed:", e.message); }
    }, 300);
    if (sessTimer.unref) sessTimer.unref();
}
// 起動時：前回の預かり分が残っていたら、全員の受け取り箱へ返す（落ちた・再起動した場合の救済）
(function recover() {
    try {
        const j = JSON.parse(fs.readFileSync(SESS_FILE, "utf-8"));
        let n = 0;
        Object.keys(j.sessions || {}).forEach(pid => { if (Market.returnItems(pid, j.sessions[pid].items, "サバイバルエリアで預かっていた装備が戻ってきました（サーバー再起動）")) n++; });
        fs.writeFileSync(SESS_FILE, JSON.stringify({ sessions: {} }), "utf-8");
        if (n) console.log("[Survival] returned carried gear to " + n + " players after restart");
    } catch (e) { /* 初回 */ }
})();

// ---------- 武器の種類表（クライアントと同じ hw-weapons.js から読む） ----------
let TYPES = { sword: { kind: "cone", range: 78, arc: 1.7, cd: 0.42, mult: 1.0 } };
let PCT_CAP = 0.5;
let MYTHIC_IDS = [];
try {
    const sb = { localStorage: { getItem: () => null, setItem() {} }, console: { log() {}, warn() {}, error() {} }, document: {}, navigator: {} };
    sb.window = sb; vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "client", "js", "hw-weapons.js"), "utf8"), sb);
    if (sb.HW && sb.HW.TYPES) { TYPES = sb.HW.TYPES; PCT_CAP = sb.HW.PCT_CAP || 0.5; MYTHIC_IDS = Object.keys(sb.HW.MYTHICS || {}); }
const C = {
    TICK_MS: 50, MAX_PLAYERS: 60, MAX_MONSTERS: 420, AOI: 1300, PLAYER_R: 14,
    BASE_SPEED: 240, REGEN_DELAY: 5, REGEN_PCT: 0.02, RESPAWN_S: 5, INVULN_S: 3, COMBAT_S: 8,
    PVP_PCT: 0.07,            // 武器1発(攻撃力が基準の武器)で相手の最大HPの何%を削るか
    PVP_CAP_PCT: 0.35,        // 1発で削れる上限（どんな申告でも一撃では死なない）
    DEF_K: 300,               // 防御による軽減：def / (def + DEF_K)（最大60%）
    DENSITY: [0, 9, 8, 8],    // ゾーン(tier)ごとに、プレイヤーの周り(半径1300)に維持する敵の数
    DESPAWN_DIST: 2200, SPAWN_MIN: 650, SPAWN_MAX: 1100, BOSS_RESPAWN_S: 300,
    MAX_HOLD: 40, CHEST_RANGE: 85, CHEST_CHANNEL_S: 1.6, CHEST_RESPAWN_S: 600, RUIN_CHEST_RESPAWN_S: 900, RUIN_TARGET: 9, RUIN_BOSS_RESPAWN_S: 480,
    PVP_LASER_MUL: 0.35, ULT_CD_S: 30, ULT_PVP_MUL: 0.15, ULT_PVP_CAP: 0.4, MYTHIC_CHEST: 0.0005, MYTHIC_RUIN_CHEST: 0.0015,   // 神話が宝箱から出る確率（危険度ごとに×1〜3）
    MAX_CARRY: 16, STEAL_PAIR_CD_S: 120   // 持ち込める点数／同じ相手から続けて奪えない時間
};
const MON = {
    1: [
        { name: "ゴブリン弓兵", icon: "🏹", hp: 4, dmg: 0.05, spd: 120, r: 15, aggro: 480, range: 360, ranged: true, cd: 1.8, coins: [8, 14] }
    ],
    2: [
        { name: "オーク戦士", icon: "👹", hp: 12, dmg: 0.09, spd: 140, r: 20, aggro: 380, range: 32, cd: 1.1, coins: [35, 60] },
        { name: "岩のゴーレム", icon: "🗿", hp: 22, dmg: 0.12, spd: 90, r: 26, aggro: 300, range: 38, cd: 1.6, coins: [50, 80] },
        { name: "呪術師", icon: "🧙", hp: 9, dmg: 0.08, spd: 120, r: 16, aggro: 520, range: 400, ranged: true, cd: 1.6, coins: [40, 65] }
    ],
    3: [
        { name: "虚無の騎士", icon: "⚔️", hp: 30, dmg: 0.14, spd: 165, r: 20, aggro: 460, range: 34, cd: 1.0, coins: [140, 220] },
        { name: "次元獣", icon: "🦑", hp: 26, dmg: 0.11, spd: 130, r: 24, aggro: 560, range: 420, ranged: true, cd: 1.4, coins: [150, 240] },
        { name: "深淵の影", icon: "👻", hp: 20, dmg: 0.13, spd: 200, r: 16, aggro: 500, range: 28, cd: 0.9, coins: [130, 200] }
    ]
};
const DEMON = { name: "不壊の悪魔", icon: "😈", hp: 420, dmg: 0.22, spd: 135, r: 52, aggro: 1100, range: 60, cd: 1.2, coins: 6000 };
const DEMON_NEST = 5;
const BOSS = { icon: "💀", hp: 260, dmg: 0.2, spd: 150, r: 46, aggro: 900, range: 56, cd: 1.3, coins: 3000 };

const players = new Map();      // socket.id -> P
const monsters = new Map();     // id -> M
const projs = [];
let events = [];                // このtickで起きた演出（ダメージ数字など）
let nextEid = 1, nextMid = 1;
const chestState = new Map();          // 宝箱id -> 次に開けられる時刻
const ruinState = SW.RUINS.map(() => ({ bossMid: 0, bossRespawnAt: 0 }));
const nests = SW.NESTS.map(n => ({ id: n.id, alive: false, mid: 0, respawnAt: 0 }));
let io = null, loop = null, tickN = 0, lastSpawnAt = 0;

const now = () => Date.now() / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d) => (isFinite(Number(v)) ? Number(v) : d);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const reduction = (def) => clamp(def / (def + C.DEF_K), 0, 0.6);
function unitPower(P) {                                   // 攻撃力(atk)による火力の伸び：1〜3倍で頭打ち
    return clamp(1 + Math.log2(1 + P.atkStat / 50) * 0.35, 1, 3);
}

function init(ioServer) { io = ioServer; }

// ---------- 参加・退出 ----------
function sanitizeName(s) { return String(s || "名無し").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || "名無し"; }
function join(socket, data) {
    if (players.has(socket.id)) return { ok: true, resumed: true, me: roster(players.get(socket.id)), roster: allRoster() };
    if (players.size >= C.MAX_PLAYERS) return { ok: false, reason: "full", max: C.MAX_PLAYERS };
    data = data || {};
    const pid = /^[A-Za-z0-9]{4,12}$/.test(String(data.playerId || "")) ? String(data.playerId).toUpperCase() : null;
    if (!pid) return { ok: false, reason: "invalid" };
    for (const O of players.values()) if (O.pid === pid) return { ok: false, reason: "already" };          // 同じキャラの二重参加は不可
    const st = data.stats || {}, wp = data.weapon || {};
    const type = TYPES[wp.type] ? wp.type : "sword";
    const a = Math.random() * Math.PI * 2, rr = Math.random() * SW.SAFE_R * 0.6;
    const P = {
        eid: nextEid++, sid: socket.id, name: sanitizeName(data.name), level: clamp(Math.floor(num(data.level, 1)), 1, 9999),
        avatar: data.avatar && typeof data.avatar === "object" ? safeAvatar(data.avatar) : null,
        x: SW.CX + Math.cos(a) * rr, y: SW.CY + Math.sin(a) * rr, dir: 0, aim: 0, mx: 0, my: 0, firing: false,
        maxHp: clamp(Math.round(num(st.maxHp, 100)), 20, 1e7), hp: 0, atkStat: 0, def: clamp(num(st.def, 0), 0, 1e7),
        wmythic: (wp.mythic && MYTHIC_IDS.indexOf(String(wp.mythic)) >= 0) ? String(wp.mythic) : null, wtype: type, wname: String(wp.name || TYPES[type].label || "武器").slice(0, 24), wpct: clamp(num(wp.pct, 0), 0, PCT_CAP),
        nextAtk: 0, lastHurt: 0, lastCombat: 0, invuln: now() + C.INVULN_S, dead: false, respawnAt: 0, ghostUntil: 0,
        kills: 0, deaths: 0, coinsGained: 0, seq: 0,
        pid: pid, carry: [], weaponItemId: null, stealCd: {}, use: false, chan: null, ultReq: false, ult: null, ultReadyAt: 0
    };
    // 持ち込み装備：サーバーが預かる（出るときに返す。PvPで倒されると、この中から1つ奪われる）
    const taken = new Set(Market.escrowedIds()); players.forEach(O => O.carry.forEach(it => taken.add(it.data.id)));
    const raw = Array.isArray(data.items) ? data.items.slice(0, C.MAX_CARRY) : [];
    raw.forEach(r => {
        const it = Market.validateItem(r); if (!it || taken.has(it.data.id)) return;
        taken.add(it.data.id);
        const eq = typeof (r && r.eq) === "string" && /^(weapon|armor:[a-z_]{1,12}|acc)$/.test(r.eq) ? r.eq : null;
        P.carry.push({ kind: it.kind, data: it.data, eq: eq });
        if (it.kind === "weapon" && wp.id && wp.id === it.data.id) P.weaponItemId = it.data.id;
    });
    P.atkStat = clamp(num(st.atk, 10), 1, 1e7);
    P.hp = P.maxHp;
    players.set(socket.id, P);
    saveSessions();
    socket.join("survival");
    io.to("survival").emit("survival:joined", roster(P));
    if (!loop) loop = setInterval(tick, C.TICK_MS);
    return { ok: true, me: roster(P), roster: allRoster(), world: { size: SW.SIZE, seed: SW.SEED }, tick: C.TICK_MS, carried: P.carry.map(it => it.data.id) };
}
function safeAvatar(av) { try { const j = JSON.stringify(av); return j.length < 2000 ? JSON.parse(j) : null; } catch (e) { return null; } }
function roster(P) { return { eid: P.eid, name: P.name, level: P.level, avatar: P.avatar, weapon: P.wname }; }
function allRoster() { return Array.from(players.values()).map(roster); }

function remove(sid) {
    const P = players.get(sid); if (!P) return 0;
    const returned = settle(P);
    players.delete(sid);
    if (io) io.to("survival").emit("survival:left", { eid: P.eid });
    saveSessions();
    if (!players.size) { monsters.clear(); projs.length = 0; nests.forEach(n => { n.alive = false; n.mid = 0; }); if (loop) { clearInterval(loop); loop = null; } }
    return returned;
}
// 預かっていた装備を、持ち主の受け取り箱へ返す
function settle(P) {
    const n = P.carry.length; if (!n) return 0;
    Market.returnItems(P.pid, P.carry, "サバイバルエリアから持ち帰った装備（" + n + "点）");
    P.carry = [];
    return n;
}
// 退出の申請：戦闘直後は不可（切断して逃げるのを防ぐ）
function leave(socket, force) {
    const P = players.get(socket.id); if (!P) return { ok: true };
    const wait = Math.ceil(P.lastCombat + C.COMBAT_S - now());
    if (wait > 0 && !P.dead) {
        if (!force) return { ok: false, reason: "combat", wait: wait };
        // 画面を閉じた／別の画面へ移った場合：体はその場に残る（戦闘中の逃げ得は不可）。時間が来たら退出して装備が戻る
        P.ghost = true; P.ghostUntil = now() + wait; P.mx = P.my = 0; P.firing = false;
        return { ok: true, ghost: true, returned: 0 };
    }
    socket.leave("survival");
    return { ok: true, returned: remove(socket.id) };
}
function disconnect(socket) {
    const P = players.get(socket.id); if (!P) return;
    const wait = P.lastCombat + C.COMBAT_S - now();
    if (wait > 0 && !P.dead) { P.ghost = true; P.ghostUntil = now() + wait; P.mx = P.my = 0; P.firing = false; return; }   // 戦闘中の切断：体は残る
    remove(socket.id);
}
function input(socket, m) {
    const P = players.get(socket.id); if (!P || P.dead || P.ghost || !m) return;
    let mx = clamp(num(m.mx, 0), -1, 1), my = clamp(num(m.my, 0), -1, 1);
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    P.mx = mx; P.my = my; P.aim = num(m.aim, P.aim); P.firing = !!m.atk; P.use = !!m.use; P.ultReq = !!m.ult; P.seq = (m.seq | 0);
}

// ---------- 攻撃 ----------
function hitUnits(P, T) { return T.mult * (1 + P.wpct) * unitPower(P); }
function playerAttack(P, t) {
    const T = TYPES[P.wtype]; if (!T || t < P.nextAtk) return;
    P.nextAtk = t + clamp(T.cd || 0.5, 0.15, 3);
    const dir = P.aim, c = Math.cos(dir), s = Math.sin(dir);
    P.dir = dir;
    if (T.kind === "lasers") {                                  // 不壊：自分の周りから7本のレーザーを、近くの敵へ自動で狙って当てる（命中は即時）
        const N = T.count || 7, R = T.range || 520, units = hitUnits(P, T), foes = [];
        monsters.forEach(M => { const d = dist(P, M) - M.r; if (d < R) foes.push({ m: M, d: d }); });
        if (!SW.inSafe(P.x, P.y)) players.forEach(O => { if (O !== P && !O.dead && !SW.inSafe(O.x, O.y)) { const d = dist(P, O) - C.PLAYER_R; if (d < R) foes.push({ p: O, d: d }); } });
        foes.sort((a, b) => a.d - b.d);
        for (let i = 0; i < N; i++) {
            const oa = t * 1.6 + i * Math.PI * 2 / N, ex = P.x + Math.cos(oa) * 34, ey = P.y + Math.sin(oa) * 34, f = foes[foes.length ? i % foes.length : 0];
            if (f) {
                const o = f.m || f.p;
                events.push(["l", Math.round(ex), Math.round(ey), Math.round(o.x), Math.round(o.y), 0]);
                if (f.m) damageMonster(f.m, units, P); else if (!f.p.dead) damagePlayer(f.p, pvpDamage(f.p, units * C.PVP_LASER_MUL), P, null);
            } else events.push(["l", Math.round(ex), Math.round(ey), Math.round(ex + Math.cos(oa) * 150), Math.round(ey + Math.sin(oa) * 150), 0]);
        }
        return;
    }
    const inShape = (tx, ty, tr) => {
        const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy);
        switch (T.kind) {
            case "cone": case "chain": { if (T.kind === "chain") return inLine(dx, dy, T.range || 200, (T.width || 22) + tr); if (d > (T.range || 80) + tr) return false; let da = Math.abs(Math.atan2(dy, dx) - dir); da = da > Math.PI ? 2 * Math.PI - da : da; return da <= (T.arc || 1.7) / 2 || d < tr + 12; }
            case "line": return inLine(dx, dy, T.range || 150, (T.width || 24) + tr);
            case "smash": { const cx = dx - c * (T.reach || 60), cy = dy - s * (T.reach || 60); return Math.hypot(cx, cy) <= (T.radius || 90) + tr; }
            case "ring": return d <= (T.radius || 100) + tr;
            default: return false;
        }
    };
    const inLine = (dx, dy, len, w) => { const f = dx * c + dy * s, side = Math.abs(-dx * s + dy * c); return f >= -10 && f <= len && side <= w; };
    if (T.kind === "proj") {
        const n = Math.max(1, T.spread || 1);
        for (let i = 0; i < n; i++) {
            const a = dir + (n > 1 ? (i - (n - 1) / 2) * 0.12 : 0);
            projs.push({ x: P.x + Math.cos(a) * 20, y: P.y + Math.sin(a) * 20, vx: Math.cos(a) * (T.speed || 600), vy: Math.sin(a) * (T.speed || 600), r: T.radius || 8,
                life: (T.range || 700) / (T.speed || 600), own: "p", oid: P.eid, units: hitUnits(P, T) / (n > 2 ? 2 : 1), pierce: T.pierce || 0, hit: new Set() });
        }
        return;
    }
    const units = hitUnits(P, T);
    if (!SW.inSafe(P.x, P.y)) players.forEach(O => { if (O !== P && !O.dead && inShape(O.x, O.y, C.PLAYER_R)) damagePlayer(O, pvpDamage(O, units), P, null); });
    monsters.forEach(M => { if (inShape(M.x, M.y, M.r)) damageMonster(M, units, P); });
}
function pvpDamage(O, units) { return Math.min(O.maxHp * C.PVP_CAP_PCT, O.maxHp * C.PVP_PCT * units) * (1 - reduction(O.def)); }

function damagePlayer(O, dmg, byPlayer, byMonster) {
    const t = now();
    if (O.dead || t < O.invuln || SW.inSafe(O.x, O.y)) return;
    if (byPlayer && SW.inSafe(byPlayer.x, byPlayer.y)) return;                // 安全地帯からの攻撃はなし
    dmg = Math.max(1, Math.round(dmg));
    O.hp -= dmg; O.lastHurt = t; O.lastCombat = t;
    if (byPlayer) byPlayer.lastCombat = t;
    events.push(["h", Math.round(O.x), Math.round(O.y - 20), dmg, 1]);
    if (O.hp <= 0) {
        O.hp = 0; O.dead = true; O.deaths++; O.respawnAt = t + C.RESPAWN_S; O.mx = O.my = 0; O.firing = false; O.chan = null; O.ult = null;
        if (byPlayer) { byPlayer.kills++; feed("⚔️ " + byPlayer.name + " が " + O.name + " を倒した！"); stealOne(byPlayer, O, t); }
        else feed("☠️ " + O.name + " は " + (byMonster ? byMonster.name : "何か") + " にやられた");
        if (O.ghost) remove(O.sid);
    }
}
// ---------- 必殺技「不壊の怒り・全方位照射」（武器：不壊）----------
//  自分のまわりの広い範囲（半径620）に砲門が並び、中心へ向けて大量のビームを撃つ。撃ち切ったあと、逆回転でもう一度。
//  ビームは撃つ前に細い予告線が出る（避けられる）。プレイヤーへの威力は小さく、1回の必殺技で与えられる合計にも上限がある。
const ULT = { R: 620, W: 54, N: 22, STEP: 0.37, GAP: 0.12, WARN: 0.3, MULT: 0.8 };
function startUlt(P, t) {
    P.ultReadyAt = t + C.ULT_CD_S; P.invuln = Math.max(P.invuln, t + 1.5);
    P.ult = { cx: P.x, cy: P.y, off: Math.random() * 6.28, t0: t + 0.5, fired: 0, pend: [], dealt: {}, hitAt: {} };
    events.push(["u", Math.round(P.x), Math.round(P.y), ULT.R]);
}
function tickUlt(P, t) {
    const U = P.ult; if (!U) return;
    const total = ULT.N * 2, units = ULT.MULT * (1 + P.wpct) * unitPower(P);
    // 次のビームの予告を出す
    while (U.fired < total && t >= U.t0 + U.fired * ULT.GAP + (U.fired >= ULT.N ? 0.45 : 0)) {
        const k = U.fired % ULT.N, theta = U.off + (U.fired < ULT.N ? k * ULT.STEP : (ULT.N - 1 - k) * ULT.STEP + 0.18);
        const gx = clamp(U.cx + Math.cos(theta) * ULT.R, 40, SW.SIZE - 40), gy = clamp(U.cy + Math.sin(theta) * ULT.R, 40, SW.SIZE - 40);
        const a = Math.atan2(U.cy - gy, U.cx - gx), len = ULT.R * 1.9;
        const b = { gx: gx, gy: gy, x2: gx + Math.cos(a) * len, y2: gy + Math.sin(a) * len, at: t + ULT.WARN };
        U.pend.push(b); U.fired++;
        events.push(["l", Math.round(gx), Math.round(gy), Math.round(b.x2), Math.round(b.y2), 3]);
    }
    // 予告から少し経ったビームを撃つ
    for (let i = U.pend.length - 1; i >= 0; i--) {
        const b = U.pend[i]; if (t < b.at) continue;
        U.pend.splice(i, 1);
        events.push(["l", Math.round(b.gx), Math.round(b.gy), Math.round(b.x2), Math.round(b.y2), 2]);
        const segDist = (px, py) => { const dx = b.x2 - b.gx, dy = b.y2 - b.gy, l2 = dx * dx + dy * dy; let u = l2 ? ((px - b.gx) * dx + (py - b.gy) * dy) / l2 : 0; u = clamp(u, 0, 1); return Math.hypot(px - (b.gx + dx * u), py - (b.gy + dy * u)); };
        monsters.forEach(M => { if (segDist(M.x, M.y) < ULT.W / 2 + M.r) damageMonster(M, units, P); });
        if (!SW.inSafe(P.x, P.y)) players.forEach(O => {
            if (O === P || O.dead || SW.inSafe(O.x, O.y) || segDist(O.x, O.y) >= ULT.W / 2 + C.PLAYER_R) return;
            const dmg = pvpDamage(O, units * C.ULT_PVP_MUL), cap = O.maxHp * C.ULT_PVP_CAP, got = U.dealt[O.eid] || 0;
            if (got >= cap || (U.hitAt[O.eid] || 0) > t) return;                                   // 1回の必殺技で与えられる合計の上限／同じ相手に連続では当たらない
            U.hitAt[O.eid] = t + 0.25; U.dealt[O.eid] = got + dmg; damagePlayer(O, dmg, P, null);
        });
    }
    if (U.fired >= total && !U.pend.length) P.ult = null;
}

// ---------- 戦利品（宝箱・ボス・敵のドロップ） ----------
//  手に入れた装備は、持ち込み装備と同じ「預かり」に入る（＝倒されると奪われる可能性がある）。町へ戻ると受け取り箱から手元へ。
const RAR_JP = { mythic: "神話", normal: "ノーマル", magic: "マジック", rare: "レア", epic: "エピック", legendary: "レジェンド", tier1: "ティア1", tier2: "ティア2", tier3: "ティア3", tier4: "ティア4", tier5: "ティア5" };
function giveItems(P, specs, src, ready) {
    const got = [];
    (ready || []).concat(specs.map(sp => Loot.rollItem(sp))).forEach(it => {
        if (!it) return;
        if (P.carry.length >= C.MAX_HOLD) { return; }                       // 持ちきれない
        const ok = Market.validateItem(it, true); if (!ok) return;
        P.carry.push({ kind: ok.kind, data: ok.data, eq: null });
        got.push({ name: labelOf(ok), rarity: RAR_JP[ok.kind === "orb" ? ok.data.tier : ok.data.rarity] || "", kind: ok.kind, top: (ok.kind === "orb" ? ok.data.tier : ok.data.rarity) === "legendary" || ok.data.tier === "tier5" || ok.data.rarity === "mythic", mythic: ok.data.rarity === "mythic" });
    });
    if (got.length) {
        saveSessions();
        const s = io && io.sockets.sockets.get(P.sid); if (s) s.emit("survival:loot", { src: src, items: got });
        got.filter(g => g.top).forEach(g => feed("✨ " + P.name + " が「" + g.name + "」を手に入れた！（" + g.rarity + "）"));
    }
    return got.length;
}
function giveCoins(P, coins, text) {
    if (coins <= 0) return;
    P.coinsGained += coins;
    const s = io && io.sockets.sockets.get(P.sid); if (s) s.emit("survival:reward", { coins: coins, text: text });
}
function openChest(P, ch, t) {
    chestState.set(ch.id, t + (ch.ruin != null ? C.RUIN_CHEST_RESPAWN_S : C.CHEST_RESPAWN_S));
    const tier = Math.max(1, ch.tier), inRuin = ch.ruin != null;
    const coinRange = { 1: [30, 80], 2: [120, 260], 3: [400, 800] }[tier];
    const coins = Math.round((coinRange[0] + Math.random() * (coinRange[1] - coinRange[0])) * (inRuin ? 2 : 1));
    giveCoins(P, coins, "宝箱を開けた！");
    const minR = tier >= 3 ? (inRuin ? "epic" : "rare") : tier === 2 ? (inRuin ? "rare" : "magic") : (inRuin ? "magic" : "normal");
    const specs = [];
    if (inRuin || Math.random() < (tier === 1 ? 0.35 : tier === 2 ? 0.55 : 0.75)) specs.push({ tier: tier, minRarity: minR, legend: inRuin ? 0.02 * tier : 0.005 * tier });
    if (inRuin && Math.random() < 0.4) specs.push({ tier: tier, minRarity: minR });
    events.push(["o", Math.round(ch.x), Math.round(ch.y)]);
    const ready = [];
    if (Math.random() < (inRuin ? C.MYTHIC_RUIN_CHEST : C.MYTHIC_CHEST) * tier) { const m = Loot.makeMythic(); if (m) ready.push(m); }      // 神話の武器（専用のもの以外）
    giveItems(P, specs, inRuin ? "遺跡の宝箱" : "宝箱", ready);
}
function chestAt(P, t) {
    let best = null, bd = C.CHEST_RANGE;
    SW.chestsNear(P.x, P.y, C.CHEST_RANGE).forEach(ch => { if ((chestState.get(ch.id) || 0) > t) return; const d = Math.hypot(ch.x - P.x, ch.y - P.y); if (d < bd) { bd = d; best = ch; } });
    return best;
}

// ---------- 装備の奪取：倒した相手の持ち込み装備から、ランダムに1つを自分のものにする ----------
//  ・どちらも「装備を持ち込んでいる」ときだけ成立（手ぶらで入った人は、奪えない代わりに奪われもしない）
//  ・同じ相手から続けては奪えない（復活直後の連続狩りを防ぐ）
function labelOf(it) {
    const d = it.data;
    if (it.kind === "orb") return "オーブ（" + (d.tier || "") + "）";
    return String(d.name || ((d.prefix || "") + (d.baseName || "")) || "装備").slice(0, 24);
}
function stealOne(K, V, t) {
    if (!K.carry.length || !V.carry.length) return;
    if ((K.stealCd[V.eid] || 0) > t) return;
    K.stealCd[V.eid] = t + C.STEAL_PAIR_CD_S;
    const it = V.carry.splice(Math.floor(Math.random() * V.carry.length), 1)[0];
    K.carry.push({ kind: it.kind, data: it.data, eq: null });
    if (it.kind === "weapon" && it.data.id === V.weaponItemId) { V.wtype = "fist"; V.wpct = 0; V.wname = "素手"; V.wmythic = null; V.weaponItemId = null; V.ult = null; }   // 武器を失うと素手に
    else if (it.kind === "armor" || it.kind === "acc") V.def = V.def * 0.9;                                                             // 防具を失うと防御が下がる
    saveSessions();
    const label = labelOf(it);
    feed("🎒 " + K.name + " が " + V.name + " の「" + label + "」を奪った！");
    const send = (P, role) => { const s = io && io.sockets.sockets.get(P.sid); if (s) s.emit("survival:steal", { role: role, name: label, kind: it.kind, other: role === "killer" ? V.name : K.name }); };
    send(K, "killer"); send(V, "victim");
}
function damageMonster(M, units, P) {
    if (M.dead) return;
    M.hp -= units; M.dmgBy[P.eid] = (M.dmgBy[P.eid] || 0) + units; P.lastCombat = now(); M.target = P.eid;
    events.push(["h", Math.round(M.x), Math.round(M.y - M.r - 6), Math.max(1, Math.round(units * 10)), 0]);
    if (M.hp <= 0) killMonster(M);
}
function killMonster(M) {
    M.dead = true; monsters.delete(M.id);
    events.push(["d", Math.round(M.x), Math.round(M.y)]);
    const total = Object.values(M.dmgBy).reduce((a, b) => a + b, 0) || 1;
    const coinsAll = M.boss ? (M.demon ? DEMON.coins : BOSS.coins) : Math.round(M.coins[0] + Math.random() * (M.coins[1] - M.coins[0]));
    players.forEach(P => {
        const share = (M.dmgBy[P.eid] || 0) / total;
        if (share < 0.1) return;                                                   // 1割以上削った人に、貢献度に応じて分配
        const coins = Math.max(1, Math.round(coinsAll * share));
        P.coinsGained += coins;
        const s = io && io.sockets.sockets.get(P.sid);
        if (s) s.emit("survival:reward", { coins: coins, text: M.name + " を倒した！" });
        // 装備の戦利品：ネストのボス＞遺跡の守護者＞ふつうの敵（まれに）
        if (M.demon) { const w = Loot.makeMythic("legend_unbreakable"); if (w) giveItems(P, [{ tier: 3, minRarity: "epic", legend: 0.4 }], "不壊の悪魔の宝", [w]); }
        else if (M.boss) giveItems(P, [{ tier: 3, minRarity: "epic", legend: 0.25 }], "ボスの宝");
        else if (M.ruinBoss) giveItems(P, [{ tier: M.tier, minRarity: M.tier >= 3 ? "epic" : "rare", legend: 0.05 * M.tier }], "遺跡の守護者の宝");
        else if (share >= 0.5 && Math.random() < [0, 0.02, 0.03, 0.04][M.tier || 1]) giveItems(P, [{ tier: M.tier || 1, minRarity: "normal" }], "敵のドロップ");
    });
    if (M.ruinBoss) { const rs = ruinState[M.ruin]; if (rs) { rs.bossMid = 0; rs.bossRespawnAt = now() + C.RUIN_BOSS_RESPAWN_S; } feed("🏛 " + M.name + " が倒された！"); }
    if (M.boss) { const n = nests[M.nest]; if (n) { n.alive = false; n.mid = 0; n.respawnAt = now() + C.BOSS_RESPAWN_S; } feed("🔥 " + M.name + " が倒された！（" + Math.round(C.BOSS_RESPAWN_S / 60) + "分後に復活）"); }
}
function feed(text) { if (io) io.to("survival").emit("survival:feed", text); }

// ---------- 敵 ----------
function spawnMonster(x, y, tier, bossNest) {
    const id = nextMid++;
    let def;
    if (bossNest === DEMON_NEST) def = Object.assign({ boss: true, demon: true }, DEMON);
    else if (bossNest != null) def = Object.assign({ name: SW.NESTS[bossNest].name, boss: true }, BOSS);
    else { const list = MON[tier] || MON[1]; def = list[Math.floor(Math.random() * list.length)]; }
    const M = { id: id, name: def.name, icon: def.icon, tier: tier, boss: !!def.boss, demon: !!def.demon, big: null, nextBig: 0, nextBeam: 0, nest: bossNest, x: x, y: y, homeX: x, homeY: y, r: def.r, hp: def.hp, maxHp: def.hp,
        dmg: def.dmg, spd: def.spd, aggro: def.aggro, range: def.range, ranged: !!def.ranged, cd: def.cd, coins: def.coins, nextAtk: 0, nextShot: 0, ring: 0, dmgBy: {}, face: 0, dead: false, target: 0, wander: 0, wx: x, wy: y };
    monsters.set(id, M);
    return M;
}
function spawnRuinMonster(idx, boss) {
    const r = SW.RUINS[idx];
    const a = Math.random() * Math.PI * 2, d = boss ? 0 : 60 + Math.random() * r.r * 0.65;
    const M = spawnMonster(r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, r.tier, null);
    M.ruin = idx;
    if (boss) {
        M.ruinBoss = true; M.name = r.name + "の守護者"; M.icon = "👑"; M.r = 36; M.hp = M.maxHp = 55 + r.tier * 35; M.dmg = 0.1 + r.tier * 0.02;
        M.spd = 140; M.aggro = 700; M.range = 48; M.cd = 1.2; M.coins = [250 * r.tier, 400 * r.tier]; M.ring = 0;
    }
    return M;
}
function freeSpot(cx, cy) {
    for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, d = C.SPAWN_MIN + Math.random() * (C.SPAWN_MAX - C.SPAWN_MIN);
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        if (x < 80 || y < 80 || x > SW.SIZE - 80 || y > SW.SIZE - 80) continue;
        if (SW.zoneAt(x, y).tier === 0) continue;
        if (SW.obstaclesNear(x, y, 50).some(o => Math.hypot(o.x - x, o.y - y) < o.r + 30)) continue;
        return { x, y };
    }
    return null;
}
function director(t) {
    // 近くの敵が少なければ補充（プレイヤーの周りだけ）
    players.forEach(P => {
        if (P.dead || monsters.size >= C.MAX_MONSTERS) return;
        const tier = SW.zoneAt(P.x, P.y).tier; if (!tier) return;
        let near = 0; monsters.forEach(M => { if (!M.boss && Math.abs(M.x - P.x) < C.AOI && Math.abs(M.y - P.y) < C.AOI) near++; });
        const need = Math.min(3, C.DENSITY[tier] - near);
        for (let i = 0; i < need; i++) { const p = freeSpot(P.x, P.y); if (p) spawnMonster(p.x, p.y, SW.zoneAt(p.x, p.y).tier); }
    });
    // 遠すぎる敵は消す
    monsters.forEach(M => {
        if (M.boss) return;
        let closest = 1e9; players.forEach(P => { closest = Math.min(closest, dist(P, M)); });
        if (closest > C.DESPAWN_DIST) monsters.delete(M.id);
    });
    // 遺跡：誰かが近づいたら、中に敵が湧き、守護者が現れる（離れると消えて、また来ると復活）
    SW.RUINS.forEach((r, i) => {
        let near = false; players.forEach(P => { if (!P.dead && dist(P, r) < r.r + 900) near = true; });
        if (!near) return;
        const rs = ruinState[i]; let cnt = 0;
        monsters.forEach(M => { if (M.ruin === i && !M.ruinBoss) cnt++; });
        for (let k = 0; k < Math.min(2, C.RUIN_TARGET - cnt); k++) if (monsters.size < C.MAX_MONSTERS) spawnRuinMonster(i, false);
        if (rs.bossMid && !monsters.has(rs.bossMid)) rs.bossMid = 0;
        if (!rs.bossMid && t >= rs.bossRespawnAt && monsters.size < C.MAX_MONSTERS) rs.bossMid = spawnRuinMonster(i, true).id;
    });
    // ボスの巣：誰かが近づいたら出現
    SW.NESTS.forEach((nst, i) => {
        const n = nests[i];
        if (n.alive && !monsters.has(n.mid)) { n.alive = false; n.mid = 0; }
        if (!n.alive && t >= n.respawnAt) {
            let near = false; players.forEach(P => { if (dist(P, nst) < 1800) near = true; });
            if (near) { const M = spawnMonster(nst.x, nst.y, 3, i); n.alive = true; n.mid = M.id; }
        }
    });
}
function nearestTarget(M, range) {
    let best = null, bd = range;
    players.forEach(P => { if (P.dead || SW.inSafe(P.x, P.y)) return; const d = dist(P, M); if (d < bd) { bd = d; best = P; } });
    return best;
}
// 不壊の悪魔：通常攻撃で、大量のビームを常に放ち続ける。大技では、ぐるりと並んだ砲門から中心へ大量のビームを撃ち切り、逆回転でもう一度撃つ
function demonAttack(M, T, t) {
    if (!M.big && t >= M.nextBig && T) {
        M.big = { t0: t + 1.4, fired: 0, off: Math.random() * 6.28, cx: M.x, cy: M.y }; M.nextBig = t + 24;
        events.push(["u", Math.round(M.x), Math.round(M.y), 650]);                      // 大技の予告（輪）
    }
    if (M.big) {
        const B = M.big, N = 26, total = N * 2;
        while (B.fired < total && t >= B.t0 + B.fired * 0.1 + (B.fired >= N ? 0.5 : 0)) {
            const k = B.fired % N, th = B.off + (B.fired < N ? k * 0.4 : (N - 1 - k) * 0.4 + 0.2), gx = B.cx + Math.cos(th) * 650, gy = B.cy + Math.sin(th) * 650, a = Math.atan2(B.cy - gy, B.cx - gx);
            projs.push({ x: gx, y: gy, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, r: 12, life: 2.0, own: "m", oid: M.id, pct: M.dmg * 0.3, name: M.name, pierce: 0, hit: new Set(), beam: true });
            B.fired++;
        }
        if (B.fired >= total) M.big = null;
        return;
    }
    if (T && t >= M.nextBeam) {                                                          // 通常攻撃：扇状のビームを撃ち続ける
        M.nextBeam = t + 0.3;
        const base = Math.atan2(T.y - M.y, T.x - M.x);
        for (let i = -1; i <= 1; i++) projs.push({ x: M.x, y: M.y, vx: Math.cos(base + i * 0.13) * 480, vy: Math.sin(base + i * 0.13) * 480, r: 8, life: 1.6, own: "m", oid: M.id, pct: M.dmg * 0.22, name: M.name, pierce: 0, hit: new Set(), beam: true });
    }
}
function monsterAI(M, dt, t) {
    const T = nearestTarget(M, M.boss ? M.aggro : M.aggro);
    if (M.demon) demonAttack(M, T, t);
    let tx = M.wx, ty = M.wy, speed = M.spd * 0.45, chasing = false;
    if (T) {
        chasing = true; const d = dist(T, M); M.face = Math.atan2(T.y - M.y, T.x - M.x);
        if (M.ranged) {
            if (d < 200) { tx = M.x - Math.cos(M.face) * 100; ty = M.y - Math.sin(M.face) * 100; speed = M.spd; }
            else if (d > M.range * 0.8) { tx = T.x; ty = T.y; speed = M.spd; } else { tx = M.x; ty = M.y; }
            if (d <= M.range && t >= M.nextShot) { M.nextShot = t + M.cd; const a = M.face; projs.push({ x: M.x, y: M.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, r: 9, life: 1.8, own: "m", oid: M.id, pct: M.dmg, name: M.name, pierce: 0, hit: new Set() }); }
        } else {
            tx = T.x; ty = T.y; speed = M.spd * (M.boss && M.hp < M.maxHp * 0.5 ? 1.3 : 1);
            if (d <= M.range + C.PLAYER_R && t >= M.nextAtk) { M.nextAtk = t + M.cd; damagePlayer(T, T.maxHp * M.dmg * (1 - reduction(T.def)), null, M); }
        }
        if ((M.boss || M.ruinBoss) && !M.demon && t >= M.ring) {                                                  // ボス：全方位の弾
            M.ring = t + (M.hp < M.maxHp * 0.5 ? 3.2 : 4.5) * (M.ruinBoss ? 1.3 : 1); const n = M.hp < M.maxHp * 0.5 ? (M.ruinBoss ? 12 : 18) : (M.ruinBoss ? 8 : 12), off = Math.random() * 6;
            for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2; projs.push({ x: M.x, y: M.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 11, life: 2.6, own: "m", oid: M.id, pct: M.dmg * 0.45, name: M.name, pierce: 0, hit: new Set() }); }
        }
    } else {
        if (dist({ x: M.x, y: M.y }, { x: M.wx, y: M.wy }) < 12 || t > M.wander) { M.wander = t + 3 + Math.random() * 4; const a = Math.random() * 6.28, d = Math.random() * 160; M.wx = M.homeX + Math.cos(a) * d; M.wy = M.homeY + Math.sin(a) * d; }
        if (M.boss) { M.wx = M.homeX; M.wy = M.homeY; M.hp = Math.min(M.maxHp, M.hp + M.maxHp * 0.02 * dt); }
        tx = M.wx; ty = M.wy;
    }
    if (M.demon && M.big) speed = 0;                                                      // 大技の間は動かない
    const dx = tx - M.x, dy = ty - M.y, d = Math.hypot(dx, dy);
    if (d > 4) {
        let nx = M.x + dx / d * speed * dt, ny = M.y + dy / d * speed * dt;
        const r = SW.resolve(nx, ny, M.r); nx = r.x; ny = r.y;
        if (SW.inSafe(nx, ny)) { const a = Math.atan2(ny - SW.CY, nx - SW.CX); nx = SW.CX + Math.cos(a) * (SW.SAFE_R + 4); ny = SW.CY + Math.sin(a) * (SW.SAFE_R + 4); }
        M.x = nx; M.y = ny;
    }
}

// ---------- 1 tick ----------
function tick() {
    const dt = C.TICK_MS / 1000, t = now();
    tickN++;
    players.forEach((P, sid) => {
        if (P.ghost && t > P.ghostUntil) { remove(sid); return; }
        if (P.dead) {
            if (t >= P.respawnAt && !P.ghost) {
                const a = Math.random() * 6.28, rr = Math.random() * SW.SAFE_R * 0.6;
                P.x = SW.CX + Math.cos(a) * rr; P.y = SW.CY + Math.sin(a) * rr; P.hp = P.maxHp; P.dead = false; P.invuln = t + C.INVULN_S; P.lastCombat = 0;
            }
            return;
        }
        // 移動
        if (P.mx || P.my) {
            const r = SW.resolve(P.x + P.mx * C.BASE_SPEED * dt, P.y + P.my * C.BASE_SPEED * dt, C.PLAYER_R);
            P.x = r.x; P.y = r.y; if (!P.firing) P.dir = Math.atan2(P.my, P.mx);
        }
        if (P.ultReq && !P.ult && P.wtype === "unbreakable" && t >= P.ultReadyAt) startUlt(P, t);
        if (P.ult) tickUlt(P, t);
        if (P.firing) playerAttack(P, t);
        // 宝箱を開ける（少し時間がかかり、動く・攻撃される・攻撃すると中断）
        if (P.chan) {
            const ch = P.chan;
            if (P.mx || P.my || P.firing || P.lastHurt > ch.start || Math.hypot(P.x - ch.x, P.y - ch.y) > 40 || (chestState.get(ch.id) || 0) > t) P.chan = null;
            else if (t >= ch.until) { P.chan = null; openChest(P, ch.chest, t); }
        } else if (P.use && !P.mx && !P.my && !P.firing) {
            const c = chestAt(P, t); if (c) P.chan = { id: c.id, chest: c, start: t, until: t + C.CHEST_CHANNEL_S, x: P.x, y: P.y };
        }
        if (t - P.lastHurt > C.REGEN_DELAY && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * C.REGEN_PCT * dt);
    });
    monsters.forEach(M => monsterAI(M, dt, t));
    // 弾
    for (let i = projs.length - 1; i >= 0; i--) {
        const b = projs[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > SW.SIZE || b.y > SW.SIZE;
        if (!dead && SW.obstaclesNear(b.x, b.y, 40).some(o => Math.hypot(o.x - b.x, o.y - b.y) < o.r + b.r - 4)) dead = true;
        if (!dead && b.own === "p") {
            const owner = Array.from(players.values()).find(p => p.eid === b.oid);
            if (owner) {
                monsters.forEach(M => { if (!dead && !b.hit.has("m" + M.id) && Math.hypot(M.x - b.x, M.y - b.y) < M.r + b.r) { b.hit.add("m" + M.id); damageMonster(M, b.units, owner); if (b.pierce-- <= 0) dead = true; } });
                if (!dead && !SW.inSafe(owner.x, owner.y)) players.forEach(O => { if (!dead && O !== owner && !O.dead && !b.hit.has("p" + O.eid) && Math.hypot(O.x - b.x, O.y - b.y) < C.PLAYER_R + b.r) { b.hit.add("p" + O.eid); damagePlayer(O, pvpDamage(O, b.units), owner, null); if (b.pierce-- <= 0) dead = true; } });
            }
        } else if (!dead && b.own === "m") {
            players.forEach(O => { if (!dead && !O.dead && Math.hypot(O.x - b.x, O.y - b.y) < C.PLAYER_R + b.r) { damagePlayer(O, O.maxHp * b.pct * (1 - reduction(O.def)), null, { name: b.name }); dead = true; } });
        }
        if (dead) projs.splice(i, 1);
    }
    if (t - lastSpawnAt > 1) { lastSpawnAt = t; director(t); }
    snapshot(t);
    events = [];
}

function snapshot(t) {
    if (!io) return;
    players.forEach((P, sid) => {
        if (P.ghost) return;
        const s = io.sockets.sockets.get(sid); if (!s) return;
        const near = (o, rad) => Math.abs(o.x - P.x) < rad && Math.abs(o.y - P.y) < rad;
        const ps = [], ms = [], bs = [], ev = [];
        players.forEach(O => { if (O !== P && near(O, C.AOI)) ps.push([O.eid, Math.round(O.x), Math.round(O.y), +(O.dir).toFixed(2), Math.round(O.hp / O.maxHp * 100), (O.dead ? 1 : 0) | (t < O.invuln ? 2 : 0) | (O.ghost ? 4 : 0), O.wtype, O.wmythic || ""]); });
        monsters.forEach(M => { if (near(M, C.AOI)) ms.push([M.id, M.icon, Math.round(M.x), Math.round(M.y), Math.max(1, Math.round(M.hp / M.maxHp * 100)), (M.boss || M.ruinBoss) ? 1 : 0, M.r, (M.boss || M.ruinBoss) ? M.name : "", +(M.face).toFixed(2)]); });
        for (let i = 0; i < projs.length; i++) { const b = projs[i]; if (near(b, C.AOI)) bs.push([Math.round(b.x), Math.round(b.y), b.r, b.own === "m" ? 1 : 0]); }
        const cs = [];
        SW.chestsNear(P.x, P.y, C.AOI).forEach(c => cs.push([c.id, c.x, c.y, c.tier, (chestState.get(c.id) || 0) > t ? 1 : 0, c.ruin != null ? 1 : 0]));
        for (let i = 0; i < events.length; i++) { const e = events[i]; if (Math.abs(e[1] - P.x) < C.AOI && Math.abs(e[2] - P.y) < C.AOI) ev.push(e); }
        s.volatile.emit("survival:snap", {
            n: tickN, ack: P.seq,
            me: { x: Math.round(P.x * 10) / 10, y: Math.round(P.y * 10) / 10, hp: Math.round(P.hp), mhp: P.maxHp, dead: P.dead, rs: P.dead ? Math.max(0, Math.ceil(P.respawnAt - t)) : 0, inv: t < P.invuln, kills: P.kills, deaths: P.deaths, coins: P.coinsGained, cr: P.carry.length, wt: P.wtype, wm: P.wmythic || "", uc: Math.max(0, Math.ceil(P.ultReadyAt - t)), ur: P.ult ? 1 : 0, cb: Math.max(0, Math.ceil(P.lastCombat + C.COMBAT_S - t)), ch: P.chan ? Math.min(1, (t - P.chan.start) / C.CHEST_CHANNEL_S) : 0 },
            p: ps, m: ms, b: bs, c: cs, ev: ev, online: players.size
        });
    });
}

function stats() { return { players: players.size, monsters: monsters.size, projectiles: projs.length }};
module.exports = { init, join, leave, disconnect, input, stats, CONFIG: C, TYPES: () => TYPES, _players: players, _monsters: monsters, _tick: tick};