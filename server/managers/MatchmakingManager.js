// Matchmaking Manager for random matching
const matchmakingQueue = [];

function addToQueue(player) {
    // Check if player is already in queue
    const existingIndex = matchmakingQueue.findIndex(p => p.id === player.id);
    if (existingIndex !== -1) {
        return { success: false, message: "Already in queue" };
    }
    
    // Add to queue
    matchmakingQueue.push({
        id: player.id,
        socketId: player.socketId,
        player: player,
        timestamp: Date.now()
    });
    
    // Try to find a match
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
    // Find a match (first available player in queue)
    if (matchmakingQueue.length >= 2) {
        const matchIndex = matchmakingQueue.findIndex(p => p.id !== player.id);
        if (matchIndex !== -1) {
            const matchedPlayer = matchmakingQueue[matchIndex];
            
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
    
    return {
        success: true,
        matched: false
    };
}

function getQueueSize() {
    return matchmakingQueue.length;
}

module.exports = {
    addToQueue,
    removeFromQueue,
    tryMatch,
    getQueueSize
};
