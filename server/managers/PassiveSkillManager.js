// ============================================
// School Battle
// PassiveSkillManager.js
// Manages passive skills acquired every 10 levels
// ============================================

// Passive Skills data - acquired every 10 levels
const PASSIVE_SKILLS = [
    {
        level: 10,
        name: "攻撃力上昇 Lv1",
        description: "攻撃力が10%上昇する",
        effect: (player) => {
            player.atk = Math.floor(player.atk * 1.1);
        }
    },
    {
        level: 20,
        name: "防御力上昇 Lv1",
        description: "防御力が10%上昇する",
        effect: (player) => {
            player.def = Math.floor(player.def * 1.1);
        }
    },
    {
        level: 30,
        name: "HP上昇 Lv1",
        description: "最大HPが15%上昇する",
        effect: (player) => {
            const hpIncrease = Math.floor(player.maxHp * 0.15);
            player.maxHp += hpIncrease;
            player.hp = player.maxHp;
        }
    },
    {
        level: 40,
        name: "攻撃力上昇 Lv2",
        description: "攻撃力が15%上昇する",
        effect: (player) => {
            player.atk = Math.floor(player.atk * 1.15);
        }
    },
    {
        level: 50,
        name: "防御力上昇 Lv2",
        description: "防御力が15%上昇する",
        effect: (player) => {
            player.def = Math.floor(player.def * 1.15);
        }
    },
    {
        level: 60,
        name: "素早さ上昇 Lv1",
        description: "素早さが10%上昇する",
        effect: (player) => {
            player.sp = Math.floor(player.sp * 1.1);
        }
    },
    {
        level: 70,
        name: "攻撃力上昇 Lv3",
        description: "攻撃力が20%上昇する",
        effect: (player) => {
            player.atk = Math.floor(player.atk * 1.2);
        }
    },
    {
        level: 80,
        name: "防御力上昇 Lv3",
        description: "防御力が20%上昇する",
        effect: (player) => {
            player.def = Math.floor(player.def * 1.2);
        }
    },
    {
        level: 90,
        name: "素早さ上昇 Lv2",
        description: "素早さが15%上昇する",
        effect: (player) => {
            player.sp = Math.floor(player.sp * 1.15);
        }
    },
    {
        level: 100,
        name: "全能力大幅上昇",
        description: "全ステータスが25%上昇する",
        effect: (player) => {
            player.atk = Math.floor(player.atk * 1.25);
            player.def = Math.floor(player.def * 1.25);
            player.sp = Math.floor(player.sp * 1.25);
            const hpIncrease = Math.floor(player.maxHp * 0.25);
            player.maxHp += hpIncrease;
            player.hp = player.maxHp;
        }
    }
];

// Check if player has leveled up to a milestone and apply passive skill
function applyPassiveSkillIfUnlocked(player) {
    const unlockedSkill = PASSIVE_SKILLS.find(skill => skill.level === player.level);
    
    if (unlockedSkill && (!player.passiveSkills || !player.passiveSkills.some(s => s.level === unlockedSkill.level))) {
        // Initialize passiveSkills array if it doesn't exist
        if (!player.passiveSkills) {
            player.passiveSkills = [];
        }
        
        // Add the skill to player's passive skills
        player.passiveSkills.push({
            level: unlockedSkill.level,
            name: unlockedSkill.name,
            description: unlockedSkill.description
        });
        
        // Apply the skill effect
        unlockedSkill.effect(player);
        
        return unlockedSkill;
    }
    
    return null;
}

// Get all available skills for a player
function getPlayerPassiveSkills(player) {
    return PASSIVE_SKILLS.filter(skill => skill.level <= (player.level || 0));
}

// Get next milestone skill info
function getNextMilestoneSkill(player) {
    const currentLevel = player.level || 0;
    const nextMilestone = PASSIVE_SKILLS.find(skill => skill.level > currentLevel);
    
    return nextMilestone || null;
}

module.exports = {
    PASSIVE_SKILLS,
    applyPassiveSkillIfUnlocked,
    getPlayerPassiveSkills,
    getNextMilestoneSkill
};
