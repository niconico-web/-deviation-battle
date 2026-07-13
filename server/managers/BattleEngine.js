// ============================================
// School Battle
// BattleEngine.js
// Commit #012
// Part 1 / 5
// ============================================

// -----------------------------
// å®šæ•°
// -----------------------------

const HIT_RATE = 95;
const DODGE_RATE = 5;

const CRITICAL_RATE = 0.20;
const CRITICAL_POWER = 1.5;

const RANDOM_DAMAGE_MIN = -5;
const RANDOM_DAMAGE_MAX = 5;

const GUARD_RATE = 0.5;

// -----------------------------
// ãƒ©ãƒ³ãƒ€ãƒ?
// -----------------------------

function randomRange(min,max){

    return Math.floor(
        Math.random() *
        (max-min+1)
    ) + min;

}

// -----------------------------
// ãƒ€ãƒ¡ãƒ¼ã‚¸è¨ˆç®?
// -----------------------------

function calculateDamage(
    attacker,
    target,
    power
){

    // å‘½ä¸­
    if(Math.random()*100 > HIT_RATE){

        return{

            damage:0,

            miss:true,

            critical:false

        };

    }

    // å›é¿
    if(Math.random()*100 < DODGE_RATE){

        return{

            damage:0,

            miss:true,

            critical:false

        };

    }

    let damage =

        power

        - target.def*0.5

        + randomRange(
            RANDOM_DAMAGE_MIN,
            RANDOM_DAMAGE_MAX
        );

    let critical = false;

    if(Math.random() < CRITICAL_RATE){

        critical = true;

        damage *= CRITICAL_POWER;

    }

    if(target.guard){

        damage *= GUARD_RATE;

    }

    damage = Math.floor(damage);

    if(damage<1){

        damage=1;

    }

    target.hp -= damage;

    if(target.hp<0){

        target.hp=0;

    }

    target.guard=false;

    return{

        damage,

        miss:false,

        critical,

        hp:target.hp

    };

}

// -----------------------------
// å¿?æ®ºæŠ€
// -----------------------------

function calculateUltimate(
    attacker,
    target
){

    return calculateDamage(

        attacker,

        target,

        Math.floor(attacker.sp*2.5)

    );

}

// -----------------------------
// é€šå¸¸æ”»æ’?
// -----------------------------

function calculateAttack(
    attacker,
    target
){

    return calculateDamage(

        attacker,

        target,

        attacker.atk

    );

}

// -----------------------------
// ç‰¹æ®Šæ”»æ’?
// -----------------------------

function calculateSpecial(
    attacker,
    target
){

    return calculateDamage(

        attacker,

        target,

        Math.floor(attacker.sp*1.3)

    );

}

// -----------------------------
// é˜²å¾¡
// -----------------------------

function guard(player){

    player.guard = true;

}

// -----------------------------
// -----------------------------
// è¡Œå‹•å®Ÿè¡?
// -----------------------------

function executeAction(
    battle,
    attackerId,
    action
){

    const attacker =
        battle.players[attackerId];

    const defenderId =
        Object.keys(battle.players)
        .find(id => id !== attackerId);

    const defender =
        battle.players[defenderId];

    let result;

    switch(action){

        case "attack":

            result =
                calculateAttack(
                    attacker,
                    defender
                );

            break;

        case "special":

            result =
                calculateSpecial(
                    attacker,
                    defender
                );

            break;

        case "guard":

            guard(attacker);

            result = {

                damage:0,
                guard:true

            };

            break;

        case "ultimate":

            if(attacker.ultimate < 100){

                return null;

            }

            result =
                calculateUltimate(
                    attacker,
                    defender
                );

            attacker.ultimate = 0;

            break;

        default:

            return null;

    }

    // •KEƒQ[ƒWi•KEg—p‚ÍÁ”ïÏ‚İ‚Ì‚½‚ß‰ÁZ‚µ‚È‚¢j

    if(action !== "ultimate"){

        attacker.ultimate += 20;

        if(attacker.ultimate>100){

            attacker.ultimate=100;

        }

    }

    // ã‚¿ãƒ¼ãƒ³äº¤ä»£

    battle.turn = defenderId;

    // å‹æ•—

    if(defender.hp<=0){

        battle.finished = true;
    }

    return{

        attacker,

        defender,

        action,

        result,

        turn:battle.turn,

        winner:

            battle.finished

            ? attacker.id

            : null

    };

}
module.exports={

    calculateAttack,

    calculateSpecial,

    calculateUltimate,

    guard,

    executeAction

};