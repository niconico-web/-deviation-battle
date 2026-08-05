// ============================================
// School Battle
// disconnect.js
// ============================================

const BattleManager = require("../managers/BattleManager");
const RoomManager = require("../managers/RoomManager");

// BattleManagerのタイマー管理を使用
const disconnectTimers = BattleManager.disconnectTimers;

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
                        
                        // 10秒後に相手プレイヤーに通知（再接続の猶予期間）
                        const timerKey = `${roomId}_${playerId}`;
                        
                        disconnectTimers[timerKey] = setTimeout(() => {
                            const battle = BattleManager.getBattle(roomId);
                            if (battle && !battle.finished) {
                                const enemyId = Object.keys(battle.players).find(id => id !== playerId);
                                if (enemyId) {
                                    const enemy = battle.players[enemyId];
                                    const enemySocket = io.sockets.sockets.get(enemy.socketId);
                                    
                                    if (enemySocket) {
                                        console.log(`Notifying enemy ${enemyId} that player ${playerId} left`);
                                        enemySocket.emit("opponentLeft");
                                    }
                                }
                            }
                            delete disconnectTimers[timerKey];
                        }, 10000); // 10秒待つ
                    }
                }
                
                // ルームマネージャーからは削除しない（再接続のために残す）
                // バトルが終了した場合のみ削除する
            });
        });

    });

};
