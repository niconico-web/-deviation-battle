const assert = require('assert');
const K = require('./KeystoneBattleEffects');

const branchAnchor = {
  bone: 'atk_mastery', wraith: 'magic_mastery', beast: 'tank_mastery',
  storm: 'speed_mastery', spark: 'special_mastery', chain: 'crit_mastery',
  dodge: 'speed_path_5', reflect: 'immortal_guard', shadow: 'tank_path_5',
  pact: 'vampire', sacrifice: 'hp_mastery', frenzy: 'crit_apex'
};
const mechanicFor = {
  bone: 'minion', wraith: 'minion', beast: 'minion',
  storm: 'lightning', spark: 'lightning', chain: 'lightning',
  dodge: 'mirror', reflect: 'mirror', shadow: 'mirror',
  pact: 'blood', sacrifice: 'blood', frenzy: 'blood'
};
function path(branch, tier) {
  const mechanic = mechanicFor[branch];
  const depths = [12, 24, 36, 48];
  const end = depths[tier - 1];
  const nodes = [branchAnchor[branch]];
  for (let depth = 1; depth <= end; depth++) {
    const keyTier = depths.indexOf(depth);
    nodes.push(keyTier >= 0 ? `ks_${mechanic}_${branch}_${keyTier + 1}` : `poe_${branch}_${depth}_1`);
  }
  return nodes;
}
function player(nodes, overrides = {}) {
  return { atk: 100, hp: 1000, maxHp: 1000, skillTree: { unlockedNodes: nodes }, ...overrides };
}

// Minion contract: summon one minion on every third successful normal attack.
{
  const attacker = player(path('bone', 1));
  const defender = { hp: 5000 };
  const r1 = {}, r2 = {}, r3 = {};
  K.onSuccessfulHit(attacker, defender, 20, 'attack', r1);
  K.onSuccessfulHit(attacker, defender, 20, 'attack', r2);
  assert.strictEqual(attacker.keystoneState.minionCount || 0, 0);
  K.onSuccessfulHit(attacker, defender, 20, 'attack', r3);
  assert.strictEqual(r3.keystoneMinionSummoned, 1);
  assert.strictEqual(r3.keystoneMinionCount, 1);
  assert.ok(r3.keystoneExtraDamage > 0);
}

// Lightning contract: bonus discharge every fourth normal hit.
{
  const attacker = player(path('storm', 1));
  const defender = { hp: 5000 };
  const results = [{}, {}, {}, {}];
  for (const result of results) K.onSuccessfulHit(attacker, defender, 20, 'attack', result);
  assert.strictEqual(results[2].keystoneLightning, undefined);
  assert.ok(results[3].keystoneLightning > 0);
}

// Mirror contract: a successful dodge prepares one empowered next attack.
{
  const defender = player(path('dodge', 2));
  const attacker = { hp: 5000 };
  const dodgeResult = {};
  assert.strictEqual(K.onDodge(defender, dodgeResult), true);
  assert.strictEqual(dodgeResult.keystoneMirrorReady, true);
  const hitResult = {};
  K.onSuccessfulHit(defender, attacker, 20, 'attack', hitResult);
  assert.ok(hitResult.keystoneMirrorStrike > 0);
  assert.strictEqual(defender.keystoneState.mirrorReady, false);
}

// Blood pact: normal attack spends HP and increases damage; non-normal commands do not.
{
  const attacker = player(path('pact', 1));
  const result = {};
  const prepared = K.prepareAttack(attacker, 'attack', result);
  assert.strictEqual(result.keystoneBloodCost, 30);
  assert.strictEqual(attacker.hp, 970);
  assert.strictEqual(prepared.damageMultiplier, 1.25);
  const before = attacker.hp;
  K.prepareAttack(attacker, 'special', {});
  assert.strictEqual(attacker.hp, before);
}

// A keystone cannot activate without the complete path to it.
{
  const attacker = player(['ks_minion_bone_1']);
  assert.strictEqual(K.getKeystoneTiers(attacker).minion, 0);
}
// Reject unknown branch IDs even if they mimic the keystone naming pattern.
{
  const attacker = player(['ks_minion_admin_4']);
  assert.strictEqual(K.getKeystoneTiers(attacker).minion, 0);
}

console.log('KeystoneBattleEffects tests passed');

// Integration: the actual online PvP command path applies keystone mechanics.
{
  const BattleEngine = require('./BattleEngine');
  const minionPlayer = player(path('bone', 1), {
    id: 'minion-player', name: 'Minion Player', grade: 1,
    readyForCommand: true, ultimateGauge: { current: 0, max: 100 }
  });
  const opponent = {
    id: 'opponent', name: 'Opponent', grade: 1,
    atk: 30, def: 0, speed: 10, hp: 10000, maxHp: 10000,
    readyForCommand: false, ultimateGauge: { current: 0, max: 100 }
  };
  const battle = { players: { [minionPlayer.id]: minionPlayer, [opponent.id]: opponent }, finished: false, isBossBattle: false };
  let thirdResult;
  for (let i = 0; i < 3; i++) {
    minionPlayer.readyForCommand = true;
    thirdResult = BattleEngine.processPvpCommand(battle, minionPlayer.id, 'attack');
    assert.ok(!thirdResult.error);
  }
  assert.strictEqual(thirdResult.keystoneMinionSummoned, 1);
  assert.ok(thirdResult.keystoneExtraDamage > 0);
}

{
  const BattleEngine = require('./BattleEngine');
  const bloodPlayer = player(path('pact', 1), {
    id: 'blood-player', name: 'Blood Player', grade: 1,
    readyForCommand: true, ultimateGauge: { current: 0, max: 100 }
  });
  const opponent = {
    id: 'opponent-2', name: 'Opponent 2', grade: 1,
    atk: 30, def: 0, speed: 10, hp: 10000, maxHp: 10000,
    readyForCommand: false, ultimateGauge: { current: 0, max: 100 }
  };
  const battle = { players: { [bloodPlayer.id]: bloodPlayer, [opponent.id]: opponent }, finished: false, isBossBattle: false };
  const result = BattleEngine.processPvpCommand(battle, bloodPlayer.id, 'attack');
  assert.strictEqual(result.keystoneBloodCost, 30);
  assert.strictEqual(bloodPlayer.hp, 970);
}
