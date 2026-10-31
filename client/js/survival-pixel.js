// ============================================================
// survival-pixel.js ― サバイバルエリアの 2D ドット絵描画
//   既存のドット絵ライブラリ（SBPix）の上に、サバイバル専用の見た目を足す。
//   軽くするための工夫：
//    ・文字（絵文字）の描画をやめ、あらかじめ作ったドット絵の画像を貼るだけにする（1回作ったら使い回し）
//    ・地面は「模様のパターン」で一気に塗る（小さな四角を何十個も描かない）
//    ・画面の外のものは描かない
//    ・重い環境では、飾り（草花など）や影を自動でやめる（lite）
// ============================================================
(function () {
    'use strict';
    const PX = () => window.SBPix && window.SBPix.on && window.SBPix.on();
    const cache = new Map();

    // 文字列のドット絵（. は透明）を、色表で画像にして取っておく
    function bake(key, rows, pal, scale) {
        const k = key + ':' + scale; let c = cache.get(k); if (c) return c;
        const w = Math.max.apply(null, rows.map((r) => r.length)), h = rows.length;
        c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
        const g = c.getContext('2d');
        rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.' || ch === ' ' || !pal[ch]) continue; g.fillStyle = pal[ch]; g.fillRect(x * scale, y * scale, scale, scale); } });
        cache.set(k, c); return c;
    }
    function put(ctx, c, x, y, flip) { ctx.imageSmoothingEnabled = false; if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(c, -c.width / 2, y - c.height / 2); ctx.restore(); } else ctx.drawImage(c, x - c.width / 2, y - c.height / 2); }
    const shade = (c, f) => (window.SBPix && window.SBPix.shade) ? window.SBPix.shade(c, f) : c;

    // ---------- 障害物 ----------
    const TREE = ['....GGGG....', '..GGGGGGGG..', '.GGgGGGGGGG.', 'GGGGGGgGGGGG', 'GGgGGGGGGgGG', '.GGGGGGGGGG.', '..GGGgGGGG..', '....GGGG....', '.....TT.....', '.....TT.....', '....tTTt....'];
    const PAL_TREE = { G: '#2f7a3a', g: '#44a34f', T: '#6b4a2a', t: '#4a301a' };
    const CRYSTAL = ['....cc....', '...cCCc...', '..cCwCCc..', '..cCwCCc..', '.cCCCCCCc.', '.cCCCCCCc.', 'cCCCCCCCCc', '.cccccccc.'];
    const PILLAR = ['.pppppp.', 'pPPPPPPp', '.pPPPPp.', '.pPPPPp.', '.pPPPPp.', '.pPPPPp.', 'pPPPPPPp', '.pppppp.'];
    function drawObstacle(ctx, o) {
        if (o.t === 'rock') { if (window.SBPix && window.SBPix.drawRock) window.SBPix.drawRock(ctx, o.x, o.y, o.r); return; }
        if (o.t === 'tree') { put(ctx, bake('tree', TREE, PAL_TREE, 5), o.x, o.y - 8); return; }
        if (o.t === 'crystal') { put(ctx, bake('cry', CRYSTAL, { c: '#6a4aa8', C: '#a47bff', w: '#e8dcff' }, 6), o.x, o.y - 6); return; }
        if (o.t === 'pillar') { put(ctx, bake('pil', PILLAR, { p: '#4a4660', P: '#7a7694' }, 7), o.x, o.y - 4); return; }
        if (o.t === 'wall') { ctx.fillStyle = '#3a3550'; ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2); ctx.fillStyle = '#5a5478'; ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, 6); return; }
        ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
    }

    // ---------- 地面 ----------
    // ゾーンの色 → 地面の種類（SBPix.kindOfColor）。パターンは SBPix が作って取っておく
    function ground(ctx, x0, y0, x1, y1, zoneAt, lite) {
        const B = 200, bx0 = Math.floor(x0 / B), bx1 = Math.floor(x1 / B), by0 = Math.floor(y0 / B), by1 = Math.floor(y1 / B);
        ctx.imageSmoothingEnabled = false;
        for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
            const z = zoneAt(bx * B + B / 2, by * B + B / 2), kind = z._k || (z._k = (window.SBPix && window.SBPix.kindOfColor) ? window.SBPix.kindOfColor(z.color) : 'grass');
            ctx.fillStyle = window.SBPix.pattern(ctx, kind, z.color);
            ctx.fillRect(bx * B, by * B, B + 1, B + 1);
        }
    }
    // ダンジョンの床と壁
    function dungeonFloor(ctx, R) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = window.SBPix.pattern(ctx, R.boss ? 'brick' : 'stone', R.boss ? '#3a2a3e' : '#3a3950');
        ctx.fillRect(R.ox - 120, R.oy - 120, 1680 + 240, 1680 + 240);
        if (R.boss) { ctx.fillStyle = 'rgba(120,40,160,.16)'; ctx.beginPath(); ctx.arc(R.x, R.y, 640, 0, 7); ctx.fill(); }
    }

    // ---------- 建物・建造物 ----------
    const COL = { shop: '#d99a3a', casino: '#c0392b', inn: '#4a8fd0', tavern: '#8a5a2b', buyback: '#2aa88a', base: '#6b7a8a' };
    const ICON = { shop: '🏪', casino: '🎰', inn: '🛏️', tavern: '🍺', buyback: '♻️', base: '🏠' };
    function plot(ctx, x, y, kind, flag, label) {
        if (PX() && window.SBPix.drawBuilding) window.SBPix.drawBuilding(ctx, x, y, 60, 54, COL[kind] || '#888', 'house');
        else { ctx.fillStyle = COL[kind] || '#888'; ctx.fillRect(x - 28, y - 24, 56, 48); }
        ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(ICON[kind] || '', x, y - 38);
        ctx.fillStyle = flag; ctx.fillRect(x - 14, y + 32, 28, 5);
        ctx.font = '700 13px sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = '#fff'; ctx.strokeText(label, x, y + 50); ctx.fillText(label, x, y + 50);
    }
    function castle(ctx, x, y, col) {
        if (PX() && window.SBPix.drawBuilding) { window.SBPix.drawBuilding(ctx, x, y + 4, 150, 120, col, 'house'); }
        else { ctx.fillStyle = col; ctx.fillRect(x - 70, y - 50, 140, 100); }
        ctx.font = '70px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('🏰', x, y - 6);
    }
    function gate(ctx, x, y, label, col) {
        if (PX() && window.SBPix.drawBuilding) window.SBPix.drawBuilding(ctx, x, y, 110, 100, col || '#6a5acd', 'gate');
        else { ctx.fillStyle = col || '#6a5acd'; ctx.fillRect(x - 50, y - 45, 100, 90); }
        ctx.font = '700 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = '#fff'; ctx.strokeText(label, x, y - 66); ctx.fillText(label, x, y - 66);
    }
    function stairs(ctx, x, y, up, now) {
        const g = 0.6 + 0.4 * Math.sin(now / 300);
        ctx.fillStyle = up ? 'rgba(120,200,255,' + (0.25 * g) + ')' : 'rgba(255,200,120,' + (0.28 * g) + ')'; ctx.beginPath(); ctx.arc(x, y, 62, 0, 7); ctx.fill();
        ctx.fillStyle = up ? '#3a5a7a' : '#7a5a3a'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 30 + i * 4, y - 20 + i * 11, 60 - i * 8, 10);
        ctx.font = '700 13px sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = '#fff'; const t = up ? '↑ 上へ [E]' : '↓ 下へ [E]'; ctx.strokeText(t, x, y - 36); ctx.fillText(t, x, y - 36);
    }
    function shrine(ctx, x, y, name, open, now) {
        if (PX() && window.SBPix.drawBuilding) window.SBPix.drawBuilding(ctx, x, y, 120, 100, open ? '#d4af37' : '#666', 'gate');
        ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(open ? '✨' : '・', x, y - 70 + Math.sin(now / 400) * 4);
        ctx.font = '700 14px sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = open ? '#ffe9a0' : '#bbb'; const t = name + (open ? '' : '（空）'); ctx.strokeText(t, x, y + 70); ctx.fillText(t, x, y + 70);
    }
    // 落ちている神器（光る）
    function artifact(ctx, x, y, icon, now, label) {
        const g = 0.5 + 0.5 * Math.sin(now / 260);
        ctx.fillStyle = 'rgba(255,230,120,' + (0.18 + 0.14 * g) + ')'; ctx.beginPath(); ctx.arc(x, y, 46 + g * 8, 0, 7); ctx.fill();
        ctx.font = '36px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(icon, x, y - 4 + Math.sin(now / 300) * 3);
        ctx.font = '700 13px sans-serif'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.fillStyle = '#ffe9a0'; ctx.strokeText(label, x, y + 34); ctx.fillText(label, x, y + 34);
    }
    // 貿易船
    const SHIP = ['.......m.......', '.......mw......', '.....mmmmww....', '....mmmmmmmw...', '...mmmmmmmmmw..', '..mmmmmmmmmmmw.', '.hhhhhhhhhhhhh.', '.hHHHHHHHHHHHh.', '..hhhhhhhhhhh..', '...hhhhhhhhh...'];
    function ship(ctx, x, y, col, face) {
        const c = bake('ship' + col, SHIP, { m: '#d8d8e0', w: '#ffffff', h: '#6b4a2a', H: col }, 5); put(ctx, c, x, y, Math.cos(face) < 0);
    }
    // 敵：アイコンからアーキタイプを決める
    const ARCH = { '👹': 'charger', '🏹': 'ranged', '🧙': 'ranged', '🗿': 'tank', '⚔️': 'charger', '🦑': 'swarm', '👻': 'swarm', '😈': 'bomber', '💀': 'chaser' };
    const TCOL = ['#7ac36a', '#c9a24a', '#a05ad0', '#d05a5a'];
    function monster(ctx, e, now, meX) {
        if (PX() && window.SBPix.drawEnemy) {
            if (e.boss && window.SBPix.drawBoss) { window.SBPix.drawBoss(ctx, e.x, e.y, e.r, e.name || '', e.icon, e.col || '#c0392b', { left: meX < e.x }); return true; }
            window.SBPix.drawEnemy(ctx, e.x, e.y, e.r, ARCH[e.icon] || 'chaser', e.col || TCOL[(e.tier || 1)] || '#a44', { left: meX < e.x, seed: e.id * 1.7, now: now });
            return true;
        }
        return false;
    }
    // 兵（国のCPU）
    function soldier(ctx, x, y, col, face, moving, name) {
        if (PX() && window.SBPix.drawPerson) window.SBPix.drawPerson(ctx, x, y + 6, { cloth: col, hair: window.SBPix.hairOf(name || 'g'), moving: moving, left: Math.cos(face) < 0 });
        else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill(); }
    }
    function person(ctx, x, y, o) { if (PX() && window.SBPix.drawPerson) { window.SBPix.drawPerson(ctx, x, y + 6, o); return true; } return false; }
    function weapon(ctx, x, y, a, type, col) { if (PX() && window.SBPix.drawWeapon && window.SBPix.hasWeapon && window.SBPix.hasWeapon(type)) { window.SBPix.drawWeapon(ctx, x, y, a, type, col || '#cfd6e6', {}); return true; } return false; }
    function bullet(ctx, x, y, r, col, vx, vy) { if (PX() && window.SBPix.drawBullet) { window.SBPix.drawBullet(ctx, x, y, r, col, { vx: vx, vy: vy }); return true; } return false; }
    // 宝箱
    const CHEST = ['.bbbbbbbb.', 'bBBBBBBBBb', 'bBBBBBBBBb', 'bbbbggbbbb', 'bBBBgGBBBb', 'bBBBBBBBBb', 'bbbbbbbbbb'];
    function chest(ctx, x, y, open, tier) { const c = bake('chest' + tier + (open ? 'o' : ''), CHEST, { b: '#4a2e14', B: open ? '#2a1a0a' : (tier >= 3 ? '#8a3aa8' : tier === 2 ? '#a8832a' : '#8a5a2b'), g: '#f2c14e', G: '#b88a1e' }, 5); put(ctx, c, x, y); }

    window.SVPix = { on: PX, ground: ground, dungeonFloor: dungeonFloor, obstacle: drawObstacle, plot: plot, castle: castle, gate: gate, stairs: stairs, shrine: shrine, artifact: artifact, ship: ship, monster: monster, soldier: soldier, person: person, weapon: weapon, bullet: bullet, chest: chest, shade: shade };
})();
