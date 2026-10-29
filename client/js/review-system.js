// ============================================
// 復習システム
// 間違えた問題を記録し、間隔反復スケジューリングで復習を管理
// ============================================

// SuperMemo-2アルゴリズムによる間隔反復スケジューリング
class ReviewScheduler {
    constructor() {
        this.MIN_EASE_FACTOR = 1.3;
        this.DEFAULT_EASE_FACTOR = 2.5;
    }

    // 次回の復習日を計算
    calculateNextReview(reviewItem, quality) {
        // quality: 0-5（0=完全忘却、5=完璧）
        // 評価基準:
        // 5: 完璧に覚えている
        // 4: 正解したが少し迷った
        // 3: 正解したが難しかった
        // 2: 間違えたがヒントで正解
        // 1: 間違えた
        // 0: 完全忘却

        if (!reviewItem) {
            // 初回の場合
            return {
                interval: 1, // 1日後
                easeFactor: this.DEFAULT_EASE_FACTOR,
                nextReviewDate: Date.now() + (24 * 60 * 60 * 1000)
            };
        }

        let { interval, easeFactor } = reviewItem;

        if (quality >= 3) {
            // 正解した場合
            if (interval === 0) {
                interval = 1;
            } else if (interval === 1) {
                interval = 6;
            } else {
                interval = Math.round(interval * easeFactor);
            }

            // イージーファクターを更新
            easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
            if (easeFactor < this.MIN_EASE_FACTOR) {
                easeFactor = this.MIN_EASE_FACTOR;
            }
        } else {
            // 間違えた場合
            interval = 1; // 1日後に再試行
            easeFactor = easeFactor - 0.2; // イージーファクターを下げる
            if (easeFactor < this.MIN_EASE_FACTOR) {
                easeFactor = this.MIN_EASE_FACTOR;
            }
        }

        const nextReviewDate = Date.now() + (interval * 24 * 60 * 60 * 1000);

        return {
            interval,
            easeFactor,
            nextReviewDate
        };
    }

    // 復習が必要な問題を取得
    getDueReviews(reviewList) {
        const now = Date.now();
        return reviewList.filter(item => item.nextReviewDate <= now);
    }

    // 復習リストから問題を削除（マスターした場合）
    removeReview(reviewList, questionId) {
        return reviewList.filter(item => item.questionId !== questionId);
    }
}

// 復習システムのメインクラス
class ReviewSystem {
    constructor() {
        this.scheduler = new ReviewScheduler();
        this.reviewList = [];
        this.loadReviewList();
    }

    // 復習リストをロード
    loadReviewList() {
        try {
            const player = getPlayerData();
            if (player && player.reviewList) {
                this.reviewList = player.reviewList;
            }
        } catch (e) {
            console.error('復習リストのロードに失敗:', e);
        }
    }

    // 復習リストを保存
    saveReviewList() {
        try {
            const player = getPlayerData();
            if (player) {
                player.reviewList = this.reviewList;
                localStorage.setItem('player', JSON.stringify(player));
            }
        } catch (e) {
            console.error('復習リストの保存に失敗:', e);
        }
    }

    // 問題を復習リストに追加（間違えた場合）
    addWrongQuestion(questionData) {
        const existingIndex = this.reviewList.findIndex(
            item => item.questionId === questionData.id
        );

        if (existingIndex >= 0) {
            // 既にリストにある場合は更新
            this.reviewList[existingIndex].wrongCount = (this.reviewList[existingIndex].wrongCount || 0) + 1;
            this.reviewList[existingIndex].lastWrongDate = Date.now();
        } else {
            // 新規追加
            this.reviewList.push({
                questionId: questionData.id,
                question: questionData.question,
                answer: questionData.answer,
                subject: questionData.subject || 'unknown',
                level: questionData.level || 'unknown',
                grade: questionData.grade || 'unknown',
                difficulty: questionData.difficulty || 'basic',
                wrongCount: 1,
                lastWrongDate: Date.now(),
                interval: 0,
                easeFactor: 2.5,
                nextReviewDate: Date.now() + (24 * 60 * 60 * 1000), // 1日後
                tags: questionData.tags || [],
                explanation: questionData.explanation || ''
            });
        }

        this.saveReviewList();
    }

    // 復習結果を記録
    recordReviewResult(questionId, quality) {
        const index = this.reviewList.findIndex(item => item.questionId === questionId);
        if (index < 0) return;

        const item = this.reviewList[index];
        const result = this.scheduler.calculateNextReview(item, quality);

        item.interval = result.interval;
        item.easeFactor = result.easeFactor;
        item.nextReviewDate = result.nextReviewDate;
        item.lastReviewDate = Date.now();
        item.reviewCount = (item.reviewCount || 0) + 1;

        // qualityが5（完璧）で、かつ連続3回以上正解の場合はリストから削除
        if (quality === 5 && item.reviewCount >= 3) {
            this.reviewList.splice(index, 1);
        }

        this.saveReviewList();
    }

    // 復習が必要な問題を取得
    getDueReviews() {
        return this.scheduler.getDueReviews(this.reviewList);
    }

    // 復習リストの統計を取得
    getReviewStats() {
        const total = this.reviewList.length;
        const due = this.getDueReviews().length;
        const mastered = this.reviewList.filter(item => item.easeFactor >= 3.0).length;
        const struggling = this.reviewList.filter(item => item.wrongCount >= 3).length;

        return {
            total,
            due,
            mastered,
            struggling,
            accuracy: total > 0 ? Math.round((total - struggling) / total * 100) : 100
        };
    }

    // 教科別の復習リストを取得
    getReviewsBySubject(subject) {
        return this.reviewList.filter(item => item.subject === subject);
    }

    // 苦手な問題（間違えた回数が多い）を取得
    getStrugglingQuestions(limit = 10) {
        return this.reviewList
            .sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0))
            .slice(0, limit);
    }
}

// グローバルインスタンス
let reviewSystem = null;

// 復習システムを初期化
function initReviewSystem() {
    if (!reviewSystem) {
        reviewSystem = new ReviewSystem();
    }
    return reviewSystem;
}

// 復習UIを表示
function showReviewUI() {
    const system = initReviewSystem();
    const stats = system.getReviewStats();
    const dueReviews = system.getDueReviews();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'reviewModal';

    let reviewsHtml = '';
    if (dueReviews.length === 0) {
        reviewsHtml = '<div class="review-empty">現在復習が必要な問題はありません</div>';
    } else {
        reviewsHtml = dueReviews.map(item => `
            <div class="review-item" data-question-id="${item.questionId}">
                <div class="review-question">${item.question}</div>
                <div class="review-answer">正解: ${item.answer}</div>
                <div class="review-meta">
                    <span class="review-tag">${item.subject}</span>
                    <span class="review-count">間違えた回数: ${item.wrongCount}</span>
                </div>
                <div class="review-actions">
                    <button class="btn btn-success review-grade" data-quality="5">完璧</button>
                    <button class="btn btn-primary review-grade" data-quality="4">良い</button>
                    <button class="btn btn-warning review-grade" data-quality="3">普通</button>
                    <button class="btn btn-danger review-grade" data-quality="2">難しい</button>
                    <button class="btn btn-secondary review-grade" data-quality="1">忘れた</button>
                </div>
                ${item.explanation ? `<div class="review-explanation">解説: ${item.explanation}</div>` : ''}
            </div>
        `).join('');
    }

    modal.innerHTML = `
        <div class="modal-content review-modal">
            <button type="button" class="close btn btn-secondary">閉じる</button>
            <h2>📚 復習リスト</h2>
            
            <div class="review-stats">
                <div class="stat-card">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">総問題数</div>
                </div>
                <div class="stat-card due">
                    <div class="stat-value">${stats.due}</div>
                    <div class="stat-label">復習が必要</div>
                </div>
                <div class="stat-card mastered">
                    <div class="stat-value">${stats.mastered}</div>
                    <div class="stat-label">マスター済み</div>
                </div>
                <div class="stat-card struggling">
                    <div class="stat-value">${stats.struggling}</div>
                    <div class="stat-label">苦手な問題</div>
                </div>
            </div>

            <div class="review-list">
                ${reviewsHtml}
            </div>

            ${stats.struggling > 0 ? `
                <div class="struggling-section">
                    <h3>苦手な問題TOP5</h3>
                    <div class="struggling-list">
                        ${system.getStrugglingQuestions(5).map(item => `
                            <div class="struggling-item">
                                <div class="struggling-question">${item.question}</div>
                                <div class="struggling-count">間違えた回数: ${item.wrongCount}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    document.body.appendChild(modal);

    // イベントリスナー
    modal.querySelector('.close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // 復習評価ボタン
    modal.querySelectorAll('.review-grade').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const questionId = e.target.closest('.review-item').dataset.questionId;
            const quality = parseInt(e.target.dataset.quality);
            system.recordReviewResult(questionId, quality);

            // UIを更新
            const item = e.target.closest('.review-item');
            item.style.opacity = '0.5';
            item.style.pointerEvents = 'none';

            // 全て評価したら再読み込み
            if (modal.querySelectorAll('.review-item[style*="opacity"]').length === dueReviews.length) {
                setTimeout(() => {
                    modal.remove();
                    showReviewUI(); // 再表示して更新されたリストを表示
                }, 500);
            }
        });
    });
}

// グローバル関数として公開
window.initReviewSystem = initReviewSystem;
window.showReviewUI = showReviewUI;
window.getReviewSystem = () => reviewSystem;

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    initReviewSystem();
});
