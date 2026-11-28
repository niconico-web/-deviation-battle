'use strict';
// ============================================================
// PushManager.js ― サイトを閉じていても届く「Web Push 通知」
//  ・勉強タイマーの終了時刻に、そのデバイスへ通知する（クライアントが予約 → ここが時刻になったら送る）
//  ・緊急ステージの1時間前／開催時に、通知をONにしている全デバイスへ通知する
//  ・購読・予約は server/data/push.json に保存（Supabase 連携が有効なら再起動しても残る）
//  ・VAPID鍵：環境変数 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY（無ければ自動生成して push.json に保存）
//  ・環境変数
//      PUSH_TZ_OFFSET_MIN  緊急ステージの時刻の基準（既定 540 = 日本時間）
//      PUSH_KEEPALIVE=1    予約が無くてもサーバーが眠らないよう自分に定期アクセス（無料プランで緊急通知を使うとき）
// ============================================================
const fs = require('fs');
const path = require('path');
let webpush = null;
try { webpush = require('web-push'); } catch (e) { console.warn('[push] web-push が入っていないため通知は無効です（npm install で有効になります）'); }

const FILE = path.join(__dirname, '../data/push.json');
const EMG_HOURS = [13, 15, 17, 20, 22];          // client/js/progression.js の EMG_HOURS と同じ
const EMG_OPEN_MIN = 30;                          // 開催からの有効時間（通知を送る猶予）
const MAX_SUBS = 5000, MAX_JOBS_PER_DEVICE = 5, MAX_AHEAD_MS = 3 * 3600 * 1000;
const TZ_MIN = Number.isFinite(+process.env.PUSH_TZ_OFFSET_MIN) ? +process.env.PUSH_TZ_OFFSET_MIN : 540;

let state = { vapid: null, subs: {}, jobs: [], sentEmg: {} };
let saveTimer = null, started = false, lastPing = 0;

function load() {
    try {
        const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        state = Object.assign(state, j);
        state.subs = state.subs || {}; state.jobs = Array.isArray(state.jobs) ? state.jobs : []; state.sentEmg = state.sentEmg || {};
    } catch (e) { /* 初回は無い */ }
}
function save() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(state)); }
        catch (e) { console.warn('[push] 保存に失敗:', e.message); }
    }, 800);
}

function ensureVapid() {
    if (!webpush) return null;
    const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (pub && priv) state.vapid = { publicKey: pub, privateKey: priv, env: true };
    else if (!state.vapid || !state.vapid.publicKey) { state.vapid = webpush.generateVAPIDKeys(); console.warn('[push] VAPID鍵を自動生成しました。環境変数 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY に固定するのがおすすめです'); save(); }
    const subject = process.env.VAPID_SUBJECT || (process.env.SITE_URL && /^https:/.test(process.env.SITE_URL) ? process.env.SITE_URL : 'mailto:admin@example.com');
    webpush.setVapidDetails(subject, state.vapid.publicKey, state.vapid.privateKey);
    return state.vapid.publicKey;
}

function enabled() { return !!(webpush && state.vapid && state.vapid.publicKey); }
function publicKey() { return enabled() ? state.vapid.publicKey : null; }

function validSub(sub) {
    return !!(sub && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.endpoint.length < 1000 &&
        sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string' && sub.keys.p256dh.length < 200 && sub.keys.auth.length < 100);
}
function subscribe(sub, opt) {
    if (!enabled() || !validSub(sub)) return false;
    const cur = state.subs[sub.endpoint];
    if (!cur && Object.keys(state.subs).length >= MAX_SUBS) return false;
    state.subs[sub.endpoint] = { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, emg: !(opt && opt.emg === false), t: Date.now() };
    save(); return true;
}
function unsubscribe(endpoint) {
    delete state.subs[endpoint]; state.jobs = state.jobs.filter(j => j.endpoint !== endpoint); save();
}
function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }
function schedule(endpoint, at, msg) {
    if (!enabled() || !state.subs[endpoint]) return false;
    at = +at; const now = Date.now();
    if (!Number.isFinite(at) || at > now + MAX_AHEAD_MS) return false;
    const tag = clip(msg && msg.tag, 40) || 'study';
    state.jobs = state.jobs.filter(j => !(j.endpoint === endpoint && j.tag === tag));      // 同じ種類の予約は上書き
    if (state.jobs.filter(j => j.endpoint === endpoint).length >= MAX_JOBS_PER_DEVICE) return false;
    state.jobs.push({ endpoint: endpoint, at: Math.max(at, now), tag: tag, title: clip(msg && msg.title, 80) || 'SchoolBattle', body: clip(msg && msg.body, 160), url: '/' });
    save(); startLoop(); return true;
}
function cancel(endpoint, tag) {
    const n = state.jobs.length; state.jobs = state.jobs.filter(j => !(j.endpoint === endpoint && (!tag || j.tag === tag)));
    if (state.jobs.length !== n) save();
}

async function sendTo(endpoint, payload) {
    const rec = state.subs[endpoint]; if (!rec || !enabled()) return;
    try { await webpush.sendNotification(rec.sub, JSON.stringify(payload), { TTL: 3600, urgency: 'high' }); }
    catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) { delete state.subs[endpoint]; state.jobs = state.jobs.filter(j => j.endpoint !== endpoint); save(); }      // 失効した購読は消す
        else console.warn('[push] 送信失敗:', e && (e.statusCode || e.message));
    }
}

function jstParts(ms) { const d = new Date(ms + TZ_MIN * 60000); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; }
function emergencyTick(now) {
    const p = jstParts(now), day = p.y + '-' + p.m + '-' + p.d;
    EMG_HOURS.forEach(H => {
        let kind = null;
        if (p.h === H - 1 && p.mi < 5) kind = 'alert';                      // 1時間前（0〜5分の間に1回だけ）
        else if (p.h === H && p.mi < EMG_OPEN_MIN) kind = 'open';             // 開催
        if (!kind) return;
        const key = day + '-' + H + '-' + kind; if (state.sentEmg[key]) return; state.sentEmg[key] = now;
        const payload = kind === 'alert'
            ? { title: '⏰ まもなく緊急ステージ', body: H + '時に緊急ステージが出現します（あと約1時間）', tag: 'emg-alert', url: '/' }
            : { title: '🚨 緊急ステージ開催中！', body: '緊急ステージが出現しました（約' + EMG_OPEN_MIN + '分間）', tag: 'emg-open', url: '/' };
        Object.keys(state.subs).forEach(ep => { if (state.subs[ep].emg) sendTo(ep, payload); });
        console.log('[push] 緊急ステージ通知 ' + key + ' → ' + Object.keys(state.subs).length + '台');
    });
    const old = now - 3 * 86400000; Object.keys(state.sentEmg).forEach(k => { if (state.sentEmg[k] < old) delete state.sentEmg[k]; });
    save();
}

function tick() {
    const now = Date.now();
    const due = state.jobs.filter(j => j.at <= now);
    if (due.length) { state.jobs = state.jobs.filter(j => j.at > now); save(); due.forEach(j => sendTo(j.endpoint, { title: j.title, body: j.body, tag: j.tag, url: j.url })); }
    emergencyTick(now);
    keepAlive(now);
}
function keepAlive(now) {      // 無料プランは15分アクセスが無いと眠る → 予約が残っている間は自分に定期アクセスして起こしておく
    const base = process.env.RENDER_EXTERNAL_URL || process.env.SITE_URL;
    if (!base || typeof fetch !== 'function') return;
    if (!(state.jobs.length || process.env.PUSH_KEEPALIVE === '1')) return;
    if (now - lastPing < 9 * 60000) return; lastPing = now;
    fetch(base.replace(/\/+$/, '') + '/api/time', { cache: 'no-store' }).catch(() => {});
}
function startLoop() {
    if (started || !enabled()) return; started = true;
    setInterval(() => { try { tick(); } catch (e) { console.warn('[push] tick エラー:', e.message); } }, 15000).unref();
}

function init(app) {
    load(); ensureVapid();
    if (enabled()) startLoop();
    const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
    app.get('/api/push/key', (req, res) => { res.set('Cache-Control', 'no-store'); if (!enabled()) return bad(res, 503, 'push disabled'); res.json({ ok: true, key: publicKey() }); });
    app.post('/api/push/subscribe', (req, res) => { const b = req.body || {}; if (!subscribe(b.subscription, { emg: b.emg })) return bad(res, 400, 'bad subscription'); res.json({ ok: true }); });
    app.post('/api/push/unsubscribe', (req, res) => { const b = req.body || {}; if (typeof b.endpoint === 'string') unsubscribe(b.endpoint); res.json({ ok: true }); });
    app.post('/api/push/schedule', (req, res) => { const b = req.body || {}; if (!schedule(b.endpoint, b.at, b)) return bad(res, 400, 'cannot schedule'); res.json({ ok: true }); });
    app.post('/api/push/cancel', (req, res) => { const b = req.body || {}; if (typeof b.endpoint === 'string') cancel(b.endpoint, b.tag); res.json({ ok: true }); });
}

module.exports = { init, subscribe, schedule, cancel, tick, _state: () => state };
