const MatchmakingManager = require("../managers/MatchmakingManager");
const RoomManager = require("../managers/RoomManager");
const BattleManager = require("../managers/BattleManager");

function toBattlePlayer(player, socketId) {
    const battleStats = player.battleStats || player;
    // 正規化してログ出力
    const grade = Number(player.grade ?? battleStats.grade ?? 1) || 1;
    console.log(`[Matchmaking] toBattlePlayer: normalized grade=${grade}`);

    // デバッグ用の詳細ログ（大きなオブジェクトは省略して出力）
    console.log(`[Matchmaking] Player id=${player.id}, name=${player.name}`);

    return {
        id: player.id,
        socketId,
        name: player.name || "Unknown",
        maxHp: battleStats.maxHp ?? player.maxHp ?? 50,
        atk: battleStats.atk ?? player.atk ?? 10,
        def: battleStats.def ?? player.def ?? 10,
        speed: battleStats.speed ?? player.speed ?? 10,
        grade,
        equippedWeapon: player.equippedWeapon || null,
        skillTrees: player.skillTrees || {}, // スキルツリー情報
        customSkills: player.customSkills || [], // カスタムスキル情報
        skillSlots: player.skillSlots || [null, null, null] // スキルスロット情報
    };
}

module.exports = function(io){

    io.on("connection",(socket)=>{

        socket.on("requestRandomMatch", (player) => {
            console.log(`[Matchmaking] requestRandomMatch received from socket: ${socket.id}`);
            console.log(`[Matchmaking] Player data:`, player);

            if(!player || typeof player !== "object" || !player.id){
                console.error("[Matchmaking] Invalid player data");
                socket.emit("errorMessage", "プレイヤーデータが必要です");
                return;
            }

            const result = MatchmakingManager.addToQueue({
                id: player.id,
                socketId: socket.id,
                player: player
            });

            console.log(`[Matchmaking] addToQueue result:`, result);

            if(!result.success){
                console.error("[Matchmaking] Failed to add to queue:", result.message);
                socket.emit("errorMessage", result.message);
                return;
            }

            if(result.matched){
                console.log("[Matchmaking] Match found! Processing...");
                const opponent = result.opponent;
                const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

                console.log(`[Matchmaking] Creating room ${roomId} for matched players`);
                RoomManager.createRoom(roomId, socket.id, player);
                RoomManager.joinRoom(roomId, opponent.socketId, opponent.player); // 修正: opponent.playerを渡す

                socket.join(roomId);
                const opponentSocket = io.sockets.sockets.get(opponent.socketId);
                if (opponentSocket) {
                    opponentSocket.join(roomId);
                    console.log(`[Matchmaking] Opponent socket joined room ${roomId}`);
                } else {
                    console.warn(`[Matchmaking] Opponent socket not found: ${opponent.socketId}`);
                }

                const hostData = toBattlePlayer(player, socket.id);
                const guestData = toBattlePlayer(opponent.player, opponent.socketId);
                const battleData = BattleManager.createBattle(roomId, hostData, guestData);

                if (!battleData) {
                    console.error("[Matchmaking] Failed to create battle");
                    socket.emit("errorMessage", "バトルの作成に失敗しました");
                    return;
                }

                console.log(`[Matchmaking] Sending matchFound to host: ${socket.id}`);
                console.log(`[Matchmaking] Host data:`, battleData.players[player.id]);
                console.log(`[Matchmaking] Enemy data:`, battleData.players[opponent.player.id]);
                
                socket.emit("matchFound", {
                    roomId,
                    me: battleData.players[player.id],
                    enemy: battleData.players[opponent.player.id]
                });
                console.log(`[Matchmaking] matchFound emitted to host`);

                console.log(`[Matchmaking] Sending matchFound to guest: ${opponent.socketId}`);
                io.to(opponent.socketId).emit("matchFound", {
                    roomId,
                    me: battleData.players[opponent.player.id],
                    enemy: battleData.players[player.id]
                });
                console.log(`[Matchmaking] matchFound emitted to guest`);
            } else {
                console.log("[Matchmaking] No match found, player waiting in queue");
            }
        });

        socket.on("cancelMatchmaking", (playerId) => {
            MatchmakingManager.removeFromQueue(playerId);
            socket.emit("matchCancelled");
        });

        socket.on("disconnect", () => {
            const queue = MatchmakingManager.getQueue();
            for (const entry of queue) {
                if (entry.socketId === socket.id) {
                    MatchmakingManager.removeFromQueue(entry.id);
                }
            }
        });

    });

};
