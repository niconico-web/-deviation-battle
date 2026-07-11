// ============================================
// School Battle
// PlayerManager.js
// Commit #009
// ============================================

const players = {};

// -------------------------
// プレイヤー追加
// -------------------------

// -------------------------
// プレイヤー追加
// -------------------------

function addPlayer(socketId, player){

    players[socketId] = {

        id: socketId,

        ...player

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