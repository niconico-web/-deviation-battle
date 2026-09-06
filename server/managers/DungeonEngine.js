// ============================================
// Dungeon Engine
// DungeonEngine.js
// ============================================

const MonstersData = require("./monsters-data");
const BattleEngine = require("../managers/BattleEngine");

// ===================================
// ダンジョンクラス
// ===================================
class Dungeon {
    constructor(playerId, difficulty) {
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

    // ダンジョンクリア
    completeDungeon() {
        this.isFinished = true;
        
        // クリア報酬の計算
        const reward = MonstersData.DUNGEON_REWARDS[this.difficulty];
        const baseCoins = this.getBaseRewardCoins();
        const baseExp = this.getBaseRewardExp();
        
        this.totalCoins += baseCoins;
        this.totalExp += baseExp;
        this.rewards.push({
            type: 'coins',
            amount: baseCoins
        });
        this.rewards.push({
            type: 'exp',
            amount: baseExp
        });

        // 難易度別の特別報酬
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

        return {
            cleared: true,
            floor: this.currentFloor,
            totalCoins: this.totalCoins,
            totalExp: this.totalExp,
            rewards: this.rewards
        };
    }

    // ダンジョンクリア失敗
    defeat() {
        this.isFinished = true;
        this.isDefeated = true;
        
        // 獲得したコインと経験値の30%を獲得
        const recoveryRate = 0.3;
        const partialCoins = Math.floor(this.totalCoins * recoveryRate);
        const partialExp = Math.floor(this.totalExp * recoveryRate);

        return {
            cleared: false,
            floor: this.currentFloor,
            defeated: true,
            coins: partialCoins,
            exp: partialExp,
            message: `${this.currentFloor}階でキャラが倒されました。獲得報酬の${Math.round(recoveryRate * 100)}%を獲得できます。`
        };
    }

    // 基本報酬コインの計算
    getBaseRewardCoins() {
        const floorBonus = this.currentFloor * 50;
        const difficultyBonus = {
            'easy': 100,
            'normal': 200,
            'hard': 400,
            'very_hard': 800,
            'nightmare': 1600
        };
        return floorBonus + (difficultyBonus[this.difficulty] || 0);
    }

    // 基本報酬経験値の計算
    getBaseRewardExp() {
        const floorBonus = this.currentFloor * 25;
        const difficultyBonus = {
            'easy': 50,
            'normal': 100,
            'hard': 200,
            'very_hard': 400,
            'nightmare': 800
        };
        return floorBonus + (difficultyBonus[this.difficulty] || 0);
    }

    // 階クリア時のコイン・経験値獲得
    clearFloor(battleReward = {}) {
        const floorCoins = this.currentFloor * 10 + (battleReward.coins || 0);
        const floorExp = this.currentFloor * 5 + (battleReward.exp || 0);
        
        this.totalCoins += floorCoins;
        this.totalExp += floorExp;
        
        this.floorHistory.push({
            floor: this.currentFloor,
            coins: floorCoins,
            exp: floorExp,
            timestamp: Date.now()
        });

        return {
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
    startDungeon(playerId, difficulty) {
        if (this.activeDungeons.has(playerId)) {
            return { error: "既にダンジョンがアクティブです" };
        }

        if (!MonstersData.DIFFICULTIES[difficulty.toUpperCase()]) {
            return { error: "無効な難易度です" };
        }

        const dungeon = new Dungeon(playerId, difficulty);
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

        const floorReward = dungeon.clearFloor(battleResult);
        
        if (dungeon.currentFloor === 10) {
            // ボスを倒した = ダンジョンクリア
            const result = dungeon.completeDungeon();
            this.activeDungeons.delete(playerId);
            return result;
        } else {
            // 次の階へ
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
