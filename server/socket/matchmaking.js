const MatchmakingManager = require("../managers/MatchmakingManager");
const RoomManager = require("../managers/RoomManager");
const BattleManager = require("../managers/BattleManager");

module.exports = function(io){

    io.on("connection",(socket)=>{

        // ランダムマッチリクエスト
        socket.on("requestRandomMatch", (player) => {
            console.log(`[Matchmaking Socket] Received requestRandomMatch from socket: ${socket.id}`);
            console.log(`[Matchmaking Socket] Player data:`, player);
            
            if(!player){
                console.log(`[Matchmaking Socket] No player data provided`);
                socket.emit("errorMessage", "プレイヤーデータが必要です");
                return;
            }

            // Add player to matchmaking queue
            const result = MatchmakingManager.addToQueue({
                id: player.id,
                socketId: socket.id,
                player: player
            });

            console.log(`[Matchmaking Socket] Matchmaking result:`, result);

            if(!result.success){
                socket.emit("errorMessage", result.message);
                return;
            }

            if(result.matched){
                console.log(`[Matchmaking Socket] Match found! Creating room...`);
                // Match found! Create room and start battle
                const opponent = result.opponent;
                
                // Create new room
                const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                console.log(`[Matchmaking Socket] Created room: ${roomId}`);
                
                // Add both players to room
                RoomManager.createRoom(roomId, socket.id, player);
                RoomManager.joinRoom(roomId, opponent.socketId, opponent.player);
                
                // Join socket rooms
                socket.join(roomId);
                io.to(opponent.socketId).sockets.get(opponent.socketId)?.join(roomId);
                
                // Initialize battle
                const battleData = BattleManager.createBattle(roomId, player, opponent.player);
                
                // Notify both players
                console.log(`[Matchmaking Socket] Sending matchFound to both players`);
                socket.emit("matchFound", {
                    roomId: roomId,
                    me: battleData.players[socket.id],
                    enemy: battleData.players[opponent.socketId]
                });
                
                io.to(opponent.socketId).emit("matchFound", {
                    roomId: roomId,
                    me: battleData.players[opponent.socketId],
                    enemy: battleData.players[socket.id]
                });
            } else {
                console.log(`[Matchmaking Socket] No match found yet, player waiting`);
            }
        });

        // Cancel matchmaking
        socket.on("cancelMatchmaking", (playerId) => {
            MatchmakingManager.removeFromQueue(playerId);
            socket.emit("matchCancelled");
        });

        // Handle disconnect - remove from queue
        socket.on("disconnect", () => {
            // Remove from matchmaking queue if present
            const queueSize = MatchmakingManager.getQueueSize();
            for(let i = 0; i < queueSize; i++){
                // The queue management handles removal by ID
            }
        });

    });

};
