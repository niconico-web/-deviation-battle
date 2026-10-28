// ============================================================
// nation-ui.js ― サバイバルエリアの「国」の管理画面（建国・国政・外交・護衛・建築・店）
//  計算も保存もすべてサーバー（NationManager）。ここは画面を出して、操作を送るだけ。
//  コインは市場と同じく端末が正本：サーバーが OK を返してから、端末のコインを引く
// ============================================================
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString('ja-JP');
    const PALETTE = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ff6fa8'];
    const REASON = {
        no_coins: (r) => 'コインが足りません' + (r.need ? '（必要 ' + fmt(r.need) + '）' : ''), no_treasury: (r) => '国庫が足りません' + (r.need ? '（必要 ' + fmt(r.need) + '）' : ''),
        bad_name: () => '国名は2〜12文字で入力してください（使えない言葉があります）', name_taken: () => 'その国名はすでに使われています', no_land: () => 'もう空いている土地がありません', dead: () => '倒れている間は移動できません', travel_cd: (r) => 'あと ' + r.sec + ' 秒待ってください', in_combat: () => '戦闘中は移動できません', need_safe_zone: () => '安全地帯（地図の中心）にいるときだけ使えます', need_friendly_land: () => '自国・同盟国の領地にいるときだけ使えます', bad_type: () => '不正な操作です',
        already_member: () => 'すでに国に所属しています', closed: () => 'この国は国民を受け付けていません', not_ruler: () => '国王だけができる操作です', no_nation: () => '国に所属していません',
        ruler_must_transfer: () => '国王は、先に他の国民へ王位を譲ってください（1人だけなら解散できます）', not_my_land: () => '自分の国の領地の中でだけ建てられます', too_close_castle: () => '城に近すぎます',
        plot_limit: (r) => '1人が建てられるのは ' + r.max + ' か所までです', too_near: () => '他の建物に近すぎます', blocked: () => '障害物があって建てられません（空いた場所に移動してください）',
        protected: () => '建国直後の国には宣戦布告できません（3時間の保護期間）', allied: () => '同盟国には宣戦布告できません。先に同盟を破棄してください', already: () => 'すでに申し込み済み／成立済みです',
        at_war: () => '戦争中の国とは結べません', not_at_war: () => '戦争中ではありません', max: () => 'これ以上は雇えません', too_far: () => '店から遠すぎます。近づいてください', gone: () => '売り切れました',
        own: () => '自分の店の商品は買えません', nothing: () => '出せる商品がありませんでした（ロック中・神話・すでに別の場所に出品中など）', forbidden: () => '権限がありません', not_found: () => '見つかりません',
        price_changed: (r) => '値段が変わりました（いまは ' + fmt(r.price) + ' コイン）。もう一度確認してください', bad_price: () => '値段を正しく入力してください（1コイン以上）', rate_limit: () => '操作が速すぎます。少し待ってください', not_in_area: () => 'サバイバルエリアに入っているときだけ使えます', offline: () => 'サーバーに接続できません', timeout: () => '通信がタイムアウトしました', server_error: () => 'サーバーでエラーが起きました'
    };
    let S = null, tab = '', shop = null, busy = false, mkInfo = null;

    const sock = () => window.socket;
    const player = () => { try { return typeof getPlayerData === 'function' ? getPlayerData() : null; } catch (e) { return null; } };
    const coins = () => Math.floor((player() || {}).coins || 0);
    function spend(n) {
        const p = player(); if (!p || !n) return;
        p.coins = Math.max(0, (p.coins || 0) - n);
        try { localStorage.setItem('player', JSON.stringify(p)); if (typeof updateStatus === 'function') updateStatus(p); if (typeof syncPlayerToServer === 'function') syncPlayerToServer(true); } catch (e) { /* 次回同期 */ }
    }
    function call(ev, payload) {
        return new Promise((resolve) => {
            const s = sock();
            if (!s || !s.connected) { resolve({ ok: false, reason: 'offline' }); return; }
            s.timeout(15000).emit(ev, payload || {}, (err, res) => resolve(err ? { ok: false, reason: 'timeout' } : (res || { ok: false, reason: 'server_error' })));
        });
    }
    const reasonText = (r) => { const f = REASON[r && r.reason]; return f ? f(r) : 'うまくいきませんでした（' + (r && r.reason) + '）'; };
    function note(t, err) { const m = $('nbMsg'); if (!m) return; m.textContent = t; m.className = 'nb-msg' + (err ? ' err' : ''); }
    const nName = (id) => { const t = (window.SBSurvival && window.SBSurvival.table()) || {}; return t[id] ? t[id].name : (S && (S.nations.find((n) => n.id === id) || {}).name) || '？'; };
    const dot = (c) => '<span class="nb-dot" style="background:' + esc(c) + '"></span>';

    // ---------- 開閉 ----------
    function open() {
        const w = $('nbOverlay'); if (!w) return;
        w.style.display = 'flex'; shop = null; refresh();
    }
    function close() { const w = $('nbOverlay'); if (w) w.style.display = 'none'; shop = null; }
    async function refresh() {
        const r = await call('nation:state', {});
        if (!r.ok) { $('nbBody').innerHTML = '<div class="nb-empty">' + esc(reasonText(r)) + '</div>'; return; }
        S = r;
        if (!tab || (!S.mine && ['found', 'join'].indexOf(tab) < 0) || (S.mine && ['found', 'join'].indexOf(tab) >= 0)) tab = S.mine ? 'home' : 'found';
        if (window.SBSurvival && window.SBSurvival.refreshView) window.SBSurvival.refreshView();
        render();
    }
    function render() {
        if (!S) return;
        if (shop) { renderShop(); return; }
        const tabs = S.mine ? [['home', '🏰 国'], ['rule', '👑 国政'], ['diplo', '🤝 外交'], ['guard', '🛡 護衛'], ['build', '🏠 建築']] : [['found', '🏰 建国'], ['join', '👥 入国']];
        $('nbTabs').innerHTML = tabs.map((t) => '<button type="button" class="nb-tab' + (tab === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>').join('');
        $('nbTabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; note(''); render(); }));
        const body = $('nbBody'); body.scrollTop = 0;
        ({ found: renderFound, join: renderJoin, home: renderHome, rule: renderRule, diplo: renderDiplo, guard: renderGuard, build: renderBuild }[tab] || renderHome)(body);
    }
    const guardBusy = async (fn) => { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } };

    // ---------- 建国・入国 ----------
    function renderFound(el) {
        const cost = S.cfg.FOUND_COST;
        el.innerHTML = '<div class="nb-card"><h3>🏰 国を建てる</h3>' +
            '<p>建国費用は <b>' + fmt(cost) + ' コイン</b>。領地（約11〜13区画）は自動で割り振られ、その中心に城と城下町ができます。<br>建国すると、税率・同盟・貿易・戦争・衛兵の雇用などを自分で決められます。</p>' +
            '<p>空いている土地：<b>' + S.freeSites + '</b> / ' + S.totalSites + '　／　所持コイン：<b>' + fmt(coins()) + '</b></p>' +
            '<label>国名（2〜12文字）<input id="nbName" maxlength="12" placeholder="例：ミライ王国"></label>' +
            '<div class="nb-colors">' + PALETTE.map((c, i) => '<button type="button" class="nb-col' + (i === 0 ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>').join('') + '</div>' +
            '<button type="button" class="nb-btn big" id="nbFound"' + (S.freeSites ? '' : ' disabled') + '>🏰 ' + fmt(cost) + ' コインで建国する</button></div>';
        let col = PALETTE[0];
        el.querySelectorAll('.nb-col').forEach((b) => b.addEventListener('click', () => { col = b.dataset.c; el.querySelectorAll('.nb-col').forEach((x) => x.classList.toggle('on', x === b)); }));
        $('nbFound').addEventListener('click', () => guardBusy(async () => {
            const name = $('nbName').value.trim();
            if (coins() < cost) { note('コインが足りません（' + fmt(cost) + ' 必要）', true); return; }
            if (!window.confirm('「' + name + '」を ' + fmt(cost) + ' コインで建国します。よろしいですか？')) return;
            const r = await call('nation:create', { name: name, color: col, coins: coins() });
            if (!r.ok) { note(reasonText(r), true); return; }
            spend(r.cost); note('🏰 建国しました！ 城は「' + r.site + '」にあります'); await refresh();
        }));
    }
    function renderJoin(el) {
        if (!S.nations.length) { el.innerHTML = '<div class="nb-empty">まだ国がありません。最初の建国者になろう！</div>'; return; }
        el.innerHTML = S.nations.map((n) => '<div class="nb-card row"><div>' + dot(n.color) + '<b>' + esc(n.name) + '</b>（' + esc(n.site) + '）<br><small>👑 ' + esc(n.ruler) + '　👥 ' + n.members + '人　🗺 ' + n.cells + '区画　国税 ' + n.citizenTax + '%／営業税 ' + n.shopTax + '%' + (n.open ? '' : '　🔒受付停止') + '</small></div>' +
            '<button type="button" class="nb-btn" data-j="' + n.id + '"' + (n.open ? '' : ' disabled') + '>入国</button></div>').join('');
        el.querySelectorAll('[data-j]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => {
            const n = S.nations.find((x) => x.id === Number(b.dataset.j));
            if (!window.confirm('「' + n.name + '」に入国します。\n・稼いだコインから国税 ' + n.citizenTax + '% が引かれます\n・同じ国・同盟国の人とは戦えなくなります\nよろしいですか？')) return;
            const r = await call('nation:join', { nid: n.id }); if (!r.ok) { note(reasonText(r), true); return; }
            note('入国しました'); await refresh();
        })));
    }

    // ---------- 国（概要） ----------
    function renderHome(el) {
        const m = S.mine, allies = m.allies.map(nName).join('、') || 'なし', wars = m.wars.map(nName).join('、') || 'なし';
        el.innerHTML = '<div class="nb-card"><h3>' + dot(m.color) + esc(m.name) + (m.isRuler ? ' 👑' : '') + '</h3>' +
            '<p>📍 ' + esc(m.site) + '　👑 国王：' + esc(m.ruler) + '　👥 ' + m.members + '人　🗺 ' + m.cells + '区画</p>' +
            '<p>💰 国庫：<b>' + fmt(m.treasury) + '</b>　　国税 ' + m.citizenTax + '%（稼いだコインから）／営業税 ' + m.shopTax + '%（店の売上から）</p>' +
            '<p>🤝 同盟：' + esc(allies) + '<br>⚔ 戦争中：' + esc(wars) + '<br>🚢 航行中の貿易船：' + m.ships + '</p></div>' +
            '<div class="nb-card"><h3>💰 国庫へ寄付</h3><div class="nb-line"><input id="nbDon" type="number" min="1" placeholder="コイン"><button type="button" class="nb-btn" id="nbDonBtn">寄付する</button></div><small>国庫は衛兵・貿易・宣戦布告に使われます</small></div>' +
            '<div class="nb-card"><h3>👥 国民</h3>' + m.memberList.map((x) => '<div class="nb-line"><span>' + (x.ruler ? '👑 ' : '') + esc(x.name) + '</span>' + (m.isRuler && !x.ruler ? '<span><button type="button" class="nb-btn sm" data-tr="' + esc(x.pid) + '">王位を譲る</button> <button type="button" class="nb-btn sm danger" data-kick="' + esc(x.pid) + '">追放</button></span>' : '') + '</div>').join('') + '</div>' +
            '<div class="nb-card"><h3>🧭 移動</h3><small>地図がとても広いので、自分の国と安全地帯のあいだを行き来できます（戦闘中は不可・20秒ごと）。</small><div class="nb-line"><button type="button" class="nb-btn" data-go="capital">🏰 首都へ移動（安全地帯から）</button><button type="button" class="nb-btn" data-go="safe">🛡 安全地帯へ戻る（自国・同盟国の領地から）</button></div></div>' +
            '<div class="nb-card"><button type="button" class="nb-btn danger" id="nbLeave">' + (m.isRuler && m.members === 1 ? '🏚 国を解散する' : '🚪 出国する') + '</button></div>';
        $('nbDonBtn').addEventListener('click', () => guardBusy(async () => {
            const a = Math.floor(Number($('nbDon').value)); if (!(a >= 1)) { note('金額を入力してください', true); return; }
            const r = await call('nation:donate', { amount: a, coins: coins() }); if (!r.ok) { note(reasonText(r), true); return; }
            spend(r.cost); note('寄付しました（' + fmt(a) + '）'); await refresh();
        }));
        el.querySelectorAll('[data-tr]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => { if (!window.confirm('王位を譲ります。よろしいですか？')) return; const r = await call('nation:transfer', { pid: b.dataset.tr }); note(r.ok ? '王位を譲りました' : reasonText(r), !r.ok); await refresh(); })));
        el.querySelectorAll('[data-kick]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => { if (!window.confirm('この国民を追放します。よろしいですか？')) return; const r = await call('nation:kick', { pid: b.dataset.kick }); note(r.ok ? '追放しました' : reasonText(r), !r.ok); await refresh(); })));
        el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => { const r = await call('nation:travel', { to: b.dataset.go }); if (!r.ok) { note(reasonText(r), true); return; } close(); })));
        $('nbLeave').addEventListener('click', () => guardBusy(async () => {
            if (!window.confirm(m.isRuler && m.members === 1 ? '国を解散します（国庫は受け取り箱に戻ります）。よろしいですか？' : '出国します。この国に建てた拠点・店は取り壊され、在庫は戻ります。よろしいですか？')) return;
            const r = await call('nation:leave', {}); if (!r.ok) { note(reasonText(r), true); return; }
            tab = ''; note(r.disbanded ? '国を解散しました' : '出国しました'); if (window.SBMarket) window.SBMarket.claimMail(true).catch(() => {}); await refresh();
        }));
    }

    // ---------- 国政（税・受付） ----------
    function renderRule(el) {
        const m = S.mine;
        if (!m.isRuler) { el.innerHTML = '<div class="nb-empty">国政は国王だけが決められます。</div>'; return; }
        el.innerHTML = '<div class="nb-card"><h3>🧾 税金</h3>' +
            '<label>国税（国民が稼いだコインから引く）<span class="nb-range"><input id="nbCt" type="number" min="0" max="' + S.cfg.MAX_TAX + '" value="' + m.citizenTax + '"> %</span></label>' +
            '<label>営業税（領地内の店の売上から引く）<span class="nb-range"><input id="nbSt" type="number" min="0" max="' + S.cfg.MAX_TAX + '" value="' + m.shopTax + '"> %</span></label>' +
            '<small>上限 ' + S.cfg.MAX_TAX + '%。高すぎると国民が出国します。</small></div>' +
            '<div class="nb-card"><h3>🚪 入国の受付</h3><label class="nb-check"><input id="nbOpen" type="checkbox"' + (m.open ? ' checked' : '') + '> 新しい国民を受け付ける</label></div>' +
            '<div class="nb-card"><button type="button" class="nb-btn big" id="nbSavePol">💾 保存する</button></div>';
        $('nbSavePol').addEventListener('click', () => guardBusy(async () => {
            const r = await call('nation:setPolicy', { citizenTax: Number($('nbCt').value), shopTax: Number($('nbSt').value), open: $('nbOpen').checked });
            note(r.ok ? '保存しました' : reasonText(r), !r.ok); await refresh();
        }));
    }

    // ---------- 外交（同盟・貿易・戦争） ----------
    function renderDiplo(el) {
        const m = S.mine, others = S.nations.filter((n) => n.id !== m.id);
        let h = '';
        if (m.incoming.length) {
            h += '<div class="nb-card"><h3>📨 届いている申し込み</h3>' + m.incoming.map((p) => '<div class="nb-line"><span>' + esc(nName(p.from)) + '：' + ({ ally: '同盟', peace: '停戦', trade: '貿易（相手は ' + fmt(p.vol) + ' コインぶんを送る）' }[p.type]) + '</span>' +
                (m.isRuler ? '<span><button type="button" class="nb-btn sm" data-acc="' + p.id + '" data-ty="' + p.type + '">承諾</button> <button type="button" class="nb-btn sm danger" data-rej="' + p.id + '">断る</button></span>' : '') + '</div>').join('') + '</div>';
        }
        if (m.trades.length) {
            h += '<div class="nb-card"><h3>⚓ 貿易契約</h3><small>5分ごとに、貿易量ぶんの積み荷を載せた貿易船が出航します。無事に着くと +' + Math.round(S.cfg.TRADE_BONUS * 100) + '% 上乗せで相手の国庫へ。襲われると積み荷を奪われます（護衛を雇えます）。</small>' +
                m.trades.map((t) => '<div class="nb-line"><span>' + esc(nName(t.other)) + '　送る ' + fmt(t.mine) + ' ／ 届く ' + fmt(t.theirs) + '</span>' + (m.isRuler ? '<span><input class="nb-mini" type="number" data-vol="' + t.id + '" value="' + t.mine + '" min="' + S.cfg.TRADE_MIN + '" max="' + S.cfg.TRADE_MAX + '"><button type="button" class="nb-btn sm" data-setvol="' + t.id + '">変更</button> <button type="button" class="nb-btn sm danger" data-ctr="' + t.id + '">解約</button></span>' : '') + '</div>').join('') + '</div>';
        }
        h += '<div class="nb-card"><h3>🌍 他の国</h3>' + (others.length ? others.map((n) => {
            const isAlly = m.allies.indexOf(n.id) >= 0, isWar = m.wars.indexOf(n.id) >= 0, hasTrade = m.trades.some((t) => t.other === n.id);
            const prot = n.protectedUntil * 1000 > Date.now();
            return '<div class="nb-nation">' + '<div>' + dot(n.color) + '<b>' + esc(n.name) + '</b> ' + (isAlly ? '<span class="nb-tag ally">同盟</span>' : '') + (isWar ? '<span class="nb-tag war">戦争中</span>' : '') + (hasTrade ? '<span class="nb-tag trade">貿易中</span>' : '') + (prot ? '<span class="nb-tag">保護期間</span>' : '') + '<br><small>👑 ' + esc(n.ruler) + '　🗺 ' + n.cells + '区画　👥 ' + n.members + '人</small></div>' +
                (m.isRuler ? '<div class="nb-acts">' +
                    (isWar ? '<button type="button" class="nb-btn sm" data-pe="' + n.id + '">🕊 停戦を申し込む</button>' : (isAlly ? '<button type="button" class="nb-btn sm danger" data-bk="' + n.id + '">💔 同盟を破棄</button>' : '<button type="button" class="nb-btn sm" data-al="' + n.id + '">🤝 同盟を申し込む</button>')) +
                    (!isWar && !hasTrade ? '<button type="button" class="nb-btn sm" data-tr="' + n.id + '">⚓ 貿易を申し込む</button>' : '') +
                    (!isWar && !isAlly ? '<button type="button" class="nb-btn sm danger" data-wr="' + n.id + '">⚔ 宣戦布告（' + fmt(S.cfg.WAR_COST) + '）</button>' : '') + '</div>' : '') + '</div>';
        }).join('') : '<div class="nb-empty">他の国はまだありません</div>') + '</div>';
        if (!m.isRuler) h += '<small class="nb-note">外交は国王だけが行えます。</small>';
        el.innerHTML = h;
        const act = (sel, fn) => el.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => guardBusy(async () => { await fn(b); })));
        const done = async (r, ok) => { note(r.ok ? ok : reasonText(r), !r.ok); await refresh(); };
        act('[data-acc]', async (b) => { let vol = 0; if (b.dataset.ty === 'trade') { const v = window.prompt('あなたの国が送る貿易量（コイン）を入力\n' + S.cfg.TRADE_MIN + '〜' + S.cfg.TRADE_MAX, '20000'); if (v == null) return; vol = Number(v); } await done(await call('nation:respond', { id: Number(b.dataset.acc), accept: true, vol: vol }), '承諾しました'); });
        act('[data-rej]', async (b) => done(await call('nation:respond', { id: Number(b.dataset.rej), accept: false }), '断りました'));
        act('[data-al]', async (b) => done(await call('nation:propose', { type: 'ally', to: Number(b.dataset.al) }), '同盟を申し込みました'));
        act('[data-pe]', async (b) => done(await call('nation:propose', { type: 'peace', to: Number(b.dataset.pe) }), '停戦を申し込みました'));
        act('[data-bk]', async (b) => { if (window.confirm('同盟を破棄します。よろしいですか？')) await done(await call('nation:breakAlly', { to: Number(b.dataset.bk) }), '同盟を破棄しました'); });
        act('[data-tr]', async (b) => { const v = window.prompt('貿易量（5分ごとに送る積み荷、コイン）\n国庫から出ます。' + S.cfg.TRADE_MIN + '〜' + S.cfg.TRADE_MAX, '20000'); if (v == null) return; await done(await call('nation:propose', { type: 'trade', to: Number(b.dataset.tr), vol: Number(v) }), '貿易を申し込みました'); });
        act('[data-wr]', async (b) => { if (window.confirm('「' + nName(Number(b.dataset.wr)) + '」に宣戦布告します（国庫から ' + fmt(S.cfg.WAR_COST) + '）。\n戦争中は、敵の領地に居座ると侵略度が上がり、100%で領地を奪えます。\n同じように、あなたの領地も狙われます。よろしいですか？')) await done(await call('nation:declareWar', { to: Number(b.dataset.wr) }), '宣戦布告しました'); });
        act('[data-ctr]', async (b) => { if (window.confirm('貿易契約を解約します。よろしいですか？')) await done(await call('nation:cancelTrade', { id: Number(b.dataset.ctr) }), '解約しました'); });
        act('[data-setvol]', async (b) => { const inp = el.querySelector('[data-vol="' + b.dataset.setvol + '"]'); await done(await call('nation:setTradeVol', { id: Number(b.dataset.setvol), vol: Number(inp.value) }), '貿易量を変更しました'); });
    }

    // ---------- 護衛（CPUを雇う） ----------
    function renderGuard(el) {
        const m = S.mine, g = S.cfg.GUARD;
        if (!m.isRuler) { el.innerHTML = '<div class="nb-empty">護衛の雇用は国王だけができます。</div>'; return; }
        el.innerHTML = '<div class="nb-card"><h3>🛡 城・城下町の衛兵</h3><small>衛兵はCPU。国庫から雇います。味方（同じ国・同盟国）は守り、戦争中の国の人や、国民・貿易船に手を出した人を攻撃します。倒されたら、雇い直しが必要です。</small>' +
            ['castle', 'town'].map((k) => '<div class="nb-line"><span>' + (k === 'castle' ? '🛡️ 城の衛兵' : '💂 城下町の衛兵') + '　' + m.guards[k] + ' / ' + g[k].max + '人　（1人 ' + fmt(g[k].cost) + '）</span><span><button type="button" class="nb-btn sm" data-h="' + k + '" data-n="1">+1</button> <button type="button" class="nb-btn sm" data-h="' + k + '" data-n="5">+5</button></span></div>').join('') + '<p>💰 国庫：' + fmt(m.treasury) + '</p></div>' +
            '<div class="nb-card"><h3>🚢 貿易船の護衛</h3><small>貿易船を出すたびに、護衛兵が船に付き添います。1人ごとに ' + fmt(S.cfg.ESCORT_COST) + '（出航のたびに国庫から）。</small>' +
            '<div class="nb-line"><span>付き添う人数</span><span><select id="nbEsc">' + [0, 1, 2, 3].map((i) => '<option value="' + i + '"' + (m.escortPref === i ? ' selected' : '') + '>' + i + '人</option>').join('') + '</select> <button type="button" class="nb-btn sm" id="nbEscSave">保存</button></span></div></div>';
        el.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => { const r = await call('nation:hire', { post: b.dataset.h, n: Number(b.dataset.n) }); note(r.ok ? r.n + '人を雇いました（' + fmt(r.cost) + '）' : reasonText(r), !r.ok); await refresh(); })));
        $('nbEscSave').addEventListener('click', () => guardBusy(async () => { const r = await call('nation:setPolicy', { escortPref: Number($('nbEsc').value) }); note(r.ok ? '保存しました' : reasonText(r), !r.ok); await refresh(); }));
    }

    // ---------- 建築（拠点・店） ----------
    function renderBuild(el) {
        const m = S.mine, mine = m.plots.filter((p) => p.owner === S.pid);
        el.innerHTML = '<div class="nb-card"><h3>🏗 ここに建てる</h3>' +
            '<p>自分の国の領地の中で、建てたい場所に立って押します。<b>' + fmt(S.cfg.PLOT_COST) + ' コイン</b>（国庫に入ります）。1人 ' + S.cfg.MAX_PLOTS_PER_PLAYER + ' か所まで。</p>' +
            '<ul class="nb-ul"><li>🏠 拠点：倒されたとき、ここで復活できる</li><li>🏪 店：自分の装備を並べて、他のプレイヤーに売れる（売上は受け取り箱へ。営業税 ' + m.shopTax + '% が国庫へ）</li></ul>' +
            '<label>名前<input id="nbPName" maxlength="16" placeholder="任意"></label>' +
            '<div class="nb-line"><button type="button" class="nb-btn" data-b="base">🏠 拠点を建てる</button><button type="button" class="nb-btn" data-b="shop">🏪 店を建てる</button></div></div>' +
            '<div class="nb-card"><h3>🏘 自分の建物（' + mine.length + '）</h3>' + (mine.length ? mine.map((p) => '<div class="nb-line"><span>' + (p.kind === 'shop' ? '🏪' : '🏠') + ' ' + esc(p.name) + (p.kind === 'shop' ? '（商品 ' + p.stock + '）' : '') + '</span><span>' + (p.kind === 'shop' ? '<button type="button" class="nb-btn sm" data-shop="' + esc(p.id) + '">店を開く</button> ' : '') + '<button type="button" class="nb-btn sm danger" data-del="' + esc(p.id) + '">取り壊し</button></span></div>').join('') : '<div class="nb-empty">まだありません</div>') + '</div>';
        el.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => {
            const r = await call('nation:build', { kind: b.dataset.b, name: $('nbPName').value, coins: coins() });
            if (!r.ok) { note(reasonText(r), true); return; }
            spend(r.cost); note('建てました！'); await refresh();
        })));
        el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => { if (!window.confirm('取り壊します（返金はありません。店の在庫は受け取り箱に戻ります）。よろしいですか？')) return; const r = await call('nation:demolish', { id: b.dataset.del }); note(r.ok ? '取り壊しました' : reasonText(r), !r.ok); if (r.ok && window.SBMarket) window.SBMarket.claimMail(true).catch(() => {}); await refresh(); })));
        el.querySelectorAll('[data-shop]').forEach((b) => b.addEventListener('click', () => openShop(b.dataset.shop)));
    }

    // ---------- 店 ----------
    async function openShop(id) {
        const w = $('nbOverlay'); if (!w) return;
        w.style.display = 'flex';
        if (!mkInfo) { const r = await call('market:info', {}); if (r && r.ok) { mkInfo = r; if (window.SBMarket) window.SBMarket.setInfo(r); } }
        const r = await call('nation:shopView', { id: id });
        if (!r.ok) { shop = null; if (!S) await refresh(); note(reasonText(r), true); if (!S) { $('nbBody').innerHTML = '<div class="nb-empty">' + esc(reasonText(r)) + '</div>'; } return; }
        shop = r; if (!S) { const st = await call('nation:state', {}); if (st.ok) S = st; }
        renderShop();
    }
    const sugg = (kind, d) => { const m = ((kind === 'orb' ? (mkInfo || {}).orbMin : (mkInfo || {}).equipMin) || {})[kind === 'orb' ? d.tier : d.rarity] || 100; return Math.max(1, m * 2); };   // 値付けの目安（市場の最低価格の2倍）
    function itemRow(it, right) {
        const M = window.SBMarket; let name = '?', col = '#ccc', lines = [];
        try { name = M.nameOf(it.kind, it.data); col = M.rarColor(it.kind, it.data); lines = M.detailLines(it.kind, it.data); } catch (e) { /* 表示だけ */ }
        return '<div class="nb-item"><div><b style="color:' + esc(col) + '">' + esc(name) + '</b><div class="nb-det">' + lines.slice(0, 4).map(esc).join('<br>') + '</div></div><div class="nb-right">' + right + '</div></div>';
    }
    const effOf = (price, sale, shopSale) => Math.max(1, Math.floor(price * (100 - Math.max(sale || 0, shopSale || 0)) / 100));
    function renderShop() {
        const s = shop; $('nbTabs').innerHTML = '<button type="button" class="nb-tab on" id="nbBack">← 戻る</button>';
        $('nbBack').addEventListener('click', () => { shop = null; if (S && S.mine) render(); else close(); });
        const body = $('nbBody'); body.scrollTop = 0;
        let h = '<div class="nb-card"><h3>🏪 ' + esc(s.name) + (s.sale ? ' <span class="nb-tag war">全品 ' + s.sale + '%OFF</span>' : '') + '</h3><small>店主：' + esc(s.owner) + '（' + esc(s.nation) + '）／ 営業税 ' + s.tax + '%　所持コイン：' + fmt(coins()) + '</small></div>';
        if (s.mine) {
            h += '<div class="nb-card"><h3>⚙ お店の設定</h3>' +
                '<label>店の名前<input id="nbShopName" maxlength="16" value="' + esc(s.name) + '"></label>' +
                '<label>全品セール（割引 0〜90%）<span class="nb-range"><input id="nbShopSale" type="number" min="0" max="90" value="' + (s.sale || 0) + '"> %</span></label>' +
                '<small>商品ごとの割引と全品セールは、大きいほうが適用されます。売上から営業税 ' + s.tax + '% が引かれます。</small>' +
                '<div class="nb-line"><button type="button" class="nb-btn" id="nbShopSave">💾 保存</button></div></div>';
        }
        h += '<div class="nb-card"><h3>' + (s.mine ? '📦 陳列中の商品' : '🛒 商品') + '（' + s.items.length + '）</h3>' + (s.items.length ? s.items.map((it, i) => {
            if (s.mine) return itemRow(it, '<div class="nb-pr">定価 <input class="nb-mini" type="number" id="nbEp' + i + '" value="' + it.price + '" min="1"></div><div class="nb-pr">割引 <input class="nb-mini s" type="number" id="nbEs' + i + '" value="' + (it.sale || 0) + '" min="0" max="90"> %</div><small>売値 <b>' + fmt(it.eff) + '</b> 💰</small><br><button type="button" class="nb-btn sm" data-upd="' + i + '">更新</button> <button type="button" class="nb-btn sm danger" data-un="' + esc(it.id) + '">引き上げ</button>');
            const off = it.eff < it.price;
            return itemRow(it, (off ? '<s class="nb-old">' + fmt(it.price) + '</s> <span class="nb-tag war">' + Math.round((1 - it.eff / it.price) * 100) + '%OFF</span><br>' : '') + '<b>' + fmt(it.eff) + '</b> 💰<br><button type="button" class="nb-btn sm" data-buy="' + esc(it.id) + '" data-p="' + it.eff + '">買う</button>');
        }).join('') : '<div class="nb-empty">商品はありません</div>') + '</div>';
        if (s.mine) {
            let inv = []; try { const I = window.SBMarket.inventory(); inv = [].concat(I.weapon, I.armor, I.acc, I.orb); } catch (e) { /* 取得できない */ }
            h += '<div class="nb-card"><h3>➕ 商品を並べる（自分の持ち物から）</h3><small>手持ちのアイテムを選んで、値段と割引を自由に決められます。装備中・ロック中・神話は並べられません。並べたアイテムは手元から店に移り、売れるまで引き上げられます。</small>' +
                (inv.length ? inv.slice(0, 60).map((it, i) => itemRow(it, '<div class="nb-pr">定価 <input class="nb-mini" type="number" id="nbPr' + i + '" value="' + sugg(it.kind, it.data) + '" min="1"></div><div class="nb-pr">割引 <input class="nb-mini s" type="number" id="nbSl' + i + '" value="0" min="0" max="90"> %</div><button type="button" class="nb-btn sm" data-add="' + i + '">並べる</button>')).join('') : '<div class="nb-empty">並べられるアイテムがありません</div>') + '</div>';
            body.innerHTML = h;
            $('nbShopSave').addEventListener('click', () => guardBusy(async () => {
                const r = await call('nation:shopSetShop', { id: s.id, name: $('nbShopName').value, sale: Number($('nbShopSale').value) });
                note(r.ok ? '保存しました' : reasonText(r), !r.ok); await openShop(s.id);
            }));
            body.querySelectorAll('[data-upd]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => {
                const i = Number(b.dataset.upd), it = s.items[i];
                const r = await call('nation:shopSetPrice', { id: s.id, itemId: it.id, price: Number($('nbEp' + i).value), sale: Number($('nbEs' + i).value) });
                note(r.ok ? '更新しました' : reasonText(r), !r.ok); await openShop(s.id);
            })));
            body.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => {
                const i = Number(b.dataset.add), it = inv[i], price = Math.floor(Number($('nbPr' + i).value)), sale = Math.floor(Number($('nbSl' + i).value) || 0);
                if (!(price >= 1)) { note('定価を入力してください', true); return; }
                const r = await call('nation:shopStock', { id: s.id, items: [{ kind: it.kind, data: it.data, price: price, sale: sale }] });
                if (!r.ok) { note(reasonText(r), true); return; }
                window.SBMarket.removeLocal([it]); note('並べました（売値 ' + fmt(effOf(price, sale, s.sale)) + '）'); await openShop(s.id);
            })));
            body.querySelectorAll('[data-un]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => { const r = await call('nation:shopUnstock', { id: s.id, itemId: b.dataset.un }); if (!r.ok) { note(reasonText(r), true); return; } if (window.SBMarket) await window.SBMarket.claimMail(true); note('引き上げました。手元に戻りました'); await openShop(s.id); })));
        } else {
            body.innerHTML = h;
            body.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => guardBusy(async () => {
                if (!window.confirm(fmt(b.dataset.p) + ' コインで買います。よろしいですか？')) return;
                const r = await call('nation:shopBuy', { id: s.id, itemId: b.dataset.buy, price: Number(b.dataset.p), coins: coins() });
                if (!r.ok) { note(reasonText(r), true); await openShop(s.id); return; }
                spend(r.cost); if (window.SBMarket) await window.SBMarket.claimMail(true); note('🛒 買いました！ 手元に届きました'); await openShop(s.id);
            })));
        }
    }

    // ---------- 組み立て ----------
    function build() {
        const wrap = document.querySelector('#section-survival .sv-wrap'); if (!wrap || $('nbOverlay')) return;
        const d = document.createElement('div'); d.id = 'nbOverlay';
        d.innerHTML = '<div class="nb-panel"><div class="nb-head"><b>🏰 国</b><button type="button" id="nbClose">✕</button></div><div class="nb-tabs" id="nbTabs"></div><div class="nb-msg" id="nbMsg"></div><div class="nb-body" id="nbBody"></div></div>';
        wrap.appendChild(d);
        $('nbClose').addEventListener('click', close);
        d.addEventListener('mousedown', (e) => { if (e.target === d) close(); });
        ['keydown', 'keyup'].forEach((ev) => d.addEventListener(ev, (e) => e.stopPropagation()));
    }
    function init() {
        build();
        const b = $('svNation'); if (b) b.addEventListener('click', open);
        const sb = $('svShopBtn'); if (sb) sb.addEventListener('click', () => { const id = window.SBSurvival && window.SBSurvival.nearShop(); if (id) openShop(id); });
    }
    window.SBNation = { open: open, close: close, openShop: openShop, refresh: refresh };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
