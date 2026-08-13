// server/managers/PartyManager.js

const parties = new Map();
const playerToParty = new Map();
const MAX_PARTY_SIZE = 4;

function createParty(hostId, hostSocketId, hostPlayer) {
    const partyId = `party_${Date.now()}`;
    const party = {
        id: partyId,
        hostId: hostId,
        members: [{ id: hostId, socketId: hostSocketId, player: hostPlayer, isReady: false }],
        status: 'waiting',
        targetBoss: null,
        difficulty: null,
    };
    parties.set(partyId, party);
    playerToParty.set(hostId, partyId);
    return party;
}

function joinParty(partyId, playerId, playerSocketId, player) {
    const party = parties.get(partyId);
    if (!party) {
        return { error: 'Party not found.' };
    }
    if (party.members.length >= MAX_PARTY_SIZE) {
        return { error: 'Party is full.' };
    }
    if (party.members.some(member => member.id === playerId)) {
        // If player is already in party, just update their socketId
        const member = party.members.find(m => m.id === playerId);
        member.socketId = playerSocketId;
        console.log(`[PartyManager] Player ${playerId} re-joined party ${partyId} with new socket ${playerSocketId}`);
        return { party };
    }

    party.members.push({ id: playerId, socketId: playerSocketId, player: player, isReady: false });
    playerToParty.set(playerId, partyId);
    return { party };
}

function leaveParty(playerId) {
    const partyId = playerToParty.get(playerId);
    if (!partyId) {
        return { error: 'You are not in a party.' };
    }

    const party = parties.get(partyId);
    if (!party) {
        // This case should ideally not happen if data is consistent
        playerToParty.delete(playerId);
        return { error: 'Party not found, but your status was cleared.' };
    }

    party.members = party.members.filter(member => member.id !== playerId);
    playerToParty.delete(playerId);

    // If the party is empty, delete it
    if (party.members.length === 0) {
        parties.delete(partyId);
        return { partyDeleted: true };
    }

    // If the host left, assign a new host
    if (party.hostId === playerId) {
        party.hostId = party.members[0].id;
    }

    return { party };
}

function getPartyByPlayerId(playerId) {
    const partyId = playerToParty.get(playerId);
    return parties.get(partyId);
}

function setPlayerReady(playerId, isReady) {
    const party = getPartyByPlayerId(playerId);
    if (!party) return null;

    const member = party.members.find(m => m.id === playerId);
    if (member) {
        member.isReady = isReady;
    }
    return party;
}

function setBossSelection(playerId, bossId, difficulty) {
    const party = getPartyByPlayerId(playerId);
    if (!party || party.hostId !== playerId) {
        return null; // Only host can set the boss
    }
    party.targetBoss = bossId;
    party.difficulty = difficulty;
    return party;
}

function getParty(partyId) {
    return parties.get(partyId);
}

module.exports = {
    createParty,
    joinParty,
    leaveParty,
    getPartyByPlayerId,
    setPlayerReady,
    setBossSelection,
    getParty,
};
