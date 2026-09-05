const BattleManager = require("../managers/BattleManager");
const BattleEngine = require("../managers/BattleEngine");
const BossManager = require('../managers/BossManager');
const PlayerManager = require('../managers/PlayerManager');

// ==== ボス・レイド戦：ボス自身の行動ゲージ（リアルタイム進行）====
// クライアントのローカル戦と同じ考え方：プレイヤー側は正解数で行動ゲージが進むが、
// ボス側は素早さに応じてリアルタイムに進行し、満タンになったら攻撃の予備動作
// （テレグラフ）を見せ、その間にガードできる。
const BOSS_ATB_TICK_MS = 200;
const BOSS_ATB_MAX = 100;
const BOSS_ATB_BASE_FILL_MS = 10000; // クライアントのローカル戦と同じ目安（約10秒）
const BOSS_ATB_TELEGRAPH_MS = 700;   // ガードの猶予（クライアントと合わせて0.7秒）

/**
 * ボス・レイド戦のボス側ゲージをリアルタイムに進行させるループを開始する。
 * バトルが終了する、またはボスが撃破されるまで動き続ける。
 */
function startBossAtbLoop(io, roomId) {
    const battle = BattleManager.getBattle(roomId);
    if (!battle || battle.bossAtbInterval) return; // 既に開始済みなら何もしない

    battle.bossAtbGauge = 0;
    battle.bossTelegraphActive = false;
    battle.bossGuardedBy = new Set();

    battle.bossAtbInterval = setInterval(() => {
        const currentBattle = BattleManager.getBattle(roomId);
        if (!currentBattle || currentBattle.finished) {
            clearInterval(battle.bossAtbInterval);
            return;
        }
        if (currentBattle.bossTelegraphActive) return;

        const bossId = Object.keys(currentBattle.players).find(id => currentBattle.players[id].isBoss);
        const boss = bossId ? currentBattle.players[bossId] : null;
        if (!boss || boss.hp <= 0) return;

        const alivePlayers = Object.values(currentBattle.players).filter(p => !p.isBoss && p.hp > 0);
        if (alivePlayers.length === 0) return;

        const avgSpeed = alivePlayers.reduce((sum, p) => sum + (p.speed || 1), 0) / alivePlayers.length;
        const speedFactor = BattleEngine.getATBSpeedFactor(boss.speed, avgSpeed);
        const ticksToFill = BOSS_ATB_BASE_FILL_MS / BOSS_ATB_TICK_MS;
        currentBattle.bossAtbGauge = (currentBattle.bossAtbGauge || 0) + (BOSS_ATB_MAX / ticksToFill) * speedFactor;

        if (currentBattle.bossAtbGauge >= BOSS_ATB_MAX) {
            currentBattle.bossAtbGauge = BOSS_ATB_MAX;
            triggerBossTelegraph(io, roomId);
        }
    }, BOSS_ATB_TICK_MS);
}

/**
 * ボスのゲージが満タンになった時に呼ばれる。生存者からランダムに1人を狙い、
 * 攻撃の予備動作を全員に通知したうえで、ガードの猶予時間後にダメージを解決する。
 */
function triggerBossTelegraph(io, roomId) {
    const battle = BattleManager.getBattle(roomId);
    if (!battle || battle.finished) return;

    const bossId = Object.keys(battle.players).find(id => battle.players[id].isBoss);
    const boss = bossId ? battle.players[bossId] : null;
    const alivePlayers = Object.values(battle.players).filter(p => !p.isBoss && p.hp > 0);
    if (!boss || alivePlayers.length === 0) return;

    battle.bossTelegraphActive = true;
    battle.bossGuardedBy = new Set();

    const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    battle.bossTelegraphTargetId = target.id;

    io.to(roomId).emit('battle:bossTelegraph', {
        bossName: boss.name,
        targetId: target.id,
        telegraphMs: BOSS_ATB_TELEGRAPH_MS
    });

    setTimeout(() => {
        const currentBattle = BattleManager.getBattle(roomId);
        if (!currentBattle || currentBattle.finished) return;

        const guardActivated = !!(currentBattle.bossGuardedBy && currentBattle.bossGuardedBy.has(target.id));
        const result = BattleEngine.resolveRaidBossAttack(currentBattle, target.id, guardActivated);

        if (!result.error) {
            const logs = [];
            if (result.guarded) logs.push(`${result.playerName}はガードした！ダメージ80%カット！`);
            logs.push(`${boss.name}の攻撃！${result.playerName}に${result.damage}のダメージ！`);

            const stateUpdate = {};
            Object.keys(currentBattle.players).forEach(id => {
                const p = currentBattle.players[id];
                if (p) {
                    stateUpdate[id] = {
                        hp: p.hp,
                        maxHp: p.maxHp,
                        ultimateGauge: p.ultimateGauge,
                        gaugeCount: p.gaugeCount,
                        gaugeRequired: p.gaugeRequired
                    };
                }
            });

            io.to(roomId).emit('battle:update', {
                logs,
                damageEvents: [{ targetId: target.id, dodged: false, damage: result.damage }],
                effectEvents: [],
                stateUpdate
            });

            if (result.raidDefeat) {
                io.to(roomId).emit('battle:finished', { winner: bossId, draw: false });
                if (currentBattle.bossAtbInterval) clearInterval(currentBattle.bossAtbInterval);
                BattleManager.deleteBattle(roomId);
                return;
            }
        }

        currentBattle.bossAtbGauge = 0;
        currentBattle.bossTelegraphActive = false;
        currentBattle.bossGuardedBy = new Set();
    }, BOSS_ATB_TELEGRAPH_MS);
}

module.exports = function(io){

    io.on("connection",(socket)=>{

        // ボス・レイド戦のガードボタン（テレグラフの猶予時間内に押した場合のみ有効）
        socket.on('battle:guard', ({ roomId }) => {
            const battle = BattleManager.getBattle(roomId);
            if (!battle || !battle.bossTelegraphActive) return;

            const playerId = BattleManager.findPlayerIdBySocket(battle, socket.id);
            if (!playerId) return;

            if (!battle.bossGuardedBy) battle.bossGuardedBy = new Set();
            battle.bossGuardedBy.add(playerId);
        });

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
            if (skillId && player && Array.isArray(player.skillSlots)) {
                usedSkill = player.skillSlots.find(s => s && s.id === skillId) || null;
            }

            if (!battle.isBossBattle) {
                // 通常のPvP戦：プレイヤーごとに独立した行動ゲージ・問題で処理する
                const pvpResult = BattleEngine.processPlayerAnswer(battle, playerId, answer, usedSkill);

                if (pvpResult.error) {
                    socket.emit("answerError", { message: pvpResult.error });
                    return;
                }

                const pvpLogs = [];
                if (pvpResult.isCorrect) {
                    if (pvpResult.autoStrongAttack) {
                        pvpLogs.push(`${pvpResult.playerName}が正解！行動ゲージ満タンで強攻撃発動！ダメージ${pvpResult.strongDamage || 0}`);
                    } else {
                        pvpLogs.push(`${pvpResult.playerName}が正解！追撃ダメージ${pvpResult.chipDamage || 0}（行動ゲージ ${pvpResult.gaugeCount || 0}/${pvpResult.gaugeRequired}）`);
                    }
                } else {
                    pvpLogs.push(`${pvpResult.playerName}は不正解…`);
                }
                if (pvpResult.skillUsed) {
                    pvpLogs.push(`スキル「${pvpResult.skillUsed.name}」を発動！`);
                }

                const pvpDamageEvents = [];
                if (pvpResult.chipDamage) {
                    const targetId = Object.keys(battle.players).find(id => id !== playerId);
                    pvpDamageEvents.push({ targetId, dodged: false, damage: pvpResult.chipDamage });
                }
                if (pvpResult.strongDamage) {
                    const targetId = Object.keys(battle.players).find(id => id !== playerId);
                    pvpDamageEvents.push({ targetId, dodged: false, damage: pvpResult.strongDamage });
                }

                const pvpEffectEvents = [];
                if (pvpResult.isCorrect) {
                    pvpEffectEvents.push({ type: 'correct', playerId });
                }

                const pvpStateUpdate = {};
                Object.keys(battle.players).forEach(id => {
                    const p = battle.players[id];
                    if (p) {
                        pvpStateUpdate[id] = {
                            hp: p.hp,
                            maxHp: p.maxHp,
                            ultimateGauge: p.ultimateGauge,
                            gaugeCount: p.gaugeCount,
                            gaugeRequired: p.gaugeRequired
                        };
                    }
                });

                const pvpUpdatePayload = { logs: pvpLogs, damageEvents: pvpDamageEvents, effectEvents: pvpEffectEvents, stateUpdate: pvpStateUpdate };
                if (pvpResult.autoStrongAttack) {
                    pvpUpdatePayload.autoStrongAttack = true;
                    pvpUpdatePayload.strongDamage = pvpResult.strongDamage;
                    pvpUpdatePayload.playerName = pvpResult.playerName;
                }
                if (pvpResult.gaugeFull) {
                    // 誰の行動ゲージが満タンになり、コマンド選択中なのかを全員に通知する
                    pvpUpdatePayload.gaugeFullPlayerId = playerId;
                }
                io.to(roomId).emit("battle:update", pvpUpdatePayload);

                // 次の問題は本人にだけ送る（PvPでは問題がプレイヤーごとに独立しているため、
                // 相手の問題を見せてはいけない）
                if (pvpResult.nextQuestion && player.socketId) {
                    io.to(player.socketId).emit("battle:yourQuestion", { question: pvpResult.nextQuestion });
                }

                if (pvpResult.winner) {
                    io.to(roomId).emit("battle:finished", { winner: pvpResult.winner, draw: false });
                    BattleManager.deleteBattle(roomId);
                }
                return;
            }

            // ここから下はボス・レイド戦。
            // プレイヤーごとに独立した行動ゲージ・問題で処理する（ボス自身の攻撃は
            // リアルタイムのタイマー側=startBossAtbLoopで別途処理される）
            const raidResult = BattleEngine.processRaidPlayerAnswer(battle, playerId, answer, usedSkill);

            if (raidResult.error) {
                socket.emit("answerError", { message: raidResult.error });
                return;
            }

            const raidLogs = [];
            if (raidResult.isCorrect) {
                if (raidResult.autoStrongAttack) {
                    raidLogs.push(`${raidResult.playerName}が正解！行動ゲージ満タンで強攻撃発動！ダメージ${raidResult.strongDamage || 0}`);
                } else {
                    raidLogs.push(`${raidResult.playerName}が正解！追撃ダメージ${raidResult.chipDamage || 0}（行動ゲージ ${raidResult.gaugeCount || 0}/${raidResult.gaugeRequired}）`);
                }
            } else {
                raidLogs.push(`${raidResult.playerName}は不正解…`);
            }
            if (raidResult.skillUsed) {
                raidLogs.push(`スキル「${raidResult.skillUsed.name}」を発動！`);
            }

            const raidDamageEvents = [];
            if (raidResult.chipDamage) {
                const bossId = Object.keys(battle.players).find(id => battle.players[id].isBoss);
                raidDamageEvents.push({ targetId: bossId, dodged: false, damage: raidResult.chipDamage });
            }
            if (raidResult.strongDamage) {
                const bossId = Object.keys(battle.players).find(id => battle.players[id].isBoss);
                raidDamageEvents.push({ targetId: bossId, dodged: false, damage: raidResult.strongDamage });
            }

            const raidEffectEvents = [];
            if (raidResult.isCorrect) {
                raidEffectEvents.push({ type: 'correct', playerId });
            }

            const raidStateUpdate = {};
            Object.keys(battle.players).forEach(id => {
                const p = battle.players[id];
                if (p) {
                    raidStateUpdate[id] = {
                        hp: p.hp,
                        maxHp: p.maxHp,
                        ultimateGauge: p.ultimateGauge,
                        gaugeCount: p.gaugeCount,
                        gaugeRequired: p.gaugeRequired
                    };
                }
            });

            const raidUpdatePayload = { logs: raidLogs, damageEvents: raidDamageEvents, effectEvents: raidEffectEvents, stateUpdate: raidStateUpdate };
            if (raidResult.autoStrongAttack) {
                raidUpdatePayload.autoStrongAttack = true;
                raidUpdatePayload.strongDamage = raidResult.strongDamage;
                raidUpdatePayload.playerName = raidResult.playerName;
            }
            if (raidResult.gaugeFull) {
                raidUpdatePayload.gaugeFullPlayerId = playerId;
            }
            io.to(roomId).emit("battle:update", raidUpdatePayload);

            if (raidResult.nextQuestion && player.socketId) {
                io.to(player.socketId).emit("battle:yourQuestion", { question: raidResult.nextQuestion });
            }

            if (raidResult.raidVictory) {
                io.to(roomId).emit("battle:finished", { winner: 'party', draw: false });
                BattleManager.deleteBattle(roomId);
            }
        });

        // コマンド選択後の処理
        socket.on("battle:submitCommand", (data) => {
            const { command } = data || {};

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

            if (!battle.isBossBattle) {
                // 通常のPvP戦：「行動ゲージが満タンになった本人」だけがコマンドを選べる
                if (!player.readyForCommand) {
                    socket.emit("answerError", { message: "まだ行動ゲージが満タンではありません" });
                    return;
                }

                const pvpResult = BattleEngine.processPvpCommand(battle, playerId, command);
                if (pvpResult.error) {
                    socket.emit("answerError", { message: pvpResult.error });
                    return;
                }

                const enemyId = Object.keys(battle.players).find(id => id !== playerId);

                const pvpLogs = [];
                if (pvpResult.damage) pvpLogs.push(`${pvpResult.damage}のダメージ！`);
                if (pvpResult.defended) pvpLogs.push("防御姿勢をとった！");
                if (pvpResult.ultimateActivated) pvpLogs.push("必殺技が発動！");
                if (pvpResult.selfBurnTick) pvpLogs.push(`火傷ダメージ！${player.name}に${pvpResult.selfBurnTick.damage}のダメージ（残り${pvpResult.selfBurnTick.remaining}ターン）`);
                if (pvpResult.selfPoisonTick) pvpLogs.push(`毒ダメージ！${player.name}に${pvpResult.selfPoisonTick.damage}のダメージ（残り${pvpResult.selfPoisonTick.remaining}ターン）`);
                if (pvpResult.enemyBurnTick) pvpLogs.push(`火傷ダメージ！相手に${pvpResult.enemyBurnTick.damage}のダメージ（残り${pvpResult.enemyBurnTick.remaining}ターン）`);
                if (pvpResult.enemyPoisonTick) pvpLogs.push(`毒ダメージ！相手に${pvpResult.enemyPoisonTick.damage}のダメージ（残り${pvpResult.enemyPoisonTick.remaining}ターン）`);

                const pvpDamageEvents = [];
                if (pvpResult.damage) {
                    pvpDamageEvents.push({ targetId: enemyId, dodged: !!pvpResult.dodged, damage: pvpResult.damage });
                }
                if (pvpResult.selfBurnTick) pvpDamageEvents.push({ targetId: playerId, dodged: false, damage: pvpResult.selfBurnTick.damage });
                if (pvpResult.selfPoisonTick) pvpDamageEvents.push({ targetId: playerId, dodged: false, damage: pvpResult.selfPoisonTick.damage });
                if (pvpResult.enemyBurnTick) pvpDamageEvents.push({ targetId: enemyId, dodged: false, damage: pvpResult.enemyBurnTick.damage });
                if (pvpResult.enemyPoisonTick) pvpDamageEvents.push({ targetId: enemyId, dodged: false, damage: pvpResult.enemyPoisonTick.damage });

                const pvpEffectEvents = [];
                if (pvpResult.ultimateActivated) {
                    pvpEffectEvents.push({ type: 'ultimate', playerId });
                }

                const pvpStateUpdate = {};
                Object.keys(battle.players).forEach(id => {
                    const p = battle.players[id];
                    if (p) {
                        pvpStateUpdate[id] = {
                            hp: p.hp,
                            maxHp: p.maxHp,
                            ultimateGauge: p.ultimateGauge,
                            gaugeCount: p.gaugeCount,
                            gaugeRequired: p.gaugeRequired
                        };
                    }
                });

                io.to(roomId).emit("battle:update", { logs: pvpLogs, damageEvents: pvpDamageEvents, effectEvents: pvpEffectEvents, stateUpdate: pvpStateUpdate });

                if (pvpResult.nextQuestion && player.socketId) {
                    io.to(player.socketId).emit("battle:yourQuestion", { question: pvpResult.nextQuestion });
                }

                if (pvpResult.winner) {
                    io.to(roomId).emit("battle:finished", { winner: pvpResult.winner, draw: false });
                    BattleManager.deleteBattle(roomId);
                }
                return;
            }

            if (!player.readyForCommand) {
                socket.emit("answerError", { message: "まだ行動ゲージが満タンではありません" });
                return;
            }

            // コマンドを処理してダメージを適用（ボス・レイド戦。対象は常にボス）
            const raidCmdResult = BattleEngine.processRaidPlayerCommand(battle, playerId, command);

            if (raidCmdResult.error) {
                socket.emit("answerError", { message: raidCmdResult.error });
                return;
            }

            const bossId = Object.keys(battle.players).find(id => battle.players[id].isBoss);

            const raidCmdLogs = [];
            if (raidCmdResult.damage) {
                raidCmdLogs.push(`${raidCmdResult.damage}のダメージ！`);
            }
            if (raidCmdResult.defended) {
                raidCmdLogs.push("防御姿勢をとった！");
            }
            if (raidCmdResult.ultimateActivated) {
                raidCmdLogs.push("必殺技が発動！");
            }
            if (raidCmdResult.selfBurnTick) raidCmdLogs.push(`火傷ダメージ！${player.name}に${raidCmdResult.selfBurnTick.damage}のダメージ（残り${raidCmdResult.selfBurnTick.remaining}ターン）`);
            if (raidCmdResult.selfPoisonTick) raidCmdLogs.push(`毒ダメージ！${player.name}に${raidCmdResult.selfPoisonTick.damage}のダメージ（残り${raidCmdResult.selfPoisonTick.remaining}ターン）`);
            if (raidCmdResult.bossBurnTick) raidCmdLogs.push(`火傷ダメージ！ボスに${raidCmdResult.bossBurnTick.damage}のダメージ（残り${raidCmdResult.bossBurnTick.remaining}ターン）`);
            if (raidCmdResult.bossPoisonTick) raidCmdLogs.push(`毒ダメージ！ボスに${raidCmdResult.bossPoisonTick.damage}のダメージ（残り${raidCmdResult.bossPoisonTick.remaining}ターン）`);

            const raidCmdDamageEvents = [];
            if (raidCmdResult.damage) {
                raidCmdDamageEvents.push({ targetId: bossId, dodged: !!raidCmdResult.dodged, damage: raidCmdResult.damage });
            }
            if (raidCmdResult.selfBurnTick) raidCmdDamageEvents.push({ targetId: playerId, dodged: false, damage: raidCmdResult.selfBurnTick.damage });
            if (raidCmdResult.selfPoisonTick) raidCmdDamageEvents.push({ targetId: playerId, dodged: false, damage: raidCmdResult.selfPoisonTick.damage });
            if (raidCmdResult.bossBurnTick) raidCmdDamageEvents.push({ targetId: bossId, dodged: false, damage: raidCmdResult.bossBurnTick.damage });
            if (raidCmdResult.bossPoisonTick) raidCmdDamageEvents.push({ targetId: bossId, dodged: false, damage: raidCmdResult.bossPoisonTick.damage });

            const raidCmdEffectEvents = [];
            if (raidCmdResult.ultimateActivated) {
                raidCmdEffectEvents.push({ type: 'ultimate', playerId });
            }

            const raidCmdStateUpdate = {};
            Object.keys(battle.players).forEach(id => {
                const p = battle.players[id];
                if (p) {
                    raidCmdStateUpdate[id] = {
                        hp: p.hp,
                        maxHp: p.maxHp,
                        ultimateGauge: p.ultimateGauge,
                        gaugeCount: p.gaugeCount,
                        gaugeRequired: p.gaugeRequired
                    };
                }
            });

            io.to(roomId).emit("battle:update", { logs: raidCmdLogs, damageEvents: raidCmdDamageEvents, effectEvents: raidCmdEffectEvents, stateUpdate: raidCmdStateUpdate });

            if (raidCmdResult.nextQuestion && player.socketId) {
                io.to(player.socketId).emit("battle:yourQuestion", { question: raidCmdResult.nextQuestion });
            }

            if (raidCmdResult.raidVictory) {
                io.to(roomId).emit("battle:finished", { winner: 'party', draw: false });
                BattleManager.deleteBattle(roomId);
            } else if (raidCmdResult.raidDefeat) {
                // 以前はここでraidDefeat（毒・火傷などでパーティが全滅した場合）が
                // 判定されておらず、バトルが終了扱いにならないまま残ってしまっていた。
                io.to(roomId).emit("battle:finished", { winner: bossId, draw: false, raidDefeat: true });
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
                isBossBattle: battle.isBossBattle,
                initialQuestion: initialization.initialQuestion,
                hasPlayers: !!battle.players,
                roomClients: io.sockets.adapter.rooms.get(roomId)?.size || 0,
                players: battle.players
            });

            if (battle.isBossBattle) {
                // ボス・レイド戦は今まで通り、全員に同じ問題を送信
                io.to(roomId).emit("battleStarted", {
                    initialQuestion: initialization.initialQuestion,
                    players: battle.players
                });
            } else {
                // 通常のPvP戦：問題はプレイヤーごとに独立しているため、
                // 全員に共有する battleStarted では問題を含めず、各プレイヤーには
                // 自分専用の問題を個別に送信する（相手の問題を見せないため）
                io.to(roomId).emit("battleStarted", {
                    players: battle.players
                });

                const initialQuestions = initialization.initialQuestions || {};
                Object.keys(initialQuestions).forEach(pid => {
                    const p = battle.players[pid];
                    if (p && p.socketId) {
                        io.to(p.socketId).emit("battle:yourQuestion", { question: initialQuestions[pid] });
                    }
                });
            }

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
        socket.on('battle:join', ({ roomId, playerId }) => {
            if (!playerId || !roomId) {
                return socket.emit('battleError', { message: 'Invalid join request.' });
            }

            const battle = BattleManager.getBattle(roomId);
            if (!battle) {
                return socket.emit('battleError', { message: 'Battle room not found.' });
            }

            // プレイヤーがこのバトルに参加しているか確認
            const player = battle.players[playerId];
            if (!player) {
                return socket.emit('battleError', { message: 'You are not part of this battle.' });
            }
            
            BattleManager.remapPlayerSocket(roomId, playerId, socket.id);
            socket.join(roomId);

            console.log(`[Battle] Player ${player.name} (${player.id}) joined battle room ${roomId}`);

            // battle.players の中から自分以外の参加者を割り出す。
            // ※以前は存在しない battle.enemy を参照しており、ここで例外が発生して
            //   battle:initialState が一切送られず「読み込み中」のまま止まっていた
            //  （1対1のフレンド対戦を含む、battle:join を使う全ての対戦で発生していた）。
            // ボス戦なら isBoss:true のエントリが敵、それ以外は味方（レイドパーティメンバー）。
            // 1対1のPvPなら、残る1人がそのまま敵になる。
            const others = Object.values(battle.players).filter(p => p.id !== playerId);
            const bossEntry = others.find(p => p.isBoss);
            const enemy = bossEntry || others[0] || null;
            const allies = others.filter(p => p !== enemy);

            let question;
            const joiningPlayer = battle.players[playerId];
            if (joiningPlayer.gaugeRequired === undefined) {
                joiningPlayer.gaugeCount = 0;
                joiningPlayer.gaugeRequired = BattleEngine.getRequiredCorrectCount(joiningPlayer.speed);
                joiningPlayer.readyForCommand = false;
            }
            question = joiningPlayer.currentQuestion || BattleEngine.generatePlayerQuestion(battle, playerId);

            if (bossEntry && !battle.bossAtbInterval) {
                // ボス・レイド戦：ボス自身の行動ゲージはリアルタイムに進行させる。
                // （最初に参加したプレイヤーのタイミングで一度だけ開始する）
                startBossAtbLoop(io, roomId);
            }

            const initialState = {
                me: battle.players[playerId],
                enemy: enemy,
                allies: allies,
                question
            };

            console.log('[Battle] Sending battle:initialState with question:', initialState.question);
            socket.emit('battle:initialState', initialState);
        });
    });

};