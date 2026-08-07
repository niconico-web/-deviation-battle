// Matchmaking Manager for random matching
const matchmakingQueue = [];

function addToQueue(player) {
    console.log(`[Matchmaking] Adding player to queue: ${player.id}, socket: ${player.socketId}`);
    console.log(`[Matchmaking] Current queue size: ${matchmakingQueue.length}`);

    const existingPlayerIndex = matchmakingQueue.findIndex(entry => entry.id === player.id);
    const existingSocketIndex = matchmakingQueue.findIndex(entry => entry.socketId === player.socketId);
    const existingIndex = existingPlayerIndex !== -1 ? existingPlayerIndex : existingSocketIndex;

    if (existingIndex !== -1) {
        const existingEntry = matchmakingQueue[existingIndex];
        console.log(`[Matchmaking] Existing queue entry found for ${player.id} on socket ${player.socketId}; refreshing state`);

        matchmakingQueue[existingIndex] = {
            ...existingEntry,
            id: player.id,
            socketId: player.socketId,
            player: player,
            timestamp: Date.now()
        };

        console.log(`[Matchmaking] Queue entry refreshed. Queue size: ${matchmakingQueue.length}`);
        return tryMatch(player);
    }

    matchmakingQueue.push({
        id: player.id,
        socketId: player.socketId,
        player: player,
        timestamp: Date.now()
    });

    console.log(`[Matchmaking] Player added. Queue size: ${matchmakingQueue.length}`);

    return tryMatch(player);
}

function removeFromQueue(playerId) {
    const index = matchmakingQueue.findIndex(p => p.id === playerId);
    if (index !== -1) {
        matchmakingQueue.splice(index, 1);
        return true;
    }
    return false;
}

function tryMatch(player) {
    console.log(`[Matchmaking] Trying to find match for player: ${player.id}`);
    console.log(`[Matchmaking] Queue length: ${matchmakingQueue.length}`);
    console.log(`[Matchmaking] Current queue:`, matchmakingQueue.map(p => ({ id: p.id, socketId: p.socketId })));
    
    // Find a match (first available player in queue that is NOT the current player)
    // Need to check queue length after adding current player
    if (matchmakingQueue.length >= 2) {
        const matchIndex = matchmakingQueue.findIndex(entry => entry.socketId !== player.socketId);
        console.log(`[Matchmaking] Found potential match at index: ${matchIndex}`);
        
        if (matchIndex !== -1) {
            const matchedPlayer = matchmakingQueue[matchIndex];
            console.log(`[Matchmaking] Matched with: ${matchedPlayer.id}`);
            
            // Remove both from queue
            removeFromQueue(player.id);
            removeFromQueue(matchedPlayer.id);
            
            return {
                success: true,
                matched: true,
                opponent: matchedPlayer
            };
        }
    }
    
    console.log(`[Matchmaking] No match found, player waiting in queue`);
    return {
        success: true,
        matched: false
    };
}

function getQueueSize() {
    return matchmakingQueue.length;
}

function getQueue() {
    return matchmakingQueue;
}

module.exports = {
    addToQueue,
    removeFromQueue,
    tryMatch,
    getQueueSize,
    getQueue
};
