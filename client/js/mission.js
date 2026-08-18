// client/js/mission.js

const MISSION_REWARDS = {
    XP: 300,
    COINS: 30,
};

const FINAL_REWARD_ORB_TIERS = ['tier2', 'tier3', 'tier4'];

// Pool of possible daily missions
const MISSION_POOL = [
    { id: 'win_bot_3', type: 'win_bot', target: 3, description: '??????3?????' },
    { id: 'win_online_2', type: 'win_online', target: 2, description: '????????2?????' },
    { id: 'study_30_min', type: 'study', target: 1800, description: '??30??????' }, // 1800 seconds
    { id: 'level_up_1', type: 'level_up', target: 1, description: '????1???' },
    { id: 'create_weapon_1', type: 'create_weapon', target: 1, description: '????????1?????' },
    { id: 'synthesize_orb_2', type: 'synthesize_orb', target: 2, description: '????2?????' },
    { id: 'limit_break_1', type: 'limit_break', target: 1, description: '???1???????' },
    { id: 'upgrade_weapon_5', type: 'upgrade_weapon', target: 5, description: '???5?????' },
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
            let progressMade = false;
            if (type === 'defeat_boss') {
                const condition = mission.condition;
                if (condition) {
                    const bossIdMatch = !condition.bossId || condition.bossId === value.bossId;
                    const difficultyMatch = !condition.difficulty || condition.difficulty === value.difficulty;
                    if (bossIdMatch && difficultyMatch) {
                        mission.progress += 1;
                        progressMade = true;
                    }
                }
            } else {
                mission.progress += value;
                progressMade = true;
            }

            if (progressMade) {
                if (mission.progress >= mission.target) {
                    mission.completed = true;
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
        alert('??????????????');
        return;
    }

    mission.claimed = true;
    player.xp = (player.xp || 0) + MISSION_REWARDS.XP;
    player.coins = (player.coins || 0) + MISSION_REWARDS.COINS;

    alert(`??????????\n${MISSION_REWARDS.XP} XP\n${MISSION_REWARDS.COINS} ???`);

    // Check for final reward
    const allClaimed = player.dailyMissions.missions.every(m => m.claimed);
    if (allClaimed && !player.dailyMissions.finalRewardClaimed) {
        player.dailyMissions.finalRewardClaimed = true;
        
        const randomTier = FINAL_REWARD_ORB_TIERS[Math.floor(Math.random() * FINAL_REWARD_ORB_TIERS.length)];
        const orb = createOrb(randomTier);
        if (orb) {
            if (!player.orbs) player.orbs = [];
            player.orbs.push(orb);
            alert(`????????????????\n????? ${getOrbDisplayName(orb)} ????????`);
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
        container.innerHTML = '<p>???????????????</p>';
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
                <span>??: ${MISSION_REWARDS.XP} XP, ${MISSION_REWARDS.COINS} ???</span>
                <button class="btn btn-small claim-btn" data-index="${index}" ${!mission.completed || mission.claimed ? 'disabled' : ''}>
                    ${mission.claimed ? '???' : '????'}
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
            <h4>????????????</h4>
            <p>???????????????????????? (??: ${completedCount} / 3)</p>
            <div class="final-reward-icon">${player.dailyMissions.finalRewardClaimed ? '&#10004;' : '&#127873;'}</div>
            <p>${player.dailyMissions.finalRewardClaimed ? '?????????????' : '??: Tier2??????'}</p>
        `;
    }

    // Add event listeners to claim buttons
    container.querySelectorAll('.claim-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            claimMissionReward(parseInt(btn.dataset.index));
        });
    });
}
