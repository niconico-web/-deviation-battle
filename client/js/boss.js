// ボス武器の基礎倍率（討伐直後の状態）。ここから限界突破で上限を伸ばして「強化」で近づけていく。
const BOSS_WEAPON_BASE_MULTIPLIER = 2.0;
// 限界突破1回あたりの上限倍率の増加量
const BOSS_WEAPON_LIMIT_BREAK_INCREMENT = 0.5;
// 限界突破できる最大回数
const BOSS_WEAPON_MAX_LIMIT_BREAK = 4;

/**
 * ボスIDから、その武器の限界突破素材のIDを生成する。
 * @param {string} bossId
 * @returns {string}
 */
function getBossLimitBreakMaterialId(bossId) {
    return `${bossId}_limit_break_material`;
}

/**
 * 限界突破素材の表示名を生成する。
 * @param {string} bossName
 * @returns {string}
 */
function getBossLimitBreakMaterialName(bossName) {
    return `${bossName}の魂の欠片`;
}

/**
 * プレイヤーが指定したボスをモチーフにした武器を既に所持しているか判定する。
 * @param {object} player
 * @param {string} bossId
 * @returns {boolean}
 */
function playerOwnsBossWeapon(player, bossId) {
    return (player.weapons || []).some(w => w.sourceBossId === bossId);
}

/**
 * Adds a specified amount of a material to the player's inventory.
 * @param {object} player - The player object.
 * @param {string} materialId - The unique ID of the material.
 * @param {string} materialName - The display name of the material.
 * @param {number} count - The number of materials to add.
 * @returns {object} The updated player object.
 */
function addMaterialToPlayer(player, materialId, materialName, count) {
    if (!player.materials) {
        player.materials = [];
    }
    let material = player.materials.find(m => m.id === materialId);
    if (material) {
        material.count = (material.count || 0) + count;
    } else {
        player.materials.push({ id: materialId, name: materialName, count: count });
    }
    return player;
}

/**
 * Creates a custom skill from a boss's skill.
 * @param {object} bossData - The full data object for the boss.
 * @param {string} skillName - The name of the skill to get.
 * @returns {object|null} A custom skill object or null.
 */
function getBossSkillAsCustomSkill(bossData, skillName) {
    if (!bossData || !bossData.skills || !skillName) return null;

    const bossSkill = bossData.skills.find(s => s.name === skillName);
    if (!bossSkill) {
        console.error(`Skill '${skillName}' not found on boss '${bossData.name}'`);
        return null;
    }

    // The skill effect must be a valid object to function correctly.
    if (!bossSkill.effect || typeof bossSkill.effect !== 'object') {
        console.error(`Skill '${skillName}' has an invalid or missing effect object.`);
        return null;
    }

    return {
        id: `boss_skill_${bossData.id}_${Date.now()}`,
        name: `[秘技] ${bossSkill.name}`,
        description: bossSkill.description,
        effect: bossSkill.effect, // Copy the effect object directly
        strength: 'tier15', // Boss skills are powerful
        createdAt: Date.now(),
        type: 'active'
    };
}
/**
 * Applies rewards for defeating a boss.
<<<<<<< HEAD
 * ・「ノーマル(medium)」を初めて攻略：ボスをモチーフにした武器（基礎倍率2.0倍）をドロップ
 * ・「ハード(hard)」を初めて攻略：ボスのスキルを習得
 * ・武器を入手済みの状態で「ノーマル」か「ハード」を周回：限界突破素材をドロップ（何度でも）
=======
 * This function now returns the updated player object and saves rewards to sessionStorage
 * for the result screen to display.
>>>>>>> 1dd16d5105284553dd0cc792a037b077593ba0fa
 * @param {object} player - The player object.
 * @param {object} boss - The defeated boss object from the battle (drops/skillsを含む).
 * @returns {object} The updated player object.
 */
function applyBossRewards(player, boss) {
    if (!boss || !boss.id || !boss.difficulty) {
        console.error("Invalid boss data for rewards", boss);
        return player;
    }

<<<<<<< HEAD
    // 戦闘用に生成されたbossオブジェクトには drops/skills が含まれているので、まずそれを使う。
    // （古いセーブデータ等で欠けている場合のみ、簡易版のwindow.bossesにフォールバックする）
    let fullBossData = boss;
    if (!fullBossData.drops) {
        if (!window.bosses) {
            const bossesData = localStorage.getItem('bosses');
            if (bossesData) {
                window.bosses = JSON.parse(bossesData);
            }
        }
        const found = (window.bosses || []).find(b => b.id === boss.id);
        if (found && found.drops) {
            fullBossData = found;
        }
    }
    if (!fullBossData.drops) {
        console.error("Boss drop data not found for ID:", boss.id);
        return player;
    }

    const difficulty = boss.difficulty;
    // 武器を持っているかどうかは、今回の報酬を適用する「前」の状態で判定する
    // （＝武器を初めて手に入れたその周では、まだ限界突破素材は出さない）
    const alreadyOwnsWeapon = playerOwnsBossWeapon(player, boss.id);

    let newPlayer = { ...player };
    let rewardMessage = "";

    // ---- 初回討伐報酬（武器・スキル） ----
    if (!hasDefeatedBoss(player, boss.id, difficulty)) {
        fullBossData.drops.forEach(drop => {
            if (drop.difficulty.includes(difficulty)) {
                if (drop.type === 'weapon') {
                    const weapon = generateBossWeapon(fullBossData, drop.name);
                    if (weapon) {
                        newPlayer = addWeaponToPlayer(newPlayer, weapon);
                        rewardMessage += `討伐報酬として、ユニーク武器「${weapon.name}」を獲得した！\n`;
                    }
                } else if (drop.type === 'skill') {
                    const skill = getBossSkillAsCustomSkill(fullBossData, drop.name);
                    if (skill) {
                        if (!newPlayer.customSkills) newPlayer.customSkills = [];
                        newPlayer.customSkills.push(skill);
                        rewardMessage += `討伐報酬として、ボススキル「${skill.name}」を習得した！\n`;
                    }
                }
=======
    // The 'boss' object from the battle now contains all necessary data (skills, rewards).
    // We no longer need to look up data in the (potentially incomplete) window.bosses list.
    if (!boss.rewards) {
        console.log(`Boss ${boss.id} has no rewards defined in its battle data. Skipping.`);
        return player;
    }

    const difficulty = boss.difficulty;
    const bossRewardsInfo = boss.rewards;
    let newPlayer = { ...player };
    let rewardsForDisplay = {};

    // 1. Weapon Drop: On 'medium' (Normal) difficulty, if player doesn't have the weapon yet.
    // This is more robust than only checking for first clear.
    const playerDoesNotHaveWeapon = !(player.weapons || []).some(w => w.bossId === boss.id);
    if (difficulty === 'medium' && playerDoesNotHaveWeapon) {
        const weaponName = bossRewardsInfo.weaponName || `${boss.name}の武器`;
        const weapon = generateBossWeapon(boss, weaponName);
        if (weapon) {
            newPlayer = addWeaponToPlayer(newPlayer, weapon);
            rewardsForDisplay.bossWeapon = weapon;
        }
    }
    
    // 2. Skill Drop: On 'hard' difficulty, first clear only.
    const skillName = bossRewardsInfo.skillName;
    if (difficulty === 'hard' && skillName) {
        const expectedSkillName = `[秘技] ${skillName}`;
        const playerDoesNotHaveSkill = !(player.customSkills || []).some(s => s.name === expectedSkillName);
        if (playerDoesNotHaveSkill) {
            const skill = getBossSkillAsCustomSkill(boss, skillName);
            if (skill) {
                if (!newPlayer.customSkills) newPlayer.customSkills = [];
                newPlayer.customSkills.push(skill);
                rewardsForDisplay.bossSkill = skill; // For result screen display
>>>>>>> 1dd16d5105284553dd0cc792a037b077593ba0fa
            }
        });

        if (rewardMessage.trim()) {
            newPlayer = markBossDefeated(newPlayer, boss.id, difficulty);
        }
    }
<<<<<<< HEAD

    // ---- 周回報酬（限界突破素材） ----
    // 既にこのボスの武器を所持していて、ノーマルかハードを攻略した場合は毎回もらえる
    if ((difficulty === 'medium' || difficulty === 'hard') && alreadyOwnsWeapon) {
        const materialId = getBossLimitBreakMaterialId(boss.id);
        const materials = { ...(newPlayer.materials || {}) };
        materials[materialId] = (materials[materialId] || 0) + 1;
        newPlayer.materials = materials;
        rewardMessage += `限界突破素材「${getBossLimitBreakMaterialName(fullBossData.name)}」を手に入れた！\n`;
    }

    if (rewardMessage.trim()) {
        // Use a timeout to show the message after the result screen has settled.
        setTimeout(() => alert(rewardMessage), 500);
=======

    // 3. Limit Break Material Drop: On 'medium' (Normal) or 'hard' difficulty.
    if ((difficulty === 'medium' || difficulty === 'hard')) {
        const material = bossRewardsInfo.material;
        if (material && material.id && material.name) {
            const amount = (difficulty === 'hard') ? 2 : 1;
            newPlayer = addMaterialToPlayer(newPlayer, material.id, material.name, amount);
            rewardsForDisplay.limitBreakMaterial = { name: material.name, count: amount };
        }
    }

    // Save rewards to localStorage for result.js to display.
    if (Object.keys(rewardsForDisplay).length > 0) {
        const battleResult = JSON.parse(localStorage.getItem('battleResultData') || '{}');
        battleResult.rewards = { ...battleResult.rewards, ...rewardsForDisplay };
        localStorage.setItem('battleResultData', JSON.stringify(battleResult));
>>>>>>> 1dd16d5105284553dd0cc792a037b077593ba0fa
    }

    return newPlayer;
}
/**
 * Checks if a player has already defeated a boss at a specific difficulty.
 * @param {object} player - The player object.
 * @param {string} bossId - The ID of the boss.
 * @param {string} difficulty - The difficulty ('easy', 'medium', 'hard').
 * @returns {boolean}
 */
function hasDefeatedBoss(player, bossId, difficulty) {
    if (!player.bossDefeats) return false;
    const defeats = player.bossDefeats[bossId];
    if (!defeats) return false;
    return defeats.includes(difficulty);
}

/**
 * Marks a boss as defeated for a player at a specific difficulty.
 * @param {object} player - The player object.
 * @param {string} bossId - The ID of the boss.
 * @param {string} difficulty - The difficulty.
 * @returns {object} The updated player object.
 */
function markBossDefeated(player, bossId, difficulty) {
    if (!player.bossDefeats) {
        player.bossDefeats = {};
    }
    if (!player.bossDefeats[bossId]) {
        player.bossDefeats[bossId] = [];
    }
    if (!player.bossDefeats[bossId].includes(difficulty)) {
        player.bossDefeats[bossId].push(difficulty);
    }
    return player;
}

/**
<<<<<<< HEAD
 * Creates a custom skill from a boss's skill for the 'hard' difficulty reward.
 * @param {object} boss - The defeated boss object.
 * @returns {object|null} A custom skill object or null.
 */
function getBossSkillAsCustomSkill(boss, skillName) {
    if (!boss || !boss.skills || boss.skills.length === 0 || !skillName) return null;

    // Find the specific skill from the boss's skill list
    const bossSkill = boss.skills.find(s => s.name === skillName);

    if (!bossSkill) {
        console.error(`Skill '${skillName}' not found on boss '${boss.name}'`);
        return null;
    }

    return {
        id: `boss_skill_${boss.id}_${Date.now()}`,
        name: `[秘技] ${bossSkill.name}`,
        description: bossSkill.description,
        effect: bossSkill.effect,
        strength: 'tier15', // Boss skills are very powerful
        createdAt: Date.now(),
        type: 'active'
    };
}

/**
 * Generates a boss-themed weapon with 3 random unique abilities for the 'medium' difficulty reward.
 * 基礎倍率は BOSS_WEAPON_BASE_MULTIPLIER で、限界突破するまではこれが上限。
 * 限界突破素材を使うことで上限倍率が0.5ずつ伸び、その分「強化」でさらに鍛えられるようになる。
 * @param {object} boss - The defeated boss object.
=======
 * Generates a boss weapon, ready for the limit break system.
 * @param {object} bossData - The full data object for the boss.
 * @param {string} weaponName - The name for the new weapon.
>>>>>>> 1dd16d5105284553dd0cc792a037b077593ba0fa
 * @returns {object|null} A weapon object or null.
 */
function generateBossWeapon(bossData, weaponName) {
    if (!bossData || !weaponName) return null;

    // Use a weapon type from rewards, or a random one as fallback
    const weaponTypes = (typeof WEAPON_TYPES !== 'undefined') ? Object.keys(WEAPON_TYPES) : ["大剣"];
    const weaponType = bossData.rewards?.weaponType || weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

    // Get all available unique abilities from weapons.js
    const allAbilities = (typeof ORB_UNIQUE_ABILITIES !== 'undefined') ? Object.values(ORB_UNIQUE_ABILITIES) : [];
    let selectedAbilities = [];
    if (allAbilities.length > 0) {
        // Shuffle and pick 3
        const shuffled = allAbilities.sort(() => 0.5 - Math.random());
        selectedAbilities = shuffled.slice(0, 3);
    }

<<<<<<< HEAD
    // Randomly select a weapon type
    const weaponTypes = (typeof WEAPON_TYPES !== 'undefined') ? Object.keys(WEAPON_TYPES) : ["剣"];
    const randomType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

    // Give a significant boost to two random stats
    const statBonuses = {};
    const statsToBoost = ["atk", "def", "speed", "maxHp"];
    const shuffledStats = statsToBoost.sort(() => 0.5 - Math.random());
    statBonuses[shuffledStats[0]] = 0.25; // +25%
    statBonuses[shuffledStats[1]] = 0.25; // +25%

    // Create a powerful original weapon (base state — 限界突破と強化で伸ばしていく)
=======
    // Create a boss weapon compatible with the limit break system
>>>>>>> 1dd16d5105284553dd0cc792a037b077593ba0fa
    const weapon = {
        id: `boss_weapon_${bossData.id}_${Date.now()}`,
        name: weaponName,
<<<<<<< HEAD
        type: randomType,
        isOriginal: true,
        multiplier: BOSS_WEAPON_BASE_MULTIPLIER,
        baseMultiplier: BOSS_WEAPON_BASE_MULTIPLIER, // 強化進捗率の計算に使う基準値
        maxMultiplier: BOSS_WEAPON_BASE_MULTIPLIER, // 限界突破前はこれが上限（＝まだ強化はできない）
        statBonuses: statBonuses,
        upgradeCount: 0,
        uniqueAbilities: selectedAbilities,
        ultimateName: `${boss.name}の魂`,
        sourceBossId: boss.id, // どのボスをモチーフにした武器か（限界突破の判定に使用）
        limitBreakLevel: 0,
        maxLimitBreak: BOSS_WEAPON_MAX_LIMIT_BREAK,
=======
        type: weaponType,
        isOriginal: true, // Allows upgrading and limit breaking
        isBossWeapon: true, // Special flag for boss weapons
        bossId: bossData.id, // Link to the boss for material matching
        multiplier: 2.0,  // Set multiplier to 2.0 as requested
        maxMultiplier: 2.0,  // Initial max multiplier, can be increased by limit breaking
        limitBreakCount: 0,
        upgradeCount: 999, // Mark as fully upgraded
        statBonuses: bossData.rewards?.statBonuses || {}, // Use defined bonuses or empty
        uniqueAbilities: selectedAbilities, // Set 3 random unique abilities
        ultimateName: `${bossData.name}の魂`,
>>>>>>> 1dd16d5105284553dd0cc792a037b077593ba0fa
    };

    return weapon;
}
