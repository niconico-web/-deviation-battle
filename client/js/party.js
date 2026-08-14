// client/js/party.js

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
                window.socket.emit('party:leave');
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
    if (typeof setupPartyEventListeners === 'function') {
        setupPartyEventListeners();
    }
});
