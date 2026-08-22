// ============================================
// 武器システム
// ============================================

// 禁止ワードリスト（差別用語、暴言、下ネタなど）
const BANNED_WORDS = [
    // 差別用語
    "ニガー", "nigger", "nigga", "negro", "にがー", "ニガー", "ニガァ", "にがぁ",
    "イエローモンキー", "yellowmonkey", "yellow monkey", "いえろーもんきー", "イエローモンキー",
    "ジャップ", "jap", "じゃっぷ", "ジャップ",
    "チンク", "chink", "ちんく", "チンク",
    "ゴック", "gook", "ごっく", "ゴック",
    "外人", "gaijin", "がいじん", "ガイジン",
    "土人", "dojin", "どじん", "ドジン",
    "原住民", "げんじゅうみん", "ゲンジュウミン",
    "野蛮人", "やばんじん", "ヤバンジン",
    "未開人", "みかいじん", "ミカイジン",
    "劣等人種", "れっとうじんしゅ", "レットウジンシュ",
    "優生学", "ゆうせいがく", "ユウセイガク",
    "民族浄化", "みんぞくじょうか", "ミンゾクジョウカ",
    "ホロコースト", "holocaust", "ほろこーすと", "ホロコースト",
    
    // 暴言・脅迫
    "死ね", "shine", "しね", "シネ", "死ねぇ", "しねぇ",
    "殺す", "korosu", "kill", "ころす", "コロス", "殺すぞ", "ころすぞ", "コロスゾ",
    "消えろ", "kiero", "きえろ", "キエロ",
    "失せろ", "usero", "うせろ", "ウセロ",
    "氏ね", "shine", "しね", "シネ",
    "自殺", "jisatsu", "suicide", "じさつ", "ジサツ", "自殺しろ", "じさつしろ", "ジサツシロ",
    "死にたい", "しにたい", "シニタイ",
    "お前ら死ね", "おまらしね", "オマラシネ",
    "お前ら消えろ", "おまらきえろ", "オマラキエロ",
    "うざい", "uzai", "annoying", "うざい", "ウザイ", "うざいんだよ", "ウザインダヨ",
    "うっせぇ", "うっせえ", "ウッセェ",
    "キモい", "kimoii", "gross", "きもい", "キモイ", "キモいんだよ", "キモインダヨ",
    "気持ち悪い", "きもちわるい", "キモチワルイ",
    "キショい", "きしょい", "キショイ", "キショいんだよ", "キショインダヨ",
    "汚い", "kitanai", "きたない", "キタナイ",
    "デブ", "debu", "fat", "でぶ", "デブ", "デブ野郎", "でぶやろう", "デブヤロウ",
    "ブス", "busu", "ugly", "ぶす", "ブス", "ブス野郎", "ぶすやろう", "ブスヤロウ",
    "ブス女", "ぶすおんな", "ブスオンナ",
    "ブス男", "ぶすおとこ", "ブスオトコ",
    "障害", "shougai", "しょうがい", "ショウガイ",
    "障害者", "しょうがいしゃ", "ショウガイシャ",
    "カス", "kasu", "trash", "かす", "カス", "カス野郎", "かすやろう", "カスヤロウ",
    "クズ", "kuzu", "scum", "くず", "クズ", "クズ野郎", "くずやろう", "クズヤロウ",
    "ゴミ", "gomi", "garbage", "ごみ", "ゴミ", "ゴミ野郎", "ごみやろう", "ゴミヤロウ",
    "虫けら", "むしけら", "ムシケラ",
    "害虫", "がいちゅう", "ガイチュウ", "害虫野郎", "がいちゅうやろう", "ガイチュウヤロウ",
    "豚野郎", "ぶたやろう", "ブタヤロウ", "豚", "ぶた", "ブタ",
    "猿野郎", "さるやろう", "サルヤロウ", "猿", "さる", "サル",
    "犬野郎", "いぬやろう", "イヌヤロウ", "犬", "いぬ", "イヌ",
    "畜生", "ちくしょう", "チクショウ", "畜生",
    "チクショー", "ちくしょう", "チクショウ", "チッ",
    "糞", "kuso", "shit", "くそ", "クソ", "クソ野郎", "くそやろう", "クソヤロウ",
    "ファック", "fuck", "ふぁっく", "ファック",
    "ファッキング", "fucking", "ふぁっきんぐ", "ファッキング",
    "アホ", "aho", "あほ", "アホ", "アホ野郎", "あほやろう", "アホヤロウ",
    "バカ", "baka", "ばか", "バカ", "バカ野郎", "ばかやろう", "バカヤロウ",
    "馬鹿", "ばか", "バカ", "馬鹿野郎", "ばかやろう", "バカヤロウ",
    "阿呆", "あほう", "アホウ", "阿呆野郎", "あほうやろう", "アホウヤロウ",
    "タコ", "tako", "たこ", "タコ", "タコ野郎", "たこやろう", "タコヤロウ",
    "ヘイタイ", "へいたい", "ヘイタイ", "ヘイタイ野郎", "へいたいやろう", "ヘイタイヤロウ",
    "デタラメ", "でたらめ", "デタラメ",
    "適当", "てきとう", "テキトウ", "適当野郎", "てきとうやろう", "テキトウヤロウ",
    "無能", "むのう", "ムノウ", "無能野郎", "むのうやろう", "ムノウヤロウ",
    "能なし", "のうなし", "ノウナシ", "能なしだよ", "のうなしだよ", "ノウナシダヨ",
    "役立たず", "やくたたず", "ヤクタタズ", "役立たず野郎", "やくたたずやろう", "ヤクタタズヤロウ",
    "無駄飯食らい", "むだめしくらい", "ムダメシクライ",
    "社会的に死ぬ", "しゃかいてきにしぬ", "シャカイテキニシヌ",
    "社会的死刑", "しゃかいてきしけい", "シャカイテキシケイ",
    "炎上", "えんじょう", "エンジョウ", "炎上しろ", "えんじょうしろ", "エンジョウシロ",
    "晒し上げ", "さらしあげ", "サラシアゲ",
    "晒し", "さらし", "サラシ",
    "人権", "じんけん", "ジンケン", "人権ない", "じんけんない", "ジンケンナイ",
    "人権なし", "じんけんなし", "ジンケンナシ",
    "人権侵害", "じんけんしんがい", "ジンケンシンガイ",
    "誹謗中傷", "ひぼうちゅうしょう", "ヒボウチュウショウ",
    "中傷", "ちゅうしょう", "チュウショウ",
    "脅迫", "きょうはく", "キョウハク",
    "ストーカー", "stalker", "すとーかー", "ストーカー野郎", "すとーかーやろう", "ストーカーヤロウ",
    "ガイジ", "gaiji", "がいじ", "ガイジ", "ガイジ野郎", "がいじやろう", "ガイジヤロウ",
    
    // 下ネタ・性的表現
    "ちんこ", "chinko", "ちんこ", "チンコ", "ちんちん", "chinchin", "チンチン",
    "ちんぽ", "chinpo", "ちんぽ", "チンポ",
    "ペニス", "penis", "ぺにす", "ペニス",
    "まんこ", "manko", "まんこ", "マンコ", "おまんこ", "omanko", "おまんこ", "オマンコ",
    "膣", "ちつ", "チツ",
    "性器", "せいき", "セイキ", "性器野郎", "せいきやろう", "セイキヤロウ",
    "セックス", "sex", "せっくす", "セックス",
    "エロ", "ero", "えろ", "エロ", "エロい", "えろい", "エロイ", "エロ野郎", "えろやろう", "エロヤロウ",
    "ポルノ", "porno", "ぽるの", "ポルノ",
    "アダルト", "adult", "あだると", "アダルト",
    "AV", "えーぶい", "エービー",
    "エロ動画", "えろどうが", "エロドウガ",
    "ポルノ動画", "ぽるのどうが", "ポルノドウガ",
    "痴漢", "chikan", "ちかん", "チカン", "痴漢野郎", "ちかんやろう", "チカンヤロウ",
    "盗撮", "とうさつ", "トウサツ", "盗撮野郎", "とうさつやろう", "トウサツヤロウ",
    "レイプ", "rape", "れいぷ", "レイプ",
    "強姦", "ごうかん", "ゴウカン", "強姦野郎", "ごうかんやろう", "ゴウカンヤロウ",
    "性的暴行", "せいてきぼうこう", "セイテキボウコウ",
    "セクハラ", "せくはら", "セクハラ", "セクハラ野郎", "せくはらやろう", "セクハラヤロウ",
    "フェラ", "fera", "ふぇら", "フェラ",
    "フェラチオ", "ふぉらちお", "フェラチオ",
    "クンニ", "くんに", "クンニ",
    "クンニリングス", "くんにりんぐす", "クンニリングス",
    "精液", "せいえき", "セイエキ",
    "ザーメン", "ざーめん", "ザーメン",
    "射精", "しゃせい", "シャセイ",
    "オナニー", "onani", "おなにー", "オナニー", "オナニー野郎", "おなにーやろう", "オナニーヤロウ",
    "自慰", "じい", "ジイ",
    "自慰行為", "じいこうい", "ジイコウイ",
    "手淫", "しゅいん", "シュイン",
    "指淫", "しいん", "シイン",
    "交尾", "こうび", "コウビ",
    "性交", "せいこう", "セイコウ",
    "コンドーム", "こんどーむ", "コンドーム",
    "避妊", "ひにん", "ヒニン",
    "中出し", "なかだし", "ナカダシ",
    "孕ませ", "はらませ", "ハラマセ",
    "孕む", "はらむ", "ハラム",
    "妊娠", "にんしん", "ニンシン",
    "堕胎", "だたい", "ダタイ",
    "中絶", "ちゅうぜつ", "チュウゼツ",
    "売春", "ばいしゅん", "バイシュン",
    "売春婦", "ばいしゅんふ", "バイシュンフ",
    "ソープ", "そーぷ", "ソープ",
    "風俗", "ふうぞく", "フウゾク",
    "デリヘル", "でりへる", "デリヘル",
    "ヘルス", "へるす", "ヘルス",
    "イメクラ", "いめくら", "イメクラ",
    "性感マッサージ", "かんせいまっさーじ", "カンセイマッサージ",
    "モーション", "もーしょん", "モーション",
    "本番", "ほんばん", "ホンバン",
    "生", "なま", "ナマ",
    "生姦", "なまかん", "ナマカン",
    "無修正", "むしゅうせい", "ムシュウセイ", "無修正野郎", "むしゅうせいやろう", "ムシュウセイヤロウ",
    "裏", "うら", "ウラ",
    "裏ビデオ", "うらびでお", "ウラビデオ",
    "裏画像", "うらがぞう", "ウラガゾウ",
    "エロ画像", "えろがぞう", "エロガゾウ",
    "エロビデオ", "えろびでお", "エロビデオ",
    "エロ漫画", "えろまんが", "エロマンガ",
    "エロ小説", "えろしょうせつ", "エロショウセツ",
    "官能小説", "かんのうしょうせつ", "カンノウショウセツ",
    "ポルノ雑誌", "ぽるのざっし", "ポルノザッシ",
    "エロ雑誌", "えろざっし", "エロザッシ",
    "ヌード", "ぬーど", "ヌード",
    "全裸", "ぜんら", "ゼンラ",
    "裸", "はだか", "ハダカ",
    "裸体", "らたい", "ラタイ",
    "脱衣", "だつい", "ダツイ", "脱衣野郎", "だついやろう", "ダツイヤロウ",
    "下着", "したぎ", "シタギ", "下着泥棒", "したぎどろぼう", "シタギドロボウ",
    "ブラ", "ぶら", "ブラ",
    "ブラジャー", "ぶらじゃー", "ブラジャー",
    "パンティ", "ぱんてぃ", "パンティ",
    "パンツ", "ぱんつ", "パンツ",
    "ショーツ", "しょーつ", "ショーツ",
    "ブラパン", "ぶらぱん", "ブラパン",
    "ランジェリー", "らんじぇりー", "ランジェリー",
    "水着", "みずぎ", "ミズギ",
    "ビキニ", "びきに", "ビキニ",
    "微乳", "びにゅう", "ビニュウ",
    "貧乳", "ひんにゅう", "ヒンニュウ",
    "爆乳", "ばくにゅう", "バクニュウ",
    "巨乳", "きょにゅう", "キョニュウ",
    "おっぱい", "oppai", "おっぱい", "オッパイ",
    "胸", "むね", "ムネ",
    "お尻", "oshiri", "おしり", "オシリ",
    "尻", "しり", "シリ",
    "ケツ", "けつ", "ケツ",
    "アナル", "あなる", "アナル",
    "肛門", "こうもん", "コウモン",
    "尻穴", "しりあな", "シリアナ",
    "ケツ穴", "けつあな", "ケツアナ",
    "アナルセックス", "あなるせっくす", "アナルセックス",
    "尻フェチ", "しりふぇち", "シリフェチ",
    "スカトロ", "すかとろ", "スカトロ",
    "スカトロジー", "すかとろじー", "スカトロジー",
    "排泄", "はいせつ", "ハイセツ",
    "排泄物", "はいせつぶつ", "ハイセツブツ",
    "糞便", "ふんべん", "フンベン",
    "尿", "にょう", "ニョウ",
    "小便", "しょうべん", "ショウベン",
    "大便", "だいべん", "ダイベン",
    "おしっこ", "おしっこ", "オシッコ",
    "うんち", "うんち", "ウンチ",
    "便所", "べんじょ", "ベンジョ", "便所野郎", "べんじょやろう", "ベンジョヤロウ",
    "トイレ", "といれ", "トイレ", "トイレ野郎", "といれやろう", "トイレヤロウ",
    "小便野郎", "しょうべんやろう", "ショウベンヤロウ",
    "大便野郎", "だいべんやろう", "ダイベンヤロウ",
    
    // その他不快な言葉
    "テロ", "terror", "てろ", "テロ",
    "テロリスト", "terrorist", "てろりすと", "テロリスト",
    "爆弾", "ばくだん", "バクダン",
    "爆撃", "ばくげき", "バクゲキ",
    "殺戮", "さつりく", "サツリク",
    "虐殺", "ぎゃくさつ", "ギャクサツ",
    "大量殺人", "たいりょうさつじん", "タイリョウサツジン",
    "連続殺人", "れんぞくさつじん", "レンゾクサツジン",
    "殺人鬼", "さつじんき", "サツジンキ",
    "狂人", "きょうじん", "キョウジン",
    "精神病", "せいしつびょう", "セイシツビョウ",
    "精神異常", "せいしんいじょう", "セイシンイジョウ",
    "頭おかしい", "あたまおかしい", "アタマオカシイ",
    "頭悪い", "あたまわるい", "アタマワルイ",
    "頭大丈夫", "あたまだいじょうぶ", "アタマダイジョウブ",
    "頭壊れてる", "あたまこわれてる", "アタマコワレテル",
    "脳みそ", "のうみそ", "ノウミソ",
    "脳みそない", "のうみそない", "ノウミソナイ",
    "脳みそ腐ってる", "のうみそくさってる", "ノウミソクサッテル",
    "脳みそ大丈夫", "のうみそだいじょうぶ", "ノウミソダイジョウブ",
    "知的障害", "ちてきしょうがい", "チテキショウガイ",
    "知的障害者", "ちてきしょうがいしゃ", "チテキショウガイシャ",
    "精神障害", "せいしんしょうがい", "セイシンショウガイ",
    "精神障害者", "せいしんしょうがいしゃ", "セイシンショウガイシャ",
    "発達障害", "はったつしょうがい", "ハッタツショウガイ",
    "発達障害者", "はったつしょうがいしゃ", "ハッタツショウガイシャ",
    "自閉症", "じへいしょう", "ジヘイショウ", "自閉症野郎", "じへいしょうやろう", "ジヘイショウヤロウ",
    "アスペルガー", "あすぺるがー", "アスペルガー","アスペ","あすぺ",
    "ADHD", "えーでぃえいちでぃ", "ADHD",
    "障害を持つ", "しょうがいをもつ", "ショウガイオモツ",
    "障害児", "しょうがいじ", "ショウガイジ", "障害児野郎", "しょうがいじやろう", "ショウガイジヤロウ",
    "身体障害", "しんたいしょうがい", "シンタイショウガイ",
    "身体障害者", "しんたいしょうがいしゃ", "シンタイショウガイシャ", "身体障害者野郎", "しんたいしょうがいしゃやろう", "シンタイショウガイシャヤロウ",
    "車椅子", "くるまいす", "クルマイス", "車椅子野郎", "くるまいすやろう", "クルマイスヤロウ",
    "盲人", "もうじん", "モウジン", "盲人野郎", "もうじんやろう", "モウジンヤロウ",
    "聾者", "ろうしゃ", "ロウシャ", "聾者野郎", "ろうしゃやろう", "ロウシャヤロウ",
    "唖者", "あしゃ", "アシャ", "唖者野郎", "あしゃやろう", "アシャヤロウ",
    
    // 英語の不快な言葉
    "bitch",
    "bastard",
    "asshole",
    "dick",
    "pussy",
    "cunt",
    "whore",
    "slut",
    "faggot",
    "retard",
    "idiot",
    "stupid",
    "dumb",
    "moron",
    "imbecile",
    "loser",
    "hater",
    "troll",
    "douche",
    "douchebag",
    "jackass",
    "dumbass",
    "shithead",
    "dickhead",
    "prick",
    "cock",
    "cock sucker",
    "motherfucker",
    "son of a bitch",
    "wanker",
    "twat",
    "arse",
    "arsehole",
    "bullshit",
    "crap",
    "damn",
    "hell",
    "suck",
    "sucks",
    "blowjob",
    "blow job",
    "handjob",
    "hand job",
    "boobs",
    "tits",
    "titties",
    "ass",
    "butt",
    "butthole",
    "rape",
    "molest",
    "molester",
    "pedophile",
    "necrophilia",
    "bestiality",
    "incest",
    "orgy",
    "prostitute",
    "hooker",
    "stripper",
    "pimp",
    "drug",
    "drugs",
    "cocaine",
    "heroin",
    "meth",
    "marijuana",
    "weed",
    "lsd",
    "ecstasy",
    "overdose",
    "suicide",
    "murder",
    "kill",
    "die",
    "death",
    "dead",
    "torture",
    "abuse",
    "abusive",
    "violence",
    "violent",
    "hate",
    "hateful",
    "racist",
    "racism",
    "discrimination",
    "nazi",
    "hitler",
    "kkk",
    "isis",
    "al qaeda",
    "taliban"
];

/**
 * 名前が禁止ワードを含んでいるかチェック
 * @param {string} name - チェックする名前
 * @returns {object} - { valid: boolean, reason: string }
 */
function validateName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, reason: '名前が無効です' };
    }

    const normalized = name.toLowerCase().trim();
    
    // 空文字チェック
    if (normalized.length === 0) {
        return { valid: false, reason: '名前を入力してください' };
    }

    // 長さチェック（長すぎる名前を禁止）
    if (normalized.length > 20) {
        return { valid: false, reason: '名前は20文字以内にしてください' };
    }

    // 禁止ワードチェック
    for (const bannedWord of BANNED_WORDS) {
        if (normalized.includes(bannedWord.toLowerCase())) {
            return { valid: false, reason: '不適切な言葉が含まれています' };
        }
    }

    // 禁止ワードの部分一致チェック（文字を分けて入力する回避策対策）
    const spacedName = normalized.replace(/\s+/g, '').replace(/[\s\u3000]/g, '');
    for (const bannedWord of BANNED_WORDS) {
        if (spacedName.includes(bannedWord.toLowerCase())) {
            return { valid: false, reason: '不適切な言葉が含まれています' };
        }
    }

    // 類似文字置換チェック
    const similarReplaced = normalized
        .replace(/[†‡※]/g, '')
        .replace(/[0-9]/g, '')
        .replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, '');
    
    for (const bannedWord of BANNED_WORDS) {
        if (similarReplaced.includes(bannedWord.toLowerCase())) {
            return { valid: false, reason: '不適切な言葉が含まれています' };
        }
    }

    return { valid: true, reason: '' };
}

// オリジナル武器設定
const ORIGINAL_WEAPON_COST = 30; // 作成コスト
const ORIGINAL_WEAPON_UPGRADE_COST = 3; // 強化コスト
const ORIGINAL_WEAPON_UPGRADE_INCREMENT = 0.002; // 強化ごとの倍率増加
const ORIGINAL_WEAPON_MAX_MULTIPLIER = 2.0; // 最大倍率（通常）
const ORIGINAL_WEAPON_MAX_MULTIPLIER_WITH_TIER4 = 10.0; // Tier4オーブ使用時の最大倍率
const ORIGINAL_WEAPON_BASE_MULTIPLIER = 1.05; // 基礎倍率（tier1相当）
// オリジナル武器の限界突破設定
const ORIGINAL_WEAPON_LIMIT_BREAK_COST_ORB_TIER = "tier4"; // コストとなるオーブのティア
const ORIGINAL_WEAPON_LIMIT_BREAK_INCREMENT = 0.5; // 1回あたりの上限倍率の増加量
const ORIGINAL_WEAPON_MAX_LIMIT_BREAK = 16; // 最大限界突破回数

// 必殺技システム
const ULTIMATE_GAUGE_MAX = 100; // 必殺技ゲージ最大値
const ULTIMATE_GAUGE_PER_CORRECT = 20; // 正解ごとのゲージ増加量
const ULTIMATE_DAMAGE_MULTIPLIER = 1.5; // 必殺技発動時のダメージ倍率

// ============================================
// オーブシステム
// ============================================

const ORB_TIERS = {
    tier1: { name: "Tier1", dropRate: 0.50, statRange: [0.05, 0.10] },
    tier2: { name: "Tier2", dropRate: 0.30, statRange: [0.10, 0.15] },
    tier3: { name: "Tier3", dropRate: 0.15, statRange: [0.15, 0.20] },
    tier4: { name: "Tier4", dropRate: 0.05, statRange: [0.15, 0.20] }
};

const ORB_DROP_THRESHOLD_SECONDS = 25 * 60; // 25分
const ORB_DROP_CHANCE = 0.50; // 50%（戦闘勝利時）

const ORB_UNIQUE_ABILITIES = {
    life_drain: {
        name: "ライフドレイン",
        description: "相手に攻撃したとき、その時与えたダメージの20%分自分のHPを回復できる",
        effect: "life_drain"
    },
    overwhelming_growth: {
        name: "圧倒的成長性",
        description: "勉強タイマー使用時のステータスの上り幅が2倍になる",
        effect: "double_study_growth"
    },
    re_miserable: {
        name: "リ・ミゼラブル",
        description: "戦闘時相手の全ステータスを0.8倍",
        effect: "enemy_stat_debuff"
    },
    penetration: {
        name: "貫通",
        description: "相手の防御ステータスを50%減らす",
        effect: "ignore_def_half"
    },
    iron_wall: {
        name: "鉄壁",
        description: "相手からの攻撃のダメージ50%カット",
        effect: "damage_cut_half"
    },
    sure_hit: {
        name: "必中",
        description: "相手の回避率を無視して相手に絶対攻撃をあてられる",
        effect: "ignore_evasion"
    },
    critical_hit: {
        name: "必殺",
        description: "クリティカル率が30%まで上昇する（通常は常に5%）",
        effect: "critical_damage"
    },
    guts: {
        name: '根性',
        description: '即死のダメージを食らってもHPを1残して耐えることができる。HPが１の状態では攻撃力が3倍になる。',
        effect: 'guts'
    },
    dual_weapon: {
        name: 'デュアルウェポン',
        description: 'これを使って武器を作るとき、もう一つ武器の種類を選択できる。その選んだ武器の種類のバフ、デバフの倍率がその武器に乗るようになる。（例：大剣を作成し、デュアルウェポンで双剣を選択すると、大剣に双剣のバフ・デバフ効果も付与される）',
        effect: 'dual_weapon'
    },
    one_shot_kill: {
        name: "一撃必殺",
        description: "相手を一撃で倒す。この能力は必中効果も持つ。",
        effect: "one_shot_kill"
    }
};

const ORB_STAT_TYPES = ["atk", "def", "speed", "maxHp"];

const ORB_STAT_LABELS = {
    atk: "攻撃",
    def: "防御",
    speed: "速さ",
    maxHp: "HP"
};

function createOrb(tier) {
    const tierConfig = ORB_TIERS[tier];
    if (!tierConfig) return null;
    
    const statType = ORB_STAT_TYPES[Math.floor(Math.random() * ORB_STAT_TYPES.length)];
    const minBonus = tierConfig.statRange[0];
    const maxBonus = tierConfig.statRange[1];
    const bonus = minBonus + Math.random() * (maxBonus - minBonus);
    
    const id = `orb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const orb = {
        id,
        tier,
        statType,
        bonus: Math.round(bonus * 1000) / 1000, // 小数点3桁まで
        uniqueAbility: null
    };
    
    // Tier4のみユニーク能力を付与（ボス能力を除外）
    if (tier === "tier4") {
        const abilityKeys = Object.keys(ORB_UNIQUE_ABILITIES).filter(key => !key.startsWith("boss_") && key !== "one_shot_kill");
        const abilityKey = abilityKeys[Math.floor(Math.random() * abilityKeys.length)];
        orb.uniqueAbility = {
            key: abilityKey,
            ...ORB_UNIQUE_ABILITIES[abilityKey]
        };
    }
    
    return orb;
}

function rollOrbDrop(dropChance = ORB_DROP_CHANCE) {
    if (Math.random() > dropChance) return null;
    
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [tier, config] of Object.entries(ORB_TIERS)) {
        cumulative += config.dropRate;
        if (rand < cumulative) {
            return createOrb(tier);
        }
    }
    
    return null;
}

function getOrbDisplayName(orb) {
    if (!orb) return "不明なオーブ";
    const tierName = ORB_TIERS[orb.tier]?.name || orb.tier;
    const statLabel = ORB_STAT_LABELS[orb.statType] || orb.statType;
    const bonusPercent = Math.round(orb.bonus * 100);
    
    let name = `${tierName}オーブ (${statLabel}+${bonusPercent}%)`;
    
    if (orb.uniqueAbility) {
        name += ` [${orb.uniqueAbility.name}]`;
    }
    
    return name;
}

function applyOrbToWeapon(weapon, orbs) {
    if (!weapon || !orbs || orbs.length === 0) return weapon;

    const newWeapon = { ...weapon };
    const totalBonus = {};

    // オーブの補正を集計
    for (const orb of orbs) {
        if (!totalBonus[orb.statType]) {
            totalBonus[orb.statType] = 0;
        }
        totalBonus[orb.statType] += orb.bonus;
    }

    // ステータス補正を適用（既存の補正を上書きせず、オーブの補正のみを適用）
    newWeapon.statBonuses = {}; // 新しい武器なので補正をリセット
    for (const [stat, bonus] of Object.entries(totalBonus)) {
        newWeapon.statBonuses[stat] = bonus;
    }

    // ユニーク能力を適用（Tier4オーブから）
    const uniqueAbilities = orbs
        .filter(orb => orb.uniqueAbility)
        .map(orb => orb.uniqueAbility);

    if (uniqueAbilities.length > 0) {
        newWeapon.uniqueAbilities = uniqueAbilities;
    } else {
        newWeapon.uniqueAbilities = []; // ユニーク能力をリセット
    }

    // オーブの合計倍率を計算
    let orbMultiplier = 1.0;
    for (const orb of orbs) {
        const tierMult = { tier1: 1.02, tier2: 1.05, tier3: 1.08, tier4: 1.12 }[orb.tier] || 1.0;
        orbMultiplier *= tierMult;
    }

    newWeapon.multiplier = ORIGINAL_WEAPON_BASE_MULTIPLIER * orbMultiplier; // 基礎倍率から再計算
    newWeapon.orbs = orbs.map(orb => orb.id); // 使用したオーブのIDを記録
    newWeapon.upgradeCount = 0; // 強化回数をリセット

    // Tier4オーブが使用されている場合、倍率上限を10倍に設定
    const hasTier4Orb = orbs.some(orb => orb.tier === "tier4");
    if (hasTier4Orb) {
        newWeapon.maxMultiplier = ORIGINAL_WEAPON_MAX_MULTIPLIER_WITH_TIER4;
        newWeapon.hasTier4Orb = true; // フラグを設定
    } else {
        newWeapon.maxMultiplier = ORIGINAL_WEAPON_MAX_MULTIPLIER;
        newWeapon.hasTier4Orb = false;
    }

    return newWeapon;
}

// ユニーク能力を適用したステータス計算
function applyUniqueAbilitiesToStats(baseStats, weapon, isEnemy = false) {
    if (!weapon || !weapon.uniqueAbilities) return baseStats;

    const stats = { ...baseStats };

    for (const ability of weapon.uniqueAbilities) {
        switch (ability.effect) {
            case "enemy_stat_debuff": // リ・ミゼラブル
                if (isEnemy) {
                    stats.atk = Math.floor(stats.atk * 0.8);
                    stats.def = Math.floor(stats.def * 0.8);
                    stats.speed = Math.floor(stats.speed * 0.8);
                    stats.maxHp = Math.floor(stats.maxHp * 0.8);
                }
                break;
            case "ignore_def_half": // 貫通
                if (isEnemy) {
                    stats.def = Math.floor(stats.def * 0.5);
                }
                break;
            case "boss_all_stat_boost_damage_reduction_def_break": // 深淵の守護者
                if (!isEnemy) {
                    stats.atk = Math.floor(stats.atk * 1.20);
                    stats.def = Math.floor(stats.def * 1.20);
                    stats.speed = Math.floor(stats.speed * 1.20);
                    stats.maxHp = Math.floor(stats.maxHp * 1.20);
                }
                break;
            // 他の能力はダメージ計算時に処理
        }
    }

    return stats;
}

// ユニーク abilityによるダメージ計算
function calculateDamageWithAbilities(baseDamage, attacker, defender, weapon) {
    if (!weapon || !weapon.uniqueAbilities) return baseDamage;

    let damage = baseDamage;

    for (const ability of weapon.uniqueAbilities) {
        switch (ability.effect) {
            case "critical_damage": // 必殺
                // 基礎5% + 必殺能力25% = 最大30%
                if (Math.random() < 0.30) {
                    damage = Math.floor(damage * 1.5);
                }
                break;
            case "life_drain": // ライフドレイン
                // ダメージ計算後に回復処理を行うため、ここではフラグのみ設定
                break;
            case "damage_cut_half": // 鉄壁
                // 防御側の処理
                break;
            // Boss theme abilities
            case "boss_atk_boost_multi_hit": // オーク軍団の猛攻
                damage = Math.floor(damage * 1.35); // ATK boost 35%
                if (Math.random() < 0.20) {
                    damage = Math.floor(damage * 2); // 2連撃
                }
                break;
            case "boss_poison_on_hit_strong": // 影蛇の毒牙
                if (Math.random() < 0.50) {
                    // 猛毒付与（戦闘システムで処理）
                    weapon.pendingPoison = { turns: 4, damage: 0.08 };
                }
                break;
            case "boss_burn_on_hit_strong": // 炎龍の息吹
                if (Math.random() < 0.40) {
                    // 大火傷付与（戦闘システムで処理）
                    weapon.pendingBurn = { turns: 5, damage: 0.05 };
                }
                break;
            case "boss_low_hp_atk_boost_crit": // 深淵騎士の闘気
                if (attacker && attacker.hp / attacker.maxHp <= 0.5) {
                    damage = Math.floor(damage * 1.50); // ATK boost 50%
                    if (Math.random() < 0.15) {
                        damage = Math.floor(damage * 1.5); // クリティカル率15%
                    }
                }
                break;
            case "boss_all_stat_boost_damage_reduction_def_break": // 深淵の守護者
                damage = Math.floor(damage * 1.20); // 全ステータス20%上昇
                if (Math.random() < 0.25) {
                    // 防御破壊（戦闘システムで処理）
                    weapon.pendingDefBreak = { turns: 2, reduction: 0.30 };
                }
                break;
        }
    }

    return damage;
}

// 防御側のダメージ軽減計算
function calculateDefenseWithAbilities(baseDamage, defender, weapon) {
    if (!weapon || !weapon.uniqueAbilities) return baseDamage;

    let damage = baseDamage;

    for (const ability of weapon.uniqueAbilities) {
        switch (ability.effect) {
            case "damage_cut_half": // 鉄壁
                damage = Math.floor(damage * 0.5);
                break;
            // Boss theme defensive abilities
            case "boss_damage_reduction_freeze": // 氷の巨人の鎧
                damage = Math.floor(damage * 0.70); // 30%軽減
                if (Math.random() < 0.30) {
                    // 凍結付与（戦闘システムで処理）
                    weapon.pendingFreeze = true;
                }
                break;
            case "boss_hp_regen_damage_reduction": // 天界守護者の加護
                damage = Math.floor(damage * 0.85); // 15%軽減
                // HP回復は戦闘システムのターン開始時に処理
                weapon.hasHpRegen = true;
                weapon.hpRegenAmount = 0.08;
                break;
            case "boss_all_stat_boost_damage_reduction_def_break": // 深淵の守護者
                damage = Math.floor(damage * 0.75); // 25%軽減
                break;
        }
    }

    return damage;
}

const WEAPON_TYPES = {
    sword_shield: { name: "片手剣＋盾", primary: ["def", "atk"], secondary: [], debuff: {} },
    spear:        { name: "長槍",       primary: ["atk", "speed"], secondary: [], debuff: {}, debugBonus: { bonusMult: 2.0, primary: ["atk", "speed", "def", "maxHp"] } },
    greatsword:   { name: "大剣",       primary: ["atk"], secondary: [], debuff: { def: 0.85, speed: 0.85 }, bonusMult: 1.3 },
    dual_swords:  { name: "双剣",       primary: ["speed", "atk"], secondary: [], debuff: {} },
    scythe:       { name: "鎌",         primary: ["maxHp", "atk", "def", "speed"], secondary: [], debuff: {}, bonusMult: 1.1 },
    pistol:       { name: "ピストル",   primary: ["speed","maxHp"], secondary: ["atk"], debuff: {} },
    katana:       { name: "刀",         primary: ["def", "speed"], secondary: [], debuff: {} },
    magic_wand:   { name: "魔法の杖",   primary: ["atk", "maxHp"], secondary: ["def"], debuff: { speed: 0.9 } },
    gloves:       { name: "グローブ",   primary: ["atk", "speed"], secondary: [], debuff: { def: 0.9 } },
    shoes:        { name: "シューズ",   primary: ["speed", "def"], secondary: [], debuff: { atk: 0.9 } }
};

const TIER_MULT = { tier1: 1.05, tier2: 1.12, tier3: 1.20 };
const UNIQUE_MULT = 1.65; // tier3(1.20) × 1.375 ≒ 1.65

const TIER_PRICES = { tier1: 30, tier2: 50, tier3: 100 };

const WEAPON_CATALOG = {
    sword_shield: {
        tier1: { name: "鉄の盾剣", ultimate: "シールドバッシュ" },
        tier2: { name: "騎士の盾剣", ultimate: "ホーリーガード" },
        tier3: { name: "聖騎士の盾剣", ultimate: "ディバインプロテクション" },
        unique: { name: "神盾剣ゼウス・ヘカテー", ultimate: "神々の裁き" }
    },
    spear: {
        tier1: { name: "木の槍", ultimate: "突撃" },
        tier2: { name: "鋼の長槍", ultimate: "雷撃突き" },
        tier3: { name: "ドラゴンスレイヤー", ultimate: "ドラゴンスレイヤー" },
        unique: { name: "神槍　天照", ultimate: "天照の神光" },
        debug: { name: "デバッガーランス", isDebug: true, ultimate: "デバッグ斬撃" }
    },
    greatsword: {
        tier1: { name: "錆びた大剣", ultimate: "大切断" },
        tier2: { name: "黒鉄の大剣", ultimate: "鉄斬り" },
        tier3: { name: "覇王の大剣", ultimate: "覇王斬" },
        unique: { name: "ベルゼバブ", ultimate: "地獄の業火" }
    },
    dual_swords: {
        tier1: { name: "錆びた双剣", ultimate: "双斬" },
        tier2: { name: "疾風の双剣", ultimate: "疾風双斬" },
        tier3: { name: "幻影の双剣", ultimate: "幻影乱舞" },
        unique: { name: "巨狼　オルトロス", ultimate: "双頭狼の連撃" }
    },
    scythe: {
        tier1: { name: "農夫の鎌", ultimate: "収穫" },
        tier2: { name: "死神の鎌", ultimate: "死神の鎌" },
        tier3: { name: "冥府の鎌", ultimate: "冥府への誘い" },
        unique: { name: "グリム・リーパー", ultimate: "死神の最期" }
    },
    pistol: {
        tier1: { name: "古式ピストル", ultimate: "一発" },
        tier2: { name: "連射ピストル", ultimate: "ラピッドファイア" },
        tier3: { name: "マグナム", ultimate: "マグナムバースト" },
        unique: { name: "九頭蛇　ヒュドラ", ultimate: "九頭の猛毒" }
    },
    katana: {
        tier1: { name: "錆びた刀", ultimate: "居合斬り" },
        tier2: { name: "業物", ultimate: "一閃" },
        tier3: { name: "名刀「村正」", ultimate: "妖刀の呪い" },
        unique: { name: "天雲　スサノオ", ultimate: "天叢雲剣" }
    },
    magic_wand: {
        tier1: { name: "木の杖", ultimate: "小魔法" },
        tier2: { name: "魔術師の杖", ultimate: "ファイアボール" },
        tier3: { name: "賢者の杖", ultimate: "メテオストライク" },
        unique: { name: "魔導書　グリモワール", ultimate: "禁断の魔法" }
    }
};

const DEBUG_UNIQUE_WINS = 1; // デバッグ用ユニーク武器は1勝で入手可能
const UNIQUE_QUEST_WINS = 500; // 通常のユニーク武器は500勝で入手可能

// デバッグ用: テスト用に勝利数を減らす
const TEST_UNIQUE_WINS = 3; // テスト用に3勝に設定（本番は500に戻す）
const COIN_BATTLE_WIN = 15;
// const COIN_STUDY_30MIN = 20;
const COIN_STUDY_30MIN = 20;
const STUDY_COIN_THRESHOLD = 30 * 60; // 30分

function getWeaponMultiplier(weapon) {
    if (!weapon) return 1;
    if (weapon.isOriginal) return weapon.multiplier || ORIGINAL_WEAPON_BASE_MULTIPLIER;
    if (weapon.isUnique) return UNIQUE_MULT;
    return TIER_MULT[weapon.tier] || 1;
}

function createOriginalWeapon(name, type, statBonuses, ultimateName) {
    // 武器名のバリデーション
    const validation = validateName(name);
    if (!validation.valid) {
        return { error: validation.reason };
    }

    const id = `original_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
        id,
        name: name || "オリジナル武器",
        type,
        isOriginal: true,
        multiplier: ORIGINAL_WEAPON_BASE_MULTIPLIER,
        statBonuses: statBonuses || {}, // { atk: 0.5, def: -0.3, speed: 0.2 } etc.
        upgradeCount: 0,
        ultimateName: ultimateName || null // オリジナル武器の必殺技名
    };
}

function getWeaponMaxMultiplier(weapon) {
    return (weapon && weapon.maxMultiplier != null) ? weapon.maxMultiplier : ORIGINAL_WEAPON_MAX_MULTIPLIER;
}

function getWeaponBaseMultiplierForProgress(weapon) {
    return (weapon && weapon.baseMultiplier != null) ? weapon.baseMultiplier : ORIGINAL_WEAPON_BASE_MULTIPLIER;
}

function upgradeOriginalWeapon(weapon) {
    if (!weapon.isOriginal) return weapon;
    const max = getWeaponMaxMultiplier(weapon);
    if (weapon.multiplier >= max) return weapon;

    const newMultiplier = Math.min(
        max,
        weapon.multiplier + ORIGINAL_WEAPON_UPGRADE_INCREMENT
    );

    let updated = {
        ...weapon,
        multiplier: newMultiplier,
        upgradeCount: weapon.upgradeCount + 1
    };

    // ボス武器が「4回限界突破＋上限まで強化」を満たしたら、tier4固有能力を付与する
    if (typeof checkAndGrantBossTier4Ability === "function") {
        updated = checkAndGrantBossTier4Ability(updated);
    }

    return updated;
}

function canUpgradeOriginalWeapon(weapon) {
    return weapon.isOriginal && weapon.multiplier < getWeaponMaxMultiplier(weapon);
}

function getOriginalWeaponUpgradeCost(weapon) {
    return ORIGINAL_WEAPON_UPGRADE_COST;
}

function createWeapon(type, tier, isUnique) {
    const catalog = WEAPON_CATALOG[type];
    if (!catalog) return null;
    const tierKey = isUnique ? "unique" : tier;
    const info = catalog[tierKey];
    if (!info) return null;
    return {
        id: `${type}_${tierKey}`,
        type,
        tier: isUnique ? "unique" : tier,
        name: info.name,
        isUnique: !!isUnique,
        isDebug: info.isDebug || false,
        isDebugWeapon: tierKey === "debug"
    };
}

function getAllShopWeapons() {
    const list = [];
    for (const type of Object.keys(WEAPON_TYPES)) {
        for (const tier of ["tier1", "tier2", "tier3"]) {
            list.push(createWeapon(type, tier, false));
        }
    }
    return list;
}

function applyWeaponStats(baseStats, weapon) {
    if (!weapon) return { ...baseStats };
    
    // オリジナル武器の場合
    if (weapon.isOriginal) {
        const result = { ...baseStats };
        let typeConf = WEAPON_TYPES[weapon.type];
        
        // 基本倍率を取得（武器種のbonusMultは適用しない）
        let mult = weapon.multiplier || ORIGINAL_WEAPON_BASE_MULTIPLIER;

        // デュアルウェポン能力による武器種情報のマージ
        if (weapon.uniqueAbilities && weapon.uniqueAbilities.some(a => a.effect === 'dual_weapon') && weapon.secondaryType) {
            const dualWeaponInfo = WEAPON_TYPES[weapon.secondaryType];
            if (typeConf && dualWeaponInfo) {
                // primary, secondary, debuffをマージする
                const mergedPrimary = [...new Set([...typeConf.primary, ...dualWeaponInfo.primary])];
                const mergedSecondary = [...new Set([...typeConf.secondary, ...dualWeaponInfo.secondary])];
                const mergedDebuff = {...typeConf.debuff, ...dualWeaponInfo.debuff};
                
                typeConf = {
                    ...typeConf, // bonusMultなどは元の武器種のものを維持
                    primary: mergedPrimary,
                    secondary: mergedSecondary,
                    debuff: mergedDebuff
                };
            }
        }
        
        // カスタム補正を考慮した倍率計算
        const statMultipliers = { atk: mult, def: mult, speed: mult, maxHp: mult };
        
        // カスタム補正を倍率に反映
        if (weapon.statBonuses) {
            for (const [stat, bonus] of Object.entries(weapon.statBonuses)) {
                if (statMultipliers[stat] !== undefined) {
                    statMultipliers[stat] = statMultipliers[stat] * (1 + bonus);
                }
            }
        }
        
        // 武器種の設定を適用（bonusMultを除く）
        if (typeConf) {
            // プライマリステータスに倍率適用
            for (const stat of typeConf.primary) {
                if (result[stat] !== undefined) {
                    result[stat] = Math.floor(result[stat] * statMultipliers[stat]);
                }
            }
            
            // セカンダリステータスに倍率適用（0.85倍）
            for (const stat of typeConf.secondary) {
                if (result[stat] !== undefined) {
                    result[stat] = Math.floor(result[stat] * (statMultipliers[stat] * 0.85));
                }
            }
            
            // デバフ適用
            if (typeConf.debuff) {
                for (const [stat, debuffMult] of Object.entries(typeConf.debuff)) {
                    if (result[stat] !== undefined) {
                        result[stat] = Math.floor(result[stat] * debuffMult);
                    }
                }
            }
        } else {
            // 武器種がない場合は全ステータスに基本倍率適用
            for (const stat of ['atk', 'def', 'speed', 'maxHp']) {
                if (result[stat] !== undefined) {
                    result[stat] = Math.floor(result[stat] * statMultipliers[stat]);
                }
            }
        }
        
        // 最小値を保証（最低でも基礎ステータス以上）
        for (const stat of ['atk', 'def', 'speed', 'maxHp']) {
            if (result[stat] !== undefined && result[stat] < baseStats[stat]) {
                result[stat] = baseStats[stat];
            }
        }
        
        return result;
    }
    
    const typeConf = WEAPON_TYPES[weapon.type];
    if (!typeConf) return { ...baseStats };
    
    // デバッグ武器の場合は特別ボーナスを適用
    if (weapon.isDebugWeapon && typeConf.debugBonus) {
        const result = { ...baseStats };
        const debugBonus = typeConf.debugBonus;
        const mult = debugBonus.bonusMult || 2.0;
        
        // デバッグ武器専用のプライマリステータスに倍率適用
        for (const stat of debugBonus.primary) {
            result[stat] = Math.floor(result[stat] * mult);
        }
        
        // 最小値を保証（最低でも基礎ステータス以上）
        for (const stat of ['atk', 'def', 'speed', 'maxHp']) {
            if (result[stat] !== undefined && result[stat] < baseStats[stat]) {
                result[stat] = baseStats[stat];
            }
        }
        
        return result;
    }
    
    // 基本倍率を取得（bonusMultがあれば使用、なければデフォルト倍率）
    let mult = getWeaponMultiplier(weapon);
    if (typeConf.bonusMult) {
        mult = mult * typeConf.bonusMult;
    }
    
    const result = { ...baseStats };
    
    // プライマリステータスに倍率適用
    for (const stat of typeConf.primary) {
        result[stat] = Math.floor(result[stat] * mult);
    }
    
    // セカンダリステータスに倍率適用（0.85倍）
    for (const stat of typeConf.secondary) {
        result[stat] = Math.floor(result[stat] * (mult * 0.85));
    }
    
    // デバフ適用
    if (typeConf.debuff) {
        for (const [stat, debuffMult] of Object.entries(typeConf.debuff)) {
            if (result[stat] !== undefined) {
                result[stat] = Math.floor(result[stat] * debuffMult);
            }
        }
    }
    
    // 最小値を保証（最低でも基礎ステータス以上）
    for (const stat of ['atk', 'def', 'speed', 'maxHp']) {
        if (result[stat] !== undefined && result[stat] < baseStats[stat]) {
            result[stat] = baseStats[stat];
        }
    }
    
    return result;
}

function playerOwnsWeapon(player, weaponId) {
    return (player.weapons || []).some(w => w.id === weaponId);
}

// ============================================
// デバッグ用「必中・即死」武器
// 開発中の動作確認用。ブラウザのコンソールから
// giveDebugInstantKillWeapon() を実行すると、現在のプレイヤーに
// 追加・装備される（script.js からグローバル公開）。
// ============================================

const DEBUG_INSTANT_KILL_WEAPON_ID = "debug_instant_kill_weapon";

/**
 * 必中・一撃必殺のデバッグ用武器を生成する。
 * battle.js側で weapon.debugInstantKill を見て、回避判定を無視し
 * 確実にトドメを刺す処理をしている。
 * @returns {object}
 */
function createDebugInstantKillWeapon() {
    return {
        id: DEBUG_INSTANT_KILL_WEAPON_ID,
        type: (typeof WEAPON_TYPES !== 'undefined' ? Object.keys(WEAPON_TYPES)[0] : "剣"),
        name: "【デバッグ】絶対撃破の剣",
        isOriginal: true,
        isDebugWeapon: true,
        debugInstantKill: true, // battle.js: 必中・確定撃破フラグ
        multiplier: 1,
        baseMultiplier: 1,
        maxMultiplier: 1,
        statBonuses: {},
        upgradeCount: 0,
        uniqueAbilities: [],
        ultimateName: "デバッグ・絶対撃破"
    };
}

/**
 * デバッグ用の必中即死武器を、現在のプレイヤーに追加して装備する。
 * ブラウザのコンソールから `giveDebugInstantKillWeapon()` として実行する想定。
 * @param {object} [player] - 省略時はlocalStorageから読み込む。
 * @returns {object} 更新後のプレイヤーオブジェクト。
 */
function giveDebugInstantKillWeapon(player) {
    let p = player;
    let fromLocalStorage = false;
    if (!p) {
        const raw = localStorage.getItem("player");
        if (!raw) {
            console.error("[Debug] プレイヤーデータが見つかりません。");
            return null;
        }
        p = JSON.parse(raw);
        fromLocalStorage = true;
    }

    let updated = p;
    if (!playerOwnsWeapon(updated, DEBUG_INSTANT_KILL_WEAPON_ID)) {
        updated = addWeaponToPlayer(updated, createDebugInstantKillWeapon());
    }
    const equipResult = equipWeapon(updated, DEBUG_INSTANT_KILL_WEAPON_ID);
    if (equipResult.ok) {
        updated = equipResult.player;
    }

    if (fromLocalStorage) {
        localStorage.setItem("player", JSON.stringify(updated));
        console.log("[Debug] 必中即死のデバッグ武器を装備しました。ページを再読み込みすると反映されます。");
        if (typeof updateStatus === "function") updateStatus(updated);
        if (typeof renderOriginalWeapons === "function") renderOriginalWeapons();
        if (typeof renderInventory === "function") renderInventory();
    }

    return updated;
}

// ============================================
// 素材・限界突破システム
// ============================================

function getMaterialCount(player, materialId) {
    return (player && player.materials && player.materials[materialId]) || 0;
}

function addMaterialToPlayer(player, materialId, amount = 1) {
    const materials = { ...(player.materials || {}) };
    materials[materialId] = (materials[materialId] || 0) + amount;
    return { ...player, materials };
}

/**
 * プレイヤーが作成したオリジナル武器が限界突破可能か判定する。
 * @param {object} weapon
 * @returns {boolean}
 */
function canLimitBreakOriginalWeapon(weapon) {
    // ボス武器ではなく、純粋なオリジナル武器であること
    if (!weapon || !weapon.isOriginal || weapon.sourceBossId) {
        return false;
    }
    const level = weapon.originalLimitBreakLevel || 0;
    const max = weapon.maxOriginalLimitBreak != null ? weapon.maxOriginalLimitBreak : ORIGINAL_WEAPON_MAX_LIMIT_BREAK;
    return level < max;
}

/**
 * Tier4オーブを1つ消費して、オリジナル武器の上限倍率を伸ばす。
 * @param {object} player
 * @param {string} weaponId
 * @returns {{ok:boolean, message?:string, player?:object, weapon?:object}}
 */
function limitBreakOriginalWeapon(player, weaponId) {
    const weapon = (player.weapons || []).find(w => w.id === weaponId);
    if (!weapon) {
        return { ok: false, message: "武器を所持していません" };
    }
    if (!canLimitBreakOriginalWeapon(weapon)) {
        return { ok: false, message: "この武器は限界突破できません" };
    }

    // Tier4オーブを探す
    const tier4OrbIndex = (player.orbs || []).findIndex(orb => orb.tier === ORIGINAL_WEAPON_LIMIT_BREAK_COST_ORB_TIER);
    if (tier4OrbIndex === -1) {
        return { ok: false, message: "限界突破に必要なTier4オーブを所持していません" };
    }

    // オーブを消費
    const orbs = [...player.orbs];
    orbs.splice(tier4OrbIndex, 1);

    // 武器を更新
    const updatedWeapon = {
        ...weapon,
        originalLimitBreakLevel: (weapon.originalLimitBreakLevel || 0) + 1,
        maxMultiplier: (getWeaponMaxMultiplier(weapon) || ORIGINAL_WEAPON_MAX_MULTIPLIER) + ORIGINAL_WEAPON_LIMIT_BREAK_INCREMENT,
        maxOriginalLimitBreak: weapon.maxOriginalLimitBreak != null ? weapon.maxOriginalLimitBreak : ORIGINAL_WEAPON_MAX_LIMIT_BREAK
    };

    // プレイヤーの武器リストを更新
    const weapons = player.weapons.map(w => (w.id === weaponId ? updatedWeapon : w));

    // プレイヤーオブジェクトを更新
    let updatedPlayer = { ...player, weapons, orbs };

    // 装備中の武器も更新
    if (updatedPlayer.equippedWeapon && updatedPlayer.equippedWeapon.id === weaponId) {
        updatedPlayer.equippedWeapon = updatedWeapon;
    }

    return { ok: true, player: updatedPlayer, weapon: updatedWeapon };
}

/**
 * ボス武器が限界突破可能か（上限回数に達していないか）を判定する。
 * @param {object} weapon
 * @returns {boolean}
 */
function canLimitBreakWeapon(weapon) {
    if (!weapon || !weapon.sourceBossId) return false;
    const level = weapon.limitBreakLevel || 0;
    const max = weapon.maxLimitBreak != null ? weapon.maxLimitBreak : 4;
    return level < max;
}

/**
 * 限界突破素材を1個消費して、対象武器の上限倍率を0.5伸ばす。
 * （実際の倍率を上限まで伸ばすには、別途「強化」を行う必要がある）
 * @param {object} player
 * @param {string} weaponId
 * @returns {{ok:boolean, message?:string, player?:object, weapon?:object}}
 */
function limitBreakWeapon(player, weaponId) {
    const weapon = (player.weapons || []).find(w => w.id === weaponId);
    if (!weapon) return { ok: false, message: "武器を所持していません" };
    if (!weapon.sourceBossId) return { ok: false, message: "この武器は限界突破できません" };
    if (!canLimitBreakWeapon(weapon)) return { ok: false, message: "既に限界突破の上限に達しています" };

    const materialId = getBossLimitBreakMaterialId(weapon.sourceBossId);
    const have = getMaterialCount(player, materialId);
    if (have < 1) return { ok: false, message: "限界突破素材が足りません" };

    const materials = { ...(player.materials || {}) };
    materials[materialId] = have - 1;

    let updatedWeapon = {
        ...weapon,
        limitBreakLevel: (weapon.limitBreakLevel || 0) + 1,
        maxMultiplier: getWeaponMaxMultiplier(weapon) + BOSS_WEAPON_LIMIT_BREAK_INCREMENT
    };

    // ボス武器が「4回限界突破＋上限まで強化」を満たしたら、tier4固有能力を付与する
    if (typeof checkAndGrantBossTier4Ability === "function") {
        updatedWeapon = checkAndGrantBossTier4Ability(updatedWeapon);
    }

    const weapons = player.weapons.map(w => w.id === weaponId ? updatedWeapon : w);
    let updatedPlayer = { ...player, weapons, materials };
    if (updatedPlayer.equippedWeapon && updatedPlayer.equippedWeapon.id === weaponId) {
        updatedPlayer.equippedWeapon = updatedWeapon;
    }
    return { ok: true, player: updatedPlayer, weapon: updatedWeapon };
}

function addWeaponToPlayer(player, weapon) {
    if (!weapon) return player;
    const weapons = player.weapons || [];
    if (weapons.some(w => w.id === weapon.id)) return player;
    return { ...player, weapons: [...weapons, weapon] };
}

function removeWeaponFromPlayer(player, weaponId) {
    const weapons = (player.weapons || []).filter(w => w.id !== weaponId);
    const equippedWeapon = player.equippedWeapon?.id === weaponId ? null : player.equippedWeapon;
    return { ...player, weapons, equippedWeapon };
}

function discardWeapon(player, weaponId) {
    const weapon = (player.weapons || []).find(w => w.id === weaponId);
    if (!weapon) return { ok: false, message: "武器を所持していません" };
    if (player.equippedWeapon?.id === weaponId) return { ok: false, message: "装備中の武器は捨てられません" };
    
    const updated = removeWeaponFromPlayer(player, weaponId);
    return { ok: true, player: updated, weapon };
}

function buyWeapon(player, type, tier) {
    const price = TIER_PRICES[tier];
    if (!price) return { ok: false, message: "無効な武器です" };
    const weapon = createWeapon(type, tier, false);
    if (!weapon) return { ok: false, message: "武器が見つかりません" };
    if (playerOwnsWeapon(player, weapon.id)) return { ok: false, message: "既に所持しています" };
    const coins = player.coins || 0;
    if (coins < price) return { ok: false, message: `コインが足りません（必要: ${price}、所持: ${coins}）` };
    const updated = addWeaponToPlayer({ ...player, coins: coins - price }, weapon);
    return { ok: true, player: updated, weapon };
}

function equipWeapon(player, weaponId) {
    const weapon = (player.weapons || []).find(w => w.id === weaponId);
    if (!weapon) return { ok: false, message: "武器を所持していません" };
    
    // 武器装備時にHPを調整
    const baseStats = getStatsFromPlayer(player);
    const newStats = applyWeaponStats(baseStats, weapon);
    const hpRatio = player.hp / player.maxHp;
    const newHp = Math.floor(newStats.maxHp * hpRatio);
    
    return { ok: true, player: { ...player, equippedWeapon: weapon, hp: newHp } };
}

function unequipWeapon(player) {
    return { ...player, equippedWeapon: null };
}

function addCoins(player, amount) {
    return { ...player, coins: (player.coins || 0) + amount };
}

function incrementWeaponWin(player) {
    if (!player.equippedWeapon) {
        console.log(`[Weapons] incrementWeaponWin: No equipped weapon - no count added`);
        return player;
    }
    const type = player.equippedWeapon.type;
    const weaponWins = { ...(player.weaponWins || {}) };
    weaponWins[type] = (weaponWins[type] || 0) + 1;
    console.log(`[Weapons] incrementWeaponWin: weaponName=${player.equippedWeapon.name}, type=${type}, newCount=${weaponWins[type]}`);
    console.log(`[Weapons] All weaponWins:`, weaponWins);
    return { ...player, weaponWins };
}

function getWeaponWinCount(player, type) {
    return (player.weaponWins || {})[type] || 0;
}

function canClaimUniqueQuest(player, type) {
    const typeConf = WEAPON_TYPES[type];
    // テスト用: 3勝に設定（本番は500に戻す）
    const requiredWins = TEST_UNIQUE_WINS;
    return getWeaponWinCount(player, type) >= requiredWins;
}

function canClaimDebugWeapon(player, type) {
    return getWeaponWinCount(player, type) >= 1;
}

function getWeaponDisplayName(weapon) {
    if (!weapon) return "なし";
    if (weapon.isOriginal) return weapon.name;
    const tierLabel = weapon.isUnique ? "★ユニーク" : weapon.tier?.toUpperCase() || "";
    return `${weapon.name} [${tierLabel}]`;
}

function getWeaponTypeLabel(type) {
    return WEAPON_TYPES[type]?.name || type;
}

// 必殺技名を取得
function getWeaponUltimateName(weapon) {
    if (!weapon) return "なし";
    
    // オリジナル武器の場合
    if (weapon.isOriginal) {
        return weapon.ultimateName || "カスタム必殺技";
    }
    
    // 通常武器の場合
    const catalog = WEAPON_CATALOG[weapon.type];
    if (!catalog) {
        console.warn("No catalog found for weapon type:", weapon.type);
        return "なし";
    }
    
    const tierKey = weapon.isUnique ? "unique" : weapon.tier;
    const weaponInfo = catalog[tierKey];
    
    if (!weaponInfo) {
        console.warn("No weapon info found for tierKey:", tierKey, "in type:", weapon.type);
        return "なし";
    }
    
    return weaponInfo.ultimate || "なし";
}

// 必殺技ゲージを初期化
function initializeUltimateGauge() {
    return {
        current: 0,
        max: ULTIMATE_GAUGE_MAX
    };
}

// 必殺技ゲージを増加
function increaseUltimateGauge(gauge, amount = ULTIMATE_GAUGE_PER_CORRECT) {
    const newCurrent = Math.min(gauge.max, gauge.current + amount);
    return {
        ...gauge,
        current: newCurrent
    };
}

// 必殺技ゲージが最大かチェック
function isUltimateReady(gauge) {
    return gauge.current >= gauge.max;
}

// 必殺技ゲージを消費
function consumeUltimateGauge(gauge) {
    return {
        ...gauge,
        current: 0
    };
}

// オリジナル武器の必殺技名を設定
function setOriginalWeaponUltimateName(weapon, ultimateName) {
    if (!weapon || !weapon.isOriginal) {
        return { error: "オリジナル武器ではありません" };
    }
    
    // 必殺技名のバリデーション
    const validation = validateName(ultimateName);
    if (!validation.valid) {
        return { error: validation.reason };
    }
    
    return {
        ...weapon,
        ultimateName: ultimateName || "カスタム必殺技"
    };
}
