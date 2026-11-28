// ============================================
// School Battle
// orig-weapon-ui.js（オリジナル武器：キット作成・武器作成・工房・ドット絵エディタ・金床）
// ============================================
// 中身のルールは hw-weapons.js（キット・成長・レア度アップ）にある。ここは画面だけ。
//   1. 素材からキットを作る  2. キットから武器を作る（武器種・名前・ドット絵・攻撃エフェクトの色）
//   3. 工房：素材を与えて成長／見た目を描き直す／レア度アップ（金床でハンマーを叩く）
(function (global) {
    'use strict';
    const L = () => global.SBLobbyUI;
    const esc = s => (L() ? L().esc(s) : String(s));
    const num = n => Number(n || 0).toLocaleString();

    // ---------- プレイヤーデータ（コイン・素材）----------
    const player = () => { try { return global.getPlayerData ? global.getPlayerData() : JSON.parse(localStorage.getItem('player') || 'null'); } catch (e) { return null; } };
    const savePlayer = p => { try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) { /* 保存できなくても続ける */ } };
    const coins = () => { const p = player(); return p ? (p.coins || 0) : 0; };
    function addCoins(v) { const p = player(); if (!p) return; p.coins = (p.coins || 0) + v; savePlayer(p); }
    function mats() { const p = player(); const m = p && p.materials && !Array.isArray(p.materials) ? p.materials : {}; return m; }
    function takeMats(used) {      // used: { id: n }。足りなければ false
        const p = player(); if (!p) return false; if (!p.materials || Array.isArray(p.materials)) p.materials = {};
        for (const id of Object.keys(used)) if ((p.materials[id] | 0) < used[id]) return false;
        Object.keys(used).forEach(id => { p.materials[id] = (p.materials[id] | 0) - used[id]; if (p.materials[id] <= 0) delete p.materials[id]; });
        savePlayer(p); return true;
    }
    // MATERIAL_DATA は materials.js の const（window の持ち物ではない）なので、グローバルの名前で直接読む
    const matInfo = id => { try { return (typeof MATERIAL_DATA !== 'undefined' && MATERIAL_DATA[id]) || null; } catch (e) { return null; } };
    const tagChips = (tags, small) => (tags || []).map(t => '<span style="display:inline-block;background:#2b3550;border-radius:10px;padding:1px 7px;margin:1px 2px 1px 0;font-size:' + (small ? '.68' : '.74') + 'rem;color:#cfe0ff">' + esc(HW.TAGS[t] || t) + '</span>').join('');
    const biasChips = b => { const top = HW.biasTop(b); return top.length ? tagChips(top) : '<span style="color:#778;font-size:.78rem">（偏りなし）</span>'; };
    const RC = k => (HW.RARITIES[k] || HW.RARITIES.normal);

    // ============================================================
    // 画像ファイルから、ドット絵を作る（絵のエディタ・弾の絵のエディタで共通）
    //  ・画像を縮小して、はみ出さないよう中央に置く（縦横比は保つ）。半透明の部分は透明にする
    //  ・「背景を消す」：周りが透明でない画像は、四すみの色に近い背景を、外側から消す
    //  ・色は、使われている色から「かたまり」ごとに最大16色にまとめる（メディアンカット）
    // ============================================================
    function imgToPix(img, W, H, nCol, o) {
        const rot = ((o.rot | 0) % 4 + 4) % 4, odd = rot % 2 === 1, sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
        if (!sw || !sh) return null;
        const rw = odd ? sh : sw, rh = odd ? sw : sh, sc = Math.min(W / rw, H / rh), dw = Math.max(1, Math.round(rw * sc)), dh = Math.max(1, Math.round(rh * sc));
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.save(); g.translate(W / 2, H / 2); g.rotate(rot * Math.PI / 2); const iw = odd ? dh : dw, ih = odd ? dw : dh; g.drawImage(img, -iw / 2, -ih / 2, iw, ih); g.restore();
        const d = g.getImageData(0, 0, W, H).data, a = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
        const x0 = Math.floor((W - dw) / 2), y0 = Math.floor((H - dh) / 2), x1 = Math.min(W - 1, x0 + dw - 1), y1 = Math.min(H - 1, y0 + dh - 1);
        const cr = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
        if (o.bg && cr.every(c => a[c[1] * W + c[0]])) {      // 四すみが不透明＝背景つきの画像：四すみの色に近い部分を、外側から消す
            let br = 0, bgc = 0, bb = 0; cr.forEach(c => { const k = (c[1] * W + c[0]) * 4; br += d[k]; bgc += d[k + 1]; bb += d[k + 2]; }); br /= 4; bgc /= 4; bb /= 4;
            const near = k => Math.abs(d[k * 4] - br) + Math.abs(d[k * 4 + 1] - bgc) + Math.abs(d[k * 4 + 2] - bb) < 96, stack = [];
            for (let x = x0; x <= x1; x++) { stack.push([x, y0], [x, y1]); } for (let y = y0; y <= y1; y++) { stack.push([x0, y], [x1, y]); }
            while (stack.length) { const p = stack.pop(), x = p[0], y = p[1]; if (x < x0 || x > x1 || y < y0 || y > y1) continue; const k = y * W + x; if (!a[k] || !near(k)) continue; a[k] = 0; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
        }
        const hist = new Map();      // 色ごとの数（各色5bitにまるめる）
        for (let i = 0; i < W * H; i++) if (a[i]) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], key = (r >> 3) << 10 | (gg >> 3) << 5 | (b >> 3), e = hist.get(key); if (e) { e.n++; e.r += r; e.g += gg; e.b += b; } else hist.set(key, { n: 1, r: r, g: gg, b: b }); }
        if (!hist.size) return null;
        let boxes = [Array.from(hist.values()).map(e => ({ n: e.n, r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }))];
        while (boxes.length < nCol) {      // いちばん色の幅が広いかたまりを、中央で2つに割る
            let bi = -1, bs = 0, bch = 'r';
            boxes.forEach((bx, i) => { if (bx.length < 2) return; ['r', 'g', 'b'].forEach(ch => { let lo = 255, hi = 0; bx.forEach(c => { lo = Math.min(lo, c[ch]); hi = Math.max(hi, c[ch]); }); if (hi - lo > bs) { bs = hi - lo; bi = i; bch = ch; } }); });
            if (bi < 0) break;
            const bx = boxes[bi].slice().sort((p, q) => p[bch] - q[bch]); let tot = 0; bx.forEach(c => { tot += c.n; }); let acc = 0, cut = 1;
            for (let i = 0; i < bx.length - 1; i++) { acc += bx[i].n; cut = i + 1; if (acc >= tot / 2) break; }
            boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
        }
        const pal = boxes.map(bx => { let n = 0, r = 0, gg = 0, b = 0; bx.forEach(c => { n += c.n; r += c.r * c.n; gg += c.g * c.n; b += c.b * c.n; }); return [Math.round(r / n), Math.round(gg / n), Math.round(b / n)]; });
        const hex = c => '#' + c.map(v => ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2)).join(''), cache = new Map(), grid = [];
        for (let y = 0; y < H; y++) { const row = new Array(W).fill(-1); for (let x = 0; x < W; x++) { const i = y * W + x; if (!a[i]) continue; const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], key = r << 16 | gg << 8 | b; let ci = cache.get(key); if (ci == null) { let bd = 1e9; ci = 0; pal.forEach((c, k) => { const dd = (c[0] - r) * (c[0] - r) + (c[1] - gg) * (c[1] - gg) + (c[2] - b) * (c[2] - b); if (dd < bd) { bd = dd; ci = k; } }); cache.set(key, ci); } row[x] = ci; } grid.push(row); }
        return { grid: grid, pal: pal.map(hex) };
    }
    function imageImport(host, W, H, nCol, onApply, hint) {
        host.innerHTML = '<div style="margin-top:8px;padding:6px;border:1px dashed #3a4666;border-radius:6px;font-size:.8rem;color:#9fb3d9">🖼 <b>画像ファイルから描く</b>' + (hint ? '<div style="font-size:.74rem;color:#8a97b5">' + hint + '</div>' : '') +
            '<input type="file" accept="image/*" style="display:none"> <button type="button" class="sbl-btn gray" data-b="pick" style="padding:5px 10px;margin:3px 3px 0 0">画像を選ぶ</button>' +
            '向き <select data-b="rot" style="background:#10131c;color:#e6e9f5;border:1px solid #3a4666;border-radius:4px"><option value="0">そのまま</option><option value="1">右に90°</option><option value="2">180°</option><option value="3">左に90°</option></select> ' +
            '<label style="white-space:nowrap"><input type="checkbox" data-b="bg" checked> 背景を消す</label> <span data-b="msg" style="color:#ff9a9a"></span></div>';
        const fi = host.querySelector('input[type=file]'), msg = host.querySelector('[data-b=msg]'), rotEl = host.querySelector('[data-b=rot]'), bgEl = host.querySelector('[data-b=bg]');
        let img = null;
        const run = () => {
            if (!img) return; msg.textContent = '';
            let r = null; try { r = imgToPix(img, W, H, nCol, { rot: +rotEl.value, bg: bgEl.checked }); } catch (e) { r = null; }
            if (!r) { msg.textContent = 'この画像からは、絵を作れませんでした（全部透明か、背景を消しすぎたかも）。'; return; }
            onApply(r);
        };
        host.querySelector('[data-b=pick]').addEventListener('click', () => fi.click());
        fi.addEventListener('change', () => {
            const f = fi.files && fi.files[0]; fi.value = ''; if (!f) return;
            if (!/^image\//.test(f.type)) { msg.textContent = '画像ファイルを選んでください。'; return; }
            if (f.size > 8 * 1024 * 1024) { msg.textContent = '画像が大きすぎます（8MBまで）。'; return; }
            const url = URL.createObjectURL(f), im = new Image();
            im.onload = () => { URL.revokeObjectURL(url); img = im; run(); };
            im.onerror = () => { URL.revokeObjectURL(url); msg.textContent = 'この画像は読み込めませんでした。'; };
            im.src = url;
        });
        rotEl.addEventListener('change', run); bgEl.addEventListener('change', run);
    }

    // ============================================================
    // ドット絵エディタ
    // ============================================================
    const PALETTE0 = ['#ffffff', '#c9d3e6', '#8fa0bf', '#5a6a8c', '#2a3350', '#14121c', '#8a5a2b', '#5b3a1c', '#f2c14e', '#b88a1e', '#ff5a3a', '#ffa13a', '#4ac8ff', '#3a6ee8', '#7fd13b', '#c06aff'];
    const FX_PRESETS = ['#ff5a3a', '#ffa13a', '#ffe14a', '#7fd13b', '#4ac8ff', '#3a6ee8', '#c06aff', '#ff6ad5', '#ffffff', '#9aa6c0'];
    function pixelEditor(box, init, type) {
        // 解像度：1マスは従来の 1/4 の大きさ（縦横4倍・64×96）。昔の絵（16×24）は4倍に拡大して読み込む
        const F = 4, W = 16 * F, H = 24 * F, CH = HW.PIX_CHARS, HEXC = /^#[0-9a-fA-F]{6}$/;
        const st = { grid: [], pal: PALETTE0.slice(), cur: 8, tool: 'pen', mirror: true, gripY: 20 * F, gripX: W / 2, undo: [], fx: (init && init.fxColor) || '#ff5a3a', brush: 1, zoom: 1, size: (init && HW.cleanSize) ? HW.cleanSize(init.size || 1) : 1 };
        const blank = () => { const g = []; for (let y = 0; y < H; y++) g.push(new Array(W).fill(-1)); return g; };
        st.grid = blank();
        function loadPix(px) {      // 保存された絵（rows / pal / grip / s）を読み込む
            const c = HW.cleanPix(px); if (!c) return false;
            const k = c.s === F ? 1 : F;      // 保存された絵が従来の細かさなら、4倍に拡大して取り込む
            const idx = {}; st.pal = PALETTE0.slice();
            CH.split('').forEach((ch, i) => { if (c.pal[ch]) { st.pal[i] = c.pal[ch]; idx[ch] = i; } });
            st.grid = blank();
            for (let y = 0; y < c.rows.length; y++) { const r = c.rows[y]; for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch === '.' || idx[ch] == null) continue; for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) { const gx = x * k + dx, gy = y * k + dy; if (gx < W && gy < H) st.grid[gy][gx] = idx[ch]; } } }
            st.gripY = Math.min(H - 1, (c.grip || c.gripY || 20) * k);
            st.gripX = Math.min(W - 1, (c.gripX || W / 2 / k) * k);
            return true;
        }
        function loadTemplate(t) {      // 武器種の標準の絵を、下書きとして読み込む（4倍に拡大）
            const D = global.SBPIX_DATA, W0 = D && D.WEAPONS && (D.WEAPONS[t] || D.WEAPONS.default); if (!W0) return;
            const pal = SBPix._palWeapon('#8fb0ff'), letters = []; W0.rows.forEach(r => { for (const ch of r) if (ch !== '.' && ch !== ' ' && pal[ch] && letters.indexOf(ch) < 0) letters.push(ch); });
            const map = {}; st.pal = PALETTE0.slice(); letters.slice(0, 16).forEach((ch, i) => { map[ch] = i; st.pal[i] = pal[ch]; });
            const w0 = Math.max.apply(null, W0.rows.map(r => r.length)), ox = Math.floor((W - w0 * F) / 2), oy = Math.max(0, H - W0.rows.length * F - F);
            st.grid = blank();
            W0.rows.forEach((r, ry) => { for (let rx = 0; rx < r.length; rx++) { const ch = r[rx]; if (ch === '.' || ch === ' ' || map[ch] == null) continue; for (let dy = 0; dy < F; dy++) for (let dx = 0; dx < F; dx++) { const x = rx * F + dx + ox, y = ry * F + dy + oy; if (x >= 0 && x < W && y >= 0 && y < H) st.grid[y][x] = map[ch]; } } });
            st.gripY = Math.min(H - 1, ((W0.grip | 0) * F) + oy);
            st.gripX = W / 2;
        }
        if (!(init && init.pix && loadPix(init.pix))) loadTemplate(type || 'sword');
        const baseCell = Math.max(4, Math.min(8, Math.floor((Math.min(global.innerWidth || 360, 420) - 56) / W)));
        const cellOf = () => baseCell * st.zoom;
        box.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start">' +
            '<div style="max-width:100%"><div id="pxeWrap" style="max-width:100%;max-height:62vh;overflow:auto;border:2px solid #3a4666;border-radius:6px;background:#10131c"><canvas id="pxeCv" style="display:block;touch-action:none;cursor:crosshair;max-width:none"></canvas></div>' +
            '<div style="margin-top:4px;font-size:.78rem;color:#9fb3d9">ズーム <button type="button" class="sbl-btn gray" id="pxeZm" style="padding:3px 9px;margin:0">－</button> <b id="pxeZv">1x</b> <button type="button" class="sbl-btn gray" id="pxeZp" style="padding:3px 9px;margin:0">＋</button>　太さ <select id="pxeBr" style="background:#10131c;color:#e6ecff;border:1px solid #3a4666;border-radius:5px;padding:2px"><option value="1">細(1)</option><option value="2">中(2)</option><option value="4">太(4)</option></select></div></div>' +
            '<div style="flex:1;min-width:190px">' +
            '<div style="font-size:.78rem;color:#9fb3d9;margin-bottom:3px">色（タップで選ぶ。選んだ色は下で変えられます）</div><div id="pxePal" style="display:grid;grid-template-columns:repeat(8,1fr);gap:3px;max-width:240px"></div>' +
            '<div style="margin:5px 0"><input type="color" id="pxeCol" value="#ffffff" style="width:44px;height:30px;padding:0;border:1px solid #3a4666;background:#fff;vertical-align:middle"> <span style="font-size:.78rem;color:#9fb3d9">選んだ色を変える</span></div>' +
            '<div id="pxeTools" style="display:flex;flex-wrap:wrap;gap:3px"></div>' +
            '<div style="margin:6px 0;font-size:.8rem"><label><input type="checkbox" id="pxeMir" checked> 左右対称に描く</label></div>' +
            '<div style="font-size:.8rem;color:#9fb3d9">持ち手の位置（赤い線。ここを持って振ります）</div>' +
            '<div style="font-size:.78rem;color:#9fb3d9">縦位置<input type="range" id="pxeGripY" min="0" max="' + (H - 1) + '" value="' + st.gripY + '" style="width:100%"></div>' +
            '<div style="font-size:.78rem;color:#9fb3d9">横位置<input type="range" id="pxeGripX" min="0" max="' + (W - 1) + '" value="' + st.gripX + '" style="width:100%"></div>' +
            '<div style="margin-top:6px"><button type="button" class="sbl-btn gray" id="pxeUndo" style="padding:5px 10px">↩ 戻す</button><button type="button" class="sbl-btn gray" id="pxeClear" style="padding:5px 10px">全消し</button><button type="button" class="sbl-btn gray" id="pxeTpl" style="padding:5px 10px">下書き（武器種）</button></div><div id="pxeImg"></div>' +
            '<div style="margin-top:8px;font-size:.8rem;color:#9fb3d9">攻撃エフェクトの色</div><div id="pxeFx" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center"></div>' +
            '<div style="margin-top:8px;font-size:.8rem;color:#9fb3d9">武器の大きさ <b id="pxeSzv" style="color:#ffd84a"></b>（持ち手を中心に、見た目が大きく／小さくなります）<input type="range" id="pxeSz" min="' + HW.SIZE_MIN + '" max="' + HW.SIZE_MAX + '" step="0.05" value="' + st.size + '" style="width:100%"></div>' +
            '<div style="margin-top:6px;font-size:.8rem;color:#9fb3d9">プレビュー</div><canvas id="pxePv" width="190" height="190" style="background:#10131c;border:1px solid #3a4666;border-radius:6px"></canvas>' +
            '</div></div>';
        const cv = box.querySelector('#pxeCv'), g = cv.getContext('2d'), pv = box.querySelector('#pxePv'), pg = pv.getContext('2d');
        function sizeCv() { const c = cellOf(); cv.width = W * c; cv.height = H * c; box.querySelector('#pxeZv').textContent = st.zoom + 'x'; }
        function toPix() {
            const rows = st.grid.map(r => r.map(i => i < 0 ? '.' : CH[i]).join(''));
            const pal = {}; CH.split('').forEach((ch, i) => { pal[ch] = HEXC.test(st.pal[i]) ? st.pal[i].toLowerCase() : '#ffffff'; });      // 色は必ず #rrggbb で保存する
            return HW.cleanPix({ rows: rows, pal: pal, gripY: st.gripY, gripX: st.gripX, s: F });
        }
        function drawPreview() {
            pg.clearRect(0, 0, pv.width, pv.height);
            const px = toPix(); if (!px) { pg.fillStyle = '#556'; pg.font = '12px sans-serif'; pg.fillText('絵を描いてください', 24, 70); return; }
            const col = st.fx;
            pg.save(); pg.globalAlpha = 0.9; pg.strokeStyle = col; pg.lineWidth = 8; pg.lineCap = 'round'; pg.beginPath(); pg.arc(95, 178, 78, -2.6, -0.55); pg.stroke();
            pg.globalAlpha = 0.5; pg.lineWidth = 16; pg.beginPath(); pg.arc(95, 178, 78, -2.5, -0.65); pg.stroke(); pg.restore();
            try { SBPix.drawWeapon(pg, 95, 172, -Math.PI / 2 + 0.5, type || 'sword', '#ffffff', { custom: SBPix.prepCustom(px), scale: 2, size: st.size }); } catch (e) { /* 描けなくてもエディタは使える */ }
        }
        function render() {
            const cell = cellOf();
            g.fillStyle = '#161a26'; g.fillRect(0, 0, cv.width, cv.height);
            const q = F * cell;      // 市松模様は、従来の1マス（4×4）の大きさで描く（軽くするため）
            g.fillStyle = '#1b2030'; for (let y = 0; y < H / F; y++) for (let x = 0; x < W / F; x++) if ((x + y) % 2) g.fillRect(x * q, y * q, q, q);
            for (let y = 0; y < H; y++) { const row = st.grid[y]; for (let x = 0; x < W; x++) { const i = row[x]; if (i >= 0) { g.fillStyle = st.pal[i]; g.fillRect(x * cell, y * cell, cell, cell); } } }
            if (cell >= 6) { g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= W; x++) { g.moveTo(x * cell + .5, 0); g.lineTo(x * cell + .5, H * cell); } for (let y = 0; y <= H; y++) { g.moveTo(0, y * cell + .5); g.lineTo(W * cell, y * cell + .5); } g.stroke(); }
            g.strokeStyle = '#ff4a5a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, st.gripY * cell + cell / 2); g.lineTo(W * cell, st.gripY * cell + cell / 2); g.stroke();
            g.strokeStyle = '#ff4a5a'; g.lineWidth = 2; g.beginPath(); g.moveTo(st.gripX * cell + cell / 2, 0); g.lineTo(st.gripX * cell + cell / 2, H * cell); g.stroke();
            if (st.mirror) { g.strokeStyle = 'rgba(120,200,255,.35)'; g.beginPath(); g.moveTo(W * cell / 2, 0); g.lineTo(W * cell / 2, H * cell); g.stroke(); }
            drawPreview();
        }
        function setColor(v) { if (!HEXC.test(v || '')) return; st.pal[st.cur] = v.toLowerCase(); palUi(true); render(); }
        function palUi(keepInput) {
            const pe = box.querySelector('#pxePal');
            pe.innerHTML = st.pal.map((c, i) => '<button type="button" data-i="' + i + '" style="height:26px;border-radius:5px;border:2px solid ' + (i === st.cur && st.tool !== 'erase' ? '#ffd84a' : '#2b3550') + ';background:' + c + ';cursor:pointer"></button>').join('');
            pe.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { st.cur = +b.dataset.i; if (st.tool === 'erase') st.tool = 'pen'; palUi(); toolUi(); }));
            const ci = box.querySelector('#pxeCol'); if (!keepInput && ci.value !== st.pal[st.cur]) ci.value = st.pal[st.cur];      // 色選び中は、選択画面を壊さないよう値を書き戻さない
        }
        const TOOLS = [['pen', '✏ 鉛筆'], ['erase', '🧽 消しゴム'], ['fill', '🪣 塗りつぶし'], ['pick', '💧 スポイト'], ['hand', '✋ 移動（スクロール）']];
        function toolUi() {
            const te = box.querySelector('#pxeTools');
            te.innerHTML = TOOLS.map(t => '<button type="button" data-t="' + t[0] + '" class="sbl-btn ' + (st.tool === t[0] ? '' : 'gray') + '" style="padding:5px 9px;margin:0;font-size:.8rem">' + t[1] + '</button>').join('');
            te.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { st.tool = b.dataset.t; cv.style.cursor = st.tool === 'hand' ? 'grab' : 'crosshair'; palUi(); toolUi(); }));
        }
        function fxUi() {
            const fe = box.querySelector('#pxeFx');
            fe.innerHTML = FX_PRESETS.map(c => '<button type="button" data-c="' + c + '" style="width:24px;height:24px;border-radius:50%;border:2px solid ' + (c === st.fx ? '#fff' : '#2b3550') + ';background:' + c + ';cursor:pointer"></button>').join('') +
                '<input type="color" id="pxeFxCol" value="' + st.fx + '" style="width:34px;height:28px;padding:0;border:1px solid #3a4666;background:#fff">';
            fe.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { st.fx = b.dataset.c; fxUi(); drawPreview(); }));
            const onFx = e => { if (HEXC.test(e.target.value)) { st.fx = e.target.value.toLowerCase(); drawPreview(); } };
            fe.querySelector('#pxeFxCol').addEventListener('input', onFx); fe.querySelector('#pxeFxCol').addEventListener('change', onFx);
        }
        function snap() { st.undo.push(JSON.stringify(st.grid)); if (st.undo.length > 25) st.undo.shift(); }
        function setCell(x, y, v) {
            const b = st.brush;
            for (let dy = 0; dy < b; dy++) for (let dx = 0; dx < b; dx++) {
                const xx = x + dx - (b >> 1), yy = y + dy - (b >> 1); if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
                st.grid[yy][xx] = v; if (st.mirror) st.grid[yy][W - 1 - xx] = v;
            }
        }
        function fill(x, y, v) {
            const t = st.grid[y][x]; if (t === v) return; const stack = [[x, y]]; let n = 0, lim = W * H * 4;
            while (stack.length && n++ < lim) { const p = stack.pop(), px = p[0], py = p[1]; if (px < 0 || px >= W || py < 0 || py >= H || st.grid[py][px] !== t) continue; st.grid[py][px] = v; stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]); }
        }
        function at(ev) { const r = cv.getBoundingClientRect(), c = cellOf(), sx = cv.width / r.width, sy = cv.height / r.height; return [Math.floor((ev.clientX - r.left) * sx / c), Math.floor((ev.clientY - r.top) * sy / c)]; }
        let down = false, lastP = null;
        function line(x0, y0, x1, y1, v) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) setCell(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), v); }      // 指を速く動かしても線がつながる
        function act(ev, first) {
            const p = at(ev), x = p[0], y = p[1]; if (x < 0 || x >= W || y < 0 || y >= H) return;
            if (st.tool === 'pick') { if (first && st.grid[y][x] >= 0) { st.cur = st.grid[y][x]; st.tool = 'pen'; palUi(); toolUi(); } return; }
            if (st.tool === 'fill') { if (first) { snap(); fill(x, y, st.cur); render(); } return; }
            const v = st.tool === 'erase' ? -1 : st.cur;
            if (lastP && !first) line(lastP[0], lastP[1], x, y, v); else setCell(x, y, v);
            lastP = [x, y]; render();
        }
        // スクロール：「✋ 移動」ツールで1本指ドラッグ、または どのツールでも2本指ドラッグでスクロールできる（マウスはホイール）
        const wrap = box.querySelector('#pxeWrap'), ptrs = new Map();
        let panning = false, panLast = null, stroked = false;
        const center = () => { let x = 0, y = 0; ptrs.forEach(p => { x += p.x; y += p.y; }); return [x / ptrs.size, y / ptrs.size]; };
        function startPan() { panning = true; panLast = center(); }
        cv.addEventListener('pointerdown', ev => {
            ev.preventDefault(); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
            try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* 対応していない端末でも描ける */ }
            if (ptrs.size >= 2) {      // 2本目の指：いま描きかけの線は取り消して、スクロールに切り替える
                if (down && stroked) { const t = st.undo.pop(); if (t) st.grid = JSON.parse(t); render(); }
                down = false; lastP = null; stroked = false; startPan(); return;
            }
            if (st.tool === 'hand') { startPan(); return; }
            down = true; lastP = null; stroked = false;
            if (st.tool === 'pen' || st.tool === 'erase') { snap(); stroked = true; } else if (st.tool === 'fill') stroked = true;
            act(ev, true);
        });
        cv.addEventListener('pointermove', ev => {
            if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
            if (panning) { const c = center(); wrap.scrollLeft -= c[0] - panLast[0]; wrap.scrollTop -= c[1] - panLast[1]; panLast = c; return; }
            if (down && (st.tool === 'pen' || st.tool === 'erase')) act(ev, false);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => cv.addEventListener(n, ev => {
            ptrs.delete(ev.pointerId); down = false; lastP = null; stroked = false;
            if (ptrs.size === 0) panning = false; else if (panning) panLast = center();
        }));
        const colEl = box.querySelector('#pxeCol');
        colEl.addEventListener('input', e => setColor(e.target.value)); colEl.addEventListener('change', e => setColor(e.target.value));
        box.querySelector('#pxeMir').addEventListener('change', e => { st.mirror = e.target.checked; render(); });
        box.querySelector('#pxeGripY').addEventListener('input', e => { st.gripY = +e.target.value; render(); });
        box.querySelector('#pxeGripX').addEventListener('input', e => { st.gripX = +e.target.value; render(); });
        const szUi = () => { box.querySelector('#pxeSzv').textContent = '×' + st.size.toFixed(2); };
        box.querySelector('#pxeSz').addEventListener('input', e => { st.size = HW.cleanSize(e.target.value); szUi(); drawPreview(); }); szUi();
        box.querySelector('#pxeBr').addEventListener('change', e => { st.brush = +e.target.value || 1; });
        box.querySelector('#pxeZp').addEventListener('click', () => { st.zoom = Math.min(4, st.zoom + 1); sizeCv(); render(); });
        box.querySelector('#pxeZm').addEventListener('click', () => { st.zoom = Math.max(1, st.zoom - 1); sizeCv(); render(); });
        box.querySelector('#pxeUndo').addEventListener('click', () => { const t = st.undo.pop(); if (t) { st.grid = JSON.parse(t); render(); } });
        box.querySelector('#pxeClear').addEventListener('click', () => { snap(); st.grid = blank(); render(); });
        box.querySelector('#pxeTpl').addEventListener('click', () => { if (!confirm('いまの絵を消して、武器種の標準の絵を下書きとして読み込みます。よろしいですか？')) return; snap(); loadTemplate(type || 'sword'); box.querySelector('#pxeGripY').value = st.gripY; box.querySelector('#pxeGripX').value = st.gripX; palUi(); render(); });
        imageImport(box.querySelector('#pxeImg'), W, H, CH.length, r => {      // 画像から：いまの絵を置きかえる（「戻す」で元に戻せる）
            snap(); st.grid = r.grid; st.pal = PALETTE0.slice(); r.pal.forEach((c, i) => { st.pal[i] = c; }); st.cur = 0; palUi(); render();
        }, '武器の先が上、持ち手が下になる向きで読み込まれます（向きは下で回せます）。赤い線の「持ち手の位置」も合わせてください。');
        sizeCv(); palUi(); toolUi(); fxUi(); render();
        return { pix: toPix, fx: () => st.fx, size: () => st.size, setType: t => { type = t; drawPreview(); } };
    }

    // ============================================================
    // 武器の小さな見た目（一覧・金床で使う）
    // ============================================================
    function iconCanvas(w, size) {
        const cv = document.createElement('canvas'); cv.width = size; cv.height = size; cv.style.cssText = 'image-rendering:pixelated;background:#10131c;border-radius:8px;border:1px solid #3a4666';
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
        try {
            const px = w.pix ? HW.cleanPix(w.pix) : null;
            SBPix.drawWeapon(g, size / 2, size * 0.78, -Math.PI / 2 + 0.35, w.type, HW.rarityOf(w).color, { custom: px ? SBPix.prepCustom(px) : null, scale: Math.max(2, Math.round(size / 40)) });
        } catch (e) { /* 描けなければ空のまま */ }
        return cv;
    }

    // ============================================================
    // 1. キット作成
    // ============================================================
    function openKits(hack, onChange) {
        if (!L() || !global.HW) { alert('読み込みに失敗しました'); return; }
        const m = L().modal('🔨 オリジナル武器キット', () => { if (onChange) onChange(); });
        const used = {};
        function draw() {
            const have = mats(), ids = Object.keys(have).filter(id => have[id] > 0 && matInfo(id)).sort((a, b) => (matInfo(b).rarity | 0) - (matInfo(a).rarity | 0) || a.localeCompare(b));
            const kv = HW.kitValue(used, matInfo), ok = kv.n >= HW.KIT_NEED_COUNT && kv.v >= HW.KIT_NEED_VALUE;
            const bias = {}; Object.keys(used).forEach(id => { if (used[id] > 0) HW.matTags(matInfo(id)).forEach(t => { bias[t] = (bias[t] || 0) + used[id] * (matInfo(id).rarity | 0 || 1); }); });
            const kits = hack.kits || [];
            m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%">' +
                '<div style="font-size:.84rem;color:#9fb3d9;line-height:1.6">素材を使って「オリジナル武器キット」を作ります。キットから、武器の種類・見た目（ドット絵）・攻撃エフェクトの色を決めて、自分だけの武器を作れます。<b>使った素材の系統で、あとで付きやすい効果が変わります</b>（炎の素材なら炎系の効果、など）。</div>' +
                '<div class="sbl-sec">持っているキット（' + kits.length + '）</div>' +
                (kits.length ? kits.map(k => '<div class="sbl-card" style="display:flex;justify-content:space-between;align-items:center;gap:6px;cursor:default"><span>キット <small style="display:inline">素材' + k.n + '個</small> ' + biasChips(k.bias) + '</span><button type="button" class="sbl-btn orange" data-kit="' + k.id + '" style="margin:0">武器を作る</button></div>').join('') : '<div style="color:#778;font-size:.82rem">まだありません。</div>') +
                '<div class="sbl-sec">キットの材料（素材' + HW.KIT_NEED_COUNT + '個以上、レア度の合計が' + HW.KIT_NEED_VALUE + '以上）</div>' +
                '<div style="font-size:.84rem;margin:2px 0 6px">選んだ素材：<b>' + kv.n + '</b>個　レア度の合計：<b style="color:' + (kv.v >= HW.KIT_NEED_VALUE ? '#7aff9a' : '#ffb06a') + '">' + kv.v + ' / ' + HW.KIT_NEED_VALUE + '</b>　偏り：' + biasChips(bias) + '</div>' +
                '<button type="button" class="sbl-btn green" id="kitMake"' + (ok ? '' : ' disabled style="opacity:.5"') + '>キットを作る</button>' +
                '<div style="margin-top:6px">' + (ids.length ? ids.map(id => { const mi = matInfo(id), u = used[id] | 0; return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #232a3d;font-size:.84rem"><span style="flex:1;min-width:0">' + esc(mi.name) + ' <small style="color:#9fb3d9">★' + mi.rarity + '</small><br>' + tagChips(HW.matTags(mi), true) + '</span><span style="color:#9fb3d9">所持' + have[id] + '</span><button type="button" class="sbl-btn gray" data-m="' + id + '" data-d="-1" style="margin:0;padding:3px 9px">−</button><b style="min-width:22px;text-align:center">' + u + '</b><button type="button" class="sbl-btn" data-m="' + id + '" data-d="1" style="margin:0;padding:3px 9px"' + (u >= have[id] ? ' disabled' : '') + '>＋</button></div>'; }).join('') : '<div style="color:#778;font-size:.84rem">素材がありません。ステージで敵を倒すと素材が手に入ります。</div>') + '</div></div>';
            m.body.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.m, d = +b.dataset.d; used[id] = Math.max(0, Math.min(mats()[id] | 0, (used[id] | 0) + d)); if (!used[id]) delete used[id]; draw(); }));
            const mk = m.body.querySelector('#kitMake'); if (mk) mk.addEventListener('click', () => {
                if (!ok) return;
                if (!confirm('選んだ素材 ' + kv.n + ' 個を使って、キットを作ります。よろしいですか？')) return;
                if (!takeMats(used)) { alert('素材が足りません。'); return; }
                const kit = HW.makeKit(hack, used, matInfo); if (!kit) { alert('キットを作れませんでした。'); return; }
                HW.save(hack); Object.keys(used).forEach(k => delete used[k]); draw();
            });
            m.body.querySelectorAll('[data-kit]').forEach(b => b.addEventListener('click', () => openCreate(hack, b.dataset.kit, () => { draw(); })));
        }
        draw();
    }

    // ============================================================
    // 2. キットから武器を作る
    // ============================================================
    function openCreate(hack, kitId, onDone) {
        const kit = (hack.kits || []).find(k => k.id === kitId); if (!kit) return;
        const types = HW.availableTypes(hack);
        let type = types.indexOf('sword') >= 0 ? 'sword' : types[0], name = '', els = [], ed = null;
        const m = L().modal('✨ 武器を作る', null);
        m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%"></div>'; const box = m.body.firstChild;
        function frame() {
            box.innerHTML = '<div style="font-size:.84rem;color:#9fb3d9">素材の偏り：' + biasChips(kit.bias) + '　最初はノーマルの武器です。素材を与えて成長させ、上限まで育ったらお金でレア度を上げていきます。</div>' +
                '<div class="sbl-sec">武器の種類（攻撃の仕方が変わります）</div><select id="ocType" style="padding:5px;max-width:100%">' + types.map(t => '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' + esc(HW.TYPES[t].label) + '</option>').join('') + '</select>' +
                '<div class="sbl-sec">名前（' + HW.FORGE_NAME_MAX + '文字まで）</div><input id="ocName" type="text" maxlength="' + HW.FORGE_NAME_MAX + '" placeholder="例：勇者の剣" value="' + esc(name) + '" style="width:100%;box-sizing:border-box;padding:6px">' +
                (global.SBElem ? '<div class="sbl-sec">属性（任意・最大2つ）</div><div id="ocEl" style="display:flex;flex-wrap:wrap;gap:4px">' + SBElem.ORDER.map(id => { const e = SBElem.ELEMS[id], on = els.indexOf(id) >= 0; return '<button type="button" data-el="' + id + '" class="sbl-btn ' + (on ? '' : 'gray') + '" style="margin:0;padding:4px 9px;font-size:.8rem">' + esc(e.icon || '') + esc(e.label || id) + '</button>'; }).join('') + '</div>' : '') +
                '<div class="sbl-sec">見た目（ドット絵を自分で描く）と、攻撃エフェクトの色</div><div id="ocPx"></div>' +
                '<div style="margin-top:10px"><button type="button" class="sbl-btn orange" id="ocGo">この武器を作る</button><button type="button" class="sbl-btn gray" id="ocCancel">やめる</button></div><div id="ocMsg" style="font-size:.82rem;color:#ff9a9a;margin-top:4px"></div>';
            ed = pixelEditor(box.querySelector('#ocPx'), null, type);
            box.querySelector('#ocType').addEventListener('change', e => { type = e.target.value; name = box.querySelector('#ocName').value; if (ed) ed.setType(type); });
            box.querySelector('#ocName').addEventListener('input', e => { name = e.target.value; });
            box.querySelectorAll('#ocEl [data-el]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.el, i = els.indexOf(id); if (i >= 0) els.splice(i, 1); else { els.push(id); if (els.length > 2) els.shift(); } b.parentNode.querySelectorAll('[data-el]').forEach(x => { x.classList.toggle('gray', els.indexOf(x.dataset.el) < 0); }); }));
            box.querySelector('#ocCancel').addEventListener('click', () => m.close());
            box.querySelector('#ocGo').addEventListener('click', () => {
                const msg = box.querySelector('#ocMsg'); name = box.querySelector('#ocName').value; const clean = HW.cleanName(name);
                if (clean) { const v = (typeof global.validateName === 'function') ? global.validateName(clean) : { valid: true }; if (!v.valid) { msg.textContent = v.reason; return; } }
                if (hack.weapons.length >= HW.STORAGE_LIMIT) { msg.textContent = '武器庫がいっぱいです。不要な武器を売却してください。'; return; }
                const pix = ed.pix(); if (!pix) { msg.textContent = '見た目の絵を描いてください（何も描かれていません）。'; return; }
                if (!confirm((clean || 'オリジナル' + HW.TYPES[type].label) + ' を作ります（キットを1つ使います）。よろしいですか？')) return;
                const w = HW.forgeFromKit(hack, kitId, { type: type, name: clean, elems: els.slice(), pix: pix, fxColor: ed.fx(), size: ed.size() });
                if (!w) { msg.textContent = 'この武器種は、まだ作れません。'; return; }
                hack.weapons.push(w); HW.save(hack); m.close(); if (onDone) onDone(w);
                try { alert('「' + w.name + '」ができました！ 武器庫の「⚒ 工房」で、素材を与えて育てましょう。'); } catch (e) { /* 通知できなくても作成は完了 */ }
            });
        }
        frame();
    }

    // ============================================================
    // 3. 工房（成長・見た目・レア度アップ）
    // ============================================================
    function openWorkshop(hack, w, onChange) {
        if (!L() || !w || !w.custom) return;
        HW.ensureGrowth(w);
        const m = L().modal('⚒ 工房　' + w.name, () => { if (onChange) onChange(); });
        function fxList() { return (w.effects || []).length ? w.effects.map(f => '<div class="sbl-fx">◆ ' + esc(HW.describeEffect(f)) + '</div>').join('') : '<div class="sbl-fx" style="color:#778">なし</div>'; }
        function draw() {
            const inf = HW.rankUpInfo(w), R = RC(w.rarity), cap = HW.growCap(w), exp = w.exp || 0, pc = Math.min(100, Math.round(exp / cap * 100));
            const have = mats(), ids = Object.keys(have).filter(id => have[id] > 0 && matInfo(id)).sort((a, b) => (matInfo(b).rarity | 0) - (matInfo(a).rarity | 0));
            m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%"><div style="display:flex;gap:10px;align-items:center"><span id="wkIcon"></span><div><div style="font-weight:bold;color:' + R.color + '">' + esc(w.name) + '</div><div style="font-size:.82rem;color:#9fb3d9">[' + R.label + '] ' + esc((HW.TYPES[w.type] || {}).label || w.type) + '　攻撃力 ' + HW.pctLabel(w) + '</div></div></div>' +
                '<div class="sbl-sec">成長（' + R.label + 'の上限まで）</div><div style="background:#10131c;border-radius:8px;overflow:hidden;height:16px;border:1px solid #2b3550"><div style="height:100%;width:' + pc + '%;background:linear-gradient(90deg,#3a6ee8,#7fd13b)"></div></div><div style="font-size:.8rem;color:#9fb3d9">経験値 ' + exp + ' / ' + cap + '（' + pc + '%）　付きやすい効果：' + biasChips(w.bias) + '</div>' +
                '<div class="sbl-sec">特殊効果</div>' + fxList() +
                (w.anvil ? '<div class="sbl-sec">⚠ 金床の作業の途中です</div><button type="button" class="sbl-btn orange" id="wkResume">🔨 金床に戻る</button>' :
                    '<div style="margin-top:8px"><button type="button" class="sbl-btn" id="wkLook">🎨 見た目を描き直す（無料）</button>' + (w.rarity === 'mythic' ? '<button type="button" class="sbl-btn" id="wkMotion" style="background:#ff4fd8;color:#fff">🌟 神話の動きを作る（通常攻撃・必殺技）</button><button type="button" class="sbl-btn" id="wkAtk" style="background:#ff4fd8;color:#fff">🎯 通常攻撃を配置で作る</button>' : '') + (inf.ok ? '<button type="button" class="sbl-btn orange" id="wkRank"' + (inf.ready ? '' : ' disabled style="opacity:.5"') + '>🔨 ' + RC(inf.next).label + 'へ（金床・' + num(inf.cost) + 'コイン）</button>' : '') + '</div>' +
                    (inf.ok && !inf.ready ? '<div style="font-size:.78rem;color:#9fb3d9">成長が上限になると、お金で次のレア度へ進めます。</div>' : '') +
                    '<div class="sbl-sec">素材を与えて成長させる（与えた素材の系統で、次のレア度の効果が付きやすくなります）</div>' +
                    (exp >= cap ? '<div style="color:#7aff9a;font-size:.84rem">上限まで成長しました。' + (inf.ok ? 'レア度アップができます。' : '') + '</div>' : (ids.length ? ids.map(id => { const mi = matInfo(id), e1 = HW.expOfMaterial(mi), need = Math.ceil((cap - exp) / e1), mx = Math.min(have[id], need); return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #232a3d;font-size:.84rem"><span style="flex:1;min-width:0">' + esc(mi.name) + ' <small style="color:#9fb3d9">★' + mi.rarity + '　+' + e1 + 'EXP</small><br>' + tagChips(HW.matTags(mi), true) + '</span><span style="color:#9fb3d9">所持' + have[id] + '</span><button type="button" class="sbl-btn" data-f="' + id + '" data-n="1" style="margin:0;padding:4px 9px">×1</button>' + (mx > 1 ? '<button type="button" class="sbl-btn green" data-f="' + id + '" data-n="' + mx + '" style="margin:0;padding:4px 9px">×' + mx + '</button>' : '') + '</div>'; }).join('') : '<div style="color:#778;font-size:.84rem">素材がありません。ステージで素材を集めましょう。</div>'))) + '</div>';
            m.body.querySelector('#wkIcon').appendChild(iconCanvas(w, 72));
            const lk = m.body.querySelector('#wkLook'); if (lk) lk.addEventListener('click', () => openLook(hack, w, draw));
            const mo = m.body.querySelector('#wkMotion'); if (mo) mo.addEventListener('click', () => openMotion(hack, w, draw));
            const ak = m.body.querySelector('#wkAtk'); if (ak) ak.addEventListener('click', () => openAtk(hack, w, draw));
            const rk = m.body.querySelector('#wkRank'); if (rk) rk.addEventListener('click', () => { if (!rk.disabled) openRankMode(hack, w, draw); });
            const rs = m.body.querySelector('#wkResume'); if (rs) rs.addEventListener('click', () => openAnvil(hack, w, draw));
            m.body.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
                const id = b.dataset.f, n = +b.dataset.n; if (!takeMats(Object.fromEntries([[id, n]]))) { alert('素材が足りません。'); return; }
                const r = HW.feedMaterial(w, matInfo(id), n); if (!r) { alert('いまは素材を与えられません。'); return; }
                const back = n - (r.used || 0); if (back > 0) { const p = player(); if (p) { p.materials = p.materials || {}; p.materials[id] = (p.materials[id] | 0) + back; savePlayer(p); } }      // 上限を超えた分は返す
                HW.save(hack); draw();
            }));
        }
        draw();
    }
    function openLook(hack, w, onDone) {
        const m = L().modal('🎨 見た目を描き直す　' + w.name, null);
        m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%"><div id="lkPx"></div><div style="margin-top:8px"><button type="button" class="sbl-btn orange" id="lkSave">この見た目にする</button><button type="button" class="sbl-btn gray" id="lkCancel">やめる</button></div><div id="lkMsg" style="font-size:.82rem;color:#ff9a9a"></div></div>';
        const ed = pixelEditor(m.body.querySelector('#lkPx'), { pix: w.pix, fxColor: w.fxColor, size: w.size }, w.type);
        m.body.querySelector('#lkCancel').addEventListener('click', () => m.close());
        m.body.querySelector('#lkSave').addEventListener('click', () => {
            const px = ed.pix(); if (!px) { m.body.querySelector('#lkMsg').textContent = '何も描かれていません。'; return; }
            if (!HW.setLook(w, { pix: px, fxColor: ed.fx(), size: ed.size() })) { m.body.querySelector('#lkMsg').textContent = '保存できませんでした。'; return; }
            HW.save(hack); m.close(); if (onDone) onDone();
        });
    }


    // ============================================================
    // 配置で作る通常攻撃（神話）：近接と遠距離の攻撃を、狙った向きのまわりに自由に置く。
    //   置くほど、1個あたりの威力は下がる（合計は一定に近い）。遠距離の弾は、1個ずつ16×16のドット絵を自分で描ける（絵の「右」が飛ぶ向き）
    // ============================================================
    function texEditor(box, init, onOk, onCancel) {
        const N = HW.TEX_SIZE, CH = HW.PIX_CHARS, HEXC = /^#[0-9a-fA-F]{6}$/, cell = 13;
        const st = { grid: [], pal: PALETTE0.slice(), cur: 10, tool: 'pen', undo: [] };
        const blank = () => { const g = []; for (let y = 0; y < N; y++) g.push(new Array(N).fill(-1)); return g; };
        st.grid = blank();
        const c0 = init ? HW.cleanPix(init) : null;
        if (c0) { const idx = {}; CH.split('').forEach((ch, i) => { if (c0.pal[ch]) { st.pal[i] = c0.pal[ch]; idx[ch] = i; } }); c0.rows.forEach((r, y) => { for (let x = 0; x < r.length && x < N && y < N; x++) if (r[x] !== '.' && idx[r[x]] != null) st.grid[y][x] = idx[r[x]]; }); }
        box.innerHTML = '<div style="font-size:.8rem;color:#9fb3d9;margin-bottom:4px">弾の絵（16×16）。絵の「右」が、飛んでいく向きです。</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start"><canvas id="txCv" width="' + N * cell + '" height="' + N * cell + '" style="touch-action:none;border:2px solid #3a4666;border-radius:6px;background:#10131c;max-width:100%"></canvas>' +
            '<div style="flex:1;min-width:170px"><div id="txPal" style="display:grid;grid-template-columns:repeat(8,1fr);gap:3px;max-width:240px"></div>' +
            '<div style="margin:5px 0"><input type="color" id="txCol" value="#ffffff" style="width:44px;height:30px;padding:0;border:1px solid #3a4666;background:#fff;vertical-align:middle"> <span style="font-size:.78rem;color:#9fb3d9">選んだ色を変える</span></div>' +
            '<div id="txTools" style="display:flex;flex-wrap:wrap;gap:3px"></div>' +
            '<div style="margin-top:6px"><button type="button" class="sbl-btn gray" id="txUndo" style="padding:5px 10px">↩ 戻す</button><button type="button" class="sbl-btn gray" id="txClear" style="padding:5px 10px">全消し</button></div><div id="txImg"></div>' +
            '<div style="margin-top:6px;font-size:.8rem;color:#9fb3d9">飛ぶようす</div><canvas id="txPv" width="170" height="44" style="background:#10131c;border:1px solid #3a4666;border-radius:6px"></canvas></div></div>' +
            '<div style="margin-top:8px"><button type="button" class="sbl-btn orange" id="txOk">この絵にする</button><button type="button" class="sbl-btn gray" id="txNo">やめる</button> <span id="txMsg" style="font-size:.8rem;color:#ff9a9a"></span></div>';
        const cv = box.querySelector('#txCv'), g = cv.getContext('2d'), pv = box.querySelector('#txPv'), pg = pv.getContext('2d');
        function toPix() {
            const rows = st.grid.map(r => r.map(i => i < 0 ? '.' : CH[i]).join('')), pal = {};
            CH.split('').forEach((ch, i) => { pal[ch] = HEXC.test(st.pal[i]) ? st.pal[i].toLowerCase() : '#ffffff'; });
            return HW.cleanPix({ rows: rows, pal: pal, grip: 0, s: 1 });
        }
        function preview() {
            pg.clearRect(0, 0, pv.width, pv.height); const px = toPix(); if (!px || !SBPix.prepTex) return;
            const sp = SBPix.prepTex(px); for (let i = 0; i < 4; i++) SBPix.drawTex(pg, sp, 30 + i * 36, 22, 0, 2);
        }
        function render() {
            g.fillStyle = '#161a26'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#1b2030';
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2) g.fillRect(x * cell, y * cell, cell, cell);
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = st.grid[y][x]; if (i >= 0) { g.fillStyle = st.pal[i]; g.fillRect(x * cell, y * cell, cell, cell); } }
            g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath(); for (let k = 0; k <= N; k++) { g.moveTo(k * cell + .5, 0); g.lineTo(k * cell + .5, N * cell); g.moveTo(0, k * cell + .5); g.lineTo(N * cell, k * cell + .5); } g.stroke();
            g.strokeStyle = 'rgba(255,90,90,.5)'; g.beginPath(); g.moveTo(N * cell - 6, N * cell / 2 - 5); g.lineTo(N * cell - 1, N * cell / 2); g.lineTo(N * cell - 6, N * cell / 2 + 5); g.stroke();      // 右向きの目印
            preview();
        }
        function palUi(keep) {
            const pe = box.querySelector('#txPal');
            pe.innerHTML = st.pal.map((c, i) => '<button type="button" data-i="' + i + '" style="height:24px;border-radius:5px;border:2px solid ' + (i === st.cur && st.tool !== 'erase' ? '#ffd84a' : '#2b3550') + ';background:' + c + ';cursor:pointer"></button>').join('');
            pe.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { st.cur = +b.dataset.i; if (st.tool === 'erase') st.tool = 'pen'; palUi(); toolUi(); }));
            const ci = box.querySelector('#txCol'); if (!keep && ci.value !== st.pal[st.cur]) ci.value = st.pal[st.cur];
        }
        const TOOLS = [['pen', '✏ 鉛筆'], ['erase', '🧽 消しゴム'], ['fill', '🪣 塗りつぶし']];
        function toolUi() { const te = box.querySelector('#txTools'); te.innerHTML = TOOLS.map(t => '<button type="button" data-t="' + t[0] + '" class="sbl-btn ' + (st.tool === t[0] ? '' : 'gray') + '" style="padding:5px 9px;margin:0;font-size:.8rem">' + t[1] + '</button>').join(''); te.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { st.tool = b.dataset.t; cv.style.cursor = st.tool === 'hand' ? 'grab' : 'crosshair'; palUi(); toolUi(); })); }
        const snap = () => { st.undo.push(JSON.stringify(st.grid)); if (st.undo.length > 25) st.undo.shift(); };
        function fill(x, y, v) { const t = st.grid[y][x]; if (t === v) return; const stack = [[x, y]]; let n = 0; while (stack.length && n++ < N * N * 4) { const p = stack.pop(), px = p[0], py = p[1]; if (px < 0 || px >= N || py < 0 || py >= N || st.grid[py][px] !== t) continue; st.grid[py][px] = v; stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]); } }
        const at = ev => { const r = cv.getBoundingClientRect(); return [Math.floor((ev.clientX - r.left) * cv.width / r.width / cell), Math.floor((ev.clientY - r.top) * cv.height / r.height / cell)]; };
        let down = false;
        function act(ev, first) { const p = at(ev), x = p[0], y = p[1]; if (x < 0 || x >= N || y < 0 || y >= N) return; if (st.tool === 'fill') { if (first) { snap(); fill(x, y, st.cur); render(); } return; } st.grid[y][x] = st.tool === 'erase' ? -1 : st.cur; render(); }
        cv.addEventListener('pointerdown', ev => { ev.preventDefault(); down = true; try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* 対応していない端末でも描ける */ } if (st.tool !== 'fill') snap(); act(ev, true); });
        cv.addEventListener('pointermove', ev => { if (down && st.tool !== 'fill') act(ev, false); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => cv.addEventListener(n, () => { down = false; }));
        const setCol = v => { if (!HEXC.test(v || '')) return; st.pal[st.cur] = v.toLowerCase(); palUi(true); render(); };
        const ce = box.querySelector('#txCol'); ce.addEventListener('input', e => setCol(e.target.value)); ce.addEventListener('change', e => setCol(e.target.value));
        box.querySelector('#txUndo').addEventListener('click', () => { const t = st.undo.pop(); if (t) { st.grid = JSON.parse(t); render(); } });
        box.querySelector('#txClear').addEventListener('click', () => { snap(); st.grid = blank(); render(); });
        box.querySelector('#txNo').addEventListener('click', () => onCancel());
        box.querySelector('#txOk').addEventListener('click', () => { const px = toPix(); if (!px) { box.querySelector('#txMsg').textContent = '何も描かれていません。'; return; } onOk(px); });
        imageImport(box.querySelector('#txImg'), N, N, CH.length, r => { snap(); st.grid = r.grid; st.pal = PALETTE0.slice(); r.pal.forEach((c, i) => { st.pal[i] = c; }); st.cur = 0; palUi(); render(); }, '画像の「右」が、飛んでいく向きになります。');
        palUi(); toolUi(); render();
    }

    function openAtk(hack, w, onDone) {
        const base = HW.cleanMotion(w.motion) || HW.defaultMotion(), cur = base.atk || { cd: 1, units: [], tex: [] }, RCol = w.fxColor || RC(w.rarity).color, MAXU = HW.ATK_MAX_UNITS;
        const st = { cd: cur.cd, units: JSON.parse(JSON.stringify(cur.units)), tex: JSON.parse(JSON.stringify(cur.tex)), sel: cur.units.length ? 0 : -1 };
        const m = L().modal('🎯 通常攻撃を配置で作る　' + w.name, null), CX = 160, CY = 120;
        m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%"><div id="atMain">' +
            '<div style="font-size:.82rem;line-height:1.6;color:#cfe0ff">近接の斬撃と遠距離の弾を、狙った向き（→）のまわりに自由に置けます。<b>置くほど、1個あたりの威力は下がります</b>（合計はほぼ一定）。弾は1個ずつ、自分で描いた絵で飛ばせます。置かずに保存すると、段ごとのコンボに戻ります。</div>' +
            '<canvas id="atCv" width="320" height="240" style="touch-action:none;background:#10131c;border:1px solid #3a4666;border-radius:8px;max-width:100%;margin-top:6px"></canvas>' +
            '<div style="font-size:.76rem;color:#9fb3d9">図の上をタップ／なぞると、選んだ攻撃の向きが変わります。</div>' +
            '<div style="margin:6px 0"><button type="button" class="sbl-btn" id="atAddM" style="margin:0 4px 0 0">＋近接を置く</button><button type="button" class="sbl-btn" id="atAddR" style="margin:0 4px 0 0">＋遠距離を置く</button><button type="button" class="sbl-btn gray" id="atDel" style="margin:0">🗑 消す</button></div>' +
            '<div id="atChips" style="margin-bottom:4px"></div><div id="atPanel"></div>' +
            '<div style="font-size:.8rem;margin-top:6px">攻撃の間隔（長いほど、合計の威力は大きい） <input type="range" id="atCd" min="0.8" max="2" step="0.1" value="' + st.cd + '" style="width:45%;vertical-align:middle"> <b id="atCdv">' + st.cd + '</b></div>' +
            '<div id="atSum" style="font-size:.8rem;line-height:1.6;margin-top:6px;color:#cfe0ff"></div>' +
            '<div id="atMsg" style="font-size:.82rem;color:#ff9a9a;min-height:1.2em"></div><div style="margin-top:6px"><button type="button" class="sbl-btn orange" id="atSave">この配置にする</button><button type="button" class="sbl-btn gray" id="atCancel">やめる</button></div></div>' +
            '<div id="atTexBox" style="display:none"></div></div>';
        const $ = s => m.body.querySelector(s), cv = $('#atCv'), g = cv.getContext('2d');
        const texSprite = u => { const t = u.kind === 'ranged' && u.tx >= 0 && st.tex[u.tx]; const c = t && HW.cleanPix(t); return c && SBPix.prepTex ? SBPix.prepTex(c) : null; };
        function draw() {
            g.clearRect(0, 0, 320, 240); g.fillStyle = '#10131c'; g.fillRect(0, 0, 320, 240);
            g.strokeStyle = '#2b3550'; g.lineWidth = 1; g.beginPath(); g.arc(CX, CY, 100, 0, 7); g.stroke();
            g.strokeStyle = '#3a4666'; g.beginPath(); g.moveTo(CX, CY); g.lineTo(CX + 118, CY); g.moveTo(CX + 108, CY - 5); g.lineTo(CX + 118, CY); g.lineTo(CX + 108, CY + 5); g.stroke();
            g.fillStyle = '#778'; g.font = '11px sans-serif'; g.fillText('狙う向き', CX + 70, CY - 8);
            st.units.forEach((u, i) => {
                const a = u.da * Math.PI / 180, col = u.col || RCol, sel = i === st.sel;
                if (u.kind === 'melee') {
                    const R = 30 + 50 * u.r;
                    g.beginPath(); g.moveTo(CX, CY); g.arc(CX, CY, R, a - u.arc / 2, a + u.arc / 2); g.closePath();
                    g.globalAlpha = 0.35; g.fillStyle = col; g.fill(); g.globalAlpha = 1; g.strokeStyle = sel ? '#ffd84a' : col; g.lineWidth = sel ? 3 : 1.5; g.stroke();
                } else {
                    const len = 40 + (u.rg - 250) / 650 * 60, x = CX + Math.cos(a) * len, y = CY + Math.sin(a) * len, ts = texSprite(u);
                    g.strokeStyle = sel ? '#ffd84a' : col; g.lineWidth = sel ? 3 : 1.5; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(CX + Math.cos(a) * u.d0 * 0.5, CY + Math.sin(a) * u.d0 * 0.5); g.lineTo(x, y); g.stroke(); g.setLineDash([]);
                    if (ts && SBPix.drawTex) SBPix.drawTex(g, ts, x, y, a, Math.max(1, Math.round(2 * u.sz))); else { g.fillStyle = col; g.beginPath(); g.arc(x, y, 5 + 4 * u.sz, 0, 7); g.fill(); }
                }
                g.fillStyle = sel ? '#ffd84a' : '#cfe0ff'; g.font = 'bold 12px sans-serif'; g.fillText(String(i + 1), CX + Math.cos(a) * 112 - 4, CY + Math.sin(a) * 112 + 4);
            });
            g.fillStyle = '#4a7fe8'; g.beginPath(); g.arc(CX, CY, 10, 0, 7); g.fill();
        }
        function sum() {
            const el = $('#atSum'), a = HW.cleanAtk({ cd: st.cd, units: st.units, tex: st.tex });
            if (!a) { el.innerHTML = '<span style="color:#778">まだ攻撃を置いていません。</span>'; return; }
            const P = HW.atkPlan(a);
            el.innerHTML = '置いた数：<b>' + P.n + '</b> / ' + MAXU + '　1回の通常攻撃の威力の合計：<b>×' + P.total + '</b>（1個だけのとき ×' + P.single + '）<br>1個あたり：' + P.per.map((v, i) => '<span style="margin-right:8px">' + (i + 1) + '番 ×' + v + '（' + Math.round(100 * v / P.single) + '%）</span>').join('');
        }
        function chips() {
            $('#atChips').innerHTML = st.units.map((u, i) => '<button type="button" data-i="' + i + '" class="sbl-btn ' + (i === st.sel ? '' : 'gray') + '" style="margin:0 3px 3px 0;padding:3px 9px;font-size:.78rem">' + (i + 1) + (u.kind === 'melee' ? ' 近' : ' 遠') + '</button>').join('');
            $('#atChips').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { st.sel = +b.dataset.i; refresh(); }));
            $('#atAddM').disabled = $('#atAddR').disabled = st.units.length >= MAXU; $('#atDel').disabled = st.sel < 0;
        }
        const row = (lab, f, lo, hi, step, v) => '<div style="display:flex;align-items:center;gap:6px;font-size:.8rem;margin:2px 0"><span style="width:8.2em">' + lab + '</span><input type="range" data-f="' + f + '" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + v + '" style="flex:1"><b data-v="' + f + '" style="width:3.2em;text-align:right">' + v + '</b></div>';
        function panel() {
            const pe = $('#atPanel'), u = st.units[st.sel];
            if (!u) { pe.innerHTML = ''; return; }
            const colRow = '<div style="font-size:.8rem;margin:3px 0">' + (u.kind === 'melee' ? '斬撃の色' : '弾の色（絵が無いとき）') + ' <input type="color" data-c="col" value="' + (u.col || RCol) + '" style="width:34px;height:24px;padding:0;border:1px solid #3a4666;background:#fff;vertical-align:middle">' + (u.col ? ' <button type="button" class="sbl-btn gray" data-a="nocol" style="padding:1px 7px;margin:0">武器の色に戻す</button>' : '<small style="color:#778">（武器の色）</small>') + '</div>';
            let h = '<div class="sbl-card" style="margin:4px 0"><b style="color:#ffd84a">' + (st.sel + 1) + '番：' + (u.kind === 'melee' ? '近接（斬撃）' : '遠距離（弾）') + '</b>' +
                row('向き（度）', 'da', -180, 180, 5, u.da) + row('威力の配分', 'w', 1, 5, 1, u.w) + row('出るまでの間（秒）', 'dl', 0, 0.5, 0.05, u.dl);
            if (u.kind === 'melee') h += row('届く距離', 'r', 0.6, 1.6, 0.1, u.r) + row('斬る幅', 'arc', 0.4, 2.4, 0.1, u.arc);
            else h += row('弾の速さ', 'sp', 300, 1000, 50, u.sp) + row('射程', 'rg', 250, 900, 50, u.rg) + row('弾の大きさ', 'sz', 0.5, 2, 0.1, u.sz) + row('出る位置（前へ）', 'd0', 0, 60, 5, u.d0) +
                '<div style="font-size:.8rem;margin:4px 0"><button type="button" class="sbl-btn" data-a="tex" style="margin:0 4px 0 0">🎨 ' + (u.tx >= 0 ? '弾の絵を描き直す' : '弾の絵を描く') + '</button>' + (u.tx >= 0 ? '<button type="button" class="sbl-btn gray" data-a="notex" style="margin:0">絵を外す</button>' : '') + '</div>';
            pe.innerHTML = h + colRow + '</div>';
            pe.querySelectorAll('input[data-f]').forEach(inp => inp.addEventListener('input', () => { u[inp.dataset.f] = +inp.value; const b = pe.querySelector('[data-v="' + inp.dataset.f + '"]'); if (b) b.textContent = inp.value; draw(); sum(); }));
            const ci = pe.querySelector('input[data-c]'); if (ci) { const fn = e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) { u.col = e.target.value.toLowerCase(); draw(); } }; ci.addEventListener('input', fn); ci.addEventListener('change', fn); }
            pe.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
                if (b.dataset.a === 'nocol') { u.col = ''; refresh(); }
                else if (b.dataset.a === 'notex') { u.tx = -1; refresh(); }
                else if (b.dataset.a === 'tex') {
                    $('#atMain').style.display = 'none'; const tb = $('#atTexBox'); tb.style.display = '';
                    const back = () => { tb.style.display = 'none'; tb.innerHTML = ''; $('#atMain').style.display = ''; refresh(); };
                    texEditor(tb, u.tx >= 0 ? st.tex[u.tx] : null, px => { if (u.tx >= 0 && st.tex[u.tx]) st.tex[u.tx] = px; else { st.tex.push(px); u.tx = st.tex.length - 1; } back(); }, back);
                }
            }));
        }
        function refresh() { draw(); sum(); chips(); panel(); }
        const add = kind => {
            if (st.units.length >= MAXU) return;
            st.units.push(kind === 'melee' ? { kind: 'melee', da: 0, w: 1, dl: 0, r: 1, arc: 1.2, col: '' } : { kind: 'ranged', da: 0, w: 1, dl: 0, sp: 640, rg: 520, sz: 1, d0: 0, tx: -1, col: '' });
            st.sel = st.units.length - 1; refresh();
        };
        $('#atAddM').addEventListener('click', () => add('melee')); $('#atAddR').addEventListener('click', () => add('ranged'));
        $('#atDel').addEventListener('click', () => { if (st.sel < 0) return; st.units.splice(st.sel, 1); st.sel = st.units.length ? Math.min(st.sel, st.units.length - 1) : -1; refresh(); });
        $('#atCd').addEventListener('input', e => { st.cd = +e.target.value; $('#atCdv').textContent = e.target.value; sum(); });
        let drag = false;
        const ang = ev => { const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * 320 / r.width - CX, y = (ev.clientY - r.top) * 240 / r.height - CY; return Math.atan2(y, x) * 180 / Math.PI; };
        const setDa = ev => { const u = st.units[st.sel]; if (!u) return; u.da = Math.max(-180, Math.min(180, Math.round(ang(ev) / 5) * 5)); const inp = m.body.querySelector('input[data-f="da"]'); if (inp) inp.value = u.da; const b = m.body.querySelector('[data-v="da"]'); if (b) b.textContent = u.da; draw(); };
        cv.addEventListener('pointerdown', ev => {
            ev.preventDefault(); const p = ang(ev); let best = -1, bd = 18;
            st.units.forEach((u, i) => { let d = Math.abs(((p - u.da + 540) % 360) - 180); if (d < bd) { bd = d; best = i; } });      // 置いた攻撃の近くをタップしたら、その攻撃を選ぶ
            if (best >= 0 && best !== st.sel) { st.sel = best; refresh(); } else { drag = true; try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* 対応していない端末でも使える */ } setDa(ev); }
        });
        cv.addEventListener('pointermove', ev => { if (drag) setDa(ev); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => cv.addEventListener(n, () => { if (drag) { drag = false; panel(); } }));
        $('#atCancel').addEventListener('click', () => m.close());
        $('#atSave').addEventListener('click', () => {
            const used = [], map = {};      // 使っていない絵を捨てて、番号をつめる
            const units = st.units.map(u => { const c = Object.assign({}, u); if (c.kind === 'ranged' && c.tx >= 0 && st.tex[c.tx]) { if (!(c.tx in map)) { map[c.tx] = used.length; used.push(st.tex[c.tx]); } c.tx = map[c.tx]; } else if (c.kind === 'ranged') c.tx = -1; return c; });
            if (!HW.setAtk(w, units.length ? { cd: st.cd, units: units, tex: used } : null)) { $('#atMsg').textContent = '保存できませんでした。'; return; }
            HW.save(hack); m.close(); if (onDone) onDone();
        });
        refresh();
    }

    // ============================================================
    // 神話の動きを作る：通常攻撃のコンボ（1〜6段）と、必殺技（最大4つの型をつなげる）。剣が分身して攻撃する動きも作れる
    //   威力は自動で釣り合わせる（hw-weapons.js の motionCombo / motionUlt）ので、配分と見た目を自由に決めればよい
    // ============================================================
    function openMotion(hack, w, onDone) {
        const base = HW.cleanMotion(w.motion) || HW.defaultMotion(), RCol = (w.fxColor || RC(w.rarity).color);
        const st = { combo: base.combo.map(s => JSON.parse(JSON.stringify(s))), ult: JSON.parse(JSON.stringify(base.ult)), tab: 'combo', open: 0 };
        let raf = 0;
        const stopPv = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
        const m = L().modal('🌟 神話の動きを作る　' + w.name, () => { stopPv(); if (onDone) onDone(); });
        const pc = (w.pix && global.SBPix && SBPix.prepCustom) ? SBPix.prepCustom(HW.cleanPix(w.pix)) : null;
        const SS = 'background:#10131c;color:#e6ecff;border:1px solid #3a4666;border-radius:5px;padding:3px';
        const sel = (attr, opts, cur) => '<select ' + attr + ' style="' + SS + '">' + opts.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
        const O = { w: [[1, '1 弱'], [2, '2'], [3, '3 中'], [4, '4'], [5, '5 強']], dir: [[1, '右まわり'], [-1, '左まわり']], r: [[0.8, '極小'], [0.9, '小'], [1, '標準'], [1.25, '大'], [1.5, '特大']], a: [[0.6, '細い'], [1, '標準'], [1.4, '広い'], [2, '全周に近い']], wd: [[0.6, '細い'], [1, '標準'], [1.5, '太い'], [2.2, '極太']],
            lunge: [[0, 'なし'], [14, '小'], [30, '中'], [50, '大']], cd: [[1, '速い'], [1.3, 'ふつう'], [1.7, 'ゆっくり'], [2, '長い']], kb: [[0, '武器どおり'], [120, '弱'], [240, '中'], [400, '強']], xs: [[0, '0'], [1, '+1'], [2, '+2'], [3, '+3'], [4, '+4'], [5, '+5']],
            bn: [[1, '1本'], [2, '2本'], [3, '3本'], [4, '4本']], bh: [[1, '1回'], [2, '2回'], [3, '3回'], [4, '4回']], bsz: [[0.8, '小'], [1, '標準'], [1.4, '大'], [2, '特大']], bsp: [[0.6, '遅い'], [1, '標準'], [1.4, '速い'], [1.6, '超速']],
            psz: [[0.7, '小'], [1, '標準'], [1.3, '大'], [1.6, '特大']], psp: [[0.6, 'ゆっくり'], [1, '標準'], [1.4, '速い'], [1.6, '超速']] };
        const near = (arr, v) => { let b = arr[0][0], d = 1e9; arr.forEach(o => { const x = Math.abs(o[0] - v); if (x < d) { d = x; b = o[0]; } }); return b; };
        const normNow = () => HW.motionCombo({ custom: true, rarity: 'mythic', motion: { combo: st.combo, ult: st.ult } }) || [];
        const modeOpts = [['', 'なし']].concat(Object.keys(HW.BLADE_MODES).map(k => [k, HW.BLADE_MODES[k]]));
        const shapeOpts = [['', '武器どおり']].concat(Object.keys(HW.SHAPES).map(k => [k, HW.SHAPES[k]]));
        function bladeHtml(i, key, label) {
            const bl = st.combo[i][key], at = 'data-i="' + i + '" data-g="' + key + '" ';
            return '<div style="margin-top:2px"><b style="color:#ff9ae8">' + label + '</b> ' + sel(at + 'data-f="bmode"', modeOpts, bl ? bl.mode : '') +
                (bl ? '<br>　' + sel(at + 'data-f="bn"', O.bn, bl.n) + ' ' + sel(at + 'data-f="bh"', O.bh, bl.hits) + ' 大きさ' + sel(at + 'data-f="bsz"', O.bsz, near(O.bsz, bl.sz)) + ' 速さ' + sel(at + 'data-f="bsp"', O.bsp, near(O.bsp, bl.sp)) : '') + '</div>';
        }
        function comboHtml() {
            const nm = normNow();
            return st.combo.map((s, i) => {
                const mm = nm[i] ? nm[i].m : 0;
                const chk = (f, label) => '<label style="margin-right:8px;white-space:nowrap"><input type="checkbox" data-i="' + i + '" data-f="' + f + '"' + (s[f] ? ' checked' : '') + '> ' + label + '</label>';
                const at = f => 'data-i="' + i + '" data-f="' + f + '"';
                return '<div class="sbl-card" style="margin:6px 0"><div style="display:flex;align-items:center;gap:6px"><b style="color:#ffd84a">' + (i + 1) + '段目</b><span style="font-size:.76rem;color:#9fb3d9">威力 ×' + (Math.round(mm * 100) / 100) + (s.fin ? '（フィニッシュ）' : '') + '</span><span style="flex:1"></span>' +
                    '<button type="button" class="sbl-btn gray" data-a="up" data-i="' + i + '" style="padding:2px 8px;margin:0">↑</button><button type="button" class="sbl-btn gray" data-a="dn" data-i="' + i + '" style="padding:2px 8px;margin:0">↓</button><button type="button" class="sbl-btn gray" data-a="del" data-i="' + i + '" style="padding:2px 8px;margin:0">🗑</button></div>' +
                    '<div style="font-size:.8rem;line-height:2.1;margin-top:4px"><b>攻撃の形</b> ' + sel(at('shape'), shapeOpts, s.shape) + '　色 <input type="color" ' + at('col') + ' value="' + (s.col || RCol) + '" style="width:34px;height:24px;padding:0;border:0;background:none;vertical-align:middle">' + (s.col ? ' <button type="button" class="sbl-btn gray" data-a="nocol" data-i="' + i + '" style="padding:1px 7px;margin:0">武器の色に戻す</button>' : '<small style="color:#778">（武器の色）</small>') + '<br>' +
                    '威力の配分 ' + sel(at('w'), O.w, s.w) + '　向き ' + sel(at('dir'), O.dir, s.dir) + '　範囲 ' + sel(at('r'), O.r, near(O.r, s.r)) + '　角度 ' + sel(at('a'), O.a, near(O.a, s.a)) + '　幅 ' + sel(at('wd'), O.wd, near(O.wd, s.wd)) + '<br>' +
                    '踏み込み ' + sel(at('lunge'), O.lunge, near(O.lunge, s.lunge)) + '　ふっとばし ' + sel(at('kb'), O.kb, near(O.kb, s.kb)) + '　次の攻撃までの間 ' + sel(at('cd'), O.cd, near(O.cd, s.cd)) + '　弾の増加 ' + sel(at('xs'), O.xs, s.xs) + '<br>' +
                    chk('fin', 'フィニッシュ（大きく振る）') + chk('wave', '剣気（前方に追撃）') + chk('quake', '衝撃波') + chk('heal', '当てると回復') + chk('homing', '弾が追尾') +
                    bladeHtml(i, 'blades', '分身の剣①') + bladeHtml(i, 'blades2', '分身の剣②') + '</div></div>';
            }).join('') + (st.combo.length < HW.MOTION_MAX_STEPS ? '<button type="button" class="sbl-btn" data-a="add">➕ 段を足す（最大 ' + HW.MOTION_MAX_STEPS + ' 段）</button>' : '');
        }
        function ultHtml() {
            const K = HW.ULT_KINDS, u = st.ult, totW = u.seq.reduce((a, p) => a + p.w, 0);
            const phases = u.seq.map((p, i) => {
                const kk = K[p.kind], at = f => 'data-pi="' + i + '" data-pf="' + f + '"';
                return '<div class="sbl-card" style="margin:6px 0"><div style="display:flex;align-items:center;gap:6px"><b style="color:#ffd84a">' + (i + 1) + '番目</b><span style="font-size:.76rem;color:#9fb3d9">威力の割合 ' + Math.round(100 * p.w / totW) + '%</span><span style="flex:1"></span>' +
                    '<button type="button" class="sbl-btn gray" data-pa="up" data-pi="' + i + '" style="padding:2px 8px;margin:0">↑</button><button type="button" class="sbl-btn gray" data-pa="dn" data-pi="' + i + '" style="padding:2px 8px;margin:0">↓</button><button type="button" class="sbl-btn gray" data-pa="del" data-pi="' + i + '" style="padding:2px 8px;margin:0">🗑</button></div>' +
                    '<div style="font-size:.8rem;line-height:2.1;margin-top:4px">型 ' + sel(at('kind'), Object.keys(K).map(k => [k, K[k].label + '：' + K[k].desc]), p.kind) + '<br>' +
                    '回数 <input type="range" ' + at('n') + ' min="' + kk.min + '" max="' + kk.max + '" value="' + p.n + '" style="width:40%;vertical-align:middle"> <b>' + p.n + kk.unit + '</b>　威力の配分 ' + sel(at('w'), O.w, p.w) + '<br>範囲・大きさ ' + sel(at('sz'), O.psz, near(O.psz, p.sz)) + '　速さ ' + sel(at('sp'), O.psp, near(O.psp, p.sp)) + '</div></div>';
            }).join('');
            return '<div style="font-size:.78rem;color:#9fb3d9;margin:4px 0">型を最大 ' + HW.ULT_MAX_PHASES + ' つ、順番につなげられます。必殺技1回の合計の威力は一定で、各型の配分で分け合います。</div>' + phases +
                (u.seq.length < HW.ULT_MAX_PHASES ? '<button type="button" class="sbl-btn" data-pa="add">➕ 型を足す</button>' : '') +
                '<div style="margin-top:8px;font-size:.84rem;line-height:2"><label style="margin-right:10px"><input type="checkbox" id="mtFin"' + (u.finale ? ' checked' : '') + '> 終幕の大爆発</label>' + (u.finale ? '大きさ ' + sel('id="mtFsz"', O.psz, near(O.psz, u.fsz)) : '') + '<br>' +
                '<label style="margin-right:10px"><input type="checkbox" id="mtHeal"' + (u.heal ? ' checked' : '') + '> 体力を回復する</label><label><input type="checkbox" id="mtGuard"' + (u.guard ? ' checked' : '') + '> 終わりに結界を張る</label></div>' +
                '<div style="margin-top:6px;font-size:.84rem">必殺技の名前：<input type="text" id="mtUname" maxlength="' + HW.FORGE_NAME_MAX + '" value="' + esc(u.name) + '" placeholder="（空なら自動で付きます）" style="background:#10131c;color:#e6ecff;border:1px solid #3a4666;border-radius:5px;padding:4px;width:55%"></div>';
        }
        function render() {
            const tabBtn = (id, label) => '<button type="button" class="sbl-btn ' + (st.tab === id ? '' : 'gray') + '" data-tab="' + id + '" style="margin:0 4px 6px 0">' + label + '</button>';
            m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%"><div style="font-size:.82rem;line-height:1.6;color:#cfe0ff">自分だけの動きを作れます。威力は自動で釣り合わせるので、派手にしても強くなりすぎません（決めるのは配分と見た目）。何度でも無料で作り直せます。</div>' + (base.atk ? '<div style="font-size:.8rem;color:#ffb06a;margin-top:4px">※「配置で作る通常攻撃」を設定中は、通常攻撃は配置のほうが使われ、下のコンボは使われません（必殺技は、ここの設定が使われます）。</div>' : '') +
                '<div style="margin-top:6px">' + tabBtn('combo', '⚔ 通常攻撃') + tabBtn('ult', '⚡ 必殺技') + '</div><div id="mtBody">' + (st.tab === 'combo' ? comboHtml() : ultHtml()) + '</div>' +
                '<div class="sbl-sec">プレビュー（動きのイメージ）</div><canvas id="mtPv" width="320" height="170" style="background:#10131c;border:1px solid #3a4666;border-radius:8px;max-width:100%"></canvas><div><button type="button" class="sbl-btn gray" id="mtPlay">▶ 再生</button></div>' +
                '<div id="mtMsg" style="font-size:.82rem;color:#ff9a9a;min-height:1.2em"></div><div style="margin-top:6px"><button type="button" class="sbl-btn orange" id="mtSave">この動きにする</button><button type="button" class="sbl-btn gray" id="mtCancel">やめる</button></div></div>';
            const q = (sel_, fn) => m.body.querySelectorAll(sel_).forEach(fn);
            q('[data-tab]', b => b.addEventListener('click', () => { st.tab = b.dataset.tab; render(); play(); }));
            q('[data-i][data-f]', el => el.addEventListener('change', () => onField(+el.dataset.i, el.dataset.f, el)));
            q('[data-a]', b => b.addEventListener('click', () => onAct(b.dataset.a, +b.dataset.i)));
            q('[data-pi][data-pf]', el => el.addEventListener(el.type === 'range' ? 'input' : 'change', () => onPhase(+el.dataset.pi, el.dataset.pf, el)));
            q('[data-pa]', b => b.addEventListener('click', () => onPAct(b.dataset.pa, +b.dataset.pi)));
            const bind = (id, ev, fn) => { const el = m.body.querySelector(id); if (el) el.addEventListener(ev, () => fn(el)); };
            bind('#mtFin', 'change', el => { st.ult.finale = el.checked; render(); }); bind('#mtFsz', 'change', el => { st.ult.fsz = +el.value; });
            bind('#mtHeal', 'change', el => { st.ult.heal = el.checked; }); bind('#mtGuard', 'change', el => { st.ult.guard = el.checked; }); bind('#mtUname', 'input', el => { st.ult.name = el.value; });
            m.body.querySelector('#mtPlay').addEventListener('click', play);
            m.body.querySelector('#mtCancel').addEventListener('click', () => m.close());
            m.body.querySelector('#mtSave').addEventListener('click', () => {
                if (!HW.setMotion(w, { combo: st.combo, ult: st.ult })) { m.body.querySelector('#mtMsg').textContent = '保存できませんでした。'; return; }
                HW.save(hack); m.close();
            });
        }
        function onField(i, f, el) {
            const s = st.combo[i]; if (!s) return;
            if (el.type === 'checkbox') { const c = el.checked; if (f === 'wave') s.wave = c ? 1.7 : 0; else if (f === 'quake') s.quake = c ? 140 : 0; else if (f === 'heal') s.heal = c ? 0.01 : 0; else s[f] = c; }
            else if (f === 'col') s.col = el.value;
            else if (f === 'shape') s.shape = el.value;
            else if (f === 'bmode') { const k = el.dataset.g, old = s[k]; s[k] = el.value ? { mode: el.value, n: (old && old.n) || 2, hits: (old && old.hits) || 2, sz: (old && old.sz) || 1, sp: (old && old.sp) || 1 } : null; }
            else if (f === 'bn' || f === 'bh' || f === 'bsz' || f === 'bsp') { const b = s[el.dataset.g]; if (b) b[{ bn: 'n', bh: 'hits', bsz: 'sz', bsp: 'sp' }[f]] = +el.value; }
            else s[f] = +el.value;
            render(); play();
        }
        function onAct(a, i) {
            if (a === 'add') { if (st.combo.length < HW.MOTION_MAX_STEPS) st.combo.push(HW.cleanMotion({ combo: [{ dir: st.combo.length % 2 ? -1 : 1 }], ult: {} }).combo[0]); }
            else if (a === 'del') { if (st.combo.length > 1) st.combo.splice(i, 1); }
            else if (a === 'nocol') { st.combo[i].col = ''; }
            else if (a === 'up' && i > 0) { const t = st.combo[i - 1]; st.combo[i - 1] = st.combo[i]; st.combo[i] = t; }
            else if (a === 'dn' && i < st.combo.length - 1) { const t = st.combo[i + 1]; st.combo[i + 1] = st.combo[i]; st.combo[i] = t; }
            render(); play();
        }
        function onPhase(i, f, el) {
            const p = st.ult.seq[i]; if (!p) return;
            if (f === 'kind') { p.kind = el.value; p.n = HW.ULT_KINDS[el.value].def; } else p[f] = +el.value;
            render(); if (f !== 'n') play();
        }
        function onPAct(a, i) {
            const sq = st.ult.seq;
            if (a === 'add') { if (sq.length < HW.ULT_MAX_PHASES) sq.push({ kind: 'quake', n: HW.ULT_KINDS.quake.def, w: 1, sz: 1, sp: 1 }); }
            else if (a === 'del') { if (sq.length > 1) sq.splice(i, 1); }
            else if (a === 'up' && i > 0) { const t = sq[i - 1]; sq[i - 1] = sq[i]; sq[i] = t; }
            else if (a === 'dn' && i < sq.length - 1) { const t = sq[i + 1]; sq[i + 1] = sq[i]; sq[i] = t; }
            render(); play();
        }
        // プレビュー：的に向かって、コンボ（または必殺技）を一度演じる。剣の分身は、実戦と同じ計算（blades.js）で動く
        function play() {
            stopPv(); const cv = m.body.querySelector('#mtPv'); if (!cv || !global.SBBlades) return; const g = cv.getContext('2d');
            const OX = 70, OY = 92, EX = 250, EY = 92, dummy = { x: EX, y: EY, r: 16, id: 1, hp: 999 };
            const nm = normNow(), ultMode = st.tab === 'ult';
            let t = 0, idx = 0, nextAt = 0.3, blades = [], flash = 0, fxs = [], swing = null, last = performance.now(), phIdx = 0, phAt = 0.3;
            const env = { targets: [dummy], hit: () => { flash = 0.12; } };
            const lookOf = col => ({ type: w.type, col: col || RCol, pc: pc });
            function frame(now) {
                const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; flash = Math.max(0, flash - dt);
                if (!ultMode) {
                    while (idx < nm.length && t >= nextAt) {
                        const s = nm[idx++], col = s.col || RCol; swing = { t: 0, dir: s.dir, r: s.r, a: s.a, fin: !!s.fin, col: col, shape: s.shape || '' };
                        if (s.wave) fxs.push({ k: 'line', t: 0, len: 150 * s.wave / 1.7, col: col }); if (s.quake) fxs.push({ k: 'ring', t: 0, max: s.quake * 0.55, col: col, at: 'o' });
                        [['blades', 'bm'], ['blades2', 'bm2']].forEach(p => { const b = s[p[0]]; if (b) blades = blades.concat(SBBlades.make({ mode: b.mode, n: b.n, hits: b.hits, cap: b.cap, sz: b.sz, sp: b.sp, bm: s[p[1]], a: 0, x: OX, y: OY, tg: [[EX, EY]], fin: s.fin }, lookOf(col), { targets: [dummy] })); });
                        flash = 0.1; nextAt = t + 0.45 * (s.cd || 1);
                    }
                } else {
                    const U = HW.motionUlt({ custom: true, rarity: 'mythic', motion: { combo: st.combo, ult: st.ult } }), subs = U ? (U.st === 'seq' ? U.phases : [U]) : [];
                    while (phIdx < subs.length && t >= phAt) {
                        const Q = subs[phIdx++], K = Q.st;
                        if (K === 'bladedance') blades = blades.concat(SBBlades.make({ mode: 'dance', n: Math.min(8, Q.n), hits: 1, bm: 0.1, sz: Q.sz || 1, a: 0, x: OX, y: OY, tg: [], life: 2.2 }, lookOf(), { targets: [dummy] }));
                        else { const cnt = Math.min(7, Math.max(3, Math.round((Q.n || Q.waves || Q.rep || 5) / 5))); for (let i = 0; i < cnt; i++) fxs.push({ k: (K === 'slash' || K === 'cross') ? (i % 2 ? 'x' : 'ring') : (K === 'volley' || K === 'meteor' ? 'shot' : (K === 'lance' ? 'line' : 'ring')), st: K, t: -i * 0.16, max: (K === 'nova' ? 130 : 80) * (Q.radius ? Q.radius / 240 : 1) + i * 8, len: 160, col: RCol, at: 'o' }); }
                        phAt = t + 1.4;
                    }
                }
                blades.forEach(b => SBBlades.step(b, dt, OX, OY, env)); blades = blades.filter(b => !b.dead);
                g.clearRect(0, 0, 320, 170); g.fillStyle = '#161a26'; g.fillRect(0, 124, 320, 46);
                g.fillStyle = flash > 0 ? '#ffffff' : '#c0505a'; g.beginPath(); g.arc(EX, EY, 16, 0, 7); g.fill();
                g.fillStyle = '#4a7fe8'; g.beginPath(); g.arc(OX, OY, 12, 0, 7); g.fill();
                let wa = 0.4;
                if (swing) {
                    swing.t += dt; const k = swing.t / 0.22;
                    if (k < 1) {
                        g.save(); g.globalAlpha = 1 - k; g.strokeStyle = swing.col; g.fillStyle = swing.col; g.lineWidth = swing.fin ? 9 : 6;
                        const sh = swing.shape;
                        if (sh === 'line') { g.beginPath(); g.moveTo(OX + 12, OY); g.lineTo(OX + 12 + 150 * swing.r * Math.min(1, k * 2.5), OY); g.stroke(); }
                        else if (sh === 'ring') { g.beginPath(); g.arc(OX, OY, 90 * swing.r * Math.min(1, k * 1.6), 0, 7); g.stroke(); }
                        else if (sh === 'smash') { g.globalAlpha *= 0.5; g.beginPath(); g.arc(OX + 70, OY, 60 * swing.r * Math.min(1, k * 1.6), 0, 7); g.fill(); }
                        else if (sh === 'proj') { g.beginPath(); g.arc(OX + 20 + (EX - OX - 20) * Math.min(1, k * 1.5), OY, 7, 0, 7); g.fill(); }
                        else { const half = Math.min(3, 1.0 * swing.a); g.beginPath(); g.arc(OX, OY, 48 * swing.r, swing.dir > 0 ? -half : half, swing.dir > 0 ? half : -half, swing.dir < 0); g.stroke(); }
                        g.restore(); wa = swing.dir * (-1.0 + 2.0 * Math.min(1, k));
                    } else swing = null;
                }
                try { SBPix.drawWeapon(g, OX + 8, OY + 3, wa, w.type, swing ? swing.col : RCol, { custom: pc, scale: 2 }); } catch (e) { g.strokeStyle = RCol; g.lineWidth = 3; g.beginPath(); g.moveTo(OX, OY); g.lineTo(OX + Math.cos(wa) * 34, OY + Math.sin(wa) * 34); g.stroke(); }
                fxs.forEach(f => { if (f.t < 0) { f.t += dt; return; } f.t += dt; const k = Math.min(1, f.t / 0.3); g.save(); g.globalAlpha = 1 - k; g.strokeStyle = f.col || RCol; g.fillStyle = f.col || RCol; g.lineWidth = 5;
                    if (f.k === 'ring') { g.beginPath(); g.arc(OX, OY, (f.max || 80) * k, 0, 7); g.stroke(); }
                    else if (f.k === 'line') { g.beginPath(); g.moveTo(OX + 20, OY); g.lineTo(OX + 20 + (f.len || 150) * Math.min(1, k * 2), OY); g.stroke(); }
                    else if (f.k === 'x') { g.beginPath(); g.moveTo(EX - 26, EY - 26); g.lineTo(EX + 26, EY + 26); g.moveTo(EX + 26, EY - 26); g.lineTo(EX - 26, EY + 26); g.stroke(); }
                    else if (f.k === 'shot') { const meteor = f.st === 'meteor'; g.beginPath(); g.arc(meteor ? EX - 20 + (f.max % 40) : OX + 20 + (EX - OX - 20) * k, meteor ? 10 + (EY - 10) * k : OY - 8 + (f.max % 16), 6, 0, 7); g.fill(); }
                    g.restore(); });
                fxs = fxs.filter(f => f.t < 0.6);
                blades.forEach(b => SBBlades.draw(g, b));
                const endT = ultMode ? Math.max(4.2, phAt + 1.2) : (nextAt + 1.8);
                if (t < endT) raf = requestAnimationFrame(frame); else raf = 0;
            }
            raf = requestAnimationFrame(frame);
        }
        render(); play();
    }

    // ---------- レア度アップ：やり方を選ぶ ----------
    function openRankMode(hack, w, onDone) {
        const inf = HW.rankUpInfo(w); if (!inf.ok || !inf.ready) return;
        const rn = RC(inf.next), nextR = HW.RARITIES[inf.next], curN = (w.effects || []).length, allTaps = Math.max(curN, nextR.fx[0]);
        const m = L().modal('🔨 ' + rn.label + 'へ', null);
        const enough = coins() >= inf.cost;
        m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%"><div style="font-size:.86rem;line-height:1.7">「' + esc(w.name) + '」を <b style="color:' + rn.color + '">' + rn.label + '</b> にします。必要なコイン：<b style="color:' + (enough ? '#7aff9a' : '#ff9a9a') + '">' + num(inf.cost) + '</b>（所持 ' + num(coins()) + '）<br>金床でハンマーを叩くたびに、効果が1つずつロールされます。素材で偏らせた系統の効果が出やすくなっています。</div>' +
            '<div class="sbl-sec">どちらにしますか？</div>' +
            '<div class="sbl-card" id="rmAll" style="cursor:pointer"><b>🎲 効果をすべて変える</b><small>いまの効果 ' + curN + ' 個をすべて捨てて、新しい効果にロールし直します（ハンマー ' + allTaps + ' 回）。</small></div>' +
            '<div class="sbl-card" id="rmAdd" style="cursor:pointer;' + (inf.canAdd ? '' : 'opacity:.45') + '"><b>➕ 効果をつけ足す</b><small>いまの効果は残して（レア度に合わせて少し強化）、新しい効果をロールして足します（最大 ' + inf.addMax + ' 個）。' + (inf.canAdd ? '' : '　⚠ いまは効果が上限なので、選べません。') + '</small></div>' +
            '<div id="rmMsg" style="font-size:.82rem;color:#ff9a9a;margin-top:6px"></div><div style="margin-top:8px"><button type="button" class="sbl-btn gray" id="rmCancel">やめる</button></div></div>';
        m.body.querySelector('#rmCancel').addEventListener('click', () => m.close());
        function go(mode) {
            const msg = m.body.querySelector('#rmMsg');
            if (mode === 'add' && !inf.canAdd) { msg.textContent = '効果が上限なので、つけ足せません。'; return; }
            if (coins() < inf.cost) { msg.textContent = 'コインが足りません。'; return; }
            if (global.SBCost && hack.equipped === w.id) { const r = SBCost.canEquip(hack, { patchWeapon: w, patch: { rarity: inf.next } }); if (!r.ok) { msg.textContent = '装備中の武器は、レア度を上げるとコストが上限を超えます（' + r.after.cost + ' / 上限 ' + r.after.cap + '）。いったん装備を外すか、ステータス合計（勉強）を上げてください。'; return; } }
            if (!confirm(rn.label + 'へ進めます（' + num(inf.cost) + ' コイン）。' + (mode === 'all' ? 'いまの効果はすべて変わります。' : '') + 'よろしいですか？')) return;
            const a = HW.startRankUp(w, mode); if (!a) { msg.textContent = '始められませんでした。'; return; }
            addCoins(-inf.cost); HW.save(hack); m.close(); openAnvil(hack, w, onDone);
        }
        m.body.querySelector('#rmAll').addEventListener('click', () => go('all'));
        m.body.querySelector('#rmAdd').addEventListener('click', () => go('add'));
    }

    // ---------- 金床：タップでハンマーを叩く ----------
    function injectAnvilStyle() {
        if (document.getElementById('sbAnvilStyle')) return;
        const st = document.createElement('style'); st.id = 'sbAnvilStyle';
        st.textContent = '.av-scene{position:relative;height:210px;background:radial-gradient(ellipse at 50% 85%,#3a2418 0,#171b26 70%);border-radius:12px;border:2px solid #3a2f28;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation;cursor:pointer}' +
            '.av-anvil{position:absolute;left:50%;bottom:22px;width:150px;height:46px;margin-left:-75px;background:linear-gradient(#6b7384,#3a4152);border-radius:6px 6px 14px 14px;box-shadow:0 6px 0 #232733}' +
            '.av-anvil:before{content:"";position:absolute;left:-26px;top:4px;width:44px;height:16px;background:#5b6377;border-radius:12px 0 0 12px}' +
            '.av-anvil:after{content:"";position:absolute;left:30px;bottom:-26px;width:90px;height:26px;background:#2b3040;border-radius:0 0 8px 8px}' +
            '.av-wpn{position:absolute;left:50%;bottom:68px;margin-left:-40px;transition:transform .08s}' +
            '.av-wpn.hit{transform:translateY(5px) scale(1.04)}' +
            '.av-hammer{position:absolute;left:62%;top:6px;font-size:64px;transform-origin:20% 90%;transform:rotate(-35deg);transition:transform .14s ease-out;filter:drop-shadow(0 4px 2px rgba(0,0,0,.5))}' +
            '.av-hammer.swing{transform:rotate(30deg) translate(-26px,40px)}' +
            '.av-spark{position:absolute;font-size:18px;pointer-events:none;animation:avSpark .6s ease-out forwards}' +
            '@keyframes avSpark{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.4)}}' +
            '.av-new{animation:avNew .8s ease-out}@keyframes avNew{0%{background:#ffd84a55;transform:scale(1.04)}100%{background:transparent;transform:scale(1)}}';
        document.head.appendChild(st);
    }
    function openAnvil(hack, w, onDone) {
        if (!w.anvil) return; injectAnvilStyle();
        const m = L().modal('🔨 金床　' + w.name, () => { if (onDone) onDone(); });
        let busy = false, last = null, finished = false;
        const nextR = RC(w.anvil.next);
        function draw() {
            const a = w.anvil, done = a ? a.rolled.length : 0, total = a ? a.total : 0;
            const shown = a ? (a.mode === 'add' ? (w.effects || []).map(f => ({ f: f, n: false })).concat(a.rolled.map(f => ({ f: f, n: true }))) : a.rolled.map(f => ({ f: f, n: true }))) : (w.effects || []).map(f => ({ f: f, n: false }));
            m.body.innerHTML = '<div class="sbl-col" style="flex:1 1 100%">' +
                '<div style="text-align:center;font-size:.9rem;margin-bottom:6px">' + (finished ? '<b style="color:' + nextR.color + '">✨ ' + nextR.label + 'に進化しました！</b>' : '金床をタップして、ハンマーを叩こう！　<b>あと ' + (total - done) + ' 回</b>') + '</div>' +
                '<div class="av-scene" id="avScene"><div class="av-anvil"></div><div class="av-wpn" id="avWpn"></div><div class="av-hammer" id="avHam">🔨</div></div>' +
                '<div class="sbl-sec">' + (a ? (a.mode === 'all' ? '新しい効果（すべて変わります）' : '足された効果') : '効果') + '</div>' +
                (a && a.mode === 'add' ? '<div style="font-size:.78rem;color:#9fb3d9">もとの効果は残っています（' + (w.effects || []).length + '個）</div>' : '') +
                '<div id="avList">' + (shown.length ? shown.map((x, i) => '<div class="sbl-fx' + (x.n && last && x.f === last ? ' av-new' : '') + '" style="' + (x.n ? 'color:#ffe08a' : '') + '">' + (x.n ? '🆕 ' : '◆ ') + esc(HW.describeEffect(x.f)) + '</div>').join('') : '<div class="sbl-fx" style="color:#778">まだありません</div>') + '</div>' +
                '<div style="margin-top:8px">' + (finished ? '<button type="button" class="sbl-btn green" id="avClose">できあがり</button>' : '<button type="button" class="sbl-btn orange" id="avHit">🔨 叩く</button><div style="font-size:.76rem;color:#8a97b8;margin-top:4px">途中で閉じても、次に工房を開くと続きから叩けます。</div>') + '</div></div>';
            const wp = m.body.querySelector('#avWpn'); wp.appendChild(iconCanvas(w, 80));
            const sc = m.body.querySelector('#avScene'); if (sc && !finished) sc.addEventListener('click', hit);
            const hb = m.body.querySelector('#avHit'); if (hb) hb.addEventListener('click', hit);
            const cb = m.body.querySelector('#avClose'); if (cb) cb.addEventListener('click', () => m.close());
        }
        function sparks() {
            const sc = m.body.querySelector('#avScene'); if (!sc) return;
            for (let i = 0; i < 9; i++) { const s = document.createElement('span'); s.className = 'av-spark'; s.textContent = i % 3 ? '✨' : '🔥'; s.style.left = (45 + Math.random() * 10) + '%'; s.style.bottom = '78px'; s.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px'); s.style.setProperty('--dy', (-30 - Math.random() * 90) + 'px'); sc.appendChild(s); setTimeout(() => s.remove(), 650); }
        }
        function hit() {
            if (busy || finished || !w.anvil) return; busy = true;
            const ham = m.body.querySelector('#avHam'), wp = m.body.querySelector('#avWpn');
            if (ham) ham.classList.add('swing');
            setTimeout(() => {
                if (wp) wp.classList.add('hit'); sparks();
                try { if (global.SBSound && SBSound.sfx) SBSound.sfx('hit'); } catch (e) { /* 音が出なくても続ける */ }
                const r = HW.hammer(w);
                if (!r) { busy = false; if (ham) ham.classList.remove('swing'); alert('これ以上ロールできません。'); return; }
                last = r.fx; finished = !!r.finished; HW.save(hack);
                setTimeout(() => { draw(); busy = false; }, 150);
            }, 140);
        }
        draw();
    }

    global.SBOrigUI = { openKits: openKits, openCreate: openCreate, openWorkshop: openWorkshop, openAnvil: openAnvil, openMotion: openMotion, openAtk: openAtk, pixelEditor: pixelEditor };
})(window);
