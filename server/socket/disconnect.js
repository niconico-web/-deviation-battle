// ============================================
// School Battle
// disconnect.js
// ============================================

const BattleManager = require("../managers/BattleManager");
const RoomManager = require("../managers/RoomManager");

module.exports = function(io){

    io.on("connection",(socket)=>{

        socket.on("disconnect", () => {
            console.log(`[${new Date().toISOString()}] Socket disconnected: ${socket.id}`);
            
            // プレイヤーが参加しているルームを探す
            const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
            
            rooms.forEach(roomId => {
                const battle = BattleManager.getBattle(roomId);
                
                if (battle && !battle.finished) {
                    const playerId = BattleManager.findPlayerIdBySocket(battle, socket.id);
                    
                    if (playerId) {
                        console.log(`Player ${playerId} disconnected from battle ${roomId}`);
                        
                        // 相手プレイヤーに通知
                        const enemyId = Object.keys(battle.players).find(id => id !== playerId);
                        if (enemyId) {
                            const enemy = battle.players[enemyId];
                            const enemySocket = io.sockets.sockets.get(enemy.socketId);
                            
                            if (enemySocket) {
                                enemySocket.emit("opponentLeft");
                            }
                        }
                    }
                }
                
                // ルームマネージャーからも削除
                const room = RoomManager.getRoom(roomId);
                if (room) {
                    if (room.host === socket.id) {
                        RoomManager.deleteRoom(roomId);
                    } else if (room.guest === socket.id) {
                        room.guest = null;
                    }
                }
            });
        });

    });

};
