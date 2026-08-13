// server/socket/party.js

const BossManager = require('../managers/BossManager');
const PartyManager = require('../managers/PartyManager');
const PlayerManager = require('../managers/PlayerManager');

module.exports = function(io) {
    io.on('connection', (socket) => {

        // Handler to get the list of all available bosses
        socket.on('bosses:get', () => {
            try {
                const bosses = BossManager.getAllBosses();
                socket.emit('bosses:list', bosses);
            } catch (error) {
                console.error('Error fetching boss list:', error);
                socket.emit('error:server', { message: 'Failed to load boss list.' });
            }
        });

        // Party creation
        socket.on('party:create', () => {
            const player = PlayerManager.getPlayer(socket.id);
            if (!player) {
                return socket.emit('party:error', { message: 'Player not found.' });
            }
            // Ensure player is not already in a party
            if (PartyManager.getPartyByPlayerId(player.id)) {
                return socket.emit('party:error', { message: 'You are already in a party.' });
            }

            const party = PartyManager.createParty(player.id, socket.id);
            socket.join(party.id);
            io.to(party.id).emit('party:update', party);
            console.log(`[Party] Player ${player.id} created party ${party.id}`);
        });

        // More party handlers (join, leave, etc.) will be added here
    });
};
