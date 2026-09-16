// client/js/mission.js

// ミッション個別に報酬指定が無い場合のデフォルト報酬
const MISSION_REWARDS = {
    XP: 300,
    COINS: 30,
};

const FINAL_REWARD_ORB_TIERS = ['tier2', 'tier3', 'tier4'];

// クエストのランク（旧ギルドクエスト）に応じた報酬を計算する。
// ランクが高いほどXP・コインが多く、Bランク以上は達成時にオーブも入手できる。
const MISSION_RANK_VALUES = { F: 1, E: 2, D: 3, C: 4, B: 5, A: 6, S: 7 };
function getMissionRewardForRank(rank) {
    const rankValue = MISSION_RANK_VALUES[rank] || 1;
    const reward = { xp: rankValue * 100, coins: rankValue * 50 };
    if (rankValue >= 7) reward.orbTier = 'tier4';
    else if (rankValue >= 6) reward.orbTier = 'tier3';
    else if (rankValue >= 5) reward.orbTier = 'tier2';
    return reward;
}

// Pool of possible daily missions
// もともとの育成系ミッションに加え、以前はギルドクエストとして提供していた
// 「討伐」「納品」「対人戦」「勉強」系の内容もここに統合されている
// （ギルド機能自体は廃止し、報酬付きのクエスト性はミッションに引き継いだ）。
const MISSION_POOL = [
    // --- もともとの育成系ミッション（デフォルト報酬） ---
    { id: 'win_bot_3', type: 'win_bot', target: 3, description: 'ボット戦で3回勝利する' },
    { id: 'win_online_2', type: 'win_online', target: 2, description: 'オンライン対戦で2回勝利する' },
    { id: 'study_30_min', type: 'study', target: 1800, description: '合計30分勉強する' }, // 1800 seconds
    { id: 'level_up_1', type: 'level_up', target: 1, description: 'レベルを1上げる' },
    { id: 'create_weapon_1', type: 'create_weapon', target: 1, description: '武器を1つ作成する' },
    { id: 'synthesize_orb_2', type: 'synthesize_orb', target: 2, description: 'オーブを2つ合成する' },
    { id: 'limit_break_1', type: 'limit_break', target: 1, description: '武器を1回限界突破する' },
    { id: 'upgrade_weapon_5', type: 'upgrade_weapon', target: 5, description: '武器を5回強化する' },
    { id: 'defeat_boss_1', type: 'defeat_boss', target: 1, description: 'ボスを1体討伐する' },

    // --- 素材納品（旧ギルドクエスト） ---
    { id: 'collect_goblin_fang_3', type: 'collect_material', target: { materialId: 'goblin_fang', count: 3 }, description: 'ゴブリンの牙を3本集める', reward: getMissionRewardForRank('F') },
    { id: 'collect_slime_jelly_3', type: 'collect_material', target: { materialId: 'slime_jelly', count: 3 }, description: 'スライムゼリーを3個集める', reward: getMissionRewardForRank('F') },
    { id: 'collect_goblin_fang_6', type: 'collect_material', target: { materialId: 'goblin_fang', count: 6 }, description: 'ゴブリンの牙を6本集める', reward: getMissionRewardForRank('E') },
    { id: 'collect_goblin_hide_6', type: 'collect_material', target: { materialId: 'goblin_hide', count: 6 }, description: 'ゴブリンの皮を6枚集める', reward: getMissionRewardForRank('E') },
    { id: 'collect_slime_jelly_6', type: 'collect_material', target: { materialId: 'slime_jelly', count: 6 }, description: 'スライムゼリーを6個集める', reward: getMissionRewardForRank('E') },
    { id: 'collect_slime_core_5', type: 'collect_material', target: { materialId: 'slime_core', count: 5 }, description: 'スライムコアを5個集める', reward: getMissionRewardForRank('D') },
    { id: 'collect_dragon_scale_4', type: 'collect_material', target: { materialId: 'dragon_scale', count: 4 }, description: 'ドラゴンの鱗を4枚集める', reward: getMissionRewardForRank('C') },
    { id: 'collect_dragon_heart_3', type: 'collect_material', target: { materialId: 'dragon_heart', count: 3 }, description: 'ドラゴンの心臓を3個集める', reward: getMissionRewardForRank('C') },

    // --- ボス討伐（旧ギルドクエスト、特定のボス・難易度を指定） ---
    { id: 'defeat_goblin_king_easy_1', type: 'defeat_boss', target: 1, condition: { bossId: 'goblin_king', difficulty: 'easy' }, description: 'ゴブリンキング(イージー)を1体討伐する', reward: getMissionRewardForRank('F') },
    { id: 'defeat_goblin_king_easy_2', type: 'defeat_boss', target: 2, condition: { bossId: 'goblin_king', difficulty: 'easy' }, description: 'ゴブリンキング(イージー)を2体討伐する', reward: getMissionRewardForRank('C') },
    { id: 'defeat_goblin_king_medium_2', type: 'defeat_boss', target: 2, condition: { bossId: 'goblin_king', difficulty: 'medium' }, description: 'ゴブリンキング(ノーマル)を2体討伐する', reward: getMissionRewardForRank('B') },
    { id: 'defeat_orc_warlord_easy_2', type: 'defeat_boss', target: 2, condition: { bossId: 'orc_warlord', difficulty: 'easy' }, description: 'オークの戦将(イージー)を2体討伐する', reward: getMissionRewardForRank('C') },
    { id: 'defeat_orc_warlord_medium_2', type: 'defeat_boss', target: 2, condition: { bossId: 'orc_warlord', difficulty: 'medium' }, description: 'オークの戦将(ノーマル)を2体討伐する', reward: getMissionRewardForRank('B') },
    { id: 'defeat_shadow_serpent_medium_2', type: 'defeat_boss', target: 2, condition: { bossId: 'shadow_serpent', difficulty: 'medium' }, description: 'ヨルムンガンド(ノーマル)を2体討伐する', reward: getMissionRewardForRank('B') },
    { id: 'defeat_shadow_serpent_hard_1', type: 'defeat_boss', target: 1, condition: { bossId: 'shadow_serpent', difficulty: 'hard' }, description: 'ヨルムンガンド(ハード)を1体討伐する', reward: getMissionRewardForRank('A') },
    { id: 'defeat_ice_golem_medium_2', type: 'defeat_boss', target: 2, condition: { bossId: 'ice_golem', difficulty: 'medium' }, description: 'アイスゴーレム(ノーマル)を2体討伐する', reward: getMissionRewardForRank('B') },
    { id: 'defeat_ice_golem_hard_1', type: 'defeat_boss', target: 1, condition: { bossId: 'ice_golem', difficulty: 'hard' }, description: 'アイスゴーレム(ハード)を1体討伐する', reward: getMissionRewardForRank('A') },
    { id: 'defeat_flame_dragon_medium_2', type: 'defeat_boss', target: 2, condition: { bossId: 'flame_dragon', difficulty: 'medium' }, description: 'フレイムドラゴン(ノーマル)を2体討伐する', reward: getMissionRewardForRank('A') },
    { id: 'defeat_flame_dragon_hard_1', type: 'defeat_boss', target: 1, condition: { bossId: 'flame_dragon', difficulty: 'hard' }, description: 'フレイムドラゴン(ハード)を1体討伐する', reward: getMissionRewardForRank('A') },
    { id: 'defeat_abyssal_knight_hard_1', type: 'defeat_boss', target: 1, condition: { bossId: 'abyssal_knight', difficulty: 'hard' }, description: 'アビサルナイト(ハード)を1体討伐する', reward: getMissionRewardForRank('S') },
    { id: 'defeat_celestial_guardian_hard_1', type: 'defeat_boss', target: 1, condition: { bossId: 'celestial_guardian', difficulty: 'hard' }, description: 'セレスティアルガーディアン(ハード)を1体討伐する', reward: getMissionRewardForRank('S') },
    { id: 'defeat_abyss_warden_hard_1', type: 'defeat_boss', target: 1, condition: { bossId: 'abyss_warden', difficulty: 'hard' }, description: '深淵ヲ廻ルモノ(ハード)を1体討伐する', reward: getMissionRewardForRank('S') },

    // --- 対人戦（旧ギルドクエスト） ---
    { id: 'win_online_1_quest', type: 'win_online', target: 1, description: 'オンライン対戦で1回勝利する', reward: getMissionRewardForRank('F') },
    { id: 'win_online_3_quest', type: 'win_online', target: 3, description: 'オンライン対戦で3回勝利する', reward: getMissionRewardForRank('D') },
    { id: 'win_online_4_quest', type: 'win_online', target: 4, description: 'オンライン対戦で4回勝利する', reward: getMissionRewardForRank('C') },
    { id: 'win_online_6_quest', type: 'win_online', target: 6, description: 'オンライン対戦で6回勝利する', reward: getMissionRewardForRank('B') },

    // --- 勉強（旧ギルドクエスト） ---
    { id: 'study_1_hour_quest', type: 'study', target: 3600, description: '合計1時間勉強する', reward: getMissionRewardForRank('E') },
    { id: 'study_2_hour_quest', type: 'study', target: 7200, description: '合計2時間勉強する', reward: getMissionRewardForRank('D') },
    { id: 'study_3_hour_quest', type: 'study', target: 10800, description: '合計3時間勉強する', reward: getMissionRewardForRank('C') },
];

/**
 * Get today's date as a string 'YYYY-MM-DD'
 */
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Initialize or reset daily missions for the player.
 */
function initializeDailyMissions() {
    let player = getPlayerData();
    if (!player) return;

    const today = getTodayDateString();
    if (!player.dailyMissions || player.dailyMissions.date !== today) {
        // Generate new missions for the day
        const shuffledMissions = [...MISSION_POOL].sort(() => 0.5 - Math.random());
        const newMissions = shuffledMissions.slice(0, 4).map(mission => ({
            ...mission,
            progress: 0,
            completed: false,
            claimed: false,
        }));

        player.dailyMissions = {
            date: today,
            missions: newMissions,
            finalRewardClaimed: false,
        };
        localStorage.setItem("player", JSON.stringify(player));
        console.log('[Mission] Daily missions initialized for', today);
    }
    renderDailyMissions();
}

/**
 * 指定されたミッションの目標数値（進捗の分母）を取得する。
 * targetがオブジェクト（素材収集など）の場合はcount/secondsを見る。
 */
function getMissionTargetValue(mission) {
    if (typeof mission.target === 'object' && mission.target !== null) {
        return mission.target.count || mission.target.seconds || 1;
    }
    return mission.target;
}

/**
 * 指定されたミッションの報酬（xp/coins/orbTier）を取得する。
 * 個別指定が無い場合はデフォルト報酬を使う。
 */
function getMissionReward(mission) {
    if (mission.reward) return mission.reward;
    return { xp: MISSION_REWARDS.XP, coins: MISSION_REWARDS.COINS };
}

/**
 * Update progress for a specific mission type.
 * @param {string} type - The type of mission (e.g., 'win_bot', 'study').
 * @param {number|object} value - The value to add to progress or check against.
 */
function updateMissionProgress(type, value = 1) {
    let player = getPlayerData();
    if (!player || !player.dailyMissions) {
        console.log(`[Mission] Cannot update mission progress: player=${!!player}, dailyMissions=${!!player?.dailyMissions}`);
        return;
    }

    console.log(`[Mission] Updating progress for type=${type}, value=${JSON.stringify(value)}`);
    let missionsUpdated = false;
    player.dailyMissions.missions.forEach(mission => {
        if (mission.type === type && !mission.completed) {
            let progressMade = false;
            const targetValue = getMissionTargetValue(mission);
            if (type === 'defeat_boss') {
                const condition = mission.condition;
                if (condition) {
                    const bossIdMatch = !condition.bossId || condition.bossId === value.bossId;
                    const difficultyMatch = !condition.difficulty || condition.difficulty === value.difficulty;
                    if (bossIdMatch && difficultyMatch) {
                        mission.progress += 1;
                        progressMade = true;
                        console.log(`[Mission] defeat_boss progress updated: ${mission.progress}/${targetValue}`);
                    }
                } else {
                    // 条件がない場合はどのボスでもカウント
                    mission.progress += 1;
                    progressMade = true;
                    console.log(`[Mission] defeat_boss progress updated (no condition): ${mission.progress}/${targetValue}`);
                }
            } else if (type === 'collect_material') {
                if (mission.target.materialId === value.materialId) {
                    mission.progress += value.count;
                    progressMade = true;
                }
            } else {
                mission.progress += value;
                progressMade = true;
                console.log(`[Mission] ${type} progress updated: ${mission.progress}/${targetValue}`);
            }

            if (progressMade) {
                if (mission.progress >= targetValue) {
                    mission.completed = true;
                    mission.progress = targetValue;
                    console.log(`[Mission] Mission ${mission.id} completed!`);
                }
                missionsUpdated = true;
            }
        }
    });

    if (missionsUpdated) {
        localStorage.setItem("player", JSON.stringify(player));
        renderDailyMissions();
    }
}

/**
 * Claim reward for a completed mission.
 * @param {number} missionIndex - The index of the mission to claim.
 */
function claimMissionReward(missionIndex) {
    let player = getPlayerData();
    if (!player || !player.dailyMissions) return;

    const mission = player.dailyMissions.missions[missionIndex];
    if (!mission || !mission.completed || mission.claimed) {
        alert('報酬を受け取れません');
        return;
    }

    mission.claimed = true;
    const reward = getMissionReward(mission);
    player.xp = (player.xp || 0) + reward.xp;
    player.coins = (player.coins || 0) + reward.coins;

    let msg = `ミッション達成！\n${reward.xp} XP\n${reward.coins} コイン`;

    // 高難度ミッション（Bランク以上相当）はクリア時にオーブも入手できる
    if (reward.orbTier && typeof createOrb === 'function') {
        const bonusOrb = createOrb(reward.orbTier);
        if (bonusOrb) {
            if (!player.orbs) player.orbs = [];
            player.orbs.push(bonusOrb);
            msg += `\n特別報酬: ${typeof getOrbDisplayName === 'function' ? getOrbDisplayName(bonusOrb) : bonusOrb.tier}`;
        }
    }

    alert(msg);

    // Check for final reward
    const allClaimed = player.dailyMissions.missions.every(m => m.claimed);
    if (allClaimed && !player.dailyMissions.finalRewardClaimed) {
        player.dailyMissions.finalRewardClaimed = true;
        
        const randomTier = FINAL_REWARD_ORB_TIERS[Math.floor(Math.random() * FINAL_REWARD_ORB_TIERS.length)];
        const orb = createOrb(randomTier);
        if (orb) {
            if (!player.orbs) player.orbs = [];
            player.orbs.push(orb);
            alert(`全ミッション達成！\n報酬として ${getOrbDisplayName(orb)} を入手しました！`);
            if (typeof renderOrbInventory === 'function') renderOrbInventory();
        }
    }

    localStorage.setItem("player", JSON.stringify(player));
    updateStatus(player);
    updateXpDisplay(player);
    renderDailyMissions();
}

/**
 * Render the daily missions UI.
 */
function renderDailyMissions() {
    const container = document.getElementById('daily-missions-list');
    if (!container) return;

    const player = getPlayerData();
    if (!player || !player.dailyMissions) {
        container.innerHTML = '<p>ミッションデータがありません。</p>';
        return;
    }

    container.innerHTML = '';
    player.dailyMissions.missions.forEach((mission, index) => {
        const target = getMissionTargetValue(mission);
        const progress = Math.min(mission.progress, target);
        const progressText = mission.type === 'study' ? formatTime(progress) : `${progress} / ${target}`;
        const reward = getMissionReward(mission);
        const rewardText = `報酬: ${reward.xp} XP, ${reward.coins} コイン${reward.orbTier ? ' + オーブ' : ''}`;

        const missionEl = document.createElement('div');
        missionEl.className = 'mission-item';
        if (mission.completed) missionEl.classList.add('completed');
        if (mission.claimed) missionEl.classList.add('claimed');

        missionEl.innerHTML = `
            <div class="mission-description">${mission.description}</div>
            <div class="mission-progress">
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${(progress / target) * 100}%"></div>
                </div>
                <span class="progress-text">${progressText}</span>
            </div>
            <div class="mission-reward">
                <span>${rewardText}</span>
                <button class="btn btn-small claim-btn" data-index="${index}" ${!mission.completed || mission.claimed ? 'disabled' : ''}>
                    ${mission.claimed ? '受取済' : '受け取る'}
                </button>
            </div>
        `;
        container.appendChild(missionEl);
    });

    // Final reward status
    const finalRewardContainer = document.getElementById('daily-final-reward');
    if (finalRewardContainer) {
        const completedCount = player.dailyMissions.missions.filter(m => m.claimed).length;
        const totalCount = player.dailyMissions.missions.length;
        finalRewardContainer.innerHTML = `
            <h4>最終達成報酬</h4>
            <p>全てのミッションを達成して報酬を受け取ろう！ (達成: ${completedCount} / ${totalCount})</p>
            <div class="final-reward-icon">${player.dailyMissions.finalRewardClaimed ? '??' : '?'}</div>
            <p>${player.dailyMissions.finalRewardClaimed ? '最終報酬は受取済みです' : '報酬: Tier2以上のオーブ'}</p>
        `;
    }

    // Add event listeners to claim buttons
    container.querySelectorAll('.claim-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            claimMissionReward(parseInt(btn.dataset.index));
        });
    });
}
