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
                <p><strong>初回クリア報酬:</strong> ${rewards[difficulty]}（+コイン・経験値）</p>
                <p><strong>通常報酬（2回目以降）:</strong> コイン ${repeatCoinRewards[difficulty]}枚</p>
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
    const dungeonSocket = getDungeonSocket();
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

    const dungeonSocket = getDungeonSocket();
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
    const dungeonSocket = getDungeonSocket();
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
        // 敵を倒した。サーバーに階クリアを通知し、次の階（またはダンジョンクリア）の
        // 情報を取得してから遷移する。
        // ※以前はここでexecuteCommandの結果(result)をそのままhandleFloorClearedに
        //   渡していたが、result.dungeonやresult.floorRewardは存在せず
        //   (dungeon:floorClearedを一度も呼んでいなかったため)、
        //   実際にはこの分岐に来た時点でエラーになり遊べなかった。
        requestFloorCleared();
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
// 階クリアをサーバーに通知
// ===================================
function requestFloorCleared() {
    const dungeonSocket = getDungeonSocket();
    if (!dungeonSocket) {
        console.error('Socket not connected');
        alert('接続エラーです。ページをリロードしてください。');
        return;
    }

    dungeonSocket.emit('dungeon:floorCleared', {}, (response) => {
        if (response.error) {
            alert(`エラー: ${response.error}`);
            return;
        }

        if (response.cleared) {
            handleDungeonCleared(response);
        } else {
            handleFloorCleared(response);
        }
    });
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
    // （10階＝ボスを撃破した場合はこの関数ではなくhandleDungeonClearedが
    //   呼ばれるので、ここでは常に「次の階へ進む」でよい）
    document.getElementById('nextFloorBtn').addEventListener('click', () => {
        initializeDungeonBattleUI({
            dungeon: result.dungeon,
            currentMonsters: result.nextMonsters
        });
    });
}

// ===================================
// ダンジョン報酬の実際の付与
// ===================================
// 以前はここで報酬（コイン・経験値・オーブ/アイテム）が画面上に表示されるだけで、
// 実際のプレイヤーデータには一切反映されていなかった。
// 初回クリア報酬（オーブ/アイテム＋コイン＋経験値）と通常報酬（コインのみ）の
// どちらであってもresult.totalCoins/totalExp/rewardsに集計済みの値が入っているので、
// それをそのままplayerオブジェクトへ加算して保存する。
function applyDungeonRewards(difficulty, result) {
    if (typeof getPlayerData !== 'function') return null;
    let player = getPlayerData();
    if (!player) return null;

    const gainedCoins = result.totalCoins || 0;
    const gainedExp = result.totalExp || 0;

    player.coins = (player.coins || 0) + gainedCoins;

    const oldLevel = typeof calcLevel === 'function' ? calcLevel(player.xp || 0) : (player.level || 0);
    player.xp = (player.xp || 0) + gainedExp;
    const newLevel = typeof calcLevel === 'function' ? calcLevel(player.xp) : oldLevel;
    player.level = newLevel;
    if (newLevel > oldLevel && typeof addSkillPointsOnLevelUp === 'function') {
        player = addSkillPointsOnLevelUp(player, oldLevel, newLevel);
    }

    // 特別報酬（オーブ/アイテム）：completeDungeon()側で初回クリア時にしか
    // rewardsへ含めていないため、ここでは中身をそのまま反映するだけでよい。
    (result.rewards || []).forEach(reward => {
        if (reward.type === 'orb' && typeof createOrb === 'function') {
            const orb = createOrb(reward.tier);
            if (orb) {
                player.orbs = player.orbs || [];
                player.orbs.push(orb);
            }
        } else if (reward.type === 'item') {
            player.dungeonItems = player.dungeonItems || [];
            player.dungeonItems.push({
                id: reward.itemId,
                name: reward.description || reward.itemId,
                rarity: reward.rarity || null,
                obtainedAt: Date.now()
            });
        }
    });

    if (result.isFirstClear) {
        player.dungeonClears = player.dungeonClears || {};
        player.dungeonClears[difficulty] = true;
    }

    localStorage.setItem("player", JSON.stringify(player));
    if (typeof updateStatus === 'function') updateStatus(player);
    if (typeof updateXpDisplay === 'function') updateXpDisplay(player);
    if (typeof renderOrbInventory === 'function') renderOrbInventory();
    if (typeof syncPlayerToServer === 'function') syncPlayerToServer(true);

    return player;
}

// ===================================
// ダンジョンクリア処理
// ===================================
function handleDungeonCleared(result) {
    const dungeonContainer = document.getElementById('dungeonBattleContainer');
    if (!dungeonContainer) return;

    applyDungeonRewards(result.dungeon?.difficulty || currentDungeon?.difficulty, result);

    const clearedHTML = `
        <div class="dungeon-clear-screen">
            <h1>🎉 ダンジョンクリア！</h1>
            <div class="clear-stats">
                <p>難易度: ${getDifficultyName(result.dungeon.difficulty)}</p>
                <p>クリアランク: <strong class="rank-s">${result.rank || 'C'}</strong></p>
            </div>
            <div class="clear-rewards">
                <h3>獲得報酬${result.isFirstClear ? '（初回クリア報酬）' : '（通常報酬）'}</h3>
                <p>総獲得コイン: <strong>${result.totalCoins}</strong></p>
                ${result.isFirstClear ? `<p>総獲得経験値: <strong>${result.totalExp}</strong></p>` : ''}
                ${result.rewards.filter(r => r.type === 'orb' || r.type === 'item').map(r => `
                    <p>${r.description || r.type}: <strong>${r.tier || r.itemId}</strong></p>
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
