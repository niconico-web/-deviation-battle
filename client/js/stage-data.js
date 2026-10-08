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
        if (!def.world) def.world = 1;
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


    // ============================================================
    // 第二世界「次元の裏側」
    //  ・第一世界の最終ステージ「深淵の裂け目」をナイトメアでクリアすると解放される
    //  ・world:2 のステージは敵が強い（power：HP／攻撃／速さの倍率）。ボスは専用の技セット(boss-moves.js)を持つ
    // ============================================================
    const W2_POWER = { hp: 1.6, dmg: 1.4, spd: 1.08 };
    add({
        id: 'rift_plains', world: 2, power: W2_POWER, name: '砕けた大地', icon: '🌌', ilvl: 16, bg: '#3a3358', bg2: '#2b2545',
        desc: '次元の割れ目の向こうに広がる、ひび割れた大地。次元狼の群れが獲物を探している。',
        enemies: [{ name: '裂け目の兵', icon: '👤', arch: 'chaser', color: '#9a7aff' }, { name: '次元ウルフ', icon: '🐺', arch: 'charger', color: '#6a8aff' }, { name: '浮遊する岩片', icon: '🪨', arch: 'ranged', color: '#a89ad8' }, { name: '歪みの虫', icon: '🪲', arch: 'swarm', color: '#c07aff' }],
        boss: { name: '次元狼フェンリル・ゼロ', icon: '🐺', color: '#7a8aff', patterns: ['charge', 'radial', 'slam'] },
        drops: ['void_sword', 'moon_dagger', 'rail_pistol', 'wind_greaves', 'asura_fist', 'rift_twins', 'moon_chakram'],
        bossDrops: ['fenrir_fang', 'rift_twins']
    });
    add({
        id: 'rift_forest', world: 2, power: W2_POWER, name: '逆さの森', icon: '🌳', ilvl: 17, bg: '#2a4a46', bg2: '#1f3a37',
        desc: '根が空を向く、上下の逆転した森。嘆きの樹母が侵入者を絡め取る。',
        enemies: [{ name: '逆さの花', icon: '🌺', arch: 'ranged', color: '#ff7ac0' }, { name: '根の蛇', icon: '🪱', arch: 'charger', color: '#8a6a3a' }, { name: '腐った古木', icon: '🌲', arch: 'tank', color: '#4a6a3a' }, { name: '胞子', icon: '🍄', arch: 'bomber', color: '#c09aff' }],
        boss: { name: '嘆きの樹母', icon: '🌳', color: '#3aa36a', patterns: ['spiral', 'slam', 'summon'] },
        drops: ['star_staff', 'sky_bow', 'arch_staff', 'dragon_whip', 'rift_tome', 'rift_chain', 'siege_xbow'],
        bossDrops: ['world_tree_bow', 'rift_tome']
    });
    add({
        id: 'rift_desert', world: 2, power: W2_POWER, name: '鏡面の砂漠', icon: '🪞', ilvl: 18, bg: '#b89a6a', bg2: '#9a7f54',
        desc: '砂のひと粒ひと粒が鏡になった砂漠。蜃気楼の中でスフィンクスが謎を出す。',
        enemies: [{ name: '鏡の亡霊', icon: '👻', arch: 'ranged', color: '#e0e8ff' }, { name: '蜃気楼の獣', icon: '🦁', arch: 'charger', color: '#e8c070' }, { name: '砂金の守り手', icon: '🗿', arch: 'tank', color: '#d8b84a' }, { name: '光の欠片', icon: '✨', arch: 'swarm', color: '#fff0a0' }],
        boss: { name: 'ミラージュ・スフィンクス', icon: '🦁', color: '#e8b84a', patterns: ['volley', 'slam', 'summon'] },
        drops: ['muramasa', 'kusanagi', 'heavy_xbow', 'gungnir', 'psy_crown', 'moon_chakram', 'rift_cannon'],
        bossDrops: ['mirage_blade', 'rift_cannon']
    });
    add({
        id: 'rift_clock', world: 2, power: W2_POWER, name: '溶けた時計塔', icon: '⏳', ilvl: 19, bg: '#4a3f2a', bg2: '#392f1f',
        desc: '時間がどろりと溶けた塔。針が逆回りする部屋で、時を喰らうものが待つ。',
        enemies: [{ name: '歯車の亡霊', icon: '⚙️', arch: 'chaser', color: '#c4a46a' }, { name: '砂時計の蛇', icon: '⏳', arch: 'charger', color: '#e8d08a' }, { name: '振り子の騎士', icon: '🛡️', arch: 'tank', color: '#8a7a5a' }, { name: '刻の砂粒', icon: '💠', arch: 'swarm', color: '#f0d8a0' }, { name: '時計砲台', icon: '🕰️', arch: 'ranged', color: '#b09a6a' }],
        boss: { name: '刻喰らいクロノス', icon: '⏳', color: '#d8b84a', patterns: ['spiral', 'radial', 'slam'] },
        drops: ['soul_scythe', 'reaper', 'rail_pistol', 'moon_dagger', 'chrono_twins', 'chrono_chain', 'world_edge'],
        bossDrops: ['chrono_scythe', 'chrono_chain']
    });
    add({
        id: 'rift_battlefield', world: 2, power: W2_POWER, name: '星屑の戦場', icon: '🌠', ilvl: 20, bg: '#1a1f4a', bg2: '#12163a',
        desc: '砕けた星々が降り注ぐ宇宙の戦場。星砕きの巨神が足を踏み鳴らす。',
        enemies: [{ name: '星屑の兵', icon: '⭐', arch: 'chaser', color: '#ffe08a' }, { name: '隕石獣', icon: '☄️', arch: 'charger', color: '#ff8a4a' }, { name: '星の砲手', icon: '🌟', arch: 'ranged', color: '#a0b4ff' }, { name: '流星', icon: '💫', arch: 'swarm', color: '#d0e0ff' }, { name: '惑星の番人', icon: '🪐', arch: 'tank', color: '#8a7ab4' }],
        boss: { name: '星砕きの巨神', icon: '🌠', color: '#ffb84a', patterns: ['slam', 'radial', 'charge'] },
        drops: ['mjolnir', 'world_edge', 'bardiche', 'siege_xbow', 'star_staff', 'dragon_breath', 'star_chakram'],
        bossDrops: ['star_crusher', 'star_chakram']
    });
    add({
        id: 'rift_throne', world: 2, power: { hp: 1.9, dmg: 1.5, spd: 1.1 }, name: '終焉の玉座', icon: '👑', ilvl: 22, bg: '#2a0f3a', bg2: '#1c0a28',
        desc: '次元の最奥。すべての世界を見下ろす玉座に、次元竜王が君臨する。',
        enemies: [{ name: '竜王の近衛', icon: '🐉', arch: 'chaser', color: '#c04aff' }, { name: '次元の竜騎士', icon: '🛡️', arch: 'tank', color: '#6a4a9a' }, { name: '終焉の使い魔', icon: '👁️', arch: 'ranged', color: '#ff4a9a' }, { name: '虚無の爆炎', icon: '💥', arch: 'bomber', color: '#ff7a3a' }, { name: '星竜の幼体', icon: '🦎', arch: 'charger', color: '#4aa0ff' }],
        boss: { name: '次元竜王バハムート・ノヴァ', icon: '🐲', color: '#b04aff', patterns: ['radial', 'volley', 'slam', 'summon'] },
        drops: ['world_edge', 'kusanagi', 'soul_scythe', 'gungnir', 'sky_bow', 'chrono_twins', 'akashic_tome', 'rail_pistol', 'star_staff'],
        bossDrops: ['nova_roar', 'nova_cannon', 'akashic_tome']
    });


    // ============================================================
    // ゲートキーパー（世界をまたぐ門番）
    //  ・前の世界の最終ステージをナイトメアで攻略すると「門」が現れ、このステージが挑めるようになる
    //  ・倒すと次の世界が解放される。雑魚はおらず最初からボス戦（bossOnly）。ボスは門の前から動かない（stand）
    //  ・技は boss-moves.js の「ゲート」系（ゲートから無数の剣とビームを撃つ）
    // ============================================================
    add({
        id: 'gate_world2', world: 1, gateTo: 2, bossOnly: true, power: { hp: 1.8, dmg: 1.4, spd: 1.0 },
        name: '次元の門', icon: '🚪', ilvl: 16, bg: '#241a3a', bg2: '#180f2a',
        desc: '深淵の裂け目の奥に現れた、次元の門。門を守るゲートキーパーを倒さなければ、第二世界へは進めない。',
        enemies: [{ name: '門の影', icon: '👤', arch: 'chaser', color: '#9a7aff' }],
        boss: { name: 'ゲートキーパー', icon: '🚪', color: '#ffd36a', patterns: ['radial'], stand: true, gate: true },
        drops: ['void_sword', 'world_edge', 'kusanagi', 'gungnir', 'star_staff'],
        bossDrops: ['gate_greatsword', 'world_edge']
    });
    add({
        id: 'gate_world3', world: 2, gateTo: 3, bossOnly: true, power: { hp: 2.3, dmg: 1.7, spd: 1.0 },
        name: '神域の門', icon: '⛩️', ilvl: 23, bg: '#1b1f4a', bg2: '#10133a',
        desc: '次元の最奥に聳える、神域へ通じる巨大な門。「終焉の門番」ゲートキーパーが、さらに多くの門を開いて待ち構える。',
        enemies: [{ name: '門の影', icon: '👤', arch: 'chaser', color: '#9a7aff' }],
        boss: { name: 'ゲートキーパー・終焉', icon: '⛩️', color: '#ffe9a0', patterns: ['radial'], stand: true, gate: true },
        drops: ['world_edge', 'kusanagi', 'soul_scythe', 'star_chakram', 'akashic_tome', 'nova_cannon'],
        bossDrops: ['gate_scepter', 'world_edge']
    });

    // ============================================================
    // 第三世界「神域」（ゲートキーパー・終焉を倒すと解放）
    // ============================================================
    const W3_POWER = { hp: 2.4, dmg: 1.8, spd: 1.12 };
    add({
        id: 'god_garden', world: 3, power: W3_POWER, name: '雲上の神苑', icon: '☁️', ilvl: 24, bg: '#7a9ad8', bg2: '#5f7fc0',
        desc: '雲の上に広がる白い庭園。聖獣と天使の兵が、侵入者を許さない。',
        enemies: [{ name: '天使兵', icon: '👼', arch: 'chaser', color: '#fff0b0' }, { name: '聖獣', icon: '🦄', arch: 'charger', color: '#e8d0ff' }, { name: '光の花', icon: '🌸', arch: 'ranged', color: '#ffb0d8' }, { name: '雲の精', icon: '☁️', arch: 'swarm', color: '#f0f4ff' }, { name: '守護像', icon: '🗿', arch: 'tank', color: '#b8c0d8' }],
        boss: { name: '熾天使ケルビム', icon: '😇', color: '#ffe680', patterns: ['volley', 'radial', 'slam'] },
        drops: ['sky_rapier', 'angel_bit', 'seraph_wand', 'god_edge', 'titan_bow', 'sky_bow', 'star_staff'],
        bossDrops: ['sky_rapier', 'seraph_wand']
    });
    add({
        id: 'god_forge', world: 3, power: W3_POWER, name: '神々の鍛冶場', icon: '⚒️', ilvl: 25, bg: '#5a2a1a', bg2: '#451e12',
        desc: '神の武具が打たれる灼熱の鍛冶場。鍛冶神が、終わらない槌音を響かせる。',
        enemies: [{ name: '炎の小人', icon: '🔥', arch: 'swarm', color: '#ff9a4a' }, { name: '鋼の巨兵', icon: '🤖', arch: 'tank', color: '#9aa4b8' }, { name: '溶岩犬', icon: '🐕', arch: 'charger', color: '#ff6a3a' }, { name: '火花砲台', icon: '💥', arch: 'ranged', color: '#ffc84a' }, { name: '爆炎', icon: '🧨', arch: 'bomber', color: '#ff7a3a' }],
        boss: { name: '鍛冶神ヘパイストス', icon: '🔨', color: '#ff8a3a', patterns: ['slam', 'volley', 'charge'] },
        drops: ['ether_gunblade', 'chaos_axe', 'god_edge', 'mjolnir', 'berserk_axe', 'siege_xbow', 'dragon_breath'],
        bossDrops: ['ether_gunblade', 'chaos_axe']
    });
    add({
        id: 'god_ocean', world: 3, power: W3_POWER, name: '星海の底', icon: '🌊', ilvl: 26, bg: '#0f2a5a', bg2: '#0a1f45',
        desc: '星々が水となって流れる、宇宙の海の底。星を喰らう鯨が、静かに泳いでいる。',
        enemies: [{ name: '星くらげ', icon: '🪼', arch: 'ranged', color: '#a0d8ff' }, { name: '深星魚', icon: '🐟', arch: 'swarm', color: '#80c0ff' }, { name: '星の鮫', icon: '🦈', arch: 'charger', color: '#6a9aff' }, { name: '星殻の亀', icon: '🐢', arch: 'tank', color: '#5a8ac8' }, { name: '泡の爆弾', icon: '🫧', arch: 'bomber', color: '#c0e8ff' }],
        boss: { name: '星喰いの鯨ケートス', icon: '🐋', color: '#4a9aff', patterns: ['spiral', 'radial', 'charge'] },
        drops: ['angel_bit', 'titan_bow', 'seraph_wand', 'aeon_bit', 'dragon_whip', 'star_staff', 'sky_bow'],
        bossDrops: ['aeon_bit', 'titan_bow']
    });
    add({
        id: 'god_archive', world: 3, power: W3_POWER, name: '無限書庫', icon: '📚', ilvl: 27, bg: '#3a3250', bg2: '#2a2440',
        desc: '世界の全てが記された、果てのない書庫。記録の大天使が、書かれざる者を消しに来る。',
        enemies: [{ name: '写本の霊', icon: '📜', arch: 'ranged', color: '#f0e0b0' }, { name: '羽ペンの蜂', icon: '🪶', arch: 'swarm', color: '#d8c8ff' }, { name: '書架の騎士', icon: '🛡️', arch: 'tank', color: '#8a7ab4' }, { name: '索引の獣', icon: '🐺', arch: 'charger', color: '#a89ad8' }, { name: '燃える頁', icon: '📕', arch: 'bomber', color: '#ff8a6a' }],
        boss: { name: '記録の大天使メタトロン', icon: '📖', color: '#ffe0a0', patterns: ['volley', 'radial', 'summon'] },
        drops: ['seraph_wand', 'divine_rapier', 'ether_gunblade', 'god_edge', 'star_staff', 'arch_staff', 'psy_crown'],
        bossDrops: ['divine_rapier', 'seraph_wand']
    });
    add({
        id: 'god_chaos', world: 3, power: W3_POWER, name: '原初の混沌', icon: '🌀', ilvl: 28, bg: '#2a1038', bg2: '#1c0a28',
        desc: '世界が生まれる前の、形のない混沌。混沌の母が、あらゆる怪物を産み続けている。',
        enemies: [{ name: '混沌の子', icon: '👾', arch: 'chaser', color: '#c04aff' }, { name: '形無き獣', icon: '🦑', arch: 'charger', color: '#8a3aff' }, { name: '歪んだ眼', icon: '👁️', arch: 'ranged', color: '#ff4a9a' }, { name: '泥の巨人', icon: '🗿', arch: 'tank', color: '#6a3a8a' }, { name: '虚無の欠片', icon: '💠', arch: 'swarm', color: '#d09aff' }],
        boss: { name: '混沌の母ティアマト', icon: '🐲', color: '#b03aff', patterns: ['radial', 'spiral', 'slam', 'summon'] },
        drops: ['chaos_axe', 'genesis_gunblade', 'aeon_bit', 'god_edge', 'soul_scythe', 'world_edge', 'dragon_breath', 'berserk_axe'],
        bossDrops: ['chaos_axe', 'genesis_gunblade']
    });
    add({
        id: 'god_throne', world: 3, power: { hp: 3.0, dmg: 2.0, spd: 1.14 }, name: '創世の玉座', icon: '☀️', ilvl: 30, bg: '#4a3a1a', bg2: '#352810',
        desc: '神域の最奥。すべてを創った創世神が、玉座から世界を見下ろしている。',
        enemies: [{ name: '神の近衛', icon: '⚔️', arch: 'chaser', color: '#ffe080' }, { name: '光の獅子', icon: '🦁', arch: 'charger', color: '#ffd04a' }, { name: '星の使徒', icon: '🌟', arch: 'ranged', color: '#fff0a0' }, { name: '黄金の巨像', icon: '🗽', arch: 'tank', color: '#d8b84a' }, { name: '創世の火', icon: '🔆', arch: 'bomber', color: '#ffb84a' }],
        boss: { name: '創世神アルカディア', icon: '☀️', color: '#fff0b0', patterns: ['radial', 'volley', 'slam', 'summon'] },
        drops: ['creation_scepter', 'genesis_gunblade', 'divine_rapier', 'god_edge', 'aeon_bit', 'titan_bow', 'seraph_wand', 'chaos_axe'],
        bossDrops: ['creation_scepter', 'genesis_gunblade', 'divine_rapier']
    });


    // ============================================================
    // 第四世界「機神の都」（ゲートキーパー・終焉II を倒すと解放）
    //  歯車と蒸気と電脳の都。機械の神々が、侵入者を部品に変える。新しい武器種：電磁砲・歯車刃
    // ============================================================
    const E = (name, icon, arch, color) => ({ name: name, icon: icon, arch: arch, color: color });
    const W4_POWER = { hp: 2.7, dmg: 1.9, spd: 1.14 };
    add({
        id: 'gate_world4', world: 3, gateTo: 4, bossOnly: true, power: { hp: 2.9, dmg: 1.9, spd: 1.0 },
        name: '機神の門', icon: '⚙️', ilvl: 31, bg: '#1d2430', bg2: '#121822',
        desc: '神域の果てに現れた、鋼鉄の巨大な門。門を守るゲートキーパーを倒さなければ、機神の都へは進めない。',
        enemies: [E('門の影', '👤', 'chaser', '#9ac0ff')],
        boss: { name: 'ゲートキーパー・機構', icon: '⚙️', color: '#ffd9a0', patterns: ['radial'], stand: true, gate: true },
        drops: ['god_edge', 'titan_bow', 'seraph_wand', 'genesis_gunblade', 'divine_rapier'],
        bossDrops: ['gate_gearblade', 'creation_scepter']
    });
    add({
        id: 'steam_bridge', world: 4, power: W4_POWER, name: '蒸気の大橋', icon: '🌉', ilvl: 32, bg: '#5a4a3a', bg2: '#463a2d',
        desc: '蒸気を噴き上げる巨大な鉄橋。蒸気竜機が橋の上を支配している。',
        enemies: [E('蒸気兵', '🤖', 'chaser', '#c8b090'), E('ボイラー虫', '🪲', 'bomber', '#ff9a4a'), E('鉄砲台', '🔫', 'ranged', '#9aa4b8')],
        boss: { name: '蒸気竜機スチームドレイク', icon: '🐲', color: '#e0a060', patterns: ['radial', 'charge', 'slam'] },
        drops: ['rail_mk1', 'gear_saw', 'clock_blade', 'steam_pistol', 'god_edge', 'chaos_axe'],
        bossDrops: ['rail_mk1', 'gear_saw']
    });
    add({
        id: 'gear_cathedral', world: 4, power: W4_POWER, name: '歯車の大聖堂', icon: '⛪', ilvl: 33, bg: '#3a3a4a', bg2: '#2b2b3a',
        desc: '無数の歯車が祈りを刻む大聖堂。大司教機が、止まらない讃美歌を奏でる。',
        enemies: [E('歯車の信徒', '⚙️', 'swarm', '#d0c090'), E('機械僧兵', '🛡️', 'tank', '#8a94a8'), E('鐘守', '🔔', 'ranged', '#ffe080')],
        boss: { name: '大司教機ギアビショップ', icon: '🔔', color: '#d8c070', patterns: ['volley', 'summon', 'spiral'] },
        drops: ['gear_twin', 'clock_blade', 'mech_halberd', 'rail_mk1', 'seraph_wand', 'aeon_bit'],
        bossDrops: ['gear_twin', 'mech_halberd']
    });
    add({
        id: 'cyber_corridor', world: 4, power: W4_POWER, name: '電脳回廊', icon: '💾', ilvl: 34, bg: '#0f2a3a', bg2: '#0a1f2c',
        desc: '光の回路が走る電脳の回廊。守護プログラムが、侵入者を削除しようとする。',
        enemies: [E('ウイルス', '🦠', 'swarm', '#7aff9a'), E('ファイアウォール', '🧱', 'tank', '#4ac8ff'), E('スナイパーAI', '🎯', 'ranged', '#ff6aa0')],
        boss: { name: '電脳の守護者サイバーウォーデン', icon: '🧿', color: '#4adfff', patterns: ['volley', 'slam', 'radial'] },
        drops: ['rail_mk1', 'steam_pistol', 'tesla_whip', 'gear_twin', 'aeon_bit', 'titan_bow'],
        bossDrops: ['tesla_whip', 'rail_mk2']
    });
    add({
        id: 'steel_arena', world: 4, power: W4_POWER, name: '鋼鉄の闘技場', icon: '🏟️', ilvl: 35, bg: '#4a3a3a', bg2: '#392b2b',
        desc: '歓声のない鋼鉄の闘技場。剣闘機が、挑戦者を待ち構える。',
        enemies: [E('剣闘機', '🗡️', 'charger', '#c0a0a0'), E('盾兵機', '🛡️', 'tank', '#a0a8b8'), E('投槍機', '🔱', 'ranged', '#e0c080')],
        boss: { name: '剣闘機グラディエーター・ゼロ', icon: '⚔️', color: '#ff7a5a', patterns: ['charge', 'slam', 'summon'] },
        drops: ['rail_mk2', 'gear_twin', 'mech_halberd', 'clock_blade', 'tesla_whip', 'chaos_axe'],
        bossDrops: ['rail_mk2', 'mech_halberd']
    });
    add({
        id: 'zero_foundry', world: 4, power: W4_POWER, name: '零式工廠', icon: '🏭', ilvl: 36, bg: '#4a2a1a', bg2: '#381e12',
        desc: '止まらない溶鉱炉と組立ライン。母機が、無限に兵を生み出し続ける。',
        enemies: [E('組立ドローン', '🛸', 'swarm', '#ffb060'), E('溶鉱炉兵', '🔥', 'chaser', '#ff7a3a'), E('クレーン腕', '🦾', 'charger', '#b0b8c8')],
        boss: { name: '工廠長オートマ・マザー', icon: '🏭', color: '#ff9a3a', patterns: ['summon', 'radial', 'spiral', 'slam'] },
        drops: ['gear_omega', 'rail_mk2', 'steam_pistol', 'tesla_whip', 'god_edge', 'dragon_breath'],
        bossDrops: ['gear_omega', 'rail_zero']
    });
    add({
        id: 'mech_throne', world: 4, power: { hp: 3.3, dmg: 2.2, spd: 1.16 }, name: '機神の玉座', icon: '🤴', ilvl: 38, bg: '#1a2a4a', bg2: '#111c36',
        desc: '機神の都の最奥。すべての機械を統べる機神王が、歯車の玉座に座している。',
        enemies: [E('機神の近衛', '🦾', 'chaser', '#80b0ff'), E('王の砲台', '💠', 'ranged', '#a0e0ff'), E('重装機兵', '🗿', 'tank', '#8a98c0')],
        boss: { name: '機神王ゴッドマキナ', icon: '🤴', color: '#6aa8ff', patterns: ['radial', 'volley', 'slam', 'summon'] },
        drops: ['rail_zero', 'gear_omega', 'rail_mk2', 'tesla_whip', 'creation_scepter', 'genesis_gunblade', 'divine_rapier'],
        bossDrops: ['rail_zero', 'gear_omega', 'mech_blade_god']
    });

    // ============================================================
    // 第五世界「虚空の彼方」（ゲートキーパー・無限 を倒すと解放）
    //  星々が死に絶えた宇宙の果て。最強の敵と虚空の王が待つ。新しい武器種：衛星砲・特異点
    // ============================================================
    const W5_POWER = { hp: 3.1, dmg: 2.1, spd: 1.16 };
    add({
        id: 'gate_world5', world: 4, gateTo: 5, bossOnly: true, power: { hp: 3.3, dmg: 2.2, spd: 1.0 },
        name: '虚空の門', icon: '🕳️', ilvl: 39, bg: '#0a0618', bg2: '#05030f',
        desc: '機神の玉座の背後に口を開けた、虚空の門。門を守るゲートキーパーを倒さなければ、世界の果てへは進めない。',
        enemies: [E('門の影', '👤', 'chaser', '#9a7aff')],
        boss: { name: 'ゲートキーパー・無限', icon: '🕳️', color: '#e0d0ff', patterns: ['radial'], stand: true, gate: true },
        drops: ['rail_zero', 'gear_omega', 'creation_scepter', 'genesis_gunblade', 'mech_blade_god'],
        bossDrops: ['gate_voidblade', 'rail_zero']
    });
    add({
        id: 'stardust_graveyard', world: 5, power: W5_POWER, name: '星屑の墓場', icon: '💫', ilvl: 40, bg: '#1a1a2e', bg2: '#10101f',
        desc: '死んだ星々が漂う墓場。星喰らいの屍竜が、残った光を貪っている。',
        enemies: [E('星屑の亡霊', '👻', 'ranged', '#c0c8ff'), E('隕石蟲', '☄️', 'charger', '#ff9a6a'), E('墓守の骸', '💀', 'tank', '#c8c0b0')],
        boss: { name: '星喰らいの屍竜スターイーター', icon: '🐉', color: '#8a7aff', patterns: ['charge', 'radial', 'spiral'] },
        drops: ['orb_sat', 'sing_core', 'void_katana', 'god_edge', 'mech_blade_god', 'rail_zero'],
        bossDrops: ['orb_sat', 'void_katana']
    });
    add({
        id: 'galaxy_vortex', world: 5, power: W5_POWER, name: '銀河の渦', icon: '🌀', ilvl: 41, bg: '#241a4a', bg2: '#1a1236',
        desc: '星々が渦を巻いて落ちていく銀河の中心。渦の巫女が、運命を回している。',
        enemies: [E('渦の使い', '🌀', 'chaser', '#b09aff'), E('星の群れ', '⭐', 'swarm', '#ffe08a'), E('重力球', '🔮', 'ranged', '#8a6aff')],
        boss: { name: '渦の巫女ギャラクシア', icon: '🔮', color: '#c09aff', patterns: ['spiral', 'volley', 'summon'] },
        drops: ['orb_sat', 'sing_core', 'nova_greatsword', 'void_katana', 'seraph_wand', 'aeon_bit'],
        bossDrops: ['sing_core', 'orb_array']
    });
    add({
        id: 'event_horizon', world: 5, power: W5_POWER, name: '事象の地平', icon: '⚫', ilvl: 42, bg: '#0a0a14', bg2: '#05050c',
        desc: '光さえ逃げられない境界。地平の番人が、一度入った者を二度と返さない。',
        enemies: [E('影の使徒', '🌑', 'chaser', '#6a6a9a'), E('引力の獣', '🐺', 'charger', '#8a8ac0'), E('虚無の眼', '👁️', 'ranged', '#c0a0ff')],
        boss: { name: '地平の番人ホライゾン', icon: '⚫', color: '#a090ff', patterns: ['slam', 'radial', 'charge', 'spiral'] },
        drops: ['orb_array', 'sing_maw', 'nova_greatsword', 'eclipse_dagger', 'void_katana', 'world_edge'],
        bossDrops: ['sing_maw', 'eclipse_dagger']
    });
    add({
        id: 'dying_star', world: 5, power: W5_POWER, name: '終焉の星', icon: '🌟', ilvl: 43, bg: '#4a1a1a', bg2: '#380f0f',
        desc: '最期の輝きを放ちながら膨らむ赤い星。滅星の巨人が、星の欠片を投げつける。',
        enemies: [E('炎の残滓', '🔥', 'swarm', '#ff8a4a'), E('星核兵', '💥', 'bomber', '#ffb04a'), E('溶けた巨兵', '🗿', 'tank', '#d07a5a')],
        boss: { name: '滅星の巨人ノヴァ・タイタン', icon: '🌟', color: '#ff6a3a', patterns: ['slam', 'volley', 'radial'] },
        drops: ['orb_array', 'nova_greatsword', 'eclipse_dagger', 'star_bow', 'dragon_breath', 'chaos_axe'],
        bossDrops: ['nova_greatsword', 'star_bow']
    });
    add({
        id: 'void_sea', world: 5, power: W5_POWER, name: '虚空の海', icon: '🌌', ilvl: 44, bg: '#0a1030', bg2: '#060a22',
        desc: '何もないはずの海に、巨大な影が泳ぐ。虚空鯨が、世界の残骸を呑み込んでいく。',
        enemies: [E('虚空の稚魚', '🐟', 'swarm', '#7aa0ff'), E('深淵の捕食者', '🦈', 'charger', '#4a6ad0'), E('星屑クラゲ', '🪼', 'ranged', '#a0d0ff')],
        boss: { name: '虚空鯨ヴォイドリヴァイアサン', icon: '🐋', color: '#5a7aff', patterns: ['spiral', 'charge', 'radial', 'summon'] },
        drops: ['orb_omega', 'sing_maw', 'star_bow', 'eclipse_dagger', 'void_katana', 'aeon_bit'],
        bossDrops: ['orb_omega', 'sing_omega']
    });
    add({
        id: 'void_throne', world: 5, power: { hp: 3.8, dmg: 2.4, spd: 1.18 }, name: '虚空の玉座', icon: '👑', ilvl: 46, bg: '#14041f', bg2: '#0c0214',
        desc: '世界の果てに据えられた玉座。すべての終わりを見届ける虚空の王が、最後の挑戦者を待っている。',
        enemies: [E('虚空の近衛', '🛡️', 'chaser', '#c090ff'), E('終焉の使い', '☠️', 'charger', '#8a4aff'), E('王の眼', '👁️', 'ranged', '#ff80d0'), E('玉座の巨兵', '🗿', 'tank', '#6a4a9a')],
        boss: { name: '虚空の王アビス・オブ・ゼロ', icon: '👑', color: '#e0a0ff', patterns: ['radial', 'volley', 'slam', 'spiral', 'summon'] },
        drops: ['sing_omega', 'orb_omega', 'star_bow', 'nova_greatsword', 'eclipse_dagger', 'void_katana', 'creation_scepter'],
        bossDrops: ['sing_omega', 'orb_omega', 'void_king_blade']
    });

    // ============================================================
    // スタンダードワールド（スタンダードキャラ専用）
    //  ・シーズンで持ち帰ったステータスを試す、永遠の世界。最初のボスから HP が1億を超える（ノーマル）
    //  ・bossHp : ノーマル・ソロのボスHP / req : 敵の攻撃力の基準にするステータス合計
    //  ・制限時間は25分。ハード×2.2・ナイトメア×4.5。協力プレイ推奨
    // ============================================================
    const WS_POWER = { hp: 1, dmg: 1.0, spd: 1.12 };
    const stdEnemies = [E('永劫の従者', '🗡️', 'chaser', '#e0d0ff'), E('終局の砲手', '🔮', 'ranged', '#a08aff'), E('時の番人', '⌛', 'tank', '#ffe0a0')];
    const stdDrops = ['creation_scepter', 'genesis_gunblade', 'divine_rapier', 'sing_omega', 'orb_omega', 'void_king_blade', 'mech_blade_god', 'star_bow'];
    add({ id: 'std_gate', world: 9, standardOnly: true, bossHp: 1.2e8, reqOverride: 1000000, power: WS_POWER, name: '永劫の入口', icon: '♾️', ilvl: 47, bg: '#1a1424', bg2: '#100a1a',
        desc: 'スタンダードワールドの入口。最初のボスから、HPが1億を超える。',
        enemies: stdEnemies, boss: { name: '永劫の番人ガーディアン・ゼロ', icon: '🗿', color: '#e0d0ff', patterns: ['radial', 'slam', 'summon'] }, drops: stdDrops, bossDrops: stdDrops.slice(0, 3) });
    add({ id: 'std_time', world: 9, standardOnly: true, bossHp: 3.6e8, reqOverride: 1500000, power: WS_POWER, name: '時の終端', icon: '⌛', ilvl: 48, bg: '#2a2410', bg2: '#1c180a',
        desc: '時間が止まり、砕けた砂時計が宙に浮かぶ終端。',
        enemies: stdEnemies, boss: { name: '終端の時計守クロノ・オメガ', icon: '⌛', color: '#ffe080', patterns: ['spiral', 'volley', 'charge'] }, drops: stdDrops, bossDrops: stdDrops.slice(1, 4) });
    add({ id: 'std_cause', world: 9, standardOnly: true, bossHp: 1.1e9, reqOverride: 2500000, power: WS_POWER, name: '因果の断崖', icon: '🧭', ilvl: 49, bg: '#102a2a', bg2: '#0a1c1c',
        desc: '原因と結果が断ち切られた断崖。裁定者が、あらゆる因果を書き換える。',
        enemies: stdEnemies, boss: { name: '因果の裁定者コーザ・ジャッジ', icon: '⚖️', color: '#80ffe0', patterns: ['volley', 'slam', 'radial', 'summon'] }, drops: stdDrops, bossDrops: stdDrops.slice(2, 5) });
    add({ id: 'std_loop', world: 9, standardOnly: true, bossHp: 3.3e9, reqOverride: 4000000, power: WS_POWER, name: '無限回廊', icon: '🔁', ilvl: 50, bg: '#2a1040', bg2: '#1c0a2c',
        desc: '出口のない無限の回廊。回廊主が、挑戦者を何度でも迷わせる。',
        enemies: stdEnemies, boss: { name: '無限の回廊主ループ・マスター', icon: '🔁', color: '#d080ff', patterns: ['charge', 'spiral', 'slam', 'volley'] }, drops: stdDrops, bossDrops: stdDrops.slice(3, 6) });
    add({ id: 'eternal_throne', world: 9, standardOnly: true, bossHp: 1e10, reqOverride: 6000000, power: WS_POWER, name: '永劫の玉座', icon: '♾️', ilvl: 51, bg: '#14101e', bg2: '#0c0814',
        desc: 'スタンダードワールドの最奥。すべての努力を積み上げた者だけが、永劫の裁定者に挑める。',
        enemies: stdEnemies, boss: { name: '永劫の裁定者', icon: '♾️', color: '#f0e0ff', patterns: ['radial', 'spiral', 'slam', 'summon'] }, drops: stdDrops, bossDrops: stdDrops.slice(4, 8) });

    // ============================================================
    // オンラインマッチ（アクション対戦）の闘技場。ステージゲートには出ない（world: 0）
    //  ・2〜4人の乱戦。敵はいない。ダメージはステータスに関係なく「最大HPの割合」で決まる（武器・スキル・特殊効果の勝負）
    //  ・1人で入ると、スパーリングボットとの練習になる
    // ============================================================
    add({ id: 'pvp_arena', world: 0, pvp: true, bossOnly: true, name: 'アリーナ', icon: '⚔️', ilvl: 1, bg: '#2a2a3a', bg2: '#1c1c2a',
        desc: 'オンラインマッチ会場。2〜4人の乱戦、最後まで立っていた人の勝ち。',
        enemies: [E('ボット', '🤖', 'chaser', '#9ab')], boss: { name: 'スパーリングボット', icon: '🤖', color: '#9ab0c0', patterns: ['charge', 'volley', 'slam'] },
        drops: [], bossDrops: [] });

    // 追加の武器種のベースを、近いレベルのステージのドロップに加える（各ベース：tier±3のステージの通常ドロップ、最上位は最も近いボスのドロップにも）
    (function addNewWeaponDrops() {
        const types = ['rod', 'sling', 'claws', 'flail', 'fan', 'boomerang', 'trident', 'chime', 'lance', 'chainsaw', 'flamethrower', 'mortar', 'prism', 'comet', 'voidblade'];
        const tiers = { rod: [3, 7, 11], sling: [3, 7, 11], claws: [4, 8, 12], flail: [17, 20, 23], fan: [17, 20, 23], boomerang: [17, 20, 23], trident: [24, 27, 30], chime: [24, 27, 30], lance: [25, 28, 30],
            chainsaw: [32, 35, 38], flamethrower: [32, 35, 38], mortar: [33, 36, 38], prism: [40, 43, 46], comet: [40, 43, 46], voidblade: [41, 44, 46] };
        types.forEach(ty => tiers[ty].forEach((tr, i) => {
            const id = ty + '_' + (i + 1);
            const pool = S.filter(st => !st.pvp && !st.standardOnly && !st.gateTo && !st.mini && st.drops && Math.abs(st.ilvl - tr) <= 3);
            pool.forEach(st => { if (st.drops.indexOf(id) < 0) st.drops.push(id); });
            if (i === 2 && pool.length) { const bs = pool.reduce((a, b) => (Math.abs(b.ilvl - tr) < Math.abs(a.ilvl - tr) ? b : a)); if (bs.bossDrops && bs.bossDrops.indexOf(id) < 0) bs.bossDrops.push(id); }
        }));
    })();

    // ============================================================
    // モンスター素材のドロップ表（グリフ工房の素材になる。ids は materials.js の MATERIAL_DATA と同じ）
    //   mob   : 雑魚を倒すたびに、各行を独立して抽選（確率は控えめ）
    //   elite : 精鋭を倒したとき
    //   boss  : ボスを倒したとき（確率1は確定。レア素材は低確率）
    //   書式 [素材ID, 確率]
    // ============================================================
    const MATS = {
        meadow:            { mob: [['slime_jelly', .30], ['hornet_stinger', .25], ['goblin_fang', .25], ['herb_leaf', .22]], elite: [['slime_core', .6], ['goblin_hide', .6], ['crow_feather', .5]], boss: [['goblin_fang', 1], ['goblin_hide', 1], ['shaman_totem', .7], ['slime_core', .6], ['crow_feather', .5]] },
        whisper_forest:    { mob: [['wolf_fang', .30], ['wolf_pelt', .25], ['mushroom_cap', .30], ['herb_leaf', .25]], elite: [['poison_fang', .55], ['magic_powder', .5], ['cursed_thread', .45]], boss: [['hag_eye', 1], ['cursed_thread', 1], ['poison_fang', .8], ['magic_powder', .6], ['dark_essence', .35]] },
        sand_ruins:        { mob: [['scorpion_tail', .30], ['jackal_fang', .25], ['spider_silk', .25], ['rock_fragment', .30]], elite: [['lizard_scale', .5], ['iron_ore', .5], ['ancient_scroll', .4]], boss: [['sandworm_hide', 1], ['rock_fragment', 1], ['titan_stone', .5], ['ancient_scroll', .6], ['vulture_feather', .5]] },
        frost_lab:         { mob: [['ice_wolf_fang', .25], ['ice_shard', .25], ['rock_fragment', .25], ['crab_shell', .25]], elite: [['ice_shard', .7], ['magic_powder', .5], ['silver_ore', .4]], boss: [['ice_shard', 1], ['frost_core', .35], ['silver_ore', .8], ['crystal_shard', .5], ['titan_stone', .3]] },
        wasteland:         { mob: [['skeleton_bone', .30], ['jackal_fang', .20], ['orc_horn', .15], ['mercenary_badge', .12], ['iron_ore', .15]], elite: [['orc_armor', .6], ['orc_horn', .6], ['bandit_dagger_shard', .5], ['dark_essence', .3]], boss: [['orc_horn', 1], ['orc_armor', 1], ['mercenary_badge', .8], ['ogre_fist', .5], ['titan_stone', .35]] },
        toxic_swamp:       { mob: [['frog_leg', .30], ['bog_herb', .20], ['snake_scale', .25], ['mushroom_cap', .20]], elite: [['poison_fang', .7], ['bog_herb', .6], ['wraith_shroud', .4], ['serpent_scale', .3]], boss: [['hydra_venom', 1], ['serpent_scale', 1], ['poison_fang', 1], ['basilisk_eye', .4], ['world_serpent_fang', .2]] },
        rocky_mountain:    { mob: [['rock_fragment', .35], ['bat_wing', .30], ['mole_claw', .25], ['centipede_shell', .20]], elite: [['iron_ore', .6], ['gargoyle_wing', .45], ['troll_hide', .45], ['titan_stone', .3]], boss: [['troll_hide', 1], ['rock_fragment', 1], ['titan_stone', .8], ['gold_ore', .6], ['ogre_fist', .6], ['chimera_eye', .3]] },
        thunder_canyon:    { mob: [['crow_feather', .30], ['vulture_feather', .25], ['lizard_scale', .20], ['lightning_gem', .15]], elite: [['lightning_gem', .6], ['tengu_fan', .45], ['storm_feather', .4], ['chimera_eye', .25]], boss: [['storm_feather', 1], ['lightning_gem', 1], ['griffin_claw', .6], ['tengu_fan', .6], ['sun_crystal', .3]] },
        magma_core:        { mob: [['fire_crystal', .22], ['rock_fragment', .25], ['lizard_scale', .20], ['firefly_light', .25]], elite: [['fire_crystal', .65], ['oni_horn_fragment', .45], ['elemental_core', .3]], boss: [['dragon_scale', 1], ['fire_crystal', 1], ['dragon_bone', .7], ['magma_core', .35], ['dragon_heart', .25], ['eternal_flame', .2]] },
        deep_sea:          { mob: [['crab_shell', .30], ['turtle_shell', .28], ['kappa_plate', .15], ['snake_scale', .20]], elite: [['coral_scale', .6], ['kappa_plate', .5], ['elemental_core', .3], ['crystal_shard', .3]], boss: [['coral_scale', 1], ['crystal_shard', .8], ['elemental_core', .5], ['dream_dust', .3], ['abyss_gem', .15]] },
        haunted_graveyard: { mob: [['skeleton_bone', .30], ['ghost_essence', .30], ['bat_wing', .30], ['rat_tail', .20]], elite: [['wraith_shroud', .6], ['cursed_thread', .5], ['dark_essence', .45], ['banshee_wail', .35]], boss: [['dark_essence', 1], ['banshee_wail', .7], ['shadow_pelt', .6], ['moon_stone', .4], ['lich_phylactery', .25], ['reaper_scythe_shard', .12]] },
        sky_castle:        { mob: [['crow_feather', .30], ['firefly_light', .25], ['harpy_feather', .20], ['vulture_feather', .20]], elite: [['harpy_feather', .6], ['unicorn_horn', .3], ['star_fragment', .3], ['storm_feather', .3]], boss: [['star_fragment', .8], ['sun_crystal', .6], ['unicorn_horn', .6], ['phoenix_feather', .5], ['divine_crystal', .3], ['time_sand', .15]] },
        fallen_church:     { mob: [['bat_wing', .25], ['ghost_essence', .25], ['dark_essence', .20], ['cursed_thread', .20]], elite: [['dark_essence', .6], ['gargoyle_wing', .55], ['wraith_shroud', .5], ['nether_crown_shard', .15]], boss: [['dark_essence', 1], ['nether_crown_shard', .4], ['void_stone', .35], ['abyss_gem', .3], ['chaos_orb', .2], ['gravity_orb', .2]] },
        abyssal_rift:      { mob: [['ghost_essence', .30], ['dark_essence', .25], ['shadow_pelt', .20], ['void_essence', .08]], elite: [['void_essence', .35], ['abyss_gem', .25], ['time_sand', .2], ['gravity_orb', .2], ['chaos_orb', .15]], boss: [['void_essence', 1], ['abyss_gem', .7], ['time_sand', .5], ['gravity_orb', .45], ['chaos_orb', .4], ['eternal_flame', .35], ['frost_core', .3], ['dragon_soul', .15], ['primeval_core', .15]] },
        slime_burrow:      { mob: [['slime_jelly', .40], ['herb_leaf', .25], ['slime_core', .10]], elite: [['slime_core', .7], ['slime_jelly', 1]], boss: [['slime_core', 1], ['slime_jelly', 1], ['herb_leaf', 1]] },
        goblin_camp:       { mob: [['goblin_fang', .30], ['goblin_hide', .30], ['rock_fragment', .20], ['mushroom_cap', .15]], elite: [['goblin_hide', .6], ['mercenary_badge', .5], ['shaman_totem', .5]], boss: [['goblin_fang', 1], ['goblin_hide', 1], ['shaman_totem', .8], ['mercenary_badge', .7], ['bandit_dagger_shard', .5]] },
        haunted_library:   { mob: [['ghost_essence', .30], ['bat_wing', .20], ['magic_powder', .20], ['ancient_scroll', .15]], elite: [['magic_powder', .6], ['ancient_scroll', .5], ['hag_eye', .35]], boss: [['ancient_scroll', 1], ['magic_powder', 1], ['dark_essence', .5], ['sphinx_riddle_stone', .3], ['lich_phylactery', .2]] },
        rift_plains:       { mob: [['wolf_fang', .30], ['shadow_pelt', .25], ['void_essence', .12], ['rock_fragment', .25]], elite: [['void_essence', .45], ['wolf_pelt', .5], ['gravity_orb', .25]], boss: [['void_essence', 1], ['wolf_fang', 1], ['shadow_pelt', .8], ['gravity_orb', .5], ['chaos_orb', .35], ['primeval_core', .2]] },
        rift_forest:       { mob: [['herb_leaf', .30], ['mushroom_cap', .28], ['bog_herb', .25], ['void_essence', .12]], elite: [['unicorn_horn', .4], ['bog_herb', .6], ['void_essence', .4], ['dream_dust', .3]], boss: [['void_essence', 1], ['dream_dust', .8], ['unicorn_horn', .6], ['serpent_scale', .6], ['abyss_gem', .4], ['primeval_core', .2]] },
        rift_desert:       { mob: [['rock_fragment', .30], ['crystal_shard', .22], ['vulture_feather', .22], ['void_essence', .12]], elite: [['crystal_shard', .6], ['sphinx_riddle_stone', .4], ['gold_ore', .4], ['void_essence', .4]], boss: [['sphinx_riddle_stone', 1], ['void_essence', 1], ['gold_ore', .8], ['mithril_ore', .6], ['sun_crystal', .45], ['time_sand', .3], ['primeval_core', .2]] },
        rift_clock:        { mob: [['iron_ore', .28], ['ghost_essence', .28], ['magic_powder', .22], ['void_essence', .13]], elite: [['time_sand', .45], ['silver_ore', .5], ['void_essence', .4], ['gravity_orb', .3]], boss: [['time_sand', 1], ['void_essence', 1], ['gravity_orb', .7], ['chaos_orb', .5], ['abyss_gem', .5], ['reaper_scythe_shard', .3], ['primeval_core', .25]] },
        rift_battlefield:  { mob: [['star_fragment', .22], ['rock_fragment', .28], ['fire_crystal', .22], ['void_essence', .13]], elite: [['star_fragment', .55], ['titan_stone', .5], ['elemental_core', .4], ['void_essence', .45]], boss: [['star_fragment', 1], ['titan_stone', 1], ['divine_crystal', .6], ['void_essence', 1], ['eternal_flame', .45], ['chaos_orb', .4], ['primeval_core', .25]] },
        rift_throne:       { mob: [['dark_essence', .28], ['void_essence', .18], ['dragon_scale', .12], ['abyss_gem', .08]], elite: [['void_essence', .55], ['abyss_gem', .4], ['dragon_scale', .4], ['chaos_orb', .3]], boss: [['void_essence', 1], ['dragon_scale', 1], ['dragon_heart', .6], ['abyss_gem', .8], ['chaos_orb', .6], ['dragon_soul', .4], ['primeval_core', .35]] },
        gate_world2:       { mob: [], elite: [], boss: [['void_essence', 1], ['gravity_orb', .8], ['abyss_gem', .6], ['chaos_orb', .5], ['primeval_core', .3]] },
        gate_world3:       { mob: [], elite: [], boss: [['void_essence', 1], ['time_sand', .8], ['abyss_gem', .8], ['chaos_orb', .6], ['dragon_soul', .4], ['primeval_core', .4]] },
        god_garden:        { mob: [['dream_dust', .26], ['unicorn_horn', .14], ['sun_crystal', .12], ['void_essence', .12]], elite: [['unicorn_horn', .5], ['sun_crystal', .45], ['phoenix_feather', .3], ['void_essence', .45]], boss: [['sun_crystal', 1], ['unicorn_horn', 1], ['phoenix_feather', .7], ['divine_crystal', .5], ['chaos_orb', .4], ['primeval_core', .3]] },
        god_forge:         { mob: [['fire_crystal', .26], ['iron_ore', .26], ['elemental_core', .1], ['void_essence', .12]], elite: [['elemental_core', .5], ['eternal_flame', .4], ['mithril_ore', .4], ['void_essence', .45]], boss: [['eternal_flame', 1], ['elemental_core', 1], ['mithril_ore', .8], ['titan_stone', .6], ['chaos_orb', .45], ['primeval_core', .3]] },
        god_ocean:         { mob: [['star_fragment', .24], ['ice_shard', .22], ['crystal_shard', .2], ['void_essence', .12]], elite: [['star_fragment', .55], ['frost_core', .4], ['moon_stone', .35], ['void_essence', .45]], boss: [['star_fragment', 1], ['moon_stone', 1], ['frost_core', .8], ['divine_crystal', .5], ['chaos_orb', .45], ['primeval_core', .3]] },
        god_archive:       { mob: [['magic_powder', .26], ['ghost_essence', .22], ['dream_dust', .2], ['void_essence', .13]], elite: [['dream_dust', .5], ['time_sand', .4], ['ghost_essence', .5], ['void_essence', .45]], boss: [['time_sand', 1], ['dream_dust', 1], ['divine_crystal', .6], ['abyss_gem', .6], ['chaos_orb', .5], ['primeval_core', .35]] },
        god_chaos:         { mob: [['dark_essence', .28], ['void_essence', .2], ['abyss_gem', .1], ['dragon_scale', .1]], elite: [['void_essence', .6], ['abyss_gem', .45], ['chaos_orb', .35], ['dragon_scale', .4]], boss: [['void_essence', 1], ['abyss_gem', 1], ['chaos_orb', .8], ['dragon_heart', .6], ['dragon_soul', .5], ['primeval_core', .4]] },
        god_throne:        { mob: [['sun_crystal', .2], ['void_essence', .2], ['divine_crystal', .08], ['abyss_gem', .1]], elite: [['divine_crystal', .5], ['sun_crystal', .5], ['chaos_orb', .4], ['abyss_gem', .45]], boss: [['divine_crystal', 1], ['void_essence', 1], ['chaos_orb', .8], ['dragon_soul', .6], ['primeval_core', .6], ['eternal_flame', .5]] },
        clockwork_factory: { mob: [['iron_ore', .30], ['rock_fragment', .30], ['magic_powder', .20], ['silver_ore', .15]], elite: [['iron_ore', .7], ['silver_ore', .5], ['gold_ore', .3], ['crystal_shard', .25]], boss: [['gold_ore', .8], ['mithril_ore', .45], ['crystal_shard', .6], ['elemental_core', .5], ['titan_stone', .4]] }
    };

    // 第四・第五世界・スタンダードワールドの素材表（既存の素材IDを使う）
    const M = (mob, elite, boss) => ({ mob: mob, elite: elite, boss: boss });
    const W4M = M([['iron_ore', .30], ['silver_ore', .22], ['magic_powder', .20], ['void_essence', .2]], [['mithril_ore', .5], ['elemental_core', .45], ['void_essence', .5]], [['mithril_ore', 1], ['elemental_core', .8], ['abyss_gem', .5], ['primeval_core', .3]]);
    const W5M = M([['void_essence', .3], ['star_fragment', .25], ['dark_essence', .2], ['abyss_gem', .12]], [['abyss_gem', .5], ['chaos_orb', .4], ['void_essence', .6]], [['abyss_gem', 1], ['chaos_orb', .9], ['dragon_soul', .5], ['primeval_core', .5]]);
    ['steam_bridge', 'gear_cathedral', 'cyber_corridor', 'steel_arena', 'zero_foundry', 'mech_throne'].forEach(id => { MATS[id] = W4M; });
    ['stardust_graveyard', 'galaxy_vortex', 'event_horizon', 'dying_star', 'void_sea', 'void_throne'].forEach(id => { MATS[id] = W5M; });
    MATS.gate_world4 = { mob: [], elite: [], boss: [['void_essence', 1], ['mithril_ore', .9], ['abyss_gem', .8], ['chaos_orb', .6], ['dragon_soul', .5], ['primeval_core', .5]] };
    MATS.gate_world5 = { mob: [], elite: [], boss: [['void_essence', 1], ['abyss_gem', 1], ['chaos_orb', .8], ['dragon_soul', .6], ['primeval_core', .6]] };
    ['std_gate', 'std_time', 'std_cause', 'std_loop', 'eternal_throne'].forEach(id => { MATS[id] = MATS.god_throne; });
    S.forEach(st => { st.mats = MATS[st.id] || { mob: [], elite: [], boss: [] }; });


    // ============================================================
    // 推奨ステータス合計（ステージの強さの基準）
    //  ・敵のHPとダメージは「そのステージを遊ぶ人のステータス合計がこのくらい」という想定で決まる。
    //  ・第一世界の最初のステージは従来のまま（250 = 初期の持ち点）。第一世界の最終ステージで約1500、
    //    いちばん後ろの通常ステージ（最終世界のラスボス）で 100000 になるよう、ステージが進むごとに指数的に上がる。
    //  ・数字を変えたいときは STAT_REQ だけ触ればよい。世界を増やしても、いちばん後ろのステージが自動的に final になる。
    //  ・weapon の攻撃力上昇は「％」なので、ステータス合計の差がそのまま強さの差になる。
    // ============================================================
    const STAT_REQ = { start: 250, w1End: 1500, w1EndIlvl: 15, final: 100000 };
    const ILVL_MAX = Math.max.apply(null, S.filter(x => !x.standardOnly).map(x => x.ilvl));
    function reqTotal(ilvl) {
        if (ilvl <= 1) return STAT_REQ.start;
        if (ilvl <= STAT_REQ.w1EndIlvl) return STAT_REQ.start * Math.pow(STAT_REQ.w1End / STAT_REQ.start, (ilvl - 1) / (STAT_REQ.w1EndIlvl - 1));
        const span = Math.max(1, ILVL_MAX - STAT_REQ.w1EndIlvl);
        return STAT_REQ.w1End * Math.pow(STAT_REQ.final / STAT_REQ.w1End, Math.min(1.5, (ilvl - STAT_REQ.w1EndIlvl) / span));
    }
    // 戦闘ステータスの換算式（stage.js の P.atkMul / P.maxHp と同じ形。合計を5ステータスに均等に振った人を想定）
    const atkMulRef = T => 0.6 + (T / 5) / 150;
    const maxHpRef = T => 100 + (T / 5) * 2;
    S.forEach(st => {
        st.req = Math.round(st.reqOverride || reqTotal(st.ilvl));
        const gStat = atkMulRef(st.req) / atkMulRef(STAT_REQ.start);
        st.gMob = gStat;                                                       // 雑魚のHP倍率（その合計の人の火力に合わせる）
        st.gDmg = st.bossHp ? st.bossHp / (70 * 1.7 * 24) : gStat;             // ボスのHP倍率。bossHp があれば「ボスHP＝その値」になる
        st.gHp = maxHpRef(st.req) / maxHpRef(STAT_REQ.start);                  // 敵の攻撃力の基準HP倍率（プレイヤーのHPの伸びに合わせる）
    });

    // 難易度：敵のHP・攻撃・速さ・精鋭の出現率と、ドロップのレア度補正
    const DIFFS = [
        { name: 'ノーマル',   hp: 1.0, dmg: 1.0, spd: 1.0,  elite: 0.10, luck: 0.0, color: '#3a6ee8', note: '標準。装備を整えながら進める難易度。' },
        { name: 'ハード',     hp: 2.2, dmg: 1.6, spd: 1.08, elite: 0.16, luck: 0.7, color: '#d9812a', note: '敵が硬く強い。高レア武器が出やすい。' },
        { name: 'ナイトメア', hp: 4.5, dmg: 2.4, spd: 1.16, elite: 0.24, luck: 1.6, color: '#b03a3a', note: '被弾が痛い上級者向け。伝説武器を狙える。' }
    ];

    // 世界(ワールド)の定義
    //  unlock.stageId/diff : このステージを diff 以上の難易度でクリアすると「門」が現れる（gateFlag）
    //  unlock.gateId       : 門のステージ。ゲートキーパーを倒すと世界が解放される（flag）
    const WORLDS = [
        { id: 1, name: '第一世界', icon: '🌍', color: '#3a6ee8', note: 'はじまりの世界。' },
        { id: 2, name: '第二世界「次元の裏側」', icon: '🌌', color: '#9a4aff', note: '次元の割れ目の向こう。さらに強い敵とボスが待ち受ける。',
          unlock: { stageId: 'abyssal_rift', diff: 2, gateId: 'gate_world2', gateFlag: 'gateOpen2', flag: 'world2',
                    openText: 'どこかに次元の割れ目ができたようだ...', openSub: '「次元の門」が現れた。門を守るゲートキーパーを倒せば、第二世界へ進める。',
                    clearText: '次元の門が開かれた...', clearSub: 'ステージゲートに「第二世界」が追加されました。' } },
        { id: 3, name: '第三世界「神域」', icon: '⛩️', color: '#ffc84a', note: '神々の住まう領域。最強の敵と創世神が待つ。',
          unlock: { stageId: 'rift_throne', diff: 2, gateId: 'gate_world3', gateFlag: 'gateOpen3', flag: 'world3',
                    openText: '次元の最奥で、巨大な門が軋む音がした...', openSub: '「神域の門」が現れた。終焉の門番を倒せば、第三世界へ進める。',
                    clearText: '神域の門が開かれた...', clearSub: 'ステージゲートに「第三世界」が追加されました。' } },
        { id: 4, name: '第四世界「機神の都」', icon: '⚙️', color: '#6aa8ff', note: '歯車と蒸気と電脳の都。機械の神々が待つ。新武器種：電磁砲・歯車刃',
          unlock: { stageId: 'god_throne', diff: 2, gateId: 'gate_world4', gateFlag: 'gateOpen4', flag: 'world4',
                    openText: '神域の果てで、鋼鉄の門が動き出した...', openSub: '「機神の門」が現れた。ゲートキーパー・機構を倒せば、第四世界へ進める。',
                    clearText: '機神の門が開かれた...', clearSub: 'ステージゲートに「第四世界」が追加されました。' } },
        { id: 5, name: '第五世界「虚空の彼方」', icon: '🕳️', color: '#c090ff', note: '星々が死に絶えた世界の果て。最強の敵と虚空の王が待つ。新武器種：衛星砲・特異点',
          unlock: { stageId: 'mech_throne', diff: 2, gateId: 'gate_world5', gateFlag: 'gateOpen5', flag: 'world5',
                    openText: '機神の玉座の背後で、虚空が口を開けた...', openSub: '「虚空の門」が現れた。ゲートキーパー・無限を倒せば、第五世界へ進める。',
                    clearText: '虚空の門が開かれた...', clearSub: 'ステージゲートに「第五世界」が追加されました。' } },
        // スタンダードワールド（スタンダードキャラ専用。最初から入れる。最初のボスからHPが1億超え）
        { id: 9, name: 'スタンダードワールド', icon: '♾️', color: '#c0a0ff', standardOnly: true, alwaysOpen: true, note: 'シーズンで持ち帰ったステータスを試す、永遠の世界。ボスのHPは1億超えから。制限時間25分・協力プレイ推奨。' }
    ];

    window.STAGE_DATA = { STAGES: S, ARCH: ARCH, PATTERNS: PATTERNS, DIFFS: DIFFS, WORLDS: WORLDS, STAT_REQ: STAT_REQ, ILVL_MAX: ILVL_MAX };
    window.getStageById = function (id) { return S.find(s => s.id === id) || null; };
})();
