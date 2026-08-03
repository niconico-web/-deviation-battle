// ============================================
// 武器システム
// ============================================

// ============================================
// オーブシステム
// ============================================

const ORB_TIERS = {
    tier1: { name: "Tier1", dropRate: 0.50, statRange: [0.05, 0.10] },
    tier2: { name: "Tier2", dropRate: 0.30, statRange: [0.10, 0.15] },
    tier3: { name: "Tier3", dropRate: 0.15, statRange: [0.15, 0.20] },
    tier4: { name: "Tier4", dropRate: 0.05, statRange: [0.15, 0.20] }
};

const ORB_DROP_THRESHOLD_SECONDS = 25 * 60; // 25分
const ORB_DROP_CHANCE = 0.50; // 50%（戦闘勝利時）

const ORB_UNIQUE_ABILITIES = {
    life_drain: {
        name: "ライフドレイン",
        description: "相手に攻撃したとき、その時与えたダメージの20%分自分のHPを回復できる",
        effect: "life_drain"
    },
    overwhelming_growth: {
        name: "圧倒的成長性",
        description: "勉強タイマー使用時のステータスの上り幅が2倍になる",
        effect: "double_study_growth"
    },
    re_miserable: {
        name: "リ・ミゼラブル",
        description: "戦闘時相手の全ステータスを0.8倍",
        effect: "enemy_stat_debuff"
    },
    penetration: {
        name: "貫通",
        description: "相手の防御ステータスを50%減らす",
        effect: "ignore_def_half"
    },
    iron_wall: {
        name: "鉄壁",
        description: "相手からの攻撃のダメージ50%カット",
        effect: "damage_cut_half"
    },
    sure_hit: {
        name: "必中",
        description: "相手の回避率を無視して相手に絶対攻撃をあてられる",
        effect: "ignore_evasion"
    },
    critical_hit: {
        name: "必殺",
        description: "20%の確率で相手への攻撃のダメージ1.5倍",
        effect: "critical_damage"
    }
};

const ORB_STAT_TYPES = ["atk", "def", "speed", "maxHp"];

const ORB_STAT_LABELS = {
    atk: "攻撃",
    def: "防御",
    speed: "速さ",
    maxHp: "HP"
};

function createOrb(tier) {
    const tierConfig = ORB_TIERS[tier];
    if (!tierConfig) return null;
    
    const statType = ORB_STAT_TYPES[Math.floor(Math.random() * ORB_STAT_TYPES.length)];
    const minBonus = tierConfig.statRange[0];
    const maxBonus = tierConfig.statRange[1];
    const bonus = minBonus + Math.random() * (maxBonus - minBonus);
    
    const id = `orb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const orb = {
        id,
        tier,
        statType,
        bonus: Math.round(bonus * 1000) / 1000, // 小数点3桁まで
        uniqueAbility: null
    };
    
    // Tier4のみユニーク能力を付与
    if (tier === "tier4") {
        const abilityKeys = Object.keys(ORB_UNIQUE_ABILITIES);
        const abilityKey = abilityKeys[Math.floor(Math.random() * abilityKeys.length)];
        orb.uniqueAbility = {
            key: abilityKey,
            ...ORB_UNIQUE_ABILITIES[abilityKey]
        };
    }
    
    return orb;
}

function rollOrbDrop(dropChance = ORB_DROP_CHANCE) {
    if (Math.random() > dropChance) return null;
    
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [tier, config] of Object.entries(ORB_TIERS)) {
        cumulative += config.dropRate;
        if (rand < cumulative) {
            return createOrb(tier);
        }
    }
    
    return null;
}

function getOrbDisplayName(orb) {
    if (!orb) return "不明なオーブ";
    const tierName = ORB_TIERS[orb.tier]?.name || orb.tier;
    const statLabel = ORB_STAT_LABELS[orb.statType] || orb.statType;
    const bonusPercent = Math.round(orb.bonus * 100);
    
    let name = `${tierName}オーブ (${statLabel}+${bonusPercent}%)`;
    
    if (orb.uniqueAbility) {
        name += ` [${orb.uniqueAbility.name}]`;
    }
    
    return name;
}

function applyOrbToWeapon(weapon, orbs) {
    if (!weapon || !orbs || orbs.length === 0) return weapon;
    
    const newWeapon = { ...weapon };
    const totalBonus = {};
    
    // オーブの補正を集計
    for (const orb of orbs) {
        if (!totalBonus[orb.statType]) {
            totalBonus[orb.statType] = 0;
        }
        totalBonus[orb.statType] += orb.bonus;
    }
    
    // ステータス補正を適用（既存の補正を上書きせず、オーブの補正のみを適用）
    newWeapon.statBonuses = {}; // 新しい武器なので補正をリセット
    for (const [stat, bonus] of Object.entries(totalBonus)) {
        newWeapon.statBonuses[stat] = bonus;
    }
    
    // ユニーク能力を適用（Tier4オーブから）
    const uniqueAbilities = orbs
        .filter(orb => orb.uniqueAbility)
        .map(orb => orb.uniqueAbility);
    
    if (uniqueAbilities.length > 0) {
        newWeapon.uniqueAbilities = uniqueAbilities;
    } else {
        newWeapon.uniqueAbilities = []; // ユニーク能力をリセット
    }
    
    // オーブの合計倍率を計算
    let orbMultiplier = 1.0;
    for (const orb of orbs) {
        const tierMult = { tier1: 1.02, tier2: 1.05, tier3: 1.08, tier4: 1.12 }[orb.tier] || 1.0;
        orbMultiplier *= tierMult;
    }
    
    newWeapon.multiplier = ORIGINAL_WEAPON_BASE_MULTIPLIER * orbMultiplier; // 基礎倍率から再計算
    newWeapon.orbs = orbs.map(orb => orb.id); // 使用したオーブのIDを記録
    newWeapon.upgradeCount = 0; // 強化回数をリセット
    
    return newWeapon;
}

// ユニーク能力を適用したステータス計算
function applyUniqueAbilitiesToStats(baseStats, weapon, isEnemy = false) {
    if (!weapon || !weapon.uniqueAbilities) return baseStats;
    
    const stats = { ...baseStats };
    
    for (const ability of weapon.uniqueAbilities) {
        switch (ability.effect) {
            case "enemy_stat_debuff": // リ・ミゼラブル
                if (isEnemy) {
                    stats.atk = Math.floor(stats.atk * 0.8);
                    stats.def = Math.floor(stats.def * 0.8);
                    stats.speed = Math.floor(stats.speed * 0.8);
                    stats.maxHp = Math.floor(stats.maxHp * 0.8);
                }
                break;
            case "ignore_def_half": // 貫通
                if (isEnemy) {
                    stats.def = Math.floor(stats.def * 0.5);
                }
                break;
            // 他の能力はダメージ計算時に処理
        }
    }
    
    return stats;
}

// ユニーク abilityによるダメージ計算
function calculateDamageWithAbilities(baseDamage, attacker, defender, weapon) {
    if (!weapon || !weapon.uniqueAbilities) return baseDamage;
    
    let damage = baseDamage;
    
    for (const ability of weapon.uniqueAbilities) {
        switch (ability.effect) {
            case "critical_damage": // 必殺
                if (Math.random() < 0.20) {
                    damage = Math.floor(damage * 1.5);
                }
                break;
            case "life_drain": // ライフドレイン
                // ダメージ計算後に回復処理を行うため、ここではフラグのみ設定
                break;
            case "damage_cut_half": // 鉄壁
                // 防御側の処理
                break;
        }
    }
    
    return damage;
}

// 防御側のダメージ軽減計算
function calculateDefenseWithAbilities(baseDamage, defender, weapon) {
    if (!weapon || !weapon.uniqueAbilities) return baseDamage;
    
    let damage = baseDamage;
    
    for (const ability of weapon.uniqueAbilities) {
        switch (ability.effect) {
            case "damage_cut_half": // 鉄壁
                damage = Math.floor(damage * 0.5);
                break;
        }
    }
    
    return damage;
}

const WEAPON_TYPES = {
    sword_shield: { name: "片手剣＋盾", primary: ["def", "atk"], secondary: [], debuff: {} },
    spear:        { name: "長槍",       primary: ["atk", "speed"], secondary: [], debuff: {}, debugBonus: { bonusMult: 2.0, primary: ["atk", "speed", "def", "maxHp"] } },
    greatsword:   { name: "大剣",       primary: ["atk"], secondary: [], debuff: { def: 0.85, speed: 0.85 }, bonusMult: 1.3 },
    dual_swords:  { name: "双剣",       primary: ["speed", "atk"], secondary: [], debuff: {} },
    scythe:       { name: "鎌",         primary: ["maxHp", "atk", "def", "speed"], secondary: [], debuff: {}, bonusMult: 0.95 },
    pistol:       { name: "ピストル",   primary: ["speed","maxHp"], secondary: ["atk"], debuff: {} },
    katana:       { name: "刀",         primary: ["def", "speed"], secondary: [], debuff: {} }
};

const TIER_MULT = { tier1: 1.05, tier2: 1.12, tier3: 1.20 };
const UNIQUE_MULT = 1.65; // tier3(1.20) × 1.375 ≒ 1.65

const TIER_PRICES = { tier1: 30, tier2: 50, tier3: 100 };

const WEAPON_CATALOG = {
    sword_shield: {
        tier1: { name: "鉄の盾剣" },
        tier2: { name: "騎士の盾剣" },
        tier3: { name: "聖騎士の盾剣" },
        unique: { name: "神盾剣ゼウス・ヘカテー" }
    },
    spear: {
        tier1: { name: "木の槍" },
        tier2: { name: "鋼の長槍" },
        tier3: { name: "ドラゴンスレイヤー" },
        unique: { name: "神槍　天照" },
        debug: { name: "デバッガーランス", isDebug: true }
    },
    greatsword: {
        tier1: { name: "錆びた大剣" },
        tier2: { name: "黒鉄の大剣" },
        tier3: { name: "覇王の大剣" },
        unique: { name: "ベルゼバブ" }
    },
    dual_swords: {
        tier1: { name: "錆びた双剣" },
        tier2: { name: "疾風の双剣" },
        tier3: { name: "幻影の双剣" },
        unique: { name: "巨狼　オルトロス" }
    },
    scythe: {
        tier1: { name: "農夫の鎌" },
        tier2: { name: "死神の鎌" },
        tier3: { name: "冥府の鎌" },
        unique: { name: "グリム・リーパー" }
    },
    pistol: {
        tier1: { name: "古式ピストル" },
        tier2: { name: "連射ピストル" },
        tier3: { name: "マグナム" },
        unique: { name: "九頭蛇　ヒュドラ" }
    },
    katana: {
        tier1: { name: "錆びた刀" },
        tier2: { name: "業物" },
        tier3: { name: "名刀「村正」" },
        unique: { name: "天雲　スサノオ" }
    }
};

const DEBUG_UNIQUE_WINS = 1; // デバッグ用ユニーク武器は1勝で入手可能
const UNIQUE_QUEST_WINS = 500; // 通常のユニーク武器は500勝で入手可能

// デバッグ用: テスト用に勝利数を減らす
const TEST_UNIQUE_WINS = 3; // テスト用に3勝に設定（本番は500に戻す）
const COIN_BATTLE_WIN = 15;
const COIN_STUDY_30MIN = 20;
const STUDY_COIN_THRESHOLD = 30 * 60; // 30分

// オリジナル武器設定
const ORIGINAL_WEAPON_COST = 30; // 作成コスト
const ORIGINAL_WEAPON_UPGRADE_COST = 3; // 強化コスト
const ORIGINAL_WEAPON_UPGRADE_INCREMENT = 0.002; // 強化ごとの倍率増加
const ORIGINAL_WEAPON_MAX_MULTIPLIER = 2.0; // 最大倍率
const ORIGINAL_WEAPON_BASE_MULTIPLIER = 1.05; // 基礎倍率（tier1相当）

function getWeaponMultiplier(weapon) {
    if (!weapon) return 1;
    if (weapon.isOriginal) return weapon.multiplier || ORIGINAL_WEAPON_BASE_MULTIPLIER;
    if (weapon.isUnique) return UNIQUE_MULT;
    return TIER_MULT[weapon.tier] || 1;
}

function createOriginalWeapon(name, type, statBonuses) {
    const id = `original_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
        id,
        name: name || "オリジナル武器",
        type,
        isOriginal: true,
        multiplier: ORIGINAL_WEAPON_BASE_MULTIPLIER,
        statBonuses: statBonuses || {}, // { atk: 0.5, def: -0.3, speed: 0.2 } etc.
        upgradeCount: 0
    };
}

function upgradeOriginalWeapon(weapon) {
    if (!weapon.isOriginal) return weapon;
    if (weapon.multiplier >= ORIGINAL_WEAPON_MAX_MULTIPLIER) return weapon;
    
    const newMultiplier = Math.min(
        ORIGINAL_WEAPON_MAX_MULTIPLIER,
        weapon.multiplier + ORIGINAL_WEAPON_UPGRADE_INCREMENT
    );
    
    return {
        ...weapon,
        multiplier: newMultiplier,
        upgradeCount: weapon.upgradeCount + 1
    };
}

function canUpgradeOriginalWeapon(weapon) {
    return weapon.isOriginal && weapon.multiplier < ORIGINAL_WEAPON_MAX_MULTIPLIER;
}

function getOriginalWeaponUpgradeCost(weapon) {
    return ORIGINAL_WEAPON_UPGRADE_COST;
}

function createWeapon(type, tier, isUnique) {
    const catalog = WEAPON_CATALOG[type];
    if (!catalog) return null;
    const tierKey = isUnique ? "unique" : tier;
    const info = catalog[tierKey];
    if (!info) return null;
    return {
        id: `${type}_${tierKey}`,
        type,
        tier: isUnique ? "unique" : tier,
        name: info.name,
        isUnique: !!isUnique,
        isDebug: info.isDebug || false,
        isDebugWeapon: tierKey === "debug"
    };
}

function getAllShopWeapons() {
    const list = [];
    for (const type of Object.keys(WEAPON_TYPES)) {
        for (const tier of ["tier1", "tier2", "tier3"]) {
            list.push(createWeapon(type, tier, false));
        }
    }
    return list;
}

function applyWeaponStats(baseStats, weapon) {
    if (!weapon) return { ...baseStats };
    
    // オリジナル武器の場合
    if (weapon.isOriginal) {
        const result = { ...baseStats };
        const typeConf = WEAPON_TYPES[weapon.type];
        
        // 基本倍率を取得（武器種のbonusMultは適用しない）
        let mult = weapon.multiplier || ORIGINAL_WEAPON_BASE_MULTIPLIER;
        
        // 武器種の設定を適用（bonusMultを除く）
        if (typeConf) {
            // プライマリステータスに倍率適用
            for (const stat of typeConf.primary) {
                if (result[stat] !== undefined) {
                    result[stat] = Math.floor(result[stat] * mult);
                }
            }
            
            // セカンダリステータスに倍率適用（0.85倍）
            for (const stat of typeConf.secondary) {
                if (result[stat] !== undefined) {
                    result[stat] = Math.floor(result[stat] * (mult * 0.85));
                }
            }
            
            // デバフ適用
            if (typeConf.debuff) {
                for (const [stat, debuffMult] of Object.entries(typeConf.debuff)) {
                    if (result[stat] !== undefined) {
                        result[stat] = Math.floor(result[stat] * debuffMult);
                    }
                }
            }
        } else {
            // 武器種がない場合は全ステータスに基本倍率適用
            for (const stat of ['atk', 'def', 'speed', 'maxHp']) {
                if (result[stat] !== undefined) {
                    result[stat] = Math.floor(result[stat] * mult);
                }
            }
        }
        
        // カスタム補正適用
        if (weapon.statBonuses) {
            for (const [stat, bonus] of Object.entries(weapon.statBonuses)) {
                if (result[stat] !== undefined) {
                    result[stat] = Math.floor(result[stat] * (1 + bonus));
                }
            }
        }
        
        return result;
    }
    
    const typeConf = WEAPON_TYPES[weapon.type];
    if (!typeConf) return { ...baseStats };
    
    // デバッグ武器の場合は特別ボーナスを適用
    if (weapon.isDebugWeapon && typeConf.debugBonus) {
        const result = { ...baseStats };
        const debugBonus = typeConf.debugBonus;
        const mult = debugBonus.bonusMult || 2.0;
        
        // デバッグ武器専用のプライマリステータスに倍率適用
        for (const stat of debugBonus.primary) {
            result[stat] = Math.floor(result[stat] * mult);
        }
        
        return result;
    }
    
    // 基本倍率を取得（bonusMultがあれば使用、なければデフォルト倍率）
    let mult = getWeaponMultiplier(weapon);
    if (typeConf.bonusMult) {
        mult = mult * typeConf.bonusMult;
    }
    
    const result = { ...baseStats };
    
    // プライマリステータスに倍率適用
    for (const stat of typeConf.primary) {
        result[stat] = Math.floor(result[stat] * mult);
    }
    
    // セカンダリステータスに倍率適用（0.85倍）
    for (const stat of typeConf.secondary) {
        result[stat] = Math.floor(result[stat] * (mult * 0.85));
    }
    
    // デバフ適用
    if (typeConf.debuff) {
        for (const [stat, debuffMult] of Object.entries(typeConf.debuff)) {
            if (result[stat] !== undefined) {
                result[stat] = Math.floor(result[stat] * debuffMult);
            }
        }
    }
    
    return result;
}

function getEffectiveStats(player) {
    const base = getStatsFromPlayer(player);
    return applyWeaponStats(base, player.equippedWeapon);
}

function getBattleStats(player) {
    return getEffectiveStats(player);
}

function playerOwnsWeapon(player, weaponId) {
    return (player.weapons || []).some(w => w.id === weaponId);
}

function addWeaponToPlayer(player, weapon) {
    if (!weapon) return player;
    const weapons = player.weapons || [];
    if (weapons.some(w => w.id === weapon.id)) return player;
    return { ...player, weapons: [...weapons, weapon] };
}

function removeWeaponFromPlayer(player, weaponId) {
    const weapons = (player.weapons || []).filter(w => w.id !== weaponId);
    const equippedWeapon = player.equippedWeapon?.id === weaponId ? null : player.equippedWeapon;
    return { ...player, weapons, equippedWeapon };
}

function discardWeapon(player, weaponId) {
    const weapon = (player.weapons || []).find(w => w.id === weaponId);
    if (!weapon) return { ok: false, message: "武器を所持していません" };
    if (player.equippedWeapon?.id === weaponId) return { ok: false, message: "装備中の武器は捨てられません" };
    
    const updated = removeWeaponFromPlayer(player, weaponId);
    return { ok: true, player: updated, weapon };
}

function buyWeapon(player, type, tier) {
    const price = TIER_PRICES[tier];
    if (!price) return { ok: false, message: "無効な武器です" };
    const weapon = createWeapon(type, tier, false);
    if (!weapon) return { ok: false, message: "武器が見つかりません" };
    if (playerOwnsWeapon(player, weapon.id)) return { ok: false, message: "既に所持しています" };
    const coins = player.coins || 0;
    if (coins < price) return { ok: false, message: `コインが足りません（必要: ${price}、所持: ${coins}）` };
    const updated = addWeaponToPlayer({ ...player, coins: coins - price }, weapon);
    return { ok: true, player: updated, weapon };
}

function equipWeapon(player, weaponId) {
    const weapon = (player.weapons || []).find(w => w.id === weaponId);
    if (!weapon) return { ok: false, message: "武器を所持していません" };
    return { ok: true, player: { ...player, equippedWeapon: weapon } };
}

function unequipWeapon(player) {
    return { ...player, equippedWeapon: null };
}

function addCoins(player, amount) {
    return { ...player, coins: (player.coins || 0) + amount };
}

function incrementWeaponWin(player) {
    if (!player.equippedWeapon) {
        console.log(`[Weapons] incrementWeaponWin: No equipped weapon - no count added`);
        return player;
    }
    const type = player.equippedWeapon.type;
    const weaponWins = { ...(player.weaponWins || {}) };
    weaponWins[type] = (weaponWins[type] || 0) + 1;
    console.log(`[Weapons] incrementWeaponWin: weaponName=${player.equippedWeapon.name}, type=${type}, newCount=${weaponWins[type]}`);
    console.log(`[Weapons] All weaponWins:`, weaponWins);
    return { ...player, weaponWins };
}

function getWeaponWinCount(player, type) {
    return (player.weaponWins || {})[type] || 0;
}

function canClaimUniqueQuest(player, type) {
    const typeConf = WEAPON_TYPES[type];
    // テスト用: 3勝に設定（本番は500に戻す）
    const requiredWins = TEST_UNIQUE_WINS;
    return getWeaponWinCount(player, type) >= requiredWins;
}

function canClaimDebugWeapon(player, type) {
    return getWeaponWinCount(player, type) >= 1;
}

function getWeaponDisplayName(weapon) {
    if (!weapon) return "なし";
    if (weapon.isOriginal) return weapon.name;
    const tierLabel = weapon.isUnique ? "★ユニーク" : weapon.tier?.toUpperCase() || "";
    return `${weapon.name} [${tierLabel}]`;
}

function getWeaponTypeLabel(type) {
    return WEAPON_TYPES[type]?.name || type;
}
