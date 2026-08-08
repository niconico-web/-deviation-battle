let studyStartTime = null, studyTimerInterval = null, studyElapsedBefore = 0;
let socketHandlersSetup = false;
let matchmakingTimeout = null;
let pendingRandomMatchPlayer = null;

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

    // Connection logging
    window.socket.on("connect", () => {
        console.log("接続:", window.socket.id);
        updateOnlineButtons(true); // ボタンを有効化
        
        // Call setup for online features
        if (typeof setupOnlineEventHandlers === 'function') {
            setupOnlineEventHandlers();
        }

        if (pendingRandomMatchPlayer) {
            console.log("Re-emitting pending random match request after reconnect", pendingRandomMatchPlayer.id);
            window.socket.emit("requestRandomMatch", pendingRandomMatchPlayer);
        }
    });

    window.socket.on("disconnect", () => {
        console.log("切断");
        updateOnlineButtons(false); // ボタンを無効化
    });

    window.socket.on("connect_error", (error) => {
        console.log("接続エラー:", error);
        updateOnlineButtons(false); // ボタンを無効化
    });
    
    // 接続状態の管理は connect/disconnect/connect_error イベントに一本化

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

    // Initialize connection state
    // window.socket.connected = false; // setIntervalが管理
    
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
        grade: Math.floor(Number(document.getElementById("statGrade").value))
    };
}

function setStatsToInputs(stats) {
    document.getElementById("statMaxHp").value = stats.maxHp;
    document.getElementById("statAtk").value = stats.atk;
    document.getElementById("statDef").value = stats.def;
    document.getElementById("statSpeed").value = stats.speed;
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

    // 名前のバリデーション（新規作成時のみ）
    if (!existing && typeof validateName === "function") {
        const validation = validateName(name);
        if (!validation.valid) {
            alert(validation.reason);
            return;
        }
    }

    if (!existing) {
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

    const xp = existing ? existing.xp : 0;
    const totalStudySeconds = existing ? (existing.totalStudySeconds || 0) : 0;
    const player = buildPlayer(name, stats, xp, {
        totalStudySeconds,
        grade: stats.grade,
        id: existing?.id,
        coins: existing?.coins || 0,
        weapons: existing?.weapons || [],
        equippedWeapon: existing?.equippedWeapon || null,
        weaponWins: existing?.weaponWins || {}
    });
    localStorage.setItem("player", JSON.stringify(player));
    updateStatus(player);
    updateXpDisplay(player);
    
    // Lock stat inputs after creation
    lockStatInputs(true);
    document.getElementById("statAllocationDesc").textContent = I18N.fixedStats;
    
    alert(I18N.charCreated);
}

function updateStatus(player) {
    const weaponText = player.equippedWeapon
        ? getWeaponDisplayName(player.equippedWeapon)
        : "なし";
    
    // 武器補正を適用したステータスを取得
    const battleStats = getBattleStats(player);
    
    document.getElementById("status").innerHTML =
        "<h2>" + I18N.status + "</h2>" +
        "<p><strong>" + I18N.playerNameLabel + "</strong>" + player.name + "</p>" +
        "<p><strong>" + I18N.level + I18N.colon + "</strong>" + (player.level || 1) + " <strong>" + I18N.xp + I18N.colon + "</strong>" + (player.xp || 0) + "</p>" +
        "<p><strong>コイン" + I18N.colon + "</strong>" + (player.coins || 0) + "</p>" +
        "<p><strong>装備武器" + I18N.colon + "</strong>" + weaponText + "</p><hr>" +
        "<p>HP" + I18N.colon + battleStats.maxHp + "</p>" +
        "<p>" + I18N.atk + I18N.colon + battleStats.atk + "</p>" +
        "<p>" + I18N.def + I18N.colon + battleStats.def + "</p>" +
        "<p>" + I18N.speed + I18N.colon + battleStats.speed + "</p>" +
        "<p>学年" + I18N.colon + player.grade + "</p><hr>" +
        "<p>" + I18N.totalStudy + formatTime(player.totalStudySeconds || 0) + "</p>";
}

function updateXpDisplay(player) {
    const el = document.getElementById("xpDisplay"); if (!el) return;
    const lv = player.level || 1, xp = player.xp || 0;
    el.textContent = I18N.xp + I18N.colon + xp + " (Lv." + lv + " -> " + I18N.xpNext + " " + xpToNextLevel(lv) + " XP)";
}

function getPlayerData() {
    const raw = localStorage.getItem("player");
    return raw ? migratePlayer(JSON.parse(raw)) : null;
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
    document.getElementById("studyStart").disabled = false;
    document.getElementById("studyStop").disabled = true;
    document.getElementById("studyFocus").disabled = false;
    applyStudyRewards(elapsed);
    document.getElementById("studyTimer").textContent = "00:00:00";
}

function updateStudyTimerDisplay() {
    if (studyStartTime === null) return;
    document.getElementById("studyTimer").textContent = formatTime(studyElapsedBefore + Math.floor((Date.now() - studyStartTime) / 1000));
}

// Map subjects to the 2 stats they strengthen
const SUBJECT_STATS = {
    jp: ["maxHp", "def"],     // 国語 → HP・防御
    math: ["atk", "speed"],   // 算数・数学 → 攻撃・速さ
    eng: ["def", "speed"],    // 英語 → 防御・速さ
    sci: ["atk", "maxHp"],    // 理科 → 攻撃・HP
    soc: ["maxHp", "def"]     // 社会 → HP・防御
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
    const [stat1, stat2] = SUBJECT_STATS[subject];
    const statNames = {
        maxHp: "HP",
        atk: I18N.atk,
        def: I18N.def,
        speed: I18N.speed
    };
    const infoEl = document.getElementById("statGrowthInfo");
    if (infoEl) {
        infoEl.innerHTML = `<p><strong>${I18N.statGrowthInfo}</strong>${statNames[stat1]}・${statNames[stat2]}</p>`;
    }
}

function applyStudyRewards(seconds) {
    if (seconds < 60) { alert("勉強時間は1分以上にしてください"); return; }
    const player = getPlayerData(); if (!player) return;
    const subject = document.getElementById("studyFocus").value;
    const stats = getStatsFromPlayer(player);
    const gainedXp = calcStudyXp(seconds);
    let statGain = calcStatGain(seconds);
    
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
    
    const [stat1, stat2] = SUBJECT_STATS[subject];
    stats[stat1] += statGain;
    stats[stat2] += statGain;

    const hp = (stat1 === "maxHp" || stat2 === "maxHp")
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

    const updated = buildPlayer(player.name, stats, (player.xp || 0) + gainedXp, {
        hp,
        totalStudySeconds: (player.totalStudySeconds || 0) + seconds,
        grade: player.grade,
        id: player.id,
        coins: (player.coins || 0) + gainedCoins,
        weapons: player.weapons,
        equippedWeapon: player.equippedWeapon,
        weaponWins: player.weaponWins,
        orbs: player.orbs || []
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
    const subjectLabel = { jp: I18N.hpDef, math: I18N.mathAtk, eng: I18N.engDefSpeed, sci: I18N.sciAtk, soc: I18N.socHp }[subject];
    let msg = I18N.studyDone + "\n" + I18N.time + I18N.colon + formatTime(seconds) + "\n" + I18N.xp + " +" + gainedXp + "\n" + subjectLabel + I18N.statUp + " +" + statGain;
    if (hasOverwhelmingGrowth) msg += "（圧倒的成長性発動中！）";
    if (gainedCoins > 0) msg += "\nコイン +" + gainedCoins + "（30分以上の勉強ボーナス）";
    if (droppedOrb && typeof getOrbDisplayName === "function") {
        msg += "\n\n★オーブを入手！★\n" + getOrbDisplayName(droppedOrb);
    }
    alert(msg);
    if (typeof renderShop === "function") {
        renderShop();
        renderInventory();
    }
}

// Online event handlers are now in online.js

function getMatchPlayer() {
    const p = getPlayerData();
    if (!p) return null;
    const battleStats = getBattleStats(p);
    // 武器補正後のmaxHpをHPとして設定（常にフルHPで開始）
    return { ...p, ...battleStats, hp: battleStats.maxHp, battleStats };
}

function setupSocketEventHandlers() {
    if (!window.socket || socketHandlersSetup) return;
    socketHandlersSetup = true;
    
    console.log("Setting up socket event handlers...");

    console.log("Socket event handlers setup complete");
}

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

function setupDOMEventHandlers() {
    // モバイルメニュートグル
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });
        
        // メニュー外をクリックしたら閉じる
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            }
        });
    }

    // サイドバーメニューのイベントハンドラー
    const menuButtons = document.querySelectorAll('.menu-btn');
    menuButtons.forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;
            if (section) {
                // 全てのメニューボタンとセクションのactiveクラスを削除
                menuButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
                
                // クリックされたボタンと対応するセクションにactiveクラスを追加
                button.classList.add('active');
                const targetSection = document.getElementById(`section-${section}`);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
                
                // モバイルの場合はメニューを閉じる
                if (window.innerWidth < 768) {
                    sidebar.classList.remove('active');
                }
            }
        });
    });

    const deleteBtn = document.getElementById("deletePlayerBtn");
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (!confirm(I18N.deleteConfirm)) return;
            if (studyStartTime !== null) stopStudy();
            localStorage.removeItem("player");
            localStorage.removeItem("battlePlayer");
            localStorage.removeItem("enemy");
            localStorage.removeItem("roomId");
            localStorage.removeItem("isBotBattle");
            document.getElementById("playerName").value = "";
            setStatsToInputs(DEFAULT_STATS);
            document.getElementById("status").innerHTML = "<h2>" + I18N.status + "</h2><p>" + I18N.noChar + "</p>";
            updateXpDisplay({ xp: 0, level: 1 });
            alert(I18N.deleted);
        };
    }

    const studyStartBtn = document.getElementById("studyStart");
    if (studyStartBtn) {
        studyStartBtn.onclick = startStudy;
    }

    const studyStopBtn = document.getElementById("studyStop");
    if (studyStopBtn) {
        studyStopBtn.onclick = stopStudy;
    }

    const studyFocusSelect = document.getElementById("studyFocus");
    if (studyFocusSelect) {
        studyFocusSelect.onchange = updateStatGrowthInfo;
    }
}

STAT_KEYS.forEach(key => {
    const inputId = key === "maxHp" ? "statMaxHp" : "stat" + key.charAt(0).toUpperCase() + key.slice(1);
    const el = document.getElementById(inputId);
    if (el) el.addEventListener("input", updateRemainingPoints);
});

function initializeI18nTexts() {
    // Set all i18n text elements
    const elements = {
        "subtitle": I18N.subtitle,
        "playerNameLabel": I18N.playerName,
        "statAllocationTitle": I18N.statAllocation,
        "statAllocationDesc": I18N.statAllocationDesc,
        "playerName": { placeholder: I18N.playerNamePh },
        "studyTimerTitle": I18N.studyTimer,
        "studyDesc": I18N.studyDesc,
        "studyFocusLabel": I18N.studyFocus,
        "createCharBtn": I18N.createChar,
        "studyStart": I18N.studyStart,
        "studyStop": I18N.studyStop,
        "onlineTitle": I18N.online,
        "randomMatch": I18N.randomMatch,
        "createRoom": I18N.createRoom,
        "joinRoom": I18N.joinRoom,
        "roomCodeLabel": I18N.roomCode,
        "roomInput": { placeholder: I18N.roomPh },
        "deletePlayerBtn": I18N.deletePlayer
    };

    for (const [id, text] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (!el) continue;
        
        if (typeof text === 'object' && text.placeholder) {
            el.placeholder = text.placeholder;
        } else {
            el.textContent = text;
        }
    }

    // Set select options for subjects
    const selectOptions = {
        "jpOpt": I18N.jp,
        "mathOpt": I18N.math,
        "engOpt": I18N.eng,
        "sciOpt": I18N.sci,
        "socOpt": I18N.soc
    };
    for (const [id, text] of Object.entries(selectOptions)) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // Set stat labels
    const labelTexts = {
        "atkLabelText": I18N.atk,
        "defLabelText": I18N.def,
        "speedLabelText": I18N.speed
    };
    for (const [id, text] of Object.entries(labelTexts)) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
}

window.onload = () => {
    console.log("window.onload triggered.");
    // Check file protocol
    if (location.protocol === "file:") { alert(I18N.fileWarn); }

    // Check for room parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        console.log("URLからルームコードを検出:", roomParam);
        // Store room code for auto-join after player initialization
        window.pendingRoomJoin = roomParam.toUpperCase();
    }

    // Initialize socket
    initializeSocket();

    // Setup socket event handlers
    setTimeout(setupSocketEventHandlers, 200);

    initializeI18nTexts();
    updateStatGrowthInfo();
    updateRemainingPoints();

    // Setup DOM event handlers
    setupDOMEventHandlers();

    const player = getPlayerData();
    if (player) {
        console.log("既存のプレイヤーデータ found:", player);
        updateStatus(player);
        updateXpDisplay(player);
        document.getElementById("playerName").value = player.name;
        setStatsToInputs(getStatsFromPlayer(player));
        // Lock stat inputs after character creation
        lockStatInputs(true);
        // Update stat allocation description for existing players
        document.getElementById("statAllocationDesc").textContent = I18N.fixedStats;

        // Auto-join room if pending
        if (window.pendingRoomJoin) {
            setTimeout(() => {
                autoJoinRoom(window.pendingRoomJoin);
            }, 1000);
        }
    } else {
        console.log("プレイヤーデータなし、デフォルト値を使用");
        setStatsToInputs(DEFAULT_STATS);
        updateXpDisplay({ xp: 0, level: 1 });
        lockStatInputs(false);
    }
};

function autoJoinRoom(roomId) {
    if (!window.socket || !window.socket.connected) {
        setTimeout(() => autoJoinRoom(roomId), 1000);
        return;
    }

    const player = getMatchPlayer();
    if (!player) {
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    document.getElementById("roomInput").value = roomId;
    window.socket.emit("playerJoin", player);
    window.socket.emit("joinRoom", { roomId, player });
    window.history.replaceState({}, document.title, window.location.pathname);
}

function lockStatInputs(locked) {
    STAT_KEYS.forEach(key => {
        const inputId = key === "maxHp" ? "statMaxHp" : "stat" + key.charAt(0).toUpperCase() + key.slice(1);
        const el = document.getElementById(inputId);
        if (el) {
            el.disabled = locked;
            el.readOnly = locked;
        }
    });
    // Also lock the grade select
    const gradeSelect = document.getElementById("statGrade");
    if (gradeSelect) {
        gradeSelect.disabled = locked;
    }
    // Lock player name input
    const playerNameInput = document.getElementById("playerName");
    if (playerNameInput) {
        playerNameInput.disabled = locked;
        playerNameInput.readOnly = locked;
    }
    const createBtn = document.getElementById("createCharBtn");
    if (createBtn) {
        createBtn.disabled = locked;
        createBtn.textContent = locked ? I18N.statsLocked : I18N.createChar;
    }
}
