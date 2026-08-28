/**
 * メイン画面（index.html）向けの「遊び方」チュートリアル。
 * キャラクター作成・武器作成・オーブ・スキルの4トピックを、
 * 共通の1つのモーダル（#tutorial-overlay）を使い回して表示する。
 * 各トピックは、対応するセクションを初めて開いたときに自動表示され、
 * 各見出しの「?」ボタンからいつでも見返せる。
 */
(function () {
    'use strict';

    const TOPICS = {
        character: {
            storageKey: 'sb_tutorial_character_seen',
            buttonId: 'tutorialOpenBtn-character',
            steps: [
                {
                    icon: '🧑‍🎓',
                    title: 'キャラクターを作ろう',
                    body: 'まずは「ステータス」タブで、あなただけのキャラクターを作成します。\n名前を入力し、ステータスを配分しましょう。'
                },
                {
                    icon: '📊',
                    title: 'ステータス配分',
                    body: 'HP・攻撃・防御・速さ・特殊の5つのステータスに、持ち点250ポイントを自由に配分します。\n各ステータスは最低10ポイント必要です。\n学年も設定でき、出題される問題の難易度に影響します。'
                },
                {
                    icon: '🔒',
                    title: '作成すると固定される',
                    body: '「キャラクター作成」ボタンを押すと、そのステータスで確定します。\n以降は「勉強」タブで勉強することで経験値と一緒にステータスを伸ばしていけます。'
                },
                {
                    icon: '💾',
                    title: 'プレイヤーIDを控えておこう',
                    body: 'キャラクター作成後、6文字のプレイヤーIDが発行されます。\n「データをサーバーに保存」しておけば、別の端末でもそのIDでデータを読み込めます。'
                }
            ]
        },
        weapon: {
            storageKey: 'sb_tutorial_weapon_seen',
            buttonId: 'tutorialOpenBtn-weapon',
            steps: [
                {
                    icon: '🗡️',
                    title: 'オリジナル武器を作ろう',
                    body: 'ショップの「オリジナル武器作成」から、自分だけの武器を作成できます。\n武器名・武器種（片手剣、大剣、杖など）・必殺技名を決めましょう。\n作成にはコインが必要です。'
                },
                {
                    icon: '🔮',
                    title: 'オーブを組み込める',
                    body: '所持しているオーブがあれば、作成時に一緒に組み込めます。\n組み込んだオーブは消費され、その武器にステータスボーナスや特殊なユニーク能力を付与します。'
                },
                {
                    icon: '⚔️',
                    title: 'デュアルウェポン',
                    body: '「デュアルウェポン」の能力を持つオーブを組み込むと、サブの武器種も選べるようになり、2つの武器種の特徴を併せ持つ武器が作れます。'
                },
                {
                    icon: '🎒',
                    title: '作った武器を装備しよう',
                    body: '作成した武器は「オリジナル武器」の一覧に追加されます。\n装備してバトルに挑み、武器ごとの必殺技や能力を試してみましょう。'
                }
            ]
        },
        orb: {
            storageKey: 'sb_tutorial_orb_seen',
            buttonId: 'tutorialOpenBtn-orb',
            steps: [
                {
                    icon: '🧪',
                    title: 'オーブとは？',
                    body: 'オーブは武器に組み込むことでステータスボーナスや特殊な能力を付与できるアイテムです。\n素材から作成したり、低ティアのオーブを合成して作ります。'
                },
                {
                    icon: '📦',
                    title: '素材からオーブを作成',
                    body: '「素材管理」を開くと、モンスターから入手した素材の一覧を確認できます。\n素材を最大5つ選んで「オーブ作成」を行うと、選んだ素材のレア度に応じたティアのオーブができます。\nレア度の高い素材を組み合わせるほど、高ティアのオーブができやすくなります。'
                },
                {
                    icon: '✨',
                    title: 'オーブ合成',
                    body: '「オーブ合成」では、同じティアのオーブを複数個消費して、より上位のティアのオーブに合成できます。\nティア1を5個でティア2に、ティア2を5個でティア3に、ティア3を10個でティア4に合成できます。'
                },
                {
                    icon: '🗡️',
                    title: '武器に組み込もう',
                    body: '作成・合成したオーブは、オリジナル武器の作成時に組み込んで使います。\nオーブは武器作成時に消費されるので、強力なオーブは特別な武器のために取っておくのもおすすめです。'
                }
            ]
        },
        skill: {
            storageKey: 'sb_tutorial_skill_seen',
            buttonId: 'tutorialOpenBtn-skill',
            steps: [
                {
                    icon: '🌳',
                    title: 'スキルツリー',
                    body: 'レベルアップすると「スキルポイント」がもらえます。\n「スキルツリー」タブでポイントを消費してノードを解放し、キャラクターを永続的に強化していきましょう。'
                },
                {
                    icon: '🎯',
                    title: 'アクティブスキルの装備',
                    body: '「装備中スキル」タブでは、バトル中に使えるアクティブスキルをスロットにセットできます。\n問題が出題されてから数秒間だけスキルボタンが使えるので、タイミングを見て発動しましょう。'
                },
                {
                    icon: '📝',
                    title: 'オリジナルスキル作成',
                    body: '「カスタムスキル」タブでは、名前と内容を自由に決めて自分だけのオリジナルスキルを作成できます。\n自分の戦い方をイメージしながら、オリジナルの一枠を作ってみましょう。'
                }
            ]
        },
        study: {
            storageKey: 'sb_tutorial_study_seen',
            buttonId: 'tutorialOpenBtn-study',
            steps: [
                {
                    icon: '📖',
                    title: '勉強でステータスを伸ばそう',
                    body: 'キャラクター作成後は、ここで勉強することでステータスを伸ばしていきます。\n伸ばしたいステータスに対応する科目を選んで「勉強開始」を押しましょう。'
                },
                {
                    icon: '⏱️',
                    title: '勉強時間と経験値',
                    body: '勉強時間が長いほど経験値がたまり、1分ごとに選んだ科目に対応するステータスが1ポイント上昇します。\n「勉強終了」を押すまで継続します。'
                }
            ]
        },
        missions: {
            storageKey: 'sb_tutorial_missions_seen',
            buttonId: 'tutorialOpenBtn-missions',
            steps: [
                {
                    icon: '🎯',
                    title: 'デイリーミッション',
                    body: '毎日決まったミッションが用意されます。\n条件を満たすとミッションが達成扱いになり、報酬を受け取れます。\nミッションは日付が変わるとリセットされます。'
                },
                {
                    icon: '🏅',
                    title: '最終報酬',
                    body: 'その日のミッションを全て達成して報酬を受け取ると、まとめて「最終報酬」も受け取れます。\n毎日コツコツこなして、素材やオーブを手に入れましょう。'
                }
            ]
        },
        online: {
            storageKey: 'sb_tutorial_online_seen',
            buttonId: 'tutorialOpenBtn-online',
            steps: [
                {
                    icon: '🔰',
                    title: 'まずは練習から',
                    body: '初めての方は、ページ上部の「スライムと実戦形式で練習する」から始めるのがおすすめです。\n実際のバトル画面で、操作方法を教わりながら練習できます。'
                },
                {
                    icon: '🌐',
                    title: 'ランダムマッチ・ルームマッチ',
                    body: '「ランダムマッチ」は誰かとすぐに対戦できます。\n「ルームマッチ」はルームコードを使って、友達など特定の相手と対戦できます。\n「セーフモード」を有効にすると、負けても武器を奪われません。'
                },
                {
                    icon: '🤖',
                    title: 'ボットバトル',
                    body: '対戦相手のモンスターを選んで、一人でいつでも練習できます。\n「おまかせ」を選ぶとランダムなモンスターと対戦します。'
                },
                {
                    icon: '🎉',
                    title: 'パーティ',
                    body: '「パーティ作成」または「パーティ参加」で仲間を集めて、みんなでボスバトルに挑戦できます。\n全員が「準備OK」を押すと開始できます。'
                }
            ]
        },
        boss: {
            storageKey: 'sb_tutorial_boss_seen',
            buttonId: 'tutorialOpenBtn-boss',
            steps: [
                {
                    icon: '👹',
                    title: 'ボスバトルとは',
                    body: '通常のバトルより手強いボスに挑戦するモードです。\nボスと難易度（イージー・ノーマル・ハード）を選んで挑戦しましょう。'
                },
                {
                    icon: '🧍',
                    title: 'ソロ／パーティで挑戦',
                    body: '一人で挑む「ソロ」と、オンラインのパーティタブで仲間を集めてから挑む「パーティ」の2つの挑戦方法があります。\nパーティ戦では、問題に最初に正解した1人だけがコマンドを選べます。'
                }
            ]
        },
        ranking: {
            storageKey: 'sb_tutorial_ranking_seen',
            buttonId: 'tutorialOpenBtn-ranking',
            steps: [
                {
                    icon: '🏆',
                    title: '戦力ランキング',
                    body: 'プレイヤーの総合的な戦力をランキング形式で確認できます。\n「ランキング更新」を押すと最新の順位を取得できます。\nステータスや武器・スキルを強化して、上位を目指しましょう。'
                }
            ]
        },
        guild: {
            storageKey: 'sb_tutorial_guild_seen',
            buttonId: 'tutorialOpenBtn-guild',
            steps: [
                {
                    icon: '🏰',
                    title: 'ギルドに参加しよう',
                    body: '「ギルドを作成」で新しいギルドを作るか、「ギルド一覧を見る」から既存のギルドに参加できます。\nギルドに入ると、マイギルド欄で詳細を確認できます。'
                },
                {
                    icon: '🚪',
                    title: 'ギルドを抜ける',
                    body: '合わないと感じたら、マイギルド欄の「ギルドを脱退」からいつでも抜けられます。\n別のギルドに参加し直すこともできます。'
                }
            ]
        }
    };

    // セクション（data-section）から、そのセクションを開いたときに
    // 自動表示すべきトピックへの対応。1つのセクションに複数トピックがある
    // 場合（ショップ＝武器・オーブ）は、自動表示は最初の1つだけに絞る。
    const SECTION_AUTO_TOPIC = {
        stats: 'character',
        study: 'study',
        missions: 'missions',
        shop: 'weapon',
        skills: 'skill',
        online: 'online',
        'boss-battle': 'boss',
        ranking: 'ranking',
        guild: 'guild'
    };

    let currentTopicKey = null;
    let currentStep = 0;

    function isSeen(topicKey) {
        try {
            return localStorage.getItem(TOPICS[topicKey].storageKey) === 'true';
        } catch (e) {
            return false;
        }
    }

    function markSeen(topicKey) {
        try {
            localStorage.setItem(TOPICS[topicKey].storageKey, 'true');
        } catch (e) {
            // localStorageが使えなくても致命的にはしない
        }
    }

    function renderStep() {
        const topic = TOPICS[currentTopicKey];
        if (!topic) return;
        const step = topic.steps[currentStep];

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
        topic.steps.forEach((_, index) => {
            const dot = document.createElement('span');
            dot.className = 'dot' + (index === currentStep ? ' active' : '');
            dotsEl.appendChild(dot);
        });

        prevBtn.disabled = currentStep === 0;
        nextBtn.textContent = (currentStep === topic.steps.length - 1) ? 'はじめる' : '次へ';
    }

    function openTutorial(topicKey) {
        if (!TOPICS[topicKey]) return;
        currentTopicKey = topicKey;
        currentStep = 0;
        renderStep();
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    function closeTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.style.display = 'none';
        if (currentTopicKey) markSeen(currentTopicKey);
        currentTopicKey = null;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const overlay = document.getElementById('tutorial-overlay');
        if (!overlay) return; // このページにチュートリアルUIが無い場合は何もしない

        const skipBtn = document.getElementById('tutorialSkipBtn');
        const prevBtn = document.getElementById('tutorialPrevBtn');
        const nextBtn = document.getElementById('tutorialNextBtn');

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
            const topic = TOPICS[currentTopicKey];
            if (!topic) return;
            if (currentStep < topic.steps.length - 1) {
                currentStep++;
                renderStep();
            } else {
                closeTutorial();
            }
        });

        // 各見出しの「?」ボタン
        Object.keys(TOPICS).forEach((topicKey) => {
            const btn = document.getElementById(TOPICS[topicKey].buttonId);
            btn?.addEventListener('click', () => openTutorial(topicKey));
        });

        // 各セクションを初めて開いたときに、対応するチュートリアルを自動表示する
        document.querySelectorAll('.menu-btn').forEach((menuBtn) => {
            menuBtn.addEventListener('click', () => {
                const section = menuBtn.dataset.section;
                const topicKey = SECTION_AUTO_TOPIC[section];
                if (topicKey && !isSeen(topicKey)) {
                    // 他のUI初期化とタイミングが重ならないよう少し遅らせる
                    setTimeout(() => openTutorial(topicKey), 200);
                }
            });
        });

        // 「ステータス」タブは最初から開いているため、初回訪問時はページ読み込み時に表示する
        if (!isSeen('character')) {
            setTimeout(() => openTutorial('character'), 300);
        }
    });
})();
