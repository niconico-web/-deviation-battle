const MatchmakingManager = require("../managers/MatchmakingManager");
const RoomManager = require("../managers/RoomManager");
const BattleManager = require("../managers/BattleManager");

function toBattlePlayer(player, socketId) {
    const battleStats = player.battleStats || player;
    return {
        id: player.id,
        socketId,
        name: player.name,
        maxHp: battleStats.maxHp ?? player.maxHp,
        atk: battleStats.atk ?? player.atk,
        def: battleStats.def ?? player.def,
        speed: battleStats.speed ?? player.speed,
        grade: player.grade || 1,
        equippedWeapon: player.equippedWeapon || null
    };
}

module.exports = function(io){

    io.on("connection",(socket)=>{

        socket.on("requestRandomMatch", (player) => {
            if(!player || !player.id){
                socket.emit("errorMessage", "プレイヤーデータが必要です");
                return;
            }

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
                const opponent = result.opponent;
                const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

                RoomManager.createRoom(roomId, socket.id, player);
                RoomManager.joinRoom(roomId, opponent.socketId, opponent.player);

                socket.join(roomId);
                const opponentSocket = io.sockets.sockets.get(opponent.socketId);
                if (opponentSocket) opponentSocket.join(roomId);

                const hostData = toBattlePlayer(player, socket.id);
                const guestData = toBattlePlayer(opponent.player, opponent.socketId);
                const battleData = BattleManager.createBattle(roomId, hostData, guestData);

                if (!battleData) {
                    socket.emit("errorMessage", "バトルの作成に失敗しました");
                    return;
                }

                socket.emit("matchFound", {
                    roomId,
                    me: battleData.players[player.id],
                    enemy: battleData.players[opponent.player.id]
                });

                io.to(opponent.socketId).emit("matchFound", {
                    roomId,
                    me: battleData.players[opponent.player.id],
                    enemy: battleData.players[player.id]
                });
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
