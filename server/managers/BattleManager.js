// ============================================
// School Battle
// BattleManager.js
// Commit #011
// Part 1 / 6
// ============================================

const battles = {};

// -----------------------------
// ?????
// -----------------------------

function createBattle(roomId, host, guest){

    if(!host?.id || !guest?.id){
        return null;
    }

    console.log(`[BattleManager] createBattle: host.grade=${host.grade}, guest.grade=${guest.grade}`);

    battles[roomId] = {

        roomId,

        players:{

            [host.id]:{

                id: host.id,
                socketId: host.socketId,
                name: host.name,

                hp: host.maxHp,
                maxHp: host.maxHp,

                atk: host.atk,
                def: host.def,
                speed: host.speed,
                grade: host.grade || 1,

                equippedWeapon: host.equippedWeapon || null,

                answerTime: null,
                correctAnswers: 0

            },

            [guest.id]:{

                id: guest.id,
                socketId: guest.socketId,
                name: guest.name,

                hp: guest.maxHp,
                maxHp: guest.maxHp,

                atk: guest.atk,
                def: guest.def,
                speed: guest.speed,
                grade: guest.grade || 1,

                equippedWeapon: guest.equippedWeapon || null,

                answerTime: null,
                correctAnswers: 0

            }

        },

        turn: null,

        finished: false

    };

    return battles[roomId];

}

// -----------------------------
// ?????
// -----------------------------

function getBattle(roomId){

    return battles[roomId];

}

// -----------------------------
// ???????
// -----------------------------

function getPlayer(roomId,id){

    const battle = battles[roomId];

    if(!battle) return null;

    return battle.players[id];

}

// -----------------------------
// ????
// -----------------------------

function getEnemy(roomId,id){

    const battle = battles[roomId];

    if(!battle) return null;

    const ids = Object.keys(battle.players);

    const enemyId = ids.find(
        playerId => playerId !== id
    );

    return battle.players[enemyId];

}

// -----------------------------
// ?????
// -----------------------------

function nextTurn(roomId){

    const battle = battles[roomId];

    if(!battle) return;

    const ids = Object.keys(battle.players);

    battle.turn = ids.find(
        id => id !== battle.turn
    );

}

// -----------------------------
// ?????
// -----------------------------

function finishBattle(roomId){

    if(!battles[roomId]) return;

    battles[roomId].finished = true;

}

// -----------------------------
// ソケ�?�?IDの付け替え（�?��?�ジ遷移後�?�再接続用?�?
// -----------------------------

function findPlayerIdBySocket(battle, socketId) {
    return Object.keys(battle.players).find(
        id => battle.players[id].socketId === socketId
    );
}

function remapPlayerSocket(roomId, oldPlayerId, newSocketId){

    const battle = battles[roomId];

    if(!battle || !battle.players[oldPlayerId]) return false;

    battle.players[oldPlayerId].socketId = newSocketId;

    return true;

}

// -----------------------------
// ?????
// -----------------------------

function deleteBattle(roomId){

    delete battles[roomId];

}

module.exports = {

    createBattle,

    getBattle,

    getPlayer,

    getEnemy,

    nextTurn,

    finishBattle,

    deleteBattle,

    findPlayerIdBySocket,

    remapPlayerSocket

};