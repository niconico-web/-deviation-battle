// ============================================
// School Battle
// SocialManager.js
// ============================================

const fs = require('fs');
const path = require('path');

const SOCIAL_DATA_FILE = path.join(__dirname, '..', 'data', 'social.json');
const DATA_DIR = path.dirname(SOCIAL_DATA_FILE);

let socialData = {};

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ソーシャルデータを読み込む
function loadSocialData() {
    try {
        if (fs.existsSync(SOCIAL_DATA_FILE)) {
            const fileContent = fs.readFileSync(SOCIAL_DATA_FILE, 'utf-8');
            socialData = JSON.parse(fileContent);
            console.log('[SocialManager] Social data loaded from file.');
        } else {
            console.log('[SocialManager] No social data file found, starting with empty data.');
            socialData = {
                friends: {},
                friendRequests: {},
                guildInvites: {}
            };
        }
    } catch (error) {
        console.error('[SocialManager] Error loading social data:', error);
        socialData = {
            friends: {},
            friendRequests: {},
            guildInvites: {}
        };
    }
}

// ソーシャルデータを保存
function saveSocialData() {
    try {
        fs.writeFileSync(SOCIAL_DATA_FILE, JSON.stringify(socialData, null, 2), 'utf-8');
    } catch (error) {
        console.error('[SocialManager] Error saving social data:', error);
    }
}

// プレイヤーを検索
function searchPlayer(targetId, requesterId) {
    const PlayerDataManager = require('./PlayerDataManager');
    const targetPlayer = PlayerDataManager.getPlayer(targetId);
    
    if (!targetPlayer) {
        return { success: false, message: 'プレイヤーが見つかりません' };
    }

    // 基本情報のみを返す（セキュリティのため）
    return {
        success: true,
        player: {
            id: targetPlayer.id,
            name: targetPlayer.name,
            level: targetPlayer.level || 1,
            grade: targetPlayer.grade || 1
        }
    };
}

// フレンド申請を送信
function sendFriendRequest(fromId, fromName, toId) {
    if (!socialData.friendRequests) {
        socialData.friendRequests = {};
    }
    
    if (!socialData.friendRequests[toId]) {
        socialData.friendRequests[toId] = [];
    }
    
    // 既に申請中かチェック
    const existingRequest = socialData.friendRequests[toId].find(
        req => req.fromId === fromId
    );
    
    if (existingRequest) {
        return { success: false, message: '既にフレンド申請を送信しています' };
    }
    
    // 既にフレンドかチェック
    if (socialData.friends[fromId] && socialData.friends[fromId].includes(toId)) {
        return { success: false, message: '既にフレンドです' };
    }
    
    const requestId = 'FR_' + Date.now().toString(36).toUpperCase();
    const request = {
        id: requestId,
        fromId,
        fromName,
        toId,
        createdAt: Date.now()
    };
    
    socialData.friendRequests[toId].push(request);
    saveSocialData();
    
    return { success: true, request };
}

// フレンド申請に応答
function respondFriendRequest(requestId, fromId, accept) {
    // 申請を探す
    let request = null;
    let targetId = null;
    
    for (const playerId in socialData.friendRequests) {
        const found = socialData.friendRequests[playerId].find(
            req => req.id === requestId
        );
        if (found) {
            request = found;
            targetId = playerId;
            break;
        }
    }
    
    if (!request) {
        return { success: false, message: '申請が見つかりません' };
    }
    
    if (request.fromId !== fromId) {
        return { success: false, message: 'この申請に応答する権限がありません' };
    }
    
    // 申請を削除
    socialData.friendRequests[targetId] = socialData.friendRequests[targetId].filter(
        req => req.id !== requestId
    );
    
    if (accept) {
        // フレンド関係を追加
        if (!socialData.friends) {
            socialData.friends = {};
        }
        
        if (!socialData.friends[request.fromId]) {
            socialData.friends[request.fromId] = [];
        }
        if (!socialData.friends[targetId]) {
            socialData.friends[targetId] = [];
        }
        
        socialData.friends[request.fromId].push(targetId);
        socialData.friends[targetId].push(request.fromId);
        
        saveSocialData();
        
        return {
            success: true,
            accepted: true,
            friend: {
                id: targetId,
                name: request.toName || 'Unknown'
            }
        };
    } else {
        saveSocialData();
        return { success: true, accepted: false };
    }
}

// フレンドを削除
function removeFriend(playerId, friendId) {
    if (!socialData.friends) {
        return { success: false, message: 'フレンドデータがありません' };
    }
    
    if (!socialData.friends[playerId]) {
        return { success: false, message: 'フレンドがいません' };
    }
    
    const index = socialData.friends[playerId].indexOf(friendId);
    if (index === -1) {
        return { success: false, message: 'そのプレイヤーはフレンドではありません' };
    }
    
    // 双方向のフレンド関係を削除
    socialData.friends[playerId] = socialData.friends[playerId].filter(id => id !== friendId);
    if (socialData.friends[friendId]) {
        socialData.friends[friendId] = socialData.friends[friendId].filter(id => id !== playerId);
    }
    
    saveSocialData();
    
    return { success: true };
}

// フレンドリストを取得
function getFriendList(playerId) {
    if (!socialData.friends || !socialData.friends[playerId]) {
        return [];
    }
    
    const friendIds = socialData.friends[playerId];
    const PlayerDataManager = require('./PlayerDataManager');
    
    return friendIds.map(friendId => {
        const friend = PlayerDataManager.getPlayer(friendId);
        if (friend) {
            return {
                id: friend.id,
                name: friend.name,
                level: friend.level || 1
            };
        }
        return null;
    }).filter(friend => friend !== null);
}

// フレンド申請リストを取得
function getFriendRequests(playerId) {
    if (!socialData.friendRequests || !socialData.friendRequests[playerId]) {
        return [];
    }
    
    return socialData.friendRequests[playerId];
}

// ギルド招待を送信
function sendGuildInvite(fromId, fromName, toId, guildId, guildName) {
    if (!socialData.guildInvites) {
        socialData.guildInvites = {};
    }
    
    if (!socialData.guildInvites[toId]) {
        socialData.guildInvites[toId] = [];
    }
    
    // 既に招待中かチェック
    const existingInvite = socialData.guildInvites[toId].find(
        invite => invite.guildId === guildId
    );
    
    if (existingInvite) {
        return { success: false, message: '既にこのギルドから招待されています' };
    }
    
    const inviteId = 'GI_' + Date.now().toString(36).toUpperCase();
    const invite = {
        id: inviteId,
        fromId,
        fromName,
        toId,
        guildId,
        guildName,
        createdAt: Date.now()
    };
    
    socialData.guildInvites[toId].push(invite);
    saveSocialData();
    
    return { success: true, invite };
}

// ギルド招待リストを取得
function getGuildInvites(playerId) {
    if (!socialData.guildInvites || !socialData.guildInvites[playerId]) {
        return [];
    }
    
    return socialData.guildInvites[playerId];
}

// 起動時ロード
loadSocialData();

module.exports = {
    searchPlayer,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    getFriendList,
    getFriendRequests,
    sendGuildInvite,
    getGuildInvites
};
