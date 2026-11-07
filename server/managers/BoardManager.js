// ============================================
// School Battle
// BoardManager.js
// 掲示板（スレッド＋返信）のサーバー側データ管理
// ============================================

const fs = require('fs');
const path = require('path');
const ContentFilter = require('./ContentFilter');

const BOARD_DATA_FILE = path.join(__dirname, '..', 'data', 'board.json');
const DATA_DIR = path.dirname(BOARD_DATA_FILE);

// 文字数制限
const MAX_TITLE_LENGTH = 30;
const MAX_BODY_LENGTH = 1000;
const MAX_REPLY_LENGTH = 500;

let boardData = { threads: [], nextId: 1 };

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 掲示板データを読み込む
function loadBoardData() {
    try {
        if (fs.existsSync(BOARD_DATA_FILE)) {
            const fileContent = fs.readFileSync(BOARD_DATA_FILE, 'utf-8');
            boardData = JSON.parse(fileContent);
            if (!boardData || !Array.isArray(boardData.threads)) {
                boardData = { threads: [], nextId: 1 };
            }
            if (typeof boardData.nextId !== 'number') {
                boardData.nextId = 1;
            }
            console.log('[BoardManager] Board data loaded from file.');
        } else {
            console.log('[BoardManager] No board data file found, starting with empty data.');
            boardData = { threads: [], nextId: 1 };
        }
    } catch (error) {
        console.error('[BoardManager] Error loading board data:', error);
        boardData = { threads: [], nextId: 1 };
    }
}

// 掲示板データを保存
function saveBoardData() {
    try {
        fs.writeFileSync(BOARD_DATA_FILE, JSON.stringify(boardData, null, 2), 'utf-8');
    } catch (error) {
        console.error('[BoardManager] Error saving board data:', error);
    }
}

// テキストのバリデーション（文字数＋禁止ワード）
// ※ ContentFilter.validateText は validateName を呼ぶ実装で、
//   名前用の20文字制限が掛かってしまうため、ここでは BANNED_WORDS を
//   直接使って禁止ワード判定だけを行う。
function validateText(text, maxLength, label) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { valid: false, message: `${label}を入力してください` };
    }
    if (text.length > maxLength) {
        return { valid: false, message: `${label}は${maxLength}文字以内にしてください` };
    }
    const normalized = text.toLowerCase();
    for (const bannedWord of ContentFilter.BANNED_WORDS) {
        if (normalized.includes(bannedWord.toLowerCase())) {
            return { valid: false, message: '不適切な言葉が含まれています' };
        }
    }
    return { valid: true };
}

// スレッド一覧を取得（更新日時の新しい順）
function getThreads(page = 1, perPage = 20) {
    page = Math.max(1, parseInt(page, 10) || 1);
    perPage = Math.min(50, Math.max(1, parseInt(perPage, 10) || 20));

    const sorted = boardData.threads.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const totalCount = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * perPage;
    const pageThreads = sorted.slice(start, start + perPage).map(t => ({
        id: t.id,
        title: t.title,
        authorName: t.authorName,
        replyCount: t.replyCount || (t.replies ? t.replies.length : 0),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
    }));

    return {
        threads: pageThreads,
        page: safePage,
        totalPages,
        totalCount
    };
}

// スレッド詳細を取得
function getThread(id) {
    const threadId = parseInt(id, 10);
    const thread = boardData.threads.find(t => t.id === threadId);
    if (!thread) {
        return null;
    }
    return thread;
}

// スレッドを作成
function createThread({ title, body, authorId, authorName }) {
    if (!authorId || !authorName) {
        return { success: false, message: '投稿者情報が不正です' };
    }

    const titleCheck = validateText(title, MAX_TITLE_LENGTH, 'タイトル');
    if (!titleCheck.valid) {
        return { success: false, message: titleCheck.message };
    }
    const bodyCheck = validateText(body, MAX_BODY_LENGTH, '本文');
    if (!bodyCheck.valid) {
        return { success: false, message: bodyCheck.message };
    }

    const now = Date.now();
    const thread = {
        id: boardData.nextId++,
        title: title.trim(),
        authorId,
        authorName,
        body: body.trim(),
        replies: [],
        nextReplyId: 1,
        replyCount: 0,
        createdAt: now,
        updatedAt: now
    };

    boardData.threads.push(thread);
    saveBoardData();

    return { success: true, thread };
}

// スレッドに返信
function reply(threadId, { body, authorId, authorName }) {
    const thread = getThread(threadId);
    if (!thread) {
        return { success: false, message: 'スレッドが見つかりません' };
    }
    if (!authorId || !authorName) {
        return { success: false, message: '投稿者情報が不正です' };
    }

    const bodyCheck = validateText(body, MAX_REPLY_LENGTH, '返信');
    if (!bodyCheck.valid) {
        return { success: false, message: bodyCheck.message };
    }

    const replyData = {
        id: thread.nextReplyId++,
        authorId,
        authorName,
        body: body.trim(),
        createdAt: Date.now()
    };

    thread.replies.push(replyData);
    thread.replyCount = thread.replies.length;
    thread.updatedAt = Date.now();
    saveBoardData();

    return { success: true, reply: replyData, threadId: thread.id };
}

// スレッドを削除（投稿者本人のみ）
function deleteThread(threadId, playerId) {
    const id = parseInt(threadId, 10);
    const index = boardData.threads.findIndex(t => t.id === id);
    if (index === -1) {
        return { success: false, message: 'スレッドが見つかりません' };
    }
    if (boardData.threads[index].authorId !== playerId) {
        return { success: false, message: 'このスレッドを削除する権限がありません' };
    }
    boardData.threads.splice(index, 1);
    saveBoardData();
    return { success: true };
}

// 起動時ロード
loadBoardData();

module.exports = {
    getThreads,
    getThread,
    createThread,
    reply,
    deleteThread
};
