// ============================================
// School Battle
// guild.js
// ============================================

class GuildSystem {
    constructor() {
        this.currentGuild = null;
        this.availableQuests = [];
        this.activeQuests = [];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadGuildData();
    }

    setupEventListeners() {
        // ギルド作成ボタン
        document.getElementById('createGuildBtn')?.addEventListener('click', () => {
            this.showCreateGuildModal();
        });

        // ギルド一覧ボタン
        document.getElementById('showGuildListBtn')?.addEventListener('click', () => {
            this.showGuildList();
        });

        // ギルド作成モーダル
        document.getElementById('confirmCreateGuildBtn')?.addEventListener('click', () => {
            this.createGuild();
        });

        document.getElementById('cancelCreateGuildBtn')?.addEventListener('click', () => {
            this.hideCreateGuildModal();
        });

        // ギルド一覧モーダル
        document.getElementById('closeGuildListBtn')?.addEventListener('click', () => {
            this.hideGuildListModal();
        });

        // ギルド脱退
        document.getElementById('leaveGuildBtn')?.addEventListener('click', () => {
            this.leaveGuild();
        });

        // クエストフィルター
        document.querySelectorAll('.quest-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setQuestFilter(e.target.dataset.filter);
            });
        });

        // クエスト作成
        document.getElementById('createQuestBtn')?.addEventListener('click', () => {
            this.createQuest();
        });

        // Socketイベントリスナー
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        if (!window.socket) return;

        // ギルド作成レスポンス
        window.socket.on('guild:createResponse', (response) => {
            if (response.success) {
                this.currentGuild = response.guild;
                this.hideCreateGuildModal();
                this.updateGuildUI();
                this.showNotification('ギルドを作成しました！', 'success');
            } else {
                this.showNotification(response.message, 'error');
            }
        });

        // ギルド参加レスポンス
        window.socket.on('guild:joinResponse', (response) => {
            if (response.success) {
                this.currentGuild = response.guild;
                this.hideGuildListModal();
                this.updateGuildUI();
                this.showNotification('ギルドに参加しました！', 'success');
            } else {
                this.showNotification(response.message, 'error');
            }
        });

        // ギルド脱退レスポンス
        window.socket.on('guild:leaveResponse', (response) => {
            if (response.success) {
                this.currentGuild = null;
                this.updateGuildUI();
                this.showNotification('ギルドを脱退しました', 'success');
            } else {
                this.showNotification(response.message, 'error');
            }
        });

        // ギルド情報
        window.socket.on('guild:info', (guild) => {
            if (guild) {
                this.currentGuild = guild;
                this.updateGuildUI();
            }
        });

        // プレイヤーのギルド
        window.socket.on('guild:playerGuild', (guild) => {
            this.currentGuild = guild;
            this.updateGuildUI();
        });

        // 全ギルド
        window.socket.on('guild:allGuilds', (guilds) => {
            this.renderGuildList(guilds);
        });

        // クエスト作成レスポンス
        window.socket.on('quest:createResponse', (response) => {
            if (response.success) {
                this.loadAvailableQuests();
                this.showNotification('クエストを作成しました！', 'success');
                // フォームをクリア
                document.getElementById('questTitle').value = '';
                document.getElementById('questDescription').value = '';
                document.getElementById('questReward').value = '';
            } else {
                this.showNotification(response.message, 'error');
            }
        });

        // クエスト受注レスポンス
        window.socket.on('quest:acceptResponse', (response) => {
            if (response.success) {
                this.loadAvailableQuests();
                this.loadActiveQuests();
                this.showNotification('クエストを受注しました！', 'success');
            } else {
                this.showNotification(response.message, 'error');
            }
        });

        // クエスト報告レスポンス
        window.socket.on('quest:reportResponse', (response) => {
            if (response.success) {
                this.loadActiveQuests();
                this.showNotification('クエストを報告しました', 'success');
            } else {
                this.showNotification(response.message, 'error');
            }
        });

        // クエスト報酬支払いレスポンス
        window.socket.on('quest:payRewardResponse', (response) => {
            if (response.success) {
                this.loadActiveQuests();
                this.showNotification('報酬を受け取りました！', 'success');
                if (response.rankUp) {
                    this.showNotification(`ギルドランクが${response.newRank}ランクにアップ！`, 'success');
                }
            } else {
                this.showNotification(response.message, 'error');
            }
        });

        // 利用可能なクエスト
        window.socket.on('quest:available', (quests) => {
            this.availableQuests = quests;
            this.renderQuestBoard();
        });

        // プレイヤーのアクティブクエスト
        window.socket.on('quest:playerActive', (quests) => {
            this.activeQuests = quests;
            this.renderActiveQuests();
        });
    }

    loadGuildData() {
        const player = this.getPlayerData();
        if (player && player.id && window.socket) {
            window.socket.emit('guild:getPlayerGuild', player.id);
            this.loadAvailableQuests();
            this.loadActiveQuests();
        }
    }

    getPlayerData() {
        // プレイヤーデータを取得（既存の関数を使用）
        if (typeof getPlayerData === 'function') {
            return getPlayerData();
        }
        return null;
    }

    showCreateGuildModal() {
        document.getElementById('createGuildModal').style.display = 'block';
    }

    hideCreateGuildModal() {
        document.getElementById('createGuildModal').style.display = 'none';
    }

    showGuildList() {
        if (window.socket) {
            window.socket.emit('guild:getAll');
        }
        document.getElementById('guildListModal').style.display = 'block';
    }

    hideGuildListModal() {
        document.getElementById('guildListModal').style.display = 'none';
    }

    createGuild() {
        const name = document.getElementById('guildName').value.trim();
        const description = document.getElementById('guildDescription').value.trim();
        const player = this.getPlayerData();

        if (!name) {
            this.showNotification('ギルド名を入力してください', 'error');
            return;
        }

        if (!player || !player.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('guild:create', {
                name,
                description,
                playerId: player.id,
                playerName: player.name
            });
        }
    }

    joinGuild(guildId) {
        const player = this.getPlayerData();
        if (!player || !player.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('guild:join', {
                guildId,
                playerId: player.id,
                playerName: player.name
            });
        }
    }

    leaveGuild() {
        if (!this.currentGuild) return;

        if (!confirm('本当にギルドを脱退しますか？')) return;

        const player = this.getPlayerData();
        if (!player || !player.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('guild:leave', {
                guildId: this.currentGuild.id,
                playerId: player.id
            });
        }
    }

    updateGuildUI() {
        const guildInfo = document.getElementById('guild-info');
        const noGuild = document.getElementById('no-guild');
        const questCreation = document.getElementById('quest-creation');

        if (this.currentGuild) {
            guildInfo.style.display = 'block';
            noGuild.style.display = 'none';
            questCreation.style.display = 'block';
            this.renderMyGuild();
        } else {
            guildInfo.style.display = 'none';
            noGuild.style.display = 'block';
            questCreation.style.display = 'none';
        }
    }

    renderMyGuild() {
        const container = document.getElementById('my-guild-details');
        if (!this.currentGuild) return;

        const rankClass = `rank-${this.currentGuild.rank}`;
        
        container.innerHTML = `
            <div class="guild-detail-item">
                <strong>ギルド名:</strong> ${this.currentGuild.name}
            </div>
            <div class="guild-detail-item">
                <strong>ランク:</strong> <span class="guild-rank-badge ${rankClass}">${this.currentGuild.rank}ランク</span>
            </div>
            <div class="guild-detail-item">
                <strong>リーダー:</strong> ${this.currentGuild.leaderName}
            </div>
            <div class="guild-detail-item">
                <strong>メンバー数:</strong> ${this.currentGuild.members.length}人
            </div>
            <div class="guild-detail-item">
                <strong>貢献度:</strong> ${this.currentGuild.contribution}
            </div>
            ${this.currentGuild.description ? `
            <div class="guild-detail-item">
                <strong>説明:</strong> ${this.currentGuild.description}
            </div>
            ` : ''}
        `;
    }

    renderGuildList(guilds) {
        const container = document.getElementById('guild-list-container');
        if (!guilds || guilds.length === 0) {
            container.innerHTML = '<p>ギルドがありません</p>';
            return;
        }

        container.innerHTML = guilds.map(guild => {
            const rankClass = `rank-${guild.rank}`;
            return `
                <div class="guild-list-item" onclick="guildSystem.joinGuild('${guild.id}')">
                    <h4>${guild.name} <span class="guild-rank-badge ${rankClass}">${guild.rank}ランク</span></h4>
                    <p>リーダー: ${guild.leaderName}</p>
                    <p>メンバー数: ${guild.members.length}人</p>
                    ${guild.description ? `<p>${guild.description}</p>` : ''}
                </div>
            `;
        }).join('');
    }

    loadAvailableQuests() {
        if (window.socket) {
            const guildId = this.currentGuild ? this.currentGuild.id : null;
            window.socket.emit('quest:getAvailable', guildId);
        }
    }

    loadActiveQuests() {
        const player = this.getPlayerData();
        if (player && player.id && window.socket) {
            window.socket.emit('quest:getPlayerActive', player.id);
        }
    }

    setQuestFilter(filter) {
        this.currentFilter = filter;
        
        // ボタンのアクティブ状態を更新
        document.querySelectorAll('.quest-filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            }
        });

        this.renderQuestBoard();
    }

    renderQuestBoard() {
        const container = document.getElementById('quest-board');
        if (!container) return;

        let filteredQuests = this.availableQuests;
        
        if (this.currentFilter !== 'all') {
            filteredQuests = this.availableQuests.filter(q => q.category === this.currentFilter);
        }

        if (filteredQuests.length === 0) {
            container.innerHTML = '<p style="color: #FFE4B5; text-align: center; grid-column: 1/-1;">クエストがありません</p>';
            return;
        }

        const categoryIcons = {
            BATTLE: '⚔️',
            DELIVERY: '📦',
            ESCORT: '🛡️',
            SPECIAL: '🔍'
        };

        container.innerHTML = filteredQuests.map(quest => {
            const statusClass = quest.status === 'accepted' ? 'accepted' : 
                               quest.status === 'completed' ? 'completed' : '';
            const icon = categoryIcons[quest.category] || '📋';
            
            return `
                <div class="quest-card ${statusClass}" data-quest-id="${quest.id}">
                    <div class="quest-card-header">
                        <div class="quest-card-title">${quest.title}</div>
                        <div class="quest-card-rank">${quest.rank}ランク</div>
                    </div>
                    <div class="quest-card-description">${quest.description}</div>
                    <div class="quest-card-footer">
                        <div class="quest-card-category">${icon} ${quest.category}</div>
                        <div class="quest-card-reward">報酬: ${quest.reward}</div>
                    </div>
                </div>
            `;
        }).join('');

        // クエストカードのクリックイベント
        container.querySelectorAll('.quest-card').forEach(card => {
            card.addEventListener('click', () => {
                const questId = card.dataset.questId;
                this.handleQuestCardClick(questId);
            });
        });
    }

    handleQuestCardClick(questId) {
        const quest = this.availableQuests.find(q => q.id === questId);
        if (!quest) return;

        if (quest.status === 'available') {
            this.acceptQuest(questId);
        } else if (quest.status === 'accepted') {
            this.showQuestDetails(quest);
        }
    }

    acceptQuest(questId) {
        const player = this.getPlayerData();
        if (!player || !player.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('quest:accept', {
                questId,
                playerId: player.id,
                playerName: player.name
            });
        }
    }

    showQuestDetails(quest) {
        // クエスト詳細を表示（モーダルまたはアラート）
        const message = `
クエスト: ${quest.title}
詳細: ${quest.description}
カテゴリ: ${quest.category}
ランク: ${quest.rank}
報酬: ${quest.reward}

このクエストを報告しますか？
        `;
        
        if (confirm(message)) {
            this.reportQuest(quest.id);
        }
    }

    reportQuest(questId) {
        const player = this.getPlayerData();
        if (!player || !player.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('quest:report', {
                questId,
                playerId: player.id,
                evidence: 'manual_report'
            });
        }
    }

    renderActiveQuests() {
        const container = document.getElementById('active-quests');
        if (!container) return;

        if (this.activeQuests.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">受注中のクエストはありません</p>';
            return;
        }

        container.innerHTML = this.activeQuests.map(quest => `
            <div class="active-quest-item">
                <div class="active-quest-info">
                    <div class="active-quest-title">${quest.title}</div>
                    <div class="active-quest-progress">${quest.description}</div>
                </div>
                <div class="active-quest-actions">
                    <button class="btn btn-primary" onclick="guildSystem.reportQuest('${quest.id}')">報告</button>
                </div>
            </div>
        `).join('');
    }

    createQuest() {
        const title = document.getElementById('questTitle').value.trim();
        const description = document.getElementById('questDescription').value.trim();
        const category = document.getElementById('questCategory').value;
        const rank = document.getElementById('questRank').value;
        const reward = parseInt(document.getElementById('questReward').value);

        if (!title || !description || !reward) {
            this.showNotification('すべての項目を入力してください', 'error');
            return;
        }

        const player = this.getPlayerData();
        if (!player || !player.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('quest:create', {
                guildId: this.currentGuild ? this.currentGuild.id : null,
                title,
                description,
                category,
                rank,
                reward,
                playerId: player.id,
                playerName: player.name,
                type: 'user'
            });
        }
    }

    showNotification(message, type = 'info') {
        // 既存の通知システムを使用
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
            alert(message);
        }
    }
}

// グローバルインスタンスを作成
let guildSystem;
document.addEventListener('DOMContentLoaded', () => {
    guildSystem = new GuildSystem();
});