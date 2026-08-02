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
            }
        });

        socket.on("submitAnswer", (data) => {
            const { roomId, answer } = data;
            const battle = BattleManager.getBattle(roomId);
            
            if (!battle) {
                socket.emit("answerError", { message: "Battle not found" });
                return;
            }

            const playerId = BattleManager.findPlayerIdBySocket(battle, socket.id);
            if (!playerId) {
                socket.emit("answerError", { message: "Player not found in battle" });
                return;
            }
            
            const result = BattleEngine.processAnswer(battle, playerId, answer);
            
            if (result.error) {
                socket.emit("answerError", { message: result.error });
                return;
            }
            
            // 結果を両方のプレイヤーに送信
            io.to(roomId).emit("answerResult", result);
            
            // バトルが終了した場合
            if (result.winner) {
                const finalResult = BattleEngine.finalizeBattle(battle);
                io.to(roomId).emit("battleFinished", finalResult);
                BattleManager.deleteBattle(roomId);
            }
        });

        // バトル開始（問題送信）
        socket.on("requestBattleStart", (data) => {
            const { roomId } = data;
            const battle = BattleManager.getBattle(roomId);
            
            console.log(`[Battle] requestBattleStart: roomId=${roomId}, socketId=${socket.id}, battle=${!!battle}`);
            
            if (!battle) {
                console.error(`[Battle] Battle not found for room: ${roomId}`);
                socket.emit("battleError", { message: "Battle not found" });
                return;
            }
            
            console.log(`[Battle] Battle found, players:`, Object.keys(battle.players));
            
            // リクエストしたプレイヤーをルームに参加させる
            socket.join(roomId);
            console.log(`[Battle] Socket ${socket.id} joined room ${roomId}`);
            
            // プレイヤーのソケットIDを更新
            const playerId = BattleManager.findPlayerIdBySocket(battle, socket.id);
            if (playerId) {
                BattleManager.remapPlayerSocket(roomId, playerId, socket.id);
                console.log(`[Battle] Remapped player ${playerId} to socket ${socket.id}`);
            }
            
            const initialization = BattleEngine.initializeBattle(battle);
            
            console.log(`[Battle] Sending battleStarted:`, {
                initialQuestion: initialization.initialQuestion,
                hasPlayers: !!battle.players,
                roomClients: io.sockets.adapter.rooms.get(roomId)?.size || 0
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