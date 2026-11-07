// ============================================
// School Battle
// board.js
// 掲示板ソケット（スレッド一覧・作成・詳細・返信）
// ============================================

const BoardManager = require("../managers/BoardManager");

module.exports = function(io){

    io.on("connection",(socket)=>{

        // -----------------------------
        // 掲示板システム
        // -----------------------------

        // スレッド一覧取得
        socket.on("board:list", (page) => {
            const result = BoardManager.getThreads(page || 1);
            socket.emit("board:threads", result);
        });

        // スレッド詳細取得
        socket.on("board:getThread", (id) => {
            const thread = BoardManager.getThread(id);
            socket.emit("board:thread", thread);
        });

        // スレッド作成
        socket.on("board:create", (data) => {
            const { title, body, authorId, authorName } = data || {};
            console.log(`[Board] Create thread request: ${title} by ${authorName}`);

            const result = BoardManager.createThread({
                title,
                body,
                authorId,
                authorName
            });

            socket.emit("board:createResponse", result);
        });

        // スレッドに返信
        socket.on("board:reply", (data) => {
            const { threadId, body, authorId, authorName } = data || {};
            console.log(`[Board] Reply request: thread ${threadId} by ${authorName}`);

            const result = BoardManager.reply(threadId, {
                body,
                authorId,
                authorName
            });

            socket.emit("board:replyResponse", result);
        });

        // スレッド削除（投稿者本人のみ）
        socket.on("board:delete", (data) => {
            const { threadId, playerId } = data || {};
            const result = BoardManager.deleteThread(threadId, playerId);
            socket.emit("board:deleteResponse", result);
        });
    });
};
