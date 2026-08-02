// ============================================
// 武器システム
// ============================================

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

function getWeaponMultiplier(weapon) {
    if (!weapon) return 1;
    if (weapon.isUnique) return UNIQUE_MULT;
    return TIER_MULT[weapon.tier] || 1;
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
    const tierLabel = weapon.isUnique ? "★ユニーク" : weapon.tier?.toUpperCase() || "";
    return `${weapon.name} [${tierLabel}]`;
}

function getWeaponTypeLabel(type) {
    return WEAPON_TYPES[type]?.name || type;
}
