// ============================================
// School Battle
// MagicSkillManager.js
// Manages magic skills with status debuff effects
// ============================================

// Magic Skills with debuff effects
const MAGIC_SKILLS = [
    {
        id: "fire",
        name: "ファイア",
        description: "ダメージを与え、相手の攻撃力を3ターン低下させる",
        gaugeConsume: 20,
        baseDamage: (sp) => Math.floor(sp * 1.2),
        effect: (target) => {
            target.debuffs = target.debuffs || [];
            target.debuffs.push({
                type: "atk",
                reduction: 0.2,
                remainingTurns: 3,
                stat: "atk"
            });
        }
    },
    {
        id: "ice",
        name: "アイス",
        description: "ダメージを与え、相手の防御力を3ターン低下させる",
        gaugeConsume: 20,
        baseDamage: (sp) => Math.floor(sp * 1.2),
        effect: (target) => {
            target.debuffs = target.debuffs || [];
            target.debuffs.push({
                type: "def",
                reduction: 0.2,
                remainingTurns: 3,
                stat: "def"
            });
        }
    },
    {
        id: "thunder",
        name: "サンダー",
        description: "ダメージを与え、相手の素早さを3ターン低下させる",
        gaugeConsume: 20,
        baseDamage: (sp) => Math.floor(sp * 1.2),
        effect: (target) => {
            target.debuffs = target.debuffs || [];
            target.debuffs.push({
                type: "sp",
                reduction: 0.2,
                remainingTurns: 3,
                stat: "sp"
            });
        }
    },
    {
        id: "dark",
        name: "ダーク",
        description: "ダメージを与え、相手の特殊を3ターン低下させる",
        gaugeConsume: 20,
        baseDamage: (sp) => Math.floor(sp * 1.2),
        effect: (target) => {
            target.debuffs = target.debuffs || [];
            target.debuffs.push({
                type: "special",
                reduction: 0.2,
                remainingTurns: 3,
                stat: "special"
            });
        }
    },
    {
        id: "poison",
        name: "ポイズン",
        description: "ダメージを与え、相手に毎ターン最大HPの10%継続ダメージを3ターン与える",
        gaugeConsume: 20,
        baseDamage: (sp) => Math.floor(sp * 1.2),
        effect: (target) => {
            target.debuffs = target.debuffs || [];
            target.debuffs.push({
                type: "poison",
                damagePerTurn: 0.1,
                remainingTurns: 3,
                stat: "poison"
            });
        }
    }
];

// Get magic skill by ID
function getMagicSkill(skillId) {
    return MAGIC_SKILLS.find(skill => skill.id === skillId);
}

// Get all magic skills
function getAllMagicSkills() {
    return MAGIC_SKILLS;
}

// Apply debuff effects to target
function applyMagicDebuff(target, debuff) {
    if (!target.debuffs) {
        target.debuffs = [];
    }
    target.debuffs.push(debuff);
}

// Reduce debuff remaining turns
function reduceDebuffTurns(player) {
    if (!player.debuffs || player.debuffs.length === 0) {
        return;
    }

    player.debuffs = player.debuffs.map(debuff => ({
        ...debuff,
        remainingTurns: debuff.remainingTurns - 1
    })).filter(debuff => debuff.remainingTurns > 0);
}

// Calculate actual stat value considering debuffs
function getActualStat(player, stat) {
    let value = player[stat] || 0;

    if (!player.debuffs) {
        return value;
    }

    const relevantDebuffs = player.debuffs.filter(d => d.stat === stat);
    
    relevantDebuffs.forEach(debuff => {
        if (debuff.type !== "poison") {
            value = Math.floor(value * (1 - debuff.reduction));
        }
    });

    return value;
}

// Apply poison damage
function applyPoisonDamage(player) {
    if (!player.debuffs) {
        return 0;
    }

    let totalDamage = 0;
    const poisonDebuffs = player.debuffs.filter(d => d.type === "poison");

    poisonDebuffs.forEach(debuff => {
        const damage = Math.floor(player.maxHp * debuff.damagePerTurn);
        totalDamage += damage;
    });

    player.hp = Math.max(0, player.hp - totalDamage);
    return totalDamage;
}

module.exports = {
    MAGIC_SKILLS,
    getMagicSkill,
    getAllMagicSkills,
    applyMagicDebuff,
    reduceDebuffTurns,
    getActualStat,
    applyPoisonDamage
};
