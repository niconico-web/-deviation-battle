// client/js/board.js
// ============================================
// 掲示板UI（スレッド一覧・作成・詳細・返信）
// ============================================

const BoardUI = {
    modal: null,
    view: 'list',        // 'list' | 'create' | 'detail'
    page: 1,
    threadsData: null,
    currentThread: null,
    currentThreadId: null
};

// HTMLエスケープ
function boardEscape(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 日時フォーマット
function boardFormatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// プレイヤー情報取得
function boardGetPlayer() {
    if (typeof getPlayerData === 'function') {
        return getPlayerData();
    }
    return null;
}

// モーダルを開く
BoardUI.open = function () {
    if (BoardUI.modal) {
        BoardUI.modal.style.display = 'flex';
    } else {
        BoardUI.createModal();
    }
    BoardUI.showList();
};

// モーダルを閉じる
BoardUI.close = function () {
    if (BoardUI.modal) {
        BoardUI.modal.style.display = 'none';
    }
};

// モーダルDOMを作成
BoardUI.createModal = function () {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'boardModal';
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="modal-content board-modal-content">
            <button type="button" class="close btn btn-secondary" id="boardCloseBtn">閉じる</button>
            <h2>📋 掲示板</h2>
            <div id="boardContent"></div>
        </div>
    `;

    document.body.appendChild(modal);
    BoardUI.modal = modal;

    modal.querySelector('#boardCloseBtn').addEventListener('click', () => BoardUI.close());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) BoardUI.close();
    });
};

// コンテンツ領域を取得
BoardUI.getContent = function () {
    return BoardUI.modal ? BoardUI.modal.querySelector('#boardContent') : null;
};

// 一覧画面を表示
BoardUI.showList = function () {
    BoardUI.view = 'list';
    const content = BoardUI.getContent();
    if (!content) return;

    content.innerHTML = `
        <div class="board-list-header">
            <button type="button" class="btn btn-primary" id="boardNewThreadBtn">＋ 新規スレッド</button>
        </div>
        <div id="boardThreadList"><p>読み込み中...</p></div>
        <div id="boardPager" class="board-pager"></div>
    `;

    content.querySelector('#boardNewThreadBtn').addEventListener('click', () => BoardUI.showCreateForm());

    if (window.socket && window.socket.connected) {
        window.socket.emit('board:list', BoardUI.page);
    } else {
        const listEl = content.querySelector('#boardThreadList');
        if (listEl) listEl.innerHTML = '<p>サーバーに接続されていません</p>';
    }
};

// スレッド一覧を描画
BoardUI.renderThreads = function (data) {
    BoardUI.threadsData = data;
    const content = BoardUI.getContent();
    if (!content || BoardUI.view !== 'list') return;

    const listEl = content.querySelector('#boardThreadList');
    const pagerEl = content.querySelector('#boardPager');
    if (!listEl) return;

    if (!data || !data.threads || data.threads.length === 0) {
        listEl.innerHTML = '<p class="board-empty">まだスレッドがありません。最初のスレッドを立ててみましょう！</p>';
    } else {
        let html = '<div class="board-thread-list">';
        data.threads.forEach(t => {
            html += `
                <div class="board-thread-item" data-thread-id="${t.id}">
                    <div class="board-thread-title">${boardEscape(t.title)}</div>
                    <div class="board-thread-meta">
                        <span>👤 ${boardEscape(t.authorName)}</span>
                        <span>💬 ${t.replyCount || 0}件</span>
                        <span>🕐 ${boardFormatDate(t.updatedAt)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        listEl.innerHTML = html;

        listEl.querySelectorAll('.board-thread-item').forEach(item => {
            item.addEventListener('click', () => {
                BoardUI.openThread(parseInt(item.dataset.threadId, 10));
            });
        });
    }

    // ページャー
    if (pagerEl) {
        const page = data ? data.page : 1;
        const totalPages = data ? data.totalPages : 1;
        if (totalPages > 1) {
            pagerEl.innerHTML = `
                <button type="button" class="btn btn-secondary board-page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← 前へ</button>
                <span class="board-page-info">${page} / ${totalPages} ページ</span>
                <button type="button" class="btn btn-secondary board-page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>次へ →</button>
            `;
            pagerEl.querySelectorAll('.board-page-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const p = parseInt(btn.dataset.page, 10);
                    if (p >= 1) {
                        BoardUI.page = p;
                        BoardUI.showList();
                    }
                });
            });
        } else {
            pagerEl.innerHTML = '';
        }
    }
};

// 新規スレッド作成フォーム
BoardUI.showCreateForm = function () {
    BoardUI.view = 'create';
    const content = BoardUI.getContent();
    if (!content) return;

    content.innerHTML = `
        <div class="board-create-form">
            <h3>新規スレッド</h3>
            <label class="field-label" for="boardThreadTitle">タイトル（30文字以内）</label>
            <input type="text" id="boardThreadTitle" maxlength="30" placeholder="タイトルを入力">
            <label class="field-label" for="boardThreadBody">本文（1000文字以内）</label>
            <textarea id="boardThreadBody" rows="8" maxlength="1000" placeholder="本文を入力"></textarea>
            <div class="board-form-actions">
                <button type="button" class="btn btn-primary" id="boardCreateSubmit">投稿する</button>
                <button type="button" class="btn btn-secondary" id="boardCreateCancel">キャンセル</button>
            </div>
        </div>
    `;

    content.querySelector('#boardCreateCancel').addEventListener('click', () => BoardUI.showList());
    content.querySelector('#boardCreateSubmit').addEventListener('click', () => {
        const title = content.querySelector('#boardThreadTitle').value.trim();
        const body = content.querySelector('#boardThreadBody').value.trim();
        const player = boardGetPlayer();

        if (!player || !player.id) {
            alert('キャラクターを作成してください');
            return;
        }
        if (!title) {
            alert('タイトルを入力してください');
            return;
        }
        if (!body) {
            alert('本文を入力してください');
            return;
        }

        if (window.socket && window.socket.connected) {
            window.socket.emit('board:create', {
                title: title,
                body: body,
                authorId: player.id,
                authorName: player.name
            });
        } else {
            alert('サーバーに接続されていません');
        }
    });
};

// スレッド詳細を開く
BoardUI.openThread = function (threadId) {
    BoardUI.view = 'detail';
    BoardUI.currentThreadId = threadId;
    const content = BoardUI.getContent();
    if (!content) return;

    content.innerHTML = '<p>読み込み中...</p>';

    if (window.socket && window.socket.connected) {
        window.socket.emit('board:getThread', threadId);
    } else {
        content.innerHTML = '<p>サーバーに接続されていません</p>';
    }
};

// スレッド詳細を描画
BoardUI.renderThread = function (thread) {
    BoardUI.currentThread = thread;
    const content = BoardUI.getContent();
    if (!content || BoardUI.view !== 'detail') return;

    if (!thread) {
        content.innerHTML = `
            <p>スレッドが見つかりません。</p>
            <button type="button" class="btn btn-secondary" id="boardBackBtn">一覧に戻る</button>
        `;
        content.querySelector('#boardBackBtn').addEventListener('click', () => BoardUI.showList());
        return;
    }

    const player = boardGetPlayer();
    const isAuthor = player && thread.authorId === player.id;

    let repliesHtml = '';
    if (thread.replies && thread.replies.length > 0) {
        repliesHtml = thread.replies.map(r => `
            <div class="board-reply-item">
                <div class="board-reply-meta">
                    <span>👤 ${boardEscape(r.authorName)}</span>
                    <span>🕐 ${boardFormatDate(r.createdAt)}</span>
                </div>
                <div class="board-reply-body">${boardEscape(r.body).replace(/\n/g, '<br>')}</div>
            </div>
        `).join('');
    } else {
        repliesHtml = '<p class="board-empty">まだ返信がありません。最初の返信をしてみましょう！</p>';
    }

    content.innerHTML = `
        <div class="board-thread-detail">
            <button type="button" class="btn btn-secondary" id="boardBackBtn">← 一覧に戻る</button>
            <h3 class="board-detail-title">${boardEscape(thread.title)}</h3>
            <div class="board-thread-meta board-detail-meta">
                <span>👤 ${boardEscape(thread.authorName)}</span>
                <span>🕐 ${boardFormatDate(thread.createdAt)}</span>
                ${isAuthor ? '<button type="button" class="btn btn-danger board-delete-btn" id="boardDeleteBtn">削除</button>' : ''}
            </div>
            <div class="board-thread-body">${boardEscape(thread.body).replace(/\n/g, '<br>')}</div>

            <h4 class="board-replies-title">返信（${thread.replyCount || (thread.replies ? thread.replies.length : 0)}件）</h4>
            <div class="board-replies">${repliesHtml}</div>

            <div class="board-reply-form">
                <textarea id="boardReplyBody" rows="3" maxlength="500" placeholder="返信を入力（500文字以内）"></textarea>
                <button type="button" class="btn btn-primary" id="boardReplySubmit">返信する</button>
            </div>
        </div>
    `;

    content.querySelector('#boardBackBtn').addEventListener('click', () => BoardUI.showList());

    const deleteBtn = content.querySelector('#boardDeleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (!confirm('このスレッドを削除しますか？')) return;
            if (window.socket && window.socket.connected && player) {
                window.socket.emit('board:delete', { threadId: thread.id, playerId: player.id });
            }
        });
    }

    content.querySelector('#boardReplySubmit').addEventListener('click', () => {
        const replyBody = content.querySelector('#boardReplyBody').value.trim();
        const p = boardGetPlayer();

        if (!p || !p.id) {
            alert('キャラクターを作成してください');
            return;
        }
        if (!replyBody) {
            alert('返信を入力してください');
            return;
        }

        if (window.socket && window.socket.connected) {
            window.socket.emit('board:reply', {
                threadId: thread.id,
                body: replyBody,
                authorId: p.id,
                authorName: p.name
            });
        } else {
            alert('サーバーに接続されていません');
        }
    });
};

// ソケットイベントリスナーの設定
function setupBoardSocketListeners() {
    if (!window.socket) return;

    // 二重登録を防ぐ
    window.socket.off('board:threads');
    window.socket.off('board:thread');
    window.socket.off('board:createResponse');
    window.socket.off('board:replyResponse');
    window.socket.off('board:deleteResponse');

    // スレッド一覧受信
    window.socket.on('board:threads', (data) => {
        BoardUI.renderThreads(data);
    });

    // スレッド詳細受信
    window.socket.on('board:thread', (thread) => {
        BoardUI.renderThread(thread);
    });

    // スレッド作成結果
    window.socket.on('board:createResponse', (result) => {
        if (result && result.success) {
            BoardUI.page = 1;
            BoardUI.showList();
            if (window.socket && window.socket.connected) {
                window.socket.emit('board:list', 1);
            }
        } else {
            alert(result && result.message ? result.message : 'スレッドの作成に失敗しました');
        }
    });

    // 返信結果
    window.socket.on('board:replyResponse', (result) => {
        if (result && result.success) {
            // 詳細と一覧の返信数を更新
            if (window.socket && window.socket.connected) {
                window.socket.emit('board:getThread', result.threadId);
                window.socket.emit('board:list', BoardUI.page);
            }
        } else {
            alert(result && result.message ? result.message : '返信に失敗しました');
        }
    });

    // 削除結果
    window.socket.on('board:deleteResponse', (result) => {
        if (result && result.success) {
            BoardUI.showList();
            if (window.socket && window.socket.connected) {
                window.socket.emit('board:list', BoardUI.page);
            }
        } else {
            alert(result && result.message ? result.message : '削除に失敗しました');
        }
    });
}

// 掲示板ボタンのバインド
function setupBoardButton() {
    const btn = document.getElementById('boardBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            BoardUI.open();
        });
    }
}

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupBoardSocketListeners();
        setupBoardButton();
    }, 100);
});

// グローバル公開
window.BoardUI = BoardUI;
window.boardEscape = boardEscape;
