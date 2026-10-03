// ============================================
// PvP闘技場システム
// ============================================

// PvPランキングデータ
let pvpRanking = [];

// 現在のシーズン
let currentSeason = 1;

// シーズン情報
const SEASON_DURATION = 30 * 24 * 60 * 60 * 1000; // 30日
let seasonStartTime = Date.now();

// PvP統計
let pvpStats = {
    wins: 0,
    losses: 0,
    draws: 0,
    currentWinStreak: 0,
    maxWinStreak: 0,
    seasonPoints: 0
};

// PvPシステムの初期化
function initPvPSystem() {
    loadPvPData();
    setupPvPSocketListeners();
}

// PvPデータをロード
function loadPvPData() {
    const player = getPlayerData();
    if (player) {
        if (player.pvpStats) {
            pvpStats = player.pvpStats;
        }
        if (player.seasonStartTime) {
            seasonStartTime = player.seasonStartTime;
        }
    }
    
    // シーズンチェック
    checkSeason();
}

// PvPデータを保存
function savePvPData() {
    const player = getPlayerData();
    if (player) {
        player.pvpStats = pvpStats;
        player.seasonStartTime = seasonStartTime;
        localStorage.setItem('player', JSON.stringify(player));
        syncPlayerToServer(true);
    }
}

// シーズンチェック
function checkSeason() {
    const now = Date.now();
    const seasonElapsed = now - seasonStartTime;
    
    if (seasonElapsed > SEASON_DURATION) {
        // シーズン終了
        endSeason();
    }
}

// シーズン終了処理
function endSeason() {
    currentSeason++;
    seasonStartTime = Date.now();
    
    // シーズン報酬を付与
    const player = getPlayerData();
    if (player) {
        const rewardPoints = Math.floor(pvpStats.seasonPoints / 10);
        player.coins = (player.coins || 0) + rewardPoints;
        
        addChatMessage({
            type: 'system',
            playerName: 'PvP',
            playerLevel: 0,
            message: `シーズン${currentSeason - 1}が終了しました！報酬として${rewardPoints}コインを獲得しました`,
            timestamp: Date.now()
        });
        
        // 統計をリセット
        pvpStats = {
            wins: 0,
            losses: 0,
            draws: 0,
            currentWinStreak: 0,
            maxWinStreak: 0,
            seasonPoints: 0
        };
        
        savePvPData();
    }
}

// PvP勝利時の処理
function handlePvPWin() {
    pvpStats.wins++;
    pvpStats.currentWinStreak++;
    pvpStats.seasonPoints += 10;
    
    if (pvpStats.currentWinStreak > pvpStats.maxWinStreak) {
        pvpStats.maxWinStreak = pvpStats.currentWinStreak;
    }
    
    savePvPData();
}

// PvP敗北時の処理
function handlePvPLoss() {
    pvpStats.losses++;
    pvpStats.currentWinStreak = 0;
    pvpStats.seasonPoints = Math.max(0, pvpStats.seasonPoints - 5);
    
    savePvPData();
}

// PvP引き分け時の処理
function handlePvPDraw() {
    pvpStats.draws++;
    pvpStats.seasonPoints += 3;
    
    savePvPData();
}

// PvPランクを計算
function calculatePvPRank() {
    const totalGames = pvpStats.wins + pvpStats.losses + pvpStats.draws;
    if (totalGames === 0) return 'Unranked';
    
    const winRate = pvpStats.wins / totalGames;
    
    if (pvpStats.seasonPoints >= 1000) return 'Legendary';
    if (pvpStats.seasonPoints >= 500) return 'Diamond';
    if (pvpStats.seasonPoints >= 300) return 'Platinum';
    if (pvpStats.seasonPoints >= 150) return 'Gold';
    if (pvpStats.seasonPoints >= 50) return 'Silver';
    return 'Bronze';
}

// PvPランキングUIを表示
function showPvPRankingUI() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'pvpRankingModal';
    
    const myRank = calculatePvPRank();
    const winRate = pvpStats.wins + pvpStats.losses + pvpStats.draws > 0 
        ? Math.round((pvpStats.wins / (pvpStats.wins + pvpStats.losses + pvpStats.draws)) * 100) 
        : 0;
    
    const seasonEndTime = new Date(seasonStartTime + SEASON_DURATION);
    const seasonRemaining = Math.ceil((seasonEndTime - Date.now()) / (24 * 60 * 60 * 1000));
    
    let rankingList = '';
    if (pvpRanking.length > 0) {
        rankingList = pvpRanking.slice(0, 10).map((player, index) => `
            <div class="ranking-item ${index < 3 ? 'top-rank' : ''}">
                <span class="ranking-position">${index + 1}</span>
                <span class="ranking-name">${player.name}</span>
                <span class="ranking-level">Lv.${player.level}</span>
                <span class="ranking-points">${player.points}pt</span>
            </div>
        `).join('');
    } else {
        rankingList = '<p class="no-ranking-data">ランキングデータがありません</p>';
    }
    
    modal.innerHTML = `
        <div class="modal-content pvp-ranking-modal">
            <button type="button" class="close btn btn-secondary">閉じる</button>
            <h2>⚔️ PvP闘技場ランキング</h2>
            
            <div class="season-info">
                <span>シーズン ${currentSeason}</span>
                <span>残り ${seasonRemaining} 日</span>
            </div>
            
            <div class="my-pvp-stats">
                <h3>自分の成績</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">ランク</span>
                        <span class="stat-value rank-${myRank.toLowerCase()}">${myRank}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">勝率</span>
                        <span class="stat-value">${winRate}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">勝利数</span>
                        <span class="stat-value">${pvpStats.wins}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">敗北数</span>
                        <span class="stat-value">${pvpStats.losses}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">最大連勝</span>
                        <span class="stat-value">${pvpStats.maxWinStreak}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">シーズンポイント</span>
                        <span class="stat-value">${pvpStats.seasonPoints}</span>
                    </div>
                </div>
            </div>
            
            <div class="ranking-list">
                <h3>トッププレイヤー</h3>
                ${rankingList}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // イベントリスナー
    modal.querySelector('.close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    // ランキングデータをリクエスト
    if (window.socket && window.socket.connected) {
        window.socket.emit('pvp:getRanking');
    }
}

// ソケットイベントリスナーの設定
function setupPvPSocketListeners() {
    if (!window.socket) return;
    
    // ランキングデータ受信
    window.socket.on('pvp:ranking', (data) => {
        pvpRanking = data || [];
        // UIが開いている場合は更新
        const modal = document.getElementById('pvpRankingModal');
        if (modal) {
            modal.remove();
            showPvPRankingUI();
        }
    });
    
    // 戦闘結果受信
    window.socket.on('pvp:battleResult', (data) => {
        const { result, opponent } = data;
        
        if (result === 'win') {
            handlePvPWin();
            addChatMessage({
                type: 'system',
                playerName: 'PvP',
                playerLevel: 0,
                message: `${opponent} との対戦に勝利しました！+10pt`,
                timestamp: Date.now()
            });
        } else if (result === 'loss') {
            handlePvPLoss();
            addChatMessage({
                type: 'system',
                playerName: 'PvP',
                playerLevel: 0,
                message: `${opponent} との対戦に敗北しました。-5pt`,
                timestamp: Date.now()
            });
        } else if (result === 'draw') {
            handlePvPDraw();
            addChatMessage({
                type: 'system',
                playerName: 'PvP',
                playerLevel: 0,
                message: `${opponent} との対戦は引き分けでした。+3pt`,
                timestamp: Date.now()
            });
        }
    });
}

// グローバル関数として公開
window.showPvPRankingUI = showPvPRankingUI;
window.handlePvPWin = handlePvPWin;
window.handlePvPLoss = handlePvPLoss;
window.handlePvPDraw = handlePvPDraw;
window.calculatePvPRank = calculatePvPRank;

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initPvPSystem();
    }, 100);
});