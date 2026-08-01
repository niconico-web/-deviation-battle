let onlineHandlersSetup = false;

// ------------------
// ルーム作成
// ------------------
function setupOnlineEventHandlers() {
    if (onlineHandlersSetup) {
        console.log("Online handlers already setup, skipping");
        return;
    }
    onlineHandlersSetup = true;

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

            // 参加情報を保存
            localStorage.setItem("attemptedJoinRoom", roomId);
            localStorage.setItem("attemptedJoinTime", Date.now().toString());

            console.log("ルーム参加を試みます:", roomId);
            window.socket.emit("playerJoin", player);
            window.socket.emit("joinRoom", { roomId, player });
        };
    }

    // ------------------
    // 作成完了
    // ------------------
    if (window.socket) {
        window.socket.on("roomCreated",(roomId)=>{
            // ルームコードをローカルストレージに保存
            localStorage.setItem("lastCreatedRoom", roomId);
            localStorage.setItem("lastCreatedRoomTime", Date.now().toString());
            alert("ルームコード\n\n"+roomId + "\n\nこのコードを友達に教えてください！\n\n（コードはコピーしてください）");
        });

        // ------------------
        // 参加失敗
        // ------------------
        window.socket.on("joinFailed",()=>{
            const attemptedRoom = localStorage.getItem("attemptedJoinRoom");
            const lastCreatedRoom = localStorage.getItem("lastCreatedRoom");
            const lastCreatedTime = localStorage.getItem("lastCreatedRoomTime");

            let message = "ルームが存在しません。\n\n";

            if (lastCreatedRoom && lastCreatedTime) {
                const timeDiff = Date.now() - parseInt(lastCreatedTime);
                const minutesAgo = Math.floor(timeDiff / 60000);
                message += `最後に作成したルーム: ${lastCreatedRoom} (${minutesAgo}分前)\n`;
            }

            if (attemptedRoom) {
                message += `参加しようとしたルーム: ${attemptedRoom}\n`;
            }

            message += "\n同じブラウザでルームを作成した場合、\nページを再読み込みしてから参加してください。\n\nまたは、別のブラウザ/デバイスで友達と一緒に試してください。";

            alert(message);
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
    if (onlineHandlersSetup) {
        console.log("Online handlers already setup, skipping initialization");
        return;
    }

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