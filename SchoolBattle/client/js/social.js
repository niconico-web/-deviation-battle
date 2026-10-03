// ============================================
// School Battle
// social.js
// ============================================

class SocialSystem {
    constructor() {
        this.friends = [];
        this.friendRequests = [];
        this.searchedPlayer = null;
        this.init();
    }

    init() {
        console.log('SocialSystem initializing...');
        this.setupEventListeners();
        this.loadSocialData();
        console.log('SocialSystem initialized');
    }

    setupEventListeners() {
        // プレイヤー検索
        document.getElementById('searchPlayerBtn')?.addEventListener('click', () => {
            this.searchPlayer();
        });

        // フレンド申請
        document.getElementById('friendRequestBtn')?.addEventListener('click', () => {
            this.sendFriendRequest();
        });

        // ギルド招待
        document.getElementById('guildInviteBtn')?.addEventListener('click', () => {
            this.sendGuildInvitation();
        });

        // 対戦申請
        document.getElementById('challengePlayerBtn')?.addEventListener('click', () => {
            this.challengePlayer();
        });

        // Socketイベントリスナー
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        if (!window.socket) return;

        // プレイヤー検索結果
        window.socket.on('social:playerFound', (player) => {
            this.searchedPlayer = player;
            this.renderSearchResult(player);
        });

        // フレンド申請送信結果
        window.socket.on('social:friendRequestSent', (response) => {
            if (response.success) {
                this.showNotification('フレンド申請を送信しました', 'success');
            } else {
                this.showNotification(response.message, 'error');
            }
        });

        // フレンド申請受信
        window.socket.on('social:friendRequestReceived', (request) => {
            this.friendRequests.push(request);
            this.renderFriendRequests();
            this.showNotification(`${request.fromName}からフレンド申請が来ました`, 'info');
        });

        // フレンド申請結果
        window.socket.on('social:friendRequestResult', (result) => {
            if (result.accepted) {
                this.friends.push(result.friend);
                this.renderFriendList();
                this.showNotification('フレンドになりました！', 'success');
            } else {
                this.showNotification('フレンド申請が拒否されました', 'info');
            }
        });

        // ギルド招待結果
        window.socket.on('social:guildInviteResult', (response) => {
            if (response.success) {
                this.showNotification('ギルド招待を送信しました', 'success');
            } else {
                this.showNotification(response.message, 'error');
            }
        });

        // フレンドリスト受信
        window.socket.on('social:friendList', (friends) => {
            this.friends = friends;
            this.renderFriendList();
        });

        // フレンド申請リスト受信
        window.socket.on('social:friendRequests', (requests) => {
            this.friendRequests = requests;
            this.renderFriendRequests();
        });
    }

    loadSocialData() {
        const player = this.getPlayerData();
        if (player && player.id && window.socket) {
            window.socket.emit('social:getFriendList', player.id);
            window.socket.emit('social:getFriendRequests', player.id);
        }
    }

    getPlayerData() {
        if (typeof getPlayerData === 'function') {
            return getPlayerData();
        }
        return null;
    }

    searchPlayer() {
        const playerId = document.getElementById('playerIdSearch').value.trim();
        if (!playerId) {
            this.showNotification('プレイヤーIDを入力してください', 'error');
            return;
        }

        if (playerId.length !== 6) {
            this.showNotification('プレイヤーIDは6文字です', 'error');
            return;
        }

        const currentPlayer = this.getPlayerData();
        if (!currentPlayer || !currentPlayer.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (playerId === currentPlayer.id) {
            this.showNotification('自分を検索することはできません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('social:searchPlayer', { 
                targetId: playerId, 
                requesterId: currentPlayer.id 
            });
        }
    }

    renderSearchResult(player) {
        const resultDiv = document.getElementById('playerSearchResult');
        const infoDiv = document.getElementById('searchedPlayerInfo');
        
        if (!player) {
            resultDiv.style.display = 'none';
            this.showNotification('プレイヤーが見つかりません', 'error');
            return;
        }

        resultDiv.style.display = 'block';
        infoDiv.innerHTML = `
            <div class="player-info">
                <p><strong>名前:</strong> ${player.name}</p>
                <p><strong>ID:</strong> ${player.id}</p>
                <p><strong>レベル:</strong> ${player.level || 1}</p>
                <p><strong>学年:</strong> ${player.grade || 1}</p>
            </div>
        `;

        // ボタンの表示状態を更新
        const isAlreadyFriend = this.friends.some(f => f.id === player.id);
        document.getElementById('friendRequestBtn').disabled = isAlreadyFriend;
        document.getElementById('friendRequestBtn').textContent = isAlreadyFriend ? '既にフレンド' : 'フレンド申請';
    }

    sendFriendRequest() {
        if (!this.searchedPlayer) return;

        const currentPlayer = this.getPlayerData();
        if (!currentPlayer || !currentPlayer.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('social:sendFriendRequest', {
                fromId: currentPlayer.id,
                fromName: currentPlayer.name,
                toId: this.searchedPlayer.id
            });
        }
    }

    sendGuildInvitation() {
        if (!this.searchedPlayer) return;

        const currentPlayer = this.getPlayerData();
        if (!currentPlayer || !currentPlayer.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        // ギルドに所属しているか確認
        if (!currentPlayer.guildId) {
            this.showNotification('まずはギルドに参加してください', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('social:sendGuildInvite', {
                fromId: currentPlayer.id,
                fromName: currentPlayer.name,
                toId: this.searchedPlayer.id,
                guildId: currentPlayer.guildId,
                guildName: currentPlayer.guildName
            });
        }
    }

    challengePlayer() {
        if (!this.searchedPlayer) return;

        // セーフマッチの選択ダイアログ
        const useSafeMode = confirm('セーフモードで対戦しますか？\nセーフモードでは武器が奪われません。');
        
        // ルームを作成して対戦
        const currentPlayer = this.getPlayerData();
        if (!currentPlayer) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        // 対戦相手の情報を設定
        localStorage.setItem('challengeTargetId', this.searchedPlayer.id);
        localStorage.setItem('safeMode', useSafeMode.toString());

        // 対戦ルームを作成
        if (window.socket) {
            window.socket.emit('createRoom', currentPlayer);
        }
    }

    renderFriendList() {
        const container = document.getElementById('friendList');
        if (!container) return;

        if (this.friends.length === 0) {
            container.innerHTML = '<p>フレンドはまだいません</p>';
            return;
        }

        container.innerHTML = this.friends.map(friend => `
            <div class="friend-item">
                <div class="friend-info">
                    <strong>${friend.name}</strong> (Lv.${friend.level || 1})
                </div>
                <div class="friend-actions">
                    <button class="btn btn-secondary" onclick="socialSystem.challengeFriend('${friend.id}')">対戦</button>
                    <button class="btn btn-danger" onclick="socialSystem.removeFriend('${friend.id}')">削除</button>
                </div>
            </div>
        `).join('');
    }

    renderFriendRequests() {
        const container = document.getElementById('friendRequests');
        if (!container) return;

        if (this.friendRequests.length === 0) {
            container.innerHTML = '<p>フレンド申請はありません</p>';
            return;
        }

        container.innerHTML = this.friendRequests.map(request => `
            <div class="friend-request-item">
                <div class="request-info">
                    <strong>${request.fromName}</strong>からフレンド申請
                </div>
                <div class="request-actions">
                    <button class="btn btn-primary" onclick="socialSystem.respondToFriendRequest('${request.id}', true)">承認</button>
                    <button class="btn btn-danger" onclick="socialSystem.respondToFriendRequest('${request.id}', false)">拒否</button>
                </div>
            </div>
        `).join('');
    }

    respondToFriendRequest(requestId, accept) {
        const currentPlayer = this.getPlayerData();
        if (!currentPlayer || !currentPlayer.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('social:respondFriendRequest', {
                requestId,
                fromId: currentPlayer.id,
                accept
            });
        }

        // ローカルから申請を削除
        this.friendRequests = this.friendRequests.filter(r => r.id !== requestId);
        this.renderFriendRequests();
    }

    challengeFriend(friendId) {
        const friend = this.friends.find(f => f.id === friendId);
        if (!friend) return;

        const useSafeMode = confirm('セーフモードで対戦しますか？\nセーフモードでは武器が奪われません。');
        
        localStorage.setItem('challengeTargetId', friendId);
        localStorage.setItem('safeMode', useSafeMode.toString());

        const currentPlayer = this.getPlayerData();
        if (currentPlayer && window.socket) {
            window.socket.emit('createRoom', currentPlayer);
        }
    }

    removeFriend(friendId) {
        if (!confirm('本当にこのフレンドを削除しますか？')) return;

        const currentPlayer = this.getPlayerData();
        if (!currentPlayer || !currentPlayer.id) {
            this.showNotification('プレイヤーデータが見つかりません', 'error');
            return;
        }

        if (window.socket) {
            window.socket.emit('social:removeFriend', {
                playerId: currentPlayer.id,
                friendId
            });
        }

        // ローカルから削除
        this.friends = this.friends.filter(f => f.id !== friendId);
        this.renderFriendList();
    }

    showNotification(message, type = 'info') {
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
            alert(message);
        }
    }
}

// グローバルインスタンスを作成
let socialSystem;

function initSocialSystem() {
    console.log('initSocialSystem called');
    if (!socialSystem) {
        console.log('Creating new SocialSystem instance');
        socialSystem = new SocialSystem();
    } else {
        console.log('SocialSystem already exists');
    }
}

document.addEventListener('DOMContentLoaded', initSocialSystem);

// window.addEventListener('load', () => {
//     console.log('Window load fired, initializing social system');
//     setTimeout(initSocialSystem, 100);
// });
