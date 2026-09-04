// PWA Install Prompt Logic
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // デフォルトのインストールプロンプトを抑制
    e.preventDefault();
    // イベントを後で使えるように保存
    deferredPrompt = e;
    
    const installPopup = document.getElementById('install-popup');
    if (installPopup) {
        // 既にインストール済みかチェック
        if (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone) {
            console.log('App is already installed.');
            return;
        }
        console.log('`beforeinstallprompt` event was fired.');
        installPopup.style.display = 'flex';
    }
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
});

let studyStartTime = null, studyTimerInterval = null, studyElapsedBefore = 0;
let socketHandlersSetup = false;
let matchmakingTimeout = null;
let pendingRandomMatchPlayer = null;

// 勉強タイマーの状態をスリープ時にも保持するための処理
const STUDY_TIMER_STORAGE_KEY = 'studyTimerState';

function saveStudyTimerState() {
    if (studyStartTime !== null) {
        const elapsed = studyElapsedBefore + Math.floor((Date.now() - studyStartTime) / 1000);
        const state = {
            elapsed: elapsed,
            subject: document.getElementById("studyFocus")?.value || 'jp',
            timestamp: Date.now()
        };
        localStorage.setItem(STUDY_TIMER_STORAGE_KEY, JSON.stringify(state));
        console.log('Study timer state saved:', state);
    }
}

function loadStudyTimerState() {
    const savedState = localStorage.getItem(STUDY_TIMER_STORAGE_KEY);
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            // 最後の保存から24時間以内ならタイマーを復元（長時間の勉強に対応）
            if (Date.now() - state.timestamp < 86400000) {
                console.log('Study timer state loaded:', state);
                return state;
            } else {
                console.log('Study timer state too old, clearing');
                localStorage.removeItem(STUDY_TIMER_STORAGE_KEY);
            }
        } catch (e) {
            console.error('Failed to load study timer state:', e);
            localStorage.removeItem(STUDY_TIMER_STORAGE_KEY);
        }
    }
    return null;
}

function clearStudyTimerState() {
    localStorage.removeItem(STUDY_TIMER_STORAGE_KEY);
}

// Page Visibility API - スリープ/復帰検出
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // ページが非表示になったらタイマー状態を保存
        saveStudyTimerState();
    } else {
        // ページが再表示されたら、日付が変わっている可能性を考慮してミッションを再初期化する
        if (typeof initializeDailyMissions === 'function') {
            initializeDailyMissions();
        }

        // ページが再表示されたらタイマー状態を復元
        const savedState = loadStudyTimerState();
        if (savedState && studyStartTime === null) {
            // タイマーが停止中なら復元
            const subjectSelect = document.getElementById("studyFocus");
            if (subjectSelect) {
                subjectSelect.value = savedState.subject;
            }
            // スリープ中に経過した時間を加算して新しい開始時間を設定
            const sleepElapsed = Math.floor((Date.now() - savedState.timestamp) / 1000);
            studyElapsedBefore = savedState.elapsed + sleepElapsed;
            studyStartTime = Date.now(); // 現在時刻から再開
            document.getElementById("studyStart").disabled = true;
            document.getElementById("studyStop").disabled = false;
            document.getElementById("studyFocus").disabled = true;
            studyTimerInterval = setInterval(updateStudyTimerDisplay, 1000);
            updateStudyTimerDisplay();
            console.log('Study timer restored from sleep state. Sleep elapsed:', sleepElapsed, 'Total elapsed:', studyElapsedBefore);
        }
    }
});

// アプリが完全に閉じられる前にタイマー状態を保存
window.addEventListener('beforeunload', () => {
    saveStudyTimerState();
});

// 複数タブ防止（改善版）
const tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
let heartbeatInterval = null;

// 既存のタブ情報をチェック
const existingTabData = localStorage.getItem('activeTabData');
if (existingTabData) {
    try {
        const data = JSON.parse(existingTabData);
        const now = Date.now();
        // 5秒以上前のタブ情報は無効とみなす（タブが正常に閉じられなかった場合）
        if (now - data.timestamp < 5000) {
            // 他のタブが最近開かれている
            console.log('Another tab is already open');
            // alert('このサイトは同時に1つのタブでのみ使用できます。既存のタブを閉じてから再度開いてください。');
            // window.location.href = 'about:blank';
        }
    } catch (e) {
        // データが破損している場合は無視して続行
        console.log('Invalid tab data, continuing...');
    }
}

// 自分のタブ情報を設定
localStorage.setItem('activeTabData', JSON.stringify({
    id: tabId,
    timestamp: Date.now()
}));

// ハートビートを送信してタブが生きていることを示す
heartbeatInterval = setInterval(() => {
    localStorage.setItem('activeTabData', JSON.stringify({
        id: tabId,
        timestamp: Date.now()
    }));
}, 2000);

// 他のタブからのメッセージを監視
window.addEventListener('storage', (e) => {
    if (e.key === 'activeTabData' && e.newValue) {
        try {
            const data = JSON.parse(e.newValue);
            if (data.id !== tabId) {
                // 他のタブが開かれた
                alert('このサイトは同時に1つのタブでのみ使用できます。このタブを閉じてください。');
                window.location.href = 'about:blank';
            }
        } catch (e) {
            console.log('Invalid tab data from storage event');
        }
    }
});

// ページを離れる時にタブ情報をクリア
window.addEventListener('beforeunload', () => {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    const currentData = localStorage.getItem('activeTabData');
    if (currentData) {
        try {
            const data = JSON.parse(currentData);
            if (data.id === tabId) {
                localStorage.removeItem('activeTabData');
            }
        } catch (e) {
            localStorage.removeItem('activeTabData');
        }
    }
});

// Initialize socket after DOM is ready
window.socket = null;

function initializeSocket() {
    console.log("Initializing socket...");
    window.socket = io({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        transports: ["websocket", "polling"],
        forceNew: false
    });

    // SocialSystem（フレンド申請など）は script.js より先に読み込まれ、
    // 自身のDOMContentLoadedハンドラの中で window.socket の存在チェックを行うが、
    // その時点ではまだここ（initializeSocket）が実行されておらず window.socket が
    // 存在しないため、フレンド申請関連のソケットリスナーが一切登録されない状態だった。
    // ここでsocket生成後に改めて呼び直すことで、リスナーを確実に登録する。
    if (typeof socialSystem !== 'undefined' && socialSystem && typeof socialSystem.setupSocketListeners === 'function') {
        socialSystem.setupSocketListeners();
    }

    // Connection logging
    window.socket.on("connect", () => {
        console.log("接続:", window.socket.id);
        updateOnlineButtons(true); // ボタンを有効化
        
        // Call setup for online features
        if (typeof setupOnlineEventHandlers === 'function') {
            setupOnlineEventHandlers();
        }

        // 接続時は常にプレイヤーデータをサーバーへ同期する
        // （こうしないと、pendingSaveフラグが立っていない通常の接続時には一切保存されず、
        //   ランキングなどサーバー側の集計にプレイヤーが反映されないままになってしまう）
        if (localStorage.getItem('pendingSave') === 'true') {
            console.log("Found pending save, attempting to sync to server...");
        }
        syncPlayerToServer(true); // silent=trueで自動保存

        if (pendingRandomMatchPlayer) {
            console.log("Re-emitting pending random match request after reconnect", pendingRandomMatchPlayer.id);
            window.socket.emit("requestRandomMatch", pendingRandomMatchPlayer);
        }
        
        // Request boss list from server
        window.socket.emit('bosses:get');
    });

    window.socket.on("disconnect", () => {
        console.log("切断");
        updateOnlineButtons(false); // ボタンを無効化
    });

    window.socket.on("connect_error", (error) => {
        console.log("接続エラー:", error);
        updateOnlineButtons(false); // ボタンを無効化
    });
    
    // ユニーク武器獲得通知
    window.socket.on("uniqueWeaponClaimed", (data) => {
        const message = `${data.weaponName}が${data.playerName}によって入手されました！`;
        alert(message);
        // ユニーククエストUIを更新（ショップページにいる場合）
        if (typeof renderUniqueQuests === "function" && document.getElementById("uniqueQuestList")) {
            renderUniqueQuests();
        }
    });
    
    // ユニーククエスト完了通知（クエスト自体が削除される）
    window.socket.on("uniqueQuestCompleted", (data) => {
        const message = `${data.weaponName}のクエストが${data.playerName}によって完了されました！世界にこの武器は1つしかありません。`;
        alert(message);
        // ユニーククエストUIを更新（ショップページにいる場合）
        if (typeof renderUniqueQuests === "function" && document.getElementById("uniqueQuestList")) {
            renderUniqueQuests();
        }
    });

    console.log("Socket initialized, waiting for connection...");
    console.log("Initial socket.connected state:", window.socket.connected);
    
    // イベントハンドラーを設定
    setupSocketEventHandlers();
}

function getStatsFromInputs() {
    return {
        maxHp: Math.floor(Number(document.getElementById("statMaxHp").value)),
        atk: Math.floor(Number(document.getElementById("statAtk").value)),
        def: Math.floor(Number(document.getElementById("statDef").value)),
        speed: Math.floor(Number(document.getElementById("statSpeed").value)),
        special: Math.floor(Number(document.getElementById("statSpecial").value)),
        grade: Math.floor(Number(document.getElementById("statGrade").value))
    };
}

function setStatsToInputs(stats) {
    document.getElementById("statMaxHp").value = stats.maxHp;
    document.getElementById("statAtk").value = stats.atk;
    document.getElementById("statDef").value = stats.def;
    document.getElementById("statSpeed").value = stats.speed;
    if (document.getElementById("statSpecial")) {
        document.getElementById("statSpecial").value = stats.special != null ? stats.special : Math.floor(stats.atk * 0.6);
    }
    if (stats.grade) {
        document.getElementById("statGrade").value = stats.grade;
    }
    updateRemainingPoints();
}

function updateRemainingPoints() {
    const el = document.getElementById("remainingPoints");
    if (!el) return;
    const stats = getStatsFromInputs();
    const used = sumStats(stats);
    const remaining = TOTAL_STAT_POINTS - used;
    if (getPlayerData() && used > TOTAL_STAT_POINTS) {
        el.textContent = I18N.studiedTotal.replace("{total}", used);
        el.className = "remaining-points points-trained";
        return;
    }
    el.textContent = I18N.remainingPoints.replace("{remaining}", remaining).replace("{total}", TOTAL_STAT_POINTS);
    el.className = "remaining-points" + (remaining === 0 ? " points-ok" : remaining < 0 ? " points-over" : " points-under");
}

function createCharacter() {
    const name = document.getElementById("playerName").value.trim() || I18N.unnamed;
    const stats = getStatsFromInputs();
    const existing = getPlayerData();
    const prestigeMode = isPrestigeMode && !!existing;

    // 名前のバリデーション（新規作成時のみ）
    if (!existing && typeof validateName === "function") {
        const validation = validateName(name);
        if (!validation.valid) {
            alert(validation.reason);
            return;
        }
    }

    if (!existing || prestigeMode) {
        // 新規作成時、またはプレステージによる再配分時は
        // 持ち点250ポイントちょうどを配分することを要求する
        const validation = validateStatAllocation(stats);
        if (!validation.ok) { alert(validation.message); return; }
    } else {
        for (const key of STAT_KEYS) {
            if (!Number.isFinite(stats[key]) || stats[key] < MIN_STAT) {
                alert(I18N.statMinError.replace("{min}", MIN_STAT));
                return;
            }
        }
    }

    // プレステージ時はレベル（xp）とスキルツリーもリセットする。
    // ただし学年（grade）はリセット対象外（statsから取得した現在の学年をそのまま使う）。
    const xp = prestigeMode ? 0 : (existing ? existing.xp : 0);
    const totalStudySeconds = existing ? (existing.totalStudySeconds || 0) : 0;
    const prestigeCount = prestigeMode ? (existing?.prestigeCount || 0) + 1 : (existing?.prestigeCount || 0);
    const skillTreeForPlayer = prestigeMode ? { unlockedNodes: [], availablePoints: 0 } : existing?.skillTree;
    const skillSlotsForPlayer = prestigeMode ? [null, null, null] : existing?.skillSlots;
    const player = buildPlayer(name, stats, xp, {
        totalStudySeconds,
        grade: stats.grade,
        id: existing?.id,
        coins: existing?.coins || 0,
        weapons: existing?.weapons || [],
        equippedWeapon: existing?.equippedWeapon || null,
        weaponWins: existing?.weaponWins || {},
        orbs: existing?.orbs || [],
        skillTree: skillTreeForPlayer,
        skillSlots: skillSlotsForPlayer,
        customSkills: existing?.customSkills,
        bossDefeats: existing?.bossDefeats,
        materials: existing?.materials,
        pvpWins: existing?.pvpWins,
        bossRunCount: existing?.bossRunCount,
        dailyMissions: existing?.dailyMissions,
        guild: existing?.guild,
        adventurerExp: existing?.adventurerExp,
        special: existing?.special,
        prestigeCount
    });
    localStorage.setItem("player", JSON.stringify(player));
    updateStatus(player);
    updateXpDisplay(player);

    // キャラクター作成直後はデイリーミッションがまだ初期化されておらず、
    // ミッション画面が「ミッションデータがありません」のままになってしまうため、
    // ここで明示的に初期化・再描画しておく。
    if (typeof initializeDailyMissions === "function") {
        initializeDailyMissions();
    }
    
    // Lock stat inputs after creation
    isPrestigeMode = false;
    lockStatInputs(true);
    document.getElementById("statAllocationDesc").textContent = I18N.fixedStats;
    
    // Update data management UI
    const playerIdEl = document.getElementById("currentPlayerId");
    if (playerIdEl) playerIdEl.textContent = player.id;
    const saveDataBtn = document.getElementById("saveDataBtn");
    if (saveDataBtn) saveDataBtn.disabled = false;

    syncPlayerToServer(true);

    if (prestigeMode) {
        const bonusPercent = Math.round(prestigeCount * PRESTIGE_BONUS_PER_PRESTIGE * 100);
        alert(I18N.prestigeDone.replace("{bonus}", bonusPercent));
    } else {
        alert(I18N.charCreated);
    }
}

// プレステージ機能：一定レベルに到達したプレイヤーが、ステータスを
// 最初の振り分け可能な状態（持ち点250）に戻して再配分する代わりに、
// 全ステータスに永続的な倍率ボーナスを得られる（回数分累積、上限なし）。
let isPrestigeMode = false;

function startPrestige() {
    const player = getPlayerData();
    if (!player) return;

    if (!canPrestige(player)) {
        alert(I18N.prestigeLevelRequired.replace("{level}", PRESTIGE_UNLOCK_LEVEL));
        return;
    }

    const nextCount = (player.prestigeCount || 0) + 1;
    const nextBonusPercent = Math.round(nextCount * PRESTIGE_BONUS_PER_PRESTIGE * 100);
    const confirmed = confirm(I18N.prestigeConfirmMsg.replace("{bonus}", nextBonusPercent));
    if (!confirmed) return;

    isPrestigeMode = true;
    setStatsToInputs(DEFAULT_STATS);
    lockStatInputs(false);
    document.getElementById("statAllocationDesc").textContent = I18N.prestigeAllocationDesc;
    const createBtn = document.getElementById("createCharBtn");
    if (createBtn) createBtn.textContent = I18N.prestigeConfirmBtn;
    updateRemainingPoints();
}

/**
 * 武器の表示名を取得する
 * @param {object} weapon - 武器オブジェクト
 * @returns {string} 武器の表示名
 */
function getWeaponDisplayName(weapon) {
    if (!weapon) return 'なし';
    return weapon.name || '名称不明の武器';
}

/**
 * 装備中の武器詳細をHTMLで整形して返す
 * @param {object} weapon - 武器オブジェクト
 * @returns {string} 武器詳細のHTML文字列
 */
// ボス選択プルダウンの下に、選択中のボスのアイコン・説明をプレビュー表示する
function updateBossPreview(selectEl, previewEl) {
    if (!selectEl || !previewEl) return;
    const bossId = selectEl.value;
    const boss = (window.bosses || []).find(b => b.id === bossId);
    if (!boss) {
        previewEl.innerHTML = "";
        return;
    }
    const iconHtml = (typeof getBossIconSVG === "function") ? getBossIconSVG(boss.id, 64) : "";
    const descHtml = boss.description ? `<p class="boss-preview-desc">${boss.description}</p>` : "";
    previewEl.innerHTML =
        `<div class="boss-preview-inner">
            <span class="boss-icon-wrap">${iconHtml}</span>
            <div class="boss-preview-text">
                <strong>${boss.name}</strong>
                ${descHtml}
            </div>
        </div>`;
}

function formatWeaponDetailsHTML(weapon) {
    if (!weapon) return "なし";

    const iconHtml = (typeof getWeaponIconSVG === "function")
        ? `<span class="weapon-icon-wrap">${getWeaponIconSVG(weapon.type, 40)}</span>`
        : "";
    let detailsHtml = `<strong>${getWeaponDisplayName(weapon)}</strong>`;
    const detailsList = [];

    // ステータスボーナス
    if (weapon.statBonuses && Object.keys(weapon.statBonuses).length > 0) {
        const bonusStrings = Object.entries(weapon.statBonuses).map(([stat, value]) => {
            const statLabel = (typeof STAT_LABELS !== 'undefined' && STAT_LABELS[stat]) ? STAT_LABELS[stat] : stat;
            return `${statLabel} +${Math.round(value * 100)}%`;
        });
        if (bonusStrings.length > 0) {
            detailsList.push(`<li><strong>補正:</strong> ${bonusStrings.join(', ')}</li>`);
        }
    }

    // 特殊能力
    if (weapon.uniqueAbilities && weapon.uniqueAbilities.length > 0) {
        const abilityNames = weapon.uniqueAbilities.map(ability => ability.name || '名称不明の能力').join(', ');
        detailsList.push(`<li><strong>特殊能力:</strong> ${abilityNames}</li>`);
    }

    if (detailsList.length > 0) {
        detailsHtml += `<ul style="margin: 5px 0 5px 0; padding-left: 20px; list-style-type: '◆ '; font-size: 0.9em; color: #ddd;">${detailsList.join('')}</ul>`;
    }

    return `<div class="weapon-display-inner">${iconHtml}<div class="item-text-col">${detailsHtml}</div></div>`;
}

function updateStatus(player) {
    // 武器補正を適用したステータスを取得
    const battleStats = getBattleStats(player);
    const weaponDetailsHtml = formatWeaponDetailsHTML(player.equippedWeapon);
    const prestigeCount = player.prestigeCount || 0;
    const prestigeBonusPercent = Math.round(prestigeCount * PRESTIGE_BONUS_PER_PRESTIGE * 100);

    let prestigeHtml = "<div class='prestige-box'><h3>" + I18N.prestigeTitle + "</h3>" +
        "<p>" + I18N.prestigeCountLabel + I18N.colon + prestigeCount + I18N.prestigeTimesSuffix + "</p>" +
        "<p>" + I18N.prestigeBonusLabel + I18N.colon + "+" + prestigeBonusPercent + "%</p>";
    if (canPrestige(player)) {
        prestigeHtml += "<button type='button' id='prestigeBtn' class='btn btn-secondary'>" + I18N.prestigeBtn + "</button>";
    } else {
        prestigeHtml += "<p class='prestige-locked'>" + I18N.prestigeLocked.replace("{level}", PRESTIGE_UNLOCK_LEVEL) + "</p>";
    }
    prestigeHtml += "</div>";

    document.getElementById("status").innerHTML =
        "<h2>" + I18N.status + "</h2>" +
        "<p><strong>" + I18N.playerNameLabel + "</strong>" + player.name + "</p>" +
        "<p><strong>プレイヤーID" + I18N.colon + "</strong>" + player.id + "</p>" +
        "<p><strong>" + I18N.level + I18N.colon + "</strong>" + (player.level || 1) + " <strong>" + I18N.xp + I18N.colon + "</strong>" + (player.xp || 0) + "</p>" +
        "<p><strong>コイン" + I18N.colon + "</strong>" + (player.coins || 0) + "</p>" +
        "<p><strong>装備武器" + I18N.colon + "</strong></p><div class='weapon-display'>" + weaponDetailsHtml + "</div><hr>" +
        "<p>HP" + I18N.colon + battleStats.maxHp + "</p>" +
        "<p>" + I18N.atk + I18N.colon + battleStats.atk + "</p>" +
        "<p>" + I18N.def + I18N.colon + battleStats.def + "</p>" +
        "<p>" + I18N.speed + I18N.colon + battleStats.speed + "</p>" +
        "<p>特殊" + I18N.colon + (battleStats.special != null ? battleStats.special : battleStats.atk) + "</p>" +
        "<p>学年" + I18N.colon + player.grade + "</p><hr>" +
        "<p>" + I18N.totalStudy + formatTime(player.totalStudySeconds || 0) + "</p>" +
        "<hr>" + prestigeHtml;

    const prestigeBtn = document.getElementById("prestigeBtn");
    if (prestigeBtn) {
        prestigeBtn.addEventListener("click", startPrestige);
    }
}

function updateXpDisplay(player) {
    const el = document.getElementById("xpDisplay"); if (!el) return;
    const lv = player.level || 1, xp = player.xp || 0;
    el.textContent = I18N.xp + I18N.colon + xp + " (Lv." + lv + " -> " + I18N.xpNext + " " + xpToNextLevel(lv) + " XP)";
}

function startStudy() {
    if (studyStartTime !== null) return;
    if (!getPlayerData()) { alert(I18N.needChar); return; }
    studyStartTime = Date.now();
    studyElapsedBefore = 0;
    document.getElementById("studyStart").disabled = true;
    document.getElementById("studyStop").disabled = false;
    document.getElementById("studyFocus").disabled = true;
    studyTimerInterval = setInterval(updateStudyTimerDisplay, 1000);
    updateStudyTimerDisplay();
}

function stopStudy() {
    if (studyStartTime === null) return;
    clearInterval(studyTimerInterval);
    studyTimerInterval = null;
    const elapsed = studyElapsedBefore + Math.floor((Date.now() - studyStartTime) / 1000);
    studyStartTime = null;
    studyElapsedBefore = 0;
    
    // 保存されたタイマー状態をクリア
    clearStudyTimerState();
    
    // ボタンの状態を確実に更新
    const studyStartBtn = document.getElementById("studyStart");
    const studyStopBtn = document.getElementById("studyStop");
    const studyFocusBtn = document.getElementById("studyFocus");
    
    if (studyStartBtn) studyStartBtn.disabled = false;
    if (studyStopBtn) studyStopBtn.disabled = true;
    if (studyFocusBtn) studyFocusBtn.disabled = false;
    
    applyStudyRewards(elapsed);
    document.getElementById("studyTimer").textContent = "00:00:00";
}

function updateStudyTimerDisplay() {
    if (studyStartTime === null) return;
    document.getElementById("studyTimer").textContent = formatTime(studyElapsedBefore + Math.floor((Date.now() - studyStartTime) / 1000));
}

// Map subjects to the 2 stats they strengthen
const SUBJECT_STATS = {
    jp: ["maxHp", "def"],     // 国語 → HP・防御・特殊
    math: ["atk", "speed",],   // 算数・数学 → 攻撃・速さ・特殊
    eng: ["def", "atk"],    // 英語 → 防御・速さ・特殊
    sci: ["atk", "special"],    // 理科 → 攻撃・HP・特殊
    soc: ["maxHp", "special"]     // 社会 → HP・防御・特殊
};

// Subject display names
const SUBJECT_DISPLAY_NAMES = {
    jp: "国語",
    math: "算数・数学",
    eng: "英語",
    sci: "理科",
    soc: "社会"
};

function getSubjectDisplayName(subject) {
    return SUBJECT_DISPLAY_NAMES[subject] || subject;
}

// Display stat growth info based on selected subject
function updateStatGrowthInfo() {
    const subject = document.getElementById("studyFocus").value;
    const [stat1, stat2, stat3] = SUBJECT_STATS[subject];
    const statNames = {
        maxHp: "HP",
        atk: I18N.atk,
        def: I18N.def,
        speed: I18N.speed,
        special: "特殊"
    };
    const infoEl = document.getElementById("statGrowthInfo");
    if (infoEl) {
        let stats;
        if (stat3) {
            stats = `${statNames[stat1]}・${statNames[stat2]}・${statNames[stat3]}`;
        } else if (stat2) {
            stats = `${statNames[stat1]}・${statNames[stat2]}`;
        } else {
            stats = statNames[stat1];
        }
        infoEl.innerHTML = `<p><strong>${I18N.statGrowthInfo}</strong>${stats}</p>`;
    }
}

function applyStudyRewards(seconds) {
    if (seconds < 60) { alert("勉強時間は1分以上にしてください"); return; }
    let player = getPlayerData(); if (!player) return;
    const subject = document.getElementById("studyFocus").value;
    const stats = getStatsFromPlayer(player);
    const gainedXp = calcStudyXp(seconds);
    let statGain = calcStatGain(seconds);
    const oldLevel = player.level || calcLevel(player.xp || 0);
    
    // 圧倒的成長性をチェック
    let hasOverwhelmingGrowth = false;
    if (player.equippedWeapon && player.equippedWeapon.uniqueAbilities) {
        hasOverwhelmingGrowth = player.equippedWeapon.uniqueAbilities.some(
            ability => ability.effect === "double_study_growth"
        );
    }
    
    if (hasOverwhelmingGrowth) {
        statGain *= 2;
    }
    
    const [stat1, stat2, stat3] = SUBJECT_STATS[subject];
    stats[stat1] += statGain;
    if (stat2) {
        stats[stat2] += statGain;
    }
    if (stat3) {
        stats[stat3] += statGain;
    }

    const hp = (stat1 === "maxHp" || stat2 === "maxHp" || stat3 === "maxHp")
        ? (player.hp || player.maxHp) + statGain
        : (player.hp || player.maxHp);

    let gainedCoins = 0;
    if (seconds >= STUDY_COIN_THRESHOLD) {
        gainedCoins = COIN_STUDY_30MIN;
    }

    // オーブドロップ判定（25分以上で確定）
    let droppedOrb = null;
    if (seconds >= 25 * 60 && typeof rollOrbDrop === "function") {
        droppedOrb = rollOrbDrop(1.0); // 100%ドロップ
    }

    const newXp = (player.xp || 0) + gainedXp;
    const newLevel = calcLevel(newXp);

    if (newLevel > oldLevel && typeof addSkillPointsOnLevelUp === 'function') {
        player = addSkillPointsOnLevelUp(player, oldLevel, newLevel);
        alert(`レベルアップ！ Lv${newLevel}\nスキルポイントを ${ (newLevel - oldLevel) * SKILL_POINTS_PER_LEVEL } 獲得しました！`);
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
        materials: player.materials || {},
        pvpWins: player.pvpWins || 0,
        bossRunCount: player.bossRunCount || 0,
        dailyMissions: player.dailyMissions,
        guild: player.guild,
        adventurerExp: player.adventurerExp || 0,
        special: player.special,
        prestigeCount: player.prestigeCount
    });

    // オーブを追加
    if (droppedOrb) {
        if (!updated.orbs) updated.orbs = [];
        updated.orbs.push(droppedOrb);
    }

    localStorage.setItem("player", JSON.stringify(updated));
    setStatsToInputs(stats);
    updateStatus(updated);
    updateXpDisplay(updated);
    if (typeof renderSkillTreeUI === "function") renderSkillTreeUI();
    syncPlayerToServer(true);
    // 翻訳データを安全に参照
    const I18N = window.I18N || {};
    const subjectMap = {
        jp: I18N.hpDef || "HP・防御",
        math: I18N.mathAtk || "攻撃・速さ",
        eng: I18N.engDefAtk || "防御・攻撃",
        sci: I18N.sciAtkSpe || "攻撃・特殊",
        soc: I18N.socHpSpe || "HP・特殊"
    };
    const subjectLabel = subjectMap[subject] || "";

    let msg = (I18N.studyDone || "勉強を終了しました。") + "\n" +
              (I18N.time || "時間") + (I18N.colon || ": ") + formatTime(seconds) + "\n" +
              (I18N.xp || "XP") + " +" + gainedXp + "\n" +
              subjectLabel + (I18N.statUp || "の能力") + " +" + statGain;

    if (hasOverwhelmingGrowth) msg += "（圧倒的成長性発動中！）";
    if (gainedCoins > 0) msg += `\n30分以上の勉強ボーナス +${gainedCoins}コイン`;
    if (droppedOrb && typeof getOrbDisplayName === "function") {
        msg += "\n\n★オーブを入手！★\n" + getOrbDisplayName(droppedOrb);
    }
    alert(msg);
    if (typeof renderShop === "function") {
        renderOriginalWeapons();
        renderShop();
        renderInventory();
    }

    // デイリーミッションの進捗を更新
    if (typeof updateMissionProgress === 'function') {
        updateMissionProgress('study', seconds);
    }
    
    // ギルドに参加している場合、冒険者経験値を追加（1分あたり0.5経験値）
    if (typeof addAdventurerExp === 'function') {
        const adventurerExpGain = Math.floor(seconds / 120); // 2分で1経験値（上がりにくくする）
        if (adventurerExpGain > 0) {
            const player = getPlayerData();
            addAdventurerExp(player, adventurerExpGain);
        }
    }
}

// プレイヤーIDの正規化（大文字・空白・全角の揺れを吸収）
function normalizePlayerId(rawId) {
    if (rawId == null) return "";
    return String(rawId)
        // 全角英数字を半角に変換
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[\s\u3000]/g, "")
        .trim()
        .toUpperCase();
}

// サーバーへのデータ同期（silent=true の場合は成功通知を出さない）
let pendingSilentSave = false;
function syncPlayerToServer(silent) {
    const player = getPlayerData();
    if (!player) return false;

    if (!window.socket || !window.socket.connected) {
        // 接続がない場合は保留フラグを立てる
        localStorage.setItem('pendingSave', 'true');
        console.log("Socket not connected. Marked for pending save.");
        return false;
    }

    pendingSilentSave = !!silent;
    window.socket.emit("saveData", player);
    return true;
}

function setupSocketEventHandlers() {
    if (!window.socket || socketHandlersSetup) return;
    socketHandlersSetup = true;
    
    console.log("Setting up socket event handlers...");

    // Boss list handler
    window.socket.on('bosses:list', (bosses) => {
        window.bosses = bosses; // Store bosses globally
        localStorage.setItem('bosses', JSON.stringify(bosses)); // And in localStorage for persistence

        const bossSelects = [
            { select: document.getElementById('bossSelect'), preview: document.getElementById('bossPreview') },       // For party
            { select: document.getElementById('soloBossSelect'), preview: document.getElementById('soloBossPreview') } // For solo
        ];
        bossSelects.forEach(({ select, preview }) => {
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = ''; // Clear existing options
            bosses.forEach(boss => {
                const option = document.createElement('option');
                option.value = boss.id;
                option.textContent = boss.name;
                select.appendChild(option);
            });
            // Restore previous selection if possible
            if (currentVal) select.value = currentVal;

            updateBossPreview(select, preview);
            if (!select.dataset.previewBound) {
                select.addEventListener('change', () => updateBossPreview(select, preview));
                select.dataset.previewBound = "true";
            }
        });
        console.log('Boss list updated from server.');
    });

    // Party handlers
    window.socket.on('party:update', (party) => {
        if (party) {
            if (typeof updatePartyUI === 'function') {
                updatePartyUI(party);
            }
        } else {
            if (typeof resetPartyUI === 'function') {
                resetPartyUI();
            }
        }
    });

    window.socket.on('party:closed', () => {
        if (typeof resetPartyUI === 'function') {
            resetPartyUI();
        }
        alert('The party has been disbanded.');
    });

    window.socket.on('party:error', (error) => {
        alert(`Party Error: ${error.message}`);
    });

    window.socket.on('bossBattle:start', ({ boss, party, roomId }) => {
        const player = getMatchPlayer();
        if (!player) {
            alert('Character not created.');
            return;
        }
        localStorage.setItem("isBossBattle", "true");
        // If party data is present, it's a multiplayer boss battle
        if (party && party.members.length > 1) {
            localStorage.setItem("isBotBattle", "false");
            localStorage.setItem("partyData", JSON.stringify(party));
            if (roomId) {
                localStorage.setItem("roomId", roomId);
            }
        } else {
            localStorage.setItem("isBotBattle", "true"); // Use bot battle flow for solo/fallback
        }
        localStorage.setItem("battlePlayer", JSON.stringify(player));
        localStorage.setItem("enemy", JSON.stringify(boss));
        localStorage.removeItem("rewardsApplied");
        location.href = "battle.html";
    });

    window.socket.on('bosses:details', ({ boss }) => {
        if (!boss) {
            alert('ボスの詳細の取得に失敗しました。');
            return;
        }
        const player = getMatchPlayer();
        if (!player) {
            alert('キャラクターを作成してください。');
            return;
        }
        localStorage.setItem("isBossBattle", "true"); // ボス戦フラグ
        localStorage.setItem("isBotBattle", "true"); // ボット戦の仕組みを流用
        localStorage.setItem("battlePlayer", JSON.stringify(player));
        localStorage.setItem("enemy", JSON.stringify(boss));
        localStorage.removeItem("rewardsApplied"); // Ensure rewards can be applied
        location.href = "battle.html";
    });

    // データ保存・読み込み関連のイベント
    window.socket.on("dataSaved", (info) => {
        localStorage.removeItem('pendingSave'); // 保存成功したので保留フラグを削除
        const id = info && info.playerId ? info.playerId : (getPlayerData()?.id || "");
        if (pendingSilentSave) {
            pendingSilentSave = false;
            console.log("[Data] Auto saved to server:", id);
            return;
        }
        alert(`データをサーバーに保存しました。\n\nプレイヤーID: ${id}\n\nこのIDを他の端末で入力すると引き継げます。`);
    });

    window.socket.on("dataLoaded", (loadedPlayer) => {
        if (loadedPlayer && loadedPlayer.id) {
            if (studyStartTime !== null) stopStudy(); // 勉強中なら停止
            // 引き継ぎ後に前回のバトル情報が残らないよう掃除する
            ["battlePlayer", "enemy", "roomId", "isBotBattle", "battleResult", "rewardsApplied", "stolenWeapon", "droppedOrb"]
                .forEach(key => localStorage.removeItem(key));
            const migrated = typeof migratePlayer === "function" ? migratePlayer(loadedPlayer) : loadedPlayer;
            localStorage.setItem("player", JSON.stringify(migrated));
            alert(`プレイヤー「${migrated.name}」(ID: ${migrated.id}) のデータを引き継ぎました。`);
            location.reload(); // ページをリロードしてUIを完全に更新
        } else {
            alert("指定されたIDのプレイヤーデータが見つかりませんでした。\n\n・IDが正しいか確認してください（英数字6文字）\n・引き継ぎ元の端末で「データをサーバーに保存」を実行済みか確認してください");
        }
    });

    window.socket.on("dataError", (message) => {
        pendingSilentSave = false;
        alert(`エラー: ${message}`);
    });

    // 戦力ランキング受信は ranking.js でハンドリングされているため、ここでは重複を避けるために削除

    console.log("Socket event handlers setup complete");
}

// 戦力ランキングの描画は ranking.js の renderRanking()（#ranking-list-container を使用）が担当する。
// ここに同名の関数を重複定義すると、後から読み込まれる方が上書きしてしまい、
// ranking.js側が期待する要素(#ranking-list-container)ではなく存在しない#rankingListを
// 参照してしまうため、ランキングが「読み込み中」のまま止まる不具合の原因になっていた。
// そのため、このファイルでは定義しない。

// グローバルにアクセス可能に
window.normalizePlayerId = normalizePlayerId;

// デバッグ用: ブラウザのコンソールで giveDebugInstantKillWeapon() を実行すると、
// 必中・一撃必殺の武器を現在のプレイヤーに追加・装備する（テスト用）。
if (typeof giveDebugInstantKillWeapon === "function") {
    window.giveDebugInstantKillWeapon = giveDebugInstantKillWeapon;
}
window.syncPlayerToServer = syncPlayerToServer;

// グローバルにアクセス可能に
window.setupSocketEventHandlers = setupSocketEventHandlers;

function updateOnlineButtons(isConnected) {
    console.log(`updateOnlineButtons called with: ${isConnected}`);
    const randomMatchBtn = document.getElementById("randomMatch");
    const createRoomBtn = document.getElementById("createRoom");
    const joinRoomBtn = document.getElementById("joinRoom");

    if (randomMatchBtn) {
        randomMatchBtn.disabled = !isConnected;
        console.log(`randomMatchBtn.disabled set to: ${!isConnected}`);
    }
    if (createRoomBtn) {
        createRoomBtn.disabled = !isConnected;
        console.log(`createRoomBtn.disabled set to: ${!isConnected}`);
    }
    if (joinRoomBtn) {
        joinRoomBtn.disabled = !isConnected;
        console.log(`joinRoomBtn.disabled set to: ${!isConnected}`);
    }
}

// プレイヤーデータをlocalStorageから取得・移行する
function getPlayerData() {
    const raw = localStorage.getItem("player");
    if (!raw) return null;
    try {
        const player = JSON.parse(raw);
        // migratePlayer関数（stats.jsにある想定）で古いデータ構造を新しいものに変換
        return typeof migratePlayer === "function" ? migratePlayer(player) : player;
    } catch (e) {
        console.error("プレイヤーデータの解析に失敗しました:", e);
        console.error("破損した可能性のあるデータ:", raw); // 破損データをログに出力
        // localStorage.removeItem("player"); // 根本原因がわかるまで、データを自動削除しないようにします
        alert("プレイヤーデータの読み込みに失敗しました。データが破損している可能性があります。開発者コンソールで詳細を確認してください。");
        return null;
    }
}

// 対戦用のプレイヤーデータを取得する
function getMatchPlayer() {
    const p = getPlayerData();
    if (!p) return null;
    const battleStats = getBattleStats(p);
    // 武器補正後のmaxHpをHPとして設定（常にフルHPで開始）
    return { ...p, ...battleStats, hp: battleStats.maxHp, battleStats };
}

// ステータス入力欄などをロック/アンロックする
function lockStatInputs(locked) {
    const statKeys = ["maxHp", "atk", "def", "speed"]; // STAT_KEYSがグローバルにない場合を想定
    statKeys.forEach(key => {
        const inputId = key === "maxHp" ? "statMaxHp" : "stat" + key.charAt(0).toUpperCase() + key.slice(1);
        const el = document.getElementById(inputId);
        if (el) {
            el.disabled = locked;
            el.readOnly = locked;
        }
    });
    const gradeSelect = document.getElementById("statGrade");
    if (gradeSelect) gradeSelect.disabled = locked;

    const playerNameInput = document.getElementById("playerName");
    if (playerNameInput) {
        playerNameInput.disabled = locked;
        playerNameInput.readOnly = locked;
    }

    const createBtn = document.getElementById("createCharBtn");
    if (createBtn) {
        createBtn.disabled = locked;
        if (window.I18N) {
            createBtn.textContent = locked ? I18N.statsLocked : I18N.createChar;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing application');
    // ソケット接続の初期化に失敗しても、メニュー・ステータス表示など
    // 後続の必須初期化処理が巻き込まれて止まらないようにする
    try {
        initializeSocket();
    } catch (e) {
        console.error("initializeSocket() failed:", e);
    }

    // ============================================================
    // 最優先で初期化する部分（ここでエラーが起きると困るもの）：
    // サイドバー・メニューボタンのナビゲーションと、既存プレイヤーの
    // ステータス表示。これらは、他の機能（ショップ初期化など）で
    // 何か問題が起きても、絶対に動作し続けなければならない。
    // ============================================================

    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const menuButtons = document.querySelectorAll('.menu-btn');
    const contentSections = document.querySelectorAll('.content-section');

    console.log('Menu elements found:', {
        mobileMenuToggle: !!mobileMenuToggle,
        sidebar: !!sidebar,
        sidebarOverlay: !!sidebarOverlay,
        menuButtons: menuButtons.length,
        contentSections: contentSections.length
    });

    function toggleMobileMenu() {
        console.log('Toggle mobile menu called');
        if (!sidebar) return;
        const isOpen = sidebar.classList.toggle('active');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active', isOpen);
        if (mobileMenuToggle) mobileMenuToggle.textContent = isOpen ? '✕' : '☰';
        console.log('Menu toggled, isOpen:', isOpen);
    }

    function closeMobileMenu() {
        console.log('Close mobile menu called');
        if (!sidebar) return;
        sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        if (mobileMenuToggle) mobileMenuToggle.textContent = '☰';
    }

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
        console.log('Mobile menu toggle event listener attached');
    } else {
        console.error('Mobile menu toggle button not found!');
    }

    const refreshRankingBtn = document.getElementById('refreshRankingBtn');
    if (refreshRankingBtn) {
        refreshRankingBtn.addEventListener('click', () => {
            if (window.socket) {
                window.socket.emit('ranking:get');
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMobileMenu);
    }

    menuButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('Menu button clicked:', button.dataset.section);
            const section = button.dataset.section;

            menuButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            contentSections.forEach(sec => sec.classList.remove('active'));
            const activeSection = document.getElementById(`section-${section}`);
            if (activeSection) {
                activeSection.classList.add('active');
                console.log('Activated section:', section);
            } else {
                console.error('Section not found:', `section-${section}`);
            }

            if (section === 'ranking' && window.socket) {
                window.socket.emit('ranking:get');
            }

            // ショップ・インベントリタブを開いたときは最新状態を再描画する
            // （そうしないと、キャラクター作成直後などは何も表示されないままになる）
            if (section === 'shop' || section === 'inventory') {
                try {
                    if (typeof renderShop === "function") renderShop();
                    if (typeof renderInventory === "function") renderInventory();
                    if (typeof renderOriginalWeapons === "function") renderOriginalWeapons();
                    if (typeof renderMaterialsInventory === "function") renderMaterialsInventory();
                    if (typeof renderOrbInventory === "function") renderOrbInventory();
                } catch (e) {
                    console.error("Error rendering shop/inventory tab:", e);
                }
            }

            // デイリーミッションタブを開いたときは最新状態を再描画する
            if (section === 'missions') {
                try {
                    if (typeof renderDailyMissions === "function") renderDailyMissions();
                } catch (e) {
                    console.error("Error rendering missions tab:", e);
                }
            }

            // スキルツリータブを開いたときは最新状態を再描画する
            if (section === 'skills') {
                try {
                    if (typeof renderSkillTreeUI === "function") renderSkillTreeUI();
                } catch (e) {
                    console.error("Error rendering skills tab:", e);
                }
            }

            closeMobileMenu();
        });
    });

    // プレイヤーデータの読み込みとステータス表示の初期化
    try {
        const initialPlayer = getPlayerData();
        if (initialPlayer) {
            updateStatus(initialPlayer);
            updateXpDisplay(initialPlayer);
            document.getElementById("playerName").value = initialPlayer.name;
            if (typeof getStatsFromPlayer === "function") {
                setStatsToInputs(getStatsFromPlayer(initialPlayer));
            }
            lockStatInputs(true);
            const statDesc = document.getElementById("statAllocationDesc");
            if (statDesc) {
                statDesc.textContent = (window.I18N ? I18N.fixedStats : "ステータスは固定されています。");
            }
            // データ管理UIの初期化
            // 以前はcreateCharacter()内でしかこのボタンを有効化しておらず、
            // 一度ページを再読み込みした「既存プレイヤー」はこのボタンが
            // 永久に disabled のままになり、一切データ保存ができなかった
            // （＝他端末へのデータ引き継ぎが不可能だった）不具合があった。
            const playerIdEl = document.getElementById("currentPlayerId");
            if (playerIdEl) playerIdEl.textContent = initialPlayer.id;
            const saveDataBtnEl = document.getElementById("saveDataBtn");
            if (saveDataBtnEl) saveDataBtnEl.disabled = false;
        } else {
            // 新規作成時の処理
            if (typeof updateRemainingPoints === "function") {
                updateRemainingPoints();
            }
            lockStatInputs(false);
        }
    } catch (e) {
        console.error("Error initializing player status display:", e);
    }

    // プレイヤー削除ボタンのイベントリスナーを再設定
    // UIの動的な書き換えでリスナーが消える問題に対応
    const deletePlayerBtn = document.getElementById("deletePlayerBtn");
    if (deletePlayerBtn && deletePlayerBtn.parentNode) {
        // 既存のリスナーを削除して再設定するために、要素をクローンして置き換える
        const newBtn = deletePlayerBtn.cloneNode(true);
        deletePlayerBtn.parentNode.replaceChild(newBtn, deletePlayerBtn);

        newBtn.addEventListener('click', () => {
            if (window.I18N && confirm(I18N.deleteConfirm)) {
                if (studyStartTime !== null) stopStudy();
                localStorage.clear();
                alert(I18N.deleted);
                location.reload();
            }
        });
    }

    // ============================================================
    // ここから下は、他の機能の初期化（不具合があっても
    // ナビゲーションやステータス表示を巻き込まないよう、
    // 全体をtry/catchで保護している）
    // ============================================================
    try {
        // ショップ画面（武器作成ボタン・オーブ合成モーダルなど）のイベントを初期化する
        // ※ これを呼ばないと「武器を作成」「オーブ合成」ボタンが一切反応しなくなる
        if (typeof initShop === "function") {
            initShop();
        }

        // デイリーミッションの初期化
        if (typeof initializeDailyMissions === "function") {
            initializeDailyMissions();
        }

        // スキルセクションのサブタブ切り替えロジック
        const skillSubTabs = document.querySelectorAll('.sub-tab-btn');
        const skillSubContents = document.querySelectorAll('.sub-tab-content');

        skillSubTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                skillSubTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const subtabId = tab.dataset.subtab;
                skillSubContents.forEach(content => {
                    // `active` クラスの付け外しで表示/非表示を切り替える
                    content.classList.toggle('active', content.id === subtabId);
                });
            });
        });

        // 初期表示時に最初のサブタブをアクティブにする
        if (skillSubTabs.length > 0) {
            // 既にアクティブなタブがなければ、最初のタブをクリックして表示状態を初期化
            const hasActiveTab = Array.from(skillSubTabs).some(tab => tab.classList.contains('active'));
            if (!hasActiveTab) {
                skillSubTabs[0].click();
            }
        }

        // PWAインストールボタンのイベントリスナー
        const installButton = document.getElementById('install-button');
        if (installButton) {
            installButton.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    deferredPrompt = null;
                    const installPopup = document.getElementById('install-popup');
                    if (installPopup) {
                        installPopup.style.display = 'none';
                    }
                }
            });
        }
        const closeInstallPopup = document.getElementById('close-install-popup');
        if (closeInstallPopup) {
            closeInstallPopup.addEventListener('click', () => {
                const installPopup = document.getElementById('install-popup');
                if (installPopup) {
                    installPopup.style.display = 'none';
                }
            });
        }

        if (typeof setupPartyEventListeners === 'function') {
            setupPartyEventListeners();
        }

        const refreshRankingBtn = document.getElementById('refreshRankingBtn');
        if (refreshRankingBtn) {
            refreshRankingBtn.addEventListener('click', () => {
                if (window.socket) {
                    window.socket.emit('ranking:get');
                }
            });
        }

        // 勉強関連のイベントハンドラ
        const studyStartBtn = document.getElementById("studyStart");
        if (studyStartBtn) {
            studyStartBtn.addEventListener('click', startStudy);
        }
        const studyStopBtn = document.getElementById("studyStop");
        if (studyStopBtn) {
            studyStopBtn.addEventListener('click', stopStudy);
        }
        const studyFocusSelect = document.getElementById("studyFocus");
        if (studyFocusSelect) {
            studyFocusSelect.addEventListener('change', updateStatGrowthInfo);
            updateStatGrowthInfo(); // 初期表示
        }

        // データ管理ボタン
        const saveDataBtn = document.getElementById('saveDataBtn');
        if (saveDataBtn) {
            saveDataBtn.addEventListener('click', () => {
                syncPlayerToServer(false);
            });
        }

        const loadDataBtn = document.getElementById('loadDataBtn');
        if (loadDataBtn) {
            loadDataBtn.addEventListener('click', () => {
                const loadPlayerId = document.getElementById('loadPlayerId').value.trim().toUpperCase();
                if (!loadPlayerId || loadPlayerId.length !== 6) {
                    alert('プレイヤーIDは6文字で入力してください。');
                    return;
                }
                if (!window.socket || !window.socket.connected) {
                    alert('サーバーに接続されていません。ページを再読み込みしてください。');
                    return;
                }
                if (confirm(`プレイヤーID: ${loadPlayerId} のデータを読み込みます。\n現在のデータは上書きされます。よろしいですか？`)) {
                    window.socket.emit('loadData', loadPlayerId);
                }
            });
        }

        // ソロボスバトル開始ボタン
        const startSoloBossBattleBtn = document.getElementById('startSoloBossBattleBtn');
        if (startSoloBossBattleBtn) {
            startSoloBossBattleBtn.addEventListener('click', () => {
                const player = getPlayerData();
                if (!player) {
                    alert('まずはキャラクターを作成してください。');
                    return;
                }
                if (!window.socket || !window.socket.connected) {
                    alert('サーバーに接続されていません。ページを再読み込みしてください。');
                    return;
                }
                const bossId = document.getElementById('soloBossSelect').value;
                const difficulty = document.getElementById('soloBossDifficulty').value;
                if (!bossId) {
                    alert('ボスを選択してください。');
                    return;
                }
                // Save difficulty for result screen
                localStorage.setItem("battleDifficulty", difficulty);
                window.socket.emit('bosses:getDetails', { bossId, difficulty });
            });
        }

        // キャラクター作成・削除ボタン
        const createCharBtn = document.getElementById("createCharBtn");
        if (createCharBtn) {
            createCharBtn.addEventListener('click', createCharacter);
        }

        // 素材管理の初期化
        if (typeof initMaterials === "function") {
            initMaterials();
        }

        // 素材管理モーダルの開閉
        // （ボタンにクリックイベントが一切設定されておらず、押しても何も起きなかった。
        //   モーダルのHTML自体も存在しなかったため、あわせて追加した）
        const openMaterialManagementBtn = document.getElementById('openMaterialManagementBtn');
        const materialManagementModal = document.getElementById('materialManagementModal');
        if (openMaterialManagementBtn && materialManagementModal) {
            openMaterialManagementBtn.addEventListener('click', () => {
                if (typeof renderMaterialsInventory === "function") {
                    renderMaterialsInventory();
                }
                materialManagementModal.style.display = 'flex';
            });
            const closeMaterialManagementBtn = materialManagementModal.querySelector('.close');
            if (closeMaterialManagementBtn) {
                closeMaterialManagementBtn.addEventListener('click', () => {
                    materialManagementModal.style.display = 'none';
                });
            }
        }

        // オーブ作成モーダルの開閉
        const openOrbCraftingBtn = document.getElementById('openOrbCraftingBtn');
        const orbCraftingModal = document.getElementById('orbCraftingModal');
        if (openOrbCraftingBtn && orbCraftingModal) {
            openOrbCraftingBtn.addEventListener('click', () => {
                if (typeof showMaterialCraftingUI === "function") {
                    showMaterialCraftingUI();
                }
                orbCraftingModal.style.display = 'flex';
            });
            const closeOrbCraftingBtn = orbCraftingModal.querySelector('.close');
            if (closeOrbCraftingBtn) {
                closeOrbCraftingBtn.addEventListener('click', () => {
                    orbCraftingModal.style.display = 'none';
                });
            }
        }

        // ギルドシステムの初期化
        if (typeof initializeGuildSystem === "function") {
            initializeGuildSystem();
        }

        // スキルツリーの初期描画
        if (typeof renderSkillTreeUI === "function") {
            renderSkillTreeUI();
        }

        // ステータス入力欄のイベントリスナー
        const statInputs = document.querySelectorAll('.stat-allocation input, .stat-allocation select');
        statInputs.forEach(input => {
            input.addEventListener('input', updateRemainingPoints);
        });
    } catch (e) {
        console.error("Error during secondary page initialization:", e);
    }
});

/**
 * デバッグ用の一撃必殺武器をプレイヤーに付与するコマンド
 */
function giveOneShotWeapon() {
    const player = getPlayerData();
    if (!player) {
        console.error("プレイヤーが存在しません。");
        return;
    }

    // デバッグ武器の定義
    const debugWeapon = {
        id: `debug_one_shot_${Date.now()}`,
        name: "デバッガーズ・ジェノサイド",
        type: "spear", // どの武器種でも良い
        isOriginal: true, // オリジナル武器として扱うと管理が楽
        multiplier: 999,
        statBonuses: { atk: 999 },
        uniqueAbilities: [
            ORB_UNIQUE_ABILITIES.one_shot_kill, // 一撃必殺
            ORB_UNIQUE_ABILITIES.sure_hit      // 必中
        ],
        ultimateName: "コード・デストラクション"
    };

    const updatedPlayer = addWeaponToPlayer(player, debugWeapon);
    localStorage.setItem("player", JSON.stringify(updatedPlayer));

    alert(`デバッグ武器「${debugWeapon.name}」を付与しました。インベントリを確認し、装備してください。`);
    // UIを更新
    if (typeof renderInventory === 'function') renderInventory();
    if (typeof renderOriginalWeapons === 'function') renderOriginalWeapons();
    if (typeof updateStatus === 'function') updateStatus(updatedPlayer);
}
// コンソールからアクセスできるようにグローバルに公開
window.giveOneShotWeapon = giveOneShotWeapon;
