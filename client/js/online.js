let onlineHandlersSetup = false;

function getBattleReadyPlayer(player) {
    const battleStats = getBattleStats(player);
    // 武器補正後のmaxHpをHPとして設定（常にフルHPで開始）
    return {
        ...player,
        ...battleStats,
        hp: battleStats.maxHp,
        battleStats
    };
}

const BOT_MONSTERS = [
    // レア度1 - 低級モンスター
    {
        id: 'goblin', name: "ゴブリン", monsterType: "ゴブリン", monsterEmoji: "👺",
        baseStats: { maxHp: 80, atk: 60, def: 40, speed: 50 },
        statMultiplier: 0.8,
        materialDrops: [{ materialId: 'goblin_fang', chance: 0.5 }]
    },
    {
        id: 'goblin_scout', name: "ゴブリンの偵察兵", monsterType: "ゴブリン", monsterEmoji: "🗡️",
        baseStats: { maxHp: 70, atk: 55, def: 35, speed: 70 },
        statMultiplier: 0.75,
        materialDrops: [{ materialId: 'goblin_hide', chance: 0.5 }]
    },
    {
        id: 'slime', name: "スライム", monsterType: "スライム", monsterEmoji: "💧",
        baseStats: { maxHp: 100, atk: 50, def: 60, speed: 30 },
        statMultiplier: 0.5,
        materialDrops: [{ materialId: 'slime_jelly', chance: 0.6 }]
    },
    {
        id: 'wolf', name: "狼", monsterType: "獣", monsterEmoji: "🐺",
        baseStats: { maxHp: 75, atk: 65, def: 35, speed: 65 },
        statMultiplier: 0.79,
        materialDrops: [{ materialId: 'wolf_fang', chance: 0.5 }, { materialId: 'wolf_pelt', chance: 0.4 }]
    },
    {
        id: 'bat', name: "コウモリ", monsterType: "飛行", monsterEmoji: "🦇",
        baseStats: { maxHp: 60, atk: 45, def: 25, speed: 80 },
        statMultiplier: 0.46,
        materialDrops: [{ materialId: 'bat_wing', chance: 0.6 }]
    },
    {
        id: 'rat', name: "ネズミ", monsterType: "獣", monsterEmoji: "🐀",
        baseStats: { maxHp: 50, atk: 40, def: 20, speed: 90 },
        statMultiplier: 0.42,
        materialDrops: [{ materialId: 'rat_tail', chance: 0.5 }]
    },
    {
        id: 'snake', name: "蛇", monsterType: "爬虫類", monsterEmoji: "🐍",
        baseStats: { maxHp: 65, atk: 55, def: 30, speed: 75 },
        statMultiplier: 0.62,
        materialDrops: [{ materialId: 'snake_scale', chance: 0.5 }]
    },
    {
        id: 'spider', name: "蜘蛛", monsterType: "虫", monsterEmoji: "🕷️",
        baseStats: { maxHp: 70, atk: 50, def: 35, speed: 60 },
        statMultiplier: 0.51,
        materialDrops: [{ materialId: 'spider_silk', chance: 0.6 }]
    },
    {
        id: 'boar', name: "猪", monsterType: "獣", monsterEmoji: "🐗",
        baseStats: { maxHp: 90, atk: 70, def: 45, speed: 40 },
        statMultiplier: 0.8,
        materialDrops: [{ materialId: 'boar_tusk', chance: 0.5 }]
    },
    {
        id: 'skeleton', name: "スケルトン", monsterType: "アンデッド", monsterEmoji: "💀",
        baseStats: { maxHp: 85, atk: 60, def: 30, speed: 50 },
        statMultiplier: 0.64,
        materialDrops: [{ materialId: 'skeleton_bone', chance: 0.5 }]
    },
    {
        id: 'ghost', name: "ゴースト", monsterType: "霊", monsterEmoji: "👻",
        baseStats: { maxHp: 75, atk: 55, def: 25, speed: 70 },
        statMultiplier: 0.66,
        materialDrops: [{ materialId: 'ghost_essence', chance: 0.4 }]
    },
    {
        id: 'mushroom', name: "毒キノコ", monsterType: "植物", monsterEmoji: "🍄",
        baseStats: { maxHp: 60, atk: 45, def: 50, speed: 30 },
        statMultiplier: 0.39,
        materialDrops: [{ materialId: 'mushroom_cap', chance: 0.6 }]
    },
    {
        id: 'herb_gatherer', name: "薬草採取者", monsterType: "人型", monsterEmoji: "🧑‍🌾",
        baseStats: { maxHp: 70, atk: 50, def: 40, speed: 55 },
        statMultiplier: 0.53,
        materialDrops: [{ materialId: 'herb_leaf', chance: 0.6 }]
    },
    {
        id: 'rock_golem', name: "ロックゴーレム", monsterType: "無機物", monsterEmoji: "🗿",
        baseStats: { maxHp: 120, atk: 55, def: 80, speed: 20 },
        statMultiplier: 0.91,
        materialDrops: [{ materialId: 'rock_fragment', chance: 0.5 }]
    },

    // レア度2 - 中級モンスター
    {
        id: 'slime_king', name: "スライムキング", monsterType: "スライム", monsterEmoji: "👑",
        baseStats: { maxHp: 130, atk: 55, def: 65, speed: 25 },
        statMultiplier: 0.93,
        materialDrops: [{ materialId: 'slime_core', chance: 0.4 }]
    },
    {
        id: 'orc', name: "オーク", monsterType: "オーク", monsterEmoji: "👹",
        baseStats: { maxHp: 110, atk: 75, def: 55, speed: 40 },
        statMultiplier: 0.95,
        materialDrops: [{ materialId: 'orc_horn', chance: 0.4 }, { materialId: 'orc_armor', chance: 0.3 }]
    },
    {
        id: 'orc_warrior', name: "オーク戦士", monsterType: "オーク", monsterEmoji: "⚔️",
        baseStats: { maxHp: 125, atk: 85, def: 60, speed: 35 },
        statMultiplier: 1.24,
        materialDrops: [{ materialId: 'orc_horn', chance: 0.5 }, { materialId: 'orc_armor', chance: 0.4 }]
    },
    {
        id: 'harpy', name: "ハーピー", monsterType: "飛行", monsterEmoji: "🦅",
        baseStats: { maxHp: 95, atk: 70, def: 40, speed: 85 },
        statMultiplier: 1.06,
        materialDrops: [{ materialId: 'harpy_feather', chance: 0.5 }]
    },
    {
        id: 'minotaur', name: "ミノタウロス", monsterType: "獣人", monsterEmoji: "🐂",
        baseStats: { maxHp: 150, atk: 90, def: 70, speed: 30 },
        statMultiplier: 1.35,
        materialDrops: [{ materialId: 'minotaur_horn', chance: 0.4 }]
    },
    {
        id: 'ogre', name: "オーガ", monsterType: "巨人", monsterEmoji: "🧌",
        baseStats: { maxHp: 140, atk: 95, def: 65, speed: 25 },
        statMultiplier: 1.29,
        materialDrops: [{ materialId: 'ogre_fist', chance: 0.4 }]
    },
    {
        id: 'dark_sorcerer', name: "ダークソーサラー", monsterType: "人型", monsterEmoji: "🧙‍♂️",
        baseStats: { maxHp: 100, atk: 80, def: 45, speed: 60 },
        statMultiplier: 1.02,
        materialDrops: [{ materialId: 'dark_essence', chance: 0.4 }]
    },
    {
        id: 'fire_elemental', name: "ファイアエレメンタル", monsterType: "元素", monsterEmoji: "🔥",
        baseStats: { maxHp: 110, atk: 85, def: 40, speed: 55 },
        statMultiplier: 1.08,
        materialDrops: [{ materialId: 'fire_crystal', chance: 0.4 }]
    },
    {
        id: 'ice_elemental', name: "アイスエレメンタル", monsterType: "元素", monsterEmoji: "❄️",
        baseStats: { maxHp: 115, atk: 75, def: 55, speed: 45 },
        statMultiplier: 1.09,
        materialDrops: [{ materialId: 'ice_shard', chance: 0.4 }]
    },
    {
        id: 'lightning_elemental', name: "ライトニングエレメンタル", monsterType: "元素", monsterEmoji: "⚡",
        baseStats: { maxHp: 105, atk: 90, def: 35, speed: 70 },
        statMultiplier: 1.18,
        materialDrops: [{ materialId: 'lightning_gem', chance: 0.4 }]
    },
    {
        id: 'poison_spider', name: "毒蜘蛛", monsterType: "虫", monsterEmoji: "🕷️",
        baseStats: { maxHp: 90, atk: 70, def: 40, speed: 65 },
        statMultiplier: 0.84,
        materialDrops: [{ materialId: 'poison_fang', chance: 0.5 }]
    },
    {
        id: 'iron_golem', name: "アイアンゴーレム", monsterType: "無機物", monsterEmoji: "🤖",
        baseStats: { maxHp: 160, atk: 70, def: 90, speed: 15 },
        statMultiplier: 1.33,
        materialDrops: [{ materialId: 'iron_ore', chance: 0.5 }]
    },
    {
        id: 'silver_wolf', name: "銀狼", monsterType: "獣", monsterEmoji: "🐺",
        baseStats: { maxHp: 100, atk: 80, def: 50, speed: 75 },
        statMultiplier: 1.26,
        materialDrops: [{ materialId: 'silver_ore', chance: 0.3 }, { materialId: 'wolf_fang', chance: 0.4 }]
    },
    {
        id: 'mage', name: "魔法使い", monsterType: "人型", monsterEmoji: "🧙",
        baseStats: { maxHp: 95, atk: 85, def: 40, speed: 65 },
        statMultiplier: 1.04,
        materialDrops: [{ materialId: 'magic_powder', chance: 0.5 }]
    },
    {
        id: 'ancient_scholar', name: "古代の学者", monsterType: "人型", monsterEmoji: "📚",
        baseStats: { maxHp: 110, atk: 75, def: 50, speed: 55 },
        statMultiplier: 1.11,
        materialDrops: [{ materialId: 'ancient_scroll', chance: 0.3 }]
    },

    // レア度3 - 上級モンスター
    {
        id: 'baby_dragon', name: "ベビードラゴン", monsterType: "ドラゴン", monsterEmoji: "🐲",
        baseStats: { maxHp: 120, atk: 70, def: 50, speed: 40 },
        statMultiplier: 0.97,
        materialDrops: [{ materialId: 'dragon_scale', chance: 0.4 }]
    },
    {
        id: 'wild_wyvern', name: "野生のワイバーン", monsterType: "ドラゴン", monsterEmoji: "🐉",
        baseStats: { maxHp: 150, atk: 85, def: 55, speed: 60 },
        statMultiplier: 1.37,
        materialDrops: [{ materialId: 'dragon_heart', chance: 0.3 }]
    },
    {
        id: 'dragon_knight', name: "ドラゴンナイト", monsterType: "人型", monsterEmoji: "🐉",
        baseStats: { maxHp: 160, atk: 95, def: 70, speed: 50 },
        statMultiplier: 1.4,
        materialDrops: [{ materialId: 'dragon_scale', chance: 0.4 }, { materialId: 'dragon_bone', chance: 0.3 }]
    },
    {
        id: 'phoenix', name: "フェニックス", monsterType: "神獣", monsterEmoji: "🔥",
        baseStats: { maxHp: 140, atk: 90, def: 60, speed: 80 },
        statMultiplier: 1.38,
        materialDrops: [{ materialId: 'phoenix_feather', chance: 0.2 }]
    },
    {
        id: 'unicorn', name: "ユニコーン", monsterType: "神獣", monsterEmoji: "🦄",
        baseStats: { maxHp: 150, atk: 75, def: 80, speed: 70 },
        statMultiplier: 1.42,
        materialDrops: [{ materialId: 'unicorn_horn', chance: 0.2 }]
    },
    {
        id: 'griffin', name: "グリフォン", monsterType: "神獣", monsterEmoji: "🦅",
        baseStats: { maxHp: 145, atk: 100, def: 65, speed: 75 },
        statMultiplier: 1.47,
        materialDrops: [{ materialId: 'griffin_claw', chance: 0.3 }]
    },
    {
        id: 'chimera', name: "キメラ", monsterType: "魔獣", monsterEmoji: "🦁",
        baseStats: { maxHp: 170, atk: 110, def: 75, speed: 45 },
        statMultiplier: 1.58,
        materialDrops: [{ materialId: 'chimera_eye', chance: 0.2 }]
    },
    {
        id: 'hydra', name: "ヒドラ", monsterType: "魔獣", monsterEmoji: "🐍",
        baseStats: { maxHp: 180, atk: 95, def: 80, speed: 40 },
        statMultiplier: 1.53,
        materialDrops: [{ materialId: 'hydra_venom', chance: 0.2 }]
    },
    {
        id: 'titan', name: "タイタン", monsterType: "巨人", monsterEmoji: "🗿",
        baseStats: { maxHp: 200, atk: 105, def: 95, speed: 25 },
        statMultiplier: 1.76,
        materialDrops: [{ materialId: 'titan_stone', chance: 0.2 }]
    },
    {
        id: 'elemental_lord', name: "エレメンタルロード", monsterType: "元素", monsterEmoji: "🌟",
        baseStats: { maxHp: 165, atk: 100, def: 70, speed: 60 },
        statMultiplier: 1.55,
        materialDrops: [{ materialId: 'elemental_core', chance: 0.2 }]
    },
    {
        id: 'gold_golem', name: "ゴールドゴーレム", monsterType: "無機物", monsterEmoji: "🗿",
        baseStats: { maxHp: 175, atk: 90, def: 100, speed: 20 },
        statMultiplier: 1.49,
        materialDrops: [{ materialId: 'gold_ore', chance: 0.3 }]
    },
    {
        id: 'mithril_golem', name: "ミスリルゴーレム", monsterType: "無機物", monsterEmoji: "🤖",
        baseStats: { maxHp: 190, atk: 95, def: 110, speed: 15 },
        statMultiplier: 1.69,
        materialDrops: [{ materialId: 'mithril_ore', chance: 0.2 }]
    },
    {
        id: 'star_guardian', name: "スターガーディアン", monsterType: "天体", monsterEmoji: "⭐",
        baseStats: { maxHp: 155, atk: 90, def: 75, speed: 85 },
        statMultiplier: 1.6,
        materialDrops: [{ materialId: 'star_fragment', chance: 0.2 }]
    },
    {
        id: 'moon_beast', name: "ムーンビースト", monsterType: "獣", monsterEmoji: "🌙",
        baseStats: { maxHp: 160, atk: 85, def: 80, speed: 80 },
        statMultiplier: 1.62,
        materialDrops: [{ materialId: 'moon_stone', chance: 0.2 }]
    },
    {
        id: 'sun_guardian', name: "サンガーディアン", monsterType: "天体", monsterEmoji: "☀️",
        baseStats: { maxHp: 165, atk: 95, def: 75, speed: 75 },
        statMultiplier: 1.71,
        materialDrops: [{ materialId: 'sun_crystal', chance: 0.2 }]
    },

    // レア度4 - 最高級モンスター
    {
        id: 'ancient_dragon', name: "古代ドラゴン", monsterType: "ドラゴン", monsterEmoji: "🐲",
        baseStats: { maxHp: 250, atk: 130, def: 100, speed: 60 },
        statMultiplier: 1.95,
        materialDrops: [{ materialId: 'dragon_heart', chance: 0.2 }, { materialId: 'dragon_soul', chance: 0.1 }]
    },
    {
        id: 'divine_beast', name: "神獣", monsterType: "神獣", monsterEmoji: "✨",
        baseStats: { maxHp: 220, atk: 120, def: 110, speed: 80 },
        statMultiplier: 1.91,
        materialDrops: [{ materialId: 'divine_crystal', chance: 0.15 }]
    },
    {
        id: 'abyss_lord', name: "アビスロード", monsterType: "深淵", monsterEmoji: "🌑",
        baseStats: { maxHp: 240, atk: 140, def: 90, speed: 70 },
        statMultiplier: 1.96,
        materialDrops: [{ materialId: 'abyss_gem', chance: 0.15 }]
    },
    {
        id: 'world_tree_guardian', name: "世界樹の守護者", monsterType: "植物", monsterEmoji: "🌳",
        baseStats: { maxHp: 280, atk: 100, def: 130, speed: 40 },
        statMultiplier: 2.0,
        materialDrops: [{ materialId: 'world_tree_leaf', chance: 0.15 }]
    },
    {
        id: 'time_mage', name: "タイムメイジ", monsterType: "人型", monsterEmoji: "⏰",
        baseStats: { maxHp: 180, atk: 110, def: 80, speed: 120 },
        statMultiplier: 1.86,
        materialDrops: [{ materialId: 'time_sand', chance: 0.15 }]
    },
    {
        id: 'void_walker', name: "ヴォイドウォーカー", monsterType: "虚空", monsterEmoji: "🌀",
        baseStats: { maxHp: 200, atk: 125, def: 85, speed: 100 },
        statMultiplier: 1.87,
        materialDrops: [{ materialId: 'void_essence', chance: 0.15 }]
    },
    {
        id: 'chaos_beast', name: "カオスビースト", monsterType: "混沌", monsterEmoji: "🌈",
        baseStats: { maxHp: 260, atk: 135, def: 95, speed: 65 },
        statMultiplier: 2.05,
        materialDrops: [{ materialId: 'chaos_orb', chance: 0.1 }]
    },
    {
        id: 'eternal_flame_guardian', name: "永遠の炎の守護者", monsterType: "炎", monsterEmoji: "🔥",
        baseStats: { maxHp: 230, atk: 145, def: 105, speed: 55 },
        statMultiplier: 1.93,
        materialDrops: [{ materialId: 'eternal_flame', chance: 0.1 }]
    },
    {
        id: 'void_dragon', name: "ヴォイドドラゴン", monsterType: "ドラゴン", monsterEmoji: "🐉",
        baseStats: { maxHp: 300, atk: 150, def: 120, speed: 50 },
        statMultiplier: 2.2,
        materialDrops: [{ materialId: 'void_stone', chance: 0.1 }]
    },

    // レア度1〜4 追加モンスター（大幅増量）
    {
        id: 'frog', name: "カエル", monsterType: "両生類", monsterEmoji: "🐸",
        baseStats: { maxHp: 55, atk: 40, def: 30, speed: 60 },
        statMultiplier: 0.4,
        materialDrops: [{ materialId: 'frog_leg', chance: 0.5 }]
    },
    {
        id: 'crow', name: "カラス", monsterType: "飛行", monsterEmoji: "🐦‍⬛",
        baseStats: { maxHp: 55, atk: 50, def: 20, speed: 85 },
        statMultiplier: 0.48,
        materialDrops: [{ materialId: 'crow_feather', chance: 0.5 }]
    },
    {
        id: 'hornet', name: "スズメバチ", monsterType: "虫", monsterEmoji: "🐝",
        baseStats: { maxHp: 45, atk: 60, def: 15, speed: 95 },
        statMultiplier: 0.55,
        materialDrops: [{ materialId: 'hornet_stinger', chance: 0.5 }]
    },
    {
        id: 'centipede', name: "ムカデ", monsterType: "虫", monsterEmoji: "🐛",
        baseStats: { maxHp: 65, atk: 55, def: 35, speed: 55 },
        statMultiplier: 0.5,
        materialDrops: [{ materialId: 'centipede_shell', chance: 0.5 }]
    },
    {
        id: 'crab', name: "カニ", monsterType: "甲殻類", monsterEmoji: "🦀",
        baseStats: { maxHp: 80, atk: 45, def: 70, speed: 25 },
        statMultiplier: 0.6,
        materialDrops: [{ materialId: 'crab_shell', chance: 0.5 }]
    },
    {
        id: 'turtle', name: "カメ", monsterType: "爬虫類", monsterEmoji: "🐢",
        baseStats: { maxHp: 100, atk: 30, def: 85, speed: 10 },
        statMultiplier: 0.68,
        materialDrops: [{ materialId: 'turtle_shell', chance: 0.5 }]
    },
    {
        id: 'weasel', name: "イタチ", monsterType: "獣", monsterEmoji: "🦡",
        baseStats: { maxHp: 55, atk: 55, def: 25, speed: 80 },
        statMultiplier: 0.57,
        materialDrops: [{ materialId: 'weasel_fur', chance: 0.5 }]
    },
    {
        id: 'firefly', name: "ホタル", monsterType: "虫", monsterEmoji: "🪲",
        baseStats: { maxHp: 40, atk: 35, def: 15, speed: 70 },
        statMultiplier: 0.35,
        materialDrops: [{ materialId: 'firefly_light', chance: 0.5 }]
    },
    {
        id: 'mole', name: "モグラ", monsterType: "獣", monsterEmoji: "🦫",
        baseStats: { maxHp: 60, atk: 40, def: 45, speed: 35 },
        statMultiplier: 0.37,
        materialDrops: [{ materialId: 'mole_claw', chance: 0.5 }]
    },
    {
        id: 'scorpion', name: "サソリ", monsterType: "虫", monsterEmoji: "🦂",
        baseStats: { maxHp: 70, atk: 65, def: 40, speed: 50 },
        statMultiplier: 0.69,
        materialDrops: [{ materialId: 'scorpion_tail', chance: 0.5 }]
    },
    {
        id: 'jackal', name: "ジャッカル", monsterType: "獣", monsterEmoji: "🐕",
        baseStats: { maxHp: 65, atk: 60, def: 30, speed: 70 },
        statMultiplier: 0.71,
        materialDrops: [{ materialId: 'jackal_fang', chance: 0.5 }]
    },
    {
        id: 'vulture', name: "ハゲワシ", monsterType: "飛行", monsterEmoji: "🦤",
        baseStats: { maxHp: 70, atk: 50, def: 30, speed: 65 },
        statMultiplier: 0.59,
        materialDrops: [{ materialId: 'vulture_feather', chance: 0.5 }]
    },
    {
        id: 'goblin_shaman', name: "ゴブリンシャーマン", monsterType: "ゴブリン", monsterEmoji: "🧌",
        baseStats: { maxHp: 65, atk: 60, def: 30, speed: 45 },
        statMultiplier: 0.44,
        materialDrops: [{ materialId: 'shaman_totem', chance: 0.5 }]
    },
    {
        id: 'sand_lizard', name: "サンドリザード", monsterType: "爬虫類", monsterEmoji: "🦎",
        baseStats: { maxHp: 105, atk: 70, def: 50, speed: 55 },
        statMultiplier: 0.98,
        materialDrops: [{ materialId: 'lizard_scale', chance: 0.4 }]
    },
    {
        id: 'cave_troll', name: "洞窟トロル", monsterType: "巨人", monsterEmoji: "👹",
        baseStats: { maxHp: 135, atk: 80, def: 60, speed: 20 },
        statMultiplier: 1.15,
        materialDrops: [{ materialId: 'troll_hide', chance: 0.4 }]
    },
    {
        id: 'swamp_hag', name: "沼の魔女", monsterType: "人型", monsterEmoji: "🧙‍♀️",
        baseStats: { maxHp: 100, atk: 75, def: 40, speed: 55 },
        statMultiplier: 0.86,
        materialDrops: [{ materialId: 'hag_eye', chance: 0.4 }]
    },
    {
        id: 'bandit', name: "野盗", monsterType: "人型", monsterEmoji: "🗡️",
        baseStats: { maxHp: 95, atk: 70, def: 45, speed: 60 },
        statMultiplier: 0.88,
        materialDrops: [{ materialId: 'bandit_dagger_shard', chance: 0.4 }]
    },
    {
        id: 'mercenary', name: "傭兵", monsterType: "人型", monsterEmoji: "🛡️",
        baseStats: { maxHp: 115, atk: 80, def: 55, speed: 45 },
        statMultiplier: 1.17,
        materialDrops: [{ materialId: 'mercenary_badge', chance: 0.4 }]
    },
    {
        id: 'cursed_doll', name: "呪いの人形", monsterType: "霊", monsterEmoji: "🪆",
        baseStats: { maxHp: 90, atk: 70, def: 35, speed: 60 },
        statMultiplier: 0.82,
        materialDrops: [{ materialId: 'cursed_thread', chance: 0.4 }]
    },
    {
        id: 'gargoyle', name: "ガーゴイル", monsterType: "無機物", monsterEmoji: "🗿",
        baseStats: { maxHp: 140, atk: 65, def: 95, speed: 25 },
        statMultiplier: 1.31,
        materialDrops: [{ materialId: 'gargoyle_wing', chance: 0.4 }]
    },
    {
        id: 'kappa', name: "河童", monsterType: "妖怪", monsterEmoji: "🐲",
        baseStats: { maxHp: 100, atk: 65, def: 50, speed: 65 },
        statMultiplier: 1.0,
        materialDrops: [{ materialId: 'kappa_plate', chance: 0.4 }]
    },
    {
        id: 'tengu', name: "天狗", monsterType: "妖怪", monsterEmoji: "👺",
        baseStats: { maxHp: 110, atk: 90, def: 45, speed: 75 },
        statMultiplier: 1.27,
        materialDrops: [{ materialId: 'tengu_fan', chance: 0.4 }]
    },
    {
        id: 'oni_child', name: "鬼の子", monsterType: "鬼", monsterEmoji: "👹",
        baseStats: { maxHp: 120, atk: 85, def: 55, speed: 40 },
        statMultiplier: 1.2,
        materialDrops: [{ materialId: 'oni_horn_fragment', chance: 0.4 }]
    },
    {
        id: 'ice_wolf', name: "氷狼", monsterType: "獣", monsterEmoji: "🐺",
        baseStats: { maxHp: 105, atk: 75, def: 50, speed: 70 },
        statMultiplier: 1.22,
        materialDrops: [{ materialId: 'ice_wolf_fang', chance: 0.4 }]
    },
    {
        id: 'bog_witch', name: "沼沢の魔女", monsterType: "人型", monsterEmoji: "🧙",
        baseStats: { maxHp: 95, atk: 80, def: 40, speed: 55 },
        statMultiplier: 0.89,
        materialDrops: [{ materialId: 'bog_herb', chance: 0.4 }]
    },
    {
        id: 'wraith', name: "レイス", monsterType: "霊", monsterEmoji: "👻",
        baseStats: { maxHp: 100, atk: 85, def: 35, speed: 70 },
        statMultiplier: 1.13,
        materialDrops: [{ materialId: 'wraith_shroud', chance: 0.4 }]
    },
    {
        id: 'basilisk', name: "バジリスク", monsterType: "爬虫類", monsterEmoji: "🐍",
        baseStats: { maxHp: 165, atk: 95, def: 75, speed: 45 },
        statMultiplier: 1.46,
        materialDrops: [{ materialId: 'basilisk_eye', chance: 0.25 }]
    },
    {
        id: 'manticore', name: "マンティコア", monsterType: "魔獣", monsterEmoji: "🦂",
        baseStats: { maxHp: 175, atk: 105, def: 70, speed: 55 },
        statMultiplier: 1.64,
        materialDrops: [{ materialId: 'manticore_stinger', chance: 0.25 }]
    },
    {
        id: 'banshee', name: "バンシー", monsterType: "霊", monsterEmoji: "👻",
        baseStats: { maxHp: 140, atk: 100, def: 45, speed: 90 },
        statMultiplier: 1.44,
        materialDrops: [{ materialId: 'banshee_wail', chance: 0.25 }]
    },
    {
        id: 'lich', name: "リッチ", monsterType: "アンデッド", monsterEmoji: "💀",
        baseStats: { maxHp: 160, atk: 110, def: 65, speed: 50 },
        statMultiplier: 1.51,
        materialDrops: [{ materialId: 'lich_phylactery', chance: 0.25 }]
    },
    {
        id: 'werebear', name: "ワーベア", monsterType: "獣人", monsterEmoji: "🐻",
        baseStats: { maxHp: 180, atk: 100, def: 80, speed: 45 },
        statMultiplier: 1.66,
        materialDrops: [{ materialId: 'werebear_claw', chance: 0.25 }]
    },
    {
        id: 'sphinx', name: "スフィンクス", monsterType: "神獣", monsterEmoji: "🦁",
        baseStats: { maxHp: 150, atk: 95, def: 85, speed: 65 },
        statMultiplier: 1.57,
        materialDrops: [{ materialId: 'sphinx_riddle_stone', chance: 0.25 }]
    },
    {
        id: 'cerberus', name: "ケルベロス", monsterType: "魔獣", monsterEmoji: "🐕",
        baseStats: { maxHp: 170, atk: 115, def: 70, speed: 60 },
        statMultiplier: 1.73,
        materialDrops: [{ materialId: 'cerberus_fang', chance: 0.25 }]
    },
    {
        id: 'storm_eagle', name: "ストームイーグル", monsterType: "神獣", monsterEmoji: "🦅",
        baseStats: { maxHp: 145, atk: 100, def: 65, speed: 95 },
        statMultiplier: 1.67,
        materialDrops: [{ materialId: 'storm_feather', chance: 0.25 }]
    },
    {
        id: 'coral_dragon', name: "コーラルドラゴン", monsterType: "ドラゴン", monsterEmoji: "🐉",
        baseStats: { maxHp: 185, atk: 105, def: 90, speed: 45 },
        statMultiplier: 1.78,
        materialDrops: [{ materialId: 'coral_scale', chance: 0.25 }]
    },
    {
        id: 'sand_wyrm', name: "サンドワーム", monsterType: "魔獣", monsterEmoji: "🐛",
        baseStats: { maxHp: 200, atk: 110, def: 85, speed: 30 },
        statMultiplier: 1.8,
        materialDrops: [{ materialId: 'sandworm_hide', chance: 0.25 }]
    },
    {
        id: 'shadow_panther', name: "シャドウパンサー", monsterType: "獣", monsterEmoji: "🐆",
        baseStats: { maxHp: 155, atk: 120, def: 55, speed: 100 },
        statMultiplier: 1.84,
        materialDrops: [{ materialId: 'shadow_pelt', chance: 0.25 }]
    },
    {
        id: 'crystal_golem', name: "クリスタルゴーレム", monsterType: "無機物", monsterEmoji: "💎",
        baseStats: { maxHp: 195, atk: 90, def: 115, speed: 20 },
        statMultiplier: 1.75,
        materialDrops: [{ materialId: 'crystal_shard', chance: 0.25 }]
    },
    {
        id: 'sea_serpent', name: "シーサーペント", monsterType: "ドラゴン", monsterEmoji: "🐍",
        baseStats: { maxHp: 190, atk: 100, def: 80, speed: 55 },
        statMultiplier: 1.82,
        materialDrops: [{ materialId: 'serpent_scale', chance: 0.25 }]
    },
    {
        id: 'frost_titan', name: "フロストタイタン", monsterType: "巨人", monsterEmoji: "🧊",
        baseStats: { maxHp: 270, atk: 135, def: 115, speed: 30 },
        statMultiplier: 2.02,
        materialDrops: [{ materialId: 'frost_core', chance: 0.15 }]
    },
    {
        id: 'magma_behemoth', name: "マグマベヒモス", monsterType: "巨人", monsterEmoji: "🌋",
        baseStats: { maxHp: 290, atk: 145, def: 110, speed: 25 },
        statMultiplier: 2.13,
        materialDrops: [{ materialId: 'magma_core', chance: 0.15 }]
    },
    {
        id: 'star_dragon', name: "スタードラゴン", monsterType: "ドラゴン", monsterEmoji: "🌠",
        baseStats: { maxHp: 260, atk: 140, def: 100, speed: 65 },
        statMultiplier: 2.09,
        materialDrops: [{ materialId: 'star_dragon_scale', chance: 0.15 }]
    },
    {
        id: 'death_reaper', name: "デスリーパー", monsterType: "死神", monsterEmoji: "💀",
        baseStats: { maxHp: 230, atk: 150, def: 90, speed: 75 },
        statMultiplier: 1.98,
        materialDrops: [{ materialId: 'reaper_scythe_shard', chance: 0.15 }]
    },
    {
        id: 'nether_king', name: "ネザーキング", monsterType: "冥府", monsterEmoji: "🔥",
        baseStats: { maxHp: 250, atk: 145, def: 100, speed: 60 },
        statMultiplier: 2.07,
        materialDrops: [{ materialId: 'nether_crown_shard', chance: 0.15 }]
    },
    {
        id: 'celestial_phoenix', name: "セレスティアルフェニックス", monsterType: "神獣", monsterEmoji: "☄️",
        baseStats: { maxHp: 240, atk: 130, def: 105, speed: 90 },
        statMultiplier: 2.11,
        materialDrops: [{ materialId: 'celestial_ash', chance: 0.15 }]
    },
    {
        id: 'world_serpent', name: "ワールドサーペント", monsterType: "深淵", monsterEmoji: "🐍",
        baseStats: { maxHp: 310, atk: 140, def: 115, speed: 40 },
        statMultiplier: 2.18,
        materialDrops: [{ materialId: 'world_serpent_fang', chance: 0.15 }]
    },
    {
        id: 'dream_eater', name: "ドリームイーター", monsterType: "虚空", monsterEmoji: "🌙",
        baseStats: { maxHp: 220, atk: 135, def: 85, speed: 85 },
        statMultiplier: 1.89,
        materialDrops: [{ materialId: 'dream_dust', chance: 0.15 }]
    },
    {
        id: 'gravity_lord', name: "グラビティロード", monsterType: "元素", monsterEmoji: "🌀",
        baseStats: { maxHp: 245, atk: 140, def: 95, speed: 70 },
        statMultiplier: 2.04,
        materialDrops: [{ materialId: 'gravity_orb', chance: 0.15 }]
    },
    {
        id: 'blight_dragon', name: "ブライトドラゴン", monsterType: "ドラゴン", monsterEmoji: "🐲",
        baseStats: { maxHp: 280, atk: 145, def: 105, speed: 55 },
        statMultiplier: 2.15,
        materialDrops: [{ materialId: 'blight_scale', chance: 0.15 }]
    },
    {
        id: 'primeval_giant', name: "原初の巨人", monsterType: "巨人", monsterEmoji: "🗿",
        baseStats: { maxHp: 320, atk: 130, def: 130, speed: 20 },
        statMultiplier: 2.16,
        materialDrops: [{ materialId: 'primeval_core', chance: 0.15 }]
    },
];

function setupOnlineEventHandlers() {
    if (onlineHandlersSetup) {
        return;
    }
    onlineHandlersSetup = true;

    // モンスター選択欄に選択肢を追加
    const botMonsterSelectEl = document.getElementById("botMonsterSelect");
    if (botMonsterSelectEl) {
        BOT_MONSTERS.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = `${m.monsterEmoji} ${m.name}`;
            botMonsterSelectEl.appendChild(opt);
        });
    }

    // ボタンイベントハンドラーの設定
    const createRoomBtn = document.getElementById("createRoom");
    const joinRoomBtn = document.getElementById("joinRoom");
    const botMatchBtn = document.getElementById("botMatch");
    const randomMatchBtn = document.getElementById("randomMatch");

    if (randomMatchBtn) {
        let isMatching = false;
        randomMatchBtn.onclick = function() {
            if (isMatching) {
                // マッチングをキャンセル
                isMatching = false;
                randomMatchBtn.textContent = "ランダムマッチ";
                randomMatchBtn.disabled = false;
                const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
                if (player && window.socket) {
                    window.socket.emit("cancelMatchmaking", player.id);
                }
                // イベントリスナーを解除
                window.socket.off("matchFound");
                window.socket.off("matchCancelled");
                window.socket.off("errorMessage");
                return;
            }

            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }
            if (!window.socket || !window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }

            // セーフモードチェック
            const safeModeCheckbox = document.getElementById('randomMatchSafeMode');
            const isSafeMode = safeModeCheckbox ? safeModeCheckbox.checked : false;
            localStorage.setItem('safeMode', isSafeMode.toString());

            isMatching = true;
            randomMatchBtn.textContent = "マッチング待機中... (クリックでキャンセル)";
            const battlePlayer = getBattleReadyPlayer(player);
            
            const handleMatchFound = (data) => {
                isMatching = false;
                randomMatchBtn.textContent = "ランダムマッチ";
                randomMatchBtn.disabled = false;

                localStorage.removeItem("isBotBattle");
                localStorage.setItem("roomId", data.roomId);
                localStorage.setItem("battlePlayer", JSON.stringify(data.me));
                localStorage.setItem("enemy", JSON.stringify(data.enemy));
                setTimeout(() => {
                    location.href = "battle.html";
                }, 50);
            };

            const handleMatchCancelled = () => {
                isMatching = false;
                randomMatchBtn.textContent = "ランダムマッチ";
                randomMatchBtn.disabled = false;
                alert("マッチングがキャンセルされました。");
            };

            const handleErrorMessage = (message) => {
                isMatching = false;
                randomMatchBtn.textContent = "ランダムマッチ";
                randomMatchBtn.disabled = false;
                alert(message || "マッチングに失敗しました。");
            };

            window.socket.off("matchFound");
            window.socket.off("matchCancelled");
            window.socket.off("errorMessage");
            window.socket.on("matchFound", handleMatchFound);
            window.socket.on("matchCancelled", handleMatchCancelled);
            window.socket.on("errorMessage", handleErrorMessage);

            window.socket.emit("requestRandomMatch", battlePlayer);
        };
    }

    if (botMatchBtn) {
        botMatchBtn.onclick = function() {
            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }

            const battleStats = getBattleStats(player);

            // モンスター選択欄で選ばれたモンスターを使用（「おまかせ」ならランダム）
            const monsterSelect = document.getElementById("botMonsterSelect");
            const selectedId = monsterSelect ? monsterSelect.value : "random";
            const randomMonster = (selectedId && selectedId !== "random")
                ? (BOT_MONSTERS.find(m => m.id === selectedId) || BOT_MONSTERS[Math.floor(Math.random() * BOT_MONSTERS.length)])
                : BOT_MONSTERS[Math.floor(Math.random() * BOT_MONSTERS.length)];

            // プレイヤーの学年に合わせてボットの学年を設定
            const playerGrade = player.grade || 1;

            // モンスターのステータスは、プレイヤーの実ステータス（武器補正込み）に
            // モンスターごとの強さ倍率（statMultiplier）をかけて決定する。
            // 例: スライムはプレイヤーの0.5倍、ゴブリンは0.8倍、強力なモンスターは2倍前後。
            // これにより、プレイヤーが成長するほどモンスターも相対的に強くなり、
            // 常に歯ごたえのあるバトルになる。
            const statMultiplier = randomMonster.statMultiplier != null ? randomMonster.statMultiplier : 1.0;
            const baseMaxHp = Math.max(1, Math.round(battleStats.maxHp * statMultiplier));
            const baseAtk = Math.max(1, Math.round(battleStats.atk * statMultiplier));
            const baseDef = Math.max(1, Math.round(battleStats.def * statMultiplier));
            const baseSpeed = Math.max(1, Math.round(battleStats.speed * statMultiplier));

            const botBaseStats = {
                maxHp: baseMaxHp,
                atk: baseAtk,
                def: baseDef,
                speed: baseSpeed
            };

            const botPlayer = {
                id: "bot_" + Date.now(),
                name: randomMonster.name,
                ...botBaseStats,
                hp: baseMaxHp,
                grade: playerGrade,
                isBot: true,
                monsterType: randomMonster.monsterType,
                monsterEmoji: randomMonster.monsterEmoji,
                materialDrops: randomMonster.materialDrops
            };

            const battlePlayer = getBattleReadyPlayer(player);

            localStorage.setItem("roomId", "bot_battle_" + Date.now());
            localStorage.setItem("battlePlayer", JSON.stringify(battlePlayer));
            localStorage.setItem("enemy", JSON.stringify(botPlayer));
            localStorage.setItem("isBotBattle", "true");

            setTimeout(() => {
                location.href = "battle.html";
            }, 50);
        };
    }

    // 「実戦形式」の練習バトル：常にスライムを相手に、実際のバトル画面で
    // 操作方法を教えながら戦う（battle.html側のPracticeCoachが吹き出しを表示する）。
    const practiceBotMatchBtn = document.getElementById("practiceBotMatch");
    if (practiceBotMatchBtn) {
        practiceBotMatchBtn.onclick = function() {
            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }

            const battleStats = getBattleStats(player);
            const slimeMonster = BOT_MONSTERS.find(m => m.id === "slime") || BOT_MONSTERS[0];
            const playerGrade = player.grade || 1;

            const statMultiplier = slimeMonster.statMultiplier != null ? slimeMonster.statMultiplier : 1.0;
            const botBaseStats = {
                maxHp: Math.max(1, Math.round(battleStats.maxHp * statMultiplier)),
                atk: Math.max(1, Math.round(battleStats.atk * statMultiplier)),
                def: Math.max(1, Math.round(battleStats.def * statMultiplier)),
                speed: Math.max(1, Math.round(battleStats.speed * statMultiplier))
            };

            const botPlayer = {
                id: "bot_" + Date.now(),
                name: slimeMonster.name,
                ...botBaseStats,
                hp: botBaseStats.maxHp,
                grade: playerGrade,
                isBot: true,
                monsterType: slimeMonster.monsterType,
                monsterEmoji: slimeMonster.monsterEmoji,
                materialDrops: slimeMonster.materialDrops
            };

            const battlePlayer = getBattleReadyPlayer(player);

            localStorage.setItem("roomId", "bot_battle_" + Date.now());
            localStorage.setItem("battlePlayer", JSON.stringify(battlePlayer));
            localStorage.setItem("enemy", JSON.stringify(botPlayer));
            localStorage.setItem("isBotBattle", "true");
            localStorage.setItem("sb_practice_tutorial", "true");

            setTimeout(() => {
                location.href = "battle.html";
            }, 50);
        };
    }

    if (createRoomBtn) {
        createRoomBtn.onclick = function() {
            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }
            if (!window.socket) {
                alert("ソケットが初期化されていません。ページを再読み込みしてください。");
                return;
            }
            if (!window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            
            // セーフモードチェック
            const safeModeCheckbox = document.getElementById('roomMatchSafeMode');
            const isSafeMode = safeModeCheckbox ? safeModeCheckbox.checked : false;
            localStorage.setItem('safeMode', isSafeMode.toString());
            
            createRoomBtn.disabled = true;
            createRoomBtn.textContent = "作成中...";
            const battlePlayer = getBattleReadyPlayer(player);
            
            const cleanupListeners = () => {
                window.socket.off("roomCreated", handleRoomCreated);
                window.socket.off("errorMessage", handleErrorMessage);
                window.socket.off("roomReady", handleRoomReadyForHost);
            };

            const handleRoomReadyForHost = (data) => {
                console.log("Room is ready for host!", data);
                localStorage.removeItem("isBotBattle");
                localStorage.setItem("roomId", data.roomId);
                localStorage.setItem("battlePlayer", JSON.stringify(data.me));
                localStorage.setItem("enemy", JSON.stringify(data.enemy));
                cleanupListeners();
                setTimeout(() => {
                    location.href = "battle.html";
                }, 50);
            };
            
            const handleRoomCreated = (roomId) => {
                console.log("roomCreated event received:", roomId);
                localStorage.setItem("lastCreatedRoom", roomId);
                localStorage.setItem("lastCreatedRoomTime", Date.now().toString());

                createRoomBtn.textContent = "相手の参加待ち...";
                // Button remains disabled

                const roomUrl = window.location.origin + "/?room=" + roomId;
                const clipboardText = `ルームコード: ${roomId}\n参加URL: ${roomUrl}`;
                navigator.clipboard.writeText(clipboardText).then(() => {
                    alert("ルームコード: " + roomId + "\n\n✓ コードとURLをクリップボードにコピーしました！\n\n友達にURLを送るか、コードを教えてください。\n\nURL: " + roomUrl);
                }).catch(() => {
                    alert("ルームコード: " + roomId + "\n\n参加URL: " + roomUrl);
                });
            };
            
            const handleErrorMessage = (message) => {
                createRoomBtn.disabled = false;
                createRoomBtn.textContent = "ルーム作成";
                alert(message || "ルーム作成に失敗しました。もう一度お試しください。");
                cleanupListeners();
            };

            cleanupListeners(); // Clean up any previous listeners before setting new ones
            window.socket.on("roomCreated", handleRoomCreated);
            window.socket.on("roomReady", handleRoomReadyForHost);
            window.socket.on("errorMessage", handleErrorMessage);

            window.socket.emit("createRoom", battlePlayer);

            setTimeout(() => {
                if (createRoomBtn.textContent === "作成中...") {
                    createRoomBtn.disabled = false;
                    createRoomBtn.textContent = "ルーム作成";
                    alert("ルーム作成に失敗しました(タイムアウト)。もう一度お試しください。");
                    cleanupListeners();
                }
            }, 10000);
        };
    }

    if (joinRoomBtn) {
        joinRoomBtn.onclick = function() {
            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }
            const roomId = document.getElementById("roomInput").value.trim().toUpperCase();
            if (!roomId) {
                alert("ルームコードを入力してください。");
                return;
            }
            if (!window.socket) {
                alert("ソケットが初期化されていません。ページを再読み込みしてください。");
                return;
            }
            // socket.connectedプロパティのチェックを緩和
            if (!window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            joinRoomBtn.disabled = true;
            joinRoomBtn.textContent = "参加中...";
            localStorage.setItem("attemptedJoinRoom", roomId);
            const battlePlayer = getBattleReadyPlayer(player);
            console.log("Emitting joinRoom with roomId:", roomId, "player:", battlePlayer);
            
            // roomReadyイベントを受信する一時的なリスナー
            const handleRoomReady = (data) => {
                console.log("roomReady event received:", data);
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = "ルーム参加";

                localStorage.removeItem("isBotBattle");
                localStorage.setItem("roomId", data.roomId);
                localStorage.setItem("battlePlayer", JSON.stringify(data.me));
                localStorage.setItem("enemy", JSON.stringify(data.enemy));
                setTimeout(() => {
                    location.href = "battle.html";
                }, 50); // 50ミリ秒待機
            };

            const handleJoinFailed = () => {
                console.log("joinFailed event received");
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = "ルーム参加";

                const attemptedRoom = localStorage.getItem("attemptedJoinRoom");
                let message = "ルームが存在しないか、満員です。\n\n";
                if (attemptedRoom) {
                    message += `参加しようとしたルーム: ${attemptedRoom}\n`;
                }
                message += "\nルームコードを確認するか、新しいルームを作成してください。";
                alert(message);
            };

            window.socket.off("roomReady");
            window.socket.off("joinFailed");
            window.socket.on("roomReady", handleRoomReady);
            window.socket.on("joinFailed", handleJoinFailed);

            window.socket.emit("joinRoom", { roomId, player: battlePlayer });

            setTimeout(() => {
                if (joinRoomBtn.disabled) {
                    joinRoomBtn.disabled = false;
                    joinRoomBtn.textContent = "ルーム参加";
                    alert("ルーム参加に失敗しました。もう一度お試しください。");
                }
            }, 10000);
        };
    }
}
