// ============================================
// School Battle
// connection.js
// Commit #009
// Part 2 / 4
// ============================================

const PlayerManager = require("../managers/PlayerManager");
const RoomManager = require("../managers/RoomManager");

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

            console.log(

                "Room Ready:",

                roomId

            );

            io.to(roomId).emit(

                "roomReady",

                {

                    roomId,

                    host,

                    guest

                }

            );

        });
                // -----------------------------
        // プレイヤー行動
        // -----------------------------

        socket.on("playerAction",(data)=>{

            socket.to(data.roomId).emit(

                "playerAction",

                {

                    action:data.action,

                    playerId:socket.id

                }

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

        });

    });

};
