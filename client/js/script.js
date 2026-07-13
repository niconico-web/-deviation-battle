// ============================================
// School Battle - Lobby
// ============================================

const socket = io();

let studyStartTime = null;
let studyTimerInterval = null;
let studyElapsedBefore = 0;

// ============================================
// キャラクター作成
// ============================================

function createCharacter(){

    const name =
        document.getElementById("playerName").value.trim() || "無名";

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

// ============================================
// ステータス表示
// ============================================

function updateStatus(player){

    const subjects = player.subjects || DEFAULT_SUBJECTS;

    document.getElementById("status").innerHTML = `
<h2>ステータス</h2>
<p><strong>プレイヤー名：</strong>${player.name}</p>
<p><strong>レベル：</strong>${player.level || 1}　<strong>経験値：</strong>${player.xp || 0}</p>
<hr>
<p>?? HP：${player.maxHp}</p>
<p>? 攻撃：${player.atk}</p>
<p>? 特殊：${player.sp}</p>
<p>? 防御：${player.def}</p>
<p>? 速さ：${player.speed}</p>
<hr>
<p>国語 ${subjects.jp} / 数学 ${subjects.math} / 英語 ${subjects.eng}</p>
<p>理科 ${subjects.sci} / 社会 ${subjects.soc}</p>
<p>累計勉強時間：${formatTime(player.totalStudySeconds || 0)}</p>
`;

}

function updateXpDisplay(player){

    const xpEl = document.getElementById("xpDisplay");

    if(!xpEl) return;

    const level = player.level || 1;
    const xp = player.xp || 0;
    const needed = xpToNextLevel(level);

    xpEl.textContent = `経験値：${xp}（Lv.${level} → 次まで ${needed} XP）`;

}

// ============================================
// プレイヤーデータ取得
// ============================================

function getPlayerData(){

    const raw = localStorage.getItem("player");

    return raw ? JSON.parse(raw) : null;

}

function getSubjectsFromInputs(){

    return {
        jp: Number(document.getElementById("jp").value),
        math: Number(document.getElementById("math").value),
        eng: Number(document.getElementById("eng").value),
        sci: Number(document.getElementById("sci").value),
        soc: Number(document.getElementById("soc").value)
    };

}

// ============================================
// 勉強タイマー
// ============================================

function startStudy(){

    if(studyStartTime !== null) return;

    const player = getPlayerData();

    if(!player){

        alert("先にキャラクターを作成してください。");
        return;

    }

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

    const elapsed = studyElapsedBefore +
        Math.floor((Date.now() - studyStartTime) / 1000);

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

    const elapsed = studyElapsedBefore +
        Math.floor((Date.now() - studyStartTime) / 1000);

    document.getElementById("studyTimer").textContent = formatTime(elapsed);

}

function applyStudyRewards(seconds){

    if(seconds < 5){

        alert("5秒未満の勉強では報酬はもらえません。");
        return;

    }

    const player = getPlayerData();

    if(!player) return;

    const focus = document.getElementById("studyFocus").value;
    const subjects = player.subjects || getSubjectsFromInputs();
    const gainedXp = calcStudyXp(seconds);
    const subjectGain = calcSubjectGain(seconds);

    subjects[focus] = clampSubject(subjects[focus] + subjectGain);

    const newXp = (player.xp || 0) + gainedXp;
    const updated = buildPlayer(player.name, subjects, newXp);
    updated.totalStudySeconds = (player.totalStudySeconds || 0) + seconds;

    localStorage.setItem("player", JSON.stringify(updated));

    document.getElementById("jp").value = subjects.jp;
    document.getElementById("math").value = subjects.math;
    document.getElementById("eng").value = subjects.eng;
    document.getElementById("sci").value = subjects.sci;
    document.getElementById("soc").value = subjects.soc;

    updateStatus(updated);
    updateXpDisplay(updated);

    const label = SUBJECT_LABELS[focus];

    alert(
        `勉強完了！\n` +
        `時間：${formatTime(seconds)}\n` +
        `経験値 +${gainedXp}\n` +
        `${label}偏差値 +${subjectGain.toFixed(2)}（かなり少し）`
    );

}

// ============================================
// ルーム作成
// ============================================

document.getElementById("createRoom").onclick = () => {

    const player = getPlayerData();

    if(!player){

        alert("先にキャラクターを作成してください。");
        return;

    }

    socket.emit("playerJoin", player);
    socket.emit("createRoom");

};

// ============================================
// ルーム参加
// ============================================

document.getElementById("joinRoom").onclick = () => {

    const player = getPlayerData();

    if(!player){

        alert("先にキャラクターを作成してください。");
        return;

    }

    const roomId = document
        .getElementById("roomInput")
        .value
        .trim()
        .toUpperCase();

    if(roomId === ""){

        alert("ルームコードを入力してください。");
        return;

    }

    socket.emit("playerJoin", player);
    socket.emit("joinRoom", roomId);

};

socket.on("roomCreated", (roomId) => {

    alert(
        "ルームを作成しました！\n\nルームコード：" +
        roomId +
        "\n\n友達に伝えてください。"
    );

});

socket.on("joinFailed", () => {

    alert("ルームが見つかりません。");

});

socket.on("roomReady", (data) => {

    localStorage.setItem("roomId", data.roomId);
    localStorage.setItem("player", JSON.stringify(data.me));
    localStorage.setItem("enemy", JSON.stringify(data.enemy));
    localStorage.setItem("myTurn", String(data.myTurn));

    alert("マッチングしました！");

    location.href = "battle.html";

});

socket.on("connected", () => {

    console.log("サーバーに接続しました。");

});

socket.on("disconnect", () => {

    console.log("サーバーとの接続が切れました。");

});

socket.on("errorMessage", (message) => {

    alert(message);

});

document.getElementById("deletePlayer").onclick = () => {

    if(!confirm("プレイヤーデータを削除しますか？")){
        return;
    }

    if(studyStartTime !== null){
        stopStudy();
    }

    localStorage.removeItem("player");
    localStorage.removeItem("enemy");
    localStorage.removeItem("roomId");

    document.getElementById("playerName").value = "";

    document.getElementById("status").innerHTML = `
        <h2>ステータス</h2>
        <p>まだキャラクターが作成されていません。</p>
    `;

    updateXpDisplay({ xp: 0, level: 1 });

    alert("プレイヤーデータを削除しました。");

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

            document.getElementById("jp").value = player.subjects.jp;
            document.getElementById("math").value = player.subjects.math;
            document.getElementById("eng").value = player.subjects.eng;
            document.getElementById("sci").value = player.subjects.sci;
            document.getElementById("soc").value = player.subjects.soc;

        }

    }else{

        updateXpDisplay({ xp: 0, level: 1 });

    }

    console.log("School Battle Lobby Ready");

};

window.debugPlayer = () => {
    console.log(getPlayerData());
};

window.clearSave = () => {

    localStorage.removeItem("player");
    localStorage.removeItem("enemy");
    localStorage.removeItem("roomId");

    alert("セーブデータを削除しました。");

};
