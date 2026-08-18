// ============================================
// School Battle
// GuildManager.js
// ============================================

const fs = require('fs');
const path = require('path');

const GUILD_DATA_FILE = path.join(__dirname, '..', 'data', 'guilds.json');
const QUEST_DATA_FILE = path.join(__dirname, '..', 'data', 'quests.json');
const DATA_DIR = path.dirname(GUILD_DATA_FILE);

let guildData = {};
let questData = {};

// ギルドランク定義
const GUILD_RANKS = {
    F: { name: 'Fランク', minContribution: 0, minMembers: 1, minLevel: 1 },
    E: { name: 'Eランク', minContribution: 100, minMembers: 3, minLevel: 5 },
    D: { name: 'Dランク', minContribution: 500, minMembers: 5, minLevel: 10 },
    C: { name: 'Cランク', minContribution: 2000, minMembers: 10, minLevel: 20 },
    B: { name: 'Bランク', minContribution: 5000, minMembers: 15, minLevel: 30 },
    A: { name: 'Aランク', minContribution: 15000, minMembers: 20, minLevel: 40 },
    S: { name: 'Sランク', minContribution: 50000, minMembers: 30, minLevel: 50 }
};

// クエストカテゴリ定義
const QUEST_CATEGORIES = {
    BATTLE: { name: '討伐依頼', icon: '⚔️' },
    DELIVERY: { name: '素材納品', icon: '📦' },
    ESCORT: { name: '護衛協力', icon: '🛡️' },
    SPECIAL: { name: '調査特殊', icon: '🔍' }
};

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ギルドデータを読み込む
function loadGuildData() {
    try {
        if (fs.existsSync(GUILD_DATA_FILE)) {
            const fileContent = fs.readFileSync(GUILD_DATA_FILE, 'utf-8');
            guildData = JSON.parse(fileContent);
            console.log('[GuildManager] Guild data loaded from file.');
        } else {
            console.log('[GuildManager] No guild data file found, starting with empty data.');
        }
    } catch (error) {
        console.error('[GuildManager] Error loading guild data:', error);
        guildData = {};
    }
}

// クエストデータを読み込む
function loadQuestData() {
    try {
        if (fs.existsSync(QUEST_DATA_FILE)) {
            const fileContent = fs.readFileSync(QUEST_DATA_FILE, 'utf-8');
            questData = JSON.parse(fileContent);
            console.log('[GuildManager] Quest data loaded from file.');
        } else {
            console.log('[GuildManager] No quest data file found, starting with empty data.');
        }
    } catch (error) {
        console.error('[GuildManager] Error loading quest data:', error);
        questData = {};
    }
}

// ギルドデータを保存
function saveGuildData() {
    try {
        fs.writeFileSync(GUILD_DATA_FILE, JSON.stringify(guildData, null, 2), 'utf-8');
    } catch (error) {
        console.error('[GuildManager] Error saving guild data:', error);
    }
}

// クエストデータを保存
function saveQuestData() {
    try {
        fs.writeFileSync(QUEST_DATA_FILE, JSON.stringify(questData, null, 2), 'utf-8');
    } catch (error) {
        console.error('[GuildManager] Error saving quest data:', error);
    }
}

// ギルドを作成
function createGuild(guildData) {
    const { name, leaderId, leaderName } = guildData;
    
    if (!name || !leaderId || !leaderName) {
        return { success: false, message: '必須項目が不足しています' };
    }
    
    // ギルド名の重複チェック
    if (Object.values(guildData).some(g => g.name === name)) {
        return { success: false, message: 'このギルド名は既に使用されています' };
    }
    
    const guildId = 'GUILD_' + Date.now().toString(36).toUpperCase();
    
    const newGuild = {
        id: guildId,
        name: name,
        leaderId: leaderId,
        leaderName: leaderName,
        rank: 'F',
        contribution: 0,
        members: [{
            id: leaderId,
            name: leaderName,
            role: 'leader',
            joinedAt: Date.now(),
            contribution: 0
        }],
        createdAt: Date.now(),
        description: guildData.description || ''
    };
    
    guildData[guildId] = newGuild;
    saveGuildData();
    
    return { success: true, guild: newGuild };
}

// ギルドに参加
function joinGuild(guildId, playerId, playerName) {
    const guild = guildData[guildId];
    if (!guild) {
        return { success: false, message: 'ギルドが見つかりません' };
    }
    
    // 既にメンバーかチェック
    if (guild.members.some(m => m.id === playerId)) {
        return { success: false, message: '既にこのギルドのメンバーです' };
    }
    
    guild.members.push({
        id: playerId,
        name: playerName,
        role: 'member',
        joinedAt: Date.now(),
        contribution: 0
    });
    
    saveGuildData();
    return { success: true, guild: guild };
}

// ギルドを脱退
function leaveGuild(guildId, playerId) {
    const guild = guildData[guildId];
    if (!guild) {
        return { success: false, message: 'ギルドが見つかりません' };
    }
    
    // リーダーは脱退できない
    if (guild.leaderId === playerId) {
        return { success: false, message: 'リーダーはギルドを脱退できません' };
    }
    
    const memberIndex = guild.members.findIndex(m => m.id === playerId);
    if (memberIndex === -1) {
        return { success: false, message: 'メンバーが見つかりません' };
    }
    
    guild.members.splice(memberIndex, 1);
    saveGuildData();
    
    return { success: true, guild: guild };
}

// ギルド情報を取得
function getGuild(guildId) {
    return guildData[guildId] || null;
}

// プレイヤーのギルドを取得
function getPlayerGuild(playerId) {
    for (const guild of Object.values(guildData)) {
        if (guild.members.some(m => m.id === playerId)) {
            return guild;
        }
    }
    return null;
}

// 全ギルドを取得
function getAllGuilds() {
    return Object.values(guildData);
}

// ギルドランクを計算
function calculateGuildRank(guild) {
    const ranks = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
    
    for (let i = ranks.length - 1; i >= 0; i--) {
        const rank = ranks[i];
        const requirements = GUILD_RANKS[rank];
        
        if (guild.contribution >= requirements.minContribution &&
            guild.members.length >= requirements.minMembers) {
            return rank;
        }
    }
    
    return 'F';
}

// ギルド貢献度を追加
function addContribution(guildId, playerId, amount) {
    const guild = guildData[guildId];
    if (!guild) {
        return { success: false, message: 'ギルドが見つかりません' };
    }
    
    guild.contribution += amount;
    
    const member = guild.members.find(m => m.id === playerId);
    if (member) {
        member.contribution += amount;
    }
    
    // ランクアップチェック
    const newRank = calculateGuildRank(guild);
    const rankUp = newRank !== guild.rank;
    guild.rank = newRank;
    
    saveGuildData();
    
    return { 
        success: true, 
        guild: guild, 
        rankUp: rankUp,
        newRank: newRank 
    };
}

// クエストを作成
function createQuest(questData) {
    const { guildId, title, description, category, rank, reward, createdBy, creatorName, type } = questData;
    
    if (!title || !description || !category || !rank || !reward) {
        return { success: false, message: '必須項目が不足しています' };
    }
    
    // ランクのバリデーション
    if (!GUILD_RANKS[rank]) {
        return { success: false, message: '無効なランクです' };
    }
    
    // カテゴリのバリデーション
    if (!QUEST_CATEGORIES[category]) {
        return { success: false, message: '無効なカテゴリです' };
    }
    
    const questId = 'QUEST_' + Date.now().toString(36).toUpperCase();
    
    const newQuest = {
        id: questId,
        guildId: guildId || null,
        title: title,
        description: description,
        category: category,
        rank: rank,
        reward: reward,
        type: type || 'system', // 'system' or 'user'
        createdBy: createdBy,
        creatorName: creatorName,
        status: 'available', // 'available', 'accepted', 'completed', 'failed'
        acceptedBy: null,
        acceptedByName: null,
        acceptedAt: null,
        completedAt: null,
        createdAt: Date.now()
    };
    
    questData[questId] = newQuest;
    saveQuestData();
    
    return { success: true, quest: newQuest };
}

// クエストを受注
function acceptQuest(questId, playerId, playerName) {
    const quest = questData[questId];
    if (!quest) {
        return { success: false, message: 'クエストが見つかりません' };
    }
    
    if (quest.status !== 'available') {
        return { success: false, message: 'このクエストは受注できません' };
    }
    
    // ギルドクエストの場合、ギルドランクチェック
    if (quest.guildId) {
        const guild = getGuild(quest.guildId);
        if (!guild) {
            return { success: false, message: 'ギルドが見つかりません' };
        }
        
        const member = guild.members.find(m => m.id === playerId);
        if (!member) {
            return { success: false, message: 'このギルドのメンバーではありません' };
        }
        
        const rankRequirements = GUILD_RANKS[quest.rank];
        // ランクチェック（ここでは簡易的に実装）
    }
    
    quest.status = 'accepted';
    quest.acceptedBy = playerId;
    quest.acceptedByName = playerName;
    quest.acceptedAt = Date.now();
    
    saveQuestData();
    
    return { success: true, quest: quest };
}

// クエストを報告
function reportQuest(questId, playerId, evidence) {
    const quest = questData[questId];
    if (!quest) {
        return { success: false, message: 'クエストが見つかりません' };
    }
    
    if (quest.acceptedBy !== playerId) {
        return { success: false, message: 'このクエストを受注していません' };
    }
    
    if (quest.status !== 'accepted') {
        return { success: false, message: 'このクエストは報告できません' };
    }
    
    quest.status = 'completed';
    quest.completedAt = Date.now();
    quest.evidence = evidence;
    
    saveQuestData();
    
    return { success: true, quest: quest };
}

// クエスト報酬を支払う
function payQuestReward(questId) {
    const quest = questData[questId];
    if (!quest) {
        return { success: false, message: 'クエストが見つかりません' };
    }
    
    if (quest.status !== 'completed') {
        return { success: false, message: 'クエストが完了していません' };
    }
    
    // ギルドクエストの場合、ギルド貢献度を追加
    if (quest.guildId && quest.acceptedBy) {
        addContribution(quest.guildId, quest.acceptedBy, quest.reward);
    }
    
    quest.status = 'paid';
    saveQuestData();
    
    return { success: true, quest: quest };
}

// 利用可能なクエストを取得
function getAvailableQuests(guildId = null) {
    const quests = Object.values(questData).filter(q => q.status === 'available');
    
    if (guildId) {
        // ギルドメンバーの場合：そのギルドのクエスト + システムクエスト（guildIdがないもの）
        const guildQuests = quests.filter(q => q.guildId === guildId);
        const systemQuests = quests.filter(q => !q.guildId);
        console.log(`Available quests for guild ${guildId}:`, { guildQuests: guildQuests.length, systemQuests: systemQuests.length });
        return [...guildQuests, ...systemQuests];
    }
    
    // ギルド未参加の場合：システムクエストのみ
    const systemQuests = quests.filter(q => !q.guildId);
    console.log('Available quests for non-guild player:', systemQuests.length);
    return systemQuests;
}

// プレイヤーのアクティブクエストを取得
function getPlayerActiveQuests(playerId) {
    return Object.values(questData).filter(q => 
        q.acceptedBy === playerId && q.status === 'accepted'
    );
}

// システムクエストを生成
function generateSystemQuests() {
    const systemQuests = [
        {
            title: '初心者トレーニング',
            description: '対戦で3回勝利せよ',
            category: 'BATTLE',
            rank: 'F',
            reward: 50,
            type: 'system'
        },
        {
            title: '素材収集',
            description: 'ショップでアイテムを5個購入せよ',
            category: 'DELIVERY',
            rank: 'F',
            reward: 30,
            type: 'system'
        },
        {
            title: '新人護衛',
            description: 'レベル10以下のプレイヤーと対戦して勝利せよ',
            category: 'ESCORT',
            rank: 'E',
            reward: 100,
            type: 'system'
        },
        {
            title: '戦術研究',
            description: 'ギルド掲示板で新しい戦術アイデアを投稿せよ',
            category: 'SPECIAL',
            rank: 'D',
            reward: 150,
            type: 'system'
        },
        {
            title: '連勝記録',
            description: '対戦で5連勝せよ',
            category: 'BATTLE',
            rank: 'C',
            reward: 300,
            type: 'system'
        },
        {
            title: '伝説の戦士',
            description: 'Sランクプレイヤーに勝利せよ',
            category: 'BATTLE',
            rank: 'A',
            reward: 1000,
            type: 'system'
        },
        {
            title: 'ギルド貢献',
            description: 'ギルドクエストを10回完了せよ',
            category: 'SPECIAL',
            rank: 'B',
            reward: 500,
            type: 'system'
        }
    ];
    
    const createdQuests = [];
    for (const questTemplate of systemQuests) {
        const result = createQuest({
            ...questTemplate,
            createdBy: 'SYSTEM',
            creatorName: 'システム'
        });
        if (result.success) {
            createdQuests.push(result.quest);
        }
    }
    
    return createdQuests;
}

// 起動時ロード
loadGuildData();
loadQuestData();

// システムクエストがなければ生成
if (Object.keys(questData).length === 0) {
    console.log('[GuildManager] Generating system quests...');
    generateSystemQuests();
}

module.exports = {
    // ギルド管理
    createGuild,
    joinGuild,
    leaveGuild,
    getGuild,
    getPlayerGuild,
    getAllGuilds,
    addContribution,
    
    // クエスト管理
    createQuest,
    acceptQuest,
    reportQuest,
    payQuestReward,
    getAvailableQuests,
    getPlayerActiveQuests,
    generateSystemQuests,
    
    // 定数
    GUILD_RANKS,
    QUEST_CATEGORIES
};
