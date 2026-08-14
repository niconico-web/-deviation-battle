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
 * Applies rewards for defeating a boss.
 * This function now returns the updated player object and saves rewards to sessionStorage
 * for the result screen to display.
 * @param {object} player - The player object.
 * @param {object} boss - The defeated boss object from the battle.
 * @returns {object} The updated player object.
 */
function applyBossRewards(player, boss) {
    if (!boss || !boss.id || !boss.difficulty) {
        console.error("Invalid boss data for rewards", boss);
        return player;
    }

    // Ensure window.bosses is populated
    if (!window.bosses) {
        const bossesData = localStorage.getItem('bosses');
        if (bossesData) {
            window.bosses = JSON.parse(bossesData);
        } else {
            console.error("Boss data not found. Cannot process boss rewards.");
            return player;
        }
    }

    const fullBossData = window.bosses.find(b => b.id === boss.id);
    // The old code crashed because `fullBossData.drops` was undefined.
    // The new logic checks for `fullBossData.rewards` instead.
    if (!fullBossData || !fullBossData.rewards) {
        console.log(`Boss ${boss.id} has no rewards defined. Skipping.`);
        return player;
    }

    const difficulty = boss.difficulty;
    const bossRewardsInfo = fullBossData.rewards;
    let newPlayer = { ...player };
    let rewardsForDisplay = {};

    // 1. Weapon Drop: On 'medium' (Normal) difficulty, first clear only.
    if (difficulty === 'medium' && !hasDefeatedBoss(player, boss.id, 'medium')) {
        const weaponName = bossRewardsInfo.weaponName || `${fullBossData.name}の武器`;
        const weapon = generateBossWeapon(fullBossData, weaponName);
        if (weapon) {
            // Assume addWeaponToPlayer is a global function.
            newPlayer = addWeaponToPlayer(newPlayer, weapon);
            rewardsForDisplay.bossWeapon = weapon;
            // Mark this difficulty as cleared to prevent getting the weapon again.
            newPlayer = markBossDefeated(newPlayer, boss.id, 'medium');
        }
    }

    // 2. Limit Break Material Drop: On 'medium' (Normal) or 'hard' difficulty.
    if ((difficulty === 'medium' || difficulty === 'hard')) {
        const material = bossRewardsInfo.material;
        if (material && material.id && material.name) {
            const amount = (difficulty === 'hard') ? 2 : 1;
            newPlayer = addMaterialToPlayer(newPlayer, material.id, material.name, amount);
            rewardsForDisplay.limitBreakMaterial = { name: material.name, count: amount };
        }
    }

    // Save rewards to sessionStorage for result.js to display.
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

    // Use a random weapon type if not specified in boss data
    const weaponTypes = (typeof WEAPON_TYPES !== 'undefined') ? Object.keys(WEAPON_TYPES) : ["大剣"];
    const weaponType = bossData.rewards?.weaponType || weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

    // Create a boss weapon compatible with the limit break system
    const weapon = {
        id: `boss_weapon_${bossData.id}_${Date.now()}`,
        name: weaponName,
        type: weaponType,
        isOriginal: true, // Allows upgrading
        isBossWeapon: true, // Special flag for boss weapons
        bossId: bossData.id, // Link to the boss for material matching
        multiplier: 1.6, // A strong base multiplier
        maxMultiplier: 2.0,  // Initial max multiplier, can be increased by limit breaking
        limitBreakCount: 0,
        upgradeCount: 0,
        statBonuses: bossData.rewards?.statBonuses || {}, // Use defined bonuses or empty
        uniqueAbilities: bossData.rewards?.uniqueAbilities || [], // Use defined abilities or empty
        ultimateName: `${bossData.name}の魂`,
    };

    return weapon;
}