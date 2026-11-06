const assert = require('assert');
const BattleManager = require('./BattleManager');

const nodes = ['atk_mastery', 'poe_bone_1_2', 'ks_minion_bone_1'];
const battle = BattleManager.createBattle('keystone-test', {
  id: 'p1', name: 'Player 1', grade: 1,
  battleStats: { maxHp: 100, atk: 20, def: 10, speed: 10 },
  skillTree: { unlockedNodes: nodes }
}, {
  id: 'p2', name: 'Player 2', grade: 1,
  battleStats: { maxHp: 100, atk: 20, def: 10, speed: 10 },
  skillTree: { unlockedNodes: ['magic_mastery'] }
});
assert.ok(battle);
assert.deepStrictEqual(battle.players.p1.skillTree.unlockedNodes, nodes);
assert.deepStrictEqual(battle.players.p2.skillTree.unlockedNodes, ['magic_mastery']);
BattleManager.deleteBattle('keystone-test');
console.log('BattleManager keystone transfer tests passed');
