'use strict';
// ============================================================
// socket/admin.js ― ① BANされたプレイヤーの通信を止める ② 管理者用の操作（検索・BAN・解除）
//  管理者になるには、環境変数 ADMIN_KEY（8文字以上の合言葉）を、画面の「🛡 管理者」から入力する。
//  ADMIN_KEY が未設定のときは、管理者機能は無効（BANの強制だけは動く）。
// ============================================================
const crypto = require('crypto');
const Ban = require('../managers/BanManager');
const PlayerDataManager = require('../managers/PlayerDataManager');

const ADMIN_KEY = String(process.env.ADMIN_KEY || '');
const ADMIN_ON = ADMIN_KEY.length >= 8;
if (!ADMIN_ON) console.warn('[admin] 環境変数 ADMIN_KEY（8文字以上）が未設定のため、管理者機能は無効です');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const ADMIN_HASH = sha(ADMIN_KEY);
const keyOk = (k) => ADMIN_ON && crypto.timingSafeEqual(sha(k), ADMIN_HASH);

// ログインの総当たり対策：同じ接続元から5回失敗したら15分ロック
const fails = new Map();
function ipOf(socket) { const h = socket.handshake || {}; const xf = h.headers && h.headers['x-forwarded-for']; return String(xf ? String(xf).split(',')[0].trim() : (h.address || '')); }
function locked(ip) { const f = fails.get(ip); return !!(f && f.n >= 5 && Date.now() - f.t < 15 * 60000); }
function failed(ip) { const f = fails.get(ip); if (!f || Date.now() - f.t > 15 * 60000) fails.set(ip, { n: 1, t: Date.now() }); else { f.n++; f.t = Date.now(); } }

function banInfo(b) { return { id: b.id, reason: b.reason || '', until: b.until || 0 }; }

module.exports = function (io) {
    function kick(accountId, b) {
        io.sockets.sockets.forEach((s) => {
            if (s.data && s.data.pid === accountId) { try { s.emit('banned', banInfo(b)); } catch (e) { /* 無視 */ } setTimeout(() => { try { s.disconnect(true); } catch (e) { /* 無視 */ } }, 300); }
        });
    }

    io.on('connection', (socket) => {
        socket.data = socket.data || {};

        // ---- BANされたプレイヤー／端末からの通信は、すべて止める ----
        socket.use((packet, next) => {
            const event = packet[0], args = packet.slice(1);
            if (typeof event === 'string' && event.indexOf('admin:') === 0) return next();      // 管理者の操作は、下で個別に確認する
            let b = socket.data.pid ? Ban.isBanned(socket.data.pid) : null;
            if (!b) {
                const x = Ban.extract(args);
                x.ids.concat(x.weak).forEach(id => { if (!b) b = Ban.isBanned(id); });
                if (!b && x.dev) b = Ban.isDevBanned(x.dev);
                if (!b && x.ids.length) {
                    if (!socket.data.pid) socket.data.pid = x.ids[0];      // この接続の持ち主（BANしたとき、この接続も切るため）
                    if (x.dev) x.ids.forEach(id => Ban.noteDevice(id, x.dev));
                }
            }
            if (!b) return next();
            const cb = args.length && typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
            if (cb) { try { cb({ ok: false, reason: 'banned', ban: banInfo(b) }); } catch (e) { /* 無視 */ } }
            try { socket.emit('banned', banInfo(b)); } catch (e) { /* 無視 */ }
            setTimeout(() => { try { socket.disconnect(true); } catch (e) { /* 無視 */ } }, 300);
        });

        // ---- 管理者の操作 ----
        const guard = (fn) => (payload, cb) => {
            if (typeof cb !== 'function') cb = () => {};
            if (!socket.data.isAdmin) return cb({ ok: false, reason: 'forbidden' });
            try { cb(fn(payload && typeof payload === 'object' ? payload : {})); }
            catch (e) { console.error('[admin] 失敗:', e); cb({ ok: false, reason: 'server_error' }); }
        };

        socket.on('admin:login', (payload, cb) => {
            if (typeof cb !== 'function') cb = () => {};
            if (!ADMIN_ON) return cb({ ok: false, reason: 'disabled' });
            const ip = ipOf(socket);
            if (locked(ip)) return cb({ ok: false, reason: 'locked' });
            const k = payload && typeof payload.key === 'string' ? payload.key.slice(0, 200) : '';
            if (!keyOk(k)) { failed(ip); console.warn('[admin] ログイン失敗 from ' + ip); return cb({ ok: false, reason: 'bad_key' }); }
            fails.delete(ip); socket.data.isAdmin = true; console.log('[admin] ログイン成功 from ' + ip);
            cb({ ok: true });
        });

        // プレイヤー検索：名前の一部 か IDで。空なら、レベルの高い順
        socket.on('admin:players', guard((m) => {
            const q = String(m.q || '').trim().toLowerCase().slice(0, 30);
            let rows = PlayerDataManager.getAllPlayers().filter(p => p && p.id);
            if (q) rows = rows.filter(p => String(p.id).toLowerCase() === q || String(p.id).toLowerCase().indexOf(q) === 0 || String(p.name || '').toLowerCase().indexOf(q) !== -1);
            rows.sort((a, b) => (b.level || 0) - (a.level || 0));
            return {
                ok: true, total: rows.length,
                rows: rows.slice(0, 30).map(p => ({ id: p.id, name: String(p.name || ''), level: p.level || 1, studyMinutes: Math.floor((p.totalStudySeconds || 0) / 60), pvpWins: p.pvpWins || 0, banned: !!Ban.isBanned(p.id) }))
            };
        }));
        socket.on('admin:bans', guard(() => ({ ok: true, rows: Ban.list() })));
        socket.on('admin:ban', guard((m) => {
            const a = Ban.acct(m.id); if (!a) return { ok: false, reason: 'bad_id' };
            const p = PlayerDataManager.getPlayer(a);
            const r = Ban.ban(a, { reason: m.reason, days: m.days, name: p && p.name, by: 'admin' });
            if (r.ok) { console.log('[admin] BAN ' + a + ' (' + (p && p.name) + ') days=' + (m.days || 0) + ' reason=' + (m.reason || '')); kick(a, Ban.isBanned(a)); }
            return r;
        }));
        socket.on('admin:unban', guard((m) => { const r = Ban.unban(m.id); if (r.ok) console.log('[admin] BAN解除 ' + Ban.acct(m.id)); return r; }));
    });
};
