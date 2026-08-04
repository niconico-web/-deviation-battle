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

// -----------------------------
// ランダム
// -----------------------------

function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
    const subjects = ['math', 'jp', 'english'];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    
    console.log(`[BattleEngine] Selected subject: ${subject}`);
    
    // 二人のプレイヤーの学年に基づいて問題を取得
    const question = QuestionManager.getBattleQuestion(player1.grade, player2.grade, subject);
    
    console.log(`[BattleEngine] Question result:`, question);
    
    if (!question) {
        // 問題が見つからない場合のフォールバック
        console.warn(`問題が見つかりません: player1Grade=${player1.grade}, player2Grade=${player2.grade}, subject=${subject}`);
        // デフォルトの問題を返す
        battle.currentQuestion = {
            question: "1 + 1 = ?",
            answer: "2",
            subject: subject,
            subjectDisplayName: QuestionManager.getSubjectDisplayName(subject),
            startTime: Date.now()
        };
        
        // プレイヤーの回答時間をリセット
        playerIds.forEach(id => {
            battle.players[id].answerTime = null;
        });
        
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
    
    // プレイヤーの回答時間をリセット
    playerIds.forEach(id => {
        battle.players[id].answerTime = null;
    });
    
    return battle.currentQuestion;
}

// -----------------------------
// ダメージ計算
// -----------------------------

function calculateDamage(attacker, answerTimeMs) {
    // 基本ダメージ
    let damage = BASE_DAMAGE + Math.floor(attacker.atk * 0.3);
    
    // 回答時間によるペナルティ（1秒あたりTIME_PENALTY_PER_SECOND）
    const answerTimeSeconds = answerTimeMs / 1000;
    const timePenalty = Math.floor(answerTimeSeconds * TIME_PENALTY_PER_SECOND);
    damage = Math.max(1, damage - timePenalty);
    
    // 速さによるボーナス
    const speedBonus = Math.floor(attacker.speed * SPEED_BONUS_MULTIPLIER);
    damage += speedBonus;
    
    // ランダム要素（±5）
    damage += randomRange(-5, 5);
    
    // 最小ダメージ保証
    damage = Math.max(1, damage);
    
    return damage;
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
        isCorrect,
        answerTime,
        question: battle.currentQuestion.question
    };
    
    if (isCorrect) {
        // 正解の場合
        player.correctAnswers++;
        
        // 先に正解した場合のみダメージを与える
        if (!enemy.answerTime) {
            const damage = calculateDamage(player, answerTime);
            enemy.hp = Math.max(0, enemy.hp - damage);
            
            result.damage = damage;
            result.enemyHp = enemy.hp;
            result.firstCorrect = true;
            
            // 勝利判定
            if (enemy.hp <= 0) {
                battle.finished = true;
                result.winner = playerId;
            } else {
                // バトル終了でなければ、即座に次の問題へ
                generateQuestion(battle);
                result.nextQuestion = battle.currentQuestion;
            }
        } else {
            // 相手が既に回答している場合、ダメージなし
            result.firstCorrect = false;
        }
    } else {
        // 不正解の場合 - 間違えた方がダメージを受ける
        const damage = calculateDamage(enemy, 0); // 相手の攻撃力でダメージ計算
        player.hp = Math.max(0, player.hp - damage);
        
        result.damage = damage;
        result.playerHp = player.hp;
        result.firstCorrect = false;
        result.wrongAnswer = true;
        
        // 勝利判定
        if (player.hp <= 0) {
            battle.finished = true;
            result.winner = enemyId;
        } else {
            // バトル終了でなければ、即座に次の問題へ
            generateQuestion(battle);
            result.nextQuestion = battle.currentQuestion;
        }
    }
    
    return {
        ...result,
        battleState: {
            players: battle.players,
            finished: battle.finished
        }
    };
}

// -----------------------------
// バトル開始時の初期化
// -----------------------------

function initializeBattle(battle) {
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