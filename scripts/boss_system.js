// Boss Data Structure - Weapons and Skills
const bossData = {
  "Boss1": {
    "normal_weapon": "Sword of Thunder",
    "normal_ability": "Lightning Strike",
    "hard_skill": "Thunderstorm"
  },
  "Boss2": {
    "normal_weapon": "Shadow Dagger",
    "normal_ability": "Dark Veil",
    "hard_skill": "Shadow Lash"
  },
  "Boss3": {
    "normal_weapon": "Dragon Scale Mail",
    "normal_ability": "Scorching Breath",
    "hard_skill": "Dragon Roar"
  }
};

// Weapon System - Add weapon to inventory on defeat
function grantNormalWeapon(bossName) {
  const weapon = bossData[bossName].normal_weapon;
  const ability = bossData[bossName].normal_ability;
  // Add weapon to inventory and apply ability
  console.log(`Granted weapon: ${weapon} with ability: ${ability}`);
}

// Hard Mode Skill System - Learn active skill on hard mode defeat
function learnHardSkill(bossName) {
  const skill = bossData[bossName].hard_skill;
  // Add skill to skill tree
  console.log(`Learned skill: ${skill}`);
}

// Example usage:
// grantNormalWeapon("Boss1");
// learnHardSkill("Boss1");