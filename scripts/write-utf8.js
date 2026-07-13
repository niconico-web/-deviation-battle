/**
 * Writes all client files as UTF-8.
 * Run: node scripts/write-utf8.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../client");

function write(rel, content) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, { encoding: "utf8" });
    const b = fs.readFileSync(file);
    const bad = (b.toString("utf8").match(/\uFFFD/g) || []).length;
    console.log(rel, bad === 0 ? "OK" : "BAD " + bad);
}

const i18n = {
    appTitle: "School Battle",
    subtitle: "五教科の偏差値で戦うオンライン対戦",
    playerName: "プレイヤー名",
    playerNamePh: "名前を入力",
    deviation: "偏差値",
    jp: "国語",
    math: "数学",
    eng: "英語",
    sci: "理科",
    soc: "社会",
    createChar: "キャラクター作成",
    status: "ステータス",
    noChar: "まだキャラクターが作成されていません。",
    studyTimer: "勉強タイマー",
    studyDesc: "勉強時間が長いほど経験値が増えます。強化科目に応じて偏差値がわずかに上昇します。",
    studyFocus: "強化する科目",
    studyStart: "勉強開始",
    studyStop: "勉強終了",
    xp: "経験値",
    online: "オンライン対戦",
    createRoom: "ルーム作成",
    roomCode: "ルームコード",
    roomPh: "6文字のコード",
    joinRoom: "ルーム参加",
    deletePlayer: "プレイヤー削除",
    hpDef: "国語（HP・防御）",
    mathAtk: "数学（攻撃・速さ）",
    engSp: "英語（特殊・速さ）",
    sciAtk: "理科（攻撃・特殊）",
    socHp: "社会（HP・防御）",
    battle: "バトル",
    you: "あなた",
    enemy: "相手",
    loading: "読込中...",
    atk: "攻撃",
    sp: "特殊",
    def: "防御",
    speed: "速さ",
    attack: "攻撃",
    special: "特殊",
    guard: "防御",
    ultimate: "必殺技",
    ultimateGauge: "必殺技ゲージ",
    battleStart: "戦闘開始！",
    retry: "もう一度",
    home: "ホームへ",
    win: "YOU WIN",
    lose: "YOU LOSE"
};

write("js/i18n.js", `const I18N = ${JSON.stringify(i18n, null, 4)};
`);

write("js/stats.js", `const SUBJECT_KEYS = ["jp", "math", "eng", "sci", "soc"];

const SUBJECT_LABELS = {
    jp: "${i18n.jp}",
    math: "${i18n.math}",
    eng: "${i18n.eng}",
    sci: "${i18n.sci}",
    soc: "${i18n.soc}"
};

const DEFAULT_SUBJECTS = { jp: 50, math: 50, eng: 50, sci: 50, soc: 50 };

function clampSubject(value) {
    return Math.min(80, Math.max(30, Math.round(value * 100) / 100));
}

function calcStatsFromSubjects(subjects) {
    const { jp, math, eng, sci, soc } = subjects;
    return {
        maxHp: Math.max(50, Math.floor(100 + (jp - 50) * 4 + (soc - 50) * 2)),
        atk: Math.max(20, Math.floor(50 + (math - 50) * 5 + (sci - 50) * 2)),
        sp: Math.max(20, Math.floor(50 + (eng - 50) * 5 + (sci - 50) * 2)),
        def: Math.max(20, Math.floor(50 + (soc - 50) * 5 + (jp - 50) * 2)),
        speed: Math.max(20, Math.floor(50 + (eng - 50) * 3 + (math - 50) * 2))
    };
}

function xpToNextLevel(level) { return level * 150; }

function calcLevel(xp) {
    let level = 1;
    let remaining = xp;
    while (remaining >= xpToNextLevel(level)) {
        remaining -= xpToNextLevel(level);
        level++;
    }
    return level;
}

function calcStudyXp(seconds) { return Math.floor(seconds / 10); }
function calcSubjectGain(seconds) { return (seconds / 60) * 0.03; }

function buildPlayer(name, subjects, xp) {
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

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}
`);

write("index.html", `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${i18n.appTitle}</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body>
<div class="container">
<header class="page-header">
<h1>${i18n.appTitle}</h1>
<p class="subtitle">${i18n.subtitle}</p>
</header>
<section class="section">
<label class="field-label" for="playerName">${i18n.playerName}</label>
<input id="playerName" type="text" placeholder="${i18n.playerNamePh}" autocomplete="nickname">
</section>
<section class="section">
<h2>${i18n.deviation}</h2>
<div class="subjects">
<label>${i18n.jp}<input id="jp" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
<label>${i18n.math}<input id="math" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
<label>${i18n.eng}<input id="eng" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
<label>${i18n.sci}<input id="sci" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
<label>${i18n.soc}<input id="soc" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
</div>
<button type="button" class="btn btn-primary" onclick="createCharacter()">${i18n.createChar}</button>
</section>
<div id="status" class="status-box">
<h2>${i18n.status}</h2>
<p>${i18n.noChar}</p>
</div>
<section class="study-section section">
<h2>${i18n.studyTimer}</h2>
<p class="study-desc">${i18n.studyDesc}</p>
<label class="field-label" for="studyFocus">${i18n.studyFocus}</label>
<select id="studyFocus">
<option value="jp">${i18n.hpDef}</option>
<option value="math">${i18n.mathAtk}</option>
<option value="eng">${i18n.engSp}</option>
<option value="sci">${i18n.sciAtk}</option>
<option value="soc">${i18n.socHp}</option>
</select>
<p id="studyTimer" class="study-timer">00:00:00</p>
<p id="xpDisplay" class="xp-display">${i18n.xp}：0</p>
<div class="study-buttons">
<button type="button" id="studyStart" class="btn btn-primary">${i18n.studyStart}</button>
<button type="button" id="studyStop" class="btn btn-danger" disabled>${i18n.studyStop}</button>
</div>
</section>
<section class="section buttons">
<h2>${i18n.online}</h2>
<button type="button" id="createRoom" class="btn btn-secondary">${i18n.createRoom}</button>
<label class="field-label" for="roomInput">${i18n.roomCode}</label>
<input id="roomInput" type="text" placeholder="${i18n.roomPh}" maxlength="6" autocapitalize="characters" autocomplete="off">
<button type="button" id="joinRoom" class="btn btn-secondary">${i18n.joinRoom}</button>
<button type="button" id="deletePlayer" class="btn btn-danger-outline">${i18n.deletePlayer}</button>
</section>
</div>
<script src="/socket.io/socket.io.js"></script>
<script src="js/i18n.js"></script>
<script src="js/stats.js"></script>
<script src="js/script.js"></script>
</body>
</html>
`);

write("battle.html", `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${i18n.appTitle} - ${i18n.battle}</title>
<link rel="stylesheet" href="css/battle.css">
</head>
<body>
<div class="battle-container">
<header class="battle-header">
<h1>${i18n.battle}</h1>
<p id="turnText" class="turn-text"></p>
</header>
<div class="players">
<div class="card player-card" id="playerCard">
<p class="card-label">${i18n.you}</p>
<h2 id="myName">----</h2>
<div id="myDamage" class="damage"></div>
<div class="hpbar"><div id="myHPBar" class="fill"></div></div>
<p id="myHPText" class="hp-text">HP 100 / 100</p>
<div class="stats">
<p id="myAtk">${i18n.atk}：-</p>
<p id="mySp">${i18n.sp}：-</p>
<p id="myDef">${i18n.def}：-</p>
<p id="mySpeed">${i18n.speed}：-</p>
</div>
</div>
<div class="vs">VS</div>
<div class="card enemy-card" id="enemyCard">
<p class="card-label">${i18n.enemy}</p>
<h2 id="enemyName">${i18n.loading}</h2>
<div id="enemyDamage" class="damage"></div>
<div class="hpbar"><div id="enemyHPBar" class="fill enemy"></div></div>
<p id="enemyHPText" class="hp-text">HP ???</p>
<div class="stats">
<p id="enemyAtk">${i18n.atk}：？</p>
<p id="enemySp">${i18n.sp}：？</p>
<p id="enemyDef">${i18n.def}：？</p>
<p id="enemySpeed">${i18n.speed}：？</p>
</div>
</div>
</div>
<div class="ultimate-section">
<p class="gauge-label">${i18n.ultimateGauge}</p>
<div class="ultimateGauge"><div id="ultimateGaugeBar" class="ultimateFill"></div></div>
</div>
<div class="commands">
<button type="button" id="attackBtn" class="cmd-btn attack">${i18n.attack}</button>
<button type="button" id="specialBtn" class="cmd-btn special">${i18n.special}</button>
<button type="button" id="guardBtn" class="cmd-btn guard">${i18n.guard}</button>
<button type="button" id="ultimateBtn" class="cmd-btn ultimate" disabled>${i18n.ultimate}</button>
</div>
<div id="log" class="battle-log">${i18n.battleStart}</div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script src="js/i18n.js"></script>
<script src="js/battle.js"></script>
</body>
</html>
`);

write("result.html", `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${i18n.appTitle} - Result</title>
<link rel="stylesheet" href="css/result.css">
</head>
<body>
<div id="resultCard">
<h1 id="resultTitle"></h1>
<div class="result-stats">
<p id="turnText"></p>
<p id="hpText"></p>
<p id="damageText"></p>
<p id="criticalText"></p>
</div>
<div class="buttonArea">
<button type="button" id="retryBtn" class="btn">${i18n.retry}</button>
<button type="button" id="homeBtn" class="btn">${i18n.home}</button>
</div>
</div>
<script src="js/i18n.js"></script>
<script src="js/result.js"></script>
</body>
</html>
`);

console.log("Done. All files written as UTF-8.");
