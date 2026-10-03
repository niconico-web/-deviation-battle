// ============================================
// ダンジョンシステム
// ============================================

// ダンジョン定義
const DUNGEONS = [
    {
        id: 'ancient_ruins',
        name: '古代遺跡',
        description: '古い時代の遺跡。強力なモンスターが潜んでいる。',
        worldId: 'dungeon_ancient_ruins',
        requiredLevel: 5,
        recommendedPartySize: 2,
        width: 1200,
        height: 800,
        entrance: { x: 100, y: 400 },
        bossLocation: { x: 1000, y: 400 },
        bossId: 'forest_mage',
        monsters: ['goblin', 'wolf', 'forest_mage'],
        monsterCount: 12,
        rewards: {
            exp: 300,
            coins: 200,
            items: [{ type: 'orb', tier: 'tier3', amount: 1 }]
        }
    },
    {
        id: 'dark_cave',
        name: '暗黒の洞窟',
        description: '光の届かない洞窟。危険がいっぱい。',
        worldId: 'dungeon_dark_cave',
        requiredLevel: 10,
        recommendedPartySize: 3,
        width: 1500,
        height: 1000,
        entrance: { x: 100, y: 500 },
        bossLocation: { x: 1300, y: 500 },
        bossId: 'golem',
        monsters: ['wolf', 'golem'],
        monsterCount: 15,
        rewards: {
            exp: 500,
            coins: 350,
            items: [{ type: 'orb', tier: 'tier3', amount: 2 }]
        }
    }
];

// ダンジョンの進行状況
let dungeonProgress = {};

// 現在のダンジョン（クラシックダンジョンシステム用）
let currentClassicDungeon = null;

// ダンジョンに入る
function enterDungeon(dungeonId) {
    const dungeon = DUNGEONS.find(d => d.id === dungeonId);
    if (!dungeon) {
        alert('ダンジョンが見つかりません');
        return;
    }
    
    const player = getPlayerData();
    if (!player) {
        alert('キャラクターを作成してください');
        return;
    }
    
    // レベル要件チェック
    if (player.level < dungeon.requiredLevel) {
        alert(`このダンジョンにはLv.${dungeon.requiredLevel}以上が必要です`);
        return;
    }
    
    // パーティーチェック（推奨パーティサイズ以上の場合は警告）
    if (dungeon.recommendedPartySize > 1) {
        // パーティーにいるかチェック
        // 簡易実装：単独でも入れるが警告を表示
        const confirmed = confirm(
            `${dungeon.name}に入ります。\n` +
            `推奨パーティサイズ: ${dungeon.recommendedPartySize}人\n` +
            `単独で挑戦しますか？`
        );
        if (!confirmed) return;
    }
    
    currentClassicDungeon = dungeon;
    
    // ワールドシステムにダンジョン設定を通知
    if (typeof setDungeonWorld === 'function') {
        setDungeonWorld(dungeon);
    }
    
    // ダンジョン用ワールドに参加
    if (window.socket && window.socket.connected) {
        window.socket.emit('world:leave', { worldId: 'town_main', playerId: player.id });
        
        setTimeout(() => {
            window.socket.emit('world:join', {
                worldId: dungeon.worldId,
                player: { 
                    id: player.id, 
                    name: player.name, 
                    level: player.level,
                    avatar: player.avatar || null
                },
                spawn: dungeon.entrance
            });
        }, 100);
    }
    
    addChatMessage({
        type: 'system',
        playerName: 'ダンジョン',
        playerLevel: 0,
        message: `${dungeon.name}に入りました`,
        timestamp: Date.now()
    });
}

// ダンジョンから出る
function exitDungeon() {
    if (!currentClassicDungeon) return;
    
    const player = getPlayerData();
    if (!player) return;
    
    // ワールドシステムを町のデフォルトに戻す
    if (typeof resetToWorldDefaults === 'function') {
        resetToWorldDefaults();
    }
    
    // ダンジョン用ワールドから退出
    if (window.socket && window.socket.connected) {
        window.socket.emit('world:leave', {
            worldId: currentClassicDungeon.worldId,
            playerId: player.id
        });
        
        setTimeout(() => {
            window.socket.emit('world:join', {
                worldId: 'town_main',
                player: { 
                    id: player.id, 
                    name: player.name, 
                    level: player.level,
                    avatar: player.avatar || null
                },
                spawn: { x: 800, y: 600 } // 町の中央に戻る
            });
        }, 100);
    }
    
    currentClassicDungeon = null;
    
    addChatMessage({
        type: 'system',
        playerName: 'ダンジョン',
        playerLevel: 0,
        message: '町に戻りました',
        timestamp: Date.now()
    });
}

// ダンジョンクリア
function clearDungeon() {
    if (!currentClassicDungeon) return;
    
    const player = getPlayerData();
    if (!player) return;
    
    // 報酬を付与
    if (currentClassicDungeon.rewards) {
        // EXP
        if (currentClassicDungeon.rewards.exp) {
            player.xp = (player.xp || 0) + currentClassicDungeon.rewards.exp;
        }

        // コイン
        if (currentClassicDungeon.rewards.coins) {
            player.coins = (player.coins || 0) + currentClassicDungeon.rewards.coins;
        }

        // アイテム
        if (currentClassicDungeon.rewards.items && currentClassicDungeon.rewards.items.length > 0) {
            currentClassicDungeon.rewards.items.forEach(item => {
                if (item.type === 'orb') {
                    if (!player.orbs) player.orbs = [];
                    if (typeof createOrb === 'function') {
                        const orb = createOrb(item.tier);
                        if (orb) player.orbs.push(orb);
                    }
                }
            });
        }
        
        localStorage.setItem('player', JSON.stringify(player));
        updateStatus(player);
    }
    
    // クリア記録を保存
    if (!dungeonProgress[currentClassicDungeon.id]) {
        dungeonProgress[currentClassicDungeon.id] = {
            firstClearAt: Date.now(),
            clearCount: 0
        };
    }
    dungeonProgress[currentClassicDungeon.id].clearCount++;
    dungeonProgress[currentClassicDungeon.id].lastClearAt = Date.now();
    
    // プレイヤーデータに保存
    player.dungeonProgress = dungeonProgress;
    localStorage.setItem('player', JSON.stringify(player));
    
    addChatMessage({
        type: 'system',
        playerName: 'ダンジョン',
        playerLevel: 0,
        message: `${currentClassicDungeon.name}をクリアしました！EXP+${currentClassicDungeon.rewards.exp} コイン+${currentClassicDungeon.rewards.coins}`,
        timestamp: Date.now()
    });

    alert(`🎉 ${currentClassicDungeon.name}クリア！\nEXP+${currentClassicDungeon.rewards.exp} コイン+${currentClassicDungeon.rewards.coins}`);
    
    // 自動的に町に戻る
    exitDungeon();
}

// ダンジョン選択UIを表示
function showDungeonSelectionUI() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'dungeonSelectionModal';
    
    let dungeonList = '';
    DUNGEONS.forEach(dungeon => {
        const progress = dungeonProgress[dungeon.id];
        const clearCount = progress ? progress.clearCount : 0;
        
        dungeonList += `
            <div class="dungeon-item">
                <div class="dungeon-header">
                    <span class="dungeon-name">${dungeon.name}</span>
                    <span class="dungeon-clear-count">クリア: ${clearCount}回</span>
                </div>
                <p class="dungeon-description">${dungeon.description}</p>
                <div class="dungeon-info">
                    <span>必要Lv: ${dungeon.requiredLevel}</span>
                    <span>推奨パーティ: ${dungeon.recommendedPartySize}人</span>
                </div>
                <div class="dungeon-rewards">
                    <span>報酬: EXP+${dungeon.rewards.exp} コイン+${dungeon.rewards.coins}</span>
                </div>
                <button class="btn btn-primary dungeon-enter-btn" data-dungeon-id="${dungeon.id}">入る</button>
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div class="modal-content dungeon-selection-modal">
            <button type="button" class="close btn btn-secondary">閉じる</button>
            <h2>ダンジョン選択</h2>
            <div class="dungeon-list">
                ${dungeonList}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // イベントリスナー
    modal.querySelector('.close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    // ダンジョン入場ボタン
    modal.querySelectorAll('.dungeon-enter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dungeonId = btn.dataset.dungeonId;
            enterDungeon(dungeonId);
            modal.remove();
        });
    });
}

// 現在のダンジョンを取得
function getCurrentDungeon() {
    return currentClassicDungeon;
}

// グローバル関数として公開
window.DUNGEONS = DUNGEONS;
window.enterDungeon = enterDungeon;
window.exitDungeon = exitDungeon;
window.clearDungeon = clearDungeon;
window.showDungeonSelectionUI = showDungeonSelectionUI;
window.getCurrentDungeon = getCurrentDungeon;

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    // プレイヤーデータからダンジョン進行状況をロード
    const player = getPlayerData();
    if (player && player.dungeonProgress) {
        dungeonProgress = player.dungeonProgress;
    }
});