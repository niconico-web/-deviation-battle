let studyStartTime = null, studyTimerInterval = null, studyElapsedBefore = 0;

// Initialize socket after DOM is ready
window.socket = null;

function initializeSocket() {
    window.socket = io({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ["websocket", "polling"]
    });

    // Connection logging
    window.socket.on("connect", () => {
        console.log("接続:", window.socket.id);
        window.socket.connected = true;
    });

    window.socket.on("disconnect", () => {
        console.log("切断");
        window.socket.connected = false;
    });

    window.socket.on("connect_error", (error) => {
        console.log("接続エラー:", error);
        window.socket.connected = false;
    });

    // Initialize connection state
    window.socket.connected = false;
}

function getStatsFromInputs() {
    return {
        maxHp: Math.floor(Number(document.getElementById("statMaxHp").value)),
        atk: Math.floor(Number(document.getElementById("statAtk").value)),
        def: Math.floor(Number(document.getElementById("statDef").value)),
        speed: Math.floor(Number(document.getElementById("statSpeed").value)),
        grade: Math.floor(Number(document.getElementById("statGrade").value))
    };
}

function setStatsToInputs(stats) {
    document.getElementById("statMaxHp").value = stats.maxHp;
    document.getElementById("statAtk").value = stats.atk;
    document.getElementById("statDef").value = stats.def;
    document.getElementById("statSpeed").value = stats.speed;
    if (stats.grade) {
        document.getElementById("statGrade").value = stats.grade;
    }
    updateRemainingPoints();
}

function updateRemainingPoints() {
    const el = document.getElementById("remainingPoints");
    if (!el) return;
    const stats = getStatsFromInputs();
    const used = sumStats(stats);
    const remaining = TOTAL_STAT_POINTS - used;
    if (getPlayerData() && used > TOTAL_STAT_POINTS) {
        el.textContent = I18N.studiedTotal.replace("{total}", used);
        el.className = "remaining-points points-trained";
        return;
    }
    el.textContent = I18N.remainingPoints.replace("{remaining}", remaining).replace("{total}", TOTAL_STAT_POINTS);
    el.className = "remaining-points" + (remaining === 0 ? " points-ok" : remaining < 0 ? " points-over" : " points-under");
}

function createCharacter() {
    const name = document.getElementById("playerName").value.trim() || I18N.unnamed;
    const stats = getStatsFromInputs();
    const existing = getPlayerData();

    if (!existing) {
        const validation = validateStatAllocation(stats);
        if (!validation.ok) { alert(validation.message); return; }
    } else {
        for (const key of STAT_KEYS) {
            if (!Number.isFinite(stats[key]) || stats[key] < MIN_STAT) {
                alert(I18N.statMinError.replace("{min}", MIN_STAT));
                return;
            }
        }
    }

    const xp = existing ? existing.xp : 0;
    const totalStudySeconds = existing ? (existing.totalStudySeconds || 0) : 0;
    const player = buildPlayer(name, stats, xp, { totalStudySeconds, grade: stats.grade });
    localStorage.setItem("player", JSON.stringify(player));
    updateStatus(player);
    updateXpDisplay(player);
    
    // Lock stat inputs after creation
    lockStatInputs(true);
    document.getElementById("statAllocationDesc").textContent = I18N.fixedStats;
    
    alert(I18N.charCreated);
}

function updateStatus(player) {
    document.getElementById("status").innerHTML =
        "<h2>" + I18N.status + "</h2>" +
        "<p><strong>" + I18N.playerNameLabel + "</strong>" + player.name + "</p>" +
        "<p><strong>" + I18N.level + I18N.colon + "</strong>" + (player.level || 1) + " <strong>" + I18N.xp + I18N.colon + "</strong>" + (player.xp || 0) + "</p><hr>" +
        "<p>HP" + I18N.colon + player.maxHp + "</p>" +
        "<p>" + I18N.atk + I18N.colon + player.atk + "</p>" +
        "<p>" + I18N.def + I18N.colon + player.def + "</p>" +
        "<p>" + I18N.speed + I18N.colon + player.speed + "</p>" +
        "<p>学年" + I18N.colon + player.grade + "</p><hr>" +
        "<p>" + I18N.totalStudy + formatTime(player.totalStudySeconds || 0) + "</p>";
}

function updateXpDisplay(player) {
    const el = document.getElementById("xpDisplay"); if (!el) return;
    const lv = player.level || 1, xp = player.xp || 0;
    el.textContent = I18N.xp + I18N.colon + xp + " (Lv." + lv + " -> " + I18N.xpNext + " " + xpToNextLevel(lv) + " XP)";
}

function getPlayerData() {
    const raw = localStorage.getItem("player");
    return raw ? migratePlayer(JSON.parse(raw)) : null;
}

function startStudy() {
    if (studyStartTime !== null) return;
    if (!getPlayerData()) { alert(I18N.needChar); return; }
    studyStartTime = Date.now();
    studyElapsedBefore = 0;
    document.getElementById("studyStart").disabled = true;
    document.getElementById("studyStop").disabled = false;
    document.getElementById("studyFocus").disabled = true;
    studyTimerInterval = setInterval(updateStudyTimerDisplay, 1000);
    updateStudyTimerDisplay();
}

function stopStudy() {
    if (studyStartTime === null) return;
    clearInterval(studyTimerInterval);
    studyTimerInterval = null;
    const elapsed = studyElapsedBefore + Math.floor((Date.now() - studyStartTime) / 1000);
    studyStartTime = null;
    studyElapsedBefore = 0;
    document.getElementById("studyStart").disabled = false;
    document.getElementById("studyStop").disabled = true;
    document.getElementById("studyFocus").disabled = false;
    applyStudyRewards(elapsed);
    document.getElementById("studyTimer").textContent = "00:00:00";
}

function updateStudyTimerDisplay() {
    if (studyStartTime === null) return;
    document.getElementById("studyTimer").textContent = formatTime(studyElapsedBefore + Math.floor((Date.now() - studyStartTime) / 1000));
}

// Map subjects to the 2 stats they strengthen
const SUBJECT_STATS = {
    jp: ["maxHp", "def"],     // 国語 → HP・防御
    math: ["atk", "speed"],   // 数学 → 攻撃・速さ
    eng: ["atk", "speed"],    // 英語 → 攻撃・速さ
    sci: ["atk", "def"],      // 理科 → 攻撃・防御
    soc: ["maxHp", "def"]     // 社会 → HP・防御
};

// Display stat growth info based on selected subject
function updateStatGrowthInfo() {
    const subject = document.getElementById("studyFocus").value;
    const [stat1, stat2] = SUBJECT_STATS[subject];
    const statNames = {
        maxHp: "HP",
        atk: I18N.atk,
        sp: I18N.sp,
        def: I18N.def,
        speed: I18N.speed
    };
    const infoEl = document.getElementById("statGrowthInfo");
    if (infoEl) {
        infoEl.innerHTML = `<p><strong>${I18N.statGrowthInfo}</strong>${statNames[stat1]}・${statNames[stat2]}</p>`;
    }
}

function applyStudyRewards(seconds) {
    if (seconds < 60) { alert("勉強時間は1分以上にしてください"); return; }
    const player = getPlayerData(); if (!player) return;
    const subject = document.getElementById("studyFocus").value;
    const stats = getStatsFromPlayer(player);
    const gainedXp = calcStudyXp(seconds);
    const statGain = calcStatGain(seconds);
    
    // Get the 2 stats to enhance for this subject
    const [stat1, stat2] = SUBJECT_STATS[subject];
    stats[stat1] += statGain;
    stats[stat2] += statGain;

    const hp = (stat1 === "maxHp" || stat2 === "maxHp")
        ? (player.hp || player.maxHp) + statGain
        : (player.hp || player.maxHp);

    const updated = buildPlayer(player.name, stats, (player.xp || 0) + gainedXp, { hp, totalStudySeconds: (player.totalStudySeconds || 0) + seconds });
    localStorage.setItem("player", JSON.stringify(updated));
    setStatsToInputs(stats);
    updateStatus(updated);
    updateXpDisplay(updated);
    const subjectLabel = { jp: I18N.hpDef, math: I18N.mathAtk, eng: I18N.engSp, sci: I18N.sciAtk, soc: I18N.socHp }[subject];
    alert(I18N.studyDone + "\n" + I18N.time + I18N.colon + formatTime(seconds) + "\n" + I18N.xp + " +" + gainedXp + "\n" + subjectLabel + I18N.statUp + " +" + statGain);
}

// Online event handlers are now in online.js
// document.getElementById("createRoom").onclick = () => { const p = getPlayerData(); if (!p) { alert(I18N.needChar); return; } socket.emit("playerJoin", p); socket.emit("createRoom", p); };
// document.getElementById("joinRoom").onclick = () => { const p = getPlayerData(); if (!p) { alert(I18N.needChar); return; } const roomId = document.getElementById("roomInput").value.trim().toUpperCase(); if (!roomId) { alert(I18N.roomCode + I18N.colon); return; } socket.emit("playerJoin", p); socket.emit("joinRoom", { roomId, player: p }); };
let matchmakingTimeout = null;
document.getElementById("randomMatch").onclick = () => { 
    const p = getPlayerData(); 
    if (!p) { alert(I18N.needChar); return; } 
    const btn = document.getElementById("randomMatch"); 
    btn.textContent = I18N.searching; 
    btn.disabled = true; 
    socket.emit("playerJoin", p); 
    socket.emit("requestRandomMatch", p);
    
    // Add cancel functionality
    matchmakingTimeout = setTimeout(() => {
        if(btn.disabled && btn.textContent === I18N.searching){
            btn.textContent = I18N.randomMatch;
            btn.disabled = false;
            alert("対戦相手が見つかりませんでした。時間をおいて再度お試しください。");
        }
    }, 30000); // 30 second timeout
};
function setupSocketEventHandlers() {
    if (!window.socket) return;

    window.socket.on("roomCreated", roomId => { alert(I18N.roomCreated + "\n\n" + I18N.roomCodeMsg + I18N.colon + roomId + "\n\n" + I18N.tellFriend); });
    window.socket.on("joinFailed", () => alert(I18N.roomNotFound));
    window.socket.on("roomReady", data => { localStorage.setItem("roomId", data.roomId); localStorage.setItem("battlePlayer", JSON.stringify(data.me)); localStorage.setItem("enemy", JSON.stringify(data.enemy)); alert(I18N.matched); location.href = "battle.html"; });
    window.socket.on("matchFound", data => {
        if(matchmakingTimeout) clearTimeout(matchmakingTimeout);
        localStorage.setItem("roomId", data.roomId);
        localStorage.setItem("battlePlayer", JSON.stringify(data.me));
        localStorage.setItem("enemy", JSON.stringify(data.enemy));
        alert(I18N.matchFound);
        location.href = "battle.html";
    });
    window.socket.on("matchCancelled", () => { const btn = document.getElementById("randomMatch"); btn.textContent = I18N.randomMatch; btn.disabled = false; alert(I18N.matchCancelled); });
    window.socket.on("errorMessage", m => alert(m));
}

function setupDOMEventHandlers() {
    const deleteBtn = document.getElementById("deletePlayerBtn");
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (!confirm(I18N.deleteConfirm)) return;
            if (studyStartTime !== null) stopStudy();
            localStorage.removeItem("player");
            localStorage.removeItem("battlePlayer");
            localStorage.removeItem("enemy");
            localStorage.removeItem("roomId");
            document.getElementById("playerName").value = "";
            setStatsToInputs(DEFAULT_STATS);
            document.getElementById("status").innerHTML = "<h2>" + I18N.status + "</h2><p>" + I18N.noChar + "</p>";
            updateXpDisplay({ xp: 0, level: 1 });
            alert(I18N.deleted);
        };
    }

    const studyStartBtn = document.getElementById("studyStart");
    if (studyStartBtn) {
        studyStartBtn.onclick = startStudy;
    }

    const studyStopBtn = document.getElementById("studyStop");
    if (studyStopBtn) {
        studyStopBtn.onclick = stopStudy;
    }

    const studyFocusSelect = document.getElementById("studyFocus");
    if (studyFocusSelect) {
        studyFocusSelect.onchange = updateStatGrowthInfo;
    }

    const randomMatchBtn = document.getElementById("randomMatch");
    if (randomMatchBtn) {
        randomMatchBtn.onclick = () => {
            const p = getPlayerData();
            if (!p) { alert(I18N.needChar); return; }
            const btn = document.getElementById("randomMatch");
            btn.textContent = I18N.searching;
            btn.disabled = true;
            if (!window.socket || !window.socket.connected) {
                btn.textContent = I18N.randomMatch;
                btn.disabled = false;
                alert("サーバーに接続されていません。ページを再読み込みしてください。");
                return;
            }
            window.socket.emit("playerJoin", p);
            window.socket.emit("requestRandomMatch", p);

            // Add cancel functionality
            matchmakingTimeout = setTimeout(() => {
                if(btn.disabled && btn.textContent === I18N.searching){
                    btn.textContent = I18N.randomMatch;
                    btn.disabled = false;
                    alert("対戦相手が見つかりませんでした。時間をおいて再度お試しください。");
                }
            }, 30000); // 30 second timeout
        };
    }
}

STAT_KEYS.forEach(key => {
    const inputId = key === "maxHp" ? "statMaxHp" : "stat" + key.charAt(0).toUpperCase() + key.slice(1);
    const el = document.getElementById(inputId);
    if (el) el.addEventListener("input", updateRemainingPoints);
});

function initializeI18nTexts() {
    // Set all i18n text elements
    const elements = {
        "subtitle": I18N.subtitle,
        "playerNameLabel": I18N.playerName,
        "statAllocationTitle": I18N.statAllocation,
        "statAllocationDesc": I18N.statAllocationDesc,
        "playerName": { placeholder: I18N.playerNamePh },
        "studyTimerTitle": I18N.studyTimer,
        "studyDesc": I18N.studyDesc,
        "studyFocusLabel": I18N.studyFocus,
        "createCharBtn": I18N.createChar,
        "studyStart": I18N.studyStart,
        "studyStop": I18N.studyStop,
        "onlineTitle": I18N.online,
        "randomMatch": I18N.randomMatch,
        "createRoom": I18N.createRoom,
        "joinRoom": I18N.joinRoom,
        "roomCodeLabel": I18N.roomCode,
        "roomInput": { placeholder: I18N.roomPh },
        "deletePlayerBtn": I18N.deletePlayer
    };

    for (const [id, text] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (!el) continue;
        
        if (typeof text === 'object' && text.placeholder) {
            el.placeholder = text.placeholder;
        } else {
            el.textContent = text;
        }
    }

    // Set select options for subjects
    const selectOptions = {
        "jpOpt": I18N.jp,
        "mathOpt": I18N.math,
        "engOpt": I18N.eng,
        "sciOpt": I18N.sci,
        "socOpt": I18N.soc
    };
    for (const [id, text] of Object.entries(selectOptions)) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // Set stat labels
    const labelTexts = {
        "atkLabelText": I18N.atk,
        "defLabelText": I18N.def,
        "speedLabelText": I18N.speed
    };
    for (const [id, text] of Object.entries(labelTexts)) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
}

window.onload = () => {
    // Check file protocol
    if (location.protocol === "file:") { alert(I18N.fileWarn); }

    // Initialize socket
    initializeSocket();

    // Setup socket event handlers
    setTimeout(setupSocketEventHandlers, 200);

    initializeI18nTexts();
    updateStatGrowthInfo();
    updateRemainingPoints();

    // Setup DOM event handlers
    setupDOMEventHandlers();

    const player = getPlayerData();
    if (player) {
        console.log("既存のプレイヤーデータ found:", player);
        updateStatus(player);
        updateXpDisplay(player);
        document.getElementById("playerName").value = player.name;
        setStatsToInputs(getStatsFromPlayer(player));
        // Lock stat inputs after character creation
        lockStatInputs(true);
        // Update stat allocation description for existing players
        document.getElementById("statAllocationDesc").textContent = I18N.fixedStats;
    } else {
        console.log("プレイヤーデータなし、デフォルト値を使用");
        setStatsToInputs(DEFAULT_STATS);
        updateXpDisplay({ xp: 0, level: 1 });
        lockStatInputs(false);
    }
};

function lockStatInputs(locked) {
    STAT_KEYS.forEach(key => {
        const inputId = key === "maxHp" ? "statMaxHp" : "stat" + key.charAt(0).toUpperCase() + key.slice(1);
        const el = document.getElementById(inputId);
        if (el) {
            el.disabled = locked;
            el.readOnly = locked;
        }
    });
    // Also lock the grade select
    const gradeSelect = document.getElementById("statGrade");
    if (gradeSelect) {
        gradeSelect.disabled = locked;
    }
    const createBtn = document.getElementById("createCharBtn");
    if (createBtn) {
        createBtn.disabled = locked;
        createBtn.textContent = locked ? I18N.statsLocked : I18N.createChar;
    }
}
