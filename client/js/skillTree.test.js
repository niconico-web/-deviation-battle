const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, 'skillTree.js'), 'utf8');
const context = { console };
const testCode = `
  const ids = SKILL_TREE.nodes.map(n => n.id);
  const idSet = new Set(ids);
  globalThis.treeStats = {
    count: ids.length,
    keystones: SKILL_TREE.nodes.filter(n => n.type === 'keystone').length,
    bridges: SKILL_TREE.nodes.filter(n => n.id.startsWith('bridge_')).length,
    duplicates: ids.length - idSet.size,
    missingPrerequisites: SKILL_TREE.nodes.filter(n => {
      const req = [...(n.requires ? (Array.isArray(n.requires) ? n.requires : [n.requires]) : []), ...(n.requiresAny ? (Array.isArray(n.requiresAny) ? n.requiresAny : [n.requiresAny]) : [])];
      return req.some(id => !idSet.has(id));
    }).map(n => n.id)
  };
  const p = { skillTree: { unlockedNodes: ['atk_mastery'], availablePoints: 1000 }, skillSlots: [null, null, null] };
  for (let depth = 1; depth <= 12; depth++) {
    const id = depth === 12 ? 'ks_minion_bone_1' : 'poe_bone_' + depth + '_1';
    const result = unlockSkillNode(p, id);
    if (!result.success) throw new Error('failed to unlock ' + id + ': ' + result.error);
  }
  globalThis.keystoneEffects = getSkillNodeEffects(p).keystones;
  const layout = getSkillTreeLayout(SKILL_TREE.nodes);
  const layoutPoints = [...layout.values()];
  let minNodeDistance = Infinity;
  for (let i = 0; i < layoutPoints.length; i++) {
    for (let j = i + 1; j < layoutPoints.length; j++) {
      minNodeDistance = Math.min(minNodeDistance, Math.hypot(layoutPoints[i].x - layoutPoints[j].x, layoutPoints[i].y - layoutPoints[j].y));
    }
  }
  globalThis.layoutStats = { count: layout.size, minNodeDistance };
`;
vm.runInNewContext(source + testCode, context);
assert.strictEqual(context.treeStats.count, 2018);
assert.strictEqual(context.treeStats.keystones, 60);
assert.strictEqual(context.treeStats.bridges, 9);
assert.strictEqual(context.treeStats.duplicates, 0);
assert.strictEqual(context.treeStats.missingPrerequisites.length, 0);
assert.ok(context.keystoneEffects.some(k => k.id === 'ks_minion_bone_1'));
assert.strictEqual(context.layoutStats.count, 2018);
assert.ok(context.layoutStats.minNodeDistance >= 82, 'skill tree nodes should not overlap');
console.log('Skill tree generation and unlock tests passed');
