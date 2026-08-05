// ============================================
// School Battle
// PlayerManager.js
// Commit #009
// ============================================

const ContentFilter = require("./ContentFilter");
const players = {};

// -------------------------
// プレイヤー追加
// -------------------------

// -------------------------
// プレイヤー追加
// -------------------------

function addPlayer(socketId, player){

    // プレイヤー名のバリデーション
    if (player && player.name) {
        const validation = ContentFilter.validateName(player.name);
        if (!validation.valid) {
            console.log(`[PlayerManager] Invalid player name rejected: ${player.name} - ${validation.reason}`);
            throw new Error(validation.reason);
        }
    }

    players[socketId] = {

        ...player,

        socketId: socketId

    };

}

// -------------------------
// プレイヤー取得
// -------------------------

function getPlayer(socketId){

    return players[socketId];

}

// -------------------------
// 全取得
// -------------------------

function getPlayers(){

    return players;

}

// -------------------------
// 削除
// -------------------------

function removePlayer(socketId){

    delete players[socketId];

}

// -------------------------
// 存在確認
// -------------------------

function hasPlayer(socketId){

    return players.hasOwnProperty(socketId);

}

// -------------------------

module.exports={

    addPlayer,

    getPlayer,

    getPlayers,

    removePlayer,

    hasPlayer

};