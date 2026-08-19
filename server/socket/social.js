// ============================================
// School Battle
// social.js
// ============================================

const SocialManager = require("../managers/SocialManager");

module.exports = function(io){

    io.on("connection",(socket)=>{

        // -----------------------------
        // ソーシャルシステム
        // -----------------------------

        // プレイヤー検索
        socket.on("social:searchPlayer", (data) => {
            const { targetId, requesterId } = data;
            console.log(`[Social] Search player: ${targetId} by ${requesterId}`);
            
            const result = SocialManager.searchPlayer(targetId, requesterId);
            socket.emit("social:playerFound", result.success ? result.player : null);
        });

        // フレンド申請送信
        socket.on("social:sendFriendRequest", (data) => {
            const { fromId, fromName, toId } = data;
            console.log(`[Social] Friend request: ${fromId} -> ${toId}`);
            
            const result = SocialManager.sendFriendRequest(fromId, fromName, toId);
            socket.emit("social:friendRequestSent", result);
            
            if (result.success) {
                // 相手に通知
                io.to(toId).emit("social:friendRequestReceived", result.request);
            }
        });

        // フレンド申請応答
        socket.on("social:respondFriendRequest", (data) => {
            const { requestId, fromId, accept } = data;
            console.log(`[Social] Respond to friend request: ${requestId}, accept: ${accept}`);
            
            const result = SocialManager.respondFriendRequest(requestId, fromId, accept);
            
            if (result.success) {
                // 申請者に結果を通知
                const targetId = accept ? result.friend.id : fromId;
                io.to(targetId).emit("social:friendRequestResult", result);
            }
        });

        // フレンド削除
        socket.on("social:removeFriend", (data) => {
            const { playerId, friendId } = data;
            console.log(`[Social] Remove friend: ${playerId} -> ${friendId}`);
            
            const result = SocialManager.removeFriend(playerId, friendId);
            socket.emit("social:removeFriendResult", result);
        });

        // フレンドリスト取得
        socket.on("social:getFriendList", (playerId) => {
            const friends = SocialManager.getFriendList(playerId);
            socket.emit("social:friendList", friends);
        });

        // フレンド申請リスト取得
        socket.on("social:getFriendRequests", (playerId) => {
            const requests = SocialManager.getFriendRequests(playerId);
            socket.emit("social:friendRequests", requests);
        });

        // ギルド招待送信
        socket.on("social:sendGuildInvite", (data) => {
            const { fromId, fromName, toId, guildId, guildName } = data;
            console.log(`[Social] Guild invite: ${fromId} -> ${toId} for guild ${guildId}`);
            
            const result = SocialManager.sendGuildInvite(fromId, fromName, toId, guildId, guildName);
            socket.emit("social:guildInviteResult", result);
            
            if (result.success) {
                // 相手に通知
                io.to(toId).emit("social:guildInviteReceived", result.invite);
            }
        });

        // ギルド招待リスト取得
        socket.on("social:getGuildInvites", (playerId) => {
            const invites = SocialManager.getGuildInvites(playerId);
            socket.emit("social:guildInvites", invites);
        });
    });
};
