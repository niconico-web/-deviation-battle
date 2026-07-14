const socket = io();
let studyStartTime = null, studyTimerInterval = null, studyElapsedBefore = 0;
if (location.protocol === "file:") { alert(I18N.fileWarn); }

function getStatsFromInputs() {
    return {
        maxHp: Math.floor(Number(document.getElementById("statMaxHp").value)),
        atk: Math.floor(Number(document.getElementById("statAtk").value)),
        sp: Math.floor(Number(document.getElementById("statSp").value)),
        def: Math.floor(Number(document.getElementById("statDef").value)),
        speed: Math.floor(Number(document.getElementById("statSpeed").value))
    };
}

function setStatsToInputs(stats) {
    document.getElementById("statMaxHp").value = stats.maxHp;
    document.getElementById("statAtk").value = stats.atk;
    document.getElementById("statSp").value = stats.sp;
    document.getElementById("statDef").value = stats.def;
    document.getElementById("statSpeed").value = stats.speed;
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
    const player = buildPlayer(name, stats, xp, { totalStudySeconds });
    localStorage.setItem("player", JSON.stringify(player));
    updateStatus(player);
    updateXpDisplay(player);
    alert(I18N.charCreated);
}

function updateStatus(player) {
    document.getElementById("status").innerHTML =
        "<h2>" + I18N.status + "</h2>" +
        "<p><strong>" + I18N.playerNameLabel + "</strong>" + player.name + "</p>" +
        "<p><strong>" + I18N.level + I18N.colon + "</strong>" + (player.level || 1) + " <strong>" + I18N.xp + I18N.colon + "</strong>" + (player.xp || 0) + "</p><hr>" +
        "<p>HP" + I18N.colon + player.maxHp + "</p>" +
        "<p>" + I18N.atk + I18N.colon + player.atk + "</p>" +
        "<p>" + I18N.sp + I18N.colon + player.sp + "</p>" +
        "<p>" + I18N.def + I18N.colon + player.def + "</p>" +
        "<p>" + I18N.speed + I18N.colon + player.speed + "</p><hr>" +
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

function applyStudyRewards(seconds) {
    if (seconds < 5) { alert(I18N.studyTooShort); return; }
    const player = getPlayerData(); if (!player) return;
    const focus = document.getElementById("studyFocus").value;
    const stats = getStatsFromPlayer(player);
    const gainedXp = calcStudyXp(seconds);
    const statGain = calcStatGain(seconds);
    stats[focus] += statGain;

    const hp = focus === "maxHp"
        ? (player.hp || player.maxHp) + statGain
        : (player.hp || player.maxHp);

    const updated = buildPlayer(player.name, stats, (player.xp || 0) + gainedXp, { hp, totalStudySeconds: (player.totalStudySeconds || 0) + seconds });
    localStorage.setItem("player", JSON.stringify(updated));
    setStatsToInputs(stats);
    updateStatus(updated);
    updateXpDisplay(updated);
    alert(I18N.studyDone + "\n" + I18N.time + I18N.colon + formatTime(seconds) + "\n" + I18N.xp + " +" + gainedXp + "\n" + STAT_LABELS[focus] + I18N.statUp + " +" + statGain);
}

document.getElementById("createRoom").onclick = () => { const p = getPlayerData(); if (!p) { alert(I18N.needChar); return; } socket.emit("playerJoin", p); socket.emit("createRoom", p); };
document.getElementById("joinRoom").onclick = () => { const p = getPlayerData(); if (!p) { alert(I18N.needChar); return; } const roomId = document.getElementById("roomInput").value.trim().toUpperCase(); if (!roomId) { alert(I18N.roomCode + I18N.colon); return; } socket.emit("playerJoin", p); socket.emit("joinRoom", { roomId, player: p }); };
socket.on("roomCreated", roomId => { alert(I18N.roomCreated + "\n\n" + I18N.roomCodeMsg + I18N.colon + roomId + "\n\n" + I18N.tellFriend); });
socket.on("joinFailed", () => alert(I18N.roomNotFound));
socket.on("roomReady", data => { localStorage.setItem("roomId", data.roomId); localStorage.setItem("battlePlayer", JSON.stringify(data.me)); localStorage.setItem("enemy", JSON.stringify(data.enemy)); localStorage.setItem("myTurn", String(data.myTurn)); alert(I18N.matched); location.href = "battle.html"; });
socket.on("errorMessage", m => alert(m));
document.getElementById("deletePlayer").onclick = () => {
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
document.getElementById("studyStart").onclick = startStudy;
document.getElementById("studyStop").onclick = stopStudy;

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
        "createRoomBtn": I18N.createRoom,
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

    // Set select options
    const selectOptions = {
        "atkOpt": I18N.math,
        "spOpt": I18N.eng,
        "defOpt": I18N.sci,
        "speedOpt": I18N.soc
    };
    for (const [id, text] of Object.entries(selectOptions)) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // Set stat labels
    const atkLabel = document.getElementById("atkLabel");
    if (atkLabel) atkLabel.textContent = I18N.math;
    const spLabel = document.getElementById("spLabel");
    if (spLabel) spLabel.textContent = I18N.eng;
    const defLabel = document.getElementById("defLabel");
    if (defLabel) defLabel.textContent = I18N.sci;
    const speedLabel = document.getElementById("speedLabel");
    if (speedLabel) speedLabel.textContent = I18N.soc;
}

window.onload = () => {
    initializeI18nTexts();
    
    const player = getPlayerData();
    if (player) {
        updateStatus(player);
        updateXpDisplay(player);
        document.getElementById("playerName").value = player.name;
        setStatsToInputs(getStatsFromPlayer(player));
    } else {
        setStatsToInputs(DEFAULT_STATS);
        updateXpDisplay({ xp: 0, level: 1 });
    }
};
