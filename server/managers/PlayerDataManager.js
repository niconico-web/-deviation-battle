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
// 以前は savePlayer のたびに「全プレイヤー分を整形(indent付き)してwriteFileSyncで同期書き込み」していたため、
// 人が増えるほど1回の保存でサーバー全体が数十〜数百ミリ秒止まり、保存が重なると他の全員の操作が固まっていた。
// 今は ①メモリ上の更新だけ即時 ②ディスクへの書き込みは数秒ぶんまとめて1回 ③非同期＋一時ファイル経由で安全に書く、に変更。
const SAVE_DEBOUNCE_MS = 3000;     // 最後の更新からこの時間あとに書く
const SAVE_MAX_WAIT_MS = 15000;    // 更新し続けていても、最長でこの間隔では必ず書く
let saveTimer = null;
let firstDirtyAt = 0;
let writing = false;
let dirtyWhileWriting = false;

function scheduleSave() {
    const now = Date.now();
    if (!firstDirtyAt) firstDirtyAt = now;
    if (saveTimer) clearTimeout(saveTimer);
    const wait = Math.max(0, Math.min(SAVE_DEBOUNCE_MS, firstDirtyAt + SAVE_MAX_WAIT_MS - now));
    saveTimer = setTimeout(flushAsync, wait);
    if (saveTimer.unref) saveTimer.unref();   // 保存待ちだけでプロセスを生かし続けない（終了時は flushSync が書く）
}

function flushAsync() {
    saveTimer = null;
    if (writing) { dirtyWhileWriting = true; return; }
    writing = true; firstDirtyAt = 0; dirtyWhileWriting = false;
    let json;
    try { json = JSON.stringify(playerData); } catch (error) { console.error('[PlayerDataManager] Error serializing player data:', error); writing = false; return; }
    const tmp = DATA_FILE + '.tmp';
    fs.promises.writeFile(tmp, json, 'utf-8')
        .then(() => fs.promises.rename(tmp, DATA_FILE))   // 書き込み途中で落ちてもplayers.jsonが壊れない
        .catch((error) => { console.error('[PlayerDataManager] Error saving player data:', error); })
        .finally(() => { writing = false; if (dirtyWhileWriting) scheduleSave(); });
}

// 終了時など「今すぐ確実に」書きたいときだけ同期で書く
function flushSync() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!firstDirtyAt && !dirtyWhileWriting) return;
    try {
        const tmp = DATA_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(playerData), 'utf-8');
        fs.renameSync(tmp, DATA_FILE);
        firstDirtyAt = 0; dirtyWhileWriting = false;
    } catch (error) {
        console.error('[PlayerDataManager] Error saving player data (sync):', error);
    }
}
process.on('exit', flushSync);
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => { flushSync(); process.exit(0); }));

// プレイヤーデータを保存
function savePlayer(player) {
    if (!player || !player.id) {
        return false;
    }
    // 既存のデータをマージして、ギルド情報などが失われないようにする
    const existingData = playerData[player.id] || {};
    playerData[player.id] = { ...existingData, ...player };
    scheduleSave();
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
    flushSync,
    savePlayer,
    getPlayer,
    getAllPlayers
};
