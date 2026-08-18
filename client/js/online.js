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

const BOT_MONSTERS = [
    { 
        name: "ゴブリン", monsterType: "ゴブリン", monsterEmoji: "👺", 
        baseStats: { maxHp: 80, atk: 60, def: 40, speed: 50 },
        materialDrops: [{ materialId: 'goblin_fang', chance: 0.5 }]
    },
    { 
        name: "スライム", monsterType: "スライム", monsterEmoji: "💧",
        baseStats: { maxHp: 100, atk: 50, def: 60, speed: 30 },
        materialDrops: [{ materialId: 'slime_jelly', chance: 0.6 }]
    },
    { 
        name: "ベビードラゴン", monsterType: "ドラゴン", monsterEmoji: "🐲",
        baseStats: { maxHp: 120, atk: 70, def: 50, speed: 40 },
        materialDrops: [{ materialId: 'dragon_scale', chance: 0.4 }]
    }
];

function setupOnlineEventHandlers() {
    if (onlineHandlersSetup) {
        return;
    }
    onlineHandlersSetup = true;
    
    // ボタンイベントハンドラーの設定
    const createRoomBtn = document.getElementById("createRoom");
    const joinRoomBtn = document.getElementById("joinRoom");
    const botMatchBtn = document.getElementById("botMatch");
    const randomMatchBtn = document.getElementById("randomMatch");

    if (randomMatchBtn) {
        let isMatching = false;
        randomMatchBtn.onclick = function() {
            if (isMatching) {
                // マッチングをキャンセル
                isMatching = false;
                randomMatchBtn.textContent = "ランダムマッチ";
                randomMatchBtn.disabled = false;
                const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
                if (player && window.socket) {
                    window.socket.emit("cancelMatchmaking", player.id);
                }
                // イベントリスナーを解除
                window.socket.off("matchFound");
                window.socket.off("matchCancelled");
                window.socket.off("errorMessage");
                return;
            }

            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }
            if (!window.socket || !window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }

            isMatching = true;
            randomMatchBtn.textContent = "マッチング待機中... (クリックでキャンセル)";
            const battlePlayer = getBattleReadyPlayer(player);
            
            const handleMatchFound = (data) => {
                isMatching = false;
                randomMatchBtn.textContent = "ランダムマッチ";
                randomMatchBtn.disabled = false;

                localStorage.removeItem("isBotBattle");
                localStorage.setItem("roomId", data.roomId);
                localStorage.setItem("battlePlayer", JSON.stringify(data.me));
                localStorage.setItem("enemy", JSON.stringify(data.enemy));
                setTimeout(() => {
                    location.href = "battle.html";
                }, 50);
            };

            const handleMatchCancelled = () => {
                isMatching = false;
                randomMatchBtn.textContent = "ランダムマッチ";
                randomMatchBtn.disabled = false;
                alert("マッチングがキャンセルされました。");
            };

            const handleErrorMessage = (message) => {
                isMatching = false;
                randomMatchBtn.textContent = "ランダムマッチ";
                randomMatchBtn.disabled = false;
                alert(message || "マッチングに失敗しました。");
            };

            window.socket.off("matchFound");
            window.socket.off("matchCancelled");
            window.socket.off("errorMessage");
            window.socket.on("matchFound", handleMatchFound);
            window.socket.on("matchCancelled", handleMatchCancelled);
            window.socket.on("errorMessage", handleErrorMessage);

            window.socket.emit("requestRandomMatch", battlePlayer);
        };
    }

    if (botMatchBtn) {
        botMatchBtn.onclick = function() {
            const player = migratePlayer(JSON.parse(localStorage.getItem("player")));
            if (!player) {
                alert("まずはキャラクターを作成してください。");
                return;
            }

            const battleStats = getBattleStats(player);
            
            // ランダムなモンスターを選択
            const randomMonster = BOT_MONSTERS[Math.floor(Math.random() * BOT_MONSTERS.length)];

            // プレイヤーの学年に合わせてボットの学年を設定
            const playerGrade = player.grade || 1;
            
            // 学年に応じた基礎ステータスを計算（強化版）
            const gradeMultiplier = Math.max(1.0, 1.0 + (playerGrade - 1) * 0.1);
            const baseMaxHp = Math.floor(randomMonster.baseStats.maxHp * gradeMultiplier);
            const baseAtk = Math.floor(randomMonster.baseStats.atk * gradeMultiplier);
            const baseDef = Math.floor(randomMonster.baseStats.def * gradeMultiplier);
            const baseSpeed = Math.floor(randomMonster.baseStats.speed * gradeMultiplier);

            // 武器補正を適用
            const botBaseStats = {
                maxHp: baseMaxHp,
                atk: baseAtk,
                def: baseDef,
                speed: baseSpeed
            };

            const botPlayer = {
                id: "bot_" + Date.now(),
                name: randomMonster.name,
                ...botBaseStats,
                hp: baseMaxHp,
                grade: playerGrade,
                isBot: true,
                monsterType: randomMonster.monsterType,
                monsterEmoji: randomMonster.monsterEmoji,
                materialDrops: randomMonster.materialDrops
            };

            const battlePlayer = getBattleReadyPlayer(player);

            localStorage.setItem("roomId", "bot_battle_" + Date.now());
            localStorage.setItem("battlePlayer", JSON.stringify(battlePlayer));
            localStorage.setItem("enemy", JSON.stringify(botPlayer));
            localStorage.setItem("isBotBattle", "true");

            setTimeout(() => {
                location.href = "battle.html";
            }, 50);
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
            if (!window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            createRoomBtn.disabled = true;
            createRoomBtn.textContent = "作成中...";
            const battlePlayer = getBattleReadyPlayer(player);
            
            const cleanupListeners = () => {
                window.socket.off("roomCreated", handleRoomCreated);
                window.socket.off("errorMessage", handleErrorMessage);
                window.socket.off("roomReady", handleRoomReadyForHost);
            };

            const handleRoomReadyForHost = (data) => {
                console.log("Room is ready for host!", data);
                localStorage.removeItem("isBotBattle");
                localStorage.setItem("roomId", data.roomId);
                localStorage.setItem("battlePlayer", JSON.stringify(data.me));
                localStorage.setItem("enemy", JSON.stringify(data.enemy));
                cleanupListeners();
                setTimeout(() => {
                    location.href = "battle.html";
                }, 50);
            };
            
            const handleRoomCreated = (roomId) => {
                console.log("roomCreated event received:", roomId);
                localStorage.setItem("lastCreatedRoom", roomId);
                localStorage.setItem("lastCreatedRoomTime", Date.now().toString());

                createRoomBtn.textContent = "相手の参加待ち...";
                // Button remains disabled

                const roomUrl = window.location.origin + "/?room=" + roomId;
                const clipboardText = `ルームコード: ${roomId}\n参加URL: ${roomUrl}`;
                navigator.clipboard.writeText(clipboardText).then(() => {
                    alert("ルームコード: " + roomId + "\n\n✓ コードとURLをクリップボードにコピーしました！\n\n友達にURLを送るか、コードを教えてください。\n\nURL: " + roomUrl);
                }).catch(() => {
                    alert("ルームコード: " + roomId + "\n\n参加URL: " + roomUrl);
                });
            };
            
            const handleErrorMessage = (message) => {
                createRoomBtn.disabled = false;
                createRoomBtn.textContent = "ルーム作成";
                alert(message || "ルーム作成に失敗しました。もう一度お試しください。");
                cleanupListeners();
            };

            cleanupListeners(); // Clean up any previous listeners before setting new ones
            window.socket.on("roomCreated", handleRoomCreated);
            window.socket.on("roomReady", handleRoomReadyForHost);
            window.socket.on("errorMessage", handleErrorMessage);

            window.socket.emit("createRoom", battlePlayer);

            setTimeout(() => {
                if (createRoomBtn.textContent === "作成中...") {
                    createRoomBtn.disabled = false;
                    createRoomBtn.textContent = "ルーム作成";
                    alert("ルーム作成に失敗しました(タイムアウト)。もう一度お試しください。");
                    cleanupListeners();
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
            if (!window.socket.connected) {
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            joinRoomBtn.disabled = true;
            joinRoomBtn.textContent = "参加中...";
            localStorage.setItem("attemptedJoinRoom", roomId);
            const battlePlayer = getBattleReadyPlayer(player);
            console.log("Emitting joinRoom with roomId:", roomId, "player:", battlePlayer);
            
            // roomReadyイベントを受信する一時的なリスナー
            const handleRoomReady = (data) => {
                console.log("roomReady event received:", data);
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = "ルーム参加";

                localStorage.removeItem("isBotBattle");
                localStorage.setItem("roomId", data.roomId);
                localStorage.setItem("battlePlayer", JSON.stringify(data.me));
                localStorage.setItem("enemy", JSON.stringify(data.enemy));
                setTimeout(() => {
                    location.href = "battle.html";
                }, 50); // 50ミリ秒待機
            };

            const handleJoinFailed = () => {
                console.log("joinFailed event received");
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

            window.socket.off("roomReady");
            window.socket.off("joinFailed");
            window.socket.on("roomReady", handleRoomReady);
            window.socket.on("joinFailed", handleJoinFailed);

            window.socket.emit("joinRoom", { roomId, player: battlePlayer });

            setTimeout(() => {
                if (joinRoomBtn.disabled) {
                    joinRoomBtn.disabled = false;
                    joinRoomBtn.textContent = "ルーム参加";
                    alert("ルーム参加に失敗しました。もう一度お試しください。");
                }
            }, 10000);
        };
    }
}
