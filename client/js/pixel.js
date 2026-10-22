// ============================================================
// ドット絵エンジン (pixel.js)
//  pixel-data.js の「文字の並び」を、色を当てはめて小さな画像にして（キャッシュして）描く。
//  ・拡大してもぼやけない（最近傍で拡大）
//  ・色はパレットで差し替える：チームの服の色／髪の色／武器はレア度の色／敵は種類ごとの色
//  ・あとから本物のPNGに差し替えたいときは、SBPix.override(キー, 画像) で上書きできる
//  ・設定：SBPix.setOn(false) でドット絵を切って、従来の丸い表示に戻せる（P キー）
// ============================================================
(function () {
    'use strict';
    const D = window.SBPIX_DATA;
    if (!D) return;
    const KEY = 'sbPixel';
    let enabled = true; try { enabled = localStorage.getItem(KEY) !== '0'; } catch (e) { enabled = true; }

    // ---------- 色 ----------
    function parse(c) {
        if (typeof c !== 'string') return [200, 200, 200];
        let m = /^#?([0-9a-f]{6})$/i.exec(c); if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
        m = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c); if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)];
        m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(c); if (m) return [+m[1], +m[2], +m[3]];
        return [200, 200, 200];
    }
    function hex(r) { return '#' + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
    function shade(c, f) { const r = parse(c), t = f > 0 ? 255 : 0, k = Math.abs(f); return hex(r.map(v => v + (t - v) * k)); }

    // ---------- 焼き付け（文字の並び → 画像）----------
    const CACHE = {}, OVERRIDE = {};
    function bake(rows, pal, scale, flash) {
        const h = rows.length; let w = 0; rows.forEach(r => { if (r.length > w) w = r.length; });
        const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale;
        const g = cv.getContext('2d');
        for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
            const ch = rows[y][x]; if (ch === '.' || ch === ' ') continue;
            const col = pal[ch]; if (!col) continue;
            g.fillStyle = flash ? '#ffffff' : col; g.fillRect(x * scale, y * scale, scale, scale);
        }
        return { c: cv, w: w * scale, h: h * scale, cols: w, rows: h };
    }
    function get(key, rows, pal, scale, flash) {
        const k = key + '|' + scale + (flash ? '|f' : '');
        if (OVERRIDE[key]) return OVERRIDE[key];
        return CACHE[k] || (CACHE[k] = bake(rows, pal, scale, flash));
    }

    // ---------- パレット ----------
    function palPerson(cloth, hair) { return { k: '#14121c', h: hair, H: shade(hair, -0.35), s: '#f2c9a0', S: '#d9a577', e: '#1a1a24', c: cloth, C: shade(cloth, -0.4), l: shade(cloth, 0.35), b: '#4a3020', w: '#ffffff' }; }
    function palWeapon(col) { return { a: shade(col, 0.55), b: col, c: shade(col, -0.45), h: '#8a5a2b', H: '#5b3a1c', g: '#f2c14e', G: '#b88a1e', s: '#b4bcc9', S: '#6b7384', r: '#d84a4a', w: '#ffffff', k: '#14121c' }; }
    function palEnemy(col) { return { m: col, M: shade(col, -0.4), L: shade(col, 0.4), k: '#14121c', w: '#ffffff', e: '#ff3b3b', y: '#ffe14a', r: '#ff4a4a' }; }
    const HAIRS = ['#4a2c1a', '#222233', '#d8b03a', '#b5392b', '#6a3fa0', '#2f7d6d', '#e8e8f0', '#d86a9a'];
    function hairOf(name) { let h = 0; const s = String(name || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return HAIRS[h % HAIRS.length]; }

    // ---------- 人物 ----------
    // frame: 'idle' | 'walkA' | 'walkB'
    function person(cloth, hair, frame, scale, flash) {
        const rows = D.BODY_TOP.concat(D.LEGS[frame] || D.LEGS.idle);
        return get('p:' + cloth + ':' + hair + ':' + frame, rows, palPerson(cloth, hair), scale, flash);
    }
    function weapon(type, color, scale) {
        const W = D.WEAPONS[type] || D.WEAPONS.default, s = get('w:' + (D.WEAPONS[type] ? type : 'default') + ':' + color, W.rows, palWeapon(color), scale);
        s.grip = W.grip * scale; return s;
    }
    function enemy(arch, color, scale, flash) {
        const rows = D.ENEMIES[arch] || D.ENEMIES.default;
        return get('e:' + (D.ENEMIES[arch] ? arch : 'default') + ':' + color, rows, palEnemy(color), scale, flash);
    }

    // ---------- 描く ----------
    // 人物：足もと(x,y)を基準に描く。left=true で左向き
    function drawPerson(ctx, x, y, o) {
        const sc = o.scale || 2, now = o.now || performance.now();
        const fr = o.moving ? (Math.floor(now / 130) % 2 ? 'walkA' : 'walkB') : 'idle';
        const sp = person(o.cloth, o.hair, fr, sc, !!o.flash), bob = o.moving ? (Math.floor(now / 130) % 2 ? -sc : 0) : (Math.floor(now / 480) % 2 ? -sc : 0);
        ctx.save(); ctx.imageSmoothingEnabled = false;
        if (o.alpha != null) ctx.globalAlpha = o.alpha;
        ctx.translate(Math.round(x), Math.round(y + bob));
        if (o.left) ctx.scale(-1, 1);
        ctx.drawImage(sp.c, -Math.round(sp.w / 2), -sp.h + 2 * sc);
        ctx.restore();
        return sp;
    }
    // 武器：手の位置(x,y)に持ち手を合わせて、角度 a の向きに向ける。swing(0〜1)があれば振る動き
    function drawWeapon(ctx, x, y, a, type, color, o) {
        o = o || {}; const sc = o.scale || 2, sp = weapon(type, color, sc);
        let rot = a + Math.PI / 2, ox = 0, oy = 0, k = o.swing;
        if (k != null && k >= 0 && k <= 1) {
            const dir = o.dir || 1, kind = o.kind || 'cone';
            if (kind === 'line') { const f = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 14; ox = Math.cos(a) * f; oy = Math.sin(a) * f; }
            else if (kind === 'proj') { const f = -Math.max(0, 1 - k * 3) * 5; ox = Math.cos(a) * f; oy = Math.sin(a) * f; }
            else if (kind === 'smash') { rot += -1.5 + 1.8 * Math.min(1, k * 1.6); }
            else { const span = o.fin ? 3.0 : 2.1; rot += dir * (-span / 2 + span * Math.min(1, k * 1.5)); }
        }
        ctx.save(); ctx.imageSmoothingEnabled = false; if (o.alpha != null) ctx.globalAlpha = o.alpha;
        ctx.translate(Math.round(x + ox), Math.round(y + oy)); ctx.rotate(rot);
        ctx.drawImage(sp.c, -Math.round(sp.w / 2), -sp.grip);
        ctx.restore();
        if (o.glint) {      // レジェンド・神話：ときどききらっと光る
            const t = ((o.now || performance.now()) / 1000) % 1.6;
            if (t < 0.22) { const L = sp.h - sp.grip, d = (0.35 + 0.5 * (t / 0.22)) * L; ctx.save(); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1 - t / 0.22; const gx = x + Math.cos(a) * d, gy = y + Math.sin(a) * d; ctx.fillRect(Math.round(gx) - 1, Math.round(gy) - 5, 2, 10); ctx.fillRect(Math.round(gx) - 5, Math.round(gy) - 1, 10, 2); ctx.restore(); }
        }
    }
    // 敵：中心(x,y)。r は当たり判定の半径（これに合わせて整数倍で拡大）。faceLeft で反転
    function drawEnemy(ctx, x, y, r, arch, color, o) {
        o = o || {}; const rows = D.ENEMIES[arch] || D.ENEMIES.default, cols = Math.max.apply(null, rows.map(s => s.length));
        const sc = Math.max(2, Math.round(r * 2 / cols)), sp = enemy(arch, color, sc, !!o.flash), now = o.now || performance.now();
        const bob = Math.sin(now / 220 + (o.seed || 0)) * 1.6;
        ctx.save(); ctx.imageSmoothingEnabled = false; if (o.alpha != null) ctx.globalAlpha = o.alpha;
        ctx.translate(Math.round(x), Math.round(y + bob)); if (o.left) ctx.scale(-1, 1);
        ctx.drawImage(sp.c, -Math.round(sp.w / 2), -Math.round(sp.h / 2));
        ctx.restore();
    }

    window.SBPix = {
        on: () => enabled, setOn: v => { enabled = !!v; try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) { /* 保存できなくてもよい */ } },
        hasEnemy: a => !!D.ENEMIES[a], hasWeapon: t => !!D.WEAPONS[t], weaponTypes: () => Object.keys(D.WEAPONS),
        hairOf: hairOf, shade: shade, drawPerson: drawPerson, drawWeapon: drawWeapon, drawEnemy: drawEnemy,
        override: (key, img) => { OVERRIDE[key] = img; },
        _get: get, _parse: parse, _hex: hex, _bake: bake, _palPerson: palPerson, _palWeapon: palWeapon, _palEnemy: palEnemy
    };
})();
