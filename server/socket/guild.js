// ============================================
// School Battle
// guild.js
// ============================================

const GuildManager = require("../managers/GuildManager");

module.exports = function(io){

    io.on("connection",(socket)=>{

        // -----------------------------
        // ギルドシステム
        // -----------------------------

        // ギルド作成
        socket.on("guild:create", (data) => {
            const { name, description, playerId, playerName } = data;
            console.log(`[Guild] Create guild request: ${name} by ${playerName}`);
            
            const result = GuildManager.createGuild({
                name,
                description,
                leaderId: playerId,
                leaderName: playerName
            });
            
            socket.emit("guild:createResponse", result);
        });

        // ギルド参加
        socket.on("guild:join", (data) => {
            const { guildId, playerId, playerName } = data;
            console.log(`[Guild] Join guild request: ${guildId} by ${playerName}`);
            
            const result = GuildManager.joinGuild(guildId, playerId, playerName);
            socket.emit("guild:joinResponse", result);
        });

        // ギルド脱退
        socket.on("guild:leave", (data) => {
            const { guildId, playerId } = data;
            console.log(`[Guild] Leave guild request: ${playerId} from ${guildId}`);
            
            const result = GuildManager.leaveGuild(guildId, playerId);
            socket.emit("guild:leaveResponse", result);
        });

        // ギルド情報取得
        socket.on("guild:getInfo", (guildId) => {
            const guild = GuildManager.getGuild(guildId);
            socket.emit("guild:info", guild);
        });

        // プレイヤーのギルド取得
        socket.on("guild:getPlayerGuild", (playerId) => {
            const guild = GuildManager.getPlayerGuild(playerId);
            socket.emit("guild:playerGuild", guild);
        });

        // 全ギルド取得
        socket.on("guild:getAll", () => {
            const guilds = GuildManager.getAllGuilds();
            socket.emit("guild:allGuilds", guilds);
        });

        // クエスト作成
        socket.on("quest:create", (data) => {
            const { guildId, title, description, category, rank, reward, playerId, playerName, type } = data;
            console.log(`[Guild] Create quest request: ${title} by ${playerName}`);
            
            const result = GuildManager.createQuest({
                guildId,
                title,
                description,
                category,
                rank,
                reward,
                createdBy: playerId,
                creatorName: playerName,
                type
            });
            
            socket.emit("quest:createResponse", result);
        });

        // クエスト受注
        socket.on("quest:accept", (data) => {
            const { questId, playerId, playerName } = data;
            console.log(`[Guild] Accept quest request: ${questId} by ${playerName}`);
            
            const result = GuildManager.acceptQuest(questId, playerId, playerName);
            socket.emit("quest:acceptResponse", result);
        });

        // クエスト報告
        socket.on("quest:report", (data) => {
            const { questId, playerId, evidence } = data;
            console.log(`[Guild] Report quest request: ${questId} by ${playerId}`);
            
            const result = GuildManager.reportQuest(questId, playerId, evidence);
            socket.emit("quest:reportResponse", result);
        });

        // クエスト報酬支払い
        socket.on("quest:payReward", (questId) => {
            console.log(`[Guild] Pay reward request: ${questId}`);
            
            const result = GuildManager.payQuestReward(questId);
            socket.emit("quest:payRewardResponse", result);
        });

        // 利用可能なクエスト取得
        socket.on("quest:getAvailable", (guildId) => {
            const quests = GuildManager.getAvailableQuests(guildId);
            socket.emit("quest:available", quests);
        });

        // プレイヤーのアクティブクエスト取得
        socket.on("quest:getPlayerActive", (playerId) => {
            const quests = GuildManager.getPlayerActiveQuests(playerId);
            socket.emit("quest:playerActive", quests);
        });

        // システムクエスト再生成
        socket.on("quest:regenerateSystem", () => {
            console.log(`[Guild] Regenerate system quests request`);
            
            const quests = GuildManager.generateSystemQuests();
            socket.emit("quest:systemRegenerated", quests);
        });
    });
};
