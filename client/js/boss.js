// ボス武器の基礎倍率（討伐直後の状態）。ここから限界突破で上限を伸ばして「強化」で近づけていく。
const BOSS_WEAPON_BASE_MULTIPLIER = 2.0;
// 限界突破1回あたりの上限倍率の増加量
const BOSS_WEAPON_LIMIT_BREAK_INCREMENT = 0.5;
// 限界突破できる最大回数
const BOSS_WEAPON_MAX_LIMIT_BREAK = 4;

/**
 * ボスIDから、その武器の限界突破素材のIDを生成する。
 * @param {string} bossId
 * @returns {string}
 */
function getBossLimitBreakMaterialId(bossId) {
    return `${bossId}_limit_break_material`;
}

/**
 * 限界突破素材の表示名を生成する。
 * @param {string} bossName
 * @returns {string}
 */
function getBossLimitBreakMaterialName(bossName) {
    return `${bossName}の魂の欠片`;
}

/**
 * プレイヤーが指定したボスをモチーフにした武器を既に所持しているか判定する。
 * @param {object} player
 * @param {string} bossId
 * @returns {boolean}
 */
function playerOwnsBossWeapon(player, bossId) {
    return (player.weapons || []).some(w => w.sourceBossId === bossId || w.bossId === bossId);
}

/**
 * Adds a specified amount of a material to the player's inventory.
 * @param {object} player - The player object.
 * @param {string} materialId - The unique ID of the material.
 * @param {string} materialName - The display name of the material.
 * @param {number} count - The number of materials to add.
 * @returns {object} The updated player object.
 */
function addMaterialToPlayer(player, materialId, materialName, count) {
    if (!player.materials) {
        player.materials = [];
    }
    let material = player.materials.find(m => m.id === materialId);
    if (material) {
        material.count = (material.count || 0) + count;
    } else {
        player.materials.push({ id: materialId, name: materialName, count: count });
    }
    return player;
}

/**
 * Creates a custom skill from a boss's skill.
 * @param {object} bossData - The full data object for the boss.
 * @param {string} skillName - The name of the skill to get.
 * @returns {object|null} A custom skill object or null.
 */
function getBossSkillAsCustomSkill(bossData, skillName) {
    if (!bossData || !bossData.skills || !skillName) return null;

    const bossSkill = bossData.skills.find(s => s.name === skillName);
    if (!bossSkill) {
        console.error(`Skill '${skillName}' not found on boss '${bossData.name}'`);
        return null;
    }

    // The skill effect must be a valid object to function correctly.
    if (!bossSkill.effect || typeof bossSkill.effect !== 'object') {
        console.error(`Skill '${skillName}' has an invalid or missing effect object.`);
        return null;
    }

    return {
        id: `boss_skill_${bossData.id}_${Date.now()}`,
        name: `[秘技] ${bossSkill.name}`,
        description: bossSkill.description,
        effect: bossSkill.effect, // Copy the effect object directly
        strength: 'tier15', // Boss skills are powerful
        createdAt: Date.now(),
        type: 'active'
    };
}
/**
 * Applies rewards for defeating a boss.
 * This function now returns the updated player object and saves rewards to localStorage
 * for the result screen to display.
 * @param {object} player - The player object.
 * @param {object} boss - The defeated boss object from the battle (with rewards info).
 * @returns {object} The updated player object.
 */
function applyBossRewards(player, boss) {
    if (!boss || !boss.id || !boss.difficulty) {
        console.error("Invalid boss data for rewards", boss);
        return player;
    }

    // The 'boss' object from the battle now contains all necessary data (skills, rewards).
    if (!boss.rewards) {
        console.log(`Boss ${boss.id} has no rewards defined in its battle data. Skipping.`);
        return player;
    }

    const difficulty = boss.difficulty;
    const bossRewardsInfo = boss.rewards;
    let newPlayer = { ...player };
    let rewardsForDisplay = {};

    // 1. Weapon Drop: On 'medium' (Normal) difficulty, if player doesn't have the weapon yet.
    const playerDoesNotHaveWeapon = !playerOwnsBossWeapon(player, boss.id);
    if (difficulty === 'medium' && playerDoesNotHaveWeapon) {
        const weaponName = bossRewardsInfo.weaponName || `${boss.name}の武器`;
        const weapon = generateBossWeapon(boss, weaponName);
        if (weapon) {
            newPlayer = addWeaponToPlayer(newPlayer, weapon);
            rewardsForDisplay.bossWeapon = weapon;
        }
    }
    
    // 2. Skill Drop: On 'hard' difficulty, if player doesn't have the skill yet.
    const skillName = bossRewardsInfo.skillName;
    if (difficulty === 'hard' && skillName) {
        const expectedSkillName = `[秘技] ${skillName}`;
        const playerDoesNotHaveSkill = !(player.customSkills || []).some(s => s.name === expectedSkillName);
        if (playerDoesNotHaveSkill) {
            const skill = getBossSkillAsCustomSkill(boss, skillName);
            if (skill) {
                if (!newPlayer.customSkills) newPlayer.customSkills = [];
                newPlayer.customSkills.push(skill);
                rewardsForDisplay.bossSkill = skill; // For result screen display
            }
        }
    }

    // 3. Limit Break Material Drop: On 'medium' (Normal) or 'hard' difficulty.
    if ((difficulty === 'medium' || difficulty === 'hard')) {
        const material = bossRewardsInfo.material;
        if (material && material.id && material.name) {
            const amount = (difficulty === 'hard') ? 2 : 1;
            newPlayer = addMaterialToPlayer(newPlayer, material.id, material.name, amount);
            rewardsForDisplay.limitBreakMaterial = { name: material.name, count: amount };
        }
    }

    // Save rewards to localStorage for result.js to display.
    if (Object.keys(rewardsForDisplay).length > 0) {
        const battleResult = JSON.parse(localStorage.getItem('battleResultData') || '{}');
        battleResult.rewards = { ...battleResult.rewards, ...rewardsForDisplay };
        localStorage.setItem('battleResultData', JSON.stringify(battleResult));
    }

    return newPlayer;
}
/**
 * Checks if a player has already defeated a boss at a specific difficulty.
 * @param {object} player - The player object.
 * @param {string} bossId - The ID of the boss.
 * @param {string} difficulty - The difficulty ('easy', 'medium', 'hard').
 * @returns {boolean}
 */
function hasDefeatedBoss(player, bossId, difficulty) {
    if (!player.bossDefeats) return false;
    const defeats = player.bossDefeats[bossId];
    if (!defeats) return false;
    return defeats.includes(difficulty);
}

/**
 * Marks a boss as defeated for a player at a specific difficulty.
 * @param {object} player - The player object.
 * @param {string} bossId - The ID of the boss.
 * @param {string} difficulty - The difficulty.
 * @returns {object} The updated player object.
 */
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

/**
 * Generates a boss weapon, ready for the limit break system.
 * @param {object} bossData - The full data object for the boss.
 * @param {string} weaponName - The name for the new weapon.
 * @returns {object|null} A weapon object or null.
 */
function generateBossWeapon(bossData, weaponName) {
    if (!bossData || !weaponName) return null;

    // Use a weapon type from rewards, or a random one as fallback
    const weaponTypes = (typeof WEAPON_TYPES !== 'undefined') ? Object.keys(WEAPON_TYPES) : ["大剣"];
    const weaponType = bossData.rewards?.weaponType || weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

    // Get all available unique abilities from weapons.js
    const allAbilities = (typeof ORB_UNIQUE_ABILITIES !== 'undefined') ? Object.values(ORB_UNIQUE_ABILITIES) : [];
    let selectedAbilities = [];
    if (allAbilities.length > 0) {
        // Shuffle and pick 3
        const shuffled = allAbilities.sort(() => 0.5 - Math.random());
        selectedAbilities = shuffled.slice(0, 3);
    }

    // Create a boss weapon compatible with the limit break system
    const weapon = {
        id: `boss_weapon_${bossData.id}_${Date.now()}`,
        name: weaponName,
        type: weaponType,
        isOriginal: true, // Allows upgrading and limit breaking
        isBossWeapon: true, // Special flag for boss weapons
        bossId: bossData.id, // Link to the boss for material matching
        multiplier: 2.0,  // Set multiplier to 2.0 as requested
        maxMultiplier: 2.0,  // Initial max multiplier, can be increased by limit breaking
        limitBreakCount: 0,
        upgradeCount: 999, // Mark as fully upgraded
        statBonuses: bossData.rewards?.statBonuses || {}, // Use defined bonuses or empty
        uniqueAbilities: selectedAbilities, // Set 3 random unique abilities
        ultimateName: `${bossData.name}の魂`,
    };

    return weapon;
}
