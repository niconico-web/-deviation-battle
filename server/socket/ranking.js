const PlayerDataManager = require('../managers/PlayerDataManager');

// 戦力スコアの重み付け
// ・勉強時間: 1分あたり 1pt
// ・対人戦勝利: 1勝あたり 30pt
// ・ボス戦周回: 1周あたり 15pt
const STUDY_MINUTE_WEIGHT = 1;
const PVP_WIN_WEIGHT = 30;
const BOSS_RUN_WEIGHT = 15;

/**
 * プレイヤー1人分の戦力スコアと内訳を計算する。
 * @param {object} player
 * @returns {{studyMinutes:number, pvpWins:number, bossRunCount:number, powerScore:number}}
 */
function calculatePowerScore(player) {
    const studyMinutes = Math.floor((player.totalStudySeconds || 0) / 60);
    const pvpWins = player.pvpWins || 0;
    const bossRunCount = player.bossRunCount || 0;

    const powerScore =
        studyMinutes * STUDY_MINUTE_WEIGHT +
        pvpWins * PVP_WIN_WEIGHT +
        bossRunCount * BOSS_RUN_WEIGHT;

    return { studyMinutes, pvpWins, bossRunCount, powerScore };
}

/**
 * 全プレイヤーの戦力ランキングを、戦力スコアの高い順に並べて返す。
 * @returns {Array<object>}
 */
function getPowerRanking() {
    const players = PlayerDataManager.getAllPlayers();

    return players
        .filter(p => p && p.id && p.name)
        .map(p => {
            const breakdown = calculatePowerScore(p);
            return {
                id: p.id,
                name: p.name,
                level: p.level || 1,
                ...breakdown
            };
        })
        .sort((a, b) => b.powerScore - a.powerScore);
}

module.exports = function (io) {
    io.on('connection', (socket) => {
        // クライアントからのランキング取得要求に応える
        socket.on('ranking:get', () => {
            try {
                const ranking = getPowerRanking();
                socket.emit('ranking:list', ranking);
            } catch (e) {
                console.error('Error getting power ranking:', e);
                socket.emit('dataError', 'ランキングの取得に失敗しました。');
            }
        });
    });
};

module.exports.calculatePowerScore = calculatePowerScore;
module.exports.getPowerRanking = getPowerRanking;
