// ボス武器の基礎倍率（最弱ボスの討伐直後の状態）。ここから限界突破で上限を伸ばして「強化」で近づけていく。
const BOSS_WEAPON_BASE_MULTIPLIER = 2.0;
// ボスの強さ（bosses.json内の並び順 = 弱い順）が1段階上がるごとに、ドロップする武器の基礎倍率が伸びる量
// （下のテーブルに載っていない新しいボスが追加された場合のフォールバック用）
const BOSS_WEAPON_TIER_MULTIPLIER_STEP = 0.25;
// 限界突破1回あたりの上限倍率の増加量
const BOSS_WEAPON_LIMIT_BREAK_INCREMENT = 0.5;
// 限界突破できる最大回数
const BOSS_WEAPON_MAX_LIMIT_BREAK = 4;

// ボスごとの武器基礎倍率。ボスの種類が一段階強くなるごとに倍率が上がる。
// ゴブリンキング（最弱）= 2.0倍、深淵ヲ廻ルモノ（最強の隠しボス）= 6.0倍。
const BOSS_WEAPON_MULTIPLIER_BY_ID = {
    goblin_king: 2.0,
    orc_warlord: 2.5,
    shadow_serpent: 3.0,
    ice_golem: 3.5,
    flame_dragon: 4.0,
    abyssal_knight: 4.5,
    celestial_guardian: 5.0,
    abyss_warden: 6.0
};

/**
 * ボスIDに応じた武器の基礎倍率を返す。
 * テーブルに載っていない（新しく追加された）ボスの場合は、
 * bosses.json内の並び順から推定した値をフォールバックとして使う。
 * @param {string} bossId
 * @returns {number}
 */
function getBossWeaponBaseMultiplier(bossId) {
    if (BOSS_WEAPON_MULTIPLIER_BY_ID[bossId] != null) {
        return BOSS_WEAPON_MULTIPLIER_BY_ID[bossId];
    }
    const tierIndex = getBossTierIndex(bossId);
    return Math.round((BOSS_WEAPON_BASE_MULTIPLIER + tierIndex * BOSS_WEAPON_TIER_MULTIPLIER_STEP) * 100) / 100;
}

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
 * （過去バージョンで bossId フィールドとして保存されたデータも念のため見る）
 * @param {object} player
 * @param {string} bossId
 * @returns {boolean}
 */
function playerOwnsBossWeapon(player, bossId) {
    return (player.weapons || []).some(w => w.sourceBossId === bossId || w.bossId === bossId);
}

/**
 * プレイヤーが指定したボスのスキルを既に習得しているか判定する。
 * @param {object} player
 * @param {string} bossId
 * @returns {boolean}
 */
function playerOwnsBossSkill(player, bossId) {
    return (player.customSkills || []).some(s => s.sourceBossId === bossId);
}

/**
 * bosses.json内での並び順（0始まり）から、ボスの「強さティア」を求める。
 * bosses.jsonは弱い順に並んでいる前提。見つからない場合は0。
 * @param {string} bossId
 * @returns {number}
 */
function getBossTierIndex(bossId) {
    const list = window.bosses || [];
    const index = list.findIndex(b => b.id === bossId);
    return index >= 0 ? index : 0;
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
        type: 'active',
        sourceBossId: bossData.id // どのボスのスキルか（再取得判定に使用）
    };
}

/**
 * Applies rewards for defeating a boss.
 * ・「ノーマル(medium)」を攻略：ボスをモチーフにした武器をまだ持っていなければドロップ
 *   （討伐済みかどうかではなく、「今持っているか」で判定するので、捨てても再入手できる）
 * ・「ハード(hard)」を攻略：ボスのスキルをまだ持っていなければ習得
 * ・武器を入手済みの状態で「ノーマル」か「ハード」を周回：限界突破素材をドロップ（何度でも）
 * 報酬はリザルト画面で表示できるよう、localStorageの battleResultData にも保存する。
 * @param {object} player - The player object.
 * @param {object} boss - The defeated boss object from the battle (drops/skillsを含む).
 * @returns {object} The updated player object.
 */
function applyBossRewards(player, boss) {
    if (!boss || !boss.id || !boss.difficulty) {
        console.error("Invalid boss data for rewards", boss);
        return player;
    }

    // window.bosses（強さティアの判定に使用）を確保しておく
    if (!window.bosses) {
        const bossesData = localStorage.getItem('bosses');
        if (bossesData) {
            window.bosses = JSON.parse(bossesData);
        }
    }

    // 戦闘用に生成されたbossオブジェクトには drops/skills が含まれているので、まずそれを使う。
    // （古いセーブデータ等で欠けている場合のみ、簡易版のwindow.bossesにフォールバックする）
    let fullBossData = boss;
    if (!fullBossData.drops) {
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
    // 武器・スキルを持っているかどうかは、今回の報酬を適用する「前」の状態で判定する
    const ownedWeaponBefore = playerOwnsBossWeapon(player, boss.id);
    const ownedSkillBefore = playerOwnsBossSkill(player, boss.id);

    let newPlayer = { ...player };
    const rewardsForDisplay = {};
    let anyOneTimeReward = false;

    // ---- 討伐報酬（武器・スキル） ----
    // 「一度倒したらもうドロップしない」ではなく「今持っていなければドロップする」。
    // 武器やスキルを誤って手放してしまった場合でも、再度攻略すれば手に入る。
    fullBossData.drops.forEach(drop => {
        if (!drop.difficulty.includes(difficulty)) return;

        if (drop.type === 'weapon' && !ownedWeaponBefore) {
            const weapon = generateBossWeapon(fullBossData, drop.name);
            if (weapon) {
                newPlayer = addWeaponToPlayer(newPlayer, weapon);
                rewardsForDisplay.bossWeapon = weapon;
                anyOneTimeReward = true;
            }
        } else if (drop.type === 'skill' && !ownedSkillBefore) {
            const skill = getBossSkillAsCustomSkill(fullBossData, drop.name);
            if (skill) {
                if (!newPlayer.customSkills) newPlayer.customSkills = [];
                newPlayer.customSkills.push(skill);
                rewardsForDisplay.bossSkill = skill;
                anyOneTimeReward = true;
            }
        }
    });

    if (anyOneTimeReward) {
        newPlayer = markBossDefeated(newPlayer, boss.id, difficulty);
    }

    // ---- 周回報酬（限界突破素材） ----
    // 既にこのボスの武器を所持していて、ノーマルかハードを攻略した場合は毎回もらえる
    if ((difficulty === 'medium' || difficulty === 'hard') && ownedWeaponBefore) {
        const materialId = getBossLimitBreakMaterialId(boss.id);
        const materialName = getBossLimitBreakMaterialName(fullBossData.name);
        const materials = { ...(newPlayer.materials || {}) };
        materials[materialId] = (materials[materialId] || 0) + 1;
        newPlayer.materials = materials;
        rewardsForDisplay.limitBreakMaterial = { name: materialName, count: 1 };
    }

    // リザルト画面で表示できるよう保存
    if (Object.keys(rewardsForDisplay).length > 0) {
        const battleResult = JSON.parse(localStorage.getItem('battleResultData') || '{}');
        battleResult.rewards = { ...(battleResult.rewards || {}), ...rewardsForDisplay };
        localStorage.setItem('battleResultData', JSON.stringify(battleResult));
    }

    return newPlayer;
}

/**
 * Checks if a player has already defeated a boss at a specific difficulty.
 * （記録用。報酬付与の判定には使用しない -- 実際に持っているかどうかで判定する）
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
 * Generates a boss-themed weapon with 3 random unique abilities for the 'medium' difficulty reward.
 * 基礎倍率はボスごとに定義されたテーブル（BOSS_WEAPON_MULTIPLIER_BY_ID）から決まる。
 * 限界突破するまではこれが上限。限界突破素材を使うことで上限倍率が0.5ずつ伸び、
 * その分「強化」でさらに鍛えられるようになる。
 * @param {object} boss - The defeated boss object.
 * @param {string} weaponName - The name for the new weapon.
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

    // ボスごとの基礎倍率（強いボスほど強い武器がドロップする）
    const baseMultiplier = getBossWeaponBaseMultiplier(boss.id);

    // Create a powerful original weapon (base state — 限界突破と強化で伸ばしていく)
    const weapon = {
        id: `boss_weapon_${boss.id}_${Date.now()}`,
        name: weaponName,
        type: randomType,
        isOriginal: true,
        multiplier: baseMultiplier,
        baseMultiplier: baseMultiplier, // 強化進捗率の計算に使う基準値
        maxMultiplier: baseMultiplier, // 限界突破前はこれが上限（＝まだ強化はできない）
        statBonuses: statBonuses,
        upgradeCount: 0,
        uniqueAbilities: selectedAbilities,
        ultimateName: `${boss.name}の魂`,
        sourceBossId: boss.id, // どのボスをモチーフにした武器か（限界突破・再ドロップ判定に使用）
        limitBreakLevel: 0,
        maxLimitBreak: BOSS_WEAPON_MAX_LIMIT_BREAK,
    };

    return weapon;
}
