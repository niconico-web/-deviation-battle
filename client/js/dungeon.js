// ============================================
// Dungeon Frontend Handler
// dungeon.js
// ============================================

let currentDungeon = null;
let currentDungeonBattle = null;
let dungeonSocket = null;

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
        'easy': 'Tier2以上のオーブ',
        'normal': 'Tier3以上のオーブ',
        'hard': 'Tier4以上のオーブ',
        'very_hard': 'ステータス再分配アイテム',
        'nightmare': '武器オーブスロット追加チケット'
    };

    const html = `
        <div class="dungeon-info-panel">
            <h3>${difficultyNames[difficulty]}</h3>
            <div class="dungeon-info-details">
                <p><strong>難易度:</strong> ${difficultyNames[difficulty]}</p>
                <p><strong>層数:</strong> 10階</p>
                <p><strong>推奨ステータス:</strong> ${getRecommendedStats(difficulty)}</p>
                <p><strong>クリア報酬:</strong> ${rewards[difficulty]}</p>
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
    if (!dungeonSocket) {
        console.error('Socket not connected');
        alert('接続エラーです。ページをリロードしてください。');
        return;
    }

    console.log(`[Dungeon] Starting dungeon with difficulty: ${difficulty}`);
    
    dungeonSocket.emit('dungeon:start', { difficulty }, (response) => {
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
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const dungeonBattleHTML = `
        <div id="dungeonBattleContainer" class="dungeon-battle-container">
            <div class="dungeon-header">
                <div class="dungeon-progress">
                    <span class="floor-info">第${dungeonData.dungeon.currentFloor}階</span>
                    <div class="floor-progress-bar">
                        <div class="floor-progress-fill" style="width: ${(dungeonData.dungeon.currentFloor / dungeonData.dungeon.maxFloors) * 100}%"></div>
                    </div>
                </div>
                <div class="dungeon-rewards">
                    <span>獲得コイン: <strong id="dungeonCoins">${dungeonData.dungeon.totalCoins}</strong></span>
                    <span>獲得経験値: <strong id="dungeonExp">${dungeonData.dungeon.totalExp}</strong></span>
                </div>
                <button id="abandonDungeonBtn" class="btn btn-danger">ダンジョンを放棄</button>
            </div>

            <div id="dungeonBattleScreen" class="dungeon-battle-screen">
                <!-- バトル画面がここに表示されます -->
            </div>
        </div>
    `;

    // ダンジョンバトル画面を挿入
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = dungeonBattleHTML;
    const container = tempDiv.firstElementChild;
    
    // 既存のコンテンツを隠す
    const sections = mainContent.querySelectorAll('.content-section');
    sections.forEach(s => s.style.display = 'none');
    
    mainContent.appendChild(container);

    // 放棄ボタンのイベント
    document.getElementById('abandonDungeonBtn').addEventListener('click', abandonDungeon);

    // 最初のバトルを表示
    initializeDungeonBattleUI(dungeonData);
}

// ===================================
// ダンジョンバトルUI初期化
// ===================================
function initializeDungeonBattleUI(dungeonData) {
    const battleScreen = document.getElementById('dungeonBattleScreen');
    if (!battleScreen) return;

    const isBosBattle = dungeonData.dungeon.currentFloor === 10;
    const enemy = dungeonData.currentMonsters[0];

    const battleHTML = `
        <div class="dungeon-battle-ui">
            <div class="battle-enemies">
                <div class="enemy-card">
                    <h3>${enemy.name}</h3>
                    <div class="enemy-hp">
                        <div class="hp-bar">
                            <div class="hp-fill" style="width: 100%"></div>
                        </div>
                        <span class="hp-text">HP: <strong>${enemy.hp}</strong>/${enemy.maxHp}</span>
                    </div>
                    ${isBosBattle ? '<div class="boss-badge">ボス</div>' : ''}
                </div>
            </div>

            <div class="battle-question">
                <div id="questionContainer" class="question-container">
                    <!-- 問題がここに表示されます -->
                </div>
            </div>

            <div class="battle-controls">
                <div class="answer-input-group">
                    <input type="text" id="dungeonAnswerInput" placeholder="回答を入力" class="answer-input">
                    <button id="dungeonSubmitAnswer" class="btn btn-primary">回答する</button>
                </div>
                <div id="battleCommands" class="battle-commands" style="display: none;">
                    <button id="dungeonAttackCmd" class="cmd-btn" data-command="attack">⚔️ 攻撃</button>
                    <button id="dungeonSpecialCmd" class="cmd-btn" data-command="special">✨ 特殊</button>
                    <button id="dungeonGuardCmd" class="cmd-btn" data-command="guard">🛡️ 防御</button>
                    <button id="dungeonUltimateCmd" class="cmd-btn" data-command="ultimate">⚡ 必殺技</button>
                </div>
            </div>

            <div id="battleLog" class="battle-log">
                <!-- バトルログがここに表示されます -->
            </div>
        </div>
    `;

    battleScreen.innerHTML = battleHTML;

    // 問題を取得して表示
    generateDungeonQuestion();

    // 回答送信イベント
    document.getElementById('dungeonSubmitAnswer').addEventListener('click', submitDungeonAnswer);
    document.getElementById('dungeonAnswerInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitDungeonAnswer();
    });

    // コマンドボタンのイベント
    document.querySelectorAll('.cmd-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const command = btn.dataset.command;
            executeDungeonCommand(command);
        });
    });
}

// ===================================
// 問題生成
// ===================================
function generateDungeonQuestion() {
    if (!dungeonSocket) return;

    dungeonSocket.emit('dungeon:getQuestion', {}, (response) => {
        if (response.error) {
            console.error('Question error:', response.error);
            return;
        }

        const container = document.getElementById('questionContainer');
        if (!container) return;

        const html = `
            <div class="question-card">
                <p class="question-text">${response.question}</p>
                ${response.options ? `
                    <div class="question-options">
                        ${response.options.map((opt, idx) => `
                            <button class="option-btn" data-answer="${opt}">${opt}</button>
                        `).join('')}
                    </div>
                ` : ''}
                <p class="question-hint">${response.subjectDisplayName || ''}</p>
            </div>
        `;

        container.innerHTML = html;

        // オプションボタンのイベント
        container.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const answerInput = document.getElementById('dungeonAnswerInput');
                if (answerInput) {
                    answerInput.value = btn.dataset.answer;
                    submitDungeonAnswer();
                }
            });
        });
    });
}

// ===================================
// 回答送信
// ===================================
function submitDungeonAnswer() {
    const answerInput = document.getElementById('dungeonAnswerInput');
    const answer = answerInput.value.trim();

    if (!answer) {
        alert('回答を入力してください');
        return;
    }

    if (!dungeonSocket) {
        console.error('Socket not connected');
        return;
    }

    console.log('[Dungeon] Submitting answer:', answer);

    dungeonSocket.emit('dungeon:answerQuestion', { answer }, (response) => {
        if (response.error) {
            alert(`エラー: ${response.error}`);
            return;
        }

        handleDungeonAnswerResult(response);
    });

    answerInput.value = '';
}

// ===================================
// コマンド実行
// ===================================
function executeDungeonCommand(command) {
    if (!dungeonSocket) {
        console.error('Socket not connected');
        return;
    }

    console.log('[Dungeon] Executing command:', command);

    dungeonSocket.emit('dungeon:executeCommand', { command }, (response) => {
        if (response.error) {
            alert(`エラー: ${response.error}`);
            return;
        }

        handleDungeonBattleResult(response);
    });
}

// ===================================
// 回答結果処理
// ===================================
function handleDungeonAnswerResult(result) {
    const battleLog = document.getElementById('battleLog');
    if (!battleLog) return;

    // ログを追加
    const logEntry = document.createElement('div');
    logEntry.className = `battle-log-entry ${result.isCorrect ? 'correct' : 'wrong'}`;
    logEntry.innerHTML = `
        <span class="log-time">${new Date().toLocaleTimeString()}</span>
        <span class="log-message">
            ${result.isCorrect ? '✅ 正解！' : '❌ 不正解'}
            ${result.damage ? `ダメージ: ${result.damage}` : ''}
        </span>
    `;
    battleLog.appendChild(logEntry);
    battleLog.scrollTop = battleLog.scrollHeight;

    if (result.isCorrect) {
        // コマンド選択を表示
        document.getElementById('battleCommands').style.display = 'flex';
        document.getElementById('dungeonAnswerInput').style.display = 'none';
        document.getElementById('dungeonSubmitAnswer').style.display = 'none';
    } else {
        // 次の問題を表示
        setTimeout(() => {
            generateDungeonQuestion();
        }, 1500);
    }

    // 敵HPを更新
    if (result.enemyHp !== undefined) {
        updateEnemyHP(result.enemyHp, result.currentMonsters[0]?.maxHp);
    }
}

// ===================================
// バトル結果処理
// ===================================
function handleDungeonBattleResult(result) {
    const battleLog = document.getElementById('battleLog');
    if (!battleLog) return;

    // ログを追加
    const logEntry = document.createElement('div');
    logEntry.className = 'battle-log-entry';
    logEntry.innerHTML = `
        <span class="log-time">${new Date().toLocaleTimeString()}</span>
        <span class="log-message">
            コマンド: ${result.command} | ダメージ: ${result.damage || 0}
        </span>
    `;
    battleLog.appendChild(logEntry);
    battleLog.scrollTop = battleLog.scrollHeight;

    // 敵HPを更新
    if (result.enemyHp !== undefined) {
        updateEnemyHP(result.enemyHp, result.currentMonsters[0]?.maxHp);
    }

    if (result.winner) {
        // 階をクリア
        handleFloorCleared(result);
    } else {
        // 次の問題へ
        setTimeout(() => {
            document.getElementById('battleCommands').style.display = 'none';
            document.getElementById('dungeonAnswerInput').style.display = 'block';
            document.getElementById('dungeonSubmitAnswer').style.display = 'block';
            generateDungeonQuestion();
        }, 1500);
    }
}

// ===================================
// 敵HP更新
// ===================================
function updateEnemyHP(currentHP, maxHP) {
    const hpFill = document.querySelector('.hp-fill');
    const hpText = document.querySelector('.hp-text');
    
    if (hpFill && hpText) {
        const percentage = Math.max(0, (currentHP / maxHP) * 100);
        hpFill.style.width = percentage + '%';
        hpText.innerHTML = `HP: <strong>${currentHP}</strong>/${maxHP}`;
    }
}

// ===================================
// 階クリア処理
// ===================================
function handleFloorCleared(result) {
    const battleScreen = document.getElementById('dungeonBattleScreen');
    if (!battleScreen) return;

    // クリア画面を表示
    const clearHTML = `
        <div class="floor-clear-screen">
            <h2>第${result.dungeon.currentFloor - 1}階 クリア！</h2>
            <div class="clear-rewards">
                <p>獲得コイン: <strong>+${result.floorReward.coins}</strong></p>
                <p>獲得経験値: <strong>+${result.floorReward.exp}</strong></p>
            </div>
            <button id="nextFloorBtn" class="btn btn-primary">次の階へ</button>
        </div>
    `;

    battleScreen.innerHTML = clearHTML;

    // コイン・経験値を更新
    document.getElementById('dungeonCoins').textContent = result.dungeon.totalCoins;
    document.getElementById('dungeonExp').textContent = result.dungeon.totalExp;

    // 次の階へボタン
    document.getElementById('nextFloorBtn').addEventListener('click', () => {
        if (result.dungeon.currentFloor === 11) {
            // ダンジョンクリア
            handleDungeonCleared(result);
        } else {
            initializeDungeonBattleUI({
                dungeon: result.dungeon,
                currentMonsters: result.nextMonsters
            });
        }
    });
}

// ===================================
// ダンジョンクリア処理
// ===================================
function handleDungeonCleared(result) {
    const dungeonContainer = document.getElementById('dungeonBattleContainer');
    if (!dungeonContainer) return;

    const clearedHTML = `
        <div class="dungeon-clear-screen">
            <h1>🎉 ダンジョンクリア！</h1>
            <div class="clear-stats">
                <p>難易度: ${getDifficultyName(result.dungeon.difficulty)}</p>
                <p>クリアランク: <strong class="rank-s">${result.rank || 'C'}</strong></p>
            </div>
            <div class="clear-rewards">
                <h3>獲得報酬</h3>
                <p>総獲得コイン: <strong>${result.totalCoins}</strong></p>
                <p>総獲得経験値: <strong>${result.totalExp}</strong></p>
                ${result.rewards.map(r => `
                    <p>${r.description || r.type}: <strong>${r.amount || r.tier || r.itemId}</strong></p>
                `).join('')}
            </div>
            <button id="returnMenuBtn" class="btn btn-primary">メニューに戻る</button>
        </div>
    `;

    dungeonContainer.innerHTML = clearedHTML;

    document.getElementById('returnMenuBtn').addEventListener('click', returnToDungeonMenu);
}

// ===================================
// ダンジョン放棄
// ===================================
function abandonDungeon() {
    if (!confirm('本当にダンジョンを放棄しますか？獲得した報酬は失われます。')) {
        return;
    }

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
    const stats = {
        'easy': '総ステータス 100以上',
        'normal': '総ステータス 150以上',
        'hard': '総ステータス 250以上',
        'very_hard': '総ステータス 400以上',
        'nightmare': '総ステータス 600以上'
    };
    return stats[difficulty] || '不明';
}

function getDifficultyDescription(difficulty) {
    const descriptions = {
        'easy': '初心者向けの難易度です。基本的な敵が登場します。',
        'normal': '標準的な難易度です。本格的なダンジョン攻略が始まります。',
        'hard': '高難易度です。強力な敵とボスが待ち構えています。',
        'very_hard': 'ベリーハード難易度です。最大級の挑戦が必要です。',
        'nightmare': 'ナイトメア難易度です。究極の試練に挑みます。'
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
    // Socket.io接続を待つ
    if (typeof io !== 'undefined') {
        // onlineで既に接続されているsocketを使用
        dungeonSocket = socket; // globalのsocketを使用
    }

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
