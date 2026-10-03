// ============================================
// クエストシステム
// ============================================

// クエスト定義
const QUESTS = [
    {
        id: 'forest_monsters',
        name: '森のモンスター討伐',
        description: '知識の森にいるモンスターを3体倒す',
        type: 'monster_hunt',
        target: { type: 'monster', monsterId: 'wolf', count: 3 },
        rewards: {
            exp: 50,
            coins: 30,
            items: []
        },
        region: 'forest',
        requiredLevel: 3,
        npc: 'village_head'
    },
    {
        id: 'goblin_threat',
        name: 'ゴブリンの脅威',
        description: '草原にいるゴブリンを5体倒す',
        type: 'monster_hunt',
        target: { type: 'monster', monsterId: 'goblin', count: 5 },
        rewards: {
            exp: 80,
            coins: 50,
            items: [{ type: 'material', materialId: 'goblin_ear', amount: 2 }]
        },
        region: 'grassland',
        requiredLevel: 1,
        npc: 'village_head'
    },
    {
        id: 'gather_herbs',
        name: '薬草採取',
        description: '森で薬草を3つ集める',
        type: 'collection',
        target: { type: 'item', itemId: 'herb', count: 3 },
        rewards: {
            exp: 30,
            coins: 20,
            items: [{ type: 'consumable', itemId: 'potion', amount: 2 }]
        },
        region: 'forest',
        requiredLevel: 2,
        npc: 'healer'
    },
    {
        id: 'first_boss',
        name: '最初のボス討伐',
        description: '森の魔術師を倒す',
        type: 'boss_battle',
        target: { type: 'boss', bossId: 'forest_mage', count: 1 },
        rewards: {
            exp: 200,
            coins: 100,
            items: [{ type: 'orb', tier: 'tier2', amount: 1 }]
        },
        region: 'forest',
        requiredLevel: 8,
        npc: 'village_head'
    }
];

// NPC定義
const NPCS = [
    {
        id: 'village_head',
        name: '村長',
        icon: '👴',
        location: { worldId: 'town_main', x: 300, y: 300 },
        dialogue: {
            default: 'ようこそ、若者よ。この世界はまだ多くの謎に満ちている。',
            quest_available: '新しい仕事があるかもしれないぞ。',
            quest_in_progress: '頼んだ仕事は進んでいるか？',
            quest_complete: 'よくやった！これでお礼だ。'
        },
        availableQuests: ['forest_monsters', 'goblin_threat', 'first_boss']
    },
    {
        id: 'healer',
        name: '治療師',
        icon: '👩‍⚕️',
        location: { worldId: 'town_main', x: 500, y: 400 },
        dialogue: {
            default: '怪我をしたらすぐに来るといい。',
            quest_available: '薬草が必要なんだ。',
            quest_in_progress: '薬草は集まったか？',
            quest_complete: 'ありがとう、これを使ってくれ。'
        },
        availableQuests: ['gather_herbs']
    }
];

// プレイヤーのクエスト進行状況
let playerQuests = {};

// クエストシステムの初期化
function initQuestSystem() {
    loadPlayerQuests();
    setupQuestSocketListeners();
}

// プレイヤーのクエストデータをロード
function loadPlayerQuests() {
    const player = getPlayerData();
    if (player && player.quests) {
        playerQuests = player.quests;
    }
}

// プレイヤーのクエストデータを保存
function savePlayerQuests() {
    const player = getPlayerData();
    if (player) {
        player.quests = playerQuests;
        localStorage.setItem('player', JSON.stringify(player));
        if (typeof syncPlayerToServer === 'function') syncPlayerToServer(true);
    }
}

// 利用可能なクエストを取得
function getAvailableQuests(npcId) {
    const npc = NPCS.find(n => n.id === npcId);
    if (!npc) return [];
    
    const player = getPlayerData();
    const playerLevel = player ? player.level : 1;
    
    return npc.availableQuests
        .map(questId => QUESTS.find(q => q.id === questId))
        .filter(quest => {
            if (!quest) return false;
            // レベル要件チェック
            if (quest.requiredLevel > playerLevel) return false;
            // 既に受注済みの場合は除外
            if (playerQuests[quest.id]) return false;
            return true;
        });
}

// 進行中のクエストを取得
function getInProgressQuests() {
    return Object.entries(playerQuests)
        .filter(([id, progress]) => !progress.completed)
        .map(([id, progress]) => ({
            quest: QUESTS.find(q => q.id === id),
            progress
        }))
        .filter(item => item.quest);
}

// 完了したクエストを取得
function getCompletedQuests() {
    return Object.entries(playerQuests)
        .filter(([id, progress]) => progress.completed)
        .map(([id, progress]) => ({
            quest: QUESTS.find(q => q.id === id),
            progress
        }))
        .filter(item => item.quest);
}

// クエストを受注
function acceptQuest(questId) {
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest) return { success: false, message: 'クエストが見つかりません' };
    
    if (playerQuests[questId]) {
        return { success: false, message: '既に受注済みです' };
    }
    
    playerQuests[questId] = {
        startedAt: Date.now(),
        progress: 0,
        completed: false
    };
    
    savePlayerQuests();

    if (typeof addChatMessage === 'function') {
        addChatMessage({
            type: 'system',
            playerName: 'クエスト',
            playerLevel: 0,
            message: `クエスト「${quest.name}」を受注しました`,
            timestamp: Date.now()
        });
    }

    return { success: true };
}

// クエスト進行を更新
function updateQuestProgress(questId, amount = 1) {
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest || !playerQuests[questId] || playerQuests[questId].completed) {
        return;
    }
    
    playerQuests[questId].progress += amount;
    
    // クエスト完了チェック
    if (playerQuests[questId].progress >= quest.target.count) {
        completeQuest(questId);
    } else {
        savePlayerQuests();
    }
}

// クエストを完了
function completeQuest(questId) {
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest || !playerQuests[questId]) return;
    
    playerQuests[questId].completed = true;
    playerQuests[questId].completedAt = Date.now();
    
    // 報酬を付与
    const player = getPlayerData();
    if (player) {
        // EXP
        if (quest.rewards.exp) {
            player.xp = (player.xp || 0) + quest.rewards.exp;
        }
        
        // コイン
        if (quest.rewards.coins) {
            player.coins = (player.coins || 0) + quest.rewards.coins;
        }
        
        // アイテム
        if (quest.rewards.items && quest.rewards.items.length > 0) {
            quest.rewards.items.forEach(item => {
                if (item.type === 'material') {
                    if (!player.materials) player.materials = {};
                    player.materials[item.materialId] = (player.materials[item.materialId] || 0) + item.amount;
                } else if (item.type === 'orb') {
                    if (!player.orbs) player.orbs = [];
                    // オーブを生成して追加
                    if (typeof createOrb === 'function') {
                        const orb = createOrb(item.tier);
                        if (orb) player.orbs.push(orb);
                    }
                }
            });
        }
        
        localStorage.setItem('player', JSON.stringify(player));
        if (typeof updateStatus === 'function') updateStatus(player);
    }
    
    savePlayerQuests();

    if (typeof addChatMessage === 'function') {
        addChatMessage({
            type: 'system',
            playerName: 'クエスト',
            playerLevel: 0,
            message: `クエスト「${quest.name}」を完了しました！EXP+${quest.rewards.exp} コイン+${quest.rewards.coins}`,
            timestamp: Date.now()
        });
    }
}

// NPCとの会話UIを表示
function showNPCDialogue(npcId) {
    const npc = NPCS.find(n => n.id === npcId);
    if (!npc) return;
    
    const availableQuests = getAvailableQuests(npcId);
    const inProgressQuests = getInProgressQuests().filter(item => 
        item.quest && item.quest.npc === npcId
    );
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'npcDialogueModal';
    
    let questButtons = '';
    
    // 利用可能なクエストボタン
    if (availableQuests.length > 0) {
        questButtons += '<h3>利用可能なクエスト</h3>';
        availableQuests.forEach(quest => {
            questButtons += `
                <div class="quest-item">
                    <strong>${quest.name}</strong>
                    <p>${quest.description}</p>
                    <p class="quest-rewards">報酬: EXP+${quest.rewards.exp} コイン+${quest.rewards.coins}</p>
                    <button class="btn btn-primary quest-accept-btn" data-quest-id="${quest.id}">受注する</button>
                </div>
            `;
        });
    }
    
    // 進行中のクエストボタン
    if (inProgressQuests.length > 0) {
        questButtons += '<h3>進行中のクエスト</h3>';
        inProgressQuests.forEach(item => {
            const progress = Math.min(item.progress.progress, item.quest.target.count);
            questButtons += `
                <div class="quest-item in-progress">
                    <strong>${item.quest.name}</strong>
                    <p>進行: ${progress}/${item.quest.target.count}</p>
                    <div class="quest-progress-bar">
                        <div class="quest-progress-fill" style="width: ${(progress/item.quest.target.count)*100}%"></div>
                    </div>
                </div>
            `;
        });
    }
    
    modal.innerHTML = `
        <div class="modal-content npc-dialogue-modal">
            <button type="button" class="close btn btn-secondary">閉じる</button>
            <div class="npc-header">
                <span class="npc-icon">${npc.icon}</span>
                <span class="npc-name">${npc.name}</span>
            </div>
            <div class="npc-dialogue">
                <p>${npc.dialogue.default}</p>
            </div>
            <div class="npc-quests">
                ${questButtons}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // イベントリスナー
    modal.querySelector('.close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    // クエスト受注ボタン
    modal.querySelectorAll('.quest-accept-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const questId = btn.dataset.questId;
            const result = acceptQuest(questId);
            if (result.success) {
                btn.textContent = '受注済み';
                btn.disabled = true;
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            } else {
                alert(result.message);
            }
        });
    });
}

// フィールドで遭遇したモンスターを倒した後にクエスト進行を更新する。
// 以前はworld:join等と同様にサーバーへ'quest:monsterDefeated'を送って
// 折り返しの通知を待つ実装だったが、サーバー側に対応するハンドラが無く
// 一度も発火していなかった。クエスト進行はこのプレイヤー自身の
// localStorageで完結する情報なので、戦闘勝利後にresult.js側から
// 直接この関数を呼ぶだけで十分。
function resolveFieldMonsterQuestProgress(won) {
    const raw = localStorage.getItem('pendingQuestMonster');
    localStorage.removeItem('pendingQuestMonster');
    if (!won || !raw) return;

    let info;
    try {
        info = JSON.parse(raw);
    } catch (e) {
        return;
    }
    if (!info || !info.monsterId) return;

    loadPlayerQuests();

    Object.entries(playerQuests).forEach(([questId, progress]) => {
        if (progress.completed) return;

        const quest = QUESTS.find(q => q.id === questId);
        if (quest && quest.type === 'monster_hunt' && quest.target.monsterId === info.monsterId) {
            updateQuestProgress(questId, 1);
        }
    });
}

function setupQuestSocketListeners() {
    // 現時点ではクエスト進行にサーバーからの通知を必要とするものは無い
}

// グローバル関数として公開
window.NPCS = NPCS;
window.QUESTS = QUESTS;
window.showNPCDialogue = showNPCDialogue;
window.acceptQuest = acceptQuest;
window.updateQuestProgress = updateQuestProgress;
window.getAvailableQuests = getAvailableQuests;
window.getInProgressQuests = getInProgressQuests;
window.getCompletedQuests = getCompletedQuests;
window.resolveFieldMonsterQuestProgress = resolveFieldMonsterQuestProgress;

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initQuestSystem();
    }, 100);
});