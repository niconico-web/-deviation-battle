// ============================================
// Dungeon Frontend Handler
// dungeon.js
// ============================================

let currentDungeon = null;
let currentDungeonBattle = null;

// ===================================
// ソケット取得ヘルパー
// ===================================
// dungeon.jsはindex.html内でscript.jsより先に読み込まれているため、
// DOMContentLoaded時点ではまだwindow.socketが生成されておらず(script.js側の
// initializeSocket()がまだ実行されていない)、その場でdungeonSocket変数に
// キャッシュしてしまうと常にnullのままになり「接続エラーです」の誤警告が
// 出続けていた。呼び出しの都度window.socketを直接参照することで、
// スクリプトの読み込み順に依存しないようにする。
function getDungeonSocket() {
    return (typeof window !== "undefined" && window.socket) ? window.socket : null;
}

// ===================================
// ダンジョン選択画面の初期化
// ===================================
function initializeDungeonUI() {
    const dungeonSection = document.getElementById('section-dungeon');
    if (!dungeonSection) return;

    // ダンジョン難易度選択
    const difficultyButtons = dungeonSection.querySelectorAll('.dungeon-difficulty-card');
    difficultyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = btn.dataset.difficulty;
            showDungeonInfo(difficulty);
        });
    });

    // ダンジョン開始ボタン
    const startBtn = document.getElementById('startDungeonBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const difficulty = document.getElementById('selectedDifficulty').value;
            startDungeon(difficulty);
        });
    }

    // ダンジョン放棄ボタン
    const abandonBtn = document.getElementById('abandonDungeonBtn');
    if (abandonBtn) {
        abandonBtn.addEventListener('click', abandonDungeon);
    }
}

// ===================================
// ダンジョン難易度情報表示
// ===================================
function showDungeonInfo(difficulty) {
    const infoContainer = document.getElementById('dungeonInfoContainer');
    if (!infoContainer) return;

    const difficultyNames = {
        'easy': 'イージー',
        'normal': 'ノーマル',
        'hard': 'ハード',
        'very_hard': 'ベリーハード',
        'nightmare': 'ナイトメア'
    };

    const rewards = {
        'easy': 'Tier2オーブ',
        'normal': 'Tier3オーブ',
        'hard': 'Tier4オーブ',
        'very_hard': 'ステータス再分配アイテム',
        'nightmare': '武器オーブスロット追加チケット'
    };

    const repeatCoinRewards = {
        'easy': 500,
        'normal': 1000,
        'hard': 2200,
        'very_hard': 4500,
        'nightmare': 10000
    };

    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    const alreadyCleared = !!(player && player.dungeonClears && player.dungeonClears[difficulty]);

    const html = `
        <div class="dungeon-info-panel">
            <h3>${difficultyNames[difficulty]}</h3>
            <div class="dungeon-info-details">
                <p><strong>難易度:</strong> ${difficultyNames[difficulty]}</p>
                <p><strong>層数:</strong> 10階</p>
                <p><strong>推奨ステータス:</strong> ${getRecommendedStats(difficulty)}</p>
                <p><strong>初回クリア報酬（10階のボスを撃破）:</strong> ${rewards[difficulty]}（+コイン・経験値）</p>
                <p><strong>通常報酬（2回目以降のクリア）:</strong> コイン ${repeatCoinRewards[difficulty]}枚</p>
                <p class="dungeon-floor-reward-note">各階を突破するたびにコイン・経験値がもらえます。階を突破した後は「次の階へ」進むか、その時点までの報酬を持って「撤退する」かを選べます。ただし敗北するとそのダンジョンで得た報酬は全て失われ、さらに所持金の半分を失うので注意してください。</p>
                ${alreadyCleared ? '<p class="dungeon-cleared-note">※このダンジョンは既にクリア済みです。次回以降は通常報酬（コイン）になります。</p>' : ''}
                <p><strong>説明:</strong> ${getDifficultyDescription(difficulty)}</p>
            </div>
            <input type="hidden" id="selectedDifficulty" value="${difficulty}">
            <button id="startDungeonBtn" class="btn btn-primary">ダンジョンに挑戦</button>
        </div>
    `;

    infoContainer.innerHTML = html;

    // イベントリスナー再設定
    document.getElementById('startDungeonBtn').addEventListener('click', () => {
        startDungeon(difficulty);
    });
}

// ===================================
// ダンジョン開始
// ===================================
function startDungeon(difficulty) {
    const dungeonSocket = getDungeonSocket();
    if (!dungeonSocket) {
        console.error('Socket not connected');
        alert('接続エラーです。ページをリロードしてください。');
        return;
    }

    console.log(`[Dungeon] Starting dungeon with difficulty: ${difficulty}`);

    // このプレイヤーがこの難易度を初めてクリアするかどうかをここで判定してサーバーに伝える。
    // 初回クリア報酬（オーブ/アイテム）は一度だけ、2回目以降は難易度別のコイン報酬になる。
    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    const isFirstClear = !(player && player.dungeonClears && player.dungeonClears[difficulty]);

    dungeonSocket.emit('dungeon:start', { difficulty, isFirstClear }, (response) => {
        if (response.error) {
            alert(`エラー: ${response.error}`);
            return;
        }

        currentDungeon = response.dungeon;
        currentDungeonBattle = {
            players: {}
        };

        // ダンジョン画面へ遷移
        switchToDungeonBattle(response);
    });
}

// ===================================
// ダンジョンバトル画面へ切り替え
// ===================================
function switchToDungeonBattle(dungeonData) {
    // ダンジョンの情報を保存
    localStorage.setItem('dungeonData', JSON.stringify(dungeonData));
    localStorage.setItem('isDungeonBattle', 'true');
    
    // プレイヤーデータを設定
    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    if (player) {
        localStorage.setItem('battlePlayer', JSON.stringify(player));
    }
    
    // 敵データを設定
    const enemy = dungeonData.currentMonsters[0];
    if (enemy) {
        localStorage.setItem('enemy', JSON.stringify(enemy));
    }
    
    // ボットバトルモードを設定
    localStorage.setItem('isBotBattle', 'true');

    // 10階（ボス階）かどうかでisBossBattleフラグを設定する
    // （未設定のままだとボス専用の問題・スキル演出が有効にならないため）
    if (dungeonData.dungeon && dungeonData.dungeon.currentFloor === 10) {
        localStorage.setItem('isBossBattle', 'true');
    } else {
        localStorage.removeItem('isBossBattle');
    }

    // battle.htmlに遷移
    window.location.href = 'battle.html';
}

// ===================================
// （旧）ダンジョン画面内バトルUIは削除済み
// ===================================
// 以前ここには initializeDungeonBattleUI() 以下一連の関数
// （generateDungeonQuestion, submitDungeonAnswer, executeDungeonCommand,
// handleDungeonAnswerResult, handleDungeonBattleResult, requestFloorCleared,
// handleFloorCleared, applyDungeonRewards, handleDungeonCleared）が
// 定義されていたが、これらが参照する #dungeonBattleScreen /
// #dungeonBattleContainer はどのHTMLにも存在せず、実際には一度も
// 呼ばれない死んだコードだった。
// 実際のダンジョン戦闘は startDungeon() → switchToDungeonBattle() で
// battle.html（通常のボット戦バトル画面）に遷移して行われ、
// 階の進行・撤退・報酬付与・敗北処理は client/js/result.js が担う。
// ===================================
// ダンジョン放棄
// ===================================
function abandonDungeon() {
    if (!confirm('本当にダンジョンを放棄しますか？獲得した報酬は失われます。')) {
        return;
    }

    const dungeonSocket = getDungeonSocket();
    if (!dungeonSocket) {
        console.error('Socket not connected');
        return;
    }

    dungeonSocket.emit('dungeon:abandon', {}, (response) => {
        if (response.error) {
            alert(`エラー: ${response.error}`);
            return;
        }

        returnToDungeonMenu();
    });
}

// ===================================
// メニューに戻る
// ===================================
function returnToDungeonMenu() {
    const dungeonContainer = document.getElementById('dungeonBattleContainer');
    if (dungeonContainer) {
        dungeonContainer.remove();
    }

    // ダンジョンセクションを表示
    const dungeonSection = document.getElementById('section-dungeon');
    if (dungeonSection) {
        dungeonSection.style.display = 'block';
    }

    currentDungeon = null;
    currentDungeonBattle = null;
}

// ===================================
// ヘルパー関数
// ===================================

function getRecommendedStats(difficulty) {
    // 難易度再設計に伴い引き上げ：イージーが旧ナイトメア相当、
    // ナイトメアはメインシナリオの裏ボス「深淵ヲ廻ルモノ」に挑めるレベルを想定。
    const stats = {
        'easy': '総ステータス 600以上',
        'normal': '総ステータス 1000以上',
        'hard': '総ステータス 1700以上',
        'very_hard': '総ステータス 2800以上',
        'nightmare': '総ステータス 4500以上'
    };
    return stats[difficulty] || '不明';
}

function getDifficultyDescription(difficulty) {
    const descriptions = {
        'easy': 'これまでのイージーより大幅に強化されており、旧ナイトメア相当の歯応えです。基本装備では油断できません。',
        'normal': '本格的なダンジョン攻略難易度です。しっかり装備・スキルを整えて挑みましょう。',
        'hard': '高難易度です。強力な敵とボスが待ち構えています。',
        'very_hard': 'ベリーハード難易度です。最大級の挑戦が必要です。',
        'nightmare': 'ナイトメア難易度です。ボス「深淵ヲ廻ルモノ」の討伐に匹敵する、確定ヒット・防御無視の大技やほぼ全ダメージ無効化の盾を持つ理不尽級のボスが立ちはだかります。'
    };
    return descriptions[difficulty] || '不明';
}

function getDifficultyName(difficulty) {
    const names = {
        'easy': 'イージー',
        'normal': 'ノーマル',
        'hard': 'ハード',
        'very_hard': 'ベリーハード',
        'nightmare': 'ナイトメア'
    };
    return names[difficulty] || '不明';
}

// ===================================
// ページ読み込み時の初期化
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    // socket自体はscript.js側のinitializeSocket()で生成される。
    // dungeon.jsはscript.jsより先に読み込まれるためこの時点ではまだ存在しないことがあるが、
    // 各操作関数はgetDungeonSocket()でその都度window.socketを見に行くので、
    // ここで変数にキャッシュする必要はない。
    initializeDungeonUI();
});

// ===================================
// エクスポート（必要な場合）
// ===================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        startDungeon,
        abandonDungeon,
        returnToDungeonMenu
    };
}
