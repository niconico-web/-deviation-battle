/**
 * バトル画面の「遊び方」チュートリアル。
 * - 初めてバトル画面を開いたときに自動的に表示する（localStorageで一度きり）。
 * - ヘッダーの「?」ボタンからいつでも見返せる。
 * - オンライン/パーティ戦かどうかで、コマンド選択に関する説明を出し分ける。
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'sb_tutorial_battle_seen';

    // battle.js 側の isBotBattle 等の定義タイミングに依存しないよう、直接 localStorage を見る
    const isOnlineOrPartyBattle = localStorage.getItem('isBotBattle') !== 'true';

    const baseSteps = [
        {
            icon: '📖',
            title: 'ようこそスクールバトルへ！',
            body: 'このチュートリアルでは、バトルの基本的な遊び方を説明します。\nいつでもヘッダーの「?」ボタンから見返せます。'
        },
        {
            icon: '❓',
            title: '問題に回答しよう',
            body: '出題された問題の答えを、4つの選択肢の中からタップして選びます。\n制限時間が表示されるので、時間内に回答しましょう。'
        },
        {
            icon: '⚡',
            title: '行動ゲージシステム',
            body: '正解するたびに「行動ゲージ」が溜まります。\n正解すると、その場で小さな追撃ダメージ（攻撃力の0.5倍）を与えつつゲージが進みます。\n行動ゲージが満タンになると、自動的に強攻撃（攻撃力の1倍）が発動します！'
        },
        {
            icon: '⚔️',
            title: '追撃ダメージと強攻撃',
            body: '正解ごとの追撃ダメージは0.5倍、行動ゲージ満タン時の強攻撃は1倍です。\n素早さが高いと、行動ゲージを満タンにするために必要な正解数が少なくなります。\nスキルツリーで「攻撃」か「特殊」を選ぶと、そのステータスがダメージ計算に使われます。'
        }
    ];

    const onlineStep = {
        icon: '⏱️',
        title: 'オンライン・パーティ戦の注意',
        body: '同じ問題に相手（やパーティメンバー）も同時に挑戦しています。\nそれぞれが独立した行動ゲージを持っているので、自分のペースで正解を重ねて行動ゲージを溜めましょう。\n相手が先に強攻撃を発動しても、自分のゲージはそのまま進みます。'
    };

    const finalSteps = [
        {
            icon: '✨',
            title: 'アクティブスキル',
            body: '問題が表示されてから数秒間だけ、画面下のスキルボタンが使えます。\n味方を強化したり相手を弱体化したりする効果があるので、状況に合わせて使ってみましょう。'
        },
        {
            icon: '💥',
            title: '必殺技ゲージ',
            body: '問題に正解するたびに必殺技ゲージが少しずつ貯まります。\n満タンになったら「必殺技」コマンドを選んで、強力な一撃を狙いましょう！'
        },
        {
            icon: '🎉',
            title: '準備完了！',
            body: 'これで基本はバッチリです。\nそれでは、バトルを楽しんでください！'
        }
    ];

    const TUTORIAL_STEPS = isOnlineOrPartyBattle
        ? [...baseSteps, onlineStep, ...finalSteps]
        : [...baseSteps, ...finalSteps];

    let currentStep = 0;

    function renderStep() {
        const step = TUTORIAL_STEPS[currentStep];
        const iconEl = document.getElementById('tutorialStepIcon');
        const titleEl = document.getElementById('tutorialStepTitle');
        const bodyEl = document.getElementById('tutorialStepBody');
        const dotsEl = document.getElementById('tutorialDots');
        const prevBtn = document.getElementById('tutorialPrevBtn');
        const nextBtn = document.getElementById('tutorialNextBtn');

        if (!step || !iconEl || !titleEl || !bodyEl || !dotsEl || !prevBtn || !nextBtn) return;

        iconEl.textContent = step.icon;
        titleEl.textContent = step.title;
        bodyEl.textContent = step.body;

        dotsEl.innerHTML = '';
        TUTORIAL_STEPS.forEach((_, index) => {
            const dot = document.createElement('span');
            dot.className = 'dot' + (index === currentStep ? ' active' : '');
            dotsEl.appendChild(dot);
        });

        prevBtn.disabled = currentStep === 0;
        nextBtn.textContent = (currentStep === TUTORIAL_STEPS.length - 1) ? 'はじめる' : '次へ';
    }

    function openTutorial() {
        currentStep = 0;
        renderStep();
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    function closeTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.style.display = 'none';
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch (e) {
            // localStorageが使えない環境でも致命的にならないようにする
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const openBtn = document.getElementById('tutorialOpenBtn');
        const skipBtn = document.getElementById('tutorialSkipBtn');
        const prevBtn = document.getElementById('tutorialPrevBtn');
        const nextBtn = document.getElementById('tutorialNextBtn');
        const overlay = document.getElementById('tutorial-overlay');

        if (!overlay) return; // このページにチュートリアルが無い場合は何もしない

        openBtn?.addEventListener('click', openTutorial);
        skipBtn?.addEventListener('click', closeTutorial);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeTutorial();
        });

        prevBtn?.addEventListener('click', () => {
            if (currentStep > 0) {
                currentStep--;
                renderStep();
            }
        });

        nextBtn?.addEventListener('click', () => {
            if (currentStep < TUTORIAL_STEPS.length - 1) {
                currentStep++;
                renderStep();
            } else {
                closeTutorial();
            }
        });

        // 初めてのバトル画面訪問時のみ自動表示
        let alreadySeen = false;
        try {
            alreadySeen = localStorage.getItem(STORAGE_KEY) === 'true';
        } catch (e) {
            alreadySeen = false;
        }
        if (!alreadySeen) {
            openTutorial();
        }
    });
})();
