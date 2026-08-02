const fs = require("fs");
const path = require("path");

const CLAIMS_FILE = path.join(__dirname, "../data/unique_claims.json");

// グローバルIOインスタンス（サーバー起動時に設定）
let ioInstance = null;

function setIO(io) {
    ioInstance = io;
}

function loadClaims() {
    try {
        return JSON.parse(fs.readFileSync(CLAIMS_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveClaims(claims) {
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claims, null, 2), "utf8");
}

function getAllClaims() {
    return loadClaims();
}

function getClaim(type) {
    return loadClaims()[type] || null;
}

function tryClaim(type, playerId, playerName) {
    const claims = loadClaims();
    if (claims[type]) {
        return { success: false, claimedBy: claims[type] };
    }
    claims[type] = {
        playerId,
        playerName,
        claimedAt: Date.now(),
        completed: true // クエスト完了フラグ
    };
    saveClaims(claims);
    
    // 全員に通知を送信（クエスト完了通知）
    if (ioInstance) {
        ioInstance.emit("uniqueQuestCompleted", {
            type,
            weaponName: getWeaponName(type),
            playerName
        });
    }
    
    return { success: true, claim: claims[type] };
}

function getWeaponName(type) {
    const weaponNames = {
        sword_shield: "神盾剣ゼウス・ヘカテー",
        spear: "神槍　天照",
        greatsword: "ベルゼバブ",
        dual_swords: "巨狼　オルトロス",
        scythe: "魂狩りの鎌",
        pistol: "終末の銃",
        katana: "天叢雲剣"
    };
    return weaponNames[type] || type;
}

module.exports = {
    getAllClaims,
    getClaim,
    tryClaim,
    setIO
};
