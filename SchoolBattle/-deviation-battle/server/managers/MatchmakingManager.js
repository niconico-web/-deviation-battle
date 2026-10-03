// Matchmaking Manager for random matching
const matchmakingQueue = [];

function addToQueue(player) {
    console.log(`[Matchmaking] Adding player to queue: ${player.id}, socket: ${player.socketId}`);
    console.log(`[Matchmaking] Current queue size: ${matchmakingQueue.length}`);

    // If the player or socket is already present, refresh the entry instead of duplicating
    const existingIndexById = matchmakingQueue.findIndex(entry => entry.id === player.id);
    const existingIndexBySocket = matchmakingQueue.findIndex(entry => entry.socketId === player.socketId);
    const existingIndex = existingIndexById !== -1 ? existingIndexById : existingIndexBySocket;

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
        return tryMatch(matchmakingQueue[existingIndex]);
    }

    const entry = {
        id: player.id,
        socketId: player.socketId,
        player: player,
        timestamp: Date.now()
    };

    matchmakingQueue.push(entry);

    console.log(`[Matchmaking] Player added. Queue size: ${matchmakingQueue.length}`);

    return tryMatch(entry);
}

function removeFromQueue(identifier) {
    // Accept either player id or socketId or full entry
    const index = matchmakingQueue.findIndex(p => {
        if (!identifier) return false;
        if (typeof identifier === 'object') {
            if (identifier.id && p.id === identifier.id) return true;
            if (identifier.socketId && p.socketId === identifier.socketId) return true;
            return false;
        }
        // string or number
        return p.id === identifier || p.socketId === identifier;
    });

    if (index !== -1) {
        matchmakingQueue.splice(index, 1);
        return true;
    }
    return false;
}

function tryMatch(entry) {
    try {
        console.log(`[Matchmaking] Trying to find match for player: ${entry.id}`);
        console.log(`[Matchmaking] Queue length: ${matchmakingQueue.length}`);
        console.log(`[Matchmaking] Current queue:`, matchmakingQueue.map(p => ({ id: p.id, socketId: p.socketId })));
        
        if (matchmakingQueue.length >= 2) {
            // 自分自身以外のプレイヤーを探す
            const matchIndex = matchmakingQueue.findIndex(p => p.socketId !== entry.socketId && p.id !== entry.id);
            console.log(`[Matchmaking] Found potential match at index: ${matchIndex}`);
            
            if (matchIndex !== -1) {
                const matchedPlayer = matchmakingQueue[matchIndex];
                console.log(`[Matchmaking] Matched with: ${matchedPlayer.id} (socket ${matchedPlayer.socketId})`);
                
                // マッチした2人をキューから削除する
                // インデックスがずれないように、大きい方のインデックスから先に削除する
                const myIndex = matchmakingQueue.findIndex(p => p.socketId === entry.socketId && p.id === entry.id);
                const indices = [matchIndex, myIndex];
                const uniqueIndices = Array.from(new Set(indices)).sort((a,b) => b - a);

                for (const i of uniqueIndices) {
                    if (i !== -1) matchmakingQueue.splice(i, 1);
                }
                
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
    } catch (err) {
        console.error('[Matchmaking] Error in tryMatch:', err);
        return { success: false, message: '内部エラー' };
    }
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
