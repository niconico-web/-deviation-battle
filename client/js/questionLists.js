// client/js/questionLists.js
// ============================================================
// 問題リスト機能：プレイヤーが自分で問題（一問一答形式）を登録した
// 「問題リスト」を作成・編集・削除・配布（エクスポート/インポート）できる。
// 既存の学年別問題（questions.js内のQUESTIONS_DATA）は「デフォルト問題リスト」として
// 扱うが、実データとしては保存しない（表示上の説明のみ）。
//
// 模擬戦闘：プレイヤーが作った問題リストは通常のボット戦・ダンジョン等では
// 使用できないが、「模擬戦闘」ではその問題リストを使い、ボットが次々に現れる
// 連続戦闘を行える。模擬戦闘は単語帳・過去問演習のようなもので、
// ・勝敗にかかわらずリザルト画面には遷移せず、そのまま次の敵と戦い続ける
// ・敗北してもHPが全回復して戦闘が継続する（詰みにならない）
// ・素材はドロップしないが、戦闘中の時間は「勉強時間」としてカウントされ、
//   勉強タイマーと同じ計算式でステータス上昇・コイン獲得が発生する
// ・どのステータスを伸ばすかは、通常の勉強タイマー（教科ごとに固定）と違い、
//   模擬戦闘を始める前にプレイヤーが1つだけ自由に選べる
// という設計になっている。
//
// このファイルはindex.html（管理UI・模擬戦闘の開始）とbattle.html（模擬戦闘の
// 実際の戦闘進行）の両方から読み込まれる。battle.html側では、battle.jsが
// トップレベルで宣言しているme/enemy/battleEndなどの変数を、同じグローバル
// スコープを共有する形でそのまま参照・更新する（classicスクリプトはページ内で
// スコープを共有するため）。
// ============================================================

// ---- 選択可能なステータスの定義（模擬戦闘開始前に1つだけ選ぶ） ----
const MOCK_BATTLE_STAT_OPTIONS = [
    { key: "maxHp", label: "HP" },
    { key: "atk", label: "攻撃" },
    { key: "def", label: "防御" },
    { key: "speed", label: "速さ" },
    { key: "special", label: "特殊" }
];

function getMockBattleStatLabel(key) {
    const found = MOCK_BATTLE_STAT_OPTIONS.find(o => o.key === key);
    return found ? found.label : key;
}

function generateQuestionListId() {
    return "ql_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
}

// ============================================================
// 一覧表示（index.html側）
// ============================================================

let questionListEditorState = null; // { editingId: string|null, rows: [{question, answer}] }

function renderQuestionListPanel() {
    const container = document.getElementById("questionListsContainer");
    if (!container) return;

    const player = (typeof getPlayerData === "function") ? getPlayerData() : null;
    const lists = (player && player.questionLists) ? player.questionLists : [];

    let html = "";
    html += '<div class="question-list-item question-list-default">';
    html += '<div class="question-list-main"><strong>デフォルト問題リスト</strong>';
    html += '<p class="help-text">通常のバトル・ダンジョンで出題される、学年・教科に応じた問題です。編集はできません。</p></div>';
    html += '</div>';

    if (lists.length === 0) {
        html += '<p class="help-text">まだ自分で作った問題リストがありません。「新しい問題リストを作る」から作成できます。</p>';
    } else {
        lists.forEach(list => {
            const count = (list.questions || []).length;
            html += '<div class="question-list-item">';
            html += `<div class="question-list-main"><strong>${escapeQuestionListHtml(list.name)}</strong>`;
            html += `<p class="help-text">問題数：${count}問</p></div>`;
            html += '<div class="question-list-actions">';
            html += `<button type="button" class="btn btn-secondary btn-small" data-ql-edit="${list.id}">編集</button>`;
            html += `<button type="button" class="btn btn-secondary btn-small" data-ql-export="${list.id}">配布用に書き出す</button>`;
            html += `<button type="button" class="btn btn-danger-outline btn-small" data-ql-delete="${list.id}">削除</button>`;
            html += '</div></div>';
        });
    }

    container.innerHTML = html;

    container.querySelectorAll("[data-ql-edit]").forEach(btn => {
        btn.addEventListener("click", () => openQuestionListEditor(btn.getAttribute("data-ql-edit")));
    });
    container.querySelectorAll("[data-ql-export]").forEach(btn => {
        btn.addEventListener("click", () => openQuestionListExport(btn.getAttribute("data-ql-export")));
    });
    container.querySelectorAll("[data-ql-delete]").forEach(btn => {
        btn.addEventListener("click", () => deleteQuestionList(btn.getAttribute("data-ql-delete")));
    });

    renderMockBattleListOptions(lists);
}

function escapeQuestionListHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
}

// ============================================================
// 作成・編集モーダル
// ============================================================

function openQuestionListEditor(listId) {
    const modal = document.getElementById("questionListEditModal");
    if (!modal) return;

    let rows = [{ question: "", answer: "" }];
    let name = "";

    if (listId) {
        const player = getPlayerData();
        const list = player && (player.questionLists || []).find(l => l.id === listId);
        if (!list) { alert("問題リストが見つかりませんでした。"); return; }
        name = list.name;
        rows = (list.questions || []).map(q => ({ question: q.question || "", answer: q.answer || "" }));
        if (rows.length === 0) rows = [{ question: "", answer: "" }];
    }

    questionListEditorState = { editingId: listId || null, rows };

    const titleEl = document.getElementById("questionListEditTitle");
    if (titleEl) titleEl.textContent = listId ? "問題リストを編集" : "新しい問題リストを作る";
    const nameInput = document.getElementById("questionListNameInput");
    if (nameInput) nameInput.value = name;

    renderQuestionListEditorRows();
    modal.style.display = "flex";
}

function closeQuestionListEditor() {
    const modal = document.getElementById("questionListEditModal");
    if (modal) modal.style.display = "none";
    questionListEditorState = null;
}

function renderQuestionListEditorRows() {
    const rowsContainer = document.getElementById("questionListRowsContainer");
    if (!rowsContainer || !questionListEditorState) return;

    rowsContainer.innerHTML = "";
    questionListEditorState.rows.forEach((row, index) => {
        const rowEl = document.createElement("div");
        rowEl.className = "question-list-row";

        const qInput = document.createElement("input");
        qInput.type = "text";
        qInput.placeholder = "問題文";
        qInput.value = row.question;
        qInput.addEventListener("input", () => { questionListEditorState.rows[index].question = qInput.value; });

        const aInput = document.createElement("input");
        aInput.type = "text";
        aInput.placeholder = "正解";
        aInput.value = row.answer;
        aInput.addEventListener("input", () => { questionListEditorState.rows[index].answer = aInput.value; });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-danger-outline btn-small";
        removeBtn.textContent = "削除";
        removeBtn.addEventListener("click", () => {
            questionListEditorState.rows.splice(index, 1);
            if (questionListEditorState.rows.length === 0) {
                questionListEditorState.rows.push({ question: "", answer: "" });
            }
            renderQuestionListEditorRows();
        });

        rowEl.appendChild(qInput);
        rowEl.appendChild(aInput);
        rowEl.appendChild(removeBtn);
        rowsContainer.appendChild(rowEl);
    });
}

function addQuestionListEditorRow() {
    if (!questionListEditorState) return;
    questionListEditorState.rows.push({ question: "", answer: "" });
    renderQuestionListEditorRows();
}

function saveQuestionListFromEditor() {
    if (!questionListEditorState) return;
    const nameInput = document.getElementById("questionListNameInput");
    const name = nameInput ? nameInput.value.trim() : "";
    if (!name) { alert("問題リストの名前を入力してください。"); return; }

    const questions = questionListEditorState.rows
        .map(r => ({ question: (r.question || "").trim(), answer: (r.answer || "").trim() }))
        .filter(r => r.question && r.answer);

    if (questions.length === 0) {
        alert("問題を1つ以上登録してください（問題文・正解の両方が必要です）。");
        return;
    }

    const player = getPlayerData();
    if (!player) { alert("まずはキャラクターを作成してください。"); return; }
    if (!player.questionLists) player.questionLists = [];

    if (questionListEditorState.editingId) {
        const idx = player.questionLists.findIndex(l => l.id === questionListEditorState.editingId);
        if (idx !== -1) {
            player.questionLists[idx] = {
                ...player.questionLists[idx],
                name,
                questions
            };
        }
    } else {
        player.questionLists.push({
            id: generateQuestionListId(),
            name,
            questions,
            createdAt: Date.now()
        });
    }

    localStorage.setItem("player", JSON.stringify(player));
    if (typeof syncPlayerToServer === "function") syncPlayerToServer(true);

    closeQuestionListEditor();
    renderQuestionListPanel();
}

function deleteQuestionList(listId) {
    if (!confirm("この問題リストを削除しますか？（元に戻せません）")) return;
    const player = getPlayerData();
    if (!player || !player.questionLists) return;
    player.questionLists = player.questionLists.filter(l => l.id !== listId);
    localStorage.setItem("player", JSON.stringify(player));
    if (typeof syncPlayerToServer === "function") syncPlayerToServer(true);
    renderQuestionListPanel();
}

// ============================================================
// 配布（エクスポート／インポート）
// ============================================================

function openQuestionListExport(listId) {
    const player = getPlayerData();
    const list = player && (player.questionLists || []).find(l => l.id === listId);
    if (!list) { alert("問題リストが見つかりませんでした。"); return; }

    // id・作成日時は含めず、名前と問題のみを配布データとする
    // （インポートする側で新しいidが発行されるようにするため）
    const exportData = { name: list.name, questions: list.questions };
    const modal = document.getElementById("questionListExportModal");
    const textarea = document.getElementById("questionListExportTextarea");
    if (textarea) textarea.value = JSON.stringify(exportData, null, 2);
    if (modal) modal.style.display = "flex";
}

function closeQuestionListExportModal() {
    const modal = document.getElementById("questionListExportModal");
    if (modal) modal.style.display = "none";
}

function copyQuestionListExportText() {
    const textarea = document.getElementById("questionListExportTextarea");
    if (!textarea) return;
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textarea.value).then(() => {
            alert("コピーしました。友達に貼り付けて渡せます。");
        }).catch(() => {
            fallbackCopyQuestionListText();
        });
        copied = true;
    }
    if (!copied) fallbackCopyQuestionListText();
}

function fallbackCopyQuestionListText() {
    try {
        document.execCommand("copy");
        alert("コピーしました。友達に貼り付けて渡せます。");
    } catch (e) {
        alert("自動コピーに失敗しました。表示されているテキストを手動でコピーしてください。");
    }
}

function openQuestionListImportModal() {
    const modal = document.getElementById("questionListImportModal");
    const textarea = document.getElementById("questionListImportTextarea");
    if (textarea) textarea.value = "";
    if (modal) modal.style.display = "flex";
}

function closeQuestionListImportModal() {
    const modal = document.getElementById("questionListImportModal");
    if (modal) modal.style.display = "none";
}

function importQuestionListFromText() {
    const textarea = document.getElementById("questionListImportTextarea");
    const raw = textarea ? textarea.value.trim() : "";
    if (!raw) { alert("配布されたデータを貼り付けてください。"); return; }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        alert("データの形式が正しくありません。友達からコピーしたデータをそのまま貼り付けてください。");
        return;
    }

    const name = (parsed && typeof parsed.name === "string") ? parsed.name.trim() : "";
    const questions = (parsed && Array.isArray(parsed.questions)) ? parsed.questions : null;
    if (!name || !questions) {
        alert("データの形式が正しくありません。");
        return;
    }
    const cleanQuestions = questions
        .map(q => ({ question: (q && q.question ? String(q.question) : "").trim(), answer: (q && q.answer ? String(q.answer) : "").trim() }))
        .filter(q => q.question && q.answer);
    if (cleanQuestions.length === 0) {
        alert("有効な問題が1つも見つかりませんでした。");
        return;
    }

    const player = getPlayerData();
    if (!player) { alert("まずはキャラクターを作成してください。"); return; }
    if (!player.questionLists) player.questionLists = [];
    player.questionLists.push({
        id: generateQuestionListId(),
        name,
        questions: cleanQuestions,
        createdAt: Date.now()
    });
    localStorage.setItem("player", JSON.stringify(player));
    if (typeof syncPlayerToServer === "function") syncPlayerToServer(true);

    closeQuestionListImportModal();
    renderQuestionListPanel();
    alert(`「${name}」（${cleanQuestions.length}問）をインポートしました。`);
}

// ============================================================
// 模擬戦闘の開始（index.html側）
// ============================================================

function renderMockBattleListOptions(lists) {
    const select = document.getElementById("mockBattleListSelect");
    if (!select) return;
    const usable = (lists || []).filter(l => (l.questions || []).length > 0);
    if (usable.length === 0) {
        select.innerHTML = '<option value="">（利用できる問題リストがありません）</option>';
        select.disabled = true;
    } else {
        select.disabled = false;
        select.innerHTML = usable.map(l => `<option value="${l.id}">${escapeQuestionListHtml(l.name)}（${l.questions.length}問）</option>`).join("");
    }
}

function openMockBattleSetup() {
    const player = getPlayerData();
    if (!player) { alert("まずはキャラクターを作成してください。"); return; }
    const usable = (player.questionLists || []).filter(l => (l.questions || []).length > 0);
    if (usable.length === 0) {
        alert("模擬戦闘で使う問題リストがありません。先に「新しい問題リストを作る」から作成してください。");
        return;
    }
    renderMockBattleListOptions(player.questionLists);
    const modal = document.getElementById("mockBattleSetupModal");
    if (modal) modal.style.display = "flex";
}

function closeMockBattleSetup() {
    const modal = document.getElementById("mockBattleSetupModal");
    if (modal) modal.style.display = "none";
}

function startMockBattle() {
    const select = document.getElementById("mockBattleListSelect");
    const listId = select ? select.value : null;
    if (!listId) { alert("問題リストを選んでください。"); return; }

    const statRadio = document.querySelector('input[name="mockBattleStat"]:checked');
    const statKey = statRadio ? statRadio.value : "atk";

    const player = getPlayerData();
    if (!player) { alert("まずはキャラクターを作成してください。"); return; }
    const list = (player.questionLists || []).find(l => l.id === listId);
    if (!list || !(list.questions || []).length) {
        alert("問題リストが見つからないか、問題が登録されていません。");
        return;
    }

    const battlePlayer = (typeof getBattleReadyPlayer === "function") ? getBattleReadyPlayer(player) : { ...player };
    const enemy = generateMockBattleEnemy(battlePlayer, player.grade);

    // 他のバトルモードのフラグが残っていると誤動作するため、明示的にクリアする
    localStorage.removeItem("isBossBattle");
    localStorage.removeItem("isDungeonBattle");
    localStorage.removeItem("dungeonData");
    localStorage.removeItem("partyData");
    localStorage.removeItem("sb_practice_tutorial");

    localStorage.setItem("roomId", "mock_battle_" + Date.now());
    localStorage.setItem("battlePlayer", JSON.stringify(battlePlayer));
    localStorage.setItem("enemy", JSON.stringify(enemy));
    localStorage.setItem("isBotBattle", "true");
    localStorage.setItem("isMockBattle", "true");
    localStorage.setItem("mockBattleQuestions", JSON.stringify(list.questions));
    localStorage.setItem("mockBattleListName", list.name);
    localStorage.setItem("mockBattleStat", statKey);

    setTimeout(() => { location.href = "battle.html"; }, 50);
}

// ============================================================
// 模擬戦闘専用の敵生成（battle.htmlはonline.jsのBOT_MONSTERSを
// 読み込んでいないため、ここに簡易版を用意する）
// ============================================================

const MOCK_BATTLE_ENEMY_NAMES = [
    "過去問の亡霊", "模試ゴーレム", "暗記コボルト", "復習スライム",
    "反復オーガ", "記憶の番人", "演習ドール", "小テストスプライト",
    "確認テストナイト", "総復習ドラゴン"
];

function generateMockBattleEnemy(baseStats, grade) {
    const stats = baseStats || {};
    // プレイヤーの実ステータス合計を基準に、0.75〜1.35倍の範囲でランダムな強さの敵を作る
    const mult = 0.75 + Math.random() * 0.6;
    const total = ((stats.maxHp || 100) + (stats.atk || 10) + (stats.def || 10) + (stats.speed || 10)) * mult;

    // 合計値をHP・攻撃・防御・速さにランダムに再配分（個体差を出す）
    const shares = [Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5];
    const shareSum = shares.reduce((a, b) => a + b, 0);

    const maxHp = Math.max(20, Math.round(total * (shares[0] / shareSum)));
    const atk = Math.max(3, Math.round(total * (shares[1] / shareSum) * 0.5));
    const def = Math.max(3, Math.round(total * (shares[2] / shareSum) * 0.5));
    const speed = Math.max(3, Math.round(total * (shares[3] / shareSum) * 0.5));
    const name = MOCK_BATTLE_ENEMY_NAMES[Math.floor(Math.random() * MOCK_BATTLE_ENEMY_NAMES.length)];

    return {
        id: "mockbot_" + Date.now() + "_" + Math.floor(Math.random() * 1000000),
        name,
        maxHp, hp: maxHp, atk, def, speed,
        special: Math.round((atk + def) / 2),
        grade: grade || 1,
        isBot: true,
        isMockBattleEnemy: true
        // materialDropsを設定しないことで、万一素材ドロップ処理が呼ばれても何も起きないようにする
    };
}

// ============================================================
// 模擬戦闘の進行（battle.html側）
// battle.jsが定義するme/enemy/battleEnd等のグローバル変数をそのまま参照・更新する。
// ============================================================

let mockBattleQuestionsCache = null;
let mockBattleListNameCache = "";
let mockBattleStatKey = "atk";
let mockBattleStartTimeMs = null;
let mockBattleTimerIntervalId = null;

function loadMockBattleDataFromStorage() {
    if (mockBattleQuestionsCache) return;
    try {
        mockBattleQuestionsCache = JSON.parse(localStorage.getItem("mockBattleQuestions") || "[]");
    } catch (e) {
        mockBattleQuestionsCache = [];
    }
    mockBattleListNameCache = localStorage.getItem("mockBattleListName") || "模擬戦闘";
    mockBattleStatKey = localStorage.getItem("mockBattleStat") || "atk";
}

/**
 * 模擬戦闘用の問題を1つランダムに返す。battle.jsのaskNextPlayerQuestion()から呼ばれる。
 * 戻り値: { question, answer, subject, subjectDisplayName } または null（問題が無い場合）
 */
function getMockBattleQuestion() {
    loadMockBattleDataFromStorage();
    if (!mockBattleQuestionsCache || mockBattleQuestionsCache.length === 0) return null;
    const q = mockBattleQuestionsCache[Math.floor(Math.random() * mockBattleQuestionsCache.length)];
    return {
        question: q.question,
        answer: q.answer,
        subject: null,
        subjectDisplayName: "模擬戦闘（" + mockBattleListNameCache + "）"
    };
}

/**
 * 模擬戦闘のバナーUI・経過時間タイマーを初期化する。battle.jsのinitialize()から呼ばれる。
 */
function initMockBattleUI() {
    loadMockBattleDataFromStorage();
    mockBattleStartTimeMs = Date.now();

    const banner = document.getElementById("mockBattleBanner");
    if (banner) banner.style.display = "flex";
    const listNameEl = document.getElementById("mockBattleBannerListName");
    if (listNameEl) listNameEl.textContent = mockBattleListNameCache;
    const statEl = document.getElementById("mockBattleBannerStat");
    if (statEl) statEl.textContent = getMockBattleStatLabel(mockBattleStatKey);

    updateMockBattleTimerDisplay();
    mockBattleTimerIntervalId = setInterval(updateMockBattleTimerDisplay, 1000);

    const exitBtn = document.getElementById("mockBattleExitBtn");
    if (exitBtn) {
        exitBtn.addEventListener("click", exitMockBattle);
    }
}

function updateMockBattleTimerDisplay() {
    const el = document.getElementById("mockBattleBannerTimer");
    if (!el || mockBattleStartTimeMs == null) return;
    const seconds = Math.floor((Date.now() - mockBattleStartTimeMs) / 1000);
    el.textContent = (typeof formatTime === "function") ? formatTime(seconds) : String(seconds);
}

/**
 * finishBotBattle()の冒頭からisMockBattleの場合に呼ばれる。
 * 通常のリザルト画面遷移は行わず、勝利なら次の敵を出現させ、敗北ならHPを全回復して続行する。
 */
function handleMockBattleRoundEnd(result) {
    if (timerInterval) clearInterval(timerInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (bossAutoAnswerTimer) clearTimeout(bossAutoAnswerTimer);
    atbPlayerActionPending = true; // 次の敵が出るまで／HP回復するまで誤操作を防ぐ

    const buttons = choicesContainer.querySelectorAll(".choice-btn");
    buttons.forEach(btn => btn.disabled = true);
    if (typeof enableSkillButtons === "function") enableSkillButtons(false);

    if (result === "win") {
        // 次の敵が出現するまでの間、倒した敵のゲージが進行して攻撃してこないようにする
        enemyATB = 0;
        atbBossTelegraphActive = false;
        addLog(`${enemy.name}を撃破！（模擬戦闘のため素材は入手できません）`);
        setTimeout(spawnNextMockBattleEnemy, 1200);
    } else {
        addLog("模擬戦闘なのでHPが全回復し、戦闘を続行します！");
        me.hp = me.maxHp;
        if (typeof updateHP === "function") updateHP();
        if (typeof updatePlayerUI === "function") updatePlayerUI();
        setTimeout(() => {
            atbPlayerActionPending = false;
            questionDisplay.textContent = "気を取り直して続行！";
            askNextPlayerQuestion();
        }, 1200);
    }
}

function spawnNextMockBattleEnemy() {
    const player = (typeof getPlayerData === "function") ? getPlayerData() : null;
    enemy = generateMockBattleEnemy(me, (player && player.grade) || me.grade);

    // 継続効果・バフデバフ類を新しい敵に対してリセットする
    enemyBurnTurns = 0;
    enemyPoisonTurns = 0;
    enemySpeedDebuff = 0;
    enemySpeedDebuffTurns = 0;
    enemyAtkDebuff = 0;
    enemyAtkDebuffTurns = 0;
    enemyDefDebuff = 0;
    enemyDefDebuffTurns = 0;
    enemyAccuracyDebuff = 0;
    enemyAccuracyDebuffTurns = 0;
    enemyNextDamageShield = 0;
    enemyATB = 0;

    questionDisplay.textContent = "新たな敵が現れた！";
    if (typeof updateEnemyUI === "function") updateEnemyUI();
    if (typeof updateStats === "function") updateStats();
    if (typeof updateATBBars === "function") updateATBBars();
    addLog(`${enemy.name} が現れた！`);

    atbPlayerActionPending = false;
    askNextPlayerQuestion();
}

/**
 * 模擬戦闘を終了する。経過時間ぶんの勉強時間報酬（ステータス上昇・コイン・経験値）を
 * 勉強タイマーと同じ計算式で反映してからホームへ戻る。
 */
function exitMockBattle() {
    if (mockBattleTimerIntervalId) clearInterval(mockBattleTimerIntervalId);
    if (atbInterval) { clearInterval(atbInterval); atbInterval = null; }
    if (timerInterval) clearInterval(timerInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (bossAutoAnswerTimer) clearTimeout(bossAutoAnswerTimer);
    battleEnd = true;

    const elapsedSeconds = mockBattleStartTimeMs != null ? Math.floor((Date.now() - mockBattleStartTimeMs) / 1000) : 0;
    const summary = applyMockBattleRewards(elapsedSeconds, mockBattleStatKey);

    localStorage.removeItem("isMockBattle");
    localStorage.removeItem("mockBattleQuestions");
    localStorage.removeItem("mockBattleListName");
    localStorage.removeItem("mockBattleStat");
    localStorage.removeItem("isBotBattle");

    if (summary) {
        let msg = "模擬戦闘を終了しました。\n";
        msg += "時間：" + (typeof formatTime === "function" ? formatTime(summary.seconds) : summary.seconds + "秒") + "\n";
        msg += "経験値 +" + summary.gainedXp + "\n";
        msg += getMockBattleStatLabel(summary.statKey) + " +" + summary.statGain;
        if (summary.hasOverwhelmingGrowth) msg += "（圧倒的成長性発動中！）";
        if (summary.gainedCoins > 0) msg += "\n30分以上の勉強ボーナス +" + summary.gainedCoins + "コイン";
        alert(msg);
    } else {
        alert("模擬戦闘を終了しました。（1分未満だったため報酬はありません）");
    }

    location.href = "index.html";
}

/**
 * 勉強タイマー（applyStudyRewards）と同じ計算式で報酬を計算・反映する。
 * SUBJECT_STATSのように2〜3ステータスに分散させず、指定した1つのステータスに全量加算する点のみ異なる。
 */
function applyMockBattleRewards(seconds, statKey) {
    if (seconds < 60) return null;
    let player = getPlayerData();
    if (!player) return null;

    const stats = getStatsFromPlayer(player);
    const gainedXp = calcStudyXp(seconds);
    let statGain = calcStatGain(seconds, player);

    let hasOverwhelmingGrowth = false;
    if (player.equippedWeapon && player.equippedWeapon.uniqueAbilities) {
        hasOverwhelmingGrowth = player.equippedWeapon.uniqueAbilities.some(
            ability => ability.effect === "double_study_growth"
        );
    }
    if (hasOverwhelmingGrowth) statGain *= 2;

    const validKey = MOCK_BATTLE_STAT_OPTIONS.some(o => o.key === statKey) ? statKey : "atk";
    stats[validKey] = (stats[validKey] || 0) + statGain;

    const hp = validKey === "maxHp" ? (player.hp || player.maxHp) + statGain : (player.hp || player.maxHp);

    let gainedCoins = 0;
    if (seconds >= STUDY_COIN_THRESHOLD) gainedCoins = COIN_STUDY_30MIN;

    const oldLevel = player.level || calcLevel(player.xp || 0);
    const newXp = (player.xp || 0) + gainedXp;
    const newLevel = calcLevel(newXp);
    if (newLevel > oldLevel && typeof addSkillPointsOnLevelUp === "function") {
        player = addSkillPointsOnLevelUp(player, oldLevel, newLevel);
    }

    const updated = buildPlayer(player.name, stats, newXp, {
        hp,
        totalStudySeconds: (player.totalStudySeconds || 0) + seconds,
        grade: player.grade,
        id: player.id,
        coins: (player.coins || 0) + gainedCoins,
        weapons: player.weapons,
        equippedWeapon: player.equippedWeapon,
        weaponWins: player.weaponWins,
        orbs: player.orbs || [],
        skillTree: player.skillTree,
        skillSlots: player.skillSlots,
        customSkills: player.customSkills,
        bossDefeats: player.bossDefeats || {},
        dungeonClears: player.dungeonClears || {},
        materials: player.materials || {},
        dungeonItems: player.dungeonItems || [],
        dungeonCheckpoint: player.dungeonCheckpoint || 0,
        pvpWins: player.pvpWins || 0,
        bossRunCount: player.bossRunCount || 0,
        dailyMissions: player.dailyMissions,
        guild: player.guild,
        adventurerExp: player.adventurerExp || 0,
        special: player.special,
        prestigeCount: player.prestigeCount,
        prestigeBonusPercent: player.prestigeBonusPercent,
        lastLoginDate: player.lastLoginDate,
        loginStreak: player.loginStreak,
        questionLists: player.questionLists || []
    });

    localStorage.setItem("player", JSON.stringify(updated));

    if (typeof updateMissionProgress === "function") {
        updateMissionProgress("study", seconds);
    }
    if (typeof addAdventurerExp === "function") {
        const adventurerExpGain = Math.floor(seconds / 120);
        if (adventurerExpGain > 0) addAdventurerExp(updated, adventurerExpGain);
    }

    return { statGain, statKey: validKey, gainedXp, gainedCoins, newLevel, oldLevel, hasOverwhelmingGrowth, seconds };
}

// ============================================================
// 初期化（index.html側で呼ばれる）
// ============================================================

function initQuestionListsUI() {
    renderQuestionListPanel();

    const createBtn = document.getElementById("questionListCreateBtn");
    if (createBtn) createBtn.addEventListener("click", () => openQuestionListEditor(null));

    const importOpenBtn = document.getElementById("questionListImportOpenBtn");
    if (importOpenBtn) importOpenBtn.addEventListener("click", openQuestionListImportModal);

    const mockBattleOpenBtn = document.getElementById("mockBattleOpenBtn");
    if (mockBattleOpenBtn) mockBattleOpenBtn.addEventListener("click", openMockBattleSetup);

    // 編集モーダル
    const editModal = document.getElementById("questionListEditModal");
    if (editModal) {
        const closeBtn = editModal.querySelector(".close");
        if (closeBtn) closeBtn.addEventListener("click", closeQuestionListEditor);
    }
    const addRowBtn = document.getElementById("questionListAddRowBtn");
    if (addRowBtn) addRowBtn.addEventListener("click", addQuestionListEditorRow);
    const saveBtn = document.getElementById("questionListSaveBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveQuestionListFromEditor);

    // エクスポートモーダル
    const exportModal = document.getElementById("questionListExportModal");
    if (exportModal) {
        const closeBtn = exportModal.querySelector(".close");
        if (closeBtn) closeBtn.addEventListener("click", closeQuestionListExportModal);
    }
    const copyBtn = document.getElementById("questionListCopyBtn");
    if (copyBtn) copyBtn.addEventListener("click", copyQuestionListExportText);

    // インポートモーダル
    const importModal = document.getElementById("questionListImportModal");
    if (importModal) {
        const closeBtn = importModal.querySelector(".close");
        if (closeBtn) closeBtn.addEventListener("click", closeQuestionListImportModal);
    }
    const importSubmitBtn = document.getElementById("questionListImportSubmitBtn");
    if (importSubmitBtn) importSubmitBtn.addEventListener("click", importQuestionListFromText);

    // 模擬戦闘設定モーダル
    const mockModal = document.getElementById("mockBattleSetupModal");
    if (mockModal) {
        const closeBtn = mockModal.querySelector(".close");
        if (closeBtn) closeBtn.addEventListener("click", closeMockBattleSetup);
    }
    const mockStartBtn = document.getElementById("mockBattleStartBtn");
    if (mockStartBtn) mockStartBtn.addEventListener("click", startMockBattle);
}
