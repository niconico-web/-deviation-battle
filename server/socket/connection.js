// ============================================
// School Battle
// connection.js
// Commit #009
// Part 2 / 4
// ============================================

const PlayerManager = require("../managers/PlayerManager");
const RoomManager = require("../managers/RoomManager");
const BattleManager = require("../managers/BattleManager");
const BattleEngine = require("../managers/BattleEngine");

module.exports = function(io){

    io.on("connection",(socket)=>{

        console.log("接続:",socket.id);

        socket.emit("connected");

        // -----------------------------
        // プレイヤー登録
        // -----------------------------

        socket.on("playerJoin",(player)=>{

            PlayerManager.addPlayer(

                socket.id,

                player

            );

            console.log(

                "Player Join:",

                player.name

            );

        });

        // -----------------------------
        // ルーム作成
        // -----------------------------

        socket.on("createRoom",()=>{

            const roomId=Math.random()

                .toString(36)

                .substring(2,8)

                .toUpperCase();

            RoomManager.createRoom(

                roomId,

                socket.id

            );

            socket.join(roomId);

            console.log(

                "Room Create:",

                roomId

            );

            socket.emit(

                "roomCreated",

                roomId

            );

        });

        // -----------------------------
        // ルーム参加
        // -----------------------------

        socket.on("joinRoom",(roomId)=>{

            console.log(

                "Join Request:",

                roomId

            );

            const success=

                RoomManager.joinRoom(

                    roomId,

                    socket.id

                );

            if(!success){

                socket.emit(

                    "joinFailed"

                );

                return;

            }

            socket.join(roomId);

            const room=

                RoomManager.getRoom(

                    roomId

                );

            const host=

                PlayerManager.getPlayer(

                    room.host

                );

            const guest=

                PlayerManager.getPlayer(

                    room.guest

                );
                console.log("===== roomReady送信 =====");
console.log("room.host =", room.host);
console.log("room.guest =", room.guest);
console.log("現在接続中 =", [...io.sockets.sockets.keys()]);

            console.log(

                "Room Ready:",

                roomId

            );

            // -----------------------------
        // Battle作成
        // -----------------------------

        const battle = BattleManager.createBattle(
            roomId,
            host,
            guest
        );

        // -----------------------------
        // Hostへ送信
        // -----------------------------

        io.to(room.host).emit(
            "roomReady",
            {
                roomId,

                me: battle.players[room.host],

                enemy: battle.players[room.guest],

                myTurn:
                battle.turn === room.host
            }
        );

        // -----------------------------
        // Guestへ送信
        // -----------------------------

        io.to(room.guest).emit(
            "roomReady",
            {
                roomId,

                me: battle.players[room.guest],

                enemy: battle.players[room.host],

            myTurn:
                battle.turn === room.guest
        }
        );

        });
// -----------------------------
// プレイヤー行動
// -----------------------------

        socket.on("playerAction",(data)=>{

            const battle =
            BattleManager.getBattle(data.roomId);

            if(!battle) return;

            if(battle.finished) return;

            if(battle.turn !== socket.id) return;

            const result =
                BattleEngine.executeAction(

                    battle,

                    socket.id,

                    data.action

                );

            io.to(data.roomId).emit(

                "battleUpdate",

                result

            );

            if(battle.finished){

                io.to(data.roomId).emit(

                    "battleFinished",

                    {

                        winner:result.winner

                    }

                );

            }

        });
        socket.on("battleFinished",(data)=>{

            io.to(data.roomId).emit(
                "battleFinished",
                data
            );

            BattleManager.finishBattle(
                data.roomId
            );

        });
        socket.on("requestRematch",(roomId)=>{

            io.to(roomId).emit(
            "rematchReady"
            );

        });

        // -----------------------------
        // 切断
        // -----------------------------

        socket.on("disconnect",()=>{

            console.log(

                "切断:",

                socket.id

            );

            PlayerManager.removePlayer(

                socket.id

            );

            console.log(

                "現在のプレイヤー:",

                PlayerManager.getPlayers()

            );
            socket.broadcast.emit(

                "opponentLeft"

            );

        });

    });

};
