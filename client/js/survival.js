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
    let chests = [], plots = [], nTable = {}, nCells = {}, shopNear = null;
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
        pos: () => ({ x: pred.x, y: pred.y }), nid: () => me.nid || 0, table: () => nTable, running: () => joined,
        nearShop: () => (shopNear ? shopNear[0] : null), refreshView: () => {}, toast: (t) => toast(t), msg: (t, e) => msg(t, e)
    };

    function playerData() { try { return typeof getPlayerData === 'function' ? getPlayerData() : null; } catch (e) { return null; } }
    function unlocked() { try { return !!(window.HW && window.HW.load().world2); } catch (e) { return false; } }
    function msg(t, err) { const m = $('svMsg'); if (!m) return; m.textContent = t; m.className = 'sv-msg' + (err ? ' err' : ''); clearTimeout(msg._t); if (t) msg._t = setTimeout(() => { m.textContent = ''; }, 4000); }

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
        // 装備を持ち込むかの確認（再接続のときは聞かずに、前回と同じく持ち込む）
        let carry = [];
        const gear = gatherCarry();
        if (gear.length) {
            const bring = resume || window.confirm('【装備の持ち込み】\n装備中の ' + gear.length + ' 点（' + gear.map(itemLabel).slice(0, 4).join('、') + (gear.length > 4 ? ' ほか' : '') + '）をサーバーに預けて持ち込みます。\n\n・PvPで倒されると、持ち込んだ装備の中から1つランダムに奪われます\n・相手を倒すと、相手の持ち込み装備を1つ奪えます\n・町へ戻ると、預けた装備（奪った装備も）が戻ります\n・ロック中／神話の装備は持ち込まれず、安全です\n\nOK：持ち込んで入る　キャンセル：次の確認へ');
            if (bring) carry = gear;
            else if (!window.confirm('装備を持ち込まずに入りますか？\n（装備は安全ですが、敵を倒す以外では何も得られず、相手の装備を奪うこともできません）')) { goTown(); return; }
        }
        cvs = $('svCanvas'); ctx = cvs.getContext('2d'); mini = $('svMini'); mctx = mini.getContext('2d');
        running = true; resize();
        let stats = {}; try { stats = getBattleStats(p) || {}; } catch (e) { /* 申告できない場合は初期値 */ }
        let w = null; try { w = (window.HW.load().weapons || []).find((x) => x.id === window.HW.load().equipped) || window.HW.getEquipped(window.HW.load()); } catch (e) { /* 素手扱い */ }
        const payload = {
            playerId: String(p.id), name: p.name, level: p.level || 1, avatar: p.avatar || null,
            stats: { maxHp: stats.maxHp || p.maxHp || 100, atk: stats.atk || p.atk || 10, def: stats.def || p.def || 0 },
            weapon: w ? { id: w.id, type: w.type, pct: w.pct || 0, name: (window.HW.displayName ? window.HW.displayName(w) : w.name) } : { type: 'fist', pct: 0, name: '素手' },
            items: carry.map((it) => ({ kind: it.kind, eq: it.eq, data: it.data }))
        };
        window.socket.timeout(10000).emit('survival:join', payload, (err, res) => {
            if (err || !res) { failEnter('参加できませんでした（通信エラー）'); return; }
            if (!res.ok) { failEnter(res.reason === 'full' ? 'いまは満員です（最大' + res.max + '人）。少し待ってからもう一度' : res.reason === 'already' ? 'まだ前回の戦闘の余韻が残っています。少し待ってからもう一度' : 'うまく参加できませんでした'); return; }
            joined = true; myEid = res.me.eid; roster.clear(); res.roster.forEach((r) => roster.set(r.eid, r));
            if (res.nation) { nTable = res.nation.table || {}; nCells = res.nation.cells || {}; }
            if (res.carried && res.carried.length) removeCarried(res.carried);        // 預かりが確定してから、手元から外す
            attach(); lastT = performance.now(); raf = requestAnimationFrame(frame);
            sendTimer = setInterval(sendInput, SEND_MS);
            msg(res.carried && res.carried.length ? '装備 ' + res.carried.length + ' 点を持ち込んだ。倒されると1つ奪われる——でも、相手の装備も奪える！' : '次元の裂け目に降り立った。ここは完全PvP——周りの人にも、敵にも気をつけて！');
        });
    }
    // 画面を離れた／閉じた：戦闘中でも体を残して退出（装備は、時間が来たら受け取り箱へ戻る）
    function stop() {
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
    function goTown() { stop(); if (typeof window.activateSection === 'function') window.activateSection('town', true); }

    // ---------- 受信 ----------
    function bindSocket() {
        const s = window.socket; if (!s || s.__sv) return; s.__sv = true;
        s.on('survival:snap', onSnap);
        s.on('survival:joined', (r) => roster.set(r.eid, r));
        s.on('nation:view', (v) => { nTable = v.table || {}; nCells = v.cells || {}; });
        s.on('nation:note', (t) => { feedLines.push({ t: t, at: performance.now() }); if (feedLines.length > 6) feedLines.shift(); msg(t); });
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
        const seenP = new Set(), seenM = new Set();
        d.p.forEach((a) => { seenP.add(a[0]); const e = ents.p.get(a[0]) || { x: a[1], y: a[2] }; e.tx = a[1]; e.ty = a[2]; e.dir = a[3]; e.hp = a[4]; e.fl = a[5]; e.nid = a[8] | 0; ents.p.set(a[0], e); });
        d.m.forEach((a) => { seenM.add(a[0]); const e = ents.m.get(a[0]) || { x: a[2], y: a[3] }; e.icon = a[1]; e.tx = a[2]; e.ty = a[3]; e.hp = a[4]; e.boss = a[5]; e.r = a[6]; e.name = a[7]; e.nid = a[9] | 0; e.kind = a[10] || ''; e.rx = a[11]; e.ry = a[12]; e.cargo = a[13] | 0; ents.m.set(a[0], e); });
        ents.p.forEach((_, k) => { if (!seenP.has(k)) ents.p.delete(k); });
        ents.m.forEach((_, k) => { if (!seenM.has(k)) ents.m.delete(k); });
        projs = d.b; chests = d.c || []; plots = d.st || [];
        d.ev.forEach((e) => {
            if (e[0] === 'h') floats.push({ x: e[1], y: e[2], text: '' + e[3], col: e[4] ? '#ff6a6a' : '#ffffff', at: performance.now() });
            else if (e[0] === 'd') floats.push({ x: e[1], y: e[2], text: '✨', col: '#ffd84a', at: performance.now() });
            else if (e[0] === 'o') floats.push({ x: e[1], y: e[2] - 10, text: '🎁', col: '#ffd84a', at: performance.now(), big: true });
        });
        if (!wasDead && me.dead) shake = 12;
    }

    // ---------- 入力 ----------
    function moveVec() {
        let x = 0, y = 0;
        if (keys.ArrowLeft || keys.a || keys.A) x -= 1; if (keys.ArrowRight || keys.d || keys.D) x += 1;
        if (keys.ArrowUp || keys.w || keys.W) y -= 1; if (keys.ArrowDown || keys.s || keys.S) y += 1;
        x += stick.x; y += stick.y;
        const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
        return { x: x, y: y };
    }
    function nearestFoe(maxD) {
        let best = null, bd = maxD;
        ents.m.forEach((e) => { if (!wantFoe(e)) return; const d = Math.hypot(e.x - pred.x, e.y - pred.y); if (d < bd) { bd = d; best = e; } });
        ents.p.forEach((e) => { if ((e.fl & 1) || isFriendNid(e.nid)) return; const d = Math.hypot(e.x - pred.x, e.y - pred.y); if (d < bd) { bd = d; best = e; } });
        return best;
    }
    function aimAngle() {
        if (touchAtk.on) { const f = nearestFoe(420); if (f) return Math.atan2(f.y - pred.y, f.x - pred.x); return lastDir; }
        if (mouse.on) { const w = cvs.clientWidth, h = cvs.clientHeight; return Math.atan2(mouse.y - h / 2, mouse.x - w / 2); }
        const f = nearestFoe(300); if (f) return Math.atan2(f.y - pred.y, f.x - pred.x);
        return lastDir;
    }
    function using() { return !!(keys.e || keys.E || keys.f || keys.F || touchUse.on); }
    function chestNear() { let best = null, bd = 85; chests.forEach((c) => { if (c[4]) return; const d = Math.hypot(c[1] - pred.x, c[2] - pred.y); if (d < bd) { bd = d; best = c; } }); return best; }
    function attacking() { return !!(keys[' '] || keys.j || keys.J || mouse.down || touchAtk.on); }
    function sendInput() {
        if (!joined || !window.socket.connected) return;
        const v = moveVec(); const aim = aimAngle(); if (v.x || v.y) lastDir = Math.atan2(v.y, v.x);
        window.socket.volatile.emit('survival:input', { mx: v.x, my: v.y, aim: aim, atk: attacking() && !me.dead, use: using() && !me.dead, seq: ++seq });
    }
    const kd = (e) => { if (!running) return; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault(); keys[e.key] = true; };
    const ku = (e) => { keys[e.key] = false; };
    function attach() {
        window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('resize', resize);
        cvs.addEventListener('mousemove', mm); cvs.addEventListener('mousedown', md); window.addEventListener('mouseup', mu); cvs.addEventListener('mouseleave', () => { mouse.on = false; });
        const z = $('svStickZone'); z.addEventListener('touchstart', ts, { passive: false }); z.addEventListener('touchmove', tm, { passive: false }); z.addEventListener('touchend', te); z.addEventListener('touchcancel', te);
        const u = $('svUseBtn'); u.addEventListener('touchstart', (e) => { e.preventDefault(); touchUse.on = true; }, { passive: false }); u.addEventListener('touchend', () => { touchUse.on = false; }); u.addEventListener('touchcancel', () => { touchUse.on = false; });
        const a = $('svAtkBtn'); a.addEventListener('touchstart', (e) => { e.preventDefault(); touchAtk.on = true; }, { passive: false }); a.addEventListener('touchend', () => { touchAtk.on = false; }); a.addEventListener('touchcancel', () => { touchAtk.on = false; });
    }
    function detach() { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('mouseup', mu); Object.keys(keys).forEach((k) => { keys[k] = false; }); stick.x = stick.y = 0; touchAtk.on = false; touchUse.on = false; mouse.down = false; }
    function rel(e) { const r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function mm(e) { const p = rel(e); mouse.x = p.x; mouse.y = p.y; mouse.on = true; }
    function md(e) { const p = rel(e); mouse.x = p.x; mouse.y = p.y; mouse.on = true; mouse.down = true; }
    function mu() { mouse.down = false; }
    function ts(e) { e.preventDefault(); const t = e.changedTouches[0]; stick.id = t.identifier; const r = $('svStickZone').getBoundingClientRect(); stick.ox = r.left + r.width / 2; stick.oy = r.top + r.height / 2; tm(e); }
    function tm(e) {
        e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === stick.id) {
            const dx = t.clientX - stick.ox, dy = t.clientY - stick.oy, l = Math.hypot(dx, dy), m = 46;
            stick.x = l > 6 ? dx / Math.max(l, m) : 0; stick.y = l > 6 ? dy / Math.max(l, m) : 0; if (l > m) { stick.x = dx / l; stick.y = dy / l; }
            const k = $('svStickKnob'); if (k) k.style.transform = 'translate(' + (stick.x * 36) + 'px,' + (stick.y * 36) + 'px)';
        }
    }
    function te(e) { for (const t of e.changedTouches) if (t.identifier === stick.id) { stick.id = null; stick.x = stick.y = 0; const k = $('svStickKnob'); if (k) k.style.transform = ''; } }
    function resize() { if (!cvs) return; const w = cvs.parentElement.clientWidth, h = cvs.parentElement.clientHeight; cvs.width = Math.max(320, w); cvs.height = Math.max(240, h); }

    // ---------- 描画ループ ----------
    function frame(now) {
        if (!running) return;
        const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
        // 自分の予測移動
        if (!me.dead) { const v = moveVec(); if (v.x || v.y) { const r = SW.resolve(pred.x + v.x * SPEED * dt, pred.y + v.y * SPEED * dt, PR); pred.x = r.x; pred.y = r.y; } }
        const k = 1 - Math.pow(0.0005, dt);
        ents.p.forEach((e) => { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; });
        ents.m.forEach((e) => { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; });
        draw(now); raf = requestAnimationFrame(frame);
    }
    function draw(now) {
        const W = cvs.width, H = cvs.height, cx = pred.x, cy = pred.y;
        ctx.save();
        if (shake > 0.5) { ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake *= 0.85; }
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
        ctx.translate(Math.round(W / 2 - cx), Math.round(H / 2 - cy));
        const x0 = cx - W / 2, y0 = cy - H / 2, x1 = cx + W / 2, y1 = cy + H / 2, T = 200;
        // 地面（ゾーンごとの色）
        for (let gx = Math.floor(x0 / T) * T; gx < x1; gx += T) for (let gy = Math.floor(y0 / T) * T; gy < y1; gy += T) {
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
        // 遺跡（ダンジョン）の床と名前
        SW.RUINS.forEach((r) => {
            if (r.x + r.r < x0 || r.x - r.r > x1 || r.y + r.r < y0 || r.y - r.r > y1) return;
            ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.2832); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.55, 0, 6.2832); ctx.stroke();
            ctx.font = '700 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = TIER_COL[r.tier]; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
            const label = '🏛 ' + r.name + '（危険度 ' + r.tier + '）'; ctx.strokeText(label, r.x, r.y - r.r - 16); ctx.fillText(label, r.x, r.y - r.r - 16);
        });
        // 障害物（遺跡の石壁は丸石で描く）
        ctx.textBaseline = 'middle';
        SW.obstaclesNear(cx, cy, Math.hypot(W, H) / 2 + 60).forEach((o) => {
            if (o.t === 'wall') { ctx.fillStyle = '#5c5c6a'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#7b7b8c'; ctx.beginPath(); ctx.arc(o.x - 5, o.y - 6, o.r * 0.55, 0, 6.2832); ctx.fill(); return; }
            ctx.font = Math.round(o.r * 2.2) + 'px sans-serif'; ctx.fillText(OBS_ICON[o.t] || '🪨', o.x, o.y);
        });
        // 宝箱
        chests.forEach((c) => {
            if (!c[4]) { ctx.fillStyle = 'rgba(255,216,74,.18)'; ctx.beginPath(); ctx.arc(c[1], c[2], 26 + Math.sin(now / 300) * 3, 0, 6.2832); ctx.fill(); }
            ctx.globalAlpha = c[4] ? 0.35 : 1; ctx.font = (c[5] ? 34 : 28) + 'px sans-serif'; ctx.fillText(c[4] ? '📭' : '📦', c[1], c[2]); ctx.globalAlpha = 1;
        });
        // 国の建物（拠点・店）
        plots.forEach((pl) => {
            ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(pl[1] ? '🏪' : '🏠', pl[2], pl[3]);
            ctx.fillStyle = nCol(pl[4]); ctx.fillRect(pl[2] - 14, pl[3] + 26, 28, 5);
            ctx.font = '700 13px sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = '#fff'; ctx.strokeText(pl[5], pl[2], pl[3] + 46); ctx.fillText(pl[5], pl[2], pl[3] + 46);
        });
        // 貿易船の航路
        ents.m.forEach((e) => { if (e.kind === 'ship' && e.rx) { ctx.strokeStyle = hexA(nCol(e.nid), 0.55); ctx.lineWidth = 3; ctx.setLineDash([12, 12]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.rx, e.ry); ctx.stroke(); ctx.setLineDash([]); } });
        // 敵・国の衛兵・貿易船
        ents.m.forEach((e) => {
            ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.7, e.r, e.r * 0.4, 0, 0, 6.2832); ctx.fill();
            if (e.nid) { ctx.strokeStyle = nCol(e.nid); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.7, e.r * 1.1, e.r * 0.5, 0, 0, 6.2832); ctx.stroke(); }
            ctx.font = Math.round(e.r * 2.3) + 'px sans-serif'; ctx.fillText(e.icon, e.x, e.y);
            bar(e.x, e.y - e.r - 12, e.r * 2, e.hp, e.nid ? (isFriendNid(e.nid) ? '#4adf7a' : '#ff9a3a') : (e.boss ? '#ff4a4a' : '#e05555'));
            if (e.nid) {
                ctx.font = '700 13px sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = relColor(e.nid, false);
                const lb = nTag(e.nid) + e.name + (e.kind === 'ship' ? '（積荷 ' + e.cargo.toLocaleString('ja-JP') + '）' : '');
                ctx.strokeText(lb, e.x, e.y - e.r - 18); ctx.fillText(lb, e.x, e.y - e.r - 18);
            }
            if (e.boss) { ctx.font = '700 16px sans-serif'; ctx.fillStyle = '#ffb0b0'; ctx.fillText(e.name, e.x, e.y - e.r - 26); }
        });
        // 他のプレイヤー
        ents.p.forEach((e, id) => drawPerson(e.x, e.y, e.dir, Object.assign({}, roster.get(id) || { name: '???', level: 1 }, { nid: e.nid }), e.hp, e.fl, false, now));
        drawPerson(pred.x, pred.y, me.dead ? 0 : (attacking() ? aimAngle() : lastDir), { name: (playerData() || {}).name || '自分', level: (playerData() || {}).level || 1, avatar: (playerData() || {}).avatar, nid: me.nid }, Math.round(me.hp / Math.max(1, me.mhp) * 100), (me.dead ? 1 : 0) | (me.inv ? 2 : 0), true, now);
        // 弾
        projs.forEach((b) => { ctx.fillStyle = b[3] ? '#ff5a5a' : '#8fe0ff'; ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke(); });
        // ダメージ数字
        ctx.textBaseline = 'alphabetic';
        floats = floats.filter((f) => now - f.at < 900);
        floats.forEach((f) => { const a = 1 - (now - f.at) / 900; ctx.globalAlpha = a; ctx.font = '700 ' + (f.big ? 22 : 16) + 'px sans-serif'; ctx.fillStyle = f.col; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; const y = f.y - (1 - a) * 36; ctx.strokeText(f.text, f.x, y); ctx.fillText(f.text, f.x, y); ctx.globalAlpha = 1; });
        ctx.restore();
        hud(now);
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
        // 城と城下町（建国前の土地は「建国できる土地」）
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        SW.SITES.forEach((st) => {
            if (st.x < x0 - 400 || st.x > x1 + 400 || st.y < y0 - 400 || st.y > y1 + 400) return;
            const o = own(Math.floor(st.x / CELL), Math.floor(st.y / CELL)); const nat = nTable[Object.keys(nTable).find((k) => nTable[k].site === st.id)];
            const nid = Number(Object.keys(nTable).find((k) => nTable[k].site === st.id)) || 0;
            if (!nid) {
                ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(st.x, st.y, SW.TOWN_R, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
                ctx.font = '48px sans-serif'; ctx.fillText('🏕️', st.x, st.y);
                ctx.font = '700 18px sans-serif'; ctx.fillStyle = '#e6e6e6'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; const l = st.name + '（未開の地：建国できる）'; ctx.strokeText(l, st.x, st.y - 70); ctx.fillText(l, st.x, st.y - 70);
                return;
            }
            const col = nCol(nid);
            ctx.fillStyle = hexA(col, 0.18); ctx.beginPath(); ctx.arc(st.x, st.y, SW.TOWN_R, 0, 6.2832); ctx.fill();
            ctx.strokeStyle = hexA(col, 0.8); ctx.lineWidth = 4; ctx.stroke();
            for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832 + st.id, r = SW.TOWN_R * (0.62 + (i % 3) * 0.12); ctx.font = '30px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(i % 4 === 0 ? '🏪' : '🏠', st.x + Math.cos(a) * r, st.y + Math.sin(a) * r); }
            ctx.font = '96px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('🏰', st.x, st.y - 6);
            ctx.fillStyle = col; ctx.fillRect(st.x - 3, st.y - 92, 6, 6);
            ctx.font = '700 22px sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.fillStyle = col; const nm = '🚩 ' + (nat ? nat.name : '？'); ctx.strokeText(nm, st.x, st.y - 84); ctx.fillText(nm, st.x, st.y - 84);
        });
        ctx.textBaseline = 'middle';
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
    function hud(now) {
        const z = SW.zoneAt(pred.x, pred.y), safe = SW.inSafe(pred.x, pred.y);
        $('svHpFill').style.width = Math.max(0, Math.min(100, me.hp / Math.max(1, me.mhp) * 100)) + '%';
        $('svHpText').textContent = Math.max(0, me.hp) + ' / ' + me.mhp;
        $('svZone').textContent = (safe ? '🛡 ' : '⚠ ') + z.name + (z.tier ? '（危険度 ' + z.tier + '）' : '');
        $('svStats').textContent = '⚔ キル ' + me.kills + '　💀 死亡 ' + me.deaths + '　💰 +' + me.coins + '　🎒 ' + (me.cr || 0) + '点　👥 ' + online + '人';
        const ci = me.ci || { o: 0, iv: 0, by: 0, lk: 0 }, tt = $('svTerr');
        if (tt) {
            let tx = '', tc = '#fff';
            if (ci.o) {
                const nm = nTable[ci.o] ? nTable[ci.o].name : '？';
                if (ci.o === me.nid) { tx = '🏰 自国の領地（' + nm + '）'; tc = '#9fffb5'; }
                else if (isAlly(ci.o)) { tx = '🤝 同盟国の領地（' + nm + '）'; tc = '#7fc8ff'; }
                else { tx = (isWarNid(ci.o) ? '⚔ 敵国の領地（' + nm + '）' : '🚩 ' + nm + 'の領地'); tc = isWarNid(ci.o) ? '#ff8080' : '#ffe9a0'; }
                if (ci.iv > 0) tx += '　侵略度 ' + ci.iv + '%' + (ci.by === me.nid ? '（占領中！）' : (ci.o === me.nid || isAlly(ci.o) ? '（奪われかけている！）' : ''));
                else if (ci.lk && isWarNid(ci.o)) tx += '　首都は最後まで落ちません';
            }
            tt.textContent = tx; tt.style.color = tc; tt.style.display = tx ? 'block' : 'none';
        }
        // 近くの店
        shopNear = null; plots.forEach((pl) => { if (pl[1] && !me.dead && Math.hypot(pl[2] - pred.x, pl[3] - pred.y) < 200) shopNear = pl; });
        const sb = $('svShopBtn'); if (sb) { sb.style.display = shopNear ? 'block' : 'none'; if (shopNear) sb.textContent = '🛒 ' + shopNear[5] + ' を見る'; }
        const cb = $('svCombat'); cb.style.display = (me.cb > 0 && !me.dead) ? 'block' : 'none'; cb.textContent = '戦闘中 ' + me.cb + 's（離脱不可）';
        const dead = $('svDead'); dead.style.display = me.dead ? 'flex' : 'none'; if (me.dead) dead.querySelector('b').textContent = me.rs;
        const near = chestNear(), pr = $('svPrompt');
        pr.style.display = (near && !me.dead) ? 'block' : 'none'; pr.textContent = me.ch > 0 ? '開けています… ' + Math.round(me.ch * 100) + '%（動くと中断）' : ((near && near[5]) ? '📦 遺跡の宝箱：' : '📦 宝箱：') + 'E / 🎁ボタン を押し続けて開ける';
        const lag = $('svLag'); lag.style.display = (performance.now() - lastSnapAt > 1500 && joined) ? 'block' : 'none';
        feedLines = feedLines.filter((f) => now - f.at < 7000);
        $('svFeed').innerHTML = feedLines.map((f) => '<div>' + String(f.t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) + '</div>').join('');
        // ミニマップ
        const S = mini.width, sc = S / SW.SIZE; mctx.clearRect(0, 0, S, S);
        SW.ZONES.slice().reverse().forEach((zz, i, arr) => { mctx.fillStyle = zz.color; mctx.beginPath(); mctx.arc(S / 2, S / 2, Math.min(zz.max, SW.SIZE * 0.7) * sc, 0, 6.2832); mctx.fill(); });
        mctx.strokeStyle = 'rgba(255,255,255,.4)'; mctx.strokeRect(0.5, 0.5, S - 1, S - 1);
        SW.RUINS.forEach((r) => { mctx.fillStyle = TIER_COL[r.tier]; mctx.fillRect(r.x * sc - 3, r.y * sc - 3, 6, 6); });
        { const GN = SW.GN, c = S / GN; Object.keys(nCells).forEach((k) => { const i = Number(k); mctx.fillStyle = hexA(nCol(nCells[k]), 0.55); mctx.fillRect((i % GN) * c, Math.floor(i / GN) * c, c + 0.5, c + 0.5); }); }
        SW.SITES.forEach((st) => { mctx.fillStyle = '#fff'; mctx.fillRect(st.x * sc - 2, st.y * sc - 2, 4, 4); });
        mctx.fillStyle = '#ffe066'; ents.m.forEach((e) => { if (e.kind === 'ship') mctx.fillRect(e.x * sc - 2, e.y * sc - 2, 4, 4); });
        mctx.fillStyle = '#ff5a5a'; SW.NESTS.forEach((n) => mctx.fillRect(n.x * sc - 2, n.y * sc - 2, 4, 4));
        mctx.fillStyle = '#ffb04a'; ents.p.forEach((e) => mctx.fillRect(e.x * sc - 2, e.y * sc - 2, 4, 4));
        mctx.fillStyle = '#4adf7a'; mctx.beginPath(); mctx.arc(pred.x * sc, pred.y * sc, 3.5, 0, 6.2832); mctx.fill();
    }

    // ---------- 起動 ----------
    function init() {
        const sec = $('section-survival'); if (!sec) return;
        bindSocket(); setTimeout(bindSocket, 2000); setTimeout(bindSocket, 6000);
        new MutationObserver(() => { if (sec.classList.contains('active')) start(false); else stop(); }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        $('svLeave').addEventListener('click', leaveClicked);
        window.addEventListener('beforeunload', () => { if (joined) { try { window.socket.emit('survival:leave', { force: true }); } catch (e) { /* 切断扱い */ } } });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
