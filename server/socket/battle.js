const BattleManager = require("../managers/BattleManager");
const BattleEngine = require("../managers/BattleEngine");
const BossManager = require('../managers/BossManager');
const PlayerManager = require('../managers/PlayerManager');

module.exports = function(io){

    io.on("connection",(socket)=>{

        // バトルルーム参加
        socket.on("joinBattleRoom", (data) => {
            const { roomId, playerId } = data;
            console.log(`[Battle] joinBattleRoom: roomId=${roomId}, playerId=${playerId}, socketId=${socket.id}`);
            
            const battle = BattleManager.getBattle(roomId);
            if (!battle) {
                console.error(`[Battle] Battle not found for room: ${roomId}`);
                socket.emit("battleError", { message: "Battle not found" });
                return;
            }
            
            // ルームに参加
            socket.join(roomId);
            console.log(`[Battle] Socket ${socket.id} joined room ${roomId}`);
            
            // プレイヤーのソケットIDを更新
            const player = battle.players[playerId];
            if (player) {
                BattleManager.remapPlayerSocket(roomId, playerId, socket.id);
                console.log(`[Battle] Remapped player ${playerId} to socket ${socket.id}`);
            } else {
                console.warn(`[Battle] Player ${playerId} not found in battle`);
                console.warn(`[Battle] Available players:`, Object.keys(battle.players));
            }
            
            // 参加成功を通知
            socket.emit("joinBattleRoomSuccess", { roomId, playerId });
        });

        // オンライン対戦（1対1）でのバトル進行に使う新しいイベント名。
        // クライアント(battle.js)は "battle:submitAnswer" / "battle:update" / "battle:finished" を使うが、
        // これに対応するサーバー側ハンドラが存在しなかったため、回答を送信しても
        // 何も返ってこず「読み込み中」のまま止まっていた。
        socket.on("battle:submitAnswer", (data) => {
            const { answer, skillId } = data || {};

            // battle:join / requestBattleStart で socket.join(roomId) 済みのはずなので、
            // 自分自身のデフォルトルーム以外のルームIDを取得する
            const roomId = [...socket.rooms].find(r => r !== socket.id);
            if (!roomId) {
                socket.emit("answerError", { message: "バトルルームが見つかりません" });
                return;
            }

            const battle = BattleManager.getBattle(roomId);
            if (!battle) {
                socket.emit("answerError", { message: "バトルが見つかりません" });
                return;
            }
            if (battle.finished) {
                socket.emit("answerError", { message: "バトルは終了しています" });
                return;
            }

            const playerId = BattleManager.findPlayerIdBySocket(battle, socket.id);
            if (!playerId) {
                socket.emit("answerError", { message: "プレイヤーが見つかりません" });
                return;
            }

            const player = battle.players[playerId];
            let usedSkill = null;
            if (skillId && player && Array.isArray(player.equippedSkills)) {
                usedSkill = player.equippedSkills.find(s => s && s.id === skillId) || null;
            }

            // レイドボス戦（パーティ対ボス、3人以上いる場合を含む）と、通常の1対1対戦とで処理を分ける
            if (battle.isBossBattle) {
                const result = BattleEngine.processRaidAnswer(battle, playerId, answer, usedSkill);

                if (result.error) {
                    socket.emit("answerError", { message: result.error });
                    return;
                }

                const bossId = Object.keys(battle.players).find(id => battle.players[id].isBoss);

                const logs = [];
                if (result.isCorrect) {
                    logs.push(`${result.playerName}が正解した！`);
                    if (result.damage) {
                        logs.push(`ボスに${result.damage}のダメージ！`);
                    }
                    if (result.ultimateActivated) {
                        logs.push(`${result.playerName}の必殺技が発動！`);
                    }
                } else {
                    logs.push(`${result.playerName}は不正解…ボスの反撃を受けた！`);
                    if (result.dodged) {
                        logs.push(`${result.playerName}は回避した！`);
                    } else if (result.damage) {
                        logs.push(`${result.playerName}は${result.damage}のダメージを受けた！`);
                    }
                    if (result.playerDown) {
                        logs.push(`${result.playerName}は戦闘不能になった！`);
                    }
                }
                if (result.skillUsed) {
                    logs.push(`スキル「${result.skillUsed.name}」を発動！`);
                }
                if (result.gutsSurvive) {
                    logs.push(`${result.gutsSurvivePlayerName}は根性で持ちこたえた！`);
                }

                const damageEvents = [];
                if (result.damage) {
                    const targetId = result.isCorrect ? bossId : playerId;
                    damageEvents.push({ targetId, dodged: !!result.dodged, damage: result.damage });
                }

                const effectEvents = [];
                if (result.ultimateActivated) {
                    effectEvents.push({ type: 'ultimate', playerId });
                }
                if (result.isCorrect) {
                    effectEvents.push({ type: 'correct', playerId });
                }

                // レイド戦は参加者全員分の状態を送る（ボス＋パーティメンバー全員）
                const stateUpdate = {};
                Object.keys(battle.players).forEach(id => {
                    const p = battle.players[id];
                    if (p) {
                        stateUpdate[id] = { hp: p.hp, maxHp: p.maxHp, ultimateGauge: p.ultimateGauge };
                    }
                });

                const updatePayload = { logs, damageEvents, effectEvents, stateUpdate };
                if (result.nextQuestion) {
                    updatePayload.nextQuestion = result.nextQuestion;
                }

                io.to(roomId).emit("battle:update", updatePayload);

                if (result.winner) {
                    io.to(roomId).emit("battle:finished", { winner: result.winner, draw: false });
                    BattleManager.deleteBattle(roomId);
                }
                return;
            }

            const result = BattleEngine.processAnswer(battle, playerId, answer, usedSkill);

            if (result.error) {
                socket.emit("answerError", { message: result.error });
                return;
            }

            const enemyId = Object.keys(battle.players).find(id => id !== playerId);

            // クライアントが期待する battle:update の形に変換する
            const logs = [];
            if (result.isCorrect) {
                logs.push(`${result.playerName}が正解した！`);
                if (result.dodged) {
                    logs.push("回避された！ダメージなし");
                } else if (result.damage) {
                    logs.push(`${result.damage}のダメージ！`);
                }
            } else if (result.wrongAnswer) {
                logs.push(`${result.playerName}は不正解…反撃を受けた！`);
                if (result.dodged) {
                    logs.push("回避した！ダメージなし");
                } else if (result.damage) {
                    logs.push(`${result.damage}のダメージを受けた！`);
                }
            }
            if (result.skillUsed) {
                logs.push(`スキル「${result.skillUsed.name}」を発動！`);
            }
            if (result.gutsSurvive) {
                logs.push(`${result.gutsSurvivePlayerName}は根性で持ちこたえた！`);
            }

            const damageEvents = [];
            if (result.damage) {
                const targetId = result.isCorrect ? enemyId : playerId;
                damageEvents.push({ targetId, dodged: !!result.dodged, damage: result.damage });
            }

            const effectEvents = [];
            if (result.ultimateActivated) {
                effectEvents.push({ type: 'ultimate', playerId: result.isCorrect ? playerId : enemyId });
            }
            if (result.isCorrect) {
                effectEvents.push({ type: 'correct', playerId });
            }

            const stateUpdate = {};
            [playerId, enemyId].forEach(id => {
                const p = battle.players[id];
                if (p) {
                    stateUpdate[id] = { hp: p.hp, maxHp: p.maxHp, ultimateGauge: p.ultimateGauge };
                }
            });

            const updatePayload = { logs, damageEvents, effectEvents, stateUpdate };
            if (result.nextQuestion) {
                updatePayload.nextQuestion = result.nextQuestion;
            }

            io.to(roomId).emit("battle:update", updatePayload);

            if (result.winner) {
                io.to(roomId).emit("battle:finished", { winner: result.winner, draw: false });
                BattleManager.deleteBattle(roomId);
            }
        });

        socket.on("submitAnswer", (data) => {
            const { roomId, answer, skill } = data;
            const battle = BattleManager.getBattle(roomId);
            
            console.log(`[Battle] submitAnswer: roomId=${roomId}, socketId=${socket.id}, answer=${answer}`);
            
            if (!battle) {
                console.error(`[Battle] Battle not found for room: ${roomId}`);
                socket.emit("answerError", { message: "Battle not found" });
                return;
            }

            const playerId = BattleManager.findPlayerIdBySocket(battle, socket.id);
            if (!playerId) {
                console.error(`[Battle] Player not found for socket: ${socket.id}`);
                socket.emit("answerError", { message: "Player not found in battle" });
                return;
            }
            
            console.log(`[Battle] Processing answer for player: ${playerId}`);
            
            const result = BattleEngine.processAnswer(battle, playerId, answer, skill);
            
            console.log(`[Battle] Answer result:`, result);
            
            if (result.error) {
                socket.emit("answerError", { message: result.error });
                return;
            }
            
            // 結果を両方のプレイヤーに送信
            console.log(`[Battle] Emitting answerResult to room: ${roomId}`);
            io.to(roomId).emit("answerResult", result);
            
            // バトルが終了した場合
            if (result.winner) {
                console.log(`[Battle] Battle finished, winner: ${result.winner}`);
                const finalResult = BattleEngine.finalizeBattle(battle);
                io.to(roomId).emit("battleFinished", finalResult);
                BattleManager.deleteBattle(roomId);
            }
        });

        // バトル開始（問題送信）
        socket.on("requestBattleStart", (data) => {
            const { roomId, playerId, playerName } = data;
            const battle = BattleManager.getBattle(roomId);
            
            console.log(`[Battle] requestBattleStart: roomId=${roomId}, socketId=${socket.id}, playerId=${playerId}, playerName=${playerName}, battle=${!!battle}`);
            
            if (!battle) {
                console.error(`[Battle] Battle not found for room: ${roomId}`);
                socket.emit("battleError", { message: "Battle not found" });
                return;
            }
            
            console.log(`[Battle] Battle found, players:`, Object.keys(battle.players));
            console.log(`[Battle] Battle players details:`, battle.players);
            
            // リクエストしたプレイヤーをルームに参加させる
            socket.join(roomId);
            console.log(`[Battle] Socket ${socket.id} joined room ${roomId}`);
            
            // プレイヤーのソケットIDを更新
            let foundPlayerId = BattleManager.findPlayerIdBySocket(battle, socket.id);
            
            // ソケットIDで見つからない場合、playerIdで検索
            if (!foundPlayerId && playerId) {
                if (battle.players[playerId]) {
                    foundPlayerId = playerId;
                    BattleManager.remapPlayerSocket(roomId, playerId, socket.id);
                    console.log(`[Battle] Remapped player ${playerId} to socket ${socket.id} by playerId`);
                }
            }
            
            if (foundPlayerId) {
                BattleManager.remapPlayerSocket(roomId, foundPlayerId, socket.id);
                console.log(`[Battle] Remapped player ${foundPlayerId} to socket ${socket.id}`);
            } else {
                console.warn(`[Battle] Could not find player for socket ${socket.id} or playerId ${playerId}`);
                console.warn(`[Battle] Available players:`, Object.keys(battle.players));
            }
            
            // もう一方のプレイヤーもルームに参加させる
            const playerIds = Object.keys(battle.players);
            const otherPlayerId = playerIds.find(id => id !== foundPlayerId);
            if (otherPlayerId) {
                const otherPlayer = battle.players[otherPlayerId];
                const otherSocket = io.sockets.sockets.get(otherPlayer.socketId);
                if (otherSocket) {
                    otherSocket.join(roomId);
                    console.log(`[Battle] Other player ${otherPlayerId} joined room ${roomId}`);
                } else {
                    console.warn(`[Battle] Other player socket ${otherPlayer.socketId} not found`);
                }
            }
            
            const initialization = BattleEngine.initializeBattle(battle);
            
            console.log(`[Battle] Sending battleStarted:`, {
                initialQuestion: initialization.initialQuestion,
                hasPlayers: !!battle.players,
                roomClients: io.sockets.adapter.rooms.get(roomId)?.size || 0,
                players: battle.players
            });
            
            // 両方のプレイヤーに最初の問題を送信
            io.to(roomId).emit("battleStarted", {
                initialQuestion: initialization.initialQuestion,
                players: battle.players
            });
            
            console.log(`[Battle] battleStarted emitted to room: ${roomId}`);
        });

        // バトル終了
        socket.on("battleFinished", (data) => {

            socket.to(data.roomId).emit("battleFinished", data);

        });

        // 再戦リクエスト
        socket.on("requestRematch", (data) => {

            const { roomId, playerId } = data;
            socket.to(roomId).emit("rematchRequested", { playerId });

        });

        // 再戦受諾
        socket.on("acceptRematch", (data) => {

            const { roomId } = data;
            // Create new room for rematch
            const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // Notify both players to join new room
            io.to(roomId).emit("rematchConfirmed", { newRoomId });

        });

        // -----------------------------
        // ボス戦
        // -----------------------------
        socket.on('boss:getList', () => {
            try {
                const bosses = BossManager.getAllBosses();
                socket.emit('boss:list', bosses);
            } catch (error) {
                console.error("Error getting boss list:", error);
                socket.emit('battleError', { message: 'Failed to get boss list.' });
            }
        });

        socket.on('boss:startBattle', (data) => {
            try {
                const { bossId, difficulty, player } = data;
                if (!bossId || !difficulty || !player) {
                    return socket.emit('battleError', { message: 'Invalid request for boss battle.' });
                }

                PlayerManager.addPlayer(socket.id, player);
                const playerForBattle = PlayerManager.getPlayer(socket.id);

                if (!playerForBattle) {
                    return socket.emit('battleError', { message: 'Player data not found for battle.' });
                }

                const boss = BossManager.createBossForBattle(bossId, difficulty);
                if (!boss) {
                    return socket.emit('battleError', { message: 'Boss not found.' });
                }

                const roomId = `BOSS_${socket.id.substring(0, 5)}_${Date.now()}`;
                const battle = BattleManager.createBattle(roomId, playerForBattle, boss, true); // isBossBattle = true

                if (!battle) {
                    return socket.emit('battleError', { message: 'Failed to create boss battle.' });
                }

                socket.join(roomId);
                socket.emit('battleCreated', { roomId });
            } catch (error) {
                console.error("Error starting boss battle:", error);
                socket.emit('battleError', { message: 'An unexpected error occurred while starting the boss battle.' });
            }
        });

        // マルチプレイヤーレイドバトル用の参加ハンドラ
        socket.on('battle:join', ({ roomId }) => {
            const player = PlayerManager.getPlayer(socket.id);
            if (!player || !roomId) {
                return socket.emit('battleError', { message: 'Invalid join request.' });
            }

            const battle = BattleManager.getBattle(roomId);
            if (!battle) {
                return socket.emit('battleError', { message: 'Battle room not found.' });
            }

            // プレイヤーがこのバトルに参加しているか確認
            if (!battle.players[player.id]) {
                return socket.emit('battleError', { message: 'You are not part of this battle.' });
            }
            
            BattleManager.remapPlayerSocket(roomId, player.id, socket.id);
            socket.join(roomId);

            console.log(`[Battle] Player ${player.name} (${player.id}) joined battle room ${roomId}`);

            // battle.players の中から自分以外の参加者を割り出す。
            // ※以前は存在しない battle.enemy を参照しており、ここで例外が発生して
            //   battle:initialState が一切送られず「読み込み中」のまま止まっていた
            //  （1対1のフレンド対戦を含む、battle:join を使う全ての対戦で発生していた）。
            // ボス戦なら isBoss:true のエントリが敵、それ以外は味方（レイドパーティメンバー）。
            // 1対1のPvPなら、残る1人がそのまま敵になる。
            const others = Object.values(battle.players).filter(p => p.id !== player.id);
            const bossEntry = others.find(p => p.isBoss);
            const enemy = bossEntry || others[0] || null;
            const allies = others.filter(p => p !== enemy);

            const initialState = {
                me: battle.players[player.id],
                enemy: enemy,
                allies: allies,
                // このバトルの現在の問題を使う（未生成なら生成する）
                question: battle.currentQuestion || BattleEngine.generateQuestion(battle)
            };

            console.log('[Battle] Sending battle:initialState with question:', initialState.question);
            socket.emit('battle:initialState', initialState);
        });
    });

};