// Set up home button immediately so it works even if other scripts fail.
document.getElementById("homeBtn").onclick = () => location.href = "index.html";

// ソケット接続（ダンジョンバトルの場合必要）
const wasDungeonBattle = localStorage.getItem("isDungeonBattle") === "true";
if (wasDungeonBattle) {
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

// 「もう一度戦う」で使うため、末尾でクリアされる前にバトル種別を控えておく
const wasBotBattle = localStorage.getItem("isBotBattle");
const wasBossBattle = localStorage.getItem("isBossBattle");
const battleDifficultyValue = localStorage.getItem("battleDifficulty");
const partyDataValue = localStorage.getItem("partyData");

if (wasDungeonBattle) {
    // ダンジョンバトルの場合は専用の処理のみを行う
    handleDungeonResult(won);
} else {
    handleNormalResult();
}

// ===================================
// 通常のリザルト処理（ダンジョンバトル以外の場合）
// ===================================
function handleNormalResult() {
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
            retryBtn.textContent = "もう一度戦う";
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
        onlineBtn.textContent = "オンラインへ";
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

    // クリーンアップ処理
    localStorage.removeItem("stolenWeapon");
    localStorage.removeItem("lostWeapon");
    localStorage.removeItem("battleCoinGain");
    localStorage.removeItem("droppedOrb");
    localStorage.removeItem("isBotBattle");
    localStorage.removeItem("isBossBattle"); // Clear boss battle flag
    localStorage.removeItem("battleDifficulty"); // Clear difficulty
    localStorage.removeItem("battleResultData"); // Clear boss reward data
}

// ===================================
// ダンジョン結果処理
// ===================================
// 勝敗にかかわらずまずリザルト画面に遷移し、
//   ・勝利時：次の階へ進むか、その時点で保有している報酬を持って撤退するかを選べる
//   ・敗北時：そのダンジョンで得た報酬を全て失い、さらに所持金の半分を失う
function handleDungeonResult(won) {
    const dungeonDataJSON = localStorage.getItem('dungeonData');
    if (!dungeonDataJSON) {
        console.error('No dungeon data found');
        title.textContent = "エラー";
        cleanupDungeonStorage();
        return;
    }

    const dungeonData = JSON.parse(dungeonDataJSON);
    const difficulty = dungeonData.dungeon?.difficulty;
    const dungeonPlayerHP = localStorage.getItem('dungeonPlayerHP') || "0";
    // ダンジョンのセッションはページ遷移をまたぐため、Socket.IOのsocket.id（接続ごとに
    // 変わる）ではなく、プレイヤーの永続ID（player.id）でサーバー側のダンジョンを
    // 特定する。これが無いと毎回のページ遷移で新しい接続になり、
    // 「アクティブなダンジョンがありません」エラーになってしまう。
    const dungeonPlayer = typeof getPlayerData === 'function' ? getPlayerData() : null;
    const dungeonPlayerId = dungeonPlayer ? dungeonPlayer.id : null;

    // 通常リザルト用の要素は使わないので隠しておく
    hideNormalResultFields();

    const retryBtn = document.getElementById('retryBtn');
    const onlineBtn = document.getElementById('onlineBtn');
    const partyBtn = document.getElementById('partyBtn');
    const bossBtn = document.getElementById('bossBtn');
    const homeBtn = document.getElementById('homeBtn');
    if (partyBtn) partyBtn.style.display = 'none';
    if (bossBtn) bossBtn.style.display = 'none';
    if (homeBtn) homeBtn.style.display = 'none';

    if (!window.socket) {
        title.textContent = "エラー";
        document.getElementById('damageText').textContent = "接続エラーです。ホーム画面に戻ります。";
        if (retryBtn) retryBtn.style.display = 'none';
        if (onlineBtn) onlineBtn.style.display = 'none';
        cleanupDungeonStorage();
        setTimeout(() => location.href = 'index.html', 2000);
        return;
    }

    if (won) {
        title.textContent = "🎉 勝利！";
        title.style.color = "#ffd700";
        document.getElementById('hpText').textContent = `残りHP: ${dungeonPlayerHP}`;

        window.socket.emit('dungeon:floorCleared', { playerId: dungeonPlayerId }, (response) => {
            if (response.error) {
                alert(`エラー: ${response.error}`);
                cleanupDungeonStorage();
                location.href = 'index.html';
                return;
            }

            if (response.cleared) {
                showDungeonClearResult(response, difficulty);
                return;
            }

            // まだダンジョンは続く：この階のクリア報酬を表示し、
            // 「次の階へ」か「撤退する」かを選ばせる
            document.getElementById('turnText').textContent = `第${response.dungeon.currentFloor - 1}階 クリア！`;
            document.getElementById('damageText').textContent =
                `この階の報酬: コイン+${response.floorReward.coins} / 経験値+${response.floorReward.exp}`;
            document.getElementById('criticalText').textContent =
                `ここまでの保有報酬（撤退時に持ち帰れる分）: コイン${response.dungeon.totalCoins} / 経験値${response.dungeon.totalExp}`;

            // 次の階のためにデータを更新
            localStorage.setItem('dungeonData', JSON.stringify({
                dungeon: response.dungeon,
                currentMonsters: response.nextMonsters
            }));
            const nextEnemy = response.nextMonsters && response.nextMonsters[0];
            if (nextEnemy) {
                localStorage.setItem('enemy', JSON.stringify(nextEnemy));
            }

            if (retryBtn) {
                retryBtn.style.display = 'inline-block';
                retryBtn.textContent = '次の階へ';
                retryBtn.onclick = () => {
                    const battlePlayerJSON = localStorage.getItem('battlePlayer');
                    const battlePlayer = battlePlayerJSON ? JSON.parse(battlePlayerJSON) : null;
                    if (battlePlayer) {
                        // HPは全回復せず、前の階を終えた時点のHPを引き継ぐ
                        battlePlayer.hp = Math.max(1, parseInt(dungeonPlayerHP, 10) || battlePlayer.hp);
                        localStorage.setItem('battlePlayer', JSON.stringify(battlePlayer));
                    }
                    localStorage.setItem('isBotBattle', 'true');
                    localStorage.setItem('isDungeonBattle', 'true');
                    // 10階（ボス階）に到達した場合はボス専用の問題・演出を有効にする
                    if (response.dungeon && response.dungeon.currentFloor === 10) {
                        localStorage.setItem('isBossBattle', 'true');
                    } else {
                        localStorage.removeItem('isBossBattle');
                    }
                    location.href = 'battle.html';
                };
            }

            if (onlineBtn) {
                onlineBtn.style.display = 'inline-block';
                onlineBtn.textContent = '撤退する';
                onlineBtn.onclick = () => {
                    if (!confirm('撤退すると、それ以上先の階には進めなくなります。ここまでの報酬を持ち帰りますか？')) {
                        return;
                    }
                    window.socket.emit('dungeon:retreat', { playerId: dungeonPlayerId }, (retreatResponse) => {
                        if (retreatResponse.error) {
                            alert(`エラー: ${retreatResponse.error}`);
                            cleanupDungeonStorage();
                            location.href = 'index.html';
                            return;
                        }
                        applyDungeonRunRewards(retreatResponse.difficulty || difficulty, {
                            coins: retreatResponse.totalCoins,
                            exp: retreatResponse.totalExp,
                            rewards: retreatResponse.rewards,
                            isFirstClear: false
                        });
                        alert(`撤退しました。コイン+${retreatResponse.totalCoins} / 経験値+${retreatResponse.totalExp} を持ち帰りました。`);
                        cleanupDungeonStorage();
                        location.href = 'index.html';
                    });
                };
            }
        });
    } else {
        title.textContent = "💔 敗北";
        title.style.color = "#ff4757";
        document.getElementById('hpText').textContent = `残りHP: ${dungeonPlayerHP}`;
        document.getElementById('damageText').textContent = "敗北しました…このダンジョンで得た報酬はすべて失われました。";

        window.socket.emit('dungeon:playerDefeated', { playerId: dungeonPlayerId }, (response) => {
            if (response.error) {
                alert(`エラー: ${response.error}`);
            }

            // 所持金の半分を失うペナルティ（このダンジョンで得た分は元々サーバー側で
            // 加算されていないため、何も加算しないことで「全て失う」を表現している）
            const penalizedPlayer = applyDungeonDefeatPenalty();
            document.getElementById('criticalText').textContent = penalizedPlayer
                ? `ペナルティ: 所持金が半分になりました（残り ${penalizedPlayer.coins}コイン）`
                : '';

            if (retryBtn) {
                retryBtn.style.display = 'inline-block';
                retryBtn.textContent = 'ダンジョンへ戻る';
                retryBtn.onclick = () => {
                    cleanupDungeonStorage();
                    location.href = 'index.html#section-dungeon';
                };
            }
            if (onlineBtn) onlineBtn.style.display = 'none';
        });
    }
}

// ===================================
// ダンジョンクリア（10階のボス撃破）結果表示
// ===================================
function showDungeonClearResult(response, difficulty) {
    applyDungeonRunRewards(response.dungeon?.difficulty || difficulty, {
        coins: response.totalCoins,
        exp: response.totalExp,
        rewards: response.rewards,
        isFirstClear: response.isFirstClear
    });

    title.textContent = "🏆 ダンジョンクリア！";
    title.style.color = "#ffd700";

    document.getElementById('turnText').textContent = `${getDifficultyDisplayName(response.dungeon?.difficulty || difficulty)} ダンジョン`;
    document.getElementById('hpText').textContent = `クリアランク: ${response.rank || 'C'}`;
    document.getElementById('damageText').textContent = response.isFirstClear ? "🌟 初回クリアボーナス！" : "";
    const xpEl = document.getElementById('xpGainText');
    if (xpEl) xpEl.textContent = `獲得経験値: ${response.totalExp || 0}`;
    const coinEl = document.getElementById('coinGainText');
    if (coinEl) coinEl.textContent = `獲得コイン: ${response.totalCoins || 0}`;

    const orbText = document.getElementById('orbText');
    const specialRewards = (response.rewards || []).filter(r => r.type === 'orb' || r.type === 'item');
    if (orbText && specialRewards.length > 0) {
        orbText.style.display = 'block';
        orbText.textContent = `報酬: ${specialRewards.map(r => r.description || r.type).join(', ')}`;
    }

    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.style.display = 'inline-block';
        retryBtn.textContent = 'ホームへ戻る';
        retryBtn.onclick = () => {
            cleanupDungeonStorage();
            location.href = 'index.html';
        };
    }
    const onlineBtn = document.getElementById('onlineBtn');
    if (onlineBtn) onlineBtn.style.display = 'none';
}

// ===================================
// ダンジョン報酬をプレイヤーデータへ反映
// ===================================
// ダンジョンをクリアする（10階のボスを倒す）か、途中で撤退した場合にのみ呼ばれる。
// 敗北した場合は呼ばれないため、その時点までの報酬はすべて失われたことになる。
function applyDungeonRunRewards(difficulty, { coins = 0, exp = 0, rewards = [], isFirstClear = false } = {}) {
    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    if (!player) return null;

    player.coins = (player.coins || 0) + (coins || 0);

    const oldLevel = typeof calcLevel === 'function' ? calcLevel(player.xp || 0) : (player.level || 1);
    player.xp = (player.xp || 0) + (exp || 0);
    const newLevel = typeof calcLevel === 'function' ? calcLevel(player.xp) : oldLevel;
    player.level = newLevel;

    let updatedPlayer = player;
    if (newLevel > oldLevel && typeof addSkillPointsOnLevelUp === 'function') {
        updatedPlayer = addSkillPointsOnLevelUp(player, oldLevel, newLevel) || player;
    }

    (rewards || []).forEach(reward => {
        if (reward.type === 'orb' && typeof createOrb === 'function') {
            const orb = createOrb(reward.tier);
            if (orb) {
                updatedPlayer.orbs = updatedPlayer.orbs || [];
                updatedPlayer.orbs.push(orb);
            }
        } else if (reward.type === 'item') {
            updatedPlayer.dungeonItems = updatedPlayer.dungeonItems || [];
            updatedPlayer.dungeonItems.push({
                id: reward.itemId,
                name: reward.description || reward.itemId,
                rarity: reward.rarity || null,
                obtainedAt: Date.now()
            });
        }
    });

    if (isFirstClear && difficulty) {
        updatedPlayer.dungeonClears = updatedPlayer.dungeonClears || {};
        updatedPlayer.dungeonClears[difficulty] = true;
    }

    localStorage.setItem("player", JSON.stringify(updatedPlayer));
    return updatedPlayer;
}

// ===================================
// ダンジョン敗北ペナルティ（所持金の半分を失う）
// ===================================
function applyDungeonDefeatPenalty() {
    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    if (!player) return null;

    player.coins = Math.floor((player.coins || 0) / 2);
    localStorage.setItem("player", JSON.stringify(player));
    return player;
}

function getDifficultyDisplayName(difficulty) {
    const names = {
        easy: 'イージー',
        normal: 'ノーマル',
        hard: 'ハード',
        very_hard: 'ベリーハード',
        nightmare: 'ナイトメア'
    };
    return names[difficulty] || difficulty || '不明';
}

// 通常リザルト用のUI要素はダンジョン結果画面では使わないため隠す
function hideNormalResultFields() {
    ['stealText', 'materialDropText', 'bossWeaponDropText', 'limitBreakMaterialText', 'bossSkillDropText'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const xpEl = document.getElementById('xpGainText');
    if (xpEl) xpEl.textContent = '';
    const coinEl = document.getElementById('coinGainText');
    if (coinEl) coinEl.textContent = '';
    const orbEl = document.getElementById('orbText');
    if (orbEl) orbEl.style.display = 'none';
}

function cleanupDungeonStorage() {
    localStorage.removeItem('dungeonData');
    localStorage.removeItem('isDungeonBattle');
    localStorage.removeItem('dungeonBattleResult');
    localStorage.removeItem('dungeonPlayerHP');
    localStorage.removeItem('isBotBattle');
    localStorage.removeItem('isBossBattle');
    localStorage.removeItem('enemy');
    localStorage.removeItem('rewardsApplied');
}
