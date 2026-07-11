// ============================================
// School Battle
// battle.js
// Version 1.0
// Commit #010
// Part 1 / 8
// ============================================

// --------------------------------------------
// Socket.IO
// --------------------------------------------

const socket = io();

// --------------------------------------------
// LocalStorage
// --------------------------------------------

const me = JSON.parse(
    localStorage.getItem("player")
);

const enemy = JSON.parse(
    localStorage.getItem("enemy")
);

const roomId =
    localStorage.getItem("roomId");

const GAME_MODE =
    localStorage.getItem("gameMode") || "online";

// --------------------------------------------
// Battle Constants
// --------------------------------------------

const HIT_RATE = 95;
const DODGE_RATE = 5;

const CRITICAL_RATE = 0.20;
const CRITICAL_POWER = 1.5;

const RANDOM_DAMAGE_MIN = -5;
const RANDOM_DAMAGE_MAX = 5;

const GUARD_RATE = 0.5;

const MAX_ULTIMATE = 100;

// --------------------------------------------
// Battle State
// --------------------------------------------

let battleEnd = false;

let myTurn = true;

let myGuard = false;
let enemyGuard = false;

let turn = 1;

let ultimateGauge = 0;

let totalDamage = 0;

let criticalCount = 0;

// --------------------------------------------
// DOM
// --------------------------------------------

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

// --------------------------------------------
// 起動
// --------------------------------------------

window.onload = () => {

    initializeBattle();

};

// --------------------------------------------
// 初期化
// --------------------------------------------

function initializeBattle(){
    if(!checkData()) return;

    if(!me){

        alert("プレイヤーデータがありません。");

        location.href = "index.html";

        return;

    }

    if(!enemy){

        alert("対戦相手が見つかりません。");

        location.href = "index.html";

        return;

    }

    updateScreen();

    addLog("⚔ Battle Start!");

    addLog(`${me.name} が勝負を挑んできた！`);

    updateUltimateGauge();
    setButtonsEnabled(true);
    ultimateGauge=0;

    updateUltimateGauge();

}
// ============================================
// Commit #010
// Part 2 / 8
// 画面更新・演出
// ============================================

// --------------------------------------------
// 画面更新
// --------------------------------------------

function updateScreen(){

    myName.textContent = me.name;
    enemyName.textContent = enemy.name;

    document.getElementById("myAtk").textContent =
        "攻撃：" + me.atk;

    document.getElementById("mySp").textContent =
        "特殊：" + me.sp;

    document.getElementById("myDef").textContent =
        "防御：" + me.def;

    document.getElementById("mySpeed").textContent =
        "素早さ：" + me.speed;

    document.getElementById("enemyAtk").textContent =
        "攻撃：" + enemy.atk;

    document.getElementById("enemySp").textContent =
        "特殊：" + enemy.sp;

    document.getElementById("enemyDef").textContent =
        "防御：" + enemy.def;

    document.getElementById("enemySpeed").textContent =
        "素早さ：" + enemy.speed;

    updateHP();

}

// --------------------------------------------
// HP更新
// --------------------------------------------

function updateHP(){

    me.hp = Math.max(0, me.hp);
    enemy.hp = Math.max(0, enemy.hp);

    myHPText.textContent =
        `HP ${me.hp} / ${me.maxHp}`;

    enemyHPText.textContent =
        `HP ${enemy.hp} / ${enemy.maxHp}`;

    animateHPBar(
        myHPBar,
        me.hp,
        me.maxHp
    );

    animateHPBar(
        enemyHPBar,
        enemy.hp,
        enemy.maxHp
    );

}

// --------------------------------------------
// HPバーアニメーション
// --------------------------------------------

function animateHPBar(bar,hp,maxHp){

    const percent =
        Math.max(0,(hp/maxHp)*100);

    bar.style.transition =
        "width .35s ease";

    bar.style.width =
        percent + "%";

}

// --------------------------------------------
// ログ追加
// --------------------------------------------

function addLog(text){

    const line =
        document.createElement("div");

    line.textContent = text;

    log.appendChild(line);

    log.scrollTop =
        log.scrollHeight;

}

// --------------------------------------------
// ダメージ表示
// --------------------------------------------

function showDamage(cardId,damage){

    const target =

        cardId==="playerCard"

        ? document.getElementById("myDamage")

        : document.getElementById("enemyDamage");

    target.textContent =
        "-" + damage;

    target.classList.add("show");

    setTimeout(()=>{

        target.classList.remove("show");

        target.textContent="";

    },900);

}

// --------------------------------------------
// ヒットアニメーション
// --------------------------------------------

function hitAnimation(cardId){

    const card =
        document.getElementById(cardId);

    card.classList.remove("hit");

    void card.offsetWidth;

    card.classList.add("hit");

    setTimeout(()=>{

        card.classList.remove("hit");

    },250);

}
// ============================================
// Commit #010
// Part 3 / 8
// ダメージ計算
// ============================================

// --------------------------------------------
// ランダム値
// --------------------------------------------

function randomRange(min,max){

    return Math.floor(

        Math.random() *

        (max-min+1)

    ) + min;

}

// --------------------------------------------
// ダメージ計算
// --------------------------------------------

function calculateDamage(

    power,

    attacker,

    target,

    guard

){

    // 命中判定
    if(Math.random()*100 > HIT_RATE){

        return{

            damage:0,

            critical:false,

            miss:true

        };

    }

    // 回避判定
    if(Math.random()*100 < DODGE_RATE){

        return{

            damage:0,

            critical:false,

            miss:true

        };

    }

    let damage =

        power

        - target.def * 0.5

        + randomRange(

            RANDOM_DAMAGE_MIN,

            RANDOM_DAMAGE_MAX

        );

    let critical = false;

    // クリティカル
    if(Math.random() < CRITICAL_RATE){

        damage *= CRITICAL_POWER;

        critical = true;

    }

    // 防御
    if(guard){

        damage *= GUARD_RATE;

    }

    damage = Math.floor(damage);

    if(damage < 1){

        damage = 1;

    }

    return{

        damage,

        critical,

        miss:false

    };

}
// --------------------------------------------
// ターゲットへダメージ
// --------------------------------------------

function applyDamage(

    target,

    damage

){

    target.hp -= damage;

    if(target.hp < 0){

        target.hp = 0;

    }

    updateHP();

}
// ============================================
// Commit #010
// Part 4 / 8
// 攻撃処理
// ============================================

// --------------------------------------------
// 通常攻撃
// --------------------------------------------

function attack(attacker,target,power,guard){

    const result = calculateDamage(

        power,

        attacker,

        target,

        guard

    );

    if(result.miss){

        addLog("💨 攻撃は外れた！");

        return 0;

    }

    applyDamage(

        target,

        result.damage

    );

    if(target===enemy){

        hitAnimation("enemyCard");

        showDamage(

            "enemyCard",

            result.damage

        );

    }

    else{

        hitAnimation("playerCard");

        showDamage(

            "playerCard",

            result.damage

        );

    }

    if(result.critical){

        criticalCount++;

        addLog("💥 クリティカル！！");

    }

    if(attacker===me){

        totalDamage += result.damage;

        addUltimateGauge(20);

    }

    updateHP();

    checkBattleEnd();

    return result.damage;

}

// --------------------------------------------
// プレイヤー通常攻撃
// --------------------------------------------

function playerAttack(){

    if(battleEnd) return;

    if(!myTurn) return;

    enemyGuard=false;

    const damage = attack(

        me,

        enemy,

        me.atk,

        enemyGuard

    );

    addLog(

        `⚔ ${me.name} の攻撃！`

    );

    addLog(

        `${damage} ダメージ！`

    );

    sendAction("attack");

    endTurn();

}

// --------------------------------------------
// 特殊攻撃
// --------------------------------------------

function playerSpecial(){

    if(battleEnd) return;

    if(!myTurn) return;

    enemyGuard=false;

    const damage = attack(

        me,

        enemy,

        Math.floor(me.sp*1.3),

        enemyGuard

    );

    addLog(

        `✨ ${me.name} の特殊攻撃！`

    );

    addLog(

        `${damage} ダメージ！`

    );

    sendAction("special");

    endTurn();

}

// --------------------------------------------
// 防御
// --------------------------------------------

function playerGuard(){

    if(battleEnd) return;

    if(!myTurn) return;

    myGuard=true;

    addLog("🛡 防御した！");

    sendAction("guard");

    endTurn();

}
// ============================================
// 必殺技
// ============================================

function playerUltimate(){

    if(battleEnd) return;

    if(!myTurn) return;

    if(ultimateGauge<MAX_ULTIMATE){

        return;

    }

    ultimateGauge=0;

    updateUltimateGauge();

    const damage = attack(

        me,

        enemy,

        Math.floor(me.sp*2.5),

        enemyGuard

    );

    addLog("🔥 必殺技！！");

    addLog(

        `${damage} ダメージ！`

    );

    sendAction("ultimate");

    endTurn();

}
// ============================================
// ボタン登録
// ============================================

attackBtn.onclick = playerAttack;

specialBtn.onclick = playerSpecial;

guardBtn.onclick = playerGuard;

ultimateBtn.onclick = playerUltimate;
// ============================================
// Commit #010
// Part 5 / 8
// ターン管理
// ============================================

// --------------------------------------------
// ターン終了
// --------------------------------------------

function endTurn(){

    myTurn = false;

    setButtonsEnabled(false);

}

// --------------------------------------------
// ターン開始
// --------------------------------------------

function startTurn(){

    myTurn = true;

    setButtonsEnabled(true);

}

// --------------------------------------------
// ボタン切替
// --------------------------------------------

function setButtonsEnabled(enabled){

    attackBtn.disabled = !enabled;

    specialBtn.disabled = !enabled;

    guardBtn.disabled = !enabled;

    ultimateBtn.disabled =

        !enabled ||

        ultimateGauge < MAX_ULTIMATE;

}
// ============================================
// 勝敗判定
// ============================================

function checkBattleEnd(){

    if(me.hp <= 0){

        me.hp = 0;

        battleEnd = true;

        finishBattle("lose");

        return true;

    }

    if(enemy.hp <= 0){

        enemy.hp = 0;

        battleEnd = true;

        finishBattle("win");

        return true;

    }

    return false;

}
// ============================================
// バトル終了
// ============================================

function finishBattle(result){

    setButtonsEnabled(false);

    localStorage.setItem(

        "battleResult",

        result

    );

    localStorage.setItem(

        "battleTurn",

        turn

    );

    localStorage.setItem(

        "playerHP",

        me.hp

    );

    localStorage.setItem(

        "enemyHP",

        enemy.hp

    );

    localStorage.setItem(

        "totalDamage",

        totalDamage

    );

    localStorage.setItem(

        "criticalCount",

        criticalCount

    );

    addLog("");

    if(result==="win"){

        addLog("🏆 勝利！！");

    }

    else{

        addLog("💀 敗北...");

    }

    setTimeout(()=>{

    socket.emit("battleFinished",{

        roomId,

        result

    });

},1500);
    socket.disconnect();

}
// ============================================
// Commit #010
// Part 5 / 8
// ターン管理
// ============================================

// --------------------------------------------
// 自分のターン終了
// --------------------------------------------

function endTurn(){

    myTurn = false;

    setButtonsEnabled(false);

}

// --------------------------------------------
// 自分のターン開始
// --------------------------------------------

function startTurn(){

    myTurn = true;

    myGuard = false;

    setButtonsEnabled(true);

}

// --------------------------------------------
// ボタン切替
// --------------------------------------------

function setButtonsEnabled(enabled){

    attackBtn.disabled = !enabled;

    specialBtn.disabled = !enabled;

    guardBtn.disabled = !enabled;

    ultimateBtn.disabled =

        !enabled ||

        ultimateGauge < MAX_ULTIMATE;

}
// ============================================
// 勝敗判定
// ============================================

function checkBattleEnd(){

    if(me.hp <= 0){

        me.hp = 0;

        updateHP();

        finishBattle("lose");

        return true;

    }

    if(enemy.hp <= 0){

        enemy.hp = 0;

        updateHP();

        finishBattle("win");

        return true;

    }

    return false;

}
// ============================================
// バトル終了
// ============================================

function finishBattle(result){

    if(battleEnd){

        return;

    }

    battleEnd = true;

    setButtonsEnabled(false);

    localStorage.setItem(

        "battleResult",

        result

    );

    localStorage.setItem(

        "battleTurn",

        turn

    );

    localStorage.setItem(

        "playerHP",

        me.hp

    );

    localStorage.setItem(

        "enemyHP",

        enemy.hp

    );

    localStorage.setItem(

        "totalDamage",

        totalDamage

    );

    localStorage.setItem(

        "criticalCount",

        criticalCount

    );

    if(result==="win"){

        addLog("🏆 勝利！！");

    }

    else{

        addLog("💀 敗北...");

    }

    setTimeout(()=>{

        location.href="result.html";

    },2000);

}
// ============================================
// Commit #010
// Part 6 / 8
// Socket通信
// ============================================

// --------------------------------------------
// 行動送信
// --------------------------------------------

function sendAction(action){

    socket.emit("playerAction",{

        roomId,

        action

    });

}
// --------------------------------------------
// 相手の行動受信
// --------------------------------------------

socket.on("playerAction",(data)=>{

    if(battleEnd) return;

    switch(data.action){

        case "attack":

            addLog("⚔ 相手の攻撃！");

            attack(

                enemy,

                me,

                enemy.atk,

                myGuard

            );

            myGuard=false;

            break;

        case "special":

            addLog("✨ 相手の特殊攻撃！");

            attack(

                enemy,

                me,

                Math.floor(enemy.sp*1.3),

                myGuard

            );

            myGuard=false;

            break;

        case "guard":

            enemyGuard=true;

            addLog("🛡 相手は防御した！");

            break;

        case "ultimate":

            addLog("🔥 相手の必殺技！！");

            attack(

                enemy,

                me,

                Math.floor(enemy.sp*2.5),

                myGuard

            );

            myGuard=false;

            break;

    }

    turn++;

    startTurn();

});
// --------------------------------------------
// サーバー接続
// --------------------------------------------

socket.on("connect",()=>{

    console.log("Socket Connected");

});
// ============================================
// バトル終了同期
// ============================================

socket.on("battleFinished",(data)=>{

    localStorage.setItem(

        "battleResult",

        data.result

    );

    location.href="result.html";

});
// ============================================
// 再戦
// ============================================

function requestRematch(){

    socket.emit("requestRematch",roomId);

}
socket.on("rematchReady",()=>{

    location.reload();

});
function resetRoom(roomId){

    if(!rooms[roomId]) return;

    // 今後HPや状態を初期化する場合はここに追加
}

module.exports = {

    createRoom,

    joinRoom,

    getRoom,

    deleteRoom,

    resetRoom

};
// ============================================
// エラーチェック
// ============================================

function checkData(){

    if(!me){

        alert("プレイヤーデータがありません。");

        location.href="index.html";

        return false;

    }

    if(!enemy){

        alert("対戦相手が見つかりません。");

        location.href="index.html";

        return false;

    }

    return true;

}
// ============================================
// デバッグ
// ============================================

window.debugBattle=()=>{

    console.table({

        me,

        enemy,

        roomId,

        myTurn,

        battleEnd,

        ultimateGauge,

        turn

    });

};
// ============================================
// Battle Ready
// ============================================

console.log("Battle Ready.");