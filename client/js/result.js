const result = localStorage.getItem("battleResult");
const turn = Number(localStorage.getItem("battleTurn") || "0");
const playerHP = localStorage.getItem("playerHP") || "0";
const enemyData = localStorage.getItem("enemy");
const enemy = enemyData ? JSON.parse(enemyData) : null;
const damage = Number(localStorage.getItem("totalDamage") || "0");
const critical = localStorage.getItem("criticalCount") || "0";
const title = document.getElementById("resultTitle");
const won = result === "win";

const stolenWeaponRaw = localStorage.getItem("stolenWeapon");
const lostWeaponRaw = localStorage.getItem("lostWeapon");
const stolenWeapon = stolenWeaponRaw ? JSON.parse(stolenWeaponRaw) : null;
const lostWeapon = lostWeaponRaw ? JSON.parse(lostWeaponRaw) : null;

console.log(`[Result] Result page loaded: result=${result}, won=${won}`);
console.log(`[Result] battleXpGain exists:`, !!localStorage.getItem("battleXpGain"));

// 強制的にバトル報酬を適用（デバッグ用）
console.log(`[Result] Force calling applyBattleRewards for debugging`);
const updatedPlayer = applyBattleRewards(won, turn, damage, {
    stolenWeapon: won && !enemy?.isBoss ? stolenWeapon : null,
    lostWeapon: !won && !enemy?.isBoss ? lostWeapon : null,
    enemy: enemy
});
console.log(`[Result] Updated player:`, updatedPlayer);

const xpGain = localStorage.getItem("battleXpGain") || "0";
const coinGain = localStorage.getItem("battleCoinGain") || "0";
const droppedOrbRaw = localStorage.getItem("droppedOrb");
const droppedOrb = droppedOrbRaw ? JSON.parse(droppedOrbRaw) : null;

title.textContent = won ? I18N.win : I18N.lose;
title.className = won ? "win" : "lose";
document.getElementById("turnText").textContent = I18N.turnCount + " : " + turn;
document.getElementById("hpText").textContent = I18N.remainHp + " : " + playerHP;
document.getElementById("damageText").textContent = I18N.totalDamage + " : " + damage;
document.getElementById("criticalText").textContent = I18N.criticalCount + " : " + critical + " " + I18N.times;
const xpEl = document.getElementById("xpGainText");
if (xpEl) xpEl.textContent = I18N.xp + " +" + xpGain;

const coinEl = document.getElementById("coinGainText");
if (coinEl) coinEl.textContent = "コイン +" + coinGain;

const stealEl = document.getElementById("stealText");
if (stealEl) {
    if (won && stolenWeapon) {
        stealEl.textContent = "武器を奪取: " + getWeaponDisplayName(stolenWeapon);
        stealEl.style.display = "block";
    } else if (!won && lostWeapon) {
        stealEl.textContent = "装備武器を奪われました: " + getWeaponDisplayName(lostWeapon);
        stealEl.style.display = "block";
    } else {
        stealEl.style.display = "none";
    }
}

// オーブドロップ表示
const orbEl = document.getElementById("orbText");
if (orbEl) {
    if (droppedOrb && typeof getOrbDisplayName === "function") {
        orbEl.textContent = "★オーブを入手！★\n" + getOrbDisplayName(droppedOrb);
        orbEl.style.display = "block";
    } else {
        orbEl.style.display = "none";
    }
}

localStorage.removeItem("stolenWeapon");
localStorage.removeItem("lostWeapon");
localStorage.removeItem("battleCoinGain");
localStorage.removeItem("droppedOrb");
localStorage.removeItem("isBotBattle");
localStorage.removeItem("isBossBattle"); // Clear boss battle flag

document.getElementById("homeBtn").onclick = () => location.href = "index.html";
