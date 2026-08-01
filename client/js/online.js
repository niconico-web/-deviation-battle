// ------------------
// ルーム作成
// ------------------
function setupOnlineEventHandlers() {
    const createRoomBtn = document.getElementById("createRoom");
    const joinRoomBtn = document.getElementById("joinRoom");

    if (createRoomBtn) {
        createRoomBtn.onclick = () => {
            const player = JSON.parse(localStorage.getItem("player"));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }
            if (!window.socket || !window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            window.socket.emit("playerJoin", player);
            window.socket.emit("createRoom", player);
        };
    }

    // ------------------
    // ルーム参加
    // ------------------
    if (joinRoomBtn) {
        joinRoomBtn.onclick = () => {
            const player = JSON.parse(localStorage.getItem("player"));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }
            const roomId = document.getElementById("roomInput").value.trim().toUpperCase();
            if(roomId === ""){
                alert("ルームコードを入力してください。");
                return;
            }
            if (!window.socket || !window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            window.socket.emit("playerJoin", player);
            window.socket.emit("joinRoom", { roomId, player });
        };
    }

    // ------------------
    // 作成完了
    // ------------------
    if (window.socket) {
        window.socket.on("roomCreated",(roomId)=>{
            alert("ルームコード\n\n"+roomId);
        });

        // ------------------
        // 参加失敗
        // ------------------
        window.socket.on("joinFailed",()=>{
            alert("ルームが存在しません。");
        });

        // ------------------
        // マッチ完了
        // ------------------
        window.socket.on("roomReady",(data)=>{
            console.log("roomReady受信!",data);
            localStorage.setItem("roomId", data.roomId);
            localStorage.setItem("battlePlayer", JSON.stringify(data.me));
            localStorage.setItem("enemy", JSON.stringify(data.enemy));
            location.href = "battle.html";
        });
    }
}

// Setup online handlers when DOM is ready and socket is initialized
function setupOnlineHandlersWhenReady() {
    // Wait for socket to be initialized
    const checkSocket = setInterval(() => {
        if (window.socket && window.socket.connected) {
            clearInterval(checkSocket);
            console.log("Socket connected, setting up online handlers");
            setupOnlineEventHandlers();
        }
    }, 100);

    // Fallback after 5 seconds
    setTimeout(() => {
        clearInterval(checkSocket);
        console.log("Socket check timeout, setting up handlers anyway");
        setupOnlineEventHandlers();
    }, 5000);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupOnlineHandlersWhenReady);
} else {
    setupOnlineHandlersWhenReady();
}