function setupRankingEventListeners() {
    const rankingMenuBtn = document.querySelector('.menu-btn[data-section="ranking"]');
    const refreshRankingBtn = document.getElementById('refreshRankingBtn');

    const fetchRanking = () => {
        if (window.socket && window.socket.connected) {
            console.log('[Ranking] Requesting ranking data...');
            window.socket.emit('ranking:get');
        } else {
            console.warn('[Ranking] Cannot fetch ranking, socket not connected.');
            const container = document.getElementById('ranking-list-container');
            if (container) {
                container.innerHTML = '<p>?T?[?o?[?????????????????B?????L???O???\???????????B</p>';
            }
        }
    };

    if (rankingMenuBtn) {
        rankingMenuBtn.addEventListener('click', fetchRanking);
    }

    if (refreshRankingBtn) {
        refreshRankingBtn.addEventListener('click', fetchRanking);
    }

    if (window.socket) {
        window.socket.on('ranking:list', (ranking) => {
            console.log('[Ranking] Received ranking data:', ranking);
            renderRanking(ranking);
        });
    }
}

function renderRanking(ranking) {
    const container = document.getElementById('ranking-list-container');
    if (!container) return;

    if (!ranking || ranking.length === 0) {
        container.innerHTML = '<p>ランキングデータがありません。</p>';
        return;
    }

    const player = getPlayerData();
    const playerId = player ? player.id : null;

    let tableHtml = `
        <table class="ranking-table">
            <thead>
                <tr>
                    <th>????</th>
                    <th>???O</th>
                    <th>???x??</th>
                    <th>?????X?R?A</th>
                    <th>???? (???/??l/?{?X)</th>
                </tr>
            </thead>
            <tbody>
    `;

    ranking.forEach((entry, index) => {
        const isCurrentUser = entry.id === playerId;
        tableHtml += `
            <tr class="${isCurrentUser ? 'current-user-rank' : ''}">
                <td>${index + 1}</td>
                <td>${escapeHtml(entry.name)}</td>
                <td>${entry.level}</td>
                <td>${entry.powerScore}</td>
                <td>${entry.studyMinutes}分 / ${entry.pvpWins}勝 / ${entry.bossRunCount}回</td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;

    container.innerHTML = tableHtml;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

window.addEventListener('DOMContentLoaded', () => {
    // socket??????????????????X?i?[?????
    setTimeout(() => {
        if (typeof setupRankingEventListeners === 'function') {
            setupRankingEventListeners();
        }
    }, 500); // script.js??socket????????????????????
});
