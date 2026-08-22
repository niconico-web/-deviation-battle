// client/js/guild.js

const GUILD_QUEST_STORAGE_KEY = 'guildWeeklyQuests';

// ============================================================================
// ギルドデータ管理
// ============================================================================

/**
 * プレイヤーのギルド情報を取得する。
 * @returns {object|null} ギルド情報オブジェクト、または未参加の場合はnull。
 */
function getPlayerGuild() {
    const player = getPlayerData();
    return player ? (player.guild || null) : null;
}

/**
 * プレイヤーのギルド情報を設定する。
 * @param {object|null} guildData - 設定するギルド情報。nullの場合はギルドから脱退。
 */
function setPlayerGuild(guildData) {
    let player = getPlayerData();
    if (!player) return;

    player.guild = guildData;
    localStorage.setItem("player", JSON.stringify(player));
    renderGuildUI(); // UIを更新
}

// ============================================================================
// クエストデータ管理 (クライアントサイドの簡易実装)
// 実際にはサーバーで管理されるべきデータですが、今回はクライアントで仮実装
// ============================================================================

/**
 * 週IDを生成する関数 (月曜始まり)
 * @param {Date} [date=new Date()] - 基準日
 * @returns {string} 'YYYY-WW' 形式の週ID
 */
function getWeekId(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // 月曜日を週の始まり(0)とする
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum); // 週の月曜日に移動
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

/**
 * クライアントサイドでクエストリストを管理する (仮)
 * 実際にはサーバーから取得・更新されるべきです。
 */
function getGuildQuests() {
    const data = localStorage.getItem(GUILD_QUEST_STORAGE_KEY);
    return data ? JSON.parse(data) : { weekId: null, quests: [] };
}

function saveGuildQuests(data) { // data is { weekId, quests }
    localStorage.setItem(GUILD_QUEST_STORAGE_KEY, JSON.stringify(data));
}

/**
 * クエストを受注する
 * @param {string} questId - 受注するクエストのID
 */
function acceptQuest(questId) {
    let questsData = getGuildQuests();
    let quests = questsData.quests;
    let player = getPlayerData();
    if (!player) return;

    const questIndex = quests.findIndex(q => q.id === questId);
    if (questIndex > -1 && quests[questIndex].status === 'available') {
        // ランクチェック
        const playerRank = getAdventurerRank(player);
        const questRank = quests[questIndex].rank;
        if (playerRank < getRankValue(questRank)) {
            alert(`ランク不足です。必要ランク: ${questRank} (現在: ${playerRank})`);
            return;
        }
        
        quests[questIndex].status = 'active'; // 'available' -> 'active'
        quests[questIndex].assignedTo = player.id;
        questsData.quests = quests;
        saveGuildQuests(questsData);
        renderQuestBoard();
        renderActiveQuests();
        alert('クエストを受注しました！');
    }
}

/**
 * ギルドクエストの進捗を更新する
 * @param {string} type - クエストのタイプ (e.g., 'defeat_boss', 'collect_material')
 * @param {object|number} value - 達成した内容 (e.g., { bossId: '...', count: 1 }, 1)
 */
function updateGuildQuestProgress(type, value) {
    let questsData = getGuildQuests();
    let quests = questsData.quests;
    const player = getPlayerData();
    if (!player) return;

    let questUpdated = false;
    const activeQuests = quests.filter(q => q.assignedTo === player.id && q.status === 'active');

    activeQuests.forEach(quest => {
        if (quest.type === type) {
            let progressMade = false;
            switch (type) {
                case 'defeat_boss':
                    if (quest.target.bossId === value.bossId && quest.target.difficulty === value.difficulty) {
                        quest.progress = (quest.progress || 0) + 1;
                        progressMade = true;
                    }
                    break;
                case 'collect_material':
                    if (quest.target.materialId === value.materialId) {
                        quest.progress = (quest.progress || 0) + value.count;
                        progressMade = true;
                    }
                    break;
                case 'win_online':
                case 'study_time':
                    quest.progress = (quest.progress || 0) + value;
                    progressMade = true;
                    break;
            }

            if (progressMade) {
                questUpdated = true;
                const targetCount = quest.target.count || quest.target.seconds || 1;
                if (quest.progress >= targetCount) {
                    quest.status = 'completed';
                    quest.progress = targetCount;
                    
                    // クエスト報酬を計算
                    const rankValue = getRankValue(quest.rank);
                    const coinReward = rankValue * 50; // ランク×50コイン
                    const xpReward = rankValue * 100; // ランク×100XP
                    let orbReward = null;
                    
                    // 高ランククエストでオーブ確定ドロップ
                    if (rankValue >= 5) { // Bランク以上
                        const orbTier = rankValue >= 7 ? 'tier4' : (rankValue >= 6 ? 'tier3' : 'tier2');
                        orbReward = createOrb(orbTier);
                    }
                    
                    // プレイヤーに報酬を付与
                    player.coins = (player.coins || 0) + coinReward;
                    player.xp = (player.xp || 0) + xpReward;
                    if (orbReward) {
                        if (!player.orbs) player.orbs = [];
                        player.orbs.push(orbReward);
                    }
                    localStorage.setItem("player", JSON.stringify(player));
                    
                    // ギルド貢献度を付与
                    const playerGuild = getPlayerGuild();
                    if (playerGuild) {
                        playerGuild.contribution = (playerGuild.contribution || 0) + (quest.reward || 0);
                        setPlayerGuild(playerGuild);
                    }
                    
                    // 報酬メッセージを表示
                    let rewardMessage = `クエスト「${quest.title}」を達成しました！\n報酬: ${coinReward}コイン, ${xpReward}XP`;
                    if (orbReward) {
                        rewardMessage += `\n特別報酬: ${getOrbDisplayName(orbReward)}`;
                    }
                    alert(rewardMessage);
                    
                    // クエストボードとアクティブクエストを更新
                    renderQuestBoard();
                    renderActiveQuests();
                }
            }
        }
    });

    if (questUpdated) {
        questsData.quests = quests;
        saveGuildQuests(questsData);
        renderActiveQuests();
    }
}

// ============================================================================
// UIレンダリング
// ============================================================================

/**
 * ギルドUI全体をレンダリングする。
 */
function renderGuildUI() {
    const playerGuild = getPlayerGuild();
    const guildInfoSection = document.getElementById('guild-info');
    const noGuildSection = document.getElementById('no-guild');

    if (playerGuild) {
        // ギルド参加中
        if (guildInfoSection) guildInfoSection.style.display = 'block';
        if (noGuildSection) noGuildSection.style.display = 'none';

        const myGuildDetails = document.getElementById('my-guild-details');
        if (myGuildDetails) {
            myGuildDetails.innerHTML = `
                <h4>${playerGuild.name}</h4>
                <p>${playerGuild.description}</p>
                <p>メンバー: ${playerGuild.members.length}人</p>
                <p>あなたの貢献度: ${playerGuild.contribution || 0}</p>
            `;
        }
    } else {
        // ギルド未参加
        if (guildInfoSection) guildInfoSection.style.display = 'none';
        if (noGuildSection) noGuildSection.style.display = 'block';
    }
    renderQuestBoard();
    renderActiveQuests();
}

/**
 * クエスト掲示板をレンダリングする。
 * @param {string} filterCategory - フィルタリングするカテゴリ ('all', 'BATTLE', 'DELIVERY'など)
 */
function renderQuestBoard(filterCategory = 'all') {
    const questBoard = document.getElementById('quest-board');
    if (!questBoard) return;

    const playerGuild = getPlayerGuild();
    if (!playerGuild) {
        questBoard.innerHTML = '<p>ギルドに参加していないとクエストを受注できません。</p>';
        return;
    }

    const player = getPlayerData();
    if (!player) {
        questBoard.innerHTML = '<p>キャラクターを作成してください。</p>';
        return;
    }

    const questsData = getGuildQuests();
    const quests = questsData.quests || [];

    const filteredQuests = filterCategory === 'all'
        ? quests.filter(q => q.status === 'available')
        : quests.filter(q => q.category === filterCategory);

    if (filteredQuests.length === 0) {
        questBoard.innerHTML = '<p>現在、利用可能なクエストはありません。</p>';
        return;
    }

    filteredQuests.forEach(quest => {
        const questCard = document.createElement('div');
        questCard.className = 'quest-card';
        
        // 冒険者ランクチェック
        const playerRank = getAdventurerRank(player);
        const canAccept = playerRank >= getRankValue(quest.rank);
        
        questCard.innerHTML = `
            <h3>${quest.title} (${quest.rank || 'N/A'}ランク)</h3>
            <p>${quest.description}</p>
            <p>報酬: ${quest.reward || 0}貢献度</p>
            <p>必要ランク: ${quest.rank || 'N/A'} (現在: ${playerRank})</p>
            ${quest.status === 'completed' 
                ? '<button class="btn btn-disabled" disabled>完了</button>'
                : canAccept 
                    ? `<button class="btn btn-primary accept-quest-btn" data-quest-id="${quest.id}">受注する</button>`
                    : `<button class="btn btn-disabled" disabled>ランク不足</button>`
            }
        `;
        questBoard.appendChild(questCard);
    });

    questBoard.querySelectorAll('.accept-quest-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            acceptQuest(e.target.dataset.questId);
        });
    });
}

/**
 * プレイヤーの冒険者ランクを取得する。
 */
function getAdventurerRank(player) {
    // ギルドに参加している場合は、冒険者経験値に基づいてランクを決定
    if (player.guild && player.adventurerExp) {
        const exp = player.adventurerExp;
        // ランクアップに必要な経験値（上がりにくくする）
        const rankThresholds = {
            'F': 0,
            'E': 100,
            'D': 300,
            'C': 600,
            'B': 1000,
            'A': 1500,
            'S': 2500
        };
        
        if (exp >= rankThresholds.S) return 'S';
        if (exp >= rankThresholds.A) return 'A';
        if (exp >= rankThresholds.B) return 'B';
        if (exp >= rankThresholds.C) return 'C';
        if (exp >= rankThresholds.D) return 'D';
        if (exp >= rankThresholds.E) return 'E';
        return 'F';
    }
    
    // ギルドに参加していない場合は、レベルに基づいてランクを決定
    const level = player.level || 1;
    if (level >= 50) return 'S';
    if (level >= 40) return 'A';
    if (level >= 30) return 'B';
    if (level >= 20) return 'C';
    if (level >= 10) return 'D';
    return 'F';
}

/**
 * 冒険者経験値を追加する。
 */
function addAdventurerExp(player, amount) {
    if (!player.guild) return; // ギルドに参加していない場合は経験値を追加しない
    
    player.adventurerExp = (player.adventurerExp || 0) + amount;
    
    // ランクアップチェック
    const oldRank = getAdventurerRank(player);
    localStorage.setItem("player", JSON.stringify(player));
    const newRank = getAdventurerRank(player);
    
    if (oldRank !== newRank) {
        alert(`冒険者ランクが上がりました！ ${oldRank} → ${newRank}`);
    }
}

/**
 * ランク文字列を数値に変換する。
 */
function getRankValue(rank) {
    const rankValues = { 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'B': 5, 'A': 6, 'S': 7 };
    return rankValues[rank] || 0;
}

/**
 * 受注中のクエストをレンダリングする。
 */
function renderActiveQuests() {
    const activeQuestsContainer = document.getElementById('active-quests');
    if (!activeQuestsContainer) return;

    const player = getPlayerData();
    if (!player) {
        activeQuestsContainer.innerHTML = '<p>キャラクターを作成してください。</p>';
        return;
    }

    const activeQuests = (getGuildQuests().quests || []).filter(q => q.assignedTo === player.id && q.status === 'active');
    activeQuestsContainer.innerHTML = '';

    if (activeQuests.length === 0) {
        activeQuestsContainer.innerHTML = '<p>現在、受注中のクエストはありません。</p>';
        return;
    }

    activeQuests.forEach(quest => {
        const questCard = document.createElement('div');
        questCard.className = 'quest-card active-quest';
        questCard.innerHTML = `
            <h3>${quest.title}</h3>
            <p>${quest.description || ''}</p>
            <p>進捗: ${quest.progress || 0} / ${quest.target.count || quest.target.seconds || 1}</p>
            <!-- 進捗バーなどをここに追加可能 -->
        `;
        activeQuestsContainer.appendChild(questCard);
    });
}

/**
 * ウィークリークエストを生成する関数
 * @returns {Array}
 */
function generateWeeklyQuests() {
    const questPool = [
        { id: 'collect_goblin_fang_10', type: 'collect_material', title: 'ゴブリンの牙収集', description: 'ゴブリンから牙を10本集める。', target: { materialId: 'goblin_fang', count: 10 }, reward: 100, category: 'DELIVERY', rank: 'E' },
        { id: 'collect_slime_jelly_10', type: 'collect_material', title: 'スライムゼリー収集', description: 'スライムからゼリーを10個集める。', target: { materialId: 'slime_jelly', count: 10 }, reward: 100, category: 'DELIVERY', rank: 'E' },
        { id: 'defeat_goblin_king_easy_3', type: 'defeat_boss', title: 'ゴブリンキング討伐(Easy) x3', description: 'ゴブリンキング(EASY)を3体討伐する。', target: { bossId: 'goblin_king', difficulty: 'easy', count: 3 }, reward: 150, category: 'BATTLE', rank: 'D' },
        { id: 'win_online_5', type: 'win_online', title: 'オンライン対戦5勝', description: 'オンライン対戦で5回勝利する。', target: { count: 5 }, reward: 200, category: 'BATTLE', rank: 'C' },
        { id: 'study_3_hours', type: 'study_time', title: '合計3時間勉強', description: '合計3時間勉強して学力を高める。', target: { seconds: 10800 }, reward: 180, category: 'SPECIAL', rank: 'D' },
    ];

    const shuffled = questPool.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10).map(q => ({
        ...q,
        id: `${q.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // ユニークID
        status: 'available', assignedTo: null, progress: 0,
    }));
}

/**
 * ギルドシステムを初期化する。
 */
function initializeGuildSystem() {
    console.log("Initializing guild system.");
    
    // ギルドデータをサーバーから再取得して同期
    if (window.socket) {
        const player = getPlayerData();
        if (player) {
            window.socket.emit('guild:getPlayerGuild', player.id);
            window.socket.on('guild:playerGuild', (guild) => {
                // サーバーからギルド情報が返ってきた場合のみ更新
                // nullの場合はローカルのギルド情報を維持
                if (guild) {
                    setPlayerGuild(guild);
                }
            });
        }
        // サーバーからギルドリストを取得
        window.socket.emit('guild:getList'); // サーバーからギルドリストを取得
    }
    
    renderGuildUI();

    // クエストのリセット処理
    const currentWeekId = getWeekId();
    const savedQuestsData = getGuildQuests();
    if (!savedQuestsData.weekId || savedQuestsData.weekId !== currentWeekId) {
        console.log(`New week detected. Generating new quests for week ${currentWeekId}.`);
        const newQuests = generateWeeklyQuests();
        saveGuildQuests({ weekId: currentWeekId, quests: newQuests });
    }

    // イベントリスナー設定
    document.getElementById('createGuildBtn')?.addEventListener('click', () => {
        document.getElementById('createGuildModal').style.display = 'flex';
    });
    document.getElementById('cancelCreateGuildBtn')?.addEventListener('click', () => {
        document.getElementById('createGuildModal').style.display = 'none';
    });
    document.getElementById('confirmCreateGuildBtn')?.addEventListener('click', () => {
        const guildName = document.getElementById('guildName').value.trim();
        const guildDescription = document.getElementById('guildDescription').value.trim();
        const player = getPlayerData();
        if (!player) {
            alert('キャラクターを作成してください。');
            return;
        }
        if (!guildName || !guildDescription) {
            alert('ギルド名と説明を入力してください。');
            return;
        }
        if (!window.socket || !window.socket.connected) {
            alert('サーバーに接続されていません。ページを再読み込みしてください。');
            return;
        }
        // サーバーにギルドを作成してもらう（他プレイヤーのギルド一覧にも反映されるように）
        window.socket.emit('guild:create', {
            name: guildName,
            description: guildDescription,
            playerId: player.id,
            playerName: player.name
        });
    });
    document.getElementById('leaveGuildBtn')?.addEventListener('click', () => {
        const playerGuild = getPlayerGuild();
        const player = getPlayerData();
        if (!playerGuild || !player) return;
        if (confirm('本当にギルドを脱退しますか？')) {
            if (window.socket && window.socket.connected) {
                window.socket.emit('guild:leave', { guildId: playerGuild.id, playerId: player.id });
            } else {
                // サーバーに接続できない場合でも、ローカルの所属状態は解除しておく
                setPlayerGuild(null);
                alert('ギルドから脱退しました。');
            }
        }
    });

    document.querySelectorAll('.quest-filter-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.quest-filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderQuestBoard(e.target.dataset.filter);
        });
    });

    // ギルド一覧表示
    document.getElementById('showGuildListBtn')?.addEventListener('click', () => {
        document.getElementById('guildListModal').style.display = 'flex';
        // 開くたびに最新の一覧をサーバーから取得する
        // （以前はページ読み込み時に一度取得したきりだったため、
        //   その後に作成/参加したギルドが一覧に反映されないままだった）
        if (window.socket && window.socket.connected) {
            document.getElementById('guild-list-container').innerHTML = '<p>読み込み中...</p>';
            window.socket.emit('guild:getList');
        }
    });
    document.getElementById('closeGuildListBtn')?.addEventListener('click', () => {
        document.getElementById('guildListModal').style.display = 'none';
    });

    // ギルド検索
    document.getElementById('guildSearchInput')?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const guildItems = document.querySelectorAll('#guild-list-container .guild-list-item');
        guildItems.forEach(item => {
            const guildName = item.querySelector('h4').textContent.toLowerCase();
            if (guildName.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    if (window.socket) {
        window.socket.on('guild:questUpdate', (quests) => {
            // This event is now managed client-side, but can be used for server-sync in the future
            renderQuestBoard();
            renderActiveQuests();
        });

        window.socket.on('guild:joinResponse', (result) => {
            if (result.success) {
                setPlayerGuild(result.guild);
                alert('ギルドに参加しました！');
                document.getElementById('guildListModal').style.display = 'none';
            } else {
                alert(result.message || 'ギルド参加に失敗しました');
            }
        });

        // ギルド作成のサーバー応答
        window.socket.on('guild:createResponse', (result) => {
            if (result.success) {
                const newGuild = result.guild;

                // 新しいギルドにウィークリークエストを配布
                const currentWeekId = getWeekId();
                const quests = generateWeeklyQuests();
                saveGuildQuests({ weekId: currentWeekId, quests: quests });

                setPlayerGuild(newGuild);
                document.getElementById('createGuildModal').style.display = 'none';
                document.getElementById('guildName').value = '';
                document.getElementById('guildDescription').value = '';
                alert(`ギルド「${newGuild.name}」を作成しました！`);
                window.socket.emit('guild:getList'); // 一覧を最新化
            } else {
                alert(result.message || 'ギルド作成に失敗しました');
            }
        });

        // ギルド脱退のサーバー応答
        window.socket.on('guild:leaveResponse', (result) => {
            if (result.success) {
                setPlayerGuild(null);
                alert('ギルドから脱退しました。');
                window.socket.emit('guild:getList'); // 一覧を最新化
            } else {
                alert(result.message || 'ギルド脱退に失敗しました');
            }
        });

        window.socket.on('guild:list', (guilds) => {
            const container = document.getElementById('guild-list-container');
            if (!container) return;
            container.innerHTML = '';
            if (!guilds || guilds.length === 0) {
                container.innerHTML = '<p>現在、ギルドはありません。</p>';
                return;
            }
            
            const searchInput = document.getElementById('guildSearchInput');
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            
            guilds.forEach(guild => {
                const item = document.createElement('div');
                item.className = 'guild-list-item';
                if (searchTerm && !guild.name.toLowerCase().includes(searchTerm)) {
                    item.style.display = 'none';
                }
                item.innerHTML = `
                    <h4>${guild.name}</h4>
                    <p>${guild.description}</p>
                    <p>メンバー: ${guild.memberCount}人</p>
                    <button class="btn btn-small join-guild-btn" data-guild-id="${guild.id}">参加</button>
                `;
                container.appendChild(item);
            });

            container.querySelectorAll('.join-guild-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const guildId = e.target.dataset.guildId;
                    const player = getPlayerData();
                    if (player && window.socket) {
                        window.socket.emit('guild:join', { guildId, playerId: player.id, playerName: player.name });
                    }
                });
            });
        });
    }
}