const socket = io();
const roomId = localStorage.getItem("roomId");
let me = JSON.parse(localStorage.getItem("player"));
let enemy = JSON.parse(localStorage.getItem("enemy"));
let myTurn = localStorage.getItem("myTurn") === "true";
let battleEnd = false, rejoined = false, turnCount = 0, totalDamage = 0, criticalCount = 0;

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

function statLabel(key, val){ return I18N[key] + I18N.colon + val; }

function initialize(){
    if(!me || !enemy){ alert(I18N.noBattleData); location.href = "index.html"; return; }
    myName.textContent = me.name;
    enemyName.textContent = enemy.name;
    updateStats(); updateHP(); updateUltimateGauge(); updateButtons();
    addLog(I18N.battleBegin);
}

function updateStats(){
    myAtk.textContent = statLabel("atk", me.atk);
    mySp.textContent = statLabel("sp", me.sp);
    myDef.textContent = statLabel("def", me.def);
    mySpeed.textContent = statLabel("speed", me.speed);
    enemyAtk.textContent = statLabel("atk", enemy.atk);
    enemySp.textContent = statLabel("sp", enemy.sp);
    enemyDef.textContent = statLabel("def", enemy.def);
    enemySpeed.textContent = statLabel("speed", enemy.speed);
}

function updateHP(){
    myHPText.textContent = "HP " + me.hp + " / " + me.maxHp;
    enemyHPText.textContent = "HP " + enemy.hp + " / " + enemy.maxHp;
    myHPBar.style.width = (me.hp / me.maxHp * 100) + "%";
    enemyHPBar.style.width = (enemy.hp / enemy.maxHp * 100) + "%";
}

function updateUltimateGauge(){
    if(ultimateGaugeBar) ultimateGaugeBar.style.width = (me.ultimate || 0) + "%";
}

function addLog(text){
    const div = document.createElement("div");
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function showDamage(id, amount){
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = amount > 0 ? "-" + amount : "MISS";
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
}

function syncBattleState(data){
    if(data.attacker.id === me.id){ Object.assign(me, data.attacker); Object.assign(enemy, data.defender); }
    else { Object.assign(enemy, data.attacker); Object.assign(me, data.defender); }
    myTurn = (data.turn === me.id);
    localStorage.setItem("player", JSON.stringify(me));
    localStorage.setItem("enemy", JSON.stringify(enemy));
    localStorage.setItem("myTurn", String(myTurn));
    updateHP(); updateStats(); updateUltimateGauge(); updateButtons();
}

function finishBattle(winnerId){
    if(battleEnd) return;
    battleEnd = true;
    updateButtons();
    const win = winnerId === me.id;
    addLog(win ? I18N.victory : I18N.defeat);
    localStorage.setItem("battleResult", win ? "win" : "lose");
    localStorage.setItem("battleTurn", String(turnCount));
    localStorage.setItem("playerHP", String(me.hp));
    localStorage.setItem("enemyHP", String(enemy.hp));
    localStorage.setItem("totalDamage", String(totalDamage));
    localStorage.setItem("criticalCount", String(criticalCount));
    setTimeout(() => location.href = "result.html", 2500);
}

function updateButtons(){
    const canUlt = (me.ultimate || 0) >= 100;
    attackBtn.disabled = !myTurn || battleEnd || !rejoined;
    specialBtn.disabled = !myTurn || battleEnd || !rejoined;
    guardBtn.disabled = !myTurn || battleEnd || !rejoined;
    ultimateBtn.disabled = !myTurn || battleEnd || !canUlt || !rejoined;
    if(!turnText) return;
    if(!rejoined) turnText.textContent = I18N.connecting;
    else if(battleEnd) turnText.textContent = I18N.battleEnd;
    else turnText.textContent = myTurn ? I18N.yourTurn : I18N.enemyTurn;
}

function sendAction(action){
    if(!myTurn || battleEnd || !rejoined) return;
    socket.emit("playerAction", { roomId, action });
}

socket.on("connect", () => {
    if(roomId && me && me.id) socket.emit("rejoinBattle", { roomId, oldPlayerId: me.id, player: me });
});

socket.on("battleRejoined", (data) => {
    me = data.me; enemy = data.enemy; myTurn = data.myTurn; rejoined = true;
    localStorage.setItem("player", JSON.stringify(me));
    localStorage.setItem("enemy", JSON.stringify(enemy));
    localStorage.setItem("myTurn", String(myTurn));
    updateStats(); updateHP(); updateUltimateGauge(); updateButtons();
    addLog(I18N.reconnected);
});

socket.on("rejoinFailed", (data) => {
    alert(data && data.reason === "battle_finished" ? I18N.battleAlreadyEnd : I18N.rejoinFailed);
    location.href = "index.html";
});

socket.on("battleUpdate", (data) => {
    if(battleEnd) return;
    turnCount++;
    syncBattleState(data);
    const labels = { attack: I18N.attackAction, special: I18N.specialAction, guard: I18N.guardAction, ultimate: I18N.ultimateAction };
    addLog(data.attacker.name + (labels[data.action] || ""));
    if(data.result.miss){
        addLog(I18N.miss);
        showDamage(data.attacker.id === me.id ? "enemyDamage" : "myDamage", 0);
    } else if(data.result.guard){
        addLog(I18N.guarding);
    } else {
        addLog(data.result.damage + " " + I18N.damage);
        if(data.attacker.id === me.id){ totalDamage += data.result.damage; showDamage("enemyDamage", data.result.damage); }
        else showDamage("myDamage", data.result.damage);
        if(data.result.critical){ criticalCount++; addLog(I18N.critical); }
    }
    if(data.winner) finishBattle(data.winner);
});

socket.on("battleFinished", (data) => finishBattle(data.winner));
socket.on("actionError", (data) => addLog("[" + I18N.note + "] " + data.message));
socket.on("opponentLeft", () => {
    battleEnd = true; updateButtons(); addLog(I18N.opponentLeft);
    alert(I18N.opponentLeft); location.href = "index.html";
});

attackBtn.onclick = () => sendAction("attack");
specialBtn.onclick = () => sendAction("special");
guardBtn.onclick = () => sendAction("guard");
ultimateBtn.onclick = () => sendAction("ultimate");
window.onload = () => initialize();
