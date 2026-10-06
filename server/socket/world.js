// server/socket/world.js
// ============================================
// 町フィールド（自由移動MMOフィールド）の
// リアルタイム位置同期を扱うソケットハンドラ。
//
// イベント：
//   world:join   { worldId, player }         -> world:state, (他者へ) world:playerJoined
//   world:move   { worldId, x, y, dir }      -> (同じ部屋へ・100msごとにまとめて) world:playersMoved [{id,x,y,dir}...]
//   world:leave  { worldId }                 -> (他者へ) world:playerLeft
//   disconnect                               -> 入っていた全ワールドから退出扱いにする
// ============================================

const WorldManager = require("../managers/WorldManager");

function roomName(worldId) {
    return `world:${worldId}`;
}

// 位置の配信：以前は誰かが動くたびに「部屋の全員へ1通ずつ」送っていたため、N人いると送信数がN²に比例して増え、
// 人が増えるほどサーバーが重くなっていた。今は 100ms ごとに「その間に動いた全員ぶん」を1通にまとめて送る。
// volatile＝詰まっている相手には送らず捨てる（位置は次の更新で上書きされるので問題ない）。
// 再接続復元用のパケット保存（connectionStateRecovery）にも載らないので、メモリも増えない。
const MOVE_BATCH_MS = 100;
const MIN_MOVE_GAP_MS = 40;          // 1人が極端な頻度で送ってきても無視する
const pendingMoves = {};             // worldId -> { playerId: {id,x,y,dir} }
let flushTimer = null;

module.exports = function (io) {
    function flushMoves() {
        flushTimer = null;
        for (const worldId of Object.keys(pendingMoves)) {
            const list = Object.values(pendingMoves[worldId]);
            delete pendingMoves[worldId];
            if (list.length) io.to(roomName(worldId)).volatile.emit("world:playersMoved", list);
        }
    }
    function queueMove(worldId, entry) {
        (pendingMoves[worldId] || (pendingMoves[worldId] = {}))[entry.id] = entry;
        if (!flushTimer) flushTimer = setTimeout(flushMoves, MOVE_BATCH_MS);
    }

    io.on("connection", (socket) => {
        let lastMoveAt = 0;

        socket.on("world:join", (data) => {
            const worldId = data && data.worldId;
            const player = data && data.player;
            const spawn = data && data.spawn;

            if (!worldId || !player || !player.id) {
                socket.emit("world:error", { message: "invalid_join" });
                return;
            }

            const room = roomName(worldId);
            socket.join(room);

            const entry = WorldManager.joinWorld(worldId, socket.id, player, spawn);
            if (!entry) {
                socket.emit("world:error", { message: "join_failed" });
                return;
            }

            // 参加者本人へ：今そのフィールドにいる全員の状態を送る
            const others = WorldManager.getPlayers(worldId).filter(p => p.id !== player.id);
            socket.emit("world:state", { worldId, players: others, me: entry });

            // 他の参加者へ：新しいプレイヤーが入ってきたことを通知
            socket.to(room).emit("world:playerJoined", entry);
        });

        socket.on("world:move", (data) => {
            const worldId = data && data.worldId;
            const playerId = data && data.playerId;
            if (!worldId || !playerId) return;

            const now = Date.now();
            if (now - lastMoveAt < MIN_MOVE_GAP_MS) return;
            lastMoveAt = now;

            const updated = WorldManager.updatePosition(worldId, playerId, data.x, data.y, data.dir);
            if (!updated) return;

            queueMove(worldId, { id: playerId, x: updated.x, y: updated.y, dir: updated.dir });
        });

        socket.on("world:leave", (data) => {
            const worldId = data && data.worldId;
            const playerId = data && data.playerId;
            if (!worldId || !playerId) return;

            WorldManager.leaveWorld(worldId, playerId);
            if (pendingMoves[worldId]) delete pendingMoves[worldId][playerId];
            socket.leave(roomName(worldId));
            socket.to(roomName(worldId)).emit("world:playerLeft", { id: playerId });
        });

        socket.on("disconnect", () => {
            const left = WorldManager.leaveBySocket(socket.id);
            if (left) {
                if (pendingMoves[left.worldId]) delete pendingMoves[left.worldId][left.playerId];
                io.to(roomName(left.worldId)).emit("world:playerLeft", { id: left.playerId });
            }
        });
    });
};
