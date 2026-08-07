window.socket = io({
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5
});

window.socket.on("connect", () => {
    console.log("Socket.IO connected successfully with ID:", window.socket.id);
});

window.socket.on("connect_error", (err) => {
    console.error("Socket.IO connection error:", err.message);
    // 接続失敗時のUIフィードバックをここに追加可能
    // 例: alert("サーバーとの接続に失敗しました。ページを再読み込みしてください。");
});

window.socket.on("disconnect", (reason) => {
    console.log("Socket.IO disconnected:", reason);
    if (reason === "io server disconnect") {
        // サーバー側から切断された場合
        window.socket.connect();
    }
    // その他の理由（クライアント側の問題など）での切断の場合は、
    // 自動再接続が試みられます。
});

// サーバーからのカスタムイベントのリスナー（デバッグ用）
window.socket.on("server_message", (data) => {
    console.log("Message from server:", data);
});
