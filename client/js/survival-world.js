// ============================================================
// survival-world.js ― サバイバルエリアの「世界の定義」。サーバーとブラウザの両方が同じファイルを読む
//  （地形・障害物・当たり判定がずれると、同期がおかしくなるため。1か所だけに書く）
//  ・マップは 12000×12000（はじまりの町の約 90 倍の面積）。中心が「次元の裂けた跡地」（安全地帯）
//  ・障害物は600px四方のチャンクごとに決定的に生成する（保存不要・同じ乱数で誰が見ても同じ）
// ============================================================
(function (root) {
    'use strict';
    const SIZE = 12000, CX = 6000, CY = 6000, SAFE_R = 420, CHUNK = 600, SEED = 20261026;

    // 距離でゾーンが変わる：中心に近いほど安全、遠いほど危険（敵が強く、コインが多い）
    const ZONES = [
        { id: 'landing',  name: '裂けた跡地（安全地帯）', tier: 0, max: SAFE_R,  color: '#3b2f5e', dot: '#6a5acd' },
        { id: 'plains',   name: '砕けた草原',             tier: 1, max: 2300,    color: '#2f4a33', dot: '#4f7a55' },
        { id: 'waste',    name: '荒れ果てた大地',         tier: 2, max: 3900,    color: '#54452c', dot: '#7d6a45' },
        { id: 'abyss',    name: '深淵の領域',             tier: 3, max: 5200,    color: '#2a2147', dot: '#4a3c80' },
        { id: 'rim',      name: '次元の果て',             tier: 3, max: 1e9,     color: '#1a1226', dot: '#3a2a5a' }
    ];
    function zoneAt(x, y) {
        const d = Math.hypot(x - CX, y - CY);
        for (let i = 0; i < ZONES.length; i++) if (d < ZONES[i].max) return ZONES[i];
        return ZONES[ZONES.length - 1];
    }
    const inSafe = (x, y) => Math.hypot(x - CX, y - CY) < SAFE_R;

    // ボスの巣：6か所（外周）。ここに強いボスが居座る
    const NESTS = [];
    for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        NESTS.push({ id: k, x: Math.round(CX + Math.cos(a) * 4300), y: Math.round(CY + Math.sin(a) * 4300),
            name: ['炎獄の番人', '凍てつく王', '雷鳴の魔獣', '虚無の騎士長', '深淵の大蛇', '不壊の悪魔'][k] });
    }

    // ---------- 遺跡（ダンジョン） ----------
    //  石壁に囲まれた広場。入口は中心側に向いている。中には敵がたくさん湧き、守護者と宝箱が4つある。
    //  地下の別空間ではなく、同じ広い地図の上にある（外から見える・PvPも続く＝潜るのは危険）
    const RUIN_NAMES = {
        1: ['苔むした祠', '忘れられた井戸跡', '崩れた物見台', '朽ちた砦', '小さな石舞台'],
        2: ['砂塵の墓所', '錆びた機械工房', '古戦場の砦', '骨の遺跡'],
        3: ['虚無の神殿', '深淵の回廊', '歪んだ時計塔', '次元の墓標']
    };
    const RUINS = [];
    (function () {
        const rnd = mulberry32(SEED ^ 0x5bd1e995), want = { 1: 5, 2: 4, 3: 4 }, range = { 1: [900, 2000], 2: [2500, 3700], 3: [4100, 5000] };
        [1, 2, 3].forEach(function (tier) {
            let made = 0, tries = 0;
            while (made < want[tier] && tries++ < 400) {
                const a = rnd() * Math.PI * 2, d = range[tier][0] + rnd() * (range[tier][1] - range[tier][0]);
                const x = Math.round(CX + Math.cos(a) * d), y = Math.round(CY + Math.sin(a) * d);
                if (x < 500 || y < 500 || x > SIZE - 500 || y > SIZE - 500) continue;
                if (NESTS.some(function (n) { return Math.hypot(n.x - x, n.y - y) < 700; })) continue;
                if (RUINS.some(function (r) { return Math.hypot(r.x - x, r.y - y) < 900; })) continue;
                const names = RUIN_NAMES[tier];
                RUINS.push({ id: RUINS.length, x: x, y: y, r: Math.round(300 + rnd() * 60), tier: tier, name: names[made % names.length], gap: Math.atan2(CY - y, CX - x) + (rnd() - 0.5) * 0.8 });
                made++;
            }
        });
        RUINS.forEach(function (r) {
            r.walls = [];
            const n = Math.floor(2 * Math.PI * r.r / 58);
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 - Math.PI;
                let da = Math.abs(a - r.gap); da = da > Math.PI ? 2 * Math.PI - da : da;
                if (da < 0.30) continue;                                              // 入口
                r.walls.push({ x: Math.round(r.x + Math.cos(a) * r.r), y: Math.round(r.y + Math.sin(a) * r.r), r: 30, t: 'wall' });
            }
            // 中の宝箱（4つ）
            r.chests = [];
            for (let i = 0; i < 4; i++) {
                const a = rnd() * Math.PI * 2, dd = r.r * (0.2 + rnd() * 0.45);
                r.chests.push({ id: 'r' + r.id + 'c' + i, x: Math.round(r.x + Math.cos(a) * dd), y: Math.round(r.y + Math.sin(a) * dd), tier: r.tier, ruin: r.id });
            }
        });
    })();
    const inRuin = (x, y, pad) => RUINS.some(function (r) { return Math.hypot(r.x - x, r.y - y) < r.r + (pad || 0); });

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
            if (inRuin(x, y, 90)) continue;                                              // 遺跡の中と周りは、壁だけにする
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
        for (let k = 0; k < RUINS.length; k++) {                                       // 遺跡の石壁
            const r = RUINS[k]; if (Math.hypot(r.x - x, r.y - y) > r.r + rad + 70) continue;
            for (let i = 0; i < r.walls.length; i++) out.push(r.walls[i]);
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
            const blocked = z.tier === 0 || inRuin(x, y, 100) || NESTS.some(n => Math.hypot(n.x - x, n.y - y) < 280) || chunk(cx, cy).some(o => Math.hypot(o.x - x, o.y - y) < o.r + 40);
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
        x = Math.max(r, Math.min(SIZE - r, x)); y = Math.max(r, Math.min(SIZE - r, y));
        return { x: x, y: y };
    }
    const api = { SIZE, CX, CY, SAFE_R, CHUNK, SEED, ZONES, NESTS, RUINS, inRuin, chestsNear, zoneAt, inSafe, chunk, obstaclesNear, resolve, mulberry32 };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SurvivalWorld = api;
})(typeof window !== 'undefined' ? window : globalThis);
