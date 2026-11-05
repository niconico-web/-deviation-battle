// ============================================================
// survival.js ― サバイバルエリアのクライアント（描画・操作・HUD）
//  計算はすべてサーバー。ここは「入力を送る」「届いた状態を描く」だけ。
//  自分の移動だけは、操作の遅れを感じないよう手元でも先に動かして（予測）、サーバーの位置にゆっくり合わせる
// ============================================================
(function () {
    'use strict';
    const SW = window.SurvivalWorld;
    if (!SW) return;
    const $ = (id) => document.getElementById(id);
    const SPEED = 240, PR = 14, SEND_MS = 50;
    const OBS_ICON = { tree: '🌲', rock: '🪨', crystal: '💎', pillar: '🗼' };

    let running = false, joined = false, raf = 0, sendTimer = 0, lastT = 0, cvs = null, ctx = null, mini = null, mctx = null;
    let me = { x: SW.CX, y: SW.CY, hp: 1, mhp: 1, dead: false, rs: 0, inv: false, kills: 0, deaths: 0, coins: 0, cb: 0 };
    let pred = { x: SW.CX, y: SW.CY }, serverMe = null, myEid = 0, seq = 0, lastDir = 0;
    const roster = new Map(), ents = { p: new Map(), m: new Map() };
    let projs = [], floats = [], feedLines = [], online = 1, lastSnapAt = 0, shake = 0;
    const keys = {}, mouse = { x: 0, y: 0, on: false }, stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 }, touchAtk = { on: false }, touchUse = { on: false };
    let chests = [], plots = [], nTable = {}, nCells = {}, shopNear = null, arts = [], fxs = [], hint = '', wName = '', pgs = [], ptOwner = [];
    const TIER_COL = { 1: '#8fe08f', 2: '#ffd84a', 3: '#ff8aff' };

    // ---------- 国（色・味方判定・領地） ----------
    const hexA = (h, a) => { const n = parseInt(String(h || '#888888').slice(1), 16) || 0x888888; return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
    const nCol = (nid) => (nTable[nid] && nTable[nid].color) || '#bbbbbb';
    const isAlly = (nid) => !!(nid && me.nid && nid !== me.nid && nTable[me.nid] && nTable[me.nid].allies.indexOf(nid) >= 0);
    const isFriendNid = (nid) => !!(nid && me.nid && (nid === me.nid || isAlly(nid)));
    const isWarNid = (nid) => !!(nid && me.nid && nTable[me.nid] && (nTable[me.nid].wars || []).indexOf(nid) >= 0);
    function relColor(nid, isMe) { if (isMe) return '#9fffb5'; if (!nid) return '#ffffff'; if (nid === me.nid) return '#9fffb5'; if (isAlly(nid)) return '#7fc8ff'; if (isWarNid(nid)) return '#ff8080'; return '#ffffff'; }
    const nTag = (nid) => (nid && nTable[nid] ? '【' + nTable[nid].name + '】' : '');
    // 自動照準で狙ってよい相手（味方・中立の衛兵は狙わない。貿易船は襲える）
    function wantFoe(e) { if (!e.nid) return true; if (isFriendNid(e.nid)) return false; if (e.kind === 'ship') return true; return isWarNid(e.nid); }
    window.SBSurvival = {
        pos: () => ({ x: pred.x, y: pred.y }), cells: () => nCells, arts: () => arts, aim: () => aimAngle(), nid: () => me.nid || 0, table: () => nTable, running: () => joined,
        nearShop: () => (shopNear ? shopNear[0] : null), refreshView: () => {}, toast: (t) => toast(t), msg: (t, e) => msg(t, e)
    };

    function playerData() { try { return typeof getPlayerData === 'function' ? getPlayerData() : null; } catch (e) { return null; } }
    function unlocked() { try { return !!(window.HW && window.HW.load().world2); } catch (e) { return false; } }
    const sTxt = (el, v) => { if (el && el._v !== v) { el._v = v; el.textContent = v; } };
    const sHtml = (el, v) => { if (el && el._h !== v) { el._h = v; el.innerHTML = v; } };
    function msg(t, err) { if (window.SVHud) SVHud.announce(t, 3200); return; }
    function msgOld(t, err) { const m = $('svMsg'); if (!m) return; m.textContent = t; m.className = 'sv-msg' + (err ? ' err' : ''); clearTimeout(msg._t); if (t) msg._t = setTimeout(() => { m.textContent = ''; }, 4000); }

    // ---------- 入口（町の「次元の裂け目」から） ----------
    window.openSurvival = function () {
        if (!unlocked()) { alert('次元の裂け目は、第二世界に到達すると開きます。\n（第一世界の最終ゲートを突破しよう）'); return; }
        if (typeof window.activateSection === 'function') window.activateSection('survival', true);
    };
    window.isSurvivalUnlocked = unlocked;

    // ---------- 持ち込み装備 ----------
    //  装備中のうち「ロックなし・神話でない」ものを、サーバーに預けて持ち込む（出るときに返る）
    function gatherCarry() {
        const H = window.HW, d = H.load(), out = [];
        const ok = (x) => x && !x.locked && x.rarity !== 'mythic' && !x.mythicId;
        const w = (d.weapons || []).find((x) => x.id === d.equipped); if (ok(w)) out.push({ kind: 'weapon', eq: 'weapon', data: w });
        Object.keys(d.armorEq || {}).forEach((slot) => { const a = (d.armors || []).find((x) => x.id === d.armorEq[slot]); if (ok(a)) out.push({ kind: 'armor', eq: 'armor:' + slot, data: a }); });
        (d.accEq || []).forEach((id) => { const a = id && (d.accs || []).find((x) => x.id === id); if (ok(a)) out.push({ kind: 'acc', eq: 'acc', data: a }); });
        return out;
    }
    // ステージと同じ「スキル構成」を、サーバーへ申告する（数値はサーバーが範囲内に直す）
    function collectSkills() {
        const out = [];
        try {
            if (!window.ActionSkills) return out;
            ActionSkills.loadLoadout().slice(0, 4).forEach((sk) => {
                if (!sk || !ActionSkills.isFormUnlocked(sk.form)) { out.push(null); return; }
                const c = ActionSkills.compute(sk), p = {};
                Object.keys(c.params || {}).forEach((k) => { const v = c.params[k]; if (typeof v === 'number' || (Array.isArray(v) && k === 'pieces')) p[k] = v; });
                p.custom = !!(c.params && c.params.custom);
                out.push({ name: sk.name, form: sk.form, cost: c.cost, cooldown: c.cooldown, effects: sk.effects || [], params: p });
            });
        } catch (e) { /* スキルなしで参加 */ }
        return out;
    }
    function itemLabel(it) { const x = it.data; return x.name || ((x.prefix || '') + (x.baseName || '')) || '装備'; }
    // サーバーが預かりを確定したものだけを、手元から外す
    function removeCarried(ids) {
        const set = new Set(ids), H = window.HW, d = H.load();
        d.weapons = (d.weapons || []).filter((x) => !set.has(x.id)); d.armors = (d.armors || []).filter((x) => !set.has(x.id)); d.accs = (d.accs || []).filter((x) => !set.has(x.id));
        if (set.has(d.equipped)) d.equipped = null;
        Object.keys(d.armorEq || {}).forEach((k) => { if (set.has(d.armorEq[k])) delete d.armorEq[k]; });
        if (Array.isArray(d.accEq)) d.accEq = d.accEq.map((id) => (set.has(id) ? null : id));
        H.save(d);
    }
    function toast(text) {
        const el = document.createElement('div');
        el.textContent = text; el.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1a1f3af0;color:#fff;padding:10px 16px;border-radius:12px;z-index:10000;max-width:86vw;text-align:center;font-size:.9rem;border:1px solid #6a5acd';
        document.body.appendChild(el); setTimeout(() => el.remove(), 5000);
    }

    // ---------- 開始／終了 ----------
    function failEnter(text) { running = false; msg(text, true); setTimeout(goTown, 2500); }
    function start(resume) {
        if (running) return;
        const p = playerData();
        if (!p) { msg('キャラクターデータがありません', true); return; }
        if (!window.socket || !window.socket.connected) { failEnter('サーバーに接続できません。通信できる状態でもう一度'); return; }
        // 出撃準備（武器・持ち込む装備・スキルの確認）。再接続のときは聞かずに、前回と同じく持ち込む
        if (resume || !window.SVHud) { enter(p, gatherCarry()); return; }
        running = true;
        window.SVHud.prepare(gatherCarry).then((sel) => { running = false; if (sel === null) { goTown(); return; } enter(p, sel); });
    }
    function enter(p, carry) {
        if (running) return;
        cvs = $('svCanvas'); ctx = cvs.getContext('2d'); mini = document.createElement('canvas'); mini.width = 140; mini.height = 140; mctx = mini.getContext('2d');
        running = true; resize();
        let stats = {}; try { stats = getBattleStats(p) || {}; } catch (e) { /* 申告できない場合は初期値 */ }
        let w = null; try { w = (window.HW.load().weapons || []).find((x) => x.id === window.HW.load().equipped) || window.HW.getEquipped(window.HW.load()); } catch (e) { /* 素手扱い */ }
        wName = w ? (window.HW.displayName ? window.HW.displayName(w) : w.name) : '素手';
        const payload = {
            playerId: (function () { try { const n = window.SeasonSys && window.SeasonSys.netId && window.SeasonSys.netId(); if (n) return String(n); } catch (e) { /* 通常のID */ } return String(p.id); })(), name: p.name, level: p.level || 1, avatar: p.avatar || null,
            stats: { maxHp: stats.maxHp || p.maxHp || 100, atk: stats.atk || p.atk || 10, def: stats.def || p.def || 0 },
            special: stats.special || p.special || 0,
            skills: collectSkills(),
            weapon: w ? { id: w.id, type: w.type, pct: w.pct || 0, name: (window.HW.displayName ? window.HW.displayName(w) : w.name) } : { type: 'fist', pct: 0, name: '素手' },
            items: carry.map((it) => ({ kind: it.kind, eq: it.eq, data: it.data }))
        };
        window.socket.timeout(10000).emit('survival:join', payload, (err, res) => {
            if (err || !res) { failEnter('参加できませんでした（通信エラー）'); return; }
            if (!res.ok) { failEnter(res.reason === 'full' ? 'いまは満員です（最大' + res.max + '人）。少し待ってからもう一度' : res.reason === 'already' ? 'まだ前回の戦闘の余韻が残っています。少し待ってからもう一度' : 'うまく参加できませんでした'); return; }
            joined = true; myEid = res.me.eid; roster.clear(); res.roster.forEach((r) => roster.set(r.eid, r));
            if (res.nation) { nTable = res.nation.table || {}; nCells = res.nation.cells || {}; ptOwner = res.nation.pts || []; nVer++; }
            if (window.SVHud) { SVHud.mount(res, { aim: aimAngle, town: leaveClicked, shop: openShopMenu }); SVHud.bindInput(cvs); }
            if (res.carried && res.carried.length) removeCarried(res.carried);        // 預かりが確定してから、手元から外す
            attach(); lastT = performance.now(); raf = requestAnimationFrame(frame);
            sendTimer = setInterval(sendInput, SEND_MS);
            msg(res.carried && res.carried.length ? '装備 ' + res.carried.length + ' 点を持ち込んだ。倒されると1つ奪われる——でも、相手の装備も奪える！' : '次元の裂け目に降り立った。ここは完全PvP——周りの人にも、敵にも気をつけて！');
        });
    }
    // 画面を離れた／閉じた：戦闘中でも体を残して退出（装備は、時間が来たら受け取り箱へ戻る）
    function stop() {
        if (window.SVHud) SVHud.unmount();
        if (!running && !joined) return;
        running = false; cancelAnimationFrame(raf); clearInterval(sendTimer); detach();
        if (joined && window.socket) {
            try { window.socket.emit('survival:leave', { force: true }, (res) => { if (res && res.ok) afterExit(res); }); } catch (e) { /* 切断扱い */ }
        }
        joined = false; ents.p.clear(); ents.m.clear(); projs = []; floats = []; feedLines = [];
    }
    // 退出が済んだあと：預けていた装備を受け取り箱から取り込む
    function afterExit(res) {
        if (res && res.returned && window.SBMarket) {
            window.SBMarket.claimMail(true).then(() => toast('🎒 預けていた装備 ' + res.returned + ' 点を持ち帰りました')).catch(() => {});
        } else if (res && res.ghost) toast('戦闘直後のため、体が少しその場に残ります。装備は少し後に戻ります（町でしばらく待つと戻ります）');
    }
    function leaveClicked() {
        if (!joined) { goTown(); return; }
        window.socket.timeout(8000).emit('survival:leave', {}, (err, res) => {
            if (!err && res && res.ok) { joined = false; afterExit(res); goTown(); }
            else if (res && res.reason === 'combat') msg('戦闘中は離脱できません（あと ' + res.wait + ' 秒）', true);
            else msg('離脱できませんでした。もう一度', true);
        });
    }
    function goTown() { stop(); if (typeof window.activateSection === 'function') window.activateSection('town', true); else setTimeout(() => { location.href = 'index.html'; }, 150); }

    // ---------- 受信 ----------
    function bindSocket() {
        const s = window.socket; if (!s || s.__sv) return; s.__sv = true;
        s.on('survival:snap', onSnap);
        s.on('survival:joined', (r) => roster.set(r.eid, r));
        s.on('nation:view', (v) => { nTable = v.table || {}; nCells = v.cells || {}; ptOwner = v.pts || ptOwner; nVer++; });
        s.on('survival:notice', (t) => { msg(t); });
        s.on('nation:note', (t) => { if (window.SVHud) SVHud.pushFeed(t); msg(t); });
        s.on('survival:left', (r) => { roster.delete(r.eid); ents.p.delete(r.eid); });
        s.on('survival:feed', (t) => { feedLines.push({ t: t, at: performance.now() }); if (feedLines.length > 6) feedLines.shift(); });
        s.on('survival:reward', (r) => {
            const pl = playerData(); if (!pl) return;
            pl.coins = (pl.coins || 0) + (r.coins | 0);
            try { localStorage.setItem('player', JSON.stringify(pl)); if (typeof syncPlayerToServer === 'function') syncPlayerToServer(true); } catch (e) { /* 次回同期 */ }
            floats.push({ x: pred.x, y: pred.y - 50, text: '+' + r.coins + '💰', col: '#ffd84a', at: performance.now(), big: true });
        });
        s.on('survival:loot', (r) => {
            const list = r.items.map((i) => i.rarity + '「' + i.name + '」').join('、');
            msg('🎁 ' + r.src + '：' + list + ' を手に入れた！（町へ戻ると手元に届きます／倒されると奪われることも）');
            toast('🎁 ' + r.src + '\n' + r.items.map((i) => '・' + i.rarity + ' ' + i.name).join('\n'));
            floats.push({ x: pred.x, y: pred.y - 70, text: '🎁 ×' + r.items.length, col: '#7dffb0', at: performance.now(), big: true });
        });
        s.on('survival:steal', (r) => {
            if (r.role === 'killer') { msg('🎒 ' + r.other + ' の「' + r.name + '」を奪った！　町へ戻ると手に入ります（奪い返されることも…）'); floats.push({ x: pred.x, y: pred.y - 60, text: '🎒 奪取！', col: '#7dffb0', at: performance.now(), big: true }); }
            else { msg('💀 ' + r.other + ' に「' + r.name + '」を奪われた…', true); shake = 14; }
        });
        s.on('connect', () => {
            if (!running) return;
            // 再接続：サーバー側では別人扱いになる。戻ってきた装備を受け取ってから、もう一度参加する
            running = false; joined = false; clearInterval(sendTimer); cancelAnimationFrame(raf); detach();
            const again = () => { const sec = $('section-survival'); if (sec && sec.classList.contains('active')) start(true); };
            if (window.SBMarket) window.SBMarket.claimMail(true).then(again, again); else again();
        });
        s.on('disconnect', () => { if (running) msg('接続が切れました。つながり次第、再参加します…', true); });
    }
    function onSnap(d) {
        lastSnapAt = performance.now();
        const wasDead = me.dead; me = d.me; online = d.online;
        if (!serverMe || Math.hypot(me.x - pred.x, me.y - pred.y) > 140 || me.dead) { pred.x = me.x; pred.y = me.y; }
        else { pred.x += (me.x - pred.x) * 0.12; pred.y += (me.y - pred.y) * 0.12; }
        serverMe = me;
        if (window.SVHud) SVHud.update(me);
        const seenP = new Set(), seenM = new Set();
        d.p.forEach((a) => { seenP.add(a[0]); const e = ents.p.get(a[0]) || { x: a[1], y: a[2] }; e.tx = a[1]; e.ty = a[2]; e.dir = a[3]; e.hp = a[4]; e.fl = a[5]; e.nid = a[8] | 0; ents.p.set(a[0], e); });
        d.m.forEach((a) => { seenM.add(a[0]); const e = ents.m.get(a[0]) || { x: a[2], y: a[3] }; e.icon = a[1]; e.tx = a[2]; e.ty = a[3]; e.hp = a[4]; e.boss = a[5]; e.r = a[6]; e.name = a[7]; e.nid = a[9] | 0; e.kind = a[10] || ''; e.rx = a[11]; e.ry = a[12]; e.cargo = a[13] | 0; ents.m.set(a[0], e); });
        ents.p.forEach((_, k) => { if (!seenP.has(k)) ents.p.delete(k); });
        ents.m.forEach((_, k) => { if (!seenM.has(k)) ents.m.delete(k); });
        projs = d.b; chests = d.c || []; if (d.st) plots = d.st; if (d.ar) arts = d.ar; pgs = d.pg || [];
        d.ev.forEach((e) => {
            if (e[0] === 'h') floats.push({ x: e[1], y: e[2], text: '' + e[3], col: e[4] ? '#ff6a6a' : '#ffffff', at: performance.now() });
            else if (e[0] === 'd') floats.push({ x: e[1], y: e[2], text: '✨', col: '#ffd84a', at: performance.now() });
            else if (e[0] === 'k') addFx(e);
            else if (e[0] === 'o') floats.push({ x: e[1], y: e[2] - 10, text: '🎁', col: '#ffd84a', at: performance.now(), big: true });
        });
        if (!wasDead && me.dead) shake = 12;
    }

    // ---------- 入力（ステージと同じ：SVHud が受け持つ） ----------
    function moveVec() { return SVHud.moveVec(); }
    function nearestFoe(maxD) {
        let best = null, bd = maxD;
        ents.m.forEach((e) => { if (!wantFoe(e)) return; const d = Math.hypot(e.x - pred.x, e.y - pred.y); if (d < bd) { bd = d; best = e; } });
        ents.p.forEach((e) => { if ((e.fl & 1) || isFriendNid(e.nid)) return; const d = Math.hypot(e.x - pred.x, e.y - pred.y); if (d < bd) { bd = d; best = e; } });
        return best;
    }
    function aimAngle() { return SVHud.aimAngle(nearestFoe, pred, lastDir, window.innerWidth, window.innerHeight); }
    function using() { return SVHud.using(); }
    function attacking() { return SVHud.attacking(); }
    function chestNear() { let best = null, bd = 85; chests.forEach((c) => { if (c[4]) return; const d = Math.hypot(c[1] - pred.x, c[2] - pred.y); if (d < bd) { bd = d; best = c; } }); return best; }
    function sendInput() {
        if (!joined || !window.socket.connected) return;
        const v = moveVec(); const aim = aimAngle(); if (v.x || v.y) lastDir = Math.atan2(v.y, v.x);
        window.socket.volatile.emit('survival:input', { mx: v.x, my: v.y, aim: aim, atk: attacking() && !me.dead, use: using() && !me.dead, ult: SVHud.ultHeld(), seq: ++seq });
    }
    function attach() { window.addEventListener('resize', resize); }
    function detach() { window.removeEventListener('resize', resize); }
    // 描画の細かさ（RS）。重い端末では、自動で下げて軽くする（ドット絵なので、粗くしても見た目はあまり変わらない）
    let RS = Math.max(0.5, Math.min(1, parseFloat(localStorage.getItem('svRS')) || Math.min(1, 1100 / Math.max(1, window.innerWidth)))), slowAcc = 0, slowN = 0, fpsAt = 0;
    function resize() { if (!cvs) return; const w = window.innerWidth, h = window.innerHeight; cvs.width = Math.max(320, Math.round(w * RS)); cvs.height = Math.max(240, Math.round(h * RS)); cvs.style.width = '100%'; cvs.style.height = '100%'; }

    // ---------- 描画ループ ----------
    function frame(now) {
        if (!running) return;
        const real = now - lastT, dt = Math.min(0.05, real / 1000); lastT = now;
        slowAcc += real; slowN++;
        if (now - fpsAt > 2500) { const avg = slowAcc / Math.max(1, slowN); fpsAt = now; slowAcc = 0; slowN = 0; if (avg > 27 && RS > 0.5) { RS = Math.max(0.5, +(RS - 0.15).toFixed(2)); try { localStorage.setItem('svRS', String(RS)); } catch (e) { /* 保存できなくてもよい */ } resize(); } }
        // 自分の予測移動
        if (!me.dead) { const v = moveVec(); if (v.x || v.y) { const r = SW.resolve(pred.x + v.x * SPEED * dt, pred.y + v.y * SPEED * dt, PR); pred.x = r.x; pred.y = r.y; } }
        const k = 1 - Math.pow(0.0005, dt);
        ents.p.forEach((e) => { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; });
        ents.m.forEach((e) => { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; });
        draw(now); raf = requestAnimationFrame(frame);
    }
    function draw(now) {
        const W = cvs.width / RS, H = cvs.height / RS, cx = pred.x, cy = pred.y;
        ctx.save();
        ctx.setTransform(RS, 0, 0, RS, 0, 0);
        if (shake > 0.5) { ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake *= 0.85; }
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
        ctx.translate(Math.round(W / 2 - cx), Math.round(H / 2 - cy));
        const x0 = cx - W / 2, y0 = cy - H / 2, x1 = cx + W / 2, y1 = cy + H / 2, T = 200;
        // 地面：ドット絵のパターンで一気に塗る（地下は迷路の床）
        const dgi = me.dgi >= 0 ? me.dgi : -1, usePx = window.SVPix && SVPix.on();
        if (dgi >= 0) { if (usePx) SVPix.dungeonFloor(ctx, SW.RUINS[dgi]); else { ctx.fillStyle = '#2a2940'; ctx.fillRect(x0, y0, W, H); } }
        else if (usePx) SVPix.ground(ctx, Math.max(0, x0), Math.max(0, y0), Math.min(SW.SIZE, x1), Math.min(SW.SIZE, y1), SW.zoneAt);
        else for (let gx = Math.floor(x0 / T) * T; gx < x1; gx += T) for (let gy = Math.floor(y0 / T) * T; gy < y1; gy += T) {
            if (gx < 0 || gy < 0 || gx >= SW.SIZE || gy >= SW.SIZE) { ctx.fillStyle = '#05030a'; ctx.fillRect(gx, gy, T, T); continue; }
            const z = SW.zoneAt(gx + T / 2, gy + T / 2); ctx.fillStyle = z.color; ctx.fillRect(gx, gy, T, T);
            ctx.fillStyle = z.dot; for (let i = 0; i < 4; i++) { const hx = gx + ((gx * 7 + gy * 13 + i * 61) % T), hy = gy + ((gx * 11 + gy * 5 + i * 97) % T); ctx.fillRect(hx, hy, 3, 3); }
        }
        // 領地（国ごとの色）と、城・城下町
        drawTerritory(x0, y0, x1, y1, now);
        // 安全地帯の輪
        ctx.strokeStyle = 'rgba(160,140,255,.55)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.arc(SW.CX, SW.CY, SW.SAFE_R, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '700 22px sans-serif'; ctx.fillStyle = 'rgba(190,175,255,.9)'; ctx.textAlign = 'center'; ctx.fillText('🛡 安全地帯（PvP不可）', SW.CX, SW.CY - SW.SAFE_R - 12);
        SW.NESTS.forEach((n) => { if (n.x > x0 - 200 && n.x < x1 + 200 && n.y > y0 - 200 && n.y < y1 + 200) { ctx.strokeStyle = 'rgba(255,90,90,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n.x, n.y, 230, 0, 6.2832); ctx.stroke(); ctx.fillStyle = 'rgba(255,140,140,.9)'; ctx.fillText('☠ ' + n.name + 'の巣', n.x, n.y - 250); } });
        // ダンジョンの入り口・階段・神殿・落ちている神器
        ctx.textBaseline = 'middle';
        const inV = (x, y, m) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
        // 拠点（占領ポイント）
        if (dgi < 0) SW.POINTS.forEach((q) => {
            if (!q.cap && inV(q.x, q.y, 320)) {
                const o = ptOwner[q.id] | 0, pg = pgs.find((g) => g[0] === q.id);
                SVPix.point(ctx, q, o && nTable[o] ? nTable[o].color : '#9a9a9a', pg ? pg[2] : 0, pg && pg[1] ? nCol(pg[1]) : '#ff5a8a', now, q.name + (o && nTable[o] ? '（' + nTable[o].name + '）' : ''), o === me.nid);
            }
        });
        if (dgi < 0) {
            SW.DUNGEONS.forEach((d) => { if (d.entrance && inV(d.entrance.x, d.entrance.y, 200)) SVPix.gate(ctx, d.entrance.x, d.entrance.y, '🏛 ' + d.name + '（危険度 ' + d.tier + '）[E]', '#6a5acd'); });
            SW.SHRINES.forEach((h, i) => { if (inV(h.x, h.y, 200)) SVPix.shrine(ctx, h.x, h.y, h.name, !arts[i] || arts[i][1] === 0, now); });
        } else {
            const R = SW.RUINS[dgi];
            if (R.up) SVPix.stairs(ctx, R.up.x, R.up.y, true, now);
            if (R.down) SVPix.stairs(ctx, R.down.x, R.down.y, false, now);
        }
        arts.forEach((a) => { if (a[1] === 2 && inV(a[2], a[3], 100)) SVPix.artifact(ctx, a[2], a[3], ARTI[a[0]] ? ARTI[a[0]][0] : '✨', now, ARTI[a[0]] ? ARTI[a[0]][1] : '神器'); });
        // 障害物（木・岩・水晶・壁をドット絵で）
        if (!obsCache || Math.abs(obsCache.x - cx) > 60 || Math.abs(obsCache.y - cy) > 60 || now - obsCache.at > 400 || obsCache.W !== W) obsCache = { x: cx, y: cy, at: now, W: W, list: SW.obstaclesNear(cx, cy, Math.hypot(W, H) / 2 + 160) };
        obsCache.list.forEach((o) => {
            if (o.x < x0 - 70 || o.x > x1 + 70 || o.y < y0 - 90 || o.y > y1 + 70) return;
            if (usePx) { SVPix.obstacle(ctx, o); return; }
            if (o.t === 'wall') { ctx.fillStyle = '#5c5c6a'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#7b7b8c'; ctx.beginPath(); ctx.arc(o.x - 5, o.y - 6, o.r * 0.55, 0, 6.2832); ctx.fill(); return; }
            ctx.font = Math.round(o.r * 2.2) + 'px sans-serif'; ctx.fillText(OBS_ICON[o.t] || '🪨', o.x, o.y);
        });
        // 宝箱
        chests.forEach((c) => {
            if (!c[4]) { ctx.fillStyle = 'rgba(255,216,74,.18)'; ctx.beginPath(); ctx.arc(c[1], c[2], 26 + Math.sin(now / 300) * 3, 0, 6.2832); ctx.fill(); }
            if (usePx) { ctx.globalAlpha = c[4] ? 0.4 : 1; SVPix.chest(ctx, c[1], c[2], !!c[4], c[3] || 1); ctx.globalAlpha = 1; }
            else { ctx.globalAlpha = c[4] ? 0.35 : 1; ctx.font = (c[5] ? 34 : 28) + 'px sans-serif'; ctx.fillText(c[4] ? '📭' : '📦', c[1], c[2]); ctx.globalAlpha = 1; }
        });
        // 国の建物（拠点・ショップ・ギャンブル場など）
        plots.forEach((pl) => { if (usePx) SVPix.plot(ctx, pl[2], pl[3], pl[1], nCol(pl[4]), pl[5]); });
        // 貿易船の航路
        ents.m.forEach((e) => { if (e.kind === 'ship' && e.rx) { ctx.strokeStyle = hexA(nCol(e.nid), 0.55); ctx.lineWidth = 3; ctx.setLineDash([12, 12]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.rx, e.ry); ctx.stroke(); ctx.setLineDash([]); } });
        // 敵・国の衛兵・貿易船
        ents.m.forEach((e) => {
            if (!inV(e.x, e.y, 80)) return;
            ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.7, e.r, e.r * 0.4, 0, 0, 6.2832); ctx.fill();
            if (e.nid) { ctx.strokeStyle = nCol(e.nid); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.7, e.r * 1.1, e.r * 0.5, 0, 0, 6.2832); ctx.stroke(); }
            let drawn = false;
            if (usePx) {
                if (e.kind === 'ship') { SVPix.ship(ctx, e.x, e.y, nCol(e.nid), 0); drawn = true; }
                else if (e.nid) { SVPix.soldier(ctx, e.x, e.y, nCol(e.nid), 0, true, e.name); drawn = true; }
                else drawn = SVPix.monster(ctx, e, now, pred.x);
            }
            if (!drawn) { ctx.font = Math.round(e.r * 2.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.icon, e.x, e.y); }
            bar(e.x, e.y - e.r - 12, e.r * 2, e.hp, e.nid ? (isFriendNid(e.nid) ? '#4adf7a' : '#ff9a3a') : (e.boss ? '#ff4a4a' : '#e05555'));
            if (e.nid) {
                ctx.font = '700 13px sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = relColor(e.nid, false);
                const lb = nTag(e.nid) + e.name + (e.kind === 'ship' ? '（積荷 ' + e.cargo.toLocaleString('ja-JP') + '）' : '');
                ctx.strokeText(lb, e.x, e.y - e.r - 18); ctx.fillText(lb, e.x, e.y - e.r - 18);
            }
            if (e.boss) { ctx.font = '700 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffb0b0'; ctx.fillText(e.name, e.x, e.y - e.r - 26); }
        });
        // 他のプレイヤー
        ents.p.forEach((e, id) => drawPerson(e.x, e.y, e.dir, Object.assign({}, roster.get(id) || { name: '???', level: 1 }, { nid: e.nid }), e.hp, e.fl, false, now));
        drawPerson(pred.x, pred.y, me.dead ? 0 : (attacking() ? aimAngle() : lastDir), { name: (playerData() || {}).name || '自分', level: (playerData() || {}).level || 1, avatar: (playerData() || {}).avatar, nid: me.nid }, Math.round(me.hp / Math.max(1, me.mhp) * 100), (me.dead ? 1 : 0) | (me.inv ? 2 : 0), true, now);
        // 弾
        projs.forEach((b) => { if (usePx && SVPix.bullet(ctx, b[0], b[1], b[2], b[3] ? '#ff5a5a' : '#8fe0ff', 0, 0)) return; ctx.fillStyle = b[3] ? '#ff5a5a' : '#8fe0ff'; ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke(); });
        drawFx(now);
        // ダメージ数字
        ctx.textBaseline = 'alphabetic';
        floats = floats.filter((f) => now - f.at < 900);
        floats.forEach((f) => { const a = 1 - (now - f.at) / 900; ctx.globalAlpha = a; ctx.font = '700 ' + (f.big ? 22 : 16) + 'px sans-serif'; ctx.fillStyle = f.col; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; const y = f.y - (1 - a) * 36; ctx.strokeText(f.text, f.x, y); ctx.fillText(f.text, f.x, y); ctx.globalAlpha = 1; });
        ctx.restore();
        // 画面の上に：ミニマップ（右上）とスティック（ステージと同じ）
        ctx.setTransform(RS, 0, 0, RS, 0, 0);
        { const mw = H < 420 ? 96 : 130, mx = W - mw - 12, my = H < 420 ? 34 : 52; if (me.dgi < 0 && mini) { ctx.globalAlpha = 0.9; ctx.drawImage(mini, mx, my, mw, mw); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mw); } }
        if (window.SVHud) SVHud.drawSticks(ctx);
        hud(now);
    }
    let obsCache = null;
    const townCache = {};
    function townHouses(st) {
        if (townCache[st.id]) return townCache[st.id];
        const out = [], R = SW.TOWN_R, rows = [[0.30, 8], [0.46, 12], [0.62, 18], [0.78, 24], [0.90, 28]];
        let seed = (st.id + 3) * 9301;
        const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        rows.forEach((row, ri) => { for (let i = 0; i < row[1]; i++) { const an = (i + 0.5 * (ri % 2)) / row[1] * 6.2832 + (rnd() - 0.5) * 0.08, r = row[0] * R + (rnd() - 0.5) * 30; out.push([Math.round(st.x + Math.cos(an) * r), Math.round(st.y + Math.sin(an) * r)]); } });
        return (townCache[st.id] = out);
    }
    function drawTerritory(x0, y0, x1, y1, now) {
        const CELL = SW.CELL, GN = SW.GN;
        const cx0 = Math.max(0, Math.floor(x0 / CELL)), cx1 = Math.min(GN - 1, Math.floor(x1 / CELL)), cy0 = Math.max(0, Math.floor(y0 / CELL)), cy1 = Math.min(GN - 1, Math.floor(y1 / CELL));
        const own = (cx, cy) => (cx < 0 || cy < 0 || cx >= GN || cy >= GN) ? 0 : (nCells[cy * GN + cx] | 0);
        ctx.lineWidth = 5;
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
            const o = own(cx, cy); if (!o) continue;
            const x = cx * CELL, y = cy * CELL, col = nCol(o);
            ctx.fillStyle = hexA(col, 0.14); ctx.fillRect(x, y, CELL, CELL);
            ctx.strokeStyle = hexA(col, 0.75);
            if (own(cx, cy - 1) !== o) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); ctx.stroke(); }
            if (own(cx, cy + 1) !== o) { ctx.beginPath(); ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
            if (own(cx - 1, cy) !== o) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); ctx.stroke(); }
            if (own(cx + 1, cy) !== o) { ctx.beginPath(); ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
        }
        // 城と城下町（建国前の土地は「建国できる土地」）。城下町は広い（半径 TOWN_R）
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const TR = SW.TOWN_R;
        SW.SITES.forEach((st) => {
            if (st.x < x0 - TR - 200 || st.x > x1 + TR + 200 || st.y < y0 - TR - 200 || st.y > y1 + TR + 200) return;
            const nid = Number(Object.keys(nTable).find((k) => nTable[k].site === st.id)) || 0, nat = nTable[nid];
            if (!nid) {
                ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 6; ctx.setLineDash([30, 24]); ctx.beginPath(); ctx.arc(st.x, st.y, TR, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
                ctx.font = '120px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('🏕️', st.x, st.y);
                ctx.font = '700 40px sans-serif'; ctx.fillStyle = '#e6e6e6'; ctx.strokeStyle = '#000'; ctx.lineWidth = 6; const l = st.name + '（未開の地：建国できる）'; ctx.strokeText(l, st.x, st.y - 190); ctx.fillText(l, st.x, st.y - 190);
                return;
            }
            const col = nCol(nid);
            ctx.fillStyle = hexA(col, 0.16); ctx.beginPath(); ctx.arc(st.x, st.y, TR, 0, 6.2832); ctx.fill();
            ctx.strokeStyle = '#4a4660'; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(st.x, st.y, TR, 0, 6.2832); ctx.stroke();
            ctx.strokeStyle = hexA(col, 0.85); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(st.x, st.y, TR - 18, 0, 6.2832); ctx.stroke();
            const hs = townHouses(st);
            for (let i = 0; i < hs.length; i++) { const h = hs[i]; if (h[0] > x0 - 80 && h[0] < x1 + 80 && h[1] > y0 - 80 && h[1] < y1 + 80) SVPix.house(ctx, h[0], h[1], col, i); }
            SVPix.castle(ctx, st.x, st.y, col);
            ctx.font = '700 60px sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 8; ctx.fillStyle = col; const nm = '🚩 ' + (nat ? nat.name : '？'); ctx.strokeText(nm, st.x, st.y - 380); ctx.fillText(nm, st.x, st.y - 380);
        });
        ctx.textBaseline = 'middle';
    }
    const ARTI = [['🔥', 'フェニックスの翼'], ['⚡', '雷神の槌'], ['❄️', '氷結の王冠'], ['🌋', '大地の心臓'], ['🌀', '虚空の鏡'], ['🏆', '生命の聖杯'], ['⏳', '時の砂時計']];
    // スキル・神器・必殺技の演出（サーバーの 'k' イベント）。ドット絵らしく、角のある四角と線で描く
    const FXLIFE = { w: 0.26, p: 0.2, l: 0.35, s: 0.3, n: 0.5, t: 0.3, m: 0.9, o: 3, u: 8, f: 0.3, b: 1.2, d: 6, g: 2.2, fb: 1.2 };
    function addFx(e) { if (fxs.length > 80) fxs.shift(); fxs.push({ k: e[1], x: e[2], y: e[3], a: e[4] / 100, p1: e[5], p2: e[6], p3: e[7], at: performance.now() }); }
    function drawFx(now) {
        const col = { 0: '#ffd27a', 1: '#c9e8ff', 2: '#9fe0ff', 3: '#b080ff', 4: '#9fffb5', 5: '#fff2a0' };
        fxs = fxs.filter((f) => (now - f.at) / 1000 < (f.k === 'u' || f.k === 'o' || f.k === 'd' ? f.p2 / 100 || FXLIFE[f.k] : (f.k === 'm' ? f.p2 / 100 + 0.3 : (FXLIFE[f.k] || 0.4))));
        fxs.forEach((f) => {
            const t = (now - f.at) / 1000, k = f.k; ctx.save(); ctx.translate(f.x, f.y);
            if (k === 'l' || k === 't' || k === 'f') { ctx.rotate(f.a); const a = Math.max(0, 1 - t / 0.35); ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; ctx.fillRect(0, -f.p2 / 2, f.p1, f.p2); ctx.fillStyle = 'rgba(120,200,255,' + (a * 0.6) + ')'; ctx.fillRect(0, -f.p2 / 2 - 4, f.p1, 4); ctx.fillRect(0, f.p2 / 2, f.p1, 4); }
            else if (k === 's') { ctx.rotate(f.a); const a = Math.max(0, 1 - t / 0.3), arc = f.p2 / 100; ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 14; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(0, 0, f.p1 * 0.85, -arc / 2, arc / 2); ctx.stroke(); }
            else if (k === 'n') { const a = Math.max(0, 1 - t / 0.5), r = f.p1 * Math.min(1, t / 0.18 + 0.1); ctx.strokeStyle = col[f.a] || '#fff'; ctx.globalAlpha = a; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.stroke(); ctx.fillStyle = col[f.a] || '#fff'; ctx.globalAlpha = a * 0.25; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill(); }
            else if (k === 'm') { const w = f.p2 / 100; if (t < w) { ctx.strokeStyle = 'rgba(255,90,90,.7)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, f.p1, 0, 6.2832); ctx.stroke(); } else { const a = Math.max(0, 1 - (t - w) / 0.3); ctx.fillStyle = 'rgba(255,200,120,' + a + ')'; ctx.beginPath(); ctx.arc(0, 0, f.p1, 0, 6.2832); ctx.fill(); } }
            else if (k === 'w') {                                   // 武器の通常攻撃（斬る・突く・叩く・広がる・撃つ）
                const u = Math.min(1, t / 0.22), a = 1 - u, R = f.p2 || 80; ctx.rotate(f.a);
                if (f.p1 === 1) { ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 12; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(0, 0, R * 0.85, -0.9 + u * 1.5, -0.9 + u * 1.5 + 0.7); ctx.stroke(); ctx.strokeStyle = 'rgba(160,210,255,' + (a * 0.7) + ')'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, R * 0.7, -0.9 + u * 1.5, -0.9 + u * 1.5 + 0.7); ctx.stroke(); }
                else if (f.p1 === 2) { ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; ctx.fillRect(10, -6, R * Math.min(1, u * 2), 12); }
                else if (f.p1 === 3 || f.p1 === 4) { ctx.rotate(-f.a); ctx.strokeStyle = 'rgba(255,230,160,' + a + ')'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, R * (0.3 + u * 0.7), 0, 6.2832); ctx.stroke(); }
                else { ctx.fillStyle = 'rgba(255,240,180,' + a + ')'; ctx.beginPath(); ctx.arc(26, 0, 14 * a + 4, 0, 6.2832); ctx.fill(); }
            }
            else if (k === 'fb') { ctx.rotate(f.a); const d = f.p3 / 100, u = Math.min(1, t / d), x = f.p1 * u; ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.arc(x, 0, 62, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, 0, 38, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, 0, 16, 0, 6.2832); ctx.fill(); }
            else if (k === 'd' || k === 'b') { const life = (k === 'd' ? f.p2 / 100 : 1.2), a = Math.max(0, 1 - t / life); ctx.strokeStyle = k === 'd' ? 'rgba(150,100,255,' + (0.5 * a + 0.2) + ')' : 'rgba(255,120,120,' + a + ')'; ctx.lineWidth = 6; ctx.setLineDash([16, 10]); ctx.beginPath(); ctx.arc(0, 0, f.p1, t * 0.5, t * 0.5 + 6.2832); ctx.stroke(); if (k === 'd') { ctx.fillStyle = 'rgba(80,40,160,' + (0.14 * a) + ')'; ctx.beginPath(); ctx.arc(0, 0, f.p1, 0, 6.2832); ctx.fill(); } }
            else if (k === 'g') { const a = Math.max(0, 1 - t / 2.2); ctx.strokeStyle = 'rgba(160,230,255,' + (0.6 * a) + ')'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, f.p1, 0, 6.2832); ctx.stroke(); }
            ctx.restore();
        });
    }
    // ---------- ミニマップ（重いので、土台は1枚の絵に取っておく） ----------
    let miniBase = null, miniKey = '', miniAt = 0, nVer = 0;
    function drawMini(now) {
        if (now - miniAt < 100 || !mini) return; miniAt = now;
        const S = mini.width, sc = S / SW.SIZE;
        if (!miniBase || miniKey !== String(nVer)) {
            miniKey = String(nVer);
            miniBase = document.createElement('canvas'); miniBase.width = S; miniBase.height = S;
            const g = miniBase.getContext('2d');
            SW.ZONES.slice().reverse().forEach((zz) => { g.fillStyle = zz.color; g.beginPath(); g.arc(S / 2, S / 2, Math.min(zz.max, SW.SIZE * 0.7) * sc, 0, 6.2832); g.fill(); });
            g.strokeStyle = 'rgba(255,255,255,.4)'; g.strokeRect(0.5, 0.5, S - 1, S - 1);
            const GN = SW.GN, c = S / GN;
            Object.keys(nCells).forEach((k) => { const i = Number(k); g.fillStyle = hexA(nCol(nCells[k]), 0.55); g.fillRect((i % GN) * c, Math.floor(i / GN) * c, c + 0.5, c + 0.5); });
            SW.POINTS.forEach((q) => { const o = ptOwner[q.id] | 0; g.fillStyle = o && nTable[o] ? nTable[o].color : '#bbb'; const z = q.cap ? 6 : 3; g.fillRect(q.x * sc - z / 2, q.y * sc - z / 2, z, z); if (q.cap) { g.strokeStyle = '#fff'; g.strokeRect(q.x * sc - z / 2 - 1, q.y * sc - z / 2 - 1, z + 2, z + 2); } });
            SW.DUNGEONS.forEach((d) => { if (d.entrance) { g.fillStyle = '#b08aff'; g.fillRect(d.entrance.x * sc - 3, d.entrance.y * sc - 3, 6, 6); } });
            g.fillStyle = '#ff5a5a'; SW.NESTS.forEach((n) => g.fillRect(n.x * sc - 2, n.y * sc - 2, 4, 4));
        }
        mctx.clearRect(0, 0, S, S); mctx.drawImage(miniBase, 0, 0);
        SW.SHRINES.forEach((h, i) => { mctx.fillStyle = (!arts[i] || arts[i][1] === 0) ? '#ffd24a' : '#665a2a'; mctx.fillRect(h.x * sc - 2, h.y * sc - 2, 4, 4); });
        arts.forEach((a) => { if (a[1] === 1 || a[1] === 2) { mctx.fillStyle = '#fff'; mctx.fillRect(a[2] * sc - 3, a[3] * sc - 3, 6, 6); mctx.strokeStyle = '#ffd24a'; mctx.strokeRect(a[2] * sc - 5, a[3] * sc - 5, 10, 10); } });
        mctx.fillStyle = '#ffe066'; ents.m.forEach((e) => { if (e.kind === 'ship') mctx.fillRect(e.x * sc - 2, e.y * sc - 2, 4, 4); });
        mctx.fillStyle = '#ffb04a'; ents.p.forEach((e) => mctx.fillRect(e.x * sc - 2, e.y * sc - 2, 4, 4));
        if (me.dgi < 0) { mctx.fillStyle = '#4adf7a'; mctx.beginPath(); mctx.arc(pred.x * sc, pred.y * sc, 3.5, 0, 6.2832); mctx.fill(); }
    }
    function bar(x, y, w, pct, col) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2, y, w, 5); ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(100, pct)) / 100, 5); }
    function drawPerson(x, y, dir, info, hpPct, fl, isMe, now) {
        const dead = fl & 1, inv = fl & 2, ghost = fl & 4;
        if (dead) { ctx.font = '28px sans-serif'; ctx.fillText('🪦', x, y); return; }
        ctx.globalAlpha = (inv && Math.floor(now / 120) % 2) ? 0.4 : (ghost ? 0.6 : 1);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 14, 14, 5, 0, 0, 6.2832); ctx.fill();
        if (window.SBPix && SBPix.on && SBPix.on() && SBPix.drawPerson) {
            try { SBPix.drawPerson(ctx, x, y + 10, { avatar: SBPix.cleanAvatar(info.avatar) || SBPix.npcAvatar(info.name || ''), left: Math.cos(dir) < 0, moving: true, scale: 2 }); } catch (e) { circle(x, y, isMe); }
        } else circle(x, y, isMe);
        ctx.globalAlpha = 1;
        const friend = isMe || isFriendNid(info.nid);
        bar(x, y - 34, 40, hpPct, friend ? '#4adf7a' : '#ff7a4a');
        ctx.font = '700 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = relColor(info.nid, isMe); ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        const label = nTag(info.nid) + 'Lv' + (info.level || 1) + ' ' + (info.name || ''); ctx.strokeText(label, x, y - 40); ctx.fillText(label, x, y - 40);
    }
    function circle(x, y, isMe) { ctx.fillStyle = isMe ? '#4adf7a' : '#e0864a'; ctx.beginPath(); ctx.arc(x, y, PR, 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }

    // ---------- HUD ----------
    const LK_TEXT = { 1: '王城は、ほかの拠点を全部奪うまで落ちません', 2: '建国直後の国は守られています', 3: '自分の拠点から遠すぎます（拠点をつなげて近づこう）', 4: 'まだ国がない土地です', 5: '国に入ると占領できます' };
    let lastDeadAnn = 0;
    function hud(now) {
        const z = SW.zoneAt(pred.x, pred.y), safe = SW.inSafe(pred.x, pred.y), ci = me.ci || { o: 0, iv: 0, by: 0, lk: 0, pt: -1, po: 0 };
        let place = (safe ? '🛡 ' : '⚠ ') + z.name + (z.tier ? '（危険度 ' + z.tier + '）' : '');
        if (me.dgi >= 0) place = '🏛 ' + SW.RUINS[me.dgi].name;
        else if (ci.o) place += '　' + (ci.o === me.nid ? '🏰 自国' : (isAlly(ci.o) ? '🤝 同盟国' : (isWarNid(ci.o) ? '⚔ 敵国' : '🚩 ' + (nTable[ci.o] ? nTable[ci.o].name : '？'))));
        // 拠点の占領ゲージ（画面の上のバー）
        let chall = { show: false, text: '', pct: 0 };
        if (me.dgi < 0 && ci.pt >= 0 && !me.dead) {
            const q = SW.POINTS[ci.pt], on = ci.po && nTable[ci.po] ? nTable[ci.po].name : '無主の拠点';
            let tx = '🚩 ' + q.name + '（' + on + '）';
            if (ci.iv > 0) tx += '　占領 ' + ci.iv + '%' + (ci.by && nTable[ci.by] ? '（' + nTable[ci.by].name + '）' : '');
            else if (ci.po === me.nid) tx += '　自国の拠点';
            else if (ci.lk) tx += '　' + LK_TEXT[ci.lk];
            else tx += '　円の中に立つと占領できる';
            chall = { show: true, text: tx, pct: ci.iv, col: ci.by === me.nid ? 'linear-gradient(90deg,#1f9a4a,#6aff9a)' : 'linear-gradient(90deg,#8a1f9a,#ff5a8a)' };
        }
        // 使えるもの（E／「使う」ボタン）
        shopNear = null; plots.forEach((pl) => { if (pl[1] !== 'base' && !me.dead && Math.hypot(pl[2] - pred.x, pl[3] - pred.y) < 220) shopNear = pl; });
        let useLabel = '', hint = '';
        const near = chestNear();
        if (me.ch > 0) { useLabel = '開けています'; hint = '宝箱を開けています… ' + Math.round(me.ch * 100) + '%（動くと中断）'; }
        else if (near && !me.dead) { useLabel = '📦開ける'; hint = 'E（押し続ける）：宝箱を開ける'; }
        else if (me.dgi < 0 && SW.DUNGEONS.some((d) => d.entrance && Math.hypot(d.entrance.x - pred.x, d.entrance.y - pred.y) < 130)) { useLabel = '🏛入る'; hint = 'E：ダンジョンに入る'; }
        else if (me.dgi >= 0 && ((SW.RUINS[me.dgi].up && Math.hypot(SW.RUINS[me.dgi].up.x - pred.x, SW.RUINS[me.dgi].up.y - pred.y) < 90) || (SW.RUINS[me.dgi].down && Math.hypot(SW.RUINS[me.dgi].down.x - pred.x, SW.RUINS[me.dgi].down.y - pred.y) < 90))) { useLabel = '🪜階段'; hint = 'E：階段を使う'; }
        else if (arts.some((a) => a[1] === 2 && Math.hypot(a[2] - pred.x, a[3] - pred.y) < 110)) { useLabel = '✨拾う'; hint = 'E：神器を拾う'; }
        else if (shopNear) { useLabel = '🛒'; hint = '「店」ボタン：' + shopNear[5]; }
        else hint = 'WASD 移動 ／ Space・クリック 攻撃 ／ Z X C V スキル ／ R 必殺・神器 ／ E 使う';
        const lag = performance.now() - lastSnapAt > 1500 && joined;
        const info = { stage: place, wpn: '⚔ ' + wName, timer: '👥 ' + online + '人　💀' + me.deaths + (me.cb > 0 && !me.dead ? '　⚔戦闘中' + me.cb + 's' : '') + (lag ? '　📶遅延' : ''), chall: chall, canUse: !!useLabel, useLabel: useLabel, hint: hint };
        if (window.SVHud) SVHud.update(me, info);
        if (me.dead && now - lastDeadAnn > 900) { lastDeadAnn = now; SVHud.announce('💀 倒された…　復活まで ' + me.rs + ' 秒', 1200); }
        drawMini(now);
    }
    // 「店」ボタン：近くの施設があれば開く。なければ、国の画面の「建築」へ
    function openShopMenu() {
        if (shopNear && window.SBNation) { SBNation.openPlot(shopNear[0]); return; }
        if (window.SBNation) SBNation.open('build');
    }

    // ---------- 起動 ----------
    function init() {
        bindSocket(); setTimeout(bindSocket, 2000); setTimeout(bindSocket, 6000);
        window.addEventListener('beforeunload', () => { if (joined) { try { window.socket.emit('survival:leave', { force: true }); } catch (e) { /* 切断扱い */ } } });
    }
    window.SBSurvival.begin = function () { start(false); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
