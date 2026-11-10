// ============================================================
//  職業ごとの「パーク」60個（1職業につき5つ。専用ツリーの中から1つだけ選べる）
// ------------------------------------------------------------
//  ・1つ選ぶとプレイスタイルが大きく変わる代わりに、重いデメリットがつく。メインとサブ、それぞれのツリーで1つずつ
//  ・選ぶには、その職業で使える「形」（メイン3つ／サブ2つ）をすべて解放していて、ポイントが PERK_COST 必要。解除するとポイントは戻る
//  ・保存先：player.classPerk = { 職業ID: パークID }
//  ・サブ職業でも選べる（サブは「形」が先頭2つまでなので、3つ目の形が要るパークは選べない）。メインとサブのパークは同時に効く
//  ・戦闘では practice.js / class-fx.js / class-forms.js から、次の窓口を通って呼ばれる（パークがなければ何もしない）
//      stats()                 常時の強化・弱体（agg.stats に足す）
//      setup(bridge)           戦闘の開始
//      formOverride(key)       スキルの形を、パーク専用の動きに差し替える
//      onFormCast(key, ctx)    形の発動の瞬間
//      castMul / costMul / cdMul / castOk / attackOk / dashOk / moveMul / moveFilter
//      incoming / onHurt / onKill / onHit / dealMul / afterDeal / healBlock / fatal / afterAttack / onDash / onCast
//      update(dt) / draw(ctx)
//  近似の実装（敵の向き・敵の特殊攻撃の判定など、戦闘エンジンに無い情報）は、各パークの中に「近似:」と書いてある
// ============================================================
(function (global) {
    'use strict';
    const CS = () => global.ClassSys, CF = () => global.ClassForms;
    const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
    const PERK_COST = 5;                       // パークを選ぶのに必要なポイント
    const JACKPOT_DESTROYS_WEAPON = true;      // ジャックポットのドクロで、装備中の武器を本当に消す（false なら、そのステージの間だけ武器が使えなくなる）
    let B = null, S = {}, curs = [];
    const PERKS = [], BY_ID = {}, BY_CLS = {};
    function def(cls, id, name, icon, pro, con, impl) {
        const o = Object.assign({ id: id, cls: cls, name: name, icon: icon, pro: pro, con: con }, impl || {});
        PERKS.push(o); BY_ID[id] = o; (BY_CLS[cls] = BY_CLS[cls] || []).push(o); return o;
    }

    // ---------- 共通の道具 ----------
    const me = () => B.me();
    const slotsOf = f => (B.slots() || []).filter(s => s && s.params && s.params.classForm === f);
    const popup = (t, c) => { const m = me(); B.popup(t, m.x, m.y - 50, c || '#ffe08a'); };
    const drain = (rate, dt) => { const m = me(); if (!m.dead) m.hp = Math.max(1, m.hp - m.maxHp * rate * dt); };
    const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    const hpRate = () => { const m = me(); return m.hp / m.maxHp; };
    const alive = e => e && e.hp > 0;
    const castForm = (key, ctx) => { const cf = CF(); return cf && cf.cast(key, ctx); };
    const miniCtx = (ang, mult) => ({ base: B.unitDmg() * (mult || 1), hasDmg: true, eff: [], ang: ang || 0, p: {}, skill: null });
    function zoneEnt(H, o) {      // 円形の設置エリア：{ x,y,R,life,tick,onTick,col }
        let t = 0, acc = 0;
        return H.add({ update(dt) { t += dt; acc += dt; if (o.pre) o.pre(dt, t); if (acc >= (o.tick || 0.5)) { acc = 0; o.onTick && o.onTick(t); } return t < o.life && B.isRun() && !(o.stop && o.stop()); },
            draw(c) { c.save(); c.fillStyle = o.fill || 'rgba(255,255,255,.12)'; c.strokeStyle = o.col || '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(o.x, o.y, o.R, 0, TAU); c.fill(); c.stroke(); c.restore(); } });
    }
    function spinForm(ctx, H, o) {                  // 大旋回の共通：武器を回しながら近づく
        const m = H.mk(ctx); let t = 0, acc = 0, spin = 0; const a0 = ctx.ang;
        H.add({ update(dt) {
            if (!H.alive()) return false; t += dt; acc += dt; spin += dt * 15;
            const mm = B.me(), k = o.k ? o.k() : 1; let a = a0;
            if (o.steer) { const tg = B.nearestEnemy(mm.x, mm.y, 560); a = tg ? angTo(mm, tg) : a0; }
            B.moveMe(Math.cos(a) * 255 * k * dt, Math.sin(a) * 255 * k * dt);
            if (o.clear) { const bl = B.eBullets(); for (let i = bl.length - 1; i >= 0; i--) if (Math.hypot(bl[i].x - mm.x, bl[i].y - mm.y) < o.clear) bl.splice(i, 1); }
            if (acc >= 0.18) { acc = 0; m.circle(mm.x, mm.y, 100, (o.dmg || 0.55) * k); }
            return t < 1.6;
        }, draw(c) { const mm = B.me(); c.save(); c.translate(mm.x, mm.y); c.rotate(spin); c.strokeStyle = o.col || '#ffd9a0'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-98, 0); c.lineTo(98, 0); c.stroke(); c.rotate(Math.PI / 2); c.globalAlpha = 0.6; c.beginPath(); c.moveTo(-98, 0); c.lineTo(98, 0); c.stroke(); c.restore(); } });
    }

    // =========================================================================
    //  🪓 バーバリアン
    // =========================================================================
    def('barbarian', 'bar_thirst', '血潮の渇き', '🩸',
        'HPが減るほど「大旋回」の移動速度と威力が最大3倍まで上昇する。', '常にHPが減少（秒間2%）し続け、あらゆる外部からの回復効果を受け付けなくなる。', {
            stats: { selfBleed: 0.02, noHeal: 1 }, healBlock: () => true,
            form: { bar_spin(ctx, H) { spinForm(ctx, H, { steer: true, k: () => 1 + 2 * Math.max(0, Math.min(1, 1 - hpRate())), col: '#ff8a7a' }); } },
            castMul(p) { return p && p.classForm === 'bar_spin' ? 1 + 2 * Math.max(0, 1 - hpRate()) : 1; }
        });
    def('barbarian', 'bar_continent', '大陸砕き', '🌋',
        '「岩投げ」の着弾地が、敵に大ダメージを与える広範囲の溶岩地帯に変化する。', '岩の重量が増し、スキルの発動モーション（前隙）が3倍に伸びる。', {
            form: { bar_rock(ctx, H) {
                const m = H.mk(ctx), me0 = B.me(), tp = H.targetPoint(ctx, 480, 300), sx = me0.x, sy = me0.y, WIND = 0.9, T = 0.7; let t = 0, landed = false;
                S.lockT = WIND + 0.1;                                  // 前隙の間は動けない
                H.add({ update(dt) {
                    t += dt;
                    if (!landed && t >= WIND + T) {
                        landed = true; m.circle(tp.x, tp.y, 150, 2.0); H.flash(tp.x, tp.y, 150, '#ff7a3d');
                        zoneEnt(H, { x: tp.x, y: tp.y, R: 150, life: 6, tick: 0.4, col: '#ff5a2a', fill: 'rgba(255,90,30,.28)', onTick: () => m.circle(tp.x, tp.y, 150, 0.7) });
                        return false;
                    } return true;
                }, draw(c) { if (t < WIND) return; const f = Math.min(1, (t - WIND) / T), x = sx + (tp.x - sx) * f, y = sy + (tp.y - sy) * f - Math.sin(f * Math.PI) * 140; c.save(); c.fillStyle = '#a06a3a'; c.strokeStyle = '#ff7a3d'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, 34, 0, TAU); c.fill(); c.stroke(); c.restore(); } });
            } }
        });
    def('barbarian', 'bar_collapse', 'コラプシング・ボイス', '📢',
        '「戦場の雄叫び」で引き寄せた敵同士が衝突し、3秒間の確定スタン（気絶）を起こす。', '雄叫びのクールダウンが2倍になり、発動時に自身の防御力が5秒間ゼロになる。', {
            cdMul: s => s.params.classForm === 'bar_roar' ? 2 : 1,
            incoming() { if (!(S.defZero > 0)) return 1; const red = Math.min(0.55, B.def() / (B.def() + 250)); return 1 / (1 - red); },
            update(dt) { if (S.defZero > 0) S.defZero -= dt; },
            form: { bar_roar(ctx, H) {
                const m = H.mk(ctx); let t = 0; const R = 300; S.defZero = 5;
                H.add({ update(dt) {
                    if (!H.alive()) return false; t += dt; const mm = B.me();
                    B.enemies().forEach(e => { if (!alive(e)) return; const d = Math.hypot(mm.x - e.x, mm.y - e.y); if (d > R + e.r || d < 60) return; const k = Math.min(260 * dt * (e.boss ? 0.5 : 1), d - 60) / d; e.x += (mm.x - e.x) * k; e.y += (mm.y - e.y) * k; });
                    if (t >= 0.55) { m.circle(mm.x, mm.y, 150, 1.0, e => B.setStun(e, 3)); H.flash(mm.x, mm.y, 150, '#ff9a5a'); popup('💥 衝突！', '#ff9a5a'); return false; }
                    return true;
                }, draw(c) { const mm = B.me(); c.save(); c.strokeStyle = '#ff9a5a'; c.lineWidth = 4; for (let i = 0; i < 3; i++) { const f = ((t * 2.8 + i / 3) % 1); c.globalAlpha = 1 - f; c.beginPath(); c.arc(mm.x, mm.y, R * (1 - f), 0, TAU); c.stroke(); } c.restore(); } });
            } }
        });
    def('barbarian', 'bar_unsinkable', '不沈の巨躯', '🗿',
        'スキル使用中、あらゆる状態異常を無効化し、受けるダメージを70%カットする。', '通常移動速度が常に50%低下し、ダッシュやステップなどの回避行動が一切不可になる。', {
            stats: { moveSpd: -0.5 }, dashOk: () => false,
            onCast() { S.skillT = 2.5; },                               // 「スキル使用中」＝発動から2.5秒
            incoming() { return S.skillT > 0 ? 0.3 : 1; },
            update(dt) { if (S.skillT > 0) { S.skillT -= dt; const m = me(); m.stunImm = Math.max(m.stunImm || 0, 0.3); m.poisonT = 0; } }
        });
    def('barbarian', 'bar_windrunner', 'ウィンドランナー', '🌪️',
        '「大旋回」が敵の弾丸をすべて消し去る烈風を巻き起こす。', '大旋回の威力が40%低下し、旋回中の方向転換が一切できなくなる（直線移動のみ）。', {
            form: { bar_spin(ctx, H) { spinForm(ctx, H, { steer: false, clear: 150, dmg: 0.33, col: '#bfeaff' }); } }
        });

    // =========================================================================
    //  🏰 ジャガーノート
    // =========================================================================
    def('juggernaut', 'jug_fortress', '移動要塞', '🏯',
        '「城壁展開」の壁が、自分の前進に合わせてゆっくり動き、前方を完全にガードする。', '城壁展開中の旋回（左右への方向転換）と後退が一切できなくなる。', {
            moveFilter(mx, my) { if (!(S.fortT > 0)) return [mx, my]; const d = Math.max(0, mx * Math.cos(S.fortA) + my * Math.sin(S.fortA)); return [Math.cos(S.fortA) * d, Math.sin(S.fortA) * d]; },
            moveMul() { return S.fortT > 0 ? 0.7 : 1; },
            update(dt) { if (S.fortT > 0) S.fortT -= dt; },
            form: { jug_wall(ctx, H) {
                const m = H.mk(ctx), a = ctx.ang, L = 120; S.fortT = 6; S.fortA = a; let t = 6;
                H.add({ update(dt) {
                    t -= dt; const mm = B.me(), cx = mm.x + Math.cos(a) * 130, cy = mm.y + Math.sin(a) * 130, px = -Math.sin(a), py = Math.cos(a);
                    const bl = B.eBullets(), x1 = cx + px * L, y1 = cy + py * L, x2 = cx - px * L, y2 = cy - py * L;
                    for (let i = bl.length - 1; i >= 0; i--) if (B.distSeg(bl[i].x, bl[i].y, x1, y1, x2, y2) < 24 + bl[i].r) bl.splice(i, 1);
                    S.wall = { x1, y1, x2, y2 }; return t > 0 && B.isRun();
                }, draw(c) { const w = S.wall; if (!w || t <= 0) return; c.save(); c.strokeStyle = '#6b7685'; c.lineWidth = 28; c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke(); c.strokeStyle = '#c9d3df'; c.lineWidth = 6; c.stroke(); c.restore(); } });
                m.circle(me().x + Math.cos(a) * 130, me().y + Math.sin(a) * 130, 80, 0.6);
            } }
        });
    def('juggernaut', 'jug_comet', 'コメット・チャージ', '☄️',
        '「暴走突進」中に自由に方向転換が可能になり、壁激突時に画面全体の敵を吹き飛ばす大爆発を起こす。', '突進を手動で停止できなくなり、壁にぶつかるまで走り続ける。（ステージ外落下に注意）', {
            moveFilter(mx, my) { return S.comet ? [0, 0] : [mx, my]; },
            form: { jug_charge(ctx, H) {
                const m = H.mk(ctx), w = B.world(); let a = ctx.ang, t = 0; S.comet = true; const SPD = 520;
                H.add({ update(dt) {
                    t += dt; const mm = B.me(), inp = B.input(); mm.inv = Math.max(mm.inv || 0, 0.3);
                    if (inp && (inp.mx || inp.my)) { let da = Math.atan2(inp.my, inp.mx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); a += Math.max(-4 * dt, Math.min(4 * dt, da)); }
                    B.moveMe(Math.cos(a) * SPD * dt, Math.sin(a) * SPD * dt);
                    B.enemies().forEach(e => { if (alive(e) && Math.hypot(e.x - mm.x, e.y - mm.y) < 64 + e.r) { m.hit(e, 0.6, a); e.x += Math.cos(a) * 40; e.y += Math.sin(a) * 40; } });
                    const edge = 44, hitWall = mm.x < edge || mm.y < edge || mm.x > w.w - edge || mm.y > w.h - edge;
                    if (hitWall || t > 7) { S.comet = false; B.enemies().forEach(e => { if (alive(e)) { m.hit(e, 3.0, angTo(mm, e)); if (!e.boss) { e.x += (e.x - mm.x) * 0.3; e.y += (e.y - mm.y) * 0.3; } } }); H.flash(mm.x, mm.y, 420, '#ffb04a'); popup('💥 大爆発！', '#ffb04a'); return false; }
                    return B.isRun() && !mm.dead;
                }, draw(c) { const mm = B.me(); c.save(); c.strokeStyle = 'rgba(255,200,120,.8)'; c.lineWidth = 6; c.beginPath(); c.moveTo(mm.x, mm.y); c.lineTo(mm.x - Math.cos(a) * 80, mm.y - Math.sin(a) * 80); c.stroke(); c.restore(); } });
            } }
        });
    def('juggernaut', 'jug_rod', '避雷針の呪縛', '⚡',
        '「大地の鎖」で縫い止めた敵へのダメージが、鎖で繋がれた他の敵にも100%そのまま伝播する。', '大地の鎖の射程が「至近距離（目の前）」のみになり、拘束中の敵が倒れるまで自身もその場から動けなくなる。', {
            moveFilter(mx, my) { return S.rodT > 0 ? [0, 0] : [mx, my]; },
            update(dt) { if (S.rodT > 0) S.rodT -= dt; },
            form: { jug_chain(ctx, H) {
                const m = H.mk(ctx), mm = B.me(), main = H.nearestN(mm.x, mm.y, 170, 1)[0];
                if (!main) { m.circle(mm.x + Math.cos(ctx.ang) * 90, mm.y + Math.sin(ctx.ang) * 90, 70, 0.5); return; }
                const others = H.nearestN(main.x, main.y, 420, 4, [main]), all = [main].concat(others), hp = all.map(e => e.hp); let t = 0; S.rodT = 12;
                all.forEach(e => m.hit(e, 0.8));
                H.add({ update(dt) {
                    t += dt; all.forEach(e => { if (alive(e)) { if (e.boss) B.setSt(e, { slow: 1 }); else B.setStun(e, 0.6); } });
                    const loss = all.map((e, i) => Math.max(0, hp[i] - e.hp));          // 伝播：自分以外の鎖の仲間が受けた分を、そのまま受ける
                    const total = loss.reduce((a, b) => a + b, 0);
                    all.forEach((e, i) => { hp[i] = e.hp; const add = total - loss[i]; if (add > 0 && alive(e)) { B.dealHit(e, Math.max(1, Math.round(add)), {}); hp[i] = e.hp; } });
                    if (!alive(main) || t > 12) { S.rodT = 0; return false; } return B.isRun();
                }, draw(c) { c.save(); c.strokeStyle = '#8a9bb0'; c.lineWidth = 4; c.setLineDash([8, 6]); all.forEach(e => { if (alive(e) && e !== main && alive(main)) { c.beginPath(); c.moveTo(main.x, main.y); c.lineTo(e.x, e.y); c.stroke(); } }); c.restore(); } });
            } }
        });
    def('juggernaut', 'jug_spike', 'スパイク・シールド', '🦔',
        '城壁や突進で敵を弾き飛ばした際、相手の最大HPの20%を削るトゲダメージを与える。', '自身の通常攻撃力が50%低下し、敵を倒した際の経験値やゴールドが半分になる。', {
            stats: { atkPct: -0.5, goldPct: -0.5 },               // 近似：ゴールドは半分。経験値の増減は、戦闘エンジンに窓口が無いため未対応
            onFormCast(key) { if (key === 'jug_wall' || key === 'jug_charge') S.spikeT = 2.2; },
            onHit(e, dmg) { if (S.spikeT > 0 && e && e.maxHp) dmg += e.maxHp * (e.boss ? 0.02 : 0.2); return dmg; },
            update(dt) { if (S.spikeT > 0) S.spikeT -= dt; }
        });
    def('juggernaut', 'jug_retaliate', '不屈の報復', '🛡️',
        '敵の弾を「城壁展開」で1発防ぐたびに攻撃力が20%上昇（最大10スタック）。次の攻撃が確定クリティカルになる。', '城壁の耐久値（HP）が設定され、壊されると自身が5秒間スタン状態になる。', {
            castMul() { return 1 + 0.2 * (S.stacks || 0); },
            onHit(e, dmg) { if (S.critNext) { S.critNext = false; B.popup('CRIT', e.x, e.y - e.r - 20, '#ffd84a'); return dmg * 1.6; } return dmg; },
            form: { jug_wall(ctx, H) {
                const m = H.mk(ctx), a = ctx.ang, me0 = B.me(), cx = me0.x + Math.cos(a) * 130, cy = me0.y + Math.sin(a) * 130, px = -Math.sin(a), py = Math.cos(a), L = 110;
                const x1 = cx + px * L, y1 = cy + py * L, x2 = cx - px * L, y2 = cy - py * L; let t = 6, hp = 100;
                m.line(x1, y1, x2, y2, 40, 0.6); H.flash(cx, cy, 90, '#b0bcc9');
                H.add({ update(dt) {
                    t -= dt; const bl = B.eBullets();
                    for (let i = bl.length - 1; i >= 0; i--) { const b = bl[i]; if (B.distSeg(b.x, b.y, x1, y1, x2, y2) < 20 + b.r) { bl.splice(i, 1); hp -= 12; S.stacks = Math.min(10, (S.stacks || 0) + 1); S.critNext = true; popup('攻撃力UP ×' + S.stacks, '#ffb347'); } }
                    if (hp <= 0) { B.stunSelf(5); popup('💥 城壁が壊れた！', '#ff7b7b'); return false; }
                    return t > 0 && B.isRun();
                }, draw(c) { c.save(); c.globalAlpha = Math.min(1, t); c.strokeStyle = '#6b7685'; c.lineWidth = 26; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = hp > 40 ? '#c9d3df' : '#ff8a7a'; c.lineWidth = 6 * Math.max(0.3, hp / 100); c.stroke(); c.restore(); } });
            } }
        });

    // =========================================================================
    //  🗡️ ブレードマスター
    // =========================================================================
    def('blademaster', 'bm_silence', '静寂の一閃', '🌑',
        '「居合の構え」の溜め時間が倍になる代わりに威力が4倍になり、画面内の全敵を一瞬で斬り抜ける。', '溜め中に攻撃を受けると即座に発動が失敗し、3秒間行動不能（無防備）になる。', {
            onHurt() { if (S.iaiOn) S.iaiFail = true; },
            form: { bm_iai(ctx, H) {
                const m = H.mk(ctx); let t = 0; S.iaiOn = true; S.iaiFail = false;
                H.add({ update(dt) {
                    t += dt; if (!B.isRun()) { S.iaiOn = false; return false; }
                    if (S.iaiFail) { S.iaiOn = false; B.stunSelf(3); popup('⚠ 溜め失敗…', '#ff7b7b'); return false; }
                    if (t < 0.9) return true;
                    S.iaiOn = false; const mm = B.me();
                    B.enemies().forEach(e => { if (alive(e)) { m.hit(e, 8.0, angTo(mm, e)); B.fxLine(mm.x, mm.y, e.x, e.y, '#ffffff', 40); } });
                    return false;
                }, draw(c) { if (t >= 0.9) return; const mm = B.me(); c.save(); c.strokeStyle = 'rgba(200,240,255,' + (0.3 + t * 0.6) + ')'; c.lineWidth = 2 + t * 10; c.beginPath(); c.arc(mm.x, mm.y, 30 + t * 40, 0, TAU); c.stroke(); c.restore(); } });
            } }
        });
    def('blademaster', 'bm_mirage', '虚像の舞', '👥',
        '「影断ち」の残像が、本体が次に繰り出すスキル（居合や檻）を100%の威力でコピーして発動する。', '本体の全スキルの消費リソース（マナ等）が2倍になり、残像が出ている間は自身の防御力が半減する。', {
            costMul: () => 2, incoming() { return S.mirage ? 1.6 : 1; },
            onFormCast(key, ctx) {
                if (S.copying || !S.mirage || key === 'bm_shadow') return;
                const img = S.mirage; S.mirage = null;
                setTimeout(() => { if (!B.isRun()) return; const m = me(), ox = m.x, oy = m.y; S.copying = true; m.x = img.x; m.y = img.y; try { castForm(key, Object.assign({}, ctx)); } finally { m.x = ox; m.y = oy; S.copying = false; } B.ring(img.x, img.y, 90, '#9ad8ff'); }, 350);
            },
            form: { bm_shadow(ctx, H) {
                H.base('bm_shadow', ctx); const m = me(); S.mirage = { x: m.x, y: m.y, t: 12 };
            } },
            update(dt) { if (S.mirage) { S.mirage.t -= dt; if (S.mirage.t <= 0) S.mirage = null; } },
            draw(c) { if (!S.mirage) return; c.save(); c.globalAlpha = 0.4 + 0.2 * Math.sin(Date.now() / 120); c.fillStyle = '#9ad8ff'; c.beginPath(); c.arc(S.mirage.x, S.mirage.y, 24, 0, TAU); c.fill(); c.restore(); }
        });
    def('blademaster', 'bm_eternal', '無限の檻', '⛓️',
        '「剣閃の檻」の持続時間が3倍になり、敵を永遠に切り刻み続ける。', '発動中、自身のHPが秒間5%ずつ強制ドレインされ、スキルを手動解除できなくなる。', {
            moveFilter(mx, my) { return S.cageOn ? [0, 0] : [mx, my]; },
            form: { bm_cage(ctx, H) {
                const m = H.mk(ctx); let k = 0, t = 0, tg = B.nearestEnemy(me().x, me().y, 430);
                if (!tg) { m.cone(me().x, me().y, ctx.ang, 140, 2.4, 1.0); return; }
                S.cageOn = true;
                H.add({ update(dt) {
                    if (!H.alive()) { S.cageOn = false; return false; } t += dt; drain(0.05, dt);
                    if (!alive(tg)) tg = B.nearestEnemy(me().x, me().y, 520); if (!tg) { S.cageOn = false; return false; }
                    while (k < 18 && t >= k * 0.09) { const a = k * TAU / 6 + 0.4, px = tg.x + Math.cos(a) * 85, py = tg.y + Math.sin(a) * 85, f = { x: me().x, y: me().y }; B.teleportMe(px, py); B.fxLine(f.x, f.y, px, py, '#e6f6ff', 16); m.circle(tg.x, tg.y, 95, 0.5); k++; }
                    if (k >= 18) { S.cageOn = false; return false; } return true;
                }, draw() { } });
            } }
        });
    def('blademaster', 'bm_wind', '風の加護', '🍃',
        '攻撃を当てるたびに移動速度と回避率が上昇（最大80%UP）し、敵の攻撃を自動ステップでいなし続ける。', '最大HPが常に50%低下し、「一撃でも直撃を受けたら即死」の超紙耐久になる。', {
            stats: { hpPct: -0.5 },
            setup() { S.wind = 0; S.dodge0 = B.getStat('dodge'); },
            onHit(e, dmg) { S.wind = Math.min(0.8, (S.wind || 0) + 0.04); S.windT = 4; return dmg; },
            update(dt) { if (S.windT > 0) S.windT -= dt; else if (S.wind > 0) S.wind = Math.max(0, S.wind - 0.2 * dt); B.setStat('dodge', (S.dodge0 || 0) + S.wind); },
            moveMul() { return 1 + (S.wind || 0); },
            incoming() { return 99999; }                                // 直撃＝即死（回避できたときは、ここまで来ない）
        });
    def('blademaster', 'bm_mindeye', '心眼', '👁️',
        '正面から受けた敵の攻撃をすべて自動で受け流し（パリィ）、即座に「影断ち」で自動反撃する。', '背後および側面からの被ダメージが3倍になり、通常攻撃（プレイヤーの手動攻撃）ができなくなる。', {
            attackOk: () => false,
            incoming() {     // 近似：攻撃元は「いちばん近い敵（弾がすぐ近くにあればその弾）」。自分の向きの前方±70°を「正面」とする
                const m = me(); let src = null, bd = 140;
                B.eBullets().forEach(b => { const d = Math.hypot(b.x - m.x, b.y - m.y); if (d < bd) { bd = d; src = b; } });
                if (!src) src = B.nearestEnemy(m.x, m.y, 460); if (!src) return 1;
                let da = angTo(m, src) - m.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
                if (Math.abs(da) <= 1.22) { if (!(S.parryCd > 0)) { S.parryCd = 0.5; popup('✨ パリィ！', '#9df0ff'); castForm('bm_shadow', miniCtx(angTo(m, src), 1.0)); } return 0; }
                return 3;
            },
            update(dt) { if (S.parryCd > 0) S.parryCd -= dt; }
        });

    // =========================================================================
    //  ⚜️ クルセイダー
    // =========================================================================
    function shieldBounce(ctx, H, o) {          // 聖盾投げの共通：o.targets() で次の行き先を決める
        const m = H.mk(ctx); let cur = { x: me().x, y: me().y }, state = 'go', t = 0, nextAt = 0, hits = 0, tgt = null;
        if (o.lock) S.shieldOut = true;
        H.add({ update(dt) {
            if (!H.alive()) { S.shieldOut = false; return false; } t += dt;
            if (state === 'go' && (!tgt || (tgt.fake !== true && !alive(tgt) && !tgt.ally))) { if (t >= nextAt) { tgt = o.next(cur, t); if (!tgt) state = 'back'; } }
            if (t >= o.life) state = 'back';
            const dest = state === 'back' ? B.me() : tgt; if (!dest) { state = 'back'; return true; }
            const dx = dest.x - cur.x, dy = dest.y - cur.y, d = Math.hypot(dx, dy), step = 900 * dt;
            if (d <= step + 8) {
                cur.x = dest.x; cur.y = dest.y;
                if (state === 'back') { S.shieldOut = false; if (o.onBack) o.onBack(hits); return false; }
                o.onArrive(tgt, m); hits++; tgt = null; nextAt = t + (o.gap || 0.2);
            } else { cur.x += dx / d * step; cur.y += dy / d * step; }
            return true;
        }, draw(c) { c.save(); c.translate(cur.x, cur.y); c.fillStyle = '#e8f0ff'; c.strokeStyle = '#d4a52a'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#d4a52a'; c.fillRect(-3, -12, 6, 24); c.fillRect(-12, -3, 24, 6); c.restore(); } });
    }
    def('crusader', 'cru_boomerang', '審判のブーメラン', '🪃',
        '「聖盾投げ」の跳ね返り数が無限になり、敵の間をピンボールのように往復し続ける。', '投げた盾が戻ってくるまで、他のスキルと通常攻撃が一切使用不可になる。', {
            castOk: () => !S.shieldOut, attackOk: () => !S.shieldOut,
            form: { cru_shield(ctx, H) {
                let last = null;
                shieldBounce(ctx, H, { lock: true, life: 6, gap: 0.12,
                    next(cur) { const c = H.nearestN(cur.x, cur.y, 520, 4, last ? [last] : []); return c.length ? c[Math.floor(Math.random() * c.length)] : (last && alive(last) ? last : null); },
                    onArrive(e, m) { last = e; if (alive(e)) { m.hit(e, 0.8); H.flash(e.x, e.y, 50, '#fff3b0'); } } });
            } }
        });
    def('crusader', 'cru_judgement', '天罰の導き', '⚖️',
        '「裁きの剣」が着弾後も消えず、周囲の敵を自動で感知して追尾し、落雷を落とし続ける。', '裁きの剣のクールダウンが30秒（非常に長い）になり、発動時に自身の最大マナの80%を永続ロックされる。', {
            cdMul: s => s.params.classForm === 'cru_sword' ? 3.4 : 1,
            update(dt) { if (S.eLock) { const m = me(), cap = B.energyMax() * 0.2; if (m.energy > cap) m.energy = cap; } },
            form: { cru_sword(ctx, H) {
                const m = H.mk(ctx), tp = H.targetPoint(ctx, 470, 260); S.eLock = true; popup('🔒 マナの80%をロック', '#ffd84a');
                if (S.sword) S.sword.dead = true; const sw = S.sword = { x: tp.x, y: tp.y, dead: false }; let t = 0, tick = 0;
                m.circle(tp.x, tp.y, 78, 1.4); H.flash(tp.x, tp.y, 85, '#fff3b0');
                H.add({ update(dt) {
                    if (sw.dead) return false; t += dt; tick += dt;
                    if (tick >= 1.0) { tick = 0; const e = H.nearestN(sw.x, sw.y, 650, 1)[0]; if (e) { sw.x += (e.x - sw.x) * 0.5; sw.y += (e.y - sw.y) * 0.5; m.circle(e.x, e.y, 62, 1.0); H.flash(e.x, e.y, 70, '#fff3b0'); B.line(e.x, e.y - 300, e.x, e.y); } }
                    return B.isRun();
                }, draw(c) { c.save(); c.fillStyle = '#fff3b0'; c.fillRect(sw.x - 5, sw.y - 50, 10, 60); c.strokeStyle = 'rgba(255,240,160,.5)'; c.beginPath(); c.arc(sw.x, sw.y, 70, 0, TAU); c.stroke(); c.restore(); } });
            } }
        });
    def('crusader', 'cru_martyr', '殉教者の血陣', '🩸',
        '「誓約の領域」の回復効果が消える代わりに、領域内の味方の攻撃力とクリティカル率を2倍にする。', '領域内にいる味方は、秒間ダメージを受ける（回復陣がスリップダメージ陣に変化）。', {
            castMul() { return S.inZone ? 2 : 1; },
            onHit(e, dmg) { if (S.inZone && Math.random() < 0.3) { B.popup('CRIT', e.x, e.y - e.r - 20, '#ffd84a'); return dmg * 1.5; } return dmg; },
            update(dt) { const z = S.zone; if (z && z.t > 0) { z.t -= dt; const m = me(); S.inZone = Math.hypot(m.x - z.x, m.y - z.y) <= z.R; if (S.inZone) drain(0.03, dt); } else S.inZone = false; },
            form: { cru_zone(ctx, H) {
                const m = H.mk(ctx), mm = B.me(), z = S.zone = { x: mm.x, y: mm.y, R: 170, t: 8 };
                zoneEnt(H, { x: z.x, y: z.y, R: z.R, life: 8, tick: 0.5, col: '#ff6a6a', fill: 'rgba(255,80,80,.14)', onTick: () => m.circle(z.x, z.y, z.R, 0.2) });
            } }
        });
    def('crusader', 'cru_guardian', 'ガーディアン・スピリット', '👼',
        '盾が跳ね返った味方に、3秒間あらゆるダメージを無効化する聖なる無敵バリアを付与する。', '自分自身にはバリアが絶対に付与されず、味方にバリアが付与されるたびに自分のHPが10%削れる。', {
            form: { cru_shield(ctx, H) {
                const al = Object.keys(B.allies() || {}).map(k => B.allies()[k]).filter(a => a && !a.dead).slice(0, 3); let i = 0;
                if (!al.length) { H.base('cru_shield', ctx); popup('（味方がいないと、バリアは付かない）', '#9aa6c4'); return; }
                shieldBounce(ctx, H, { life: 6, gap: 0.1,
                    next() { return i < al.length ? Object.assign(al[i++], { ally: true }) : null; },
                    onArrive(a) { B.allyBarrier(a.id, 3); B.ring(a.x, a.y, 60, '#fff3b0'); const m = me(); m.hp = Math.max(1, m.hp - m.maxHp * 0.1); popup('🛡 ' + (a.name || '味方') + 'にバリア', '#fff3b0'); } });
            } }
        });
    def('crusader', 'cru_lightning', 'ライトニング・プレッジ', '🌩️',
        '「誓約の領域」内に「裁きの剣」を落とすと、領域全体が超高火力の電気爆発を起こす。', '2つのスキルが同時に使用可能（両方クールダウンが明けている状態）でなければ、どちらのスキルも発動できなくなる。', {
            castOk(s) { const f = s.params.classForm; if (f !== 'cru_sword' && f !== 'cru_zone') return true; const other = slotsOf(f === 'cru_sword' ? 'cru_zone' : 'cru_sword')[0]; if (other && other.cdLeft > 0) { popup('2つとも準備できていません', '#ff9a9a'); return false; } return true; },
            update(dt) { if (S.zone2) { S.zone2.t -= dt; if (S.zone2.t <= 0) S.zone2 = null; } },
            form: {
                cru_zone(ctx, H) { H.base('cru_zone', ctx); const m = me(); S.zone2 = { x: m.x, y: m.y, R: 150, t: 6 }; },
                cru_sword(ctx, H) {
                    const z = S.zone2, tp = H.targetPoint(ctx, 470, 260);
                    if (z && Math.hypot(tp.x - z.x, tp.y - z.y) <= z.R) { const m = H.mk(ctx); m.circle(z.x, z.y, z.R + 40, 6.0); H.flash(z.x, z.y, z.R + 40, '#9df0ff'); B.line(z.x, z.y - 400, z.x, z.y); popup('⚡ 電気爆発！', '#9df0ff'); S.zone2 = null; }
                    else H.base('cru_sword', ctx);
                }
            }
        });

    // =========================================================================
    //  🔫 ガンスリンガー
    // =========================================================================
    def('gunslinger', 'gun_gatling', 'ガトリング・フェスティバル', '🎆',
        '「早撃ちの舞」の発射速度が4倍になり、弾幕で周囲の敵を消し飛ばす。', '弾の射程が「近接（密着距離）」まで極端に短くなり、発動中は一切移動できなくなる。', {
            form: { gun_fan(ctx, H) {
                const m = H.mk(ctx); let w = 0, t = 0; S.lockT = 24 * 0.045 + 0.1;
                H.add({ update(dt) { if (!H.alive()) return false; t += dt;
                    while (w < 24 && t >= w * 0.045) { const mm = B.me(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + w * 0.26; H.fire(m, { x: mm.x, y: mm.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, r: 7, life: 0.13, mult: 0.3, color: '#ffe08a' }); } mm.ang += 0.5; w++; }
                    return w < 24; }, draw() { } });
            } }
        });
    def('gunslinger', 'gun_ricochet', '跳弾の魔術師', '🎱',
        '「跳弾」が壁や敵に跳ね返るたびに威力が50%ずつ乗算で上昇していく（最大10回）。', '跳ね返った弾が自分自身にも当たるようになる（自傷あり）。狭い部屋で撃つと自爆の危険。', {
            form: { gun_ricochet(ctx, H) {
                const m = H.mk(ctx), mm = B.me(); let n = 0;
                H.fire(m, { x: mm.x, y: mm.y, vx: Math.cos(ctx.ang) * 540, vy: Math.sin(ctx.ang) * 540, r: 11, life: 4, mult: 0.9, pierce: 99, bounce: 10, rehit: 0.45, color: '#ffd1a0',
                    onBounce(b) { n++; b.mult *= 1.5; b.r = Math.min(26, b.r + 1); },
                    tick(b) { if (n > 0 && Math.hypot(b.x - B.me().x, b.y - B.me().y) < b.r + B.me().r && !(b.selfCd > 0)) { b.selfCd = 0.6; B.selfHit(0.04 * Math.min(6, b.mult)); } else if (b.selfCd > 0) b.selfCd -= 0.016; } });
            } }
        });
    def('gunslinger', 'gun_smoke', 'スモーク・アサシン', '🌫️',
        '「煙幕弾」の中にいる間は完全ステルスとなり、煙内からの攻撃がすべて確定クリティカルになる。', '煙幕の外にいる敵からは自分の姿が見えないが、自分からも煙幕の外にいる敵の姿が見えなくなる（画面が真っ黒になる）。', {
            incoming() { return S.inSmoke ? 0.15 : 1; },                            // 近似：敵の索敵は変えられないので、煙の中は被ダメージ85%カットで「見つからない」を表す
            castMul() { return S.inSmoke ? 1.5 : 1; },
            onHit(e, dmg) { if (S.inSmoke) { B.popup('CRIT', e.x, e.y - e.r - 20, '#ffd84a'); return dmg * 1.6; } return dmg; },
            update(dt) { if (S.smoke) { S.smoke.t -= dt; const m = me(); S.inSmoke = S.smoke.t > 0 && Math.hypot(m.x - S.smoke.x, m.y - S.smoke.y) <= S.smoke.R; if (S.smoke.t <= 0) S.smoke = null; } else S.inSmoke = false; },
            draw(c) {      // 煙の中にいる間は、画面が真っ黒（自分のまわりだけ見える）
                if (!S.inSmoke) return; const m = me(); c.save(); c.fillStyle = 'rgba(0,0,0,.93)'; c.beginPath(); c.rect(m.x - 2200, m.y - 1600, 4400, 3200); c.arc(m.x, m.y, 85, 0, TAU, true); c.fill('evenodd'); c.restore();
            },
            form: { gun_smoke(ctx, H) {
                const mm = B.me(); S.smoke = { x: mm.x, y: mm.y, R: 160, t: 6 };
                zoneEnt(H, { x: mm.x, y: mm.y, R: 160, life: 6, tick: 1, col: '#888', fill: 'rgba(120,125,135,.35)' });
            } }
        });
    def('gunslinger', 'gun_oneshot', '一撃必殺の美学', '🎯',
        'すべての通常弾・スキル弾が敵と障害物を無限に「貫通」するようになる。', '装弾数が常に「1発」になり、1発撃つたびに長いリロードを挟む超単発型になる。', {
            stats: { pierce: 99 }, pierceAll: () => true,
            afterAttack() { me().atkCd = Math.max(me().atkCd || 0, 1.7); },
            cdMul: () => 1.6
        });
    def('gunslinger', 'gun_gunkata', 'ガンカタ', '🕺',
        '敵の近接攻撃を回避（ステップ）した際、自動で至近距離からカウンターの「早撃ち」を叩き込む。', '遠距離からの銃撃による被ダメージが2倍になり、遠距離の敵に対する誘導性能がゼロになる。', {
            onDash() {
                const m = me(), n = B.nearestEnemy(m.x, m.y, 170); if (!n) return;
                const ctx = miniCtx(angTo(m, n), 1.0), H = CF().H, mk = H.mk(ctx); popup('🔫 カウンター！', '#ffe08a');
                for (let i = 0; i < 8; i++) { const a = angTo(m, n) + (i - 3.5) * 0.09; H.fire(mk, { x: m.x, y: m.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, r: 8, life: 0.4, mult: 0.45, color: '#ffe08a' }); }
            },
            incoming() { const m = me(), n = B.nearestEnemy(m.x, m.y, 230); return n ? 1 : 2; }       // 近似：近くに敵がいない（遠くから撃たれている）と2倍
        });

    // =========================================================================
    //  🥷 アサシン
    // =========================================================================
    def('assassin', 'asn_backstab', 'バックスタブ・マスター', '🗡️',
        '「影渡り」で背後に回った直後の一撃が、敵の防御力を100%無視し、さらに威力が3倍になる。', '敵の正面から攻撃した場合のダメージが「1」になる。完全に背後を取る立ち回りが必須。', {
            dealMul(e, dmg) { return S.bsT > 0 ? dmg * 3 : 1; },                     // 近似：「背後」＝影渡りの直後0.8秒だけ。防御無視は、倍率に含める
            update(dt) { if (S.bsT > 0) S.bsT -= dt; },
            form: { asn_blink(ctx, H) { S.bsT = 0.8; H.base('asn_blink', ctx); } }
        });
    def('assassin', 'asn_pandemic', 'パンデミック', '☣️',
        '「毒針の雨」の毒状態の敵が死亡した瞬間、周囲に強力な毒を大爆発拡散させ、連鎖滅殺する。', '毒針の雨の消費リソースが跳ね上がり、さらにこのスキルで敵を倒してもHP・マナなどの回復アイテムが一切ドロップしなくなる。', {
            costMul: s => s.params.classForm === 'asn_needles' ? 2.5 : 1,
            onKill(e) { if (e && e.pand > 0) { const m = CF().H.mk(miniCtx(0, 2.5)); m.circle(e.x, e.y, 170, 1.0, o => { o.pand = 8; }); CF().H.flash(e.x, e.y, 170, '#b46bff'); } },
            update(dt) { B.enemies().forEach(e => { if (e.pand > 0) e.pand -= dt; }); },
            form: { asn_needles(ctx, H) {      // 針が刺さった敵に毒（e.pand）を付ける。近似：回復アイテムのドロップ停止は、戦闘エンジンに窓口が無いため未対応
                const m = H.mk(ctx), tp = H.targetPoint(ctx, 500, 260); let t = 0, k = 0;
                H.add({ update(dt) { t += dt; while (k < 14 && t >= k * 0.057) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * 150; m.circle(tp.x + Math.cos(a) * r, tp.y + Math.sin(a) * r, 44, 0.32, e => { e.pand = 8; B.setSt(e, { weaken: 1 }); }); k++; } return k < 14; },
                    draw(c) { c.save(); c.strokeStyle = 'rgba(180,107,255,.5)'; c.setLineDash([6, 6]); c.beginPath(); c.arc(tp.x, tp.y, 150, 0, TAU); c.stroke(); c.restore(); } });
            } }
        });
    def('assassin', 'asn_triple', 'トリプルフラッシュ', '🌀',
        '「分身の術」で召喚される分身が2体に増え、本体と全く同じ攻撃を行う。', '分身のHPが「1」になり、さらに分身がダメージを受けると、そのダメージがそのまま本体にフィードバックされる。', {
            form: { asn_clone(ctx, H) {
                const m = H.mk(ctx), mm = B.me(); const clones = [0, 1].map(i => ({ x: mm.x + (i ? 55 : -55), y: mm.y + 20, cd: 0.3 + i * 0.3, hp: 1 })); let t = 0;
                H.add({ update(dt) {
                    if (!B.isRun()) return false; t += dt; const me2 = B.me();
                    for (const cl of clones) {
                        if (cl.hp <= 0) continue;
                        const tg = B.nearestEnemy(cl.x, cl.y, 420), gx = tg ? tg.x : me2.x, gy = tg ? tg.y : me2.y, d = Math.hypot(gx - cl.x, gy - cl.y);
                        if (d > 42) { cl.x += (gx - cl.x) / d * 270 * dt; cl.y += (gy - cl.y) / d * 270 * dt; }
                        cl.cd -= dt; if (tg && d < 58 + tg.r && cl.cd <= 0) { cl.cd = 0.6; m.circle(cl.x, cl.y, 66, 1.0); H.flash(cl.x, cl.y, 55, '#a68bff'); }
                        const bl = B.eBullets(); let hit = false;
                        for (let i = bl.length - 1; i >= 0; i--) if (Math.hypot(bl[i].x - cl.x, bl[i].y - cl.y) < 24 + bl[i].r) { bl.splice(i, 1); hit = true; break; }
                        if (!hit) hit = B.enemies().some(e => alive(e) && Math.hypot(e.x - cl.x, e.y - cl.y) < e.r + 14 && Math.random() < dt * 1.5);
                        if (hit) { cl.hp = 0; B.selfHit(0.06); popup('💥 分身が壊れた（本体にダメージ）', '#ff9a9a'); }
                    }
                    return t < 6 && clones.some(cl => cl.hp > 0);
                }, draw(c) { c.save(); clones.forEach(cl => { if (cl.hp <= 0) return; c.globalAlpha = 0.5 + 0.15 * Math.sin(t * 10); c.fillStyle = '#6f56d8'; c.strokeStyle = '#d8ccff'; c.lineWidth = 2; c.beginPath(); c.arc(cl.x, cl.y, 20, 0, TAU); c.fill(); c.stroke(); }); c.restore(); } });
            } }
        });
    def('assassin', 'asn_shadowstep', 'シャドウ・ステップ', '💨',
        '敵を倒すと「影渡り」のクールダウンが即座にリセットされ、連続テレポートが可能になる。', '「影渡り」を使用するたびに、自身の最大HPの5%（上限50%まで）が一時的にカットされる。（敵を倒し続けないとジリ貧）', {
            setup() { S.maxHp0 = me().maxHp; S.cut = 0; },
            onKill() { slotsOf('asn_blink').forEach(s => { s.cdLeft = 0; }); },
            update(dt) { if (S.cut > 0) { S.cut = Math.max(0, S.cut - 0.004 * dt); BY_ID.asn_shadowstep.apply(); } },
            apply() { const m = me(); m.maxHp = Math.max(1, Math.round(S.maxHp0 * (1 - S.cut))); if (m.hp > m.maxHp) m.hp = m.maxHp; },
            form: { asn_blink(ctx, H) { H.base('asn_blink', ctx); S.cut = Math.min(0.5, (S.cut || 0) + 0.05); BY_ID.asn_shadowstep.apply(); } }
        });
    def('assassin', 'asn_substitute', '身代わりの術', '🪵',
        '致命傷（HP0になる攻撃）を受けた際、身代わりの分身をその場に残して自身は全回復＆ステルスで離脱する。', 'このパークを装備している間、攻撃力が常に35%低下し、復活のクールダウンは5分間（1ステージに1回程度）。', {
            stats: { atkPct: -0.35 },
            fatal() {
                if (S.subCd > 0) return false; const m = me(); S.subCd = 300; S.decoy = { x: m.x, y: m.y, t: 3 };
                m.hp = m.maxHp; m.inv = Math.max(m.inv || 0, 3); m.invHard = Math.max(m.invHard || 0, 3); B.ring(m.x, m.y, 120, '#a68bff'); popup('🪵 身代わりの術！', '#d8ccff'); return true;
            },
            update(dt) { if (S.subCd > 0) S.subCd -= dt; if (S.decoy) { S.decoy.t -= dt; if (S.decoy.t <= 0) S.decoy = null; } },
            draw(c) { if (!S.decoy) return; c.save(); c.globalAlpha = Math.min(1, S.decoy.t); c.font = '34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🪵', S.decoy.x, S.decoy.y); c.restore(); }
        });

    // =========================================================================
    //  🪤 罠師
    // =========================================================================
    function netAt(H, ctx, x, y, R, opt) {      // 捕縛網を、その場所に出す（共通）
        const m = H.mk(ctx); m.circle(x, y, R, 0.6, e => { if (e.boss) B.setSt(e, { slow: 1 }); else B.setStun(e, opt && opt.stun || 1.5); }); H.flash(x, y, R, '#e8e8e8');
    }
    function minesForm(ctx, H, o) {              // 地雷原の共通：o.crawl / o.onTrigger / o.manual
        const m = H.mk(ctx); let t = 0, nextDrop = 0, n = 0; const mines = o.store || [];
        H.add({ update(dt) {
            if (!B.isRun()) return false; t += dt; const mm = B.me();
            if (t < 3 && t >= nextDrop && n < 8) { nextDrop += 0.35; n++; mines.push({ x: mm.x, y: mm.y, life: o.life || 20 }); }
            for (let i = mines.length - 1; i >= 0; i--) {
                const mi = mines[i]; mi.life -= dt; if (mi.life <= 0) { mines.splice(i, 1); continue; }
                if (o.crawl) { const tg = B.nearestEnemy(mi.x, mi.y, 420); if (tg) { const d = Math.hypot(tg.x - mi.x, tg.y - mi.y) || 1; mi.x += (tg.x - mi.x) / d * 170 * dt; mi.y += (tg.y - mi.y) / d * 170 * dt; } }
                if (o.manual) continue;
                if (B.enemies().some(e => alive(e) && Math.hypot(e.x - mi.x, e.y - mi.y) < 34 + e.r)) {
                    m.circle(mi.x, mi.y, 95, o.mult || 1.1, e => B.setStun(e, 0.4)); H.flash(mi.x, mi.y, 95, '#ffb04a');
                    if (o.selfDmg && Math.hypot(mm.x - mi.x, mm.y - mi.y) < 110) B.selfHit(0.07);
                    if (o.onTrigger) o.onTrigger(mi.x, mi.y, m); mines.splice(i, 1);
                }
            }
            return t < 3 || mines.length > 0;
        }, draw(c) { c.save(); mines.forEach(mi => { c.fillStyle = '#4a4036'; c.strokeStyle = o.col || '#ffd9a0'; c.lineWidth = 2; c.beginPath(); c.arc(mi.x, mi.y, 11, 0, TAU); c.fill(); c.stroke(); c.fillStyle = (Math.floor(mi.life * 3) % 2) ? '#ff6a5a' : '#6a2a22'; c.beginPath(); c.arc(mi.x, mi.y, 3.5, 0, TAU); c.fill(); }); c.restore(); } });
    }
    def('trapper', 'trp_crawler', 'マイン・クローラー', '🕷️',
        '「地雷原」の地雷が、周囲の敵を感知して自ら這って追尾し、必中の自爆特攻を行う。', '地雷の爆発が味方（プレイヤー自身含む）にも巻き込みダメージを与えるようになる。', {
            form: { trp_mines(ctx, H) { minesForm(ctx, H, { crawl: true, selfDmg: true, mult: 1.3, life: 14, col: '#ff9a6a' }); } }
        });
    def('trapper', 'trp_electro', 'エレクトロ・ネット', '🕸️',
        '「捕縛網」に電流が流れ、縛った敵の周囲にいる敵も感電させてまとめて完全移動不能にする。', '網の耐久値が大幅に下がり、攻撃を受けると罠が壊れるようになる（敵の攻撃や味方の範囲攻撃で消滅する）。', {
            form: { trp_net(ctx, H) {
                const m = H.mk(ctx), tp = H.targetPoint(ctx, 440, 250), R = 125; let t = 0, hp = 3; netAt(H, ctx, tp.x, tp.y, R + 110, { stun: 2.2 });
                H.add({ update(dt) {
                    t += dt; const bl = B.eBullets();
                    for (let i = bl.length - 1; i >= 0; i--) if (Math.hypot(bl[i].x - tp.x, bl[i].y - tp.y) < R + bl[i].r) { bl.splice(i, 1); hp--; }
                    if (hp <= 0) { H.flash(tp.x, tp.y, R, '#ff9a9a'); return false; }
                    if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) m.circle(tp.x, tp.y, R + 110, 0.2, e => { if (e.boss) B.setSt(e, { slow: 1 }); else B.setStun(e, 0.7); });
                    return t < 3.4;
                }, draw(c) { c.save(); c.strokeStyle = 'rgba(160,230,255,.9)'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t; c.beginPath(); c.moveTo(tp.x, tp.y); c.lineTo(tp.x + Math.cos(a) * (R + 110), tp.y + Math.sin(a) * (R + 110)); c.stroke(); } c.restore(); } });
            } }
        });
    def('trapper', 'trp_overclock', 'オーバークロック', '⚙️',
        '「自動砲台」を同時に最大3台まで設置できるようになり、圧倒的な面制圧が可能になる。', '砲台が「敵の攻撃対象（ヘイト）」を激しく集めるようになり、設置後数秒で集中砲火されて壊されやすくなる。', {
            setup() { S.turrets = []; },
            form: { trp_turret(ctx, H) {
                const m = H.mk(ctx), mm = B.me(), tr = { x: mm.x, y: mm.y, t: 8, hp: 4, cd: 0.2, ang: 0 };
                S.turrets.push(tr); if (S.turrets.length > 3) { S.turrets.shift().t = 0; }
                H.add({ update(dt) {
                    if (!B.isRun() || tr.t <= 0 || tr.hp <= 0) { const i = S.turrets.indexOf(tr); if (i >= 0) S.turrets.splice(i, 1); return false; }
                    tr.t -= dt; tr.cd -= dt; const tg = B.nearestEnemy(tr.x, tr.y, 460); if (tg) tr.ang = angTo(tr, tg);
                    if (tg && tr.cd <= 0) { tr.cd = 0.45; H.fire(m, { x: tr.x + Math.cos(tr.ang) * 20, y: tr.y + Math.sin(tr.ang) * 20, vx: Math.cos(tr.ang) * 640, vy: Math.sin(tr.ang) * 640, r: 7, life: 0.8, mult: 0.5, color: '#ffd9a0' }); }
                    const bl = B.eBullets(); for (let i = bl.length - 1; i >= 0; i--) if (Math.hypot(bl[i].x - tr.x, bl[i].y - tr.y) < 26) { bl.splice(i, 1); tr.hp--; }     // 近似：弾は、近くの砲台に吸われる
                    B.enemies().forEach(e => { if (alive(e) && Math.hypot(e.x - tr.x, e.y - tr.y) < e.r + 22) tr.hp -= dt * 1.4; });
                    return true;
                }, draw(c) { c.save(); c.translate(tr.x, tr.y); c.fillStyle = '#5b6470'; c.strokeStyle = tr.hp <= 1.5 ? '#ff7b7b' : '#c9d3df'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 17, 0, TAU); c.fill(); c.stroke(); c.rotate(tr.ang); c.fillStyle = '#c9d3df'; c.fillRect(0, -4, 26, 8); c.restore(); } });
            } }
        });
    def('trapper', 'trp_chain', 'トラップ・チェイン', '🔗',
        '敵が地雷を踏むと、自動的に捕縛網がその場所に射出され、コンボが自動発動する。', '地雷、捕縛網の両方のクールダウンが同時に消費され、どちらか片方でもクールダウン中の場合は罠が一切設置できなくなる。', {
            castOk(s) { const f = s.params.classForm; if (f !== 'trp_mines' && f !== 'trp_net') return true; const o = slotsOf(f === 'trp_mines' ? 'trp_net' : 'trp_mines')[0]; if (o && o.cdLeft > 0) { popup('罠がまだ準備できていません', '#ff9a9a'); return false; } return true; },
            onFormCast(key) { if (key === 'trp_mines' || key === 'trp_net') { const o = slotsOf(key === 'trp_mines' ? 'trp_net' : 'trp_mines')[0]; const me0 = slotsOf(key)[0]; if (o) o.cdLeft = Math.max(o.cdLeft || 0, me0 ? me0.cooldown : o.cooldown); } },
            form: { trp_mines(ctx, H) { minesForm(ctx, H, { onTrigger: (x, y) => netAt(H, ctx, x, y, 125) }); } }
        });
    def('trapper', 'trp_remote', 'リモート・デトネーション', '📡',
        'すべての罠（地雷・砲台）を任意のタイミングで一斉手動爆発させ、画面全体に即死級の大ダメージを与える。', '自動砲台の通常自動射撃機能が失われ、手動で爆発させる以外にダメージを与える手段がなくなる。', {
            setup() { S.rMines = []; S.rTurrets = []; },
            draw(c) { c.save(); S.rTurrets.forEach(t => { c.fillStyle = '#5b6470'; c.strokeStyle = '#ff9a6a'; c.lineWidth = 3; c.beginPath(); c.arc(t.x, t.y, 17, 0, TAU); c.fill(); c.stroke(); }); c.restore(); },
            form: {
                trp_mines(ctx, H) { minesForm(ctx, H, { manual: true, store: S.rMines, life: 60, col: '#ff6a5a' }); popup('📡 「捕縛網」スキルで一斉起爆', '#ff9a6a'); },
                trp_turret(ctx, H) { const mm = B.me(); S.rTurrets.push({ x: mm.x, y: mm.y }); if (S.rTurrets.length > 3) S.rTurrets.shift(); popup('📡 設置（自動では撃ちません）', '#ff9a6a'); },
                trp_net(ctx, H) {      // 「捕縛網」のスロットが、起爆スイッチになる
                    const m = H.mk(ctx); const all = S.rMines.splice(0).concat(S.rTurrets.splice(0)); if (!all.length) { popup('起爆する罠がありません', '#9aa6c4'); return; }
                    all.forEach(p => { m.circle(p.x, p.y, 210, 5.0); H.flash(p.x, p.y, 210, '#ff7a3d'); });
                    B.enemies().forEach(e => { if (alive(e)) m.hit(e, 1.5 * all.length * 0.5); });
                    popup('💥 一斉起爆 ×' + all.length, '#ff7a3d');
                }
            }
        });

    // =========================================================================
    //  🌀 エレメンタリスト
    // =========================================================================
    def('elementalist', 'ele_chaos', 'カオス・ボルテックス', '🌌',
        '「元素の渦」が3属性（炎・氷・雷）を同時に併せ持つ超巨大な混沌の渦に変化し、あらゆる属性シナジーを起こす。', '発動中、自身が「沈黙」状態（他のスキルが一切使えない）になり、渦の中心に向かって自分も引き寄せられる。', {
            castOk: () => !(S.silenceT > 0), update(dt) { if (S.silenceT > 0) S.silenceT -= dt; },
            form: { ele_vortex(ctx, H) {
                const m = H.mk(ctx), tp = H.targetPoint(ctx, 480, 250), R = 250; let t = 0, tick = 0; S.silenceT = 4;
                H.add({ update(dt) {
                    if (!B.isRun()) { S.silenceT = 0; return false; } t += dt; tick += dt; const mm = B.me();
                    B.enemies().forEach(e => { if (!alive(e)) return; const d = Math.hypot(tp.x - e.x, tp.y - e.y); if (d < R + e.r && d > 12) { const k = Math.min(110 * dt * (e.boss ? 0.3 : 1), d) / d; e.x += (tp.x - e.x) * k; e.y += (tp.y - e.y) * k; } });
                    const d = Math.hypot(tp.x - mm.x, tp.y - mm.y); if (d > 20) B.moveMe((tp.x - mm.x) / d * 100 * dt, (tp.y - mm.y) / d * 100 * dt);
                    if (tick >= 0.35) { tick = 0; m.circle(tp.x, tp.y, R, 0.9 * 1.5, e => B.setSt(e, { slow: 1, weaken: 1 })); }
                    if (t >= 4) { S.silenceT = 0; return false; } return true;
                }, draw(c) { c.save(); ['#ff7a3d', '#bfeaff', '#ffe14a'].forEach((col, j) => { c.strokeStyle = col; c.lineWidth = 4; c.globalAlpha = 0.8; c.beginPath(); for (let a = 0; a < 9; a += 0.2) { const r = (a / 9) * R, ang = a + t * 4 + j * 2.1; const x = tp.x + Math.cos(ang) * r, y = tp.y + Math.sin(ang) * r; if (a === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); }); c.restore(); } });
            } }
        });
    def('elementalist', 'ele_permafrost', '永久凍土', '🧊',
        '「氷柱の道」が通った場所が完全に凍りつき、その上を歩く敵を「永続的」に極大鈍足（スロウ）にする。', '氷柱の道のダメージがゼロになり、凍りついた床の上では味方の移動速度も30%低下する。', {
            setup() { S.frost = []; },
            moveMul() { const m = me(); return S.frost.some(f => Math.hypot(m.x - f.x, m.y - f.y) < f.r) ? 0.7 : 1; },
            update(dt) { if (!B.isRun()) return; B.enemies().forEach(e => { if (alive(e) && S.frost.some(f => Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r)) { B.setSt(e, { slow: 1 }); if (e.st) e.st.slowT = Math.max(e.st.slowT || 0, 1.5); } }); },
            draw(c) { c.save(); c.fillStyle = 'rgba(190,234,255,.22)'; c.strokeStyle = 'rgba(255,255,255,.5)'; S.frost.forEach(f => { c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.fill(); c.stroke(); }); c.restore(); },
            form: { ele_ice(ctx, H) {
                const mm = B.me(), a = ctx.ang; for (let i = 0; i < 7; i++) { S.frost.push({ x: mm.x + Math.cos(a) * (80 + i * 75), y: mm.y + Math.sin(a) * (80 + i * 75), r: 62 }); }
                while (S.frost.length > 28) S.frost.shift(); H.flash(mm.x + Math.cos(a) * 300, mm.y + Math.sin(a) * 300, 90, '#bfeaff');
            } }
        });
    def('elementalist', 'ele_chainreaction', 'チェイン・リアクション', '⚡',
        '「雷鎖」が敵に伝播するたびに枝分かれ（フォーク）し、画面全体の敵に電撃が無限に広がる。', '敵が1体しかいない（ボス戦など）場合、雷鎖が伝播せず、最初の1発（超微々たるダメージ）しか与えられない。', {
            form: { ele_chain(ctx, H) {
                const m = H.mk(ctx), mm = B.me(), alive0 = B.enemies().filter(alive);
                if (alive0.length <= 1) { const e = H.nearestN(mm.x, mm.y, 560, 1)[0]; if (e) m.hit(e, 0.04); popup('伝播する敵がいない…', '#9aa6c4'); return; }
                const first = H.nearestN(mm.x, mm.y, 560, 1)[0]; if (!first) return;
                const seen = new Set([first]), queue = [{ e: first, from: { x: mm.x, y: mm.y }, d: 0, at: 0 }], segs = []; let t = 0;
                H.add({ update(dt) {
                    t += dt; segs.forEach(s => { s.life -= dt; });
                    for (let i = queue.length - 1; i >= 0; i--) { const q = queue[i]; if (t < q.at) continue; queue.splice(i, 1);
                        if (alive(q.e)) m.hit(q.e, 0.9 * Math.pow(0.9, q.d)); segs.push({ x1: q.from.x, y1: q.from.y, x2: q.e.x, y2: q.e.y, life: 0.3 });
                        H.nearestN(q.e.x, q.e.y, 300, 2, Array.from(seen)).forEach(n => { seen.add(n); queue.push({ e: n, from: { x: q.e.x, y: q.e.y }, d: q.d + 1, at: t + 0.07 }); }); }
                    return queue.length > 0 || segs.some(s => s.life > 0);
                }, draw(c) { c.save(); c.strokeStyle = '#ffee88'; c.lineWidth = 4; segs.forEach(s => { if (s.life <= 0) return; c.globalAlpha = s.life / 0.3; c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.stroke(); }); c.restore(); } });
            } }
        });
    def('elementalist', 'ele_shield', 'エレメンタル・シールド', '🔰',
        '現在発動しているスキルに応じた強力な属性バリアを身に纏い、敵の攻撃を無効化しつつ能力を高める。', 'バリア発動中、自身の受ける「物理ダメージ」が3倍に跳ね上がる。（対アーチャー、ナイト等に極端に弱くなる）', {
            onCast(s) { const m = me(); S.shieldT = 4; B.barrier(m.maxHp * 0.3); m.empowerT = Math.max(m.empowerT || 0, 4); popup('🔰 属性バリア', '#c9a8ff'); },
            incoming() { return S.shieldT > 0 ? 3 : 1; }, update(dt) { if (S.shieldT > 0) S.shieldT -= dt; }
        });
    def('elementalist', 'ele_overload', '魔力暴走', '🔥',
        '全スキルのクールダウンが完全にゼロになり、スキルをマシンガンのように連射できる。', 'スキルを使うたびに現在のHPの15%を強制消費する。（連射しすぎると数秒で自滅する）', {
            cdMul: () => 0, onCast() { const m = me(); m.hp = Math.max(1, m.hp - Math.ceil(m.hp * 0.15)); }
        });

    // =========================================================================
    //  💀 ネクロマンサー
    // =========================================================================
    function skeletons(ctx, H, o) {               // 骸骨兵の共通
        const m = H.mk(ctx), mm = B.me(), n = o.n, sk = []; for (let i = 0; i < n; i++) sk.push({ x: mm.x + Math.cos(i * TAU / n) * 50, y: mm.y + Math.sin(i * TAU / n) * 50, cd: 0.2 + (i % 4) * 0.2, hp: o.hp || 99 });
        S.skels = (S.skels || []).concat(sk); let t = 0;
        const boom = s => { if (!o.boom) return; m.circle(s.x, s.y, 125, 2.0); H.flash(s.x, s.y, 125, '#ff9a5a'); };
        H.add({ update(dt) {
            if (!B.isRun()) return false; t += dt; const me2 = B.me();
            sk.forEach(s => {
                if (s.hp <= 0) return;
                const tg = B.nearestEnemy(s.x, s.y, 460), gx = tg ? tg.x : me2.x, gy = tg ? tg.y : me2.y, d = Math.hypot(gx - s.x, gy - s.y);
                if (d > 36) { s.x += (gx - s.x) / d * 215 * dt; s.y += (gy - s.y) / d * 215 * dt; }
                s.cd -= dt; if (tg && d < 44 + tg.r && s.cd <= 0) { s.cd = 0.8; m.circle(s.x, s.y, 56, 0.5); H.flash(s.x, s.y, 40, '#d8d8e8'); }
                if (o.fragile && (B.enemies().some(e => alive(e) && Math.hypot(e.x - s.x, e.y - s.y) < e.r + 16) || B.eBullets().some(b => Math.hypot(b.x - s.x, b.y - s.y) < 22))) { s.hp = 0; boom(s); }
            });
            if (t >= 10) { sk.forEach(s => { if (s.hp > 0) { s.hp = 0; boom(s); } }); }
            for (let i = S.skels.length - 1; i >= 0; i--) if (S.skels[i].hp <= 0) S.skels.splice(i, 1);
            return t < 10 && sk.some(s => s.hp > 0);
        }, draw(c) { c.save(); c.font = '26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; sk.forEach(s => { if (s.hp > 0) c.fillText('💀', s.x, s.y); }); c.restore(); } });
    }
    def('necromancer', 'nec_boneblast', 'ボーン・エクスプロージョン', '💣',
        '召喚した「骸骨兵」が倒された時、または手動起爆時に、周囲を巻き込む超火力の骨肉爆弾として大爆発する。', '骸骨兵が敵の通常攻撃一発で砕け散る（HPが1になる）ようになり、敵の前にたどり着く前に処理されやすくなる。', {
            form: { nec_skel(ctx, H) { skeletons(ctx, H, { n: 3, hp: 1, boom: true, fragile: true }); } }
        });
    def('necromancer', 'nec_embrace', '冥府の抱擁', '🫂',
        '「死の手」の持続時間が2倍になり、掴んだ敵のHPを毎秒激しく吸収してネクロマンサー本体を全回復する。', 'スキル終了後に、吸収した総量の50%のダメージを反動として受ける。', {
            form: { nec_hand(ctx, H) {
                const m = H.mk(ctx), mm = B.me(), tgs = H.nearestN(mm.x, mm.y, 500, 3); if (!tgs.length) { m.circle(mm.x + Math.cos(ctx.ang) * 200, mm.y + Math.sin(ctx.ang) * 200, 70, 0.9); return; }
                let t = 0, tick = 0, total = 0; tgs.forEach(e => m.hit(e, 0.9));
                H.add({ update(dt) {
                    t += dt; tick += dt; tgs.forEach(e => { if (alive(e)) { if (e.boss) B.setSt(e, { slow: 1 }); else B.setStun(e, 0.5); } });
                    if (tick >= 0.25) { tick = 0; tgs.forEach(e => { if (alive(e)) { const before = e.hp; m.hit(e, 0.35); const got = Math.max(0, before - e.hp); total += got; } }); const heal = me().maxHp * 0.045 * tgs.filter(alive).length; B.heal(heal); }
                    if (t >= 3.2 || !tgs.some(alive)) { const rec = Math.round(total * 0.5); B.selfDamage(rec); popup('💀 反動 -' + rec, '#ff7b7b'); return false; } return B.isRun();
                }, draw(c) { c.save(); c.strokeStyle = '#6b4aa8'; c.lineWidth = 4; tgs.forEach(e => { if (alive(e)) { c.beginPath(); c.moveTo(me().x, me().y); c.lineTo(e.x, e.y); c.stroke(); } }); c.restore(); } });
            } }
        });
    def('necromancer', 'nec_soulshare', 'ソウル・シェア', '🔗',
        '「魂の鎖」で繋がれた敵の片方にダメージを与えると、もう片方の敵にも150%に増幅されたダメージが入る。', '鎖が自分と敵の間にも繋がってしまう。つまり、自分が敵に攻撃を与えると、その反射ダメージを自分も受ける。', {
            afterDeal(e, dmg) {
                const L = S.link; if (!L || L.t <= 0 || (e !== L.a && e !== L.c)) return;
                if (S.sharing) return; S.sharing = true; const o = e === L.a ? L.c : L.a;
                try { if (alive(o)) B.dealHit(o, Math.max(1, Math.round(dmg * 1.5)), {}); B.selfDamage(Math.max(1, Math.round(dmg * 0.2))); } finally { S.sharing = false; }
            },
            update(dt) { if (S.link) { S.link.t -= dt; if (S.link.t <= 0) S.link = null; } },
            form: { nec_link(ctx, H) {
                const m = H.mk(ctx), mm = B.me(), tgs = H.nearestN(mm.x, mm.y, 520, 2); if (tgs.length < 2) { if (tgs[0]) m.hit(tgs[0], 0.6); return; }
                S.link = { a: tgs[0], c: tgs[1], t: 6 }; m.hit(tgs[0], 0.6);
            } },
            draw(c) { const L = S.link; if (!L || L.t <= 0) return; c.save(); c.strokeStyle = '#b46bff'; c.lineWidth = 3; c.setLineDash([10, 6]); c.beginPath(); c.moveTo(L.a.x, L.a.y); c.lineTo(L.c.x, L.c.y); c.moveTo(L.a.x, L.a.y); c.lineTo(me().x, me().y); c.moveTo(L.c.x, L.c.y); c.lineTo(me().x, me().y); c.stroke(); c.restore(); }
        });
    def('necromancer', 'nec_legion', 'デス・レギオン', '🏴',
        '召喚物の同時召喚数が2体から最大10体へと爆発的に増加する。', '召喚している味方の数×10%、本体の移動速度と攻撃力が低下する。（10体出すと本体は一切動けなくなる）', {
            moveMul() { return Math.max(0, 1 - 0.1 * ((S.skels || []).length)); },
            dealMul(e, dmg) { const n = (S.skels || []).length; return n ? dmg * Math.max(0.05, 1 - 0.1 * n) : dmg; },
            form: { nec_skel(ctx, H) { skeletons(ctx, H, { n: 10, hp: 99 }); } }
        });
    def('necromancer', 'nec_sacrifice', '生贄の儀式', '🩸',
        '骸骨兵を召喚している間、本体が受けるあらゆるダメージの100%を骸骨兵が身代わりとなって肩代わりする。', '本体の最大HPが常に「1」に固定される。骸骨兵が1体でも途切れた瞬間、かすり傷で即死する。', {
            setup() { const m = me(); m.maxHp = 1; m.hp = 1; S.skels = []; },
            update(dt) { const m = me(); if (m.maxHp !== 1) { m.maxHp = 1; m.hp = Math.min(1, m.hp); } },
            incoming() { const sk = (S.skels || []).filter(s => s.hp > 0); if (!sk.length) return 99999; sk[0].hp = 0; popup('💀 身代わり', '#d8d8e8'); return 0; },
            healBlock: () => false,
            form: { nec_skel(ctx, H) { skeletons(ctx, H, { n: 4, hp: 1 }); } }
        });

    // =========================================================================
    //  🧪 アルケミスト
    // =========================================================================
    def('alchemist', 'alc_corrosive', '腐食の劇薬', '☠️',
        '「酸の瓶」の酸溜まりが、敵の防御力と攻撃力を75%低下させる地獄の弱体化エリアになる。', '酸溜まりが味方の防具も溶かすようになり、エリア内にいる味方の防御力も75%低下する。', {
            incoming() { const z = S.acid; if (!z || z.t <= 0) return 1; const m = me(); return Math.hypot(m.x - z.x, m.y - z.y) <= z.R ? 2.2 : 1; },
            update(dt) { if (S.acid) { S.acid.t -= dt; if (S.acid.t <= 0) S.acid = null; } },
            form: { alc_acid(ctx, H) {
                const m = H.mk(ctx), tp = H.targetPoint(ctx, 470, 250), R = 150, z = S.acid = { x: tp.x, y: tp.y, R: R, t: 7 };
                zoneEnt(H, { x: tp.x, y: tp.y, R: R, life: 7, tick: 0.4, col: '#9be36b', fill: 'rgba(140,230,90,.25)', onTick: () => m.circle(tp.x, tp.y, R, 0.25, e => { B.setSt(e, { weaken: 1, curse: 1 }); e.cmark = { mul: 0.75, t: 1 }; if (e.st) e.st.weakenT = 2; }) });
            } }
        });
    def('alchemist', 'alc_timebomb', '時限の魔弾', '⏳',
        '「爆裂薬」が敵の体に直接付着し、5秒後にその敵を中心に周囲を巻き込む超広範囲・超高火力爆発を起こす。', '付着した敵の移動速度が3倍になり、爆発する前にプレイヤー（あなた）に向かって猛ダッシュで突撃してくる。', {
            form: { alc_bomb(ctx, H) {
                const m = H.mk(ctx), mm = B.me(), e = B.nearestEnemy(mm.x, mm.y, 520); if (!e) { m.circle(mm.x + Math.cos(ctx.ang) * 250, mm.y + Math.sin(ctx.ang) * 250, 145, 2.0); return; }
                const spd0 = e.spd; e.spd = (e.spd || 60) * 3; let t = 0;
                H.add({ update(dt) {
                    t += dt; if (!alive(e)) return false;
                    if (t >= 5) { e.spd = spd0; m.circle(e.x, e.y, 240, 6.0); H.flash(e.x, e.y, 240, '#ffb04a'); return false; } return B.isRun();
                }, draw(c) { if (!alive(e)) return; c.save(); c.strokeStyle = 'rgba(255,150,60,.9)'; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); c.arc(e.x, e.y, 240 * Math.min(1, t / 5), 0, TAU); c.stroke(); c.font = '24px sans-serif'; c.textAlign = 'center'; c.fillText('💣', e.x, e.y - e.r - 10); c.restore(); } });
            } }
        });
    def('alchemist', 'alc_equivalent', '等価交換', '⚖️',
        '「変換陣」の性質が反転し、陣の中にいる味方の全ステータスを2倍にする最強のバフエリアになる。', '陣の中にいる敵のステータスも2倍になってしまう。（敵味入り乱れる乱戦では超危険）', {
            castMul() { return S.eqIn ? 2 : 1; }, incoming() { return S.eqIn ? 0.5 : 1; },
            update(dt) {
                const z = S.eq; if (!z) { S.eqIn = false; return; } z.t -= dt; const m = me(); S.eqIn = z.t > 0 && Math.hypot(m.x - z.x, m.y - z.y) <= z.R;
                B.enemies().forEach(e => { if (!alive(e)) return; const inn = z.t > 0 && Math.hypot(e.x - z.x, e.y - z.y) <= z.R + e.r; if (inn && !e.eq0) { e.eq0 = { spd: e.spd, dmg: e.dmg }; e.spd *= 2; e.dmg *= 2; } else if (!inn && e.eq0) { e.spd = e.eq0.spd; e.dmg = e.eq0.dmg; e.eq0 = null; } });
                if (z.t <= 0) S.eq = null;
            },
            form: { alc_circle(ctx, H) { const mm = B.me(), z = S.eq = { x: mm.x, y: mm.y, R: 140, t: 7 }; zoneEnt(H, { x: z.x, y: z.y, R: z.R, life: 7, tick: 1, col: '#ffd84a', fill: 'rgba(255,216,74,.14)' }); } }
        });
    def('alchemist', 'alc_shower', 'ポーション・シャワー', '🚿',
        '薬瓶を投げる際、前方に5本の瓶を扇状に同時に投げ、画面全体に薬品をぶちまける。', '全スキルの消費マナが3倍になり、さらに投擲のたびに手持ちのゴールド（お金）を消費する。', {
            costMul: () => 3,
            formOverrideAny(key) { return /^alc_(acid|bomb)$/.test(key) ? (ctx, H) => { const base = ctx.ang; B.addCoins(-10); for (let i = -2; i <= 2; i++) { const c2 = Object.assign({}, ctx, { ang: base + i * 0.35, base: ctx.base * 0.7 }); H.base(key, c2); } popup('🚿 ×5本', '#9be36b'); } : null; }
        });
    def('alchemist', 'alc_homunculus', 'ホムンクルス錬成', '🗿',
        '薬品でダメージを与えるたびに、そのエネルギーから自動で強力な「泥のゴーレム」が生成され自動で戦う。', 'ゴーレムが稼働している間、プレイヤー本体は一切のスキルと通常攻撃が使えなくなる。', {
            castOk: () => !((S.golems || []).length), attackOk: () => !((S.golems || []).length),
            setup() { S.golems = []; S.golemCd = 0; },
            onFormCast(key) { if (/^alc_/.test(key)) S.potionT = 1.5; },
            onHit(e, dmg) { if (S.potionT > 0 && S.golems.length < 4 && !(S.golemCd > 0)) { S.golemCd = 0.8; const m = me(); S.golems.push({ x: m.x + rnd(-40, 40), y: m.y + rnd(-40, 40), t: 10, cd: 0.3 }); popup('🗿 ゴーレム錬成', '#c9a15a'); } return dmg; },
            update(dt) {
                if (S.potionT > 0) S.potionT -= dt; if (S.golemCd > 0) S.golemCd -= dt;
                const H = CF().H, mk = H.mk(miniCtx(0, 1.0));
                for (let i = S.golems.length - 1; i >= 0; i--) {
                    const g = S.golems[i]; g.t -= dt; if (g.t <= 0) { S.golems.splice(i, 1); continue; }
                    const tg = B.nearestEnemy(g.x, g.y, 520), d = tg ? Math.hypot(tg.x - g.x, tg.y - g.y) : 0;
                    if (tg && d > 40) { g.x += (tg.x - g.x) / d * 190 * dt; g.y += (tg.y - g.y) / d * 190 * dt; }
                    g.cd -= dt; if (tg && d < 60 + tg.r && g.cd <= 0) { g.cd = 0.7; mk.circle(g.x, g.y, 80, 1.1); H.flash(g.x, g.y, 70, '#c9a15a'); }
                }
            },
            draw(c) { c.save(); c.font = '34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; (S.golems || []).forEach(g => c.fillText('🗿', g.x, g.y)); c.restore(); }
        });

    // =========================================================================
    //  ⚔️🛡️ スペルブレイカー
    // =========================================================================
    def('spellbreaker', 'spb_return', '魔力還元', '♻️',
        '「魔断ち」で敵の弾丸を斬って消すたびに、他の全スキルのクールダウンが即座にリセットされる。', '敵の弾を消せなかった（空振りした）場合、すべてのスキルに10秒間のペナルティ・クールダウンが発生する。', {
            form: { spb_cut(ctx, H) {
                const m = H.mk(ctx), mm = B.me(); m.cone(mm.x, mm.y, ctx.ang, 135, 2.8, 1.0); B.fxArc(mm.x, mm.y, ctx.ang, 135, 2.8, '#9df0ff');
                const bl = B.eBullets(); let n = 0; for (let i = bl.length - 1; i >= 0; i--) if (Math.hypot(bl[i].x - mm.x, bl[i].y - mm.y) <= 175) { bl.splice(i, 1); n++; }
                n += H.pvp.ghostNear(mm.x, mm.y, 175);                                               // 対人戦：見た目の弾も消す
                H.pvp.arm('cut', 0.5, { onBlock: () => { (B.slots() || []).forEach(s => { if (s) s.cdLeft = 0; }); } });     // 対人戦：斬っている間に当たる飛び道具を止めて、リセット
                if (n > 0) { (B.slots() || []).forEach(s => { if (s) s.cdLeft = 0; }); popup('♻ クールダウン全リセット', '#9df0ff'); }
                else { (B.slots() || []).forEach(s => { if (s) s.cdLeft = Math.max(s.cdLeft || 0, 10); }); popup('空振り… 10秒ペナルティ', '#ff9a9a'); }
            } }
        });
    def('spellbreaker', 'spb_mirror', 'ミラー・フォース', '🪞',
        '「反射の構え」で跳ね返した弾丸が巨大化し、威力が3倍になって敵を自動追尾する。', '反射の構えの発動持続時間が「0.5秒（一瞬）」になり、タイミングを完璧に合わせないと直撃を食らう超シビアな仕様になる。', {
            form: { spb_reflect(ctx, H) {
                const m = H.mk(ctx); let t = 0; H.pvp.arm('reflect', 0.5, { mult: 2.4 });                  // 対人戦：0.5秒の間に当たる飛び道具を、3倍弱にして跳ね返す
                H.add({ update(dt) {
                    if (!H.alive()) return false; t += dt; const mm = B.me(), bl = B.eBullets(); H.pvp.ghostNear(mm.x, mm.y, 90);
                    for (let i = bl.length - 1; i >= 0; i--) { const b = bl[i]; if (Math.hypot(b.x - mm.x, b.y - mm.y) <= 90) { bl.splice(i, 1); const tg = B.nearestEnemy(mm.x, mm.y, 800), a = tg ? angTo(mm, tg) : Math.atan2(-b.vy, -b.vx);
                        H.fire(m, { x: mm.x, y: mm.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, r: 28, life: 2.5, mult: 2.4, home: 5, color: '#9df0ff' }); } }
                    return t < 0.5;
                }, draw(c) { const mm = B.me(); c.save(); c.strokeStyle = 'rgba(160,240,255,.9)'; c.lineWidth = 5; c.beginPath(); c.arc(mm.x, mm.y, 86, 0, TAU); c.stroke(); c.restore(); } });
            } }
        });
    def('spellbreaker', 'spb_chain', '封魔の連鎖', '⛓️',
        '「封魔印」がついた敵が特殊攻撃（詠唱など）をしようとした瞬間、周囲の敵全員にも封魔印が自動伝播し、敵全体の動きを止める。', '封魔印を付与したターゲットが特殊攻撃以外の行動（通常の物理攻撃など）をした場合、印が破裂して自分が大ダメージを受ける。', {
            // 近似：敵の「特殊攻撃」＝弾を撃つ（遠距離）／「通常の物理攻撃」＝自分に触れる（接触）として判定する
            update(dt) {
                if (!S.seals) return; const m = me(), bl = B.eBullets();
                S.seals = S.seals.filter(e => alive(e) && (e.sealT = (e.sealT || 6) - dt) > 0);
                S.seals.forEach(e => {
                    if (e.sealBurst) return;
                    if (Math.hypot(e.x - m.x, e.y - m.y) < e.r + m.r + 8) { e.sealBurst = true; B.selfHit(0.25); popup('💥 封印が破裂！', '#ff7b7b'); }
                    else if (bl.some(b => b.t0 === undefined && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 40 && !b.refl)) { B.enemies().forEach(o => { if (alive(o) && Math.hypot(o.x - e.x, o.y - e.y) < 420) { B.setStun(o, 1.6); if (S.seals.indexOf(o) < 0) S.seals.push(o); } }); popup('⛓ 封魔印が伝播', '#ffe08a'); e.sealBurst = true; }
                });
            },
            form: { spb_seal(ctx, H) { const m = H.mk(ctx), mm = B.me(), tgs = H.nearestN(mm.x, mm.y, 340, 3); S.seals = (S.seals || []).concat(tgs); tgs.forEach(e => { m.hit(e, 0.6); e.vuln = Math.max(e.vuln || 0, 6); e.sealT = 6; e.sealBurst = false; }); } }
        });
    def('spellbreaker', 'spb_anti', 'アンチ・メイジ', '🔮',
        '魔法や特殊攻撃の詠唱ゲージを持っている敵に対して、通常攻撃のダメージが5倍になる。', '魔法を使わない一般的な物理エネミー（戦士や野獣など）に対するダメージが「1」になる。', {
            dealMul(e, dmg) { return e && e.arch === 'ranged' ? dmg * 5 : 1; }              // 近似：飛び道具（遠距離）の敵を「詠唱ゲージを持つ敵」とみなす
        });
    def('spellbreaker', 'spb_eater', 'スペル・イーター', '🕳️',
        '敵の弾を消さずに盾にすべて吸収し、貯めたエネルギーを前方に画面端まで届く極大レーザーとして一気に放出する。', 'レーザーを放つまで通常攻撃が一切できず、また、一定量の弾を吸収する前にダメージを受けると盾が爆発して自分が即死する。', {
            attackOk: () => !S.eating, incoming() { return S.eating && S.absorbed < 10 ? 99999 : 1; },
            form: { spb_reflect(ctx, H) {
                const m = H.mk(ctx); let t = 0; S.eating = true; S.absorbed = 0; const a0 = ctx.ang;
                H.pvp.arm('absorb', 5, { onBlock: () => { S.absorbed++; } });                              // 対人戦：当たる飛び道具のダメージを吸収して貯める
                H.add({ update(dt) {
                    if (!H.alive()) { S.eating = false; H.pvp.arm('absorb', 0); return false; } t += dt; const mm = B.me(), bl = B.eBullets(); H.pvp.ghostNear(mm.x, mm.y, 95);
                    for (let i = bl.length - 1; i >= 0; i--) if (Math.hypot(bl[i].x - mm.x, bl[i].y - mm.y) <= 95) { bl.splice(i, 1); S.absorbed++; }
                    if (S.absorbed >= 10 || t >= 5) {
                        S.eating = false; H.pvp.arm('absorb', 0); const a = B.nearestEnemy(mm.x, mm.y, 900) ? angTo(mm, B.nearestEnemy(mm.x, mm.y, 900)) : a0, L = 2600, k = 1 + S.absorbed * 0.5;
                        m.line(mm.x, mm.y, mm.x + Math.cos(a) * L, mm.y + Math.sin(a) * L, 110, 3.0 * k); B.fxLine(mm.x, mm.y, mm.x + Math.cos(a) * L, mm.y + Math.sin(a) * L, '#9df0ff', 110); popup('🌈 放出！', '#9df0ff');
                        if (S.absorbed < 10) { S.absorbed = 10; } return false;
                    } return true;
                }, draw(c) { const mm = B.me(); c.save(); c.strokeStyle = 'rgba(160,240,255,' + (0.4 + 0.1 * S.absorbed) + ')'; c.lineWidth = 5 + S.absorbed; c.beginPath(); c.arc(mm.x, mm.y, 90, 0, TAU); c.stroke(); c.fillStyle = 'rgba(160,240,255,.12)'; c.fill(); c.restore(); } });
            } }
        });

    // =========================================================================
    //  🎲 ギャンブラー
    // =========================================================================
    def('gambler', 'gam_loaded', 'イカサマダイス', '🎲',
        '「ダイス爆弾」の出目が「5」か「6」しか出なくなり、常に最大火力の大爆発を起こせる。', 'ダイス爆弾のクールダウンが3倍になり、投げるたびに自身の所持金（ゴールド）がランダムで消滅する。', {
            needForm: ['gam_dice'], cdMul: s => s.params.classForm === 'gam_dice' ? 3 : 1, luckDice: () => 5 + Math.floor(Math.random() * 2),
            onFormCast(key) { if (key === 'gam_dice') B.addCoins(-Math.round(rnd(5, 60))); }
        });
    def('gambler', 'gam_allin', 'オール・オア・ナッシング', '🪙',
        '「コイントス」の表（当たり）が出た時の威力が20倍になり、ボスすら一撃で即死させる。', '裏（ハズレ）が出た瞬間、自分が即死する。（まさに命を賭けたギャンブル）', {
            form: { gam_coin(ctx, H) {
                const m = H.mk(ctx), mm = B.me(), heads = Math.random() < 0.5; B.popup(heads ? '🪙 表！！' : '🪙 裏…', mm.x, mm.y - 52, heads ? '#ffd84a' : '#ff7b7b');
                if (heads) H.fire(m, { x: mm.x, y: mm.y, vx: Math.cos(ctx.ang) * 700, vy: Math.sin(ctx.ang) * 700, r: 18, life: 0.9, mult: 2.2 * 20, pierce: 2, color: '#ffd84a' });
                else B.killSelf();
            } }
        });
    def('gambler', 'gam_jackpot', 'ジャックポット', '🎰',
        '「ルーレット弾」の当たり枠が90%を占めるようになり、当たった時の弾幕が画面を埋め尽くす。', '10%の確率で発生する「ハズレ（ドクロマーク）」を引くと、装備している武器がその場で破壊され消滅する。', {
            attackOk: () => !S.weaponBroken,
            form: { gam_roul(ctx, H) {
                const m = H.mk(ctx), mm = B.me();
                if (Math.random() < 0.10) { B.popup('💀 ハズレ！', mm.x, mm.y - 52, '#ff7b7b'); BY_ID.gam_jackpot.breakWeapon(); return; }
                B.popup('🎰 JACKPOT!', mm.x, mm.y - 52, '#ffd84a');
                for (let i = 0; i < 36; i++) { const a = i * TAU / 36 + ctx.ang; H.fire(m, { x: mm.x, y: mm.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 12, life: 1.2, mult: 1.6, pierce: 1, color: '#ffd84a' }); }
            } },
            breakWeapon() {
                S.weaponBroken = true; popup('💥 武器が壊れた！', '#ff7b7b');
                if (!JACKPOT_DESTROYS_WEAPON) return;
                try { const HW = global.HW; const d = HW.load(); const i = d.weapons.findIndex(w => w.id === d.equipped); if (i >= 0 && !d.weapons[i].mythicId) { d.weapons.splice(i, 1); d.equipped = d.weapons.length ? d.weapons[0].id : null; HW.save(d); } } catch (e) { console.warn('[ClassPerks] weapon destroy failed', e); }
            }
        });
    def('gambler', 'gam_seven', 'ラッキーセブン', '7️⃣',
        'あらゆる攻撃の「7ヒット目」が必ず10倍クリティカルになり、受けるダメージの「7の倍数回目の被弾」を完全に無効化する。', '7ヒット目以外のすべての攻撃ダメージが「1」になり、7の倍数以外の被弾ダメージが2倍になる。', {
            dealMul(e, dmg) { S.hits = (S.hits || 0) + 1; if (S.hits % 7 === 0) { B.popup('7 ✨', e.x, e.y - e.r - 24, '#ffd84a'); return dmg * 10; } return 1; },
            incoming() { S.taken = (S.taken || 0) + 1; return S.taken % 7 === 0 ? 0 : 2; }
        });
    def('gambler', 'gam_deadhand', 'デッドマンズ・ハンド', '🃏',
        'HPが10%以下になった瞬間、コイントス・ルーレット・ダイスの結果がすべて最高値（確定大当たり）で固定される。', 'この状態（HP10%以下）のときは、あらゆる回復手段（ポーションや味方のヒール）が無効化され、常に死と隣り合わせになる。', {
            healBlock: () => hpRate() <= 0.1, lucky: () => hpRate() <= 0.1
        });

    // =========================================================================
    //  窓口
    // =========================================================================
    function chosen() {      // 今ついているパーク（メインとサブ、それぞれのツリーで選んだもの。メインが先）
        try { const sys = CS(); if (!sys) return []; const st = sys.state(); return [st.main, st.sub].filter(Boolean).map(cid => sys.perkOf(cid)).filter(Boolean).map(id => BY_ID[id]).filter(Boolean); } catch (e) { return []; }
    }
    // そのパークが必要とする「形」のキー（サブは先頭2つの形しか使えないので、3つ目の形が要るパークは選べない）
    function needForms(p) { return Object.keys(p.form || {}).concat(p.needForm || []); }
    const each = fn => { for (const p of curs) { try { fn(p); } catch (e) { console.warn('[ClassPerks]', p.id, e); } } };
    const mulOf = (fn) => { let m = 1; each(p => { const v = fn(p); if (typeof v === 'number') m *= v; }); return m; };
    const ClassPerks = {
        PERKS: PERKS, BY_ID: BY_ID, BY_CLS: BY_CLS, PERK_COST: PERK_COST, JACKPOT_DESTROYS_WEAPON: JACKPOT_DESTROYS_WEAPON,
        list: cid => BY_CLS[cid] || [], needForms: needForms,
        // 常時の強化・弱体（ClassSys.mergeInto が、戦闘の準備のときに呼ぶ）
        stats() { const out = {}; chosen().forEach(p => Object.keys(p.stats || {}).forEach(k => { out[k] = (out[k] || 0) + p.stats[k]; })); return out; },
        setup(bridge) { B = bridge; S = { skillT: 0, lockT: 0 }; curs = chosen(); each(p => { if (p.setup) p.setup(); }); },
        active: () => curs.slice(),
        formOverride(key) {
            if (!curs.length || !B) return null;
            for (const p of curs) { if (p.form && p.form[key]) return p.form[key]; const f = p.formOverrideAny && p.formOverrideAny(key); if (f) return f; }
            return null;
        },
        onFormCast(key, ctx) { each(p => { if (p.onFormCast) p.onFormCast(key, ctx); }); },
        onCast(s) { each(p => { if (p.onCast) p.onCast(s); }); },
        castMul(p0, s, slot) { return mulOf(p => p.castMul ? (p.castMul(p0, s, slot) || 1) : 1); },
        costMul(s) { return mulOf(p => p.costMul ? p.costMul(s) : 1); },
        cdMul(s) { return mulOf(p => p.cdMul ? p.cdMul(s) : 1); },
        castOk(s) { return curs.every(p => { try { return !p.castOk || p.castOk(s); } catch (e) { return true; } }); },
        attackOk() { return curs.every(p => { try { return !p.attackOk || p.attackOk(); } catch (e) { return true; } }); },
        dashOk() { return curs.every(p => { try { return !p.dashOk || p.dashOk(); } catch (e) { return true; } }); },
        moveMul() { return mulOf(p => p.moveMul ? p.moveMul() : 1); },
        moveFilter(mx, my) { if (curs.length && S.lockT > 0) return [0, 0]; let v = [mx, my]; each(p => { if (p.moveFilter) v = p.moveFilter(v[0], v[1]); }); return v; },
        incoming() { return mulOf(p => p.incoming ? p.incoming() : 1); },
        onHurt(dmg) { each(p => { if (p.onHurt) p.onHurt(dmg); }); },
        onKill(e) { each(p => { if (p.onKill) p.onKill(e); }); },
        onHit(e, dmg, eff, st) { each(p => { if (p.onHit) dmg = p.onHit(e, dmg, eff, st); }); return dmg; },
        dealMul(e, dmg) { each(p => { if (p.dealMul) dmg = p.dealMul(e, dmg); }); return dmg; },
        afterDeal(e, dmg) { each(p => { if (p.afterDeal) p.afterDeal(e, dmg); }); },
        healBlock() { return curs.some(p => { try { return !!(p.healBlock && p.healBlock()); } catch (e) { return false; } }); },
        fatal() { return curs.some(p => { try { return !!(p.fatal && p.fatal()); } catch (e) { return false; } }); },
        afterAttack() { each(p => { if (p.afterAttack) p.afterAttack(); }); },
        onDash() { each(p => { if (p.onDash) p.onDash(); }); },
        pierceAll() { return curs.some(p => p.pierceAll); },
        lucky() { return curs.some(p => { try { return !!(p.lucky && p.lucky()); } catch (e) { return false; } }); },
        luckDice() { let v = 0; each(p => { if (p.luckDice) v = p.luckDice() || v; }); return v; },
        update(dt) { if (!curs.length || !B) return; if (S.lockT > 0) S.lockT -= dt; each(p => { if (p.update) p.update.call(p, dt); }); },
        draw(c) { if (!curs.length || !B) return; curs.forEach(p => { try { if (p.draw) p.draw(c); } catch (e) { /* 描画の失敗でゲームを止めない */ } }); },
        _state: () => S
    };
    global.ClassPerks = ClassPerks;
})(typeof window !== 'undefined' ? window : globalThis);
