// ============================================================
// ドット絵の追加部品 (pixel-extra.js)
//  ・アバターのカスタマイズ（髪型・髪色・肌・服・アクセサリー）を、ドット絵のキャラに反映する
//  ・床や壁のタイル、岩、地面のかざり
//  ・弾
//  ・町の建物、ボス
//  pixel.js と pixel-data.js の後に読み込む。
// ============================================================
(function () {
    'use strict';
    const P = window.SBPix, D = window.SBPIX_DATA;
    if (!P || !D || !D.AV) return;
    const shade = P.shade, parse = P._parse, hex = P._hex, get = P._get;
    const U = (v, f) => v;

    // ---------- アバターの色（avatar.js の選択肢と同じ id）----------
    const HAIR_COL = { black: '#333333', brown: '#8B4513', blonde: '#FFD700', red: '#FF4500', blue: '#1E90FF', pink: '#FF69B4', purple: '#9370DB', white: '#F5F5F5' };
    const SKIN_COL = { light: '#FFE4C4', medium: '#DEB887', dark: '#8B4513', very_dark: '#4A3728' };
    const DEFAULT_AV = { hairStyle: 'short', hairColor: 'black', skinColor: 'medium', outfit: 'school_uniform', accessory: 'none' };
    // 通信で受け取った値などを安全にする（知っている id だけ通す）
    function cleanAvatar(av) {
        if (typeof av === 'string') { const t = av.split('|'); av = { hairStyle: t[0], hairColor: t[1], skinColor: t[2], outfit: t[3], accessory: t[4] }; }
        if (!av || typeof av !== 'object') return null;
        const o = {
            hairStyle: D.AV.hair[av.hairStyle] ? av.hairStyle : DEFAULT_AV.hairStyle,
            hairColor: HAIR_COL[av.hairColor] ? av.hairColor : DEFAULT_AV.hairColor,
            skinColor: SKIN_COL[av.skinColor] ? av.skinColor : DEFAULT_AV.skinColor,
            outfit: D.AV.outfit[av.outfit] ? av.outfit : DEFAULT_AV.outfit,
            accessory: (av.accessory === 'none' || D.AV.acc[av.accessory]) ? av.accessory : 'none'
        };
        return o;
    }
    const avToString = av => { const a = cleanAvatar(av) || DEFAULT_AV; return [a.hairStyle, a.hairColor, a.skinColor, a.outfit, a.accessory].join('|'); };

    function composeAvatar(av, frame) {
        const A = D.AV, grid = []; for (let y = 0; y < 16; y++) grid.push(new Array(10).fill('.'));
        const put = (y0, rows) => { rows.forEach((row, i) => { const y = y0 + i; if (y < 0 || y > 15) return; for (let x = 0; x < 10 && x < row.length; x++) if (row[x] !== '.') grid[y][x] = row[x]; }); };
        const of = A.outfit[av.outfit];
        put(A.head.y, A.head.rows);
        put(9, of.rows);
        put(14, of.legs || D.LEGS[frame] || D.LEGS.idle);
        const hr = A.hair[av.hairStyle]; if (hr) put(hr.y, hr.rows);
        if (av.accessory !== 'none' && A.acc[av.accessory]) put(A.acc[av.accessory].y, A.acc[av.accessory].rows);
        const hc = HAIR_COL[av.hairColor], sk = SKIN_COL[av.skinColor];
        const pal = { k: '#14121c', s: sk, S: shade(sk, -0.15), e: '#1a1a24', h: hc, H: shade(hc, -0.35), b: '#4a3020', G: '#222233', g: '#f2c14e', r: '#d83a3a', w: '#ffffff' };
        Object.assign(pal, of.pal);
        if (av.cloth) { pal.c = av.cloth; pal.C = shade(av.cloth, -0.4); pal.l = shade(av.cloth, 0.35); }
        return { rows: grid.map(r => r.join('')), pal: pal };
    }
    function avatarSprite(av, frame, scale, flash) {
        const key = 'av:' + avToString(av) + ':' + (av.cloth || '') + ':' + frame;
        const k = key + '|' + scale + (flash ? '|f' : '');
        if (!avatarSprite.c) avatarSprite.c = {};
        if (avatarSprite.c[k]) return avatarSprite.c[k];
        const cp = composeAvatar(av, frame);
        return (avatarSprite.c[k] = P._bake(cp.rows, cp.pal, scale, flash));
    }
    function drawAvatar(ctx, x, y, o) {
        const sc = o.scale || 2, now = o.now || performance.now(), av = cleanAvatar(o.avatar) || DEFAULT_AV; if (o.cloth) av.cloth = o.cloth;
        const fr = o.moving ? (Math.floor(now / 130) % 2 ? 'walkA' : 'walkB') : 'idle';
        const sp = avatarSprite(av, fr, sc, !!o.flash), bob = o.moving ? (Math.floor(now / 130) % 2 ? -sc : 0) : (Math.floor(now / 480) % 2 ? -sc : 0);
        ctx.save(); ctx.imageSmoothingEnabled = false; if (o.alpha != null) ctx.globalAlpha = o.alpha;
        ctx.translate(Math.round(x), Math.round(y + bob)); if (o.left) ctx.scale(-1, 1);
        ctx.drawImage(sp.c, -Math.round(sp.w / 2), -sp.h + 2 * sc);
        ctx.restore(); return sp;
    }
    const baseDrawPerson = P.drawPerson;
    P.drawPerson = function (ctx, x, y, o) { return (o && o.avatar) ? drawAvatar(ctx, x, y, o) : baseDrawPerson(ctx, x, y, o); };
    // 画面の部品（アバター設定画面など）に置く小さな画像
    P.avatarCanvas = function (av, scale) { const a = cleanAvatar(av) || DEFAULT_AV; const sp = avatarSprite(a, 'idle', scale || 6, false); const c = document.createElement('canvas'); c.width = sp.w; c.height = sp.h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(sp.c, 0, 0); return c; };
    P.cleanAvatar = cleanAvatar; P.avatarString = avToString;
    P.npcAvatar = function (name) {      // 町の人は、名前から決まる見た目
        let h = 0; const s = String(name || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        const hs = Object.keys(D.AV.hair), oc = Object.keys(D.AV.outfit), hc = Object.keys(HAIR_COL), sk = Object.keys(SKIN_COL);
        return { hairStyle: hs[h % hs.length], hairColor: hc[(h >> 3) % hc.length], skinColor: sk[(h >> 6) % sk.length], outfit: oc[(h >> 9) % oc.length], accessory: ['none', 'none', 'glasses', 'hat', 'headband'][(h >> 12) % 5] };
    };

    // ---------- 乱数と色 ----------
    function rngOf(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
    function hsl(c) { const [r, g, b] = parse(c).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return { h: h, s: s, l: l }; }
    // 床の色から、地面の種類を決める
    function kindOfColor(c) {
        const q = hsl(c);
        if (q.l > 0.78) return 'snow';
        if (q.s < 0.16) return q.l < 0.12 ? 'void' : 'stone';
        if (q.h >= 70 && q.h < 175) return 'grass';
        if (q.h >= 175 && q.h < 255) return q.l < 0.3 ? 'void' : 'stone';
        if (q.h >= 255 && q.h < 335) return q.l < 0.4 ? 'void' : 'stone';
        if (q.h >= 38 && q.h < 70) return q.l > 0.5 ? 'sand' : 'dirt';
        if (q.h < 22 || q.h >= 335) return (q.s > 0.45 && q.l < 0.4) ? 'lava' : 'dirt';      // 赤くて彩度が高いものだけ溶岩。茶色っぽいものは土
        return 'dirt';
    }

    // ---------- 床・壁のタイル（16×16 を 2px で＝32px。つなげて敷き詰める）----------
    const PAT = {};
    function genTile(kind, base) {
        const N = 16, S = 2, cv = document.createElement('canvas'); cv.width = cv.height = N * S; const g = cv.getContext('2d');
        const r = rngOf(hashStr(kind + base)), t0 = shade(base, -0.16), t1 = base, t2 = shade(base, 0.1), t3 = shade(base, 0.22), dk = shade(base, -0.38);
        const px = (x, y, c) => { g.fillStyle = c; g.fillRect(((x % N) + N) % N * S, ((y % N) + N) % N * S, S, S); };
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = r(); px(x, y, v < 0.18 ? t0 : v > 0.9 ? t2 : t1); }
        if (kind === 'grass') {
            for (let i = 0; i < 9; i++) { const x = (r() * N) | 0, y = (r() * N) | 0; px(x, y, t3); px(x, y - 1, t2); if (r() < 0.5) px(x + 1, y, t2); }
            for (let i = 0; i < 6; i++) { const x = (r() * N) | 0, y = (r() * N) | 0; px(x, y, t0); px(x + 1, y, t0); }
        } else if (kind === 'stone') {
            for (let x = 0; x < N; x++) { px(x, 0, dk); px(x, 8, dk); }
            for (let y = 0; y < 8; y++) px(5, y, dk); for (let y = 8; y < N; y++) px(12, y, dk);
            for (let i = 0; i < 6; i++) { const x = (r() * N) | 0, y = (r() * N) | 0; px(x, y, t3); }
        } else if (kind === 'dirt') {
            for (let i = 0; i < 10; i++) { const x = (r() * N) | 0, y = (r() * N) | 0; px(x, y, t0); px(x + 1, y, t0); }
            for (let i = 0; i < 5; i++) { const x = (r() * N) | 0, y = (r() * N) | 0; px(x, y, t3); }
        } else if (kind === 'sand') {
            for (let y = 2; y < N; y += 5) for (let x = 0; x < N; x++) if ((x + y) % 4 < 2) px(x, y + ((x >> 2) & 1), t3);
            for (let i = 0; i < 6; i++) px((r() * N) | 0, (r() * N) | 0, t0);
        } else if (kind === 'snow') {
            for (let i = 0; i < 12; i++) px((r() * N) | 0, (r() * N) | 0, '#ffffff');
            for (let i = 0; i < 8; i++) px((r() * N) | 0, (r() * N) | 0, shade(base, -0.12));
        } else if (kind === 'lava') {
            for (let i = 0; i < 4; i++) { let x = (r() * N) | 0, y = (r() * N) | 0; for (let k = 0; k < 6; k++) { px(x, y, '#ff8a2a'); if (r() < 0.4) px(x, y, '#ffd84a'); x += r() < 0.5 ? 1 : 0; y += r() < 0.6 ? 1 : 0; } }
        } else if (kind === 'void') {
            for (let i = 0; i < 7; i++) px((r() * N) | 0, (r() * N) | 0, i % 3 === 0 ? '#ffffff' : t3);
        } else if (kind === 'brick') {
            for (let row = 0; row < 4; row++) { const y = row * 4; for (let x = 0; x < N; x++) px(x, y, dk); const off = (row % 2) * 4; for (let y2 = y; y2 < y + 4; y2++) { px(off + 2, y2, dk); px(off + 10, y2, dk); } for (let x = 0; x < N; x++) px(x, y + 1, t2); }
        }
        return cv;
    }
    P.kindOfColor = kindOfColor;
    P.pattern = function (ctx, kind, base) {
        const key = kind + '|' + base; if (!PAT[key]) { const cv = genTile(kind, base); PAT[key] = ctx.createPattern(cv, 'repeat'); }
        return PAT[key];
    };

    // ---------- 地面のかざり（草・花・小石など。見えている範囲だけ、決まった位置に出す）----------
    const DECOR = {
        grass: [['tuft', 5], ['flower', 2], ['pebble', 1]], dirt: [['pebble', 4], ['crack', 2], ['tuft', 1]], stone: [['crack', 4], ['pebble', 3]],
        sand: [['pebble', 2], ['bones', 1], ['tuft', 2]], snow: [['lump', 4], ['crystal', 2]], lava: [['ember', 4], ['pebble', 2]], void: [['star', 6], ['crystal', 1]]
    };
    function drawDecor(ctx, d, x, y, rnd, base) {
        const f = (ox, oy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + ox, y + oy, w, h); };
        if (d === 'tuft') { const c = shade(base, 0.3), c2 = shade(base, 0.15); f(0, -4, 2, 4, c); f(-3, -2, 2, 2, c2); f(3, -3, 2, 3, c2); f(0, 0, 2, 2, shade(base, -0.3)); }
        else if (d === 'flower') { const cols = ['#ff8ab0', '#ffe14a', '#ffffff', '#9ad0ff']; const c = cols[(rnd * 4) | 0]; f(0, 0, 2, 4, shade(base, 0.2)); f(-2, -4, 6, 2, c); f(0, -6, 2, 6, c); f(0, -4, 2, 2, '#ffe14a'); }
        else if (d === 'pebble') { f(0, 0, 6, 4, '#8a8f99'); f(0, 0, 4, 2, '#b4bac4'); f(2, 4, 4, 2, 'rgba(0,0,0,0.25)'); }
        else if (d === 'crack') { const c = shade(base, -0.4); f(0, 0, 2, 2, c); f(2, 2, 2, 2, c); f(4, 2, 4, 2, c); f(8, 4, 2, 2, c); }
        else if (d === 'bones') { f(0, 0, 8, 2, '#e8e2cc'); f(-2, -2, 4, 2, '#e8e2cc'); f(6, 2, 4, 2, '#e8e2cc'); }
        else if (d === 'lump') { f(0, 2, 10, 4, '#ffffff'); f(2, 0, 6, 2, '#ffffff'); f(0, 6, 10, 2, 'rgba(120,150,200,0.45)'); }
        else if (d === 'crystal') { f(0, -6, 2, 8, '#bfe8ff'); f(-2, -2, 2, 4, '#8ac8f0'); f(2, -4, 2, 6, '#e8f8ff'); }
        else if (d === 'ember') { f(0, 0, 2, 2, '#ffd84a'); f(2, -2, 2, 2, '#ff8a2a'); }
        else if (d === 'star') { f(0, 0, 2, 2, '#ffffff'); f(-2, 0, 2, 2, 'rgba(255,255,255,.5)'); f(2, 0, 2, 2, 'rgba(255,255,255,.5)'); f(0, -2, 2, 2, 'rgba(255,255,255,.5)'); f(0, 2, 2, 2, 'rgba(255,255,255,.5)'); }
    }
    P.drawScatter = function (ctx, kind, base, x0, y0, x1, y1, maxW, maxH, seed, skip) {
        const list = DECOR[kind]; if (!list) return; const CELL = 96, tw = list.reduce((s, d) => s + d[1], 0);
        for (let cy = Math.max(0, Math.floor(y0 / CELL)); cy <= Math.min(Math.floor(maxH / CELL), Math.floor(y1 / CELL)); cy++)
            for (let cx = Math.max(0, Math.floor(x0 / CELL)); cx <= Math.min(Math.floor(maxW / CELL), Math.floor(x1 / CELL)); cx++) {
                const r = rngOf((cx * 73856093) ^ (cy * 19349663) ^ seed); if (r() > 0.42) continue;
                const x = Math.round((cx * CELL + 12 + r() * (CELL - 24)) / 2) * 2, y = Math.round((cy * CELL + 12 + r() * (CELL - 24)) / 2) * 2;
                if (x < 10 || y < 10 || x > maxW - 10 || y > maxH - 10) continue; if (skip && skip(x, y)) continue;
                let pick = r() * tw, d = list[0][0]; for (const it of list) { pick -= it[1]; if (pick <= 0) { d = it[0]; break; } }
                drawDecor(ctx, d, x, y, r(), base);
            }
    };

    // ---------- 岩（ドットの丸い岩）----------
    const ROCKS = {};
    P.drawRock = function (ctx, x, y, r) {
        const key = Math.round(r / 2); let cv = ROCKS[key];
        if (!cv) {
            const S = 3, n = Math.max(5, Math.round(r * 2 / S) + 2); cv = ROCKS[key] = document.createElement('canvas'); cv.width = cv.height = n * S; const g = cv.getContext('2d'), c = (n - 1) / 2;
            for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
                const dx = i - c, dy = j - c, d = Math.hypot(dx, dy) / (n / 2 - 0.3); if (d > 1) continue;
                const light = (-(dx) * 0.6 - (dy) * 0.8) / (n / 2); g.fillStyle = d > 0.84 ? '#2c2f38' : light > 0.28 ? '#a8adb8' : light > 0.05 ? '#868b95' : light > -0.25 ? '#6b6f78' : '#52565f'; g.fillRect(i * S, j * S, S, S);
            }
            g.fillStyle = '#52565f'; g.fillRect(Math.round(n * 0.55) * S, Math.round(n * 0.4) * S, S, S * 2);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(x - r * 0.8), Math.round(y + r * 0.55), Math.round(r * 1.8), Math.max(3, Math.round(r * 0.45)));
        ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y - cv.height / 2)); ctx.restore();
    };

    // ---------- 弾 ----------
    const BUL = {};
    function bulletSprite(col, g, u) {
        const key = col + '|' + g + '|' + u; if (BUL[key]) return BUL[key];
        const n = g * 2 + 1, cv = document.createElement('canvas'); cv.width = cv.height = n * u; const c2 = cv.getContext('2d');
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            const d = Math.hypot(i - g, j - g) / (g + 0.45); if (d > 1) continue;
            c2.fillStyle = d > 0.78 ? shade(col, -0.45) : d > 0.45 ? col : d > 0.2 ? shade(col, 0.5) : '#ffffff'; c2.fillRect(i * u, j * u, u, u);
        }
        return (BUL[key] = cv);
    }
    P.drawBullet = function (ctx, x, y, r, col, o) {
        o = o || {}; col = col || '#ff6a5a';
        const u = r < 5 ? 2 : 3, g = Math.max(1, Math.round(r / u)), sp = Math.hypot(o.vx || 0, o.vy || 0);
        ctx.save(); ctx.imageSmoothingEnabled = false;
        if (sp > 140) {      // 尾（動いている向きの後ろに、薄い粒を2つ）
            const ux = o.vx / sp, uy = o.vy / sp;
            for (let i = 1; i <= 2; i++) { ctx.globalAlpha = 0.5 / i; ctx.fillStyle = col; const s = Math.max(2, (g * u) * (1.2 - i * 0.3)); ctx.fillRect(Math.round(x - ux * (g * u + i * u * 1.8) - s / 2), Math.round(y - uy * (g * u + i * u * 1.8) - s / 2), s, s); }
            ctx.globalAlpha = 1;
        }
        if (o.arrow && sp > 1) {      // 矢：8方向にそろえて、細長く描く
            const a = Math.round(Math.atan2(o.vy, o.vx) / (Math.PI / 4)) * (Math.PI / 4); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a);
            ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-10, -1, 14, 2); ctx.fillStyle = '#e8e8f0'; ctx.fillRect(-12, -3, 4, 2); ctx.fillRect(-12, 1, 4, 2); ctx.fillStyle = '#d8dde8'; ctx.fillRect(4, -2, 4, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(8, -1, 2, 2);
        } else { const cv = bulletSprite(col, g, u); ctx.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y - cv.height / 2)); }
        ctx.restore();
    };

    // ---------- 町の建物 ----------
    const BLD = {};
    function mix(a, b, t) { const A = parse(a), B = parse(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); }
    function buildBuilding(w, h, color, kind) {
        const UN = 4, gw = Math.max(8, Math.round(w / UN)), gh = Math.max(8, Math.round(h / UN)), cv = document.createElement('canvas'); cv.width = gw * UN; cv.height = gh * UN; const g = cv.getContext('2d');
        const R = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x * UN, y * UN, ww * UN, hh * UN); };
        const OL = '#14121c';
        if (kind === 'gate') {      // 石のアーチ門。中は色のうずまき
            const pw = Math.max(2, Math.round(gw * 0.2));
            R(0, 0, gw, gh, OL); R(1, 1, gw - 2, gh - 2, '#8a8f99'); R(1, 1, gw - 2, 1, '#b4bac4'); R(pw, Math.round(gh * 0.28), gw - pw * 2, gh - Math.round(gh * 0.28) - 1, OL);
            const gl = shade(color, 0.2); R(pw + 1, Math.round(gh * 0.28) + 1, gw - pw * 2 - 2, gh - Math.round(gh * 0.28) - 3, color);
            for (let yy = Math.round(gh * 0.28) + 2; yy < gh - 2; yy += 2) for (let xx = pw + 2 + (yy % 4 ? 1 : 0); xx < gw - pw - 2; xx += 3) R(xx, yy, 1, 1, gl);
            for (let yy = 2; yy < gh - 2; yy += 3) { R(1, yy, pw - 1, 1, '#6b7080'); R(gw - pw, yy, pw - 1, 1, '#6b7080'); }
            R(Math.round(gw / 2) - 1, 1, 2, 2, color);
        } else if (kind === 'sign') {      // 道しるべ
            const bx = Math.round(gw / 2) - 1; R(bx, 2, 2, gh - 2, OL); R(bx + 0, 3, 1, gh - 4, '#8a5a2b');
            R(1, 1, gw - 2, Math.max(4, Math.round(gh * 0.3)), OL); R(2, 2, gw - 4, Math.max(2, Math.round(gh * 0.3) - 2), color); R(2, 2, gw - 4, 1, shade(color, 0.35));
            R(Math.round(gw / 2) - 2, gh - 2, 5, 2, '#5b3a1c');
        } else {      // 家
            const roofH = Math.max(4, Math.round(gh * 0.45)), roof = shade(color, -0.12), roof2 = shade(color, -0.28), roofL = shade(color, 0.2), wall = mix(color, '#e8d9b5', 0.72), wallD = shade(wall, -0.18);
            for (let r = 0; r < roofH; r++) {
                const ins = Math.round((roofH - 1 - r) * (gw / 2 - 3) / (roofH - 1)), x0 = ins, ww = gw - ins * 2;
                R(x0, r, ww, 1, OL); R(x0 + 1, r, Math.max(1, ww - 2), 1, r % 2 ? roof2 : roof); if (r % 2 === 0) R(x0 + 1, r, Math.max(1, ww - 2), 1, roof); R(x0 + 1, r, 1, 1, roofL);
            }
            R(0, roofH - 1, gw, 1, OL); R(1, roofH - 1, gw - 2, 1, roof2);
            const wy = roofH; R(1, wy, gw - 2, gh - wy, OL); R(2, wy, gw - 4, gh - wy - 1, wall);
            for (let yy = wy + 1; yy < gh - 1; yy += 2) { R(2, yy, gw - 4, 1, wallD); for (let xx = 3 + ((yy - wy) % 4 ? 0 : 2); xx < gw - 3; xx += 4) R(xx, yy - 1, 1, 1, wallD); }
            const dw = 4, dx = Math.round(gw / 2) - 2, dh = Math.min(gh - wy - 2, 6); R(dx - 1, gh - 1 - dh - 1, dw + 2, dh + 1, OL); R(dx, gh - 1 - dh, dw, dh, '#5b3a1c'); R(dx, gh - 1 - dh, 1, dh, '#7a4f26'); R(dx + dw - 1, gh - 1 - Math.round(dh / 2), 1, 1, '#f2c14e');
            const wnd = (wx) => { R(wx - 1, wy + 1, 5, 5, OL); R(wx, wy + 2, 3, 3, '#ffe9a0'); R(wx + 1, wy + 2, 1, 3, '#5b3a1c'); R(wx, wy + 3, 3, 1, '#5b3a1c'); };
            if (gw >= 14) { wnd(3); wnd(gw - 6); }
        }
        return cv;
    }
    P.drawBuilding = function (ctx, x, y, w, h, color, kind) {
        const key = Math.round(w) + 'x' + Math.round(h) + '|' + color + '|' + kind; const cv = BLD[key] || (BLD[key] = buildBuilding(w, h, color, kind));
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(Math.round(x + 6), Math.round(y + h - 6), Math.round(w), 10);
        ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, Math.round(x), Math.round(y), Math.round(w), Math.round(h)); ctx.restore();
    };
    // 地面の「道」：ドットの楕円
    P.drawPathPatch = function (ctx, cx, cy, rx, ry) {
        const S = 4; ctx.save();
        for (let y = -ry; y <= ry; y += S) { const hw = Math.round(rx * Math.sqrt(1 - (y / ry) * (y / ry)) / S) * S; ctx.fillStyle = 'rgba(201,184,148,0.55)'; ctx.fillRect(Math.round((cx - hw) / S) * S, Math.round((cy + y) / S) * S, hw * 2, S); }
        ctx.fillStyle = 'rgba(150,130,100,0.5)'; for (let i = 0; i < 6; i++) { const a = i * 1.7 + cx, px2 = Math.round((cx + Math.cos(a) * rx * 0.6) / S) * S, py2 = Math.round((cy + Math.sin(a) * ry * 0.6) / S) * S; ctx.fillRect(px2, py2, S, S); }
        ctx.restore();
    };

    // ---------- ボス ----------
    function bossKind(name, icon) {
        const t = String(name || '') + ' ' + String(icon || '');
        for (const r of D.BOSS_KIND_RULES) if (r[0].test(t)) return r[1];
        return D.BOSS_KIND_RULES.default;
    }
    P.bossKind = bossKind;
    const BSP = {};
    function bossSprite(kind, color, scale, flash) {
        const key = kind + '|' + color + '|' + scale + (flash ? '|f' : ''); if (BSP[key]) return BSP[key];
        const pal = { m: color, M: shade(color, -0.4), L: shade(color, 0.4), k: '#14121c', w: '#ffffff', e: '#ff3b3b', y: '#ffe14a', r: '#ff4a4a', g: '#f2c14e', s: '#b4bcc9', S: '#6b7384', a: '#dfe6f0', h: '#8a5a2b', b: '#8a5a2b', p: shade(color, 0.3) };
        return (BSP[key] = P._bake(D.BOSSES[kind] || D.BOSSES.orb, pal, scale, flash));
    }
    P.drawBoss = function (ctx, x, y, r, name, icon, color, o) {
        o = o || {}; const kind = bossKind(name, icon), sc = Math.max(3, Math.round(r * 2.3 / 20)), sp = bossSprite(kind, color || '#a44', sc, !!o.flash), now = o.now || performance.now();
        const bob = Math.sin(now / 320) * sc * 0.6;
        ctx.save(); ctx.imageSmoothingEnabled = false; if (o.alpha != null) ctx.globalAlpha = o.alpha;
        ctx.translate(Math.round(x), Math.round(y + bob)); if (o.left) ctx.scale(-1, 1);
        ctx.drawImage(sp.c, -Math.round(sp.w / 2), -Math.round(sp.h / 2) - Math.round(sc * 0.5));
        ctx.restore();
    };
})();
