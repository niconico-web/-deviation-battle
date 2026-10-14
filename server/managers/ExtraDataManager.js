// ============================================
// ExtraDataManager.js
//  ・bundles.json    : データ引継ぎ用の「プレイヤー以外のデータ」（武器庫・防具・スキル・ビギナーミッション・シーズンなど）
//  ・pvp_event.json  : シーズンのPvPイベント（5週目〜）のポイントとランキング
//  どちらも players.json とは別ファイルにして、他のプレイヤーに配られるプレイヤー情報へ混ざらないようにする
// ============================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function makeStore(name) {
    const file = path.join(DIR, name);
    let data = {};
    try { data = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) { data = {}; }
    if (!data || typeof data !== 'object') data = {};
    let timer = null;
    function flush() {
        timer = null;
        try { fs.writeFileSync(file + '.tmp', JSON.stringify(data), 'utf-8'); fs.renameSync(file + '.tmp', file); }
        catch (e) { console.error('[ExtraData] save failed', name, e.message); }
    }
    function schedule() { if (timer) return; timer = setTimeout(flush, 2000); if (timer.unref) timer.unref(); }
    function flushNow() { if (timer) { clearTimeout(timer); flush(); } }
    return { get data() { return data; }, schedule, flushNow };
}
const bundles = makeStore('bundles.json');
const pvpEvent = makeStore('pvp_event.json');
const auth = makeStore('sync_auth.json');          // 連携パスワード（ハッシュ化）と、連携済み端末の合言葉(トークン)
['exit', 'SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => { try { bundles.flushNow(); pvpEvent.flushNow(); auth.flushNow(); } catch (e) { /* 終了時のみ */ } if (sig !== 'exit') process.exit(0); }));

const ID_RE = /^[A-Za-z0-9]{4,12}$/;
// 引き継ぎで運べるデータ（端末ごとの設定などは運ばない）。値は localStorage の文字列そのまま
const BUNDLE_KEYS = ['sbHack', 'sb_action_skills', 'sb_action_loadout', 'sb_unlocked_glyphs', 'sbBeginner', 'sbSeason', 'sbPvpEvent'];
const MAX_VALUE = 6 * 1024 * 1024;

function saveBundle(id, bundle, rev) {
    if (!ID_RE.test(String(id || '')) || !bundle || typeof bundle !== 'object') return false;
    const old = bundles.data[String(id).toUpperCase()];
    const clean = { at: Date.now(), rev: (rev !== undefined ? rev : ((old && old.rev) || 0)), items: {} };
    let total = 0;
    for (const k of BUNDLE_KEYS) {
        const v = bundle.items && bundle.items[k];
        if (typeof v !== 'string') continue;
        total += v.length;
        if (v.length > MAX_VALUE || total > 3 * MAX_VALUE) return false;
        clean.items[k] = v;
    }
    bundles.data[String(id).toUpperCase()] = clean;
    bundles.schedule();
    return true;
}
function getBundle(id) { return bundles.data[String(id || '').toUpperCase()] || null; }
// 端末の連携（同期）用：データの版（rev）。保存のたびに1ずつ増える。無ければ0
function getRev(id) { const b = getBundle(id); return (b && b.rev) || 0; }

// ---- PvPイベント ----
function reportEvent(seasonId, id, name, pts, wins, plays) {
    seasonId = String(seasonId || ''); id = String(id || '').toUpperCase();
    if (!seasonId || !ID_RE.test(id)) return false;
    const n = v => Math.max(0, Math.min(1e6, Math.floor(Number(v) || 0)));
    const s = pvpEvent.data[seasonId] || (pvpEvent.data[seasonId] = {});
    s[id] = { name: String(name || '').slice(0, 20), pts: n(pts), wins: n(wins), plays: n(plays), at: Date.now() };
    pvpEvent.schedule();
    return true;
}
function eventRanking(seasonId, id) {
    const s = pvpEvent.data[String(seasonId || '')] || {};
    const list = Object.keys(s).map(k => Object.assign({ id: k }, s[k])).sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.at - b.at);
    id = String(id || '').toUpperCase();
    const idx = list.findIndex(x => x.id === id);
    return { total: list.length, top: list.slice(0, 20).map((x, i) => ({ rank: i + 1, id: x.id.slice(0, 2) + '****', name: x.name, pts: x.pts, wins: x.wins })), me: idx >= 0 ? { rank: idx + 1, pts: list[idx].pts, wins: list[idx].wins } : null };
}
// ---- 連携パスワード ----
//  パスワードは scrypt でハッシュ化して保存（元の文字列は残さない）。
//  パスワードを入力して連携した端末には、ランダムなトークンを渡す。端末はそれを覚えて、以後の同期に添える（サーバーにはトークンのハッシュだけを保存）
const ukey = (id) => String(id || '').toUpperCase();
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function hasPassword(id) { const r = auth.data[ukey(id)]; return !!(r && r.hash); }
function setPassword(id, pw) {
    const salt = crypto.randomBytes(16).toString('hex');
    auth.data[ukey(id)] = { salt: salt, hash: crypto.scryptSync(String(pw), salt, 32).toString('hex'), tokens: [] };
    auth.schedule();
    return issueToken(id);                          // 設定した端末は、そのまま連携済みとして扱う（他の端末のトークンは無効になる）
}
function removePassword(id) { delete auth.data[ukey(id)]; auth.schedule(); }
function verifyPassword(id, pw) {
    const r = auth.data[ukey(id)]; if (!r || !r.hash) return false;
    const h = crypto.scryptSync(String(pw || ''), r.salt, 32);
    const want = Buffer.from(r.hash, 'hex');
    return h.length === want.length && crypto.timingSafeEqual(h, want);
}
function issueToken(id) {
    const r = auth.data[ukey(id)]; if (!r) return null;
    const t = crypto.randomBytes(24).toString('hex');
    r.tokens = (r.tokens || []).concat([sha(t)]).slice(-10);     // 連携できる端末は最大10台
    auth.schedule();
    return t;
}
function checkToken(id, token) { const r = auth.data[ukey(id)]; return !!(r && token && (r.tokens || []).indexOf(sha(token)) >= 0); }
// 総当たり対策：同じIDで、10分間に失敗が8回を超えたら、いったんロック
const fails = {};
function locked(id) { const f = fails[ukey(id)]; if (!f) return false; f.t = f.t.filter(x => Date.now() - x < 600000); return f.t.length >= 8; }
function recordFail(id) { const k = ukey(id); (fails[k] = fails[k] || { t: [] }).t.push(Date.now()); }
function clearFails(id) { delete fails[ukey(id)]; }

module.exports = { saveBundle, getBundle, getRev, reportEvent, eventRanking, BUNDLE_KEYS, hasPassword, setPassword, removePassword, verifyPassword, issueToken, checkToken, locked, recordFail, clearFails };
