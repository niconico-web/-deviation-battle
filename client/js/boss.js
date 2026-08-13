// Boss Battle System
// 7 Bosses with 3 difficulty levels each

const BOSS_DATA = {
    boss1: {
        name: "魔導書の守護者 アルカディア",
        description: "古代の知識を守る魔導書の守護者。強力な攻撃魔法を操る。",
        skills: [
            { name: "聖なる光の裁き", description: "聖なる光で敵に大ダメージを与える", effect: { damageMultiplier: 2.0, sureHit: true } },
            { name: "マジック・シールド", description: "強力な魔法防御シールドを展開する", effect: { shield: 100, damageReduction: 0.5 } },
            { name: "知恵の恩恵", description: "全ステータスを一時的に強化する", effect: { damageMultiplier: 1.5, damageReduction: 0.3 } }
        ],
        difficulties: {
            easy: { hp: 25000, atk: 500, def: 500, speed: 500, totalStats: 26500 },
            medium: { hp: 50000, atk: 1000, def: 1000, speed: 1000, totalStats: 53000 },
            hard: { hp: 100000, atk: 2000, def: 2000, speed: 2000, totalStats: 106000 }
        }
    },
    boss2: {
        name: "鉄壁の守護者 ベルセルク",
        description: "試練を守る剣士。物理攻撃が絶大。",
        skills: [
            { name: "破壊の一撃", description: "物理攻撃で敵を粉砕する", effect: { damageMultiplier: 2.5, defenseIgnore: true } },
            { name: "不屈の意志", description: "防御力を大幅に上昇させる", effect: { damageReduction: 0.7, selfDefDebuff: -20 } },
            { name: "戦士の咆哮", description: "敵の攻撃力を下げる", effect: { enemyAtkDebuff: 0.3 } }
        ],
        difficulties: {
            easy: { hp: 30000, atk: 600, def: 600, speed: 600, totalStats: 31800 },
            medium: { hp: 60000, atk: 1200, def: 1200, speed: 1200, totalStats: 63600 },
            hard: { hp: 120000, atk: 2400, def: 2400, speed: 2400, totalStats: 127200 }
        }
    },
    boss3: {
        name: "時空の支配者 クロノス",
        description: "時間を操る神秘の存在。速度と回避が異常に高い。",
        skills: [
            { name: "時間停止", description: "敵の行動を1ターン封じる", effect: { skipNextTurn: true } },
            { name: "加速の呪い", description: "自分の速度を大幅に上昇させる", effect: { dodgeChance: 0.5, speedBoost: 50 } },
            { name: "時空切断剣", description: "時空を裂く一撃を放つ", effect: { damageMultiplier: 3.0, sureHit: true, multiHit: 2 } }
        ],
        difficulties: {
            easy: { hp: 35000, atk: 700, def: 700, speed: 1000, totalStats: 37400 },
            medium: { hp: 70000, atk: 1400, def: 1400, speed: 2000, totalStats: 74800 },
            hard: { hp: 140000, atk: 2800, def: 2800, speed: 4000, totalStats: 149600 }
        }
    },
    boss4: {
        name: "賢者 メルクリウス",
        description: "古代の知恵を持つ賢者。魔法防御が高い。",
        skills: [
            { name: "古代魔法", description: "古代の強力な魔法を放つ", effect: { damageMultiplier: 2.2, heal: 50 } },
            { name: "魔法障壁", description: "魔法ダメージを大幅に軽減する", effect: { damageReduction: 0.8, shield: 150 } },
            { name: "賢者の智慧", description: "回復と強化を同時に行う", effect: { heal: 100, damageMultiplier: 1.3 } }
        ],
        difficulties: {
            easy: { hp: 40000, atk: 800, def: 800, speed: 800, totalStats: 42400 },
            medium: { hp: 80000, atk: 1600, def: 1600, speed: 1600, totalStats: 84800 },
            hard: { hp: 160000, atk: 3200, def: 3200, speed: 3200, totalStats: 169600 }
        }
    },
    boss5: {
        name: "混沌の化身 カオス",
        description: "混沌の化身。予測不能な攻撃を行う。",
        skills: [
            { name: "混沌の渦", description: "混沌の渦巻きで敵を巻き込む", effect: { damageMultiplier: 2.0, multiHit: 3, poison: true } },
            { name: "狂乱の舞踏", description: "ランダムな効果を発動する", effect: { damageMultiplier: 1.8, dodgeChance: 0.3, counter: true } },
            { name: "破壊の宴", description: "全体に大ダメージを与える", effect: { damageMultiplier: 2.5, areaDamage: true } }
        ],
        difficulties: {
            easy: { hp: 45000, atk: 900, def: 900, speed: 900, totalStats: 47700 },
            medium: { hp: 90000, atk: 1800, def: 1800, speed: 1800, totalStats: 95400 },
            hard: { hp: 180000, atk: 3600, def: 3600, speed: 3600, totalStats: 190800 }
        }
    },
    boss6: {
        name: "絶望の魔王 デス・ドレッド",
        description: "絶望を支配する魔王。全ステータスが高い。",
        skills: [
            { name: "絶望の視線", description: "敵に強力なデバフを与える", effect: { enemyAtkDebuff: 0.4, enemyDefDebuff: 0.4, enemyAccuracyDebuff: 0.4 } },
            { name: "魔王の鉄槌", description: "絶対的な力で敵を粉砕する", effect: { damageMultiplier: 3.0, defenseIgnore: true, sureHit: true } },
            { name: "絶望の再臨", description: "戦闘不能になっても復活する", effect: { revive: true, damageMultiplier: 2.0 } }
        ],
        difficulties: {
            easy: { hp: 50000, atk: 1000, def: 1000, speed: 1000, totalStats: 53000 },
            medium: { hp: 100000, atk: 2000, def: 2000, speed: 2000, totalStats: 106000 },
            hard: { hp: 200000, atk: 4000, def: 4000, speed: 4000, totalStats: 212000 }
        }
    },
    boss7: {
        name: "学問の頂点 オムニサイエンス",
        description: "全ての学問の頂点に立つ存在。最強のボス。",
        skills: [
            { name: "究極の知識", description: "全てのステータスを最大化する", effect: { damageMultiplier: 2.0, damageReduction: 0.5, dodgeChance: 0.3, critChance: 0.5 } },
            { name: "学問の極意", description: "複数の強力な効果を同時に発動", effect: { damageMultiplier: 2.5, multiHit: 2, sureHit: true, heal: 100 } },
            { name: "頂点の断末魔", description: "最強の一撃を放つ", effect: { damageMultiplier: 4.0, defenseIgnore: true, sureHit: true, critChance: 1.0 } }
        ],
        difficulties: {
            easy: { hp: 75000, atk: 1500, def: 1500, speed: 1500, totalStats: 79500 },
            medium: { hp: 150000, atk: 3000, def: 3000, speed: 3000, totalStats: 159000 },
            hard: { hp: 300000, atk: 6000, def: 6000, speed: 6000, totalStats: 318000 }
        }
    }
};

// Party system for 4 players
const MAX_PARTY_SIZE = 4;

// Make MAX_PARTY_SIZE available globally
if (typeof window !== 'undefined') {
    window.MAX_PARTY_SIZE = MAX_PARTY_SIZE;
}

// Boss rewards
const BOSS_REWARDS = {
    // Medium difficulty rewards: Tier4 weapon with 3 abilities and max multiplier
    medium: {
        tier4Abilities: 3,
        multiplier: 3.0,
        weaponName: "伝説の討伐武器"
    },
    // Hard difficulty rewards: Boss skill as custom skill
    hard: {
        customSkill: true,
        skillName: "伝説のボススキル"
    }
};

// Get boss data by ID
function getBossData(bossId) {
    return BOSS_DATA[bossId] || null;
}

// Get boss difficulty stats
function getBossDifficultyStats(bossId, difficulty) {
    const boss = getBossData(bossId);
    if (!boss || !boss.difficulties[difficulty]) return null;
    return boss.difficulties[difficulty];
}

// Get all boss IDs
function getAllBossIds() {
    const ids = Object.keys(BOSS_DATA);
    console.log('All boss IDs:', ids);
    return ids;
}

// Check if player has defeated a boss at specific difficulty
function hasDefeatedBoss(player, bossId, difficulty) {
    if (!player.bossDefeats) return false;
    const defeats = player.bossDefeats[bossId];
    if (!defeats) return false;
    return defeats.includes(difficulty);
}

// Mark boss as defeated
function markBossDefeated(player, bossId, difficulty) {
    if (!player.bossDefeats) {
        player.bossDefeats = {};
    }
    if (!player.bossDefeats[bossId]) {
        player.bossDefeats[bossId] = [];
    }
    if (!player.bossDefeats[bossId].includes(difficulty)) {
        player.bossDefeats[bossId].push(difficulty);
    }
    return player;
}

// Get boss skill as custom skill for hard difficulty reward
function getBossSkillAsCustomSkill(bossId) {
    const boss = getBossData(bossId);
    if (!boss || !boss.skills || boss.skills.length === 0) return null;
    
    // Return the most powerful skill (last one in array)
    const bossSkill = boss.skills[boss.skills.length - 1];
    
    // RPG-style skill names
    const skillPrefixes = {
        boss1: "アルカディアの",
        boss2: "ベルセルクの",
        boss3: "クロノスの",
        boss4: "メルクリウスの",
        boss5: "カオスの",
        boss6: "デス・ドレッドの",
        boss7: "オムニサイエンスの"
    };
    
    const prefix = skillPrefixes[bossId] || "";
    
    return {
        id: `boss_skill_${bossId}`,
        name: bossSkill.name,
        description: bossSkill.description,
        effect: bossSkill.effect,
        strength: 100, // Boss skills are very powerful
        createdAt: Date.now(),
        isBossSkill: true,
        bossSource: bossId
    };
}

// Generate Tier4 weapon for medium difficulty reward
function generateBossWeapon(bossId, difficulty) {
    const boss = getBossData(bossId);
    if (!boss) return null;
    
    const reward = BOSS_REWARDS.medium;
    
    // RPG-style weapon names based on boss
    const weaponNames = {
        boss1: "アルカディアの魔導書",
        boss2: "ベルセルクの破壊剣",
        boss3: "クロノスの時空刃",
        boss4: "メルクリウスの賢者杖",
        boss5: "カオスの混沌剣",
        boss6: "デス・ドレッドの断罪刀",
        boss7: "オムニサイエンスの至高の杖"
    };
    
    const ultimateNames = {
        boss1: "アルカディア撃破の証",
        boss2: "ベルセルク撃破の証",
        boss3: "クロノス撃破の証",
        boss4: "メルクリウス撃破の証",
        boss5: "カオス撃破の証",
        boss6: "デス・ドレッド撃破の証",
        boss7: "オムニサイエンス撃破の証"
    };
    
    // Will use TIER4_ABILITIES from weapons.js when this function is called
    // For now, return a structure that will be completed by the caller
    return {
        id: `boss_weapon_${bossId}_${Date.now()}`,
        name: weaponNames[bossId] || `${boss.name}の${reward.weaponName}`,
        type: "鎌", // Best weapon type
        multiplier: reward.multiplier,
        isOriginal: true,
        tier4AbilityCount: reward.tier4Abilities,
        ultimateName: ultimateNames[bossId] || `${boss.name}撃破の証`,
        bossDefeated: bossId,
        difficultyDefeated: difficulty
    };
}