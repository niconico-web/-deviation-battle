// client/js/guild.js

const GUILD_QUEST_STORAGE_KEY = 'guildQuests';

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
                    quest.progress = targetCount; // 上限を超えないように
                    alert(`クエスト「${quest.title}」を達成しました！`);
                    // ギルド貢献度を付与
                    const playerGuild = getPlayerGuild();
                    if (playerGuild) {
                        playerGuild.contribution = (playerGuild.contribution || 0) + (quest.reward || 0);
                        setPlayerGuild(playerGuild);
                    }
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

    const questsData = getGuildQuests();
    const quests = (questsData.quests || []).filter(q => q.status === 'available' || q.status === 'completed');
    questBoard.innerHTML = '';

    const filteredQuests = filterCategory === 'all'
        ? quests
        : quests.filter(q => q.category === filterCategory);

    if (filteredQuests.length === 0) {
        questBoard.innerHTML = '<p>現在、利用可能なクエストはありません。</p>';
        return;
    }

    filteredQuests.forEach(quest => {
        const questCard = document.createElement('div');
        questCard.className = 'quest-card';
        questCard.innerHTML = `
            <h3>${quest.title} (${quest.rank || 'N/A'}ランク)</h3>
            <p>${quest.description}</p>
            <p>報酬: ${quest.reward || 0}貢献度</p>
            ${quest.status === 'completed' 
                ? '<button class="btn btn-disabled" disabled>完了</button>'
                : `<button class="btn btn-primary accept-quest-btn" data-quest-id="${quest.id}">受注する</button>`
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
    renderGuildUI();
    if (window.socket) {
        // サーバーからギルドリストを取得
        window.socket.emit('guild:getList'); // サーバーからギルドリストを取得
    }

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
        if (guildName && guildDescription) {
            const newGuild = { id: `guild_${Date.now()}`, name: guildName, description: guildDescription, members: [getPlayerData().id], contribution: 0 };
            
            // 新しいギルドにウィークリークエストを配布
            const currentWeekId = getWeekId();
            const quests = generateWeeklyQuests();
            saveGuildQuests({ weekId: currentWeekId, quests: quests });

            setPlayerGuild(newGuild);
            document.getElementById('createGuildModal').style.display = 'none';
            alert(`ギルド「${guildName}」を作成しました！`);
        } else {
            alert('ギルド名と説明を入力してください。');
        }
    });
    document.getElementById('leaveGuildBtn')?.addEventListener('click', () => {
        if (confirm('本当にギルドを脱退しますか？')) {
            setPlayerGuild(null);
            alert('ギルドから脱退しました。');
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

        window.socket.on('guild:list', (guilds) => {
            const container = document.getElementById('guild-list-container');
            if (!container) return;
            container.innerHTML = '';
            if (!guilds || guilds.length === 0) {
                container.innerHTML = '<p>現在、ギルドはありません。</p>';
                return;
            }
            guilds.forEach(guild => {
                const item = document.createElement('div');
                item.className = 'guild-list-item';
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
                    // ここで参加処理を実装（サーバーにイベントをemit）
                    console.log(`Joining guild ${guildId}`);
                });
            });
        });
    }
}