let onlineHandlersSetup = false;

function getBattleReadyPlayer(player) {
    const battleStats = getBattleStats(player);
    return {
        ...player,
        ...battleStats,
        battleStats
    };
}

function setupOnlineEventHandlers() {
    if (onlineHandlersSetup) return;
    onlineHandlersSetup = true;

    const createRoomBtn = document.getElementById("createRoom");
    const joinRoomBtn = document.getElementById("joinRoom");
    const botMatchBtn = document.getElementById("botMatch");

    if (botMatchBtn) {
        botMatchBtn.onclick = function() {
            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }

            const battleStats = getBattleStats(player);
            const botTypes = Object.keys(WEAPON_TYPES);
            const randomType = botTypes[Math.floor(Math.random() * botTypes.length)];
            const botWeapon = createWeapon(randomType, "tier1", false);

            const botPlayer = {
                id: "bot_" + Date.now(),
                name: "AIボット",
                maxHp: 100,
                hp: 100,
                atk: 50,
                def: 40,
                speed: 30,
                grade: 5,
                isBot: true,
                equippedWeapon: botWeapon
            };

            const battlePlayer = getBattleReadyPlayer(player);

            localStorage.setItem("roomId", "bot_battle_" + Date.now());
            localStorage.setItem("battlePlayer", JSON.stringify(battlePlayer));
            localStorage.setItem("enemy", JSON.stringify(botPlayer));
            localStorage.setItem("isBotBattle", "true");

            location.href = "battle.html";
        };
    }

    if (createRoomBtn) {
        createRoomBtn.onclick = function() {
            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }
            if (!window.socket || !window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            createRoomBtn.disabled = true;
            createRoomBtn.textContent = "作成中...";
            const battlePlayer = getBattleReadyPlayer(player);
            window.socket.emit("playerJoin", battlePlayer);
            window.socket.emit("createRoom", battlePlayer);
        };
    }

    if (joinRoomBtn) {
        joinRoomBtn.onclick = function() {
            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }
            const roomId = document.getElementById("roomInput").value.trim().toUpperCase();
            if (!roomId) {
                alert("ルームコードを入力してください。");
                return;
            }
            if (!window.socket || !window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            joinRoomBtn.disabled = true;
            joinRoomBtn.textContent = "参加中...";
            localStorage.setItem("attemptedJoinRoom", roomId);
            const battlePlayer = getBattleReadyPlayer(player);
            window.socket.emit("playerJoin", battlePlayer);
            window.socket.emit("joinRoom", { roomId, player: battlePlayer });
        };
    }

    if (window.socket) {
        window.socket.on("roomCreated", (roomId) => {
            localStorage.setItem("lastCreatedRoom", roomId);
            localStorage.setItem("lastCreatedRoomTime", Date.now().toString());

            const createRoomBtn = document.getElementById("createRoom");
            if (createRoomBtn) {
                createRoomBtn.disabled = false;
                createRoomBtn.textContent = "ルーム作成";
            }

            const roomUrl = window.location.origin + "/?room=" + roomId;
            const clipboardText = `ルームコード: ${roomId}\n参加URL: ${roomUrl}`;
            navigator.clipboard.writeText(clipboardText).then(() => {
                alert("ルームコード: " + roomId + "\n\n✓ コードとURLをクリップボードにコピーしました！\n\n友達にURLを送るか、コードを教えてください。\n\nURL: " + roomUrl);
            }).catch(() => {
                alert("ルームコード: " + roomId + "\n\n参加URL: " + roomUrl);
            });
        });

        window.socket.on("joinFailed", () => {
            const joinRoomBtn = document.getElementById("joinRoom");
            if (joinRoomBtn) {
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = "ルーム参加";
            }

            const attemptedRoom = localStorage.getItem("attemptedJoinRoom");
            let message = "ルームが存在しないか、満員です。\n\n";
            if (attemptedRoom) {
                message += `参加しようとしたルーム: ${attemptedRoom}\n`;
            }
            message += "\nルームコードを確認するか、新しいルームを作成してください。";
            alert(message);
        });

        window.socket.on("roomReady", (data) => {
            const joinRoomBtn = document.getElementById("joinRoom");
            if (joinRoomBtn) {
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = "ルーム参加";
            }
            localStorage.setItem("roomId", data.roomId);
            localStorage.setItem("battlePlayer", JSON.stringify(data.me));
            localStorage.setItem("enemy", JSON.stringify(data.enemy));
            location.href = "battle.html";
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupOnlineEventHandlers);
} else {
    setupOnlineEventHandlers();
}
