const result = localStorage.getItem("battleResult");

const turn = localStorage.getItem("battleTurn") || "0";

const playerHP = localStorage.getItem("playerHP") || "0";

const enemyHP = localStorage.getItem("enemyHP") || "0";

const damage = localStorage.getItem("totalDamage") || "0";

const critical = localStorage.getItem("criticalCount") || "0";

const title = document.getElementById("resultTitle");

if(result === "win"){

    title.textContent = "? YOU WIN";
    title.className = "win";

}else{

    title.textContent = "? YOU LOSE";
    title.className = "lose";

}

document.getElementById("turnText").textContent =
    "ターン数 : " + turn;

document.getElementById("hpText").textContent =
    "残りHP : " + playerHP;

document.getElementById("damageText").textContent =
    "合計ダメージ : " + damage;

document.getElementById("criticalText").textContent =
    "クリティカル : " + critical + " 回";

document.getElementById("retryBtn").onclick = () => {
    location.href = "index.html";
};

document.getElementById("homeBtn").onclick = () => {
    location.href = "index.html";
};
