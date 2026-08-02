// ============================================
// School Battle
// QuestionManager.js
// 問題データベース管理
// ============================================

const fs = require('fs');
const path = require('path');

// 問題データベースのパス
const QUESTIONS_DB_PATH = path.join(__dirname, '../data/questions.json');

// 問題データをキャッシュ
let questionsCache = null;

// -----------------------------
// 問題データベースを読み込む
// -----------------------------
function loadQuestions() {
    if (questionsCache) {
        return questionsCache;
    }

    try {
        const data = fs.readFileSync(QUESTIONS_DB_PATH, 'utf8');
        questionsCache = JSON.parse(data);
        return questionsCache;
    } catch (error) {
        console.error('問題データベースの読み込みエラー:', error);
        return null;
    }
}

// -----------------------------
// 学年と教科から問題を取得
// -----------------------------
function getQuestions(schoolLevel, grade, subject) {
    const questions = loadQuestions();
    if (!questions) {
        console.log(`[QuestionManager] getQuestions: questions database not loaded`);
        return [];
    }

    const schoolData = questions[schoolLevel];
    if (!schoolData) {
        console.log(`[QuestionManager] getQuestions: schoolLevel=${schoolLevel} not found`);
        return [];
    }

    const gradeData = schoolData[grade];
    if (!gradeData) {
        console.log(`[QuestionManager] getQuestions: grade=${grade} not found in schoolLevel=${schoolLevel}`);
        return [];
    }

    const subjectQuestions = gradeData[subject];
    if (!subjectQuestions) {
        console.log(`[QuestionManager] getQuestions: subject=${subject} not found in grade=${grade}`);
        return [];
    }

    console.log(`[QuestionManager] getQuestions: found ${subjectQuestions.length} questions for schoolLevel=${schoolLevel}, grade=${grade}, subject=${subject}`);
    return subjectQuestions;
}

// -----------------------------
// ランダムに問題を取得
// -----------------------------
function getRandomQuestion(schoolLevel, grade, subject) {
    const questions = getQuestions(schoolLevel, grade, subject);
    console.log(`[QuestionManager] getRandomQuestion: schoolLevel=${schoolLevel}, grade=${grade}, subject=${subject}, questions.length=${questions.length}`);
    if (questions.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * questions.length);
    return questions[randomIndex];
}

// -----------------------------
// 二人のプレイヤーの学年に基づいて問題を決定
// -----------------------------
function determineQuestionLevel(player1Grade, player2Grade) {
    // 学年が違う場合は、学年が下のほうに合わせる
    const minGrade = Math.min(player1Grade, player2Grade);
    
    // 学年から学校レベルを判定
    if (minGrade <= 6) {
        return { schoolLevel: 'elementary', grade: minGrade };
    } else if (minGrade <= 9) {
        return { schoolLevel: 'junior_high', grade: minGrade - 6 };
    } else {
        return { schoolLevel: 'high_school', grade: minGrade - 9 };
    }
}

// -----------------------------
// バトル用の問題を取得
// -----------------------------
function getBattleQuestion(player1Grade, player2Grade, subject) {
    const { schoolLevel, grade } = determineQuestionLevel(player1Grade, player2Grade);
    console.log(`[QuestionManager] getBattleQuestion: player1Grade=${player1Grade}, player2Grade=${player2Grade}, subject=${subject}, schoolLevel=${schoolLevel}, grade=${grade}`);
    const question = getRandomQuestion(schoolLevel, grade, subject);
    console.log(`[QuestionManager] Question result:`, question ? 'Found' : 'Not found');
    return question;
}

// -----------------------------
// 答えを確認
// -----------------------------
function checkAnswer(question, userAnswer) {
    if (!question) return false;
    
    // 正規化して比較（空白を削除、小文字に変換）
    const normalizedCorrect = question.answer.toLowerCase().replace(/\s/g, '');
    const normalizedUser = userAnswer.toLowerCase().replace(/\s/g, '');
    
    return normalizedCorrect === normalizedUser;
}

module.exports = {
    loadQuestions,
    getQuestions,
    getRandomQuestion,
    determineQuestionLevel,
    getBattleQuestion,
    checkAnswer
};