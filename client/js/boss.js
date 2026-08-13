/**
 * Applies rewards for defeating a boss.
 * @param {object} player - The player object.
 * @param {object} boss - The defeated boss object from the battle.
 * @returns {object} The updated player object.
 */
function applyBossRewards(player, boss) {
    if (!boss || !boss.id || !boss.difficulty) {
        console.error("Invalid boss data for rewards", boss);
        return player;
    }

    const bossId = boss.id;
    const difficulty = boss.difficulty;

    // Check if reward was already claimed
    if (hasDefeatedBoss(player, bossId, difficulty)) {
        console.log(`Reward for ${bossId} (${difficulty}) already claimed.`);
        return player;
    }

    let newPlayer = { ...player };
    let rewardMessage = "";

    if (difficulty === 'medium') {
        const weapon = generateBossWeapon(boss);
        if (weapon) {
            newPlayer = addWeaponToPlayer(newPlayer, weapon);
            rewardMessage = `討伐報酬として、ユニーク武器「${weapon.name}」を獲得した！`;
        }
    } else if (difficulty === 'hard') {
        const skill = getBossSkillAsCustomSkill(boss);
        if (skill) {
            if (!newPlayer.customSkills) {
                newPlayer.customSkills = [];
            }
            newPlayer.customSkills.push(skill);
            rewardMessage = `討伐報酬として、ボススキル「${skill.name}」を習得した！`;
        }
    }

    if (rewardMessage) {
        // Use a timeout to show the message after the result screen has settled.
        setTimeout(() => alert(rewardMessage), 500);
        newPlayer = markBossDefeated(newPlayer, bossId, difficulty);
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
 * Creates a custom skill from a boss's skill for the 'hard' difficulty reward.
 * @param {object} boss - The defeated boss object.
 * @returns {object|null} A custom skill object or null.
 */
function getBossSkillAsCustomSkill(boss) {
    if (!boss || !boss.skills || boss.skills.length === 0) return null;

    // Use the last (presumably most powerful) skill of the boss
    const bossSkill = boss.skills[boss.skills.length - 1];

    return {
        id: `boss_skill_${boss.id}_${Date.now()}`,
        name: `[秘技] ${bossSkill.name}`,
        description: bossSkill.description,
        effect: bossSkill.effect,
        strength: 'tier15', // Boss skills are very powerful
        createdAt: Date.now(),
        type: 'active'
    };
}

/**
 * Generates a fully-upgraded weapon with 3 random unique abilities for the 'medium' difficulty reward.
 * @param {object} boss - The defeated boss object.
 * @returns {object|null} A weapon object or null.
 */
function generateBossWeapon(boss) {
    if (!boss) return null;

    // Get all available unique abilities from weapons.js
    const allAbilities = (typeof ORB_UNIQUE_ABILITIES !== 'undefined') ? Object.values(ORB_UNIQUE_ABILITIES) : [];
    if (allAbilities.length === 0) {
        console.error("ORB_UNIQUE_ABILITIES not found or empty. Cannot generate boss weapon.");
        return null;
    }
    // Shuffle and pick 3
    const shuffled = allAbilities.sort(() => 0.5 - Math.random());
    const selectedAbilities = shuffled.slice(0, 3);

    // Randomly select a weapon type
    const weaponTypes = (typeof WEAPON_TYPES !== 'undefined') ? Object.keys(WEAPON_TYPES) : ["剣"];
    const randomType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

    // Give a significant boost to two random stats
    const statBonuses = {};
    const statsToBoost = ["atk", "def", "speed", "maxHp"];
    const shuffledStats = statsToBoost.sort(() => 0.5 - Math.random());
    statBonuses[shuffledStats[0]] = 0.25; // +25%
    statBonuses[shuffledStats[1]] = 0.25; // +25%

    // Create a powerful original weapon
    const weapon = {
        id: `boss_weapon_${boss.id}_${Date.now()}`,
        name: `${boss.name}の魂魄`,
        type: randomType,
        isOriginal: true,
        multiplier: 3.0, // Fully upgraded state as per request
        statBonuses: statBonuses,
        upgradeCount: 999, // Indicates max upgrade
        uniqueAbilities: selectedAbilities,
        ultimateName: `${boss.name}の魂`,
    };

    return weapon;
}