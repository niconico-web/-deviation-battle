// ============================================
// School Battle - ステータス計算（共通）
// ============================================

const SUBJECT_KEYS = ["jp", "math", "eng", "sci", "soc"];

const SUBJECT_LABELS = {
    jp: "国語",
    math: "数学",
    eng: "英語",
    sci: "理科",
    soc: "社会"
};

const DEFAULT_SUBJECTS = {
    jp: 50,
    math: 50,
    eng: 50,
    sci: 50,
    soc: 50
};

function clampSubject(value){

    return Math.min(80, Math.max(30, Math.round(value * 100) / 100));

}

function calcStatsFromSubjects(subjects){

    const jp = subjects.jp;
    const math = subjects.math;
    const eng = subjects.eng;
    const sci = subjects.sci;
    const soc = subjects.soc;

    return {
        maxHp: Math.max(50, Math.floor(100 + (jp - 50) * 4 + (soc - 50) * 2)),
        atk: Math.max(20, Math.floor(50 + (math - 50) * 5 + (sci - 50) * 2)),
        sp: Math.max(20, Math.floor(50 + (eng - 50) * 5 + (sci - 50) * 2)),
        def: Math.max(20, Math.floor(50 + (soc - 50) * 5 + (jp - 50) * 2)),
        speed: Math.max(20, Math.floor(50 + (eng - 50) * 3 + (math - 50) * 2))
    };

}

function xpToNextLevel(level){

    return level * 150;

}

function calcLevel(xp){

    let level = 1;
    let remaining = xp;

    while(remaining >= xpToNextLevel(level)){

        remaining -= xpToNextLevel(level);
        level++;

    }

    return level;

}

// 勉強時間に応じた経験値（10秒ごとに1XP）
function calcStudyXp(seconds){

    return Math.floor(seconds / 10);

}

// 選択した強化科目の偏差値上昇（1分あたり+0.03、かなり伸びにくい）
function calcSubjectGain(seconds){

    return (seconds / 60) * 0.03;

}

function buildPlayer(name, subjects, xp){

    const stats = calcStatsFromSubjects(subjects);
    const level = calcLevel(xp || 0);

    return {
        name,
        subjects: { ...subjects },
        xp: xp || 0,
        level,
        maxHp: stats.maxHp,
        hp: stats.maxHp,
        atk: stats.atk,
        sp: stats.sp,
        def: stats.def,
        speed: stats.speed,
        totalStudySeconds: 0
    };

}

function formatTime(seconds){

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return [h, m, s]
        .map(v => String(v).padStart(2, "0"))
        .join(":");

}
