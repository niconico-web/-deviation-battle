'use strict';
// ============================================================
// BanManager.js ― 管理者によるプレイヤーのBAN
//  ・BAN は「アカウントID（6文字）」単位。シーズンキャラのID（末尾に S が付いた7文字）も同じアカウントとして扱う
//  ・期限つき（日数）／無期限（days=0）。期限が過ぎたら自動で解除
//  ・BAN時に、そのアカウントが使っていた端末ID（dev）も覚えておき、同じ端末で作り直した別アカウントも止める（BAN逃れ対策）
//  ・保存先は server/data/bans.json（Supabase 連携が有効なら、再起動しても残る）
// ============================================================
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../data/bans.json');
const ID_RE = /^[A-Za-z0-9]{6,7}$/;
const DEV_RE = /^[A-Za-z0-9_.:-]{6,80}$/;
const MAX_BANS = 2000;

let state = { bans: {} };
let version = 1;                          // BANが増減するたびに +1（ランキングのキャッシュを作り直す合図）
const devSeen = new Map();                // アカウントID → 見かけた端末ID（メモリのみ。BANの瞬間に bans.json へ写す）

try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (j && typeof j.bans === 'object') state = { bans: j.bans || {} }; } catch (e) { /* 初回は無い */ }

function save() {
    try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify(state), 'utf8'); fs.renameSync(FILE + '.tmp', FILE); }
    catch (e) { console.error('[Ban] 保存に失敗:', e.message); }
}

// アカウントID（6文字・大文字）に正規化。7文字で末尾が S のもの（シーズンキャラ）は先頭6文字
function acct(id) {
    const s = String(id == null ? '' : id).trim().toUpperCase();
    if (!ID_RE.test(s)) return null;
    return s.slice(0, 6);      // 7文字（末尾S）のシーズンキャラのIDは、先頭の6文字＝アカウントID
}

function expireSweep() {
    const t = Date.now(); let changed = false;
    Object.keys(state.bans).forEach(id => { const b = state.bans[id]; if (b.until && b.until <= t) { delete state.bans[id]; changed = true; } });
    if (changed) { version++; save(); }
}
setInterval(expireSweep, 60 * 1000).unref();

function isBanned(id) {
    const a = acct(id); if (!a) return null;
    const b = state.bans[a]; if (!b) return null;
    if (b.until && b.until <= Date.now()) { expireSweep(); return null; }
    return b;
}
function isDevBanned(dev) {
    if (typeof dev !== 'string' || !DEV_RE.test(dev)) return null;
    const t = Date.now();
    for (const id of Object.keys(state.bans)) {
        const b = state.bans[id];
        if (b.until && b.until <= t) continue;
        if (Array.isArray(b.devs) && b.devs.indexOf(dev) !== -1) return b;
    }
    return null;
}
function noteDevice(id, dev) {
    const a = acct(id); if (!a || typeof dev !== 'string' || !DEV_RE.test(dev)) return;
    let s = devSeen.get(a); if (!s) { if (devSeen.size > 20000) devSeen.clear(); s = new Set(); devSeen.set(a, s); }
    if (s.size < 8) s.add(dev);
}

function ban(id, opt) {
    opt = opt || {};
    const a = acct(id); if (!a) return { ok: false, reason: 'bad_id' };
    if (!state.bans[a] && Object.keys(state.bans).length >= MAX_BANS) return { ok: false, reason: 'too_many' };
    const days = Math.max(0, Math.min(3650, Math.floor(Number(opt.days) || 0)));
    const prev = state.bans[a];
    const devs = Array.from(new Set([].concat((prev && prev.devs) || [], Array.from(devSeen.get(a) || []))));
    state.bans[a] = {
        id: a, name: String(opt.name || (prev && prev.name) || '').slice(0, 30),
        reason: String(opt.reason || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 120),
        at: Date.now(), until: days ? Date.now() + days * 86400000 : 0, by: String(opt.by || 'admin').slice(0, 30), devs: devs
    };
    version++; save();
    return { ok: true, ban: publicView(state.bans[a]) };
}
function unban(id) {
    const a = acct(id); if (!a || !state.bans[a]) return { ok: false, reason: 'not_banned' };
    delete state.bans[a]; version++; save();
    return { ok: true };
}
function publicView(b) { return { id: b.id, name: b.name, reason: b.reason, at: b.at, until: b.until, by: b.by, devs: (b.devs || []).length }; }
function list() { expireSweep(); return Object.values(state.bans).sort((x, y) => y.at - x.at).map(publicView); }

// 受け取ったデータ（ソケットのイベントの引数）から、アカウントIDと端末IDを拾う。
//   ids  … オブジェクトの playerId / player.id / id などから拾ったID（この接続の持ち主の候補。優先順に並べる）
//   weak … 引数がただの文字列のとき（ルームコードなど別の6文字かもしれない）。BANされているかの確認だけに使い、持ち主とは見なさない
function extract(args) {
    const out = { ids: [], weak: [], dev: null };
    const a0 = Array.isArray(args) ? args[0] : args;
    const take = (v, into) => { const a = acct(v); if (a && into.indexOf(a) === -1) into.push(a); };
    if (typeof a0 === 'string') take(a0, out.weak);
    else if (a0 && typeof a0 === 'object') {
        ['playerId', 'pid', 'userId', 'accountId'].forEach(k => { if (typeof a0[k] === 'string') take(a0[k], out.ids); });
        ['player', 'playerData', 'me', 'guestPlayer', 'hostPlayer'].forEach(k => { const p = a0[k]; if (p && typeof p === 'object' && typeof p.id === 'string') take(p.id, out.ids); });
        if (typeof a0.id === 'string') take(a0.id, out.ids);      // id は他のもの（部屋・ギルドなど）の場合もあるので、いちばん後ろ
        const d = a0.dev || a0.deviceId; if (typeof d === 'string' && DEV_RE.test(d)) out.dev = d;
    }
    return out;
}

module.exports = { acct, isBanned, isDevBanned, noteDevice, ban, unban, list, extract, version: () => version };
