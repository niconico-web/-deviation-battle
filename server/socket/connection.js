// ============================================
// School Battle
// connection.js
// ============================================

const PlayerManager = require("../managers/PlayerManager");
const RoomManager = require("../managers/RoomManager");
const BattleManager = require("../managers/BattleManager");
const BattleEngine = require("../managers/BattleEngine");

// BattleManagerのタイマー管理を使用
const disconnectTimers = BattleManager.disconnectTimers;

function resolveBattlePlayer(socketId, storedData){

    const live = PlayerManager.getPlayer(socketId);

    if(live){
        const stats = live.battleStats || live;
        return {
            ...live,
            id: live.id || storedData?.id || socketId,
            socketId,
            maxHp: stats.maxHp ?? live.maxHp,
            atk: stats.atk ?? live.atk,
            def: stats.def ?? live.def,
            speed: stats.speed ?? live.speed,
            equippedWeapon: live.equippedWeapon || null,
            battleStats: stats // battleStatsを明示的に保持
        };
    }

    if(storedData){
        const stats = storedData.battleStats || storedData;
        return {
            ...storedData,
            id: storedData.id || socketId,
            socketId,
            maxHp: stats.maxHp ?? storedData.maxHp,
            atk: stats.atk ?? storedData.atk,
            def: stats.def ?? storedData.def,
            speed: stats.speed ?? storedData.speed,
            equippedWeapon: storedData.equippedWeapon || null,
            battleStats: stats // battleStatsを明示的に保持
        };
    }

    return null;

}

module.exports = function(io){

    io.on("connection",(socket)=>{

        console.log("Connected:", socket.id);

        socket.emit("connected");

        // Error handler
        socket.on("error", (err) => {
            console.error(`Socket error for ${socket.id}:`, err);
        });

        // -----------------------------
        // プレイヤー登録
        // -----------------------------

        socket.on("playerJoin",(player)=>{

            PlayerManager.addPlayer(socket.id, player);

            console.log("Player Join:", player.name);

        });

        // -----------------------------
        // ルーム作成
        // -----------------------------

        socket.on("createRoom",(player)=>{

            console.log("createRoom received from socket:", socket.id);
            console.log("Player data:", player);

            if(player){

                PlayerManager.addPlayer(socket.id, player);
                console.log("Player added to PlayerManager");

            }

            const roomId = Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();

            // Socket.IO roomに参加
            socket.join(roomId);
            console.log("Socket joined room:", roomId);

            // ルームマネージャーに登録
            RoomManager.createRoom(roomId, socket.id, player || null);
            console.log("Room created in RoomManager");

            console.log("Room Create:", roomId, "by socket:", socket.id);
            console.log("Socket rooms:", Array.from(socket.rooms));
            console.log("Socket connected:", socket.connected);
            console.log("Emitting roomCreated to socket:", socket.id);

            socket.emit("roomCreated", roomId);
            console.log("roomCreated emitted successfully");
            
            // 送信確認のために遅延してログ
            setTimeout(() => {
                console.log("roomCreated emission check completed");
            }, 100);

        });

        // -----------------------------
        // ルーム参加
        // -----------------------------

        socket.on("joinRoom",(data)=>{

            const roomId = typeof data === "string"
                ? data
                : data?.roomId;

            const guestPlayer = typeof data === "object"
                ? data.player
                : null;

            console.log("Join Request:", roomId, "from socket:", socket.id);
            console.log("Guest player data:", guestPlayer);
            console.log("Available rooms:", Object.keys(RoomManager.getRooms ? RoomManager.getRooms() : {}));

            if(!roomId){

                socket.emit("joinFailed");

                return;

            }

            if(guestPlayer){

                PlayerManager.addPlayer(socket.id, guestPlayer);
                console.log("Guest player added to PlayerManager");

            }

            // Socket.IO roomに参加
            socket.join(roomId);
            console.log("Socket joined room:", roomId);

            const success = RoomManager.joinRoom(
                roomId,
                socket.id,
                guestPlayer || PlayerManager.getPlayer(socket.id)
            );

            if(!success){

                console.log("Join Failed: Room not found or full:", roomId);
                socket.leave(roomId);
                socket.emit("joinFailed");

                return;

            }

            console.log("Socket rooms after join:", Array.from(socket.rooms));

            const room = RoomManager.getRoom(roomId);
            console.log("Room data:", room);

            const host = resolveBattlePlayer(room.host, room.hostData);
            const guest = resolveBattlePlayer(room.guest, room.guestData);

            console.log("Resolved host:", host);
            console.log("Resolved guest:", guest);

            if(!host || !guest){

                console.log("Join Failed: player data missing", roomId);
                console.log("Host:", host, "Guest:", guest);

                socket.emit("joinFailed");

                return;

            }

            const battle = BattleManager.createBattle(
                roomId,
                host,
                guest
            );

            if(!battle){

                console.log("Battle creation failed");
                socket.emit("joinFailed");

                return;

            }

            console.log("Room Ready:", roomId);
            console.log("Host socket:", room.host, "Guest socket:", room.guest);
            console.log("Battle players:", battle.players);
            console.log("Host data being sent:", battle.players[host.id]);
            console.log("Guest data being sent:", battle.players[guest.id]);

            // 自動参加成功の通知
            socket.emit("autoJoinSuccess", roomId);
            console.log("autoJoinSuccess emitted to guest socket:", socket.id);

            // 両方のプレイヤーに通知
            const hostData = battle.players[host.id];
            const guestData = battle.players[guest.id];
            
            console.log("Sending roomReady to host:", room.host);
            console.log("Host data:", hostData);
            io.to(room.host).emit("roomReady", {
                roomId,
                me: hostData,
                enemy: guestData
            });
            console.log("roomReady emitted to host");

            console.log("Sending roomReady to guest:", room.guest);
            console.log("Guest data:", guestData);
            io.to(room.guest).emit("roomReady", {
                roomId,
                me: guestData,
                enemy: hostData
            });
            console.log("roomReady emitted to guest");
            
            // 両方のプレイヤーをルームに参加させる
            const hostSocket = io.sockets.sockets.get(room.host);
            const guestSocket = io.sockets.sockets.get(room.guest);
            
            if (hostSocket) {
                hostSocket.join(roomId);
                console.log("Host socket joined room:", roomId);
            } else {
                console.warn("Host socket not found:", room.host);
            }
            
            if (guestSocket) {
                guestSocket.join(roomId);
                console.log("Guest socket joined room:", roomId);
            } else {
                console.warn("Guest socket not found:", room.guest);
            }
            
            console.log(`[Connection] Both players joined room ${roomId}`);

        });

        // -----------------------------
        // ポトル画面㝸㝮冝接�?
        // -----------------------------

        socket.on("rejoinBattle",(data)=>{

            const { roomId, oldPlayerId, player } = data;

            const battle = BattleManager.getBattle(roomId);

            if(!battle){

                socket.emit("rejoinFailed", { reason: "battle_not_found" });

                return;

            }

            if(battle.finished){

                socket.emit("rejoinFailed", { reason: "battle_finished" });

                return;

            }

            // 切断通知タイマーをキャンセル
            const timerKey = `${roomId}_${oldPlayerId}`;
            if (disconnectTimers[timerKey]) {
                clearTimeout(disconnectTimers[timerKey]);
                delete disconnectTimers[timerKey];
                console.log(`Cancelled disconnect timer for ${timerKey}`);
            }

            const remapped = BattleManager.remapPlayerSocket(
                roomId,
                oldPlayerId,
                socket.id
            );

            if(!remapped){

                socket.emit("rejoinFailed", { reason: "player_not_found" });

                return;

            }

            const room = RoomManager.getRoom(roomId);

            if(room){

                if(room.host === oldPlayerId) room.host = socket.id;
                if(room.guest === oldPlayerId) room.guest = socket.id;

            }

            PlayerManager.addPlayer(socket.id, player);

            socket.join(roomId);

            const me = battle.players[oldPlayerId];
            const enemy = BattleManager.getEnemy(roomId, oldPlayerId);

            socket.emit("battleRejoined", {
                me,
                enemy,
                myTurn: battle.turn === oldPlayerId
            });

            console.log("Battle Rejoined:", socket.id, "in", roomId);

        });

        // -----------------------------
        // プレイヤー行動
        // -----------------------------

        socket.on("playerAction", (data) => {

            const battle = BattleManager.getBattle(data.roomId);

            if(!battle){

                socket.emit("actionError", { message: "ポトル㝌見㝤㝋り㝾㝛ん" });

                return;

            }

            if(battle.finished){

                socket.emit("actionError", { message: "ポトル㝯終�?㝗㝦�?㝾�?" });

                return;

            }

            if(battle.turn !== socket.id){

                socket.emit("actionError", { message: "㝂㝪㝟�?�ターン㝧㝯㝂り㝾㝛ん" });

                return;

            }

            // executeAction is not implemented in current BattleEngine
            // This event handler may be for a different battle system
            socket.emit("actionError", { message: "Action not implemented" });
            return;

        });

        socket.on("battleFinished",(data)=>{

            io.to(data.roomId).emit(
                "battleFinished",
                data
            );

            BattleManager.finishBattle(data.roomId);

        });

        socket.on("requestRematch",(roomId)=>{

            io.to(roomId).emit("rematchReady");

        });

        // -----------------------------
        // �?断
        // -----------------------------

        socket.on("disconnect", (reason) => {

            console.log("DISCONNECT:", socket.id, reason);

            const rooms = [...socket.rooms];

            rooms.forEach(roomId => {

                if(roomId !== socket.id){

                    socket.to(roomId).emit("opponentLeft");

                }

            });

            PlayerManager.removePlayer(socket.id);

        });

    });

};
