const fs = require('fs');
const path = require('path');

const bossDataPath = path.join(__dirname, '..', 'data', 'bosses.json');

let bosses = [];

try {
    const bossData = fs.readFileSync(bossDataPath, 'utf8');
    bosses = JSON.parse(bossData);
    console.log('Boss data loaded successfully.');
} catch (error) {
    console.error('Failed to load boss data:', error);
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
    bossInstance.difficulty = difficulty; // 難易度をインスタンスに保持
    bossInstance.skills = bossTemplate.skills; // Ensure skills are included
    
    // Add rewards data from the main boss template so the client has it
    bossInstance.rewards = bossTemplate.rewards || null;

    // Remove difficulty structure as it's not needed in battle
    delete bossInstance.difficulties;

    return bossInstance;
}


module.exports = {
    getAllBosses,
    getBossById,
    createBossForBattle,
};
