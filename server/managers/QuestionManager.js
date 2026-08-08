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
// 学年の正規化ヘルパー
// - サーバーに渡される grade が文字列や範囲外の可能性を正規化する
// -----------------------------
function normalizeGrade(rawGrade) {
    let g = Number(rawGrade);
    if (!Number.isFinite(g) || Number.isNaN(g)) {
        // Fall back to parseInt for strings like "1" or "01"
        g = parseInt(rawGrade, 10);
    }
    if (!Number.isFinite(g) || Number.isNaN(g)) {
        return 1; // default to 1
    }
    // Clamp between 1 and 12 (1-6: elementary, 7-9: junior high, 10-12: high school)
    if (g < 1) g = 1;
    if (g > 12) g = 12;
    return Math.floor(g);
}

// -----------------------------
// 二人のプレイヤーの学年に基づいて問題を決定
// -----------------------------
function determineQuestionLevel(player1Grade, player2Grade) {
    // 正規化
    const g1 = normalizeGrade(player1Grade);
    const g2 = normalizeGrade(player2Grade);

    // 学年が違う場合は、学年が下のほうに合わせる
    const minGrade = Math.min(g1, g2);

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
// - もし期待した学年／教科に問題が無い場合、フォールバックで近い学年や相手側の学年を試す
// -----------------------------
function getBattleQuestion(player1Grade, player2Grade, subject) {
    const questionsDb = loadQuestions();
    const { schoolLevel, grade } = determineQuestionLevel(player1Grade, player2Grade);
    console.log(`[QuestionManager] getBattleQuestion: player1Grade=${player1Grade}, player2Grade=${player2Grade}, subject=${subject}, schoolLevel=${schoolLevel}, grade=${grade}`);

    // まず通常経路で取得
    let question = getRandomQuestion(schoolLevel, grade, subject);
    if (question) {
        console.log('[QuestionManager] getBattleQuestion: selected question from determined level');
        return question;
    }

    // フォールバック1: 同じ schoolLevel の近い grade を試す（上下1〜2年分）
    try {
        const availableGrades = Object.keys((questionsDb && questionsDb[schoolLevel]) || {}).map(k => Number(k)).filter(n => Number.isFinite(n));
        console.log(`[QuestionManager] getBattleQuestion: availableGrades for ${schoolLevel}:`, availableGrades);

        const deltas = [1, -1, 2, -2];
        for (const d of deltas) {
            const tryGrade = grade + d;
            if (availableGrades.includes(tryGrade)) {
                question = getRandomQuestion(schoolLevel, tryGrade, subject);
                if (question) {
                    console.log(`[QuestionManager] getBattleQuestion: fallback found at grade=${tryGrade} (same school level)`);
                    return question;
                }
            }
        }
    } catch (e) {
        console.warn('[QuestionManager] getBattleQuestion fallback same-level failed', e);
    }

    // フォールバック2: 相手の学年を使って取得（player1 若しくは player2 のどちらかの schoolLevel）
    try {
        const g1 = normalizeGrade(player1Grade);
        const g2 = normalizeGrade(player2Grade);
        const candidates = [ { schoolLevel: '', grade: 1 } ];

        const cand1 = (g1 <= 6) ? { schoolLevel: 'elementary', grade: g1 } : (g1 <= 9) ? { schoolLevel: 'junior_high', grade: g1 - 6 } : { schoolLevel: 'high_school', grade: g1 - 9 };
        const cand2 = (g2 <= 6) ? { schoolLevel: 'elementary', grade: g2 } : (g2 <= 9) ? { schoolLevel: 'junior_high', grade: g2 - 6 } : { schoolLevel: 'high_school', grade: g2 - 9 };
        candidates.push(cand1, cand2);

        for (const c of candidates) {
            if (!c || !c.schoolLevel) continue;
            question = getRandomQuestion(c.schoolLevel, c.grade, subject);
            if (question) {
                console.log(`[QuestionManager] getBattleQuestion: fallback found using candidate schoolLevel=${c.schoolLevel}, grade=${c.grade}`);
                return question;
            }
        }
    } catch (e) {
        console.warn('[QuestionManager] getBattleQuestion fallback candidate failed', e);
    }

    console.warn('[QuestionManager] getBattleQuestion: 問題が見つかりませんでした');
    return null;
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
        
        // 文学的技法の問題の場合は、類似した文字列を生成しない
        if (!isLiteraryTechniqueQuestion(answer)) {
            // まだ足りない場合は類似した文字列を生成
            while (options.length < 4) {
                const similar = generateSimilarString(answer);
                if (!usedAnswers.has(similar)) {
                    usedAnswers.add(similar);
                    options.push(similar);
                }
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

// 文学的技法の問題かどうかを判定
function isLiteraryTechniqueQuestion(answer) {
    const literaryKeywords = ['倒置法', '比喩', '反復', '対句', '擬人法', '係り結び', '受動態', '使役態', '尊敬語', '謙譲語'];
    
    // 正解に技法名が含まれている場合
    if (literaryKeywords.some(keyword => answer.includes(keyword))) {
        return true;
    }
    
    // 技法の例文から技法を判定
    const exampleToTechnique = {
        '美しい、この花は': '倒置法',
        'ライオンのように強い': '比喩',
        '走った、走った、走った': '反復',
        '山と川': '対句',
        '天と地': '対句',
        '風がささやく': '擬人法',
        '～けれども、～ので': '係り結び',
        '彼に褒められた': '受動態',
        '彼を行かせた': '使役態',
        'いらっしゃる': '尊敬語',
        'おっしゃる': '尊敬語',
        '参る': '謙譲語',
        '申す': '謙譲語'
    };
    
    for (const [example, technique] of Object.entries(exampleToTechnique)) {
        if (answer.includes(example)) {
            return true;
        }
    }
    
    return false;
}

// 文学的技法の誤答を生成（技法を混ぜるのみ）
function generateLiteraryTechniqueWrongAnswers(correct) {
    const wrongs = [];
    const usedAnswers = new Set();
    usedAnswers.add(correct); // 正解を追加して重複を防ぐ
    
    // 文学的技法のマッピング
    const techniqueMap = {
        '倒置法': ['比喩のように強い', '走った、走った、走った', '山と川、天と地', '風がささやく'],
        '比喩': ['美しい、この花は', '走った、走った、走った', '山と川、天と地', '風がささやく'],
        '反復': ['美しい、この花は', 'ライオンのように強い', '山と川、天と地', '風がささやく'],
        '対句': ['美しい、この花は', 'ライオンのように強い', '走った、走った、走った', '風がささやく'],
        '擬人法': ['美しい、この花は', 'ライオンのように強い', '走った、走った、走った', '山と川、天と地'],
        '係り結び': ['美しい、この花は', 'ライオンのように強い', '走った、走った、走った', '風がささやく'],
        '受動態': ['彼を行かせた', 'いらっしゃる、おっしゃる', '参る、申す', '～けれ��も、～ので'],
        '使役態': ['彼に褒められた', 'いらっしゃる、おっしゃる', '参る、申す', '～けれども、～ので'],
        '尊敬語': ['彼を行かせた', '彼に褒められた', '参る、申す', '～けれども、～ので'],
        '謙譲語': ['彼を行かせた', '彼に褒められた', 'いらっしゃる、おっしゃる', '～けれども、～ので']
    };
    
    // 例文から技法を判定するマッピング
    const exampleToTechnique = {
        '美しい、この花は': '倒置法',
        'ライオンのように強い': '比喩',
        '走った、走った、走った': '反復',
        '山と川': '対句',
        '天と地': '対句',
        '風がささやく': '擬人法',
        '～けれども、～ので': '係り結び',
        '彼に褒められた': '受動態',
        '彼を行かせた': '使役態',
        'いらっしゃる': '尊敬語',
        'おっしゃる': '尊敬語',
        '参る': '謙譲語',
        '申す': '謙譲語'
    };
    
    let targetTechnique = null;
    
    // 正解に含まれる技法を特定（技法名が含まれている場合）
    for (const [technique, examples] of Object.entries(techniqueMap)) {
        if (correct.includes(technique)) {
            targetTechnique = technique;
            break;
        }
    }
    
    // 技法名が含まれていない場合、例文から技法を判定
    if (!targetTechnique) {
        for (const [example, technique] of Object.entries(exampleToTechnique)) {
            if (correct.includes(example)) {
                targetTechnique = technique;
                break;
            }
        }
    }
    
    // 技法が特定できた場合、その技法の誤答を生成
    if (targetTechnique && techniqueMap[targetTechnique]) {
        for (const example of techniqueMap[targetTechnique]) {
            if (!usedAnswers.has(example)) {
                usedAnswers.add(example);
                wrongs.push(example);
            }
        }
    }
    
    return wrongs;
}

// 文字列の誤答を生成（意味のある誤答）
function generateStringWrongAnswers(correct) {
    const wrongs = [];
    
    // 文学的技法に関する問題の場合、技法を混ぜた誤答のみを生成
    if (isLiteraryTechniqueQuestion(correct)) {
        return generateLiteraryTechniqueWrongAnswers(correct);
    }
    
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
        'あ': ['い', 'う', 'え', 'お'],
        'い': ['あ', 'う', 'え', 'お'],
        'う': ['あ', 'い', 'え', 'お'],
        'え': ['あ', 'い', 'う', 'お'],
        'お': ['あ', 'い', 'う', 'え'],
        'か': ['き', 'く', 'け', 'こ'],
        'き': ['か', 'く', 'け', 'こ'],
        'く': ['か', 'き', 'け', 'こ'],
        'け': ['か', 'き', 'く', 'こ'],
        'こ': ['か', 'き', 'く', 'け'],
        'さ': ['し', 'す', 'せ', 'そ'],
        'し': ['さ', 'す', 'せ', 'そ'],
        'す': ['さ', 'し', 'せ', 'そ'],
        'せ': ['さ', 'し', 'す', 'そ'],
        'そ': ['さ', 'し', 'す', 'せ'],
        'た': ['ち', 'つ', 'て', 'と'],
        'ち': ['た', 'つ', 'て', 'と'],
        'つ': ['た', 'ち', 'て', 'と'],
        'て': ['た', 'ち', 'つ', 'と'],
        'と': ['た', 'ち', 'つ', 'て'],
        'な': ['に', 'ぬ', 'ね', 'の'],
        'に': ['な', 'ぬ', 'ね', 'の'],
        'ぬ': ['な', 'に', 'ね', 'の'],
        'ね': ['な', 'に', 'ぬ', 'の'],
        'の': ['な', 'に', 'ぬ', 'ね'],
        'は': ['ひ', 'ふ', 'へ', 'ほ'],
        'ひ': ['は', 'ふ', 'へ', 'ほ'],
        'ふ': ['は', 'ひ', 'へ', 'ほ'],
        'へ': ['は', 'ひ', 'ふ', 'ほ'],
        'ほ': ['は', 'ひ', 'ふ', 'へ'],
        'ま': ['み', 'む', 'め', 'も'],
        'み': ['ま', 'む', 'め', 'も'],
        'む': ['ま', 'み', 'め', 'も'],
        'め': ['ま', 'み', 'む', 'も'],
        'も': ['ま', 'み', 'む', 'め'],
        'や': ['ゆ', 'よ'],
        'ゆ': ['や', 'よ'],
        'よ': ['や', 'ゆ'],
        'ら': ['り', 'る', 'れ', 'ろ'],
        'り': ['ら', 'る', 'れ', 'ろ'],
        'る': ['ら', 'り', 'れ', 'ろ'],
        'れ': ['ら', 'り', 'る', 'ろ'],
        'ろ': ['ら', 'り', 'る', 'れ'],
        'わ': ['を', 'ん'],
        'を': ['わ', 'ん'],
        'ん': ['わ', 'を']
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
