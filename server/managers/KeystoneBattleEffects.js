// Server-authoritative combat effects for passive-tree keystones.
// Only explicitly whitelisted node IDs are accepted.
const BRANCHES = {
  bone: 'minion', wraith: 'minion', beast: 'minion',
  storm: 'lightning', spark: 'lightning', chain: 'lightning',
  dodge: 'mirror', reflect: 'mirror', shadow: 'mirror',
  pact: 'blood', sacrifice: 'blood', frenzy: 'blood'
};
const KEYSTONE_ID = /^ks_(minion|lightning|mirror|blood)_([a-z]+)_([1-4])$/;
const ANCHORS = {
  bone: 'atk_mastery', wraith: 'magic_mastery', beast: 'tank_mastery',
  storm: 'speed_mastery', spark: 'special_mastery', chain: 'crit_mastery',
  dodge: 'speed_path_5', reflect: 'immortal_guard', shadow: 'tank_path_5',
  pact: 'vampire', sacrifice: 'hp_mastery', frenzy: 'crit_apex'
};
const KEYSTONE_DEPTHS = [12, 24, 36, 48];
function hasCompleteKeystonePath(unlockedSet, mechanic, branch, tier) {
  const anchor = ANCHORS[branch];
  const endDepth = KEYSTONE_DEPTHS[tier - 1];
  if (!anchor || !unlockedSet.has(anchor)) return false;
  for (let depth = 1; depth <= endDepth; depth++) {
    const keyIndex = KEYSTONE_DEPTHS.indexOf(depth);
    const requiredId = keyIndex >= 0
      ? `ks_${mechanic}_${branch}_${keyIndex + 1}`
      : `poe_${branch}_${depth}_1`;
    if (!unlockedSet.has(requiredId)) return false;
  }
  return true;
}
function getKeystoneTiers(player) {
  const tiers = { minion: 0, lightning: 0, mirror: 0, blood: 0 };
  const unlocked = player?.skillTree?.unlockedNodes;
  if (!Array.isArray(unlocked)) return tiers;
  const unlockedSet = new Set(unlocked.filter(id => typeof id === 'string'));
  for (const id of unlockedSet) {
    const match = KEYSTONE_ID.exec(id);
    if (!match || BRANCHES[match[2]] !== match[1]) continue;
    const tier = Number(match[3]);
    if (!hasCompleteKeystonePath(unlockedSet, match[1], match[2], tier)) continue;
    tiers[match[1]] = Math.max(tiers[match[1]], tier);
  }
  return tiers;
}
function ensureState(player) {
  if (!player.keystoneState || typeof player.keystoneState !== 'object') {
    player.keystoneState = { normalAttackCount: 0, minionCount: 0, mirrorReady: false };
  }
  return player.keystoneState;
}
function prepareAttack(player, command, result = {}) {
  if (command !== 'attack') return { damageMultiplier: 1 };
  const tier = getKeystoneTiers(player).blood;
  if (!tier) return { damageMultiplier: 1 };
  const hpCostRate = [0, 0.03, 0.04, 0.05, 0.06][tier];
  const hpCost = Math.max(1, Math.ceil((Number(player.maxHp) || 1) * hpCostRate));
  if ((Number(player.hp) || 0) <= hpCost + 1) return { damageMultiplier: 1, bloodPactFailed: true };
  player.hp -= hpCost;
  result.keystoneBloodCost = hpCost;
  result.playerHp = player.hp;
  return { damageMultiplier: [1, 1.25, 1.35, 1.45, 1.6][tier] };
}
function onSuccessfulHit(attacker, defender, baseDamage, command, result = {}) {
  if (command !== 'attack' || !attacker || !defender || defender.hp <= 0) return 0;
  const tiers = getKeystoneTiers(attacker);
  const state = ensureState(attacker);
  let extra = 0;
  if (tiers.minion) {
    state.normalAttackCount = (state.normalAttackCount || 0) + 1;
    if (state.normalAttackCount % 3 === 0 && (state.minionCount || 0) < tiers.minion) {
      state.minionCount = (state.minionCount || 0) + 1;
      result.keystoneMinionSummoned = state.minionCount;
    }
    const perMinion = Math.max(1, Math.floor((Number(attacker.atk) || 0) * (0.08 + tiers.minion * 0.025)));
    extra += perMinion * Math.min(state.minionCount || 0, tiers.minion);
    if (state.minionCount) result.keystoneMinionCount = state.minionCount;
  }
  if (tiers.lightning) {
    state.lightningCount = (state.lightningCount || 0) + 1;
    if (state.lightningCount % 4 === 0) {
      const lightningDamage = Math.max(1, Math.floor((Number(attacker.atk) || 0) * (0.15 + tiers.lightning * 0.05)));
      extra += lightningDamage;
      result.keystoneLightning = lightningDamage;
    }
  }
  if (tiers.mirror && state.mirrorReady) {
    const mirrorDamage = Math.max(1, Math.floor((Number(attacker.atk) || 0) * (0.2 + tiers.mirror * 0.08)));
    extra += mirrorDamage;
    state.mirrorReady = false;
    result.keystoneMirrorStrike = mirrorDamage;
  }
  if (extra > 0) {
    const applied = Math.min(Math.max(0, defender.hp), extra);
    defender.hp = Math.max(0, defender.hp - applied);
    result.keystoneExtraDamage = applied;
    result.enemyHp = defender.hp;
    if (defender.isBoss) result.bossHp = defender.hp;
  }
  return extra;
}
function onDodge(player, result = {}) {
  if (!getKeystoneTiers(player).mirror) return false;
  const state = ensureState(player);
  state.mirrorReady = true;
  result.keystoneMirrorReady = true;
  return true;
}
module.exports = { getKeystoneTiers, prepareAttack, onSuccessfulHit, onDodge };
