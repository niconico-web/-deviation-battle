// client/js/guild.js

const GUILD_STORAGE_KEY = 'playerGuild';
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
 * クエストのプール (AIが生成するクエストのテンプレートとして機能)
 */
const QUEST_POOL = [
    { id: 'collect_goblin_fang_5', type: 'collect_material', title: 'ゴブリンの牙を5本集めよう', description: 'ゴブリンキングからゴブリンの牙を5本集めて納品しよう。', target: { materialId: 'goblin_fang', count: 5 }, reward: 50, category: 'DELIVERY', rank: 'E' },
    { id: 'defeat_slime_queen_1', type: 'defeat_boss', title: 'スライムクイーン討伐', description: 'スライムクイーン(NORMAL)を1体討伐しよう。', target: { bossId: 'slime_queen', difficulty: 'medium', count: 1 }, reward: 80, category: 'BATTLE', rank: 'D' },
    { id: 'study_1_hour', type: 'study_time', title: '合計1時間勉強', description: '合計1時間勉強して学力を高めよう。', target: { seconds: 3600 }, reward: 60, category: 'SPECIAL', rank: 'F' },
    { id: 'win_online_3', type: 'win_online', title: 'オンライン対戦3勝', description: 'オンライン対戦で3回勝利しよう。', target: { count: 3 }, reward: 70, category: 'BATTLE', rank: 'C' },
];

/**
 * クライアントサイドでクエストリストを管理する (仮)
 * 実際にはサーバーから取得・更新されるべきです。
 */
function getGuildQuests() {
    const quests = localStorage.getItem(GUILD_QUEST_STORAGE_KEY);
    return quests ? JSON.parse(quests) : [];
}

function saveGuildQuests(quests) {
    localStorage.setItem(GUILD_QUEST_STORAGE_KEY, JSON.stringify(quests));
}

/**
 * 新しいクエストを作成する (クライアントサイド仮実装)
 * @param {object} questData - クエストのタイトル、説明、カテゴリ、ランク、報酬など
 */
function createNewQuest(questData) {
    let quests = getGuildQuests();
    const newQuest = {
        id: `quest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        ...questData,
        status: 'available', // available, active, completed
        assignedTo: null,
        progress: 0,
        createdAt: Date.now()
    };
    quests.push(newQuest);
    saveGuildQuests(quests);
    renderQuestBoard();
    alert('クエストが作成されました！');
}

/**
 * クエストを受注する (クライアントサイド仮実装)
 * @param {string} questId - 受注するクエストのID
 */
function acceptQuest(questId) {
    let quests = getGuildQuests();
    let player = getPlayerData();
    if (!player) return;

    const questIndex = quests.findIndex(q => q.id === questId);
    if (questIndex > -1 && quests[questIndex].status === 'available') {
        quests[questIndex].status = 'active';
        quests[questIndex].assignedTo = player.id;
        saveGuildQuests(quests);
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
    let quests = getGuildQuests();
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
                if (quest.progress >= quest.target.count) {
                    quest.status = 'completed';
                    alert(`クエスト「${quest.title}」を達成しました！`);
                    // ここで報酬を付与する処理を追加
                }
            }
        }
    });

    if (questUpdated) {
        saveGuildQuests(quests);
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
    const questCreationSection = document.getElementById('quest-creation');

    if (playerGuild) {
        // ギルド参加中
        if (guildInfoSection) guildInfoSection.style.display = 'block';
        if (noGuildSection) noGuildSection.style.display = 'none';
        if (questCreationSection) questCreationSection.style.display = 'block'; // ギルドメンバーはクエスト作成可能

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
        if (questCreationSection) questCreationSection.style.display = 'none';
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

    const quests = getGuildQuests().filter(q => q.status === 'available');
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
            <h3>${quest.title} (${quest.rank}ランク)</h3>
            <p>${quest.description}</p>
            <p>報酬: ${quest.reward}貢献度</p>
            <button class="btn btn-primary accept-quest-btn" data-quest-id="${quest.id}">受注する</button>
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

    const activeQuests = getGuildQuests().filter(q => q.assignedTo === player.id && q.status === 'active');
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
            <p>${quest.description}</p>
            <p>進捗: ${quest.progress || 0} / ${quest.target.count}</p>
            <!-- 進捗バーなどをここに追加可能 -->
        `;
        activeQuestsContainer.appendChild(questCard);
    });
}

/**
 * ギルドシステムを初期化する。
 */
function initializeGuildSystem() {
    console.log("Initializing guild system.");
    renderGuildUI();

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
            setPlayerGuild({ id: `guild_${Date.now()}`, name: guildName, description: guildDescription, members: [getPlayerData().id], contribution: 0 });
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
    document.getElementById('createQuestBtn')?.addEventListener('click', () => {
        const questTitle = document.getElementById('questTitle').value.trim();
        const questDescription = document.getElementById('questDescription').value.trim();
        const questCategory = document.getElementById('questCategory').value;
        const questRank = document.getElementById('questRank').value;
        const questReward = parseInt(document.getElementById('questReward').value);

        if (questTitle && questDescription && questReward > 0) {
            // 仮のターゲット設定 (AI連携がないため、今回は固定値)
            const target = { materialId: 'goblin_fang', count: 3 }; // 例: ゴブリンの牙3本
            createNewQuest({ title: questTitle, description: questDescription, category: questCategory, rank: questRank, reward: questReward, type: 'collect_material', target: target });
        } else {
            alert('クエストの情報をすべて入力してください。');
        }
    });

    document.querySelectorAll('.quest-filter-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.quest-filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderQuestBoard(e.target.dataset.filter);
        });
    });
}