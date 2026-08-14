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
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return "p_" + crypto.randomUUID();
    }
    return "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}

function migratePlayer(player) {
    if (!player) return null;
    if (!player.id) player.id = generatePlayerId();
    if (player.coins == null) player.coins = 0;
    if (!player.weapons) player.weapons = [];
    if (!player.weaponWins) player.weaponWins = {};
    if (!player.orbs) player.orbs = [];
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
function calcLevel(xp) { let lv = 1, r = xp; while (r >= xpToNextLevel(lv)) { r -= xpToNextLevel(lv); lv++; } return lv; }
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
    let player = migratePlayer(JSON.parse(raw));
    const stats = getStatsFromPlayer(player);
    const gainedXp = 0;
    let gainedCoins = 0;

    console.log(`[Stats] applyBattleRewards START: won=${won}, equippedWeapon=${player.equippedWeapon?.name}, weaponWins=${JSON.stringify(player.weaponWins)}`);

    let droppedOrb = null;

    if (won) {
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

    const built = buildPlayer(player.name, stats, (player.xp || 0) + gainedXp, {
        hp: player.hp,
        totalStudySeconds: player.totalStudySeconds || 0,
        id: player.id,
        coins: (player.coins || 0) + gainedCoins,
        weapons: player.weapons,
        equippedWeapon: player.equippedWeapon,
        weaponWins: player.weaponWins,
        orbs: player.orbs || []
    });
    const updated = { ...player, ...built };

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

function getStatsFromPlayer(player) {
    const p = player || {}; // Ensure player is not null/undefined
    return {
        maxHp: Number(p.maxHp) || DEFAULT_STATS.maxHp,
        atk: Number(p.atk) || DEFAULT_STATS.atk,
        def: Number(p.def) || DEFAULT_STATS.def,
        speed: Number(p.speed) || DEFAULT_STATS.speed,
        grade: Number(p.grade) || 1
    };
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
        orbs: options.orbs || []
    };
}

function formatTime(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":"); }
