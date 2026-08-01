const isBotBattle = localStorage.getItem("isBotBattle") === "true";
const socket = isBotBattle ? null : io();
const roomId = localStorage.getItem("roomId");
let me = JSON.parse(localStorage.getItem("battlePlayer")), enemy = JSON.parse(localStorage.getItem("enemy"));
let battleEnd = false, rejoined = false, currentQuestion = null, questionStartTime = null, timerInterval = null, countdownInterval = null;

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

    myName.textContent = me.name;
    enemyName.textContent = enemy.name;
    updateStats();
    updateHP();
    addLog(I18N.battleBegin);

    if (isBotBattle) {
        startBotBattle();
    } else {
        socket.emit("requestBattleStart", { roomId });
    }
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
    const questions = [
        { question: "1 + 1 = ?", answer: "2" },
        { question: "2 × 3 = ?", answer: "6" },
        { question: "10 - 4 = ?", answer: "6" },
        { question: "5 + 5 = ?", answer: "10" },
        { question: "8 ÷ 2 = ?", answer: "4" },
        { question: "3 × 4 = ?", answer: "12" },
        { question: "15 - 7 = ?", answer: "8" },
        { question: "6 + 9 = ?", answer: "15" },
        { question: "20 ÷ 4 = ?", answer: "5" },
        { question: "7 × 3 = ?", answer: "21" }
    ];

    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    currentQuestion = { ...randomQuestion, id: Date.now() };

    showCountdown(() => {
        questionDisplay.textContent = currentQuestion.question;
        startTimer();
        addLog("問題が出されました！");
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
        const defReduction = Math.floor((enemy.def || 0) * 0.1);
        const damage = Math.max(1, Math.floor(me.atk * 0.5) - defReduction);
        enemy.hp = Math.max(0, enemy.hp - damage);
        showDamage("enemyDamage", damage);
        addLog("ボットにダメージ: " + damage);
    } else {
        addLog("不正解...");
    }

    updateHP();

    if (!isCorrect) {
        setTimeout(() => {
            const botAnswerTime = Math.random() * 3000 + 1000;
            const botIsCorrect = Math.random() > 0.3;

            if (botIsCorrect) {
                addLog("ボットが正解！回答時間: " + (botAnswerTime / 1000).toFixed(2) + "秒");
                const defReduction = Math.floor((me.def || 0) * 0.1);
                const damage = Math.max(1, Math.floor(enemy.atk * 0.5) - defReduction);
                me.hp = Math.max(0, me.hp - damage);
                showDamage("myDamage", damage);
                addLog("ボットからのダメージ: " + damage);
            } else {
                addLog("ボットは不正解...");
            }

            updateHP();

            if (enemy.hp <= 0) {
                finishBotBattle("win");
            } else if (me.hp <= 0) {
                finishBotBattle("lose");
            } else {
                setTimeout(generateBotQuestion, 2000);
            }
        }, 500);
    } else {
        setTimeout(() => {
            if (enemy.hp <= 0) {
                finishBotBattle("win");
            } else {
                generateBotQuestion();
            }
        }, 1000);
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

    localStorage.setItem("battleResult", win ? "win" : "lose");
    localStorage.setItem("playerHP", String(me.hp));
    localStorage.setItem("enemyHP", String(enemy.hp));
    if (win && enemy.equippedWeapon) {
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
    const playerIds = Object.keys(players);
    if (playerIds[0] === me.id) {
        Object.assign(me, players[playerIds[0]]);
        Object.assign(enemy, players[playerIds[1]]);
    } else {
        Object.assign(enemy, players[playerIds[0]]);
        Object.assign(me, players[playerIds[1]]);
    }
    
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

    if (win && enemy.equippedWeapon) {
        localStorage.setItem("stolenWeapon", JSON.stringify(enemy.equippedWeapon));
    } else if (!win && me.equippedWeapon) {
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
        currentQuestion = data.initialQuestion;
        showCountdown(() => {
            questionDisplay.textContent = currentQuestion.question;
            startTimer();
            addLog("問題が出されました！");
            answerInput.disabled = false;
            submitAnswerBtn.disabled = false;
            answerInput.focus();
        });
    });

    socket.on("answerResult", data => {
        const isMyAnswer = data.playerId === me.id;
        
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
            }
        }
        
        if (data.battleState) {
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
