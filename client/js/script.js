// ============================================
// School Battle
// script.js
// Commit #008
// Part 1 / 4
// ============================================

const socket = io();

// ============================================
// ステータス
// ============================================

let hp = 0;
let atk = 0;
let sp = 0;
let def = 0;
let speed = 0;

// ============================================
// キャラクター作成
// ============================================

function createCharacter() {

    const name =
        document.getElementById("playerName").value.trim() || "名無し";

    const jp =
        Number(document.getElementById("jp").value);

    const math =
        Number(document.getElementById("math").value);

    const eng =
        Number(document.getElementById("eng").value);

    const sci =
        Number(document.getElementById("sci").value);

    const soc =
        Number(document.getElementById("soc").value);

    // ----------------------------
    // ステータス計算
    // ----------------------------

    hp =
        Math.max(
            50,
            100 + (jp - 50) * 4 + (soc - 50) * 2
        );

    atk =
        Math.max(
            20,
            50 + (math - 50) * 5 + (sci - 50) * 2
        );

    sp =
        Math.max(
            20,
            50 + (eng - 50) * 5 + (sci - 50) * 2
        );

    def =
        Math.max(
            20,
            50 + (soc - 50) * 5 + (jp - 50) * 2
        );

    speed =
        Math.max(
            20,
            50 + (eng - 50) * 3 + (math - 50) * 2
        );

    // プレイヤーデータ

    const player = {

        name,

        hp,

        maxHp: hp,

        atk,

        sp,

        def,

        speed

    };

    // 保存

    localStorage.setItem(

        "player",

        JSON.stringify(player)

    );

    // 表示更新

    updateStatus(player);

}
// ============================================
// Commit #008
// Part 2 / 4
// ============================================

// ============================================
// ステータス表示
// ============================================

function updateStatus(player) {

    document.getElementById("status").innerHTML = `

<h2>ステータス</h2>

<p><strong>プレイヤー名：</strong>${player.name}</p>

<hr>

<p>❤️ HP：${player.hp}</p>

<p>⚔ 攻撃：${player.atk}</p>

<p>✨ 特殊：${player.sp}</p>

<p>🛡 防御：${player.def}</p>

<p>💨 素早さ：${player.speed}</p>

`;

}

// ============================================
// プレイヤーデータ取得
// ============================================

function getPlayerData(){

    return JSON.parse(

        localStorage.getItem("player")

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
// ============================================
// Commit #008
// Part 3 / 4
// ============================================

// ============================================
// ルーム作成完了
// ============================================

socket.on("roomCreated", (roomId) => {

    alert(
        "ルームを作成しました！\n\nルームコード：" +
        roomId +
        "\n\n友達に教えてください。"
    );

});

// ============================================
// ルーム参加失敗
// ============================================

socket.on("joinFailed", () => {

    alert("ルームが見つかりません。");

});

// ============================================
// マッチ成立
// ============================================

socket.on("roomReady", (data) => {

    // 部屋番号保存
    localStorage.setItem(

        "roomId",

        data.roomId

    );

    // 自分
localStorage.setItem(
    "player",
    JSON.stringify(data.me)
);

localStorage.setItem(
    "enemy",
    JSON.stringify(data.enemy)
);

localStorage.setItem(
    "myTurn",
    data.myTurn
);

    localStorage.setItem(

        "enemy",

        JSON.stringify(enemy)

    );

    alert("マッチングしました！");

    window.location.href = "battle.html";

});
// ============================================
// Commit #008
// Part 4 / 4
// ============================================

// ============================================
// Socket接続
// ============================================

socket.on("connected", () => {

    console.log("✅ サーバーに接続しました。");

});

// ============================================
// Socket切断
// ============================================

socket.on("disconnect", () => {

    console.log("❌ サーバーとの接続が切れました。");

});

// ============================================
// エラー受信
// ============================================

socket.on("errorMessage", (message) => {

    alert(message);

});

// ============================================
// 初期化
// ============================================

window.onload = () => {

    const player = getPlayerData();

    if(player){

        updateStatus(player);

        document.getElementById("playerName").value = player.name;

    }

    console.log("School Battle Lobby Ready");

};

// ============================================
// デバッグ用
// ============================================

window.debugPlayer = () => {

    console.log(getPlayerData());

};

window.clearSave = () => {

    localStorage.removeItem("player");
    localStorage.removeItem("enemy");
    localStorage.removeItem("roomId");

    alert("セーブデータを削除しました。");

};
// ============================================
// プレイヤー削除
// ============================================

document.getElementById("deletePlayer").onclick = () => {

    if (!confirm("プレイヤーデータを削除しますか？")) {
        return;
    }

    localStorage.removeItem("player");
    localStorage.removeItem("enemy");
    localStorage.removeItem("roomId");

    document.getElementById("playerName").value = "";

    document.getElementById("status").innerHTML = `
        <h2>ステータス</h2>
        <p>まだキャラクターが作成されていません。</p>
    `;

    alert("プレイヤーデータを削除しました。");

};