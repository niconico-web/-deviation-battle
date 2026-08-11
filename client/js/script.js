let studyStartTime = null, studyTimerInterval = null, studyElapsedBefore = 0;
let socketHandlersSetup = false;
let matchmakingTimeout = null;
let pendingRandomMatchPlayer = null;

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
            alert('このサイトは同時に1つのタブでのみ使用できます。既存のタブを閉じてから再度開いてください。');
            window.location.href = 'about:blank';
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
        weaponWins: existing?.weaponWins || {},
        orbs: existing?.orbs || [],
        skillTree: existing?.skillTree,
        skillSlots: existing?.skillSlots,
        customSkills: existing?.customSkills
    });
    localStorage.setItem("player", JSON.stringify(player));
    updateStatus(player);
    updateXpDisplay(player);
    
    // Lock stat inputs after creation
    lockStatInputs(true);
    document.getElementById("statAllocationDesc").textContent = I18N.fixedStats;
    
    // Update data management UI
    const playerIdEl = document.getElementById("currentPlayerId");
    if (playerIdEl) playerIdEl.textContent = player.id;
    const saveDataBtn = document.getElementById("saveDataBtn");
    if (saveDataBtn) saveDataBtn.disabled = false;

    syncPlayerToServer(true);

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
        "<p><strong>プレイヤーID" + I18N.colon + "</strong>" + player.id + "</p>" +
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
        customSkills: player.customSkills
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
    const subjectLabel = { jp: I18N.hpDef, math: I18N.mathAtk, eng: I18N.engDefSpeed, sci: I18N.sciAtk, soc: I18N.socHp }[subject];
    let msg = I18N.studyDone + "\n" + I18N.time + I18N.colon + formatTime(seconds) + "\n" + I18N.xp + " +" + gainedXp + "\n" + subjectLabel + I18N.statUp + " +" + statGain;
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
}

// Online event handlers are now in online.js

function getMatchPlayer() {
    const p = getPlayerData();
    if (!p) return null;
    const battleStats = getBattleStats(p);
    // 武器補正後のmaxHpをHPとして設定（常にフルHPで開始）
    return { ...p, ...battleStats, hp: battleStats.maxHp, battleStats };
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
    if (!window.socket || !window.socket.connected) return false;
    pendingSilentSave = !!silent;
    window.socket.emit("saveData", player);
    return true;
}

function setupSocketEventHandlers() {
    if (!window.socket || socketHandlersSetup) return;
    socketHandlersSetup = true;
    
    console.log("Setting up socket event handlers...");

    // データ保存・読み込み関連のイベント
    window.socket.on("dataSaved", (info) => {
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

    console.log("Socket event handlers setup complete");
}

// グローバルにアクセス可能に
window.normalizePlayerId = normalizePlayerId;
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

function setupDOMEventHandlers() {
    // --- Menu Handling ---
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    const menuButtons = document.querySelectorAll('.menu-btn');

    // スキルツリーのメニュー項目を動的に追加
    const skillTreeBtn = document.createElement('button');
    skillTreeBtn.className = 'menu-btn';
    skillTreeBtn.dataset.section = 'skill-tree';
    skillTreeBtn.innerHTML = '<span>🔧</span> スキルツリー';
    sidebar.insertBefore(skillTreeBtn, document.querySelector('.menu-btn[data-section="help"]'));

    // スキルツリーのセクションを動的に追加
    const skillTreeSection = document.createElement('section');
    skillTreeSection.id = 'section-skill-tree';
    skillTreeSection.className = 'content-section';
    skillTreeSection.innerHTML = `<h2>スキルツリー</h2><div id="skillTreeContainer"></div>`;
    document.querySelector('main').appendChild(skillTreeSection);

    if (mobileMenuToggle && sidebar) {
        // Listener for the main toggle button
        mobileMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from immediately closing the menu via the document listener
            sidebar.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });
    }

    // 更新されたメニューボタンリストでリスナーを再設定
    document.querySelectorAll('.menu-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;
            switchSection(section);

            // On mobile, close the sidebar after ANY menu item is clicked
            if (window.innerWidth < 768 && sidebar && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                if (mobileMenuToggle) {
                    mobileMenuToggle.classList.remove('active');
                }
            }
        });
    });

    // Listener to close the sidebar when clicking anywhere outside of it
    document.addEventListener('click', (e) => {
        if (sidebar && sidebar.classList.contains('active')) {
            // Check if the click was outside the sidebar AND outside the toggle button
            if (!sidebar.contains(e.target) && mobileMenuToggle && !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            }
        }
    });

    // --- Other Event Handlers ---
    const deleteBtn = document.getElementById("deletePlayerBtn");
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (!confirm(I18N.deleteConfirm)) return;
            if (studyStartTime !== null) stopStudy();
            localStorage.clear(); // Clear all data for a fresh start
            document.getElementById("playerName").value = "";
            setStatsToInputs(DEFAULT_STATS);
            document.getElementById("status").innerHTML = "<h2>" + I18N.status + "</h2><p>" + I18N.noChar + "</p>";
            updateXpDisplay({ xp: 0, level: 1 });
            lockStatInputs(false); // Unlock inputs for new character
            const playerIdEl = document.getElementById("currentPlayerId");
            if (playerIdEl) playerIdEl.textContent = "なし";
            const saveDataBtn = document.getElementById("saveDataBtn");
            if (saveDataBtn) saveDataBtn.disabled = true;
            alert(I18N.deleted);
            location.reload(); // Reload to apply changes cleanly
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

    // --- Data Management UI Injection and Handlers ---
    const characterSection = document.getElementById('section-stats');
    const deleteBtnEl = document.getElementById("deletePlayerBtn");

    if (characterSection) {
        const dataManagementContainer = document.createElement('div');
        dataManagementContainer.id = 'dataManagement';
        dataManagementContainer.className = 'setting-box';
        dataManagementContainer.innerHTML = `
            <h3>データ管理</h3>
            <p>現在のプレイヤーID: <strong id="currentPlayerId">なし</strong></p>
            <button id="saveDataBtn" class="btn">データをサーバーに保存</button>
            <p class="help-text">このデバイスのキャラクターデータをサーバーに保存し、他のデバイスで同じIDを使って引き継げるようにします。</p>
            <hr>
            <h4>データ引き継ぎ</h4>
            <div class="input-group">
                <input type="text" id="loadPlayerIdInput" placeholder="プレイヤーIDを入力">
                <button id="loadDataBtn" class="btn">このIDのデータを引き継ぐ</button>
            </div>
            <p class="help-text">入力したIDのデータをサーバーから読み込みます。<strong>現在のキャラクターデータは上書きされます。</strong></p>
        `;
        
        if (deleteBtnEl && deleteBtnEl.parentElement) {
            characterSection.insertBefore(dataManagementContainer, deleteBtnEl.parentElement);
        } else {
            characterSection.appendChild(dataManagementContainer);
        }

        document.getElementById("saveDataBtn").onclick = () => {
            const player = getPlayerData();
            if (!player) { alert("保存するキャラクターデータがありません。"); return; }
            if (confirm(`現在のキャラクターデータをサーバーに保存しますか？\n\nプレイヤーID: ${player.id}\n同じIDのデータは上書きされます。`)) {
                if (window.socket && window.socket.connected) { syncPlayerToServer(false); } else { alert("サーバーに接続されていません。"); }
            }
        };

        document.getElementById("loadDataBtn").onclick = () => {
            const playerIdToLoad = normalizePlayerId(document.getElementById("loadPlayerIdInput").value);
            if (!playerIdToLoad) { alert("引き継ぎたいプレイヤーIDを入力してください。"); return; }
            document.getElementById("loadPlayerIdInput").value = playerIdToLoad;
            if (confirm(`プレイヤーID「${playerIdToLoad}」のデータを引き継ぎますか？\n現在のキャラクターデータは失われます。`)) {
                if (window.socket && window.socket.connected) { window.socket.emit("loadData", playerIdToLoad); } else { alert("サーバーに接続されていません。"); }
            }
        };
    }
}

function switchSection(section) {
    if (!section) return;

    // Deactivate all sections and other menu buttons
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));

    // Activate the target section and the clicked button
    const activeSection = document.getElementById(`section-${section}`);
    if (activeSection) {
        activeSection.classList.add('active');
        // スキルツリーセクションが表示されるときに再描画
        if (section === 'skills' && typeof renderSkillTreeUI === 'function') {
            console.log('switchSection: calling renderSkillTreeUI for skills section');
            setTimeout(() => renderSkillTreeUI(), 100); // 少し遅延させてDOMが確実にレンダリングされるように
        }
    }
    const activeButton = document.querySelector(`.menu-btn[data-section="${section}"]`);
    if (activeButton) activeButton.classList.add('active');
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

    // スキルツリーUIを初期化（skillTree.js は index.html で静的に読み込み済み）
    if (typeof renderSkillTreeUI === "function") {
        renderSkillTreeUI();
    } else {
        const skillTreeScript = document.createElement('script');
        skillTreeScript.src = 'js/skillTree.js';
        skillTreeScript.onload = () => {
            if (typeof renderSkillTreeUI === "function") renderSkillTreeUI();
        };
        document.body.appendChild(skillTreeScript);
    }

    const saveDataSection = document.getElementById('saveDataSection');
    const loadDataHelpText = document.getElementById('loadDataHelpText');

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

        const playerIdEl = document.getElementById("currentPlayerId");
        if (playerIdEl) playerIdEl.textContent = player.id;
        const saveDataBtn = document.getElementById("saveDataBtn");
        if (saveDataBtn) saveDataBtn.disabled = false;

        if (saveDataSection) saveDataSection.style.display = 'block';
        if (loadDataHelpText) loadDataHelpText.innerHTML = '入力したIDのデータをサーバーから読み込みます。<strong>現在のキャラクターデータは上書きされます。</strong>';

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
        const playerIdEl = document.getElementById("currentPlayerId");
        if (playerIdEl) playerIdEl.textContent = "なし";
        const saveDataBtn = document.getElementById("saveDataBtn");
        if (saveDataBtn) saveDataBtn.disabled = true;
    }

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/js/sw.js', { scope: '/' })
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
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
