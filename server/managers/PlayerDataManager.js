const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'players.json');
const DATA_DIR = path.dirname(DATA_FILE);

let playerData = {};

// ƒf[ƒ^ƒfƒBƒŒƒNƒgƒŠ‚ª‘¶İ‚µ‚È‚¢ê‡‚Íì¬
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ‹N“®‚Éƒtƒ@ƒCƒ‹‚©‚çƒf[ƒ^‚ğ“Ç‚İ‚Ş
function loadDataFromFile() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
            playerData = JSON.parse(fileContent);
            console.log('[PlayerDataManager] Player data loaded from file.');
        } else {
            console.log('[PlayerDataManager] No player data file found, starting with empty data.');
        }
    } catch (error) {
        console.error('[PlayerDataManager] Error loading player data:', error);
        playerData = {}; // ƒGƒ‰[‚Í‹óƒf[ƒ^‚Å‰Šú‰»
    }
}

// ƒtƒ@ƒCƒ‹‚Éƒf[ƒ^‚ğ‘‚«‚Ş
function saveDataToFile() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(playerData, null, 2), 'utf-8');
    } catch (error) {
        console.error('[PlayerDataManager] Error saving player data:', error);
    }
}

// ƒvƒŒƒCƒ„[ƒf[ƒ^‚ğ•Û‘¶
function savePlayer(player) {
    if (!player || !player.id) {
        return false;
    }
    playerData[player.id] = player;
    saveDataToFile();
    return true;
}

// ƒvƒŒƒCƒ„[ƒf[ƒ^‚ğæ“¾
function getPlayer(playerId) {
    return playerData[playerId] || null;
}

// ‰Šúƒ[ƒh
loadDataFromFile();


// å…¨ãƒ—ãƒ¬ã‚¤ãƒ¤ãƒ¼ãƒ‡ãƒ¼ã‚¿ã‚’å–å¾—ï¼ˆãƒ©ãƒ³ã‚­ãƒ³ã‚°é›†è¨ˆç”¨ï¼‰
function getAllPlayers() {
    return Object.values(playerData);
}

module.exports = {
    savePlayer,
    getPlayer,
    getAllPlayers
};