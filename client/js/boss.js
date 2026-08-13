// Boss Battle System
// 7 Bosses with 3 difficulty levels each

const BOSS_DATA = {
    boss1: {
        name: "学習の守護者",
        description: "知識の守護者。強力な攻撃魔法を操る。",
        skills: [
            { name: "知識の光", description: "光の魔法で敵に大ダメージを与える", effect: { damageMultiplier: 2.0, sureHit: true } },
            { name: "守護の盾", description: "強力な防御シールドを展開する", effect: { shield: 100, damageReduction: 0.5 } },
            { name: "知恵の波動", description: "全ステータスを一時的に強化する", effect: { damageMultiplier: 1.5, damageReduction: 0.3 } }
        ],
        difficulties: {
            easy: { hp: 5000, atk: 100, def: 100, speed: 100, totalStats: 5300 },
            medium: { hp: 10000, atk: 200, def: 200, speed: 200, totalStats: 10600 },
            hard: { hp: 20000, atk: 400, def: 400, speed: 400, totalStats: 21200 }
        }
    },
    boss2: {
        name: "試練の管理者",
        description: "試練を管理する管理者。物理攻撃が強力。",
        skills: [
            { name: "鉄の拳", description: "物理攻撃で敵を粉砕する", effect: { damageMultiplier: 2.5, defenseIgnore: true } },
            { name: "不屈の精神", description: "防御力を大幅に上昇させる", effect: { damageReduction: 0.7, selfDefDebuff: -20 } },
            { name: "試練の咆哮", description: "敵の攻撃力を下げる", effect: { enemyAtkDebuff: 0.3 } }
        ],
        difficulties: {
            easy: { hp: 6000, atk: 120, def: 120, speed: 120, totalStats: 6360 },
            medium: { hp: 12000, atk: 240, def: 240, speed: 240, totalStats: 12720 },
            hard: { hp: 24000, atk: 480, def: 480, speed: 480, totalStats: 25440 }
        }
    },
    boss3: {
        name: "時間の支配者",
        description: "時間を操る支配者。速度と回避が異常に高い。",
        skills: [
            { name: "時間停止", description: "敵の行動を1ターン封じる", effect: { skipNextTurn: true } },
            { name: "加速", description: "自分の速度を大幅に上昇させる", effect: { dodgeChance: 0.5, speedBoost: 50 } },
            { name: "時空斬り", description: "時空を裂く一撃を放つ", effect: { damageMultiplier: 3.0, sureHit: true, multiHit: 2 } }
        ],
        difficulties: {
            easy: { hp: 7000, atk: 140, def: 140, speed: 200, totalStats: 7480 },
            medium: { hp: 14000, atk: 280, def: 280, speed: 400, totalStats: 14960 },
            hard: { hp: 28000, atk: 560, def: 560, speed: 800, totalStats: 29920 }
        }
    },
    boss4: {
        name: "知恵の賢者",
        description: "古代の知恵を持つ賢者。魔法防御が高い。",
        skills: [
            { name: "古代魔法", description: "古代の強力な魔法を放つ", effect: { damageMultiplier: 2.2, heal: 50 } },
            { name: "魔法障壁", description: "魔法ダメージを大幅に軽減する", effect: { damageReduction: 0.8, shield: 150 } },
            { name: "賢者の叡智", description: "回復と強化を同時に行う", effect: { heal: 100, damageMultiplier: 1.3 } }
        ],
        difficulties: {
            easy: { hp: 8000, atk: 160, def: 160, speed: 160, totalStats: 8480 },
            medium: { hp: 16000, atk: 320, def: 320, speed: 320, totalStats: 16960 },
            hard: { hp: 32000, atk: 640, def: 640, speed: 640, totalStats: 33920 }
        }
    },
    boss5: {
        name: "混沌の化身",
        description: "混沌の化身。予測不能な攻撃を行う。",
        skills: [
            { name: "混沌の渦", description: "混沌の渦巻きで敵を巻き込む", effect: { damageMultiplier: 2.0, multiHit: 3, poison: true } },
            { name: "狂乱の舞", description: "ランダムな効果を発動する", effect: { damageMultiplier: 1.8, dodgeChance: 0.3, counter: true } },
            { name: "破壊の宴", description: "全体に大ダメージを与える", effect: { damageMultiplier: 2.5, areaDamage: true } }
        ],
        difficulties: {
            easy: { hp: 9000, atk: 180, def: 180, speed: 180, totalStats: 9540 },
            medium: { hp: 18000, atk: 360, def: 360, speed: 360, totalStats: 19080 },
            hard: { hp: 36000, atk: 720, def: 720, speed: 720, totalStats: 38160 }
        }
    },
    boss6: {
        name: "絶望の魔王",
        description: "絶望を支配する魔王。全ステータスが高い。",
        skills: [
            { name: "絶望の視線", description: "敵に強力なデバフを与える", effect: { enemyAtkDebuff: 0.4, enemyDefDebuff: 0.4, enemyAccuracyDebuff: 0.4 } },
            { name: "魔王の鉄槌", description: "絶対的な力で敵を粉砕する", effect: { damageMultiplier: 3.0, defenseIgnore: true, sureHit: true } },
            { name: "絶望の再臨", description: "戦闘不能になっても復活する", effect: { revive: true, damageMultiplier: 2.0 } }
        ],
        difficulties: {
            easy: { hp: 10000, atk: 200, def: 200, speed: 200, totalStats: 10600 },
            medium: { hp: 20000, atk: 400, def: 400, speed: 400, totalStats: 21200 },
            hard: { hp: 40000, atk: 800, def: 800, speed: 800, totalStats: 42400 }
        }
    },
    boss7: {
        name: "学問の頂点",
        description: "全ての学問の頂点に立つ存在。最強のボス。",
        skills: [
            { name: "究極の知識", description: "全てのステータスを最大化する", effect: { damageMultiplier: 2.0, damageReduction: 0.5, dodgeChance: 0.3, critChance: 0.5 } },
            { name: "学問の極意", description: "複数の強力な効果を同時に発動", effect: { damageMultiplier: 2.5, multiHit: 2, sureHit: true, heal: 100 } },
            { name: "頂点の断末魔", description: "最強の一撃を放つ", effect: { damageMultiplier: 4.0, defenseIgnore: true, sureHit: true, critChance: 1.0 } }
        ],
        difficulties: {
            easy: { hp: 15000, atk: 300, def: 300, speed: 300, totalStats: 15900 },
            medium: { hp: 30000, atk: 600, def: 600, speed: 600, totalStats: 31800 },
            hard: { hp: 60000, atk: 1200, def: 1200, speed: 1200, totalStats: 63600 }
        }
    }
};

// Boss rewards
const BOSS_REWARDS = {
    // Medium difficulty rewards: Tier4 weapon with 3 abilities and max multiplier
    medium: {
        tier4Abilities: 3,
        multiplier: 3.0,
        weaponName: "討伐武器"
    },
    // Hard difficulty rewards: Boss skill as custom skill
    hard: {
        customSkill: true,
        skillName: "ボススキル"
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
    
    return {
        id: `boss_skill_${bossId}`,
        name: bossSkill.name,
        description: bossSkill.description,
        effect: bossSkill.effect,
        strength: 100, // Boss skills are very powerful
        createdAt: Date.now()
    };
}

// Generate Tier4 weapon for medium difficulty reward
function generateBossWeapon(bossId, difficulty) {
    const boss = getBossData(bossId);
    if (!boss) return null;
    
    const reward = BOSS_REWARDS.medium;
    
    // Will use TIER4_ABILITIES from weapons.js when this function is called
    // For now, return a structure that will be completed by the caller
    return {
        id: `boss_weapon_${bossId}_${Date.now()}`,
        name: `${boss.name}の${reward.weaponName}`,
        type: "鎌", // Best weapon type
        multiplier: reward.multiplier,
        isOriginal: true,
        tier4AbilityCount: reward.tier4Abilities,
        ultimateName: `${boss.name}撃破の証`,
        bossDefeated: bossId,
        difficultyDefeated: difficulty
    };
}