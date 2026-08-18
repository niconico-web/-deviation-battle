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
            const botTypes = Object.keys(WEAPON_TYPES);
            const randomType = botTypes[Math.floor(Math.random() * botTypes.length)];
            // ボットの武器をtier1-tier3でランダムに生成
            const tiers = ["tier1", "tier2", "tier3"];
            const randomTier = tiers[Math.floor(Math.random() * tiers.length)];
            const botWeapon = createWeapon(randomType, randomTier, false);

            // モンスターの種類を定義
            const monsterTypes = [
                { name: "スライム", emoji: "🟢", difficulty: 1.0, drops: ["スライムの粘液", "基本オーブ欠片"] },
                { name: "ゴブリン", emoji: "👺", difficulty: 1.2, drops: ["ゴブリンの牙", "粗末なオーブ"] },
                { name: "オーク", emoji: "👹", difficulty: 1.4, drops: ["オークの皮", "強化オーブ欠片"] },
                { name: "ドラゴン", emoji: "🐉", difficulty: 1.8, drops: ["ドラゴンの鱗", "炎のオーブ", "高級オーブ"] },
                { name: "ゾンビ", emoji: "🧟", difficulty: 1.1, drops: ["ゾンビの肉", "闇のオーブ欠片"] },
                { name: "スケルトン", emoji: "💀", difficulty: 1.3, drops: ["骨片", "死のオーブ欠片"] },
                { name: "ウィッチ", emoji: "🧙‍♀️", difficulty: 1.5, drops: "魔女の帽子", "魔法のオーブ欠片"] },
                { name: "ナイト", emoji: "🤺", difficulty: 1.6, drops: ["騎士の盾", "守護のオーブ"] },
                { name: "ゴーレム", emoji: "🗿", difficulty: 1.7, drops: ["魔法石", "大地のオーブ"] },
                { name: "フェニックス", emoji: "🔥", difficulty: 2.0, drops: ["不死鳥の羽", "再生のオーブ", "伝説のオーブ"] }
            ];

            // プレイヤーの学年に合わせてモンスターを選択
            const playerGrade = player.grade || 1;
            const availableMonsters = monsterTypes.filter(m => {
                // 学年1-3: 難易度1.0-1.3
                // 学年4-6: 難易度1.0-1.5
                // 学年7-9: 難易度1.0-1.7
                // 学年10-12: 難易度1.0-2.0
                if (playerGrade <= 3) return m.difficulty <= 1.3;
                if (playerGrade <= 6) return m.difficulty <= 1.5;
                if (playerGrade <= 9) return m.difficulty <= 1.7;
                return m.difficulty <= 2.0;
            });

            const selectedMonster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
            
            // 学年に応じた基礎ステータスを計算（モンスター難易度を考慮）
            const gradeMultiplier = Math.max(1.0, Math.min(1.8, 1.0 + (playerGrade - 1) * 0.08));
            const monsterMultiplier = selectedMonster.difficulty;
            const baseMaxHp = Math.floor(120 * gradeMultiplier * monsterMultiplier);
            const baseAtk = Math.floor(70 * gradeMultiplier * monsterMultiplier);
            const baseDef = Math.floor(55 * gradeMultiplier * monsterMultiplier);
            const baseSpeed = Math.floor(45 * gradeMultiplier * monsterMultiplier);

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
                name: selectedMonster.emoji + " " + selectedMonster.name,
                monsterType: selectedMonster.name,
                monsterEmoji: selectedMonster.emoji,
                monsterDrops: selectedMonster.drops,
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
