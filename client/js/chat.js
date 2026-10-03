// ============================================
// チャットシステム
// ============================================

// チャットタイプ定義
const CHAT_TYPES = {
    global: { name: '全体', color: '#ffffff' },
    local: { name: '近距離', color: '#4CAF50' },
    party: { name: 'パーティー', color: '#2196F3' }
};

// チャットメッセージの履歴
const chatHistory = [];
const MAX_CHAT_HISTORY = 50;

// 現在のチャットタイプ
let currentChatType = 'global';

// チャットUIの初期化
function initChatUI() {
    // チャットコンテナを作成
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chatContainer';
    chatContainer.className = 'chat-container';
    
    chatContainer.innerHTML = `
        <div class="chat-header">
            <span class="chat-title">💬 チャット</span>
            <button class="chat-toggle-btn" id="chatToggleBtn">−</button>
        </div>
        <div class="chat-type-selector">
            <button class="chat-type-btn active" data-type="global">全体</button>
            <button class="chat-type-btn" data-type="local">近距離</button>
            <button class="chat-type-btn" data-type="party">パーティー</button>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-input-area">
            <input type="text" id="chatInput" placeholder="メッセージを入力..." maxlength="100">
            <button id="chatSendBtn" class="btn btn-primary">送信</button>
        </div>
    `;
    
    document.body.appendChild(chatContainer);
    
    // イベントリスナーを設定
    setupChatEventListeners();
    
    // チャット履歴を表示
    renderChatHistory();
}

// チャットイベントリスナーの設定
function setupChatEventListeners() {
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatTypeBtns = document.querySelectorAll('.chat-type-btn');
    
    // チャットの開閉
    chatToggleBtn.addEventListener('click', () => {
        const chatContainer = document.getElementById('chatContainer');
        const messagesDiv = document.getElementById('chatMessages');
        const inputArea = document.querySelector('.chat-input-area');
        
        if (messagesDiv.style.display === 'none') {
            messagesDiv.style.display = 'block';
            inputArea.style.display = 'flex';
            chatToggleBtn.textContent = '−';
        } else {
            messagesDiv.style.display = 'none';
            inputArea.style.display = 'none';
            chatToggleBtn.textContent = '+';
        }
    });
    
    // チャットタイプの切り替え
    chatTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chatTypeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentChatType = btn.dataset.type;
            renderChatHistory();
        });
    });
    
    // メッセージ送信
    chatSendBtn.addEventListener('click', sendChatMessage);
    
    // Enterキーで送信
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
}

// チャットメッセージの送信
function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    const player = getPlayerData();
    if (!player) {
        alert('キャラクターを作成してください');
        return;
    }
    
    // 禁止ワードチェック
    if (typeof validateName === 'function') {
        const validation = validateName(message);
        if (!validation.valid) {
            alert('不適切な言葉が含まれています');
            return;
        }
    }
    
    const chatMessage = {
        type: currentChatType,
        playerId: player.id,
        playerName: player.name,
        playerLevel: player.level,
        message: message,
        timestamp: Date.now()
    };
    
    // サーバーへ送信
    if (window.socket && window.socket.connected) {
        window.socket.emit('chat:message', chatMessage);
    } else {
        // オフラインの場合はローカルにのみ表示
        addChatMessage(chatMessage);
    }
    
    chatInput.value = '';
}

// チャットメッセージの追加
function addChatMessage(message) {
    chatHistory.push(message);
    
    // 履歴が最大数を超えたら古いものを削除
    if (chatHistory.length > MAX_CHAT_HISTORY) {
        chatHistory.shift();
    }
    
    renderChatHistory();
}

// チャット履歴の描画
function renderChatHistory() {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;
    
    // 現在のチャットタイプのみを表示
    const filteredMessages = chatHistory.filter(msg => 
        msg.type === currentChatType || msg.type === 'system'
    );
    
    messagesDiv.innerHTML = filteredMessages.map(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const chatType = CHAT_TYPES[msg.type] || CHAT_TYPES.global;
        const color = chatType.color;
        
        if (msg.type === 'system') {
            return `
                <div class="chat-message system-message">
                    <span class="chat-time">${time}</span>
                    <span class="chat-text">${msg.message}</span>
                </div>
            `;
        }
        
        return `
            <div class="chat-message">
                <span class="chat-time">${time}</span>
                <span class="chat-type" style="color: ${color}">[${chatType.name}]</span>
                <span class="chat-player">${msg.playerName} Lv.${msg.playerLevel}</span>
                <span class="chat-text">: ${msg.message}</span>
            </div>
        `;
    }).join('');
    
    // 最新メッセージへスクロール
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ソケットイベントリスナーの設定
function setupChatSocketListeners() {
    if (!window.socket) return;
    
    // チャットメッセージ受信
    window.socket.on('chat:message', (message) => {
        addChatMessage(message);
    });
    
    // システムメッセージ受信
    window.socket.on('chat:system', (message) => {
        addChatMessage({
            type: 'system',
            message: message,
            timestamp: Date.now()
        });
    });
    
    // 近距離チャット（位置判定付き）
    window.socket.on('chat:local', (message) => {
        // 自分との距離をチェック
        const player = getPlayerData();
        if (!player) return;
        
        // 簡易実装：常に表示（本当は位置判定が必要）
        addChatMessage(message);
    });
}

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initChatUI();
        setupChatSocketListeners();
    }, 100);
});

// グローバル関数として公開
window.addChatMessage = addChatMessage;
window.setupChatSocketListeners = setupChatSocketListeners;