// ============================================================
// 町(ロビー)側のUI (stage-lobby.js)
//  ・ステージゲート：ステージを選んで「ソロ／部屋を作る／クイック参加／募集中の部屋に参加」
//  ・武器庫：ハクスラ武器の装備・オーブのはめ込み(PoE風)・売却
//  どちらも世界(world.js)の建物から window.openStageGate() / window.openArmory() で開く
// ============================================================
(function () {
    'use strict';

    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---------- 共通のモーダル枠 ----------
    function injectStyle() {
        if (document.getElementById('sbLobbyStyle')) return;
        const st = document.createElement('style');
        st.id = 'sbLobbyStyle';
        st.textContent = `
        .sbl-ov { position: fixed; inset: 0; z-index: 100001; background: rgba(5,7,12,.86); display: flex; align-items: center; justify-content: center; padding: 8px; }
        .sbl-box { background: #171b26; color: #eee; border: 2px solid #2b3550; border-radius: 14px; width: min(1000px, 100%); max-height: 94vh; max-height: 94dvh; display: flex; flex-direction: column; overflow: hidden; }
        .sbl-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #2b3550; }
        .sbl-head h2 { margin: 0; font-size: 1.15rem; }
        .sbl-x { background: #44495a; color: #fff; border: 0; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
        .sbl-body { display: flex; gap: 12px; padding: 12px; overflow: hidden; flex: 1; min-height: 0; }
        .sbl-col { overflow-y: auto; min-height: 0; }
        .sbl-left { flex: 1.2; } .sbl-right { flex: 1; }
        .sbl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .sbl-card { background: #232a3d; border: 2px solid transparent; border-radius: 10px; padding: 8px; cursor: pointer; }
        .sbl-card.sel { border-color: #ffd84a; } .sbl-card:hover { background: #2b3450; }
        .sbl-card small { color: #9fb3d9; display: block; }
        .sbl-btn { background: #3a6ee8; color: #fff; border: 0; border-radius: 8px; padding: 9px 14px; margin: 4px 4px 0 0; cursor: pointer; font-size: .95rem; }
        .sbl-btn.green { background: #1f9a5a; } .sbl-btn.orange { background: #d9812a; } .sbl-btn.gray { background: #44495a; } .sbl-btn.red { background: #b03a3a; }
        .sbl-btn:disabled { opacity: .45; cursor: default; }
        .sbl-sec { margin: 10px 0 4px; font-weight: bold; color: #9fb3d9; font-size: .85rem; }
        .sbl-room { display: flex; justify-content: space-between; align-items: center; background: #232a3d; border-radius: 8px; padding: 6px 10px; margin: 4px 0; font-size: .85rem; }
        .sbl-wl { display: flex; justify-content: space-between; gap: 6px; padding: 6px 8px; border-radius: 8px; cursor: pointer; border: 2px solid transparent; background: #1f2536; margin-bottom: 4px; font-size: .85rem; }
        .sbl-wl.sel { border-color: #fff; } .sbl-wl.eq { background: #223a2c; }
        .sbl-slot { display: inline-block; width: 52px; height: 52px; border-radius: 50%; border: 3px dashed #556; margin: 4px; text-align: center; line-height: 46px; cursor: pointer; font-size: 1.2rem; background: #11151f; vertical-align: top; }
        .sbl-slot.full { border-style: solid; border-color: #9fe0ff; background: #1c3144; }
        .sbl-fx { font-size: .85rem; padding: 2px 0; color: #cfe3ff; }
        .sbl-orb { background: #232a3d; border-radius: 8px; padding: 6px 8px; margin: 4px 0; cursor: pointer; font-size: .82rem; }
        .sbl-orb:hover { background: #2f3a58; }
        /* スマホ：2列を縦に積む。各列は中身の高さぶん確保し、全体を縦スクロールにする
           （以前は列の高さが0基準で縮み、はみ出した中身が隣の列に重なっていた） */
        @media (max-width: 720px), (max-aspect-ratio: 1/1) {
            .sbl-ov { align-items: flex-start; padding: max(6px, env(safe-area-inset-top)) 6px max(6px, env(safe-area-inset-bottom)); }
            .sbl-box { max-height: 100%; }
            .sbl-body { flex-direction: column; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; display: block; }
            .sbl-col { flex: none; min-height: auto; overflow: visible; margin-bottom: 14px; }
            .sbl-left, .sbl-right { flex: none; }
            .sbl-grid { grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); }
            .sbl-btn { padding: 11px 14px; }
        }
        @media (min-aspect-ratio: 1/1) { .sbl-col { touch-action: pan-y; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; } }
        /* スマホ横向き（高さが低い）：余白と文字を詰める */
        @media (max-height: 480px) and (min-aspect-ratio: 1/1) {
            .sbl-ov { padding: 4px max(6px, env(safe-area-inset-right)) 4px max(6px, env(safe-area-inset-left)); }
            .sbl-box { max-height: 100%; border-radius: 10px; }
            .sbl-head { padding: 5px 10px; } .sbl-head h2 { font-size: .95rem; }
            .sbl-body { padding: 8px; gap: 8px; }
            .sbl-grid { grid-template-columns: repeat(auto-fill, minmax(116px, 1fr)); gap: 6px; }
            .sbl-card { padding: 5px 6px; font-size: .78rem; } .sbl-card > div:first-child { font-size: 1.15rem !important; }
            .sbl-btn { padding: 6px 10px; font-size: .82rem; }
            .sbl-sec { margin: 6px 0 2px; font-size: .78rem; }
            .sbl-wl, .sbl-orb, .sbl-fx { font-size: .78rem; }
            .sbl-slot { width: 42px; height: 42px; line-height: 36px; }
        }
        @media (min-width: 721px) and (min-aspect-ratio: 1/1) { .sbl-col { touch-action: pan-y; -webkit-overflow-scrolling: touch; } }
        `;
        document.head.appendChild(st);
    }
    function modal(title, onClose) {
        injectStyle();
        const ov = document.createElement('div'); ov.className = 'sbl-ov';
        ov.innerHTML = '<div class="sbl-box"><div class="sbl-head"><h2></h2><button type="button" class="sbl-x">閉じる ✕</button></div><div class="sbl-body"></div></div>';
        ov.querySelector('h2').textContent = title;
        const close = () => { ov.remove(); if (onClose) onClose(); };
        ov.querySelector('.sbl-x').addEventListener('click', close);
        ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
        document.body.appendChild(ov);
        return { ov: ov, body: ov.querySelector('.sbl-body'), close: close };
    }

    // ============================================================
    // ステージゲート
    // ============================================================
    let rooms = [];
    // 町ページで共有しているソケット(window.socket)があればそれを使い、無ければステージ用に接続する
    function getSock() {
        if (window.socket) return window.socket;
        if (!window.sbStageSocket && typeof io === 'function') { try { window.sbStageSocket = io(); } catch (e) { window.sbStageSocket = null; } }
        return window.sbStageSocket || null;
    }
    function openStageGate() {
        if (!window.STAGE_DATA || !window.HW) { alert('ステージデータの読み込みに失敗しました'); return; }
        const hack = HW.load();

        const allStages = window.STAGE_DATA.STAGES;
        const WORLDS = window.STAGE_DATA.WORLDS || [];
        let world = 1;                                   // 表示中の世界。第二世界は解放後だけタブが現れる
        // 世界をまたぐ「門」のステージは、門が現れる条件（前の世界の最終ステージをナイトメア攻略）を満たしてから表示する
        const gateOpen = s => { if (!s.gateTo) return true; const w = WORLDS.find(x => x.id === s.gateTo); return !!(w && w.unlock && hack[w.unlock.gateFlag]); };
        const worldOpen = w => w.id === 1 || !!(w.unlock && hack[w.unlock.flag]);
        const worldStages = () => allStages.filter(s => (s.world || 1) === world && gateOpen(s));
        let selId = worldStages()[0].id;



        const DIFFS = window.STAGE_DATA.DIFFS;
        let selDiff = Math.min(DIFFS.length - 1, parseInt(hack.lastDiff, 10) || 0);
        const m = modal('🚪 ステージゲート', () => { const sk = getSock(); if (sk) sk.off('stage:rooms', onRooms); });
        m.body.innerHTML = '<div class="sbl-col sbl-left" id="sbStageList"></div><div class="sbl-col sbl-right" id="sbStageDetail"></div>';
        const listEl = m.body.querySelector('#sbStageList'), detEl = m.body.querySelector('#sbStageDetail');

        function onRooms(list) { rooms = list || []; renderDetail(); }
        const sock = getSock();
        if (sock) { sock.on('stage:rooms', onRooms); sock.on('connect', refreshRooms); }
        function refreshRooms() { if (sock && sock.connected) sock.emit('stage:list', { stageId: selId }); }

        function renderList() {

            const wdef = WORLDS.find(w => w.id === world) || {};
            const openWorlds = WORLDS.filter(worldOpen);
            const tabs = openWorlds.length > 1 ? '<div style="margin-bottom:6px">' + openWorlds.map(w => '<button class="sbl-btn' + (w.id === world ? '' : ' gray') + '" data-world="' + w.id + '" style="' + (w.id === world ? 'background:' + w.color : '') + '">' + w.icon + ' ' + esc(w.name) + '</button>').join('') + '</div>' : '';
            listEl.innerHTML = tabs + (world > 1 ? '<div style="font-size:.8rem;color:#d8b8ff;margin-bottom:4px">' + esc(wdef.note || '') + '</div>' : '') + '<div class="sbl-sec">ダンジョン＋ボス（約5分／最大4人で協力）</div><div class="sbl-grid">' + worldStages().map(s => {

                const c = hack.cleared[s.id] || 0;
                return '<div class="sbl-card' + (s.id === selId ? ' sel' : '') + '" data-id="' + s.id + '"><div style="font-size:1.5rem">' + s.icon + '</div><b>' + esc(s.name) + '</b><small>推奨Lv ' + s.ilvl + (s.mini ? '・ミニ' : '') + '</small><small>ボス：' + esc(s.boss.name) + '</small><small>' + (c ? '✔ クリア ' + c + '回' : '未クリア') + '</small></div>';
            }).join('') + '</div>';
            listEl.querySelectorAll('.sbl-card').forEach(c => c.addEventListener('click', () => { selId = c.dataset.id; renderList(); renderDetail(); refreshRooms(); }));

            listEl.querySelectorAll('[data-world]').forEach(b => b.addEventListener('click', () => { world = parseInt(b.dataset.world, 10); selId = worldStages()[0].id; renderList(); renderDetail(); refreshRooms(); }));


        }
        function matLine(s) {
            const seen = {}, out = [];
            ['mob', 'elite', 'boss'].forEach(k => (s.mats[k] || []).forEach(r => { if (!seen[r[0]]) { seen[r[0]] = 1; out.push({ id: r[0], boss: k === 'boss' }); } }));
            return out.map(o => { const m = (typeof MATERIAL_DATA !== 'undefined') ? MATERIAL_DATA[o.id] : null; return esc(m ? m.name : o.id) + (o.boss ? '<small style="display:inline;color:#ffd84a">(ボス)</small>' : ''); }).join('、 ');
        }
        function dropNames(ids) { return ids.map(id => { const b = HW.BASE_BY_ID[id]; return b ? esc(b.name) + '<small style="display:inline;color:#8a97b8">(' + (HW.TYPES[b.type] || {}).label + ')</small>' : ''; }).join('、 '); }
        function renderDetail() {
            const s = window.getStageById(selId);
            const eq = HW.getEquipped(hack);
            detEl.innerHTML =
                '<h3 style="margin:0 0 4px">' + s.icon + ' ' + esc(s.name) + '</h3><div style="font-size:.85rem;color:#b8c4e0">' + esc(s.desc) + '</div>' +
                '<div class="sbl-sec">出現する敵</div><div style="font-size:.85rem">' + s.enemies.map(e => e.icon + ' ' + esc(e.name)).join('　') + '</div>' +
                '<div class="sbl-sec">ボス</div><div style="font-size:.9rem">' + s.boss.icon + ' <b>' + esc(s.boss.name) + '</b></div>' +
                '<div class="sbl-sec">ドロップする武器（敵）</div><div style="font-size:.82rem">' + dropNames(s.drops) + '</div>' +
                '<div class="sbl-sec">ボス専用ドロップ（レア以上確定）</div><div style="font-size:.82rem;color:#ffd84a">' + dropNames(s.bossDrops) + '</div>' +
                '<div class="sbl-sec">難易度</div><div id="sbDiffs">' + DIFFS.map((d, i) => '<button class="sbl-btn' + (i === selDiff ? '' : ' gray') + '" data-diff="' + i + '" style="' + (i === selDiff ? 'background:' + d.color : '') + '">' + d.name + '</button>').join('') + '</div><div style="font-size:.78rem;color:#9fb3d9;margin-top:2px">' + esc(DIFFS[selDiff].note) + '</div>' +
                '<div class="sbl-sec">落ちる素材（グリフ工房の材料）</div><div style="font-size:.8rem;color:#c8f7a0">' + matLine(s) + '</div>' +
                '<div class="sbl-sec">装備中：<span style="color:' + HW.rarityOf(eq).color + '">' + esc(eq.name) + '</span></div>' +
                '<div><button class="sbl-btn green" id="sbSolo">ソロで出発</button><button class="sbl-btn" id="sbCreate">部屋を作って募集</button><button class="sbl-btn orange" id="sbQuick">クイック参加</button></div>' +
                '<div class="sbl-sec">募集中の部屋 <button class="sbl-btn gray" id="sbRefresh" style="padding:3px 8px;font-size:.75rem">更新</button></div>' +
                '<div id="sbRooms">' + (rooms.length ? rooms.filter(r => r.stageId === selId).map(r => '<div class="sbl-room"><span>' + esc(r.members[0] ? r.members[0].name : '?') + ' の部屋 (' + r.members.length + '/' + r.max + ')</span><button class="sbl-btn" data-room="' + r.id + '" style="margin:0">参加</button></div>').join('') || '<div style="font-size:.8rem;color:#889">このステージの募集はありません</div>' : '<div style="font-size:.8rem;color:#889">このステージの募集はありません</div>') + '</div>';
            detEl.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => { selDiff = parseInt(b.dataset.diff, 10); hack.lastDiff = selDiff; HW.save(hack); renderDetail(); }));
            detEl.querySelector('#sbSolo').addEventListener('click', () => launch('solo'));
            detEl.querySelector('#sbCreate').addEventListener('click', () => launch('create'));
            detEl.querySelector('#sbQuick').addEventListener('click', () => launch('quick'));
            detEl.querySelector('#sbRefresh').addEventListener('click', refreshRooms);
            detEl.querySelectorAll('[data-room]').forEach(b => b.addEventListener('click', () => launch('join', b.dataset.room)));
        }
        function launch(mode, roomId) {
            try { localStorage.setItem('sbStageLaunch', JSON.stringify({ stageId: selId, mode: mode, roomId: roomId || null, diff: selDiff, at: Date.now() })); } catch (e) {}
            location.href = 'stage.html';
        }
        renderList(); renderDetail(); refreshRooms();
    }

    // ============================================================
    // 武器庫（装備・ソケット・売却）
    // ============================================================
    function orbLabel(o) {
        let name = o.tier || 'orb';
        try { if (typeof getOrbDisplayName === 'function') name = getOrbDisplayName(o); } catch (e) {}
        return String(name);
    }
    function openArmory() {
        if (!window.HW) return;
        let hack = HW.load();
        try { HW.syncLegacy(hack, true); } catch (e) {}
        let selId = hack.equipped;
        let filter = 'all';
        const m = modal('🗡 武器庫（装備・オーブ・売却）', () => { try { if (typeof renderOrbInventory === 'function') renderOrbInventory(); if (typeof updateStatus === 'function') updateStatus(getPlayerData()); } catch (e) {} });
        m.body.innerHTML = '<div class="sbl-col sbl-left" id="sbWl"></div><div class="sbl-col sbl-right" id="sbWd"></div>';
        const wl = m.body.querySelector('#sbWl'), wd = m.body.querySelector('#sbWd');
        const coins = () => { const p = getPlayerData(); return p ? (p.coins || 0) : 0; };

        function sorted() {
            const arr = hack.weapons.filter(w => filter === 'all' || w.type === filter || (filter === 'eq' && w.id === hack.equipped));
            return arr.sort((a, b) => HW.RARITY_ORDER.indexOf(b.rarity) - HW.RARITY_ORDER.indexOf(a.rarity) || b.ilvl - a.ilvl || b.dmg - a.dmg);
        }
        function renderList() {
            const types = {}; hack.weapons.forEach(w => { types[w.type] = 1; });
            wl.innerHTML = '<div class="sbl-sec">所持武器 ' + hack.weapons.length + ' 本（コイン ' + coins() + '）</div>' +
                '<select id="sbFilter" style="margin-bottom:6px;padding:4px"><option value="all">すべて</option><option value="eq">装備中</option>' + Object.keys(types).map(t => '<option value="' + t + '"' + (filter === t ? ' selected' : '') + '>' + esc((HW.TYPES[t] || {}).label || t) + '</option>').join('') + '</select> ' +
                '<button class="sbl-btn gray" id="sbBulk" style="padding:4px 8px;font-size:.75rem">ノーマル/マジックを一括売却</button>' +
                sorted().map(w => '<div class="sbl-wl' + (w.id === selId ? ' sel' : '') + (w.id === hack.equipped ? ' eq' : '') + '" data-id="' + w.id + '"><span style="color:' + HW.rarityOf(w).color + '">' + (w.id === hack.equipped ? '【装備中】' : '') + esc(w.name) + '</span><span style="color:#9fb3d9">攻' + w.dmg + ' 穴' + w.sockets + '</span></div>').join('');
            wl.querySelector('#sbFilter').value = filter;
            wl.querySelector('#sbFilter').addEventListener('change', (e) => { filter = e.target.value; renderList(); });
            wl.querySelectorAll('.sbl-wl').forEach(r => r.addEventListener('click', () => { selId = r.dataset.id; renderList(); renderDetail(); }));
            wl.querySelector('#sbBulk').addEventListener('click', () => {
                const targets = hack.weapons.filter(w => w.id !== hack.equipped && (w.rarity === 'normal' || w.rarity === 'magic') && !(w.orbs || []).some(Boolean));
                if (!targets.length) { alert('売却できる武器がありません（オーブをはめた武器は対象外）'); return; }
                const total = targets.reduce((s, w) => s + HW.sellValue(w), 0);
                if (!confirm(targets.length + '本を売却して ' + total + ' コインを得ます。よろしいですか？')) return;
                targets.forEach(w => { HW.sellWeapon(hack, w.id); });
                addCoins(total); HW.save(hack); renderList(); renderDetail();
            });
        }
        function addCoins(v) { const p = getPlayerData(); if (!p) return; p.coins = (p.coins || 0) + v; localStorage.setItem('player', JSON.stringify(p)); }

        function renderDetail() {
            const w = hack.weapons.find(x => x.id === selId);
            if (!w) { wd.innerHTML = '<div style="color:#889">武器を選んでください</div>'; return; }
            const R = HW.rarityOf(w), T = HW.TYPES[w.type] || {};
            const ag = HW.aggregate(w);
            const slots = []; for (let i = 0; i < w.sockets; i++) slots.push('<span class="sbl-slot' + (w.orbs[i] ? ' full' : '') + '" data-slot="' + i + '" title="' + (w.orbs[i] ? esc(orbLabel(w.orbs[i])) : '空きソケット') + '">' + (w.orbs[i] ? '💎' : '＋') + '</span>');
            wd.innerHTML =
                '<h3 style="margin:0;color:' + R.color + '">' + esc(w.name) + '</h3>' +
                '<div style="font-size:.82rem;color:#9fb3d9">[' + R.label + '] ' + esc(T.label || w.type) + '　Lv' + w.ilvl + '　攻撃力 ' + w.dmg + '</div>' +
                '<div class="sbl-sec">特殊効果</div>' + (w.effects.length ? w.effects.map(f => '<div class="sbl-fx">◆ ' + esc(HW.describeEffect(f)) + '</div>').join('') : '<div class="sbl-fx" style="color:#778">なし</div>') +
                '<div class="sbl-sec">ソケット（オーブをはめ込む）</div><div>' + slots.join('') + '</div>' +
                (w.orbs.some(Boolean) ? '<div class="sbl-sec">オーブの効果</div>' + w.orbs.map(o => o ? HW.orbToEffects(o).lines.map(l => '<div class="sbl-fx" style="color:#9fe0ff">💎 ' + esc(l) + '</div>').join('') : '').join('') : '') +
                '<div style="margin-top:8px"><button class="sbl-btn green" id="sbEq"' + (w.id === hack.equipped ? ' disabled' : '') + '>装備する</button>' +
                '<button class="sbl-btn red" id="sbSell"' + (w.id === hack.equipped ? ' disabled' : '') + '>売却 (' + HW.sellValue(w) + ')</button></div>' +
                '<div id="sbOrbPick"></div>';
            wd.querySelector('#sbEq').addEventListener('click', () => { hack.equipped = w.id; HW.save(hack); refreshInvInfo(); renderList(); renderDetail(); });
            wd.querySelector('#sbSell').addEventListener('click', () => {
                if (!confirm(w.name + ' を売却しますか？（はめたオーブは戻ります）')) return;
                const v = HW.sellWeapon(hack, w.id); if (v > 0) { addCoins(v); HW.save(hack); selId = hack.equipped; renderList(); renderDetail(); }
            });
            wd.querySelectorAll('.sbl-slot').forEach(s => s.addEventListener('click', () => openOrbPicker(w, parseInt(s.dataset.slot, 10))));
        }
        function openOrbPicker(w, slot) {
            const box = wd.querySelector('#sbOrbPick');
            const p = getPlayerData(); const orbs = (p && p.orbs) || [];
            let h = '<div class="sbl-sec">ソケット' + (slot + 1) + 'にはめるオーブ（所持 ' + orbs.length + '）</div>';
            if (w.orbs[slot]) h += '<button class="sbl-btn gray" id="sbUn">いまのオーブを外す</button>';
            h += orbs.map((o, i) => '<div class="sbl-orb" data-i="' + i + '">💎 ' + esc(orbLabel(o)) + '<br><small style="color:#9fe0ff">' + esc(HW.orbToEffects(o).lines.join(' / ')) + '</small></div>').join('') || '<div style="color:#889;font-size:.8rem">オーブがありません（ステージの敵・ボスや勉強で入手）</div>';
            box.innerHTML = h;
            const un = box.querySelector('#sbUn'); if (un) un.addEventListener('click', () => { HW.unsocketOrb(w, slot); HW.save(hack); renderDetail(); });
            box.querySelectorAll('.sbl-orb').forEach(el => el.addEventListener('click', () => { const o = orbs[parseInt(el.dataset.i, 10)]; if (o && HW.socketOrb(w, slot, o.id)) { HW.save(hack); renderDetail(); } }));
        }
        renderList(); renderDetail();
    }

    // ---------- 第二世界の解放通知（町に戻ったとき1回だけ）----------
    function checkWorldNotice() {
        try {
            if (!window.HW) return;
            const h = HW.load();
            const wn = h.worldNotice;
            if (!wn || !wn.t) return;
            h.worldNotice = null; HW.save(h);
            const n = document.createElement('div');
            n.style.cssText = 'position:fixed;top:18%;left:50%;transform:translateX(-50%);z-index:100002;background:rgba(40,16,80,.92);color:#f0e0ff;border:2px solid #ffc84a;border-radius:12px;padding:12px 20px;font-weight:bold;text-align:center;max-width:90vw;box-shadow:0 0 24px rgba(255,200,74,.55);transition:opacity 1s;opacity:0';
            const t = document.createElement('div'); t.textContent = '🚪 ' + wn.t;
            const sub = document.createElement('div'); sub.style.cssText = 'font-size:.85em;font-weight:normal;margin-top:4px'; sub.textContent = wn.s || '';
            n.appendChild(t); n.appendChild(sub);
            document.body.appendChild(n);
            setTimeout(() => { n.style.opacity = '1'; }, 800);
            setTimeout(() => { n.style.opacity = '0'; }, 7500);
            setTimeout(() => { n.remove(); }, 8600);
        } catch (e) { /* 通知は無くても進行に影響しない */ }
    }

    // ---------- インベントリ画面（旧ショップ画面）からの導線 ----------
    function refreshInvInfo() {
        const el = document.getElementById('invEquipped');
        if (!el || !window.HW) return;
        const w = HW.getEquipped(HW.load());
        if (w) { el.textContent = w.name + '（' + HW.rarityOf(w).label + '・攻撃' + w.dmg + '）'; el.style.color = HW.rarityOf(w).color; }
    }
    function bindInventory() {
        const a = document.getElementById('openArmoryFromInv'), g = document.getElementById('openStageGateFromInv');
        if (a) a.addEventListener('click', openArmory);
        if (g) g.addEventListener('click', openStageGate);
        const sec = document.getElementById('section-shop');
        if (sec && window.MutationObserver) new MutationObserver(refreshInvInfo).observe(sec, { attributes: true, attributeFilter: ['class'] });
        refreshInvInfo();

        checkWorldNotice();

    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindInventory); else bindInventory();

    window.openStageGate = openStageGate;
    window.openArmory = openArmory;
})();
