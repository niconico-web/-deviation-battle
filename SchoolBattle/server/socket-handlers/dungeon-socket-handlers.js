// ============================================
// Dungeon Socket.io Handlers
// dungeon-socket-handlers.js
// ============================================

const DungeonEngine = require("../managers/DungeonEngine");

const dungeonManager = new DungeonEngine.DungeonManager();

// ===================================
// ダンジョンソケットハンドラー登録
// ===================================
// 依頼により全面リニューアル：難易度を廃止し、無限に続く1本のダンジョンに変更。
// 実際のモンスター・ボスの抽選やバトル処理はクライアント側（dungeon.js・battle.js、
// 既存のボット戦と同じ仕組み）で行うため、ここでは階層の進行状況・報酬・宝箱抽選のみを扱う。
// なお、以前ここにあった dungeon:getQuestion / dungeon:answerQuestion / dungeon:executeCommand は
// 実際には使われていない仮実装（"2+2=4"固定の問題、{atk:20,speed:50}固定のダミーステータスなど）で、
// かつ廃止した Dungeon.getCurrentFloorMonsters() に依存していたため、今回まとめて削除した。
function registerDungeonHandlers(io, socket) {
    console.log(`[Dungeon] Socket handlers registered for ${socket.id}`);

    // ===================================
    // ダンジョン開始
    // ===================================
    socket.on("dungeon:start", (data, callback) => {
        try {
            const playerId = (data && data.playerId) || socket.id;
            const startFloor = (data && data.startFloor) || 1;

            console.log(`[Dungeon] Player ${playerId} starting dungeon - startFloor: ${startFloor}`);

            const result = dungeonManager.startDungeon(playerId, startFloor);
            if (result.error) {
                return callback(result);
            }

            callback({
                success: true,
                dungeon: result.dungeon
            });

        } catch (error) {
            console.error("[Dungeon] Error starting dungeon:", error);
            callback({ error: "ダンジョン開始に失敗しました" });
        }
    });

    // ===================================
    // 階クリア
    // ===================================
    socket.on("dungeon:floorCleared", (data, callback) => {
        try {
            const playerId = (data && data.playerId) || socket.id;

            // ダンジョンチェック
            const dungeon = dungeonManager.getDungeon(playerId);
            if (!dungeon) {
                return callback({ error: "アクティブなダンジョンがありません" });
            }

            // 階をクリア（無限に続くため、常に「次の階へ」を返す）
            const result = dungeonManager.clearFloor(playerId, data.battleReward || {});
            if (result.error) {
                return callback(result);
            }

            callback({
                success: true,
                floorReward: result.floorReward,
                dungeon: result.dungeonState,
                nextFloor: result.nextFloor
            });

        } catch (error) {
            console.error("[Dungeon] Error clearing floor:", error);
            callback({ error: "階クリア処理に失敗しました" });
        }
    });

    // ===================================
    // プレイヤー敗北
    // ===================================
    // 敗北時はそのダンジョンで得た報酬（コイン・経験値・アイテム）を全て失う。
    // サーバー側では何も加算せず破棄するだけなので、レスポンスにcoins/expは含めない。
    // 加えて、プレイヤーの所持金の半分を失わせる処理はクライアント側（result.js）で行う。
    socket.on("dungeon:playerDefeated", (data, callback) => {
        try {
            const playerId = (data && data.playerId) || socket.id;

            // ダンジョンチェック
            const dungeon = dungeonManager.getDungeon(playerId);
            if (!dungeon) {
                return callback({ error: "アクティブなダンジョンがありません" });
            }

            // 敗北処理
            const result = dungeonManager.playerDefeated(playerId);

            callback({
                success: true,
                defeated: true,
                floor: result.floor,
                checkpoint: result.checkpoint,
                message: result.message
            });

        } catch (error) {
            console.error("[Dungeon] Error on player defeat:", error);
            callback({ error: "敗北処理に失敗しました" });
        }
    });

    // ===================================
    // 途中撤退
    // ===================================
    // 階クリア後、次の階へ進まずにその時点で保有している報酬
    // （totalCoins/totalExp/rewards）を持ち帰ってダンジョンを終了する。
    socket.on("dungeon:retreat", (data, callback) => {
        try {
            const playerId = (data && data.playerId) || socket.id;

            const result = dungeonManager.retreatDungeon(playerId);
            if (result.error) {
                return callback(result);
            }

            callback({
                success: true,
                retreated: true,
                floor: result.floor,
                checkpoint: result.checkpoint,
                totalCoins: result.totalCoins,
                totalExp: result.totalExp,
                rewards: result.rewards
            });

        } catch (error) {
            console.error("[Dungeon] Error retreating from dungeon:", error);
            callback({ error: "撤退処理に失敗しました" });
        }
    });

    // ===================================
    // ダンジョン放棄
    // ===================================
    socket.on("dungeon:abandon", (data, callback) => {
        try {
            const playerId = (data && data.playerId) || socket.id;

            const result = dungeonManager.abandonDungeon(playerId);

            if (result.error) {
                return callback(result);
            }

            callback({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error("[Dungeon] Error abandoning dungeon:", error);
            callback({ error: "ダンジョン放棄に失敗しました" });
        }
    });

    // ===================================
    // ダンジョン情報取得
    // ===================================
    socket.on("dungeon:getInfo", (data, callback) => {
        try {
            const playerId = (data && data.playerId) || socket.id;

            const info = dungeonManager.getDungeonInfo(playerId);

            callback({
                success: true,
                ...info
            });

        } catch (error) {
            console.error("[Dungeon] Error getting dungeon info:", error);
            callback({ error: "情報取得に失敗しました" });
        }
    });

    // ===================================
    // 接続切断時
    // ===================================
    // 依頼の経緯：ダンジョンは index.html（開始）→ battle.html（戦闘）→
    // result.html（結果）と複数のページ遷移をまたいで進行するが、ページ遷移のたびに
    // Socket.IOの接続は一度切断されて新しい接続（新しいsocket.id）が張り直される。
    // ダンジョンのキーはsocket.idではなくプレイヤーの永続ID（data.playerId）にしているため、
    // 切断時に自動放棄する処理はここでは行わない（ダンジョンは明示的なdungeon:abandon、
    // またはクリア/撤退/敗北によって終了するまでサーバー上に残る）。
    socket.on("disconnect", () => {
        // 意図的に何もしない（上記コメント参照）
    });
}

// ===================================
// エクスポート
// ===================================
module.exports = {
    registerDungeonHandlers,
    dungeonManager
};
