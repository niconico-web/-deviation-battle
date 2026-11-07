// ============================================
// School Battle
// pvp.js（スナップショット対戦＝他プレイヤーの「分身」戦）
// ============================================
// 実際の対戦相手がいない時間帯でもPvPできるように、各プレイヤーの
// 戦闘スナップショット（ステータス・武器補正込み）をサーバーに預け、
// ランダムな他プレイヤーの分身を敵として返す。
// ステータス自体はクライアント権威（localStorage）なので、ここでは
// 「保存と抽選」だけを担当する。数値は一応クランプしておく。

const PlayerDataManager = require("../managers/PlayerDataManager");

// スナップショットとして保存を許可するフィールド（これ以外は捨てる）
const SNAPSHOT_FIELDS = [
    'name', 'level', 'grade', 'maxHp', 'atk', 'def', 'speed', 'special',
    'attackType', 'avatar', 'skills', 'uniqueAbilities'
];
const NUM_CLAMP = 1e9;

function sanitizeSnapshot(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    SNAPSHOT_FIELDS.forEach(k => {
        const v = raw[k];
        if (v == null) return;
        if (typeof v === 'number') out[k] = Math.max(0, Math.min(NUM_CLAMP, v));
        else if (typeof v === 'string') out[k] = v.slice(0, 100);
        else if (typeof v === 'boolean') out[k] = v;
        else if (Array.isArray(v)) out[k] = v.slice(0, 50);
        else if (typeof v === 'object') out[k] = v;
    });
    if (!out.name) out.name = '名もなき戦士';
    return out;
}

module.exports = function (io) {
    io.on("connection", (socket) => {

        // 自分の戦闘スナップショットをサーバーに預ける（分身の材料）
        socket.on("pvp:updateSnapshot", (data) => {
            const { playerId, snapshot } = data || {};
            if (!playerId || !snapshot) return;
            const player = PlayerDataManager.getPlayer(playerId);
            if (!player) return;
            const clean = sanitizeSnapshot(snapshot);
            if (!clean) return;
            player.battleSnapshot = clean;
            player.battleSnapshotAt = Date.now();
            PlayerDataManager.savePlayer(player);
        });

        // ランダムな他プレイヤーの分身を1体返す
        socket.on("pvp:getRival", (data, cb) => {
            const reply = typeof cb === "function" ? cb : () => {};
            const playerId = data && data.playerId;
            if (!playerId) { reply({ success: false, reason: "no_player" }); return; }

            const players = PlayerDataManager.getAllPlayers();
            const rivals = Object.values(players).filter(p =>
                p && p.id !== playerId && p.battleSnapshot && p.battleSnapshot.name
            );
            if (!rivals.length) { reply({ success: false, reason: "no_rivals" }); return; }

            const pick = rivals[Math.floor(Math.random() * rivals.length)];
            reply({
                success: true,
                rival: {
                    id: pick.id,
                    name: pick.name || pick.battleSnapshot.name,
                    level: pick.level || pick.battleSnapshot.level || 1,
                    snapshot: pick.battleSnapshot
                }
            });
        });
    });
};
