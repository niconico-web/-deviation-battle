// イベントハンドラーが既に設定されているかをチェックするフラグ
let rankingHandlerInitialized = false;
let socketHandlerSetup = false;

function setupRankingEventListeners() {
    // 既に初期化されている場合は何もしない
    if (rankingHandlerInitialized) {
        console.log('[Ranking] Event listeners already initialized, skipping...');
        return;
    }
    rankingHandlerInitialized = true;
    
    const rankingMenuBtn = document.querySelector('.menu-btn[data-section="ranking"]');
    const refreshRankingBtn = document.getElementById('refreshRankingBtn');

    const fetchRanking = () => {
        const container = document.getElementById('ranking-list-container');
        if (container) {
            container.innerHTML = '<p>ランキングを読み込み中...</p>';
        }
        
        if (window.socket && window.socket.connected) {
            console.log('[Ranking] Requesting ranking data...');
            window.socket.emit('ranking:get');
            
            // タイムアウト設定（10秒）
            setTimeout(() => {
                if (container.innerHTML.includes('読み込み中')) {
                    container.innerHTML = '<p>ランキングの取得に失敗しました。再度お試しください。</p>';
                }
            }, 10000);
        } else {
            console.warn('[Ranking] Cannot fetch ranking, socket not connected.');
            if (container) {
                container.innerHTML = '<p>サーバーに接続されていません。ランキングを取得できません。再接続をお待ちください。</p>';
            }
        }
    };

    if (rankingMenuBtn) {
        rankingMenuBtn.addEventListener('click', fetchRanking);
    }

    if (refreshRankingBtn) {
        refreshRankingBtn.addEventListener('click', fetchRanking);
    }

    // ソケットイベントハンドラーを設定
    const setupSocketHandler = () => {
        if (!window.socket) return;
        
        // 既存のハンドラーを削除して重複を防ぐ
        window.socket.off('ranking:list');
        
        window.socket.on('ranking:list', (ranking) => {
            console.log('[Ranking] Received ranking data:', ranking);
            renderRanking(ranking);
        });
        
        socketHandlerSetup = true;
        console.log('[Ranking] Socket handler set up');
    };

    // 即時設定
    setupSocketHandler();
    
    // ソケットが後で初期化される場合に備えて、定期的にチェック
    const checkInterval = setInterval(() => {
        if (window.socket && window.socket.connected && !socketHandlerSetup) {
            setupSocketHandler();
            clearInterval(checkInterval);
        }
    }, 1000);
    
    // 5秒後にチェックを停止
    setTimeout(() => clearInterval(checkInterval), 5000);
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
                    <th>順位</th>
                    <th>プレイヤー名</th>
                    <th>レベル</th>
                    <th>戦力スコア</th>
                    <th>実績 (勉強/勝利/ボス)</th>
                </tr>
            </thead>
            <tbody>
    `;

    ranking.forEach((entry, index) => {
        const isCurrentUser = entry.id === playerId;
        const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
        tableHtml += `
            <tr class="${isCurrentUser ? 'current-user-rank' : ''}">
                <td>${rankLabel}</td>
                <td>${escapeHtml(entry.name)}${isCurrentUser ? ' <span style="color:var(--accent-blue);font-size:0.75em;">(自分)</span>' : ''}</td>
                <td>Lv.${entry.level}</td>
                <td>${entry.powerScore.toLocaleString()}</td>
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
    // socketが初期化されるのを待ってからイベントリスナーを設定
    setTimeout(() => {
        if (typeof setupRankingEventListeners === 'function') {
            setupRankingEventListeners();
        }
    }, 500); // script.jsでsocketが初期化されるのを待つ
});
