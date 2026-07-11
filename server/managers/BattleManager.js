// ============================================
// School Battle
// BattleManager.js
// Commit #011
// Part 1 / 6
// ============================================

const battles = {};

// -----------------------------
// バトル作成
// -----------------------------

function createBattle(roomId, host, guest){

    battles[roomId] = {

        roomId,

        players:{

            [host.id]:{

                id:host.id,
                name:host.name,

                hp:host.maxHp,
                maxHp:host.maxHp,

                atk:host.atk,
                sp:host.sp,
                def:host.def,
                speed:host.speed,

                guard:false,
                ultimate:0

            },

            [guest.id]:{

                id:guest.id,
                name:guest.name,

                hp:guest.maxHp,
                maxHp:guest.maxHp,

                atk:guest.atk,
                sp:guest.sp,
                def:guest.def,
                speed:guest.speed,

                guard:false,
                ultimate:0

            }

        },

        turn:

            host.speed >= guest.speed

            ? host.id

            : guest.id,

        finished:false

    };

    return battles[roomId];

}

// -----------------------------
// バトル取得
// -----------------------------

function getBattle(roomId){

    return battles[roomId];

}

// -----------------------------
// プレイヤー取得
// -----------------------------

function getPlayer(roomId,id){

    const battle = battles[roomId];

    if(!battle) return null;

    return battle.players[id];

}

// -----------------------------
// 相手取得
// -----------------------------

function getEnemy(roomId,id){

    const battle = battles[roomId];

    if(!battle) return null;

    const ids = Object.keys(

        battle.players

    );

    const enemyId = ids.find(

        playerId => playerId !== id

    );

    return battle.players[enemyId];

}

// -----------------------------
// ターン変更
// -----------------------------

function nextTurn(roomId){

    const battle = battles[roomId];

    if(!battle) return;

    const ids = Object.keys(

        battle.players

    );

    battle.turn =

        ids.find(

            id=>id!==battle.turn

        );

}

// -----------------------------
// バトル終了
// -----------------------------

function finishBattle(roomId){

    if(!battles[roomId]) return;

    battles[roomId].finished = true;

}

// -----------------------------
// バトル削除
// -----------------------------

function deleteBattle(roomId){

    delete battles[roomId];

}

module.exports={

    createBattle,

    getBattle,

    getPlayer,

    getEnemy,

    nextTurn,

    finishBattle,

    deleteBattle

};