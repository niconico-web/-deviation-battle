/**
 * 「実戦形式」の練習バトル用コーチマーク表示ユーティリティ。
 * localStorageの sb_practice_tutorial フラグが立っているときだけ battle.js から呼び出され、
 * 実際のバトルUI要素の近くに吹き出しを表示しながら操作を教える。
 * バトル自体の進行（回答判定・ダメージ計算など）には一切干渉しない。
 */
window.PracticeCoach = (function () {
    'use strict';

    let active = false;
    let banner = null;
    let currentBubble = null;
    let currentHighlightEl = null;
    let queue = [];
    let processing = false;

    function isActive() {
        return active;
    }

    function start() {
        active = true;
        if (banner) return;
        banner = document.createElement('div');
        banner.className = 'coach-banner';
        banner.innerHTML = `
            <span class="coach-banner-icon">🔰</span>
            <span>練習バトル中：スライムと戦いながら操作を覚えよう</span>
            <button type="button" id="coachBannerEndBtn">練習を終了</button>
        `;
        document.body.appendChild(banner);
        document.getElementById('coachBannerEndBtn')?.addEventListener('click', stop);
    }

    function stop() {
        active = false;
        queue = [];
        clearBubble();
        if (banner) {
            banner.remove();
            banner = null;
        }
    }

    function clearBubble() {
        if (currentBubble) {
            currentBubble.remove();
            currentBubble = null;
        }
        if (currentHighlightEl) {
            currentHighlightEl.classList.remove('coach-highlight');
            currentHighlightEl = null;
        }
    }

    function positionBubble(bubbleEl, targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const bubbleRect = bubbleEl.getBoundingClientRect();
        let top = rect.bottom + 10;
        let left = rect.left + (rect.width / 2) - (bubbleRect.width / 2);

        // 画面下にはみ出す場合はターゲットの上に表示する
        if (top + bubbleRect.height > window.innerHeight - 10) {
            top = rect.top - bubbleRect.height - 10;
        }
        // 画面左右にはみ出さないよう補正
        left = Math.max(10, Math.min(left, window.innerWidth - bubbleRect.width - 10));
        if (top < 46) top = 46; // 上部のバナーと重ならないように

        bubbleEl.style.top = `${top}px`;
        bubbleEl.style.left = `${left}px`;
    }

    /**
     * 指定した要素の近くに吹き出しを表示する。同時に1つしか表示しないよう、
     * 既に表示中の場合はキューに積んで順番に表示する。
     * @param {HTMLElement} targetEl - ハイライト・吹き出しの対象要素
     * @param {string} text - 吹き出しの本文
     * @param {object} [opts]
     * @param {string} [opts.buttonLabel] - 確認ボタンのラベル（既定「わかった」）
     * @param {function} [opts.onDismiss] - 閉じたときのコールバック
     */
    function point(targetEl, text, opts) {
        if (!active || !targetEl) return;
        queue.push({ targetEl, text, opts: opts || {} });
        processQueue();
    }

    function processQueue() {
        if (processing || queue.length === 0 || !active) return;
        processing = true;
        const { targetEl, text, opts } = queue.shift();

        // ターゲットが見えるまで少し待つ（アニメーション・DOM更新のため）
        setTimeout(() => {
            if (!active) { processing = false; return; }
            clearBubble();

            targetEl.classList.add('coach-highlight');
            currentHighlightEl = targetEl;

            const bubble = document.createElement('div');
            bubble.className = 'coach-bubble';
            bubble.innerHTML = `
                <div class="coach-bubble-text"></div>
                <button type="button" class="coach-bubble-btn"></button>
            `;
            bubble.querySelector('.coach-bubble-text').textContent = text;
            const btn = bubble.querySelector('.coach-bubble-btn');
            btn.textContent = opts.buttonLabel || 'わかった';
            document.body.appendChild(bubble);
            positionBubble(bubble, targetEl);
            currentBubble = bubble;

            btn.addEventListener('click', () => {
                clearBubble();
                processing = false;
                if (typeof opts.onDismiss === 'function') opts.onDismiss();
                processQueue();
            });
        }, 400);
    }

    /**
     * 練習バトルの締めくくりに表示するモーダル。
     */
    function finish(text) {
        if (!active) return;
        clearBubble();
        queue = [];
        const overlay = document.createElement('div');
        overlay.className = 'coach-finish-overlay';
        overlay.innerHTML = `
            <div class="coach-finish-modal">
                <div class="coach-finish-icon">🎉</div>
                <h3>基本操作はバッチリ！</h3>
                <p></p>
                <button type="button">閉じる</button>
            </div>
        `;
        overlay.querySelector('p').textContent = text;
        document.body.appendChild(overlay);
        overlay.querySelector('button').addEventListener('click', () => {
            overlay.remove();
            stop();
        });
    }

    return { start, stop, point, finish, isActive };
})();
