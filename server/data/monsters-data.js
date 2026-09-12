// ============================================
// Dungeon Monsters Data
// monsters-data.js
// ============================================

// 難易度定義
const DIFFICULTIES = {
    EASY: 'easy',
    NORMAL: 'normal',
    HARD: 'hard',
    VERY_HARD: 'very_hard',
    NIGHTMARE: 'nightmare'
};

// 難易度の表示名
const DIFFICULTY_NAMES = {
    easy: 'イージー',
    normal: 'ノーマル',
    hard: 'ハード',
    very_hard: 'ベリーハード',
    nightmare: 'ナイトメア'
};

// 難易度ごとのスケーリング係数
// 依頼により全体を大幅に引き上げ：新イージーが旧ナイトメア相当、
// 新ナイトメアは総ステータス99999999（約1億）レベルの超難易度になるよう
// カーブを急にしている（旧: 0.7/1.0/1.3/1.6/2.0の等間隔 → 新: 指数的に加速）。
const DIFFICULTY_SCALING = {
    easy: 22.0,       // 旧ナイトメア(22.0)相当
    normal: 50.0,
    hard: 120.0,
    very_hard: 350.0,
    nightmare: 1000.0 // 総ステータス99999999レベル。神話級の強さ
};

// 報酬定義
const DUNGEON_REWARDS = {
    easy: {
        orb: 'tier2',  // Tier2以上のオーブ
        description: 'Tier2以上のオーブ'
    },
    normal: {
        orb: 'tier3',  // Tier3以上のオーブ
        description: 'Tier3以上のオーブ'
    },
    hard: {
        orb: 'tier4',  // Tier4以上のオーブ
        description: 'Tier4以上のオーブ'
    },
    very_hard: {
        item: 'stat_reallocator',
        description: 'ステータス再分配アイテム',
        rarity: 'legendary'
    },
    nightmare: {
        item: 'extra_orb_slot',
        description: '武器オーブスロット追加チケット',
        rarity: 'mythic'
    }
};

// ===================================
// 階層ごとの報酬（コイン・経験値）
// ===================================
// 依頼により、ダンジョンの報酬を階層ごとに分けて定義する。
// 各階を突破するたびに難易度×階層に応じたコイン・経験値が「そのダンジョン内の
// 保有報酬」として積み上がっていき、以前は階層に関係なく一律だった
// （getBaseRewardCoins/Exp は10階クリア時にしか使われていなかった）反省を踏まえ、
// 1〜10階すべてでこの関数を使う。プレイヤーの実際の所持コイン等への反映は、
// ダンジョンをクリアするか撤退した時点でまとめて行う（負けた場合は反映されず全て失う）。
const FLOOR_REWARD_BASE = {
    easy: { coins: 60, exp: 30 },
    normal: { coins: 120, exp: 60 },
    hard: { coins: 250, exp: 120 },
    very_hard: { coins: 500, exp: 240 },
    nightmare: { coins: 1000, exp: 480 }
};

function getFloorRewardCoins(floor, difficulty) {
    const base = FLOOR_REWARD_BASE[difficulty] || FLOOR_REWARD_BASE.easy;
    return Math.round(base.coins * floor);
}

function getFloorRewardExp(floor, difficulty) {
    const base = FLOOR_REWARD_BASE[difficulty] || FLOOR_REWARD_BASE.easy;
    return Math.round(base.exp * floor);
}

// ===================================
// 通常報酬（2回目以降のクリア）
// ===================================
// 初回クリアはDUNGEON_REWARDS（オーブ/アイテム）を含む一式がもらえるが、
// 2回目以降はここで定義するコインのみがダンジョンの難易度に応じてもらえる。
const REPEAT_CLEAR_COIN_REWARDS = {
    easy: 500,
    normal: 1000,
    hard: 2200,
    very_hard: 4500,
    nightmare: 10000
};

// ===================================
// 1層 モンスター
// ===================================
const FLOOR_1_MONSTERS = {
    easy: [
        { id: 'slime_1', name: 'スライム', level: 1, hp: 20, atk: 5, def: 2, speed: 8 },
        { id: 'goblin_1', name: 'ゴブリン', level: 1, hp: 25, atk: 7, def: 3, speed: 10 }
    ],
    normal: [
        { id: 'slime_1', name: 'スライム', level: 2, hp: 30, atk: 8, def: 3, speed: 10 },
        { id: 'goblin_1', name: 'ゴブリン', level: 2, hp: 35, atk: 10, def: 4, speed: 12 },
        { id: 'rat_1', name: 'ネズミ', level: 2, hp: 28, atk: 9, def: 2, speed: 15 }
    ],
    hard: [
        { id: 'goblin_1', name: 'ゴブリン', level: 3, hp: 45, atk: 13, def: 5, speed: 14 },
        { id: 'rat_1', name: 'ネズミ', level: 3, hp: 40, atk: 12, def: 3, speed: 18 },
        { id: 'spider_1', name: 'クモ', level: 3, hp: 38, atk: 14, def: 4, speed: 16 }
    ],
    very_hard: [
        { id: 'rat_1', name: 'ネズミ', level: 4, hp: 55, atk: 16, def: 4, speed: 22 },
        { id: 'spider_1', name: 'クモ', level: 4, hp: 52, atk: 18, def: 5, speed: 20 },
        { id: 'goblin_1', name: 'ゴブリン', level: 4, hp: 60, atk: 17, def: 6, speed: 16 }
    ],
    nightmare: [
        { id: 'spider_1', name: 'クモ', level: 50, hp: 8000, atk: 2400, def: 600, speed: 2500 },
        { id: 'rat_1', name: 'ネズミ', level: 50, hp: 8500, atk: 2200, def: 500, speed: 2800 },
        { id: 'goblin_1', name: 'ゴブリン', level: 50, hp: 9000, atk: 2300, def: 800, speed: 2000 }
    ]
};

// ===================================
// 2層 モンスター
// ===================================
const FLOOR_2_MONSTERS = {
    easy: [
        { id: 'orc_1', name: 'オーク', level: 2, hp: 35, atk: 10, def: 4, speed: 9 },
        { id: 'wolf_1', name: 'ウルフ', level: 2, hp: 32, atk: 11, def: 3, speed: 13 }
    ],
    normal: [
        { id: 'orc_1', name: 'オーク', level: 3, hp: 50, atk: 13, def: 5, speed: 11 },
        { id: 'wolf_1', name: 'ウルフ', level: 3, hp: 45, atk: 14, def: 4, speed: 15 },
        { id: 'skeleton_1', name: 'スケルトン', level: 3, hp: 40, atk: 12, def: 6, speed: 12 }
    ],
    hard: [
        { id: 'orc_1', name: 'オーク', level: 4, hp: 65, atk: 17, def: 6, speed: 13 },
        { id: 'wolf_1', name: 'ウルフ', level: 4, hp: 60, atk: 18, def: 5, speed: 18 },
        { id: 'skeleton_1', name: 'スケルトン', level: 4, hp: 55, atk: 16, def: 8, speed: 14 }
    ],
    very_hard: [
        { id: 'wolf_1', name: 'ウルフ', level: 5, hp: 80, atk: 24, def: 6, speed: 23 },
        { id: 'skeleton_1', name: 'スケルトン', level: 5, hp: 75, atk: 21, def: 10, speed: 17 },
        { id: 'orc_1', name: 'オーク', level: 5, hp: 85, atk: 22, def: 8, speed: 15 }
    ],
    nightmare: [
        { id: 'wolf_1', name: 'ウルフ', level: 60, hp: 12000, atk: 3600, def: 900, speed: 3500 },
        { id: 'skeleton_1', name: 'スケルトン', level: 60, hp: 11500, atk: 3200, def: 1500, speed: 2500 },
        { id: 'orc_1', name: 'オーク', level: 60, hp: 12500, atk: 3300, def: 1200, speed: 2200 }
    ]
};

// ===================================
// 3層 モンスター
// ===================================
const FLOOR_3_MONSTERS = {
    easy: [
        { id: 'goblin_shaman_1', name: 'ゴブリン・シャーマン', level: 3, hp: 38, atk: 12, def: 3, speed: 11 },
        { id: 'bat_1', name: 'バット', level: 3, hp: 30, atk: 10, def: 2, speed: 16 }
    ],
    normal: [
        { id: 'goblin_shaman_1', name: 'ゴブリン・シャーマン', level: 4, hp: 52, atk: 15, def: 4, speed: 13 },
        { id: 'bat_1', name: 'バット', level: 4, hp: 42, atk: 13, def: 3, speed: 19 },
        { id: 'ghoul_1', name: 'グール', level: 4, hp: 48, atk: 14, def: 5, speed: 11 }
    ],
    hard: [
        { id: 'goblin_shaman_1', name: 'ゴブリン・シャーマン', level: 5, hp: 68, atk: 20, def: 5, speed: 15 },
        { id: 'bat_1', name: 'バット', level: 5, hp: 55, atk: 17, def: 4, speed: 23 },
        { id: 'ghoul_1', name: 'グール', level: 5, hp: 65, atk: 19, def: 7, speed: 13 }
    ],
    very_hard: [
        { id: 'bat_1', name: 'バット', level: 6, hp: 75, atk: 23, def: 5, speed: 30 },
        { id: 'ghoul_1', name: 'グール', level: 6, hp: 88, atk: 25, def: 9, speed: 17 },
        { id: 'goblin_shaman_1', name: 'ゴブリン・シャーマン', level: 6, hp: 90, atk: 26, def: 7, speed: 19 }
    ],
    nightmare: [
        { id: 'bat_1', name: 'バット', level: 70, hp: 15000, atk: 4500, def: 900, speed: 5500 },
        { id: 'ghoul_1', name: 'グール', level: 70, hp: 17000, atk: 4800, def: 1800, speed: 3200 },
        { id: 'goblin_shaman_1', name: 'ゴブリン・シャーマン', level: 70, hp: 18000, atk: 5000, def: 1300, speed: 3600 }
    ]
};

// ===================================
// 4層 モンスター
// ===================================
const FLOOR_4_MONSTERS = {
    easy: [
        { id: 'stone_golem_1', name: 'ストーン・ゴーレム', level: 4, hp: 50, atk: 10, def: 10, speed: 5 },
        { id: 'lizard_1', name: 'リザード', level: 4, hp: 42, atk: 14, def: 6, speed: 12 }
    ],
    normal: [
        { id: 'stone_golem_1', name: 'ストーン・ゴーレム', level: 5, hp: 68, atk: 13, def: 13, speed: 6 },
        { id: 'lizard_1', name: 'リザード', level: 5, hp: 58, atk: 18, def: 8, speed: 14 },
        { id: 'harpy_1', name: 'ハーピー', level: 5, hp: 55, atk: 16, def: 5, speed: 17 }
    ],
    hard: [
        { id: 'stone_golem_1', name: 'ストーン・ゴーレム', level: 6, hp: 90, atk: 17, def: 17, speed: 8 },
        { id: 'lizard_1', name: 'リザード', level: 6, hp: 78, atk: 24, def: 10, speed: 17 },
        { id: 'harpy_1', name: 'ハーピー', level: 6, hp: 75, atk: 22, def: 6, speed: 21 }
    ],
    very_hard: [
        { id: 'stone_golem_1', name: 'ストーン・ゴーレム', level: 7, hp: 120, atk: 23, def: 22, speed: 10 },
        { id: 'lizard_1', name: 'リザード', level: 7, hp: 105, atk: 32, def: 13, speed: 21 },
        { id: 'harpy_1', name: 'ハーピー', level: 7, hp: 100, atk: 29, def: 8, speed: 27 }
    ],
    nightmare: [
        { id: 'stone_golem_1', name: 'ストーン・ゴーレム', level: 80, hp: 20000, atk: 6000, def: 5500, speed: 2500 },
        { id: 'lizard_1', name: 'リザード', level: 80, hp: 18000, atk: 8500, def: 3500, speed: 5500 },
        { id: 'harpy_1', name: 'ハーピー', level: 80, hp: 17500, atk: 7800, def: 2000, speed: 7000 }
    ]
};

// ===================================
// 5層 モンスター
// ===================================
const FLOOR_5_MONSTERS = {
    easy: [
        { id: 'wyvern_1', name: 'ワイバーン', level: 5, hp: 55, atk: 16, def: 7, speed: 14 },
        { id: 'dark_knight_1', name: 'ダークナイト', level: 5, hp: 60, atk: 18, def: 8, speed: 11 }
    ],
    normal: [
        { id: 'wyvern_1', name: 'ワイバーン', level: 6, hp: 75, atk: 21, def: 9, speed: 17 },
        { id: 'dark_knight_1', name: 'ダークナイト', level: 6, hp: 82, atk: 24, def: 10, speed: 13 },
        { id: 'necromancer_1', name: 'ネクロマンサー', level: 6, hp: 70, atk: 22, def: 7, speed: 14 }
    ],
    hard: [
        { id: 'wyvern_1', name: 'ワイバーン', level: 7, hp: 100, atk: 28, def: 12, speed: 21 },
        { id: 'dark_knight_1', name: 'ダークナイト', level: 7, hp: 110, atk: 32, def: 13, speed: 16 },
        { id: 'necromancer_1', name: 'ネクロマンサー', level: 7, hp: 95, atk: 30, def: 9, speed: 18 }
    ],
    very_hard: [
        { id: 'wyvern_1', name: 'ワイバーン', level: 8, hp: 135, atk: 37, def: 15, speed: 27 },
        { id: 'dark_knight_1', name: 'ダークナイト', level: 8, hp: 148, atk: 43, def: 17, speed: 20 },
        { id: 'necromancer_1', name: 'ネクロマンサー', level: 8, hp: 130, atk: 40, def: 12, speed: 23 }
    ],
    nightmare: [
        { id: 'wyvern_1', name: 'ワイバーン', level: 90, hp: 25000, atk: 7500, def: 3000, speed: 5500 },
        { id: 'dark_knight_1', name: 'ダークナイト', level: 90, hp: 28000, atk: 9000, def: 3500, speed: 4000 },
        { id: 'necromancer_1', name: 'ネクロマンサー', level: 90, hp: 26000, atk: 8000, def: 2500, speed: 4800 }
    ]
};

// ===================================
// 6層 モンスター
// ===================================
const FLOOR_6_MONSTERS = {
    easy: [
        { id: 'phoenix_1', name: 'フェニックス', level: 6, hp: 65, atk: 19, def: 8, speed: 15 },
        { id: 'shadow_mage_1', name: 'シャドー・メイジ', level: 6, hp: 58, atk: 21, def: 6, speed: 16 }
    ],
    normal: [
        { id: 'phoenix_1', name: 'フェニックス', level: 7, hp: 88, atk: 25, def: 10, speed: 18 },
        { id: 'shadow_mage_1', name: 'シャドー・メイジ', level: 7, hp: 80, atk: 28, def: 8, speed: 19 },
        { id: 'demon_1', name: 'デーモン', level: 7, hp: 85, atk: 27, def: 9, speed: 17 }
    ],
    hard: [
        { id: 'phoenix_1', name: 'フェニックス', level: 8, hp: 118, atk: 33, def: 13, speed: 23 },
        { id: 'shadow_mage_1', name: 'シャドー・メイジ', level: 8, hp: 110, atk: 37, def: 10, speed: 24 },
        { id: 'demon_1', name: 'デーモン', level: 8, hp: 115, atk: 36, def: 12, speed: 21 }
    ],
    very_hard: [
        { id: 'phoenix_1', name: 'フェニックス', level: 9, hp: 160, atk: 44, def: 17, speed: 30 },
        { id: 'shadow_mage_1', name: 'シャドー・メイジ', level: 9, hp: 150, atk: 49, def: 13, speed: 31 },
        { id: 'demon_1', name: 'デーモン', level: 9, hp: 155, atk: 48, def: 15, speed: 27 }
    ],
    nightmare: [
        { id: 'phoenix_1', name: 'フェニックス', level: 100, hp: 30000, atk: 9000, def: 3500, speed: 6500 },
        { id: 'shadow_mage_1', name: 'シャドー・メイジ', level: 100, hp: 28000, atk: 10000, def: 2800, speed: 6800 },
        { id: 'demon_1', name: 'デーモン', level: 100, hp: 29500, atk: 9500, def: 3200, speed: 6000 }
    ]
};

// ===================================
// 7層 モンスター
// ===================================
const FLOOR_7_MONSTERS = {
    easy: [
        { id: 'basilisk_1', name: '��ジリスク', level: 7, hp: 75, atk: 21, def: 9, speed: 16 },
        { id: 'chimera_1', name: 'キメラ', level: 7, hp: 72, atk: 23, def: 8, speed: 14 }
    ],
    normal: [
        { id: 'basilisk_1', name: 'バジリスク', level: 8, hp: 102, atk: 28, def: 11, speed: 19 },
        { id: 'chimera_1', name: 'キメラ', level: 8, hp: 98, atk: 31, def: 10, speed: 17 },
        { id: 'hydra_1', name: 'ヒドラ', level: 8, hp: 105, atk: 29, def: 12, speed: 15 }
    ],
    hard: [
        { id: 'basilisk_1', name: 'バジリスク', level: 9, hp: 138, atk: 37, def: 14, speed: 24 },
        { id: 'chimera_1', name: 'キメラ', level: 9, hp: 133, atk: 41, def: 13, speed: 21 },
        { id: 'hydra_1', name: 'ヒドラ', level: 9, hp: 142, atk: 38, def: 16, speed: 18 }
    ],
    very_hard: [
        { id: 'basilisk_1', name: 'バジリスク', level: 10, hp: 188, atk: 49, def: 18, speed: 31 },
        { id: 'chimera_1', name: 'キメラ', level: 10, hp: 180, atk: 55, def: 17, speed: 27 },
        { id: 'hydra_1', name: 'ヒドラ', level: 10, hp: 192, atk: 51, def: 21, speed: 23 }
    ],
    nightmare: [
        { id: 'basilisk_1', name: 'バジリスク', level: 110, hp: 35000, atk: 11000, def: 4000, speed: 7000 },
        { id: 'chimera_1', name: 'キメラ', level: 110, hp: 34000, atk: 12000, def: 3800, speed: 6000 },
        { id: 'hydra_1', name: 'ヒドラ', level: 110, hp: 36000, atk: 11500, def: 4500, speed: 5200 }
    ]
};

// ===================================
// 8層 モンスター
// ===================================
const FLOOR_8_MONSTERS = {
    easy: [
        { id: 'titan_1', name: 'タイタン', level: 8, hp: 88, atk: 24, def: 11, speed: 12 },
        { id: 'arch_mage_1', name: 'アーチメイジ', level: 8, hp: 80, atk: 26, def: 8, speed: 18 }
    ],
    normal: [
        { id: 'titan_1', name: 'タイタン', level: 9, hp: 120, atk: 32, def: 14, speed: 14 },
        { id: 'arch_mage_1', name: 'アーチメイジ', level: 9, hp: 110, atk: 35, def: 10, speed: 21 },
        { id: 'seraph_1', name: 'セラフ', level: 9, hp: 115, atk: 34, def: 11, speed: 19 }
    ],
    hard: [
        { id: 'titan_1', name: 'タイタン', level: 10, hp: 162, atk: 42, def: 18, speed: 17 },
        { id: 'arch_mage_1', name: 'アーチメイジ', level: 10, hp: 150, atk: 47, def: 13, speed: 27 },
        { id: 'seraph_1', name: 'セラフ', level: 10, hp: 158, atk: 45, def: 14, speed: 24 }
    ],
    very_hard: [
        { id: 'titan_1', name: 'タイタン', level: 11, hp: 220, atk: 56, def: 23, speed: 21 },
        { id: 'arch_mage_1', name: 'アーチメイジ', level: 11, hp: 205, atk: 63, def: 17, speed: 35 },
        { id: 'seraph_1', name: 'セラフ', level: 11, hp: 215, atk: 60, def: 18, speed: 31 }
    ],
    nightmare: [
        { id: 'titan_1', name: 'タイタン', level: 120, hp: 45000, atk: 13000, def: 5500, speed: 5000 },
        { id: 'arch_mage_1', name: 'アーチメイジ', level: 120, hp: 42000, atk: 15000, def: 4000, speed: 8500 },
        { id: 'seraph_1', name: 'セラフ', level: 120, hp: 43500, atk: 14000, def: 4200, speed: 7500 }
    ]
};

// ===================================
// 9層 モンスター
// ===================================
const FLOOR_9_MONSTERS = {
    easy: [
        { id: 'abyssal_lord_1', name: 'アビサルロード', level: 9, hp: 100, atk: 27, def: 12, speed: 13 },
        { id: 'celestial_1', name: 'セレスティアル', level: 9, hp: 95, atk: 29, def: 10, speed: 20 }
    ],
    normal: [
        { id: 'abyssal_lord_1', name: 'アビサルロード', level: 10, hp: 138, atk: 36, def: 15, speed: 16 },
        { id: 'celestial_1', name: 'セレスティアル', level: 10, hp: 130, atk: 38, def: 12, speed: 24 },
        { id: 'elder_dragon_1', name: '古龍', level: 10, hp: 135, atk: 37, def: 14, speed: 18 }
    ],
    hard: [
        { id: 'abyssal_lord_1', name: 'アビサルロード', level: 11, hp: 188, atk: 48, def: 19, speed: 20 },
        { id: 'celestial_1', name: 'セレスティアル', level: 11, hp: 180, atk: 50, def: 15, speed: 31 },
        { id: 'elder_dragon_1', name: '古龍', level: 11, hp: 185, atk: 49, def: 18, speed: 23 }
    ],
    very_hard: [
        { id: 'abyssal_lord_1', name: 'アビサルロード', level: 12, hp: 258, atk: 64, def: 25, speed: 26 },
        { id: 'celestial_1', name: 'セレスティアル', level: 12, hp: 248, atk: 67, def: 20, speed: 40 },
        { id: 'elder_dragon_1', name: '古龍', level: 12, hp: 253, atk: 65, def: 23, speed: 30 }
    ],
    nightmare: [
        { id: 'abyssal_lord_1', name: 'アビサルロード', level: 100, hp: 50000, atk: 12000, def: 4500, speed: 5000 },
        { id: 'celestial_1', name: 'セレスティアル', level: 100, hp: 48000, atk: 13000, def: 4000, speed: 7500 },
        { id: 'elder_dragon_1', name: '古龍', level: 100, hp: 49000, atk: 12500, def: 4200, speed: 6000 }
    ]
};

// ===================================
// ボスデータ
// ===================================
// 依頼により全体を大幅強化：イージーが旧ナイトメア相当、ナイトメアは
// メインシナリオのボス「深淵ヲ廻ルモノ」（確定ヒット・防御無視の大技、
// ほぼ全ダメージ無効化の盾、味方全体バフを持つ理不尽級の強さ）に
// 匹敵する難易度になるよう、ステータスとスキル構成を1〜2段階ずつ底上げしている。
//
// 【最終ボスが弱すぎる不具合の修正】
// getFloorMonsters()（1〜9階）はDIFFICULTY_SCALING（easy=22倍〜nightmare=1000倍）を
// 通常モンスターの素のステータスに掛けて最終的な戦闘力を決めているが、10階のボスは
// この倍率が一切掛からず、ここに書かれた数値がそのまま使われていた。
// DIFFICULTY_SCALINGが「旧: 等間隔 → 新: 指数的」に変更された際にボス側の数値だけ
// 取り残され、結果としてeasy〜very_hardでは9階の通常モンスター（スケーリング後）の
// 攻撃力・防御力・素早さがボスを軽く上回ってしまい、「最後のボスの方が道中の敵より弱い」
// 状態になっていた（nightmareだけは元々の数値が十分大きかったため問題なかった）。
// 該当する難易度のステータスを、9階モンスターのスケーリング後の最大値のおよそ1.8〜2.5倍
// になるよう底上げして修正。
const DUNGEON_BOSSES = {
    // イージー難易度ボス（旧ナイトメア「至高の存在」相当のステータス・技構成）
    easy: {
        id: 'boss_supreme_entity',
        name: '至高の存在',
        difficulty: 'easy',
        level: 70,
        hp: 5500,
        atk: 1600,
        def: 700,
        speed: 1100,
        skills: [
            {
                // ジ・インファーナル相当：確定ヒット・防御無視の超高倍率一撃
                name: 'エクシステンシャルシュレッド',
                effect: { damageMultiplier: 5.5, ignoreDef: true, sureHit: true, multiHit: 2 }
            },
            {
                name: '絶望のヴェール',
                effect: {
                    debuff: { type: 'atk_def_speed', reduction: 0.5, turns: 3 },
                    damageMultiplier: 2.0
                }
            },
            {
                // アビスプロテクト相当：ダメージをほぼ完全にカットする
                name: '完全防壁',
                effect: { damageReduction: 0.9, turns: 2 }
            },
            {
                name: 'アビサル・ヒーリング',
                effect: { heal: 0.45, selfBuff: { type: 'def', amount: 1.4, turns: 2 } }
            },
            {
                name: 'コスミック・スラッシュ',
                effect: { damageMultiplier: 2.8, poison: { turns: 5 }, burn: { turns: 5 } }
            },
            {
                // アフェスト・ベルゼバブ相当：自身の全ステータスを大幅強化
                name: '超越的な力',
                effect: {
                    selfBuff: { type: 'all_stats', amount: 1.6, turns: 3 },
                    damageMultiplier: 2.2
                }
            }
        ]
    },

    // ノーマル難易度ボス
    normal: {
        id: 'boss_dark_lord',
        name: 'ダークロード',
        difficulty: 'normal',
        level: 50,
        hp: 15000,
        atk: 4200,
        def: 1700,
        speed: 2600,
        skills: [
            {
                name: 'ダークネスブラスト',
                effect: { damageMultiplier: 2.0, ignoreDef: true }
            },
            {
                name: '絶望の波動',
                effect: { debuff: { type: 'atk_def', reduction: 0.3, turns: 3 } }
            },
            {
                name: 'ライフスティール',
                effect: { lifeSteal: 0.35 }
            },
            {
                name: '完全防壁',
                effect: { damageReduction: 0.5, turns: 1 }
            }
        ]
    },

    // ハード難易度ボス
    hard: {
        id: 'boss_infernal_dragon',
        name: 'インフェルノドラゴン',
        difficulty: 'hard',
        level: 65,
        hp: 45000,
        atk: 12000,
        def: 4600,
        speed: 7500,
        skills: [
            {
                name: 'インフェルノブレス',
                effect: { damageMultiplier: 2.4, burn: { turns: 4 } }
            },
            {
                name: '龍の咆哮',
                effect: { damageMultiplier: 1.8, debuff: { type: 'speed', reduction: 0.35, turns: 2 } }
            },
            {
                name: 'フレイムシールド',
                effect: { damageReduction: 0.5, turns: 2 }
            },
            {
                name: 'レジリエンス',
                effect: { heal: 0.3 }
            },
            {
                name: '絶対のカタストロフ',
                effect: { damageMultiplier: 2.2, ignoreDef: true, sureHit: true }
            }
        ]
    },

    // ベリーハード難易度ボス
    very_hard: {
        id: 'boss_ancient_god',
        name: '古の神',
        difficulty: 'very_hard',
        level: 80,
        hp: 160000,
        atk: 42000,
        def: 16000,
        speed: 25000,
        skills: [
            {
                name: '絶対のカタストロフ',
                effect: { damageMultiplier: 3.0, ignoreDef: true, sureHit: true }
            },
            {
                name: '神聖なる制裁',
                effect: { damageMultiplier: 2.2, debuff: { type: 'def', reduction: 60, isFlat: true, turns: 2 } }
            },
            {
                name: '全能の盾',
                effect: { damageReduction: 0.7, turns: 1 }
            },
            {
                name: 'リジェネレーション',
                effect: { heal: 0.35, selfBuff: { type: 'def', amount: 1.3, turns: 2 } }
            },
            {
                name: '神聖試練',
                effect: {
                    debuff: { type: 'atk', reduction: 0.4, turns: 2 },
                    damageMultiplier: 1.6
                }
            },
            {
                name: 'コスミック・スラッシュ',
                effect: { damageMultiplier: 2.6, poison: { turns: 4 }, burn: { turns: 4 } }
            }
        ]
    },

    // ナイトメア難易度ボス
    // 総ステータス99999999（約1億）レベルの超難易度。
    // 神話級の強さ。ギリギリクリアできるレベルを想定。
    nightmare: {
        id: 'boss_supreme_entity',
        name: '至高の存在',
        difficulty: 'nightmare',
        level: 999,
        hp: 50000000,
        atk: 20000000,
        def: 15000000,
        speed: 14999999,
        skills: [
            {
                // 超絶ダメージ：確定ヒット・防御無視の超高倍率一撃
                name: 'エクシステンシャルシュレッド',
                effect: { damageMultiplier: 100.0, ignoreDef: true, sureHit: true, multiHit: 10 }
            },
            {
                name: '絶望のヴェール',
                effect: {
                    debuff: { type: 'atk_def_speed', reduction: 0.9, turns: 5 },
                    damageMultiplier: 50.0
                }
            },
            {
                // 完全無敵：ダメージを完全にカットする
                name: '完全防壁',
                effect: { damageReduction: 0.99, turns: 3 }
            },
            {
                name: 'アビサル・ヒーリング',
                effect: { heal: 0.9, selfBuff: { type: 'def', amount: 2.0, turns: 3 } }
            },
            {
                name: 'コスミック・スラッシュ',
                effect: { damageMultiplier: 75.0, poison: { turns: 10 }, burn: { turns: 10 } }
            },
            {
                // 神的な力：自身の全ステータスを超強化
                name: '超越的な力',
                effect: {
                    selfBuff: { type: 'all_stats', amount: 5.0, turns: 5 },
                    damageMultiplier: 100.0
                }
            }
        ]
    }
};

// ===================================
// ランダムエンカウント関数
// ===================================
function getRandomMonster(floor, difficulty) {
    const floorKey = 'FLOOR_' + floor + '_MONSTERS';
    const floorsData = {
        1: FLOOR_1_MONSTERS,
        2: FLOOR_2_MONSTERS,
        3: FLOOR_3_MONSTERS,
        4: FLOOR_4_MONSTERS,
        5: FLOOR_5_MONSTERS,
        6: FLOOR_6_MONSTERS,
        7: FLOOR_7_MONSTERS,
        8: FLOOR_8_MONSTERS,
        9: FLOOR_9_MONSTERS
    };

    const monsters = floorsData[floor]?.[difficulty] || [];
    if (monsters.length === 0) return null;
    
    return monsters[Math.floor(Math.random() * monsters.length)];
}

// ===================================
// ボス取得関数
// ===================================
function getBossByDifficulty(difficulty) {
    return DUNGEON_BOSSES[difficulty] || null;
}

// ===================================
// 無限階層ダンジョン用：階層数だけに基づく報酬・宝箱
// （難易度・初回クリア報酬を廃止し、階層が深くなるほど報酬も増えていく方式に変更）
// ===================================

/**
 * 階層番号だけを基準にしたコイン報酬。指数的に増加していく。
 */
function getFloorRewardCoinsByFloor(floor) {
    const f = Math.max(1, floor);
    return Math.round(1 * f * Math.pow(1.05, f));
}

/**
 * 階層番号だけを基準にした経験値報酬。指数的に増加していく。
 */
function getFloorRewardExpByFloor(floor) {
    const f = Math.max(1, floor);
    return Math.round(20 * f * Math.pow(1.05, f));
}

// 階層をクリアするたびに、一定確率で「宝箱」としてオーブ・ステータス再分配チケット・
// 武器オーブスロット追加チケットのいずれかが手に入る（依頼：「敵を倒していくとオーブや
// ステータスの再分配チケット、武器にオーブスロットを新しく追加するやつが出てくるような
// 宝箱みたいに出てくる感じ」）。
const DUNGEON_CHEST_DROP_CHANCE = 0.35;
const DUNGEON_CHEST_TABLE = [
    { type: 'orb', tier: 'tier1', weight: 30, description: 'オーブ（Tier1）' },
    { type: 'orb', tier: 'tier2', weight: 22, description: 'オーブ（Tier2）' },
    { type: 'orb', tier: 'tier3', weight: 14, description: 'オーブ（Tier3）' },
    { type: 'orb', tier: 'tier4', weight: 6, description: 'オーブ（Tier4）' },
    { type: 'item', itemId: 'stat_reallocator', description: 'ステータス再分配チケット', rarity: 'legendary', weight: 4 },
    { type: 'item', itemId: 'extra_orb_slot', description: '武器オーブスロット追加チケット', rarity: 'mythic', weight: 2 }
];

/**
 * 宝箱報酬を1回分抽選する。何も出ない場合はnullを返す。
 */
function rollDungeonChestReward() {
    if (Math.random() >= DUNGEON_CHEST_DROP_CHANCE) return null;
    const totalWeight = DUNGEON_CHEST_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of DUNGEON_CHEST_TABLE) {
        roll -= entry.weight;
        if (roll <= 0) {
            const { weight, ...reward } = entry;
            return reward;
        }
    }
    return null;
}

// ===================================
// エクスポート
// ===================================
module.exports = {
    DIFFICULTIES,
    DIFFICULTY_NAMES,
    DIFFICULTY_SCALING,
    DUNGEON_REWARDS,
    REPEAT_CLEAR_COIN_REWARDS,
    FLOOR_REWARD_BASE,
    getFloorRewardCoins,
    getFloorRewardExp,
    DUNGEON_BOSSES,
    getRandomMonster,
    getBossByDifficulty,
    getFloorRewardCoinsByFloor,
    getFloorRewardExpByFloor,
    rollDungeonChestReward
};
