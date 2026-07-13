// ============================================
// School Battle - Battle
// ============================================

const socket = io();

const roomId = localStorage.getItem("roomId");

let me = JSON.parse(localStorage.getItem("player"));
let enemy = JSON.parse(localStorage.getItem("enemy"));

let myTurn = localStorage.getItem("myTurn") === "true";
let battleEnd = false;
let rejoined = false;
let turnCount = 0;
let totalDamage = 0;
let criticalCount = 0;

const turnText = document.getElementById("turnText");
const myName = document.getElementById("myName");
const enemyName = document.getElementById("enemyName");
const myHPBar = document.getElementById("myHPBar");
const enemyHPBar = document.getElementById("enemyHPBar");
const myHPText = document.getElementById("myHPText");
const enemyHPText = document.getElementById("enemyHPText");
const myAtk = document.getElementById("myAtk");
const mySp = document.getElementById("mySp");
const myDef = document.getElementById("myDef");
const mySpeed = document.getElementById("mySpeed");
const enemyAtk = document.getElementById("enemyAtk");
const enemySp = document.getElementById("enemySp");
const enemyDef = document.getElementById("enemyDef");
const enemySpeed = document.getElementById("enemySpeed");
const attackBtn = document.getElementById("attackBtn");
const specialBtn = document.getElementById("specialBtn");
const guardBtn = document.getElementById("guardBtn");
const ultimateBtn = document.getElementById("ultimateBtn");
const ultimateGaugeBar = document.getElementById("ultimateGaugeBar");
const log = document.getElementById("log");

function initialize(){

    if(!me || !enemy){

        alert("対戦データがありません。");
        location.href = "index.html";
        return;

    }

    myName.textContent = me.name;
    enemyName.textContent = enemy.name;

    updateStats();
    updateHP();
    updateUltimateGauge();
    updateButtons();

    addLog("? Battle Start!");

}

function updateStats(){

    myAtk.textContent = `攻撃：${me.atk}`;
    mySp.textContent = `特殊：${me.sp}`;
    myDef.textContent = `防御：${me.def}`;
    mySpeed.textContent = `速さ：${me.speed}`;

    enemyAtk.textContent = `攻撃：${enemy.atk}`;
    enemySp.textContent = `特殊：${enemy.sp}`;
    enemyDef.textContent = `防御：${enemy.def}`;
    enemySpeed.textContent = `速さ：${enemy.speed}`;

}

function updateHP(){

    myHPText.textContent = `HP ${me.hp} / ${me.maxHp}`;
    enemyHPText.textContent = `HP ${enemy.hp} / ${enemy.maxHp}`;

    myHPBar.style.width = (me.hp / me.maxHp * 100) + "%";
    enemyHPBar.style.width = (enemy.hp / enemy.maxHp * 100) + "%";

}

function updateUltimateGauge(){

    const gauge = me.ultimate || 0;

    if(ultimateGaugeBar){
        ultimateGaugeBar.style.width = gauge + "%";
    }

}

function addLog(text){

    const div = document.createElement("div");
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;

}

function showDamage(targetId, amount){

    const el = document.getElementById(targetId);

    if(!el) return;

    el.textContent = amount > 0 ? `-${amount}` : "MISS";
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");

}

function syncBattleState(data){

    if(data.attacker.id === me.id){

        Object.assign(me, data.attacker);
        Object.assign(enemy, data.defender);

    }else{

        Object.assign(enemy, data.attacker);
        Object.assign(me, data.defender);

    }

    myTurn = (data.turn === me.id);

    localStorage.setItem("player", JSON.stringify(me));
    localStorage.setItem("enemy", JSON.stringify(enemy));
    localStorage.setItem("myTurn", String(myTurn));

    updateHP();
    updateStats();
    updateUltimateGauge();
    updateButtons();

}

function finishBattle(winnerId){

    if(battleEnd) return;

    battleEnd = true;
    updateButtons();

    const win = winnerId === me.id;

    addLog(win ? "? 勝利！" : "? 敗北...");

    localStorage.setItem("battleResult", win ? "win" : "lose");
    localStorage.setItem("battleTurn", String(turnCount));
    localStorage.setItem("playerHP", String(me.hp));
    localStorage.setItem("enemyHP", String(enemy.hp));
    localStorage.setItem("totalDamage", String(totalDamage));
    localStorage.setItem("criticalCount", String(criticalCount));

    setTimeout(() => {
        location.href = "result.html";
    }, 2500);

}

function updateButtons(){

    const canUltimate = (me.ultimate || 0) >= 100;

    attackBtn.disabled = !myTurn || battleEnd || !rejoined;
    specialBtn.disabled = !myTurn || battleEnd || !rejoined;
    guardBtn.disabled = !myTurn || battleEnd || !rejoined;
    ultimateBtn.disabled = !myTurn || battleEnd || !canUltimate || !rejoined;

    if(turnText){

        if(!rejoined){
            turnText.textContent = "接続中...";
        }else if(battleEnd){
            turnText.textContent = "バトル終了";
        }else{
            turnText.textContent = myTurn
                ? "? あなたのターン"
                : "? 相手のターン";
        }

    }

}

function sendAction(action){

    if(!myTurn || battleEnd || !rejoined) return;

    socket.emit("playerAction", {
        roomId,
        action
    });

}

socket.on("connect", () => {

    if(roomId && me && me.id){

        socket.emit("rejoinBattle", {
            roomId,
            oldPlayerId: me.id,
            player: me
        });

    }

});

socket.on("battleRejoined", (data) => {

    me = data.me;
    enemy = data.enemy;
    myTurn = data.myTurn;
    rejoined = true;

    localStorage.setItem("player", JSON.stringify(me));
    localStorage.setItem("enemy", JSON.stringify(enemy));
    localStorage.setItem("myTurn", String(myTurn));

    updateStats();
    updateHP();
    updateUltimateGauge();
    updateButtons();

    addLog("サーバーに再接続しました。");

});

socket.on("rejoinFailed", (data) => {

    console.error("rejoinFailed", data);

    if(data && data.reason === "battle_finished"){

        alert("このバトルは既に終了しています。");

    }else{

        alert("バトルへの再接続に失敗しました。ロビーに戻ります。");

    }

    location.href = "index.html";

});

socket.on("battleUpdate", (data) => {

    if(battleEnd) return;

    turnCount++;

    syncBattleState(data);

    const actionLabels = {
        attack: "の攻撃！",
        special: "の特殊攻撃！",
        guard: "は防御した！",
        ultimate: "の必殺技！"
    };

    addLog(`${data.attacker.name}${actionLabels[data.action] || ""}`);

    if(data.result.miss){

        addLog("攻撃は外れた！");

        if(data.attacker.id === me.id){
            showDamage("enemyDamage", 0);
        }else{
            showDamage("myDamage", 0);
        }

    }else if(data.result.guard){

        addLog("防御態勢！");

    }else{

        addLog(`${data.result.damage} ダメージ`);

        if(data.attacker.id === me.id){

            totalDamage += data.result.damage;
            showDamage("enemyDamage", data.result.damage);

        }else{

            showDamage("myDamage", data.result.damage);

        }

        if(data.result.critical){
            criticalCount++;
            addLog("クリティカルヒット！");
        }

    }

    if(data.winner){
        finishBattle(data.winner);
    }

});

socket.on("battleFinished", (data) => {

    finishBattle(data.winner);

});

socket.on("actionError", (data) => {

    addLog(`? ${data.message}`);

});

socket.on("opponentLeft", () => {

    battleEnd = true;
    updateButtons();
    addLog("相手が退出しました。");
    alert("相手が退出しました。");
    location.href = "index.html";

});

attackBtn.onclick = () => sendAction("attack");
specialBtn.onclick = () => sendAction("special");
guardBtn.onclick = () => sendAction("guard");
ultimateBtn.onclick = () => sendAction("ultimate");

window.onload = () => {
    initialize();
};
