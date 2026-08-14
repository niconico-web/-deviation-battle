// server/socket/party.js

const BossManager = require('../managers/BossManager');
const PartyManager = require('../managers/PartyManager');
const PlayerManager = require('../managers/PlayerManager');

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

            // The host starts the battle, other members are notified.
            const hostSocket = io.sockets.sockets.get(party.members.find(m => m.id === party.hostId)?.socketId);
            if (hostSocket) {
                hostSocket.emit('bossBattle:start', { boss });
            }

            // Notify other members that the battle has started.
            party.members.forEach(member => {
                if (member.id !== party.hostId) {
                    const memberSocket = io.sockets.sockets.get(member.socketId);
                    if (memberSocket) {
                        memberSocket.emit('party:notification', { message: `ホストの${player.name}がボスバトルを開始しました。観戦機能は開発中です。` });
                    }
                }
            });

            console.log(`[Party] Boss battle started for party ${party.id} against ${boss.name}`);
        });
    });
};
