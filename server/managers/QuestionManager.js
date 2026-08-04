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
// 選択肢を生成
// -----------------------------
function generateOptions(answer) {
    const options = [answer];
    
    // 答えが数値の場合
    if (!isNaN(answer)) {
        const numAnswer = parseInt(answer);
        const usedNumbers = new Set([numAnswer]);
        
        // よくある計算ミスを想定した誤答を生成
        const wrongAnswers = generateNumericWrongAnswers(numAnswer);
        
        for (const wrong of wrongAnswers) {
            if (!usedNumbers.has(wrong) && options.length < 4) {
                usedNumbers.add(wrong);
                options.push(String(wrong));
            }
        }
        
        // まだ足りない場合は従来の方法で追加
        while (options.length < 4) {
            let offset;
            if (Math.random() < 0.5) {
                offset = Math.floor(Math.random() * 5) + 1;
            } else {
                offset = -(Math.floor(Math.random() * 5) + 1);
            }
            
            const wrongAnswer = numAnswer + offset;
            if (!usedNumbers.has(wrongAnswer) && wrongAnswer >= 0) {
                usedNumbers.add(wrongAnswer);
                options.push(String(wrongAnswer));
            }
        }
    } else {
        // 文字列の場合は意味のある誤答を生成
        const wrongAnswers = generateStringWrongAnswers(answer);
        const usedAnswers = new Set([answer]);
        
        for (const wrong of wrongAnswers) {
            if (!usedAnswers.has(wrong) && options.length < 4) {
                usedAnswers.add(wrong);
                options.push(wrong);
            }
        }
        
        // まだ足りない場合は類似した文字列を生成
        while (options.length < 4) {
            const similar = generateSimilarString(answer);
            if (!usedAnswers.has(similar)) {
                usedAnswers.add(similar);
                options.push(similar);
            }
        }
    }
    
    // 選択肢をシャッフル
    return shuffleArray(options);
}

// 数値の誤答を生成（よくある計算ミスを想定）
function generateNumericWrongAnswers(correct) {
    const wrongs = [];
    
    // 符号ミス（正解が正の場合は負を、負の場合は正を追加）
    if (correct > 0) {
        wrongs.push(-correct);
    } else if (correct < 0) {
        wrongs.push(Math.abs(correct));
    }
    
    // ±1, ±2, ±5 の計算ミス
    const offsets = [1, 2, 5, -1, -2, -5];
    for (const offset of offsets) {
        const wrong = correct + offset;
        if (wrong !== correct && wrong >= 0) {
            wrongs.push(wrong);
        }
    }
    
    // 掛け算ミス（正解がxなら2xやx/2を追加）
    if (correct !== 0) {
        wrongs.push(correct * 2);
        if (correct % 2 === 0) {
            wrongs.push(correct / 2);
        }
    }
    
    // シャッフルして返す
    return shuffleArray(wrongs);
}

// 文字列の誤答を生成（意味のある誤答）
function generateStringWrongAnswers(correct) {
    const wrongs = [];
    
    // ひらがなの場合、類似したひらがなを生成
    if (isHiragana(correct)) {
        wrongs.push(...generateSimilarHiragana(correct));
    }
    // 英語の場合、類似した単語やスペルミスを生成
    else if (isEnglish(correct)) {
        wrongs.push(...generateSimilarEnglish(correct));
    }
    // その他の場合、類似した文字列を生成
    else {
        wrongs.push(...generateSimilarStringArray(correct));
    }
    
    return shuffleArray(wrongs);
}

// ひらがなかどうかを判定
function isHiragana(str) {
    return /^[\u3040-\u309F]+$/.test(str);
}

// 英語かどうかを判定
function isEnglish(str) {
    return /^[a-zA-Z\s]+$/.test(str);
}

// 類似したひらがなを生成
function generateSimilarHiragana(hiragana) {
    const similar = [];
    const hiraganaMap = {
        'あ': ['あ', 'い', 'う', 'お', 'か'],
        'い': ['あ', 'い', 'う', 'き', 'し'],
        'う': ['あ', 'い', 'う', 'え', 'く', 'す'],
        'え': ['あ', 'う', 'え', 'お', 'け', 'せ'],
        'お': ['あ', 'え', 'お', 'こ', 'そ'],
        'か': ['あ', 'か', 'き', 'く', 'け', 'が'],
        'き': ['い', 'か', 'き', 'く', 'ぎ', 'し'],
        'く': ['う', 'か', 'き', 'く', 'け', 'ぐ', 'す'],
        'け': ['え', 'か', 'く', 'け', 'こ', 'げ', 'せ'],
        'こ': ['お', 'か', 'け', 'こ', 'ご', 'そ'],
        'さ': ['あ', 'さ', 'し', 'す', 'せ', 'ざ'],
        'し': ['い', 'さ', 'し', 'す', 'じ', 'ち'],
        'す': ['う', 'さ', 'し', 'す', 'せ', 'ず', 'つ'],
        'せ': ['え', 'さ', 'す', 'せ', 'そ', 'ぜ'],
        'そ': ['お', 'さ', 'せ', 'そ', 'ぞ'],
        'た': ['あ', 'た', 'ち', 'つ', 'て', 'だ'],
        'ち': ['い', 'た', 'ち', 'つ', 'ぢ', 'に'],
        'つ': ['う', 'た', 'ち', 'つ', 'て', 'づ'],
        'て': ['え', 'た', 'つ', 'て', 'と', 'で'],
        'と': ['お', 'た', 'て', 'と', 'ど'],
        'な': ['あ', 'な', 'に', 'ぬ', 'ね'],
        'に': ['い', 'な', 'に', 'ぬ', 'ち'],
        'ぬ': ['う', 'な', 'に', 'ぬ', 'ね'],
        'ね': ['え', 'な', 'ぬ', 'ね', 'の'],
        'の': ['お', 'な', 'ね', 'の'],
        'は': ['あ', 'は', 'ひ', 'ふ', 'へ', 'ば'],
        'ひ': ['い', 'は', 'ひ', 'ふ', 'び', 'に'],
        'ふ': ['う', 'は', 'ひ', 'ふ', 'へ', 'ぶ'],
        'へ': ['え', 'は', 'ふ', 'へ', 'ほ', 'べ'],
        'ほ': ['お', 'は', 'へ', 'ほ', 'ぼ'],
        'ま': ['あ', 'ま', 'み', 'む', 'め'],
        'み': ['い', 'ま', 'み', 'む', 'に'],
        'む': ['う', 'ま', 'み', 'む', 'め'],
        'め': ['え', 'ま', 'む', 'め', 'も'],
        'も': ['お', 'ま', 'め', 'も'],
        'や': ['あ', 'や', 'ゆ', 'よ'],
        'ゆ': ['う', 'や', 'ゆ', 'よ'],
        'よ': ['お', 'や', 'ゆ', 'よ'],
        'ら': ['あ', 'ら', 'り', 'る', 'れ'],
        'り': ['い', 'ら', 'り', 'る', 'に'],
        'る': ['う', 'ら', 'り', 'る', 'れ'],
        'れ': ['え', 'ら', 'る', 'れ', 'ろ'],
        'ろ': ['お', 'ら', 'れ', 'ろ'],
        'わ': ['あ', 'わ', 'を', 'ん'],
        'を': ['お', 'わ', 'を', 'ん'],
        'ん': ['ん', 'わ', 'を']
    };
    
    for (let i = 0; i < hiragana.length; i++) {
        const char = hiragana[i];
        const similarChars = hiraganaMap[char] || [];
        for (const similarChar of similarChars) {
            if (similarChar !== char) {
                const newStr = hiragana.substring(0, i) + similarChar + hiragana.substring(i + 1);
                if (newStr !== hiragana && !similar.includes(newStr)) {
                    similar.push(newStr);
                }
            }
        }
    }
    
    // 文字の順序を入れ替えた誤答
    if (hiragana.length >= 2) {
        for (let i = 0; i < hiragana.length - 1; i++) {
            const swapped = hiragana.substring(0, i) + hiragana[i + 1] + hiragana[i] + hiragana.substring(i + 2);
            if (swapped !== hiragana && !similar.includes(swapped)) {
                similar.push(swapped);
            }
        }
    }
    
    return similar;
}

// 類似した英語を生成
function generateSimilarEnglish(english) {
    const similar = [];
    const lowerEnglish = english.toLowerCase();
    
    // よくある単語の関連付け
    const wordAssociations = {
        'red': ['blue', 'green', 'yellow', 'black', 'white'],
        'blue': ['red', 'green', 'yellow', 'sky', 'sea'],
        'green': ['red', 'blue', 'yellow', 'grass', 'leaf'],
        'yellow': ['red', 'blue', 'green', 'orange', 'gold'],
        'black': ['white', 'red', 'blue', 'dark', 'night'],
        'white': ['black', 'red', 'blue', 'light', 'day'],
        'dog': ['cat', 'bird', 'fish', 'animal', 'pet'],
        'cat': ['dog', 'bird', 'fish', 'animal', 'pet'],
        'bird': ['dog', 'cat', 'fish', 'fly', 'sky'],
        'fish': ['dog', 'cat', 'bird', 'swim', 'water'],
        'book': ['pen', 'paper', 'read', 'study', 'library'],
        'school': ['home', 'work', 'study', 'class', 'teacher'],
        'teacher': ['student', 'school', 'class', 'work', 'job'],
        'run': ['walk', 'jump', 'swim', 'fast', 'move'],
        'walk': ['run', 'jump', 'swim', 'slow', 'move'],
        'eat': ['drink', 'cook', 'food', 'meal', 'hungry'],
        'see': ['look', 'watch', 'hear', 'listen', 'view'],
        'hear': ['see', 'listen', 'sound', 'noise', 'speak'],
        'speak': ['hear', 'talk', 'say', 'tell', 'voice'],
        'happy': ['sad', 'glad', 'joy', 'smile', 'fun'],
        'sad': ['happy', 'glad', 'cry', 'tear', 'sorry'],
        'big': ['small', 'large', 'huge', 'tiny', 'little'],
        'small': ['big', 'large', 'tiny', 'little', 'short'],
        'hot': ['cold', 'warm', 'cool', 'fire', 'sun'],
        'cold': ['hot', 'warm', 'cool', 'ice', 'snow'],
        'good': ['bad', 'nice', 'great', 'fine', 'well'],
        'bad': ['good', 'nice', 'evil', 'wrong', 'poor'],
        'fast': ['slow', 'quick', 'rapid', 'speed', 'swift'],
        'slow': ['fast', 'quick', 'rapid', 'lazy', 'late'],
        'like': ['love', 'hate', 'enjoy', 'prefer', 'want'],
        'hate': ['like', 'love', 'dislike', 'angry', 'fear'],
        'if': ['when', 'while', 'because', 'although', 'unless'],
        'when': ['if', 'while', 'because', 'after', 'before'],
        'because': ['if', 'when', 'so', 'since', 'as'],
        'after': ['before', 'when', 'while', 'since', 'next'],
        'before': ['after', 'when', 'while', 'ago', 'previous'],
        'yes': ['no', 'maybe', 'right', 'correct', 'true'],
        'no': ['yes', 'maybe', 'wrong', 'incorrect', 'false']
    };
    
    // 関連単語を追加
    const associations = wordAssociations[lowerEnglish] || [];
    for (const assoc of associations) {
        if (assoc.toLowerCase() !== lowerEnglish && !similar.includes(assoc)) {
            similar.push(assoc);
        }
    }
    
    // スペルミスを生成（1文字変更）
    for (let i = 0; i < english.length; i++) {
        const originalChar = english[i];
        const replacementChars = 'abcdefghijklmnopqrstuvwxyz';
        for (const replacement of replacementChars) {
            if (replacement !== originalChar.toLowerCase()) {
                const misspelled = english.substring(0, i) + replacement + english.substring(i + 1);
                if (misspelled.toLowerCase() !== lowerEnglish && !similar.includes(misspelled)) {
                    similar.push(misspelled);
                    if (similar.length >= 5) break;
                }
            }
        }
        if (similar.length >= 5) break;
    }
    
    return similar;
}

// 類似した文字列配列を生成
function generateSimilarStringArray(str) {
    const similar = [];
    
    // 文字の順序を入れ替えた誤答
    if (str.length >= 2) {
        for (let i = 0; i < str.length - 1; i++) {
            const swapped = str.substring(0, i) + str[i + 1] + str[i] + str.substring(i + 2);
            if (swapped !== str && !similar.includes(swapped)) {
                similar.push(swapped);
            }
        }
    }
    
    // 1文字削除した誤答
    if (str.length > 1) {
        for (let i = 0; i < str.length; i++) {
            const deleted = str.substring(0, i) + str.substring(i + 1);
            if (!similar.includes(deleted)) {
                similar.push(deleted);
            }
        }
    }
    
    // 1文字追加した誤答（文字列の末尾に）
    const commonChars = 'の、は、が、を、に、で、と、も、';
    for (const char of commonChars) {
        const added = str + char;
        if (!similar.includes(added)) {
            similar.push(added);
        }
    }
    
    return similar;
}

// 類似した文字列を生成（単一）
function generateSimilarString(str) {
    if (str.length === 0) return '×';
    
    // ランダムに1文字変更
    const randomIndex = Math.floor(Math.random() * str.length);
    const replacement = String.fromCharCode(str.charCodeAt(randomIndex) + 1);
    return str.substring(0, randomIndex) + replacement + str.substring(randomIndex + 1);
}

// -----------------------------
// 配列をシャッフル
// -----------------------------
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// -----------------------------
// バトル用の問題を取得（選択肢付き）
// -----------------------------
function getBattleQuestionWithOptions(player1Grade, player2Grade, subject) {
    const question = getBattleQuestion(player1Grade, player2Grade, subject);
    if (!question) return null;
    
    // 選択肢を生成
    const options = generateOptions(question.answer);
    
    return {
        ...question,
        options
    };
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

// -----------------------------
// 教科名を日本語に変換
// -----------------------------
function getSubjectDisplayName(subject) {
    const subjectNames = {
        'math': '算数・数学',
        'jp': '国語',
        'english': '英語',
        'science': '理科',
        'social': '社会'
    };
    return subjectNames[subject] || subject;
}

module.exports = {
    loadQuestions,
    getQuestions,
    getRandomQuestion,
    determineQuestionLevel,
    getBattleQuestion,
    getBattleQuestionWithOptions,
    checkAnswer,
    getSubjectDisplayName
};