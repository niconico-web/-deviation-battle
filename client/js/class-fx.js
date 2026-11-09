// ============================================================
//  職業の戦闘効果（ステージ戦闘）：固有効果12種と、専用グリフの動き
// ------------------------------------------------------------
//  practice.js が、次の場面でここを呼ぶ（職業を選んでいないときは、何もしない）：
//    ClassFx.setup(bridge)      戦闘の開始
//    ClassFx.castMul(p, s, i)   スキルを撃つ瞬間。威力の倍率を返す（怒りゲージ・剣気・賭け…。グリフの自己強化もここ）
//    ClassFx.onHit(e, dmg, eff, st)  スキルが敵に当たる瞬間。ダメージを返す（奇襲・聖なる加護・グリフ）
//    ClassFx.incomingMul()      被弾の倍率（不動の城）
//    ClassFx.onHurt(dmg) / onKill(e)
//    ClassFx.update(dt) / draw(ctx)
//  サブ職業の効果は、scale=0.5 で「半分」になる（ClassSys.scaleOf）
// ============================================================
(function (global) {
    'use strict';
    const CS = () => global.ClassSys;
    let B = null;                                   // 戦闘エンジンとの橋渡し
    let U = {};                                     // 今ついている固有効果：{ 職業ID: scale }
    let S = {};                                     // 戦闘中の状態
    const rnd = (a, b) => a + Math.random() * (b - a);

    function setup(bridge) {
        B = bridge; U = {}; S = { rage: 0, stack: 0, stackT: 0, souls: 0, lastEl: null, still: 0, lastX: 0, lastY: 0, traps: [], trapCd: 0, flash: {} };
        try { CS().activeUniques().forEach(u => { U[u.id] = u.scale; }); } catch (e) { U = {}; }
        const me = B && B.me(); if (me) { S.lastX = me.x; S.lastY = me.y; }
    }
    const on = id => U[id] || 0;
    const has = () => Object.keys(U).length > 0;
    const pop = (t, c, dy) => { const me = B.me(); B.popup(t, me.x, me.y - (dy || 46), c || '#ffe08a'); };

    // ---------- スキルを撃つ瞬間：威力の倍率 ----------
    function castMul(p, s, slotIdx) {
        if (!B || !has()) return 1;
        const me = B.me(); let mul = 1;
        let sc;
        if ((sc = on('barbarian'))) {
            if (S.rage >= 100) { mul *= 1 + 0.6 * sc; S.rage = 0; pop('😡 怒り爆発！', '#ff6a5a'); B.ring(me.x, me.y, 120, '#ff6a5a'); }
        }
        if ((sc = on('blademaster'))) {
            mul *= 1 + 0.06 * S.stack * sc;
            S.stack = Math.min(5, S.stack + 1); S.stackT = 6;
        }
        if ((sc = on('necromancer'))) mul *= 1 + 0.03 * S.souls * sc;
        if ((sc = on('elementalist'))) {
            const el = p && p.element;
            if (el) { if (S.lastEl && S.lastEl !== el) { mul *= 1 + 0.25 * sc; pop('🔮 共鳴！', '#c9a8ff'); } S.lastEl = el; }
        }
        if ((sc = on('gambler'))) {
            const TABLE = [0.6, 0.8, 1.0, 1.25, 1.6, 2.2], d = Math.floor(Math.random() * 6);
            const m = 1 + (TABLE[d] - 1) * sc; mul *= m;
            pop('🎲' + (d + 1) + ' ×' + (Math.round(m * 100) / 100), d >= 4 ? '#ffd84a' : (d <= 1 ? '#9aa6c4' : '#ffffff'));
        }
        if ((sc = on('gunslinger'))) {
            (B.slots() || []).forEach((sl, i) => { if (sl && i !== slotIdx && sl.cdLeft > 0) sl.cdLeft = Math.max(0, sl.cdLeft - 0.5 * sc); });
        }
        if ((sc = on('spellbreaker'))) {
            const cap = me.maxHp * 0.2 * sc, per = me.maxHp * 0.02 * sc; let got = 0, n = 0;
            const bl = B.eBullets();
            for (let i = bl.length - 1; i >= 0; i--) { const b = bl[i]; if (Math.hypot(b.x - me.x, b.y - me.y) <= 150) { bl.splice(i, 1); n++; if (got < cap) { got += per; } } }
            if (n > 0) { B.barrier(Math.min(got, cap)); pop('✂️ 弾を断った ×' + n, '#9df0ff'); B.ring(me.x, me.y, 150, '#9df0ff'); }
        }
        // グリフ「自己強化」（使うと自分に効く）
        (p && p.effects || []).forEach(k => {
            const o = CS().GLYPH_OWNER[k]; if (!o || o.def.tpl !== 'self') return;
            const g = CS().glyphScale(k); if (g <= 0) return;
            if (o.def.self.haste) { me.haste = Math.max(me.haste || 0, o.def.self.haste * g); pop('⚡ 加速', '#9df0ff'); }
            if (o.def.self.empower) { me.empowerT = Math.max(me.empowerT || 0, o.def.self.empower * g); }
            if (o.def.self.fortify) { me.fortifyT = Math.max(me.fortifyT || 0, o.def.self.fortify * g); }
        });
        return mul;
    }

    // ---------- スキルが当たる瞬間 ----------
    function onHit(e, dmg, eff, st) {
        if (!B || !has() || !e) return dmg;
        const me = B.me(); let sc;
        // 印（受けるダメージが増える）
        if (e.cmark && e.cmark.t > 0) dmg *= 1 + e.cmark.mul;
        if ((sc = on('assassin')) && e.hp >= (e.maxHp || e.hp) * 0.9) dmg *= 1 + 0.5 * sc;       // 奇襲
        // 専用グリフ
        (eff || []).forEach(k => {
            const o = CS().GLYPH_OWNER[k]; if (!o) return;
            const g = CS().glyphScale(k); if (g <= 0) return;
            const d = o.def;
            if (d.tpl === 'dot') { const per = dmg * d.pct * g / d.sec; e.cdot = { per: Math.max(e.cdot ? e.cdot.per : 0, per), t: d.sec, acc: 0 }; }
            else if (d.tpl === 'mark') { e.cmark = { mul: d.mul * g, t: d.sec }; if (d.st) applySt(st, d.st, g); }
            else if (d.tpl === 'execute') { if (e.hp / (e.maxHp || e.hp) <= d.thr) dmg *= 1 + d.bonus * g; }
            else if (d.tpl === 'crit') { if (Math.random() < d.chance * g) { dmg *= d.mul; B.popup('CRIT', e.x, e.y - e.r - 20, '#ffd84a'); } }
            else if (d.tpl === 'st') applySt(st, d.st, g);
            else if (d.tpl === 'leech') { B.heal(dmg * d.pct * g); if (d.barrier) B.barrier(me.maxHp * d.barrier * g); }
            else if (d.tpl === 'heal') B.heal(me.maxHp * d.pct * g);
            else if (d.tpl === 'barrier') B.barrier(me.maxHp * d.pct * g);
            else if (d.tpl === 'pull') pullEnemy(e, d.px * g);
            else if (d.tpl === 'splash') {
                const base = dmg * d.pct * g;
                B.enemies().forEach(o2 => { if (o2 !== e && o2.hp > 0 && Math.hypot(o2.x - e.x, o2.y - e.y) <= d.r + o2.r) B.dealHit(o2, Math.max(1, Math.round(base)), {}); });
                B.ring(e.x, e.y, d.r, '#ffb04a');
            } else if (d.tpl === 'chain') {
                const base = dmg * d.pct * g; let from = e; const used = [e];
                for (let i = 0; i < d.n; i++) {
                    let best = null, bd = d.r;
                    B.enemies().forEach(o2 => { if (o2.hp > 0 && used.indexOf(o2) < 0) { const dd = Math.hypot(o2.x - from.x, o2.y - from.y); if (dd < bd) { bd = dd; best = o2; } } });
                    if (!best) break;
                    B.line(from.x, from.y, best.x, best.y, '#fff3b0'); B.dealHit(best, Math.max(1, Math.round(base)), {}); used.push(best); from = best;
                }
            }
        });
        // 聖なる加護（与ダメージの一部を回復。HPが低いほど増える）
        if ((sc = on('crusader'))) B.heal(dmg * 0.06 * sc * (1 + (1 - me.hp / me.maxHp)));
        return Math.round(dmg);
    }
    function applySt(st, add, g) {
        Object.keys(add).forEach(k => {
            if (k === 'stun') { const v = add.stun * g; if (v > 0.05) st.stun = Math.max(st.stun || 0, v); }
            else if (Math.random() < g) st[k] = add[k];            // 鈍足・弱体・目眩は、サブでは半分の確率
        });
    }
    function pullEnemy(e, px) {
        const me = B.me(); const d = Math.hypot(me.x - e.x, me.y - e.y) || 1, k = Math.min(px, Math.max(0, d - me.r - e.r - 6)) / d;
        e.x += (me.x - e.x) * k; e.y += (me.y - e.y) * k;
    }

    // ---------- 被弾・撃破 ----------
    function incomingMul() {
        const sc = on('juggernaut'); if (!B || !sc) return 1;
        return 1 - Math.min(0.35 * sc, 0.07 * sc * S.still);
    }
    function onHurt(dmg) {
        if (!B || !has()) return;
        const me = B.me(); let sc;
        if ((sc = on('barbarian'))) { const before = S.rage; S.rage = Math.min(100, S.rage + (dmg / me.maxHp) * 220); if (before < 100 && S.rage >= 100) pop('😡 怒り満タン！', '#ff6a5a'); }
        if (on('blademaster') && S.stack > 0) S.stack--;
    }
    function onKill(e) {
        if (!B || !has()) return;
        const me = B.me(); let sc;
        if ((sc = on('necromancer'))) { S.souls = Math.min(10, S.souls + 1); }
        if ((sc = on('crusader'))) B.heal(me.maxHp * 0.02 * sc);
        if ((sc = on('alchemist')) && Math.random() < 0.3) {
            const r = Math.floor(Math.random() * 3);
            if (r === 0) { B.heal(me.maxHp * 0.06 * sc); pop('🧪 回復薬', '#7CFC9A'); }
            else if (r === 1) { me.empowerT = Math.max(me.empowerT || 0, 3 * sc); pop('🧪 力の薬', '#ffb347'); }
            else { me.haste = Math.max(me.haste || 0, 3 * sc); pop('🧪 俊足の薬', '#9df0ff'); }
        }
    }

    // ---------- 毎フレーム ----------
    function update(dt) {
        if (!B || !has()) { tickEnemies(dt); return; }
        const me = B.me();
        // 立ち止まっている時間（不動の城・仕掛け）
        const moved = Math.hypot(me.x - S.lastX, me.y - S.lastY);
        if (moved < 2) S.still = Math.min(5.5, S.still + dt); else S.still = Math.max(0, S.still - dt * 2.5);      // 5秒で最大。動くと、すぐ下がり始める
        S.lastX = me.x; S.lastY = me.y;
        if (S.stackT > 0) { S.stackT -= dt; if (S.stackT <= 0) S.stack = 0; }
        // 罠師：仕掛け
        let sc;
        if ((sc = on('trapper'))) {
            S.trapCd -= dt;
            if (S.still >= 1.5 && S.traps.length < 3 && S.trapCd <= 0 && !me.dead) { S.traps.push({ x: me.x, y: me.y, t: 40 }); S.trapCd = 3; pop('💣 罠を仕掛けた', '#ffd9a0', 30); S.still = 0.5; }
            for (let i = S.traps.length - 1; i >= 0; i--) {
                const tr = S.traps[i]; tr.t -= dt; let fired = false;
                if (tr.t <= 0) { S.traps.splice(i, 1); continue; }
                B.enemies().forEach(e => {
                    if (fired || e.hp <= 0 || Math.hypot(e.x - tr.x, e.y - tr.y) > 30 + e.r) return;
                    fired = true;
                    const dmg = B.unitDmg() * 1.0 * sc;
                    B.ring(tr.x, tr.y, 90, '#ffb04a');
                    B.enemies().forEach(o2 => { if (o2.hp > 0 && Math.hypot(o2.x - tr.x, o2.y - tr.y) <= 90 + o2.r) { B.dealHit(o2, Math.max(1, Math.round(dmg)), {}); B.setStun(o2, 0.8 * sc); } });
                });
                if (fired) S.traps.splice(i, 1);
            }
        }
        tickEnemies(dt);
    }
    // 継続ダメージ（グリフ）と印の時間切れ
    function tickEnemies(dt) {
        if (!B) return;
        B.enemies().forEach(e => {
            if (e.hp <= 0) { e.cdot = null; e.cmark = null; return; }
            if (e.cmark) { e.cmark.t -= dt; if (e.cmark.t <= 0) e.cmark = null; }
            if (e.cdot) {
                e.cdot.t -= dt; e.cdot.acc += dt;
                if (e.cdot.acc >= 0.5) { const n = Math.max(1, Math.round(e.cdot.per * e.cdot.acc)); e.cdot.acc = 0; B.dealHit(e, n, {}); }
                if (e.cdot.t <= 0) e.cdot = null;
            }
        });
    }

    // ---------- 描画（世界座標の中）----------
    function draw(ctx) {
        if (!B || !has()) return;
        const me = B.me(); if (me.dead) return;
        const x = me.x, y = me.y - me.r - 18;
        const bar = (v, max, color, label) => {
            ctx.save(); ctx.fillStyle = 'rgba(10,12,20,.7)'; ctx.fillRect(x - 24, y, 48, 6);
            ctx.fillStyle = color; ctx.fillRect(x - 24, y, 48 * Math.min(1, v / max), 6);
            ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.strokeRect(x - 24, y, 48, 6);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x, y - 2); ctx.restore();
        };
        let off = 0;
        const row = (fn) => { fn(); ctx.save(); ctx.translate(0, 0); ctx.restore(); };
        if (on('barbarian')) { bar(S.rage, 100, S.rage >= 100 ? '#ff3b2f' : '#e0614a', '怒り'); }
        else if (on('blademaster')) { bar(S.stack, 5, '#9df0ff', '剣気 ' + S.stack); }
        else if (on('necromancer')) { bar(S.souls, 10, '#b46bff', '魂 ' + S.souls); }
        else if (on('juggernaut')) { bar(Math.min(S.still, 5), 5, '#b0bcc9', '不動'); }
        // 罠
        S.traps.forEach(tr => {
            ctx.save(); ctx.strokeStyle = '#ffd9a0'; ctx.fillStyle = 'rgba(255,170,60,.25)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(tr.x, tr.y, 16, 0, 6.2832); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(tr.x - 8, tr.y - 8); ctx.lineTo(tr.x + 8, tr.y + 8); ctx.moveTo(tr.x + 8, tr.y - 8); ctx.lineTo(tr.x - 8, tr.y + 8); ctx.stroke(); ctx.restore();
        });
        // 敵につけた印・継続ダメージ
        B.enemies().forEach(e => {
            if (e.hp <= 0) return;
            if (e.cmark) { ctx.save(); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, 6.2832); ctx.stroke(); ctx.restore(); }
            if (e.cdot) { ctx.save(); ctx.fillStyle = 'rgba(160,255,120,.55)'; ctx.beginPath(); ctx.arc(e.x + e.r * 0.6, e.y - e.r * 0.6, 4, 0, 6.2832); ctx.fill(); ctx.restore(); }
        });
    }

    global.ClassFx = { setup, castMul, onHit, incomingMul, onHurt, onKill, update, draw, _state: () => S, _setU: (u) => { U = u; } };
})(typeof window !== 'undefined' ? window : globalThis);
