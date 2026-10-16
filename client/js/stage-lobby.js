// ============================================================
// 町(ロビー)側のUI (stage-lobby.js)
//  ・ステージゲート：ステージを選んで「ソロ／部屋を作る／クイック参加／募集中の部屋に参加」
//  ・武器庫：ハクスラ武器の装備・オーブのはめ込み(PoE風)・売却
//  どちらも世界(world.js)の建物から window.openStageGate() / window.openArmory() で開く
// ============================================================
(function () {
    'use strict';

    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // 大きな数を「1.2億」「3,600万」のように読みやすくする
    function fmtBig(n) {
        n = Math.round(n);
        if (n >= 1e8) return (Math.round(n / 1e7) / 10) + '億';
        if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '万';
        return n.toLocaleString();
    }

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
        @media (max-aspect-ratio: 1/1) {
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
    const bmEvent = n => { try { window.SbBeginner && window.SbBeginner.event(n); } catch (e) {} };   // ビギナーミッションに「行動した」と知らせる
    function openStageGate() {
        bmEvent('gate');
        if (!window.STAGE_DATA || !window.HW) { alert('ステージデータの読み込みに失敗しました'); return; }
        const hack = HW.load();
        const allStages = window.STAGE_DATA.STAGES;
        const WORLDS = window.STAGE_DATA.WORLDS || [];
        let world = 1;                                   // 表示中の世界。第二世界は解放後だけタブが現れる
        // 世界をまたぐ「門」のステージは、門が現れる条件（前の世界の最終ステージをクリア）を満たしてから表示する
        const gateOpen = s => { if (!s.gateTo) return true; const w = WORLDS.find(x => x.id === s.gateTo); return !!(w && w.unlock && hack[w.unlock.gateFlag]); };
        const SS = window.SeasonSys || null;
        const progressOpen = w => w.id === 1 || !!w.alwaysOpen || !!(w.unlock && hack[w.unlock.flag]);
        // シーズンキャラは、進行状況に加えて「週ごとの解放」も必要。スタンダード専用の領域は、スタンダードキャラだけ
        const worldOpen = w => progressOpen(w) && (!SS || SS.canEnterWorld(w.id));
        const timeLocked = () => (SS && SS.isSeasonChar()) ? WORLDS.filter(w => w.id > 1 && !w.standardOnly && progressOpen(w) && !SS.canEnterWorld(w.id)) : [];
        const worldStages = () => allStages.filter(s => !s.pvp && (s.world || 1) === world && gateOpen(s));
        // ボスラッシュ／無限回廊：解放条件（ディメンション・キーパー討伐／ボスラッシュのエクストリームクリア）
        const stageUnlocked = s => { const u = s.unlock; if (!u) return true; if (u.cleared) return (hack.cleared[u.cleared] || 0) > 0; if (u.flag) return !!hack[u.flag]; return true; };
        const RD = window.STAGE_DATA.RUSH_DIFFS, RUSH = window.STAGE_DATA.RUSH;
        const diffsOf = s => s && s.rush ? RD : window.STAGE_DATA.DIFFS;
        // ボスラッシュのエクストリームは、ディメンション・キーパーをナイトメアでクリアしていないと入れない
        const dimNm = () => ((hack.clearedDiff && hack.clearedDiff[RUSH.extremeNeed.stageId]) || {})[RUSH.extremeNeed.diff] > 0;
        const diffLocked = (s, i) => s && s.rush && RD[i].needDimNightmare && !dimNm();
        // シーズンキャラの週ごとの難易度解放は、通常ステージの難易度の番号で判定する（ボスラッシュ：イージー=0／ハード=1／ナイトメア・エクストリーム=2）
        const gateIdx = (s, i) => s && s.rush ? [0, 1, 2, 2][i] : i;
        // いま入れる世界から開く（スタンダードキャラはスタンダードワールドから、シーズンキャラは第一世界から）
        world = (WORLDS.find(worldOpen) || { id: 1 }).id;
        if (!worldStages().length) { alert(SS && SS.isSeasonChar() ? 'いま入れるステージがありません。' : 'スタンダードキャラは「スタンダードワールド」に挑戦できます。シーズンワールド（第一〜第五世界）はシーズンキャラで遊べます。'); return; }
        let selId = worldStages()[0].id;
        let selDiff = Math.min(2, parseInt(hack.lastDiff, 10) || 0);
        if (window.SeasonSys) while (selDiff > 0 && !window.SeasonSys.canUseDiff(selDiff)) selDiff--;
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
            const locks = timeLocked().map(w => '<div style="font-size:.78rem;color:#ffb86a;margin-bottom:3px">🔒 ' + w.icon + ' ' + esc(w.name) + '：シーズン' + SS.worldOpenWeek(w.id) + '週目から解放</div>').join('');
            listEl.innerHTML = tabs + locks + (world > 1 ? '<div style="font-size:.8rem;color:#d8b8ff;margin-bottom:4px">' + esc(wdef.note || '') + '</div>' : '') + '<div class="sbl-sec">ダンジョン＋ボス（約5分／最大4人で協力）</div><div class="sbl-grid">' + worldStages().map(s => {
                const c = hack.cleared[s.id] || 0;
                if (s.rush || s.corridor) {
                    const un = stageUnlocked(s), best = s.rush ? Math.max.apply(null, [0].concat(Object.keys(hack.rushBest || {}).map(k => hack.rushBest[k] | 0))) : (hack.corridorBest | 0);
                    return '<div class="sbl-card' + (s.id === selId ? ' sel' : '') + '" data-id="' + s.id + '" style="' + (un ? 'border-color:#ffd84a' : 'opacity:.7') + '"><div style="font-size:1.5rem">' + (un ? s.icon : '🔒') + '</div><b>' + esc(s.name) + '</b><small style="color:#ffd36a">' + (s.rush ? 'フェーズ制ボス連戦' : '無限に続く迷宮') + '</small><small>' + (un ? (s.rush ? (c ? '✔ 制覇 ' + c + '回' : (best ? '最高：フェーズ' + best + 'まで' : '未挑戦')) : (best ? '最深：地下' + best + '階' : '未挑戦')) : '🔒 ' + esc(s.unlock.text)) + '</small></div>';
                }
                return '<div class="sbl-card' + (s.id === selId ? ' sel' : '') + '" data-id="' + s.id + '"><div style="font-size:1.5rem">' + s.icon + '</div><b>' + esc(s.name) + '</b><small>推奨Lv ' + s.ilvl + (s.mini ? '・ミニ' : '') + '</small><small style="color:#ffd36a">推奨合計 ' + fmtBig(s.req || 0) + (s.bossHp ? '　ボスHP ' + fmtBig(s.bossHp) : '') + '</small><small>ボス：' + esc(s.boss.name) + '</small><small>' + (c ? '✔ クリア ' + c + '回' : '未クリア') + '</small></div>';
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
        let selRush = Math.min(RD.length - 1, parseInt(hack.lastRushDiff, 10) || 0);
        function roomsHtml() {
            return '<div class="sbl-sec">募集中の部屋 <button class="sbl-btn gray" id="sbRefresh" style="padding:3px 8px;font-size:.75rem">更新</button></div>' +
                '<div id="sbRooms">' + ((rooms.length && rooms.filter(r => r.stageId === selId).length) ? rooms.filter(r => r.stageId === selId).map(r => '<div class="sbl-room"><span>' + esc(r.members[0] ? r.members[0].name : '?') + ' の部屋 (' + r.members.length + '/' + r.max + ')</span><button class="sbl-btn" data-room="' + r.id + '" style="margin:0">参加</button></div>').join('') : '<div style="font-size:.8rem;color:#889">このステージの募集はありません</div>') + '</div>';
        }
        // ボスラッシュの詳細（4つの難易度・フェーズ一覧・解放条件）
        function renderRush(s) {
            const un = stageUnlocked(s), eq = HW.getEquipped(hack), bestOf = i => (hack.rushBest || {})[i] | 0, clr = i => ((hack.clearedDiff || {})[s.id] || {})[i] | 0;
            const phases = RUSH.phases.map(p => '<div style="font-size:.82rem;margin:2px 0"><b style="color:' + (p.final ? '#f0b0ff' : '#ffd36a') + '">' + p.label + '</b>　' + (p.final ? '🌀 強化ディメンション・キーパー（サンズ風の弾幕）' : '第' + p.world + '世界のボスから' + RUSH.bossCount + '体が同時に出現') + '</div>').join('');
            detEl.innerHTML =
                '<h3 style="margin:0 0 4px">' + s.icon + ' ' + esc(s.name) + '</h3><div style="font-size:.85rem;color:#b8c4e0">' + esc(s.desc) + '</div>' +
                (un ? '' : '<div style="margin:8px 0;padding:8px;border:2px solid #ffb86a;border-radius:8px;color:#ffd9a0;font-weight:bold">🔒 ' + esc(s.unlock.text) + '</div>') +
                '<div class="sbl-sec">フェーズ（ボスは第四世界のボス並に強化され、進むほど強くなる）</div>' + phases +
                '<div class="sbl-sec">難易度</div><div id="sbDiffs">' + RD.map((d, i) => { const lk = !un || diffLocked(s, i) || (SS && !SS.canUseDiff(gateIdx(s, i))); return '<button class="sbl-btn' + (i === selRush && !lk ? '' : ' gray') + '" data-rdiff="' + i + '" style="' + (i === selRush && !lk ? 'background:' + d.color : '') + (lk ? ';opacity:.55' : '') + '">' + (lk ? '🔒 ' : '') + d.name + '</button>'; }).join('') + '</div>' +
                '<div style="font-size:.78rem;color:#9fb3d9;margin-top:2px">' + esc(RD[selRush].note) + '　（1フェーズ ' + RD[selRush].phaseMin + '分）</div>' +
                (RD[selRush].needDimNightmare && !dimNm() ? '<div style="font-size:.8rem;color:#ffb86a;margin-top:3px">🔒 エクストリームは、ディメンション・キーパーを「ナイトメア」でクリアすると挑戦できます</div>' : '') +
                '<div class="sbl-sec">記録</div><div style="font-size:.8rem;color:#c8d4ee">' + RD.map((d, i) => d.name + '：' + (clr(i) ? '✔制覇 ' + clr(i) + '回' : (bestOf(i) ? 'フェーズ' + bestOf(i) + 'まで' : '未挑戦'))).join('　／　') + '</div>' +
                '<div class="sbl-sec">装備中：<span style="color:' + HW.rarityOf(eq).color + '">' + esc(eq.name) + '</span></div>' +
                (un ? '<div><button class="sbl-btn green" id="sbSolo">ソロで出発</button><button class="sbl-btn" id="sbCreate">部屋を作って募集</button><button class="sbl-btn orange" id="sbQuick">クイック参加</button></div>' + roomsHtml() : '');
            bindDetail(true);
        }
        // 無限回廊の詳細
        function renderCorr(s) {
            const un = stageUnlocked(s), items = HW.SPECIAL_ORDER.map(k => HW.SPECIAL_ITEMS[k].icon + HW.SPECIAL_ITEMS[k].name + '×' + HW.itemCount(hack, k)).join('　');
            detEl.innerHTML =
                '<h3 style="margin:0 0 4px">' + s.icon + ' ' + esc(s.name) + '</h3><div style="font-size:.85rem;color:#b8c4e0">' + esc(s.desc) + '</div>' +
                (un ? '' : '<div style="margin:8px 0;padding:8px;border:2px solid #ffb86a;border-radius:8px;color:#ffd9a0;font-weight:bold">🔒 ' + esc(s.unlock.text) + '</div>') +
                '<div class="sbl-sec">ルール</div><div style="font-size:.82rem;line-height:1.6">・階層ごとにランダムな迷路。<b>下への階段</b>を見つけて進む（深いほど敵は強い）<br>・敵の強さは<b>あなたのステータス合計</b>と階層で決まる<br>・宝箱：武器・防具・特殊アイテムが出る。<b>ミミック</b>の罠に注意<br>・ときどき<b>ボス部屋</b>の入口が現れる（行かなくてもよい。倒すと特別な報酬）<br>・手に入れた武器・アイテムは、倒れても持ち帰れる（ソロ専用）</div>' +
                '<div class="sbl-sec">特殊アイテム（武器庫で使う）</div><div style="font-size:.82rem;color:#ffd9a0">' + items + '</div>' +
                '<div class="sbl-sec">記録</div><div style="font-size:.85rem">最深：' + ((hack.corridorBest | 0) ? '地下' + (hack.corridorBest | 0) + '階' : '未挑戦') + '</div>' +
                (un ? '<div style="margin-top:8px"><button class="sbl-btn green" id="sbSolo">潜る（ソロ）</button></div>' : '');
            bindDetail(false);
        }
        function bindDetail(rush) {
            const q = id => detEl.querySelector(id);
            if (rush) detEl.querySelectorAll('[data-rdiff]').forEach(b => b.addEventListener('click', () => { const di = parseInt(b.dataset.rdiff, 10), s = window.getStageById(selId);
                if (!stageUnlocked(s)) return;
                if (diffLocked(s, di)) { alert('エクストリームは、ディメンション・キーパーを「ナイトメア」でクリアすると挑戦できます。'); return; }
                if (SS && !SS.canUseDiff(gateIdx(s, di))) { alert('この難易度は、シーズン' + SS.diffOpenWeek(gateIdx(s, di)) + '週目から解放されます。'); return; }
                selRush = di; hack.lastRushDiff = di; HW.save(hack); renderDetail(); }));
            if (q('#sbSolo')) q('#sbSolo').addEventListener('click', () => launch('solo'));
            if (q('#sbCreate')) q('#sbCreate').addEventListener('click', () => launch('create'));
            if (q('#sbQuick')) q('#sbQuick').addEventListener('click', () => launch('quick'));
            if (q('#sbRefresh')) q('#sbRefresh').addEventListener('click', refreshRooms);
            detEl.querySelectorAll('[data-room]').forEach(b => b.addEventListener('click', () => launch('join', b.dataset.room)));
        }
        function renderDetail() {
            const s = window.getStageById(selId);
            if (s.rush) { renderRush(s); return; }
            if (s.corridor) { renderCorr(s); return; }
            const DIFFS = window.STAGE_DATA.DIFFS;
            const eq = HW.getEquipped(hack);
            detEl.innerHTML =
                '<h3 style="margin:0 0 4px">' + s.icon + ' ' + esc(s.name) + '</h3><div style="font-size:.85rem;color:#b8c4e0">' + esc(s.desc) + '</div>' +
                '<div class="sbl-sec">出現する敵</div><div style="font-size:.85rem">' + s.enemies.map(e => e.icon + ' ' + esc(e.name)).join('　') + '</div>' +
                '<div class="sbl-sec">ボス</div><div style="font-size:.9rem">' + s.boss.icon + ' <b>' + esc(s.boss.name) + '</b></div>' +
                '<div class="sbl-sec">ドロップする武器（敵）</div><div style="font-size:.82rem">' + dropNames(s.drops) + '</div>' +
                '<div class="sbl-sec">ボス専用ドロップ（レア以上確定）</div><div style="font-size:.82rem;color:#ffd84a">' + dropNames(s.bossDrops) + '</div>' +
                '<div class="sbl-sec">難易度</div><div id="sbDiffs">' + DIFFS.map((d, i) => { const lk = SS && !SS.canUseDiff(i); return '<button class="sbl-btn' + (i === selDiff && !lk ? '' : ' gray') + '" data-diff="' + i + '" style="' + (i === selDiff && !lk ? 'background:' + d.color : '') + (lk ? ';opacity:.55' : '') + '">' + (lk ? '🔒 ' : '') + d.name + (lk ? '（' + SS.diffOpenWeek(i) + '週目〜）' : '') + '</button>'; }).join('') + '</div><div style="font-size:.78rem;color:#9fb3d9;margin-top:2px">' + esc(DIFFS[selDiff].note) + '</div>' +
                '<div class="sbl-sec">落ちる素材（グリフ工房の材料）</div><div style="font-size:.8rem;color:#c8f7a0">' + matLine(s) + '</div>' +
                '<div class="sbl-sec">装備中：<span style="color:' + HW.rarityOf(eq).color + '">' + esc(eq.name) + '</span></div>' +
                '<div><button class="sbl-btn green" id="sbSolo">ソロで出発</button><button class="sbl-btn" id="sbCreate">部屋を作って募集</button><button class="sbl-btn orange" id="sbQuick">クイック参加</button></div>' +
                '<div class="sbl-sec">募集中の部屋 <button class="sbl-btn gray" id="sbRefresh" style="padding:3px 8px;font-size:.75rem">更新</button></div>' +
                '<div id="sbRooms">' + (rooms.length ? rooms.filter(r => r.stageId === selId).map(r => '<div class="sbl-room"><span>' + esc(r.members[0] ? r.members[0].name : '?') + ' の部屋 (' + r.members.length + '/' + r.max + ')</span><button class="sbl-btn" data-room="' + r.id + '" style="margin:0">参加</button></div>').join('') || '<div style="font-size:.8rem;color:#889">このステージの募集はありません</div>' : '<div style="font-size:.8rem;color:#889">このステージの募集はありません</div>') + '</div>';
            detEl.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => { const di = parseInt(b.dataset.diff, 10); if (SS && !SS.canUseDiff(di)) { alert('この難易度は、シーズン' + SS.diffOpenWeek(di) + '週目から解放されます。'); return; } selDiff = di; hack.lastDiff = selDiff; HW.save(hack); renderDetail(); }));
            detEl.querySelector('#sbSolo').addEventListener('click', () => launch('solo'));
            detEl.querySelector('#sbCreate').addEventListener('click', () => launch('create'));
            detEl.querySelector('#sbQuick').addEventListener('click', () => launch('quick'));
            detEl.querySelector('#sbRefresh').addEventListener('click', refreshRooms);
            detEl.querySelectorAll('[data-room]').forEach(b => b.addEventListener('click', () => launch('join', b.dataset.room)));
        }
        function launch(mode, roomId) {
            const st = window.getStageById(selId);
            if (!stageUnlocked(st)) { alert(st.unlock.text); return; }
            let useDiff = selDiff;
            if (st.rush) { if (diffLocked(st, selRush)) { alert('エクストリームは、ディメンション・キーパーを「ナイトメア」でクリアすると挑戦できます。'); return; } useDiff = selRush; }
            if (st.corridor) { mode = 'solo'; roomId = null; useDiff = 0; }
            if (SS) { const chk = SS.canEnterStage(st, st.rush ? gateIdx(st, useDiff) : useDiff); if (!chk.ok) { alert(chk.reason); return; } }
            if (typeof window.cancelStudyTimer === 'function') window.cancelStudyTimer();   // 勉強タイマー中なら0に戻す
            try { localStorage.setItem('sbStageLaunch', JSON.stringify({ stageId: selId, mode: mode, roomId: roomId || null, diff: (typeof useDiff === 'number' ? useDiff : selDiff), at: Date.now() })); } catch (e) {}
            location.href = 'stage.html';
        }
        renderList(); renderDetail(); refreshRooms();
    }


    // ============================================================
    // オンラインマッチ（アクション対戦）
    //  ・敵はいない。2〜4人の乱戦で、最後まで立っていた人の勝ち（3分で時間切れ→HP割合）
    //  ・ダメージはステータスに関係なく相手の最大HPの割合。武器・スキル・特殊効果・立ち回りの勝負
    //  ・1人で出発すると、スパーリングボットとの練習になる
    // ============================================================
    function launchPvp(mode, roomId, stageId) {
        if (typeof window.cancelStudyTimer === 'function') window.cancelStudyTimer();   // 勉強タイマー中なら0に戻す
        try { localStorage.setItem('sbStageLaunch', JSON.stringify({ stageId: stageId || 'pvp_arena', mode: mode, roomId: roomId || null, diff: 0, at: Date.now() })); } catch (e) {}
        location.href = 'stage.html';
    }
    function openPvpArena() {
        bmEvent('pvp');
        if (!window.STAGE_DATA || !window.HW) { alert('データの読み込みに失敗しました'); return; }
        let rooms = [], evRank = null;
        const sock = getSock();
        const onRooms = list => { rooms = (list || []).filter(r => String(r.stageId || '').indexOf('pvp_') === 0); draw(); };   // 乱戦・2v2・3v3 の部屋をまとめて表示
        const onRank = d => { if (SBPvpEvent && d && String(d.seasonId) === String(SBPvpEvent.seasonId())) { evRank = d; draw(); } };
        const m = modal('⚔ オンラインマッチ（アクション対戦）', () => { if (sock) { sock.off('stage:rooms', onRooms); sock.off('pvpEvent:rankingData', onRank); } });
        if (sock) { sock.on('stage:rooms', onRooms); sock.on('pvpEvent:rankingData', onRank); sock.on('connect', refresh); }
        function refresh() {
            if (sock && sock.connected) {
                sock.emit('stage:list', {});
                if (window.SBPvpEvent && SBPvpEvent.open()) { SBPvpEvent.report(sock); const p = getPlayerData(); sock.emit('pvpEvent:ranking', { seasonId: SBPvpEvent.seasonId(), id: p && p.id }); }
            }
        }
        // ---- シーズン5週目〜のPvPイベント ----
        function addCoinsEv(v) { const p = getPlayerData(); if (!p) return; p.coins = (p.coins || 0) + v; localStorage.setItem('player', JSON.stringify(p)); }
        function eventHtml() {
            const EV = window.SBPvpEvent; if (!EV) return '';
            const st = EV.seasonState(), W = (window.SeasonSys && SeasonSys.SCHEDULE && SeasonSys.SCHEDULE.pvpWeek) || 5;
            const box = (inner, bd) => '<div style="margin:8px 0;padding:8px 10px;border:1px solid ' + (bd || '#5a4a8a') + ';border-radius:8px;background:rgba(80,50,140,.18);font-size:.85rem;line-height:1.6">' + inner + '</div>';
            if (!st) return box('⚔ <b>PvPイベント</b>は、<b>シーズンキャラ専用</b>です。シーズンの' + W + '週目から開催されます。');
            if (!EV.open()) {
                if (st.ended) return box('⚔ <b>PvPイベント</b>：シーズンは終了しました。');
                const days = Math.max(0, Math.ceil((new Date(st.def.start).getTime() + (W - 1) * 7 * 86400000 - SeasonSys.now()) / 86400000));
                return box('⚔ <b>PvPイベント</b>：シーズン' + W + '週目から開催！（あと約 ' + days + ' 日）<br>オンラインマッチで勝つほど、豪華な報酬がもらえます。');
            }
            const r = EV.rec();
            let h = '<b style="color:#ffd36a">⚔ PvPイベント開催中！</b>　勝利 +' + EV.EP_WIN + 'EP ／ 負け +' + EV.EP_LOSE + 'EP（2人以上のオンラインマッチのみ。ボット練習はEPなし）<br>' +
                'あなたのEP：<b style="color:#ffd84a;font-size:1.05rem">' + r.pts + '</b>　（' + r.plays + '戦 ' + r.wins + '勝）';
            h += '<div class="sbl-sec">報酬</div>' + EV.MILESTONES.map((mm, i) => {
                const got = !!r.claimed[i], can = !got && r.pts >= mm.ep;
                return '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid #2a3350"><span style="' + (got ? 'color:#778' : '') + '">' + mm.ep + 'EP：' + esc(mm.label) + '</span>' +
                    (got ? '<span style="color:#7aff9a">受取済</span>' : (can ? '<button class="sbl-btn orange" data-claim="' + i + '" style="padding:2px 8px;font-size:.75rem">受け取る</button>' : '<span style="color:#778">あと' + (mm.ep - r.pts) + 'EP</span>')) + '</div>';
            }).join('');
            h += '<div class="sbl-sec">ランキング（EP）</div>';
            if (evRank && evRank.top) {
                h += (evRank.me ? '<div>あなた：<b>' + evRank.me.rank + '位</b>（' + evRank.me.pts + 'EP）／ 参加 ' + evRank.total + '人</div>' : '<div style="color:#9fb3d9">まだランキングに載っていません（1戦すると載ります）</div>') +
                    evRank.top.slice(0, 10).map(x => '<div style="display:flex;justify-content:space-between;font-size:.8rem"><span>' + x.rank + '位　' + esc(x.name) + '</span><span>' + x.pts + 'EP（' + x.wins + '勝）</span></div>').join('');
            } else h += '<div style="color:#9fb3d9">' + (sock && sock.connected ? '読み込み中…' : 'サーバーに接続すると表示されます') + '</div>';
            return box(h, '#8a6adf');
        }
        function draw() {
            const p = (typeof getPlayerData === 'function') ? getPlayerData() : null;
            m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%">' +
                '<div style="font-size:.9rem;color:#cfe0ff;line-height:1.6">いまの武器とスキルで戦う、リアルタイムの対人戦です。<br>' +
                '・2〜4人の乱戦。<b>最後まで立っていた人の勝ち</b>（制限時間3分、切れたらHPの割合で判定）<br>' +
                '・ダメージは<b>ステータスに関係なく、相手の最大HPの割合</b>で決まります。武器の種類・スキル・特殊効果・立ち回りの勝負！<br>' +
                '・勝てばコイン+400、負けても+120。1人で出発するとボット練習になります。</div>' +
                '<div style="margin:8px 0;font-size:.85rem;color:#ffd36a">通算勝利：' + ((p && p.pvpWins) || 0) + '勝</div>' + eventHtml() +
                '<div><button class="sbl-btn orange" id="pvQuick">ランダムマッチ</button><button class="sbl-btn" id="pvCreate">部屋を作る</button>' +
                '<button class="sbl-btn gray" id="pvCode">部屋コードで参加</button><button class="sbl-btn gray" id="pvBot">ボットと練習</button></div>' +
                '<div class="sbl-sec">チーム戦（2v2・3v3）</div>' +
                '<div style="font-size:.8rem;color:#9fb3d9;line-height:1.5;margin-bottom:4px">参加した順に 🔵青・🔴赤 へ交互に振り分けられます。味方には攻撃が当たらず、<b>相手チームを全員倒したら勝ち</b>。人数が足りなくてもホストが出発できます（1人だとボット練習）。</div>' +
                '<div><button class="sbl-btn orange" data-team="pvp_2v2:quick">2v2 ランダム</button><button class="sbl-btn" data-team="pvp_2v2:create">2v2 部屋を作る</button>' +
                '<button class="sbl-btn orange" data-team="pvp_3v3:quick">3v3 ランダム</button><button class="sbl-btn" data-team="pvp_3v3:create">3v3 部屋を作る</button></div>' +
                '<div class="sbl-sec">募集中の部屋</div>' +
                (rooms.length ? rooms.map(r => '<div class="sbl-card" style="display:flex;justify-content:space-between;align-items:center"><span>[' + ({ pvp_2v2: '2v2', pvp_3v3: '3v3' }[r.stageId] || '乱戦') + '] ' + esc(r.members.map(x => x.name).join('、')) + '　(' + r.members.length + '/' + r.max + ')</span><button class="sbl-btn" data-room="' + esc(r.id) + '" data-stage="' + esc(r.stageId) + '">参加</button></div>').join('') : '<div style="opacity:.7;font-size:.85rem">いまは募集中の部屋はありません。</div>') +
                '</div>';
            m.body.querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', () => {
                const lines = SBPvpEvent.claim(parseInt(b.dataset.claim, 10), addCoinsEv);
                if (lines) { alert('PvPイベントの報酬を受け取りました！\n\n' + lines.join('\n')); try { refreshInvInfo(); } catch (e) {} draw(); }
            }));
            m.body.querySelector('#pvQuick').addEventListener('click', () => launchPvp('quick'));
            m.body.querySelector('#pvCreate').addEventListener('click', () => launchPvp('create'));
            m.body.querySelector('#pvBot').addEventListener('click', () => launchPvp('solo'));
            m.body.querySelector('#pvCode').addEventListener('click', () => { const c = (prompt('部屋コード（4文字）を入力してください') || '').trim().toUpperCase(); if (!c) return; const r = rooms.find(x => String(x.id).toUpperCase() === c); launchPvp('join', c, r ? r.stageId : 'pvp_arena'); });   // 部屋の種類（乱戦・2v2・3v3）は一覧から調べる
            m.body.querySelectorAll('[data-team]').forEach(b => b.addEventListener('click', () => { const t = b.dataset.team.split(':'); launchPvp(t[1], null, t[0]); }));
            m.body.querySelectorAll('[data-room]').forEach(b => b.addEventListener('click', () => launchPvp('join', b.dataset.room, b.dataset.stage || 'pvp_arena')));
        }
        draw(); refresh();
    }
    window.openPvpArena = openPvpArena;

    // これまでのオンラインマッチのボタン（ランダム／ルーム作成／ルーム参加／ボット戦）は、アクション対戦につなぎ直す
    document.addEventListener('click', function (e) {
        const b = e.target && e.target.closest && e.target.closest('#randomMatch, #createRoom, #joinRoom, #botMatch, #practiceBotMatch, #pvpBtn');
        if (!b) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (b.id === 'randomMatch') launchPvp('quick');
        else if (b.id === 'createRoom') launchPvp('create');
        else if (b.id === 'joinRoom') { const c = (prompt('部屋コード（4文字）を入力してください') || '').trim().toUpperCase(); if (c) launchPvp('join', c); }
        else if (b.id === 'botMatch' || b.id === 'practiceBotMatch') launchPvp('solo');
        else openPvpArena();
    }, true);

    // ============================================================
    // 武器庫（装備・ソケット・売却）
    // ============================================================
    // ---------- 特殊アイテム（無限回廊の宝箱・ボス部屋で手に入る）の使用パネル ----------
    //  武器：スロット拡張／レア度上昇／効果リロール　防具：効果リロール
    function itemPanelHtml(hack, kinds, target, isWeapon) {
        const can = { slot: isWeapon && HW.canAddSocket(target), rarity: isWeapon && HW.canUpgradeRarity(target), reroll: !!(target && target.effects && target.effects.length) };
        const why = { slot: '最大スロットです', rarity: 'すでに最高レア度です', reroll: '追加効果がありません' };
        return '<div class="sbl-sec">特殊アイテム（無限回廊で入手）</div>' + kinds.map(k => {
            const it = HW.SPECIAL_ITEMS[k], n = HW.itemCount(hack, k), ok = can[k] && n > 0;
            return '<div style="display:flex;gap:6px;align-items:center;margin:3px 0"><button class="sbl-btn" data-item="' + k + '" style="margin:0;' + (ok ? 'background:' + it.color + ';color:#000' : 'opacity:.5') + '"' + (ok ? '' : ' disabled') + '>' + it.icon + ' ' + it.name + '×' + n + '</button><span style="font-size:.74rem;color:#9fb3d9">' + esc(can[k] ? it.desc : why[k]) + '</span></div>';
        }).join('');
    }
    function applyItem(hack, kind, target, isWeapon) {
        if (HW.itemCount(hack, kind) < 1) return false;
        let ok = false;
        if (kind === 'slot') ok = isWeapon && HW.addSocket(target);
        else if (kind === 'rarity') ok = isWeapon && HW.upgradeRarity(target);
        else if (kind === 'reroll') ok = isWeapon ? HW.rerollWeaponEffects(target) : (window.SBArmor && SBArmor.rerollEffects(target));
        if (ok) HW.takeItem(hack, kind);
        return !!ok;
    }
    function orbLabel(o) {
        let name = o.tier || 'orb';
        try { if (typeof getOrbDisplayName === 'function') name = getOrbDisplayName(o); } catch (e) {}
        return String(name);
    }
    function openArmory() {
        bmEvent('armory');
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
                '<button class="sbl-btn gray" id="sbBulk" style="padding:4px 8px;font-size:.75rem">🗑 一括売却</button>' +
                '<button class="sbl-btn orange" id="sbForge" style="padding:4px 8px;font-size:.75rem">🔨 オリジナル武器を作る</button>' +
                '<button class="sbl-btn green" id="sbArmorBtn" style="padding:4px 8px;font-size:.75rem">🛡 防具（頭・胴・脚）</button>' +
                sorted().map(w => '<div class="sbl-wl' + (w.id === selId ? ' sel' : '') + (w.id === hack.equipped ? ' eq' : '') + '" data-id="' + w.id + '"><span style="color:' + HW.rarityOf(w).color + '">' + (w.id === hack.equipped ? '【装備中】' : '') + esc(w.name) + (w.elems && w.elems.length && window.SBElem ? ' ' + SBElem.ELEMS[w.elems[0]].icon + (w.elems.length > 1 ? SBElem.ELEMS[w.elems[1]].icon : '') : '') + '</span><span style="color:#9fb3d9">' + (w.locked ? '🔒 ' : '') + '攻' + HW.pctLabel(w) + ' 穴' + w.sockets + '</span></div>').join('');
            wl.querySelector('#sbFilter').value = filter;
            wl.querySelector('#sbFilter').addEventListener('change', (e) => { filter = e.target.value; renderList(); });
            wl.querySelectorAll('.sbl-wl').forEach(r => r.addEventListener('click', () => { selId = r.dataset.id; renderList(); renderDetail(); }));
            wl.querySelector('#sbBulk').addEventListener('click', openBulk);
            wl.querySelector('#sbForge').addEventListener('click', openForge);
            const ab = wl.querySelector('#sbArmorBtn'); if (ab) ab.addEventListener('click', openArmor);
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
                '<div style="font-size:.82rem;color:#9fb3d9">[' + R.label + '] ' + esc(T.label || w.type) + '　Lv' + w.ilvl + '　攻撃力 ' + HW.pctLabel(w) + (w.custom ? '　★オリジナル' : '') + '</div>' +
                (T.sup ? '<div style="font-size:.78rem;color:#9fe0a0">🩹 支援武器：' + ({ all: '攻撃すると、自分と近くの味方を回復＆鼓舞（攻撃・防御アップ）し、当てた敵を弱体化・減速させて受けるダメージを増やす' }[T.sup] || '') + '</div>' : '') +
                (w.elems && w.elems.length && window.SBElem ? '<div class="sbl-sec">属性</div><div style="font-size:.82rem">' + SBElem.labels(w.elems) + '</div><div style="font-size:.76rem">' + SBElem.styleHtml(w.elems) + '</div>' : '<div style="font-size:.76rem;color:#778">無属性</div>') +
                '<div class="sbl-sec">特殊効果</div>' + (w.effects.length ? w.effects.map(f => '<div class="sbl-fx">◆ ' + esc(HW.describeEffect(f)) + '</div>').join('') : '<div class="sbl-fx" style="color:#778">なし</div>') +
                '<div class="sbl-sec">ソケット（オーブをはめ込む）</div><div>' + slots.join('') + '</div>' +
                (w.orbs.some(Boolean) ? '<div class="sbl-sec">オーブの効果</div>' + w.orbs.map(o => o ? HW.orbToEffects(o).lines.map(l => '<div class="sbl-fx" style="color:#9fe0ff">💎 ' + esc(l) + '</div>').join('') : '').join('') : '') +
                '<div style="margin-top:8px"><button class="sbl-btn green" id="sbEq"' + (w.id === hack.equipped ? ' disabled' : '') + '>装備する</button>' +
                '<button class="sbl-btn red" id="sbSell"' + (w.id === hack.equipped || w.locked ? ' disabled' : '') + '>売却 (' + HW.sellValue(w) + ')</button>' +
                '<button class="sbl-btn gray" id="sbLock">' + (w.locked ? '🔓 ロック解除' : '🔒 ロック') + '</button></div>' +
                '<div class="sbl-note" style="font-size:.74rem;color:#8a97b8;margin-top:3px">ロックした武器は、一括売却の対象になりません。</div>' +
                (w.custom ? '<div class="sbl-sec">名前を変更（オリジナル武器は、いつでも無料で変えられます）</div><div style="display:flex;gap:4px"><input id="sbRnName" type="text" maxlength="' + HW.FORGE_NAME_MAX + '" value="' + esc(w.name) + '" style="flex:1;min-width:0;padding:5px;box-sizing:border-box"><button class="sbl-btn orange" id="sbRnGo">変更</button></div><div id="sbRnMsg" style="font-size:.8rem;color:#ff9a9a;margin-top:3px"></div>' +
                    '<div class="sbl-sec">武器種を変更（作成費用の1/4：' + HW.typeChangeCost(w).toLocaleString() + ' コイン）</div><div style="display:flex;gap:4px"><select id="sbTyType" style="flex:1;min-width:0;padding:5px">' + HW.availableTypes(hack).map(t => '<option value="' + t + '"' + (t === w.type ? ' selected' : '') + '>' + esc(HW.TYPES[t].label) + '</option>').join('') + '</select><button class="sbl-btn orange" id="sbTyGo">変更する</button></div><div id="sbTyMsg" style="font-size:.8rem;color:#ff9a9a;margin-top:3px"></div>' : '') +
                itemPanelHtml(hack, ['slot', 'rarity', 'reroll'], w, true) +
                '<div id="sbOrbPick"></div>';
            wd.querySelectorAll('[data-item]').forEach(b => b.addEventListener('click', () => {
                const k = b.dataset.item, it = HW.SPECIAL_ITEMS[k];
                if (k === 'reroll' && !confirm('「' + w.name + '」の特殊効果をすべて振り直します。いまの効果は失われます。よろしいですか？')) return;
                if (k === 'rarity' && !confirm('「' + w.name + '」のレア度を1段階上げます。よろしいですか？')) return;
                if (applyItem(hack, k, w, true)) { HW.save(hack); refreshInvInfo(); renderList(); renderDetail(); } else alert(it.name + 'は、この武器には使えません。');
            }));
            if (w.custom) wd.querySelector('#sbTyGo').addEventListener('click', () => {
                const msg = wd.querySelector('#sbTyMsg'), nt = wd.querySelector('#sbTyType').value;
                if (!nt || !HW.TYPES[nt]) { msg.textContent = '武器種を選んでください。'; return; }
                if (nt === w.type) { msg.textContent = 'いまと同じ武器種です。'; return; }
                const cost = HW.typeChangeCost(w);
                if (coins() < cost) { msg.textContent = 'コインが足りません。'; return; }
                if (!confirm(HW.TYPES[w.type].label + ' → ' + HW.TYPES[nt].label + ' に変更します（' + cost.toLocaleString() + ' コイン）。よろしいですか？')) return;
                if (!HW.changeType(hack, w, nt)) { msg.textContent = 'この武器種には変更できません。'; return; }
                addCoins(-cost); HW.save(hack); refreshInvInfo(); renderList(); renderDetail();
            });
            if (w.custom) wd.querySelector('#sbRnGo').addEventListener('click', () => {
                const msg = wd.querySelector('#sbRnMsg'), clean = HW.cleanName(wd.querySelector('#sbRnName').value);
                if (!clean) { msg.textContent = '名前を入力してください。'; return; }
                const v = (typeof validateName === 'function') ? validateName(clean) : { valid: true };
                if (!v.valid) { msg.textContent = v.reason; return; }
                w.name = clean; w.baseName = clean; HW.save(hack); renderList(); renderDetail();
            });
            wd.querySelector('#sbLock').addEventListener('click', () => { w.locked = !w.locked; HW.save(hack); renderList(); renderDetail(); });
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

        // ---------- 一括売却 ----------
        function openBulk() {
            const pick = { normal: true, magic: true, rare: false, epic: false, legendary: false };
            let inclSock = false, inclCustom = false;
            function draw() {
                const rarities = HW.RARITY_ORDER.filter(k => pick[k]);
                const targets = HW.bulkTargets(hack, { rarities: rarities, includeSocketed: inclSock, includeCustom: inclCustom });
                const total = targets.reduce((a, w) => a + HW.sellValue(w), 0);
                const count = k => hack.weapons.filter(w => w.rarity === k && w.id !== hack.equipped && !w.locked).length;
                wd.innerHTML = '<h3 style="margin:0">🗑 一括売却</h3><div style="font-size:.82rem;color:#9fb3d9">売りたいレア度にチェックを入れてください。装備中・ロック中の武器は売られません。</div>' +
                    '<div class="sbl-sec">売るレア度</div>' +
                    HW.RARITY_ORDER.map(k => '<label style="display:block;margin:2px 0;color:' + HW.RARITIES[k].color + '"><input type="checkbox" data-r="' + k + '"' + (pick[k] ? ' checked' : '') + '> ' + HW.RARITIES[k].label + '（' + count(k) + '本）</label>').join('') +
                    '<div class="sbl-sec">オプション</div>' +
                    '<label style="display:block;margin:2px 0"><input type="checkbox" id="sbIncSock"' + (inclSock ? ' checked' : '') + '> オーブをはめた武器も売る（オーブは戻ります）</label>' +
                    '<label style="display:block;margin:2px 0"><input type="checkbox" id="sbIncCustom"' + (inclCustom ? ' checked' : '') + '> オリジナル武器も売る</label>' +
                    '<div style="margin:10px 0;font-size:1rem"><b>' + targets.length + '本</b> を売却 → <b style="color:#ffd84a">' + total + ' コイン</b></div>' +
                    '<button class="sbl-btn red" id="sbBulkGo"' + (targets.length ? '' : ' disabled') + '>売却する</button><button class="sbl-btn gray" id="sbBulkCancel">やめる</button>';
                wd.querySelectorAll('[data-r]').forEach(c => c.addEventListener('change', () => { pick[c.dataset.r] = c.checked; draw(); }));
                wd.querySelector('#sbIncSock').addEventListener('change', e => { inclSock = e.target.checked; draw(); });
                wd.querySelector('#sbIncCustom').addEventListener('change', e => { inclCustom = e.target.checked; draw(); });
                wd.querySelector('#sbBulkCancel').addEventListener('click', () => renderDetail());
                wd.querySelector('#sbBulkGo').addEventListener('click', () => {
                    const hi = targets.filter(w => w.rarity === 'epic' || w.rarity === 'legendary').length;
                    if (!confirm(targets.length + '本を売却して ' + total + ' コインを得ます。' + (hi ? '\n※エピック／レジェンドが ' + hi + '本 含まれています！' : '') + '\nよろしいですか？')) return;
                    const r = HW.bulkSell(hack, { rarities: rarities, includeSocketed: inclSock, includeCustom: inclCustom });
                    addCoins(r.coins); HW.save(hack); selId = hack.equipped;
                    renderList(); renderDetail();
                });
            }
            draw();
        }

        // ---------- オリジナル武器（コイン鍛冶）----------
        function openForge() {
            const types = HW.availableTypes(hack);
            let type = types.indexOf('sword') >= 0 ? 'sword' : types[0], rarity = 'normal', name = '', els = [];
            function draw() {
                const have = coins();
                const rars = HW.RARITY_ORDER.map(k => { const R = HW.RARITIES[k]; const c = HW.forgeCost(k, els.length); return { k: k, R: R, c: c, ok: have >= c }; });
                wd.innerHTML = '<h3 style="margin:0">🔨 オリジナル武器を作る</h3>' +
                    '<div style="font-size:.82rem;color:#9fb3d9">コインを多く使うほどレア度が上がります。名前は自由に決められます。攻撃力の上昇％はレア度で決まり、特殊効果とソケットはランダムです。</div>' +
                    '<div class="sbl-sec">所持コイン：' + have.toLocaleString() + '</div>' +
                    '<div class="sbl-sec">武器の種類</div><select id="sbFgType" style="padding:4px;max-width:100%">' + types.map(t => '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' + esc(HW.TYPES[t].label) + '</option>').join('') + '</select>' +
                    '<div class="sbl-sec">名前（' + HW.FORGE_NAME_MAX + '文字まで）</div><input id="sbFgName" type="text" maxlength="' + HW.FORGE_NAME_MAX + '" placeholder="例：勇者の剣" value="' + esc(name) + '" style="width:100%;box-sizing:border-box;padding:6px;border-radius:6px;border:1px solid #445;background:#0f1530;color:#fff">' +
                    '<div class="sbl-sec">属性（任意・最大2つ。1つで+25%、2つで+70%のコイン）</div><div id="sbFgEl" style="display:flex;flex-wrap:wrap;gap:4px">' + (window.SBElem ? SBElem.ORDER.map(id => { const m = SBElem.ELEMS[id], on = els.indexOf(id) >= 0; return '<button type="button" data-el="' + id + '" style="padding:3px 7px;border-radius:12px;border:1px solid ' + (on ? m.color : '#3a4670') + ';background:' + (on ? '#26335f' : '#171f3e') + ';color:' + m.color + ';font-size:.78rem;cursor:pointer">' + m.icon + m.name + '</button>'; }).join('') : '') + '</div>' + (els.length && window.SBElem ? '<div style="font-size:.76rem;margin-top:3px">' + SBElem.styleHtml(els) + '</div>' : '') +
                    '<div class="sbl-sec">レア度（使うコイン）</div>' +
                    rars.map(r => '<label style="display:block;margin:3px 0;padding:4px 6px;border-radius:6px;background:' + (r.k === rarity ? '#26335f' : '#171f3e') + ';opacity:' + (r.ok ? 1 : .5) + ';color:' + r.R.color + '"><input type="radio" name="sbFgR" value="' + r.k + '"' + (r.k === rarity ? ' checked' : '') + (r.ok ? '' : ' disabled') + '> ' + r.R.label + '　<b>' + r.c.toLocaleString() + ' コイン</b>　<small style="color:#9fb3d9">攻撃力 約＋' + Math.round(r.R.orig * 100) + '%・ソケット' + r.R.sockets[0] + '〜' + r.R.sockets[1] + '・効果' + r.R.fx[0] + '〜' + r.R.fx[1] + '</small></label>').join('') +
                    '<div style="margin-top:8px"><button class="sbl-btn orange" id="sbFgGo">' + HW.RARITIES[rarity].label + 'で作る（' + HW.forgeCost(rarity, els.length).toLocaleString() + ' コイン）</button><button class="sbl-btn gray" id="sbFgCancel">やめる</button></div>' +
                    '<div id="sbFgMsg" style="font-size:.82rem;color:#ff9a9a;margin-top:4px"></div>';
                wd.querySelector('#sbFgType').addEventListener('change', e => { type = e.target.value; name = wd.querySelector('#sbFgName').value; draw(); });
                wd.querySelector('#sbFgName').addEventListener('input', e => { name = e.target.value; });
                wd.querySelectorAll('[name=sbFgR]').forEach(r => r.addEventListener('change', () => { name = wd.querySelector('#sbFgName').value; rarity = r.value; draw(); }));
                wd.querySelectorAll('#sbFgEl [data-el]').forEach(b => b.addEventListener('click', () => {
                    name = wd.querySelector('#sbFgName').value; const id = b.dataset.el, i = els.indexOf(id);
                    if (i >= 0) els.splice(i, 1); else if (els.length < 2) els.push(id); else { els.shift(); els.push(id); }
                    draw();
                }));
                wd.querySelector('#sbFgCancel').addEventListener('click', () => renderDetail());
                wd.querySelector('#sbFgGo').addEventListener('click', () => {
                    const msg = wd.querySelector('#sbFgMsg'); name = wd.querySelector('#sbFgName').value;
                    const clean = HW.cleanName(name);
                    if (clean) { const v = (typeof validateName === 'function') ? validateName(clean) : { valid: true }; if (!v.valid) { msg.textContent = v.reason; return; } }
                    const cost = HW.forgeCost(rarity, els.length);
                    if (coins() < cost) { msg.textContent = 'コインが足りません。'; return; }
                    if (hack.weapons.length >= HW.STORAGE_LIMIT) { msg.textContent = '武器庫がいっぱいです。不要な武器を売却してください。'; return; }
                    if (!confirm((clean || 'オリジナル' + HW.TYPES[type].label) + '（' + HW.RARITIES[rarity].label + (els.length && window.SBElem ? '・' + SBElem.labels(els) : '') + '）を ' + cost.toLocaleString() + ' コインで作ります。よろしいですか？')) return;
                    const w = HW.forgeOriginal(hack, { type: type, rarity: rarity, name: clean, elems: els.slice() });
                    if (!w) { msg.textContent = 'この武器種は、まだ作れません。'; return; }
                    addCoins(-cost);
                    hack.weapons.push(w); HW.save(hack); selId = w.id;
                    renderList(); renderDetail();
                });
            }
            draw();
        }
        renderList(); renderDetail();
    }

    // ---------- 第二世界の解放通知（町に戻ったとき1回だけ）----------
    // ============================================================
    // 防具（頭・胴・脚）
    // ============================================================
    function openArmor() {
        if (!window.HW || !window.SBArmor) return;
        const hack = HW.load(); SBArmor.ensure(hack);
        let selId = null, slotF = 'all';
        const m = modal('🛡 防具（頭・胴・脚）', () => { try { refreshInvInfo(); if (typeof updateStatus === 'function') updateStatus(getPlayerData()); } catch (e) {} });
        m.body.innerHTML = '<div class="sbl-col sbl-left" id="arL"></div><div class="sbl-col sbl-right" id="arR"></div>';
        const L = m.body.querySelector('#arL'), R = m.body.querySelector('#arR');
        const addCoins = v => { const p = getPlayerData(); if (!p) return; p.coins = (p.coins || 0) + v; localStorage.setItem('player', JSON.stringify(p)); };
        const eqId = a => hack.armorEq[a.slot] === a.id;
        function renderList() {
            const eq = SBArmor.equipped(hack);
            const arr = hack.armors.filter(a => slotF === 'all' || a.slot === slotF).sort((a, b) => HW.RARITY_ORDER.indexOf(b.rarity) - HW.RARITY_ORDER.indexOf(a.rarity) || b.ilvl - a.ilvl);
            L.innerHTML = '<div class="sbl-sec">装備中</div>' + SBArmor.SLOT_ORDER.map(sl => { const a = eq[sl]; return '<div style="font-size:.8rem;padding:2px 0">' + SBArmor.SLOTS[sl].icon + ' ' + SBArmor.SLOTS[sl].label + '：' + (a ? '<span style="color:' + HW.rarityOf(a).color + '">' + esc(a.name) + '</span>' : '<span style="color:#778">なし</span>') + '</div>'; }).join('') +
                '<div class="sbl-sec">所持防具 ' + hack.armors.length + ' 個 <button class="sbl-btn gray" id="arBulk" style="padding:3px 8px;font-size:.75rem;margin-left:6px">🗑 一括売却</button></div>' +
                '<select id="arF" style="margin-bottom:6px;padding:4px"><option value="all">すべて</option>' + SBArmor.SLOT_ORDER.map(sl => '<option value="' + sl + '"' + (slotF === sl ? ' selected' : '') + '>' + SBArmor.SLOTS[sl].label + '</option>').join('') + '</select>' +
                (arr.length ? arr.map(a => '<div class="sbl-wl' + (a.id === selId ? ' sel' : '') + (eqId(a) ? ' eq' : '') + '" data-id="' + a.id + '"><span style="color:' + HW.rarityOf(a).color + '">' + (eqId(a) ? '【装備中】' : '') + SBArmor.SLOTS[a.slot].icon + ' ' + esc(a.name) + '</span><span style="color:#9fb3d9">Lv' + a.ilvl + (a.locked ? ' 🔒' : '') + '</span></div>').join('') : '<div style="color:#889;font-size:.8rem">防具はステージの敵・ボスがドロップします</div>');
            L.querySelector('#arF').addEventListener('change', e => { slotF = e.target.value; renderList(); });
            L.querySelector('#arBulk').addEventListener('click', openArmorBulk);
            L.querySelectorAll('.sbl-wl').forEach(r => r.addEventListener('click', () => { selId = r.dataset.id; renderList(); renderDetail(); }));
        }
        function renderDetail() {
            const a = hack.armors.find(x => x.id === selId);
            if (!a) { const t = SBArmor.summaryLines(hack); R.innerHTML = '<div class="sbl-sec">装備による効果の合計</div>' + (t.length ? t.map(l => '<div class="sbl-fx">◆ ' + esc(l) + '</div>').join('') : '<div style="color:#889">防具を選んでください</div>'); return; }
            const Rr = HW.rarityOf(a);
            R.innerHTML = '<h3 style="margin:0;color:' + Rr.color + '">' + esc(a.name) + '</h3>' +
                '<div style="font-size:.82rem;color:#9fb3d9">[' + Rr.label + '] ' + SBArmor.SLOTS[a.slot].label + '　Lv' + a.ilvl + '</div>' +
                '<div class="sbl-sec">基本性能</div>' + SBArmor.statLines(a).filter(Boolean).map(l => '<div class="sbl-fx">◆ ' + esc(l) + '</div>').join('') +
                '<div class="sbl-sec">特殊効果</div>' + (a.effects.length ? a.effects.map(f => '<div class="sbl-fx">◆ ' + esc(SBArmor.describeEffect(f)) + '</div>').join('') : '<div class="sbl-fx" style="color:#778">なし</div>') +
                itemPanelHtml(hack, ['reroll'], a, false) +
                '<div style="margin-top:8px"><button class="sbl-btn green" id="arEq">' + (eqId(a) ? '外す' : '装備する') + '</button>' +
                '<button class="sbl-btn red" id="arSell"' + (eqId(a) || a.locked ? ' disabled' : '') + '>売却 (' + SBArmor.sellValue(a) + ')</button>' +
                '<button class="sbl-btn gray" id="arLock">' + (a.locked ? '🔓 ロック解除' : '🔒 ロック') + '</button></div>';
            R.querySelectorAll('[data-item]').forEach(b => b.addEventListener('click', () => {
                if (!confirm('「' + a.name + '」の特殊効果をすべて振り直します。いまの効果は失われます。よろしいですか？')) return;
                if (applyItem(hack, 'reroll', a, false)) { HW.save(hack); renderList(); renderDetail(); } else alert('この防具には使えません。');
            }));
            R.querySelector('#arEq').addEventListener('click', () => { if (eqId(a)) SBArmor.unequip(hack, a.slot); else SBArmor.equip(hack, a.id); HW.save(hack); renderList(); renderDetail(); });
            R.querySelector('#arLock').addEventListener('click', () => { a.locked = !a.locked; HW.save(hack); renderList(); renderDetail(); });
            R.querySelector('#arSell').addEventListener('click', () => {
                if (!confirm(a.name + ' を売却しますか？')) return;
                const v = SBArmor.sell(hack, a.id); if (v > 0) { addCoins(v); HW.save(hack); selId = null; renderList(); renderDetail(); }
            });
        }
        // ---------- 防具の一括売却 ----------
        function openArmorBulk() {
            const pick = { normal: true, magic: true, rare: false, epic: false, legendary: false };
            const slotPick = { head: true, body: true, legs: true };
            function draw() {
                const o = { rarities: HW.RARITY_ORDER.filter(k => pick[k]), slots: SBArmor.SLOT_ORDER.filter(s => slotPick[s]) };
                const targets = SBArmor.bulkTargets(hack, o), total = targets.reduce((a, x) => a + SBArmor.sellValue(x), 0);
                const count = k => hack.armors.filter(a => a.rarity === k && slotPick[a.slot] && !a.locked && hack.armorEq[a.slot] !== a.id).length;
                R.innerHTML = '<h3 style="margin:0">🗑 防具の一括売却</h3><div style="font-size:.82rem;color:#9fb3d9">売りたいレア度と部位にチェックを入れてください。装備中・ロック中の防具は売られません。</div>' +
                    '<div class="sbl-sec">売るレア度</div>' + HW.RARITY_ORDER.map(k => '<label style="display:block;margin:2px 0;color:' + HW.RARITIES[k].color + '"><input type="checkbox" data-r="' + k + '"' + (pick[k] ? ' checked' : '') + '> ' + HW.RARITIES[k].label + '（' + count(k) + '個）</label>').join('') +
                    '<div class="sbl-sec">売る部位</div>' + SBArmor.SLOT_ORDER.map(s => '<label style="margin-right:10px"><input type="checkbox" data-s="' + s + '"' + (slotPick[s] ? ' checked' : '') + '> ' + SBArmor.SLOTS[s].icon + SBArmor.SLOTS[s].label + '</label>').join('') +
                    '<div style="margin:10px 0;font-size:1rem"><b>' + targets.length + '個</b> を売却 → <b style="color:#ffd84a">' + total + ' コイン</b></div>' +
                    '<button class="sbl-btn red" id="arBulkGo"' + (targets.length ? '' : ' disabled') + '>売却する</button><button class="sbl-btn gray" id="arBulkCancel">やめる</button>';
                R.querySelectorAll('[data-r]').forEach(c => c.addEventListener('change', () => { pick[c.dataset.r] = c.checked; draw(); }));
                R.querySelectorAll('[data-s]').forEach(c => c.addEventListener('change', () => { slotPick[c.dataset.s] = c.checked; draw(); }));
                R.querySelector('#arBulkCancel').addEventListener('click', () => renderDetail());
                R.querySelector('#arBulkGo').addEventListener('click', () => {
                    const hi = targets.filter(x => x.rarity === 'epic' || x.rarity === 'legendary').length;
                    if (!confirm(targets.length + '個を売却して ' + total + ' コインを得ます。' + (hi ? '\n※エピック／レジェンドが ' + hi + '個 含まれています！' : '') + '\nよろしいですか？')) return;
                    const r = SBArmor.bulkSell(hack, o);
                    addCoins(r.coins); HW.save(hack); selId = null; renderList(); renderDetail();
                });
            }
            draw();
        }
        renderList(); renderDetail();
    }

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
        if (w) { el.textContent = w.name + '（' + HW.rarityOf(w).label + '・攻撃' + HW.pctLabel(w) + '）'; el.style.color = HW.rarityOf(w).color; }
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
