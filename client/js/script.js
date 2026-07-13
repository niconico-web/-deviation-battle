const socket = io();
let studyStartTime = null, studyTimerInterval = null, studyElapsedBefore = 0;

function createCharacter(){
    const name = document.getElementById("playerName").value.trim() || I18N.unnamed;
    const subjects = {
        jp: Number(document.getElementById("jp").value),
        math: Number(document.getElementById("math").value),
        eng: Number(document.getElementById("eng").value),
        sci: Number(document.getElementById("sci").value),
        soc: Number(document.getElementById("soc").value)
    };
    const existing = getPlayerData();
    const xp = existing ? existing.xp : 0;
    const totalStudySeconds = existing ? (existing.totalStudySeconds || 0) : 0;
    const player = buildPlayer(name, subjects, xp);
    player.totalStudySeconds = totalStudySeconds;
    localStorage.setItem("player", JSON.stringify(player));
    updateStatus(player);
    updateXpDisplay(player);
}

function updateStatus(player){
    const s = player.subjects || DEFAULT_SUBJECTS;
    document.getElementById("status").innerHTML =
        "<h2>" + I18N.status + "</h2>" +
        "<p><strong>" + I18N.playerNameLabel + "</strong>" + player.name + "</p>" +
        "<p><strong>" + I18N.level + I18N.colon + "</strong>" + (player.level || 1) +
        " <strong>" + I18N.xp + I18N.colon + "</strong>" + (player.xp || 0) + "</p><hr>" +
        "<p>HP" + I18N.colon + player.maxHp + "</p>" +
        "<p>" + I18N.atk + I18N.colon + player.atk + "</p>" +
        "<p>" + I18N.sp + I18N.colon + player.sp + "</p>" +
        "<p>" + I18N.def + I18N.colon + player.def + "</p>" +
        "<p>" + I18N.speed + I18N.colon + player.speed + "</p><hr>" +
        "<p>" + I18N.jp + " " + s.jp + " / " + I18N.math + " " + s.math + " / " + I18N.eng + " " + s.eng + "</p>" +
        "<p>" + I18N.sci + " " + s.sci + " / " + I18N.soc + " " + s.soc + "</p>" +
        "<p>" + I18N.totalStudy + formatTime(player.totalStudySeconds || 0) + "</p>";
}

function updateXpDisplay(player){
    const el = document.getElementById("xpDisplay");
    if(!el) return;
    const lv = player.level || 1, xp = player.xp || 0;
    el.textContent = I18N.xp + I18N.colon + xp + " (Lv." + lv + " \u2192 " + I18N.xpNext + " " + xpToNextLevel(lv) + " XP)";
}

function getPlayerData(){ const r = localStorage.getItem("player"); return r ? JSON.parse(r) : null; }
function getSubjectsFromInputs(){
    return {
        jp: Number(document.getElementById("jp").value),
        math: Number(document.getElementById("math").value),
        eng: Number(document.getElementById("eng").value),
        sci: Number(document.getElementById("sci").value),
        soc: Number(document.getElementById("soc").value)
    };
}

function startStudy(){
    if(studyStartTime !== null) return;
    if(!getPlayerData()){ alert(I18N.needChar); return; }
    studyStartTime = Date.now();
    studyElapsedBefore = 0;
    document.getElementById("studyStart").disabled = true;
    document.getElementById("studyStop").disabled = false;
    document.getElementById("studyFocus").disabled = true;
    studyTimerInterval = setInterval(updateStudyTimerDisplay, 1000);
    updateStudyTimerDisplay();
}

function stopStudy(){
    if(studyStartTime === null) return;
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

function updateStudyTimerDisplay(){
    if(studyStartTime === null) return;
    const elapsed = studyElapsedBefore + Math.floor((Date.now() - studyStartTime) / 1000);
    document.getElementById("studyTimer").textContent = formatTime(elapsed);
}

function applyStudyRewards(seconds){
    if(seconds < 5){ alert(I18N.studyTooShort); return; }
    const player = getPlayerData();
    if(!player) return;
    const focus = document.getElementById("studyFocus").value;
    const subjects = player.subjects || getSubjectsFromInputs();
    const gainedXp = calcStudyXp(seconds);
    const subjectGain = calcSubjectGain(seconds);
    subjects[focus] = clampSubject(subjects[focus] + subjectGain);
    const updated = buildPlayer(player.name, subjects, (player.xp || 0) + gainedXp);
    updated.totalStudySeconds = (player.totalStudySeconds || 0) + seconds;
    localStorage.setItem("player", JSON.stringify(updated));
    ["jp","math","eng","sci","soc"].forEach(k => document.getElementById(k).value = subjects[k]);
    updateStatus(updated);
    updateXpDisplay(updated);
    alert(I18N.studyDone + "\n" + I18N.time + I18N.colon + formatTime(seconds) + "\n" + I18N.xp + " +" + gainedXp + "\n" + SUBJECT_LABELS[focus] + I18N.deviationUp + " +" + subjectGain.toFixed(2) + I18N.slightUp);
}

document.getElementById("createRoom").onclick = () => {
    const p = getPlayerData();
    if(!p){ alert(I18N.needChar); return; }
    socket.emit("playerJoin", p);
    socket.emit("createRoom");
};

document.getElementById("joinRoom").onclick = () => {
    const p = getPlayerData();
    if(!p){ alert(I18N.needChar); return; }
    const roomId = document.getElementById("roomInput").value.trim().toUpperCase();
    if(!roomId){ alert(I18N.roomCode + I18N.colon + I18N.playerNamePh); return; }
    socket.emit("playerJoin", p);
    socket.emit("joinRoom", roomId);
};

socket.on("roomCreated", (roomId) => {
    alert(I18N.roomCreated + "\n\n" + I18N.roomCodeMsg + I18N.colon + roomId + "\n\n" + I18N.tellFriend);
});
socket.on("joinFailed", () => alert(I18N.roomNotFound));
socket.on("roomReady", (data) => {
    localStorage.setItem("roomId", data.roomId);
    localStorage.setItem("player", JSON.stringify(data.me));
    localStorage.setItem("enemy", JSON.stringify(data.enemy));
    localStorage.setItem("myTurn", String(data.myTurn));
    alert(I18N.matched);
    location.href = "battle.html";
});
socket.on("errorMessage", (m) => alert(m));

document.getElementById("deletePlayer").onclick = () => {
    if(!confirm(I18N.deleteConfirm)) return;
    if(studyStartTime !== null) stopStudy();
    localStorage.removeItem("player");
    localStorage.removeItem("enemy");
    localStorage.removeItem("roomId");
    document.getElementById("playerName").value = "";
    document.getElementById("status").innerHTML = "<h2>" + I18N.status + "</h2><p>" + I18N.noChar + "</p>";
    updateXpDisplay({ xp: 0, level: 1 });
    alert(I18N.deleted);
};

document.getElementById("studyStart").onclick = startStudy;
document.getElementById("studyStop").onclick = stopStudy;

window.onload = () => {
    const player = getPlayerData();
    if(player){
        updateStatus(player);
        updateXpDisplay(player);
        document.getElementById("playerName").value = player.name;
        if(player.subjects){
            ["jp","math","eng","sci","soc"].forEach(k => document.getElementById(k).value = player.subjects[k]);
        }
    } else {
        updateXpDisplay({ xp: 0, level: 1 });
    }
};
