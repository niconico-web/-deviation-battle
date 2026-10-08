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
        // ★ 新しい遊び方ガイド（シーズン制・アクション戦闘・スタンダードワールド・アクション対戦に対応）
        guide: {
            storageKey: 'sb_tutorial_guide_v2_seen',
            buttonId: 'guideBtn',
            steps: [
                { icon: '🎓', title: 'ようこそ、スクールバトルへ！',
                  body: '勉強するとキャラクターが強くなり、強くなったキャラでアクションバトルのステージに挑む——それがこのゲームの流れです。\n\n「勉強 → 強くなる → ボスに挑む → 武器を集める」を繰り返して、世界の果てを目指しましょう。\nやることは、画面左下の「📘 ビギナーミッション」が順番に教えてくれます。\nこのガイドは、右上の「❓」からいつでも見返せます。' },
                { icon: '🌍', title: 'まず、2つのワールドから選ぶ',
                  body: 'サイトを開くと、「シーズンワールド」と「スタンダードワールド」のどちらで遊ぶかを選びます。\n\n🌟 シーズンワールド：期間限定の短期決戦。レベル1・素手から始まります。\n♾️ スタンダードワールド：あなたの「永遠のキャラ」の世界。\n\nあとから右上の「🏆」ボタンでいつでも切り替えられます。' },
                { icon: '🌟', title: 'シーズンワールド',
                  body: '・新しいキャラをレベル1・素手から作り、第一〜第五世界に挑みます。\n・シーズンキャラは勉強の効率が+10%。\n・週ごとに世界と難易度が少しずつ解放されます（1〜2ヶ月）。\n・シーズンが終わると、そのキャラが「スタンダードキャラ」になります（今のスタンダードキャラは上書きされます）。' },
                { icon: '♾️', title: 'スタンダードワールド',
                  body: '・シーズンで育てたステータスを試す、永遠のエンドコンテンツです。\n・最初のボスからHPが1億を超え、制限時間は25分。仲間と協力して挑むのがおすすめです。\n・スタンダードキャラは、このワールド専用です（第一〜第五世界はシーズンキャラで遊びます）。\n・今までのデータは、そのままスタンダードキャラになります。' },
                { icon: '📖', title: '勉強でステータスを伸ばす',
                  body: '「勉強」タブでタイマーを動かすか、模擬戦闘で問題に答えると、ステータスが上がります。\n\nHP（体力）／攻撃（火力）／防御（被ダメージ軽減）／素早さ（移動）／特殊（スキル）の5つ。\n何を伸ばすかは、あなたの戦い方しだいです。' },
                { icon: '🔮', title: '「特殊」ステータスの力',
                  body: '特殊を上げると、スキルまわりが全部強くなります。\n\n・エネルギーの上限が増える\n・オリジナルスキルの火力が上がる\n・1つのスキルに入れられる「グリフ（効果）」の数が増える（3つ → 最大6つ）\n\nスキルの画面で、いまの数字を確認できます。' },
                { icon: '🎯', title: '「推奨ステータス合計」',
                  body: 'ステージごとに、遊ぶ人のステータス合計の目安が表示されます。\n敵はこの数字に合わせて強くなるので、目安に届くほど楽に戦えます。\n\n武器の攻撃力は「＋○％」で、最大でも＋30%。強さの主役は、あくまでステータス合計です。' },
                { icon: '🚪', title: 'ステージに出発',
                  body: '町の「ステージゲート」から世界とステージを選びます。難易度はノーマル／ハード／ナイトメア。\n\n「ソロ」「ランダムマッチ」「部屋を作る／参加」で、仲間と一緒にも挑めます（最大4人）。\nシーズンワールドでは、まだ解放されていない世界・難易度に🔒が付きます。' },
                { icon: '🕹️', title: '戦闘の操作',
                  body: '移動：WASD／矢印キー（スマホは画面のスティック）\n攻撃：マウスクリック or Space（長押しで連続攻撃）\nダッシュ：Shift or 右クリック（一瞬の無敵）\nスキル：Z・X・C・V\nクイズ：Tab で開閉、数字キー1〜4で回答\n\nクイズに正解するとエネルギーが溜まり、スキルが撃てます。' },
                { icon: '🗡️', title: '武器庫',
                  body: 'ステージで手に入れた武器は「武器庫」で管理します。\n\n・レア度は ノーマル→マジック→レア→エピック→レジェンド\n・ソケットにオーブをはめて強化\n・🔒ロックした武器は、売却の対象になりません\n・「🗑 一括売却」で、不要な武器をレア度ごとにまとめて売れます。' },
                { icon: '🔨', title: 'オリジナル武器を作る',
                  body: 'コインを使って、自分だけの武器を作れます。名前は自由に決められます。\n\nコインを多く使うほどレア度が上がり、レジェンドはコイン100,000が必要です。\n武器種は、解放した世界のものから選べます。特殊効果とソケットはランダムです。' },
                { icon: '💠', title: 'オーブとユニーク能力',
                  body: 'オーブを武器にはめると、ステータスボーナスが付きます。\nティア4のオーブには、「根性」「デュアルウェポン」「疾風」など20種類のユニーク能力があり、アクション戦闘でそれぞれ専用の効果を発揮します。\n\nティア5はさらに強力です。' },
                { icon: '✨', title: 'オリジナルスキル',
                  body: '「スキル」で、形・効果（グリフ）・強化を組み合わせて、自分だけのスキルを作れます。\nZ・X・C・Vの4枠にセットして、戦闘中にエネルギーを使って発動します。\n\n特殊ステータスが高いほど、グリフ枠・火力・エネルギー上限が伸びます。' },
                { icon: '👑', title: 'ゲートキーパーと新しい世界',
                  body: '世界の最終ステージを（ノーマルでもOK）クリアすると、次の世界への「門」が現れます。\n門を守る「ゲートキーパー」を倒すと、次の世界が解放されます。\n\n第四世界「機神の都」、第五世界「虚空の彼方」まで、新しい武器種が待っています。' },
                { icon: '🎁', title: 'ドロップと素材',
                  body: '敵を倒すと、武器・コイン・素材が手に入ります。ボスは良い武器を落とします。\nレジェンド武器はとても出にくく、第三世界以降のステージでしか出ません。\n\n素材は、オーブの作成などに使います。' },
                { icon: '⚔️', title: 'オンラインマッチ（アクション対戦）',
                  body: '右上の「⚔️」から、2〜4人のリアルタイム対戦に参加できます。最後まで立っていた人の勝ち（3分）。\n\nダメージはステータスに関係なく「相手の最大HPの割合」で決まるので、武器・スキル・立ち回りの勝負です。\n1人で入ると、ボットと練習できます。' },
                { icon: '✏️', title: '名前の変更とデータ保存',
                  body: '名前は、「ステータス」の画面の「✏️ 名前を変更」からいつでも変えられます。\n\nデータは「データをサーバーに保存」しておけば、プレイヤーIDで別の端末からも読み込めます。シーズンキャラとスタンダードキャラは、別々に保存されます。' },
                { icon: '🎉', title: '準備完了！',
                  body: 'まずは勉強して、第一世界の最初のステージに行ってみましょう。\n困ったら、右上の「❓」でこのガイドをもう一度どうぞ。\n\n良い冒険を！' }
            ]
        },
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
                    icon: '📦',
                    title: 'ボーナス素材も組み込める',
                    body: '「武器の素材」として使える素材を持っていれば、作成時に最大3つまでボーナス素材として組み込めます。\n組み込んだ素材は消費され、その武器にステータスボーナスが追加されます（オーブのボーナスとは別枠で加算されます）。'
                },
                {
                    icon: '📊',
                    title: '素材ごとに上がるステータスが違う',
                    body: '素材によって上がるステータス（攻撃・防御・速さ・HP・特殊）や組み合わせが異なります。\nさらに、素材のレア度が高いほどボーナスの倍率も大きくなります（レア度1で1倍、レア度4で4倍）。\n作成画面の素材名の横に、実際に付与されるボーナス％が表示されます。'
                },
                {
                    icon: '🎒',
                    title: '作った武器を装備しよう',
                    body: '作成した武器は「オリジナル武器」の一覧に追加されます。\n装備してバトルに挑み、武器ごとの必殺技や能力を試してみましょう。'
                }
            ]
        },
        material: {
            storageKey: 'sb_tutorial_material_seen',
            buttonId: 'tutorialOpenBtn-material',
            steps: [
                {
                    icon: '📦',
                    title: '素材とは？',
                    body: 'モンスターに勝利すると、そのモンスター特有の「素材」を一定確率で入手できます。\n素材には1～4のレア度があり、レア度が高いほど貴重な素材です。\n入手した素材は「ショップ」タブの「素材管理」からいつでも確認できます。'
                },
                {
                    icon: '🔮',
                    title: '使い道①：オーブ作成',
                    body: '「オーブ作成」では、素材を最大5つ選んでオーブに変換できます。\n選んだ素材の平均レア度が高いほど、高ティアのオーブができやすくなります。'
                },
                {
                    icon: '🗡️',
                    title: '使い道②：武器のボーナス素材',
                    body: '「武器の素材」として使える素材は、オリジナル武器作成時にボーナス素材として最大3つまで組み込めます。\n素材ごとに上がるステータスが異なり、レア度が高い素材ほどボーナスの倍率も大きくなります。'
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
                    body: 'オーブは武器に組み込んで使う強化アイテムです。\n組み込むと、その武器にステータスボーナス（攻撃・防御・速さ・HP・特殊のいずれか）が付与されます。\nティアは1～4まであり、ティアが高いほど強力です。'
                },
                {
                    icon: '⚔️',
                    title: '入手方法①：バトルに勝利する',
                    body: 'バトルに勝利すると、約50%の確率でオーブが直接ドロップします。\nどのティアが出るかは確率で決まり、ティア1が出やすく、ティア4は出にくいレアなオーブです。'
                },
                {
                    icon: '📖',
                    title: '入手方法②：勉強する',
                    body: '「勉強」タブで25分以上続けて勉強すると、勉強終了時に必ずオーブを1個入手できます。\nコツコツ長く勉強するほど、オーブも手に入りやすくなります。'
                },
                {
                    icon: '📦',
                    title: '入手方法③：素材から作成する',
                    body: '倒したモンスターから入手した「素材」を使ってオーブを作ることもできます。\n「素材管理」を開き、素材を最大5つ選んで「オーブ作成」を実行しましょう。\n選んだ素材のレア度が高いほど、高ティアのオーブができやすくなります。'
                },
                {
                    icon: '✨',
                    title: 'オーブ合成でアップグレード',
                    body: '「オーブ合成」では、同じティアのオーブを複数消費して、より上位のオーブに合成できます。\n・ティア1を5個 → ティア2が1個\n・ティア2を5個 → ティア3が1個\n・ティア3を10個 → ティア4が1個\n低ティアのオーブが余ったら、合成して上位を目指しましょう。'
                },
                {
                    icon: '📊',
                    title: 'ステータスボーナスの目安',
                    body: 'オーブが付与するステータスボーナス（％）は、ティアによっておおよそ次のようになっています。\n・ティア1：+5～10%\n・ティア2：+10～15%\n・ティア3：+15～20%\n・ティア4：+15～20%（さらにユニーク能力付き）\n武器作成画面では、オーブごとに実際のボーナス％が表示されるので確認してみましょう。'
                },
                {
                    icon: '💎',
                    title: 'ティア4限定のユニーク能力',
                    body: 'ティア4のオーブだけ、ステータスボーナスに加えて特殊な「ユニーク能力」が1つランダムで付きます。\n例：攻撃時にHPを吸収する「ライフドレイン」、相手の防御を無視しやすくなる「貫通」、受けるダメージを半減する「鉄壁」、2つの武器種の特性を併せ持てる「デュアルウェポン」など。\nどんな能力が付くかは作成してみるまでのお楽しみです。'
                },
                {
                    icon: '🗡️',
                    title: '武器に組み込もう',
                    body: '入手・合成したオーブは、「オリジナル武器作成」画面で武器に組み込んで使います。\n組み込んだオーブはその場で消費されるので、強力なオーブほど、こだわりの武器のために取っておくのもおすすめです。'
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
                    icon: '⚔️',
                    title: 'アクション対戦',
                    body: 'オンラインマッチは、2〜4人のリアルタイムのアクション対戦です。最後まで立っていた人の勝ち（制限時間3分）。\nダメージはステータスに関係なく「相手の最大HPの割合」で決まるので、武器・スキル・立ち回りの勝負になります。'
                },
                {
                    icon: '🌐',
                    title: 'ランダムマッチ・ルームマッチ',
                    body: '「ランダムマッチ」は誰かとすぐに対戦できます。\n「ルーム作成」「ルーム参加」はルームコードを使って、友達など特定の相手と対戦できます。\n勝てばコイン+400、負けても+120です。'
                },
                {
                    icon: '🤖',
                    title: 'ボットで練習',
                    body: '「ボットと対戦」を押すか、1人で出発すると、スパーリングボットと練習できます。\n操作はステージと同じ（WASD移動・クリック攻撃・Shiftダッシュ・Z/X/C/Vスキル）です。'
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

        // 初回訪問時は、まず新しい遊び方ガイドを表示する（見終わったら、キャラクター作成の説明は「ステータス」を開いたときに出る）
        // （遊び方ガイドの自動表示はしない。最初は画面左下の「ビギナーミッション」が案内する。ガイドは右上の「❓」からいつでも読める）
        if (!isSeen('character')) {
            setTimeout(() => openTutorial('character'), 300);
        }
    });
})();
