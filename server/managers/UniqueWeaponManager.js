const fs = require("fs");
const path = require("path");

const CLAIMS_FILE = path.join(__dirname, "../data/unique_claims.json");

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
        claimedAt: Date.now()
    };
    saveClaims(claims);
    return { success: true, claim: claims[type] };
}

module.exports = {
    getAllClaims,
    getClaim,
    tryClaim
};
