// ============================================================
// ボスの技ライブラリ (boss-moves.js)
//  ・ステージ(ボス)ごとに「得意技」を3〜5個持ち、順番に繰り出す
//  ・各ボスに必ず1つ「スタン技」がある。当たると約3秒、動けず攻撃も回避もできなくなる
//    （予告は黄色い範囲＋⚡。遠くへ逃げる／ダッシュで避ければ当たらない）
//  ・技は「ステップ（時刻つきの命令）」の並びで定義し、実行は stage.js の runMove() が行う
//
//  ステップの種類（t は技の開始からの秒数）
//    cone  : 扇形の範囲攻撃（r=半径, arc=角度°, tele=予告秒, dm=威力倍率, rep/gap=持続して複数回ヒット）
//    line  : 直線のレーザー/斬撃（len=長さ, w=幅）
//    ring  : ボスを中心にした円（近づくと危険）
//    donut : ドーナツ形（ri より内側は安全）
//    at    : プレイヤーの足元に円（who: 'all' 全員 / 'rand' ランダム1人）
//    rain  : プレイヤー周辺にランダムな円を降らせる（n 個）
//    warn  : ダメージ無しの予告線（このあと dash するときの合図）
//    dash  : ボスの体当たり突進（接触でダメージ）
//    leap  : 飛び上がって着地点に落下（着地時に円の範囲ダメージ）
//    fan / rad / spiral : 弾（扇状／全方位／渦巻き）
//    summon: 手下を呼ぶ
//  ゲートキーパー専用（ゲートから剣とビームを撃つ）
//    ports : 「門」を開く（mode: around=標的の周囲 / sky=頭上に横並び / side=左右から横ビーム用 / diag=四隅の斜め）。life 秒だけ開いている
//    swords: 開いている門から剣を撃つ（per=1門あたりの本数, frac=撃つ門の割合, track=撃つ瞬間に標的を狙い直す）
//    beams : 開いている門からビームを撃つ（tele=予告秒, w=幅, r=長さ, frac=撃つ門の割合）
//  aim は 'l'＝技の開始時に狙った方向で固定 / 't'＝そのときのプレイヤーの方向（既定）、off は角度°のずらし
// ============================================================
(function () {
    'use strict';
    const D = Math.PI / 180;
    const MOVES = {};
    const SETS = {};

    // ---------- ステップ生成の短縮記法 ----------
    const cone   = (t, r, arc, tele, dm, o) => Object.assign({ t: t, k: 'cone', r: r, arc: arc * D, tele: tele, dm: dm }, o);
    const line   = (t, len, w, tele, dm, o) => Object.assign({ t: t, k: 'line', r: len, w: w, tele: tele, dm: dm }, o);
    const ring   = (t, r, tele, dm, o) => Object.assign({ t: t, k: 'ring', r: r, tele: tele, dm: dm }, o);
    const donut  = (t, r, ri, tele, dm, o) => Object.assign({ t: t, k: 'donut', r: r, ri: ri, tele: tele, dm: dm }, o);
    const at     = (t, r, tele, dm, o) => Object.assign({ t: t, k: 'at', r: r, tele: tele, dm: dm, who: 'all' }, o);
    const rain   = (t, n, r, tele, dm, o) => Object.assign({ t: t, k: 'rain', n: n, r: r, tele: tele, dm: dm, gap: 0.15 }, o);
    const warn   = (t, len, w, tele, o) => Object.assign({ t: t, k: 'warn', r: len, w: w, tele: tele, aim: 'l' }, o);
    const dash   = (t, dur, spd, o) => Object.assign({ t: t, k: 'dash', dur: dur, spd: spd, aim: 'l' }, o);
    const leap   = (t, dur, r, dm, o) => Object.assign({ t: t, k: 'leap', dur: dur, r: r, dm: dm }, o);
    const fan    = (t, n, spread, spd, dm, o) => Object.assign({ t: t, k: 'fan', n: n, sp: spread * D, spd: spd, dm: dm }, o);
    const rad    = (t, n, spd, dm, o) => Object.assign({ t: t, k: 'rad', n: n, spd: spd, dm: dm }, o);
    const spiral = (t, dur, spd, dm, o) => Object.assign({ t: t, k: 'spiral', dur: dur, spd: spd, dm: dm, arms: 2 }, o);
    const summon = (t, n) => ({ t: t, k: 'summon', n: n });
    const ports  = (t, mode, n, R, life, o) => Object.assign({ t: t, k: 'ports', mode: mode, n: n, R: R, life: life }, o);
    const swords = (t, o) => Object.assign({ t: t, k: 'swords', per: 1, spd: 520, dm: 0.5, frac: 1 }, o);
    const beams  = (t, len, w, tele, dm, o) => Object.assign({ t: t, k: 'beams', r: len, w: w, tele: tele, dm: dm, frac: 1 }, o);
    const STUN = { stun: true };

    function stepEnd(s) {
        switch (s.k) {
            case 'cone': case 'line': case 'ring': case 'donut': case 'at': return s.t + s.tele + (s.rep || 0) * (s.gap || 0.3);
            case 'rain': return s.t + s.tele + s.n * (s.gap || 0.15);
            case 'warn': return s.t + s.tele;
            case 'beams': return s.t + s.tele + (s.rep || 0) * (s.gap || 0.3);
            case 'dash': case 'leap': case 'spiral': return s.t + s.dur;
            default: return s.t;
        }
    }
    // 技の登録。dur(全体の長さ)はステップから自動計算。recは技のあとの硬直（秒）
    function def(id, name, steps, o) {
        steps = steps.slice().sort((a, b) => a.t - b.t);
        const m = Object.assign({ id: id, name: name, steps: steps, rec: 0.5 }, o || {});
        m.stun = steps.some(s => s.stun);
        m.ult = !!(o && o.ult);
        if (m.stun && !(o && 'rec' in o)) m.rec = 1.2;
        m.dur = Math.max.apply(null, steps.map(stepEnd)) + 0.1;
        MOVES[id] = m;
        return id;
    }
    // ステージ(ボス)ごとの技セット。stun は必ず1つ
    // o.ult: 大技（HPが ultAt の割合を切るたびに1回ずつ、激昂中はときどき繰り出す）
    function set(stageId, moves, stun, o) { SETS[stageId] = { moves: moves, stun: stun, ult: o && o.ult, ultAt: (o && o.ultAt) || [0.7, 0.35] }; }

    // ============================================================
    // 第一世界
    // ============================================================
    // --- ゴブリンキング：力任せの大振りと家臣 ---
    set('meadow', [
        def('gk_swing', '王の二連撃', [cone(0, 240, 100, 0.75, 1.5), cone(0.85, 240, 100, 0.6, 1.5)]),
        def('gk_stomp', '玉座の地鳴り', [ring(0, 170, 0.9, 1.6), donut(1.0, 340, 190, 0.85, 1.3)]),
        def('gk_call', '家臣召集', [summon(0, 4), rad(0.5, 12, 230, 0.8)])
    ], def('gk_scepter', '黄金の王笏', [at(0, 105, 1.2, 0.9, STUN)]));

    // --- 森の魔女：呪い弾と毒の大釜 ---
    set('whisper_forest', [
        def('wt_hex', '呪いの三連弾', [fan(0, 5, 11, 380, 0.8), fan(0.5, 5, 11, 380, 0.8), fan(1.0, 7, 11, 380, 0.8)]),
        def('wt_cauldron', '大釜の毒霧', [rain(0, 6, 95, 1.0, 1.1, { gap: 0.2 }), ring(0.8, 130, 0.9, 1.4)]),
        def('wt_broom', '箒の突進', [warn(0, 540, 80, 0.7), dash(0.7, 0.6, 780)], { rec: 0.7 })
    ], def('wt_curse', '石化の呪眼', [cone(0, 500, 55, 1.2, 0.8, Object.assign({ aim: 't' }, STUN))]));

    // --- サンドワーム：地中からの奇襲 ---
    set('sand_ruins', [
        def('sw_burrow', '潜行突き上げ', [at(0, 100, 1.0, 1.4), at(0.7, 100, 0.9, 1.4)]),
        def('sw_charge', '大地裂き', [warn(0, 600, 90, 0.8), dash(0.8, 0.7, 760), ring(1.6, 150, 0.7, 1.2)], { rec: 0.7 }),
        def('sw_spit', '砂弾連射', [fan(0, 5, 12, 360, 0.8), fan(0.4, 5, 12, 360, 0.8), rad(1.0, 14, 240, 0.7)])
    ], def('sw_quake', '砂嵐の大地震', [ring(0, 310, 1.3, 0.9, STUN)]));

    // --- アイスゴーレム：氷の拳と冷気 ---
    set('frost_lab', [
        def('ig_smash', '氷拳の叩きつけ', [cone(0, 230, 90, 0.85, 1.8), ring(1.0, 160, 0.7, 1.3)]),
        def('ig_shard', '氷柱の雨', [rain(0, 7, 75, 1.1, 1.2, { gap: 0.17 })]),
        def('ig_nova', '絶対零度', [donut(0, 430, 150, 1.1, 1.4), rad(1.3, 16, 230, 0.7)])
    ], def('ig_freeze', '凍結の吐息', [cone(0, 520, 70, 1.2, 0.8, Object.assign({ aim: 't' }, STUN))]));

    // --- オークの戦将：斧と突撃 ---
    set('wasteland', [
        def('og_axe', '戦斧の連撃', [cone(0, 250, 110, 0.7, 1.5), cone(0.8, 250, 110, 0.6, 1.5), cone(1.5, 280, 140, 0.8, 1.9)]),
        def('og_charge', '突撃の号令', [warn(0, 560, 80, 0.7), dash(0.7, 0.55, 800), warn(1.5, 560, 80, 0.5, { aim: 't' }), dash(2.0, 0.55, 800, { aim: 't' })], { rec: 0.8 }),
        def('og_horn', '進軍の角笛', [summon(0, 4), rad(0.5, 14, 240, 0.8)])
    ], def('og_bash', '盾砕きの一撃', [at(0, 110, 1.2, 0.9, STUN)]));

    // --- ヨルムンガンド：毒霧のブレスと締め付け ---
    set('toxic_swamp', [
        def('ym_breath', '毒霧のブレス', [cone(0, 660, 70, 1.1, 0.5, { aim: 't', rep: 5, gap: 0.3 })]),
        def('ym_coil', 'とぐろ締め', [ring(0, 200, 0.9, 1.5), donut(1.0, 400, 200, 0.9, 1.3)]),
        def('ym_spit', '毒液弾', [fan(0, 7, 9, 340, 0.8), rain(0.6, 5, 90, 1.0, 1.0)])
    ], def('ym_fang', '麻痺の牙', [leap(0, 0.85, 150, 0.9, STUN)]));

    // --- 岩石トロール：棍棒と落石 ---
    set('rocky_mountain', [
        def('rt_club', '岩棍棒の振り下ろし', [cone(0, 240, 80, 0.9, 2.0), ring(1.1, 170, 0.7, 1.3)]),
        def('rt_fall', '落石', [rain(0, 8, 85, 1.2, 1.2, { gap: 0.2 })]),
        def('rt_roll', 'ロックロール', [warn(0, 640, 100, 0.8), dash(0.8, 0.8, 720)], { rec: 0.8 })
    ], def('rt_quake', '大地震動', [donut(0, 430, 130, 1.3, 0.9, STUN)]));

    // --- 雷神ガルーダ：急降下と落雷 ---
    set('thunder_canyon', [
        def('gd_dive', '雷光の急降下', [leap(0, 0.8, 180, 1.8)]),
        def('gd_bolts', '落雷の連鎖', [rain(0, 9, 62, 0.8, 1.2, { gap: 0.14 })]),
        def('gd_wing', '羽根の乱射', [fan(0, 7, 10, 380, 0.8), rad(0.5, 16, 250, 0.7), fan(1.0, 7, 10, 380, 0.8)])
    ], def('gd_judgement', '天罰の雷', [at(0, 115, 1.2, 0.9, STUN)]));

    // --- フレイムドラゴン：広範囲の灼熱ブレス ---
    set('magma_core', [
        def('fd_breath', '灼熱の大ブレス', [cone(0, 580, 105, 1.0, 0.65, { aim: 't', rep: 4, gap: 0.3 })]),
        def('fd_tail', '尾薙ぎ', [cone(0, 270, 230, 0.8, 1.7)]),
        def('fd_meteor', '火口の落石', [rain(0, 7, 85, 1.0, 1.2, { gap: 0.18 })]),
        def('fd_dive', '飛翔急降下', [leap(0, 0.9, 190, 2.0)])
    ], def('fd_roar', '竜の咆哮', [ring(0, 270, 1.2, 0.9, STUN)]));

    // --- 深海クラーケン：触手と大渦 ---
    set('deep_sea', [
        def('kr_tentacle', '触手の連打', [at(0, 85, 0.8, 1.2, { who: 'rand' }), at(0.5, 85, 0.8, 1.2, { who: 'rand' }), at(1.0, 85, 0.8, 1.2)]),
        def('kr_ink', '墨の渦', [spiral(0, 2.2, 240, 0.8)], { rec: 0.8 }),
        def('kr_whirl', '大渦', [donut(0, 410, 140, 1.1, 1.4), ring(1.2, 120, 0.7, 1.5)])
    ], def('kr_grip', '巻き付き', [at(0, 125, 1.2, 0.9, STUN)]));

    // --- 血の伯爵：蝙蝠と十字斬 ---
    set('haunted_graveyard', [
        def('bc_bats', '蝙蝠の群れ', [fan(0, 5, 14, 370, 0.8), fan(0.4, 5, 14, 370, 0.8), fan(0.8, 5, 14, 370, 0.8)]),
        def('bc_cross', '鮮血の十字斬', [0, 90, 180, 270].map(a => line(0, 520, 64, 0.85, 1.6, { aim: 'l', off: a }))),
        def('bc_vortex', '血の渦', [donut(0, 400, 130, 1.0, 1.4), summon(0.6, 3)])
    ], def('bc_gaze', '魅了の邪眼', [cone(0, 520, 60, 1.2, 0.8, Object.assign({ aim: 't' }, STUN))]));

    // --- セレスティアルガーディアン：光の裁き ---
    set('sky_castle', [
        def('cg_pillar', '裁きの光柱', [at(0, 90, 0.9, 1.4), at(0.7, 90, 0.9, 1.4), rain(1.0, 4, 80, 0.9, 1.1)]),
        def('cg_sword', '聖剣の一閃', [line(0, 680, 90, 0.9, 1.8)]),
        def('cg_halo', '光輪', [rad(0, 18, 250, 0.8), ring(0.5, 170, 0.8, 1.4)])
    ], def('cg_seal', '封印の光', [at(0, 150, 1.3, 0.9, STUN)]));

    // --- 堕天使ルシフェル：黒羽根と堕天の十字 ---
    set('fallen_church', [
        def('lf_feather', '黒羽根の弾幕', [spiral(0, 1.8, 250, 0.8), fan(1.9, 7, 10, 370, 0.8)]),
        def('lf_cross', '堕天の十字', [line(0, 640, 70, 0.9, 1.7, { aim: 't' }), line(0.5, 640, 70, 0.9, 1.7, { aim: 't', off: 90 })]),
        def('lf_fall', '堕天急降下', [leap(0, 0.85, 180, 2.0)])
    ], def('lf_gospel', '闇の福音', [ring(0, 330, 1.3, 0.9, STUN)]));

    // --- 深淵ヲ廻ルモノ：鎌の二連撃→飛び上がりの一撃 ---
    set('abyssal_rift', [
        def('ab_reap', '死神の三連鎌', [cone(0, 260, 115, 0.75, 1.3), cone(0.85, 260, 115, 0.6, 1.3), leap(1.7, 0.75, 175, 2.1)], { rec: 0.8 }),
        def('ab_orbit', '廻転断ち', [cone(0, 340, 80, 0.8, 1.4, { aim: 'l', off: 0 }), cone(0.5, 340, 80, 0.7, 1.4, { aim: 'l', off: 120 }), cone(1.0, 340, 80, 0.7, 1.4, { aim: 'l', off: 240 })]),
        def('ab_spiral', '虚空の渦', [spiral(0, 2.4, 240, 0.8), rad(2.5, 20, 230, 0.7)], { rec: 0.8 }),
        def('ab_summon', '眷属召喚', [summon(0, 4), donut(0.5, 400, 140, 1.0, 1.3)])
    ], def('ab_grasp', '虚無の掌握', [ring(0, 290, 1.3, 0.9, STUN)]));

    // ---- ミニステージ ----
    // --- キングスライム ---
    set('slime_burrow', [
        def('ks_press', 'ボディプレス', [leap(0, 0.8, 170, 1.7)]),
        def('ks_split', '分裂', [summon(0, 4), rad(0.5, 12, 220, 0.8)]),
        def('ks_splash', '粘液飛沫', [rain(0, 6, 85, 1.0, 1.1, { gap: 0.18 })])
    ], def('ks_sticky', '粘着ボディ', [ring(0, 240, 1.2, 0.8, STUN)]));

    // --- ホブゴブリン将軍 ---
    set('goblin_camp', [
        def('hg_chop', '二連斬り', [cone(0, 240, 100, 0.7, 1.5), cone(0.8, 240, 100, 0.6, 1.5)]),
        def('hg_charge', '突撃命令', [warn(0, 540, 80, 0.7), dash(0.7, 0.55, 780)], { rec: 0.7 }),
        def('hg_bomb', '爆弾投げ', [rain(0, 5, 90, 1.1, 1.3, { gap: 0.2 }), fan(0.5, 5, 12, 360, 0.7)])
    ], def('hg_helm', '兜割り', [cone(0, 240, 70, 1.1, 1.0, Object.assign({ aim: 't' }, STUN))]));

    // --- 禁書の番人 ---
    set('haunted_library', [
        def('fb_pages', '飛び散る頁', [fan(0, 9, 8, 360, 0.8), fan(0.5, 9, 8, 360, 0.8)]),
        def('fb_ink', 'インク沼', [rain(0, 6, 95, 1.0, 1.1, { gap: 0.18 })]),
        def('fb_chant', '禁呪詠唱', [donut(0, 410, 140, 1.1, 1.4), summon(0.6, 3)])
    ], def('fb_close', '書を閉じる', [at(0, 135, 1.2, 0.9, STUN)]));

    // --- メカ・タイタン ---
    set('clockwork_factory', [
        def('mt_punch', 'ロケットパンチ', [line(0, 720, 85, 0.9, 1.8)]),
        def('mt_gatling', 'ガトリング', [fan(0, 3, 6, 420, 0.6), fan(0.2, 3, 6, 420, 0.6), fan(0.4, 3, 6, 420, 0.6), fan(0.6, 3, 6, 420, 0.6), spiral(0.9, 1.4, 260, 0.6)]),
        def('mt_stomp', '重力脚', [ring(0, 170, 0.9, 1.5), donut(1.0, 400, 170, 0.9, 1.3)])
    ], def('mt_emp', 'EMPパルス', [ring(0, 340, 1.3, 0.9, STUN)]));

    // ============================================================
    // 第二世界「次元の裏側」
    // ============================================================
    // --- 次元狼フェンリル・ゼロ：牙の連撃と瞬影の突進 ---
    set('rift_plains', [
        def('fz_fang', '牙の三連撃', [cone(0, 230, 90, 0.6, 1.3), cone(0.65, 230, 90, 0.5, 1.3), cone(1.25, 260, 130, 0.65, 1.7)]),
        def('fz_howl', '次元の咆哮', [rad(0, 22, 250, 0.8), ring(0.4, 180, 0.9, 1.5)]),
        def('fz_rush', '瞬影突進', [warn(0, 600, 80, 0.55), dash(0.55, 0.5, 900), warn(1.2, 600, 80, 0.45, { aim: 't' }), dash(1.65, 0.5, 900, { aim: 't' })], { rec: 0.8 })
    ], def('fz_bite', '喰らいつき', [leap(0, 0.8, 150, 1.0, STUN)]));

    // --- 嘆きの樹母：這う根と毒花粉 ---
    set('rift_forest', [
        def('tm_roots', '這う根', [line(0, 640, 70, 0.9, 1.5, { aim: 'l', off: -28 }), line(0, 640, 70, 0.9, 1.5, { aim: 'l', off: 0 }), line(0, 640, 70, 0.9, 1.5, { aim: 'l', off: 28 }), line(1.1, 640, 70, 0.8, 1.5, { aim: 't' })]),
        def('tm_pollen', '毒花粉', [donut(0, 430, 150, 1.1, 1.4), rain(0.6, 5, 90, 1.0, 1.1)]),
        def('tm_sprout', '若木の呼び声', [summon(0, 5), rain(0.5, 4, 85, 1.0, 1.2)])
    ], def('tm_bind', '絡み付く蔓', [at(0, 135, 1.3, 0.9, STUN)]));

    // --- ミラージュ・スフィンクス：爪の乱舞と蜃気楼 ---
    set('rift_desert', [
        def('ms_claw', '爪の乱舞', [cone(0, 250, 90, 0.6, 1.3), cone(0.65, 250, 90, 0.5, 1.3), cone(1.25, 250, 90, 0.5, 1.3), cone(1.8, 280, 140, 0.7, 1.8)]),
        def('ms_mirage', '蜃気楼', [rain(0, 9, 80, 1.0, 1.2, { gap: 0.15 }), at(0.9, 95, 0.9, 1.3, { who: 'rand' })]),
        def('ms_riddle', '謎かけの光線', [line(0, 700, 80, 0.9, 1.6, { aim: 'l', off: -35 }), line(0.45, 700, 80, 0.9, 1.6, { aim: 'l', off: 0 }), line(0.9, 700, 80, 0.9, 1.6, { aim: 'l', off: 35 })])
    ], def('ms_gaze', '石化の視線', [cone(0, 580, 55, 1.2, 0.9, Object.assign({ aim: 't' }, STUN))]));

    // --- 刻喰らいクロノス：時計の針と砂の雨 ---
    set('rift_clock', [
        def('ch_hands', '針の回転', [0, 1, 2, 3, 4, 5].map(i => line(i * 0.3, 620, 62, 0.55, 1.3, { aim: 'l', off: i * 32 }))),
        def('ch_rewind', '時間遡行', [at(0, 100, 1.0, 1.3), at(1.1, 100, 0.8, 1.3), at(1.9, 100, 0.8, 1.3)]),
        def('ch_sand', '砂時計の雨', [rain(0, 10, 70, 1.0, 1.2, { gap: 0.13 }), donut(1.3, 400, 140, 0.9, 1.3)])
    ], def('ch_stop', '時間停止', [ring(0, 370, 1.4, 0.9, STUN)]));

    // --- 星砕きの巨神：踏みつけと流星群 ---
    set('rift_battlefield', [
        def('sg_slam', '星砕きの一撃', [leap(0, 0.9, 235, 2.2), ring(1.1, 150, 0.7, 1.3)], { rec: 0.8 }),
        def('sg_meteor', '流星群', [rain(0, 11, 78, 1.0, 1.3, { gap: 0.13 })]),
        def('sg_beam', '星光線', [line(0, 740, 90, 0.9, 1.7, { aim: 't' }), line(0.8, 740, 90, 0.9, 1.7, { aim: 't' }), rad(1.7, 18, 240, 0.7)])
    ], def('sg_nova', '超新星', [donut(0, 460, 150, 1.4, 0.9, STUN)]));

    // --- 次元竜王バハムート・ノヴァ：超広範囲ブレスと竜爪 ---
    set('rift_throne', [
        def('dk_breath', '次元の大ブレス', [cone(0, 720, 135, 1.1, 0.6, { aim: 't', rep: 5, gap: 0.28 })], { rec: 0.8 }),
        def('dk_claw', '裂爪と急降下', [cone(0, 270, 100, 0.65, 1.4), cone(0.75, 270, 100, 0.55, 1.4), leap(1.5, 0.8, 200, 2.2)], { rec: 0.8 }),
        def('dk_meteor', '竜星群', [rain(0, 10, 85, 1.0, 1.3, { gap: 0.14 }), at(1.0, 95, 0.9, 1.3, { who: 'rand' })]),
        def('dk_storm', '終焉の嵐', [spiral(0, 2.2, 250, 0.8, { arms: 3 }), donut(1.0, 440, 150, 1.0, 1.4)], { rec: 0.8 })
    ], def('dk_roar', '竜王の咆哮', [ring(0, 350, 1.4, 1.0, STUN)]));

    // ============================================================
    // ゲートキーパー（世界の門番）
    //  門の前から動かず、周囲に無数の「門」を開いて、そこから剣やビームを撃ち込んでくる。
    //  門は開いてからしばらく光っている（予告）。剣は門の向き＝標的に向かって真っすぐ飛ぶ。ビームは細い予告線のあとに発射。
    //  大技は、HPが減るたびに1回ずつ（激昂中はさらにときどき）。ほかのボスの技とは別物。
    // ============================================================
    // --- 次元の門番：第一世界→第二世界 ---
    set('gate_world2', [
        def('g1_blades', '剣の門', [ports(0, 'around', 6, 440, 3.6),
            swords(1.0), swords(1.6, { track: true, frac: 0.8 }), swords(2.2, { track: true, frac: 0.8 }), swords(2.8, { track: true, per: 3, sp: 0.14, frac: 0.6 })]),
        def('g1_beams', '光条の門', [ports(0, 'side', 5, 560, 3.0, { gapY: 190 }), beams(0.9, 1500, 64, 0.9, 1.2),
            ports(2.0, 'sky', 5, 540, 2.4, { gapX: 230 }), beams(2.9, 1500, 70, 0.9, 1.2)], { rec: 0.8 }),
        def('g1_rain', '千剣の雨', [ports(0, 'sky', 9, 520, 3.8, { gapX: 130 }),
            swords(0.9, { frac: 0.6, spd: 500 }), swords(1.4, { frac: 0.6, spd: 500 }), swords(1.9, { frac: 0.6, spd: 500 }), swords(2.4, { frac: 0.6, spd: 500 }), swords(2.9, { frac: 0.6, spd: 500 })])
    ], def('g1_seal', '封門の鎖', [ports(0, 'around', 4, 380, 2.0), at(0.3, 125, 1.3, 0.9, STUN)]),
    { ult: def('g1_ult', '万象開門・千剣', [
        ports(0, 'around', 12, 520, 7.2),
        swords(1.4), swords(2.1, { track: true, frac: 0.7 }), swords(2.7, { track: true, frac: 0.7 }), swords(3.3, { track: true, frac: 0.7 }),
        beams(3.4, 1500, 56, 0.95, 1.3, { frac: 0.4 }),
        swords(4.4, { track: true, frac: 0.6, spd: 560 }), swords(5.0, { track: true, frac: 0.6, spd: 560 }),
        ports(5.0, 'side', 6, 600, 2.6, { gapY: 150 }), beams(6.0, 1500, 60, 0.9, 1.4)
    ], { ult: true, rec: 1.2 }), ultAt: [0.65, 0.3] });

    // --- 終焉の門番：第二世界→第三世界 ---
    set('gate_world3', [
        def('g2_blades', '剣の門・双', [ports(0, 'around', 8, 480, 4.0),
            swords(1.0, { per: 2, sp: 0.1 }), swords(1.5, { track: true }), swords(2.0, { track: true }), swords(2.5, { track: true, per: 2, sp: 0.12 }), swords(3.0, { track: true })]),
        def('g2_beams', '光条の門・交', [ports(0, 'side', 7, 600, 3.2, { gapY: 150 }), beams(0.9, 1500, 58, 0.9, 1.3),
            ports(1.9, 'diag', 4, 650, 2.6), beams(2.8, 1300, 80, 0.9, 1.4)], { rec: 0.8 }),
        def('g2_rain', '千剣の豪雨', [ports(0, 'sky', 11, 520, 4.4, { gapX: 120 }),
            swords(0.9, { frac: 0.55, spd: 560 }), swords(1.3, { frac: 0.55, spd: 560 }), swords(1.7, { frac: 0.55, spd: 560 }), swords(2.1, { frac: 0.55, spd: 560 }), swords(2.5, { frac: 0.55, spd: 560 }), swords(2.9, { frac: 0.55, spd: 560 }),
            beams(1.6, 1500, 56, 0.8, 1.2, { frac: 0.2, track: true })]),
        def('g2_close', '閉門衝撃', [ring(0, 360, 1.2, 1.4), donut(1.3, 620, 360, 1.0, 1.3), ports(1.0, 'around', 6, 420, 3.0), swords(2.4, { track: true, per: 2, sp: 0.12 })])
    ], def('g2_seal', '封門の大鎖', [ports(0, 'around', 6, 420, 2.2), at(0.2, 135, 1.3, 0.9, STUN)]),
    { ult: def('g2_ult', '天地開闢・全門解放', [
        ports(0, 'around', 16, 600, 9.2),
        swords(1.4, { per: 2, sp: 0.1 }), swords(2.0, { track: true, frac: 0.8 }), swords(2.5, { track: true, frac: 0.8 }), swords(3.0, { track: true, frac: 0.6, per: 2, sp: 0.12 }), swords(3.5, { track: true, frac: 0.6, per: 2, sp: 0.12 }),
        beams(3.0, 1500, 52, 0.9, 1.4, { frac: 0.35 }),
        ports(4.2, 'diag', 4, 700, 3.2), beams(5.0, 1500, 90, 0.9, 1.6),
        ports(5.6, 'side', 8, 650, 2.8, { gapY: 150 }), beams(6.5, 1500, 56, 0.9, 1.4),
        line(7.6, 2600, 220, 1.6, 2.4, { aim: 't' }),
        ports(8.4, 'sky', 9, 540, 2.6, { gapX: 130 }), swords(9.4, { frac: 0.7, spd: 560 }), swords(9.9, { frac: 0.7, spd: 560 })
    ], { ult: true, rec: 1.4 }), ultAt: [0.75, 0.5, 0.25] });

    // ============================================================
    // 第三世界「神域」
    // ============================================================
    // --- 熾天使ケルビム：六枚の翼と光輪 ---
    set('god_garden', [
        def('ke_wings', '六翼の斬撃', [cone(0, 270, 100, 0.6, 1.3, { aim: 'l', off: -40 }), cone(0.55, 270, 100, 0.5, 1.3, { aim: 'l', off: 40 }), cone(1.1, 290, 140, 0.65, 1.7, { aim: 't' })]),
        def('ke_halo', '光輪の舞', [rad(0, 24, 250, 0.7), ring(0.4, 190, 0.9, 1.5), rad(1.4, 24, 280, 0.7)]),
        def('ke_judge', '裁きの光', [rain(0, 10, 78, 1.0, 1.2, { gap: 0.14 }), at(0.9, 100, 0.9, 1.3, { who: 'rand' })])
    ], def('ke_seal', '聖印の封縛', [ring(0, 340, 1.4, 0.9, STUN)]));

    // --- 鍛冶神ヘパイストス：鉄槌と溶岩 ---
    set('god_forge', [
        def('fg_hammer', '神鉄の大槌', [leap(0, 0.9, 210, 2.1), ring(1.1, 160, 0.7, 1.3)], { rec: 0.8 }),
        def('fg_sparks', '火花の連打', [fan(0, 9, 8, 380, 0.7), fan(0.4, 9, 8, 380, 0.7), fan(0.8, 9, 8, 380, 0.7), rain(1.0, 6, 85, 1.0, 1.1)]),
        def('fg_lava', '溶岩流', [line(0, 700, 80, 0.9, 1.7, { aim: 'l', off: -30 }), line(0, 700, 80, 0.9, 1.7, { aim: 'l', off: 0 }), line(0, 700, 80, 0.9, 1.7, { aim: 'l', off: 30 }), donut(1.2, 440, 150, 1.0, 1.3)])
    ], def('fg_anvil', '金床落とし', [leap(0, 0.95, 200, 1.0, STUN)]));

    // --- 星喰いの鯨ケートス：大潮と星の吐息 ---
    set('god_ocean', [
        def('ct_tide', '大潮', [donut(0, 460, 160, 1.1, 1.4), ring(1.3, 140, 0.7, 1.5), donut(2.0, 460, 160, 0.9, 1.4)]),
        def('ct_breath', '星の吐息', [cone(0, 720, 90, 1.0, 0.6, { aim: 't', rep: 6, gap: 0.28 })], { rec: 0.8 }),
        def('ct_swim', '潜行突進', [warn(0, 680, 90, 0.7), dash(0.7, 0.6, 880), warn(1.5, 680, 90, 0.5, { aim: 't' }), dash(2.0, 0.6, 880, { aim: 't' })], { rec: 0.8 })
    ], def('ct_whirl', '星海の大渦', [ring(0, 380, 1.4, 0.9, STUN)]));

    // --- 記録の大天使メタトロン：光の頁と聖典 ---
    set('god_archive', [
        def('mm_pages', '光の頁', [fan(0, 11, 8, 360, 0.7), fan(0.5, 11, 8, 360, 0.7), fan(1.0, 11, 8, 360, 0.7)]),
        def('mm_script', '聖典の断罪', [0, 1, 2, 3].map(i => line(i * 0.45, 720, 62, 0.8, 1.5, { aim: 't', off: (i - 1.5) * 14 }))),
        def('mm_rain', '記録の雨', [rain(0, 12, 75, 1.1, 1.2, { gap: 0.12 }), rad(1.6, 22, 240, 0.7)])
    ], def('mm_seal', '封印の文字', [at(0, 150, 1.3, 0.9, STUN), ring(0.3, 120, 1.0, 1.0)]));

    // --- 混沌の母ティアマト：混沌のブレスと眷属 ---
    set('god_chaos', [
        def('tm_breath', '混沌のブレス', [cone(0, 760, 130, 1.1, 0.6, { aim: 't', rep: 5, gap: 0.28 })], { rec: 0.8 }),
        def('tm_claw', '竜爪の連撃', [cone(0, 270, 100, 0.65, 1.4), cone(0.7, 270, 100, 0.55, 1.4), leap(1.4, 0.8, 200, 2.2)], { rec: 0.8 }),
        def('tm_spawn', '眷属産み', [summon(0, 6), rad(0.5, 18, 230, 0.7)]),
        def('tm_storm', '混沌の嵐', [spiral(0, 2.3, 250, 0.8, { arms: 3 }), donut(1.0, 460, 150, 1.0, 1.4)], { rec: 0.8 })
    ], def('tm_roar', '母なる咆哮', [ring(0, 380, 1.4, 1.0, STUN)]));

    // --- 創世神アルカディア：創世の陽光と審判 ---
    set('god_throne', [
        def('ar_sun', '創世の陽光', [0, 1, 2, 3, 4, 5].map(i => line(i * 0.3, 700, 66, 0.6, 1.4, { aim: 'l', off: i * 30 }))),
        def('ar_stars', '星生み', [rain(0, 12, 78, 1.0, 1.3, { gap: 0.12 }), rad(1.3, 20, 250, 0.7)]),
        def('ar_judge', '審判の剣', [cone(0, 290, 140, 0.7, 1.7, { aim: 't' }), cone(0.8, 290, 140, 0.6, 1.7, { aim: 't' }), leap(1.6, 0.85, 220, 2.3)], { rec: 0.9 }),
        def('ar_genesis', '天地創造', [spiral(0, 2.4, 250, 0.8, { arms: 3 }), donut(1.0, 480, 160, 1.0, 1.4), summon(1.4, 4)], { rec: 0.9 })
    ], def('ar_silence', '静寂の世界', [ring(0, 420, 1.5, 1.0, STUN)]));

    window.BOSS_MOVES = { MOVES: MOVES, SETS: SETS, STUN_SECONDS: 3.0, STUN_IMMUNE: 3.5 };
})();
