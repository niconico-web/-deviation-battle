const fs = require('fs');
const path = require('path');

const bossDataPath = path.join(__dirname, '..', 'data', 'bosses.json');
const bossRewardsPath = path.join(__dirname, '..', 'data', 'boss_rewards.json');

let bosses = [];
let rewards = {};

try {
    const bossData = fs.readFileSync(bossDataPath, 'utf8');
    bosses = JSON.parse(bossData);
    console.log('Boss data loaded successfully.');
} catch (error) {
    console.error('Failed to load boss data:', error);
}

try {
    const rewardsData = fs.readFileSync(bossRewardsPath, 'utf8');
    rewards = JSON.parse(rewardsData);
    console.log('Boss rewards loaded successfully.');
} catch (error) {
    console.error('Failed to load boss rewards:', error);
}

function getAllBosses() {
    // Return a simplified version for the client (name, description, id)
    return bosses.map(boss => ({
        id: boss.id,
        name: boss.name,
        description: boss.description
    }));
}

function getBossById(id) {
    return bosses.find(boss => boss.id === id);
}

function getBossRewards(bossId) {
    return rewards[bossId] || null;
}

/**
 * Creates a boss instance for battle based on ID and difficulty.
 * @param {string} bossId The ID of the boss.
 * @param {string} difficulty The selected difficulty ('easy', 'medium', 'hard').
 * @returns {object|null} A boss object ready for battle or null if not found.
 */
function createBossForBattle(bossId, difficulty) {
    const bossTemplate = getBossById(bossId);
    if (!bossTemplate) {
        return null;
    }

    const difficultyStats = bossTemplate.difficulties[difficulty];
    if (!difficultyStats) {
        return null;
    }

    // Create a deep copy to avoid modifying the template
    const bossInstance = JSON.parse(JSON.stringify(bossTemplate));

    // Apply difficulty stats
    bossInstance.hp = difficultyStats.hp;
    bossInstance.maxHp = difficultyStats.hp;
    bossInstance.atk = difficultyStats.atk;
    bossInstance.def = difficultyStats.def;
    bossInstance.speed = difficultyStats.speed;
    
    // Add battle-specific properties
    bossInstance.isBoss = true;
    bossInstance.difficulty = difficulty; // ????x???C???X?^???X????
    bossInstance.skills = bossTemplate.skills; // Ensure skills are included

    // Add rewards data to the instance so the client has it
    bossInstance.rewards = getBossRewards(bossId);

    // Remove difficulty structure as it's not needed in battle
    delete bossInstance.difficulties;

    return bossInstance;
}


module.exports = {
    getAllBosses,
    getBossById,
    createBossForBattle,
    getBossRewards,
};
