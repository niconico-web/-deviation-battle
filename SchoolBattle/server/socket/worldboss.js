// server/socket/worldboss.js
// ============================================
// ワールドボスシステムのソケットハンドラ
// ============================================

let currentWorldBoss = null;
let worldBossEndTime = null;
let worldBossParticipants = [];

module.exports = function(io) {
    io.on('connection', (socket) => {

        // ワールドボス出現
        socket.on('worldBoss:spawn', (data) => {
            const { bossId } = data;
            
            // 簡易実装：管理者のみがボスを出現可能
            // 本番環境では時間ベースの出現ロジックを実装
            
            if (!currentWorldBoss) {
                // クライアントからボス情報を取得（簡易実装）
                currentWorldBoss = { id: bossId, spawnedAt: Date.now() };
                worldBossEndTime = Date.now() + 30 * 60 * 1000; // 30分
                worldBossParticipants = [];
                
                // 全プレイヤーに通知
                io.emit('worldBoss:spawn', { bossId });
            }
        });

        // ワールドボス参加
        socket.on('worldBoss:join', (data) => {
            const { bossId, playerId } = data;
            
            if (!currentWorldBoss || currentWorldBoss.id !== bossId) {
                return socket.emit('worldBoss:error', { message: 'ボスが出現していません' });
            }
            
            if (!worldBossParticipants.includes(playerId)) {
                worldBossParticipants.push(playerId);
                
                // 参加を全プレイヤーに通知
                io.emit('worldBoss:participant', { playerId });
            }
        });

        // ワールドボス終了
        socket.on('worldBoss:end', (data) => {
            const { bossId, defeated } = data;
            
            if (currentWorldBoss && currentWorldBoss.id === bossId) {
                // 全プレイヤーに通知
                io.emit('worldBoss:end', { bossId, defeated });
                
                currentWorldBoss = null;
                worldBossEndTime = null;
                worldBossParticipants = [];
            }
        });

        // ワールドボス情報リクエスト
        socket.on('worldBoss:getInfo', () => {
            if (currentWorldBoss) {
                socket.emit('worldBoss:info', {
                    boss: currentWorldBoss,
                    endTime: worldBossEndTime,
                    participantCount: worldBossParticipants.length
                });
            } else {
                socket.emit('worldBoss:info', null);
            }
        });
    });
};