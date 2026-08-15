const isBotBattle = localStorage.getItem("isBotBattle") === "true";
const isBossBattle = localStorage.getItem("isBossBattle") === "true";
const partyDataJSON = localStorage.getItem("partyData");
const partyData = partyDataJSON && !isBotBattle ? JSON.parse(partyDataJSON) : null;
const socket = isBotBattle ? null : io();
const roomId = localStorage.getItem("roomId");
const battlePlayerData = localStorage.getItem("battlePlayer");
const enemyData = localStorage.getItem("enemy");
let me = battlePlayerData ? JSON.parse(battlePlayerData) : null;
let enemy = enemyData ? JSON.parse(enemyData) : null;
let allies = []; // 自分以外のパーティメンバー

let battleEnd = false, rejoined = false, currentQuestion = null, questionStartTime = null, timerInterval = null, countdownInterval = null, botDifficulty = null;
let activeSkills = [];
let selectedSkill = null;
let usedSkills = [];
let skillActivationWindow = false;
let skillActivationTimer = null;
let bossAutoAnswerTimer = null; // Boss auto-answer timer
const BOSS_AUTO_ANSWER_TIMEOUT = 5000; // 5 seconds for boss to auto-answer
// スキルによる一時的な効果（ボット戦で使用）
let myPendingDamageReduction = 0; // 次に受けるダメージの軽減率
let myDefDebuff = 0;              // 自身の防御低下量
let myDefDebuffTurns = 0;         // 防御低下の残りターン
let mySkipThisTurn = false;       // このターン攻撃できない
let enemyBurnTurns = 0;           // 敵の火傷残りターン
let enemyPoisonTurns = 0;         // 敵の毒残りターン
let enemySpeedDebuff = 0;         // 敵の速度低下率
let enemySpeedDebuffTurns = 0;    // 敵の速度低下残りターン
let enemyAtkDebuff = 0;           // 敵の攻撃力低下率
let enemyAtkDebuffTurns = 0;      // 敵の攻撃力低下残りターン
let enemyDefDebuff = 0;           // 敵の防御力低下率
let enemyDefDebuffTurns = 0;      // 敵の防御力低下残りターン
let enemyAccuracyDebuff = 0;      // 敵の命中率低下率
let enemyAccuracyDebuffTurns = 0; // 敵の命中率低下残りターン
let myMultiHit = 0;               // 複数回攻撃の回数
let myMultiHitTurns = 0;          // 複数回攻撃の残りターン

// 武器システムの関数をインポート（weapons.jsが読み込まれている前提）
// getWeaponUltimateName関数を使用するために必要

const turnText = document.getElementById("turnText");
const myName = document.getElementById("myName");
const enemyName = document.getElementById("enemyName");
const myHPBar = document.getElementById("myHPBar");
const enemyHPBar = document.getElementById("enemyHPBar");
const myHPText = document.getElementById("myHPText");
const enemyHPText = document.getElementById("enemyHPText");
const myUltimateBar = document.getElementById("myUltimateBar");
const enemyUltimateBar = document.getElementById("enemyUltimateBar");
const myUltimateText = document.getElementById("myUltimateText");
const enemyUltimateText = document.getElementById("enemyUltimateText");
const correctEffect = document.getElementById("correctEffect");
const ultimateEffect = document.getElementById("ultimateEffect");
const myAtk = document.getElementById("myAtk");
const myDef = document.getElementById("myDef");
const mySpeed = document.getElementById("mySpeed");
const myGrade = document.getElementById("myGrade");
const enemyAtk = document.getElementById("enemyAtk");
const enemyDef = document.getElementById("enemyDef");
const enemySpeed = document.getElementById("enemySpeed");
const enemyGrade = document.getElementById("enemyGrade");
const questionDisplay = document.getElementById("questionDisplay");
const choicesContainer = document.getElementById("choicesContainer");
const timerDisplay = document.getElementById("timer");
const log = document.getElementById("log");
const skillsContainer = document.getElementById("skillSlotsContainer");

function statLabel(k, v) {
    return I18N[k] + I18N.colon + v;
}

/**
 * プレイヤーが特定のユニーク能力を持っているかチェック
 * @param {object} player - プレイヤーオブジェクト
 * @param {string} effectKey - チェックする能力のエフェクトキー
 * @returns {boolean}
 */
function hasUniqueAbility(player, effectKey) {
    return player?.equippedWeapon?.uniqueAbilities?.some(ability => ability.effect === effectKey) || false;
}

function getSubjectDisplayName(subject) {
    const subjectNames = {
        'math': '算数・数学',
        'jp': '国語',
        'english': '英語',
        'science': '理科',
        'social': '社会'
    };
    return subjectNames[subject] || subject;
}

/**
 * ボス戦用の問題をローカルから取得する（暫定的なダミー関数）
 * @param {string} bossSubject - ボスの教科
 * @returns {Array} 問題の配列（現在は空）
 */
function getLocalBossQuestions(bossSubject) {
    console.warn(`[TEMP] getLocalBossQuestions for ${bossSubject} is not implemented. Returning empty array.`);
    return [];
}

function renderPartyStatus() {
    let container = document.getElementById('ally-status-container');
    if (!container) {
        const myStatusBox = document.getElementById('my-status');
        if (myStatusBox && myStatusBox.parentElement) {
            container = document.createElement('div');
            container.id = 'ally-status-container';
            container.className = 'ally-status-container';
            // my-status の前に挿入して、味方・自分・敵の順にする
            myStatusBox.parentElement.insertBefore(container, myStatusBox);
        } else {
            console.error("Could not find a parent for 'my-status' to append ally statuses.");
            return;
        }
    }
    container.innerHTML = '';

    allies.forEach(ally => {
        const allyDiv = document.createElement('div');
        allyDiv.className = 'ally-status-box status-box'; // 既存のスタイルを流用
        allyDiv.id = `ally-status-${ally.id}`;
        allyDiv.innerHTML = `
            <h3 class="ally-name">${ally.name}</h3>
            <div class="damage-display" id="allyDamage-${ally.id}"></div>
            <div class="hp-bar-container">
                <div class="hp-bar" id="allyHPBar-${ally.id}" style="width: 100%; background-color: #28a745;"></div>
            </div>
            <div class="hp-text" id="allyHPText-${ally.id}">${ally.hp} / ${ally.maxHp}</div>
        `;
        container.appendChild(allyDiv);
    });
}

function initialize() {
    if (!me || !enemy) {
        alert(I18N.noBattleData);
        location.href = "index.html";
        return;
    }

    console.log("Battle initialize:", { me, enemy, roomId, isBotBattle, isBossBattle, partyData, allies });
    console.log("Enemy stats:", enemy.stats);
    console.log("Enemy maxHp:", enemy.maxHp);
    console.log("Socket exists:", !!socket);
    console.log("Socket connected:", socket ? socket.connected : "N/A");
    console.log("Socket ID:", socket ? socket.id : "N/A");

    // Ensure enemy has stats if they're undefined
    if (!enemy.stats) {
        console.warn("Enemy stats undefined, using defaults");
        enemy.stats = {
            maxHp: enemy.maxHp || 100,
            atk: enemy.atk || 10,
            def: enemy.def || 10,
            speed: enemy.speed || 10
        };
    }

    // Ensure enemy maxHp is set
    if (!enemy.maxHp && enemy.stats && enemy.stats.maxHp) {
        enemy.maxHp = enemy.stats.maxHp;
    }
    if (!enemy.maxHp) {
        enemy.maxHp = 100;
    }

    // ボス戦でstatsオブジェクトがない場合、トップレベルのプロパティから作成する
    if (isBossBattle && !enemy.stats) {
        console.warn("Boss enemy.stats is missing, creating from top-level properties.");
        enemy.stats = {
            maxHp: enemy.maxHp || enemy.hp,
            atk: enemy.atk,
            def: enemy.def,
            speed: enemy.speed
        };
        if (!enemy.maxHp) enemy.maxHp = enemy.hp;
    }

    // 武器補正が適用されたmaxHpに合わせて現在のHPを調整
    // 武器による補正が減少する場合でもHPはmaxHpを超えないようにする
    if (me.hp > me.maxHp) {
        me.hp = me.maxHp;
    }
    if (enemy.hp > enemy.maxHp) {
        enemy.hp = enemy.maxHp;
    }

    myName.textContent = me.name;
    enemyName.textContent = enemy.name;

    // ユニーク能力「リ・ミゼラブル」の効果をバトル開始時に適用
    const applyReMiserable = (player, target) => {
        if (player.equippedWeapon && player.equippedWeapon.uniqueAbilities) {
            const hasReMiserable = player.equippedWeapon.uniqueAbilities.some(a => a.effect === "enemy_stat_debuff");
            if (hasReMiserable) {
                addLog(`${player.name}の「リ・ミゼラブル」発動！ ${target.name}の全ステータスがダウン！`);
                target.atk = Math.floor(target.atk * 0.8);
                target.def = Math.floor(target.def * 0.8);
                target.speed = Math.floor(target.speed * 0.8);
                target.maxHp = Math.floor(target.maxHp * 0.8);
                // maxHpが減ったことに伴い、現在のHPも調整
                if (target.hp > target.maxHp) {
                    target.hp = target.maxHp;
                }
            }
        }
    };

    // 自分から相手へ
    applyReMiserable(me, enemy);
    // 相手から自分へ
    applyReMiserable(enemy, me);

    // パーティメンバーがいる場合、UIを初期化
    if (partyData) {
        allies = partyData.members
            .filter(member => member.id !== me.id)
            .map(member => ({ ...member.player, hp: member.player.maxHp, maxHp: member.player.maxHp }));
        renderPartyStatus();
    }

    updateStats();
    updateHP();
    updateUltimateGauge();
    addLog(I18N.battleBegin);
    
    // スキルを初期化
    initializeBattleSkills();

    if (isBotBattle) {
        console.log("Bot battle detected, starting bot battle immediately");
        startBotBattle();
    } else {
        console.log("Online battle detected, waiting for server");
        if (!socket) {
            addLog("エラー: ソケット接続エラーが発生しました。ページを再読み込みしてください。");
            return;
        }
        
        // ソケット接続を待つ
        if (!socket.connected) {
            addLog("サーバー接続待機中...");
            socket.once("connect", () => {
                console.log("Socket connected, starting battle");
                joinOnlineBattle();
            });
            
            // 接続に時間がかかっている場合の通知（ブロッキングしない）
            // ※ サーバーがスリープ状態から復帰する場合など、接続確立までに時間がかかることがあるため、
            //    ここでは alert() を使わず、ログ表示のみで待機を継続する（socket.io側は自動で再接続を試み続ける）
            setTimeout(() => {
                if (!socket.connected) {
                    addLog("サーバーへの接続に時間がかかっています。しばらくお待ちください...");
                }
            }, 8000);

            // それでも長時間接続できない場合のみ、ユーザーに再読み込みを促す
            setTimeout(() => {
                if (!socket.connected) {
                    addLog("エラー: サーバーに接続できませんでした。ページを再読み込みしてください。");
                }
            }, 30000);
        } else {
            joinOnlineBattle();
        }
    }
}

function joinOnlineBattle() {
    console.log("Joining online battle for room:", roomId);
    addLog("バトルに参加中...");
    // サーバーにバトル参加を通知し、初期状態を要求
    socket.emit("battle:join", { roomId });
}

function calculateDodgeChance(speed) {
    if (!speed || speed <= 0) return 0;
    // 素早さ7500で45%回避率に到達
    return Math.min(45, Math.floor((speed / 7500) * 45));
}

function updateStats() {
    myAtk.textContent = statLabel("atk", me.atk);
    myDef.textContent = statLabel("def", me.def);
    const myDodgeChance = calculateDodgeChance(me.speed);
    mySpeed.textContent = statLabel("speed", me.speed) + ` (回避${myDodgeChance}%)`;
    myGrade.textContent = "学年" + I18N.colon + (me.grade || 1);
    
    // ボスと通常のボットでステータスの持ち方が違うため、直接プロパティを参照する
    const enemyAtkVal = enemy.atk;
    const enemyDefVal = enemy.def;
    const enemySpeedVal = enemy.speed;
    
    enemyAtk.textContent = statLabel("atk", enemyAtkVal);
    enemyDef.textContent = statLabel("def", enemyDefVal);
    const enemyDodgeChance = calculateDodgeChance(enemySpeedVal);
    enemySpeed.textContent = statLabel("speed", enemySpeedVal) + ` (回避${enemyDodgeChance}%)`;
    enemyGrade.textContent = "学年" + I18N.colon + (enemy.grade || 1);
}

function updateHP() {
    // HPが0の場合にmaxHpが代入されるのを防ぐ
    const myHp = (me.hp !== null && me.hp !== undefined) ? me.hp : (me.maxHp || 100);
    const myMaxHp = me.maxHp || 100;
    const enemyHp = (enemy.hp !== null && enemy.hp !== undefined) ? enemy.hp : (enemy.maxHp || 100);
    const enemyMaxHp = enemy.maxHp || 100;
    
    myHPText.textContent = "HP " + myHp + " / " + myMaxHp;
    enemyHPText.textContent = "HP " + enemyHp + " / " + enemyMaxHp;

    // HPが0未満にならないようにし、パーセンテージを計算
    const myHpPercentage = Math.max(0, (myHp / myMaxHp) * 100);
    const enemyHpPercentage = Math.max(0, (enemyHp / enemyMaxHp) * 100);

    myHPBar.style.width = myHpPercentage + "%";
    enemyHPBar.style.width = enemyHpPercentage + "%";

    // 味方のHP更新
    allies.forEach(ally => {
        const allyHp = (ally.hp !== null && ally.hp !== undefined) ? ally.hp : (ally.maxHp || 100);
        const allyMaxHp = ally.maxHp || 100;
        const hpBar = document.getElementById(`allyHPBar-${ally.id}`);
        const hpText = document.getElementById(`allyHPText-${ally.id}`);

        if (hpBar) {
            const percentage = Math.max(0, (allyHp / allyMaxHp) * 100);
            hpBar.style.width = percentage + "%";
        }
        if (hpText) {
            hpText.textContent = `${allyHp} / ${allyMaxHp}`;
        }
    });
}

function updateUltimateGauge() {
    // 必殺技ゲージの初期化
    if (!me.ultimateGauge) {
        me.ultimateGauge = { current: 0, max: 100 };
    }
    if (!enemy.ultimateGauge) {
        enemy.ultimateGauge = { current: 0, max: 100 };
    }
    
    // 自分のゲージ更新
    const myGaugePercent = (me.ultimateGauge.current / me.ultimateGauge.max) * 100;
    myUltimateBar.style.width = myGaugePercent + "%";
    myUltimateText.textContent = `${me.ultimateGauge.current} / ${me.ultimateGauge.max}`;
    
    // 敵のゲージ更新
    const enemyGaugePercent = (enemy.ultimateGauge.current / enemy.ultimateGauge.max) * 100;
    enemyUltimateBar.style.width = enemyGaugePercent + "%";
    enemyUltimateText.textContent = `${enemy.ultimateGauge.current} / ${enemy.ultimateGauge.max}`;
    
    // ゲージが満タンの時は特別なスタイルを適用（新しいUIデザインに準拠）
    if (me.ultimateGauge.current >= me.ultimateGauge.max) {
        myUltimateBar.style.background = "linear-gradient(90deg, #007bff, #00c6ff)"; // 水色系のグラデーション
        myUltimateBar.style.boxShadow = "0 0 10px #00c6ff";
    } else {
        myUltimateBar.style.background = "#007bff"; // 単色の水色
        myUltimateBar.style.boxShadow = "none";
    }

    // 敵のゲージスタイルも同様に更新（色は変えても良い）
    if (enemy.ultimateGauge.current >= enemy.ultimateGauge.max) {
        enemyUltimateBar.style.background = "linear-gradient(90deg, #ff8c00, #ff4500)";
        enemyUltimateBar.style.boxShadow = "0 0 10px #ff8c00";
    } else {
        enemyUltimateBar.style.background = "#ff4500";
        enemyUltimateBar.style.boxShadow = "none";
    }
}

function addLog(text) {
    const div = document.createElement("div");
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function showDamage(id, amount) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = amount > 0 ? "-" + amount : "MISS";

    // Web Animations API を使用してリッチなアニメーションを実装
    el.animate([
        { transform: 'translateY(0) scale(1.2)', opacity: 1, color: '#ff4d4d' },
        { transform: 'translateY(-30px) scale(1.5)', opacity: 1, offset: 0.2, color: '#ff1a1a' },
        { transform: 'translateY(-120px) scale(1)', opacity: 0 }
    ], {
        duration: 1500,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)' // 上に素早く消えるイージング
    });

    // ダメージを受けた時に画面を揺らす
    if (amount > 0) {
        const container = document.querySelector('.battle-container');
        if (container) {
            container.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(-6px)' },
                { transform: 'translateX(6px)' },
                { transform: 'translateX(-6px)' },
                { transform: 'translateX(6px)' },
                { transform: 'translateX(0)' }
            ], {
                duration: 300,
                easing: 'ease-in-out'
            });
        }
    }
}

function showCorrectEffect() {
    // Web Animations API を使用
    correctEffect.animate([
        { opacity: 0, transform: 'scale(0.7)' },
        { opacity: 1, transform: 'scale(1.1)', offset: 0.3 },
        { opacity: 1, transform: 'scale(1)', offset: 0.6 },
        { opacity: 0, transform: 'scale(1.5)' }
    ], {
        duration: 1500,
        easing: 'ease-out'
    });
}

function showUltimateEffect() {
    // 画面フラッシュ
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = '#fff';
    flash.style.zIndex = '9998';
    flash.style.pointerEvents = 'none';
    document.body.appendChild(flash);
    flash.animate([
        { opacity: 0.9 },
        { opacity: 0 }
    ], {
        duration: 500,
        easing: 'ease-in'
    }).onfinish = () => flash.remove();

    // 必殺技エフェクト本体
    ultimateEffect.animate([
        { opacity: 0, transform: 'scale(0.5) rotate(-45deg)' },
        { opacity: 1, transform: 'scale(1.2) rotate(10deg)', offset: 0.2 },
        { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: 0.4 },
        { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: 0.8 },
        { opacity: 0, transform: 'scale(2) rotate(45deg)' }
    ], {
        duration: 2000,
        easing: 'ease-in-out'
    });

    // 画面揺れ（強め）
    const container = document.querySelector('.battle-container');
    if (container) {
        setTimeout(() => { // フラッシュと少しずらす
            container.animate([
                { transform: 'translateX(0) rotate(0)' },
                { transform: 'translateX(-10px) rotate(-1deg)' },
                { transform: 'translateX(10px) rotate(1deg)' },
                { transform: 'translateX(-10px) rotate(-1deg)' },
                { transform: 'translateX(10px) rotate(1deg)' },
                { transform: 'translateX(0) rotate(0)' }
            ], {
                duration: 500,
                easing: 'ease-in-out'
            });
        }, 100);
    }
}

function updateTimer() {
    if (!questionStartTime) return;
    const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timerDisplay.textContent = 
        String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function startTimer() {
    questionStartTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

function startBotBattle() {
    console.log("Starting bot battle, isBossBattle:", isBossBattle);
    
    if (isBossBattle) {
        // ボス戦の場合、敵オブジェクトは既にサーバーから受け取った正しいステータスを持っています。
        // HPが設定されていない場合のみ、最大HPで初期化します。
        if (!enemy.hp) {
            enemy.hp = enemy.maxHp;
        }
        console.log("Boss battle: using pre-configured boss stats", enemy);
    } else {
        // 通常のボット戦の場合のみ、プレイヤーに合わせて難易度を計算します。
        botDifficulty = calculateBotDifficulty();
    }
    
    // ステータス更新を反映
    updateStats();
    updateHP();
    generateBotQuestion();
}

function generateChoices(question) {
    choicesContainer.innerHTML = '';
    
    // 選択肢を生成
    let options;
    if (question.options && question.options.length === 4) {
        // サーバーから選択肢が提供されている場合
        options = question.options;
    } else {
        // クライアント側で選択肢を生成
        options = generateOptionsForQuestion(question);
    }
    
    // 選択肢ボタンを作成
    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'choice-btn';
        button.textContent = option;
        button.onclick = () => handleChoiceClick(option);
        choicesContainer.appendChild(button);
    });
}

function generateOptionsForQuestion(question) {
    const options = [question.answer];
    
    // 答えが数値の場合
    if (!isNaN(question.answer)) {
        const numAnswer = parseInt(question.answer);
        const usedNumbers = new Set([numAnswer]);
        
        // よくある計算ミスを想定した誤答を生成
        const wrongAnswers = generateNumericWrongAnswers(numAnswer);
        
        for (const wrong of wrongAnswers) {
            if (!usedNumbers.has(wrong) && options.length < 4) {
                usedNumbers.add(wrong);
                options.push(String(wrong));
            }
        }
        
        // まだ足りない場合は従来の方法で追加
        while (options.length < 4) {
            let offset;
            if (Math.random() < 0.5) {
                offset = Math.floor(Math.random() * 5) + 1;
            } else {
                offset = -(Math.floor(Math.random() * 5) + 1);
            }
            
            const wrongAnswer = numAnswer + offset;
            if (!usedNumbers.has(wrongAnswer) && wrongAnswer >= 0) {
                usedNumbers.add(wrongAnswer);
                options.push(String(wrongAnswer));
            }
        }
    } else {
        // 文字列の場合は意味のある誤答を生成
        const wrongAnswers = generateStringWrongAnswers(question.answer);
        const usedAnswers = new Set([question.answer]);
        
        for (const wrong of wrongAnswers) {
            if (!usedAnswers.has(wrong) && options.length < 4) {
                usedAnswers.add(wrong);
                options.push(wrong);
            }
        }
        
        // 文学的技法の問題の場合は、類似した文字列を生成しない
        if (!isLiteraryTechniqueQuestion(question.answer)) {
            // まだ足りない場合は類似した文字列を生成
            while (options.length < 4) {
                const similar = generateSimilarString(question.answer);
                if (!usedAnswers.has(similar)) {
                    usedAnswers.add(similar);
                    options.push(similar);
                }
            }
        }
    }
    
    // 選択肢をシャッフル
    return shuffleArray(options);
}

// 数値の誤答を生成（よくある計算ミスを想定）
function generateNumericWrongAnswers(correct) {
    const wrongs = [];
    
    // 符号ミス（正解が正の場合は負を、負の場合は正を追加）
    if (correct > 0) {
        wrongs.push(-correct);
    } else if (correct < 0) {
        wrongs.push(Math.abs(correct));
    }
    
    // ±1, ±2, ±5 の計算ミス
    const offsets = [1, 2, 5, -1, -2, -5];
    for (const offset of offsets) {
        const wrong = correct + offset;
        if (wrong !== correct && wrong >= 0) {
            wrongs.push(wrong);
        }
    }
    
    // 掛け算ミス（正解がxなら2xやx/2を追加）
    if (correct !== 0) {
        wrongs.push(correct * 2);
        if (correct % 2 === 0) {
            wrongs.push(correct / 2);
        }
    }
    
    // シャッフルして返す
    return shuffleArray(wrongs);
}

// 文字列の誤答を生成（意味のある誤答）
function generateStringWrongAnswers(correct) {
    const wrongs = [];
    const usedAnswers = new Set();
    usedAnswers.add(correct); // 正解を追加して重複を防ぐ
    
    // 文学的技法に関する問題の場合、技法を混ぜた誤答のみを生成（最優先）
    if (isLiteraryTechniqueQuestion(correct)) {
        const literaryWrongs = generateLiteraryTechniqueWrongAnswers(correct);
        for (const wrong of literaryWrongs) {
            if (!usedAnswers.has(wrong)) {
                usedAnswers.add(wrong);
                wrongs.push(wrong);
            }
        }
        return shuffleArray(wrongs);
    }
    
    // 文学的技法でない場合のみ、以下の処理を行う
    // ひらがなの場合、類似したひらがなを生成
    if (isHiragana(correct)) {
        const hiraganaWrongs = generateSimilarHiragana(correct);
        for (const wrong of hiraganaWrongs) {
            if (!usedAnswers.has(wrong)) {
                usedAnswers.add(wrong);
                wrongs.push(wrong);
            }
        }
    }
    // 英語の場合、類似した単語やスペルミスを生成
    else if (isEnglish(correct)) {
        const englishWrongs = generateSimilarEnglish(correct);
        for (const wrong of englishWrongs) {
            if (!usedAnswers.has(wrong)) {
                usedAnswers.add(wrong);
                wrongs.push(wrong);
            }
        }
    }
    // その他の場合、類似した文字列を生成
    else {
        const stringWrongs = generateSimilarStringArray(correct);
        for (const wrong of stringWrongs) {
            if (!usedAnswers.has(wrong)) {
                usedAnswers.add(wrong);
                wrongs.push(wrong);
            }
        }
    }
    
    return shuffleArray(wrongs);
}

// 文学的技法の問題かどうかを判定
function isLiteraryTechniqueQuestion(answer) {
    const literaryKeywords = ['倒置法', '比喩', '反復', '対句', '擬人法', '係り結び', '受動態', '使役態', '尊敬語', '謙譲語'];
    
    // 正解に技法名が含まれている場合
    if (literaryKeywords.some(keyword => answer.includes(keyword))) {
        return true;
    }
    
    // 技法の例文から技法を判定
    const exampleToTechnique = {
        '美しい、この花は': '倒置法',
        'ライオンのように強い': '比喩',
        '走った、走った、走った': '反復',
        '山と川': '対句',
        '天と地': '対句',
        '風がささやく': '擬人法',
        '～けれども、～ので': '係り結び',
        '彼に褒められた': '受動態',
        '彼を行かせた': '使役態',
        'いらっしゃる': '尊敬語',
        'おっしゃる': '尊敬語',
        '参る': '謙譲語',
        '申す': '謙譲語'
    };
    
    for (const [example, technique] of Object.entries(exampleToTechnique)) {
        if (answer.includes(example)) {
            return true;
        }
    }
    
    return false;
}

// 文学的技法の誤答を生成（技法を混ぜるのみ）
function generateLiteraryTechniqueWrongAnswers(correct) {
    const wrongs = [];
    const usedAnswers = new Set();
    usedAnswers.add(correct); // 正解を追加して重複を防ぐ
    
    // 文学的技法のマッピング
    const techniqueMap = {
        '倒置法': ['比喩のように強い', '走った、走った、走った', '山と川、天と地', '風がささやく'],
        '比喩': ['美しい、この花は', '走った、走った、走った', '山と川、天と地', '風がささやく'],
        '反復': ['美しい、この花は', 'ライオンのように強い', '山と川、天と地', '風がささやく'],
        '対句': ['美しい、この花は', 'ライオンのように強い', '走った、走った、走った', '風がささやく'],
        '擬人法': ['美しい、この花は', 'ライオンのように強い', '走った、走った、走った', '山と川、天と地'],
        '係り結び': ['美しい、この花は', 'ライオンのように強い', '走った、走った、走った', '風がささやく'],
        '受動態': ['彼を行かせた', 'いらっしゃる、おっしゃる', '参る、申す', '～けれども、～ので'],
        '使役態': ['彼に褒められた', 'いらっしゃる、おっしゃる', '参る、申す', '～けれども、～ので'],
        '尊敬語': ['彼を行かせた', '彼に褒められた', '参る、申す', '～けれども、～ので'],
        '謙譲語': ['彼を行かせた', '彼に褒められた', 'いらっしゃる、おっしゃる', '～けれども、～ので']
    };
    
    // 例文から技法を判定するマッピング
    const exampleToTechnique = {
        '美しい、この花は': '倒置法',
        'ライオンのように強い': '比喩',
        '走った、走った、走った': '反復',
        '山と川': '対句',
        '天と地': '対句',
        '風がささやく': '擬人法',
        '～けれども、～ので': '係り結び',
        '彼に褒められた': '受動態',
        '彼を行かせた': '使役態',
        'いらっしゃる': '尊敬語',
        'おっしゃる': '尊敬語',
        '参る': '謙譲語',
        '申す': '謙譲語'
    };
    
    let targetTechnique = null;
    
    // 正解に含まれる技法を特定（技法名が含まれている場合）
    for (const [technique, examples] of Object.entries(techniqueMap)) {
        if (correct.includes(technique)) {
            targetTechnique = technique;
            break;
        }
    }
    
    // 技法名が含まれていない場合、例文から技法を判定
    if (!targetTechnique) {
        for (const [example, technique] of Object.entries(exampleToTechnique)) {
            if (correct.includes(example)) {
                targetTechnique = technique;
                break;
            }
        }
    }
    
    // 技法が特定できた場合、その技法の誤答を生成
    if (targetTechnique && techniqueMap[targetTechnique]) {
        for (const example of techniqueMap[targetTechnique]) {
            if (!usedAnswers.has(example)) {
                usedAnswers.add(example);
                wrongs.push(example);
            }
        }
    }
    
    return wrongs;
}


// ひらがなかどうかを判定
function isHiragana(str) {
    return /^[\u3040-\u309F]+$/.test(str);
}

// 英語かどうかを判定
function isEnglish(str) {
    return /^[a-zA-Z\s]+$/.test(str);
}

// 類似したひらがなを生成
function generateSimilarHiragana(hiragana) {
    const similar = [];
    const hiraganaMap = {
        'あ': ['い', 'う', 'え', 'お'],
        'い': ['あ', 'う', 'え', 'お'],
        'う': ['あ', 'い', 'え', 'お'],
        'え': ['あ', 'い', 'う', 'お'],
        'お': ['あ', 'い', 'う', 'え'],
        'か': ['き', 'く', 'け', 'こ'],
        'き': ['か', 'く', 'け', 'こ'],
        'く': ['か', 'き', 'け', 'こ'],
        'け': ['か', 'き', 'く', 'こ'],
        'こ': ['か', 'き', 'く', 'け'],
        'さ': ['し', 'す', 'せ', 'そ'],
        'し': ['さ', 'す', 'せ', 'そ'],
        'す': ['さ', 'し', 'せ', 'そ'],
        'せ': ['さ', 'し', 'す', 'そ'],
        'そ': ['さ', 'し', 'す', 'せ'],
        'た': ['ち', 'つ', 'て', 'と'],
        'ち': ['た', 'つ', 'て', 'と'],
        'つ': ['た', 'ち', 'て', 'と'],
        'て': ['た', 'ち', 'つ', 'と'],
        'と': ['た', 'ち', 'つ', 'て'],
        'な': ['に', 'ぬ', 'ね', 'の'],
        'に': ['な', 'ぬ', 'ね', 'の'],
        'ぬ': ['な', 'に', 'ね', 'の'],
        'ね': ['な', 'に', 'ぬ', 'の'],
        'の': ['な', 'に', 'ぬ', 'ね'],
        'は': ['ひ', 'ふ', 'へ', 'ほ'],
        'ひ': ['は', 'ふ', 'へ', 'ほ'],
        'ふ': ['は', 'ひ', 'へ', 'ほ'],
        'へ': ['は', 'ひ', 'ふ', 'ほ'],
        'ほ': ['は', 'ひ', 'ふ', 'へ'],
        'ま': ['み', 'む', 'め', 'も'],
        'み': ['ま', 'む', 'め', 'も'],
        'む': ['ま', 'み', 'め', 'も'],
        'め': ['ま', 'み', 'む', 'も'],
        'も': ['ま', 'み', 'む', 'め'],
        'や': ['ゆ', 'よ'],
        'ゆ': ['や', 'よ'],
        'よ': ['や', 'ゆ'],
        'ら': ['り', 'る', 'れ', 'ろ'],
        'り': ['ら', 'る', 'れ', 'ろ'],
        'る': ['ら', 'り', 'れ', 'ろ'],
        'れ': ['ら', 'り', 'る', 'ろ'],
        'ろ': ['ら', 'り', 'る', 'れ'],
        'わ': ['を', 'ん'],
        'を': ['わ', 'ん'],
        'ん': ['わ', 'を']
    };
    
    for (let i = 0; i < hiragana.length; i++) {
        const char = hiragana[i];
        const similarChars = hiraganaMap[char] || [];
        for (const similarChar of similarChars) {
            if (similarChar !== char) {
                const newStr = hiragana.substring(0, i) + similarChar + hiragana.substring(i + 1);
                if (newStr !== hiragana && !similar.includes(newStr)) {
                    similar.push(newStr);
                }
            }
        }
    }
    
    return similar;
}

// 類似した英語を生成
function generateSimilarEnglish(english) {
    const similar = [];
    const lowerEnglish = english.toLowerCase();
    
    // よくある単語の関連付け
    const wordAssociations = {
        'red': ['blue', 'green', 'yellow', 'black', 'white'],
        'blue': ['red', 'green', 'yellow', 'sky', 'sea'],
        'green': ['red', 'blue', 'yellow', 'grass', 'leaf'],
        'yellow': ['red', 'blue', 'green', 'orange', 'gold'],
        'black': ['white', 'red', 'blue', 'dark', 'night'],
        'white': ['black', 'red', 'blue', 'light', 'day'],
        'dog': ['cat', 'bird', 'fish', 'animal', 'pet'],
        'cat': ['dog', 'bird', 'fish', 'animal', 'pet'],
        'bird': ['dog', 'cat', 'fish', 'fly', 'sky'],
        'fish': ['dog', 'cat', 'bird', 'swim', 'water'],
        'book': ['pen', 'paper', 'read', 'study', 'library'],
        'school': ['home', 'work', 'study', 'class', 'teacher'],
        'teacher': ['student', 'school', 'class', 'work', 'job'],
        'run': ['walk', 'jump', 'swim', 'fast', 'move'],
        'walk': ['run', 'jump', 'swim', 'slow', 'move'],
        'eat': ['drink', 'cook', 'food', 'meal', 'hungry'],
        'see': ['look', 'watch', 'hear', 'listen', 'view'],
        'hear': ['see', 'listen', 'sound', 'noise', 'speak'],
        'speak': ['hear', 'talk', 'say', 'tell', 'voice'],
        'happy': ['sad', 'glad', 'joy', 'smile', 'fun'],
        'sad': ['happy', 'glad', 'cry', 'tear', 'sorry'],
        'big': ['small', 'large', 'huge', 'tiny', 'little'],
        'small': ['big', 'large', 'tiny', 'little', 'short'],
        'hot': ['cold', 'warm', 'cool', 'fire', 'sun'],
        'cold': ['hot', 'warm', 'cool', 'ice', 'snow'],
        'good': ['bad', 'nice', 'great', 'fine', 'well'],
        'bad': ['good', 'nice', 'evil', 'wrong', 'poor'],
        'fast': ['slow', 'quick', 'rapid', 'speed', 'swift'],
        'slow': ['fast', 'quick', 'rapid', 'lazy', 'late'],
        'like': ['love', 'hate', 'enjoy', 'prefer', 'want'],
        'hate': ['like', 'love', 'dislike', 'angry', 'fear'],
        'if': ['when', 'while', 'because', 'although', 'unless'],
        'when': ['if', 'while', 'because', 'after', 'before'],
        'because': ['if', 'when', 'so', 'since', 'as'],
        'after': ['before', 'when', 'while', 'since', 'next'],
        'before': ['after', 'when', 'while', 'ago', 'previous'],
        'yes': ['no', 'maybe', 'right', 'correct', 'true'],
        'no': ['yes', 'maybe', 'wrong', 'incorrect', 'false']
    };
    
    // 関連単語を追加
    const associations = wordAssociations[lowerEnglish] || [];
    for (const assoc of associations) {
        if (assoc.toLowerCase() !== lowerEnglish && !similar.includes(assoc)) {
            similar.push(assoc);
        }
    }
    
    // スペルミスを生成（1文字変更）
    for (let i = 0; i < english.length; i++) {
        const originalChar = english[i];
        const replacementChars = 'abcdefghijklmnopqrstuvwxyz';
        for (const replacement of replacementChars) {
            if (replacement !== originalChar.toLowerCase()) {
                const misspelled = english.substring(0, i) + replacement + english.substring(i + 1);
                if (misspelled.toLowerCase() !== lowerEnglish && !similar.includes(misspelled)) {
                    similar.push(misspelled);
                    if (similar.length >= 5) break;
                }
            }
        }
        if (similar.length >= 5) break;
    }
    
    return similar;
}

// 類似した文字列配列を生成
function generateSimilarStringArray(str) {
    const similar = [];
    
    // ランダムに1文字変更
    if (str.length > 0) {
        const randomIndex = Math.floor(Math.random() * str.length);
        const replacement = String.fromCharCode(str.charCodeAt(randomIndex) + 1);
        const modified = str.substring(0, randomIndex) + replacement + str.substring(randomIndex + 1);
        if (modified !== str) {
            similar.push(modified);
        }
    }
    
    return similar;
}

// 類似した文字列を生成（単一）
function generateSimilarString(str) {
    if (str.length === 0) return '×';
    
    // ランダムに1文字変更
    const randomIndex = Math.floor(Math.random() * str.length);
    const replacement = String.fromCharCode(str.charCodeAt(randomIndex) + 1);
    return str.substring(0, randomIndex) + replacement + str.substring(randomIndex + 1);
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// ============================================
// スキルシステム（バトル中）
// ============================================

// バトルスキルの初期化
function initializeBattleSkills() {
    try {
        console.log("Initializing battle skills...");
        // プレイヤーデータからスキルツリー情報を取得
        const player = getSavedPlayer();
        if (!player) {
            console.log("Player data not found, skipping skill initialization");
            activeSkills = [];
            renderSkills();
            return;
        }
        
        console.log("Player data found:", player);
        console.log("Player skillSlots:", player.skillSlots);
        
        // スキルデータを初期化（関数が存在する場合のみ）
        if (typeof initializeSkillData === 'function') {
            const initializedPlayer = initializeSkillData(player);
            console.log("Initialized player skill data:", initializedPlayer);
            
            // アクティブスキルを取得
            if (typeof getSkillNodeEffects === 'function') {
                const skillEffects = getSkillNodeEffects(initializedPlayer);
                console.log("Skill effects:", skillEffects);
                
                // カスタムスキルも追加
                const customSkills = initializedPlayer.customSkills || [];
                console.log("Custom skills:", customSkills);
                
                // スキルスロットにあるスキルのみをアクティブスキルとして使用
                const slottedSkills = (initializedPlayer.skillSlots || []).filter(skill => skill !== null);
                console.log("Slotted skills:", slottedSkills);
                activeSkills = [];
                
                // skillEffects.activeに既にカスタムスキルが含まれているため、そのまま使用
                skillEffects.active.forEach(skill => {
                    if (slottedSkills.some(slotted => slotted.id === skill.id)) {
                        activeSkills.push(skill);
                    }
                });
                
                // 重複を削除
                activeSkills = activeSkills.filter((skill, index, self) =>
                    index === self.findIndex((s) => s.id === skill.id)
                );
                
                console.log("Final active skills:", activeSkills);
            } else {
                console.log("getSkillNodeEffects function not found");
                activeSkills = [];
            }
        } else {
            console.log("initializeSkillData function not found");
            activeSkills = [];
        }
        
        // 使用済みスキルリストを初期化
        usedSkills = [];
        
        // スキルスロットをレンダリング
        renderSkills();
    } catch (error) {
        console.error("Error initializing battle skills:", error);
        activeSkills = [];
        usedSkills = [];
        renderSkills();
    }
}

// スキルスロットのレンダリング
function renderSkills() {
    const container = document.getElementById('skillSlotsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (activeSkills.length === 0) {
        container.innerHTML = '<p class="no-skills">アクティブスキルなし</p>';
        return;
    }
    
    activeSkills.forEach(skill => {
        const skillBtn = document.createElement('button');
        skillBtn.className = 'skill-slot';
        skillBtn.dataset.skillId = skill.id;
        
        const isUsed = usedSkills.includes(skill.id);
        const isActive = selectedSkill?.id === skill.id;
        
        skillBtn.innerHTML = `
            <span class="skill-name">${skill.name}</span>
            <span class="skill-desc">${skill.description}</span>
        `;
        
        if (isUsed) {
            skillBtn.classList.add('used');
            skillBtn.disabled = true;
        } else if (isActive) {
            skillBtn.classList.add('active');
        }
        
        skillBtn.onclick = () => activateSkill(skill);
        
        container.appendChild(skillBtn);
    });
}

// スキルのアクティブ化
function activateSkill(skill) {
    if (usedSkills.includes(skill.id)) {
        addLog('このスキルは既に使用済みです');
        return;
    }
    
    if (!skillActivationWindow) {
        addLog('スキルは問題の間の3秒間のみアクティブにできます');
        return;
    }
    
    selectedSkill = skill;
    addLog(`スキル「${skill.name}」をアクティブにしました`);
    
    // スキルボタンの状態を更新
    renderSkills();
}

// スキルボタンの有効/無効化
function enableSkillButtons(enabled) {
    const buttons = document.querySelectorAll('.skill-slot');
    buttons.forEach(btn => {
        if (!btn.classList.contains('used')) {
            btn.disabled = !enabled;
        }
    });
}

// スキルアクティベーションウィンドウの開始
function startSkillActivationWindow() {
    try {
        skillActivationWindow = true;
        enableSkillButtons(true);
        
        // 3秒後にウィンドウを閉じる
        if (skillActivationTimer) {
            clearTimeout(skillActivationTimer);
        }
        
        skillActivationTimer = setTimeout(() => {
            skillActivationWindow = false;
            enableSkillButtons(false);
            
            // アクティブなスキルがあればログに表示
            if (selectedSkill) {
                addLog(`スキル「${selectedSkill.name}」が発動準備完了`);
            }
        }, 3000);
    } catch (error) {
        console.error("Error in skill activation window:", error);
        skillActivationWindow = false;
        enableSkillButtons(false);
    }
}

// スキル効果の適用
function applySkillEffect(damage, attacker, defender, skill) {
    if (!skill || !skill.effect) return damage;
    
    let modifiedDamage = damage;
    const effect = skill.effect;
    
    // ダメージ倍率
    if (effect.damageMultiplier && effect.damageMultiplier !== 1) {
        modifiedDamage = Math.floor(modifiedDamage * effect.damageMultiplier);
        addLog(`スキル効果: ダメージ${effect.damageMultiplier}倍！`);
    }
    
    // 防御貫通/防御無視
    if (effect.pierceDef || effect.ignoreDef) {
        addLog(`スキル効果: 防御を無視！`);
    }
    
    // ライフスティール
    if (effect.lifeSteal) {
        const healAmount = Math.floor(modifiedDamage * effect.lifeSteal);
        attacker.hp = Math.min(attacker.hp + healAmount, attacker.maxHp);
        addLog(`スキル効果: ${healAmount}回復！`);
        updateHP();
    }
    
    // 回復（固定値）
    if (effect.heal) {
        const healAmount = effect.heal;
        attacker.hp = Math.min(attacker.hp + healAmount, attacker.maxHp);
        addLog(`スキル効果: ${healAmount}回復！`);
        updateHP();
    }
    
    // 回復（割合）
    if (effect.healPercent) {
        const healAmount = Math.floor(attacker.maxHp * effect.healPercent);
        attacker.hp = Math.min(attacker.hp + healAmount, attacker.maxHp);
        addLog(`スキル効果: ${healAmount}回復！`);
        updateHP();
    }
    
    // シールド
    if (effect.shield) {
        const shieldAmount = effect.shield;
        if (attacker === me) {
            myShield = (myShield || 0) + shieldAmount;
            addLog(`スキル効果: シールド${shieldAmount}獲得！`);
        }
    }
    
    // 必中
    if (effect.sureHit) {
        addLog(`スキル効果: 攻撃が必中！`);
    }
    
    // クリティカル確定
    if (effect.nextAttackCrit) {
        addLog(`スキル効果: 次の攻撃が必ずクリティカル！`);
    }
    
    // クリティカル率アップ
    if (effect.critChance) {
        addLog(`スキル効果: クリティカル率${effect.critChance * 100}%アップ！`);
    }
    
    // 火傷付与
    if (effect.burn) {
        if (defender === enemy) {
            enemyBurnTurns = 3;
            addLog(`スキル効果: 敵に火傷付与！`);
        }
    }
    
    // 毒付与
    if (effect.poison) {
        if (defender === enemy) {
            enemyPoisonTurns = 3;
            addLog(`スキル効果: 敵に毒付与！`);
        }
    }
    
    // 速度低下
    if (effect.speedDebuff) {
        if (defender === enemy) {
            enemySpeedDebuff = effect.speedDebuff;
            enemySpeedDebuffTurns = 2;
            addLog(`スキル効果: 敵の速度${effect.speedDebuff * 100}%低下！`);
        }
    }

    // 敵の攻撃力低下
    if (effect.enemyAtkDebuff) {
        if (defender === enemy) {
            enemyAtkDebuff = effect.enemyAtkDebuff;
            enemyAtkDebuffTurns = 2;
            addLog(`スキル効果: 敵の攻撃力${effect.enemyAtkDebuff * 100}%低下！`);
        }
    }

    // 敵の防御力低下
    if (effect.enemyDefDebuff) {
        if (defender === enemy) {
            enemyDefDebuff = effect.enemyDefDebuff;
            enemyDefDebuffTurns = 2;
            addLog(`スキル効果: 敵の防御力${effect.enemyDefDebuff * 100}%低下！`);
        }
    }

    // 敵の命中率低下
    if (effect.enemyAccuracyDebuff) {
        if (defender === enemy) {
            enemyAccuracyDebuff = effect.enemyAccuracyDebuff;
            enemyAccuracyDebuffTurns = 2;
            addLog(`スキル効果: 敵の命中率${effect.enemyAccuracyDebuff * 100}%低下！`);
        }
    }

    // 回避率アップ
    if (effect.dodgeChance || effect.evasionChance || effect.evasionBoost) {
        const dodgeValue = effect.dodgeChance || effect.evasionChance || effect.evasionBoost;
        if (attacker === me) {
            myDodgeChance = dodgeValue;
            myDodgeTurns = 2;
            addLog(`スキル効果: 回避率${dodgeValue * 100}%アップ！`);
        }
    }
    
    // 反撃
    if (effect.counter) {
        if (attacker === me) {
            myCounterActive = true;
            myCounterTurns = 2;
            addLog(`スキル効果: 反撃発動準備！`);
        }
    }
    
    // 複数回攻撃
    if (effect.multiHit) {
        if (attacker === me) {
            myMultiHit = effect.multiHit;
            myMultiHitTurns = 1;
            addLog(`スキル効果: ${effect.multiHit}回攻撃！`);
        }
    }
    
    // 自身の防御デバフ
    if (effect.selfDefDebuff) {
        if (attacker === me) {
            myDefDebuff = effect.selfDefDebuff;
            myDefDebuffTurns = 2;
            addLog(`スキル効果: 自身の防御${effect.selfDefDebuff}低下！`);
        }
    }
    
    // ダメージ軽減（次の攻撃に対して）
    if (effect.damageReduction) {
        if (attacker === me) {
            myPendingDamageReduction = effect.damageReduction;
            addLog(`スキル効果: 次のダメージ${effect.damageReduction * 100}%軽減！`);
        }
    }
    
    // 回避率無視
    if (effect.ignoreEvasion) {
        addLog(`スキル効果: 回避率無視！`);
    }
    
    // カウンターアタック（古い互換性）
    if (effect.counterAttack) {
        addLog(`スキル効果: カウンターアタック準備！`);
    }
    
    console.log("Skill effect applied, modified damage:", modifiedDamage);
    return modifiedDamage;
    
    // バーサーク（HPが低い時に強化）
    if (effect.berserk) {
        const hpRatio = attacker.hp / attacker.maxHp;
        if (hpRatio <= 0.5) {
            modifiedDamage = Math.floor(modifiedDamage * effect.berserk);
            addLog(`スキル効果: バーサーク発動！ダメージ${effect.berserk}倍！`);
        }
    }
    
    // エクスキュート（相手HPが低い時に強化）
    if (effect.execute) {
        const hpRatio = defender.hp / defender.maxHp;
        if (hpRatio <= 0.3) {
            modifiedDamage = Math.floor(modifiedDamage * effect.execute);
            addLog(`スキル効果: エクスキュート発動！ダメージ${effect.execute}倍！`);
        }
    }
    
    // 即死確率
    if (effect.instantDeathChance) {
        if (Math.random() < effect.instantDeathChance) {
            defender.hp = 0;
            addLog(`スキル効果: 即死！`);
            updateHP();
            return modifiedDamage;
        }
    }
    
    // カース（相手ステータス低下）
    if (effect.curse) {
        defender.atk = Math.floor(defender.atk * (1 - effect.curse));
        defender.def = Math.floor(defender.def * (1 - effect.curse));
        defender.speed = Math.floor(defender.speed * (1 - effect.curse));
        addLog(`スキル効果: 相手のステータス${effect.curse * 100}%低下！`);
        updateStats();
    }
    
    return modifiedDamage;
}

// ボススキル効果の適用
function applyBossSkillEffect(damage, attacker, defender, skill) {
    if (!skill || !skill.effect) return damage;

    let modifiedDamage = damage;
    const effect = skill.effect;

    addLog(`ボスがスキル「${skill.name}」を使用！`);

    // ダメージ倍率
    if (effect.damageMultiplier) {
        modifiedDamage = Math.floor(modifiedDamage * effect.damageMultiplier);
        addLog(`ボススキル効果: ダメージが${effect.damageMultiplier}倍になった！`);
    }

    // ライフスティール
    if (effect.lifeSteal) {
        const healAmount = Math.floor(modifiedDamage * effect.lifeSteal);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
        addLog(`ボススキル効果: ボスがHPを${healAmount}吸収した！`);
    }

    // プレイヤーへのデバフ
    if (effect.debuff) {
        switch (effect.debuff.type) {
            case 'atk':
                me.atk = Math.floor(me.atk * (1 - effect.debuff.reduction));
                addLog(`ボススキル効果: ${me.name}の攻撃力が低下！`);
                break;
            // ... 他のデバフタイプもここに追加 ...
        }
    }
    return modifiedDamage;
}

// スキル使用後の処理
function afterSkillUse(skill) {
    if (skill && skill.id) {
        usedSkills.push(skill.id);
        selectedSkill = null;
        renderSkills();
    }
}

/**
 * 選択されたスキルを取得し、使用済みとしてマークする準備をします。
 * @returns {object|null} 選択されたスキルオブジェクト、または何も選択されていない場合はnull。
 */
function consumeSelectedSkill() {
    const skillToUse = selectedSkill;
    selectedSkill = null; // 次のターンのために選択をリセット
    // 実際の「使用済み」マーキングは、ターン解決後に行われる afterSkillUse で処理されます。
    return skillToUse;
}

/**
 * スキルの即時効果を適用します（プレースホルダー）。
 * @param {object} skillEffect - スキルの効果オブジェクト。
 */
function applyInstantSkillEffects(skillEffect) {
    // この関数は参照エラーを解決するためのプレースホルダーです。
    // 将来的に、攻撃計算の前に適用されるべき効果（自己ヒール、シールドなど）をここに実装できます。
}

function handleChoiceClick(selectedOption) {
    // Clear boss auto-answer timer if active
    if (bossAutoAnswerTimer) {
        clearTimeout(bossAutoAnswerTimer);
        bossAutoAnswerTimer = null;
    }
    
    // ボタンを無効化
    const buttons = choicesContainer.querySelectorAll('.choice-btn');
    buttons.forEach(btn => btn.disabled = true);
    enableSkillButtons(false); // スキルボタンを無効化
    
    if (isBotBattle) {
        handleBotAnswer(selectedOption);
    } else {
        // サーバーに回答を送信
        socket.emit("battle:submitAnswer", {
            answer: selectedOption,
            // 将来的にスキル使用を実装する場合
            // skillId: selectedSkill ? selectedSkill.id : null
        });
        // 次の問題が表示されるまで待機
        questionDisplay.textContent = "回答送信済み。次の問題を待っています...";
        choicesContainer.innerHTML = '';
    }
}

function calculateBotDifficulty() {
    // プレイヤーのステータス合計値を計算
    const playerAtk = me.atk || 10;
    const playerDef = me.def || 10;
    const playerSpeed = me.speed || 10;
    const playerMaxHp = me.maxHp || 50;
    const playerTotalStats = playerAtk + playerDef + playerSpeed + playerMaxHp;
    
    // ボットのステータス合計値をプレイヤーと同じにする
    const botTotalStats = playerTotalStats;
    
    // ステータスをランダムに振り分ける
    // 最小値を確保するために、各ステータスに最低値を割り当て
    const minAtk = 5;
    const minDef = 5;
    const minSpeed = 5;
    const minMaxHp = 20;
    const reservedStats = minAtk + minDef + minSpeed + minMaxHp;
    
    // 残りのステータスポイント
    let remainingStats = Math.max(0, botTotalStats - reservedStats);
    
    // ランダムに振り分ける
    const randomAtk = Math.floor(Math.random() * remainingStats * 0.3);
    remainingStats -= randomAtk;
    
    const randomDef = Math.floor(Math.random() * remainingStats * 0.3);
    remainingStats -= randomDef;
    
    const randomSpeed = Math.floor(Math.random() * remainingStats * 0.3);
    remainingStats -= randomSpeed;
    
    const randomMaxHp = remainingStats;
    
    // ボットのステータスを設定
    enemy.atk = minAtk + randomAtk;
    enemy.def = minDef + randomDef;
    enemy.speed = minSpeed + randomSpeed;
    enemy.maxHp = minMaxHp + randomMaxHp;
    enemy.hp = enemy.maxHp; // HPを最大値に設定
    
    // 正解率は固定（85%）
    const botAccuracy = 0.85;
    
    return {
        accuracy: botAccuracy,
        statMultiplier: 1.0
    };
}

function generateBotQuestion() {
    console.log("generateBotQuestion called, isBossBattle:", isBossBattle);
    
    // ステータス更新を反映
    updateStats();
    updateHP();
    
    // ボス戦の場合、ボス用の問題を使用
    if (isBossBattle) {
        console.log('[BotBattle] Using boss question system');
        const bossSubjects = ['math', 'jp', 'eng', 'sci', 'soc'];
        const bossSubject = bossSubjects[Math.floor(Math.random() * bossSubjects.length)];
        
        // Use local boss questions for bot battles
        const bossQuestions = getLocalBossQuestions(bossSubject);
        console.log(`[BotBattle] Got ${bossQuestions.length} boss questions for subject=${bossSubject}`);
        
        if (bossQuestions && bossQuestions.length > 0) {
            const randomQuestion = bossQuestions[Math.floor(Math.random() * bossQuestions.length)];
            currentQuestion = { ...randomQuestion, id: Date.now(), subject: bossSubject, subjectDisplayName: getSubjectDisplayName(bossSubject) };
            console.log('[BotBattle] Selected boss question:', currentQuestion);
            
            // 継続効果の処理（火傷・防御低下）
            tickBotBattleStatus();
            if (enemy.hp <= 0) { finishBotBattle("win"); return; }

            showCountdown(() => {
                questionDisplay.textContent = "スキルを選択してください (3秒)";
                choicesContainer.innerHTML = '';
                startSkillActivationWindow();

                setTimeout(() => {
                    questionDisplay.textContent = currentQuestion.question;
                    // 選択肢を生成
                    generateChoices(currentQuestion);
                    startTimer();
                    addLog("問題が出されました！" + (currentQuestion.subjectDisplayName ? "（" + currentQuestion.subjectDisplayName + "）" : ""));
                    
                    // ボス戦の場合、5秒以内にプレイヤーが答えられなければボスが自動で正解する
                    if (isBossBattle) {
                        if (bossAutoAnswerTimer) clearTimeout(bossAutoAnswerTimer);
                        bossAutoAnswerTimer = setTimeout(() => {
                            if (!battleEnd && currentQuestion) { // プレイヤーが時間内に回答できなかった場合
                                console.log('[Boss Auto-Answer] Player timed out. Boss attacks.');
                                addLog(`時間切れ！ ${enemy.name} の攻撃！`);
                                
                                // 選択肢を無効化
                                const buttons = choicesContainer.querySelectorAll('.choice-btn');
                                buttons.forEach(btn => btn.disabled = true);
                                
                                // ボスの攻撃処理
                                let myDef = Math.max(0, (me.def || 0) - myDefDebuff);
                                let botAtk = enemy.atk;
                        
                                // ボススキル使用
                                let bossUsedSkill = null;
                                if (isBossBattle && enemy.skills && enemy.skills.length > 0) {
                                    if (Math.random() < 0.5) { // 50%の確率でスキル使用
                                        bossUsedSkill = enemy.skills[Math.floor(Math.random() * enemy.skills.length)];
                                    }
                                }
                                
                                const defReduction = Math.floor(myDef * 0.1);
                                let damage = Math.max(1, Math.floor(botAtk * 0.5) - defReduction);
                        
                                if (bossUsedSkill) {
                                    damage = applyBossSkillEffect(damage, enemy, me, bossUsedSkill);
                                }
                        
                                // 鉄壁適用
                                if (hasUniqueAbility(me, 'damage_cut_half')) {
                                    damage = Math.floor(damage * 0.5);
                                    addLog("鉄壁発動！ダメージ50%カット");
                                }
                                
                                // ダメージ軽減と回避判定は省略（ボスの攻撃は必中とするなど、ゲームデザインによる）
                                me.hp = Math.max(0, me.hp - damage);
                                showDamage("myDamage", damage);
                                addLog(`${enemy.name}から ${damage} のダメージ！`);
                                
                                updateHP();
                                
                                if (me.hp <= 0) {
                                    finishBotBattle("lose");
                                } else {
                                    setTimeout(generateBotQuestion, 1000);
                                }
                            }
                        }, BOSS_AUTO_ANSWER_TIMEOUT);
                    }
                }, 3000);
            });
            return;
        } else {
            console.warn('[BotBattle] Boss questions not available, falling back to regular questions');
        }
    }
    
    // 学年に応じた問題を生成
    const playerGrade = me.grade || 1;
    const enemyGrade = enemy.grade || 1;
    
    // 学校レベルと学年を判定
    let schoolLevel, grade;
    if (playerGrade <= 6) {
        schoolLevel = 'elementary';
        grade = playerGrade;
    } else if (playerGrade <= 9) {
        schoolLevel = 'junior_high';
        grade = playerGrade - 6;
    } else {
        schoolLevel = 'high_school';
        grade = playerGrade - 9;
    }
    
    // 教科をランダムに選択
    const subjects = ['math', 'jp', 'english'];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    
    // 固定の問題セット（学年と教科に応じた問題）
    const questionsByGrade = {
        elementary: {
            1: {
                math: [
                    { question: "1 + 1 = ?", answer: "2" },
                    { question: "2 + 3 = ?", answer: "5" },
                    { question: "5 - 2 = ?", answer: "3" },
                    { question: "10 - 5 = ?", answer: "5" },
                    { question: "3 + 4 = ?", answer: "7" }
                ],
                jp: [
                    { question: "あいのうえの「あ」は何行？", answer: "あ行" },
                    { question: "「い」の後ろのひらがなは？", answer: "う" },
                    { question: "「か」の後ろのひらがなは？", answer: "き" },
                    { question: "「さ」の後ろのひらがなは？", answer: "し" },
                    { question: "「た」の後ろのひらがなは？", answer: "ち" }
                ],
                english: [
                    { question: "「犬」の英語は？", answer: "dog" },
                    { question: "「猫」の英語は？", answer: "cat" },
                    { question: "「本」の英語は？", answer: "book" },
                    { question: "「学校」の英語は？", answer: "school" },
                    { question: "「先生」の英語は？", answer: "teacher" }
                ]
            },
            2: {
                math: [
                    { question: "7 + 8 = ?", answer: "15" },
                    { question: "15 - 7 = ?", answer: "8" },
                    { question: "9 + 6 = ?", answer: "15" },
                    { question: "20 - 12 = ?", answer: "8" },
                    { question: "5 × 2 = ?", answer: "10" }
                ],
                jp: [
                    { question: "「犬」の読み方は？", answer: "いぬ" },
                    { question: "「猫」の読み方は？", answer: "ねこ" },
                    { question: "「鳥」の読み方は？", answer: "とり" },
                    { question: "「魚」の読み方は？", answer: "さかな" },
                    { question: "「花」の読み方は？", answer: "はな" }
                ],
                english: [
                    { question: "「走る」の英語は？", answer: "run" },
                    { question: "「食べる」の英語は？", answer: "eat" },
                    { question: "「見る」の英語は？", answer: "see" },
                    { question: "「聞く」の英語は？", answer: "hear" },
                    { question: "「話す」の英語は？", answer: "speak" }
                ]
            },
            3: {
                math: [
                    { question: "23 + 47 = ?", answer: "70" },
                    { question: "100 - 35 = ?", answer: "65" },
                    { question: "6 × 7 = ?", answer: "42" },
                    { question: "81 ÷ 9 = ?", answer: "9" },
                    { question: "45 ÷ 5 = ?", answer: "9" }
                ],
                jp: [
                    { question: "「走る」の反対語は？", answer: "止まる" },
                    { question: "「大きい」の反対語は？", answer: "小さい" },
                    { question: "「明るい」の反対語は？", answer: "暗い" },
                    { question: "「新しい」の反対語は？", answer: "古い" },
                    { question: "「高い」の反対語は？", answer: "低い" }
                ],
                english: [
                    { question: "「赤」の英語は？", answer: "red" },
                    { question: "「青」の英語は？", answer: "blue" },
                    { question: "「緑」の英語は？", answer: "green" },
                    { question: "「黄色」の英語は？", answer: "yellow" },
                    { question: "「黒」の英語は？", answer: "black" }
                ]
            },
            4: {
                math: [
                    { question: "345 + 678 = ?", answer: "1023" },
                    { question: "1000 - 456 = ?", answer: "544" },
                    { question: "12 × 8 = ?", answer: "96" },
                    { question: "144 ÷ 12 = ?", answer: "12" },
                    { question: "25 × 4 = ?", answer: "100" }
                ],
                jp: [
                    { question: "「春」の次の季節は？", answer: "夏" },
                    { question: "「月曜日」の次の曜日は？", answer: "火曜日" },
                    { question: "「1月」の次の月は？", answer: "2月" },
                    { question: "「朝」の次は？", answer: "昼" },
                    { question: "「今日」の次は？", answer: "明日" }
                ],
                english: [
                    { question: "「月曜日」の英語は？", answer: "monday" },
                    { question: "「火曜日」の英語は？", answer: "tuesday" },
                    { question: "「水曜日」の英語は？", answer: "wednesday" },
                    { question: "「木曜日」の英語は？", answer: "thursday" },
                    { question: "「金曜日」の英語は？", answer: "friday" }
                ]
            },
            5: {
                math: [
                    { question: "2.5 + 3.7 = ?", answer: "6.2" },
                    { question: "10 - 4.8 = ?", answer: "5.2" },
                    { question: "1.2 × 5 = ?", answer: "6" },
                    { question: "15 ÷ 0.5 = ?", answer: "30" },
                    { question: "3.6 ÷ 1.2 = ?", answer: "3" }
                ],
                jp: [
                    { question: "「国語」の漢字で「くにご」と読む漢字は？", answer: "国" },
                    { question: "「算数」の漢字で「さんすう」と読む漢字は？", answer: "算" },
                    { question: "「理科」の漢字で「りか」と読む漢字は？", answer: "理" },
                    { question: "「社会」の漢字で「しゃかい」と読む漢字は？", answer: "社" },
                    { question: "「音楽」の漢字で「おんがく」と読む漢字は？", answer: "音" }
                ],
                english: [
                    { question: "「1月」の英語は？", answer: "january" },
                    { question: "「2月」の英語は？", answer: "february" },
                    { question: "「3月」の英語は？", answer: "march" },
                    { question: "「4月」の英語は？", answer: "april" },
                    { question: "「5月」の英語は？", answer: "may" }
                ]
            },
            6: {
                math: [
                    { question: "1/2 + 1/3 = ?", answer: "5/6" },
                    { question: "3/4 - 1/4 = ?", answer: "1/2" },
                    { question: "2/3 × 3/4 = ?", answer: "1/2" },
                    { question: "5 ÷ 1/2 = ?", answer: "10" },
                    { question: "1/5 ÷ 2 = ?", answer: "1/10" }
                ],
                jp: [
                    { question: "「友情」の意味に近い言葉は？", answer: "友達" },
                    { question: "「努力」の意味に近い言葉は？", answer: "頑張る" },
                    { question: "「成功」の反対語は？", answer: "失敗" },
                    { question: "「希望」の反対語は？", answer: "絶望" },
                    { question: "「勇気」の意味に近い言葉は？", answer: "勇敢" }
                ],
                english: [
                    { question: "「春」の英語は？", answer: "spring" },
                    { question: "「夏」の英語は？", answer: "summer" },
                    { question: "「秋」の英語は？", answer: "autumn" },
                    { question: "「冬」の英語は？", answer: "winter" },
                    { question: "「季節」の英語は？", answer: "season" }
                ]
            }
        },
        junior_high: {
            1: {
                math: [
                    { question: "-5 + 3 = ?", answer: "-2" },
                    { question: "-2 × -3 = ?", answer: "6" },
                    { question: "10 ÷ -2 = ?", answer: "-5" },
                    { question: "3x + 2x = ?", answer: "5x" },
                    { question: "2(x + 3) = ?", answer: "2x+6" }
                ],
                jp: [
                    { question: "「主語」の例は？", answer: "私,彼,彼女" },
                    { question: "「述語」の例は？", answer: "走る,食べる,見る" },
                    { question: "「修飾語」の例は？", answer: "美しい,速く,静かに" },
                    { question: "「接続詞」の例は？", answer: "そして,しかし,だから" },
                    { question: "「感動詞」の例は？", answer: "あ,おお,まあ" }
                ],
                english: [
                    { question: "「犬」の英語は？", answer: "dog" },
                    { question: "「猫」の英語は？", answer: "cat" },
                    { question: "「本」の英語は？", answer: "book" },
                    { question: "「学校」の英語は？", answer: "school" },
                    { question: "「先生」の英語は？", answer: "teacher" }
                ]
            },
            2: {
                math: [
                    { question: "x² = 16 の解は？", answer: "4,-4" },
                    { question: "2x + 5 = 15 の解は？", answer: "5" },
                    { question: "3x - 7 = 14 の解は？", answer: "7" },
                    { question: "(x + 2)(x - 3) = ?", answer: "x²-x-6" },
                    { question: "x² - 5x + 6 = 0 の解は？", answer: "2,3" }
                ],
                jp: [
                    { question: "「比喩」の例は？", answer: "ライオンのように強い" },
                    { question: "「擬人法」の例は？", answer: "風がささやく" },
                    { question: "「倒置法」の例は？", answer: "美しい、この花は" },
                    { question: "「反復法」の例は？", answer: "走った、走った、走った" },
                    { question: "「対句」の例は？", answer: "山と川,天と地" }
                ],
                english: [
                    { question: "「走る」の現在形は？", answer: "run" },
                    { question: "「食べる」の過去形は？", answer: "ate" },
                    { question: "「行く」の過去形は？", answer: "went" },
                    { question: "「見る」の過去分詞は？", answer: "seen" },
                    { question: "「持っている」の現在完了形は？", answer: "have" }
                ]
            },
            3: {
                math: [
                    { question: "√16 = ?", answer: "4" },
                    { question: "√25 = ?", answer: "5" },
                    { question: "2³ = ?", answer: "8" },
                    { question: "3² = ?", answer: "9" },
                    { question: "sin 30° = ?", answer: "0.5" }
                ],
                jp: [
                    { question: "「係り結び」の例は？", answer: "～けれども、～ので" },
                    { question: "「受動態」の例は？", answer: "彼に褒められた" },
                    { question: "「使役態」の例は？", answer: "彼を行かせた" },
                    { question: "「尊敬語」の例は？", answer: "いらっしゃる,おっしゃる" },
                    { question: "「謙譲語」の例は？", answer: "参る,申す" }
                ],
                english: [
                    { question: "「もし～なら」を表す接続詞は？", answer: "if" },
                    { question: "「～ので」を表す接続詞は？", answer: "because" },
                    { question: "「～の時」を表す接続詞は？", answer: "when" },
                    { question: "「～ながら」を表す接続詞は？", answer: "while" },
                    { question: "「～まで」を表う接続詞は？", answer: "until" }
                ]
            }
        },
        high_school: {
            1: {
                math: [
                    { question: "log₂ 8 = ?", answer: "3" },
                    { question: "log₁₀ 100 = ?", answer: "2" },
                    { question: "2x + 3y = 10, x = 2 の時 y = ?", answer: "2" },
                    { question: "y = 2x + 1 の傾きは？", answer: "2" },
                    { question: "y = -3x + 5 のy切片は？", answer: "5" }
                ],
                jp: [
                    { question: "「枕草子」の作者は？", answer: "清少納言" },
                    { question: "「源氏物語」の作者は？", answer: "紫式部" },
                    { question: "「徒然草」の作者は？", answer: "吉田兼好" },
                    { question: "「方丈記」の作者は？", answer: "鴨長明" },
                    { question: "「奥の細道」の作者は？", answer: "松尾芭蕉" },
                    { question: "「美しい、この花は」で使われている技法は？", answer: "倒置法" },
                    { question: "「ライオンのように強い」で使われている技法は？", answer: "比喩" },
                    { question: "「走った、走った、走った」で使われている技法は？", answer: "反復" },
                    { question: "「山と川、天と地」で使われている技法は？", answer: "対句" },
                    { question: "「風がささやく」で使われている技法は？", answer: "擬人法" },
                    { question: "「～けれども、～ので」で使われている技法は？", answer: "係り結び" },
                    { question: "「彼に褒められた」で使われている技法は？", answer: "受動態" },
                    { question: "「彼を行かせた」で使われている技法は？", answer: "使役態" },
                    { question: "「いらっしゃる、おっしゃる」で使われている技法は？", answer: "尊敬語" },
                    { question: "「参る、申す」で使われている技法は？", answer: "謙譲語" }
                ],
                english: [
                    { question: "「関係代名詞」で使われる単語は？", answer: "which,that,who" },
                    { question: "「現在完了形」の継続を表すのは？", answer: "have+pp" },
                    { question: "「仮定法」で使われる動詞の形は？", answer: "過去形" },
                    { question: "「受動態」の作り方は？", answer: "be過去分詞" },
                    { question: "「不定詞」の名詞的用法は？", answer: "to動詞" }
                ]
            },
            2: {
                math: [
                    { question: "微分 dy/dx (x²) = ?", answer: "2x" },
                    { question: "微分 dy/dx (x³) = ?", answer: "3x²" },
                    { question: "積分 ∫x dx = ?", answer: "x²/2" },
                    { question: "積分 ∫2x dx = ?", answer: "x²" },
                    { question: "cos 0° = ?", answer: "1" }
                ],
                jp: [
                    { question: "「吾輩は猫である」の作者は？", answer: "夏目漱石" },
                    { question: "「走れメロス」の作者は？", answer: "太宰治" },
                    { question: "「城の崎にて」の作者は？", answer: "志賀直哉" },
                    { question: "「羅生門」の作者は？", answer: "芥川龍之介" },
                    { question: "「風立ちぬ」の作者は？", answer: "堀辰雄" }
                ],
                english: [
                    { question: "「話法」の種類は？", answer: "直接,間接" },
                    { question: "「比較」の最上級の作り方は？", answer: "最+est" },
                    { question: "「分詞」の現在分詞は？", answer: "ing" },
                    { question: "「分詞」の過去分詞は？", answer: "ed" },
                    { question: "「動名詞」の形は？", answer: "ing" }
                ]
            },
            3: {
                math: [
                    { question: "∫sin x dx = ?", answer: "-cos x" },
                    { question: "∫cos x dx = ?", answer: "sin x" },
                    { question: "d/dx (eˣ) = ?", answer: "eˣ" },
                    { question: "d/dx (ln x) = ?", answer: "1/x" },
                    { question: "lim (x→0) sin x/x = ?", answer: "1" }
                ],
                jp: [
                    { question: "「山月記」の作者は？", answer: "中島敦" },
                    { question: "「注文の多い料理店」の作者は？", answer: "宮沢賢治" },
                    { question: "「高瀬舟」の作者は？", answer: "森鴎外" },
                    { question: "「舞姫」の作者は？", answer: "森鴎外" },
                    { question: "「こころ」の作者は？", answer: "夏目漱石" }
                ],
                english: [
                    { question: "「仮定法過去」の例は？", answer: "If I were you" },
                    { question: "「仮定法過去完了」の例は？", answer: "If I had known" },
                    { question: "「関係副詞」の例は？", answer: "where,when,why" },
                    { question: "「原形不定詞」の使い方は？", answer: "使役,知覚" },
                    { question: "「間接疑問」の語順は？", answer: "S+V" }
                ]
            }
        }
    };
    
    // 学年と教科に対応する問題を取得
    let questions = [];
    if (questionsByGrade[schoolLevel] && questionsByGrade[schoolLevel][grade]) {
        questions = questionsByGrade[schoolLevel][grade][subject] || [];
    }
    
    // 問題がない場合はデフォルトの問題を使用
    if (questions.length === 0) {
        questions = [
            { question: "1 + 1 = ?", answer: "2" },
            { question: "2 × 3 = ?", answer: "6" }
        ];
    }
    
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    currentQuestion = { ...randomQuestion, id: Date.now(), subject: subject, subjectDisplayName: getSubjectDisplayName(subject) };

    // 継続効果の処理（火傷・防御低下）
    tickBotBattleStatus();
    if (enemy.hp <= 0) { finishBotBattle("win"); return; }

    showCountdown(() => {
        questionDisplay.textContent = "スキルを選択してください (3秒)";
        choicesContainer.innerHTML = '';
        startSkillActivationWindow();

        setTimeout(() => {
            questionDisplay.textContent = currentQuestion.question;
            // 選択肢を生成
            generateChoices(currentQuestion);
            startTimer();
            addLog("問題が出されました！" + (currentQuestion.subjectDisplayName ? "（" + currentQuestion.subjectDisplayName + "）" : ""));
            
            // ボス戦の場合、5秒以内にプレイヤーが答えられなければボスが自動で正解する
            if (isBossBattle) {
                if (bossAutoAnswerTimer) clearTimeout(bossAutoAnswerTimer);
                bossAutoAnswerTimer = setTimeout(() => {
                    if (!battleEnd && currentQuestion) {
                        console.log('[Boss Auto-Answer] Boss auto-answer triggered');
                        // ボスが正解する
                        const bossCorrectAnswer = currentQuestion.answer;
                        addLog(`ボスが正解しました！: ${bossCorrectAnswer}`);
                        handleChoiceClick(bossCorrectAnswer);
                    }
                }, BOSS_AUTO_ANSWER_TIMEOUT);
            }
        }, 3000);
    });
}

function displayQuestion(question) {
    if (!question || !question.question) {
        console.error("Invalid question data:", question);
        addLog("エラー: 無効な問題データです。");
        return;
    }
    currentQuestion = question;

    showCountdown(() => {
        questionDisplay.textContent = currentQuestion.question;
        generateChoices(currentQuestion);
        startTimer();
        const subjectDisplay = currentQuestion.subjectDisplayName || getSubjectDisplayName(currentQuestion.subject);
        addLog("問題が出されました！" + (subjectDisplay ? "（" + subjectDisplay + "）" : ""));
    });
}

// ボット戦の継続効果（火傷・自身の防御低下・敵デバフ）を1ターン分進める
function tickBotBattleStatus() {
    if (enemyBurnTurns > 0) {
        const burnDamage = Math.max(1, Math.floor(enemy.maxHp * 0.05));
        enemy.hp = Math.max(0, enemy.hp - burnDamage);
        enemyBurnTurns--;
        addLog(`火傷ダメージ！${enemy.name}に${burnDamage}のダメージ（残り${enemyBurnTurns}ターン）`);
        updateHP();
    }
    if (enemyPoisonTurns > 0) {
        const poisonDamage = Math.max(1, Math.floor(enemy.maxHp * 0.03));
        enemy.hp = Math.max(0, enemy.hp - poisonDamage);
        enemyPoisonTurns--;
        addLog(`毒ダメージ！${enemy.name}に${poisonDamage}のダメージ（残り${enemyPoisonTurns}ターン）`);
        updateHP();
    }
    if (myDefDebuffTurns > 0) {
        myDefDebuffTurns--;
        if (myDefDebuffTurns === 0) {
            myDefDebuff = 0;
            addLog("防御低下から回復した。");
        }
    }
    // 敵のデバフターンを減らす
    if (enemySpeedDebuffTurns > 0) {
        enemySpeedDebuffTurns--;
        if (enemySpeedDebuffTurns === 0) {
            enemySpeedDebuff = 0;
            addLog("敵の速度低下が回復した。");
        }
    }
    if (enemyAtkDebuffTurns > 0) {
        enemyAtkDebuffTurns--;
        if (enemyAtkDebuffTurns === 0) {
            enemyAtkDebuff = 0;
            addLog("敵の攻撃力低下が回復した。");
        }
    }
    if (enemyDefDebuffTurns > 0) {
        enemyDefDebuffTurns--;
        if (enemyDefDebuffTurns === 0) {
            enemyDefDebuff = 0;
            addLog("敵の防御力低下が回復した。");
        }
    }
    if (enemyAccuracyDebuffTurns > 0) {
        enemyAccuracyDebuffTurns--;
        if (enemyAccuracyDebuffTurns === 0) {
            enemyAccuracyDebuff = 0;
            addLog("敵の命中率低下が回復した。");
        }
    }
}

function handleBotAnswer(userAnswer) {
    let usedSkill = null;
    // consumeSelectedSkill が定義されているか確認し、未定義の場合は警告を出す
    if (typeof consumeSelectedSkill === 'function') {
        usedSkill = consumeSelectedSkill();
    } else {
        // このエラーは、古いJSファイルがキャッシュされている場合に発生する可能性が高いです
        console.error("Critical Error: consumeSelectedSkill() is not defined. This might be a caching issue. Please clear your browser cache and reload (Ctrl+Shift+R).");
    }
    const skillEffect = (usedSkill && usedSkill.effect) || {};
    applyInstantSkillEffects(skillEffect);
    // このスキルを使用済みとして記録し、戦闘中は再度使用できないようにする
    if (usedSkill) {
        afterSkillUse(usedSkill);
    }

    const isCorrect = userAnswer.trim() === currentQuestion.answer;
    const answerTime = Date.now() - questionStartTime;

    if (isCorrect) {
        addLog("正解！回答時間: " + (answerTime / 1000).toFixed(2) + "秒");
        showCorrectEffect();
        
        // 必殺技ゲージの初期化（存在しない場合）
        if (!me.ultimateGauge) {
            me.ultimateGauge = { current: 0, max: 100 };
        }
        if (!enemy.ultimateGauge) {
            enemy.ultimateGauge = { current: 0, max: 100 };
        }
        
        // 必殺技ゲージを増加
        me.ultimateGauge.current = Math.min(me.ultimateGauge.max, me.ultimateGauge.current + 20);
        updateUltimateGauge();

        let attackerAtk = me.atk;

        // 敵の攻撃デバフ適用（自分が攻撃する場合）
        if (enemyAtkDebuff > 0) {
            // 敵の攻撃デバフは敵の攻撃力に適用されるので、ここでは適用しない
            // 敵の攻撃デバフは敵が攻撃する時に適用される
        }

        if (me.hp === 1 && hasUniqueAbility(me, 'guts')) {
            attackerAtk = Math.floor(attackerAtk * 3);
            addLog(`${me.name}の攻撃力が根性で3倍に！`);
        }
        
        // 必殺技名を取得
        const ultimateName = getWeaponUltimateName(me.equippedWeapon);
        if (me.ultimateGauge.current >= me.ultimateGauge.max) {
            addLog("必殺技ゲージMAX！次の正解で「" + ultimateName + "」発動！");
        }
        
        // ユニーク能力適用
        let enemyDef = enemy.def || 0;

        // 敵の防御デバフ適用
        if (enemyDefDebuff > 0) {
            enemyDef = Math.floor(enemyDef * (1 - enemyDefDebuff));
        }

        // 貫通
        if (hasUniqueAbility(me, 'ignore_def_half')) {
            enemyDef = Math.floor(enemyDef * 0.5);
        }

        // スキルによる防御無視
        if (skillEffect.ignoreDef) {
            enemyDef = 0;
            addLog("相手の防御を無視した！");
        }
        
        const defReduction = Math.floor(enemyDef * 0.1); // ダメージ計算式がatk*0.5と低めなので、防御効果も低めに
        let damage = Math.max(1, Math.floor(attackerAtk * 0.5) - defReduction);
        
        // ★★★デバッグ武器のチェック★★★
        if (hasUniqueAbility(me, 'one_shot_kill')) {
            addLog(`デバッグ武器の効果発動！「${me.equippedWeapon.name}」！`);
            damage = enemy.maxHp * 999; // 相手の最大HP以上のダメージを与える
            skillEffect.sureHit = true; // 必中効果を強制
        }

        // 素早さによる補正（45%回避まで、それ以降は攻撃少しアップ）
        const mySpeed = me.speed || 0;
        const dodgeChance = calculateDodgeChance(mySpeed);
        
        // 45%を超える分は攻撃ボーナスに変換
        if (mySpeed > 7500) {
            const excessSpeed = mySpeed - 7500;
            const attackBonus = Math.floor(excessSpeed * 0.001); // 超過分の0.1%を攻撃ボーナス
            damage += attackBonus;
        }
        
        // 必殺技発動判定（ゲージが満タンの場合）
        let ultimateActivated = false;
        if (me.ultimateGauge.current >= me.ultimateGauge.max) {
            damage = Math.floor(damage * 1.5);
            ultimateActivated = true;
            addLog("必殺技「" + ultimateName + "」発動！ダメージ1.5倍！");
            showUltimateEffect();
            // 必殺技発動後、ゲージをリセット
            me.ultimateGauge.current = 0;
            updateUltimateGauge();
        }
        
        // 必殺（20%の確率でダメージ1.5倍）
        if (hasUniqueAbility(me, 'critical_damage') && Math.random() < 0.20) {
            damage = Math.floor(damage * 1.5);
            addLog("必殺発動！ダメージ1.5倍！");
        }
        
        // スキル効果を適用（新しいスキルシステム）
        damage = applySkillEffect(damage, me, enemy, usedSkill);
        
        // 多段攻撃（新しいmyMultiHitシステムと統合）
        const multiHitCount = myMultiHit > 0 ? myMultiHit : 1;
        if (multiHitCount > 1) {
            const perHitRate = 0.6;
            damage = Math.max(1, Math.floor(damage * perHitRate)) * multiHitCount;
            addLog(`${multiHitCount}連撃！`);
            
            // myMultiHitターンを減らす
            if (myMultiHit > 0) {
                myMultiHitTurns--;
                if (myMultiHitTurns <= 0) {
                    myMultiHit = 0;
                }
            }
        }
        
        // 「行動できない」デメリット
        if (mySkipThisTurn) {
            mySkipThisTurn = false;
            damage = 0;
            addLog(`${me.name}は身を固めていて攻撃できない！`);
        }
        
        // 回避判定（敵の回避率）
        const enemyDodgeChance = calculateDodgeChance(enemy.speed);
        const dodgeRoll = Math.random() * 100;
        if (damage <= 0) {
            showDamage("enemyDamage", 0);
        } else if (!skillEffect.sureHit && dodgeRoll < enemyDodgeChance) {
            showDamage("enemyDamage", 0);
            addLog("回避！ダメージなし");
            damage = 0;
        } else {
            if (skillEffect.sureHit && dodgeRoll < enemyDodgeChance) {
                addLog("必中効果で回避を許さなかった！");
            }
            if (enemy.hp - damage <= 0 && enemy.hp > 1 && hasUniqueAbility(enemy, 'guts')) {
                enemy.hp = 1;
                addLog(`${enemy.name}は根性で持ちこたえた！`);
            } else {
                enemy.hp = Math.max(0, enemy.hp - damage);
            }
            showDamage("enemyDamage", damage);
            addLog("ボットにダメージ: " + damage);
        }
        
        // スキルによるHP吸収
        if (skillEffect.lifeSteal && damage > 0) {
            const stolen = Math.floor(damage * skillEffect.lifeSteal);
            if (stolen > 0) {
                me.hp = Math.min(me.maxHp, me.hp + stolen);
                addLog(`HP吸収！${stolen}回復`);
            }
        }
        
        // ライフドレイン（与えたダメージの20%分回復）
        if (hasUniqueAbility(me, 'life_drain') && damage > 0) {
            const healAmount = Math.floor(damage * 0.2);
            me.hp = Math.min(me.maxHp, me.hp + healAmount);
            addLog("ライフドレイン発動！" + healAmount + "回復");
        }
        
        updateHP();
        updateUltimateGauge();
        
        // 勝利判定
        if (enemy.hp <= 0) {
            finishBotBattle("win");
        } else {
            // 即座に次の問題へ
            setTimeout(generateBotQuestion, 1000);
        }
    } else {
        addLog("不正解...");
        
        // 不正解時、即座にダメージを受ける
        let myDef = Math.max(0, (me.def || 0) - myDefDebuff);
        const defReduction = Math.floor(myDef * 0.1);
        let damage = Math.max(1, Math.floor(enemy.atk * 0.5) - defReduction);
        
        // 鉄壁（相手からの攻撃のダメージ50%カット）
        if (hasUniqueAbility(me, 'damage_cut_half')) {
            damage = Math.floor(damage * 0.5);
            addLog("鉄壁発動！ダメージ50%カット");
        }
        
        // スキルによるダメージ軽減
        damage = applyIncomingDamageReduction(damage);
        
        // 回避判定（プレイヤーの回避率）
        const myDodgeChance = calculateDodgeChance(me.speed);
        const dodgeRoll = Math.random() * 100;
        if (dodgeRoll < myDodgeChance) {
            showDamage("myDamage", 0);
            addLog("回避！ダメージなし");
        } else {
            if (me.hp - damage <= 0 && me.hp > 1 && hasUniqueAbility(me, 'guts')) {
                me.hp = 1;
                addLog(`${me.name}は根性で持ちこたえた！`);
            } else {
                me.hp = Math.max(0, me.hp - damage);
            }
            showDamage("myDamage", damage);
            addLog("ダメージを受けた: " + damage);
        }
        
        updateHP();
        
        // 勝利判定
        if (me.hp <= 0) {
            finishBotBattle("lose");
            return;
        }
        
        // ボットが回答するチャンス
        setTimeout(() => {
            const botAnswerTime = Math.random() * 2000 + 500; // 0.5-2.5秒に短縮
            let botAccuracy = botDifficulty ? botDifficulty.accuracy : 0.85; // 計算された正解率を使用

            // 敵の命中率デバフ適用
            if (enemyAccuracyDebuff > 0) {
                botAccuracy = Math.max(0.1, botAccuracy * (1 - enemyAccuracyDebuff));
            }

            const botIsCorrect = Math.random() < botAccuracy;

            if (botIsCorrect) {
                addLog("ボットが正解！回答時間: " + (botAnswerTime / 1000).toFixed(2) + "秒");
                
                // ユニーク能力適用（防御側）
                let myDef = Math.max(0, (me.def || 0) - myDefDebuff);

                let botAtk = enemy.atk;

                // 敵の攻撃デバフ適用
                if (enemyAtkDebuff > 0) {
                    botAtk = Math.floor(botAtk * (1 - enemyAtkDebuff));
                }

                if (enemy.hp === 1 && hasUniqueAbility(enemy, 'guts')) {
                    botAtk = Math.floor(botAtk * 3);
                    addLog(`${enemy.name}の攻撃力が根性で3倍に！`);
                }
                
                const defReduction = Math.floor(myDef * 0.1);
                let damage = Math.max(1, Math.floor(botAtk * 0.5) - defReduction);
                
                // Boss skill usage logic
                let bossUsedSkill = null;
                if (isBossBattle && enemy.skills && enemy.skills.length > 0) {
                    // 50% chance to use a skill
                    if (Math.random() < 0.5) {
                        bossUsedSkill = enemy.skills[Math.floor(Math.random() * enemy.skills.length)];
                        damage = applyBossSkillEffect(damage, enemy, me, bossUsedSkill);
                    }
                }

                // 素早さによる補正（ボット側）
                const enemyDodgeChance = calculateDodgeChance(enemy.speed);
                
                // 45%を超える分は攻撃ボーナスに変換
                if (enemy.speed > 7500) {
                    const excessSpeed = enemy.speed - 7500;
                    const attackBonus = Math.floor(excessSpeed * 0.001);
                    damage += attackBonus;
                }
                
                // 鉄壁適用
                if (hasUniqueAbility(me, 'damage_cut_half')) {
                    damage = Math.floor(damage * 0.5);
                    addLog("鉄壁発動！ダメージ50%カット");
                }
                
                // スキルによるダメージ軽減
                damage = applyIncomingDamageReduction(damage);
                
                // 回避判定（プレイヤーの回避率）
                const myDodgeChance = calculateDodgeChance(me.speed);
                const dodgeRoll = Math.random() * 100;
                if (dodgeRoll < myDodgeChance) {
                    showDamage("myDamage", 0);
                    addLog("回避！ダメージなし");
                } else {
                    if (me.hp - damage <= 0 && me.hp > 1 && hasUniqueAbility(me, 'guts')) {
                        me.hp = 1;
                        addLog(`${me.name}は根性で持ちこたえた！`);
                    } else {
                        me.hp = Math.max(0, me.hp - damage);
                    }
                    showDamage("myDamage", damage);
                    addLog("ボットからのダメージ: " + damage);
                }
                
                updateHP();
                
                // 勝利判定
                if (me.hp <= 0) {
                    finishBotBattle("lose");
                } else {
                    // 即座に次の問題へ
                    setTimeout(generateBotQuestion, 1000);
                }
            } else {
                addLog("ボットは不正解...");
                // 両方不正解の場合、次の問題へ
                setTimeout(generateBotQuestion, 1000);
            }
        }, 500);
    }
}

function finishBotBattle(result) {
    if (battleEnd) return;
    battleEnd = true;
    if (timerInterval) clearInterval(timerInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (bossAutoAnswerTimer) clearTimeout(bossAutoAnswerTimer);

    const buttons = choicesContainer.querySelectorAll('.choice-btn');
    buttons.forEach(btn => btn.disabled = true);

    const win = result === "win";
    addLog(win ? I18N.victory : I18N.defeat);

    console.log(`[Battle] finishBotBattle: result=${result}, win=${win}, equippedWeapon=${me.equippedWeapon?.name}, isBossBattle=${isBossBattle}`);

    localStorage.setItem("battleResult", win ? "win" : "lose");
    localStorage.setItem("playerHP", String(me.hp));
    localStorage.setItem("enemyHP", String(enemy.hp));
    // デバッグ武器は奪えない
    if (win && enemy.equippedWeapon && !enemy.equippedWeapon.isDebugWeapon) {
        localStorage.setItem("stolenWeapon", JSON.stringify(enemy.equippedWeapon));
    }
    localStorage.removeItem("rewardsApplied"); // 報酬フラグをクリア（次のバトルのために）

    setTimeout(() => location.href = "result.html", 2000);
}

function showCountdown(callback) {
    let count = 3;
    questionDisplay.textContent = count;
    questionDisplay.style.fontSize = "3rem";
    questionDisplay.style.fontWeight = "bold";
    questionDisplay.style.textAlign = "center";

    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            questionDisplay.textContent = count;
        } else if (count === 0) {
            questionDisplay.textContent = "GO!!";
            questionDisplay.style.color = "#ff6b6b";
        } else {
            clearInterval(countdownInterval);
            questionDisplay.style.fontSize = "";
            questionDisplay.style.fontWeight = "";
            questionDisplay.style.textAlign = "";
            questionDisplay.style.color = "";
            callback();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function syncBattleState(stateUpdate) {
    console.log("syncBattleState called with stateUpdate:", stateUpdate);

    for (const id in stateUpdate) {
        const data = stateUpdate[id];
        if (id === me.id) {
            // 自分
            if (data.hp !== undefined) me.hp = data.hp;
            if (data.maxHp !== undefined) me.maxHp = data.maxHp;
            if (data.ultimateGauge !== undefined) me.ultimateGauge = data.ultimateGauge;
        } else if (id === enemy.id) {
            // 敵
            if (data.hp !== undefined) enemy.hp = data.hp;
            if (data.maxHp !== undefined) enemy.maxHp = data.maxHp;
            if (data.ultimateGauge !== undefined) enemy.ultimateGauge = data.ultimateGauge;
        } else {
            // 味方
            const ally = allies.find(a => a.id === id);
            if (ally) {
                if (data.hp !== undefined) ally.hp = data.hp;
                if (data.maxHp !== undefined) ally.maxHp = data.maxHp;
            }
        }
    }
    
    console.log("Synced me.hp:", me.hp, "me.maxHp:", me.maxHp);
    console.log("Synced enemy.hp:", enemy.hp, "enemy.maxHp:", enemy.maxHp);
    
    localStorage.setItem("battlePlayer", JSON.stringify(me));
    localStorage.setItem("enemy", JSON.stringify(enemy));
    updateHP();
    updateUltimateGauge();
    
    // HPが0になった場合は即座にバトル終了チェック
    if (me.hp <= 0 || enemy.hp <= 0) {
        // 終了処理はサーバーからの'battle:finished'イベントに任せる
        console.log("HP reached zero, waiting for server to finish battle.");
    }
}

function finishBattle(winner) {
    if (battleEnd) return;
    battleEnd = true;
    stopTimer();
    
    const buttons = choicesContainer.querySelectorAll('.choice-btn');
    buttons.forEach(btn => btn.disabled = true);

    const win = winner === me.id;
    addLog(win ? I18N.victory : I18N.defeat);
    
    localStorage.setItem("battleResult", win ? "win" : "lose");
    localStorage.setItem("playerHP", String(me.hp));
    localStorage.setItem("enemyHP", String(enemy.hp));

    // デバッグ武器のみ奪えない
    if (win && enemy.equippedWeapon && !enemy.equippedWeapon.isDebugWeapon) {
        localStorage.setItem("stolenWeapon", JSON.stringify(enemy.equippedWeapon));
    } else if (!win && me.equippedWeapon && !me.equippedWeapon.isDebugWeapon) {
        localStorage.setItem("lostWeapon", JSON.stringify(me.equippedWeapon));
    }
    
    localStorage.removeItem("rewardsApplied"); // 報酬フラグをクリア（次のバトルのために）
    
    setTimeout(() => location.href = "result.html", 2500);
}

if (!isBotBattle && socket) {
    let isFirstConnection = true;
    
    socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
        addLog("サーバーに接続しました");
        
        // 初回接続時のみ、既存のバトルに再参加を試みる
        if (!isFirstConnection && roomId && me && me.id) {
            const p = getSavedPlayer();
            socket.emit("rejoinBattle", { roomId, oldPlayerId: me.id, player: p || me });
        }
        isFirstConnection = false;
    });

    socket.on("disconnect", () => {
        console.log("Socket disconnected");
        addLog("接続が切れました。再接続中...");
        
        // 自動的に再接続を試みる
        setTimeout(() => {
            if (!socket.connected) {
                addLog("再接続を試みています...");
                socket.connect();
            }
        }, 3000);
    });

    socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        addLog("接続エラー: " + error.message);
    });

    socket.on("reconnect", (attemptNumber) => {
        console.log("Socket reconnected after", attemptNumber, "attempts");
        addLog("再接続に成功しました");
        
        // 再接続後にバトルに再参加
        if (roomId && me && me.id) {
            const p = getSavedPlayer();
            socket.emit("rejoinBattle", { roomId, oldPlayerId: me.id, player: p || me });
        }
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
        console.log("Reconnect attempt:", attemptNumber);
    });

    socket.on("reconnect_failed", () => {
        console.error("Reconnect failed");
        addLog("再接続に失敗しました。ページを再読み込みしてください。");
        alert("サーバーへの再接続に失敗しました。ページを再読み込みしてください。");
    });

    // ハートビートで接続を監視
    setInterval(() => {
        if (socket && !socket.connected) {
            console.warn("Socket disconnected, attempting to reconnect...");
            addLog("接続が切れています。再接続を試みます...");
        }
    }, 5000);

    socket.on("battleRejoined", data => {
        me = data.me;
        enemy = data.enemy;
        rejoined = true;
        localStorage.setItem("battlePlayer", JSON.stringify(me));
        localStorage.setItem("enemy", JSON.stringify(enemy));
        updateStats();
        updateHP();
        addLog(I18N.reconnected);
    });

    socket.on("rejoinFailed", data => {
        alert(data && data.reason === "battle_finished" ? I18N.battleAlreadyEnd : I18N.rejoinFailed);
        location.href = "index.html";
    });

    // サーバーからの初期状態を受け取る
    socket.on('battle:initialState', (data) => {
        console.log('battle:initialState received', data);
        me = data.me;
        enemy = data.enemy;
        allies = data.allies || [];
        
        // UIを初期化
        renderPartyStatus();
        updateStats();
        updateHP();
        updateUltimateGauge();
        
        // 最初の問題を表示
        displayQuestion(data.question);
    });

    // サーバーからのリアルタイム更新を受け取る
    socket.on('battle:update', (data) => {
        console.log('battle:update received', data);

        if (data.logs && Array.isArray(data.logs)) {
            data.logs.forEach(logMsg => addLog(logMsg));
        }

        if (data.damageEvents && Array.isArray(data.damageEvents)) {
            data.damageEvents.forEach(event => {
                let damageElId;
                if (event.targetId === me.id) {
                    damageElId = 'myDamage';
                } else if (event.targetId === enemy.id) {
                    damageElId = 'enemyDamage';
                } else {
                    damageElId = `allyDamage-${event.targetId}`;
                }
                showDamage(damageElId, event.dodged ? 0 : event.damage);
            });
        }
        
        if (data.effectEvents && Array.isArray(data.effectEvents)) {
            data.effectEvents.forEach(event => {
                if (event.type === 'ultimate' && (event.playerId === me.id || event.playerId === enemy.id || allies.some(a => a.id === event.playerId))) {
                    showUltimateEffect();
                }
                if (event.type === 'correct' && event.playerId === me.id) {
                    showCorrectEffect();
                }
            });
        }

        if (data.stateUpdate) {
            syncBattleState(data.stateUpdate);
        }

        if (data.nextQuestion && data.nextQuestion.forPlayerId === me.id) {
            displayQuestion(data.nextQuestion.question);
        }
    });

    socket.on('battle:finished', (data) => {
        if (data.draw) {
            addLog("引き分け！");
            localStorage.setItem("battleResult", "draw");
        } else {
            finishBattle(data.winner);
        }
    });

    socket.on("answerError", data => {
        addLog("エラー: " + data.message);
        const buttons = choicesContainer.querySelectorAll('.choice-btn');
        buttons.forEach(btn => btn.disabled = false);
    });

    socket.on("opponentLeft", () => {
        addLog("相手との接続が切れました。再接続を待っています...");
        
        // バトルを終了せず、再接続を待つ
        // 相手が再接続した場合はbattleRejoinedイベントが来る
        setTimeout(() => {
            if (!rejoined) {
                battleEnd = true;
                stopTimer();
                alert(I18N.opponentLeft);
                location.href = "index.html";
            }
        }, 15000); // 15秒待つ
    });
}

function getSavedPlayer() {
    const raw = localStorage.getItem("player");
    if (!raw) return null;
    const player = JSON.parse(raw);
    // Simple migration without external dependencies
    if (!player.id) player.id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
    if (player.coins == null) player.coins = 0;
    if (!player.weapons) player.weapons = [];
    if (!player.weaponWins) player.weaponWins = {};
    if (!player.orbs) player.orbs = [];
    return player;
}

window.onload = () => initialize();
