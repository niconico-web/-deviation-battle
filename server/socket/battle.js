const BattleManager = require("../managers/BattleManager");
const BattleEngine = require("../managers/BattleEngine");

module.exports = function(io){

    io.on("connection",(socket)=>{

        // バトルルーム参加
        socket.on("joinBattleRoom", (data) => {
            const { roomId, playerId } = data;
            console.log(`[Battle] joinBattleRoom: roomId=${roomId}, playerId=${playerId}, socketId=${socket.id}`);
            
            const battle = BattleManager.getBattle(roomId);
            if (!battle) {
                console.error(`[Battle] Battle not found for room: ${roomId}`);
                socket.emit("battleError", { message: "Battle not found" });
                return;
            }
            
            // ルームに参加
            socket.join(roomId);
            console.log(`[Battle] Socket ${socket.id} joined room ${roomId}`);
            
            // プレイヤーのソケットIDを更新
            const player = battle.players[playerId];
            if (player) {
                BattleManager.remapPlayerSocket(roomId, playerId, socket.id);
                console.log(`[Battle] Remapped player ${playerId} to socket ${socket.id}`);
            } else {
                console.warn(`[Battle] Player ${playerId} not found in battle`);
                console.warn(`[Battle] Available players:`, Object.keys(battle.players));
            }
            
            // 参加成功を通知
            socket.emit("joinBattleRoomSuccess", { roomId, playerId });
        });

        socket.on("submitAnswer", (data) => {
            const { roomId, answer } = data;
            const battle = BattleManager.getBattle(roomId);
            
            console.log(`[Battle] submitAnswer: roomId=${roomId}, socketId=${socket.id}, answer=${answer}`);
            
            if (!battle) {
                console.error(`[Battle] Battle not found for room: ${roomId}`);
                socket.emit("answerError", { message: "Battle not found" });
                return;
            }

            const playerId = BattleManager.findPlayerIdBySocket(battle, socket.id);
            if (!playerId) {
                console.error(`[Battle] Player not found for socket: ${socket.id}`);
                socket.emit("answerError", { message: "Player not found in battle" });
                return;
            }
            
            console.log(`[Battle] Processing answer for player: ${playerId}`);
            
            const result = BattleEngine.processAnswer(battle, playerId, answer);
            
            console.log(`[Battle] Answer result:`, result);
            
            if (result.error) {
                socket.emit("answerError", { message: result.error });
                return;
            }
            
            // 結果を両方のプレイヤーに送信
            console.log(`[Battle] Emitting answerResult to room: ${roomId}`);
            io.to(roomId).emit("answerResult", result);
            
            // バトルが終了した場合
            if (result.winner) {
                console.log(`[Battle] Battle finished, winner: ${result.winner}`);
                const finalResult = BattleEngine.finalizeBattle(battle);
                io.to(roomId).emit("battleFinished", finalResult);
                BattleManager.deleteBattle(roomId);
            } else {
                // バトルが続いている場合、全プレイヤーの状態を同期
                console.log(`[Battle] Battle continuing, syncing state`);
                io.to(roomId).emit("battleStateUpdate", {
                    players: battle.players,
                    currentQuestion: battle.currentQuestion
                });
            }
        });

        // バトル開始（問題送信）
        socket.on("requestBattleStart", (data) => {
            const { roomId, playerId, playerName } = data;
            const battle = BattleManager.getBattle(roomId);
            
            console.log(`[Battle] requestBattleStart: roomId=${roomId}, socketId=${socket.id}, playerId=${playerId}, playerName=${playerName}, battle=${!!battle}`);
            
            if (!battle) {
                console.error(`[Battle] Battle not found for room: ${roomId}`);
                socket.emit("battleError", { message: "Battle not found" });
                return;
            }
            
            console.log(`[Battle] Battle found, players:`, Object.keys(battle.players));
            console.log(`[Battle] Battle players details:`, battle.players);
            
            // リクエストしたプレイヤーをルームに参加させる
            socket.join(roomId);
            console.log(`[Battle] Socket ${socket.id} joined room ${roomId}`);
            
            // プレイヤーのソケットIDを更新
            let foundPlayerId = BattleManager.findPlayerIdBySocket(battle, socket.id);
            
            // ソケットIDで見つからない場合、playerIdで検索
            if (!foundPlayerId && playerId) {
                if (battle.players[playerId]) {
                    foundPlayerId = playerId;
                    BattleManager.remapPlayerSocket(roomId, playerId, socket.id);
                    console.log(`[Battle] Remapped player ${playerId} to socket ${socket.id} by playerId`);
                }
            }
            
            if (foundPlayerId) {
                BattleManager.remapPlayerSocket(roomId, foundPlayerId, socket.id);
                console.log(`[Battle] Remapped player ${foundPlayerId} to socket ${socket.id}`);
            } else {
                console.warn(`[Battle] Could not find player for socket ${socket.id} or playerId ${playerId}`);
                console.warn(`[Battle] Available players:`, Object.keys(battle.players));
            }
            
            // もう一方のプレイヤーもルームに参加させる
            const playerIds = Object.keys(battle.players);
            const otherPlayerId = playerIds.find(id => id !== foundPlayerId);
            if (otherPlayerId) {
                const otherPlayer = battle.players[otherPlayerId];
                const otherSocket = io.sockets.sockets.get(otherPlayer.socketId);
                if (otherSocket) {
                    otherSocket.join(roomId);
                    console.log(`[Battle] Other player ${otherPlayerId} joined room ${roomId}`);
                } else {
                    console.warn(`[Battle] Other player socket ${otherPlayer.socketId} not found`);
                }
            }
            
            const initialization = BattleEngine.initializeBattle(battle);
            
            console.log(`[Battle] Sending battleStarted:`, {
                initialQuestion: initialization.initialQuestion,
                hasPlayers: !!battle.players,
                roomClients: io.sockets.adapter.rooms.get(roomId)?.size || 0,
                players: battle.players
            });
            
            // 両方のプレイヤーに最初の問題を送信
            io.to(roomId).emit("battleStarted", {
                initialQuestion: initialization.initialQuestion,
                players: battle.players
            });
            
            console.log(`[Battle] battleStarted emitted to room: ${roomId}`);
        });

        // バトル終了
        socket.on("battleFinished", (data) => {

            socket.to(data.roomId).emit("battleFinished", data);

        });

        // 再戦リクエスト
        socket.on("requestRematch", (data) => {

            const { roomId, playerId } = data;
            socket.to(roomId).emit("rematchRequested", { playerId });

        });

        // 再戦受諾
        socket.on("acceptRematch", (data) => {

            const { roomId } = data;
            // Create new room for rematch
            const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // Notify both players to join new room
            io.to(roomId).emit("rematchConfirmed", { newRoomId });

        });

    });

};