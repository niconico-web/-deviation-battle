// ============================================
// School Battle
// connection.js
// ============================================

const PlayerManager = require("../managers/PlayerManager");
const RoomManager = require("../managers/RoomManager");
const BattleManager = require("../managers/BattleManager");
const BattleEngine = require("../managers/BattleEngine");

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
            equippedWeapon: live.equippedWeapon || null
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
            equippedWeapon: storedData.equippedWeapon || null
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

            if(player){

                PlayerManager.addPlayer(socket.id, player);

            }

            const roomId = Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();

            // Socket.IO roomに参加
            socket.join(roomId);

            // ルームマネージャーに登録
            RoomManager.createRoom(roomId, socket.id, player || null);

            console.log("Room Create:", roomId, "by socket:", socket.id);
            console.log("Socket rooms:", Array.from(socket.rooms));

            socket.emit("roomCreated", roomId);

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
            console.log("Available rooms:", Object.keys(RoomManager.getRooms ? RoomManager.getRooms() : {}));

            if(!roomId){

                socket.emit("joinFailed");

                return;

            }

            if(guestPlayer){

                PlayerManager.addPlayer(socket.id, guestPlayer);

            }

            // Socket.IO roomに参加
            socket.join(roomId);

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

            const host = resolveBattlePlayer(room.host, room.hostData);

            const guest = resolveBattlePlayer(room.guest, room.guestData);

            if(!host || !guest){

                console.log("Join Failed: player data missing", roomId);

                socket.emit("joinFailed");

                return;

            }

            const battle = BattleManager.createBattle(
                roomId,
                host,
                guest
            );

            if(!battle){

                socket.emit("joinFailed");

                return;

            }

            console.log("Room Ready:", roomId);
            console.log("Host socket:", room.host, "Guest socket:", room.guest);
            console.log("Battle players:", battle.players);

            // 自動参加成功の通知
            socket.emit("autoJoinSuccess", roomId);

            // 両方のプレイヤーに通知
            io.to(room.host).emit("roomReady", {
                roomId,
                me: battle.players[host.id],
                enemy: battle.players[guest.id]
            });

            io.to(room.guest).emit("roomReady", {
                roomId,
                me: battle.players[guest.id],
                enemy: battle.players[host.id]
            });
            
            // 両方のプレイヤーをルームに参加させる
            io.sockets.sockets.get(room.host)?.join(roomId);
            io.sockets.sockets.get(room.guest)?.join(roomId);
            
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
