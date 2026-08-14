const STAT_KEYS = ["maxHp", "atk", "def", "speed"];
const STAT_LABELS = {
    maxHp: "HP", atk: I18N.atk, def: I18N.def, speed: I18N.speed
};
const TOTAL_STAT_POINTS = 200;
const MIN_STAT = 10;
const DEFAULT_STATS = { maxHp: 50, atk: 70, def: 50, speed: 30 };

function getSubjectDisplayName(subject) {
    const subjectNames = {
        'math': '算数・数学',
        'jp': '国語',
        'english': '英語',
        'eng': '英語',
        'science': '理科',
        'sci': '理科',
        'social': '社会',
        'soc': '社会'
    };
    return subjectNames[subject] || subject;
}

function sumStats(stats) {
    return STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
}

function validateStatAllocation(stats) {
    for (const key of STAT_KEYS) {
        const value = stats[key];
        if (!Number.isFinite(value) || value !== Math.floor(value) || value < MIN_STAT) {
            return { ok: false, message: I18N.statMinError.replace("{min}", MIN_STAT) };
        }
    }
    const total = sumStats(stats);
    if (total !== TOTAL_STAT_POINTS) {
        return { ok: false, message: I18N.statTotalError.replace("{total}", TOTAL_STAT_POINTS).replace("{current}", total) };
    }
    return { ok: true };
}

function generatePlayerId() {
    // 6桁の英大文字と数字で構成されるIDを生成
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function migratePlayer(player) {
    if (!player) return null;
    if (!player.id) player.id = generatePlayerId();
    if (player.coins == null) player.coins = 0;
    if (!player.weapons) player.weapons = [];
    if (!player.weaponWins) player.weaponWins = {};
    if (!player.orbs) player.orbs = [];
    if (typeof initializeSkillData === 'function') {
        player = initializeSkillData(player);
    }
    if (!player.bossDefeats) player.bossDefeats = {}; // Add bossDefeats

    if (player.subjects && typeof calcStatsFromSubjects === "function") {
        const derived = calcStatsFromSubjects(player.subjects);
        return {
            ...player,
            maxHp: derived.maxHp,
            atk: derived.atk,
            sp: derived.sp,
            def: derived.def,
            speed: derived.speed,
            hp: player.hp != null ? Math.min(player.hp, derived.maxHp) : derived.maxHp
        };
    }
    return player;
}

function calcStatsFromSubjects(s) {
    const { jp, math, eng, sci, soc } = s;
    return {
        maxHp: Math.max(50, Math.floor(100 + (jp - 50) * 4 + (soc - 50) * 2)),
        atk: Math.max(20, Math.floor(50 + (math - 50) * 5 + (sci - 50) * 2)),
        sp: Math.max(20, Math.floor(50 + (eng - 50) * 5 + (sci - 50) * 2)),
        def: Math.max(20, Math.floor(50 + (soc - 50) * 5 + (jp - 50) * 2)),
        speed: Math.max(20, Math.floor(50 + (eng - 50) * 3 + (math - 50) * 2))
    };
}

function xpToNextLevel(l) { return Math.max(40, l * 50); }
function calcLevel(xp) {
    // 元の反復計算は、非常に大きなXP値に対して遅くなる可能性があり、UIがフリーズする原因となっていました。
    // レベルアップの公式から導出した閉形式解に置き換えます。
    // レベルLに到達するための合計XPは 25 * L * (L - 1) です。
    // これを L について解きます: 25L^2 - 25L - xp = 0
    // 二次方程式の解の公式を使用: L = (-b + sqrt(b^2 - 4ac)) / 2a
    // a=25, b=-25, c=-xp
    const level = Math.floor((25 + Math.sqrt(625 + 100 * xp)) / 50);

    // xpが0の場合、levelは1になります。xpが49の場合、levelは1です。xpが50の場合、levelは2になります。
    // 浮動小数点数の問題で負の値にならないように、最低でも1を返すようにします。
    return Math.max(1, level);
}
function calcStudyXp(s) { return Math.floor(s / 4); }
function calcStatGain(s) { return Math.max(1, Math.floor(s / 60)); }
function calcBattleXp(won, turns, damage) { const base = won ? 40 : 15; return base + Math.floor(turns * 3) + Math.floor(damage / 10); }

function applyBattleRewards(won, turns, damage, options = {}) {
    // 報酬が既に適用されているかチェック
    if (localStorage.getItem("rewardsApplied") === "true") {
        console.log(`[Stats] Rewards already applied, skipping`);
        const raw = localStorage.getItem("player");
        return raw ? JSON.parse(raw) : null;
    }

    const raw = localStorage.getItem("player");
    if (!raw) {
        console.error("[Stats] applyBattleRewards failed: 'player' not found in localStorage.");
        return null;
    }
    // 新しい報酬データを保存するためのオブジェクトを初期化
    localStorage.setItem('battleResultData', JSON.stringify({}));

    let player = migratePlayer(JSON.parse(raw));
    const stats = getStatsFromPlayer(player);
    const gainedXp = calcBattleXp(won, turns, damage);
    let gainedCoins = 0;
    const isBossBattle = localStorage.getItem("isBossBattle") === "true";

    console.log(`[Stats] applyBattleRewards START: won=${won}, equippedWeapon=${player.equippedWeapon?.name}, weaponWins=${JSON.stringify(player.weaponWins)}`);

    let droppedOrb = null;

    if (won) {
        // Boss battle rewards are handled separately
        if (isBossBattle && options.enemy) {
            // Ensure difficulty is present on the enemy object for reward logic
            if (!options.enemy.difficulty) {
                const savedDifficulty = localStorage.getItem("battleDifficulty");
                if (savedDifficulty) options.enemy.difficulty = savedDifficulty;
                console.log(`[Stats] Restored difficulty '${savedDifficulty}' for boss rewards.`);
            }
            if (typeof applyBossRewards === 'function') {
                player = applyBossRewards(player, options.enemy);
            }
        }
        gainedCoins += COIN_BATTLE_WIN;
        console.log(`[Stats] Calling incrementWeaponWin for weapon: ${player.equippedWeapon?.name} (type: ${player.equippedWeapon?.type})`);
        player = incrementWeaponWin(player);
        console.log(`[Stats] After incrementWeaponWin: weaponWins=${JSON.stringify(player.weaponWins)}`);
        if (options.stolenWeapon) {
            player = addWeaponToPlayer(player, options.stolenWeapon);
        }
        
        // オーブドロップ判定（戦闘勝利時）
        if (typeof rollOrbDrop === "function") {
            droppedOrb = rollOrbDrop();
        }
    }
    if (options.lostWeapon) {
        player = removeWeaponFromPlayer(player, options.lostWeapon.id);
    }

    const oldLevel = player.level || calcLevel(player.xp || 0);
    const newXp = (player.xp || 0) + gainedXp;
    const newLevel = calcLevel(newXp);

    if (newLevel > oldLevel && typeof addSkillPointsOnLevelUp === 'function') {
        player = addSkillPointsOnLevelUp(player, oldLevel, newLevel);
        alert(`レベルアップ！ Lv${newLevel}\nスキルポイントを ${ (newLevel - oldLevel) * SKILL_POINTS_PER_LEVEL } 獲得しました！`);
    }

    const updated = buildPlayer(player.name, stats, newXp, {
        hp: player.hp,
        totalStudySeconds: player.totalStudySeconds || 0,
        id: player.id,
        coins: (player.coins || 0) + gainedCoins,
        weapons: player.weapons,
        equippedWeapon: player.equippedWeapon,
        weaponWins: player.weaponWins,
        orbs: player.orbs || [],
        grade: player.grade,
        skillTree: player.skillTree,
        skillSlots: player.skillSlots,
        customSkills: player.customSkills,
        bossDefeats: player.bossDefeats || {}
    });

    // オーブを追加
    if (droppedOrb) {
        if (!updated.orbs) updated.orbs = [];
        updated.orbs.push(droppedOrb);
    }

    localStorage.setItem("player", JSON.stringify(updated));
    localStorage.setItem("battleXpGain", String(gainedXp));
    localStorage.setItem("battleCoinGain", String(gainedCoins));
    localStorage.setItem("rewardsApplied", "true"); // 報酬適用フラグを設定
    
    if (droppedOrb) {
        localStorage.setItem("droppedOrb", JSON.stringify(droppedOrb));
    } else {
        localStorage.removeItem("droppedOrb");
    }
    
    console.log(`[Stats] applyBattleRewards END: Player saved with weaponWins:`, updated.weaponWins);
    console.log(`[Stats] Saved player data:`, JSON.stringify(updated));
    return updated;
}

function getStatsFromPlayer(player, withPassives = false) {
    const p = player || {};

    if (withPassives && typeof getSkillNodeEffects === 'function') {
        const baseStats = {
            maxHp: Number(p.maxHp) || DEFAULT_STATS.maxHp,
            atk: Number(p.atk) || DEFAULT_STATS.atk,
            def: Number(p.def) || DEFAULT_STATS.def,
            speed: Number(p.speed) || DEFAULT_STATS.speed,
            grade: Number(p.grade) || 1
        };

        const skillEffects = getSkillNodeEffects(p);
        const passive = skillEffects.passive;

        // Apply flat bonuses first, then percentage bonuses
        baseStats.maxHp = Math.floor((baseStats.maxHp + (passive.maxHp || 0)) * (1 + (passive.maxHpPercent || 0)));
        baseStats.atk = Math.floor((baseStats.atk + (passive.atk || 0)) * (1 + (passive.atkPercent || 0)));
        baseStats.def = Math.floor((baseStats.def + (passive.def || 0)) * (1 + (passive.defPercent || 0)));
        baseStats.speed = Math.floor((baseStats.speed + (passive.speed || 0)) * (1 + (passive.speedPercent || 0)));

        return baseStats;
    }

    // Return raw stats without passives
    return {
        maxHp: Number(p.maxHp) || DEFAULT_STATS.maxHp,
        atk: Number(p.atk) || DEFAULT_STATS.atk,
        def: Number(p.def) || DEFAULT_STATS.def,
        speed: Number(p.speed) || DEFAULT_STATS.speed,
        grade: Number(p.grade) || 1
    };
}

function getEffectiveStats(player) {
    // Get base stats with passive skills applied
    const statsWithSkills = getStatsFromPlayer(player, true);
    // Apply weapon bonuses
    return applyWeaponStats(statsWithSkills, player.equippedWeapon);
}

function getBattleStats(player) {
    return getEffectiveStats(player);
}

function buildPlayer(name, stats, xp, options = {}) {
    const lv = calcLevel(xp || 0);
    const maxHp = stats.maxHp;
    const hp = options.hp != null ? Math.min(options.hp, maxHp) : maxHp;
    return {
        id: options.id || generatePlayerId(),
        name,
        xp: xp || 0,
        level: lv,
        maxHp,
        hp,
        atk: stats.atk,
        def: stats.def,
        speed: stats.speed,
        grade: options.grade || stats.grade || 1,
        totalStudySeconds: options.totalStudySeconds || 0,
        coins: options.coins != null ? options.coins : 0,
        weapons: options.weapons || [],
        equippedWeapon: options.equippedWeapon || null,
        weaponWins: options.weaponWins || {},
        orbs: options.orbs || [],
        skillTree: options.skillTree || { unlockedNodes: [], availablePoints: 0 },
        skillSlots: options.skillSlots || [null, null, null],
        customSkills: options.customSkills || [],
        bossDefeats: options.bossDefeats || {}
    };
}

function formatTime(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":"); }

function getPlayerData() {
    const raw = localStorage.getItem("player");
    return raw ? migratePlayer(JSON.parse(raw)) : null;
}
