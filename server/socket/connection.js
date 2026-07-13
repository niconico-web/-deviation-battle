// ============================================
// School Battle
// connection.js
// ============================================

const PlayerManager = require("../managers/PlayerManager");
const RoomManager = require("../managers/RoomManager");
const BattleManager = require("../managers/BattleManager");
const BattleEngine = require("../managers/BattleEngine");

module.exports = function(io){

    io.on("connection",(socket)=>{

        console.log("接続:", socket.id);

        socket.emit("connected");

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

        socket.on("createRoom",()=>{

            const roomId = Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();

            RoomManager.createRoom(roomId, socket.id);

            socket.join(roomId);

            console.log("Room Create:", roomId);

            socket.emit("roomCreated", roomId);

        });

        // -----------------------------
        // ルーム参加
        // -----------------------------

        socket.on("joinRoom",(roomId)=>{

            console.log("Join Request:", roomId);

            const success = RoomManager.joinRoom(roomId, socket.id);

            if(!success){

                socket.emit("joinFailed");

                return;

            }

            socket.join(roomId);

            const room = RoomManager.getRoom(roomId);

            const host = PlayerManager.getPlayer(room.host);

            const guest = PlayerManager.getPlayer(room.guest);

            const battle = BattleManager.createBattle(
                roomId,
                host,
                guest
            );

            console.log("Room Ready:", roomId);

            io.to(room.host).emit("roomReady", {
                roomId,
                me: battle.players[room.host],
                enemy: battle.players[room.guest],
                myTurn: battle.turn === room.host
            });

            io.to(room.guest).emit("roomReady", {
                roomId,
                me: battle.players[room.guest],
                enemy: battle.players[room.host],
                myTurn: battle.turn === room.guest
            });

        });

        // -----------------------------
        // バトル画面への再接続
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

            const me = battle.players[socket.id];
            const enemy = BattleManager.getEnemy(roomId, socket.id);

            socket.emit("battleRejoined", {
                me,
                enemy,
                myTurn: battle.turn === socket.id
            });

            console.log("Battle Rejoined:", socket.id, "in", roomId);

        });

        // -----------------------------
        // プレイヤー行動
        // -----------------------------

        socket.on("playerAction", (data) => {

            const battle = BattleManager.getBattle(data.roomId);

            if(!battle){

                socket.emit("actionError", { message: "バトルが見つかりません" });

                return;

            }

            if(battle.finished){

                socket.emit("actionError", { message: "バトルは終了しています" });

                return;

            }

            if(battle.turn !== socket.id){

                socket.emit("actionError", { message: "あなたのターンではありません" });

                return;

            }

            const result = BattleEngine.executeAction(
                battle,
                socket.id,
                data.action
            );

            if(!result){

                socket.emit("actionError", { message: "無効な行動です" });

                return;

            }

            io.to(data.roomId).emit("battleUpdate", result);

            if(result.winner){

                io.to(data.roomId).emit("battleFinished", {
                    roomId: data.roomId,
                    winner: result.winner
                });

                BattleManager.finishBattle(data.roomId);

            }

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
        // 切断
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
