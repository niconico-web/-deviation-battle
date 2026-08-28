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
            icon: '⚔️',
            title: '正解するとコマンドを選べる',
            body: '正解すると「攻撃・特殊・防御・必殺技」から行動を選べるようになります。\n攻撃・特殊は相手にダメージ、防御は次に受けるダメージを軽減、必殺技はゲージが満タンの時だけ使える強力な一撃です。\nコマンドのボタンをタップすると、その場で行動が確定します。'
        }
    ];

    const onlineStep = {
        icon: '⏱️',
        title: 'オンライン・パーティ戦の注意',
        body: '同じ問題に相手（やパーティメンバー）も同時に挑戦しています。\n先に正解した1人だけがコマンドを選べます。\n自分が正解できなかった場合や、相手が先に正解した場合は、その人がコマンドを選び終えるまで少し待ちましょう。次の問題が届くと、また回答できるようになります。'
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
