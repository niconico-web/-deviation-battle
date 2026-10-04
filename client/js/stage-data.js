// ============================================================
// ステージ定義 (stage-data.js)
//  ・町(ロビー)から飛べる「ダンジョン1つ＋ボス1体」のステージ。約5分で1周
//  ・各ステージの敵／ボスには、ドロップする武器ベースが決まっている
//    - drops     : 雑魚・宝箱が落とす武器ベース
//    - bossDrops : ボスだけが落とす専用武器ベース（レア以上確定）
//  ・敵の動きは arch（行動タイプ）で決まり、ステージごとに見た目と名前が変わる
// ============================================================
(function () {
    'use strict';

    // 敵の行動タイプ
    //  chaser: 追いかけて体当たり / ranged: 距離を取って撃つ / charger: 溜めて突進
    //  tank: 遅いが硬い / bomber: 近づいて自爆 / swarm: 小さく速い群れ
    const ARCH = {
        chaser:  { hp: 1.0, atk: 1.0, spd: 1.0, r: 16 },
        ranged:  { hp: 0.7, atk: 0.9, spd: 0.8, r: 15 },
        charger: { hp: 1.2, atk: 1.4, spd: 0.9, r: 18 },
        tank:    { hp: 2.6, atk: 1.1, spd: 0.55, r: 24 },
        bomber:  { hp: 0.6, atk: 2.0, spd: 1.25, r: 15 },
        swarm:   { hp: 0.35, atk: 0.6, spd: 1.5, r: 11 }
    };

    // ボスの攻撃パターン（stage.js が実装）
    //  radial: 全方位弾 / volley: 狙い撃ち扇弾 / slam: 予告つき範囲攻撃 / charge: 突進
    //  summon: 手下召喚 / spiral: 渦巻き弾
    const PATTERNS = ['radial', 'volley', 'slam', 'charge', 'summon', 'spiral'];

    const S = []; // ステージ配列

    function add(def) {
        def.index = S.length;
        S.push(def);
    }

    // ilvl はドロップ武器の基礎レベル。ステージ難度もこれに比例する。
    add({
        id: 'meadow', name: '陽だまりの草原', icon: '🌾', ilvl: 1, bg: '#4f7d2c', bg2: '#3f6a22',
        desc: 'はじめての冒険。スライムと小鬼が群れる草原。',
        enemies: [{ name: 'スライム', icon: '🟢', arch: 'chaser', color: '#58c24a' }, { name: 'ミツバチ兵', icon: '🐝', arch: 'swarm', color: '#e8c33a' }, { name: 'ゴブリン弓兵', icon: '🏹', arch: 'ranged', color: '#8bb04a' }],
        boss: { name: 'ゴブリンキング', icon: '👑', color: '#7cb342', patterns: ['slam', 'summon', 'charge'] },
        drops: ['iron_sword', 'hand_axe', 'wood_spear', 'short_bow', 'bamboo_katana', 'twig_wand'],
        bossDrops: ['steel_sword', 'wood_mallet']
    });
    add({
        id: 'whisper_forest', name: 'ささやきの森', icon: '🌲', ilvl: 2, bg: '#1f4d3a', bg2: '#173d2e',
        desc: '木々が囁く深い森。魔女が罠を張っている。',
        enemies: [{ name: 'ウルフ', icon: '🐺', arch: 'charger', color: '#9a8a7a' }, { name: '毒キノコ', icon: '🍄', arch: 'bomber', color: '#c0502f' }, { name: '森の魔術師', icon: '🧙', arch: 'ranged', color: '#4aa37a' }],
        boss: { name: '森の魔女', icon: '🧙‍♀️', color: '#6a4aa3', patterns: ['volley', 'summon', 'spiral'] },
        drops: ['knife', 'sickle', 'leather_whip', 'short_bow', 'cloth_glove', 'wood_mallet'],
        bossDrops: ['stiletto', 'crystal_wand']
    });
    add({
        id: 'sand_ruins', name: '砂塵の遺跡', icon: '🏜️', ilvl: 3, bg: '#a8884f', bg2: '#8f733f',
        desc: '砂に埋もれた古代遺跡。サンドワームが這いまわる。',
        enemies: [{ name: 'サソリ', icon: '🦂', arch: 'charger', color: '#c58a3a' }, { name: 'ミイラ', icon: '🧟', arch: 'tank', color: '#d6cfa0' }, { name: '砂蜘蛛', icon: '🕷️', arch: 'swarm', color: '#7a5a2a' }],
        boss: { name: 'サンドワーム', icon: '🪱', color: '#b5792f', patterns: ['charge', 'slam', 'radial'] },
        drops: ['hand_xbow', 'naginata', 'hunting_gun', 'steel_sword', 'psy_ring', 'big_blade'],
        bossDrops: ['wakizashi', 'iron_lance']
    });
    add({
        id: 'frost_lab', name: '氷の研究所', icon: '❄️', ilvl: 4, bg: '#8fb8d8', bg2: '#6f9ec4',
        desc: '凍てついた研究施設。暴走した実験体がうろつく。',
        enemies: [{ name: '氷の精霊', icon: '🧊', arch: 'ranged', color: '#8fe0ff' }, { name: 'フロストゴーレム', icon: '🗿', arch: 'tank', color: '#b0d4e8' }, { name: 'ペンギン兵', icon: '🐧', arch: 'swarm', color: '#4a6a8a' }],
        boss: { name: 'アイスゴーレム', icon: '🥶', color: '#5fb4e6', patterns: ['slam', 'radial', 'volley'] },
        drops: ['zweihander', 'long_bow', 'revolver', 'knuckle', 'crystal_wand', 'iron_lance'],
        bossDrops: ['rune_sword', 'chain_whip']
    });
    add({
        id: 'wasteland', name: '荒野の戦場', icon: '⚔️', ilvl: 5, bg: '#8a7355', bg2: '#735f45',
        desc: '古戦場に亡霊が彷徨う。オークの戦将が待ち構える。',
        enemies: [{ name: 'オーク戦士', icon: '👹', arch: 'chaser', color: '#6a8a3a' }, { name: '骸骨兵', icon: '💀', arch: 'chaser', color: '#e8e4d0' }, { name: '投石オーク', icon: '🪨', arch: 'ranged', color: '#7a6a4a' }],
        boss: { name: 'オークの戦将', icon: '🪓', color: '#7a8a2a', patterns: ['charge', 'summon', 'slam'] },
        drops: ['battle_axe', 'wakizashi', 'spike_boots', 'chain_whip', 'zweihander', 'revolver'],
        bossDrops: ['berserk_axe', 'war_hammer']
    });
    add({
        id: 'toxic_swamp', name: '呪われた沼地', icon: '🐍', ilvl: 6, bg: '#3f5a3a', bg2: '#324a2e',
        desc: '毒霧の立ち込める沼。大蛇ヨルムンガンドの縄張り。',
        enemies: [{ name: 'ポイズンフロッグ', icon: '🐸', arch: 'bomber', color: '#7ad24a' }, { name: '沼の亡者', icon: '🧟', arch: 'tank', color: '#5a7a5a' }, { name: '毒蛇', icon: '🐍', arch: 'charger', color: '#8aca5a' }],
        boss: { name: 'ヨルムンガンド', icon: '🐉', color: '#3aa36a', patterns: ['spiral', 'charge', 'volley'] },
        drops: ['glaive', 'war_hammer', 'rune_sword', 'sawed_off', 'reaper', 'revolver'],
        bossDrops: ['trident', 'dragon_whip']
    });
    add({
        id: 'rocky_mountain', name: '岩山の洞窟', icon: '⛰️', ilvl: 7, bg: '#6e6e6e', bg2: '#585858',
        desc: '硬い岩の巨人が眠る洞窟。落石に注意。',
        enemies: [{ name: 'ロックゴーレム', icon: '🪨', arch: 'tank', color: '#8a8a8a' }, { name: 'コウモリ', icon: '🦇', arch: 'swarm', color: '#4a3a5a' }, { name: 'ドワーフ砲手', icon: '💣', arch: 'ranged', color: '#b08a4a' }],
        boss: { name: '岩石トロール', icon: '🗿', color: '#8a7a6a', patterns: ['slam', 'slam', 'summon'] },
        drops: ['war_hammer', 'battle_axe', 'sawed_off', 'asura_fist', 'heavy_xbow', 'glaive'],
        bossDrops: ['mjolnir', 'bardiche']
    });
    add({
        id: 'thunder_canyon', name: '雷鳴の渓谷', icon: '⚡', ilvl: 8, bg: '#4a5a8a', bg2: '#3a4a74',
        desc: '雷が絶えず落ちる谷。雷神ガルーダが空を舞う。',
        enemies: [{ name: '雷トカゲ', icon: '🦎', arch: 'charger', color: '#ffd84a' }, { name: '嵐の鷲', icon: '🦅', arch: 'swarm', color: '#8ab4ff' }, { name: '雷霊', icon: '🌩️', arch: 'ranged', color: '#c0d0ff' }],
        boss: { name: '雷神ガルーダ', icon: '⚡', color: '#ffd84a', patterns: ['volley', 'charge', 'spiral'] },
        drops: ['magnum', 'elven_bow', 'assassin_fang', 'muramasa', 'heavy_xbow', 'wind_greaves'],
        bossDrops: ['sky_bow', 'kusanagi']
    });
    add({
        id: 'magma_core', name: '灼熱の火山', icon: '🔥', ilvl: 9, bg: '#8a3a1a', bg2: '#6f2d12',
        desc: '溶岩が噴き出す火山。フレイムドラゴンの巣窟。',
        enemies: [{ name: 'マグマスライム', icon: '🟠', arch: 'chaser', color: '#ff7a2a' }, { name: '炎の悪魔', icon: '😈', arch: 'ranged', color: '#ff4a3a' }, { name: '爆炎虫', icon: '🪲', arch: 'bomber', color: '#ffb02a' }],
        boss: { name: 'フレイムドラゴン', icon: '🔥', color: '#ff5a2a', patterns: ['radial', 'volley', 'slam'] },
        drops: ['dragon_slayer', 'holy_sword', 'magnum', 'arch_staff', 'berserk_axe', 'soul_scythe'],
        bossDrops: ['dragon_breath', 'dragon_slayer']
    });
    add({
        id: 'deep_sea', name: '深海神殿', icon: '🐙', ilvl: 10, bg: '#1a4a7a', bg2: '#123a64',
        desc: '海底に沈んだ神殿。クラーケンの触手が襲う。',
        enemies: [{ name: 'クラゲ', icon: '🪼', arch: 'swarm', color: '#a0d0ff' }, { name: '深海魚', icon: '🐟', arch: 'charger', color: '#3a8ac4' }, { name: 'ヤドカリ兵', icon: '🐚', arch: 'tank', color: '#d08a6a' }],
        boss: { name: '深海クラーケン', icon: '🐙', color: '#6a4ac4', patterns: ['spiral', 'slam', 'summon'] },
        drops: ['trident', 'dragon_whip', 'wind_greaves', 'elven_bow', 'arch_staff', 'psy_crown'],
        bossDrops: ['gungnir', 'psy_crown']
    });
    add({
        id: 'haunted_graveyard', name: '月夜の墓地', icon: '🪦', ilvl: 11, bg: '#2a2a3f', bg2: '#202032',
        desc: '血の伯爵が支配する墓地。夜ほど敵は強くなる。',
        enemies: [{ name: 'ゾンビ', icon: '🧟‍♂️', arch: 'tank', color: '#6a8a5a' }, { name: 'ゴースト', icon: '👻', arch: 'ranged', color: '#d0d8ff' }, { name: '吸血コウモリ', icon: '🦇', arch: 'swarm', color: '#7a3a5a' }],
        boss: { name: '血の伯爵', icon: '🧛', color: '#c0302f', patterns: ['volley', 'summon', 'radial'] },
        drops: ['soul_scythe', 'reaper', 'moon_dagger', 'asura_fist', 'void_sword', 'arch_staff'],
        bossDrops: ['moon_dagger', 'void_sword']
    });
    add({
        id: 'sky_castle', name: '天空城', icon: '🏰', ilvl: 12, bg: '#9ab4e8', bg2: '#7f9cd6',
        desc: '雲の上にそびえる城。守護者が侵入者を裁く。',
        enemies: [{ name: '天使兵', icon: '😇', arch: 'ranged', color: '#fff0b0' }, { name: '白銀の騎士', icon: '🛡️', arch: 'tank', color: '#d0d8e8' }, { name: '風の精', icon: '🌀', arch: 'swarm', color: '#b0e8ff' }],
        boss: { name: 'セレスティアルガーディアン', icon: '😇', color: '#ffe08a', patterns: ['radial', 'slam', 'volley'] },
        drops: ['holy_sword', 'sky_bow', 'star_staff', 'bardiche', 'kusanagi', 'world_edge'],
        bossDrops: ['star_staff', 'holy_sword']
    });
    add({
        id: 'fallen_church', name: '堕ちた聖堂', icon: '⛪', ilvl: 13, bg: '#3a1f3f', bg2: '#2c1630',
        desc: '堕天使ルシフェルが祈りを歪めた聖堂。',
        enemies: [{ name: '堕ちた聖職者', icon: '🧎', arch: 'ranged', color: '#b04ac4' }, { name: 'ガーゴイル', icon: '🗿', arch: 'charger', color: '#6a5a7a' }, { name: '悪魔の子', icon: '👿', arch: 'bomber', color: '#e83a6a' }],
        boss: { name: '堕天使ルシフェル', icon: '😈', color: '#9a2ac4', patterns: ['spiral', 'volley', 'charge'] },
        drops: ['void_sword', 'world_edge', 'rail_pistol', 'siege_xbow', 'dragon_breath', 'kusanagi'],
        bossDrops: ['world_edge', 'rail_pistol']
    });
    add({
        id: 'abyssal_rift', name: '深淵の裂け目', icon: '🌀', ilvl: 15, bg: '#120a24', bg2: '#0a0618',
        desc: '世界の底。深淵ヲ廻ルモノが待つ最終ステージ。',
        enemies: [{ name: '虚無の眷属', icon: '👁️', arch: 'ranged', color: '#8a4aff' }, { name: '深淵の獣', icon: '🦑', arch: 'charger', color: '#4a2a8a' }, { name: '終焉の使徒', icon: '☠️', arch: 'tank', color: '#2a2a3a' }, { name: '星屑', icon: '✨', arch: 'swarm', color: '#d0b0ff' }],
        boss: { name: '深淵ヲ廻ルモノ', icon: '🌀', color: '#6a2aff', patterns: ['spiral', 'radial', 'slam', 'summon'] },
        drops: ['void_sword', 'world_edge', 'kusanagi', 'sky_bow', 'star_staff', 'siege_xbow', 'moon_dagger', 'mjolnir'],
        bossDrops: ['world_edge', 'kusanagi', 'sky_bow']
    });

    // 短時間で周回できる「ミニステージ」：序盤の装備稼ぎ用（ボスがやや軽い）
    add({
        id: 'slime_burrow', name: 'スライムの巣穴', icon: '🟢', ilvl: 1, bg: '#3f7a4f', bg2: '#336a42',
        desc: '3分で終わる入門ステージ。スライムの王様が待つ。',
        enemies: [{ name: 'スライム', icon: '🟢', arch: 'chaser', color: '#58c24a' }, { name: '子スライム', icon: '🟩', arch: 'swarm', color: '#7ad26a' }],
        boss: { name: 'キングスライム', icon: '🫧', color: '#3aa36a', patterns: ['slam', 'summon', 'radial'] },
        drops: ['iron_sword', 'knife', 'cloth_glove', 'sneaker', 'twig_wand', 'old_pistol'],
        bossDrops: ['hand_axe', 'wood_spear'], mini: true
    });
    add({
        id: 'goblin_camp', name: 'ゴブリンの野営地', icon: '🏕️', ilvl: 2, bg: '#6a5a3a', bg2: '#574a2e',
        desc: '焚き火を囲むゴブリンたち。戦利品をたっぷり溜め込んでいる。',
        enemies: [{ name: 'ゴブリン', icon: '👺', arch: 'chaser', color: '#8bb04a' }, { name: 'ゴブリン弓兵', icon: '🏹', arch: 'ranged', color: '#a0c05a' }, { name: 'ゴブリン爆弾兵', icon: '💣', arch: 'bomber', color: '#c0702f' }],
        boss: { name: 'ホブゴブリン将軍', icon: '👹', color: '#8a6a2a', patterns: ['charge', 'summon', 'volley'] },
        drops: ['hand_axe', 'bamboo_katana', 'old_pistol', 'wood_mallet', 'leather_whip', 'sneaker'],
        bossDrops: ['naginata', 'hand_xbow'], mini: true
    });
    add({
        id: 'haunted_library', name: '幽霊図書館', icon: '📚', ilvl: 5, bg: '#4a3a5a', bg2: '#3a2c48',
        desc: '本の亡霊が襲ってくる、学びの墓場。',
        enemies: [{ name: '飛ぶ魔導書', icon: '📖', arch: 'ranged', color: '#c0a0ff' }, { name: 'インクスライム', icon: '🖋️', arch: 'chaser', color: '#3a3a6a' }, { name: '栞の群れ', icon: '🔖', arch: 'swarm', color: '#ff7a7a' }],
        boss: { name: '禁書の番人', icon: '📕', color: '#a02a4a', patterns: ['spiral', 'volley', 'summon'] },
        drops: ['crystal_wand', 'psy_ring', 'stiletto', 'rune_sword', 'sawed_off', 'knuckle'],
        bossDrops: ['arch_staff', 'psy_crown']
    });
    add({
        id: 'clockwork_factory', name: '歯車工場', icon: '⚙️', ilvl: 8, bg: '#5a5a4a', bg2: '#484839',
        desc: '止まらない自動兵器の工場。機械のボスが稼働中。',
        enemies: [{ name: 'ドローン', icon: '🛸', arch: 'swarm', color: '#aab4c4' }, { name: '警備ロボ', icon: '🤖', arch: 'chaser', color: '#8a94a4' }, { name: '砲台', icon: '🔫', arch: 'ranged', color: '#c4a46a' }, { name: '重装ロボ', icon: '🦾', arch: 'tank', color: '#6a7484' }],
        boss: { name: 'メカ・タイタン', icon: '🤖', color: '#c4a42a', patterns: ['radial', 'slam', 'volley', 'summon'] },
        drops: ['magnum', 'heavy_xbow', 'hand_xbow', 'sawed_off', 'spike_boots', 'wind_greaves'],
        bossDrops: ['rail_pistol', 'siege_xbow']
    });

    // 難易度：敵のHP・攻撃・速さ・精鋭の出現率と、ドロップのレア度補正
    const DIFFS = [
        { name: 'ノーマル',   hp: 1.0, dmg: 1.0, spd: 1.0,  elite: 0.10, luck: 0.0, color: '#3a6ee8', note: '標準。装備を整えながら進める難易度。' },
        { name: 'ハード',     hp: 2.2, dmg: 1.6, spd: 1.08, elite: 0.16, luck: 0.7, color: '#d9812a', note: '敵が硬く強い。高レア武器が出やすい。' },
        { name: 'ナイトメア', hp: 4.5, dmg: 2.4, spd: 1.16, elite: 0.24, luck: 1.6, color: '#b03a3a', note: '被弾が痛い上級者向け。伝説武器を狙える。' }
    ];

    window.STAGE_DATA = { STAGES: S, ARCH: ARCH, PATTERNS: PATTERNS, DIFFS: DIFFS };
    window.getStageById = function (id) { return S.find(s => s.id === id) || null; };
})();
