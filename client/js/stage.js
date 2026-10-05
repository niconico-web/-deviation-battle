// ============================================================
// ステージ・エンジン (stage.js)
//  ・町(ロビー)から飛んできて「ダンジョン1つ＋ボス1体」を約5分で攻略する
//  ・敵に触れても画面遷移はしない。フィールド上でそのまま攻撃して戦う
//  ・最大4人の協力プレイ（ホストが敵を動かし、他の人は同期された状態を見る）
//  ・装備は hw-weapons.js のハクスラ武器（オーブをはめ込んで強化）
//  ・クイズに正解するとエネルギーが溜まり、Qキーでバースト（全周囲攻撃＋回復）
// ============================================================
(function () {
    'use strict';

    // 画面の向き：スマホは横画面で遊ぶ（縦のときは「横にしてね」案内を出して一時停止する）
    if (window.SBOrientation) SBOrientation.guard();

    // ---------- 起動パラメータ ----------
    let launch = null;
    try { launch = JSON.parse(localStorage.getItem('sbStageLaunch') || 'null'); } catch (e) { launch = null; }
    const stage = launch && window.getStageById ? window.getStageById(launch.stageId) : null;
    const pdata = (typeof getPlayerData === 'function') ? getPlayerData() : null;
    if (!stage || !pdata) {
        alert('ステージ情報かキャラクターデータが見つかりません。町に戻ります。');
        location.href = 'index.html';
        return;
    }
    const hack = HW.load();
    const weapon = HW.getEquipped(hack);
    const agg = HW.aggregate(weapon);
    const A = k => agg.stats[k] || 0;
    const T = HW.TYPES[weapon.type] || HW.TYPES.sword;

    // ---------- 定数 ----------
    const WORLD_W = 2400, WORLD_H = 1600;
    const MAX_PARTY = 4;
    const TIME_LIMIT = 9 * 60;           // 時間切れ
    const KILLS_BASE = 45;               // ボス出現に必要な討伐数（1人）
    const ENEMY_CAP_BASE = 30;
    const ENERGY_MAX = 100;
    const SNAP_HZ = 12;

    // ---------- 乱数・ユーティリティ ----------
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
    function seeded(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

    // ---------- 難易度 ----------
    const DIFFS = window.STAGE_DATA.DIFFS;
    let DIFF = DIFFS[Math.max(0, Math.min(DIFFS.length - 1, parseInt(launch.diff, 10) || 0))];

    // ---------- プレイヤーの戦闘ステータス ----------
    let base = { maxHp: 50, atk: 70, def: 50, speed: 30, special: 50 };
    try { const s = getStatsFromPlayer(pdata, true); if (s) base = Object.assign(base, s); } catch (e) { /* 既定値のまま */ }
    const P = {
        maxHp: Math.round((100 + base.maxHp * 2) * (1 + A('hpPct'))),
        atkMul: (0.6 + base.atk / 150) * (1 + A('atkPct')),
        def: base.def * (1 + A('defPct')),
        move: 235 * (1 + Math.min(base.speed, 300) / 700) * (1 + A('moveSpd')),
        special: base.special,
        cd: T.cd / (1 + A('aspd')),
        range: (T.range || 0) * (1 + A('rangePct')),
        radius: (T.radius || 0) * (1 + A('rangePct')),
        crit: 0.05 + A('critRate') + (T.crit || 0),
        critMul: 1.5 + A('critDmg'),
        dashCd: 1.6 * (1 - Math.min(0.6, A('dashCdr'))),
        energyMul: 1 + A('energyUp')
    };
    // 敵の強さの基準：自分の素の火力(DPS)と、装備HP補正を除いた体力
    const REF_HIT = weapon.dmg * (T.mult || 1) * P.atkMul;
    const REF_DPS = REF_HIT / P.cd * (T.spread || 1);
    const REF_HP = P.maxHp / (1 + A('hpPct'));
    const myId = String(pdata.id || ('p' + Math.random().toString(36).slice(2, 8)));
    const myName = pdata.name || 'あなた';

    // ---------- キャンバス ----------
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let VW = 960, VH = 540, DPR = 1;
    function fit() {
        DPR = Math.min(2, window.devicePixelRatio || 1);
        VW = window.innerWidth; VH = window.innerHeight;
        canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
        canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
    }
    window.addEventListener('resize', fit); fit();

    // ---------- フィールド（障害物の岩）----------
    const rocks = [];
    (function genRocks() {
        const r = seeded(hashStr(stage.id));
        for (let i = 0; i < 18; i++) {
            const x = 150 + r() * (WORLD_W - 300), y = 150 + r() * (WORLD_H - 300);
            if (dist(x, y, WORLD_W / 2, WORLD_H / 2) < 260 || dist(x, y, 220, WORLD_H / 2) < 200) continue;
            rocks.push({ x: x, y: y, r: 26 + r() * 38 });
        }
    })();
    function pushOutOfRocks(o, rad) {
        for (const k of rocks) {
            const d = dist(o.x, o.y, k.x, k.y), m = k.r + rad;
            if (d < m && d > 0.01) { o.x = k.x + (o.x - k.x) / d * m; o.y = k.y + (o.y - k.y) / d * m; }
        }
        o.x = clamp(o.x, rad, WORLD_W - rad); o.y = clamp(o.y, rad, WORLD_H - rad);
    }

    // ---------- 状態 ----------
    const me = { id: myId, name: myName, x: 220 + rnd(-30, 30), y: WORLD_H / 2 + rnd(-60, 60), r: 15, hp: P.maxHp, maxHp: P.maxHp,
        ang: 0, atkCd: 0, dashCd: 0, dashT: 0, dashVX: 0, dashVY: 0, inv: 0, energy: 0, shield: false, haste: 0, dead: false, reviveT: 0, lungeT: 0, combo: 0 };
    const allies = {};           // id -> {id,name,x,y,tx,ty,hp,maxHp,dead,ang,rar}
    let enemies = [];            // ホスト: 実体 / クライアント: スナップショットの描画用
    let eBullets = [];
    let telegraphs = [];
    let myShots = [];            // 自分の弾（命中判定は自分側でやる）
    let fx = [];                 // 見た目の演出
    let popups = [];
    let nextId = 1;
    const run = { phase: 'wait', time: 0, kills: 0, need: KILLS_BASE, bossSpawned: false, bossDead: false, ended: false,
        stats: { kills: 0, dmg: 0, loot: [], coins: 0, orbs: 0, mats: {} } };
    let isHost = true, room = null, socket = null;
    let spawnT = 1.5, snapT = 0, posT = 0;

    // ---------- ネットワーク ----------
    function netSend(t, d) { if (socket && room) socket.emit('stage:relay', { t: t, d: d }); }
    function partyCount() { return 1 + Object.keys(allies).length; }
    function partyScale() { return 1 + 0.65 * (partyCount() - 1); }

    function setupNet() {
        if (typeof io !== 'function') return false;
        socket = io();
        socket.on('connect', () => {
            const payload = { player: { id: myId, name: myName, wname: weapon.name, rar: weapon.rarity }, stageId: stage.id, diff: parseInt(launch.diff, 10) || 0 };
            if (launch.mode === 'create') socket.emit('stage:create', payload);
            else if (launch.mode === 'join') socket.emit('stage:join', Object.assign({ roomId: launch.roomId }, payload));
            else socket.emit('stage:quick', payload);
        });
        socket.on('stage:room', onRoom);
        socket.on('stage:error', (m) => { showWaitMsg((m && m.message) || 'ルームに入れませんでした'); setTimeout(() => { location.href = 'index.html'; }, 1800); });
        socket.on('stage:started', () => { if (run.phase === 'wait') beginRun(); });
        socket.on('stage:msg', onMsg);
        return true;
    }

    // ホストが抜けたとき：最後に受け取った敵の状態を引き継いで、自分が敵を動かす側になる
    function adoptEnemies() {
        enemies = enemies.map(e => {
            const def = e.boss ? { name: stage.boss.name, icon: stage.boss.icon, color: stage.boss.color, arch: 'chaser' }
                : (stage.enemies.find(d => d.name === e.def.name) || stage.enemies[0]);
            const st = enemyStats(def, e.boss, e.elite);
            return { id: e.id, def: def, arch: def.arch, boss: e.boss, elite: !!e.elite, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, dmg: st.dmg, spd: st.spd, r: e.r,
                t: 0, state: 0, st: { burn: 0, burnT: 0, poison: 0, poisonT: 0, slowT: 0, stunT: 0, bleed: 0, bleedT: 0, curseT: 0, weakenT: 0, blindT: 0 }, kx: 0, ky: 0, aim: 0, fuse: 0, patIdx: 0, enraged: e.hp / e.maxHp < 0.5 };
        });
        eBullets.forEach(b => { b.vx = 0; b.vy = 0; b.life = 0; });
        nextId = 100000 + Math.floor(Math.random() * 100000);
        announce('ホストが交代しました', 1600);
    }

    function onRoom(r) {
        room = r;
        DIFF = DIFFS[Math.max(0, Math.min(DIFFS.length - 1, r.diff | 0))];
        el('stageName').textContent = stage.icon + ' ' + stage.name + ' [' + DIFF.name + ']';
        const wasHost = isHost;
        isHost = r.hostId === myId;
        if (!wasHost && isHost && run.phase === 'run') adoptEnemies();
        const ids = r.members.map(m => m.id);
        r.members.forEach(m => { if (m.id !== myId && !allies[m.id]) allies[m.id] = { id: m.id, name: m.name, x: 220, y: WORLD_H / 2, tx: 220, ty: WORLD_H / 2, hp: 100, maxHp: 100, dead: false, ang: 0, rar: m.rar || 'normal', r: 15 }; });
        Object.keys(allies).forEach(id => { if (ids.indexOf(id) < 0) delete allies[id]; });
        if (run.phase === 'wait') renderWait();
        if (r.state === 'playing' && run.phase === 'wait') beginRun();
    }

    function onMsg(m) {
        if (!m || !m.t) return;
        const d = m.d || {};
        const a = allies[m.from];
        switch (m.t) {
            case 'pos':
                if (a) { a.tx = d.x; a.ty = d.y; a.ang = d.a; a.hp = d.hp; a.maxHp = d.mh; a.dead = !!d.dead; }
                break;
            case 'atk':
                if (a) spawnAtkFx(d);
                break;
            case 'hit':
                if (isHost) applyHit(d);
                break;
            case 'bhit':
                if (isHost) eBullets = eBullets.filter(b => b.id !== d.id);
                break;
            case 'snap':
                if (!isHost) applySnap(d);
                break;
            case 'kill':
                if (!isHost) onKillEvent(d);
                break;
            case 'boom':
                if (!isHost) onBoom(d);
                break;
            case 'announce':
                if (!isHost) announce(d.text, d.ms);
                break;
            case 'end':
                if (!isHost) finish(d.win, d);
                break;
            case 'sk':
                if (a) skillFx(d);
                break;
        }
    }

    // ---------- 入力 ----------
    const keys = {};
    const input = { mx: 0, my: 0, aimX: 0, aimY: 0, aimOn: false, mouseDown: false, touchAim: null, stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, aimStick: { id: null, ox: 0, oy: 0, x: 0, y: 0 } };
    const isTouch = matchMedia('(pointer: coarse)').matches;
    window.addEventListener('keydown', (e) => {
        if (e.repeat && ['Space'].indexOf(e.code) >= 0) return;
        keys[e.code] = true;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') doDash();
        const sk = { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3 }[e.code]; if (sk !== undefined) castSkill(sk);
        if (e.code === 'Tab') { e.preventDefault(); toggleQuiz(); }
        if (/^Digit[1-4]$/.test(e.code)) quizPick(parseInt(e.code.slice(5), 10) - 1);
        if (e.code.indexOf('Arrow') === 0 || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    canvas.addEventListener('mousemove', (e) => { input.aimX = e.clientX; input.aimY = e.clientY; input.aimOn = true; });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 2) { doDash(); return; } input.mouseDown = true; input.aimX = e.clientX; input.aimY = e.clientY; input.aimOn = true; });
    window.addEventListener('mouseup', () => { input.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // タッチ：左半分=移動スティック / 右半分=エイム＆攻撃スティック
    canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const left = e.clientX < VW / 2;
        const st = left ? input.stick : input.aimStick;
        if (st.id !== null) return;
        st.id = e.pointerId; st.ox = e.clientX; st.oy = e.clientY; st.x = 0; st.y = 0;
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
        [input.stick, input.aimStick].forEach(st => {
            if (st.id !== e.pointerId) return;
            let dx = e.clientX - st.ox, dy = e.clientY - st.oy;
            const l = Math.hypot(dx, dy), m = 56;
            if (l > m) { dx = dx / l * m; dy = dy / l * m; }
            st.x = dx / m; st.y = dy / m;
        });
    });
    const endPtr = (e) => { [input.stick, input.aimStick].forEach(st => { if (st.id === e.pointerId) { st.id = null; st.x = 0; st.y = 0; } }); };
    canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
    document.getElementById('btnDash').addEventListener('pointerdown', (e) => { e.preventDefault(); doDash(); });

    // ---------- 敵生成（ホスト）----------
    // 敵の攻撃力は「基準HPに対する割合」で持つ（各プレイヤーが自分のHPに換算して受けるので、協力でも公平）
    function ed(e) { return (e.dmg || 0) * (e.dmgMul || 1); }
    function foeDmg(arch, isBoss, elite) {
        const a = window.STAGE_DATA.ARCH[arch] || window.STAGE_DATA.ARCH.chaser;
        return (0.075 + 0.0045 * stage.ilvl) * DIFF.dmg * a.atk * (isBoss ? 0.9 : 1) * (elite ? 1.4 : 1);
    }
    function enemyStats(def, isBoss, elite) {
        const ilvl = stage.ilvl;
        const a = window.STAGE_DATA.ARCH[def.arch] || window.STAGE_DATA.ARCH.chaser;
        const ps = partyScale();
        const stageHp = 70 * (1 + ilvl * 0.7);
        let hp;
        if (isBoss) hp = Math.max(stageHp * 24, REF_DPS * 45) * DIFF.hp * ps;                 // 自分の火力で最低45秒ぶん
        else hp = Math.max(stageHp, REF_DPS * 1.8) * DIFF.hp * a.hp * ps * (elite ? 4.5 : 1); // 雑魚も最低約2秒ぶん
        return {
            maxHp: Math.round(hp),
            dmg: foeDmg(def.arch, isBoss, elite),
            spd: 118 * a.spd * (1 + ilvl * 0.015) * DIFF.spd * (elite ? 1.05 : 1),
            r: (isBoss ? 46 : a.r) * (elite ? 1.3 : 1)
        };
    }

    function spawnEnemy(def, x, y, isBoss, elite) {
        const st = enemyStats(def, isBoss, elite);
        const e = { id: nextId++, def: def, arch: def.arch, boss: !!isBoss, elite: !!elite, x: x, y: y, hp: st.maxHp, maxHp: st.maxHp, dmg: st.dmg, spd: st.spd, r: st.r,
            t: rnd(0, 2), state: 0, st: { burn: 0, burnT: 0, poison: 0, poisonT: 0, slowT: 0, stunT: 0, bleed: 0, bleedT: 0, curseT: 0, weakenT: 0, blindT: 0 },
            kx: 0, ky: 0, aim: 0, fuse: 0, patIdx: 0, enraged: false };
        enemies.push(e);
        return e;
    }

    function spawnGroup() {
        const alive = alivePlayersPos();
        const c = alive[Math.floor(Math.random() * alive.length)] || { x: WORLD_W / 2, y: WORLD_H / 2 };
        const def = stage.enemies[Math.floor(Math.random() * stage.enemies.length)];
        const eliteAlive = enemies.filter(e => e.elite && e.hp > 0).length;
        const elite = def.arch !== 'swarm' && eliteAlive < 3 && Math.random() < DIFF.elite;
        const n = elite ? 1 : (def.arch === 'swarm' ? Math.floor(rnd(5, 9)) : (def.arch === 'tank' ? Math.floor(rnd(1, 3)) : Math.floor(rnd(3, 6))));
        const ang = rnd(0, Math.PI * 2), d = rnd(480, 660);
        if (elite) announce('⚔ 精鋭が出現！', 1100);
        for (let i = 0; i < n; i++) {
            const x = clamp(c.x + Math.cos(ang) * d + rnd(-60, 60), 40, WORLD_W - 40), y = clamp(c.y + Math.sin(ang) * d + rnd(-60, 60), 40, WORLD_H - 40);
            const e = spawnEnemy(def, x, y, false, elite);
            pushOutOfRocks(e, e.r);
        }
    }

    function alivePlayersPos() {
        const out = [];
        if (!me.dead) out.push({ x: me.x, y: me.y, id: me.id });
        Object.keys(allies).forEach(id => { const a = allies[id]; if (!a.dead) out.push({ x: a.x, y: a.y, id: id }); });
        return out;
    }
    function nearestPlayer(x, y) {
        let best = null, bd = 1e9;
        alivePlayersPos().forEach(p => { const d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; best = p; } });
        return best;
    }

    function bullet(x, y, ang, spd, dmg, r, life, color) {
        eBullets.push({ id: nextId++, x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg: dmg, r: r || 7, life: life || 3.2, c: color || '#ff6a5a' });
    }
    function telegraph(x, y, r, t, dmg, c) { telegraphs.push({ id: nextId++, x: x, y: y, r: r, t: t, max: t, dmg: dmg, c: c || '#ff5a5a' }); }

    // ---------- 敵AI（ホストだけが動かす）----------
    function updateEnemies(dt) {
        for (const e of enemies) {
            const s = e.st;
            // 状態異常
            let dot = 0;
            if (s.burnT > 0) { s.burnT -= dt; dot += s.burn; }
            if (s.poisonT > 0) { s.poisonT -= dt; dot += s.poison; }
            if (s.bleedT > 0) { s.bleedT -= dt; dot += s.bleed; }
            if (s.curseT > 0) s.curseT -= dt;
            if (s.weakenT > 0) s.weakenT -= dt;
            if (s.blindT > 0) s.blindT -= dt;
            e.dmgMul = s.blindT > 0 ? 0.5 : (s.weakenT > 0 ? 0.65 : 1);
            if (dot > 0) { e.hp -= dot * dt; if (e.hp <= 0) { killEnemy(e, null); continue; } }
            if (s.stunT > 0) { s.stunT -= dt; continue; }
            const slow = s.slowT > 0 ? 0.45 : 1; if (s.slowT > 0) s.slowT -= dt;
            e.t += dt;
            // ノックバック
            if (Math.abs(e.kx) + Math.abs(e.ky) > 1) { e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt); }
            const tgt = nearestPlayer(e.x, e.y);
            if (!tgt) continue;
            const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
            const sp = e.spd * slow;
            if (e.boss) { updateBoss(e, dt, tgt, d, ang, slow); }
            else if (e.arch === 'chaser' || e.arch === 'swarm' || e.arch === 'tank') { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
            else if (e.arch === 'ranged') {
                const want = d > 320 ? 1 : (d < 200 ? -0.8 : 0);
                e.x += dx / d * sp * dt * want;
                e.y += dy / d * sp * dt * want;
                if (e.t > 1.5 && d < 640) { e.t = rnd(0, 0.4); bullet(e.x, e.y, ang, 300, ed(e), 7, 3.4, e.def.color); if (e.elite) { bullet(e.x, e.y, ang + 0.22, 300, ed(e), 7, 3.4, e.def.color); bullet(e.x, e.y, ang - 0.22, 300, ed(e), 7, 3.4, e.def.color); } }
            } else if (e.arch === 'charger') {
                if (e.state === 0) { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; if (d < 340 && e.t > 1.4) { e.state = 1; e.t = 0; e.aim = ang; } }
                else if (e.state === 1) { if (e.t > 0.7) { e.state = 2; e.t = 0; } }
                else { e.x += Math.cos(e.aim) * 540 * slow * dt; e.y += Math.sin(e.aim) * 540 * slow * dt; if (e.t > 0.55) { e.state = 0; e.t = -0.6; } }
            } else if (e.arch === 'bomber') {
                if (e.fuse > 0) { e.fuse -= dt; if (e.fuse <= 0) { boomAt(e.x, e.y, 85, ed(e) * 1.3, e.def.color); e.hp = 0; removeDead(e); } }
                else { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; if (d < 60) e.fuse = 0.6; }
            }
            pushOutOfRocks(e, e.r);
        }
        enemies = enemies.filter(e => e.hp > 0);
    }
    function removeDead(e) { /* enemies配列のhp<=0は次のfilterで消える */ }

    // ボス：パターンを順番に使う
    function updateBoss(e, dt, tgt, d, ang, slow) {
        const hpR = e.hp / e.maxHp;
        if (!e.enraged && hpR < 0.5) { e.enraged = true; netAnnounce('ボスが激昂した！', 1800); }
        const pats = stage.boss.patterns;
        // 歩行
        if (e.state === 0) { const sp = e.spd * slow * (e.enraged ? 1.3 : 0.8); if (d > 150) { e.x += Math.cos(ang) * sp * dt; e.y += Math.sin(ang) * sp * dt; } }
        const cdMax = (e.enraged ? 1.1 : 1.9) / (DIFF.dmg > 1.5 ? 1.15 : 1);
        if (e.state === 0 && e.t > cdMax) {
            const pat = pats[e.patIdx % pats.length]; e.patIdx++; e.t = 0;
            const k = ed(e) * (e.enraged ? 1.15 : 1);
            if (pat === 'radial') { const n = e.enraged ? 26 : 18, off = rnd(0, 6.28); for (let i = 0; i < n; i++) bullet(e.x, e.y, off + i * Math.PI * 2 / n, 250, k, 8, 4, stage.boss.color); }
            else if (pat === 'volley') { const n = e.enraged ? 11 : 7; for (let i = 0; i < n; i++) bullet(e.x, e.y, ang + (i - (n - 1) / 2) * 0.17, 360, k, 8, 3.2, stage.boss.color); }
            else if (pat === 'slam') { const alive = alivePlayersPos(); alive.forEach(p => telegraph(p.x, p.y, 120, 1.2, k * 1.6, stage.boss.color)); telegraph(e.x, e.y, 150, 1.2, k * 1.4, stage.boss.color); }
            else if (pat === 'charge') { e.state = 1; e.aim = ang; e.t = 0; }
            else if (pat === 'summon') { const def = stage.enemies[0]; for (let i = 0; i < (e.enraged ? 6 : 4); i++) { const m = spawnEnemy(def, e.x + rnd(-120, 120), e.y + rnd(-120, 120), false); m.hp = m.maxHp = Math.round(m.maxHp * 0.7); } }
            else if (pat === 'spiral') { e.state = 3; e.t = 0; e.spin = 0; }
        } else if (e.state === 1) { // 突進（予告0.6秒→突進0.7秒）
            if (e.t < 0.6) { /* 予告中：その場で構える */ } else if (e.t < 1.3) { e.x += Math.cos(e.aim) * 620 * dt; e.y += Math.sin(e.aim) * 620 * dt; } else { e.state = 0; e.t = 0; }
        } else if (e.state === 3) { // 渦巻き弾
            e.spin += dt * 9; if (Math.floor(e.t * 14) !== Math.floor((e.t - dt) * 14)) { bullet(e.x, e.y, e.spin, 240, ed(e) * 0.8, 7, 4, stage.boss.color); bullet(e.x, e.y, e.spin + Math.PI, 240, ed(e) * 0.8, 7, 4, stage.boss.color); }
            if (e.t > 2.2) { e.state = 0; e.t = 0; }
        }
    }

    function boomAt(x, y, r, dmg, c) {
        const d = { x: x, y: y, r: r, dmg: dmg, c: c };
        onBoom(d);
        if (isHost) netSend('boom', d);
    }
    function onBoom(d) {
        fx.push({ k: 'ring', x: d.x, y: d.y, r: 0, max: d.r, t: 0.35, life: 0.35, c: d.c || '#ff9a3a', fill: true });
        if (!me.dead && dist(me.x, me.y, d.x, d.y) < d.r + me.r) hurtMe(d.dmg);
    }

    function netAnnounce(text, ms) { announce(text, ms); if (isHost) netSend('announce', { text: text, ms: ms }); }

    // ---------- ダメージ処理 ----------
    // 自分の攻撃が敵に当たったとき：ホストなら直接、そうでなければホストへ送る
    function dealHit(e, dmg, o) {
        o = o || {};
        const d = { eid: e.id, dmg: dmg, st: o.st || null, kx: o.kx || 0, ky: o.ky || 0, by: myId, crit: !!o.crit };
        if (dmg > 0) {
            run.stats.dmg += dmg;
            popups.push({ x: e.x + rnd(-8, 8), y: e.y - e.r - 6, t: 0.7, text: String(Math.round(dmg)), c: o.crit ? '#ffd84a' : '#fff', big: !!o.crit });
        }
        e.flash = 0.1;
        if (isHost) applyHit(d); else { netSend('hit', d); e.hp = Math.max(0, e.hp - dmg); }
    }
    function applyHit(d) {
        const e = enemies.find(x => x.id === d.eid);
        if (!e || e.hp <= 0) return;
        const amp = e.st.curseT > 0 ? 1.2 : 1;
        e.hp -= d.dmg * amp;
        e.kx += d.kx; e.ky += d.ky;
        const s = d.st;
        if (s) {
            if (s.burn) { e.st.burn = Math.max(e.st.burn, s.burn); e.st.burnT = 3; }
            if (s.poison) { e.st.poison = Math.max(e.st.poison, s.poison); e.st.poisonT = 5; }
            if (s.bleed) { e.st.bleed = Math.max(e.st.bleed, s.bleed); e.st.bleedT = 4; }
            if (s.slow) e.st.slowT = 2.5;
            if (s.stun && !e.boss) e.st.stunT = Math.max(e.st.stunT, typeof s.stun === 'number' ? s.stun : 1);
            if (s.weaken) e.st.weakenT = 3;
            if (s.blind) e.st.blindT = 2.5;
            if (s.curse) e.st.curseT = 6;
        }
        if (e.hp <= 0) killEnemy(e, d.by);
    }

    function killEnemy(e, by) {
        if (e.dead) return;
        e.dead = true; e.hp = 0;
        run.kills++;
        const ev = { id: e.id, x: e.x, y: e.y, boss: e.boss, elite: !!e.elite, by: by, ilvl: stage.ilvl, ico: e.def.icon };
        onKillEvent(ev);
        netSend('kill', ev);
        if (e.boss) { run.bossDead = true; }
    }

    // 全員が受け取る撃破イベント：各自が自分用のドロップを抽選する（ハクスラ式の個人ドロップ）
    function onKillEvent(ev) {
        fx.push({ k: 'puff', x: ev.x, y: ev.y, t: 0.4, life: 0.4, c: '#fff' });
        run.stats.kills++;
        const coin = Math.round((1 + stage.ilvl * 0.8) * (ev.boss ? 25 : 1) * (1 + A('goldPct')));
        run.stats.coins += coin;
        const luck = A('dropPct');
        const rareBonus = A('rarePct') + DIFF.luck + (ev.boss ? 0.8 : 0) + (ev.elite ? 0.5 : 0);
        rollMats(ev.boss ? 'boss' : (ev.elite ? 'elite' : 'mob'), ev.x, ev.y);
        if (ev.boss) {
            // ボス専用ドロップ：レア以上確定を2本＋通常ドロップ1本
            rollLoot(stage.bossDrops, rareBonus, 'rare', ev.x, ev.y, 'boss');
            rollLoot(stage.bossDrops, rareBonus, 'rare', ev.x + 22, ev.y, 'boss');
            rollLoot(stage.drops, rareBonus, 'magic', ev.x - 22, ev.y, 'boss');
            if (Math.random() < 0.8) giveOrb(true);
        } else if (ev.elite) {
            // 精鋭：高確率で武器（マジック以上）、オーブも出やすい
            if (Math.random() < 0.55 * (1 + luck)) rollLoot(stage.drops, rareBonus, 'magic', ev.x, ev.y, 'elite');
            if (Math.random() < 0.22 * (1 + A('orbPct'))) giveOrb(false);
        } else {
            if (Math.random() < 0.07 * (1 + luck)) rollLoot(stage.drops, rareBonus, 'normal', ev.x, ev.y, 'mob');
            if (Math.random() < 0.035 * (1 + A('orbPct'))) giveOrb(false);
        }
        if (ev.by === myId) {
            onMyKill();
            // 回復の宝珠：倒した本人が拾う（被弾が増えたぶんの救済）
            if (!me.dead && Math.random() < (ev.elite || ev.boss ? 0.5 : 0.09)) {
                me.hp = Math.min(me.maxHp, me.hp + me.maxHp * (ev.elite ? 0.2 : 0.1));
                popups.push({ x: me.x, y: me.y - 34, t: 0.9, text: '+HP', c: '#7aff9a' });
            }
        }
    }

    function rollLoot(pool, luck, minR, x, y, src) {
        const w = HW.roll({ ilvl: stage.ilvl, baseIds: pool, luck: luck, minRarity: minR, source: stage.id + ':' + src });
        const d = HW.load();
        d.weapons.push(w); HW.save(d);
        run.stats.loot.push(w);
        popups.push({ x: x, y: y - 14, t: 1.6, text: '✦ ' + w.name, c: HW.rarityOf(w).color, big: true });
        fx.push({ k: 'ring', x: x, y: y, r: 0, max: 50, t: 0.5, life: 0.5, c: HW.rarityOf(w).color });
        refreshLootLog();
    }
    // ---------- モンスター素材（グリフ工房の材料）----------
    // 抽選表は stage-data.js の MATS。雑魚は控えめ、精鋭はそのまま、ボスの確定枠は2〜3個。
    function matName(id) { return (typeof MATERIAL_DATA !== 'undefined' && MATERIAL_DATA[id]) ? MATERIAL_DATA[id].name : id; }
    function rollMats(kind, x, y) {
        const list = stage.mats && stage.mats[kind];
        if (!list || !list.length) return;
        const kindMul = kind === 'mob' ? 0.6 : 1;
        const luck = (1 + A('dropPct') * 0.5) * (1 + DIFF.luck * 0.25);
        const got = {};
        list.forEach(row => {
            const id = row[0], ch = row[1];
            if (Math.random() < Math.min(1, ch * kindMul * luck)) got[id] = (got[id] || 0) + ((kind === 'boss' && ch >= 1) ? 2 + Math.floor(Math.random() * 2) : 1);
        });
        giveMaterials(got, x, y);
    }
    function giveMaterials(got, x, y) {
        const ids = Object.keys(got);
        if (!ids.length) return;
        const p = getPlayerData(); if (!p) return;
        if (!p.materials || Array.isArray(p.materials)) p.materials = {};
        ids.forEach((id, i) => {
            p.materials[id] = (p.materials[id] || 0) + got[id];
            run.stats.mats[id] = (run.stats.mats[id] || 0) + got[id];
            popups.push({ x: x + (i - (ids.length - 1) / 2) * 6, y: y - 10 - i * 14, t: 1.1, text: '🧪 ' + matName(id) + (got[id] > 1 ? '×' + got[id] : ''), c: '#c8f7a0' });
        });
        try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {}
    }
    function giveOrb(isBoss) {
        if (typeof createOrb !== 'function') return;
        const il = stage.ilvl;
        let tier = 'tier1';
        const r = Math.random();
        if (il >= 12 && r < (isBoss ? 0.15 : 0.03)) tier = 'tier4';
        else if (il >= 7 && r < (isBoss ? 0.45 : 0.18)) tier = 'tier3';
        else if (il >= 3 && r < (isBoss ? 0.7 : 0.4)) tier = 'tier2';
        const orb = createOrb(tier);
        if (!orb) return;
        const p = getPlayerData(); if (!p) return;
        if (!Array.isArray(p.orbs)) p.orbs = [];
        p.orbs.push(orb);
        try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {}
        run.stats.orbs++;
        popups.push({ x: me.x, y: me.y - 40, t: 1.4, text: '💎 オーブ入手 (' + (orb.tier || tier) + ')', c: '#9fe0ff', big: true });
    }

    // 自分が倒したとき（撃破時効果）
    function onMyKill() {
        agg.procs.filter(p => p.on === 'kill').forEach(p => {
            if (Math.random() >= p.v && p.key !== 'killHeal') return;
            if (p.key === 'killHeal') me.hp = Math.min(me.maxHp, me.hp + me.maxHp * Math.min(0.2, p.v));
            else if (p.key === 'killBoom') boomMine(me.x, me.y, 110);
            else if (p.key === 'killHaste') me.haste = 3;
            else if (p.key === 'killEnergy') addEnergy(8);
        });
    }

    // 自分が敵に与える範囲爆発（味方には当たらない）
    function boomMine(x, y, r) {
        r *= (1 + A('aoePct'));
        fx.push({ k: 'ring', x: x, y: y, r: 0, max: r, t: 0.3, life: 0.3, c: '#ffb04a', fill: true });
        const dm = weapon.dmg * P.atkMul * 0.9;
        enemies.forEach(e => { if (e.hp > 0 && dist(e.x, e.y, x, y) < r + e.r) dealHit(e, dm, {}); });
    }

    // ---------- 被ダメージ ----------
    function hurtMe(raw) {
        if (me.dead || me.inv > 0 || run.phase !== 'run') return;
        if (Math.random() < Math.min(0.5, A('dodge'))) { popups.push({ x: me.x, y: me.y - 24, t: 0.6, text: 'MISS', c: '#9fe0ff' }); me.inv = 0.25; return; }
        if (me.shield) { me.shield = false; popups.push({ x: me.x, y: me.y - 24, t: 0.7, text: 'BARRIER', c: '#9fe0ff' }); me.inv = 0.5; return; }
        // raw は「基準HPに対する割合」。防御は最大55%まで軽減
        const defNow = P.def * (me.fortifyT > 0 ? 1.4 : 1);
        const red = Math.min(0.55, defNow / (defNow + 250));
        let dmg = raw * REF_HP * (1 - red) * (1 - Math.min(0.6, A('dr')));
        dmg = Math.max(1, Math.round(dmg));
        if (me.barrierHp > 0) { const ab = Math.min(dmg, me.barrierHp); me.barrierHp -= ab; dmg -= ab; popups.push({ x: me.x, y: me.y - 30, t: 0.7, text: 'BARRIER-' + Math.round(ab), c: '#7fc8ff' }); me.inv = 0.3; if (dmg <= 0) return; }
        me.hp -= dmg; me.inv = 0.6 + A('iframe'); me.flash = 0.2;
        popups.push({ x: me.x, y: me.y - 24, t: 0.8, text: '-' + dmg, c: '#ff7b7b', big: true });
        // 被弾時効果
        if (A('thorns') > 0) { const n = nearestEnemy(me.x, me.y, 140); if (n) dealHit(n, weapon.dmg * P.atkMul * A('thorns'), {}); }
        agg.procs.filter(p => p.on === 'hurt').forEach(p => {
            if (Math.random() >= p.v) return;
            if (p.key === 'hurtShield') me.shield = true;
            if (p.key === 'hurtNova') { fx.push({ k: 'ring', x: me.x, y: me.y, r: 0, max: 160, t: 0.35, life: 0.35, c: '#ffe08a' }); enemies.forEach(e => { if (dist(e.x, e.y, me.x, me.y) < 170) { const a = Math.atan2(e.y - me.y, e.x - me.x); dealHit(e, weapon.dmg * P.atkMul * 0.8, { kx: Math.cos(a) * 300, ky: Math.sin(a) * 300 }); } }); }
        });
        if (me.hp <= 0) { me.hp = 0; me.dead = true; me.reviveT = 0; announce('倒れた！ 仲間が近くに来れば復活できます', 2200); }
    }

    function nearestEnemy(x, y, maxD) {
        let best = null, bd = maxD || 1e9;
        enemies.forEach(e => { if (e.hp <= 0) return; const d = dist(x, y, e.x, e.y) - e.r; if (d < bd) { bd = d; best = e; } });
        return best;
    }

    // ---------- 攻撃 ----------
    function aimAngle() {
        if (input.aimStick.id !== null && Math.hypot(input.aimStick.x, input.aimStick.y) > 0.2) return Math.atan2(input.aimStick.y, input.aimStick.x);
        if (isTouch) { const n = nearestEnemy(me.x, me.y, 520); if (n) return Math.atan2(n.y - me.y, n.x - me.x); }
        return me.ang;   // マウス操作時は updateMe が毎フレーム me.ang を更新している
    }
    function wantsAttack() {
        if (keys['Space'] || input.mouseDown) return true;
        if (input.aimStick.id !== null) return true;
        return false;
    }

    function calcHit(e, mult) {
        let dmg = weapon.dmg * (T.mult || 1) * P.atkMul * (mult || 1) * rnd(0.93, 1.07);
        if (e.boss) dmg *= 1 + A('dmgBoss'); else dmg *= 1 + A('dmgMob');
        if (e.hp / e.maxHp < 0.3) dmg *= 1 + A('dmgLow');
        if (e.hp >= e.maxHp) dmg *= 1 + A('dmgFull');
        if (me.hp / me.maxHp < 0.5) dmg *= 1 + A('rageAtk');
        if (me.empowerT > 0) dmg *= 1.35;
        const crit = Math.random() < P.crit;
        if (crit) dmg *= P.critMul;
        return { dmg: dmg, crit: crit };
    }

    // 命中時の効果（状態異常・連鎖雷・隕石など）
    function onHitProcs(e, h) {
        const st = {};
        let extra = false;
        const base = weapon.dmg * P.atkMul;
        agg.procs.forEach(p => {
            if (p.on === 'crit') { if (h.crit && Math.random() < p.v) boomMine(e.x, e.y, 100); return; }
            if (p.on !== 'hit') return;
            if (Math.random() >= p.v) return;
            switch (p.key) {
                case 'burn': st.burn = base * 0.35; break;
                case 'poison': st.poison = base * 0.22; break;
                case 'bleed': st.bleed = base * 0.3; break;
                case 'freeze': st.slow = 1; break;
                case 'stun': st.stun = 1; break;
                case 'curse': st.curse = 1; break;
                case 'double': extra = true; break;
                case 'shock': {
                    let c = 0; fx.push({ k: 'bolt', x: e.x, y: e.y, t: 0.25, life: 0.25, pts: [] });
                    enemies.forEach(o => { if (o !== e && o.hp > 0 && c < 3 && dist(o.x, o.y, e.x, e.y) < 190) { c++; fx.push({ k: 'line', x: e.x, y: e.y, x2: o.x, y2: o.y, t: 0.2, life: 0.2, c: '#ffe84a' }); dealHit(o, base * 0.6, {}); } });
                    break;
                }
                case 'meteor': {
                    const mx = e.x, my = e.y;
                    fx.push({ k: 'warn', x: mx, y: my, r: 70, t: 0.6, life: 0.6, c: '#ff8a3a' });
                    setTimeout(() => { if (!run.ended) boomMine(mx, my, 90); }, 600);
                    break;
                }
            }
        });
        if (A('lifesteal') > 0) me.hp = Math.min(me.maxHp, me.hp + h.dmg * A('lifesteal'));
        return { st: Object.keys(st).length ? st : null, extra: extra };
    }

    function strike(e, mult, kb) {
        const h = calcHit(e, mult);
        const pr = onHitProcs(e, h);
        const a = Math.atan2(e.y - me.y, e.x - me.x);
        const k = (kb || 0) * (1 + A('knock'));
        dealHit(e, h.dmg, { crit: h.crit, st: pr.st, kx: Math.cos(a) * k, ky: Math.sin(a) * k });
        if (pr.extra) setTimeout(() => { if (e.hp > 0) dealHit(e, h.dmg * 0.6, { crit: false }); }, 90);
        return h;
    }

    function doAttack() {
        const ang = aimAngle(); me.ang = ang;
        const cdv = P.cd / (me.haste > 0 ? 1.4 : 1);
        me.atkCd = cdv;
        const d = { k: T.kind, x: me.x, y: me.y, a: ang, rng: P.range, arc: T.arc, rad: P.radius || T.radius, w: T.width, c: HW.rarityOf(weapon).color };
        spawnAtkFx(d); netSend('atk', d);
        if (T.lunge) { me.x += Math.cos(ang) * T.lunge; me.y += Math.sin(ang) * T.lunge; pushOutOfRocks(me, me.r); }

        if (T.kind === 'cone') {
            const range = P.range, arc = T.arc;
            enemies.forEach(e => {
                if (e.hp <= 0) return;
                const dd = dist(me.x, me.y, e.x, e.y);
                if (dd > range + e.r) return;
                let da = Math.atan2(e.y - me.y, e.x - me.x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
                if (Math.abs(da) <= arc / 2 || dd < e.r + 18) strike(e, 1, T.knock);
            });
        } else if (T.kind === 'line') {
            const x2 = me.x + Math.cos(ang) * P.range, y2 = me.y + Math.sin(ang) * P.range;
            enemies.forEach(e => { if (e.hp > 0 && distSeg(e.x, e.y, me.x, me.y, x2, y2) < (T.width || 24) / 2 + e.r) strike(e, 1, T.knock); });
        } else if (T.kind === 'ring') {
            enemies.forEach(e => { if (e.hp > 0 && dist(me.x, me.y, e.x, e.y) < P.radius + e.r) strike(e, 1, T.knock); });
        } else if (T.kind === 'smash') {
            const cx = me.x + Math.cos(ang) * (T.reach || 60), cy = me.y + Math.sin(ang) * (T.reach || 60);
            fx.push({ k: 'ring', x: cx, y: cy, r: 0, max: P.radius, t: 0.3, life: 0.3, c: '#ffcf8a', fill: true });
            enemies.forEach(e => { if (e.hp > 0 && dist(cx, cy, e.x, e.y) < P.radius + e.r) strike(e, 1, T.knock); });
        } else if (T.kind === 'proj') {
            const n = (T.spread || 1) + Math.round(A('projExtra'));
            const spread = T.spread ? 0.16 : 0.12;
            for (let i = 0; i < n; i++) {
                const a = ang + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
                myShots.push({ x: me.x, y: me.y, vx: Math.cos(a) * T.speed, vy: Math.sin(a) * T.speed, r: T.radius, life: T.range / T.speed, pierce: (T.pierce || 0) + Math.round(A('pierce')), hit: {}, homing: !!T.homing, c: HW.rarityOf(weapon).color });
            }
        }
    }
    function distSeg(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
        let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; t = clamp(t, 0, 1);
        return dist(px, py, x1 + dx * t, y1 + dy * t);
    }
    function spawnAtkFx(d) {
        if (d.k === 'cone') fx.push({ k: 'arc', x: d.x, y: d.y, a: d.a, rng: d.rng, arc: d.arc, t: 0.14, life: 0.14, c: d.c });
        else if (d.k === 'line') fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x + Math.cos(d.a) * d.rng, y2: d.y + Math.sin(d.a) * d.rng, t: 0.14, life: 0.14, c: d.c, w: d.w || 14 });
        else if (d.k === 'ring') fx.push({ k: 'ring', x: d.x, y: d.y, r: 0, max: d.rad || 100, t: 0.25, life: 0.25, c: d.c });
        else if (d.k === 'smash') fx.push({ k: 'ring', x: d.x + Math.cos(d.a) * 60, y: d.y + Math.sin(d.a) * 60, r: 0, max: d.rad || 90, t: 0.25, life: 0.25, c: d.c });
    }

    function doDash() {
        if (me.dead || me.dashCd > 0 || run.phase !== 'run') return;
        let mx = input.mx, my = input.my;
        if (!mx && !my) { mx = Math.cos(me.ang); my = Math.sin(me.ang); }
        const l = Math.hypot(mx, my) || 1;
        me.dashVX = mx / l * 640; me.dashVY = my / l * 640; me.dashT = 0.18; me.dashCd = P.dashCd; me.inv = Math.max(me.inv, 0.22);
        fx.push({ k: 'puff', x: me.x, y: me.y, t: 0.25, life: 0.25, c: '#bfe6ff' });
        agg.procs.filter(p => p.on === 'dash').forEach(p => { me.dashBlast = p.v; });
    }

    // ---------- アクティブスキル（従来のモジュール式スキル：投射／レーザー／斬撃／衝撃波）----------
    // 形・効果・強化は action-skills.js のものをそのまま使う。Z X C V で発動。エネルギーを消費し、
    // エネルギーはクイズ正解で溜まる。威力は「装備武器の攻撃力 × スキル倍率」で決まる。
    const skillSlots = (window.ActionSkills ? ActionSkills.loadLoadout() : []).map(sk => sk ? Object.assign(ActionSkills.compute(sk), { cdLeft: 0 }) : null);
    while (skillSlots.length < 4) skillSlots.push(null);
    const SELF_FX = ['fortify', 'haste', 'regenerate', 'empower', 'barrier'];

    function skillFx(d) {
        const c = d.c || '#9df0ff';
        if (d.f === 'laser') fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x + Math.cos(d.a) * d.len, y2: d.y + Math.sin(d.a) * d.len, t: 0.3, life: 0.3, c: '#9df0ff', w: d.w || 24 });
        else if (d.f === 'slash') fx.push({ k: 'arc', x: d.x, y: d.y, a: d.a, rng: d.r, arc: d.arc, t: 0.26, life: 0.26, c: '#c6f0ff' });
        else if (d.f === 'nova') fx.push({ k: 'ring', x: d.x, y: d.y, r: 0, max: d.r, t: 0.35, life: 0.35, c: '#ffe6a0', fill: true });
        else fx.push({ k: 'line', x: d.x, y: d.y, x2: d.x + Math.cos(d.a) * 40, y2: d.y + Math.sin(d.a) * 40, t: 0.15, life: 0.15, c: c, w: 6 });
    }

    // 命中した敵1体への処理（ダメージ＋効果）
    function skillHit(e, base, hasDmg, eff, ang) {
        let dmg = hasDmg ? base * rnd(0.95, 1.05) : 0;
        dmg *= e.boss ? 1 + A('dmgBoss') : 1 + A('dmgMob');
        if (eff.indexOf('shatter') >= 0) dmg *= 1.3;
        if (eff.indexOf('explosion') >= 0) dmg += Math.max(2, dmg * 0.4);
        dmg = Math.round(dmg);
        const st = {};
        const has = k => eff.indexOf(k) >= 0;
        if (has('burn')) st.burn = Math.max(1, dmg * 0.6 / 3);
        if (has('soulburn')) st.burn = Math.max(st.burn || 0, Math.max(2, dmg * 1.1 / 3));
        if (has('poison')) st.poison = Math.max(1, dmg * 0.45 / 4);
        if (has('frostbite')) { st.slow = 1; st.poison = Math.max(st.poison || 0, Math.max(1, dmg * 0.3 / 3)); }
        if (has('freeze')) st.slow = 1;
        if (has('weaken')) st.weaken = 1;
        if (has('blind')) st.blind = 1;
        if (has('stun')) st.stun = Math.max(st.stun || 0, 1.0);
        if (has('petrify')) st.stun = Math.max(st.stun || 0, 1.6);
        if (has('chronowarp')) st.stun = Math.max(st.stun || 0, 2.6);
        let knock = 40;
        if (has('knockback')) knock += 300;
        if (has('gravity')) knock -= 260 + 40;     // 負の値＝自分の方へ引き寄せる
        const a = Math.atan2(e.y - me.y, e.x - me.x), res = e.boss ? 0.4 : 1;
        if (hasDmg && dmg > 0) {
            if (has('drain')) healMe(dmg * 0.3);
            if (has('voidrend')) healMe(dmg * 0.6);
        }
        dealHit(e, dmg, { st: Object.keys(st).length ? st : null, kx: Math.cos(a) * knock * res, ky: Math.sin(a) * knock * res });
    }
    function healMe(v) {
        v = Math.round(v); if (v <= 0 || me.dead) return;
        me.hp = Math.min(me.maxHp, me.hp + v);
        popups.push({ x: me.x, y: me.y - 30, t: 0.7, text: '+' + v, c: '#7CFC9A' });
    }
    function applySelfFx(key) {
        const tag = (t, c) => popups.push({ x: me.x, y: me.y - 46, t: 0.9, text: t, c: c });
        if (key === 'fortify') { me.fortifyT = 3; tag('防御UP', '#9df0ff'); }
        else if (key === 'haste') { me.haste = Math.max(me.haste, 3); tag('速度UP', '#9df0ff'); }
        else if (key === 'empower') { me.empowerT = 3; tag('攻撃UP', '#ffb347'); }
        else if (key === 'regenerate') { me.regenT = 4; tag('再生', '#7CFC9A'); }
        else if (key === 'barrier') { me.barrierHp = (me.barrierHp || 0) + Math.max(10, Math.round(me.maxHp * 0.25)); tag('バリア', '#7fc8ff'); }
    }

    function castSkill(slot) {
        const s = skillSlots[slot];
        if (!s || me.dead || run.phase !== 'run' || s.cdLeft > 0) return;
        if (me.energy < s.cost) { flashEnergy(); return; }
        me.energy -= s.cost; s.cdLeft = s.cooldown; updateEnergyUI();
        const p = s.params, ang = aimAngle(); me.ang = ang;
        popups.push({ x: me.x, y: me.y - 34, t: 0.9, text: s.skill.name, c: '#9df0ff' });
        p.effects.forEach(k => { if (SELF_FX.indexOf(k) >= 0) applySelfFx(k); });
        const eff = p.effects.filter(k => k !== 'damage' && SELF_FX.indexOf(k) < 0);
        const hasDmg = p.effects.indexOf('damage') >= 0;
        const base = weapon.dmg * P.atkMul * p.baseMult * p.dmgMult * (1 + P.special / 300) * (me.empowerT > 0 ? 1.35 : 1);
        const later = (sec, fn) => setTimeout(() => { if (run.phase === 'run' && !me.dead) fn(); }, sec * 1000);

        if (p.form === 'projectile') {
            for (let i = 0; i < p.count; i++) {
                const a = ang + (i - (p.count - 1) / 2) * p.spread;
                myShots.push({ x: me.x, y: me.y, vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed, r: p.radius, life: p.range / p.speed, pierce: p.pierce, hit: {}, homing: false, c: '#8fd3ff', skill: { base: base, hasDmg: hasDmg, eff: eff } });
            }
            const d = { f: 'projectile', x: me.x, y: me.y, a: ang }; skillFx(d); netSend('sk', d);
        } else if (p.form === 'laser') {
            for (let i = 0; i < p.count; i++) {
                const a = ang + (i - (p.count - 1) / 2) * p.spread;
                const d = { f: 'laser', x: me.x, y: me.y, a: a, len: p.length, w: p.width }; skillFx(d); netSend('sk', d);
                const x2 = me.x + Math.cos(a) * p.length, y2 = me.y + Math.sin(a) * p.length;
                enemies.forEach(e => { if (e.hp > 0 && distSeg(e.x, e.y, me.x, me.y, x2, y2) <= p.width / 2 + e.r) skillHit(e, base, hasDmg, eff, a); });
            }
        } else if (p.form === 'slash') {
            for (let i = 0; i < p.count; i++) {
                later(i * p.delay, () => {
                    const a = aimAngle() + (i % 2 ? 0.12 : -0.12); me.ang = a;
                    const d = { f: 'slash', x: me.x, y: me.y, a: a, r: p.radius, arc: p.arc }; skillFx(d); netSend('sk', d);
                    enemies.forEach(e => {
                        if (e.hp <= 0) return;
                        const dd = dist(me.x, me.y, e.x, e.y); if (dd > p.radius + e.r) return;
                        let da = Math.atan2(e.y - me.y, e.x - me.x) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
                        if (Math.abs(da) <= p.arc / 2 || dd < e.r + 18) skillHit(e, base, hasDmg, eff, a);
                    });
                });
            }
        } else if (p.form === 'nova') {
            for (let i = 0; i < p.count; i++) {
                later(i * p.delay, () => {
                    const d = { f: 'nova', x: me.x, y: me.y, r: p.radius }; skillFx(d); netSend('sk', d);
                    enemies.forEach(e => { if (e.hp > 0 && dist(me.x, me.y, e.x, e.y) <= p.radius + e.r) skillHit(e, base, hasDmg, eff, 0); });
                });
            }
        }
    }
    function flashEnergy() { const b = el('enBar'); if (!b) return; b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 300); }

    function buildSkillBar() {
        const box = el('skillBar'); box.innerHTML = '';
        const KEYS = ['Z', 'X', 'C', 'V'];
        skillSlots.forEach((s, i) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'skill-btn';
            if (s) b.innerHTML = '<span class="sk-key">' + KEYS[i] + '</span><span class="sk-icon">' + ActionSkills.FORMS[s.skill.form].icon + '</span><span class="sk-name">' + escapeHtml(s.skill.name) + '</span><span class="sk-cost">' + s.cost + '</span><span class="sk-cd"></span>';
            else { b.classList.add('empty'); b.innerHTML = '<span class="sk-key">' + KEYS[i] + '</span><span class="sk-name">未設定</span>'; }
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); castSkill(i); });
            box.appendChild(b);
        });
    }
    function updateSkillBar() {
        Array.from(el('skillBar').children).forEach((b, i) => {
            const s = skillSlots[i]; if (!s) return;
            const cd = b.querySelector('.sk-cd'); const t = s.cdLeft > 0 ? s.cdLeft.toFixed(1) : '';
            if (cd && cd.textContent !== t) cd.textContent = t;
            b.classList.toggle('ready', me.energy >= s.cost && s.cdLeft <= 0);
            b.classList.toggle('short', me.energy < s.cost);
        });
    }
    function addEnergy(v) { me.energy = Math.min(ENERGY_MAX, me.energy + v); updateEnergyUI(); }

    // ---------- 更新 ----------
    function updateMe(dt) {
        me.atkCd -= dt; me.dashCd -= dt; me.inv -= dt; if (me.haste > 0) me.haste -= dt; if (me.flash > 0) me.flash -= dt;
        if (me.dead) {
            // 仲間が近くにいると復活する
            const near = Object.keys(allies).some(id => { const a = allies[id]; return !a.dead && dist(a.x, a.y, me.x, me.y) < 90; });
            if (near) { me.reviveT += dt; if (me.reviveT > 2.5) { me.dead = false; me.hp = Math.round(me.maxHp * 0.4); me.inv = 1.5; announce('復活！', 900); } } else me.reviveT = Math.max(0, me.reviveT - dt);
            return;
        }
        // 移動
        let mx = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) + input.stick.x;
        let my = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) + input.stick.y;
        const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
        input.mx = mx; input.my = my;
        const sp = P.move * (me.haste > 0 ? 1.3 : 1);
        if (me.dashT > 0) {
            me.dashT -= dt; me.x += me.dashVX * dt; me.y += me.dashVY * dt;
            if (me.dashT <= 0 && me.dashBlast) { const v = me.dashBlast; me.dashBlast = 0; fx.push({ k: 'ring', x: me.x, y: me.y, r: 0, max: 130, t: 0.3, life: 0.3, c: '#cfe8ff' }); enemies.forEach(e => { if (e.hp > 0 && dist(e.x, e.y, me.x, me.y) < 140 + e.r) dealHit(e, weapon.dmg * P.atkMul * v, { kx: (e.x - me.x) * 3, ky: (e.y - me.y) * 3 }); }); }
        } else { me.x += mx * sp * dt; me.y += my * sp * dt; }
        pushOutOfRocks(me, me.r);
        if (input.aimOn && !isTouch) me.ang = Math.atan2(input.aimY - (VH / 2 + (me.y - cam.y)), input.aimX - (VW / 2 + (me.x - cam.x)));
        if (wantsAttack() && me.atkCd <= 0 && run.phase === 'run') doAttack();
        // 持続回復
        if (A('regen') > 0) me.hp = Math.min(me.maxHp, me.hp + me.maxHp * A('regen') * dt);
        if (me.regenT > 0) { me.regenT -= dt; me.hp = Math.min(me.maxHp, me.hp + me.maxHp * 0.03 * dt); }
        if (me.fortifyT > 0) me.fortifyT -= dt;
        if (me.empowerT > 0) me.empowerT -= dt;
        // 接触ダメージ
        for (const e of enemies) {
            if (e.hp <= 0 || e.st.stunT > 0) continue;
            if (dist(e.x, e.y, me.x, me.y) < e.r + me.r - 2) { if (e.arch === 'bomber') continue; hurtMe(ed(e) * (e.arch === 'charger' && e.state === 2 ? 1.3 : 1.0)); }
        }
        // 敵弾
        for (let i = eBullets.length - 1; i >= 0; i--) {
            const b = eBullets[i];
            if (dist(b.x, b.y, me.x, me.y) < b.r + me.r) { hurtMe(b.dmg); eBullets.splice(i, 1); if (!isHost) netSend('bhit', { id: b.id }); }
        }
    }

    function updateShots(dt) {
        for (let i = myShots.length - 1; i >= 0; i--) {
            const s = myShots[i];
            if (s.homing) { const n = nearestEnemy(s.x, s.y, 360); if (n) { const sp = Math.hypot(s.vx, s.vy); const a = Math.atan2(s.vy, s.vx), ta = Math.atan2(n.y - s.y, n.x - s.x); let da = ta - a; da = Math.atan2(Math.sin(da), Math.cos(da)); const na = a + clamp(da, -4 * dt, 4 * dt); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp; } }
            s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
            let dead = s.life <= 0 || s.x < 0 || s.y < 0 || s.x > WORLD_W || s.y > WORLD_H;
            if (!dead) for (const k of rocks) if (dist(s.x, s.y, k.x, k.y) < k.r) { dead = true; break; }
            if (!dead) {
                for (const e of enemies) {
                    if (e.hp <= 0 || s.hit[e.id]) continue;
                    if (dist(s.x, s.y, e.x, e.y) < s.r + e.r) {
                        s.hit[e.id] = 1;
                        if (s.skill) skillHit(e, s.skill.base, s.skill.hasDmg, s.skill.eff, Math.atan2(s.vy, s.vx)); else strike(e, 1, 30);
                        if (s.pierce-- <= 0) { dead = true; break; }
                    }
                }
            }
            if (dead) myShots.splice(i, 1);
        }
    }

    function updateHost(dt) {
        updateEnemies(dt);
        // 敵弾
        for (let i = eBullets.length - 1; i >= 0; i--) {
            const b = eBullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
            let dead = b.life <= 0 || b.x < -50 || b.y < -50 || b.x > WORLD_W + 50 || b.y > WORLD_H + 50;
            if (!dead) for (const k of rocks) if (dist(b.x, b.y, k.x, k.y) < k.r) { dead = true; break; }
            if (dead) eBullets.splice(i, 1);
        }
        // 予告範囲
        for (let i = telegraphs.length - 1; i >= 0; i--) {
            const t = telegraphs[i]; t.t -= dt;
            if (t.t <= 0) { boomAt(t.x, t.y, t.r, t.dmg, t.c); telegraphs.splice(i, 1); }
        }
        // 湧き
        if (run.phase === 'run' && !run.bossSpawned) {
            spawnT -= dt;
            const cap = ENEMY_CAP_BASE + 8 * (partyCount() - 1);
            if (spawnT <= 0 && enemies.length < cap) { spawnGroup(); spawnT = clamp(1.9 - run.kills / 70, 0.8, 1.9) / (1 + 0.25 * (partyCount() - 1)); }
            const need = Math.round(KILLS_BASE * (1 + 0.35 * (partyCount() - 1)));
            run.need = need;
            if (run.kills >= need) startBoss();
        }
        if (run.bossSpawned && run.bossDead && !run.ended) { run.ended = true; setTimeout(() => finishHost(true), 2600); }
        if (run.phase === 'run' && !run.ended) {
            const everyoneDown = me.dead && Object.keys(allies).every(id => allies[id].dead);
            if (everyoneDown) { run.ended = true; setTimeout(() => finishHost(false, 'down'), 1200); }
            else if (run.time > TIME_LIMIT) { run.ended = true; finishHost(false, 'time'); }
        }
    }

    function startBoss() {
        run.bossSpawned = true;
        enemies.forEach(e => { if (!e.boss) { e.hp = 0; fx.push({ k: 'puff', x: e.x, y: e.y, t: 0.3, life: 0.3, c: '#aaa' }); } });
        enemies = enemies.filter(e => e.hp > 0);
        const b = spawnEnemy({ name: stage.boss.name, icon: stage.boss.icon, arch: 'chaser', color: stage.boss.color }, WORLD_W / 2, WORLD_H / 2 - 200, true);
        b.spd = 78 * (1 + stage.ilvl * 0.012);
        netAnnounce('⚠ ' + stage.boss.name + ' が現れた！', 2600);
    }

    function finishHost(win, reason) {
        const d = { win: win, reason: reason || '' };
        netSend('end', d);
        finish(win, d);
    }

    // ---------- スナップショット ----------
    function makeSnap() {
        return {
            e: enemies.map(e => [e.id, e.def.icon, e.def.color, Math.round(e.x), Math.round(e.y), Math.round(e.hp), e.maxHp, e.r, e.boss ? 1 : 0, e.state, e.def.name, e.arch, e.elite ? 1 : 0, e.dmgMul || 1]),
            b: eBullets.map(b => [b.id, Math.round(b.x), Math.round(b.y), b.r, b.c]),
            t: telegraphs.map(t => [t.id, t.x, t.y, t.r, t.t, t.max, t.c]),
            k: run.kills, n: run.need, tm: Math.round(run.time), bs: run.bossSpawned ? 1 : 0
        };
    }
    function applySnap(s) {
        run.kills = s.k; run.need = s.n; run.time = s.tm; if (s.bs && !run.bossSpawned) run.bossSpawned = true;
        const old = {}; enemies.forEach(e => { old[e.id] = e; });
        enemies = s.e.map(a => {
            const o = old[a[0]] || { x: a[3], y: a[4], flash: 0 };
            return { id: a[0], def: { icon: a[1], color: a[2], name: a[10] }, x: o.x, y: o.y, tx: a[3], ty: a[4], hp: a[5], maxHp: a[6], r: a[7], boss: !!a[8], state: a[9], flash: o.flash || 0, st: { stunT: 0 }, arch: a[11] || 'chaser', elite: !!a[12], dmg: foeDmg(a[11] || 'chaser', !!a[8], !!a[12]), dmgMul: a[13] || 1 };
        });
        eBullets = s.b.map(a => { const o = eBullets.find(x => x.id === a[0]); return { id: a[0], x: o ? o.x : a[1], y: o ? o.y : a[2], tx: a[1], ty: a[2], r: a[3], c: a[4], dmg: 0, dm: 0 }; });
        // クライアント側の弾はダメージ値を持たないので、ホストが送った値で最小限の被弾を行う（体当たり相当）
        telegraphs = s.t.map(a => ({ id: a[0], x: a[1], y: a[2], r: a[3], t: a[4], max: a[5], c: a[6] }));
        eBullets.forEach(b => { b.dmg = foeDmg('ranged', false, false); });
    }
    function lerpRemote(dt) {
        const k = Math.min(1, dt * 14);
        enemies.forEach(e => { if (e.tx != null) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; } });
        eBullets.forEach(b => { if (b.tx != null) { b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k; } });
    }

    // ---------- 開始・終了 ----------
    function beginRun() {
        if (run.phase !== 'wait') return;
        run.phase = 'run'; run.time = 0;
        document.getElementById('waitRoom').style.display = 'none';
        announce(stage.icon + ' ' + stage.name + '　敵を倒してボスを呼び出せ！', 2600);
        refreshLootLog();
    }

    function finish(win, d) {
        if (run.phase === 'end') return;
        run.phase = 'end'; run.ended = true;
        // 報酬の反映
        const p = getPlayerData();
        if (p) { p.coins = (p.coins || 0) + run.stats.coins; try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) {} }
        const h = HW.load();
        if (win) { h.cleared[stage.id] = (h.cleared[stage.id] || 0) + 1; HW.save(h); }
        showResult(win, d || {});
    }

    // ---------- 描画 ----------
    const cam = { x: 0, y: 0 };
    function render() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = stage.bg2; ctx.fillRect(0, 0, VW, VH);
        cam.x = clamp(me.x, VW / 2, Math.max(VW / 2, WORLD_W - VW / 2)); cam.y = clamp(me.y, VH / 2, Math.max(VH / 2, WORLD_H - VH / 2));
        if (WORLD_W < VW) cam.x = WORLD_W / 2; if (WORLD_H < VH) cam.y = WORLD_H / 2;
        const ox = VW / 2 - cam.x, oy = VH / 2 - cam.y;
        ctx.save(); ctx.translate(ox, oy);
        // 床
        ctx.fillStyle = stage.bg; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); for (let x = 0; x <= WORLD_W; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); } for (let y = 0; y <= WORLD_H; y += 100) { ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); } ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 6; ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
        // 岩
        rocks.forEach(k => { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(k.x + 4, k.y + 6, k.r, 0, 7); ctx.fill(); ctx.fillStyle = '#6b6f78'; ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, 7); ctx.fill(); ctx.fillStyle = '#868b95'; ctx.beginPath(); ctx.arc(k.x - k.r * 0.25, k.y - k.r * 0.3, k.r * 0.55, 0, 7); ctx.fill(); });
        // 予告範囲
        telegraphs.forEach(t => { const f = 1 - t.t / t.max; ctx.fillStyle = 'rgba(255,60,60,' + (0.12 + f * 0.25) + ')'; ctx.strokeStyle = 'rgba(255,90,90,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,80,80,0.35)'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * f, 0, 7); ctx.fill(); });
        // 敵
        enemies.forEach(e => drawEnemy(e));
        // 敵弾
        eBullets.forEach(b => { ctx.fillStyle = b.c || '#ff6a5a'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, 7); ctx.fill(); });
        // 自分の弾
        myShots.forEach(s => { ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); });
        // 味方
        Object.keys(allies).forEach(id => drawPlayer(allies[id], false));
        drawPlayer(me, true);
        // 演出
        fx.forEach(f => drawFx(f));
        popups.forEach(p => { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.font = (p.big ? 'bold 18px' : 'bold 14px') + ' sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(p.text, p.x, p.y - (0.7 - Math.min(0.7, p.t)) * 30); ctx.fillStyle = p.c; ctx.fillText(p.text, p.x, p.y - (0.7 - Math.min(0.7, p.t)) * 30); ctx.globalAlpha = 1; });
        ctx.restore();
        drawHUD();
    }

    function drawEnemy(e) {
        const fl = e.flash > 0;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.8, e.r * 0.9, e.r * 0.4, 0, 0, 7); ctx.fill();
        if (e.arch === 'charger' && e.state === 1 && e.aim != null) { ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.aim) * 340, e.y + Math.sin(e.aim) * 340); ctx.stroke(); }
        if (e.boss && e.state === 1 && e.aim != null) { ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.aim) * 600, e.y + Math.sin(e.aim) * 600); ctx.stroke(); }
        ctx.fillStyle = fl ? '#fff' : (e.def.color || '#a44'); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        if (e.boss) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3; ctx.stroke(); }
        else if (e.elite) { ctx.strokeStyle = '#ff9a2a'; ctx.lineWidth = 4; ctx.stroke(); ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, 7); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.font = Math.round(e.r * 1.25) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
        ctx.fillText(e.def.icon, e.x, e.y + 1);
        if (e.st && (e.st.burnT > 0)) ctx.fillText('🔥', e.x + e.r * 0.6, e.y - e.r * 0.8);
        if (e.st && (e.st.poisonT > 0)) ctx.fillText('☠', e.x - e.r * 0.6, e.y - e.r * 0.8);
        if (e.st && (e.st.slowT > 0)) ctx.fillText('❄', e.x, e.y - e.r * 1.1);
        if (e.st && (e.st.stunT > 0)) ctx.fillText('💫', e.x, e.y - e.r * 1.2);
        ctx.textBaseline = 'alphabetic';
        if ((!e.boss && e.hp < e.maxHp) || e.elite) { const w = e.r * 2; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w, 4); ctx.fillStyle = '#e44'; ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w * Math.max(0, e.hp / e.maxHp), 4); }
    }

    function drawPlayer(p, isMe) {
        const rarC = isMe ? HW.rarityOf(weapon).color : (HW.RARITIES[p.rar] || HW.RARITIES.normal).color;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 14, 6, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = p.dead ? 0.35 : (isMe && me.inv > 0 && Math.floor(me.inv * 20) % 2 ? 0.45 : 1);
        ctx.fillStyle = isMe ? '#4a9eff' : '#4adb9a'; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 7); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = rarC; ctx.stroke();
        const a = p.ang || 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(p.name, p.x, p.y - 28); ctx.fillStyle = '#fff'; ctx.fillText(p.name, p.x, p.y - 28);
        const hp = isMe ? me.hp / me.maxHp : (p.hp / Math.max(1, p.maxHp));
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - 18, p.y - 24, 36, 5); ctx.fillStyle = hp > 0.3 ? '#4adb6a' : '#ff5a5a'; ctx.fillRect(p.x - 18, p.y - 24, 36 * clamp(hp, 0, 1), 5);
        if (isMe && me.shield) { ctx.strokeStyle = '#9fe0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, 7); ctx.stroke(); }
        if (p.dead) { ctx.font = '16px sans-serif'; ctx.fillText('💀', p.x, p.y + 5); }
    }

    function drawFx(f) {
        const k = 1 - f.t / f.life;
        ctx.globalAlpha = Math.max(0, 1 - k);
        if (f.k === 'arc') { ctx.fillStyle = f.c; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.rng, f.a - f.arc / 2, f.a + f.arc / 2); ctx.closePath(); ctx.globalAlpha *= 0.45; ctx.fill(); }
        else if (f.k === 'line') { ctx.strokeStyle = f.c; ctx.lineWidth = f.w || 4; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); }
        else if (f.k === 'ring') { const r = f.max * Math.min(1, k * 1.4); ctx.strokeStyle = f.c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); if (f.fill) { ctx.globalAlpha *= 0.3; ctx.fillStyle = f.c; ctx.fill(); ctx.globalAlpha = Math.max(0, 1 - k); } ctx.stroke(); }
        else if (f.k === 'puff') { ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, 8 + k * 22, 0, 7); ctx.globalAlpha *= 0.4; ctx.fill(); }
        else if (f.k === 'warn') { ctx.strokeStyle = f.c; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
        ctx.globalAlpha = 1;
    }

    // ---------- HUD ----------
    const el = id => document.getElementById(id);
    function drawHUD() {
        // ミニマップ
        const mw = VH < 520 ? 92 : 140, mh = Math.round(mw * WORLD_H / WORLD_W), mx = VW - mw - 10, my = VH < 520 ? 34 : 56;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(mx, my, mw, mh);
        const sx = mw / WORLD_W, sy = mh / WORLD_H;
        enemies.forEach(e => { ctx.fillStyle = e.boss ? '#ffd84a' : '#ff6a5a'; ctx.fillRect(mx + e.x * sx - 1, my + e.y * sy - 1, e.boss ? 5 : 2, e.boss ? 5 : 2); });
        Object.keys(allies).forEach(id => { ctx.fillStyle = '#4adb9a'; ctx.fillRect(mx + allies[id].x * sx - 2, my + allies[id].y * sy - 2, 4, 4); });
        ctx.fillStyle = '#4a9eff'; ctx.fillRect(mx + me.x * sx - 2, my + me.y * sy - 2, 4, 4);
        // タッチスティック
        [input.stick, input.aimStick].forEach(st => { if (st.id === null) return; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(st.ox, st.oy, 56, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(st.ox + st.x * 56, st.oy + st.y * 56, 24, 0, 7); ctx.fill(); });
        // 復活ゲージ
        if (me.dead) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('倒れています…仲間の復活を待っています', VW / 2, VH / 2); }
        // 上部情報
        const hpR = clamp(me.hp / me.maxHp, 0, 1);
        el('hpFill').style.width = (hpR * 100) + '%'; el('hpText').textContent = Math.ceil(me.hp) + ' / ' + me.maxHp;
        const mm = Math.floor(run.time / 60), ss = String(Math.floor(run.time % 60)).padStart(2, '0');
        el('timer').textContent = '⏱ ' + mm + ':' + ss;
        if (!run.bossSpawned) { el('prog').textContent = '討伐 ' + Math.min(run.kills, run.need) + ' / ' + run.need; el('progFill').style.width = (Math.min(1, run.kills / run.need) * 100) + '%'; el('bossBar').style.display = 'none'; }
        else {
            el('prog').textContent = 'ボス戦'; el('progFill').style.width = '100%';
            const b = enemies.find(e => e.boss);
            if (b) { el('bossBar').style.display = 'block'; el('bossName').textContent = b.def.name || stage.boss.name; el('bossFill').style.width = (clamp(b.hp / b.maxHp, 0, 1) * 100) + '%'; }
            else el('bossBar').style.display = 'none';
        }
    }
    function updateEnergyUI() { el('enFill').style.width = (me.energy / ENERGY_MAX * 100) + '%'; el('enText').textContent = 'ENERGY ' + Math.round(me.energy) + ' / ' + ENERGY_MAX; if (skillSlots.length) updateSkillBar(); }
    let annTimer = 0;
    function announce(text, ms) { const a = el('announce'); a.textContent = text; a.classList.add('show'); clearTimeout(annTimer); annTimer = setTimeout(() => a.classList.remove('show'), ms || 2000); }
    function refreshLootLog() {
        const box = el('lootLog');
        box.innerHTML = run.stats.loot.slice(-5).map(w => '<div style="color:' + HW.rarityOf(w).color + '">✦ ' + escapeHtml(w.name) + '</div>').join('');
    }
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    // ---------- 待機室 ----------
    function showWaitMsg(t) { const m = el('waitMsg'); if (m) m.textContent = t; }
    function renderWait() {
        const w = el('waitRoom'); w.style.display = 'flex';
        el('waitTitle').textContent = stage.icon + ' ' + stage.name + ' [' + DIFF.name + ']';
        el('waitCode').textContent = room ? ('ルームID: ' + room.id) : '';
        el('waitMembers').innerHTML = room ? room.members.map(m => '<div class="mem">' + (m.id === room.hostId ? '👑 ' : '') + escapeHtml(m.name) + '<small> ' + escapeHtml(m.wname || '') + '</small></div>').join('') : '';
        const startBtn = el('waitStart');
        startBtn.style.display = isHost ? 'inline-block' : 'none';
        showWaitMsg(isHost ? '準備ができたら「出発」を押してください（途中参加はできません）' : 'ホストの出発を待っています…');
    }

    // ---------- 結果 ----------
    function showResult(win, d) {
        const o = el('result'); o.style.display = 'flex';
        const loot = run.stats.loot.slice().sort((a, b) => HW.RARITY_ORDER.indexOf(b.rarity) - HW.RARITY_ORDER.indexOf(a.rarity));
        el('resTitle').textContent = win ? '🏆 ステージクリア！' : (d.reason === 'time' ? '⌛ 時間切れ…' : '💀 全滅…');
        el('resTitle').style.color = win ? '#ffe08a' : '#ff8a8a';
        el('resBody').innerHTML =
            '<div>討伐数：' + run.stats.kills + '　与ダメージ：' + Math.round(run.stats.dmg) + '</div>' +
            '<div>コイン +' + run.stats.coins + '　オーブ +' + run.stats.orbs + '</div>' +
            '<h4>獲得した素材（' + Object.keys(run.stats.mats).reduce((n, k) => n + run.stats.mats[k], 0) + '）</h4>' +
            (Object.keys(run.stats.mats).length ? '<div style="font-size:.85rem;color:#c8f7a0">' + Object.keys(run.stats.mats).map(id => escapeHtml(matName(id)) + '×' + run.stats.mats[id]).join('　') + '</div>' : '<div style="opacity:.7">なし</div>') +
            '<h4>獲得した武器（' + loot.length + '）</h4>' +
            (loot.length ? loot.map(w => '<div class="lw" style="color:' + HW.rarityOf(w).color + '">' + escapeHtml(w.name) + ' <small>[' + HW.rarityOf(w).label + ' / 攻撃' + w.dmg + ' / 穴' + w.sockets + ']</small></div>').join('') : '<div style="opacity:.7">なし</div>');
    }

    // ---------- クイズ（正解でエネルギー）----------
    let quizOn = true, quizPool = null, curQ = null, quizLock = false, streak = 0;
    function grade() { const g = clamp(parseInt(pdata.grade, 10) || 1, 1, 12); return g <= 6 ? { l: 'elementary', g: g } : (g <= 9 ? { l: 'junior_high', g: g - 6 } : { l: 'high_school', g: g - 9 }); }
    function buildPool() {
        const pool = {}; if (typeof QUESTIONS_DATA === 'undefined') return pool;
        const gi = grade(), lv = QUESTIONS_DATA[gi.l], gd = lv && lv[String(gi.g)]; if (!gd) return pool;
        ['math', 'jp', 'eng'].forEach(s => { if (gd[s] && gd[s].length) pool[s] = gd[s]; });
        return pool;
    }
    const shuf = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; } return r; };
    function opts(q, qs) {
        if (q.options && q.options.length === 4) return shuf(q.options.map(String));
        const ans = String(q.answer), out = [ans], set = new Set(out);
        if (ans.trim() !== '' && !isNaN(ans)) { const n = parseFloat(ans), isInt = Number.isInteger(n); for (const c of shuf([1, -1, 2, -2, 10, -10, 3, -3, 5, 4])) { if (out.length >= 4) break; const v = isInt ? String(n + c) : String(Math.round((n + c * 0.1) * 100) / 100); if (!set.has(v)) { set.add(v); out.push(v); } } }
        else { for (const o of shuf(qs.map(x => String(x.answer)))) { if (out.length >= 4) break; if (!set.has(o)) { set.add(o); out.push(o); } } }
        let k = 1; while (out.length < 4) out.push(ans + '・' + k++);
        return shuf(out);
    }
    function nextQuiz() {
        if (!quizPool) quizPool = buildPool();
        const subs = Object.keys(quizPool);
        if (!subs.length) curQ = { q: '3 + 4 = ?', a: '7', o: ['7', '6', '8', '12'] };
        else { const s = subs[Math.floor(Math.random() * subs.length)], qs = quizPool[s], q = qs[Math.floor(Math.random() * qs.length)]; curQ = { q: q.question, a: String(q.answer), o: opts(q, qs) }; }
        quizLock = false;
        el('quizQ').textContent = curQ.q;
        const box = el('quizC'); box.innerHTML = '';
        curQ.o.forEach((o, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + '. ' + o; b.dataset.v = o; b.addEventListener('click', () => answer(o, b)); box.appendChild(b); });
    }
    function answer(o, b) {
        if (quizLock || !curQ || run.phase === 'end') return; quizLock = true;
        if (o === curQ.a) { streak++; b.classList.add('ok'); addEnergy((25 + (streak >= 3 ? 10 : 0)) * P.energyMul); popups.push({ x: me.x, y: me.y - 40, t: 0.8, text: '+ENERGY', c: '#7fe3ff' }); setTimeout(nextQuiz, 300); }
        else { streak = 0; b.classList.add('ng'); Array.from(el('quizC').children).forEach(x => { if (x.dataset.v === curQ.a) x.classList.add('ok'); }); setTimeout(nextQuiz, 1300); }
    }
    function quizPick(i) { const b = el('quizC').children[i]; if (b) b.click(); }
    function toggleQuiz() { quizOn = !quizOn; el('quiz').style.display = quizOn ? 'block' : 'none'; }

    // ---------- ループ ----------
    let last = performance.now(), skillT = 0;
    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (window.SBOrientation && SBOrientation.blocking() && partyCount() === 1) { render(); requestAnimationFrame(loop); return; }
        if (run.phase === 'run') {
            run.time += dt;
            skillSlots.forEach(sk => { if (sk && sk.cdLeft > 0) sk.cdLeft = Math.max(0, sk.cdLeft - dt); });
            if ((skillT -= dt) <= 0) { skillT = 0.1; updateSkillBar(); }
            updateMe(dt); updateShots(dt);
            if (isHost) { updateHost(dt); } else lerpRemote(dt);
            // 位置の送信
            posT -= dt; if (posT <= 0) { posT = 1 / 15; netSend('pos', { x: Math.round(me.x), y: Math.round(me.y), a: +me.ang.toFixed(2), hp: Math.round(me.hp), mh: me.maxHp, dead: me.dead }); }
            snapT -= dt; if (isHost && room && snapT <= 0) { snapT = 1 / SNAP_HZ; netSend('snap', makeSnap()); }
        } else if (run.phase === 'end') { updateShots(dt); }
        Object.keys(allies).forEach(id => { const a = allies[id]; a.x += (a.tx - a.x) * Math.min(1, dt * 14); a.y += (a.ty - a.y) * Math.min(1, dt * 14); });
        fx.forEach(f => { f.t -= dt; }); fx = fx.filter(f => f.t > 0);
        popups.forEach(p => { p.t -= dt; }); popups = popups.filter(p => p.t > 0);
        enemies.forEach(e => { if (e.flash > 0) e.flash -= dt; });
        render();
        requestAnimationFrame(loop);
    }

    // ---------- 起動 ----------
    el('waitStart').addEventListener('click', () => { if (socket && room) socket.emit('stage:start'); else beginRun(); });
    el('waitLeave').addEventListener('click', () => { if (socket) socket.emit('stage:leave'); location.href = 'index.html'; });
    el('resBack').addEventListener('click', () => { if (socket) socket.emit('stage:leave'); location.href = 'index.html'; });
    el('quizToggle').addEventListener('click', toggleQuiz);
    window.addEventListener('beforeunload', () => { if (socket) socket.emit('stage:leave'); });
    if (isTouch) {
        document.documentElement.classList.add('touch');
        // 最初のタッチ（ユーザー操作）で全画面にして横向きに固定する。対応していない端末では何も起きない
        window.addEventListener('pointerdown', function once() { window.removeEventListener('pointerdown', once); if (window.SBOrientation) SBOrientation.enterFullscreenLandscape(); }, { once: true });
    }

    el('wpnName').textContent = weapon.name; el('wpnName').style.color = HW.rarityOf(weapon).color;
    el('stageName').textContent = stage.icon + ' ' + stage.name + ' [' + DIFF.name + ']';
    buildSkillBar(); updateEnergyUI(); nextQuiz();

    if (launch.mode === 'solo') {
        isHost = true; room = null;
        el('waitRoom').style.display = 'none';
        beginRun();
    } else {
        renderWait();
        if (!setupNet()) { showWaitMsg('通信できないため、ソロで開始します'); setTimeout(beginRun, 1200); }
    }
    requestAnimationFrame(loop);
})();
