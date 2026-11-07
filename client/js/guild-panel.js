// ============================================================================
// ギルドパネルUI（guild-panel.js）
// 既存の guild-info 等のDOMはHTMLに存在しないため、モーダルとして自前で生成する。
// 金庫コインの納入・施設強化はサーバー側（socket/guild.js → GuildManager）が権威。
// ============================================================================
(function () {
    'use strict';

    // サーバー側 GuildManager.BUILDINGS と同じ定義（変更時は両方直すこと）
    const BUILDINGS = {
        castle:   { name: '城',     icon: '🏰', maxLevel: 10, baseCost: 500,  costMult: 1.7, desc: 'ギルドの象徴。総合力に大きく貢献' },
        wall:     { name: '城壁',   icon: '🧱', maxLevel: 10, baseCost: 300,  costMult: 1.6, desc: '防衛施設。総合力に貢献' },
        barracks: { name: '兵舎',   icon: '⚔️', maxLevel: 10, baseCost: 400,  costMult: 1.7, desc: 'Lvごとに貢献度獲得+5%' },
        market:   { name: '市場',   icon: '🏪', maxLevel: 10, baseCost: 350,  costMult: 1.6, desc: '交易施設。総合力に貢献' }
    };
    const fmt = n => (n || 0).toLocaleString('ja-JP');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    let modal = null, currentGuild = null, allGuilds = [];

    function player() { return typeof getPlayerData === 'function' ? getPlayerData() : null; }
    function socketOk() { return window.socket && window.socket.connected; }

    function buildingCost(def, level) {
        if (level >= def.maxLevel) return null;
        return Math.round(def.baseCost * Math.pow(def.costMult, level));
    }

    function open() {
        if (modal) { modal.remove(); modal = null; }
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'guildPanelModal';
        modal.style.display = 'flex';   // .modal は既定で display:none なので明示的に出す
        modal.innerHTML = '<div class="modal-content" style="max-width:640px;max-height:85vh;overflow-y:auto;"><button type="button" class="close btn btn-secondary">閉じる</button><div id="guildPanelBody"><p>読み込み中…</p></div></div>';
        document.body.appendChild(modal);
        modal.querySelector('.close').addEventListener('click', () => { modal.remove(); modal = null; });
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); modal = null; } });
        refresh();
    }

    function refresh() {
        const p = player();
        if (!p || !socketOk()) { body().innerHTML = '<p>キャラクターを作成してから開いてください。</p>'; return; }
        window.socket.emit('guild:getPlayerGuild', p.id);
        window.socket.emit('guild:getList');
    }

    function body() { return document.getElementById('guildPanelBody'); }

    function render() {
        const b = body(); if (!b) return;
        const g = currentGuild;
        if (!g) { renderNoGuild(b); return; }
        const p = player();
        const me = (g.members || []).find(m => m.id === p.id);
        const isLeader = me && me.role === 'leader';
        const buildings = g.buildings || {};
        const rows = Object.keys(BUILDINGS).map(id => {
            const def = BUILDINGS[id];
            const lv = (buildings[id] && buildings[id].level) || 0;
            const cost = buildingCost(def, lv);
            const canUpgrade = isLeader && cost != null && (g.coins || 0) >= cost;
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #444;border-radius:8px;margin-bottom:6px;">' +
                '<span style="font-size:22px;">' + def.icon + '</span>' +
                '<div style="flex:1;">' +
                '<div><b>' + def.name + '</b> <span style="color:#ffd84a;">Lv.' + lv + '/' + def.maxLevel + '</span></div>' +
                '<div style="font-size:12px;color:#aaa;">' + esc(def.desc) + '</div>' +
                '</div>' +
                (cost == null ? '<span style="color:#7CFC9A;font-size:12px;">MAX</span>'
                    : '<button class="btn btn-small" data-upgrade="' + id + '"' + (canUpgrade ? '' : ' disabled') + '>⬆️ ' + fmt(cost) + 'コイン</button>') +
                '</div>';
        }).join('');

        b.innerHTML =
            '<h2 style="margin:0 0 8px;">🛡️ ' + esc(g.name) + ' <span style="font-size:13px;color:#aaa;">ランク ' + esc(g.rank || 'F') + ' / 総合力 ' + fmt(g.power || 0) + '</span></h2>' +
            '<p style="margin:0 0 10px;color:#ccc;">' + esc(g.description || '') + '</p>' +
            '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px;">' +
            '<span>💰 ギルドコイン: <b style="color:#ffd84a;">' + fmt(g.coins || 0) + '</b></span>' +
            '<span>👥 メンバー: ' + fmt((g.members || []).length) + '人</span>' +
            '<span>⭐ 貢献度: ' + fmt(g.contribution || 0) + '</span>' +
            '<span>🪙 あなたのコイン: <b>' + fmt((player() || {}).coins || 0) + '</b></span>' +
            '</div>' +
            '<h3 style="margin:10px 0 6px;">🏗️ 施設強化（ギルドコイン消費・リーダーのみ）</h3>' +
            rows +
            '<h3 style="margin:14px 0 6px;">💰 コインを納める</h3>' +
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">' +
            '<input id="guildDepositAmount" type="number" min="1" step="1" placeholder="コイン数" style="width:140px;padding:6px;">' +
            '<button class="btn btn-small" id="guildDepositBtn">納める</button>' +
            '<button class="btn btn-small" id="guildDepositAllBtn">全額納める</button>' +
            '</div>' +
            '<h3 style="margin:14px 0 6px;">👥 メンバー</h3>' +
            '<ul style="margin:0;padding-left:18px;">' +
            (g.members || []).map(m => '<li>' + esc(m.name) + ' <span style="color:#aaa;font-size:12px;">' + (m.role === 'leader' ? 'リーダー' : '') + ' 貢献度 ' + fmt(m.contribution || 0) + '</span></li>').join('') +
            '</ul>' +
            '<div style="margin-top:14px;"><button class="btn btn-secondary" id="guildLeaveBtn">ギルドを脱退する</button></div>';

        b.querySelectorAll('[data-upgrade]').forEach(btn => {
            btn.addEventListener('click', () => upgradeBuilding(btn.dataset.upgrade));
        });
        const dep = document.getElementById('guildDepositBtn');
        if (dep) dep.addEventListener('click', () => {
            const inp = document.getElementById('guildDepositAmount');
            const amt = Math.floor(Number(inp && inp.value) || 0);
            if (amt <= 0) { alert('コイン数を入力してください'); return; }
            deposit(amt);
        });
        const depAll = document.getElementById('guildDepositAllBtn');
        if (depAll) depAll.addEventListener('click', () => {
            const all = Math.floor(((player() || {}).coins) || 0);
            if (all <= 0) { alert('納められるコインがありません'); return; }
            deposit(all);
        });
        const leave = document.getElementById('guildLeaveBtn');
        if (leave) leave.addEventListener('click', () => {
            if (!confirm('ギルドを脱退しますか？')) return;
            const p = player();
            window.socket.emit('guild:leave', { guildId: g.id, playerId: p.id });
            window.socket.once('guild:leaveResponse', (res) => {
                if (res && res.success) { currentGuild = null; if (typeof setPlayerGuild === 'function') setPlayerGuild(null); refresh(); }
                else alert((res && res.message) || '脱退に失敗しました');
            });
        });
    }

    function renderNoGuild(b) {
        const list = (allGuilds || []).map(g =>
            '<div style="border:1px solid #444;border-radius:8px;padding:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">' +
            '<div><b>' + esc(g.name) + '</b> <span style="color:#aaa;font-size:12px;">' + esc(g.description || '') + ' / ' + g.memberCount + '人 / 総合力 ' + fmt(g.power || 0) + '</span></div>' +
            '<button class="btn btn-small join-guild-item" data-guild-id="' + esc(g.id) + '">参加</button>' +
            '</div>').join('');
        b.innerHTML =
            '<h2 style="margin:0 0 10px;">🛡️ ギルド</h2>' +
            '<div style="border:1px dashed #666;border-radius:8px;padding:10px;margin-bottom:12px;">' +
            '<b>ギルドを作成</b>' +
            '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">' +
            '<input id="guildCreateName" placeholder="ギルド名" maxlength="20" style="padding:6px;">' +
            '<input id="guildCreateDesc" placeholder="紹介文（任意）" maxlength="100" style="padding:6px;flex:1;min-width:160px;">' +
            '<button class="btn btn-small" id="guildCreateBtn">作成</button>' +
            '</div></div>' +
            '<h3 style="margin:10px 0 6px;">ギルド一覧</h3>' +
            (list || '<p>現在ギルドはありません。</p>');
        const cb = document.getElementById('guildCreateBtn');
        if (cb) cb.addEventListener('click', () => {
            const name = (document.getElementById('guildCreateName') || {}).value || '';
            const desc = (document.getElementById('guildCreateDesc') || {}).value || '';
            const p = player();
            if (!name.trim()) { alert('ギルド名を入力してください'); return; }
            window.socket.emit('guild:create', { name: name.trim(), description: desc.trim(), playerId: p.id, playerName: p.name });
            window.socket.once('guild:createResponse', (res) => {
                if (res && res.success) { currentGuild = res.guild; if (typeof setPlayerGuild === 'function') setPlayerGuild(res.guild); refresh(); }
                else alert((res && res.message) || '作成に失敗しました');
            });
        });
        b.querySelectorAll('.join-guild-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = player();
                window.socket.emit('guild:join', { guildId: btn.dataset.guildId, playerId: p.id, playerName: p.name });
                window.socket.once('guild:joinResponse', (res) => {
                    if (res && res.success) { currentGuild = res.guild; if (typeof setPlayerGuild === 'function') setPlayerGuild(res.guild); refresh(); }
                    else alert((res && res.message) || '参加に失敗しました');
                });
            });
        });
    }

    function deposit(amount) {
        const p = player(); if (!p || !currentGuild) return;
        window.socket.emit('guild:deposit', { guildId: currentGuild.id, playerId: p.id, amount: amount }, (res) => {
            if (!res) { alert('サーバーから応答がありません'); return; }
            if (!res.success) { alert(res.message || '納入に失敗しました'); return; }
            // サーバー権威の値でローカルを同期
            if (res.coins != null) { p.coins = res.coins; try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {} }
            if (res.guild) { currentGuild = res.guild; if (typeof setPlayerGuild === 'function') setPlayerGuild(res.guild); }
            render();
        });
    }

    function upgradeBuilding(buildingId) {
        const p = player(); if (!p || !currentGuild) return;
        window.socket.emit('guild:upgradeBuilding', { guildId: currentGuild.id, playerId: p.id, buildingId: buildingId }, (res) => {
            if (!res) { alert('サーバーから応答がありません'); return; }
            if (!res.success) { alert(res.message || '強化に失敗しました'); return; }
            if (res.guild) { currentGuild = res.guild; if (typeof setPlayerGuild === 'function') setPlayerGuild(res.guild); }
            render();
        });
    }

    // ソケット受信でギルド情報を保持
    function setup() {
        if (!window.socket) return;
        window.socket.on('guild:playerGuild', (g) => { currentGuild = g || null; if (modal) render(); });
        window.socket.on('guild:list', (list) => { allGuilds = list || []; if (modal && !currentGuild && body()) renderNoGuild(body()); });
        window.socket.on('guild:info', (g) => { if (g && currentGuild && g.id === currentGuild.id) { currentGuild = g; render(); } });
    }

    document.addEventListener('DOMContentLoaded', () => {
        setup();
        // index.html のギルドボタン
        const btn = document.getElementById('guildBtn');
        if (btn) btn.addEventListener('click', open);
    });

    window.GuildUI = { open, refresh };
})();
