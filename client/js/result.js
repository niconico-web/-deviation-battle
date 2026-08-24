// Set up home button immediately so it works even if other scripts fail.
document.getElementById("homeBtn").onclick = () => location.href = "index.html";

const result = localStorage.getItem("battleResult");
const turn = Number(localStorage.getItem("battleTurn") || "0");
const playerHP = localStorage.getItem("playerHP") || "0";
const enemyData = localStorage.getItem("enemy");
const enemy = enemyData ? JSON.parse(enemyData) : null;
const damage = Number(localStorage.getItem("totalDamage") || "0");
const critical = localStorage.getItem("criticalCount") || "0";
const title = document.getElementById("resultTitle");
const won = result === "win";

// 「もう一度戦う」で使うため、result.js末尾でクリアされる前にバトル種別を控えておく
const wasBotBattle = localStorage.getItem("isBotBattle");
const wasBossBattle = localStorage.getItem("isBossBattle");
const battleDifficultyValue = localStorage.getItem("battleDifficulty");
const partyDataValue = localStorage.getItem("partyData");

const stolenWeaponRaw = localStorage.getItem("stolenWeapon");
const lostWeaponRaw = localStorage.getItem("lostWeapon");
const stolenWeapon = stolenWeaponRaw ? JSON.parse(stolenWeaponRaw) : null;
const lostWeapon = lostWeaponRaw ? JSON.parse(lostWeaponRaw) : null;

// applyBattleRewards()内でこのキーは読み取られた後すぐに削除されてしまうため、
// 結果画面に表示するために呼び出し前の値を控えておく
const droppedMaterialId = localStorage.getItem("droppedMaterial");

console.log(`[Result] Result page loaded: result=${result}, won=${won}`);

// 強制的にバトル報酬を適用（デバッグ用）
console.log(`[Result] Player data before rewards:`, localStorage.getItem("player"));
const updatedPlayer = applyBattleRewards(won, turn, damage, {
    stolenWeapon: won && !enemy?.isBoss ? stolenWeapon : null,
    lostWeapon: !won && !enemy?.isBoss ? lostWeapon : null,
    enemy: enemy
});

// ギルドクエスト進捗更新（ボス討伐）
if (won && wasBossBattle === "true" && typeof updateGuildQuestProgress === 'function') {
    updateGuildQuestProgress('defeat_boss', { bossId: enemy.id, difficulty: battleDifficultyValue });
}

if (!updatedPlayer) {
    console.error("[Result] applyBattleRewards returned null. Player data might be lost or not updated.");
} else {
    console.log(`[Result] Player data after rewards:`, JSON.stringify(updatedPlayer));
}

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

// 通常モンスターからの素材ドロップ表示
// （以前はplayer.materialsへの反映は正しく行われていたが、
// この結果画面に表示するUIが無かったため、入手していても
// プレイヤーからは「素材がドロップしない」ように見えていた）
const materialDropEl = document.getElementById("materialDropText");
if (materialDropEl) {
    if (droppedMaterialId && typeof MATERIAL_DATA !== "undefined" && MATERIAL_DATA[droppedMaterialId]) {
        materialDropEl.textContent = "★素材を入手！★\n" + MATERIAL_DATA[droppedMaterialId].name;
        materialDropEl.style.display = "block";
    } else {
        materialDropEl.style.display = "none";
    }
}

// 「もう一度戦う」ボタン（ボット戦・ソロボス戦のみ対応。オンライン対戦やパーティボス戦は再戦不可）
const retryBtn = document.getElementById("retryBtn");
if (retryBtn) {
    if (wasBotBattle === "true" && enemy && !partyDataValue) {
        retryBtn.style.display = "";
        retryBtn.onclick = () => {
            localStorage.setItem("isBotBattle", "true");
            if (wasBossBattle === "true") {
                localStorage.setItem("isBossBattle", "true");
                if (battleDifficultyValue) {
                    localStorage.setItem("battleDifficulty", battleDifficultyValue);
                }
            } else {
                localStorage.removeItem("isBossBattle");
                localStorage.removeItem("battleDifficulty");
            }
            localStorage.setItem("enemy", JSON.stringify(enemy));
            localStorage.removeItem("rewardsApplied");
            localStorage.removeItem("stolenWeapon");
            localStorage.removeItem("lostWeapon");
            location.href = "battle.html";
        };
    } else {
        retryBtn.style.display = "none";
    }
}

// ナビゲーションボタン
const onlineBtn = document.getElementById("onlineBtn");
const partyBtn = document.getElementById("partyBtn");
const bossBtn = document.getElementById("bossBtn");

if (onlineBtn) {
    onlineBtn.style.display = "";
    onlineBtn.onclick = () => location.href = "index.html#section-online";
}

if (partyBtn) {
    partyBtn.style.display = "";
    partyBtn.onclick = () => location.href = "index.html#section-party";
}

if (bossBtn) {
    bossBtn.style.display = "";
    bossBtn.onclick = () => location.href = "index.html#section-boss-battle";
}

// ボス報酬の表示（武器・スキル・限界突破素材）
const battleResultDataRaw = localStorage.getItem("battleResultData");
const battleResultData = battleResultDataRaw ? JSON.parse(battleResultDataRaw) : null;

if (battleResultData && battleResultData.rewards) {
    const bossWeaponDropText = document.getElementById('bossWeaponDropText');
    const limitBreakMaterialText = document.getElementById('limitBreakMaterialText');
    const bossSkillDropText = document.getElementById('bossSkillDropText');

    if (battleResultData.rewards.bossWeapon && bossWeaponDropText) {
        bossWeaponDropText.textContent = `★武器を入手！ ${battleResultData.rewards.bossWeapon.name}★`;
        bossWeaponDropText.style.display = 'block';
    }

    if (battleResultData.rewards.limitBreakMaterial && limitBreakMaterialText) {
        const material = battleResultData.rewards.limitBreakMaterial;
        limitBreakMaterialText.textContent = `★限界突破素材を入手！ ${material.name} ×${material.count}★`;
        limitBreakMaterialText.style.display = 'block';
    }

    if (battleResultData.rewards.bossSkill && bossSkillDropText) {
        bossSkillDropText.textContent = `★スキルを習得！ ${battleResultData.rewards.bossSkill.name}★`;
        bossSkillDropText.style.display = 'block';
    }
}

localStorage.removeItem("stolenWeapon");
localStorage.removeItem("lostWeapon");
localStorage.removeItem("battleCoinGain");
localStorage.removeItem("droppedOrb");
localStorage.removeItem("isBotBattle");
localStorage.removeItem("isBossBattle"); // Clear boss battle flag
localStorage.removeItem("battleDifficulty"); // Clear difficulty
localStorage.removeItem("battleResultData"); // Clear boss reward data
