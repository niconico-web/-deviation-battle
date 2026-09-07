// Set up home button immediately so it works even if other scripts fail.
document.getElementById("homeBtn").onclick = () => location.href = "index.html";

// ソケット接続（ダンジョンバトルの場合必要）
const wasDungeonBattle = localStorage.getItem("isDungeonBattle");
if (wasDungeonBattle === "true") {
    window.socket = io();
}

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

// ダンジョンバトルの場合は専用の処理を行い、早期リターン
if (wasDungeonBattle === "true") {
    handleDungeonResult(won);
    // ここで処理を終了（通常のリザルト処理はスキップ）
}

// ===================================
// ダンジョン結果処理
// ===================================
function handleDungeonResult(won) {
    const dungeonDataJSON = localStorage.getItem('dungeonData');
    if (!dungeonDataJSON) {
        console.error('No dungeon data found');
        title.textContent = "エラー";
        return;
    }
    
    const dungeonData = JSON.parse(dungeonDataJSON);
    const dungeonBattleResult = localStorage.getItem('dungeonBattleResult');
    const playerHP = localStorage.getItem('dungeonPlayerHP');
    
    title.textContent = won ? "🎉 勝利！" : "💔 敗北";
    title.style.color = won ? "#ffd700" : "#ff4757";
    
    document.getElementById('turnText').textContent = `第${dungeonData.dungeon.currentFloor}階`;
    document.getElementById('hpText').textContent = `残りHP: ${playerHP}`;
    document.getElementById('damageText').textContent = won ? "敵を倒した！" : "敗北しました...";
    document.getElementById('criticalText').textContent = "";
    document.getElementById('xpGainText').textContent = "";
    document.getElementById('coinGainText').textContent = "";
    
    // ボタン設定
    const homeBtn = document.getElementById('homeBtn');
    const retryBtn = document.getElementById('retryBtn');
    const onlineBtn = document.getElementById('onlineBtn');
    
    homeBtn.style.display = 'none';
    retryBtn.style.display = 'inline-block';
    onlineBtn.style.display = 'none';
    
    retryBtn.textContent = won ? "次の階へ" : "ダンジョンへ戻る";
    retryBtn.onclick = () => {
        if (won) {
            // 勝利した場合、次の階へ進む処理
            if (typeof window.socket !== 'undefined' && window.socket) {
                window.socket.emit('dungeon:floorCleared', {}, (response) => {
                    if (response.error) {
                        alert(`エラー: ${response.error}`);
                        location.href = 'index.html';
                        return;
                    }
                    
                    if (response.cleared) {
                        // ダンジョンクリア
                        showDungeonClearResult(response);
                    } else {
                        // 次の階へ
                        location.href = 'battle.html';
                    }
                });
            } else {
                alert('接続エラーです。ホーム画面に戻ります。');
                location.href = 'index.html';
            }
        } else {
            // 敗北した場合、ダンジョンを放棄してホームへ
            if (typeof window.socket !== 'undefined' && window.socket) {
                window.socket.emit('dungeon:playerDefeated', {}, (response) => {
                    if (response.error) {
                        alert(`エラー: ${response.error}`);
                    }
                    localStorage.removeItem('dungeonData');
                    localStorage.removeItem('isDungeonBattle');
                    location.href = 'index.html';
                });
            } else {
                localStorage.removeItem('dungeonData');
                localStorage.removeItem('isDungeonBattle');
                location.href = 'index.html';
            }
        }
    };
}

// ===================================
// ダンジョンクリア結果表示
// ===================================
function showDungeonClearResult(response) {
    title.textContent = "🏆 ダンジョンクリア！";
    title.style.color = "#ffd700";
    
    document.getElementById('turnText').textContent = `${response.dungeon.difficulty} ダンジョン`;
    document.getElementById('hpText').textContent = `クリア時間: ${response.dungeon.clearTime || '不明'}`;
    document.getElementById('damageText').textContent = `ランク: ${response.rank || 'C'}`;
    document.getElementById('criticalText').textContent = response.isFirstClear ? "🌟 初回クリアボーナス！" : "";
    document.getElementById('xpGainText').textContent = `獲得経験値: ${response.totalExp || 0}`;
    document.getElementById('coinGainText').textContent = `獲得コイン: ${response.totalCoins || 0}`;
    
    // 報酬アイテム表示
    if (response.rewards && response.rewards.length > 0) {
        const orbText = document.getElementById('orbText');
        orbText.style.display = 'block';
        orbText.textContent = `報酬: ${response.rewards.map(r => r.description || r.type).join(', ')}`;
    }
    
    const retryBtn = document.getElementById('retryBtn');
    retryBtn.textContent = "ホームへ戻る";
    retryBtn.onclick = () => {
        localStorage.removeItem('dungeonData');
        localStorage.removeItem('isDungeonBattle');
        location.href = 'index.html';
    };
    
    const homeBtn = document.getElementById('homeBtn');
    homeBtn.style.display = 'inline-block';
}

// 通常のリザルト処理（ダンジョンバトル以外の場合）
if (!wasDungeonBattle) {
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
    if (coinEl) coinEl.textContent = I18N.coin + " +" + coinGain;

    const stealText = document.getElementById("stealText");
    if (stealText) {
        if (stolenWeapon) {
            stealText.textContent = I18N.stealWeapon + " : " + getWeaponDisplayName(stolenWeapon);
            stealText.style.display = "block";
        } else if (lostWeapon) {
            stealText.textContent = I18N.lostWeapon + " : " + getWeaponDisplayName(lostWeapon);
            stealText.style.display = "block";
        } else {
            stealText.style.display = "none";
        }
    }

    // オーブドロップ表示
    const orbEl = document.getElementById("orbText");
    if (orbEl) {
        if (droppedOrb) {
            orbEl.textContent = "★オーブを入手！★\n" + getOrbDisplayName(droppedOrb);
            orbEl.style.display = "block";
        } else {
            orbEl.style.display = "none";
        }
    }

    // 通常モンスターからの素材ドロップ表示
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
        bossBtn.onclick = () => location.href = "index.html#section-boss";
    }
}
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

// クリーンアップ処理（ダンジョンバトル以外の場合）
if (!wasDungeonBattle) {
    localStorage.removeItem("stolenWeapon");
    localStorage.removeItem("lostWeapon");
    localStorage.removeItem("battleCoinGain");
    localStorage.removeItem("droppedOrb");
    localStorage.removeItem("isBotBattle");
    localStorage.removeItem("isBossBattle"); // Clear boss battle flag
    localStorage.removeItem("battleDifficulty"); // Clear difficulty
    localStorage.removeItem("battleResultData"); // Clear boss reward data
} else {
    // ダンジョンバトルのクリーンアップ
    localStorage.removeItem("dungeonBattleResult");
    localStorage.removeItem("dungeonPlayerHP");
    localStorage.removeItem("isDungeonBattle");
}
