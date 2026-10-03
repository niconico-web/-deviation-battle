// server/socket/world.js
// ============================================
// 町フィールド（自由移動MMOフィールド）の
// リアルタイム位置同期を扱うソケットハンドラ。
//
// イベント：
//   world:join   { worldId, player }         -> world:state, (他者へ) world:playerJoined
//   world:move   { worldId, x, y, dir }      -> (他者へ) world:playerMoved
//   world:leave  { worldId }                 -> (他者へ) world:playerLeft
//   disconnect                               -> 入っていた全ワールドから退出扱いにする
// ============================================

const WorldManager = require("../managers/WorldManager");

function roomName(worldId) {
    return `world:${worldId}`;
}

module.exports = function (io) {
    io.on("connection", (socket) => {

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

            const updated = WorldManager.updatePosition(worldId, playerId, data.x, data.y, data.dir);
            if (!updated) return;

            socket.to(roomName(worldId)).emit("world:playerMoved", {
                id: playerId,
                x: updated.x,
                y: updated.y,
                dir: updated.dir
            });
        });

        socket.on("world:leave", (data) => {
            const worldId = data && data.worldId;
            const playerId = data && data.playerId;
            if (!worldId || !playerId) return;

            WorldManager.leaveWorld(worldId, playerId);
            socket.leave(roomName(worldId));
            socket.to(roomName(worldId)).emit("world:playerLeft", { id: playerId });
        });

        socket.on("disconnect", () => {
            const left = WorldManager.leaveBySocket(socket.id);
            if (left) {
                io.to(roomName(left.worldId)).emit("world:playerLeft", { id: left.playerId });
            }
        });
    });
};
