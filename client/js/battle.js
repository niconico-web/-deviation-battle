const isBotBattle = localStorage.getItem("isBotBattle") === "true";
const socket = isBotBattle ? null : io();
const roomId = localStorage.getItem("roomId");
let me = JSON.parse(localStorage.getItem("battlePlayer")), enemy = JSON.parse(localStorage.getItem("enemy"));
let battleEnd = false, rejoined = false, currentQuestion = null, questionStartTime = null, timerInterval = null, countdownInterval = null;

// ソケットが存在しない場合の安全対策
if (socket) {
    socket.connected = false;
}

const turnText = document.getElementById("turnText");
const myName = document.getElementById("myName");
const enemyName = document.getElementById("enemyName");
const myHPBar = document.getElementById("myHPBar");
const enemyHPBar = document.getElementById("enemyHPBar");
const myHPText = document.getElementById("myHPText");
const enemyHPText = document.getElementById("enemyHPText");
const myAtk = document.getElementById("myAtk");
const myDef = document.getElementById("myDef");
const mySpeed = document.getElementById("mySpeed");
const myGrade = document.getElementById("myGrade");
const enemyAtk = document.getElementById("enemyAtk");
const enemyDef = document.getElementById("enemyDef");
const enemySpeed = document.getElementById("enemySpeed");
const enemyGrade = document.getElementById("enemyGrade");
const questionDisplay = document.getElementById("questionDisplay");
const answerInput = document.getElementById("answerInput");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");
const timerDisplay = document.getElementById("timer");
const log = document.getElementById("log");

function statLabel(k, v) {
    return I18N[k] + I18N.colon + v;
}

function initialize() {
    if (!me || !enemy) {
        alert(I18N.noBattleData);
        location.href = "index.html";
        return;
    }

    console.log("Battle initialize:", { me, enemy, roomId, isBotBattle });
    console.log("Socket exists:", !!socket);
    console.log("Socket connected:", socket ? socket.connected : "N/A");
    console.log("Socket ID:", socket ? socket.id : "N/A");

    myName.textContent = me.name;
    enemyName.textContent = enemy.name;
    updateStats();
    updateHP();
    addLog(I18N.battleBegin);

    if (isBotBattle) {
        startBotBattle();
    } else {
        if (!socket) {
            addLog("エラー: ソケットが初期化されていません");
            alert("ソケット接続エラーが発生しました。ページを再読み込みしてください。");
            return;
        }
        
        // ソケット接続を待つ
        if (!socket.connected) {
            addLog("サーバー接続待機中...");
            socket.once("connect", () => {
                console.log("Socket connected, starting battle");
                startOnlineBattle();
            });
            
            // 接続タイムアウト
            setTimeout(() => {
                if (!socket.connected) {
                    addLog("エラー: サーバーに接続できませんでした");
                    alert("サーバーに接続できませんでした。ページを再読み込みしてください。");
                }
            }, 5000);
        } else {
            startOnlineBattle();
        }
    }
}

function startOnlineBattle() {
    console.log("Starting online battle for room:", roomId);
    addLog("バトル開始をリクエスト中...");
    
    // 直接バトル開始をリクエスト（ルーム参加はサーバー側で処理）
    socket.emit("requestBattleStart", { roomId });
    
    // タイムアウト処理
    setTimeout(() => {
        if (!currentQuestion) {
            addLog("エラー: バトル開始の応答がありません");
            console.error("No battleStarted response received");
        }
    }, 10000);
}

function updateStats() {
    myAtk.textContent = statLabel("atk", me.atk);
    myDef.textContent = statLabel("def", me.def);
    mySpeed.textContent = statLabel("speed", me.speed);
    myGrade.textContent = "学年" + I18N.colon + (me.grade || 1);
    
    enemyAtk.textContent = statLabel("atk", enemy.atk);
    enemyDef.textContent = statLabel("def", enemy.def);
    enemySpeed.textContent = statLabel("speed", enemy.speed);
    enemyGrade.textContent = "学年" + I18N.colon + (enemy.grade || 1);
}

function updateHP() {
    myHPText.textContent = "HP " + me.hp + " / " + me.maxHp;
    enemyHPText.textContent = "HP " + enemy.hp + " / " + enemy.maxHp;
    myHPBar.style.width = (me.hp / me.maxHp * 100) + "%";
    enemyHPBar.style.width = (enemy.hp / enemy.maxHp * 100) + "%";
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
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
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
    generateBotQuestion();
}

function generateBotQuestion() {
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
                    { question: "「係り結び」の例は？", answer: "～けれども,～ので" },
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
                    { question: "「奥の細道」の作者は？", answer: "松尾芭蕉" }
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
    currentQuestion = { ...randomQuestion, id: Date.now(), subject: subject };

    showCountdown(() => {
        questionDisplay.textContent = currentQuestion.question;
        startTimer();
        addLog("問題が出されました！（" + subject.toUpperCase() + "）");
        answerInput.disabled = false;
        submitAnswerBtn.disabled = false;
        answerInput.focus();
    });
}

function handleBotAnswer(userAnswer) {
    const isCorrect = userAnswer.trim() === currentQuestion.answer;
    const answerTime = Date.now() - questionStartTime;

    if (isCorrect) {
        addLog("正解！回答時間: " + (answerTime / 1000).toFixed(2) + "秒");
        
        // ユニーク能力適用
        let enemyDef = enemy.def || 0;
        let enemyAtk = enemy.atk || 0;
        let enemySpeed = enemy.speed || 0;
        let enemyMaxHp = enemy.maxHp || 0;
        
        // リ・ミゼラブル（相手の全ステータスを0.8倍）
        if (me.equippedWeapon && me.equippedWeapon.uniqueAbilities) {
            const hasReMiserable = me.equippedWeapon.uniqueAbilities.some(a => a.effect === "enemy_stat_debuff");
            if (hasReMiserable) {
                enemyDef = Math.floor(enemyDef * 0.8);
                enemyAtk = Math.floor(enemyAtk * 0.8);
                enemySpeed = Math.floor(enemySpeed * 0.8);
                enemyMaxHp = Math.floor(enemyMaxHp * 0.8);
            }
        }
        
        // 貫通（相手の防御ステータスを50%減らす）
        if (me.equippedWeapon && me.equippedWeapon.uniqueAbilities) {
            const hasPenetration = me.equippedWeapon.uniqueAbilities.some(a => a.effect === "ignore_def_half");
            if (hasPenetration) {
                enemyDef = Math.floor(enemyDef * 0.5);
            }
        }
        
        const defReduction = Math.floor(enemyDef * 0.1);
        let damage = Math.max(1, Math.floor(me.atk * 0.5) - defReduction);
        
        // 必殺（20%の確率でダメージ1.5倍）
        if (me.equippedWeapon && me.equippedWeapon.uniqueAbilities) {
            const hasCritical = me.equippedWeapon.uniqueAbilities.some(a => a.effect === "critical_damage");
            if (hasCritical && Math.random() < 0.20) {
                damage = Math.floor(damage * 1.5);
                addLog("必殺発動！ダメージ1.5倍！");
            }
        }
        
        enemy.hp = Math.max(0, enemy.hp - damage);
        showDamage("enemyDamage", damage);
        addLog("ボットにダメージ: " + damage);
        
        // ライフドレイン（与えたダメージの20%分回復）
        if (me.equippedWeapon && me.equippedWeapon.uniqueAbilities) {
            const hasLifeDrain = me.equippedWeapon.uniqueAbilities.some(a => a.effect === "life_drain");
            if (hasLifeDrain) {
                const healAmount = Math.floor(damage * 0.2);
                me.hp = Math.min(me.maxHp, me.hp + healAmount);
                addLog("ライフドレイン発動！" + healAmount + "回復");
            }
        }
        
        updateHP();
        
        // 勝利判定
        if (enemy.hp <= 0) {
            finishBotBattle("win");
        } else {
            // 即座に次の問題へ
            setTimeout(generateBotQuestion, 1000);
        }
    } else {
        addLog("不正解...");
        
        // プイヤーが不正解の場合、ボットが回答するチャンス
        setTimeout(() => {
            const botAnswerTime = Math.random() * 3000 + 1000;
            const botIsCorrect = Math.random() > 0.3;

            if (botIsCorrect) {
                addLog("ボットが正解！回答時間: " + (botAnswerTime / 1000).toFixed(2) + "秒");
                
                // ユニーク能力適用（防御側）
                let myDef = me.def || 0;
                
                // 鉄壁（相手からの攻撃のダメージ50%カット）
                if (me.equippedWeapon && me.equippedWeapon.uniqueAbilities) {
                    const hasIronWall = me.equippedWeapon.uniqueAbilities.some(a => a.effect === "damage_cut_half");
                    if (hasIronWall) {
                        // ダメージ計算後に50%カットを適用
                    }
                }
                
                const defReduction = Math.floor(myDef * 0.1);
                let damage = Math.max(1, Math.floor(enemy.atk * 0.5) - defReduction);
                
                // 鉄壁適用
                if (me.equippedWeapon && me.equippedWeapon.uniqueAbilities) {
                    const hasIronWall = me.equippedWeapon.uniqueAbilities.some(a => a.effect === "damage_cut_half");
                    if (hasIronWall) {
                        damage = Math.floor(damage * 0.5);
                        addLog("鉄壁発動！ダメージ50%カット");
                    }
                }
                
                me.hp = Math.max(0, me.hp - damage);
                showDamage("myDamage", damage);
                addLog("ボットからのダメージ: " + damage);
                
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

    answerInput.disabled = true;
    submitAnswerBtn.disabled = true;

    const win = result === "win";
    addLog(win ? I18N.victory : I18N.defeat);

    console.log(`[Battle] finishBotBattle: result=${result}, win=${win}, equippedWeapon=${me.equippedWeapon?.name}`);

    localStorage.setItem("battleResult", win ? "win" : "lose");
    localStorage.setItem("playerHP", String(me.hp));
    localStorage.setItem("enemyHP", String(enemy.hp));
    // デバッグ武器のみ奪えない
    if (win && enemy.equippedWeapon && !enemy.equippedWeapon.isDebugWeapon) {
        localStorage.setItem("stolenWeapon", JSON.stringify(enemy.equippedWeapon));
    }
    localStorage.removeItem("isBotBattle");

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

function syncBattleState(players) {
    console.log("syncBattleState called with players:", players);
    const playerIds = Object.keys(players);
    console.log("Player IDs:", playerIds, "My ID:", me.id);
    
    // IDで正確にマッチング
    const myData = players[me.id];
    const enemyId = playerIds.find(id => id !== me.id);
    const enemyData = players[enemyId];
    
    if (myData) {
        Object.assign(me, myData);
    }
    if (enemyData) {
        Object.assign(enemy, enemyData);
    }
    
    console.log("Synced me:", me);
    console.log("Synced enemy:", enemy);
    
    localStorage.setItem("battlePlayer", JSON.stringify(me));
    localStorage.setItem("enemy", JSON.stringify(enemy));
    updateHP();
    updateStats();
}

function finishBattle(winner) {
    if (battleEnd) return;
    battleEnd = true;
    stopTimer();
    
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
    
    setTimeout(() => location.href = "result.html", 2500);
}

function submitAnswer() {
    if (battleEnd || !currentQuestion) return;

    const answer = answerInput.value.trim();
    if (!answer) return;

    answerInput.disabled = true;
    submitAnswerBtn.disabled = true;

    if (isBotBattle) {
        handleBotAnswer(answer);
    } else {
        socket.emit("submitAnswer", {
            roomId,
            answer
        });
    }

    answerInput.value = "";
}

if (!isBotBattle && socket) {
    socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
        if (roomId && me && me.id) {
            const p = getSavedPlayer();
            socket.emit("rejoinBattle", { roomId, oldPlayerId: me.id, player: p || me });
        }
    });

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

    socket.on("battleStarted", data => {
        console.log("battleStarted received:", data);
        addLog("バトル開始信号を受信...");
        
        // プレイヤーデータを同期
        if (data.players) {
            const playerIds = Object.keys(data.players);
            console.log("Syncing player data:", playerIds);
            
            if (playerIds[0] === me.id) {
                me = data.players[playerIds[0]];
                enemy = data.players[playerIds[1]];
            } else {
                enemy = data.players[playerIds[0]];
                me = data.players[playerIds[1]];
            }
            
            console.log("Synced data:", { me, enemy });
            
            // UIを更新
            myName.textContent = me.name;
            enemyName.textContent = enemy.name;
            updateStats();
            updateHP();
            
            // ローカルストレージを更新
            localStorage.setItem("battlePlayer", JSON.stringify(me));
            localStorage.setItem("enemy", JSON.stringify(enemy));
        }
        
        currentQuestion = data.initialQuestion;
        
        if (!currentQuestion || !currentQuestion.question) {
            console.error("Invalid question data:", currentQuestion);
            addLog("エラー: 問題データが無効です");
            addLog("受信データ: " + JSON.stringify(data));
            return;
        }
        
        showCountdown(() => {
            questionDisplay.textContent = currentQuestion.question;
            startTimer();
            addLog("問題が出されました！" + (currentQuestion.subject ? "（" + currentQuestion.subject.toUpperCase() + "）" : ""));
            answerInput.disabled = false;
            submitAnswerBtn.disabled = false;
            answerInput.focus();
        });
    });

    socket.on("answerResult", data => {
        console.log("answerResult received:", data);
        const isMyAnswer = data.playerId === me.id;
        
        // 相手が先に正解した場合、即座に入力を無効化
        if (!isMyAnswer && data.isCorrect && data.firstCorrect) {
            answerInput.disabled = true;
            submitAnswerBtn.disabled = true;
            addLog("相手が先に正解しました！回答無効");
        }
        
        if (isMyAnswer) {
            if (data.isCorrect) {
                addLog("正解！回答時間: " + (data.answerTime / 1000).toFixed(2) + "秒");
                if (data.firstCorrect) {
                    addLog("先答！ダメージ: " + data.damage);
                    showDamage("enemyDamage", data.damage);
                } else {
                    addLog("後答...ダメージなし");
                }
            } else {
                addLog("不正解...");
                if (data.wrongAnswer && data.damage) {
                    addLog("ダメージを受けた: " + data.damage);
                    showDamage("myDamage", data.damage);
                }
            }
        } else {
            if (data.isCorrect) {
                addLog(enemy.name + "が正解！回答時間: " + (data.answerTime / 1000).toFixed(2) + "秒");
                if (data.firstCorrect) {
                    addLog("相手が先答！ダメージ: " + data.damage);
                    showDamage("myDamage", data.damage);
                }
            } else {
                addLog(enemy.name + "は不正解...");
                if (data.wrongAnswer && data.damage) {
                    addLog(enemy.name + "がダメージを受けた: " + data.damage);
                    showDamage("enemyDamage", data.damage);
                }
            }
        }
        
        if (data.battleState) {
            console.log("Syncing battle state:", data.battleState.players);
            syncBattleState(data.battleState.players);
        }
        
        if (data.nextQuestion) {
            currentQuestion = data.nextQuestion;
            showCountdown(() => {
                questionDisplay.textContent = currentQuestion.question;
                startTimer();
                answerInput.disabled = false;
                submitAnswerBtn.disabled = false;
                answerInput.focus();
                addLog("次の問題！");
            });
        }
        
        if (data.winner) {
            finishBattle(data.winner);
        }
    });

    socket.on("battleFinished", data => {
        if (data.draw) {
            addLog("引き分け！");
            localStorage.setItem("battleResult", "draw");
            setTimeout(() => location.href = "result.html", 2500);
        } else {
            finishBattle(data.winner);
        }
    });

    socket.on("answerError", data => {
        addLog("エラー: " + data.message);
        answerInput.disabled = false;
        submitAnswerBtn.disabled = false;
    });

    socket.on("opponentLeft", () => {
        battleEnd = true;
        stopTimer();
        addLog(I18N.opponentLeft);
        alert(I18N.opponentLeft);
        location.href = "index.html";
    });
}

function getSavedPlayer() {
    const raw = localStorage.getItem("player");
    return raw ? migratePlayer(JSON.parse(raw)) : null;
}

submitAnswerBtn.onclick = submitAnswer;
answerInput.onkeypress = (e) => {
    if (e.key === "Enter") {
        submitAnswer();
    }
};

window.onload = () => initialize();
