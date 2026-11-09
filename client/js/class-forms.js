// ============================================================
//  職業専用の「スキルの形」36個（1職業につき3つ）
// ------------------------------------------------------------
//  既存の形（投射・レーザー・斬撃…）を数字だけ変えたものではなく、それぞれ専用の動き（自分が動く・設置物・分身・召喚・連鎖…）を持つ。
//  発動は practice.js の castSkill から ClassForms.cast(形のキー, ctx) で呼ばれる。毎フレーム update(dt) と draw(ctx) が呼ばれる。
//   ctx = { base: 1ヒットの基準ダメージ, hasDmg, eff: 付いている効果, ang: 狙った向き, p: compute の params, skill }
//  ダメージは、すべて B.skillHit（通常のスキルと同じ処理＝グリフ・属性・職業の固有効果が乗る）を通る。
//  見た目は自分の画面にだけ出る（ほかのプレイヤーの画面には出ない）。
// ============================================================
(function (global) {
    'use strict';
    let B = null;
    const ents = [];        // 動いているもの（設置物・分身・弾など）
    const bullets = [];     // この形専用の弾
    const rnd = (a, b) => a + Math.random() * (b - a);
    const TAU = Math.PI * 2;
    const ELCOL = { fire: '#ff7a3d', water: '#4aa8ff', wind: '#9dffd2', earth: '#c9a15a', thunder: '#ffe14a', ice: '#bfeaff', venom: '#b46bff', light: '#fff3b0', dark: '#8a63d2' };

    function setBridge(b) { B = b; ents.length = 0; bullets.length = 0; }
    function add(o) { ents.push(o); return o; }
    function after(sec, fn) { return add({ w: sec, update(dt) { this.w -= dt; if (this.w <= 0) { fn(); return false; } return true; } }); }
    const alive = () => B && B.isRun() && !B.me().dead;

    // ---------- 共通の当たり判定 ----------
    function mk(ctx) {
        const hit = (e, mult, a) => B.skillHit(e, ctx.base * mult, ctx.hasDmg, ctx.eff, a == null ? Math.atan2(e.y - B.me().y, e.x - B.me().x) : a);
        return {
            hit,
            circle(x, y, r, mult, fn) { let n = 0; B.enemies().forEach(e => { if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) <= r + e.r) { hit(e, mult, Math.atan2(e.y - y, e.x - x)); if (fn) fn(e); n++; } }); return n; },
            line(x1, y1, x2, y2, w, mult, fn) { let n = 0; B.enemies().forEach(e => { if (e.hp > 0 && B.distSeg(e.x, e.y, x1, y1, x2, y2) <= w / 2 + e.r) { hit(e, mult, Math.atan2(y2 - y1, x2 - x1)); if (fn) fn(e); n++; } }); return n; },
            cone(x, y, a, r, arc, mult, fn) {
                let n = 0;
                B.enemies().forEach(e => {
                    if (e.hp <= 0) return; const d = Math.hypot(e.x - x, e.y - y); if (d > r + e.r) return;
                    let da = Math.atan2(e.y - y, e.x - x) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
                    if (Math.abs(da) <= arc / 2 || d < e.r + 18) { hit(e, mult, a); if (fn) fn(e); n++; }
                }); return n;
            }
        };
    }
    // 狙う地点：いちばん近い敵（なければ、狙った向きの先）
    function targetPoint(ctx, maxD, ahead) {
        const me = B.me(), tg = B.nearestEnemy(me.x, me.y, maxD || 460);
        if (tg) return { x: tg.x, y: tg.y, e: tg };
        const w = B.world(); return { x: Math.max(30, Math.min(w.w - 30, me.x + Math.cos(ctx.ang) * (ahead || 260))), y: Math.max(30, Math.min(w.h - 30, me.y + Math.sin(ctx.ang) * (ahead || 260))), e: null };
    }
    const nearestN = (x, y, maxD, n, except) => B.enemies().filter(e => e.hp > 0 && (!except || except.indexOf(e) < 0) && Math.hypot(e.x - x, e.y - y) <= maxD + e.r).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, n);
    const flash = (x, y, r, c) => B.ring(x, y, r, c || '#fff3b0');

    // ---------- この形専用の弾 ----------
    function shoot(o) { if (global.ClassPerks && global.ClassPerks.pierceAll()) o.pierce = 99; bullets.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, r: 8, life: 1, mult: 0.3, pierce: 0, bounce: 0, color: '#ffffff', hitAt: new Map(), rehit: 0 }, o)); }
    function updateBullets(dt) {
        const w = B.world(), rocks = B.rocks();
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.home) { const tg = B.nearestEnemy(b.x, b.y, 900); if (tg) { const sp = Math.hypot(b.vx, b.vy) || 1; let da = Math.atan2(tg.y - b.y, tg.x - b.x) - Math.atan2(b.vy, b.vx); da = Math.atan2(Math.sin(da), Math.cos(da)); const na = Math.atan2(b.vy, b.vx) + Math.max(-b.home * dt, Math.min(b.home * dt, da)); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; } }
            let dead = b.life <= 0;
            if (b.bounce > 0 || b.bounce === 0 && false) { /* 下で処理 */ }
            // 壁・岩での跳ね返り
            let bounced = false;
            if (b.x < 0 || b.x > w.w) { if (b.bounce > 0) { b.vx = -b.vx; b.x = Math.max(0, Math.min(w.w, b.x)); b.bounce--; bounced = true; } else dead = true; }
            if (b.y < 0 || b.y > w.h) { if (b.bounce > 0) { b.vy = -b.vy; b.y = Math.max(0, Math.min(w.h, b.y)); b.bounce--; bounced = true; } else dead = true; }
            if (!dead) for (const k of rocks) {
                if (Math.hypot(b.x - k.x, b.y - k.y) < k.r + b.r) {
                    if (b.bounce > 0) { const nx = b.x - k.x, ny = b.y - k.y, l = Math.hypot(nx, ny) || 1, dot = (b.vx * nx + b.vy * ny) / l; b.vx -= 2 * dot * nx / l; b.vy -= 2 * dot * ny / l; b.x = k.x + nx / l * (k.r + b.r + 1); b.y = k.y + ny / l * (k.r + b.r + 1); b.bounce--; bounced = true; }
                    else dead = true; break;
                }
            }
            if (bounced && b.onBounce) b.onBounce(b);
            if (b.tick) b.tick(b);
            if (!dead) {
                for (const e of B.enemies()) {
                    if (e.hp <= 0 || Math.hypot(e.x - b.x, e.y - b.y) > e.r + b.r) continue;
                    const last = b.hitAt.get(e) || -9; if (b.rehit <= 0 ? b.hitAt.has(e) : (b.t0 - b.life) - last < b.rehit) continue;
                    b.hitAt.set(e, b.t0 - b.life);
                    if (b.onHit) b.onHit(e, b); else b.ctxm.hit(e, b.mult, Math.atan2(b.vy, b.vx));
                    if (b.pierce-- <= 0) { dead = true; break; }
                }
            }
            if (dead) bullets.splice(i, 1);
        }
    }
    function fire(ctxm, o) { const t0 = o.life == null ? 1 : o.life; shoot(Object.assign({ ctxm, t0 }, o)); }
    function drawBullets(c) {
        bullets.forEach(b => { c.save(); c.fillStyle = b.color; c.globalAlpha = 0.9; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill(); c.globalAlpha = 0.35; c.beginPath(); c.arc(b.x - b.vx * 0.02, b.y - b.vy * 0.02, b.r * 1.5, 0, TAU); c.fill(); c.restore(); });
    }

    // ---------- 形の実装 ----------
    const IMPL = {};

    // ===== バーバリアン =====
    IMPL.bar_spin = function (ctx) {                     // 大旋回：武器を回しながら敵に近づく
        const m = mk(ctx); let t = 0, acc = 0, spin = 0;
        add({ update(dt) {
            if (!alive()) return false; t += dt; acc += dt; spin += dt * 15;
            const me = B.me(), tg = B.nearestEnemy(me.x, me.y, 560), a = tg ? Math.atan2(tg.y - me.y, tg.x - me.x) : ctx.ang;
            B.moveMe(Math.cos(a) * 255 * dt, Math.sin(a) * 255 * dt);
            if (acc >= 0.18) { acc = 0; m.circle(me.x, me.y, 100, 0.55); }
            return t < 1.6;
        }, draw(c) { const me = B.me(); c.save(); c.translate(me.x, me.y); c.rotate(spin); c.strokeStyle = '#ffd9a0'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-98, 0); c.lineTo(98, 0); c.stroke(); c.rotate(Math.PI / 2); c.globalAlpha = 0.6; c.beginPath(); c.moveTo(-98, 0); c.lineTo(98, 0); c.stroke(); c.restore(); } });
    };
    IMPL.bar_rock = function (ctx) {                     // 岩投げ：放り投げて、着弾で砕ける
        const m = mk(ctx), me = B.me(), tp = targetPoint(ctx, 480, 300), sx = me.x, sy = me.y, T = 0.7; let t = 0;
        add({ update(dt) {
            t += dt;
            if (t >= T) {
                m.circle(tp.x, tp.y, 95, 1.5); flash(tp.x, tp.y, 105, '#c9a15a');
                for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3; fire(m, { x: tp.x, y: tp.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, r: 7, life: 0.35, mult: 0.3, color: '#b89a6a' }); }
                return false;
            } return true;
        }, draw(c) { const f = Math.min(1, t / T), x = sx + (tp.x - sx) * f, y = sy + (tp.y - sy) * f - Math.sin(f * Math.PI) * 120; c.save(); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(sx + (tp.x - sx) * f, sy + (tp.y - sy) * f, 20, 8, 0, 0, TAU); c.fill(); c.fillStyle = '#8c7a5b'; c.strokeStyle = '#4a3f2c'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 24, 0, TAU); c.fill(); c.stroke(); c.restore(); } });
    };
    IMPL.bar_roar = function (ctx) {                     // 戦場の雄叫び：引き寄せて、衝撃で怯ませる
        const m = mk(ctx); let t = 0; const R = 270;
        add({ update(dt) {
            if (!alive()) return false; t += dt; const me = B.me();
            B.enemies().forEach(e => { if (e.hp <= 0) return; const d = Math.hypot(me.x - e.x, me.y - e.y); if (d > R + e.r || d < 70) return; const k = Math.min(150 / 0.35 * dt * (e.boss ? 0.4 : 1), d - 70) / d; e.x += (me.x - e.x) * k; e.y += (me.y - e.y) * k; });
            if (t >= 0.35) { m.circle(me.x, me.y, 135, 0.8, e => B.setStun(e, 0.5)); flash(me.x, me.y, 140, '#ff9a5a'); return false; }
            return true;
        }, draw(c) { const me = B.me(); c.save(); c.strokeStyle = '#ff9a5a'; c.lineWidth = 4; for (let i = 0; i < 3; i++) { const f = ((t * 2.8 + i / 3) % 1); c.globalAlpha = 1 - f; c.beginPath(); c.arc(me.x, me.y, R * (1 - f), 0, TAU); c.stroke(); } c.restore(); } });
    };

    // ===== ジャガーノート =====
    IMPL.jug_wall = function (ctx) {                     // 城壁展開：壁を立てて、敵の弾を止める
        const m = mk(ctx), me = B.me(), a = ctx.ang, cx = me.x + Math.cos(a) * 130, cy = me.y + Math.sin(a) * 130, px = -Math.sin(a), py = Math.cos(a), L = 110; let t = 6;
        const x1 = cx + px * L, y1 = cy + py * L, x2 = cx - px * L, y2 = cy - py * L;
        m.line(x1, y1, x2, y2, 40, 0.6); flash(cx, cy, 90, '#b0bcc9');
        add({ update(dt) {
            t -= dt; const bl = B.eBullets();
            for (let i = bl.length - 1; i >= 0; i--) { const b = bl[i]; if (B.distSeg(b.x, b.y, x1, y1, x2, y2) < 20 + b.r) bl.splice(i, 1); }
            return t > 0 && B.isRun();
        }, draw(c) { c.save(); c.globalAlpha = Math.min(1, t); c.strokeStyle = '#6b7685'; c.lineWidth = 26; c.lineCap = 'butt'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = '#c9d3df'; c.lineWidth = 6; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore(); } });
    };
    IMPL.jug_charge = function (ctx) {                   // 暴走突進：止まれず走り、触れた敵を弾き飛ばす
        const m = mk(ctx), me0 = B.me(), a = ctx.ang, DIST = 400, T = 0.5, done = new Set(); let t = 0; const trail = [];
        me0.inv = Math.max(me0.inv || 0, T + 0.15);
        add({ update(dt) {
            if (!alive()) return false; t += dt; const me = B.me();
            B.moveMe(Math.cos(a) * DIST / T * dt, Math.sin(a) * DIST / T * dt); trail.push({ x: me.x, y: me.y, t: 0.3 }); if (trail.length > 14) trail.shift();
            B.enemies().forEach(e => { if (e.hp > 0 && !done.has(e) && Math.hypot(e.x - me.x, e.y - me.y) < 62 + e.r) { done.add(e); m.hit(e, 1.0, a); e.x += Math.cos(a) * 90 * (e.boss ? 0.3 : 1); e.y += Math.sin(a) * 90 * (e.boss ? 0.3 : 1); } });
            if (t >= T) { m.circle(me.x, me.y, 105, 0.5); flash(me.x, me.y, 110, '#ffd9a0'); return false; } return true;
        }, draw(c) { trail.forEach(p => { p.t -= 0.016; c.save(); c.globalAlpha = Math.max(0, p.t); c.fillStyle = '#c9d3df'; c.beginPath(); c.arc(p.x, p.y, 26, 0, TAU); c.fill(); c.restore(); }); } });
    };
    IMPL.jug_chain = function (ctx) {                    // 大地の鎖：敵を縫い止める
        const m = mk(ctx), tp = targetPoint(ctx, 480, 230); let t = 0, fired = false; const R = 115;
        add({ update(dt) {
            t += dt;
            if (!fired && t >= 0.5) { fired = true; m.circle(tp.x, tp.y, R, 0.7, e => { if (e.boss) B.setSt(e, { slow: 1 }); else B.setStun(e, 1.2); }); flash(tp.x, tp.y, R, '#8a7a66'); }
            return t < 1.7;
        }, draw(c) { c.save(); if (t < 0.5) { c.strokeStyle = 'rgba(255,200,120,.8)'; c.setLineDash([8, 8]); c.lineWidth = 3; c.beginPath(); c.arc(tp.x, tp.y, R, 0, TAU); c.stroke(); } else { c.strokeStyle = '#7f8c99'; c.lineWidth = 6; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.beginPath(); c.moveTo(tp.x + Math.cos(a) * 20, tp.y + Math.sin(a) * 20); c.lineTo(tp.x + Math.cos(a) * R, tp.y + Math.sin(a) * R); c.stroke(); } } c.restore(); } });
    };

    // ===== ブレードマスター =====
    IMPL.bm_iai = function (ctx) {                       // 居合の構え：ためて、一気に斬り抜ける
        const m = mk(ctx), a = ctx.ang, me0 = B.me(), L = 330; let t = 0, done = false, sx = me0.x, sy = me0.y, ex = sx, ey = sy;
        add({ update(dt) {
            t += dt; const me = B.me();
            if (!done && t < 0.45) { sx = me.x; sy = me.y; ex = sx + Math.cos(a) * L; ey = sy + Math.sin(a) * L; return alive(); }
            if (!done) { done = true; m.line(sx, sy, ex, ey, 74, 2.0); B.fxLine(sx, sy, ex, ey, '#ffffff', 60); B.moveMe(Math.cos(a) * L, Math.sin(a) * L); }
            return t < 0.7;
        }, draw(c) { if (t < 0.45) { c.save(); c.strokeStyle = 'rgba(200,240,255,' + (0.3 + t) + ')'; c.lineWidth = 3 + t * 14; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); c.restore(); } } });
    };
    IMPL.bm_shadow = function (ctx) {                    // 影断ち：残像が、少し遅れて追撃する
        const m = mk(ctx), me = B.me(), a = ctx.ang, x = me.x, y = me.y;
        m.cone(x, y, a, 125, 2.1, 0.9); B.fxArc(x, y, a, 125, 2.1, '#c6f0ff');
        let t = 0; add({ update(dt) { t += dt; if (t >= 0.7) { m.cone(x, y, a, 125, 2.1, 0.75); B.fxArc(x, y, a, 125, 2.1, '#8ad0ff'); return false; } return true; },
            draw(c) { c.save(); c.globalAlpha = 0.35 + 0.2 * Math.sin(t * 20); c.fillStyle = '#9ad8ff'; c.beginPath(); c.arc(x, y, 24, 0, TAU); c.fill(); c.restore(); } });
    };
    IMPL.bm_cage = function (ctx) {                      // 剣閃の檻：敵の周りを駆け回って斬る
        const m = mk(ctx), me = B.me(), tg = B.nearestEnemy(me.x, me.y, 430);
        if (!tg) { m.cone(me.x, me.y, ctx.ang, 140, 2.4, 1.0); B.fxArc(me.x, me.y, ctx.ang, 140, 2.4, '#c6f0ff'); return; }
        let k = 0, t = 0; const cx = tg.x, cy = tg.y;
        add({ update(dt) {
            if (!alive()) return false; t += dt;
            while (k < 6 && t >= k * 0.09) {
                const a = k * TAU / 6 + 0.4, px = cx + Math.cos(a) * 85, py = cy + Math.sin(a) * 85;
                const from = { x: B.me().x, y: B.me().y }; B.teleportMe(px, py); B.fxLine(from.x, from.y, px, py, '#e6f6ff', 16);
                m.circle(cx, cy, 95, 0.5); k++;
            }
            return k < 6;
        }, draw() { } });
    };

    // ===== クルセイダー =====
    IMPL.cru_shield = function (ctx) {                   // 聖盾投げ：敵の間を跳ねて、手元に戻る
        const m = mk(ctx), me = B.me(); const targets = [];
        let from = { x: me.x, y: me.y };
        for (let i = 0; i < 3; i++) { const n = nearestN(from.x, from.y, 380, 1, targets)[0]; if (!n) break; targets.push(n); from = n; }
        const pts = targets.map(e => e); let cur = { x: me.x, y: me.y }, idx = 0, returning = false, hits = 0;
        if (!pts.length) { const w = B.world(); pts.push({ x: Math.max(20, Math.min(w.w - 20, me.x + Math.cos(ctx.ang) * 280)), y: Math.max(20, Math.min(w.h - 20, me.y + Math.sin(ctx.ang) * 280)), fake: true }); }
        add({ update(dt) {
            if (!alive()) return false;
            const tgt = returning ? B.me() : pts[idx]; const dx = tgt.x - cur.x, dy = tgt.y - cur.y, d = Math.hypot(dx, dy), step = 640 * dt;
            if (d <= step + 6) {
                cur.x = tgt.x; cur.y = tgt.y;
                if (returning) { if (hits > 0) B.heal(B.me().maxHp * 0.03); return false; }
                if (!tgt.fake && tgt.hp > 0) { m.hit(tgt, 0.8); hits++; flash(tgt.x, tgt.y, 50, '#fff3b0'); }
                idx++; if (idx >= pts.length) returning = true;
            } else { cur.x += dx / d * step; cur.y += dy / d * step; }
            return true;
        }, draw(c) { c.save(); c.translate(cur.x, cur.y); c.fillStyle = '#e8f0ff'; c.strokeStyle = '#d4a52a'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#d4a52a'; c.fillRect(-3, -12, 6, 24); c.fillRect(-12, -3, 24, 6); c.restore(); } });
    };
    IMPL.cru_sword = function (ctx) {                    // 裁きの剣：降って、地面に残り焼き続ける
        const m = mk(ctx), tp = targetPoint(ctx, 470, 260); let t = 0, landed = false, tick = 0;
        add({ update(dt) {
            t += dt;
            if (!landed && t >= 0.6) { landed = true; m.circle(tp.x, tp.y, 78, 1.4); flash(tp.x, tp.y, 85, '#fff3b0'); }
            if (landed) { tick += dt; if (tick >= 0.5) { tick = 0; m.circle(tp.x, tp.y, 72, 0.22); } }
            return t < 4.6;
        }, draw(c) { c.save(); if (!landed) { const f = t / 0.6; c.strokeStyle = 'rgba(255,240,160,.7)'; c.setLineDash([6, 6]); c.lineWidth = 3; c.beginPath(); c.arc(tp.x, tp.y, 78, 0, TAU); c.stroke(); c.setLineDash([]); c.fillStyle = '#fff3b0'; c.fillRect(tp.x - 5, tp.y - 340 * (1 - f) - 60, 10, 70); } else { c.fillStyle = 'rgba(255,230,120,' + (0.18 + 0.1 * Math.sin(t * 8)) + ')'; c.beginPath(); c.arc(tp.x, tp.y, 72, 0, TAU); c.fill(); c.fillStyle = '#fff3b0'; c.fillRect(tp.x - 4, tp.y - 38, 8, 46); c.fillRect(tp.x - 14, tp.y - 24, 28, 7); } c.restore(); } });
    };
    IMPL.cru_zone = function (ctx) {                     // 誓約の領域：中では回復し、敵は傷つく
        const m = mk(ctx), me = B.me(), x = me.x, y = me.y, R = 150; let t = 0, tick = 0;
        add({ update(dt) {
            t += dt; tick += dt;
            if (tick >= 0.5) { tick = 0; m.circle(x, y, R, 0.2); const me2 = B.me(); if (Math.hypot(me2.x - x, me2.y - y) <= R) B.heal(me2.maxHp * 0.012); }
            return t < 6 && B.isRun();
        }, draw(c) { c.save(); c.strokeStyle = 'rgba(255,230,140,.9)'; c.lineWidth = 3; c.fillStyle = 'rgba(255,240,170,.12)'; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill(); c.stroke(); c.globalAlpha = 0.6; c.beginPath(); c.arc(x, y, R * (0.6 + 0.05 * Math.sin(t * 5)), 0, TAU); c.stroke(); c.restore(); } });
    };

    // ===== ガンスリンガー =====
    IMPL.gun_fan = function (ctx) {                      // 早撃ちの舞：回転しながら全方位に撃つ
        const m = mk(ctx); let w = 0, t = 0;
        add({ update(dt) {
            if (!alive()) return false; t += dt;
            while (w < 3 && t >= w * 0.18) { const me = B.me(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + w * 0.26; fire(m, { x: me.x, y: me.y, vx: Math.cos(a) * 580, vy: Math.sin(a) * 580, r: 7, life: 0.9, mult: 0.3, color: '#ffe08a' }); } B.me().ang += 0.9; w++; }
            return w < 3;
        }, draw() { } });
    };
    IMPL.gun_ricochet = function (ctx) {                 // 跳弾：壁や岩で跳ね返る
        const m = mk(ctx), me = B.me();
        fire(m, { x: me.x, y: me.y, vx: Math.cos(ctx.ang) * 540, vy: Math.sin(ctx.ang) * 540, r: 11, life: 3, mult: 0.9, pierce: 99, bounce: 4, rehit: 0.45, color: '#ffd1a0' });
    };
    IMPL.gun_smoke = function (ctx) {                    // 煙幕弾：中の敵は目が眩み、動きが鈍る
        const m = mk(ctx), tp = targetPoint(ctx, 420, 250), R = 130; let t = 0, tick = 0;
        add({ update(dt) {
            t += dt; if (t < 0.5) return true; tick += dt;
            if (tick >= 0.5) { tick = 0; m.circle(tp.x, tp.y, R, 0.15, e => B.setSt(e, { blind: 1, slow: 1 })); }
            return t < 5.5;
        }, draw(c) { c.save(); if (t < 0.5) { c.fillStyle = '#555'; c.beginPath(); c.arc(B.me().x + (tp.x - B.me().x) * (t / 0.5), B.me().y + (tp.y - B.me().y) * (t / 0.5), 9, 0, TAU); c.fill(); } else { for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 0.3, r = R * (0.25 + (i % 3) * 0.25); c.fillStyle = 'rgba(160,165,175,.28)'; c.beginPath(); c.arc(tp.x + Math.cos(a) * r * 0.7, tp.y + Math.sin(a) * r * 0.7, R * 0.45, 0, TAU); c.fill(); } } c.restore(); } });
    };

    // ===== アサシン =====
    IMPL.asn_blink = function (ctx) {                    // 影渡り：敵の背後へ瞬間移動して斬る
        const m = mk(ctx), me = B.me(), tg = B.nearestEnemy(me.x, me.y, 580);
        if (!tg) { const from = { x: me.x, y: me.y }; B.moveMe(Math.cos(ctx.ang) * 220, Math.sin(ctx.ang) * 220); const me2 = B.me(); B.fxLine(from.x, from.y, me2.x, me2.y, '#7a5cff', 24); m.circle(me2.x, me2.y, 90, 1.0); return; }
        const dx = tg.x - me.x, dy = tg.y - me.y, d = Math.hypot(dx, dy) || 1, px = tg.x + dx / d * (tg.r + 34), py = tg.y + dy / d * (tg.r + 34);
        const from = { x: me.x, y: me.y }; B.fxLine(from.x, from.y, px, py, '#7a5cff', 24); B.teleportMe(px, py);
        m.circle(tg.x, tg.y, 95, 1.7); flash(tg.x, tg.y, 70, '#a68bff');
    };
    IMPL.asn_needles = function (ctx) {                  // 毒針の雨：狙った場所に降り注ぐ
        const m = mk(ctx), tp = targetPoint(ctx, 500, 260); const needles = [];
        for (let i = 0; i < 14; i++) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * 150; needles.push({ x: tp.x + Math.cos(a) * r, y: tp.y + Math.sin(a) * r, at: i * 0.057, done: false, stuck: 0 }); }
        let t = 0; add({ update(dt) { t += dt; needles.forEach(n => { if (!n.done && t >= n.at) { n.done = true; n.stuck = 1.6; m.circle(n.x, n.y, 40, 0.32); } else if (n.done) n.stuck -= dt; }); return t < 0.057 * 14 + 1.7; },
            draw(c) { c.save(); needles.forEach(n => { if (!n.done) { const f = Math.max(0, 1 - (n.at - t) / 0.25); c.strokeStyle = 'rgba(190,255,170,' + f + ')'; c.lineWidth = 2; c.beginPath(); c.moveTo(n.x, n.y - 90 * (1 - f) - 20); c.lineTo(n.x, n.y - 90 * (1 - f)); c.stroke(); } else if (n.stuck > 0) { c.globalAlpha = Math.min(1, n.stuck); c.strokeStyle = '#a8ff8a'; c.lineWidth = 3; c.beginPath(); c.moveTo(n.x, n.y - 16); c.lineTo(n.x, n.y); c.stroke(); } }); c.restore(); } });
    };
    IMPL.asn_clone = function (ctx) {                    // 分身の術：分身が一緒に攻撃する
        const m = mk(ctx), me = B.me(); const clones = [0, 1].map(i => ({ x: me.x + (i ? 50 : -50), y: me.y + 20, cd: 0.3 + i * 0.35 })); let t = 0;
        add({ update(dt) {
            if (!B.isRun()) return false; t += dt; const me2 = B.me();
            clones.forEach(cl => {
                const tg = B.nearestEnemy(cl.x, cl.y, 420), gx = tg ? tg.x : me2.x, gy = tg ? tg.y : me2.y, d = Math.hypot(gx - cl.x, gy - cl.y);
                if (d > 42) { cl.x += (gx - cl.x) / d * 255 * dt; cl.y += (gy - cl.y) / d * 255 * dt; }
                cl.cd -= dt; if (tg && d < 56 + tg.r && cl.cd <= 0) { cl.cd = 0.7; m.circle(cl.x, cl.y, 64, 0.6); flash(cl.x, cl.y, 55, '#a68bff'); }
            });
            return t < 5.5;
        }, draw(c) { c.save(); clones.forEach(cl => { c.globalAlpha = 0.5 + 0.15 * Math.sin(t * 10); c.fillStyle = '#6f56d8'; c.strokeStyle = '#d8ccff'; c.lineWidth = 2; c.beginPath(); c.arc(cl.x, cl.y, 20, 0, TAU); c.fill(); c.stroke(); }); c.restore(); } });
    };

    // ===== 罠師 =====
    IMPL.trp_mines = function (ctx) {                    // 地雷原：歩いた跡に地雷を撒く
        const m = mk(ctx); let t = 0, nextDrop = 0, n = 0; const mines = [];
        add({ update(dt) {
            if (!B.isRun()) return false; t += dt; const me = B.me();
            if (t < 3 && t >= nextDrop && n < 8) { nextDrop += 0.35; n++; mines.push({ x: me.x, y: me.y, life: 20 }); }
            for (let i = mines.length - 1; i >= 0; i--) {
                const mi = mines[i]; mi.life -= dt; if (mi.life <= 0) { mines.splice(i, 1); continue; }
                if (B.enemies().some(e => e.hp > 0 && Math.hypot(e.x - mi.x, e.y - mi.y) < 34 + e.r)) { m.circle(mi.x, mi.y, 90, 1.1, e => B.setStun(e, 0.4)); flash(mi.x, mi.y, 90, '#ffb04a'); mines.splice(i, 1); }
            }
            return t < 3 || mines.length > 0;
        }, draw(c) { c.save(); mines.forEach(mi => { c.fillStyle = '#4a4036'; c.strokeStyle = '#ffd9a0'; c.lineWidth = 2; c.beginPath(); c.arc(mi.x, mi.y, 11, 0, TAU); c.fill(); c.stroke(); c.fillStyle = (Math.floor(mi.life * 3) % 2) ? '#ff6a5a' : '#6a2a22'; c.beginPath(); c.arc(mi.x, mi.y, 3.5, 0, TAU); c.fill(); }); c.restore(); } });
    };
    IMPL.trp_net = function (ctx) {                      // 捕縛網：かかった敵は動けない
        const m = mk(ctx), me = B.me(), tp = targetPoint(ctx, 440, 250), R = 125; let t = 0, tick = 0;
        add({ update(dt) {
            t += dt;
            if (t >= 0.4 && t - dt < 0.4) { m.circle(tp.x, tp.y, R, 0.6, e => { if (e.boss) B.setSt(e, { slow: 1 }); else B.setStun(e, 1.5); }); flash(tp.x, tp.y, R, '#e8e8e8'); }
            if (t >= 0.4) { tick += dt; if (tick >= 0.5) { tick = 0; B.enemies().forEach(e => { if (e.hp > 0 && Math.hypot(e.x - tp.x, e.y - tp.y) <= R + e.r) B.setSt(e, { slow: 1 }); }); } }
            return t < 3.4;
        }, draw(c) { c.save(); c.strokeStyle = 'rgba(240,240,240,.85)'; c.lineWidth = 2; const f = Math.min(1, t / 0.4); const x = me.x + (tp.x - me.x) * f, y = me.y + (tp.y - me.y) * f; if (t < 0.4) { c.beginPath(); c.arc(x, y, 14, 0, TAU); c.stroke(); } else { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.moveTo(tp.x, tp.y); c.lineTo(tp.x + Math.cos(a) * R, tp.y + Math.sin(a) * R); c.stroke(); } for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(tp.x, tp.y, R * k / 3, 0, TAU); c.stroke(); } } c.restore(); } });
    };
    IMPL.trp_turret = function (ctx) {                   // 自動砲台：置くと、自動で撃つ
        const m = mk(ctx), me = B.me(), x = me.x, y = me.y; let t = 0, cd = 0.3, ang = 0;
        add({ update(dt) {
            if (!B.isRun()) return false; t += dt; cd -= dt;
            const tg = B.nearestEnemy(x, y, 450); if (tg) ang = Math.atan2(tg.y - y, tg.x - x);
            if (tg && cd <= 0) { cd = 0.6; fire(m, { x: x + Math.cos(ang) * 20, y: y + Math.sin(ang) * 20, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620, r: 7, life: 0.8, mult: 0.5, color: '#ffd9a0' }); }
            return t < 8;
        }, draw(c) { c.save(); c.translate(x, y); c.fillStyle = '#5b6470'; c.strokeStyle = '#c9d3df'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 17, 0, TAU); c.fill(); c.stroke(); c.rotate(ang); c.fillStyle = '#c9d3df'; c.fillRect(0, -4, 26, 8); c.restore(); } });
    };

    // ===== エレメンタリスト =====
    IMPL.ele_vortex = function (ctx) {                   // 元素の渦：引き込みながら削る
        const m = mk(ctx), tp = targetPoint(ctx, 480, 250), R = 140, col = ELCOL[ctx.p && ctx.p.element] || '#c9a8ff'; let t = 0, tick = 0;
        add({ update(dt) {
            if (!B.isRun()) return false; t += dt; tick += dt;
            B.enemies().forEach(e => { if (e.hp <= 0) return; const d = Math.hypot(tp.x - e.x, tp.y - e.y); if (d < R + e.r && d > 12) { const k = Math.min(70 * dt * (e.boss ? 0.3 : 1), d) / d; e.x += (tp.x - e.x) * k; e.y += (tp.y - e.y) * k; } });
            if (tick >= 0.4) { tick = 0; m.circle(tp.x, tp.y, R, 0.5); }
            return t < 3.5;
        }, draw(c) { c.save(); c.strokeStyle = col; c.lineWidth = 4; for (let i = 0; i < 4; i++) { c.globalAlpha = 0.8 - i * 0.15; c.beginPath(); for (let a = 0; a < 9; a += 0.2) { const r = (a / 9) * R * (1 - i * 0.12), ang = a + t * 4 + i * 1.6; const x = tp.x + Math.cos(ang) * r, y = tp.y + Math.sin(ang) * r; if (a === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); } c.restore(); } });
    };
    IMPL.ele_ice = function (ctx) {                      // 氷柱の道：前方に氷柱が次々と生える
        const m = mk(ctx), me = B.me(), a = ctx.ang, spikes = []; let t = 0;
        for (let i = 0; i < 7; i++) spikes.push({ x: me.x + Math.cos(a) * (80 + i * 75), y: me.y + Math.sin(a) * (80 + i * 75), at: i * 0.09, done: false, life: 0.7 });
        add({ update(dt) { t += dt; spikes.forEach(s => { if (!s.done && t >= s.at) { s.done = true; m.circle(s.x, s.y, 58, 0.7, e => B.setSt(e, { slow: 1 })); } else if (s.done) s.life -= dt; }); return t < 7 * 0.09 + 0.8; },
            draw(c) { c.save(); spikes.forEach(s => { if (!s.done) return; c.globalAlpha = Math.max(0, s.life + 0.3); c.fillStyle = '#bfeaff'; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x - 18, s.y + 12); c.lineTo(s.x, s.y - 58); c.lineTo(s.x + 18, s.y + 12); c.closePath(); c.fill(); c.stroke(); }); c.restore(); } });
    };
    IMPL.ele_chain = function (ctx) {                    // 雷鎖：敵から敵へ走る
        const m = mk(ctx), me = B.me(); const path = []; let from = { x: me.x, y: me.y }; const used = [];
        for (let i = 0; i < 6; i++) { const n = nearestN(from.x, from.y, i === 0 ? 540 : 280, 1, used)[0]; if (!n) break; used.push(n); path.push({ e: n, from: { x: from.x, y: from.y } }); from = n; }
        let t = 0, k = 0; const segs = [];
        add({ update(dt) {
            t += dt;
            while (k < path.length && t >= k * 0.08) { const p = path[k]; if (p.e.hp > 0) m.hit(p.e, 0.9 * Math.pow(0.85, k)); segs.push({ x1: p.from.x, y1: p.from.y, x2: p.e.x, y2: p.e.y, life: 0.3 }); k++; }
            segs.forEach(s => { s.life -= dt; });
            return k < path.length || segs.some(s => s.life > 0);
        }, draw(c) { c.save(); c.strokeStyle = '#ffee88'; c.lineWidth = 4; segs.forEach(s => { if (s.life <= 0) return; c.globalAlpha = s.life / 0.3; c.beginPath(); c.moveTo(s.x1, s.y1); const n = 5; for (let i = 1; i < n; i++) { const f = i / n; c.lineTo(s.x1 + (s.x2 - s.x1) * f + rnd(-9, 9), s.y1 + (s.y2 - s.y1) * f + rnd(-9, 9)); } c.lineTo(s.x2, s.y2); c.stroke(); }); c.restore(); } });
    };

    // ===== ネクロマンサー =====
    IMPL.nec_skel = function (ctx) {                     // 骸骨兵召喚：敵を追って戦う
        const m = mk(ctx), me = B.me(); const sk = [0, 1, 2].map(i => ({ x: me.x + Math.cos(i * 2.1) * 46, y: me.y + Math.sin(i * 2.1) * 46, cd: 0.2 + i * 0.25 })); let t = 0;
        add({ update(dt) {
            if (!B.isRun()) return false; t += dt; const me2 = B.me();
            sk.forEach(s => {
                const tg = B.nearestEnemy(s.x, s.y, 460), gx = tg ? tg.x : me2.x, gy = tg ? tg.y : me2.y, d = Math.hypot(gx - s.x, gy - s.y);
                if (d > 36) { s.x += (gx - s.x) / d * 215 * dt; s.y += (gy - s.y) / d * 215 * dt; }
                s.cd -= dt; if (tg && d < 44 + tg.r && s.cd <= 0) { s.cd = 0.8; m.circle(s.x, s.y, 56, 0.5); flash(s.x, s.y, 40, '#d8d8e8'); }
            });
            return t < 10;
        }, draw(c) { c.save(); c.font = '26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; sk.forEach(s => { c.globalAlpha = Math.min(1, (10 - t) / 1.5 + 0.2); c.fillText('💀', s.x, s.y); }); c.restore(); } });
    };
    IMPL.nec_hand = function (ctx) {                     // 死の手：地面から伸びて、敵を掴む
        const m = mk(ctx), me = B.me(), tgs = nearestN(me.x, me.y, 500, 3); let t = 0, fired = false;
        if (!tgs.length) { const p = targetPoint(ctx, 0, 240); tgs.push({ x: p.x, y: p.y, hp: 1, r: 20, fake: true }); }
        const spots = tgs.map(e => ({ e, x: e.x, y: e.y }));
        add({ update(dt) {
            t += dt;
            if (!fired && t >= 0.5) { fired = true; spots.forEach(s => { if (s.e.fake) { m.circle(s.x, s.y, 60, 0.9); return; } if (s.e.hp > 0) { m.hit(s.e, 0.9); if (s.e.boss) B.setSt(s.e, { slow: 1 }); else B.setStun(s.e, 1.0); } flash(s.x, s.y, 60, '#6b4aa8'); }); }
            return t < 1.6;
        }, draw(c) { c.save(); spots.forEach(s => { const f = Math.min(1, t / 0.5); c.strokeStyle = '#2a1840'; c.fillStyle = '#4a2d7a'; c.lineWidth = 3; if (t < 0.5) { c.setLineDash([5, 5]); c.beginPath(); c.arc(s.x, s.y, 50, 0, TAU); c.stroke(); c.setLineDash([]); } else { const px = s.e.fake ? s.x : s.e.x, py = s.e.fake ? s.y : s.e.y; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; c.beginPath(); c.moveTo(px, py + 14); c.quadraticCurveTo(px + Math.cos(a) * 20, py - 20, px + Math.cos(a) * 34, py + Math.sin(a) * 34 - 6); c.stroke(); } } }); c.restore(); } });
    };
    IMPL.nec_link = function (ctx) {                     // 魂の鎖：受けた傷が、つながった敵にも伝わる
        const m = mk(ctx), me = B.me(), tgs = nearestN(me.x, me.y, 520, 2);
        if (tgs.length < 2) { if (tgs[0]) { m.hit(tgs[0], 0.6); } return; }
        const A = tgs[0], C = tgs[1]; m.hit(A, 0.6); m.hit(C, 0.6);
        let t = 0, ha = A.hp, hc = C.hp, tick = 0;
        add({ update(dt) {
            t += dt; tick += dt;
            if (tick >= 0.1) {
                tick = 0;
                const la = Math.max(0, ha - A.hp), lc = Math.max(0, hc - C.hp);
                ha = A.hp; hc = C.hp;
                if (la > 0 && C.hp > 0) { B.dealHit(C, Math.max(1, Math.round(la * 0.6)), {}); hc = C.hp; }
                if (lc > 0 && A.hp > 0) { B.dealHit(A, Math.max(1, Math.round(lc * 0.6)), {}); ha = A.hp; }
            }
            return t < 5 && A.hp > 0 && C.hp > 0;
        }, draw(c) { c.save(); c.strokeStyle = '#b46bff'; c.lineWidth = 3; c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8); c.setLineDash([10, 6]); c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(C.x, C.y); c.stroke(); c.restore(); } });
    };

    // ===== アルケミスト =====
    IMPL.alc_acid = function (ctx) {                     // 酸の瓶：酸の溜まりが残る
        const m = mk(ctx), me = B.me(), tp = targetPoint(ctx, 470, 250), R = 100; let t = 0, tick = 0;
        add({ update(dt) {
            t += dt; if (t < 0.45) return true; tick += dt;
            if (tick >= 0.5) { tick = 0; m.circle(tp.x, tp.y, R, 0.28, e => B.setSt(e, { weaken: 1 })); }
            return t < 5.45;
        }, draw(c) { c.save(); if (t < 0.45) { const f = t / 0.45; c.fillStyle = '#9be36b'; c.beginPath(); c.arc(me.x + (tp.x - me.x) * f, me.y + (tp.y - me.y) * f - Math.sin(f * Math.PI) * 70, 9, 0, TAU); c.fill(); } else { c.fillStyle = 'rgba(140,230,90,' + (0.22 + 0.08 * Math.sin(t * 6)) + ')'; c.strokeStyle = '#9be36b'; c.lineWidth = 3; c.beginPath(); c.arc(tp.x, tp.y, R, 0, TAU); c.fill(); c.stroke(); } c.restore(); } });
    };
    IMPL.alc_bomb = function (ctx) {                     // 爆裂薬：遅れて、大きく爆発する
        const m = mk(ctx), me = B.me(), tp = targetPoint(ctx, 470, 240), R = 145; let t = 0, boom = false;
        add({ update(dt) {
            t += dt; if (!boom && t >= 1.7) { boom = true; m.circle(tp.x, tp.y, R, 2.0); flash(tp.x, tp.y, R, '#ffb04a'); return false; } return true;
        }, draw(c) { c.save(); if (t < 0.5) { const f = t / 0.5; c.fillStyle = '#ff9a4a'; c.beginPath(); c.arc(me.x + (tp.x - me.x) * f, me.y + (tp.y - me.y) * f - Math.sin(f * Math.PI) * 80, 10, 0, TAU); c.fill(); } else { const f = (t - 0.5) / 1.2; c.strokeStyle = 'rgba(255,150,60,' + (0.3 + 0.5 * f) + ')'; c.setLineDash([8, 6]); c.lineWidth = 3; c.beginPath(); c.arc(tp.x, tp.y, R * f, 0, TAU); c.stroke(); c.setLineDash([]); c.fillStyle = (Math.floor(t * 8) % 2) ? '#ff6a3a' : '#ffd08a'; c.beginPath(); c.arc(tp.x, tp.y, 12, 0, TAU); c.fill(); } c.restore(); } });
    };
    IMPL.alc_circle = function (ctx) {                   // 変換陣：中の敵は、力を失っていく
        const m = mk(ctx), me = B.me(), x = me.x, y = me.y, R = 130; let t = 0, tick = 0;
        add({ update(dt) { t += dt; tick += dt; if (tick >= 0.5) { tick = 0; m.circle(x, y, R, 0.15, e => B.setSt(e, { weaken: 1, curse: 1 })); } return t < 6 && B.isRun(); },
            draw(c) { c.save(); c.translate(x, y); c.rotate(t * 0.8); c.strokeStyle = '#d58aff'; c.lineWidth = 3; c.globalAlpha = 0.85; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, R * 0.7, 0, TAU); c.stroke(); for (let i = 0; i < 3; i++) { const a = i * TAU / 3; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7); c.lineTo(Math.cos(a + TAU / 3) * R * 0.7, Math.sin(a + TAU / 3) * R * 0.7); c.stroke(); } c.restore(); } });
    };

    // ===== スペルブレイカー =====
    IMPL.spb_cut = function (ctx) {                      // 魔断ち：広く斬り払い、弾を消す
        const m = mk(ctx), me = B.me(); m.cone(me.x, me.y, ctx.ang, 135, 2.8, 1.0); B.fxArc(me.x, me.y, ctx.ang, 135, 2.8, '#9df0ff');
        const bl = B.eBullets(); let n = 0; for (let i = bl.length - 1; i >= 0; i--) { if (Math.hypot(bl[i].x - me.x, bl[i].y - me.y) <= 175) { bl.splice(i, 1); n++; } }
        if (n > 0) B.barrier(Math.min(me.maxHp * 0.15, me.maxHp * 0.015 * n));
    };
    IMPL.spb_reflect = function (ctx) {                  // 反射の構え：当たった弾を跳ね返す
        const m = mk(ctx); let t = 0;
        add({ update(dt) {
            if (!alive()) return false; t += dt; const me = B.me(), bl = B.eBullets();
            for (let i = bl.length - 1; i >= 0; i--) {
                const b = bl[i]; if (Math.hypot(b.x - me.x, b.y - me.y) <= 78) {
                    bl.splice(i, 1); const tg = B.nearestEnemy(me.x, me.y, 700); const a = tg ? Math.atan2(tg.y - me.y, tg.x - me.x) : Math.atan2(-b.vy, -b.vx);
                    fire(m, { x: me.x, y: me.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 9, life: 1.2, mult: 0.8, color: '#9df0ff' });
                }
            }
            return t < 2.5;
        }, draw(c) { const me = B.me(); c.save(); c.strokeStyle = 'rgba(160,240,255,' + (0.5 + 0.3 * Math.sin(t * 12)) + ')'; c.lineWidth = 4; c.beginPath(); c.arc(me.x, me.y, 74, 0, TAU); c.stroke(); c.globalAlpha = 0.18; c.fillStyle = '#9df0ff'; c.fill(); c.restore(); } });
    };
    IMPL.spb_seal = function (ctx) {                     // 封魔印：動きを止め、受けるダメージが増える
        const m = mk(ctx), me = B.me(), tgs = nearestN(me.x, me.y, 340, 3); let t = 0;
        tgs.forEach(e => { m.hit(e, 0.6); if (e.boss) B.setSt(e, { blind: 1 }); else B.setStun(e, 1.0); e.vuln = Math.max(e.vuln || 0, 6); });
        add({ update(dt) { t += dt; return t < 6; }, draw(c) { c.save(); tgs.forEach(e => { if (e.hp <= 0) return; c.translate(0, 0); c.strokeStyle = 'rgba(255,230,140,' + (0.9 - t / 8) + ')'; c.lineWidth = 3; c.beginPath(); c.arc(e.x, e.y, e.r + 10, 0, TAU); c.stroke(); c.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU * 2 / 5, x = e.x + Math.cos(a) * (e.r + 10), y = e.y + Math.sin(a) * (e.r + 10); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.closePath(); c.stroke(); }); c.restore(); } });
    };

    // ===== ギャンブラー =====
    IMPL.gam_coin = function (ctx) {                     // コイントス：表なら大威力、裏なら小威力
        const m = mk(ctx), me = B.me(), heads = (global.ClassPerks && global.ClassPerks.lucky()) || Math.random() < 0.5;
        B.popup(heads ? '🪙 表！' : '🪙 裏…', me.x, me.y - 52, heads ? '#ffd84a' : '#9aa6c4');
        fire(m, heads ? { x: me.x, y: me.y, vx: Math.cos(ctx.ang) * 640, vy: Math.sin(ctx.ang) * 640, r: 15, life: 0.9, mult: 2.2, pierce: 2, color: '#ffd84a' } : { x: me.x, y: me.y, vx: Math.cos(ctx.ang) * 520, vy: Math.sin(ctx.ang) * 520, r: 9, life: 0.9, mult: 0.6, color: '#b0b8c8' });
    };
    IMPL.gam_roul = function (ctx) {                     // ルーレット弾：弾ごとに威力がバラバラ
        const m = mk(ctx), me = B.me(), TABLE = [0.2, 0.2, 0.4, 0.4, 0.6, 1.6];
        for (let i = 0; i < 12; i++) {
            const a = i * TAU / 12 + ctx.ang, mult = (global.ClassPerks && global.ClassPerks.lucky()) ? TABLE[5] : TABLE[Math.floor(Math.random() * 6)], col = mult >= 1.5 ? '#ffd84a' : (mult >= 0.6 ? '#ff9a5a' : '#8c96a8');
            fire(m, { x: me.x, y: me.y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, r: mult >= 1.5 ? 12 : 8, life: 0.95, mult: mult, color: col });
        }
    };
    IMPL.gam_dice = function (ctx) {                     // ダイス爆弾：出目の数だけ爆発する
        const m = mk(ctx), me = B.me(), tp = targetPoint(ctx, 460, 240), roll = (global.ClassPerks && (global.ClassPerks.luckDice() || (global.ClassPerks.lucky() && 6))) || (1 + Math.floor(Math.random() * 6)); let t = 0, k = 0;
        B.popup('🎲 ' + roll, me.x, me.y - 52, roll >= 5 ? '#ffd84a' : '#ffffff');
        add({ update(dt) {
            t += dt;
            while (k < roll && t >= 0.5 + k * 0.25) { m.circle(tp.x, tp.y, 95, 0.5); flash(tp.x, tp.y, 95, '#ff9a5a'); k++; }
            return k < roll;
        }, draw(c) { c.save(); if (t < 0.5) { const f = t / 0.5; c.font = '26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎲', me.x + (tp.x - me.x) * f, me.y + (tp.y - me.y) * f - Math.sin(f * Math.PI) * 70); } else { c.font = '26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎲', tp.x, tp.y); } c.restore(); } });
    };

    // ---------- 窓口 ----------
    function has(key) { return !!IMPL[key]; }
    const H = { mk, add, after, alive, fire, targetPoint, nearestN, flash, rnd, TAU, ents, bullets, IMPL, base: (key, ctx) => IMPL[key](ctx) };
    function cast(key, ctx) {
        if (!B || !IMPL[key]) return false;
        const PK = global.ClassPerks;
        try {
            if (PK) PK.onFormCast(key, ctx);
            const ov = PK && PK.formOverride(key);
            if (ov) ov(ctx, H); else IMPL[key](ctx);
            return true;
        } catch (e) { console.warn('[ClassForms] cast failed', key, e); return false; }
    }
    function update(dt) {
        if (!B) return;
        if (bullets.length) updateBullets(dt);
        for (let i = ents.length - 1; i >= 0; i--) { let keep = true; try { keep = ents[i].update(dt) !== false; } catch (e) { keep = false; console.warn('[ClassForms] update failed', e); } if (!keep) ents.splice(i, 1); }
    }
    function draw(c) { if (!B) return; ents.forEach(e => { try { if (e.draw) e.draw(c); } catch (err) { /* 描画の失敗でゲームを止めない */ } }); if (bullets.length) drawBullets(c); }
    global.ClassForms = { has, cast, update, draw, setBridge, H, keys: () => Object.keys(IMPL) };
})(typeof window !== 'undefined' ? window : globalThis);
