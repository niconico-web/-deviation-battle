// ============================================
// School Battle
// dungeon.js (socket registration)
// ============================================
// 他のserver/socket/*.jsと同じパターンで、ダンジョン用のソケットハンドラーを
// 各コネクションに登録する。以前はこのファイルが存在せず、
// server/socket-handlers/dungeon-socket-handlers.js の registerDungeonHandlers が
// どこからも呼ばれていなかったため、クライアントの dungeon:* イベントに
// サーバーが一切応答できず「接続エラー」になっていた。

const { registerDungeonHandlers } = require("../socket-handlers/dungeon-socket-handlers");

module.exports = function (io) {
    io.on("connection", (socket) => {
        registerDungeonHandlers(io, socket);
    });
};
