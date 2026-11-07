// ============================================
// School Battle
// guild.js
// ============================================

const GuildManager = require("../managers/GuildManager");
const PlayerDataManager = require("../managers/PlayerDataManager");

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

        // ギルド貢献度の追加（ギルドクエスト達成時など）
        // 以前はクライアント側でローカルのplayer.guild.contributionを
        // 書き換えるだけで、サーバーには一切反映していなかった。
        // そのため、サーバーからギルド情報を再取得した瞬間に古い値で
        // 上書きされ、「貢献度が獲得できない」ように見える不具合があった。
        socket.on("guild:addContribution", (data) => {
            const { guildId, playerId, amount } = data || {};
            if (!guildId || !playerId || !amount) {
                socket.emit("guild:addContributionResponse", { success: false, message: '不正なリクエストです' });
                return;
            }
            const result = GuildManager.addContribution(guildId, playerId, amount);
            socket.emit("guild:addContributionResponse", result);
        });

        // ギルド情報取得
        socket.on("guild:getInfo", (guildId) => {
            const guild = GuildManager.getGuild(guildId);
            if (guild) guild.power = GuildManager.guildPower(guild);
            socket.emit("guild:info", guild);
        });

        // プレイヤーのギルド取得
        socket.on("guild:getPlayerGuild", (playerId) => {
            const guild = GuildManager.getPlayerGuild(playerId);
            if (guild) guild.power = GuildManager.guildPower(guild);
            socket.emit("guild:playerGuild", guild);
        });

        // 全ギルド取得
        socket.on("guild:getAll", () => {
            const guilds = GuildManager.getAllGuilds();
            socket.emit("guild:allGuilds", guilds);
        });

        // ギルド一覧取得（ギルド一覧モーダル用）
        // クライアント側(client/js/guild.js)は "guild:getList" を送信し、
        // "guild:list" イベントで { id, name, description, memberCount } の配列を期待している。
        // このハンドラが存在しなかったため、ギルド一覧モーダルが常に空のまま
        // （検索欄などの静的な要素しか表示されない）不具合の原因になっていた。
        socket.on("guild:getList", () => {
            const guilds = GuildManager.getAllGuilds().map(g => ({
                id: g.id,
                name: g.name,
                description: g.description || '',
                memberCount: (g.members || []).length,
                power: GuildManager.guildPower(g),
                coins: g.coins || 0
            }));
            socket.emit("guild:list", guilds);
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

        // -----------------------------
        // ギルドコイン（金庫）と施設強化
        // -----------------------------

        // プレイヤーのコインをギルド金庫に納める
        // サーバー側のプレイヤーデータで所持コインを確認・減算してから、
        // ギルド金庫へ加算する（クライアント申告のコイン数は信用しない）
        socket.on("guild:deposit", (data, cb) => {
            const { guildId, playerId, amount } = data || {};
            const reply = typeof cb === "function" ? cb : (r) => socket.emit("guild:depositResponse", r);
            if (!guildId || !playerId || !amount) { reply({ success: false, message: "不正なリクエストです" }); return; }

            const guild = GuildManager.getGuild(guildId);
            if (!guild) { reply({ success: false, message: "ギルドが見つかりません" }); return; }
            if (!GuildManager.isGuildMember(guild, playerId)) { reply({ success: false, message: "ギルドメンバーではありません" }); return; }

            const amt = Math.floor(Number(amount));
            if (!isFinite(amt) || amt <= 0) { reply({ success: false, message: "コイン数が不正です" }); return; }

            const player = PlayerDataManager.getPlayer(playerId);
            const coins = player ? Math.floor(Number(player.coins) || 0) : 0;
            if (!player) { reply({ success: false, message: "プレイヤーデータが見つかりません" }); return; }
            if (coins < amt) { reply({ success: false, message: "コインが足りません", coins: coins }); return; }

            player.coins = coins - amt;
            PlayerDataManager.savePlayer(player);

            const result = GuildManager.depositCoins(guildId, playerId, amt);
            if (result.success) {
                result.coins = player.coins;   // クライアント側の所持コイン更新用
            }
            reply(result);
        });

        // 施設の強化（リーダーのみ。ギルドコインを消費）
        socket.on("guild:upgradeBuilding", (data, cb) => {
            const { guildId, playerId, buildingId } = data || {};
            const reply = typeof cb === "function" ? cb : (r) => socket.emit("guild:upgradeBuildingResponse", r);
            if (!guildId || !playerId || !buildingId) { reply({ success: false, message: "不正なリクエストです" }); return; }
            const result = GuildManager.upgradeBuilding(guildId, playerId, buildingId);
            if (result.success) result.power = GuildManager.guildPower(result.guild);
            reply(result);
        });

        // ギルド総合力の取得（一覧・詳細で使う）
        socket.on("guild:power", (guildId, cb) => {
            const reply = typeof cb === "function" ? cb : () => {};
            const g = guildId ? GuildManager.getGuild(guildId) : null;
            reply({ success: !!g, power: g ? GuildManager.guildPower(g) : 0 });
        });
    });
};
