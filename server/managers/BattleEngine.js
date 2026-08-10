// ============================================
// School Battle
// BattleEngine.js
// 早解き問題対戦型バトルシステム
// ============================================

const QuestionManager = require("./QuestionManager");

// -----------------------------
// 定数
// -----------------------------

const BASE_DAMAGE = 10;
const SPEED_BONUS_MULTIPLIER = 0.5; // 速さによるダメージボーナス
const TIME_PENALTY_PER_SECOND = 2; // 1秒あたりのダメージペナルティ

// 必殺技システム
const ULTIMATE_GAUGE_MAX = 100; // 必殺技ゲージ最大値
const ULTIMATE_GAUGE_PER_CORRECT = 20; // 正解ごとのゲージ増加量
const ULTIMATE_DAMAGE_MULTIPLIER = 1.5; // 必殺技発動時のダメージ倍率

// -----------------------------
// ランダム
// -----------------------------

function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===================================
// ユニーク能力関連ヘルパー関数
// ===================================

/**
 * プレイヤーが特定のユニーク能力を持っているかチェック
 */
function hasUniqueAbility(player, effectKey) {
    if (!player.equippedWeapon || !player.equippedWeapon.uniqueAbilities) {
        return false;
    }
    return player.equippedWeapon.uniqueAbilities.some(ability => ability.effect === effectKey);
}

/**
 * ステータスにオーブの固有能力（リ・ミゼラブル）を適用
 */
function applyOrbDebuffs(stats, player) {
    if (!player) return stats;
    
    const result = { ...stats };
    
    // リ・ミゼラブル: 相手の全ステータスを0.8倍
    if (hasUniqueAbility(player, "enemy_stat_debuff")) {
        result.atk = Math.floor(result.atk * 0.8);
        result.def = Math.floor(result.def * 0.8);
        result.speed = Math.floor(result.speed * 0.8);
        result.maxHp = Math.floor(result.maxHp * 0.8);
    }
    
    // 貫通: 防御を50%減らす
    if (hasUniqueAbility(player, "ignore_def_half")) {
        result.def = Math.floor(result.def * 0.5);
    }
    
    return result;
}

// -----------------------------
// 新しい問題を生成
// -----------------------------

function generateQuestion(battle) {
    const playerIds = Object.keys(battle.players);
    const player1 = battle.players[playerIds[0]];
    const player2 = battle.players[playerIds[1]];

    console.log(`[BattleEngine] generateQuestion: player1Grade=${player1.grade}, player2Grade=${player2.grade}`);

    // 教科をランダムに選択
    let subject = ['math', 'jp', 'english'][Math.floor(Math.random() * 3)];
    console.log(`[BattleEngine] Selected subject: ${subject}`);

    // 二人のプレイヤーの学年に基づいて問題を取得（選択肢付き）
    let question = QuestionManager.getBattleQuestionWithOptions(player1.grade, player2.grade, subject);

    // もし最初の教科で問題が見つからなかった場合、他の教科を試す
    if (!question) {
        console.warn(`[BattleEngine] No question found for subject ${subject}. Trying other subjects.`);
        const otherSubjects = ['math', 'jp', 'english'].filter(s => s !== subject);
        for (const nextSubject of otherSubjects) {
            question = QuestionManager.getBattleQuestionWithOptions(player1.grade, player2.grade, nextSubject);
            if (question) {
                subject = nextSubject; // Update subject to the one that had a question
                console.log(`[BattleEngine] Found question in fallback subject: ${subject}`);
                break;
            }
        }
    }

    console.log(`[BattleEngine] Question result:`, question);

    // プレイヤーの回答時間をリセット（新しい問題の前にリセット）
    playerIds.forEach(id => {
        battle.players[id].answerTime = null;
    });

    if (!question) {
        // 問題が見つからない場合の最終フォールバック
        console.error(`[BattleEngine] ULTIMATE FALLBACK: No questions found in any subject for grades ${player1.grade}-${player2.grade}.`);
        // デフォルトの問題を返す
        battle.currentQuestion = {
            question: "1 + 1 = ?",
            answer: "2",
            subject: 'math', // Default to math
            subjectDisplayName: QuestionManager.getSubjectDisplayName('math'),
            startTime: Date.now()
        };
        // generate options for the fallback
        battle.currentQuestion.options = QuestionManager.generateOptions(battle.currentQuestion.answer);

        return battle.currentQuestion;
    }

    // バトルに問題情報を追加
    battle.currentQuestion = {
        ...question,
        subject: subject,
        subjectDisplayName: QuestionManager.getSubjectDisplayName(subject),
        startTime: Date.now()
    };

    console.log(`[BattleEngine] Generated question:`, battle.currentQuestion);

    return battle.currentQuestion;
}

// -----------------------------
// ダメージ計算
// -----------------------------

function calculateDamage(attacker, defender, answerTimeMs, isSureHit = false, attackerAtk = null) {
    // attackerAtkが渡されなかった場合は、元のステータスを使用
    const baseAtk = attackerAtk !== null ? attackerAtk : attacker.atk;
    // 基本ダメージ
    let damage = BASE_DAMAGE + Math.floor(baseAtk * 0.3);

    // 回答時間によるペナルティ（1秒あたりTIME_PENALTY_PER_SECOND）
    const answerTimeSeconds = answerTimeMs / 1000;
    const timePenalty = Math.floor(answerTimeSeconds * TIME_PENALTY_PER_SECOND);
    damage = Math.max(1, damage - timePenalty);

    // 素早さが90を超える場合、超過分を攻撃ボーナスに変換
    const speed = attacker.speed || 0;
    if (speed > 90) {
        const excessSpeed = speed - 90;
        const attackBonus = Math.floor(excessSpeed * 0.1); // 超過分の10%を攻撃ボーナス
        damage += attackBonus;
    }

    // ランダム要素（±5）
    damage += randomRange(-5, 5);

    // 最小ダメージ保証
    damage = Math.max(1, damage);

    // 回避率の計算
    let dodgeChance = 0;
    if (!isSureHit && defender) {
        const defenderSpeed = defender.speed || 0;
        // 素早さ7500で最大回避率45%に到達する、二次関数的な上昇カーブ
        const maxSpeed = 7500;
        const maxDodge = 45; // 45%
        if (defenderSpeed > 0) {
            const calculatedDodge = maxDodge * Math.pow(defenderSpeed / maxSpeed, 2);
            dodgeChance = Math.min(calculatedDodge, maxDodge); // 上限を45%に設定
        }
    }

    return {
        damage,
        dodgeChance
    };
}

// ===================================
// 必殺技とダメージボーナス計算
// ===================================

/**
 * ユニーク能力によるダメージボーナスを適用
 */
function applyUniqueAbilityDamageBonus(damage, attacker) {
    let finalDamage = damage;
    
    // 必殺: 20%の確率でダメージ1.5倍
    if (hasUniqueAbility(attacker, "critical_damage")) {
        if (Math.random() < 0.20) {
            finalDamage = Math.floor(finalDamage * 1.5);
        }
    }
    
    return finalDamage;
}

/**
 * ユニーク能力によるダメージ軽減を適用
 */
function applyUniqueAbilityDefense(damage, defender) {
    let finalDamage = damage;
    
    // 鉄壁: ダメージ50%カット
    if (hasUniqueAbility(defender, "damage_cut_half")) {
        finalDamage = Math.floor(finalDamage * 0.5);
    }
    
    return finalDamage;
}

/**
 * ライフドレイン: 与えたダメージの20%をHP回復
 */
function applyLifeDrain(attacker, damageDealt) {
    if (!hasUniqueAbility(attacker, "life_drain")) {
        return 0;
    }
    const healAmount = Math.floor(damageDealt * 0.2);
    return healAmount;
}

// -----------------------------
// 回答を処理
// -----------------------------

function processAnswer(battle, playerId, answer) {
    const player = battle.players[playerId];
    const enemyId = Object.keys(battle.players).find(id => id !== playerId);
    const enemy = battle.players[enemyId];
    
    if (!battle.currentQuestion) {
        return { error: "No active question" };
    }
    
    // 回答時間を記録
    const answerTime = Date.now() - battle.currentQuestion.startTime;
    player.answerTime = answerTime;
    
    // 正解チェック
    const isCorrect = QuestionManager.checkAnswer(battle.currentQuestion, answer);
    
    let result = {
        playerId,
        playerName: player.name,
        isCorrect,
        answerTime,
        question: battle.currentQuestion.question
    };
    
    // 両方のプレイヤーが回答したかチェック
    const bothAnswered = player.answerTime !== null && enemy.answerTime !== null;
    
    if (isCorrect) {
        // 正解の場合
        player.correctAnswers++;
        
        // 必殺技ゲージを初期化（存在しない場合）
        if (!player.ultimateGauge) {
            player.ultimateGauge = { current: 0, max: ULTIMATE_GAUGE_MAX };
        }
        
        // 必殺技ゲージを増加
        player.ultimateGauge.current = Math.min(player.ultimateGauge.max, player.ultimateGauge.current + ULTIMATE_GAUGE_PER_CORRECT);
        result.ultimateGauge = player.ultimateGauge.current;
        result.ultimateReady = player.ultimateGauge.current >= player.ultimateGauge.max;
        
        // 先に正解した場合のみダメージを与える
        if (!enemy.answerTime) {
            // 「根性」の攻撃力アップ効果
            let attackerAtk = player.atk;
            if (player.hp === 1 && hasUniqueAbility(player, 'guts')) {
                attackerAtk = Math.floor(attackerAtk * 3);
                result.gutsAtkBoost = true;
                result.gutsAtkBoostPlayerName = player.name;
            }

            // 攻撃者が必中能力を持っているかチェック
            const isAttackerSureHit = hasUniqueAbility(player, "ignore_evasion");
            
            let damageResult = calculateDamage(player, enemy, answerTime, isAttackerSureHit, attackerAtk);
            let damage = damageResult.damage;
            const dodgeChance = damageResult.dodgeChance;
            
            // 必殺技発動判定（ゲージが満タンの場合）
            let ultimateActivated = false;
            if (player.ultimateGauge.current >= player.ultimateGauge.max) {
                damage = Math.floor(damage * ULTIMATE_DAMAGE_MULTIPLIER);
                ultimateActivated = true;
                result.ultimateActivated = true;
                result.ultimateDamage = damage;
                // 必殺技発動後、ゲージをリセット
                player.ultimateGauge.current = 0;
                result.ultimateGauge = 0;
                result.ultimateReady = false;
            }
            
            // ユニーク能力によるダメージボーナスを適用
            damage = applyUniqueAbilityDamageBonus(damage, player);
            
            // 回避判定
            const dodgeRoll = Math.random() * 100;
            if (dodgeRoll < dodgeChance) {
                result.damage = 0;
                result.dodged = true;
                result.dodgeChance = dodgeChance;
            } else {
                // ユニーク能力によるダメージ軽減を適用（防御側）
                let finalDamage = applyUniqueAbilityDefense(damage, enemy);

                if (enemy.hp - finalDamage <= 0 && enemy.hp > 1 && hasUniqueAbility(enemy, 'guts')) {
                    enemy.hp = 1;
                    result.gutsSurvive = true;
                    result.gutsSurvivePlayerName = enemy.name;
                } else {
                    enemy.hp = Math.max(0, enemy.hp - finalDamage);
                }
                result.damage = finalDamage;
                result.enemyHp = enemy.hp;
                result.firstCorrect = true;
                
                // ライフドレイン: ダメージの20%をHP回復
                const healAmount = applyLifeDrain(player, finalDamage);
                if (healAmount > 0) {
                    player.hp = Math.min(player.maxHp, player.hp + healAmount);
                    result.lifedrainHealed = healAmount;
                }
            }
            
            // 勝利判定
            if (enemy.hp <= 0) {
                battle.finished = true;
                result.winner = playerId;
            }
        } else {
            // 相手が既に回答している場合、ダメージなし
            result.firstCorrect = false;
        }
    } else {
        // 不正解の場合 - 間違えた方がダメージを受ける
        // 「根性」の攻撃力アップ効果
        let attackerAtk = enemy.atk;
        if (enemy.hp === 1 && hasUniqueAbility(enemy, 'guts')) {
            attackerAtk = Math.floor(attackerAtk * 3);
            result.gutsAtkBoost = true;
            result.gutsAtkBoostPlayerName = enemy.name;
        }

        // 敵が必中能力を持っているかチェック
        const isEnemySureHit = hasUniqueAbility(enemy, "ignore_evasion");
        
        const damageResult = calculateDamage(enemy, player, 0, isEnemySureHit, attackerAtk);
        let damage = damageResult.damage;
        const dodgeChance = damageResult.dodgeChance;
        
        // ユニーク能力によるダメージボーナスを適用
        damage = applyUniqueAbilityDamageBonus(damage, enemy);
        
        // 回避判定
        const dodgeRoll = Math.random() * 100;
        if (dodgeRoll < dodgeChance) {
            result.damage = 0;
            result.dodged = true;
            result.dodgeChance = dodgeChance;
        } else {
            // ユニーク能力によるダメージ軽減を適用（防御側）
            let finalDamage = applyUniqueAbilityDefense(damage, player);

            if (player.hp - finalDamage <= 0 && player.hp > 1 && hasUniqueAbility(player, 'guts')) {
                player.hp = 1;
                result.gutsSurvive = true;
                result.gutsSurvivePlayerName = player.name;
            } else {
                player.hp = Math.max(0, player.hp - finalDamage);
            }
            result.damage = finalDamage;
            result.playerHp = player.hp;
            result.firstCorrect = false;
            result.wrongAnswer = true;
            
            // ライフドレイン: ダメージの20%をHP回復
            const healAmount = applyLifeDrain(enemy, finalDamage);
            if (healAmount > 0) {
                enemy.hp = Math.min(enemy.maxHp, enemy.hp + healAmount);
                result.enemyLifedrainHealed = healAmount;
            }
        }
        
        // 勝利判定
        if (player.hp <= 0) {
            battle.finished = true;
            result.winner = enemyId;
            console.log(`[BattleEngine] Player ${playerId} HP reached 0, winner: ${enemyId}`);
        }
    }
    
    // 一方が正解した場合、または両方のプレイヤーが回答した場合、次の問題へ
    if ((isCorrect || bothAnswered) && !battle.finished) {
        generateQuestion(battle);
        result.nextQuestion = battle.currentQuestion;
    }
    
    // バトルが終了した場合、winnerをresultに含める
    if (battle.finished && result.winner) {
        console.log(`[BattleEngine] Battle finished, winner: ${result.winner}`);
    }
    
    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

// ===================================
// バトル初期化時の処理
// ===================================

/**
 * バトル開始時のステータス調整
 * リ・ミゼラブルなどの能力を適用
 */
function applyBattleStartEffects(battle) {
    const playerIds = Object.keys(battle.players);
    
    for (const playerId of playerIds) {
        const player = battle.players[playerId];
        
        // リ・ミゼラブル: 相手のステータスを0.8倍にする処理
        // (各プレイヤーのステータスは既に武器補正が適用されているため、
        //  敵のステータスを直接変更する必要がある)
        if (hasUniqueAbility(player, "enemy_stat_debuff")) {
            const enemyId = playerIds.find(id => id !== playerId);
            if (enemyId) {
                const enemy = battle.players[enemyId];
                console.log(`[BattleEngine] Applying リ・ミゼラブル debuff to ${enemy.name}`);
                enemy.atk = Math.floor(enemy.atk * 0.8);
                enemy.def = Math.floor(enemy.def * 0.8);
                enemy.speed = Math.floor(enemy.speed * 0.8);
                enemy.maxHp = Math.floor(enemy.maxHp * 0.8);
                
                // 現在のHPも比率を保って調整
                enemy.hp = Math.floor(enemy.hp * 0.8);
            }
        }
    }
}

// -----------------------------
// バトル開始時の初期化
// -----------------------------

function initializeBattle(battle) {
    // バトル開始時のエフェクトを適用（リ・ミゼラブルなど）
    applyBattleStartEffects(battle);
    
    // 最初の問題を生成
    generateQuestion(battle);
    
    return {
        battle,
        initialQuestion: battle.currentQuestion
    };
}

// -----------------------------
// バトル終了時の処理
// -----------------------------

function finalizeBattle(battle) {
    const playerIds = Object.keys(battle.players);
    const player1 = battle.players[playerIds[0]];
    const player2 = battle.players[playerIds[1]];
    
    let winner, loser;
    
    if (player1.hp > 0) {
        winner = player1;
        loser = player2;
    } else if (player2.hp > 0) {
        winner = player2;
        loser = player1;
    } else {
        // 引き分け
        return {
            draw: true,
            players: battle.players
        };
    }
    
    return {
        winner: winner.id,
        loser: loser.id,
        players: battle.players
    };
}

module.exports = {
    generateQuestion,
    calculateDamage,
    processAnswer,
    initializeBattle,
    finalizeBattle
};
