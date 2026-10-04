// ============================================
// チャットシステム
//  ・小さく折りたためる／ドラッグや設定でサイズ変更／設定から完全に非表示にできる
//  ・スマホでは左上（ツールバーの下）、PCでは左下に表示
//  ・表示/サイズは UISettings（⚙️ UI設定）と連動し、端末に保存される
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

const CHAT_COLLAPSED_KEY = 'sb_chat_collapsed';
let chatUnread = 0;

function chatEscape(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function chatIsCompactScreen() {
    try { return window.matchMedia('(max-width: 900px), (pointer: coarse)').matches; } catch (e) { return false; }
}

// ---- UI設定への登録（幅・高さ・文字サイズ・背景の濃さ・表示/非表示）----
function registerChatUISettings() {
    if (!window.UISettings) return;
    const compact = chatIsCompactScreen();
    UISettings.registerGlobal({
        key: 'chatScope', label: 'チャットを表示する画面', type: 'select', def: 'town',
        options: [['town', 'マップ画面のみ'], ['all', 'すべての画面']]
    });
    UISettings.register({
        id: 'chat', label: '💬 チャット', selector: '#chatContainer',
        canHide: true, canScale: false, canOpacity: false, alwaysList: true,
        note: 'チャット欄の角をドラッグしても大きさを変えられます。オフにするとチャット欄が完全に消えます。',
        controls: [
            { key: 'w', label: '幅', min: 180, max: 560, step: 10, def: compact ? 250 : 320, unit: 'px' },
            { key: 'h', label: '高さ', min: 96, max: 480, step: 10, def: compact ? 170 : 220, unit: 'px' },
            { key: 'fs', label: '文字の大きさ', min: 9, max: 20, step: 1, def: compact ? 11 : 12, unit: 'px' },
            { key: 'bg', label: '背景の濃さ', min: 20, max: 100, step: 5, def: 85, unit: '%' }
        ]
    });
    UISettings.onChange((id) => {
        if (id === 'chat' || id === '*') applyChatLayout();
        if (id === '_g:chatScope') updateChatScope();
        if (id === 'chat' && UISettings.get('chat').visible) { chatUnread = 0; updateChatBadge(); }
    });
}

function getChatPrefs() {
    if (window.UISettings) return UISettings.get('chat');
    return { visible: true, w: 300, h: 200, fs: 12, bg: 85 };
}

function applyChatLayout() {
    const c = document.getElementById('chatContainer');
    if (!c) return;
    const p = getChatPrefs();
    c.style.setProperty('--chat-w', p.w + 'px');
    c.style.setProperty('--chat-h', p.h + 'px');
    c.style.setProperty('--chat-fs', p.fs + 'px');
    c.style.setProperty('--chat-bg', String(p.bg / 100));
    c.classList.toggle('chat-top', chatIsCompactScreen());
}

function isChatCollapsed() {
    const v = localStorage.getItem(CHAT_COLLAPSED_KEY);
    if (v === null) return chatIsCompactScreen(); // 初回：スマホでは最初から折りたたんでおく
    return v === '1';
}
function setChatCollapsed(collapsed) {
    try { localStorage.setItem(CHAT_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (e) { /* noop */ }
    const c = document.getElementById('chatContainer');
    if (!c) return;
    c.classList.toggle('chat-collapsed', collapsed);
    const btn = document.getElementById('chatToggleBtn');
    if (btn) {
        btn.textContent = collapsed ? '＋' : '－';
        btn.setAttribute('aria-label', collapsed ? 'チャットを開く' : 'チャットを折りたたむ');
    }
    if (!collapsed) {
        chatUnread = 0;
        updateChatBadge();
        const m = document.getElementById('chatMessages');
        if (m) m.scrollTop = m.scrollHeight;
    }
}

function updateChatBadge() {
    const b = document.getElementById('chatBadge');
    if (!b) return;
    b.hidden = chatUnread <= 0;
    b.textContent = chatUnread > 99 ? '99+' : String(chatUnread);
}

// マップ画面以外ではチャットを出さない（他の画面のボタンを隠してしまうため）。設定で「すべての画面」に変更可
function updateChatScope() {
    const c = document.getElementById('chatContainer');
    if (!c) return;
    const scope = window.UISettings ? UISettings.getGlobal('chatScope') : 'town';
    const town = document.getElementById('section-town');
    const townActive = !town || town.classList.contains('active');
    c.classList.toggle('chat-offscreen', scope === 'town' && !townActive);
}

function showChatToast(text) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);transform:translateX(-50%);' +
        'background:rgba(15,17,21,.92);color:#fff;border:1px solid #4a4a6a;border-radius:20px;padding:8px 16px;' +
        'font-size:13px;z-index:100001;max-width:90vw;text-align:center;pointer-events:none;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// チャットUIの初期化
function initChatUI() {
    if (document.getElementById('chatContainer')) return;
    registerChatUISettings();

    const chatContainer = document.createElement('div');
    chatContainer.id = 'chatContainer';
    chatContainer.className = 'chat-container';

    chatContainer.innerHTML = `
        <div class="chat-header">
            <span class="chat-title" id="chatTitle">💬 チャット<span class="chat-badge" id="chatBadge" hidden>0</span></span>
            <div class="chat-type-selector">
                <button type="button" class="chat-type-btn active" data-type="global">全体</button>
                <button type="button" class="chat-type-btn" data-type="local">近距離</button>
                <button type="button" class="chat-type-btn" data-type="party">パーティー</button>
            </div>
            <button type="button" class="chat-head-btn" id="chatToggleBtn" aria-label="チャットを折りたたむ">－</button>
            <button type="button" class="chat-head-btn" id="chatCloseBtn" aria-label="チャットを非表示にする">✕</button>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-input-area">
            <input type="text" id="chatInput" placeholder="メッセージを入力..." maxlength="100" enterkeyhint="send" autocomplete="off">
            <button type="button" id="chatSendBtn" class="btn btn-primary">送信</button>
        </div>
        <div class="chat-resize" id="chatResize" aria-hidden="true"></div>
    `;

    document.body.appendChild(chatContainer);

    applyChatLayout();
    setChatCollapsed(isChatCollapsed());
    if (window.UISettings) UISettings.applyAll();

    setupChatEventListeners();
    setupChatResize();
    updateChatScope();
    const town = document.getElementById('section-town');
    if (town && typeof MutationObserver !== 'undefined') {
        new MutationObserver(updateChatScope).observe(town, { attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('resize', applyChatLayout);

    // チャット履歴を表示
    renderChatHistory();
}

// チャットイベントリスナーの設定
function setupChatEventListeners() {
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    const chatTitle = document.getElementById('chatTitle');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatTypeBtns = document.querySelectorAll('.chat-type-btn');

    // チャットの開閉（ヘッダーのタイトル部分をタップしても開閉できる）
    const toggle = () => {
        const c = document.getElementById('chatContainer');
        setChatCollapsed(!c.classList.contains('chat-collapsed'));
    };
    chatToggleBtn.addEventListener('click', toggle);
    chatTitle.addEventListener('click', toggle);

    // チャットを完全に非表示（UI設定の「チャット」をオフにしたのと同じ）
    chatCloseBtn.addEventListener('click', () => {
        if (window.UISettings) {
            UISettings.set('chat', { visible: false });
            showChatToast('チャットを非表示にしました。⚙️ UI設定からいつでも戻せます');
        } else {
            document.getElementById('chatContainer').style.display = 'none';
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

    // Enterキーで送信（日本語入力の変換確定のEnterでは送信しない）
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            sendChatMessage();
        }
        e.stopPropagation(); // 入力中の文字がゲームの操作キーとして扱われないようにする
    });
}

// 角のつまみをドラッグしてサイズを変える
function setupChatResize() {
    const handle = document.getElementById('chatResize');
    const c = document.getElementById('chatContainer');
    if (!handle || !c) return;
    let pid = null, sx = 0, sy = 0, sw = 0, sh = 0, w = 0, h = 0;
    handle.addEventListener('pointerdown', (e) => {
        pid = e.pointerId;
        sx = e.clientX; sy = e.clientY;
        const r = c.getBoundingClientRect();
        sw = r.width; sh = r.height; w = sw; h = sh;
        try { handle.setPointerCapture(pid); } catch (err) { /* noop */ }
        e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
        if (e.pointerId !== pid) return;
        const topAnchored = c.classList.contains('chat-top');
        const dw = e.clientX - sx;
        const dh = topAnchored ? (e.clientY - sy) : -(e.clientY - sy);
        w = Math.round(Math.max(180, Math.min(560, window.innerWidth - 16, sw + dw)));
        h = Math.round(Math.max(96, Math.min(480, window.innerHeight - 120, sh + dh)));
        c.style.setProperty('--chat-w', w + 'px');
        c.style.setProperty('--chat-h', h + 'px');
    });
    const end = (e) => {
        if (e.pointerId !== pid) return;
        pid = null;
        if (window.UISettings) UISettings.set('chat', { w: Math.round(w / 10) * 10, h: Math.round(h / 10) * 10 });
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
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

    // 折りたたみ中／非表示中に届いたメッセージは未読として数える
    const c = document.getElementById('chatContainer');
    if (c && (c.classList.contains('chat-collapsed') || c.classList.contains('ui-hidden'))
        && (message.type === currentChatType || message.type === 'system')) {
        chatUnread++;
        updateChatBadge();
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

    if (!filteredMessages.length) {
        messagesDiv.innerHTML = '<div class="chat-empty">まだメッセージがありません</div>';
        return;
    }

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
                    <span class="chat-text">${chatEscape(msg.message)}</span>
                </div>
            `;
        }

        return `
            <div class="chat-message">
                <span class="chat-time">${time}</span>
                <span class="chat-type" style="color: ${color}">[${chatType.name}]</span>
                <span class="chat-player">${chatEscape(msg.playerName)} Lv.${chatEscape(msg.playerLevel)}</span>
                <span class="chat-text">: ${chatEscape(msg.message)}</span>
            </div>
        `;
    }).join('');

    // 最新メッセージへスクロール
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ソケットイベントリスナーの設定
function setupChatSocketListeners() {
    if (!window.socket) return;

    // 二重登録を防ぐ
    window.socket.off('chat:message');
    window.socket.off('chat:system');
    window.socket.off('chat:local');

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
