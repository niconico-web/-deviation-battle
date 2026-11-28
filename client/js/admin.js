// admin.js ― ① BANされたときの画面　② 管理者パネル（プレイヤー検索・BAN・解除）
//  管理者になるには、サーバーの環境変数 ADMIN_KEY に決めた合言葉を、画面下の「🛡 管理者」から入力する。
//  BANの強制はサーバー側で行っている（この画面を消しても、通信はできない）。
(function () {
    'use strict';
    const $ = (s, r) => (r || document).querySelector(s);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const fmtDate = (ms) => { const d = new Date(ms); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

    // ---------- ① BANされたときの画面 ----------
    let bannedShown = false;
    function showBanned(info) {
        if (bannedShown) return; bannedShown = true;
        try { if (window.cancelStudyTimer) window.cancelStudyTimer(); } catch (e) { /* 無視 */ }
        const until = info && info.until ? ('解除予定：' + fmtDate(info.until)) : '期限：なし（無期限）';
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,20,.97);color:#fff;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center';
        ov.innerHTML = '<div style="max-width:420px"><div style="font-size:3rem">🚫</div><h2 style="margin:8px 0">このアカウントは利用停止中です</h2>' +
            '<p style="line-height:1.7">管理者により、アカウントの利用が制限されています。</p>' +
            (info && info.reason ? '<p style="background:#2a2a44;border-radius:8px;padding:8px 12px">理由：' + esc(info.reason) + '</p>' : '') +
            '<p style="color:#aab">' + esc(until) + '</p>' +
            '<p style="color:#889;font-size:.85rem">プレイヤーID：' + esc((info && info.id) || '') + '</p></div>';
        document.body.appendChild(ov);
    }
    window.SBBanned = showBanned;
    function hookSocket() {
        const s = window.socket; if (!s || s.__banHook) return !!(s && s.__banHook);
        s.__banHook = true; s.on('banned', showBanned); return true;
    }
    let tries = 0; const hk = setInterval(() => { if (hookSocket() || ++tries > 60) clearInterval(hk); }, 500);

    // ---------- ② 管理者パネル ----------
    const call = (event, payload) => new Promise((res) => {
        const s = window.socket; if (!s || !s.connected) return res({ ok: false, reason: 'offline' });
        s.timeout(10000).emit(event, payload || {}, (err, r) => res(err ? { ok: false, reason: 'timeout' } : r));
    });
    const REASONS = { offline: 'サーバーに接続できません', timeout: '応答がありません', bad_key: '合言葉が違います', locked: '失敗が続いたため、しばらくロックされています（15分）', disabled: 'サーバーで管理者機能が有効になっていません（ADMIN_KEY が未設定）', forbidden: '管理者としてログインしていません', bad_id: 'プレイヤーIDが正しくありません', not_banned: 'BANされていません', too_many: 'BANの件数が上限です', server_error: 'サーバーでエラーが起きました' };
    const why = (r) => REASONS[r && r.reason] || ('エラー（' + (r && r.reason) + '）');

    function openPanel() {
        if ($('#sbAdminPanel')) return;
        const ov = document.createElement('div'); ov.id = 'sbAdminPanel';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:10px';
        ov.innerHTML = '<div style="background:#1b2036;color:#eef;border:2px solid #7a8cff;border-radius:12px;max-width:640px;width:100%;max-height:92vh;overflow:auto;padding:14px 16px;font-size:.92rem;line-height:1.55">' +
            '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:1.1rem">🛡 管理者パネル</b><button type="button" data-x style="background:#333a5a;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer">✕</button></div>' +
            '<div data-body style="margin-top:10px"></div><div data-msg style="margin-top:8px;min-height:1.3em;color:#ffd84a"></div></div>';
        document.body.appendChild(ov);
        const body = $('[data-body]', ov), msg = $('[data-msg]', ov), setMsg = (t, bad) => { msg.textContent = t || ''; msg.style.color = bad ? '#ff8a8a' : '#9fe0a0'; };
        const close = () => ov.remove();
        $('[data-x]', ov).addEventListener('click', close); ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
        const BTN = 'background:#4a63ff;color:#fff;border:0;border-radius:8px;padding:6px 12px;margin:2px 4px 2px 0;cursor:pointer;font-weight:bold';
        const BTN_R = 'background:#c0392b;color:#fff;border:0;border-radius:8px;padding:5px 10px;cursor:pointer;font-weight:bold';
        const BTN_G = 'background:#2f9e5b;color:#fff;border:0;border-radius:8px;padding:5px 10px;cursor:pointer;font-weight:bold';
        const INP = 'background:#0f1426;color:#fff;border:1px solid #5a6aa8;border-radius:6px;padding:6px 8px;';

        function loginView() {
            body.innerHTML = '<div>サーバーに設定した合言葉（ADMIN_KEY）を入力してください。</div><input type="password" data-key placeholder="合言葉" autocomplete="off" style="' + INP + 'width:100%;margin:8px 0"><button type="button" data-go style="' + BTN + '">ログイン</button>';
            const go = async () => { setMsg('確認中…'); const r = await call('admin:login', { key: $('[data-key]', body).value }); if (r && r.ok) { setMsg(''); toolsView(); } else setMsg(why(r), true); };
            $('[data-go]', body).addEventListener('click', go); $('[data-key]', body).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        }
        function toolsView() {
            body.innerHTML = '<div style="display:flex;gap:6px"><input type="search" data-q placeholder="プレイヤー名 または ID" maxlength="30" style="' + INP + 'flex:1"><button type="button" data-search style="' + BTN + '">検索</button></div>' +
                '<div data-results style="margin-top:8px"></div><hr style="border:0;border-top:1px solid #3a4470;margin:12px 0"><div style="display:flex;justify-content:space-between;align-items:center"><b>🚫 BAN中のプレイヤー</b><button type="button" data-reload style="' + BTN + '">更新</button></div><div data-bans style="margin-top:6px"></div>';
            const q = $('[data-q]', body);
            const search = async () => {
                const box = $('[data-results]', body); box.textContent = '検索中…';
                const r = await call('admin:players', { q: q.value });
                if (!r || !r.ok) { box.textContent = ''; setMsg(why(r), true); return; }
                setMsg('');
                if (!r.rows.length) { box.innerHTML = '<div style="color:#aab">該当するプレイヤーはいません</div>'; return; }
                box.innerHTML = '<div style="color:#aab;font-size:.8rem">' + r.total + ' 人中、上位 ' + r.rows.length + ' 人を表示</div>' + r.rows.map((p) =>
                    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #2c3458"><div><b>' + esc(p.name) + '</b> <small style="color:#aab">ID: ' + esc(p.id) + ' ／ Lv.' + p.level + ' ／ 勉強 ' + p.studyMinutes + '分 ／ ' + p.pvpWins + '勝</small></div>' +
                    (p.banned ? '<span style="color:#ff8a8a">BAN中</span>' : '<button type="button" data-ban="' + esc(p.id) + '" data-name="' + esc(p.name) + '" style="' + BTN_R + '">BAN</button>') + '</div>').join('');
                box.querySelectorAll('[data-ban]').forEach((b) => b.addEventListener('click', () => banForm(b.dataset.ban, b.dataset.name)));
            };
            const loadBans = async () => {
                const box = $('[data-bans]', body); box.textContent = '読み込み中…';
                const r = await call('admin:bans', {});
                if (!r || !r.ok) { box.textContent = ''; setMsg(why(r), true); return; }
                if (!r.rows.length) { box.innerHTML = '<div style="color:#aab">BAN中のプレイヤーはいません</div>'; return; }
                box.innerHTML = r.rows.map((b) => '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #2c3458"><div><b>' + esc(b.name || '(名前不明)') + '</b> <small style="color:#aab">ID: ' + esc(b.id) + '<br>' + esc(b.reason || '理由なし') + ' ／ ' + (b.until ? fmtDate(b.until) + ' まで' : '無期限') + ' ／ 端末 ' + b.devs + ' 台</small></div>' +
                    '<button type="button" data-un="' + esc(b.id) + '" style="' + BTN_G + '">解除</button></div>').join('');
                box.querySelectorAll('[data-un]').forEach((b) => b.addEventListener('click', async () => {
                    if (!window.confirm(b.dataset.un + ' のBANを解除しますか？')) return;
                    const r2 = await call('admin:unban', { id: b.dataset.un }); if (r2 && r2.ok) { setMsg('解除しました'); loadBans(); search(); } else setMsg(why(r2), true);
                }));
            };
            const banForm = (id, name) => {
                const box = $('[data-results]', body);
                box.innerHTML = '<div style="border:1px solid #c0392b;border-radius:8px;padding:10px"><b>' + esc(name) + '</b> <small style="color:#aab">(ID: ' + esc(id) + ')</small> をBANします。' +
                    '<div style="margin-top:8px">期間：<select data-days style="' + INP + '"><option value="1">1日</option><option value="7">7日</option><option value="30">30日</option><option value="0">無期限</option></select></div>' +
                    '<div style="margin-top:6px"><input data-reason placeholder="理由（本人に表示されます）" maxlength="100" style="' + INP + 'width:100%"></div>' +
                    '<div style="margin-top:8px"><button type="button" data-do style="' + BTN_R + '">BANする</button> <button type="button" data-cancel style="' + BTN + 'background:#555c7a">やめる</button></div></div>';
                $('[data-cancel]', box).addEventListener('click', search);
                $('[data-do]', box).addEventListener('click', async () => {
                    const r = await call('admin:ban', { id: id, days: +$('[data-days]', box).value, reason: $('[data-reason]', box).value });
                    if (r && r.ok) { setMsg('BANしました（接続中なら、すぐ切断されます）'); loadBans(); search(); } else setMsg(why(r), true);
                });
            };
            $('[data-search]', body).addEventListener('click', search); q.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
            $('[data-reload]', body).addEventListener('click', loadBans);
            search(); loadBans();
        }
        // すでにログイン済みか確かめる（管理者パネルを開き直したとき用）
        call('admin:bans', {}).then((r) => { if (r && r.ok) toolsView(); else loginView(); });
    }
    window.SBAdmin = { open: openPanel };

    // 画面下の目立たない入口（設定の「プレイヤー削除」の下）
    function addEntry() {
        const del = document.getElementById('deletePlayerBtn');
        if (!del || document.getElementById('sbAdminEntry')) return !!document.getElementById('sbAdminEntry');
        const a = document.createElement('button'); a.type = 'button'; a.id = 'sbAdminEntry';
        a.textContent = '🛡 管理者'; a.style.cssText = 'display:block;margin-top:14px;background:none;border:0;color:#7d86a8;font-size:.75rem;text-decoration:underline;cursor:pointer;padding:2px 0';
        a.addEventListener('click', openPanel);
        del.parentNode.insertBefore(a, del.nextSibling); return true;
    }
    let t2 = 0; const iv = setInterval(() => { if (addEntry() || ++t2 > 40) clearInterval(iv); }, 500);
})();
