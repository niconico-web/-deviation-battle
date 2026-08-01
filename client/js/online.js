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

            // ルーム作成ボタンを無効化
            createRoomBtn.disabled = true;
            createRoomBtn.textContent = "作成中...";

            window.socket.emit("playerJoin", player);
            window.socket.emit("createRoom", player);

            // タイムアウト処理
            setTimeout(() => {
                if (createRoomBtn.disabled) {
                    createRoomBtn.disabled = false;
                    createRoomBtn.textContent = "ルーム作成";
                    alert("ルーム作成に失敗しました。時間をおいて再度お試しください。");
                }
            }, 10000);
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

            // 参加ボタンを無効化
            joinRoomBtn.disabled = true;
            joinRoomBtn.textContent = "参加中...";

            console.log("ルーム参加を試みます:", roomId);
            window.socket.emit("playerJoin", player);
            window.socket.emit("joinRoom", { roomId, player });

            // タイムアウト処理
            setTimeout(() => {
                if (joinRoomBtn.disabled) {
                    joinRoomBtn.disabled = false;
                    joinRoomBtn.textContent = "ルーム参加";
                    alert("ルーム参加に失敗しました。時間をおいて再度お試しください。");
                }
            }, 10000);
        };
    }

    // ------------------
    // ボット対戦
    // ------------------
    const botMatchBtn = document.getElementById("botMatch");
    if (botMatchBtn) {
        botMatchBtn.onclick = () => {
            const player = JSON.parse(localStorage.getItem("player"));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }

            // ボット対戦の設定
            const botPlayer = {
                id: "bot_" + Date.now(),
                name: "AIボット",
                maxHp: 100,
                hp: 100,
                atk: 50,
                def: 40,
                speed: 30,
                grade: 5,
                isBot: true
            };

            // バトルデータを保存
            localStorage.setItem("roomId", "bot_battle_" + Date.now());
            localStorage.setItem("battlePlayer", JSON.stringify(player));
            localStorage.setItem("enemy", JSON.stringify(botPlayer));
            localStorage.setItem("isBotBattle", "true");

            alert("ボット対戦を開始します！");
            location.href = "battle.html";
        };
    }

    // ------------------
    // 作成完了
    // ------------------
    if (window.socket && !window.socket._roomCreatedListener) {
        window.socket._roomCreatedListener = true;
        window.socket.on("roomCreated",(roomId)=>{
            // ルームコードをローカルストレージに保存
            localStorage.setItem("lastCreatedRoom", roomId);
            localStorage.setItem("lastCreatedRoomTime", Date.now().toString());

            // ルーム作成ボタンを元に戻す
            const createRoomBtn = document.getElementById("createRoom");
            if (createRoomBtn) {
                createRoomBtn.disabled = false;
                createRoomBtn.textContent = "ルーム作成";
            }

            // URLを作成
            const roomUrl = window.location.origin + "/?room=" + roomId;

            // ルームコードとURLをクリップボードにコピー
            const clipboardText = `ルームコード: ${roomId}\n参加URL: ${roomUrl}`;
            navigator.clipboard.writeText(clipboardText).then(() => {
                alert("ルームコード: " + roomId + "\n\n✓ コードとURLをクリップボードにコピーしました！\n\n友達にURLを送るか、コードを教えてください。\n\nURL: " + roomUrl);
            }).catch(() => {
                alert("ルームコード: " + roomId + "\n\n参加URL: " + roomUrl + "\n\n友達にURLを送るか、コードを教えてください！");
            });
        });
    }

        // ------------------
        // 参加失敗
        // ------------------
        if (!window.socket._joinFailedListener) {
            window.socket._joinFailedListener = true;
            window.socket.on("joinFailed",()=>{
                // Re-enable join button
                const joinRoomBtn = document.getElementById("joinRoom");
                if (joinRoomBtn) {
                    joinRoomBtn.disabled = false;
                    joinRoomBtn.textContent = "ルーム参加";
                }

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

                message += "\n⚠️ ルームコードを正確に入力しているか確認してください。\n\n";
                message += "🔧 回避策:\n";
                message += "1. ルームコードを再度確認して入力\n";
                message += "2. 新しいルームを作成して友達に教える\n";
                message += "3. 「ランダムマッチ」または「ボット対戦」を試す\n\n";
                message += "ボット対戦は練習に最適です！";

                alert(message);
            });
        }

        // ------------------
        // マッチ完了
        // ------------------
        window.socket.on("roomReady",(data)=>{
            console.log("roomReady受信!",data);
            localStorage.setItem("roomId", data.roomId);
            localStorage.setItem("battlePlayer", JSON.stringify(data.me));
            localStorage.setItem("enemy", JSON.stringify(data.enemy));

            // Re-enable join button
            const joinRoomBtn = document.getElementById("joinRoom");
            if (joinRoomBtn) {
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = "ルーム参加";
            }

            location.href = "battle.html";
        });

        // Handle room auto-join success
        window.socket.on("autoJoinSuccess", (roomId) => {
            console.log("自動参加成功:", roomId);
            // Clear pending join
            window.pendingRoomJoin = null;

            // Re-enable join button
            const joinRoomBtn = document.getElementById("joinRoom");
            if (joinRoomBtn) {
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = "ルーム参加";
            }
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