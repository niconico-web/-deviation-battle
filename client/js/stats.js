const STAT_KEYS = ["maxHp", "atk", "sp", "def", "speed"];
const STAT_LABELS = {
    maxHp: "HP", atk: I18N.atk, sp: I18N.sp, def: I18N.def, speed: I18N.speed
};
const TOTAL_STAT_POINTS = 300;
const MIN_STAT = 10;
const DEFAULT_STATS = { maxHp: 60, atk: 60, sp: 60, def: 60, speed: 60 };

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

function migratePlayer(player) {
    if (!player) return null;
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

function applyBattleRewards(won, turns, damage) {
    const raw = localStorage.getItem("player"); if (!raw) return null;
    const player = migratePlayer(JSON.parse(raw));
    const stats = getStatsFromPlayer(player);
    // Disabled XP gain from battles - only study provides XP
    const gainedXp = 0;
    const updated = buildPlayer(player.name, stats, (player.xp || 0) + gainedXp, { hp: player.hp, totalStudySeconds: player.totalStudySeconds || 0 });
    localStorage.setItem("player", JSON.stringify(updated));
    localStorage.setItem("battleXpGain", String(gainedXp));
    return updated;
}

function getStatsFromPlayer(player) {
    return {
        maxHp: player.maxHp ?? DEFAULT_STATS.maxHp,
        atk: player.atk ?? DEFAULT_STATS.atk,
        sp: player.sp ?? DEFAULT_STATS.sp,
        def: player.def ?? DEFAULT_STATS.def,
        speed: player.speed ?? DEFAULT_STATS.speed
    };
}

function buildPlayer(name, stats, xp, options = {}) {
    const lv = calcLevel(xp || 0);
    const maxHp = stats.maxHp;
    const hp = options.hp != null ? Math.min(options.hp, maxHp) : maxHp;
    return {
        name,
        xp: xp || 0,
        level: lv,
        maxHp,
        hp,
        atk: stats.atk,
        sp: stats.sp,
        def: stats.def,
        speed: stats.speed,
        totalStudySeconds: options.totalStudySeconds || 0
    };
}

function formatTime(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":"); }
