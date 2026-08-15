const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'players.json');
const DATA_DIR = path.dirname(DATA_FILE);

let playerData = {};

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 起動時にファイルからデータを読み込む
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
        playerData = {}; // エラー時は空データで開始
    }
}

// ファイルにデータを書き込む
function saveDataToFile() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(playerData, null, 2), 'utf-8');
    } catch (error) {
        console.error('[PlayerDataManager] Error saving player data:', error);
    }
}

// プレイヤーデータを保存
function savePlayer(player) {
    if (!player || !player.id) {
        return false;
    }
    playerData[player.id] = player;
    saveDataToFile();
    return true;
}

// プレイヤーデータを取得
function getPlayer(playerId) {
    return playerData[playerId] || null;
}

// 全プレイヤーデータを取得（ランキング集計用）
function getAllPlayers() {
    return Object.values(playerData);
}

// 起動時ロード
loadDataFromFile();

module.exports = {
    savePlayer,
    getPlayer,
    getAllPlayers
};
