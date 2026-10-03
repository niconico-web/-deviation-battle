// ============================================
// Dungeon Engine
// DungeonEngine.js
// ============================================

const MonstersData = require("../data/monsters-data");
const BattleEngine = require("../managers/BattleEngine");

// ===================================
// ダンジョンクラス
// ===================================
// 依頼により全面リニューアル：
// ・難易度の概念を廃止（1つの無限に続くダンジョンのみ）
// ・初回クリア報酬を廃止（10階固定のクリアという概念自体が無くなったため）
// ・階層に上限が無く、下に行くほどモンスターがどんどん強くなる
// ・10階ごとにチェックポイントとして記録し、次回そこから再開できる
// 実際のモンスター・ボスの抽選や強さの決定はクライアント側（dungeon.js）で
// 階層番号だけを基にランダムに行う（オンライン対戦とは異なりPvEのため、
// 既存のボット戦・ダンジョン戦と同じくクライアント主導の処理で問題ない）。
// このサーバー側はあくまで「今何階にいるか」「ここまでの報酬」「宝箱抽選」など
// 進行状況の管理だけを行う。
class Dungeon {
    constructor(playerId, startFloor = 1) {
        this.playerId = playerId;
        this.currentFloor = Math.max(1, Math.floor(startFloor) || 1);
        this.isFinished = false;
        this.isDefeated = false;
        this.totalCoins = 0;
        this.totalExp = 0;
        this.rewards = [];
        this.floorHistory = []; // 各階のバトル履歴
        this.startTime = Date.now();
        // これまでに到達した最も深いチェックポイント（10階刻み）。
        // 例：37階まで到達していれば30。まだ10階未満なら0。
        this.checkpoint = Math.floor(this.currentFloor / 10) * 10;
    }

    // 次の階に進む（無限に続くため上限チェックは行わない）
    advanceFloor() {
        this.currentFloor++;
        if (this.currentFloor % 10 === 0 && this.currentFloor > this.checkpoint) {
            this.checkpoint = this.currentFloor;
        }
        return true;
    }

    // 途中撤退：その時点までに保持している報酬（積み上がったtotalCoins/totalExp/rewards）を
    // そのまま持ち帰る。
    retreat() {
        this.isFinished = true;
        this.isRetreated = true;

        return {
            cleared: false,
            retreated: true,
            floor: this.currentFloor,
            checkpoint: this.checkpoint,
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
            checkpoint: this.checkpoint,
            defeated: true,
            lostCoins: this.totalCoins,
            lostExp: this.totalExp,
            message: `${this.currentFloor}階でキャラが倒されました。このダンジョンで得た報酬はすべて失われ、さらに所持金の半分を失います。`
        };
    }

    // 階クリア時のコイン・経験値獲得＋宝箱抽選
    // 階層番号だけに応じた基本報酬（MonstersData.getFloorRewardCoinsByFloor/ExpByFloor）に、
    // バトル側から渡された追加報酬（battleReward）を上乗せする。
    clearFloor(battleReward = {}) {
        const floorCoins = MonstersData.getFloorRewardCoinsByFloor(this.currentFloor) + (battleReward.coins || 0);
        const floorExp = MonstersData.getFloorRewardExpByFloor(this.currentFloor) + (battleReward.exp || 0);

        this.totalCoins += floorCoins;
        this.totalExp += floorExp;

        // 宝箱抽選（オーブ／ステータス再分配チケット／武器オーブスロット追加チケット）
        const chestReward = MonstersData.rollDungeonChestReward();
        if (chestReward) {
            this.rewards.push(chestReward);
        }

        this.floorHistory.push({
            floor: this.currentFloor,
            coins: floorCoins,
            exp: floorExp,
            timestamp: Date.now()
        });

        return {
            floor: this.currentFloor,
            coins: floorCoins,
            exp: floorExp,
            chestReward
        };
    }

    // ダンジョン状態を取得
    getState() {
        return {
            playerId: this.playerId,
            currentFloor: this.currentFloor,
            checkpoint: this.checkpoint,
            isFinished: this.isFinished,
            isDefeated: this.isDefeated,
            totalCoins: this.totalCoins,
            totalExp: this.totalExp,
            rewards: this.rewards
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
    // startFloor: 1、またはプレイヤーが到達済みのチェックポイント（10, 20, 30…）
    startDungeon(playerId, startFloor = 1) {
        const existing = this.activeDungeons.get(playerId);
        if (existing) {
            // 通信切断やブラウザを閉じるなどでダンジョンが正常に終了しないまま
            // 放置されているケースを考慮し、一定時間（2時間）操作がなければ
            // 「放棄されたもの」とみなして上書きし、新しいダンジョンを開始できるようにする。
            const STALE_MS = 2 * 60 * 60 * 1000; // 2時間
            if (Date.now() - existing.startTime < STALE_MS) {
                return { error: "既にダンジョンがアクティブです" };
            }
            this.activeDungeons.delete(playerId);
        }

        const safeStartFloor = Math.max(1, Math.floor(Number(startFloor)) || 1);
        const dungeon = new Dungeon(playerId, safeStartFloor);
        this.activeDungeons.set(playerId, dungeon);

        console.log(`[DungeonManager] Dungeon started for player ${playerId}, startFloor: ${safeStartFloor}`);

        return {
            success: true,
            dungeon: dungeon.getState()
        };
    }

    // ダンジョン取得
    getDungeon(playerId) {
        return this.activeDungeons.get(playerId);
    }

    // 階をクリア（無限に続くため、常に「次の階へ」のみ。10階固定クリアの概念は廃止）
    clearFloor(playerId, battleResult = {}) {
        const dungeon = this.getDungeon(playerId);
        if (!dungeon) {
            return { error: "アクティブなダンジョンがありません" };
        }

        if (dungeon.isFinished) {
            return { error: "ダンジョンは既に終了しています" };
        }

        const floorReward = dungeon.clearFloor(battleResult);
        dungeon.advanceFloor();

        return {
            success: true,
            floorReward: floorReward,
            nextFloor: dungeon.currentFloor,
            dungeonState: dungeon.getState()
        };
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
        return result;
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
            ...dungeon.getState()
        };
    }
}

// ===================================
// エクスポート
// ===================================
module.exports = {
    Dungeon,
    DungeonManager
};
