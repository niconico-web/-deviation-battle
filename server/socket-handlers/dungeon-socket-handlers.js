// ============================================
// Dungeon Socket.io Handlers
// dungeon-socket-handlers.js
// ============================================

const DungeonEngine = require("../managers/DungeonEngine");
const BattleEngine = require("../managers/BattleEngine");
const MonstersData = require("../data/monsters-data");

const dungeonManager = new DungeonEngine.DungeonManager();

// ===================================
// ダンジョンソケットハンドラー登録
// ===================================
function registerDungeonHandlers(io, socket) {
    console.log(`[Dungeon] Socket handlers registered for ${socket.id}`);

    // ===================================
    // ダンジョン開始
    // ===================================
    socket.on("dungeon:start", (data, callback) => {
        try {
            const playerId = socket.id;
            const difficulty = data.difficulty;

            console.log(`[Dungeon] Player ${playerId} starting dungeon - difficulty: ${difficulty}`);

            // パラメータ検証
            if (!difficulty) {
                return callback({ error: "難易度を指定してください" });
            }

            const validDifficulties = ["easy", "normal", "hard", "very_hard", "nightmare"];
            if (!validDifficulties.includes(difficulty)) {
                return callback({ error: "無効な難易度です" });
            }

            // ダンジョン開始
            const result = dungeonManager.startDungeon(playerId, difficulty);
            if (result.error) {
                return callback(result);
            }

            callback({
                success: true,
                dungeon: result.dungeon,
                currentMonsters: result.currentMonsters
            });

        } catch (error) {
            console.error("[Dungeon] Error starting dungeon:", error);
            callback({ error: "ダンジョン開始に失敗しました" });
        }
    });

    // ===================================
    // 問題取得
    // ===================================
    socket.on("dungeon:getQuestion", (data, callback) => {
        try {
            const playerId = socket.id;

            // プレイヤーがダンジョン中かチェック
            const dungeon = dungeonManager.getDungeon(playerId);
            if (!dungeon) {
                return callback({ error: "アクティブなダンジョンがありません" });
            }

            // BattleEngineから問題を取得
            // 実装は既存のBattleEngineを参照
            const question = {
                question: "2 + 2 = ?",
                options: ["3", "4", "5", "6"],
                subjectDisplayName: "算数",
                questionId: Math.random().toString(36).substr(2, 9)
            };

            callback({ success: true, ...question });

        } catch (error) {
            console.error("[Dungeon] Error getting question:", error);
            callback({ error: "問題の取得に失敗しました" });
        }
    });

    // ===================================
    // 回答処理
    // ===================================
    socket.on("dungeon:answerQuestion", (data, callback) => {
        try {
            const playerId = socket.id;
            const answer = data.answer;

            // ダンジョンチェック
            const dungeon = dungeonManager.getDungeon(playerId);
            if (!dungeon) {
                return callback({ error: "アクティブなダンジョンがありません" });
            }

            // 敵を取得
            const enemies = dungeon.getCurrentFloorMonsters();
            if (!enemies || enemies.length === 0) {
                return callback({ error: "敵が見つかりません" });
            }

            const enemy = enemies[0];

            // 回答判定（実装例）
            const isCorrect = answer === "4"; // 簡略化した例
            let damage = 0;

            if (isCorrect) {
                // ダメージ計算
                const scaling = MonstersData.DIFFICULTY_SCALING[dungeon.difficulty];
                damage = Math.floor(Math.random() * 20 + 15);
                
                // 敵のHP減少
                enemy.hp = Math.max(0, enemy.hp - damage);
            } else {
                // 敵からの反撃ダメージ
                damage = Math.floor(enemy.atk * 0.8 + Math.random() * 10);
            }

            callback({
                success: true,
                isCorrect: isCorrect,
                damage: damage,
                enemyHp: enemy.hp,
                currentMonsters: [enemy]
            });

        } catch (error) {
            console.error("[Dungeon] Error processing answer:", error);
            callback({ error: "回答処理に失敗しました" });
        }
    });

    // ===================================
    // コマンド実行
    // ===================================
    socket.on("dungeon:executeCommand", (data, callback) => {
        try {
            const playerId = socket.id;
            const command = data.command; // 'attack', 'special', 'guard', 'ultimate'

            // ダンジョンチェック
            const dungeon = dungeonManager.getDungeon(playerId);
            if (!dungeon) {
                return callback({ error: "アクティブなダンジョンがありません" });
            }

            const enemies = dungeon.getCurrentFloorMonsters();
            if (!enemies || enemies.length === 0) {
                return callback({ error: "敵が見つかりません" });
            }

            const enemy = enemies[0];

            // コマンド処理
            let damage = 0;
            switch (command) {
                case "attack":
                    damage = Math.floor(20 + Math.random() * 10);
                    break;
                case "special":
                    damage = Math.floor(35 + Math.random() * 15);
                    break;
                case "guard":
                    // 防御は次のターンのダメージを軽減
                    damage = 0;
                    break;
                case "ultimate":
                    damage = Math.floor(50 + Math.random() * 25);
                    break;
                default:
                    damage = 10;
            }

            // ダメージ適用
            enemy.hp = Math.max(0, enemy.hp - damage);

            // 敵が倒されたかチェック
            let winner = null;
            if (enemy.hp <= 0) {
                winner = "player";
            }

            callback({
                success: true,
                command: command,
                damage: damage,
                enemyHp: enemy.hp,
                currentMonsters: [enemy],
                winner: winner
            });

        } catch (error) {
            console.error("[Dungeon] Error executing command:", error);
            callback({ error: "コマンド実行に失敗しました" });
        }
    });

    // ===================================
    // 階クリア
    // ===================================
    socket.on("dungeon:floorCleared", (data, callback) => {
        try {
            const playerId = socket.id;

            // ダンジョンチェック
            const dungeon = dungeonManager.getDungeon(playerId);
            if (!dungeon) {
                return callback({ error: "アクティブなダンジョンがありません" });
            }

            // 階をクリア
            const result = dungeonManager.clearFloor(playerId, data.battleReward || {});
            if (result.error) {
                return callback(result);
            }

            // クリア完了チェック
            if (result.cleared) {
                // ダンジョンクリア
                const rankResult = DungeonEngine.calculateDungeonRank(dungeon);
                return callback({
                    success: true,
                    cleared: true,
                    dungeon: result,
                    rank: rankResult.rank,
                    totalCoins: result.totalCoins,
                    totalExp: result.totalExp,
                    rewards: result.rewards
                });
            }

            // 次の階へ進む
            callback({
                success: true,
                floorReward: result.floorReward,
                dungeon: result.dungeonState,
                nextFloor: result.nextFloor,
                nextMonsters: result.nextMonsters
            });

        } catch (error) {
            console.error("[Dungeon] Error clearing floor:", error);
            callback({ error: "階クリア処理に失敗しました" });
        }
    });

    // ===================================
    // プレイヤー敗北
    // ===================================
    socket.on("dungeon:playerDefeated", (data, callback) => {
        try {
            const playerId = socket.id;

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
                coins: result.coins,
                exp: result.exp,
                message: result.message
            });

        } catch (error) {
            console.error("[Dungeon] Error on player defeat:", error);
            callback({ error: "敗北処理に失敗しました" });
        }
    });

    // ===================================
    // ダンジョン放棄
    // ===================================
    socket.on("dungeon:abandon", (data, callback) => {
        try {
            const playerId = socket.id;

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
            const playerId = socket.id;

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
    socket.on("disconnect", () => {
        const playerId = socket.id;
        
        // アクティブなダンジョンを放棄
        const dungeon = dungeonManager.getDungeon(playerId);
        if (dungeon && !dungeon.isFinished) {
            dungeonManager.abandonDungeon(playerId);
            console.log(`[Dungeon] Player ${playerId} disconnected - dungeon abandoned`);
        }
    });
}

// ===================================
// エクスポート
// ===================================
module.exports = {
    registerDungeonHandlers,
    dungeonManager
};
