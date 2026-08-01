let onlineHandlersSetup = false;

// ------------------
// ルーム作成
// ------------------
function setupOnlineEventHandlers() {
    console.log("setupOnlineEventHandlers called");
    if (onlineHandlersSetup) {
        console.log("Online handlers already setup, skipping");
        return;
    }
    onlineHandlersSetup = true;

    const createRoomBtn = document.getElementById("createRoom");
    const joinRoomBtn = document.getElementById("joinRoom");
    const botMatchBtn = document.getElementById("botMatch");

    console.log("Elements found:", {
        createRoomBtn: !!createRoomBtn,
        joinRoomBtn: !!joinRoomBtn,
        botMatchBtn: !!botMatchBtn
    });

    // ボット対戦（最もシンプル）
    if (botMatchBtn) {
        botMatchBtn.onclick = function() {
            console.log("Bot match button clicked");
            const player = JSON.parse(localStorage.getItem("player"));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }

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

            localStorage.setItem("roomId", "bot_battle_" + Date.now());
            localStorage.setItem("battlePlayer", JSON.stringify(player));
            localStorage.setItem("enemy", JSON.stringify(botPlayer));
            localStorage.setItem("isBotBattle", "true");

            alert("ボット対戦を開始します！");
            location.href = "battle.html";
        };
        console.log("Bot match button handler attached");
    }

    // 簡易ルーム機能（デモ用）
    if (createRoomBtn) {
        createRoomBtn.onclick = function() {
            console.log("Create room button clicked");
            const player = JSON.parse(localStorage.getItem("player"));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }
            alert("ルーム機能は現在メンテナンス中です。\nボット対戦をご利用ください。");
        };
        console.log("Create room button handler attached");
    }

    if (joinRoomBtn) {
        joinRoomBtn.onclick = function() {
            console.log("Join room button clicked");
            alert("ルーム機能は現在メンテナンス中です。\nボット対戦をご利用ください。");
        };
        console.log("Join room button handler attached");
    }

    // ------------------
    // 作成完了
    // ------------------
    if (window.socket) {
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

            message += "\n⚠️ ルームコードを正確に入力しているか確認してください。\n\n";
            message += "🔧 回避策:\n";
            message += "1. ルームコードを再度確認して入力\n";
            message += "2. 新しいルームを作成して友達に教える\n";
            message += "3. 「ランダムマッチ」または「ボット対戦」を試す\n\n";
            message += "ボット対戦は練習に最適です！";

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

// Setup online handlers when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupOnlineEventHandlers);
} else {
    setupOnlineEventHandlers();
}