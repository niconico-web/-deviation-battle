// Party System for Boss Battles
// Allows up to 4 players to form a party and fight bosses together

const MAX_PARTY_SIZE = 4;

// Party data structure
function createPartyData(hostPlayerId) {
    return {
        id: `party_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        hostId: hostPlayerId,
        members: [hostPlayerId],
        createdAt: Date.now(),
        status: 'waiting', // waiting, ready, in_battle
        targetBoss: null,
        difficulty: null
    };
}

// Check if party is full
function isPartyFull(party) {
    return party.members.length >= MAX_PARTY_SIZE;
}

// Add member to party
function addMemberToParty(party, playerId) {
    if (isPartyFull(party)) return false;
    if (party.members.includes(playerId)) return false;
    party.members.push(playerId);
    return true;
}

// Remove member from party
function removeMemberFromParty(party, playerId) {
    const index = party.members.indexOf(playerId);
    if (index > -1) {
        party.members.splice(index, 1);
        // If host leaves, transfer host to next member
        if (party.hostId === playerId && party.members.length > 0) {
            party.hostId = party.members[0];
        }
        return true;
    }
    return false;
}

// Get party member count
function getPartyMemberCount(party) {
    return party.members.length;
}

// Calculate party power (sum of all members' total stats)
function calculatePartyPower(players) {
    let totalPower = 0;
    players.forEach(player => {
        const stats = player.stats || {};
        const totalStats = (stats.maxHp || 0) + (stats.atk || 0) + (stats.def || 0) + (stats.speed || 0);
        totalPower += totalStats;
    });
    return totalPower;
}

// Adjust boss difficulty based on party size
function adjustBossDifficultyForParty(baseStats, partySize) {
    const multiplier = 1 + (partySize - 1) * 0.25; // 25% increase per additional member
    return {
        hp: Math.floor(baseStats.hp * multiplier),
        atk: Math.floor(baseStats.atk * multiplier),
        def: Math.floor(baseStats.def * multiplier),
        speed: Math.floor(baseStats.speed * multiplier)
    };
}

// Distribute rewards among party members
function distributeRewards(reward, partySize) {
    // For weapons: randomly give to one party member
    // For skills: give to all party members
    // For XP/coins: distribute equally
    return {
        weapon: reward.weapon ? (Math.random() < (1 / partySize)) : null,
        skill: reward.skill, // All members get skills
        xp: Math.floor(reward.xp / partySize),
        coins: Math.floor(reward.coins / partySize)
    };
}

// Party matchmaking data
let partyMatchmakingData = {
    activeParties: new Map(),
    playerToParty: new Map()
};

// Player party management
function joinParty(playerId, partyId) {
    const party = partyMatchmakingData.activeParties.get(partyId);
    if (!party) return { success: false, message: "Party not found" };
    
    if (isPartyFull(party)) return { success: false, message: "Party is full" };
    
    const added = addMemberToParty(party, playerId);
    if (!added) return { success: false, message: "Already in party" };
    
    partyMatchmakingData.playerToParty.set(playerId, partyId);
    return { success: true, party };
}

function leaveParty(playerId) {
    const partyId = partyMatchmakingData.playerToParty.get(playerId);
    if (!partyId) return { success: false, message: "Not in a party" };
    
    const party = partyMatchmakingData.activeParties.get(partyId);
    if (!party) return { success: false, message: "Party not found" };
    
    removeMemberFromParty(party, playerId);
    partyMatchmakingData.playerToParty.delete(playerId);
    
    // If party is empty, remove it
    if (party.members.length === 0) {
        partyMatchmakingData.activeParties.delete(partyId);
    }
    
    return { success: true };
}

function createNewParty(hostPlayerId) {
    const party = createPartyData(hostPlayerId);
    partyMatchmakingData.activeParties.set(party.id, party);
    partyMatchmakingData.playerToParty.set(hostPlayerId, party.id);
    return { success: true, party };
}

function getPlayerParty(playerId) {
    const partyId = partyMatchmakingData.playerToParty.get(playerId);
    if (!partyId) return null;
    return partyMatchmakingData.activeParties.get(partyId);
}

// Party ready status
function setPartyReady(partyId, isReady) {
    const party = partyMatchmakingData.activeParties.get(partyId);
    if (!party) return { success: false };
    
    party.status = isReady ? 'ready' : 'waiting';
    return { success: true, party };
}

// Check if all party members are ready
function isPartyReady(partyId) {
    const party = partyMatchmakingData.activeParties.get(partyId);
    if (!party) return false;
    return party.status === 'ready';
}