// ============================================================
// survival-world.js ― サバイバルエリアの「世界の定義」。サーバーとブラウザの両方が同じファイルを読む
//  （地形・障害物・当たり判定がずれると、同期がおかしくなるため。1か所だけに書く）
//  ・マップは 72000×72000（最初の 12000 の 36 倍の面積）。中心が「次元の裂けた跡地」（安全地帯）
//  ・障害物は600px四方のチャンクごとに決定的に生成する（保存不要・同じ乱数で誰が見ても同じ）
// ============================================================
(function (root) {
    'use strict';
    const SIZE = 72000, CX = 36000, CY = 36000, SAFE_R = 800, CHUNK = 600, SEED = 20261026;

    // 距離でゾーンが変わる：中心に近いほど安全、遠いほど危険（敵が強く、コインが多い）
    const ZONES = [
        { id: 'landing',  name: '裂けた跡地（安全地帯）', tier: 0, max: SAFE_R,  color: '#3b2f5e', dot: '#6a5acd' },
        { id: 'plains',   name: '砕けた草原',             tier: 1, max: 9000,    color: '#2f4a33', dot: '#4f7a55' },
        { id: 'waste',    name: '荒れ果てた大地',         tier: 2, max: 18000,   color: '#54452c', dot: '#7d6a45' },
        { id: 'abyss',    name: '深淵の領域',             tier: 3, max: 28000,   color: '#2a2147', dot: '#4a3c80' },
        { id: 'rim',      name: '次元の果て',             tier: 3, max: 1e9,     color: '#1a1226', dot: '#3a2a5a' }
    ];
    function zoneAt(x, y) {
        const d = Math.hypot(x - CX, y - CY);
        for (let i = 0; i < ZONES.length; i++) if (d < ZONES[i].max) return ZONES[i];
        return ZONES[ZONES.length - 1];
    }
    const inSafe = (x, y) => Math.hypot(x - CX, y - CY) < SAFE_R;

    // ボスの巣：18か所。0〜5 が最外周（5 は不壊の悪魔）、6〜11 が中間、12〜17 がその間
    const NEST_NAMES = ['炎獄の番人', '凍てつく王', '雷鳴の魔獣', '虚無の騎士長', '深淵の大蛇', '不壊の悪魔', '紅蓮の将軍', '氷河の女帝', '轟雷の竜', '影の処刑人', '蒼海の主', '虚空の魔導師',
        '灼熱の巨人', '霜牙の狼王', '蒼雷の鳳', '暗黒の僧正', '腐海の主', '幻影の剣聖'];
    const NESTS = [];
    for (let k = 0; k < 18; k++) {
        const ring = k < 6 ? 0 : k < 12 ? 1 : 2, j = k % 6;
        const a = (Math.PI / 3) * j + (ring === 0 ? Math.PI / 6 : ring === 1 ? Math.PI / 3 + 0.35 : 0.1), d = ring === 0 ? 26500 : ring === 1 ? 17500 : 19500;
        NESTS.push({ id: k, x: Math.round(CX + Math.cos(a) * d), y: Math.round(CY + Math.sin(a) * d), name: NEST_NAMES[k] });
    }

    // ---------- 建国候補地と領地（国システム） ----------
    //  8か所の「建国候補地」があり、国を建てると、その土地の周りの区画（CELL×CELL）が自動で領地になる。
    //  区画は最も近い候補地へ決定的に割り振られる（国が建つ前から決まっている）。戦争で奪うと持ち主だけが変わる
    const CELL = 750, GN = Math.ceil(SIZE / CELL), TERRITORY_R = 3300, TOWN_R = 950;       // 城下町は、以前の約10倍の広さ（面積）。国の領地も、それが収まる広さに
    const SITE_NAMES = ['ヴァルハイム平原', 'アストリア高地', 'ルミナ湾岸', 'ノクターン丘陵', 'サンクレスト', 'ミストヴェイル', 'アイアンホルト', 'エルドラ渓谷',
        'クリスタリア', 'ハーヴェスト', 'ブラックソーン', 'セラフィム', 'ドラグニア', 'オルフェウス', 'ネブラ', 'アーカディア',
        'エメラルダ', 'ガーネットヒル', 'シルヴァーナ', 'トルマリン岬', 'ヘリオス', 'ペルセウス', 'ミドガルド', 'ラグナロク']; 
    const SITES = [];
    for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + 0.3, d = 13000 + (k % 2 ? 500 : -500);
        SITES.push({ id: k, x: Math.round(CX + Math.cos(a) * d), y: Math.round(CY + Math.sin(a) * d), name: SITE_NAMES[k] });
    }
    const cellIdx = (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return (cx < 0 || cy < 0 || cx >= GN || cy >= GN) ? -1 : cy * GN + cx; };
    const cellCenter = (idx) => ({ x: (idx % GN) * CELL + CELL / 2, y: Math.floor(idx / GN) * CELL + CELL / 2 });
    const SITE_CELLS = SITES.map(() => []), CELL_SITE = new Array(GN * GN).fill(-1);
    for (let i = 0; i < GN * GN; i++) {
        const c = cellCenter(i); let best = -1, bd = TERRITORY_R;
        for (let k = 0; k < SITES.length; k++) { const d = Math.hypot(c.x - SITES[k].x, c.y - SITES[k].y); if (d < bd) { bd = d; best = k; } }
        CELL_SITE[i] = best; if (best >= 0) SITE_CELLS[best].push(i);
    }
    const nearSite = (x, y, pad) => SITES.some(function (s) { return Math.hypot(s.x - x, s.y - y) < pad; });

    // ---------- ダンジョン（地下迷宮） ----------
    //  地図には「入り口」が2か所だけ。入ると地下1階へ。各階は自動で作られた迷路（無限回廊のよう）で、
    //  下り階段を見つけて地下5階まで進むと、確定でボスが出る。ボスを倒すと踏破。
    //  地下の階は、地図の東の外側（x > SIZE）の別の場所に並んでいる。階段で行き来する（同じ座標系なので、通信や当たり判定はそのまま使える）
    const DG_N = 8, DG_S = 210, DG_W = DG_N * DG_S, DG_PITCH = DG_W + 600, DG_X0 = SIZE + 2000, DG_Y0 = 3000;
    const DG_FLOORS = 5, DG_MAX_X = DG_X0 + 10 * DG_PITCH + 1000, DG_MAX_Y = DG_Y0 + DG_W + 1000;
    const DUNGEONS = [
        { id: 0, name: '苔むした地下迷宮', tier: 1, range: [3500, 7500] },
        { id: 1, name: '虚無の大迷宮', tier: 3, range: [19000, 26000] }
    ];
    const RUINS = [];
    (function () {
        const rnd = mulberry32(SEED ^ 0x5bd1e995);
        // 入り口の場所（地図の上）
        DUNGEONS.forEach(function (d) {
            for (let tries = 0; tries < 5000; tries++) {
                const a = rnd() * Math.PI * 2, dd = d.range[0] + rnd() * (d.range[1] - d.range[0]);
                const x = Math.round(CX + Math.cos(a) * dd), y = Math.round(CY + Math.sin(a) * dd);
                if (x < 800 || y < 800 || x > SIZE - 800 || y > SIZE - 800) continue;
                if (NESTS.some(function (n) { return Math.hypot(n.x - x, n.y - y) < 1200; })) continue;
                if (nearSite(x, y, TERRITORY_R + 500)) continue;
                if (DUNGEONS.some(function (o) { return o.entrance && Math.hypot(o.entrance.x - x, o.entrance.y - y) < 4000; })) continue;
                d.entrance = { x: x, y: y }; break;
            }
            d.floors = [];
        });
        // 各階（迷路）
        DUNGEONS.forEach(function (d) {
            for (let f = 1; f <= DG_FLOORS; f++) {
                const idx = RUINS.length, ox = DG_X0 + (d.id * DG_FLOORS + f - 1) * DG_PITCH, oy = DG_Y0;
                const R = { id: idx, dg: d.id, floor: f, tier: d.tier, name: d.name + ' 地下' + f + '階', x: ox + DG_W / 2, y: oy + DG_W / 2, r: Math.round(DG_W * 0.75), ox: ox, oy: oy, boss: f === DG_FLOORS, walls: [], chests: [], cells: [], grid: new Map() };
                const fr = mulberry32((SEED ^ Math.imul(idx + 7, 2654435761)) | 0), wall = function (x, y) { R.walls.push({ x: Math.round(x), y: Math.round(y), r: 24, t: 'wall' }); };
                const edge = function (x0, y0, x1, y1) { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 30)); for (let i = 0; i <= n; i++) wall(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); };
                if (!R.boss) {
                    // 迷路（深さ優先で通路を掘る）
                    const open = []; for (let i = 0; i < DG_N * DG_N; i++) open.push([false, false, false, false]);   // 右・下・左・上
                    const seen = new Array(DG_N * DG_N).fill(false), stack = [0], dist = new Array(DG_N * DG_N).fill(-1);
                    seen[0] = true; dist[0] = 0;
                    const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
                    while (stack.length) {
                        const c = stack[stack.length - 1], cx = c % DG_N, cy = Math.floor(c / DG_N), opts = [];
                        for (let k = 0; k < 4; k++) { const nx = cx + dx[k], ny = cy + dy[k]; if (nx >= 0 && ny >= 0 && nx < DG_N && ny < DG_N && !seen[ny * DG_N + nx]) opts.push(k); }
                        if (!opts.length) { stack.pop(); continue; }
                        const k = opts[Math.floor(fr() * opts.length)], n = (cy + dy[k]) * DG_N + cx + dx[k];
                        open[c][k] = true; open[n][(k + 2) % 4] = true; seen[n] = true; dist[n] = dist[c] + 1; stack.push(n);
                    }
                    // 壁
                    for (let cy = 0; cy < DG_N; cy++) for (let cx = 0; cx < DG_N; cx++) {
                        const c = cy * DG_N + cx, x = ox + cx * DG_S, y = oy + cy * DG_S;
                        if (!open[c][3]) edge(x, y, x + DG_S, y);
                        if (!open[c][2]) edge(x, y, x, y + DG_S);
                        if (cy === DG_N - 1) edge(x, y + DG_S, x + DG_S, y + DG_S);
                        if (cx === DG_N - 1) edge(x + DG_S, y, x + DG_S, y + DG_S);
                    }
                    // 入口（階段）は 0番、下り階段は最も遠いマス
                    let far = 1; for (let i = 1; i < DG_N * DG_N; i++) if (dist[i] > dist[far]) far = i;
                    const cc = function (i) { return { x: ox + (i % DG_N) * DG_S + DG_S / 2, y: oy + Math.floor(i / DG_N) * DG_S + DG_S / 2 }; };
                    R.up = cc(0); R.down = cc(far); R.start = { x: R.up.x + 0, y: R.up.y + 30 };
                    // 行き止まりに宝箱
                    const dead = []; for (let i = 1; i < DG_N * DG_N; i++) if (i !== far && open[i].filter(Boolean).length === 1) dead.push(i);
                    dead.sort(function (a, b) { return dist[b] - dist[a] + (fr() - 0.5) * 3; });
                    dead.slice(0, 2).forEach(function (i, k) { const c = cc(i); R.chests.push({ id: 'r' + idx + 'c' + k, x: Math.round(c.x), y: Math.round(c.y), tier: d.tier, ruin: idx }); });
                    for (let i = 0; i < DG_N * DG_N; i++) if (i !== 0 && i !== far && dist[i] > 1) R.cells.push(cc(i));
                } else {
                    // 地下5階：ボスの広間（丸い部屋）
                    const cx = R.x, cy = R.y, RR = 640, n = Math.round(2 * Math.PI * RR / 30);
                    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; wall(cx + Math.cos(a) * RR, cy + Math.sin(a) * RR); }
                    [[-300, -300], [300, -300], [-300, 300], [300, 300]].forEach(function (p) { R.walls.push({ x: cx + p[0], y: cy + p[1], r: 42, t: 'pillar' }); });
                    R.up = { x: cx, y: cy + 520 }; R.down = null; R.start = { x: cx, y: cy + 470 }; R.bossAt = { x: cx, y: cy - 120 };
                    R.cells.push({ x: cx - 200, y: cy }, { x: cx + 200, y: cy }, { x: cx, y: cy - 300 });
                }
                R.walls.forEach(function (w) { const key = Math.floor(w.x / 210) + ',' + Math.floor(w.y / 210); let g = R.grid.get(key); if (!g) R.grid.set(key, g = []); g.push(w); });
                RUINS.push(R); d.floors.push(idx);
            }
        });
    })();
    // ---------- 神殿（神器の置き場所） ----------
    //  神器は全部で7つ。それぞれ地図に1つだけ（持っている人の分も含めて）。最初は地図の外側の神殿に安置されていて、守護者を倒すと手に入る
    const SHRINE_NAMES = ['不死鳥の祭壇', '雷神の社', '氷結の玉座', '大地の祠', '虚空の鏡殿', '聖杯の泉', '刻の神殿'];
    const SHRINES = [];
    (function () {
        const rnd = mulberry32(SEED ^ 0xa11ce);
        for (let k = 0; k < 7; k++) {
            for (let tries = 0; tries < 4000; tries++) {
                const a = k * Math.PI * 2 / 7 + 0.4 + (rnd() - 0.5) * 0.3, d = 28500 + rnd() * 4000;
                const x = Math.round(CX + Math.cos(a) * d), y = Math.round(CY + Math.sin(a) * d);
                if (x < 1500 || y < 1500 || x > SIZE - 1500 || y > SIZE - 1500) continue;
                if (nearSite(x, y, TERRITORY_R + 500) || NESTS.some(function (n) { return Math.hypot(n.x - x, n.y - y) < 1800; })) continue;
                if (DUNGEONS.some(function (dg) { return dg.entrance && Math.hypot(dg.entrance.x - x, dg.entrance.y - y) < 2500; })) continue;
                if (SHRINES.some(function (o) { return Math.hypot(o.x - x, o.y - y) < 6000; })) continue;
                SHRINES.push({ id: k, x: x, y: y, name: SHRINE_NAMES[k] }); break;
            }
        }
    })();
    const nearShrine = function (x, y, pad) { return SHRINES.some(function (h) { return Math.hypot(h.x - x, h.y - y) < pad; }); };

    // 入り口の周りは広場にする（障害物を置かない）
    const nearDungeon = function (x, y, pad) { return DUNGEONS.some(function (d) { return d.entrance && Math.hypot(d.entrance.x - x, d.entrance.y - y) < pad; }); };
    const inRuin = (x, y, pad) => nearDungeon(x, y, 200 + (pad || 0));
    // 地下の階の番号（地下にいなければ -1）
    function dgAt(x, y) {
        if (x < DG_X0 - 200) return -1;
        for (let i = 0; i < RUINS.length; i++) { const r = RUINS[i]; if (x >= r.ox - 200 && x <= r.ox + DG_W + 200 && y >= r.oy - 200 && y <= r.oy + DG_W + 200) return i; }
        return -1;
    }
    const inBounds = (x, y) => (x >= 0 && y >= 0 && x <= SIZE && y <= SIZE) || (x >= DG_X0 - 300 && x <= DG_MAX_X && y >= DG_Y0 - 300 && y <= DG_MAX_Y);

    function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

    const cache = new Map();
    function chunk(cx, cy) {
        const key = cx + ',' + cy;
        let c = cache.get(key);
        if (c) return c;
        const rnd = mulberry32((SEED ^ Math.imul(cx + 1000, 73856093) ^ Math.imul(cy + 1000, 19349663)) | 0);
        c = [];
        const mx = cx * CHUNK + CHUNK / 2, my = cy * CHUNK + CHUNK / 2;
        const z = zoneAt(mx, my);
        const n = z.tier === 0 ? 0 : (z.tier === 1 ? 5 : z.tier === 2 ? 4 : 5);
        for (let i = 0; i < n; i++) {
            const x = cx * CHUNK + 40 + rnd() * (CHUNK - 80), y = cy * CHUNK + 40 + rnd() * (CHUNK - 80);
            if (x < 60 || y < 60 || x > SIZE - 60 || y > SIZE - 60) continue;
            if (Math.hypot(x - CX, y - CY) < SAFE_R + 60) continue;
            if (NESTS.some(nst => Math.hypot(x - nst.x, y - nst.y) < 260)) continue;      // 巣の周りは広場にする
            if (nearSite(x, y, TOWN_R + 120)) continue;                                  // 城下町は広場にする
            if (inRuin(x, y, 120)) continue;                                             // ダンジョン入り口の周りは広場にする
            if (nearShrine(x, y, 420)) continue;                                        // 神殿の周りも広場にする
            const zz = zoneAt(x, y), roll = rnd();
            const t = zz.tier === 1 ? (roll < 0.7 ? 'tree' : 'rock') : zz.tier === 2 ? (roll < 0.3 ? 'tree' : 'rock') : (roll < 0.6 ? 'crystal' : 'pillar');
            c.push({ x: Math.round(x), y: Math.round(y), r: t === 'tree' ? 26 : t === 'rock' ? 34 : t === 'crystal' ? 28 : 30, t: t });
        }
        if (cache.size > 3000) cache.clear();
        cache.set(key, c);
        return c;
    }
    function obstaclesNear(x, y, rad) {
        const out = [], x0 = Math.floor((x - rad) / CHUNK), x1 = Math.floor((x + rad) / CHUNK), y0 = Math.floor((y - rad) / CHUNK), y1 = Math.floor((y + rad) / CHUNK);
        for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
            if (cx < 0 || cy < 0 || cx * CHUNK >= SIZE || cy * CHUNK >= SIZE) continue;
            const c = chunk(cx, cy); for (let i = 0; i < c.length; i++) out.push(c[i]);
        }
        if (x > SIZE) {                                                                // 地下の迷路の壁（マス目ごとに分けてあるので、近くだけ取り出す）
            const k = dgAt(x, y);
            if (k >= 0) {
                const r = RUINS[k], gx0 = Math.floor((x - rad) / 210), gx1 = Math.floor((x + rad) / 210), gy0 = Math.floor((y - rad) / 210), gy1 = Math.floor((y + rad) / 210);
                for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) { const g = r.grid.get(gx + ',' + gy); if (g) for (let i = 0; i < g.length; i++) out.push(g[i]); }
            }
        }
        return out;
    }

    // ---------- 宝箱 ----------
    //  遺跡の中の宝箱（固定4つ）＋ 地図のあちこちに散らばる宝箱（チャンクごとに12%）。どちらも保存不要の決定的な配置
    const chestCache = new Map();
    function chunkChests(cx, cy) {
        const key = cx + ',' + cy; let c = chestCache.get(key); if (c) return c;
        c = [];
        const rnd = mulberry32((SEED ^ 0x1234567 ^ Math.imul(cx + 77, 2654435761) ^ Math.imul(cy + 91, 40503)) | 0);
        if (rnd() < 0.12 && cx >= 0 && cy >= 0 && cx * CHUNK < SIZE && cy * CHUNK < SIZE) {
            const x = Math.round(cx * CHUNK + 60 + rnd() * (CHUNK - 120)), y = Math.round(cy * CHUNK + 60 + rnd() * (CHUNK - 120)), z = zoneAt(x, y);
            const blocked = z.tier === 0 || nearSite(x, y, TOWN_R + 120) || inRuin(x, y, 100) || NESTS.some(n => Math.hypot(n.x - x, n.y - y) < 280) || chunk(cx, cy).some(o => Math.hypot(o.x - x, o.y - y) < o.r + 40);
            if (!blocked) c.push({ id: 's' + cx + '_' + cy, x: x, y: y, tier: z.tier, ruin: null });
        }
        if (chestCache.size > 3000) chestCache.clear();
        chestCache.set(key, c);
        return c;
    }
    function chestsNear(x, y, rad) {
        const out = [], x0 = Math.floor((x - rad) / CHUNK), x1 = Math.floor((x + rad) / CHUNK), y0 = Math.floor((y - rad) / CHUNK), y1 = Math.floor((y + rad) / CHUNK);
        for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const c = chunkChests(cx, cy); for (let i = 0; i < c.length; i++) if (Math.abs(c[i].x - x) <= rad && Math.abs(c[i].y - y) <= rad) out.push(c[i]); }
        for (let k = 0; k < RUINS.length; k++) { const r = RUINS[k]; for (let i = 0; i < r.chests.length; i++) { const c = r.chests[i]; if (Math.abs(c.x - x) <= rad && Math.abs(c.y - y) <= rad) out.push(c); } }
        return out;
    }
    // 位置(x,y)・半径 r の円を、障害物と世界の端から押し出して返す
    function resolve(x, y, r) {
        const obs = obstaclesNear(x, y, r + 40);
        for (let i = 0; i < obs.length; i++) {
            const o = obs[i], dx = x - o.x, dy = y - o.y, min = r + o.r, d2 = dx * dx + dy * dy;
            if (d2 < min * min) { const d = Math.sqrt(d2) || 0.001; x = o.x + dx / d * min; y = o.y + dy / d * min; }
        }
        if (x > SIZE + 100) { x = Math.max(DG_X0 - 250, Math.min(DG_MAX_X - r, x)); y = Math.max(DG_Y0 - 250, Math.min(DG_MAX_Y - r, y)); }
        else { x = Math.max(r, Math.min(SIZE - r, x)); y = Math.max(r, Math.min(SIZE - r, y)); }
        return { x: x, y: y };
    }
    const api = { CELL, GN, TERRITORY_R, TOWN_R, SITES, SITE_CELLS, CELL_SITE, cellIdx, cellCenter, nearSite, SIZE, CX, CY, SAFE_R, CHUNK, SEED, ZONES, NESTS, RUINS, DUNGEONS, SHRINES, nearShrine, DG_N, DG_S, DG_W, DG_X0, DG_Y0, dgAt, inBounds, nearDungeon, inRuin, chestsNear, zoneAt, inSafe, chunk, obstaclesNear, resolve, mulberry32 };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SurvivalWorld = api;
})(typeof window !== 'undefined' ? window : globalThis);
