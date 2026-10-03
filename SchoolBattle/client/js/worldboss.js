// ============================================
// ワールドボスシステム
// ============================================

// ワールドボス定義
const WORLD_BOSSES = [
    {
        id: 'knowledge_eater',
        name: '知識喰らい',
        level: 50,
        hp: 10000,
        atk: 200,
        def: 150,
        speed: 80,
        special: 180,
        icon: '👹',
        color: '#8B0000',
        size: 60,
        spawnInterval: 2 * 60 * 60 * 1000, // 2時間
        duration: 30 * 60 * 1000, // 30分間出現
        rewards: {
            exp: 1000,
            coins: 500,
            items: [
                { type: 'orb', tier: 'tier4', amount: 1 },
                { type: 'material', materialId: 'dragon_scale', amount: 3 }
            ]
        }
    },
    {
        id: 'ancient_guardian',
        name: '古代の守護者',
        level: 40,
        hp: 8000,
        atk: 180,
        def: 200,
        speed: 60,
        special: 150,
        icon: '🗿',
        color: '#4A3728',
        size: 55,
        spawnInterval: 3 * 60 * 60 * 1000, // 3時間
        duration: 45 * 60 * 1000, // 45分間出現
        rewards: {
            exp: 800,
            coins: 400,
            items: [
                { type: 'orb', tier: 'tier3', amount: 2 },
                { type: 'material', materialId: 'ancient_shard', amount: 5 }
            ]
        }
    }
];

// 現在出現中のワールドボス
let currentWorldBoss = null;
let worldBossSpawnTime = null;
let worldBossEndTime = null;
let worldBossParticipants = [];

// ワールドボスシステムの初期化
function initWorldBossSystem() {
    setupWorldBossSocketListeners();
    startWorldBossTimer();
}

// ワールドボスタイマーを開始
function startWorldBossTimer() {
    // 1分ごとにボス出現チェック
    setInterval(() => {
        checkWorldBossSpawn();
    }, 60 * 1000);
}

// ワールドボス出現チェック
function checkWorldBossSpawn() {
    if (currentWorldBoss) {
        // ボスが出現中の場合、終了時間チェック
        if (Date.now() > worldBossEndTime) {
            endWorldBoss(false); // 時間切れで終了
        }
    } else {
        // ボスが出現していない場合、出現時間チェック
        if (!worldBossSpawnTime) {
            worldBossSpawnTime = Date.now();
        }
        
        const boss = WORLD_BOSSES[0]; // 簡易実装：最初のボスのみ
        const elapsed = Date.now() - worldBossSpawnTime;
        
        if (elapsed >= boss.spawnInterval) {
            spawnWorldBoss(boss);
        }
    }
}

// ワールドボスを出現
function spawnWorldBoss(boss) {
    currentWorldBoss = { ...boss };
    worldBossSpawnTime = Date.now();
    worldBossEndTime = Date.now() + boss.duration;
    worldBossParticipants = [];
    
    // 全プレイヤーに通知
    addChatMessage({
        type: 'system',
        playerName: 'ワールドボス',
        playerLevel: 0,
        message: `🚨 ${boss.name} (Lv.${boss.level}) が出現しました！${boss.duration / 60000}分間で討伐しましょう！`,
        timestamp: Date.now()
    });
    
    // サーバーに通知
    if (window.socket && window.socket.connected) {
        window.socket.emit('worldBoss:spawn', { bossId: boss.id });
    }
}

// ワールドボスを終了
function endWorldBoss(defeated) {
    if (!currentWorldBoss) return;
    
    if (defeated) {
        // 討伐成功
        addChatMessage({
            type: 'system',
            playerName: 'ワールドボス',
            playerLevel: 0,
            message: `🎉 ${currentWorldBoss.name} を討伐しました！参加者全員に報酬が配布されます。`,
            timestamp: Date.now()
        });
        
        // 参加者に報酬を配布
        distributeWorldBossRewards();
    } else {
        // 時間切れ
        addChatMessage({
            type: 'system',
            playerName: 'ワールドボス',
            playerLevel: 0,
            message: `⏰ ${currentWorldBoss.name} が逃げました...`,
            timestamp: Date.now()
        });
    }
    
    // サーバーに通知
    if (window.socket && window.socket.connected) {
        window.socket.emit('worldBoss:end', { 
            bossId: currentWorldBoss.id, 
            defeated 
        });
    }
    
    currentWorldBoss = null;
    worldBossSpawnTime = Date.now();
    worldBossEndTime = null;
    worldBossParticipants = [];
}

// ワールドボス報酬を配布
function distributeWorldBossRewards() {
    const player = getPlayerData();
    if (!player) return;
    
    // 参加している場合のみ報酬
    if (worldBossParticipants.includes(player.id)) {
        const rewards = currentWorldBoss.rewards;
        
        // EXP
        if (rewards.exp) {
            player.xp = (player.xp || 0) + rewards.exp;
        }
        
        // コイン
        if (rewards.coins) {
            player.coins = (player.coins || 0) + rewards.coins;
        }
        
        // アイテム
        if (rewards.items && rewards.items.length > 0) {
            rewards.items.forEach(item => {
                if (item.type === 'orb') {
                    if (!player.orbs) player.orbs = [];
                    if (typeof createOrb === 'function') {
                        const orb = createOrb(item.tier);
                        if (orb) player.orbs.push(orb);
                    }
                } else if (item.type === 'material') {
                    if (!player.materials) player.materials = {};
                    player.materials[item.materialId] = (player.materials[item.materialId] || 0) + item.amount;
                }
            });
        }
        
        localStorage.setItem('player', JSON.stringify(player));
        updateStatus(player);
        
        alert(`🎉 ワールドボス報酬を獲得しました！\nEXP+${rewards.exp} コイン+${rewards.coins}`);
    }
}

// ワールドボスに参加
function joinWorldBoss() {
    if (!currentWorldBoss) return;
    
    const player = getPlayerData();
    if (!player) return;
    
    if (!worldBossParticipants.includes(player.id)) {
        worldBossParticipants.push(player.id);
        
        addChatMessage({
            type: 'system',
            playerName: 'ワールドボス',
            playerLevel: 0,
            message: `${currentWorldBoss.name} との戦闘に参加しました`,
            timestamp: Date.now()
        });
        
        // サーバーに通知
        if (window.socket && window.socket.connected) {
            window.socket.emit('worldBoss:join', { 
                bossId: currentWorldBoss.id,
                playerId: player.id 
            });
        }
    }
}

// ワールドボス情報を取得
function getWorldBossInfo() {
    if (!currentWorldBoss) return null;
    
    const remainingTime = Math.max(0, worldBossEndTime - Date.now());
    const elapsed = Date.now() - worldBossSpawnTime;
    
    return {
        boss: currentWorldBoss,
        remainingTime,
        elapsed,
        participantCount: worldBossParticipants.length,
        isParticipating: worldBossParticipants.includes(getPlayerData()?.id)
    };
}

// ワールドボス情報UIを表示
function showWorldBossInfoUI() {
    const bossInfo = getWorldBossInfo();
    
    if (!bossInfo) {
        const nextSpawn = WORLD_BOSSES[0].spawnInterval - (Date.now() - (worldBossSpawnTime || Date.now()));
        const nextSpawnMinutes = Math.ceil(nextSpawn / 60000);
        
        alert(`現在ワールドボスは出現していません。\n次の出現まで約 ${nextSpawnMinutes} 分`);
        return;
    }
    
    const remainingMinutes = Math.ceil(bossInfo.remainingTime / 60000);
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'worldBossInfoModal';
    
    modal.innerHTML = `
        <div class="modal-content world-boss-modal">
            <button type="button" class="close btn btn-secondary">閉じる</button>
            <h2>👹 ワールドボス情報</h2>
            
            <div class="boss-info">
                <div class="boss-header">
                    <span class="boss-icon">${bossInfo.boss.icon}</span>
                    <span class="boss-name">${bossInfo.boss.name}</span>
                    <span class="boss-level">Lv.${bossInfo.boss.level}</span>
                </div>
                
                <div class="boss-stats">
                    <div class="boss-stat">
                        <span class="stat-label">HP</span>
                        <span class="stat-value">${bossInfo.boss.hp}</span>
                    </div>
                    <div class="boss-stat">
                        <span class="stat-label">攻撃</span>
                        <span class="stat-value">${bossInfo.boss.atk}</span>
                    </div>
                    <div class="boss-stat">
                        <span class="stat-label">防御</span>
                        <span class="stat-value">${bossInfo.boss.def}</span>
                    </div>
                    <div class="boss-stat">
                        <span class="stat-label">残り時間</span>
                        <span class="stat-value">${remainingMinutes}分</span>
                    </div>
                </div>
                
                <div class="boss-participants">
                    <span>参加者数: ${bossInfo.participantCount}人</span>
                </div>
                
                <div class="boss-rewards">
                    <h3>討伐報酬</h3>
                    <div class="reward-list">
                        <span>EXP+${bossInfo.boss.rewards.exp}</span>
                        <span>コイン+${bossInfo.boss.rewards.coins}</span>
                        ${bossInfo.boss.rewards.items.map(item => {
                            if (item.type === 'orb') return `<span>Tier${item.tier}オーブ x${item.amount}</span>`;
                            if (item.type === 'material') return `<span>${item.materialId} x${item.amount}</span>`;
                            return '';
                        }).join('')}
                    </div>
                </div>
                
                ${!bossInfo.isParticipating ? `
                    <button id="joinWorldBossBtn" class="btn btn-primary">参加する</button>
                ` : `
                    <button class="btn btn-secondary" disabled>参加中</button>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // イベントリスナー
    modal.querySelector('.close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    // 参加ボタン
    const joinBtn = document.getElementById('joinWorldBossBtn');
    if (joinBtn) {
        joinBtn.addEventListener('click', () => {
            joinWorldBoss();
            modal.remove();
        });
    }
}

// ソケットイベントリスナーの設定
function setupWorldBossSocketListeners() {
    if (!window.socket) return;
    
    // ワールドボス出現通知
    window.socket.on('worldBoss:spawn', (data) => {
        const { bossId } = data;
        const boss = WORLD_BOSSES.find(b => b.id === bossId);
        if (boss) {
            spawnWorldBoss(boss);
        }
    });
    
    // ワールドボス終了通知
    window.socket.on('worldBoss:end', (data) => {
        const { bossId, defeated } = data;
        if (currentWorldBoss && currentWorldBoss.id === bossId) {
            endWorldBoss(defeated);
        }
    });
    
    // ワールドボス参加者更新
    window.socket.on('worldBoss:participant', (data) => {
        const { playerId } = data;
        if (!worldBossParticipants.includes(playerId)) {
            worldBossParticipants.push(playerId);
        }
    });
}

// グローバル関数として公開
window.WORLD_BOSSES = WORLD_BOSSES;
window.getWorldBossInfo = getWorldBossInfo;
window.showWorldBossInfoUI = showWorldBossInfoUI;
window.joinWorldBoss = joinWorldBoss;

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initWorldBossSystem();
    }, 100);
});