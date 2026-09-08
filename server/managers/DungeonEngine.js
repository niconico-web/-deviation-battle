// ============================================
// Dungeon Engine
// DungeonEngine.js
// ============================================

const MonstersData = require("../data/monsters-data");
const BattleEngine = require("../managers/BattleEngine");

// ===================================
// ダンジョンクラス
// ===================================
class Dungeon {
    constructor(playerId, difficulty, isFirstClear = true) {
        this.playerId = playerId;
        this.difficulty = difficulty; // 'easy', 'normal', 'hard', 'very_hard', 'nightmare'
        this.currentFloor = 1;
        this.maxFloors = 10;
        this.isFinished = false;
        this.isDefeated = false;
        this.totalCoins = 0;
        this.totalExp = 0;
        this.rewards = [];
        this.floorHistory = []; // 各階のバトル履歴
        this.startTime = Date.now();
        // このプレイヤーがこの難易度を初めてクリアするかどうか。
        // 初回クリア報酬（オーブ/アイテム＋コイン＋経験値）を出すか、
        // 通常報酬（難易度別のコインのみ）を出すかの判定に使う。
        // プレイヤーの永続的なクリア履歴はクライアント側（player.dungeonClears）が
        // 持っているため、ダンジョン開始時にクライアントから渡してもらう。
        this.isFirstClear = !!isFirstClear;
    }

    // 現在の階のモンスターを取得
    getCurrentFloorMonsters() {
        if (this.currentFloor === 10) {
            // 10階はボス戦
            return [MonstersData.getBossByDifficulty(this.difficulty)];
        }
        return this.getFloorMonsters(this.currentFloor);
    }

    // 指定階のモンスターを取得
    getFloorMonsters(floor) {
        if (floor < 1 || floor > 9) return [];
        
        const monster = MonstersData.getRandomMonster(floor, this.difficulty);
        if (!monster) return [];

        // 難易度スケーリングを適用
        const scaling = MonstersData.DIFFICULTY_SCALING[this.difficulty];
        return [{
            ...monster,
            hp: Math.ceil(monster.hp * scaling),
            atk: Math.ceil(monster.atk * scaling),
            def: Math.ceil(monster.def * scaling),
            speed: Math.ceil(monster.speed * scaling),
            maxHp: Math.ceil(monster.hp * scaling)
        }];
    }

    // 次の階に進む
    advanceFloor() {
        if (this.currentFloor < this.maxFloors) {
            this.currentFloor++;
            return true;
        }
        return false;
    }

    // ダンジョンクリア（10階のボスを撃破）
    completeDungeon() {
        this.isFinished = true;

        // 10階（ボス階）自体の階層報酬（コイン・経験値）を加算する。
        // 1〜9階と同じ「階層ごとの報酬」ルールに乗せることで、報酬体系を一本化する。
        const floorReward = this.clearFloor();

        if (this.isFirstClear) {
            // 初回クリア報酬：難易度別の特別報酬（オーブ/アイテム）を追加で付与
            const reward = MonstersData.DUNGEON_REWARDS[this.difficulty];

            if (reward.orb) {
                this.rewards.push({
                    type: 'orb',
                    tier: reward.orb,
                    description: reward.description
                });
            } else if (reward.item) {
                this.rewards.push({
                    type: 'item',
                    itemId: reward.item,
                    description: reward.description,
                    rarity: reward.rarity
                });
            }
        } else {
            // 通常報酬（2回目以降）：ダンジョンの難易度に応じたコインを追加で付与
            const repeatCoins = MonstersData.REPEAT_CLEAR_COIN_REWARDS[this.difficulty] || 0;
            this.totalCoins += repeatCoins;
            this.rewards.push({
                type: 'coins',
                amount: repeatCoins,
                repeat: true
            });
        }

        return {
            cleared: true,
            floor: this.currentFloor,
            isFirstClear: this.isFirstClear,
            totalCoins: this.totalCoins,
            totalExp: this.totalExp,
            rewards: this.rewards,
            floorReward
        };
    }

    // 途中撤退：その時点までに保持している報酬（積み上がったtotalCoins/totalExp/rewards）を
    // そのまま持ち帰る。10階のボスを倒していないため、初回クリア特典（オーブ/アイテム）や
    // 通常報酬（2回目以降のコイン）は付与されない。
    retreat() {
        this.isFinished = true;
        this.isRetreated = true;

        return {
            cleared: false,
            retreated: true,
            floor: this.currentFloor,
            totalCoins: this.totalCoins,
            totalExp: this.totalExp,
            rewards: this.rewards
        };
    }

    // ダンジョンクリア失敗
    // 依頼により、敗北時はそのダンジョンで得た報酬（コイン・経験値・アイテム等）を
    // 全て失う（サーバー側では何も加算されていないtotalCoins/totalExpをそのまま破棄し、
    // クライアントには0を返す）。加えて、プレイヤーが現在保持している所持金の半分を
    // 失わせる処理はクライアント側（result.js）でプレイヤーデータを直接操作して行う。
    defeat() {
        this.isFinished = true;
        this.isDefeated = true;

        return {
            cleared: false,
            floor: this.currentFloor,
            defeated: true,
            difficulty: this.difficulty,
            lostCoins: this.totalCoins,
            lostExp: this.totalExp,
            message: `${this.currentFloor}階でキャラが倒されました。このダンジョンで得た報酬はすべて失われ、さらに所持金の半分を失います。`
        };
    }

    // 階クリア時のコイン・経験値獲得
    // 難易度・階層に応じた基本報酬（MonstersData.getFloorRewardCoins/Exp）に、
    // バトル側から渡された追加報酬（battleReward）を上乗せする。
    clearFloor(battleReward = {}) {
        const floorCoins = MonstersData.getFloorRewardCoins(this.currentFloor, this.difficulty) + (battleReward.coins || 0);
        const floorExp = MonstersData.getFloorRewardExp(this.currentFloor, this.difficulty) + (battleReward.exp || 0);
        
        this.totalCoins += floorCoins;
        this.totalExp += floorExp;
        
        this.floorHistory.push({
            floor: this.currentFloor,
            coins: floorCoins,
            exp: floorExp,
            timestamp: Date.now()
        });

        return {
            floor: this.currentFloor,
            coins: floorCoins,
            exp: floorExp
        };
    }

    // ダンジョン状態を取得
    getState() {
        return {
            playerId: this.playerId,
            difficulty: this.difficulty,
            currentFloor: this.currentFloor,
            maxFloors: this.maxFloors,
            isFinished: this.isFinished,
            isDefeated: this.isDefeated,
            totalCoins: this.totalCoins,
            totalExp: this.totalExp,
            rewards: this.rewards,
            progress: `${this.currentFloor}/${this.maxFloors}`
        };
    }
}

// ===================================
// ダンジョン管理マネージャー
// ===================================
class DungeonManager {
    constructor() {
        this.activeDungeons = new Map(); // playerId -> Dungeon
    }

    // ダンジョン開始
    startDungeon(playerId, difficulty, isFirstClear = true) {
        const existing = this.activeDungeons.get(playerId);
        if (existing) {
            // 通信切断やブラウザを閉じるなどでダンジョンが正常に終了しないまま
            // 放置されているケースを考慮し、一定時間（2時間）操作がなければ
            // 「放棄されたもの」とみなして上書きし、新しいダンジョンを開始できるようにする。
            // （通常のページ遷移ではsocket切断時にダンジョンを破棄しなくなったため、
            //  本当に再開の見込みがない古いセッションだけをここで救済する）
            const STALE_MS = 2 * 60 * 60 * 1000; // 2時間
            if (Date.now() - existing.startTime < STALE_MS) {
                return { error: "既にダンジョンがアクティブです" };
            }
            this.activeDungeons.delete(playerId);
        }

        if (!MonstersData.DIFFICULTIES[difficulty.toUpperCase()]) {
            return { error: "無効な難易度です" };
        }

        const dungeon = new Dungeon(playerId, difficulty, isFirstClear);
        this.activeDungeons.set(playerId, dungeon);

        console.log(`[DungeonManager] Dungeon started for player ${playerId}, difficulty: ${difficulty}`);

        return {
            success: true,
            dungeon: dungeon.getState(),
            currentMonsters: dungeon.getCurrentFloorMonsters()
        };
    }

    // ダンジョン取得
    getDungeon(playerId) {
        return this.activeDungeons.get(playerId);
    }

    // 階をクリア
    clearFloor(playerId, battleResult = {}) {
        const dungeon = this.getDungeon(playerId);
        if (!dungeon) {
            return { error: "アクティブなダンジョンがありません" };
        }

        if (dungeon.isFinished) {
            return { error: "ダンジョンは既に終了しています" };
        }

        if (dungeon.currentFloor === 10) {
            // ボスを倒した = ダンジョンクリア。10階自体の階層報酬もcompleteDungeon()内の
            // clearFloor()でまとめて加算するため、ここでは二重加算しないよう呼ばない。
            const result = dungeon.completeDungeon();
            this.activeDungeons.delete(playerId);
            return result;
        } else {
            // 次の階へ
            const floorReward = dungeon.clearFloor(battleResult);
            dungeon.advanceFloor();
            return {
                success: true,
                floorReward: floorReward,
                nextFloor: dungeon.currentFloor,
                nextMonsters: dungeon.getCurrentFloorMonsters(),
                dungeonState: dungeon.getState()
            };
        }
    }

    // 途中撤退（勝利後、次の階へ進まずその時点の保有報酬を持ち帰る）
    retreatDungeon(playerId) {
        const dungeon = this.getDungeon(playerId);
        if (!dungeon) {
            return { error: "アクティブなダンジョンがありません" };
        }

        if (dungeon.isFinished) {
            return { error: "ダンジョンは既に終了しています" };
        }

        const result = dungeon.retreat();
        this.activeDungeons.delete(playerId);
        return { ...result, difficulty: dungeon.difficulty };
    }

    // プレイヤー敗北
    playerDefeated(playerId) {
        const dungeon = this.getDungeon(playerId);
        if (!dungeon) {
            return { error: "アクティブなダンジョンがありません" };
        }

        const result = dungeon.defeat();
        this.activeDungeons.delete(playerId);
        return result;
    }

    // ダンジョン放棄
    abandonDungeon(playerId) {
        if (this.activeDungeons.has(playerId)) {
            this.activeDungeons.delete(playerId);
            return { success: true, message: "ダンジョンを放棄しました" };
        }
        return { error: "アクティブなダンジョンがありません" };
    }

    // ダンジョン情報を取得
    getDungeonInfo(playerId) {
        const dungeon = this.getDungeon(playerId);
        if (!dungeon) {
            return { active: false };
        }

        return {
            active: true,
            ...dungeon.getState(),
            currentMonsters: dungeon.getCurrentFloorMonsters()
        };
    }
}

// ===================================
// ダンジョンバトル処理
// ===================================

/**
 * ダンジョン内でのバトル処理
 * @param {object} battle - バトルオブジェクト
 * @param {string} playerId - プレイヤーID
 * @param {string} answer - 問題の回答
 * @param {object} usedSkill - 使用スキル
 * @param {string} command - コマンド（attack/special/guard/ultimate）
 * @returns {object} 結果
 */
function processDungeonBattle(battle, playerId, answer, usedSkill, command = 'attack') {
    // 既存のBattleEngine を使用
    return BattleEngine.processAnswer(battle, playerId, answer, usedSkill, command);
}

/**
 * ダンジョンボス戦の処理
 * @param {object} battle - バトルオブジェクト
 * @param {string} playerId - プレイヤーID
 * @param {string} answer - 問題の回答
 * @param {object} usedSkill - 使用スキル
 * @param {string} command - コマンド（attack/special/guard/ultimate）
 * @returns {object} 結果
 */
function processDungeonBossBattle(battle, playerId, answer, usedSkill, command = 'attack') {
    // ボス戦は同じ処理を使用
    return BattleEngine.processAnswer(battle, playerId, answer, usedSkill, command);
}

/**
 * ダンジョンバトル開始
 * @param {object} player - プレイヤー
 * @param {array} enemies - 敵配列
 * @returns {object} バトルオブジェクト
 */
function initializeDungeonBattle(player, enemies) {
    const battle = {
        players: {
            [player.id]: player
        },
        currentQuestion: null,
        finished: false,
        turn: player.id,
        isBossBattle: enemies.length === 1 && enemies[0].skills // ボス判定
    };

    // 敵を登録
    enemies.forEach((enemy, index) => {
        const enemyId = `enemy_${index}`;
        battle.players[enemyId] = {
            ...enemy,
            id: enemyId,
            maxHp: enemy.hp,
            answerTime: null,
            ultimateGauge: { current: 0, max: 100 }
        };
    });

    return battle;
}

// ===================================
// ランク計算
// ===================================

/**
 * ダンジョン完了時のランク評価
 * @param {object} dungeon - ダンジョン
 * @returns {object} ランク評価
 */
function calculateDungeonRank(dungeon) {
    const completionTime = (Date.now() - dungeon.startTime) / 1000; // 秒
    const floorTime = completionTime / dungeon.maxFloors;
    
    // ランク判定ロジック
    let rank = 'C';
    if (dungeon.difficulty === 'easy') {
        if (floorTime < 30) rank = 'S';
        else if (floorTime < 60) rank = 'A';
        else if (floorTime < 120) rank = 'B';
    } else if (dungeon.difficulty === 'normal') {
        if (floorTime < 45) rank = 'S';
        else if (floorTime < 90) rank = 'A';
        else if (floorTime < 180) rank = 'B';
    } else if (dungeon.difficulty === 'hard') {
        if (floorTime < 60) rank = 'S';
        else if (floorTime < 120) rank = 'A';
        else if (floorTime < 240) rank = 'B';
    } else if (dungeon.difficulty === 'very_hard') {
        if (floorTime < 90) rank = 'S';
        else if (floorTime < 180) rank = 'A';
        else if (floorTime < 360) rank = 'B';
    } else if (dungeon.difficulty === 'nightmare') {
        if (floorTime < 120) rank = 'S';
        else if (floorTime < 240) rank = 'A';
        else if (floorTime < 480) rank = 'B';
    }

    // ランクボーナス報酬
    const rankBonus = {
        'S': { coinsMultiplier: 1.5, expMultiplier: 1.5 },
        'A': { coinsMultiplier: 1.3, expMultiplier: 1.3 },
        'B': { coinsMultiplier: 1.1, expMultiplier: 1.1 },
        'C': { coinsMultiplier: 1.0, expMultiplier: 1.0 }
    };

    return {
        rank: rank,
        completionTime: completionTime,
        bonus: rankBonus[rank]
    };
}

// ===================================
// エクスポート
// ===================================
module.exports = {
    Dungeon,
    DungeonManager,
    processDungeonBattle,
    processDungeonBossBattle,
    initializeDungeonBattle,
    calculateDungeonRank
};
