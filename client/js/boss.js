const BossManager = require('../managers/BossManager');

module.exports = function (io) {
    io.on('connection', (socket) => {
        // クライアントからのボスリスト要求に応答
        socket.on('bosses:get', () => {
            try {
                const bosses = BossManager.getAllBosses();
                socket.emit('bosses:list', bosses);
            } catch (e) {
                console.error("Error getting boss list:", e);
                socket.emit('dataError', 'Failed to get boss list.');
            }
        });

        // クライアントからの特定ボスデータ要求に応答
        socket.on('bosses:getDetails', ({ bossId, difficulty }) => {
            try {
                const boss = BossManager.createBossForBattle(bossId, difficulty);
                if (!boss) {
                    socket.emit('dataError', 'Invalid boss selection.');
                    return;
                }
                socket.emit('bosses:details', { boss });
            } catch (e) {
                console.error(`Error creating boss for battle (id: ${bossId}, diff: ${difficulty}):`, e);
                socket.emit('dataError', 'Failed to create boss for battle.');
            }
        });
    });
};