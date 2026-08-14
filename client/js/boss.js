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

    // Ensure window.bosses is populated, if not, load from localStorage
    if (!window.bosses) {
        const bossesData = localStorage.getItem('bosses');
        if (bossesData) {
            window.bosses = JSON.parse(bossesData);
        } else {
            console.error("Boss data not found. Cannot process boss rewards.");
            return player;
        }
    }
    // Find the full boss data from bosses.json to get drop info
    const fullBossData = window.bosses.find(b => b.id === boss.id);
    if (!fullBossData) {
        console.error("Full boss data not found for ID:", boss.id);
        return player;
    }
    const difficulty = boss.difficulty;

    // Check if reward was already claimed
    if (hasDefeatedBoss(player, boss.id, difficulty)) {
        console.log(`Reward for ${boss.id} (${difficulty}) already claimed.`);
        return player;
    }

    let newPlayer = { ...player };
    let rewardMessage = "";

    // Process drops based on the difficulty
    fullBossData.drops.forEach(drop => {
        if (drop.difficulty.includes(difficulty)) {
            if (drop.type === 'weapon') {
                const weapon = generateBossWeapon(boss, drop.name);
                if (weapon) {
                    newPlayer = addWeaponToPlayer(newPlayer, weapon);
                    rewardMessage += `討伐報酬として、ユニーク武器「${weapon.name}」を獲得した！\n`;
                }
            } else if (drop.type === 'skill') {
                const skill = getBossSkillAsCustomSkill(fullBossData, drop.name);
                if (skill) {
                    if (!newPlayer.customSkills) newPlayer.customSkills = [];
                    newPlayer.customSkills.push(skill);
                    rewardMessage += `討伐報酬として、ボススキル「${skill.name}」を習得した！\n`;
                }
            }
        }
    });

    if (rewardMessage.trim()) {
        // Use a timeout to show the message after the result screen has settled.
        setTimeout(() => alert(rewardMessage), 500);
        newPlayer = markBossDefeated(newPlayer, boss.id, difficulty);
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
function getBossSkillAsCustomSkill(boss, skillName) {
    if (!boss || !boss.skills || boss.skills.length === 0 || !skillName) return null;

    // Find the specific skill from the boss's skill list
    const bossSkill = boss.skills.find(s => s.name === skillName);

    if (!bossSkill) {
        console.error(`Skill '${skillName}' not found on boss '${boss.name}'`);
        return null;
    }

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
function generateBossWeapon(boss, weaponName) {
    if (!boss || !weaponName) return null;

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
        name: weaponName,
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