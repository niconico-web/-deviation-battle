// ============================================
// School Battle
// battle_v11.js
// Commit #013
// Part 1 / 4
// ============================================

const socket = io();

// ---------------------
// LocalStorage
// ---------------------

const roomId =
    localStorage.getItem("roomId");

const me =
    JSON.parse(
        localStorage.getItem("player")
    );

const enemy =
    JSON.parse(
        localStorage.getItem("enemy")
    );
    const turnText =
    document.getElementById("turnText");

// ---------------------
// 状態
// ---------------------

let myTurn =
    localStorage.getItem("myTurn")==="true";

let battleEnd = false;

// ---------------------
// DOM
// ---------------------

const myName =
    document.getElementById("myName");

const enemyName =
    document.getElementById("enemyName");

const myHPBar =
    document.getElementById("myHPBar");

const enemyHPBar =
    document.getElementById("enemyHPBar");

const myHPText =
    document.getElementById("myHPText");

const enemyHPText =
    document.getElementById("enemyHPText");

const attackBtn =
    document.getElementById("attackBtn");

const specialBtn =
    document.getElementById("specialBtn");

const guardBtn =
    document.getElementById("guardBtn");

const ultimateBtn =
    document.getElementById("ultimateBtn");

const log =
    document.getElementById("log");
    window.onload = () => {

    initialize();

};

function initialize(){

    if(!me || !enemy){

        alert("対戦データがありません。");

        location.href = "index.html";

        return;

    }

    myName.textContent = me.name;
    enemyName.textContent = enemy.name;

    updateHP();

    addLog("⚔ Battle Start!");

    updateButtons();

}
function updateHP(){

    myHPText.textContent =
        `HP ${me.hp} / ${me.maxHp}`;

    enemyHPText.textContent =
        `HP ${enemy.hp} / ${enemy.maxHp}`;

    myHPBar.style.width =
        (me.hp/me.maxHp*100)+"%";

    enemyHPBar.style.width =
        (enemy.hp/enemy.maxHp*100)+"%";

}
me.ultimate =
    data.attacker.id===me.id

    ? data.attacker.ultimate

    : data.defender.ultimate;

const gauge =
    document.getElementById(
        "ultimateGaugeBar"
    );

if(gauge){

    gauge.style.width =
        me.ultimate + "%";

}
function addLog(text){

    const div =
        document.createElement("div");

    div.textContent = text;

    log.appendChild(div);

    log.scrollTop =
        log.scrollHeight;

}
// ============================================
// サーバーから戦闘更新
// ============================================

socket.on("battleUpdate",(data)=>{

    if(battleEnd) return;

    // -----------------------------
    // HP同期
    // -----------------------------

    if(data.attacker.id===me.id){

        me.hp=data.attacker.hp;
        enemy.hp=data.defender.hp;

    }else{

        me.hp=data.defender.hp;
        enemy.hp=data.attacker.hp;

    }

    updateHP();

    // -----------------------------
    // ターン同期
    // -----------------------------

    myTurn=(data.turn===me.id);

    updateButtons();

    // -----------------------------
    // ログ
    // -----------------------------

    switch(data.action){

        case "attack":

            addLog(
                `${data.attacker.name} の攻撃！`
            );

            break;

        case "special":

            addLog(
                `${data.attacker.name} の特殊攻撃！`
            );

            break;

        case "guard":

            addLog(
                `${data.attacker.name} は防御した！`
            );

            break;

        case "ultimate":

            addLog(
                `${data.attacker.name} の必殺技！`
            );

            break;

    }

    if(data.result.miss){

        addLog("攻撃は外れた！");

    }else if(data.result.guard){

        addLog("防御態勢！");

    }else{

        addLog(
            `${data.result.damage} ダメージ`
        );

    }

});
function updateButtons(){

    const canUltimate =
        me.ultimate >= 100;

    attackBtn.disabled =
        !myTurn || battleEnd;

    specialBtn.disabled =
        !myTurn || battleEnd;

    guardBtn.disabled =
        !myTurn || battleEnd;

    ultimateBtn.disabled =
        !myTurn ||
        battleEnd ||
        !canUltimate;

    if(turnText){

        turnText.textContent =
            myTurn
            ? "🟢 あなたのターン"
            : "🔴 相手のターン";

    }

}
socket.on("connect",()=>{

    console.log("Connected");

});
socket.on("battleFinished",(data)=>{

    battleEnd=true;

    updateButtons();

    const win =
        data.winner===me.id;

    addLog(

        win

        ? "🏆 勝利！"

        : "💀 敗北..."

    );

    localStorage.setItem(

        "battleResult",

        win

    );

    setTimeout(()=>{

        location.href="result.html";

    },2500);

});
socket.on("opponentLeft",()=>{

    battleEnd=true;

    updateButtons();

    addLog("相手が退出しました。");

    alert("相手が退出しました。");

    location.href="index.html";

});
// ============================================
// 行動送信
// ============================================


// ============================================
// ボタン
// ============================================

attackBtn.onclick=()=>{

    sendAction("attack");

};

specialBtn.onclick=()=>{

    sendAction("special");

};

guardBtn.onclick=()=>{

    sendAction("guard");

};

ultimateBtn.onclick=()=>{

    sendAction("ultimate");

};
function sendAction(action){

    if(!myTurn) return;

    if(battleEnd) return;

    myTurn=false;

    updateButtons();

    socket.emit("playerAction",{

        roomId,

        action

    });

}