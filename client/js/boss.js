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
 * Applies rewards for defeating a boss.
 * ・「ノーマル(medium)」を初めて攻略：ボスをモチーフにした武器（基礎倍率2.0倍）をドロップ
 * ・「ハード(hard)」を初めて攻略：ボスのスキルを習得
 * ・武器を入手済みの状態で「ノーマル」か「ハード」を周回：限界突破素材をドロップ（何度でも）
 * @param {object} player - The player object.
 * @param {object} boss - The defeated boss object from the battle (drops/skillsを含む).
 * @returns {object} The updated player object.
 */
function applyBossRewards(player, boss) {
    if (!boss || !boss.id || !boss.difficulty) {
        console.error("Invalid boss data for rewards", boss);
        return player;
    }

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
            }
        });

        if (rewardMessage.trim()) {
            newPlayer = markBossDefeated(newPlayer, boss.id, difficulty);
        }
    }

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
 * @returns {object|null} A weapon object or null.
 */
function generateBossWeapon(boss, weaponName) {
    if (!boss || !weaponName) return null;

    // Get all available unique abilities from weapons.js
    const allAbilities = (typeof ORB_UNIQUE_ABILITIES !== 'undefined') ? Object.values(ORB_UNIQUE_ABILITIES) : [];
    if (allAbilities.length === 0) {
        console.error("ORB_UNIQUE_ABILITIES not found or empty. Cannot generate boss weapon.");
        return null;
    }
    // Shuffle and pick 3
    const shuffled = allAbilities.sort(() => 0.5 - Math.random());
    const selectedAbilities = shuffled.slice(0, 3);

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
    const weapon = {
        id: `boss_weapon_${boss.id}_${Date.now()}`,
        name: weaponName,
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
    };

    return weapon;
}
