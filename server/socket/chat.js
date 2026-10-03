// server/socket/chat.js
// ============================================
// チャットシステムのソケットハンドラ
// ============================================

module.exports = function (io) {
    io.on("connection", (socket) => {

        // チャットメッセージ受信
        socket.on("chat:message", (data) => {
            const message = data && data.message;
            const type = data && data.type;
            const playerId = data && data.playerId;
            const playerName = data && data.playerName;
            const playerLevel = data && data.playerLevel;

            if (!message || !playerId || !playerName) {
                socket.emit("chat:error", { message: "invalid_message" });
                return;
            }

            // メッセージのバリデーション
            if (typeof message !== 'string' || message.length > 100) {
                socket.emit("chat:error", { message: "message_too_long" });
                return;
            }

            // チャットタイプに応じた配信
            const chatData = {
                type: type || 'global',
                playerId,
                playerName,
                playerLevel: playerLevel || 1,
                message,
                timestamp: Date.now()
            };

            switch (type) {
                case 'global':
                    // 全体チャット：全員に配信
                    io.emit("chat:message", chatData);
                    break;
                    
                case 'local':
                    // 近距離チャット：同一ワールド内のプレイヤーに配信
                    // 簡易実装：全体チャットと同じ（本当は位置判定が必要）
                    io.emit("chat:message", chatData);
                    break;
                    
                case 'party':
                    // パーティーチャット：パーティーメンバーに配信
                    // パーティーシステム実装後に対応
                    io.emit("chat:message", chatData);
                    break;
                    
                case 'guild':
                    // ギルドチャット：ギルドメンバーに配信
                    // ギルドシステム実装後に対応
                    io.emit("chat:message", chatData);
                    break;
                    
                default:
                    // 不明なタイプは全体チャットとして扱う
                    chatData.type = 'global';
                    io.emit("chat:message", chatData);
            }
        });

        // システムメッセージ配信（管理者用）
        socket.on("chat:system", (data) => {
            const message = data && data.message;
            if (!message) return;

            io.emit("chat:system", message);
        });
    });
};