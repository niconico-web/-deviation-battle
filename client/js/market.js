// ============================================================
// market.js ― 市場（プレイヤー同士で売り買い）のクライアント
//  出品  : 出品物を手元から外してサーバーへ預ける（通信が切れても outbox に残して再送。opIdで二重出品しない）
//  購入  : 予約(reserve) → コインを引いてアイテムを入れる → 確認(ack)。ackが届くまでは売却成立にならない
//  受取  : 売れたコイン／取り下げたアイテムは「受け取り箱」に入る。開くと自動で受け取る
//  アイテムの正本は端末（localStorage）なので、IDで重複を防ぎ、受け取り済みメールIDを記録して二重受取を防ぐ
// ============================================================
(function () {
    'use strict';
    const OUTBOX_KEY = 'sbMarketOutbox', CLAIMED_KEY = 'sbMarketClaimed';
    const KIND_LABEL = { weapon: '武器', armor: '防具', acc: 'アクセサリー', orb: 'オーブ' };
    const KIND_ICON = { weapon: '🗡️', armor: '🛡️', acc: '💍', orb: '🔮' };
    const TIER_COL = { tier1: '#c9c9c9', tier2: '#6fa8ff', tier3: '#ffd84a', tier4: '#c077ff', tier5: '#ff8a2a' };
    const RAR_LABEL = { normal: 'ノーマル', magic: 'マジック', rare: 'レア', epic: 'エピック', legendary: 'レジェンド', tier1: 'ティア1', tier2: 'ティア2', tier3: 'ティア3', tier4: 'ティア4', tier5: 'ティア5' };
    const REASON = {
        below_min: (r) => '最低価格（' + fmt(r.min) + ' コイン）より安くは出品できません',
        above_max: () => '価格が高すぎます', bad_price: () => '価格を正しく入力してください', empty: () => '出品するアイテムを選んでください',
        too_many: (r) => '1件にまとめられるのは ' + r.max + ' 点までです', seller_limit: (r) => '同時に出品できるのは ' + r.max + ' 件までです',
        bad_item: () => 'このアイテムは出品できません（ロック中・神話など）', duplicate_item: () => 'すでに出品中のアイテムが含まれています',
        bad_title: () => 'タイトルに使えない言葉が含まれています', gone: () => 'この出品はもう買えません（売り切れ・取り下げ）', own: () => '自分の出品は買えません',
        reserved: () => '他の人が購入手続き中です。少し待ってからもう一度', no_coins: () => 'コインが足りません', rate_limit: () => '操作が速すぎます。少し待ってください',
        server_error: () => 'サーバーでエラーが起きました', not_found: () => '見つかりません'
    };
    let info = { feeRate: 0.05, maxItems: 20, equipMin: {}, orbMin: {}, maxPrice: 1e9 };
    let tab = 'browse', sel = [], sellKind = 'weapon', filters = { kind: '', rarity: '', q: '', sort: 'new', page: 0 };
    let busy = false;

    const $ = (id) => document.getElementById(id);
    const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString('ja-JP');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const online = () => !!(window.socket && window.socket.connected);
    const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
    const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 容量不足 */ } };
    function player() { try { return typeof getPlayerData === 'function' ? getPlayerData() : null; } catch (e) { return null; } }
    function savePlayer(p) {
        localStorage.setItem('player', JSON.stringify(p));
        try { if (typeof updateStatus === 'function') updateStatus(p); } catch (e) { /* 表示更新のみ */ }
        try { if (typeof syncPlayerToServer === 'function') syncPlayerToServer(true); } catch (e) { /* 次回同期 */ }
    }
    function call(event, payload) {
        return new Promise((resolve) => {
            if (!online()) { resolve({ ok: false, reason: 'offline' }); return; }
            window.socket.timeout(15000).emit(event, payload, (err, res) => resolve(err ? { ok: false, reason: 'timeout' } : res));
        });
    }
    function reasonText(r) {
        if (!r) return 'エラー';
        if (r.reason === 'offline' || r.reason === 'timeout') return 'サーバーに接続できません。通信できる状態でもう一度お試しください';
        const f = REASON[r.reason]; return f ? f(r) : ('エラー（' + r.reason + '）');
    }
    function toast(msg, err) { const m = $('marketMsg'); if (!m) return; m.textContent = msg; m.className = 'market-msg' + (err ? ' err' : ''); }

    // ---------- アイテムの出し入れ（端末側） ----------
    function nameOf(kind, d) {
        if (kind === 'orb') { const t = RAR_LABEL[d.tier] || d.tier; return t + 'オーブ（' + (d.statType || '?') + ' +' + Math.round((d.bonus || 0) * 1000) / 10 + '%）'; }
        if (kind === 'weapon') return d.name || ((d.prefix || '') + '＋' + (d.baseName || '武器'));
        if (kind === 'armor') return ((d.prefix || '') + (d.prefix ? '＋' : '') + (d.baseName || '防具'));
        return d.name || d.baseId || 'アクセサリー';
    }
    function rarKey(kind, d) { return kind === 'orb' ? d.tier : d.rarity; }
    function rarColor(kind, d) {
        if (kind === 'orb') return TIER_COL[d.tier] || '#ccc';
        try { return window.HW.RARITIES[d.rarity].color; } catch (e) { return '#ccc'; }
    }
    function minOf(kind, d) { return (kind === 'orb' ? info.orbMin[d.tier] : info.equipMin[d.rarity]) || 0; }
    function detailLines(kind, d) {
        const L = [];
        try {
            if (kind === 'weapon') { L.push((window.HW.TYPES[d.type] ? window.HW.TYPES[d.type].label : d.type) + ' ／ 攻撃 +' + Math.round((d.pct || 0) * 1000) / 10 + '% ／ Lv' + (d.ilvl || 1)); if (d.sockets) L.push('穴 ' + d.sockets + '（オーブ ' + (d.orbs || []).filter(Boolean).length + ' 個はめ込み済み）'); (d.effects || []).forEach((e) => L.push('・' + (e.name || e.id || '特殊効果'))); }
            else if (kind === 'armor') { L.push(((window.SBArmor.SLOTS[d.slot] || {}).label || d.slot) + ' ／ Lv' + (d.ilvl || 1)); try { (window.SBArmor.statLines(d) || []).forEach((x) => L.push(x)); } catch (e) { /* 表示だけ */ } try { (d.effects || []).forEach((e) => L.push('・' + window.SBArmor.describeEffect(e))); } catch (e) { /* 表示だけ */ } }
            else if (kind === 'acc') { try { (window.SBAcc.describe(d) || []).forEach((x) => L.push(x)); } catch (e) { L.push('Lv' + (d.ilvl || 1)); } }
            else { L.push(RAR_LABEL[d.tier] + ' ／ ' + (d.statType || '') + ' +' + Math.round((d.bonus || 0) * 1000) / 10 + '%'); if (d.uniqueAbility) L.push('固有能力：' + (d.uniqueAbility.name || d.uniqueAbility.key)); }
        } catch (e) { /* 表示だけなので無視 */ }
        return L;
    }

    // 出品できる手持ちの一覧
    function inventory() {
        const H = window.HW, d = H.load(), p = player() || {};
        const eqArm = Object.values(d.armorEq || {}), eqAcc = d.accEq || [];
        return {
            weapon: (d.weapons || []).filter((w) => w.id !== d.equipped && !w.locked && w.rarity !== 'mythic' && !w.mythicId).map((w) => ({ kind: 'weapon', data: w })),
            armor: (d.armors || []).filter((a) => eqArm.indexOf(a.id) === -1 && !a.locked).map((a) => ({ kind: 'armor', data: a })),
            acc: (d.accs || []).filter((a) => eqAcc.indexOf(a.id) === -1 && !a.locked).map((a) => ({ kind: 'acc', data: a })),
            orb: (p.orbs || []).filter((o) => o && o.tier).map((o) => ({ kind: 'orb', data: o }))
        };
    }
    function removeLocal(items) {
        const H = window.HW, d = H.load(), p = player();
        const ids = { weapon: new Set(), armor: new Set(), acc: new Set(), orb: new Set() };
        items.forEach((it) => ids[it.kind].add(it.data.id));
        d.weapons = (d.weapons || []).filter((x) => !ids.weapon.has(x.id));
        d.armors = (d.armors || []).filter((x) => !ids.armor.has(x.id));
        d.accs = (d.accs || []).filter((x) => !ids.acc.has(x.id));
        H.save(d);
        if (p) { p.orbs = (p.orbs || []).filter((x) => !ids.orb.has(x.id)); savePlayer(p); }
    }
    function addLocal(items, coinsDelta) {
        const H = window.HW, d = H.load(), p = player();
        const has = { weapon: new Set((d.weapons || []).map((x) => x.id)), armor: new Set((d.armors || []).map((x) => x.id)), acc: new Set((d.accs || []).map((x) => x.id)), orb: new Set(((p && p.orbs) || []).map((x) => x.id)) };
        if (!Array.isArray(d.weapons)) d.weapons = []; if (!Array.isArray(d.armors)) d.armors = []; if (!Array.isArray(d.accs)) d.accs = [];
        const orbs = [], hints = [];
        items.forEach((it) => {
            if (!it || !it.data || has[it.kind].has(it.data.id)) return;           // すでに持っている（再受取）ならスキップ
            has[it.kind].add(it.data.id);
            if (it.eq) hints.push(it);
            if (it.kind === 'weapon') d.weapons.push(it.data); else if (it.kind === 'armor') d.armors.push(it.data);
            else if (it.kind === 'acc') d.accs.push(it.data); else orbs.push(it.data);
        });
        // サバイバルエリアから戻った装備は、空いていれば元の場所に装備し直す
        hints.forEach((it) => {
            const x = it.data;
            if (it.eq === 'weapon') { if (!d.equipped || !d.weapons.some((w) => w.id === d.equipped)) d.equipped = x.id; }
            else if (it.eq.indexOf('armor:') === 0 && x.slot) { if (!d.armorEq || typeof d.armorEq !== 'object') d.armorEq = {}; if (!d.armorEq[x.slot] || !d.armors.some((a) => a.id === d.armorEq[x.slot])) d.armorEq[x.slot] = x.id; }
            else if (it.eq === 'acc') { if (!Array.isArray(d.accEq)) d.accEq = [null, null, null]; const i = d.accEq.indexOf(null); if (i >= 0 && d.accEq.indexOf(x.id) < 0) d.accEq[i] = x.id; }
        });
        H.save(d);
        if (p) { p.orbs = (p.orbs || []).concat(orbs); p.coins = Math.max(0, (p.coins || 0) + (coinsDelta || 0)); savePlayer(p); }
    }
    function hasAll(items) {
        const inv = (function () { const d = window.HW.load(), p = player() || {}; return { weapon: new Set((d.weapons || []).map((x) => x.id)), armor: new Set((d.armors || []).map((x) => x.id)), acc: new Set((d.accs || []).map((x) => x.id)), orb: new Set((p.orbs || []).map((x) => x.id)) }; })();
        return items.every((it) => inv[it.kind].has(it.data.id));
    }

    // ---------- outbox（出品・確認の再送） ----------
    async function flushOutbox() {
        if (!online()) return;
        let box = jget(OUTBOX_KEY, []);
        const p = player(); if (!p) return;
        for (const op of box.slice()) {
            const res = await call(op.type === 'list' ? 'market:list' : 'market:ack', op.payload);
            if (res.reason === 'offline' || res.reason === 'timeout' || res.reason === 'rate_limit') break;     // 通信の問題：あとで再送
            box = jget(OUTBOX_KEY, []).filter((x) => x.opId !== op.opId); jset(OUTBOX_KEY, box);
            if (op.type === 'list' && !res.ok) { addLocal(op.items, 0); toast('出品できなかったため、アイテムを手元に戻しました：' + reasonText(res), true); }
        }
    }

    // ---------- 出品 ----------
    async function submitSell() {
        if (busy) return; busy = true;
        try {
            if (!sel.length) { toast(reasonText({ reason: 'empty' }), true); return; }
            const price = Math.floor(Number($('sellPrice').value));
            const min = sel.reduce((s, it) => s + minOf(it.kind, it.data), 0);
            if (!(price >= 1)) { toast(reasonText({ reason: 'bad_price' }), true); return; }
            if (price < min) { toast(reasonText({ reason: 'below_min', min: min }), true); return; }
            const p = player(); if (!p) return;
            const opId = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            const payload = { playerId: String(p.id), sellerName: p.name, title: $('sellTitle').value.trim(), price: price, items: sel.map((it) => ({ kind: it.kind, data: it.data })), opId: opId };
            const box = jget(OUTBOX_KEY, []); box.push({ type: 'list', opId: opId, payload: payload, items: payload.items }); jset(OUTBOX_KEY, box);
            removeLocal(sel);                                   // 先に手元から外す（預け先に届くまで outbox が持つ）
            const chosen = sel; sel = [];
            const res = await call('market:list', payload);
            if (res.reason === 'offline' || res.reason === 'timeout') { toast('通信が不安定です。つながり次第、自動で出品します（アイテムは一時的に市場の送信待ちです）'); renderSell(); return; }
            jset(OUTBOX_KEY, jget(OUTBOX_KEY, []).filter((x) => x.opId !== opId));
            if (!res.ok) { addLocal(chosen, 0); toast(reasonText(res), true); renderSell(); return; }
            toast('出品しました！ 売れるとコインが「受け取り」に届きます'); tab = 'mine'; render();
        } finally { busy = false; }
    }

    // ---------- 購入 ----------
    async function applyPurchase(listing) {
        const p = player(); if (!p) return false;
        const already = hasAll(listing.items);                      // 取り込み済み（確認だけ再送する場合）
        if (!already) {
            if ((p.coins || 0) < listing.price) { await call('market:release', { playerId: String(p.id), listingId: listing.id }); toast(reasonText({ reason: 'no_coins' }), true); return false; }
            addLocal(listing.items, -listing.price);
        }
        const opId = 'A' + listing.id;
        const payload = { playerId: String(p.id), listingId: listing.id, opId: opId };
        const box = jget(OUTBOX_KEY, []); if (!box.some((x) => x.opId === opId)) { box.push({ type: 'ack', opId: opId, payload: payload }); jset(OUTBOX_KEY, box); }
        const res = await call('market:ack', payload);
        if (res.ok) jset(OUTBOX_KEY, jget(OUTBOX_KEY, []).filter((x) => x.opId !== opId));
        return true;
    }
    async function buy(listingId) {
        if (busy) return; busy = true;
        try {
            const p = player(); if (!p) return;
            const res = await call('market:reserve', { playerId: String(p.id), listingId: listingId, coins: p.coins || 0 });
            if (!res.ok) { toast(reasonText(res), true); closeDetail(); renderBrowse(); return; }
            const ok = await applyPurchase(res.listing);
            closeDetail();
            if (ok) { toast('購入しました！ 「' + res.listing.title + '」を ' + fmt(res.listing.price) + ' コインで手に入れました'); }
            renderBrowse(); updateCoins();
        } finally { busy = false; }
    }
    async function resumePending() {
        const p = player(); if (!p || !online()) return;
        const res = await call('market:pending', { playerId: String(p.id) });
        if (res.ok) for (const l of res.rows) await applyPurchase(l);
    }

    // ---------- 受け取り箱 ----------
    async function claimMail(silent) {
        const p = player(); if (!p || !online()) return 0;
        const res = await call('market:mail', { playerId: String(p.id) });
        if (!res.ok || !res.mail.length) { setBadge(0); return 0; }
        const claimed = new Set(jget(CLAIMED_KEY, []));
        let coins = 0; const notes = [];
        res.mail.forEach((m) => {
            if (claimed.has(m.id)) return;
            claimed.add(m.id);
            if (m.type === 'coins') coins += m.amount | 0;
            notes.push(m.note || '');
            if (m.type === 'items') addLocal(m.items, 0);
        });
        if (coins) addLocal([], coins);
        jset(CLAIMED_KEY, Array.from(claimed).slice(-300));
        await call('market:mailDone', { playerId: String(p.id), ids: res.mail.map((m) => m.id) });
        setBadge(0); updateCoins();
        if (!silent && notes.length) toast('受け取りました：' + notes.join(' ／ '));
        return res.mail.length;
    }
    function setBadge(n) { const b = $('marketMailBadge'); if (b) { b.textContent = n ? ' 📬' : ''; } }
    function updateCoins() { const c = $('marketCoins'); const p = player(); if (c && p) c.textContent = fmt(p.coins || 0); }

    // ---------- 画面 ----------
    function itemCard(it, extra) {
        const col = rarColor(it.kind, it.data);
        return '<div class="mk-item" style="border-color:' + col + '"><span class="mk-ic">' + KIND_ICON[it.kind] + '</span><span class="mk-nm" style="color:' + col + '">' + esc(nameOf(it.kind, it.data)) + '</span><small>' + (RAR_LABEL[rarKey(it.kind, it.data)] || '') + (extra || '') + '</small></div>';
    }
    function render() {
        const root = $('marketRoot'); if (!root) return;
        root.innerHTML =
            '<div class="mk-head"><div>💰 所持コイン <b id="marketCoins"></b></div><div class="mk-note">手数料 ' + Math.round(info.feeRate * 100) + '%（売れたときに引かれます）</div></div>' +
            '<div class="mk-tabs">' + [['browse', '🔎 さがす'], ['sell', '📤 出品する'], ['mine', '📦 出品中'], ['mail', '📬 受け取り']].map((t) => '<button type="button" class="mk-tab' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + (t[0] === 'mail' ? '<span id="marketMailBadge"></span>' : '') + '</button>').join('') + '</div>' +
            '<div id="marketMsg" class="market-msg"></div><div id="marketBody"></div><div id="marketDetail"></div>';
        root.querySelectorAll('.mk-tab').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
        updateCoins();
        if (tab === 'browse') renderBrowse(); else if (tab === 'sell') renderSell(); else if (tab === 'mine') renderMine(); else renderMail();
    }

    async function renderBrowse() {
        const body = $('marketBody'); if (!body) return;
        const kindOpts = [['', 'すべて']].concat(Object.keys(KIND_LABEL).map((k) => [k, KIND_LABEL[k]]));
        const rarOpts = [['', 'レア度：すべて']].concat(['normal', 'magic', 'rare', 'epic', 'legendary', 'tier1', 'tier2', 'tier3', 'tier4', 'tier5'].map((k) => [k, RAR_LABEL[k]]));
        body.innerHTML = '<div class="mk-filter"><select id="fKind">' + kindOpts.map((o) => '<option value="' + o[0] + '"' + (filters.kind === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
            '<select id="fRar">' + rarOpts.map((o) => '<option value="' + o[0] + '"' + (filters.rarity === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
            '<select id="fSort"><option value="new">新しい順</option><option value="cheap"' + (filters.sort === 'cheap' ? ' selected' : '') + '>安い順</option><option value="pricey"' + (filters.sort === 'pricey' ? ' selected' : '') + '>高い順</option></select>' +
            '<input id="fQ" type="search" placeholder="キーワード" value="' + esc(filters.q) + '" maxlength="30"></div><div id="mkList" class="mk-list">読み込み中…</div><div id="mkPager" class="mk-pager"></div>';
        const bind = (id, key) => $(id).addEventListener(id === 'fQ' ? 'change' : 'change', (e) => { filters[key] = e.target.value; filters.page = 0; renderBrowse(); });
        bind('fKind', 'kind'); bind('fRar', 'rarity'); bind('fSort', 'sort'); bind('fQ', 'q');
        const p = player();
        const res = await call('market:browse', Object.assign({ playerId: p ? String(p.id) : '', pageSize: 12 }, filters));
        const list = $('mkList'); if (!list) return;
        if (!res.ok) { list.innerHTML = '<div class="mk-empty">' + esc(reasonText(res)) + '</div>'; return; }
        if (!res.rows.length) { list.innerHTML = '<div class="mk-empty">出品はまだありません。最初の出品者になってみましょう！</div>'; $('mkPager').innerHTML = ''; return; }
        list.innerHTML = res.rows.map((l) => {
            const first = l.items[0];
            return '<div class="mk-card' + (l.status === 'reserved' ? ' rsv' : '') + '" data-id="' + l.id + '" style="border-color:' + rarColor(first.kind, first.data) + '">' +
                '<div class="mk-card-top">' + l.kinds.map((k) => KIND_ICON[k]).join('') + (l.count > 1 ? '<span class="mk-bundle">まとめ ' + l.count + '点</span>' : '') + '</div>' +
                '<div class="mk-title">' + esc(l.title) + '</div><div class="mk-seller">' + (l.mine ? '👤 自分の出品' : '👤 ' + esc(l.sellerName)) + (l.status === 'reserved' ? ' ／ 手続き中' : '') + '</div>' +
                '<div class="mk-price">💰 ' + fmt(l.price) + '</div></div>';
        }).join('');
        list.querySelectorAll('.mk-card').forEach((c) => c.addEventListener('click', () => openDetail(res.rows.find((r) => r.id === c.dataset.id))));
        const pages = Math.ceil(res.total / res.pageSize);
        $('mkPager').innerHTML = pages > 1 ? '<button type="button" id="pgPrev"' + (filters.page <= 0 ? ' disabled' : '') + '>◀</button> ' + (filters.page + 1) + ' / ' + pages + ' <button type="button" id="pgNext"' + (filters.page + 1 >= pages ? ' disabled' : '') + '>▶</button>' : '';
        if (pages > 1) { $('pgPrev').addEventListener('click', () => { filters.page--; renderBrowse(); }); $('pgNext').addEventListener('click', () => { filters.page++; renderBrowse(); }); }
    }
    function closeDetail() { const d = $('marketDetail'); if (d) d.innerHTML = ''; }
    function openDetail(l) {
        if (!l) return;
        const p = player(), canBuy = !l.mine && l.status === 'active', short = p && (p.coins || 0) < l.price;
        $('marketDetail').innerHTML = '<div class="mk-modal"><div class="mk-modal-box"><h3>' + esc(l.title) + '</h3><div class="mk-seller">出品者：' + esc(l.sellerName) + '</div>' +
            l.items.map((it) => itemCard(it) + '<ul class="mk-lines">' + detailLines(it.kind, it.data).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>').join('') +
            '<div class="mk-price big">💰 ' + fmt(l.price) + ' コイン</div>' +
            '<div class="mk-actions">' + (canBuy ? '<button type="button" class="btn btn-primary" id="mkBuy"' + (short ? ' disabled' : '') + '>' + (short ? 'コイン不足' : '購入する') + '</button>' : '<span class="mk-note">' + (l.mine ? '自分の出品です' : '手続き中です') + '</span>') +
            '<button type="button" class="btn" id="mkClose">閉じる</button></div></div></div>';
        $('mkClose').addEventListener('click', closeDetail);
        const b = $('mkBuy'); if (b) b.addEventListener('click', () => { b.disabled = true; buy(l.id); });
    }

    function renderSell() {
        const body = $('marketBody'); if (!body) return;
        const inv = inventory(), list = inv[sellKind];
        const min = sel.reduce((s, it) => s + minOf(it.kind, it.data), 0);
        const picked = (it) => sel.some((x) => x.data.id === it.data.id);
        body.innerHTML = '<div class="mk-note">装備中・ロック中・神話のアイテムは出品できません。オーブをはめた武器は、オーブごと売れます。複数選ぶと「まとめ売り」になります（最大 ' + info.maxItems + ' 点）。</div>' +
            '<div class="mk-subtabs">' + Object.keys(KIND_LABEL).map((k) => '<button type="button" class="mk-sub' + (sellKind === k ? ' on' : '') + '" data-k="' + k + '">' + KIND_ICON[k] + KIND_LABEL[k] + ' (' + inv[k].length + ')</button>').join('') + '</div>' +
            '<div class="mk-grid">' + (list.length ? list.map((it, i) => '<div class="mk-pick' + (picked(it) ? ' on' : '') + '" data-i="' + i + '">' + itemCard(it, ' ／ 最低 ' + fmt(minOf(it.kind, it.data))) + '</div>').join('') : '<div class="mk-empty">出品できる' + KIND_LABEL[sellKind] + 'がありません</div>') + '</div>' +
            '<div class="mk-sellbox"><div>選択中：<b>' + sel.length + '</b> 点　最低価格の合計：<b>' + fmt(min) + '</b> コイン</div>' +
            '<input id="sellTitle" type="text" maxlength="30" placeholder="タイトル（空なら自動）"><input id="sellPrice" type="number" min="1" step="1" placeholder="価格（コイン）" value="' + (min || '') + '">' +
            '<div class="mk-note" id="sellNet"></div><button type="button" class="btn btn-primary" id="sellGo"' + (sel.length ? '' : ' disabled') + '>出品する</button></div>';
        body.querySelectorAll('.mk-sub').forEach((b) => b.addEventListener('click', () => { sellKind = b.dataset.k; renderSell(); }));
        body.querySelectorAll('.mk-pick').forEach((c) => c.addEventListener('click', () => {
            const it = list[+c.dataset.i], k = sel.findIndex((x) => x.data.id === it.data.id);
            if (k >= 0) sel.splice(k, 1); else if (sel.length < info.maxItems) sel.push(it); else toast(reasonText({ reason: 'too_many', max: info.maxItems }), true);
            const keep = { t: $('sellTitle').value, p: $('sellPrice').value }; renderSell(); $('sellTitle').value = keep.t; if (keep.p && Number(keep.p) >= min) $('sellPrice').value = keep.p; updateNet();
        }));
        const updateNet = () => { const v = Math.floor(Number($('sellPrice').value)) || 0; $('sellNet').textContent = v ? '手数料 ' + fmt(v * info.feeRate) + ' コイン引いて、受け取りは ' + fmt(v - Math.floor(v * info.feeRate)) + ' コイン' : ''; };
        $('sellPrice').addEventListener('input', updateNet); updateNet();
        $('sellGo').addEventListener('click', submitSell);
    }

    async function renderMine() {
        const body = $('marketBody'); if (!body) return;
        body.innerHTML = '読み込み中…';
        const p = player(), res = await call('market:mine', { playerId: p ? String(p.id) : '' });
        if (!res.ok) { body.innerHTML = '<div class="mk-empty">' + esc(reasonText(res)) + '</div>'; return; }
        if (!res.rows.length) { body.innerHTML = '<div class="mk-empty">出品中のアイテムはありません</div>'; return; }
        body.innerHTML = res.rows.map((l) => '<div class="mk-row"><div><b>' + esc(l.title) + '</b> <small>' + l.count + '点</small><br>💰 ' + fmt(l.price) + (l.status === 'reserved' ? ' ／ 購入手続き中' : '') + '</div>' +
            '<button type="button" class="btn" data-id="' + l.id + '"' + (l.status === 'reserved' ? ' disabled' : '') + '>取り下げる</button></div>').join('');
        body.querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', async () => {
            b.disabled = true; const r = await call('market:cancel', { playerId: String(p.id), listingId: b.dataset.id });
            if (!r.ok) { toast(reasonText(r), true); renderMine(); return; }
            await claimMail(true); toast('取り下げました。アイテムは手元に戻りました'); renderMine();
        }));
    }
    async function renderMail() {
        const body = $('marketBody'); if (!body) return;
        body.innerHTML = '確認中…';
        const n = await claimMail(false);
        body.innerHTML = n ? '<div class="mk-empty">受け取りを完了しました（' + n + ' 件）。ログは上のメッセージを確認してください</div>' : '<div class="mk-empty">新しい受け取りはありません</div>';
        updateCoins();
    }

    // ---------- 起動 ----------
    async function open() {
        const r = await call('market:info', {}); if (r.ok) info = r;
        render(); await flushOutbox(); await resumePending(); await claimMail(false); updateCoins();
        if (tab === 'browse') renderBrowse();
    }
    function init() {
        // 市場の画面が開いたとき（町の建物・メニューのどちらから開いても）に読み込む
        const sec = $('section-market');
        if (sec) new MutationObserver(() => { if (sec.classList.contains('active')) open(); }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        // 接続できたら、送り損ねた出品・確認を再送し、受け取り箱を確認する
        const sync = () => flushOutbox().then(resumePending).then(() => claimMail(true));
        const hook = () => { if (window.socket && !window.socket.__mk) { window.socket.__mk = true; window.socket.on('connect', () => setTimeout(sync, 1500)); if (window.socket.connected) setTimeout(sync, 3000); } };
        hook(); setTimeout(hook, 2000); setTimeout(hook, 6000);
    }
    window.SBMarket = { open: open, claimMail: claimMail };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
