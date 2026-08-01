const socket = io();
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
    
    // バトル開始をリクエスト
    socket.emit("requestBattleStart", { roomId });
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
    
    setTimeout(() => location.href = "result.html", 2500);
}

function submitAnswer() {
    if (battleEnd || !currentQuestion) return;
    
    const answer = answerInput.value.trim();
    if (!answer) return;
    
    answerInput.disabled = true;
    submitAnswerBtn.disabled = true;
    
    socket.emit("submitAnswer", {
        roomId,
        answer
    });
    
    answerInput.value = "";
}

// Socket event handlers
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
    
    // 状態を同期
    if (data.battleState) {
        syncBattleState(data.battleState.players);
    }
    
    // 次の問題があれば表示
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
    
    // 勝利判定
    if (data.winner) {
        finishBattle(data.winner);
    }
});

socket.on("battleFinished", data => {
    if (data.draw) {
        addLog("引き分け！");
        localStorage.setItem("battleResult", "draw");
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

function getSavedPlayer() {
    const raw = localStorage.getItem("player");
    return raw ? JSON.parse(raw) : null;
}

// Event listeners
submitAnswerBtn.onclick = submitAnswer;
answerInput.onkeypress = (e) => {
    if (e.key === "Enter") {
        submitAnswer();
    }
};

window.onload = () => initialize();