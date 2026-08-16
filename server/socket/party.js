// server/socket/party.js

const BossManager = require('../managers/BossManager');
const PartyManager = require('../managers/PartyManager');
const PlayerManager = require('../managers/PlayerManager');
const BattleManager = require('../managers/BattleManager');

module.exports = function(io) {
    io.on('connection', (socket) => {

        // Party creation
        socket.on('party:create', (player) => {
            console.log(`[Party Server] party:create received from socket ${socket.id} with player:`, player);
            if (!player) {
                return socket.emit('party:error', { message: 'Player not found on server. Please create a character first.' });
            }
            PlayerManager.addPlayer(socket.id, player);

            // Ensure player is not already in a party
            if (PartyManager.getPartyByPlayerId(player.id)) {
                return socket.emit('party:error', { message: 'You are already in a party.' });
            }

            const party = PartyManager.createParty(player.id, socket.id, player);
            socket.join(party.id);
            socket.emit('party:update', party); // Emit to the creator first
            console.log(`[Party] Player ${player.id} created party ${party.id}`);
        });

        socket.on('party:join', ({ partyId, player }) => {
            console.log(`[Party Server] party:join received from socket ${socket.id} for party ${partyId} with player:`, player);
            if (!player) {
                return socket.emit('party:error', { message: 'Player not found on server.' });
            }
            PlayerManager.addPlayer(socket.id, player);

            const result = PartyManager.joinParty(partyId, player.id, socket.id, player);
            if (result.error) {
                return socket.emit('party:error', { message: result.error });
            }
            const party = result.party;
            socket.join(party.id);
            io.to(party.id).emit('party:update', party);
            console.log(`[Party] Player ${player.name} joined party: ${partyId}`);
        });

        socket.on('party:leave', () => {
            const player = PlayerManager.getPlayer(socket.id);
            if (!player) return;

            const partyBeforeLeave = PartyManager.getPartyByPlayerId(player.id);
            const partyId = partyBeforeLeave ? partyBeforeLeave.id : null;

            const result = PartyManager.leaveParty(player.id);

            if (result.error) {
                return socket.emit('party:error', { message: result.error });
            }

            if (partyId) {
                socket.leave(partyId);
                if (result.partyDeleted) {
                    console.log(`[Party] Party ${partyId} disbanded.`);
                } else {
                    console.log(`[Party] Player ${player.name} left party ${partyId}`);
                    io.to(partyId).emit('party:update', result.party);
                }
            }

            // Notify the leaving player to reset their UI
            socket.emit('party:update', null);
        });

        socket.on('party:setReady', ({ isReady }) => {
            const player = PlayerManager.getPlayer(socket.id);
            if (!player) return;

            const party = PartyManager.setPlayerReady(player.id, isReady);
            if (party) {
                io.to(party.id).emit('party:update', party);
            }
        });

        socket.on('party:startBossBattle', ({ bossId, difficulty }) => {
            const player = PlayerManager.getPlayer(socket.id);
            if (!player) {
                return socket.emit('party:error', { message: 'Player not found.' });
            }

            const party = PartyManager.getPartyByPlayerId(player.id);
            if (!party || party.hostId !== player.id) {
                return socket.emit('party:error', { message: 'Only the party host can start the battle.' });
            }

            // if (!party.members.every(m => m.isReady)) {
            //     return socket.emit('party:error', { message: 'Not all players are ready.' });
            // }

            const boss = BossManager.createBossForBattle(bossId, difficulty);
            if (!boss) {
                return socket.emit('party:error', { message: 'Invalid boss selection.' });
            }

            // パーティメンバー全員分の最新プレイヤーデータを集め、実際にバトルを作成する。
            // ※以前はここでバトルを作成しておらず、roomIdも生成・送信されていなかったため、
            //   クライアント側は battle:join のしようがなく「読み込み中」のまま止まっていた。
            const battlePlayers = party.members
                .map(member => PlayerManager.getPlayer(member.socketId) || member.player)
                .filter(p => p && p.id);

            if (battlePlayers.length === 0) {
                return socket.emit('party:error', { message: 'パーティメンバーの情報が見つかりません。' });
            }

            const roomId = `RAID_${party.id}_${Date.now()}`;
            const battle = BattleManager.createRaidBattle(roomId, battlePlayers, boss);
            if (!battle) {
                return socket.emit('party:error', { message: 'レイドバトルの作成に失敗しました。' });
            }

            // Emit bossBattle:start to all party members, including the party data and roomId
            party.members.forEach(member => {
                const memberSocket = io.sockets.sockets.get(member.socketId);
                if (memberSocket) {
                    memberSocket.join(roomId);
                    memberSocket.emit('bossBattle:start', {
                        boss: boss,
                        party: party, // Send party data so client can set isBotBattle correctly
                        roomId: roomId
                    });
                    console.log(`[Party] Emitted bossBattle:start to member ${member.id} in party ${party.id}`);
                }
            });

            console.log(`[Party] Boss battle started for party ${party.id} against ${boss.name} (room: ${roomId})`);
        });
    });
};
