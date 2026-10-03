// server/managers/WorldManager.js
// ============================================
// 町フィールド（オンラインMMOフィールド）の
// プレイヤー位置をメモリ上で管理するマネージャー。
// ・worldId ごとにプレイヤーの位置・向き・見た目情報を保持する
// ・socket.id と playerId の両方から引けるようにしておく
//   （切断時に socket.id からどのワールド／プレイヤーだったか
//     素早く特定するため）
// ============================================

// worlds[worldId] = { [playerId]: { id, socketId, name, level, x, y, dir, avatar, updatedAt } }
const worlds = {};

// socketId -> { worldId, playerId } の逆引き（disconnect時の後始末用）
const socketIndex = {};

function ensureWorld(worldId) {
    if (!worlds[worldId]) {
        worlds[worldId] = {};
    }
    return worlds[worldId];
}

function joinWorld(worldId, socketId, player, spawn) {
    if (!worldId || !player || !player.id) return null;

    const world = ensureWorld(worldId);

    // 既に同じplayerIdが（別socketで）入っていた場合は上書きする
    // （再接続・多重タブなどで古いエントリが残らないようにする）
    const existing = world[player.id];

    const entry = {
        id: player.id,
        socketId,
        name: player.name || "名無し",
        level: player.level || 1,
        x: existing && spawn == null ? existing.x : (spawn ? spawn.x : 800),
        y: existing && spawn == null ? existing.y : (spawn ? spawn.y : 600),
        dir: existing ? existing.dir : "down",
        avatar: player.avatar || null,
        updatedAt: Date.now()
    };

    world[player.id] = entry;
    socketIndex[socketId] = { worldId, playerId: player.id };

    return entry;
}

function updatePosition(worldId, playerId, x, y, dir) {
    const world = worlds[worldId];
    if (!world || !world[playerId]) return null;

    if (typeof x === "number" && Number.isFinite(x)) world[playerId].x = x;
    if (typeof y === "number" && Number.isFinite(y)) world[playerId].y = y;
    if (typeof dir === "string") world[playerId].dir = dir;
    world[playerId].updatedAt = Date.now();

    return world[playerId];
}

function leaveWorld(worldId, playerId) {
    const world = worlds[worldId];
    if (!world) return;
    const entry = world[playerId];
    if (entry && socketIndex[entry.socketId]) {
        delete socketIndex[entry.socketId];
    }
    delete world[playerId];
}

function leaveBySocket(socketId) {
    const info = socketIndex[socketId];
    if (!info) return null;
    delete socketIndex[socketId];
    const world = worlds[info.worldId];
    if (world && world[info.playerId] && world[info.playerId].socketId === socketId) {
        delete world[info.playerId];
        return info;
    }
    return null;
}

function getPlayers(worldId) {
    const world = worlds[worldId];
    if (!world) return [];
    return Object.values(world);
}

module.exports = {
    joinWorld,
    updatePosition,
    leaveWorld,
    leaveBySocket,
    getPlayers
};
