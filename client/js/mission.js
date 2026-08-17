// client/js/missions.js

const MISSION_REWARDS = {
    XP: 300,
    COINS: 30,
};

const FINAL_REWARD_ORB_TIERS = ['tier2', 'tier3', 'tier4'];

// Pool of possible daily missions
const MISSION_POOL = [
    { id: 'win_bot_1', type: 'win_bot', target: 1, description: 'ボット対戦で1回勝利する' },
    { id: 'win_online_1', type: 'win_online', target: 1, description: 'オンライン対戦で1回勝利する' },
    { id: 'study_5_min', type: 'study', target: 300, description: '合計5分間勉強する' }, // 300 seconds
    { id: 'defeat_goblin_king_easy', type: 'defeat_boss', target: { bossId: 'goblin_king', difficulty: 'easy' }, description: 'ゴブリンキング(EASY)を1回討伐する' },
    { id: 'create_weapon_1', type: 'create_weapon', target: 1, description: 'オリジナル武器を1個作成する' },
    { id: 'synthesize_orb_1', type: 'synthesize_orb', target: 1, description: 'オーブを1回合成する' },
    { id: 'limit_break_1', type: 'limit_break', target: 1, description: '武器を1回限界突破する' },
    { id: 'upgrade_weapon_3', type: 'upgrade_weapon', target: 3, description: '武器を3回強化する' },
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
        const newMissions = shuffledMissions.slice(0, 3).map(mission => ({
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
    }
    renderDailyMissions();
}

/**
 * Update progress for a specific mission type.
 * @param {string} type - The type of mission (e.g., 'win_bot', 'study').
 * @param {number|object} value - The value to add to progress or check against.
 */
function updateMissionProgress(type, value = 1) {
    let player = getPlayerData();
    if (!player || !player.dailyMissions) return;

    let missionsUpdated = false;
    player.dailyMissions.missions.forEach(mission => {
        if (mission.type === type && !mission.completed) {
            if (type === 'defeat_boss') {
                if (mission.target.bossId === value.bossId && mission.target.difficulty === value.difficulty) {
                    mission.progress += 1;
                }
            } else {
                mission.progress += value;
            }

            if (mission.progress >= mission.target) {
                mission.completed = true;
            }
            missionsUpdated = true;
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
        alert('報酬を受け取れません。');
        return;
    }

    mission.claimed = true;
    player.xp = (player.xp || 0) + MISSION_REWARDS.XP;
    player.coins = (player.coins || 0) + MISSION_REWARDS.COINS;

    alert(`報酬を獲得しました！\n${MISSION_REWARDS.XP} XP\n${MISSION_REWARDS.COINS} コイン`);

    // Check for final reward
    const allClaimed = player.dailyMissions.missions.every(m => m.claimed);
    if (allClaimed && !player.dailyMissions.finalRewardClaimed) {
        player.dailyMissions.finalRewardClaimed = true;
        
        const randomTier = FINAL_REWARD_ORB_TIERS[Math.floor(Math.random() * FINAL_REWARD_ORB_TIERS.length)];
        const orb = createOrb(randomTier);
        if (orb) {
            if (!player.orbs) player.orbs = [];
            player.orbs.push(orb);
            alert(`デイリーミッションコンプリート！\n宝箱から ${getOrbDisplayName(orb)} を獲得しました！`);
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
        container.innerHTML = '<p>今日のミッションはありません。</p>';
        return;
    }

    container.innerHTML = '';
    player.dailyMissions.missions.forEach((mission, index) => {
        const progress = Math.min(mission.progress, mission.target);
        const target = typeof mission.target === 'object' ? 1 : mission.target;
        const progressText = mission.type === 'study' ? `${formatTime(progress)} / ${formatTime(target)}` : `${progress} / ${target}`;

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
                <span>報酬: ${MISSION_REWARDS.XP} XP, ${MISSION_REWARDS.COINS} コイン</span>
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
        finalRewardContainer.innerHTML = `
            <h4>デイリーコンプリート報酬</h4>
            <p>全てのミッションをクリアして宝箱を開けよう！ (進捗: ${completedCount} / 3)</p>
            <div class="final-reward-icon">${player.dailyMissions.finalRewardClaimed ? '?' : '?'}</div>
            <p>${player.dailyMissions.finalRewardClaimed ? '今日の報酬は獲得済みです。' : '報酬: Tier2以上のオーブ'}</p>
        `;
    }

    // Add event listeners to claim buttons
    container.querySelectorAll('.claim-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            claimMissionReward(parseInt(btn.dataset.index));
        });
    });
}
