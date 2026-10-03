// client/js/party.js
// ============================================
// パーティーシステム（MMO拡張版）
// ============================================

// パーティーメンバーの位置情報
let partyMemberPositions = {};

// パーティーシステムの初期化
function initializePartySystem() {
    setupPartyEventListeners();
    setupPartySocketListeners();
}

function setupPartyEventListeners() {
    const createPartyBtn = document.getElementById('createPartyBtn');
    const joinPartyBtn = document.getElementById('joinPartyBtn');
    const leavePartyBtn = document.getElementById('leavePartyBtn');
    const partyReadyBtn = document.getElementById('partyReadyBtn');
    const startBossBattleBtn = document.getElementById('startBossBattleBtn');

    if (createPartyBtn) {
        createPartyBtn.addEventListener('click', () => {
            const player = getPlayerData();
            if (player && window.socket) {
                window.socket.emit('party:create', player);
            }
        });
    }

    if (joinPartyBtn) {
        joinPartyBtn.addEventListener('click', () => {
            const partyId = document.getElementById('partyCodeInput').value.trim().toUpperCase();
            const player = getPlayerData();
            if (partyId && player && window.socket) {
                window.socket.emit('party:join', { partyId, player });
            }
        });
    }

    if (leavePartyBtn) {
        leavePartyBtn.addEventListener('click', () => {
            if (window.socket) {
                const player = getPlayerData();
                if (player) window.socket.emit('party:leave', { playerId: player.id });
            }
        });
    }

    if (partyReadyBtn) {
        partyReadyBtn.addEventListener('click', () => {
            if (window.socket) {
                const isReady = !partyReadyBtn.classList.contains('ready');
                window.socket.emit('party:setReady', { isReady });
            }
        });
    }

    if (startBossBattleBtn) {
        startBossBattleBtn.addEventListener('click', () => {
            const bossId = document.getElementById('bossSelect').value;
            const difficulty = document.getElementById('bossDifficulty').value;
            if (bossId && difficulty && window.socket) {
                // Save difficulty for result screen
                localStorage.setItem("battleDifficulty", difficulty);
                window.socket.emit('party:startBossBattle', { bossId, difficulty });
            }
        });
    }
}

function updatePartyUI(party) {
    const partyInfo = document.getElementById('party-info');
    const partyControls = document.getElementById('party-controls');
    const createPartyBtn = document.getElementById('createPartyBtn');
    const joinPartyControls = document.getElementById('joinPartyControls');
    const leavePartyBtn = document.getElementById('leavePartyBtn');
    const partyReadyBtn = document.getElementById('partyReadyBtn');
    const startBossBattleControls = document.getElementById('startBossBattleControls');
    const player = getPlayerData();

    if (!party || !player) {
        resetPartyUI();
        return;
    }

    partyInfo.style.display = 'block';
    createPartyBtn.style.display = 'none';
    joinPartyControls.style.display = 'none';
    leavePartyBtn.style.display = 'block';
    partyReadyBtn.style.display = 'block';

    const amIHost = party.hostId === player.id;
    if (amIHost) {
        startBossBattleControls.style.display = 'block';
    } else {
        startBossBattleControls.style.display = 'none';
    }

    let membersHtml = `<h3>Party (Code: ${party.id})</h3><ul>`;
    party.members.forEach(member => {
        membersHtml += `<li>${member.player.name} ${member.isReady ? '(Ready)' : ''}</li>`;
    });
    membersHtml += '</ul>';
    partyInfo.innerHTML = membersHtml;

    const myMember = party.members.find(m => m.id === player.id);
    if (myMember && myMember.isReady) {
        partyReadyBtn.textContent = 'Cancel Ready';
        partyReadyBtn.classList.add('ready');
    } else {
        partyReadyBtn.textContent = 'Ready';
        partyReadyBtn.classList.remove('ready');
    }
}

function resetPartyUI() {
    const partyInfo = document.getElementById('party-info');
    const createPartyBtn = document.getElementById('createPartyBtn');
    const joinPartyControls = document.getElementById('joinPartyControls');
    const leavePartyBtn = document.getElementById('leavePartyBtn');
    const partyReadyBtn = document.getElementById('partyReadyBtn');
    const startBossBattleControls = document.getElementById('startBossBattleControls');

    partyInfo.style.display = 'none';
    partyInfo.innerHTML = '';
    createPartyBtn.style.display = 'block';
    joinPartyControls.style.display = 'block';
    leavePartyBtn.style.display = 'none';
    partyReadyBtn.style.display = 'none';
    startBossBattleControls.style.display = 'none';
}

window.addEventListener('DOMContentLoaded', () => {
    if (typeof initializePartySystem === 'function') {
        initializePartySystem();
    }
});

// パーティーソケットリスナーの設定
function setupPartySocketListeners() {
    if (!window.socket) return;

    // パーティーメンバーの位置更新
    window.socket.on('party:memberPosition', (data) => {
        const { playerId, x, y, worldId } = data;
        partyMemberPositions[playerId] = { x, y, worldId, timestamp: Date.now() };
        
        // 町画面でパーティーメンバーの位置を表示
        if (typeof updatePartyMemberIndicators === 'function') {
            updatePartyMemberIndicators();
        }
    });

    // パーティーメンバーがワールドに入った
    window.socket.on('party:memberJoinedWorld', (data) => {
        const { playerId, worldId } = data;
        if (partyMemberPositions[playerId]) {
            partyMemberPositions[playerId].worldId = worldId;
        }
        
        addChatMessage({
            type: 'party',
            playerName: 'システム',
            playerLevel: 0,
            message: `パーティーメンバーが ${worldId} に入りました`,
            timestamp: Date.now()
        });
    });

    // パーティーメンバーがワールドから出た
    window.socket.on('party:memberLeftWorld', (data) => {
        const { playerId } = data;
        if (partyMemberPositions[playerId]) {
            delete partyMemberPositions[playerId];
        }
    });
}

// パーティーメンバーの位置情報を取得
function getPartyMemberPositions() {
    return partyMemberPositions;
}

// パーティーメンバーの位置情報をクリア
function clearPartyMemberPositions() {
    partyMemberPositions = {};
}

// 現在のワールドにいるパーティーメンバーを取得
function getPartyMembersInCurrentWorld(currentWorldId) {
    const members = [];
    for (const [playerId, pos] of Object.entries(partyMemberPositions)) {
        if (pos.worldId === currentWorldId) {
            members.push({ playerId, ...pos });
        }
    }
    return members;
}

// グローバル関数として公開
window.getPartyMemberPositions = getPartyMemberPositions;
window.clearPartyMemberPositions = clearPartyMemberPositions;
window.getPartyMembersInCurrentWorld = getPartyMembersInCurrentWorld;
