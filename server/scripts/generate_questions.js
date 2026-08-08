// generate_questions.js
// Usage: node server/scripts/generate_questions.js
// Reads server/data/questions.json and writes server/data/questions_expanded.json
// Generates up to 100 questions per schoolLevel/grade/subject by adding synthetic questions
// and produces 4-choice options for every question (keeps existing "answer" as string).

const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.join(__dirname, '..', 'data', 'questions.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'questions_expanded.json');

function loadQuestions() {
  const raw = fs.readFileSync(INPUT_PATH, 'utf8');
  return JSON.parse(raw);
}

function isNumericAnswer(ans) {
  if (typeof ans !== 'string') return false;
  return /^-?\d+(?:\/\d+)?(?:\.\d+)?$/.test(ans);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateNumericDistractors(correct) {
  // correct may be integer, decimal or fraction
  // try to parse fraction
  if (correct.includes('/')) {
    const [a, b] = correct.split('/').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
      const val = a / b;
      const deltas = [0.5, 1, -1, 2, -0.5];
      const distractors = new Set();
      for (const d of deltas) {
        const v = val + d;
        if (!Number.isNaN(v)) {
          // try to express as fraction when original was fraction
          distractors.add(String(Math.round(v * 1000) / 1000));
        }
        if (distractors.size >= 3) break;
      }
      return Array.from(distractors).slice(0, 3);
    }
  }

  const num = Number(correct);
  if (!Number.isFinite(num)) return ['0', '1', '2'];

  const candidates = new Set();
  const tries = [-3, -2, -1, 1, 2, 3, 0.5, -0.5];
  for (const t of tries) {
    const v = num + t;
    if (v !== num) candidates.add(String(v));
    if (candidates.size >= 3) break;
  }
  return Array.from(candidates).slice(0, 3);
}

function generateStringDistractors(correct) {
  // simple heuristics: remove last char, add common particle, swap characters
  const out = new Set();
  if (correct.length > 1) {
    out.add(correct.slice(0, -1));
  }
  out.add(correct + 'ん');
  out.add(correct + 'を');
  // swap two chars if length >=2
  if (correct.length >= 2) {
    const arr = correct.split('');
    const i = 0, j = 1;
    const swapped = arr.slice();
    [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
    out.add(swapped.join(''));
  }
  // pad with simple alternatives if needed
  while (out.size < 3) {
    out.add(correct + String(Math.floor(Math.random() * 9) + 1));
  }
  return Array.from(out).slice(0, 3);
}

function makeOptions(correct) {
  // returns shuffled array of 4 strings containing correct and 3 distractors
  let distractors = [];
  if (isNumericAnswer(correct)) {
    distractors = generateNumericDistractors(correct);
  } else {
    distractors = generateStringDistractors(correct);
  }
  const options = [correct, ...distractors].slice(0, 4);
  return shuffle(options);
}

function synthesizeQuestion(existingQuestion, index, subject) {
  // create a generic synthetic question based on subject and index
  const idx = index;
  if (subject === 'math') {
    // generate simple arithmetic problem
    const a = randomInt(1, 99);
    const b = randomInt(1, 99);
    const q = `${a} + ${b} = ?`;
    const ans = String(a + b);
    return { question: q, answer: ans };
  }
  if (subject === 'jp') {
    const q = `次の語の反対語は何ですか？（サンプル ${idx}）`;
    const ans = `反対語${idx}`;
    return { question: q, answer: ans };
  }
  if (subject === 'english') {
    const q = `Translate: サンプル${idx}`;
    const ans = `sample${idx}`;
    return { question: q, answer: ans };
  }
  // default
  return { question: `追加問題 ${idx}`, answer: `答え${idx}` };
}

function expandQuestions(db) {
  const TARGET = 100; // target questions per subject/grade
  const result = JSON.parse(JSON.stringify(db));

  for (const schoolLevel of Object.keys(result)) {
    const grades = result[schoolLevel];
    for (const gradeKey of Object.keys(grades)) {
      const subjects = grades[gradeKey];
      for (const subject of Object.keys(subjects)) {
        let arr = subjects[subject] || [];
        // ensure array
        if (!Array.isArray(arr)) arr = [];

        // Add options to existing entries
        for (let i = 0; i < arr.length; i++) {
          const q = arr[i];
          if (!q.options) {
            q.options = makeOptions(String(q.answer));
          }
        }

        // Synthesize additional questions until TARGET
        let synthIndex = 1;
        while (arr.length < TARGET) {
          const synth = synthesizeQuestion(arr[0], synthIndex, subject);
          synth.options = makeOptions(String(synth.answer));
          arr.push(synth);
          synthIndex++;
          // safety
          if (synthIndex > 10000) break;
        }

        // Assign back
        subjects[subject] = arr;
      }
    }
  }
  return result;
}

function main() {
  console.log('Loading questions from', INPUT_PATH);
  const db = loadQuestions();
  console.log('Expanding questions to ~100 per subject/grade...');
  const expanded = expandQuestions(db);
  console.log('Writing expanded questions to', OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(expanded, null, 2), 'utf8');
  console.log('Done.');
}

if (require.main === module) {
  main();
}
