const MatchmakingManager = require("../managers/MatchmakingManager");
const RoomManager = require("../managers/RoomManager");
const BattleManager = require("../managers/BattleManager");

module.exports = function(io){

    io.on("connection",(socket)=>{

        // ランダムマッチリクエスト
        socket.on("requestRandomMatch", (player) => {
            
            if(!player){
                socket.emit("errorMessage", "プレイヤーデータが必要です");
                return;
            }

            // Add player to matchmaking queue
            const result = MatchmakingManager.addToQueue({
                id: player.id,
                socketId: socket.id,
                player: player
            });

            if(!result.success){
                socket.emit("errorMessage", result.message);
                return;
            }

            if(result.matched){
                // Match found! Create room and start battle
                const opponent = result.opponent;
                
                // Create new room
                const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                
                // Add both players to room
                RoomManager.createRoom(roomId, socket.id, player);
                RoomManager.joinRoom(roomId, opponent.socketId, opponent.player);
                
                // Join socket rooms
                socket.join(roomId);
                io.to(opponent.socketId).sockets.get(opponent.socketId)?.join(roomId);
                
                // Initialize battle
                const battleData = BattleManager.createBattle(roomId, socket.id, opponent.socketId);
                
                // Notify both players
                const myTurn = battleData.turn === socket.id;
                
                socket.emit("matchFound", {
                    roomId: roomId,
                    me: player,
                    enemy: opponent.player,
                    myTurn: myTurn
                });
                
                io.to(opponent.socketId).emit("matchFound", {
                    roomId: roomId,
                    me: opponent.player,
                    enemy: player,
                    myTurn: !myTurn
                });
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
