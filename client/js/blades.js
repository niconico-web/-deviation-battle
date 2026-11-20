// ============================================
// School Battle
// blades.js（神話のオリジナル武器：「分身の剣」の動きと描画）
// ============================================
// 通常攻撃・必殺技で、剣が何本かに分かれて、敵を攻撃する。実戦（practice.js）と、工房のプレビュー（orig-weapon-ui.js）で同じ計算を使う。
//   mode：strike=敵へ飛んで切り刻み、戻ってくる / orbit=自分のまわりを回って、触れた敵を切る
//         sweep=左右から交差して、X字に斬る / dance=（必殺技）たくさんの剣が舞って、次々に敵を切る
//         rain=敵の頭上から降り注ぐ / spiral=前方へ渦を巻いて進む / boomerang=弧を描いて飛び、戻ってくる
//   sz=大きさ（見た目と当たる範囲）/ sp=速さ
// 当たり判定とダメージは、呼び出し側（env.hit）。この中は動きと見た目だけ。
(function (global) {
    'use strict';
    const TAU = Math.PI * 2;
    const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
    const MODES = { strike: 1, orbit: 1, sweep: 1, dance: 1, rain: 1, spiral: 1, boomerang: 1 };

    // spec: { mode, n, hits, bm, a, x, y, tg:[[x,y]..], life, fin } / look: { type, col, pc } / o: { vis, targets }
    function make(spec, look, o) {
        o = o || {}; if (!spec || !MODES[spec.mode]) return [];
        const maxN = spec.mode === 'dance' ? 12 : 4, n = Math.max(1, Math.min(maxN, spec.n | 0 || 1)), out = [], tgs = Array.isArray(o.targets) ? o.targets : null;
        for (let i = 0; i < n; i++) {
            const tg = spec.tg && spec.tg.length ? spec.tg[i % spec.tg.length] : null, a0 = +spec.a || 0;
            const b = { mode: spec.mode, i: i, n: n, side: (i % 2) ? -1 : 1, t: 0, ph: 0, pt: 0, rt: 0, done: 0, hits: Math.max(1, Math.min(4, spec.hits | 0 || 1)), bm: spec.bm || 0.3,
                sz: Math.max(0.8, Math.min(2, +spec.sz || 1)), sp: Math.max(0.6, Math.min(1.6, +spec.sp || 1)), ox: +spec.x || 0, oy: +spec.y || 0, vis: !!o.vis, cap: Math.max(1, spec.cap | 0 || 99), look: look || {}, x: +spec.x || 0, y: +spec.y || 0, a: a0, a0: a0, trail: [], hitAt: {}, fin: !!spec.fin, life: +spec.life || 0, cool: 0, dead: false,
                tx: tg ? tg[0] : (+spec.x || 0) + Math.cos(a0) * 260, ty: tg ? tg[1] : (+spec.y || 0) + Math.sin(a0) * 260, hasT: !!tg, tgt: tgs ? (tgs[i % Math.max(1, tgs.length)] || null) : null, rnd: Math.random() };
            if (b.mode === 'orbit') b.life = b.life || (1.0 + 0.35 * b.hits);
            else if (b.mode === 'sweep') b.life = 0.34 * b.hits / b.sp + 0.1;
            else if (b.mode === 'dance') { b.life = b.life || 3.2; b.cool = i * 0.05; }
            if (b.mode === 'strike') { const s = b.side * 0.9; b.x += Math.cos(a0 + s) * 26; b.y += Math.sin(a0 + s) * 26; }
            out.push(b);
        }
        return out;
    }

    function hitIf(env, b, e) { if (!b.vis && env && env.hit && e && e.hp > 0) env.hit(e, b); }

    // 1フレーム進める。cx, cy＝持ち主の今の位置。env: { targets:[{x,y,r,id,hp}], hit(e,b) }（見た目だけの剣は env なし）
    function step(b, dt, cx, cy, env) {
        if (b.dead) return;
        b.t += dt;
        const tgs = (env && env.targets) || [];
        if (b.mode === 'strike') {
            if (b.ph === 0) {
                const e = b.tgt; if (e && e.hp > 0) { b.tx = e.x; b.ty = e.y; }
                const d = dist(b.x, b.y, b.tx, b.ty), sp = 1100 * b.sp * dt; b.a = Math.atan2(b.ty - b.y, b.tx - b.x);
                if (d <= sp + 24 || b.t > 1.2) { b.ph = 1; b.pt = 0; b.cool = 0; } else { b.x += Math.cos(b.a) * sp; b.y += Math.sin(b.a) * sp; }
            } else if (b.ph === 1) {
                b.pt += dt; const e = b.tgt; if (e && e.hp > 0) { b.tx = e.x; b.ty = e.y; }
                const ang = b.pt * 22 * b.sp + b.i * Math.PI; b.x = b.tx + Math.cos(ang) * 34 * b.sz; b.y = b.ty + Math.sin(ang) * 34 * b.sz; b.a = ang + (Math.PI / 2) * b.side;
                b.cool -= dt;
                if (b.cool <= 0 && b.done < b.hits) { b.cool = 0.12; b.done++; if (b.hasT) hitIf(env, b, b.tgt); }
                if (b.done >= b.hits && b.cool <= -0.05) { b.ph = 2; b.rt = 0; }
            } else {
                b.rt += dt; const d = dist(b.x, b.y, cx, cy), sp = 1250 * dt; b.a = Math.atan2(cy - b.y, cx - b.x);
                if (d <= sp + 22 || b.rt > 0.7) b.dead = true; else { b.x += Math.cos(b.a) * sp; b.y += Math.sin(b.a) * sp; }
            }
        } else if (b.mode === 'orbit') {
            const th = b.a0 + b.side * (b.i * TAU / b.n) + b.t * 9 * b.sp;
            b.x = cx + Math.cos(th) * 95 * b.sz; b.y = cy + Math.sin(th) * 95 * b.sz; b.a = th + Math.PI / 2;
            b.cool -= dt;      // 1体の敵に当てられる回数は cap まで（大きな敵のそばにずっと居ても、決めた威力を超えない）
            if (b.cool <= 0) { b.cool = 0.15; tgs.forEach(e => { if (e.hp > 0 && (b.hitAt[e.id] | 0) < b.cap && dist(b.x, b.y, e.x, e.y) < 62 * b.sz + (e.r || 14)) { b.hitAt[e.id] = (b.hitAt[e.id] | 0) + 1; hitIf(env, b, e); } }); }
            if (b.t >= b.life) b.dead = true;
        } else if (b.mode === 'sweep') {
            const s0 = b.a0 + b.side * 1.05, ox = Math.cos(s0) * 190 * b.sz, oy = Math.sin(s0) * 190 * b.sz, u = b.t * b.sp / 0.34, pass = Math.floor(u), fr = u - pass, s = pass % 2 ? 1 - fr : fr;
            const ease = s * s * (3 - 2 * s), px = b.tx, py = b.ty;
            b.x = px + ox - 2 * ox * ease; b.y = py + oy - 2 * oy * ease; b.a = Math.atan2(-oy * (pass % 2 ? -1 : 1), -ox * (pass % 2 ? -1 : 1));
            if (pass < b.hits) tgs.forEach(e => { if (e.hp > 0 && b.hitAt[e.id] !== pass + 1 && dist(b.x, b.y, e.x, e.y) < 42 * b.sz + (e.r || 14)) { b.hitAt[e.id] = pass + 1; hitIf(env, b, e); } });
            if (b.t >= b.life) b.dead = true;
        } else if (b.mode === 'rain') {      // 剣の雨：敵の頭上に現れて、順に落ちる（hits 本ぶん落とす）
            const drop = () => { const e = b.tgt; b.lx = ((e && e.hp > 0) ? e.x : b.tx) + (Math.random() - 0.5) * 70; b.ly = ((e && e.hp > 0) ? e.y : b.ty) + (Math.random() - 0.5) * 50; b.a = Math.PI / 2; };
            if (b.ph === 0) { b.pt += dt; if (b.pt >= b.i * 0.12) { b.ph = 1; b.pt = 0; drop(); b.x = b.lx; b.y = b.ly - 260; } }
            else if (b.ph === 1) {
                b.pt += dt; const k = Math.min(1, b.pt / (0.28 / b.sp)); b.x = b.lx; b.y = b.ly - 260 * (1 - k * k);
                if (k >= 1) { b.ph = 2; b.pt = 0; b.done++; tgs.forEach(e => { if (e.hp > 0 && dist(b.lx, b.ly, e.x, e.y) < 58 * b.sz + (e.r || 14)) hitIf(env, b, e); }); }
            } else { b.pt += dt; if (b.pt > 0.22) { if (b.done >= b.hits) b.dead = true; else { b.ph = 1; b.pt = 0; drop(); b.x = b.lx; b.y = b.ly - 260; } } }
        } else if (b.mode === 'spiral') {      // らせん：前方へ、渦を巻いて進む
            const T0 = 0.7 / b.sp, u = Math.min(1, b.t / T0), ca = Math.cos(b.a0), sa = Math.sin(b.a0), fwd = u * 460, ph = b.t * 16 * b.sp + b.i * Math.PI, lat = Math.sin(ph) * 55 * (0.4 + 0.6 * (1 - u));
            b.x = b.ox + ca * fwd - sa * lat; b.y = b.oy + sa * fwd + ca * lat; b.a = b.a0 + Math.cos(ph) * 0.9;
            b.cool -= dt; if (b.cool <= 0) { b.cool = 0.1; tgs.forEach(e => { if (e.hp > 0 && (b.hitAt[e.id] | 0) < b.cap && dist(b.x, b.y, e.x, e.y) < 52 * b.sz + (e.r || 14)) { b.hitAt[e.id] = (b.hitAt[e.id] | 0) + 1; hitIf(env, b, e); } }); }
            if (b.t >= T0 + 0.1) b.dead = true;
        } else if (b.mode === 'boomerang') {      // ブーメラン：弧を描いて飛んで、持ち主のところへ戻る
            const T0 = 0.9 / b.sp, u = Math.min(1, b.t / T0), s = Math.sin(Math.PI * u), ca = Math.cos(b.a0), sa = Math.sin(b.a0), fwd = 320 * s, lat = b.side * 150 * Math.sin(Math.PI * u) * Math.cos(Math.PI * u * 0.5 + 0.2);
            const bx = b.ox + (cx - b.ox) * u, by = b.oy + (cy - b.oy) * u;
            b.x = bx + ca * fwd - sa * lat; b.y = by + sa * fwd + ca * lat; b.a = b.t * 25;
            b.cool -= dt; if (b.cool <= 0) { b.cool = 0.1; tgs.forEach(e => { if (e.hp > 0 && (b.hitAt[e.id] | 0) < b.cap && dist(b.x, b.y, e.x, e.y) < 56 * b.sz + (e.r || 14)) { b.hitAt[e.id] = (b.hitAt[e.id] | 0) + 1; hitIf(env, b, e); } }); }
            if (u >= 1) b.dead = true;
        } else if (b.mode === 'dance') {
            b.cool -= dt;
            if (b.vis || !tgs.length) {      // 見た目だけ（または敵がいない）：持ち主のまわりを、ふわふわ舞う
                const k = b.t * 5 + b.i * 1.7; b.x = cx + Math.cos(k) * (90 + 60 * Math.sin(b.t * 2 + b.i)); b.y = cy + Math.sin(k * 0.8) * (70 + 50 * Math.cos(b.t * 2 + b.i)); b.a = k + Math.PI / 2;
            } else {
                if (!b.tgt || b.tgt.hp <= 0) b.tgt = tgs[Math.floor(Math.random() * tgs.length)];
                const e = b.tgt; if (e) {
                    const d = dist(b.x, b.y, e.x, e.y), sp = 1000 * b.sp * dt; b.a = Math.atan2(e.y - b.y, e.x - b.x);
                    if (d < (e.r || 14) + 30) { if (b.cool <= 0) { hitIf(env, b, e); b.cool = (0.42 + b.rnd * 0.1) / b.sp; b.tgt = null; } b.a += b.t * 18; }
                    else { b.x += Math.cos(b.a) * Math.min(sp, d); b.y += Math.sin(b.a) * Math.min(sp, d); }
                }
            }
            if (b.t >= b.life) b.dead = true;
        }
        b.trail.push([b.x, b.y]); if (b.trail.length > 6) b.trail.shift();
    }

    // 描画。ドット絵の武器を、そのまま分身させて飛ばす（描いた絵がなければ、標準の絵）
    function draw(ctx, b) {
        const L = b.look || {}, col = L.col || '#ffffff', fadeIn = Math.min(1, b.t / 0.08), fadeOut = b.life ? Math.min(1, Math.max(0, (b.life - b.t) / 0.15)) : (b.ph === 2 ? Math.max(0.3, 1 - b.rt / 0.7) : 1), al = fadeIn * fadeOut;
        ctx.save();
        for (let k = 1; k < b.trail.length; k++) { ctx.globalAlpha = al * (0.05 + 0.3 * k / b.trail.length); ctx.strokeStyle = col; ctx.lineWidth = 3 + 6 * k / b.trail.length; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.trail[k - 1][0], b.trail[k - 1][1]); ctx.lineTo(b.trail[k][0], b.trail[k][1]); ctx.stroke(); }
        ctx.globalAlpha = al;
        const P = global.SBPix, hx = b.x - Math.cos(b.a) * 16, hy = b.y - Math.sin(b.a) * 16;
        let done = false;
        if (P && P.drawWeapon && (!P.on || P.on())) { try { P.drawWeapon(ctx, hx, hy, b.a, L.type || 'sword', col, { custom: L.pc || null, mythic: L.mythic || null, scale: 2 * (b.sz || 1), glint: true }); done = true; } catch (e) { done = false; } }
        if (!done) {
            ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.scale(b.sz || 1, b.sz || 1); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = col; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(4, -5); ctx.lineTo(-14, -4); ctx.lineTo(-14, 4); ctx.lineTo(4, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = col; ctx.fillRect(-18, -8, 4, 16);
        }
        ctx.restore();
        if (b.mode === 'rain' && b.ph === 2) { const k = Math.min(1, b.pt / 0.22); ctx.save(); ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.lx, b.ly, 58 * (b.sz || 1) * (0.4 + 0.6 * k), 0, TAU); ctx.stroke(); ctx.restore(); }
    }

    global.SBBlades = { make: make, step: step, draw: draw, MODES: MODES };
})(window);
