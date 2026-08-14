const test = require('node:test');
const assert = require('node:assert/strict');
const MatchmakingManager = require('./MatchmakingManager');

test('replaces an existing queued entry when the same player reconnects', () => {
  MatchmakingManager.removeFromQueue('player-1');
  MatchmakingManager.removeFromQueue('player-2');

  const firstResult = MatchmakingManager.addToQueue({
    id: 'player-1',
    socketId: 'socket-1',
    player: { id: 'player-1' }
  });

  assert.equal(firstResult.matched, false);

  const secondResult = MatchmakingManager.addToQueue({
    id: 'player-1',
    socketId: 'socket-2',
    player: { id: 'player-1' }
  });

  assert.equal(secondResult.success, true);
  assert.equal(secondResult.matched, false);

  const queue = MatchmakingManager.getQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].socketId, 'socket-2');
});

test('matches a reconnecting player with a new queued opponent', () => {
  MatchmakingManager.removeFromQueue('player-1');
  MatchmakingManager.removeFromQueue('player-2');

  MatchmakingManager.addToQueue({
    id: 'player-1',
    socketId: 'socket-1',
    player: { id: 'player-1' }
  });

  const result = MatchmakingManager.addToQueue({
    id: 'player-2',
    socketId: 'socket-2',
    player: { id: 'player-2' }
  });

  assert.equal(result.matched, true);
  assert.equal(result.opponent.id, 'player-1');
  assert.equal(MatchmakingManager.getQueueSize(), 0);
});

test('replaces a queued entry when the same player reconnects from another socket', () => {
  MatchmakingManager.removeFromQueue('shared-player');
  MatchmakingManager.removeFromQueue('socket-3');
  MatchmakingManager.removeFromQueue('socket-4');

  const firstResult = MatchmakingManager.addToQueue({
    id: 'shared-player',
    socketId: 'socket-3',
    player: { id: 'shared-player', name: 'Player A' }
  });

  const secondResult = MatchmakingManager.addToQueue({
    id: 'shared-player',
    socketId: 'socket-4',
    player: { id: 'shared-player', name: 'Player B' }
  });

  assert.equal(firstResult.matched, false);
  assert.equal(secondResult.matched, false);
  const queue = MatchmakingManager.getQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].socketId, 'socket-4');
  assert.equal(queue[0].id, 'shared-player');
});
