let onlineHandlersSetup = false;

function getBattleReadyPlayer(player) {
    const battleStats = getBattleStats(player);
    // 武器補正後のmaxHpをHPとして設定（常にフルHPで開始）
    return {
        ...player,
        ...battleStats,
        hp: battleStats.maxHp,
        battleStats
    };
}

function setupOnlineEventHandlers() {
    // ソケットがあればハンドラー設定を試行
    if (window.socket) {
        console.log("Setting up online event handlers in online.js");
        console.log("Socket connected status:", window.socket.connected);
    } else {
        console.log("Socket not available in online.js, will retry in 1 second");
        setTimeout(() => {
            if (window.socket) {
                console.log("Retry: Socket now available, setting up handlers");
                setupOnlineEventHandlers();
            }
        }, 1000);
    }
    
    onlineHandlersSetup = true;
    
    // ボタンイベントハンドラーの設定
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
            // ボットの武器をtier1-tier3でランダムに生成
            const tiers = ["tier1", "tier2", "tier3"];
            const randomTier = tiers[Math.floor(Math.random() * tiers.length)];
            const botWeapon = createWeapon(randomType, randomTier, false);

            // プレイヤーの学年に合わせてボットの学年を設定
            const playerGrade = player.grade || 1;
            
            // 学年に応じた基礎ステータスを計算（強化版）
            const gradeMultiplier = Math.max(1.0, Math.min(1.8, 1.0 + (playerGrade - 1) * 0.08));
            const baseMaxHp = Math.floor(120 * gradeMultiplier);
            const baseAtk = Math.floor(70 * gradeMultiplier);
            const baseDef = Math.floor(55 * gradeMultiplier);
            const baseSpeed = Math.floor(45 * gradeMultiplier);

            // 武器補正を適用
            const botBaseStats = {
                maxHp: baseMaxHp,
                atk: baseAtk,
                def: baseDef,
                speed: baseSpeed
            };
            const botStatsWithWeapon = applyWeaponStats(botBaseStats, botWeapon);

            const botPlayer = {
                id: "bot_" + Date.now(),
                name: "AIボット",
                maxHp: botStatsWithWeapon.maxHp,
                hp: botStatsWithWeapon.maxHp,
                atk: botStatsWithWeapon.atk,
                def: botStatsWithWeapon.def,
                speed: botStatsWithWeapon.speed,
                grade: playerGrade,
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
            if (!window.socket) {
                alert("ソケットが初期化されていません。ページを再読み込みしてください。");
                return;
            }
            // socket.connectedプロパティのチェックを緩和（Socket.IOの状態チェックを使用）
            if (!window.socket.connected && !window.socket.io) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            createRoomBtn.disabled = true;
            createRoomBtn.textContent = "作成中...";
            const battlePlayer = getBattleReadyPlayer(player);
            console.log("Emitting playerJoin and createRoom with player:", battlePlayer);
            console.log("Socket ID:", window.socket.id);
            console.log("Socket connected:", window.socket.connected);
            
            // ルーム作成イベントを受信する一時的なリスナー
            const onRoomCreated = (roomId) => {
                console.log("roomCreated event received:", roomId);
                window.socket.off("roomCreated", onRoomCreated);
                
                localStorage.setItem("lastCreatedRoom", roomId);
                localStorage.setItem("lastCreatedRoomTime", Date.now().toString());

                createRoomBtn.disabled = false;
                createRoomBtn.textContent = "ルーム作成";

                const roomUrl = window.location.origin + "/?room=" + roomId;
                const clipboardText = `ルームコード: ${roomId}\n参加URL: ${roomUrl}`;
                navigator.clipboard.writeText(clipboardText).then(() => {
                    alert("ルームコード: " + roomId + "\n\n✓ コードとURLをクリップボードにコピーしました！\n\n友達にURLを送るか、コードを教えてください。\n\nURL: " + roomUrl);
                }).catch(() => {
                    alert("ルームコード: " + roomId + "\n\n参加URL: " + roomUrl);
                });
            };
            
            window.socket.on("roomCreated", onRoomCreated);
            console.log("roomCreated listener registered");
            
            window.socket.emit("playerJoin", battlePlayer);
            console.log("playerJoin emitted");
            
            window.socket.emit("createRoom", battlePlayer);
            console.log("createRoom emitted");
            
            // タイムアウト処理
            setTimeout(() => {
                console.log("createRoom timeout check");
                window.socket.off("roomCreated", onRoomCreated);
                if (createRoomBtn.disabled) {
                    createRoomBtn.disabled = false;
                    createRoomBtn.textContent = "ルーム作成";
                    alert("ルーム作成に失敗しました。もう一度お試しください。");
                }
            }, 10000);
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
            if (!window.socket) {
                alert("ソケットが初期化されていません。ページを再読み込みしてください。");
                return;
            }
            // socket.connectedプロパティのチェックを緩和
            if (!window.socket.connected && !window.socket.io) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            joinRoomBtn.disabled = true;
            joinRoomBtn.textContent = "参加中...";
            localStorage.setItem("attemptedJoinRoom", roomId);
            const battlePlayer = getBattleReadyPlayer(player);
            console.log("Emitting playerJoin and joinRoom with roomId:", roomId, "player:", battlePlayer);
            
            // roomReadyイベントを受信する一時的なリスナー
            const onRoomReady = (data) => {
                console.log("roomReady event received:", data);
                window.socket.off("roomReady", onRoomReady);
                
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = "ルーム参加";
                
                localStorage.setItem("roomId", data.roomId);
                localStorage.setItem("battlePlayer", JSON.stringify(data.me));
                localStorage.setItem("enemy", JSON.stringify(data.enemy));
                location.href = "battle.html";
            };
            
            // joinFailedイベントを受信する一時的なリスナー
            const onJoinFailed = () => {
                console.log("joinFailed event received");
                window.socket.off("joinFailed", onJoinFailed);
                window.socket.off("roomReady", onRoomReady);
                
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = "ルーム参加";

                const attemptedRoom = localStorage.getItem("attemptedJoinRoom");
                let message = "ルームが存在しないか、満員です。\n\n";
                if (attemptedRoom) {
                    message += `参加しようとしたルーム: ${attemptedRoom}\n`;
                }
                message += "\nルームコードを確認するか、新しいルームを作成してください。";
                alert(message);
            };
            
            window.socket.on("roomReady", onRoomReady);
            window.socket.on("joinFailed", onJoinFailed);
            
            window.socket.emit("playerJoin", battlePlayer);
            window.socket.emit("joinRoom", { roomId, player: battlePlayer });
            
            // タイムアウト処理
            setTimeout(() => {
                window.socket.off("roomReady", onRoomReady);
                window.socket.off("joinFailed", onJoinFailed);
                if (joinRoomBtn.disabled) {
                    joinRoomBtn.disabled = false;
                    joinRoomBtn.textContent = "ルーム参加";
                    alert("ルーム参加に失敗しました。もう一度お試しください。");
                }
            }, 10000);
        };
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupOnlineEventHandlers);
} else {
    console.log("DOM already loaded, setting up online event handlers immediately");
    setupOnlineEventHandlers();
}
