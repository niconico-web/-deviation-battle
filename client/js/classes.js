// ============================================================
//  職業システム（データ・選択・ツリー）
// ------------------------------------------------------------
//  ・12の職業（タンク4／アタッカー5／サポーター3）。メイン職業とサブ職業を1つずつ設定できる
//  ・どちらの職業の武器も使える（近距離の職業＝近接武器、遠距離の職業＝弾・魔法の武器）。職業を何も選んでいない間は制限なし
//  ・職業ごとに「固有効果」「専用スキルツリー」がある。専用ツリーを進めると、その職業だけの「スキルの形」3つと「グリフ」3つが手に入る
//  ・サブ職業は、固有効果とツリーの強化が「半分」：固有効果の強さ×0.5、使える形・グリフ・強化は先頭の2つまで
//  ・ツリーのポイントは、レベル1につき1ポイント（メインとサブで共有）。使った分は、職業のツリーに残る（職業を変えても戻らない）
//  ・戦闘での効果は class-fx.js、新しい形の動きは class-forms.js、画面は classes-ui.js
//  保存先：player.classes = { main, sub } / player.classTree = { 職業ID: [解放したノードID] }
// ============================================================
(function (global) {
    'use strict';

    const SUB_SCALE = 0.5;                 // サブ職業の固有効果・強化の強さ（メインを1として）
    const SUB_SLOTS = 2;                   // サブ職業で使える形・グリフ・強化の数（先頭から。メインは3つとも使える）
    const POINTS_PER_LEVEL = 1;
    const TIER_COST = [1, 2, 3];           // ツリーの段階ごとのコスト

    const ROLES = {
        tank: { name: 'タンク', icon: '🛡️' },
        attacker: { name: 'アタッカー', icon: '⚔️' },
        supporter: { name: 'サポーター', icon: '🧪' }
    };

    // 武器の種類(kind) → 近距離／遠距離（hw-weapons.js の TYPES の kind）
    const KIND_RANGE = { cone: 'melee', line: 'melee', smash: 'melee', chain: 'melee', proj: 'ranged', lasers: 'ranged', ring: 'ranged' };

    // ---------- 職業の定義 ----------
    //  passives : 専用ツリーの「強化」3つ（段階1〜3）。キーは戦闘エンジンの A() が読む値（atkPct・hpPct など）
    //  forms    : 専用の「スキルの形」3つ（完全に新しい動き。class-forms.js が実装する）。cost=エネルギー消費 cd=クールタイム dmg=威力の倍率
    //  glyphs   : 専用の「グリフ」3つ（スキルに付けられる効果。class-fx.js が実装する）
    //  unique   : 固有効果の名前と説明（動きは class-fx.js）。メインの値で書き、サブは半分になる
    const CLASSES = [
        { id: 'barbarian', name: 'バーバリアン', role: 'tank', icon: '🪓', range: 'melee',
          blurb: '攻撃を受けるほど怒りが溜まる、荒ぶる戦士。',
          unique: { name: '怒りゲージ', icon: '😡', desc: '攻撃を受けると怒りが溜まる。満タンでスキルを使うと威力+60%（ゲージは空になる）。' },
          passives: [{ n: '頑強', e: { hpPct: 0.04 } }, { n: '闘気', e: { atkPct: 0.04, dr: 0.02 } }, { n: '不屈の肉体', e: { hpPct: 0.06, lowHpDr: 0.06 } }],
          forms: [
              { key: 'bar_spin', name: '大旋回', icon: '🌀', cost: 30, cd: 7, dmg: 1.0, desc: '武器を回しながら、敵に近づく。通り道の敵を巻き込む。' },
              { key: 'bar_rock', name: '岩投げ', icon: '🪨', cost: 26, cd: 6, dmg: 1.0, desc: '岩を放り投げる。着弾で砕け、周りを吹き飛ばす。' },
              { key: 'bar_roar', name: '戦場の雄叫び', icon: '📢', cost: 34, cd: 9, dmg: 1.0, desc: '周りの敵を中央に引き寄せ、衝撃で怯ませる。' }] ,
          glyphs: [
              { key: 'cg_bar_1', name: '出血', icon: '🩸', tpl: 'dot', pct: 0.5, sec: 4, desc: '敵に出血を与える（4秒間、与ダメージの50%）。' },
              { key: 'cg_bar_2', name: '戦慄', icon: '😱', tpl: 'mark', mul: 0.15, sec: 4, st: { weaken: 1 }, desc: '敵を弱体化し、受けるダメージ+15%（4秒）。' },
              { key: 'cg_bar_3', name: '不屈の血', icon: '❤️‍🔥', tpl: 'leech', pct: 0.10, desc: '与えたダメージの10%を回復する。' }] },

        { id: 'juggernaut', name: 'ジャガーノート', role: 'tank', icon: '🏰', range: 'melee',
          blurb: '動かないほど硬くなる、動く城塞。',
          unique: { name: '不動の城', icon: '🧱', desc: '立ち止まっているほど受けるダメージが減る（最大-35%）。動くと少しずつ戻る。' },
          passives: [{ n: '鉄の皮膚', e: { defPct: 0.05 } }, { n: '重装甲', e: { dr: 0.03, hpPct: 0.04 } }, { n: '不落', e: { defPct: 0.06, dmgTaken: -0.04 } }],
          forms: [
              { key: 'jug_wall', name: '城壁展開', icon: '🧱', cost: 28, cd: 10, dmg: 0.6, desc: '前方に壁を立てる。敵の弾を止める。' },
              { key: 'jug_charge', name: '暴走突進', icon: '🐂', cost: 32, cd: 8, dmg: 1.0, desc: '止まらずに走り抜ける。触れた敵を弾き飛ばす。' },
              { key: 'jug_chain', name: '大地の鎖', icon: '⛓️', cost: 30, cd: 9, dmg: 0.8, desc: '地面から鎖が伸びて、敵を縫い止める。' }],
          glyphs: [
              { key: 'cg_jug_1', name: '鉄壁の誓い', icon: '🛡️', tpl: 'barrier', pct: 0.06, desc: '命中するたびにバリアを得る（最大HPの6%）。' },
              { key: 'cg_jug_2', name: '地割れ', icon: '🌋', tpl: 'st', st: { slow: 1, stun: 0.5 }, desc: '敵を鈍足にして、0.5秒動けなくする。' },
              { key: 'cg_jug_3', name: '重圧', icon: '⬇️', tpl: 'pull', px: 90, desc: '敵を自分の方へ引き寄せる。' }] },

        { id: 'blademaster', name: 'ブレードマスター', role: 'tank', icon: '🗡️', range: 'melee',
          blurb: '剣気を溜めて、連続で斬り続ける剣の達人。',
          unique: { name: '剣気', icon: '✨', desc: 'スキルを使うたびに剣気が溜まる（最大5）。1つにつき威力+6%。被弾すると1つ減る。6秒使わないと消える。' },
          passives: [{ n: '剣の心得', e: { atkPct: 0.04 } }, { n: '見切り', e: { dodge: 0.03, critRate: 0.02 } }, { n: '明鏡止水', e: { dr: 0.04, atkPct: 0.04 } }],
          forms: [
              { key: 'bm_iai', name: '居合の構え', icon: '⚡', cost: 30, cd: 7, dmg: 1.0, desc: '一瞬ためて、前方を一気に斬り抜ける。' },
              { key: 'bm_shadow', name: '影断ち', icon: '👥', cost: 26, cd: 6, dmg: 1.0, desc: '斬った場所に残像が残り、少し遅れて追撃する。' },
              { key: 'bm_cage', name: '剣閃の檻', icon: '🔪', cost: 34, cd: 9, dmg: 1.0, desc: '敵の周りを高速で駆け回り、斬りつける。' }],
          glyphs: [
              { key: 'cg_bm_1', name: '残心', icon: '🎯', tpl: 'crit', chance: 0.25, mul: 1.6, desc: '25%でクリティカル（1.6倍）。' },
              { key: 'cg_bm_2', name: '剣気解放', icon: '💢', tpl: 'execute', thr: 0.3, bonus: 0.5, desc: 'HP30%以下の敵に、ダメージ+50%。' },
              { key: 'cg_bm_3', name: '峰打ち', icon: '💫', tpl: 'st', st: { stun: 0.6 }, desc: '敵を0.6秒動けなくする。' }] },

        { id: 'crusader', name: 'クルセイダー', role: 'tank', icon: '⚜️', range: 'melee',
          blurb: '聖なる力で戦い、傷を癒やす聖騎士。',
          unique: { name: '聖なる加護', icon: '🕊️', desc: '与えたダメージの6%を回復する。自分のHPが低いほど回復が増える（最大2倍）。敵を倒すと最大HPの2%を回復。' },
          passives: [{ n: '信仰', e: { hpPct: 0.04 } }, { n: '聖なる盾', e: { defPct: 0.05, regen: 0.002 } }, { n: '殉教', e: { hpPct: 0.06, lifesteal: 0.01 } }],
          forms: [
              { key: 'cru_shield', name: '聖盾投げ', icon: '🛡️', cost: 28, cd: 7, dmg: 1.0, desc: '盾を投げる。敵の間を跳ね回って、手元に戻る。' },
              { key: 'cru_sword', name: '裁きの剣', icon: '🗡️', cost: 32, cd: 9, dmg: 1.0, desc: '空から光の剣が降り、地面に残って焼き続ける。' },
              { key: 'cru_zone', name: '誓約の領域', icon: '⭕', cost: 36, cd: 12, dmg: 0.6, desc: '聖なる領域を展開。中では自分が回復し、敵は傷つく。' }],
          glyphs: [
              { key: 'cg_cru_1', name: '聖火', icon: '🔥', tpl: 'dot', pct: 0.6, sec: 3, desc: '聖なる炎で敵を焼く（3秒間、与ダメージの60%）。' },
              { key: 'cg_cru_2', name: '癒しの光', icon: '💚', tpl: 'heal', pct: 0.04, desc: '命中するたびに、最大HPの4%を回復する。' },
              { key: 'cg_cru_3', name: '断罪', icon: '⚖️', tpl: 'execute', thr: 0.35, bonus: 0.4, desc: 'HP35%以下の敵に、ダメージ+40%。' }] },

        { id: 'gunslinger', name: 'ガンスリンガー', role: 'attacker', icon: '🔫', range: 'ranged',
          blurb: '撃てば撃つほど、次の弾が早く出る早撃ち屋。',
          unique: { name: '早撃ち', icon: '⏱️', desc: 'スキルを撃つたびに、ほかのスキルのクールタイムが0.5秒縮む。' },
          passives: [{ n: '射撃術', e: { atkPct: 0.04 } }, { n: '素早い手', e: { skillCdUp: -0.04, moveSpd: 0.03 } }, { n: '百発百中', e: { critRate: 0.03, atkPct: 0.05 } }],
          forms: [
              { key: 'gun_fan', name: '早撃ちの舞', icon: '💃', cost: 32, cd: 8, dmg: 1.0, desc: '回転しながら、全方位に弾を撃ち続ける。' },
              { key: 'gun_ricochet', name: '跳弾', icon: '🎱', cost: 24, cd: 5, dmg: 1.0, desc: '壁や岩で跳ね返る弾。敵に何度も当たる。' },
              { key: 'gun_smoke', name: '煙幕弾', icon: '💨', cost: 28, cd: 9, dmg: 0.5, desc: '煙の中に入った敵は目が眩み、動きが鈍る。' }],
          glyphs: [
              { key: 'cg_gun_1', name: '連鎖弾', icon: '↪️', tpl: 'chain', n: 2, pct: 0.4, r: 220, desc: '近くの敵2体に、40%のダメージが跳ぶ。' },
              { key: 'cg_gun_2', name: '炸裂弾', icon: '💥', tpl: 'splash', r: 80, pct: 0.5, desc: '周囲80の敵に、50%のダメージ。' },
              { key: 'cg_gun_3', name: '急所撃ち', icon: '🎯', tpl: 'crit', chance: 0.3, mul: 1.5, desc: '30%でクリティカル（1.5倍）。' }] },

        { id: 'assassin', name: 'アサシン', role: 'attacker', icon: '🥷', range: 'melee',
          blurb: '不意を突き、一撃で仕留める暗殺者。',
          unique: { name: '奇襲', icon: '🌑', desc: 'HPが9割以上の敵への威力+50%。' },
          passives: [{ n: '忍び足', e: { moveSpd: 0.04 } }, { n: '暗殺術', e: { atkPct: 0.04, critRate: 0.03 } }, { n: '影の加護', e: { dodge: 0.04, critDmg: 0.15 } }],
          forms: [
              { key: 'asn_blink', name: '影渡り', icon: '🌫️', cost: 28, cd: 6, dmg: 1.0, desc: '敵の背後に瞬間移動して、斬りつける。' },
              { key: 'asn_needles', name: '毒針の雨', icon: '🪡', cost: 30, cd: 8, dmg: 1.0, desc: '無数の針が、狙った場所に降り注ぐ。' },
              { key: 'asn_clone', name: '分身の術', icon: '👤', cost: 34, cd: 11, dmg: 1.0, desc: '分身が2体現れ、一緒に敵を攻撃する。' }],
          glyphs: [
              { key: 'cg_asn_1', name: '致命', icon: '☠️', tpl: 'execute', thr: 0.3, bonus: 0.6, desc: 'HP30%以下の敵に、ダメージ+60%。' },
              { key: 'cg_asn_2', name: '猛毒', icon: '🧪', tpl: 'dot', pct: 0.6, sec: 5, desc: '猛毒で敵を蝕む（5秒間、与ダメージの60%）。' },
              { key: 'cg_asn_3', name: '暗幕', icon: '🌑', tpl: 'st', st: { blind: 1 }, desc: '敵を目眩状態にする。' }] },

        { id: 'trapper', name: '罠師', role: 'attacker', icon: '🪤', range: 'ranged',
          blurb: '立ち止まって仕掛けを置く、頭脳派のハンター。',
          unique: { name: '仕掛け', icon: '💣', desc: '1.5秒立ち止まると、足元に罠を置く（最大3個）。敵が踏むと爆発して、足止めする。' },
          passives: [{ n: '罠の心得', e: { atkPct: 0.04 } }, { n: '用心深さ', e: { dr: 0.03, rangePct: 0.04 } }, { n: '工作の達人', e: { skillPct: 0.06, energyUp: 0.06 } }],
          forms: [
              { key: 'trp_mines', name: '地雷原', icon: '🧨', cost: 30, cd: 9, dmg: 1.0, desc: '歩いた跡に地雷を撒く。' },
              { key: 'trp_net', name: '捕縛網', icon: '🕸️', cost: 28, cd: 8, dmg: 0.6, desc: '網を投げる。かかった敵は動けない。' },
              { key: 'trp_turret', name: '自動砲台', icon: '🔧', cost: 36, cd: 12, dmg: 0.6, desc: '砲台を置く。自動で敵を撃つ。' }],
          glyphs: [
              { key: 'cg_trp_1', name: '足止め', icon: '🐌', tpl: 'st', st: { slow: 1, stun: 0.4 }, desc: '敵を鈍足にして、0.4秒動けなくする。' },
              { key: 'cg_trp_2', name: '爆薬', icon: '💥', tpl: 'splash', r: 90, pct: 0.6, desc: '周囲90の敵に、60%のダメージ。' },
              { key: 'cg_trp_3', name: '誘爆', icon: '🔗', tpl: 'chain', n: 3, pct: 0.3, r: 240, desc: '近くの敵3体に、30%のダメージが連鎖する。' }] },

        { id: 'elementalist', name: 'エレメンタリスト', role: 'attacker', icon: '🌈', range: 'ranged',
          blurb: '属性を切り替え、元素を共鳴させる魔術師。',
          unique: { name: '元素共鳴', icon: '🔮', desc: '前に使ったスキルと違う属性のスキルを使うと、威力+25%。（属性を付けたスキルが対象）' },
          passives: [{ n: '元素の理解', e: { skillPct: 0.05 } }, { n: '魔力の流れ', e: { energyUp: 0.08, skillCdUp: -0.04 } }, { n: '元素の支配', e: { skillPct: 0.08, critRate: 0.02 } }],
          forms: [
              { key: 'ele_vortex', name: '元素の渦', icon: '🌪️', cost: 32, cd: 9, dmg: 1.0, desc: '渦を作り、敵を引き込みながら削る。' },
              { key: 'ele_ice', name: '氷柱の道', icon: '🧊', cost: 28, cd: 7, dmg: 1.0, desc: '前方に、氷柱が次々と突き出す。' },
              { key: 'ele_chain', name: '雷鎖', icon: '⚡', cost: 30, cd: 8, dmg: 1.0, desc: '雷が、敵から敵へ走る。' }],
          glyphs: [
              { key: 'cg_ele_1', name: '焼灼', icon: '🔥', tpl: 'dot', pct: 0.5, sec: 3, desc: '敵を焼く（3秒間、与ダメージの50%）。' },
              { key: 'cg_ele_2', name: '凍結の針', icon: '❄️', tpl: 'st', st: { slow: 1, stun: 0.3 }, desc: '敵を鈍足にして、0.3秒凍らせる。' },
              { key: 'cg_ele_3', name: '感電', icon: '⚡', tpl: 'chain', n: 2, pct: 0.5, r: 230, desc: '近くの敵2体に、50%のダメージが走る。' }] },

        { id: 'necromancer', name: 'ネクロマンサー', role: 'attacker', icon: '💀', range: 'ranged',
          blurb: '倒した敵の魂を力に変える死霊術師。',
          unique: { name: '魂喰らい', icon: '👻', desc: '敵を倒すとソウルが溜まる（最大10）。1つにつきスキルの威力+3%。' },
          passives: [{ n: '死の理解', e: { atkPct: 0.04 } }, { n: '冥府の加護', e: { hpPct: 0.04, lifesteal: 0.01 } }, { n: '魂の支配者', e: { skillPct: 0.07, dmgMob: 0.05 } }],
          forms: [
              { key: 'nec_skel', name: '骸骨兵召喚', icon: '💀', cost: 36, cd: 12, dmg: 0.7, desc: '骸骨の兵を3体呼ぶ。敵を追って戦う。' },
              { key: 'nec_hand', name: '死の手', icon: '🖐️', cost: 30, cd: 8, dmg: 1.0, desc: '地面から手が伸び、敵を掴んで離さない。' },
              { key: 'nec_link', name: '魂の鎖', icon: '🔗', cost: 32, cd: 10, dmg: 0.6, desc: '敵と敵を鎖でつなぐ。受けた傷が、つながった敵にも伝わる。' }],
          glyphs: [
              { key: 'cg_nec_1', name: '腐敗', icon: '🦠', tpl: 'dot', pct: 0.5, sec: 5, desc: '敵を腐らせる（5秒間、与ダメージの50%）。' },
              { key: 'cg_nec_2', name: '死の刻印', icon: '☠️', tpl: 'mark', mul: 0.2, sec: 6, desc: '敵に刻印を刻む。受けるダメージ+20%（6秒）。' },
              { key: 'cg_nec_3', name: '生命吸引', icon: '🩸', tpl: 'leech', pct: 0.12, desc: '与えたダメージの12%を回復する。' }] },

        { id: 'alchemist', name: 'アルケミスト', role: 'supporter', icon: '⚗️', range: 'ranged',
          blurb: '調合した薬で戦い、仲間も自分も強くする錬金術師。',
          unique: { name: '調合', icon: '🧪', desc: '敵を倒すと30%の確率で、薬が完成する（回復・攻撃UP・加速のどれか）。' },
          passives: [{ n: '薬学', e: { hpPct: 0.04 } }, { n: '錬金の知恵', e: { skillPct: 0.05, regen: 0.002 } }, { n: '賢者の調合', e: { energyUp: 0.08, dr: 0.03 } }],
          forms: [
              { key: 'alc_acid', name: '酸の瓶', icon: '🧫', cost: 26, cd: 7, dmg: 1.0, desc: '酸の瓶を投げる。地面に酸の溜まりが残る。' },
              { key: 'alc_bomb', name: '爆裂薬', icon: '💣', cost: 30, cd: 8, dmg: 1.0, desc: '薬を投げる。少し遅れて、大きく爆発する。' },
              { key: 'alc_circle', name: '変換陣', icon: '🔯', cost: 34, cd: 11, dmg: 0.5, desc: '陣を敷く。中の敵は、力を失っていく。' }],
          glyphs: [
              { key: 'cg_alc_1', name: '酸', icon: '🧫', tpl: 'mark', mul: 0.1, sec: 5, st: { weaken: 1 }, desc: '敵を弱体化し、受けるダメージ+10%（5秒）。' },
              { key: 'cg_alc_2', name: '回復薬', icon: '💚', tpl: 'heal', pct: 0.05, desc: '命中するたびに、最大HPの5%を回復する。' },
              { key: 'cg_alc_3', name: '活力剤', icon: '⚡', tpl: 'self', self: { haste: 3 }, desc: '使うと、3秒間加速する。' }] },

        { id: 'spellbreaker', name: 'スペルブレイカー', role: 'supporter', icon: '🔰', range: 'melee',
          blurb: '敵の魔法や弾を断ち切り、力に変える。',
          unique: { name: '魔法破り', icon: '✂️', desc: 'スキルを使うと、周り（半径150）の敵の弾を消して、1発につきバリアを得る（最大HPの2%ずつ、上限20%）。' },
          passives: [{ n: '対魔の心得', e: { dr: 0.03 } }, { n: '魔力の鎧', e: { defPct: 0.05, atkPct: 0.03 } }, { n: '破魔の極意', e: { dr: 0.04, skillPct: 0.06 } }],
          forms: [
              { key: 'spb_cut', name: '魔断ち', icon: '✂️', cost: 28, cd: 6, dmg: 1.0, desc: '広く斬り払い、敵の弾を消し去る。' },
              { key: 'spb_reflect', name: '反射の構え', icon: '🪞', cost: 30, cd: 10, dmg: 0.8, desc: '構えている間、当たった敵の弾を跳ね返す。' },
              { key: 'spb_seal', name: '封魔印', icon: '🔏', cost: 32, cd: 11, dmg: 0.6, desc: '敵に印をつける。動きを止められ、受けるダメージが増える。' }],
          glyphs: [
              { key: 'cg_spb_1', name: '魔封じ', icon: '🚫', tpl: 'st', st: { weaken: 1, stun: 0.4 }, desc: '敵を弱体化して、0.4秒動けなくする。' },
              { key: 'cg_spb_2', name: '吸魔', icon: '🌀', tpl: 'leech', pct: 0.08, barrier: 0.03, desc: '与えたダメージの8%を回復し、最大HPの3%のバリアを得る。' },
              { key: 'cg_spb_3', name: '破邪', icon: '🔆', tpl: 'mark', mul: 0.25, sec: 5, desc: '敵に印をつける。受けるダメージ+25%（5秒）。' }] },

        { id: 'gambler', name: 'ギャンブラー', role: 'supporter', icon: '🎲', range: 'ranged',
          blurb: '運に身を任せる。出目しだいで、大当たりも大外れも。',
          unique: { name: '賭け', icon: '🎰', desc: 'スキルを使うたびにダイスを振る。威力が×0.6〜×2.2で変わる（サブでは変化の幅が半分）。' },
          passives: [{ n: '度胸', e: { critRate: 0.03 } }, { n: '強運', e: { dodge: 0.04, goldPct: 0.05 } }, { n: '大勝負', e: { critDmg: 0.2, critRate: 0.03 } }],
          forms: [
              { key: 'gam_coin', name: 'コイントス', icon: '🪙', cost: 24, cd: 5, dmg: 1.0, desc: 'コインを弾く。表なら大威力、裏なら小威力。' },
              { key: 'gam_roul', name: 'ルーレット弾', icon: '🎡', cost: 32, cd: 8, dmg: 1.0, desc: '輪になった弾が飛び出す。弾ごとに、威力がバラバラ。' },
              { key: 'gam_dice', name: 'ダイス爆弾', icon: '🎲', cost: 30, cd: 9, dmg: 1.0, desc: '爆弾を投げる。出目の数だけ、連続で爆発する。' }],
          glyphs: [
              { key: 'cg_gam_1', name: '大当たり', icon: '🎰', tpl: 'crit', chance: 0.3, mul: 2.0, desc: '30%でクリティカル（2倍）。' },
              { key: 'cg_gam_2', name: '倍賭け', icon: '✖️', tpl: 'mark', mul: 0.3, sec: 4, desc: '敵に賭けの印。受けるダメージ+30%（4秒）。' },
              { key: 'cg_gam_3', name: '強運', icon: '🍀', tpl: 'chain', n: 2, pct: 0.35, r: 230, desc: '近くの敵2体に、35%のダメージが跳ぶ。' }] }
    ];

    // ---------- 索引 ----------
    const BY_ID = {}, FORM_OWNER = {}, GLYPH_OWNER = {};
    CLASSES.forEach(c => {
        BY_ID[c.id] = c;
        c.forms.forEach((f, i) => { f.cls = c.id; f.idx = i; FORM_OWNER[f.key] = { cls: c.id, idx: i, def: f }; });
        c.glyphs.forEach((g, i) => { g.cls = c.id; g.idx = i; GLYPH_OWNER[g.key] = { cls: c.id, idx: i, def: g }; });
    });

    // ---------- ツリー：職業ごとに、3段階 × （形・グリフ・強化）= 9ノード ----------
    //  段階Nのノードは、1つ前の段階のノードをすべて解放していないと取れない
    function treeNodes(cid) {
        const c = BY_ID[cid]; if (!c) return [];
        const out = [];
        for (let t = 0; t < 3; t++) {
            out.push({ id: cid + ':f' + (t + 1), kind: 'form', idx: t, tier: t + 1, cost: TIER_COST[t], name: c.forms[t].name, icon: c.forms[t].icon, desc: 'スキルの形「' + c.forms[t].name + '」：' + c.forms[t].desc });
            out.push({ id: cid + ':g' + (t + 1), kind: 'glyph', idx: t, tier: t + 1, cost: TIER_COST[t], name: c.glyphs[t].name, icon: c.glyphs[t].icon, desc: 'グリフ「' + c.glyphs[t].name + '」：' + c.glyphs[t].desc });
            out.push({ id: cid + ':p' + (t + 1), kind: 'passive', idx: t, tier: t + 1, cost: TIER_COST[t], name: c.passives[t].n, icon: '📈', desc: '常時強化：' + describeEffect(c.passives[t].e) });
        }
        return out;
    }
    const PASSIVE_JA = { hpPct: 'HP', atkPct: '攻撃', defPct: '防御', dr: '被ダメージ軽減', lowHpDr: 'HP低下時の軽減', dodge: '回避', moveSpd: '移動速度', critRate: 'クリティカル率', critDmg: 'クリティカルダメージ', skillPct: 'スキル威力', skillCdUp: 'スキルのクールタイム', energyUp: 'エネルギー', rangePct: '射程', lifesteal: '吸収', regen: '自然回復', dmgMob: '雑魚への威力', goldPct: 'コイン', dmgTaken: '被ダメージ' };
    function describeEffect(e) { return Object.keys(e).map(k => (PASSIVE_JA[k] || k) + (e[k] >= 0 ? '+' : '') + Math.round(e[k] * 1000) / 10 + '%').join('、'); }

    // ---------- プレイヤーデータの読み書き ----------
    function readPlayer() { try { if (typeof getPlayerData === 'function') return getPlayerData(); return JSON.parse(localStorage.getItem('player') || 'null'); } catch (e) { return null; } }
    function writePlayer(p) {
        try { localStorage.setItem('player', JSON.stringify(p)); } catch (e) { return false; }
        try { if (typeof syncPlayerToServer === 'function') syncPlayerToServer(true); } catch (e) { /* 同期できなくても、端末には保存済み */ }
        return true;
    }
    function state(p) {
        p = p || readPlayer() || {};
        const cl = p.classes && typeof p.classes === 'object' ? p.classes : {};
        const main = BY_ID[cl.main] ? cl.main : null;
        const sub = BY_ID[cl.sub] && cl.sub !== main ? cl.sub : null;
        const tree = p.classTree && typeof p.classTree === 'object' ? p.classTree : {};
        return { main, sub, tree, level: Math.max(1, Number(p.level) || 1) };
    }
    function spentPoints(st) {
        let sum = 0;
        Object.keys(st.tree).forEach(cid => (st.tree[cid] || []).forEach(nid => { const n = treeNodes(cid).find(x => x.id === nid); if (n) sum += n.cost; }));
        return sum;
    }
    function pointsInfo(p) { const st = state(p); const earned = st.level * POINTS_PER_LEVEL, spent = spentPoints(st); return { earned, spent, available: Math.max(0, earned - spent) }; }

    function scaleOf(cid, st) { st = st || state(); return cid && cid === st.main ? 1 : (cid && cid === st.sub ? SUB_SCALE : 0); }
    function slotsOf(cid, st) { st = st || state(); return cid === st.main ? 3 : (cid === st.sub ? SUB_SLOTS : 0); }
    function isUnlockedNode(st, cid, nid) { return (st.tree[cid] || []).indexOf(nid) >= 0; }

    // その職業は今「使える」状態か（メインかサブで、そのノードが解放済みで、サブなら先頭の2つ以内）
    function nodeActive(st, cid, node) { return slotsOf(cid, st) > node.idx && isUnlockedNode(st, cid, node.id); }
    function isFormUnlocked(key) {
        const o = FORM_OWNER[key]; if (!o) return false;
        const st = state(); return nodeActive(st, o.cls, { id: o.cls + ':f' + (o.idx + 1), idx: o.idx });
    }
    function isGlyphUnlocked(key) {
        const o = GLYPH_OWNER[key]; if (!o) return false;
        const st = state(); return nodeActive(st, o.cls, { id: o.cls + ':g' + (o.idx + 1), idx: o.idx });
    }
    function unlockedGlyphKeys() { return Object.keys(GLYPH_OWNER).filter(isGlyphUnlocked); }
    function glyphScale(key) { const o = GLYPH_OWNER[key]; return o ? scaleOf(o.cls) : 0; }

    // 解放できるか
    function canUnlock(cid, nid, p) {
        const st = state(p); const node = treeNodes(cid).find(n => n.id === nid);
        if (!node) return { ok: false, reason: 'ノードが見つかりません' };
        if (cid !== st.main && cid !== st.sub) return { ok: false, reason: 'メインかサブに設定した職業のツリーだけ進められます' };
        if (isUnlockedNode(st, cid, nid)) return { ok: false, reason: '解放済みです' };
        if (node.idx >= slotsOf(cid, st)) return { ok: false, reason: 'サブ職業では、先頭の' + SUB_SLOTS + '段階までです' };
        if (node.tier > 1) {
            const need = treeNodes(cid).filter(n => n.tier === node.tier - 1 && n.idx < slotsOf(cid, st));
            if (need.some(n => !isUnlockedNode(st, cid, n.id))) return { ok: false, reason: '前の段階をすべて解放してください' };
        }
        if (pointsInfo(p).available < node.cost) return { ok: false, reason: 'ポイントが足りません（必要' + node.cost + '）' };
        return { ok: true, node };
    }
    function unlock(cid, nid) {
        const p = readPlayer(); if (!p) return { ok: false, reason: 'キャラクターデータがありません' };
        const chk = canUnlock(cid, nid, p); if (!chk.ok) return chk;
        p.classTree = Object.assign({}, p.classTree || {});
        p.classTree[cid] = (p.classTree[cid] || []).concat([nid]);
        writePlayer(p); return { ok: true, node: chk.node };
    }
    function resetTree(cid) {
        const p = readPlayer(); if (!p) return false;
        p.classTree = Object.assign({}, p.classTree || {}); delete p.classTree[cid];
        return writePlayer(p);
    }

    // ---------- 職業の選択 ----------
    function weaponOk(kind, st) {
        st = st || state();
        const sel = [st.main, st.sub].filter(Boolean);
        if (!sel.length) return true;                         // 職業を選んでいないあいだは、制限なし
        const r = KIND_RANGE[kind] || 'melee';
        return sel.some(cid => BY_ID[cid].range === r);
    }
    function canUseWeaponType(typeKey) {
        try { const T = global.HW && HW.TYPES && HW.TYPES[typeKey]; return weaponOk(T ? T.kind : 'cone'); } catch (e) { return true; }
    }
    function setClasses(main, sub) {
        const p = readPlayer(); if (!p) return { ok: false, reason: 'キャラクターデータがありません' };
        if (main && !BY_ID[main]) return { ok: false, reason: '不明な職業です' };
        if (sub && !BY_ID[sub]) return { ok: false, reason: '不明な職業です' };
        if (main && sub && main === sub) return { ok: false, reason: 'メインとサブは、別の職業にしてください' };
        if (!main && sub) return { ok: false, reason: '先にメイン職業を選んでください' };
        p.classes = { main: main || null, sub: sub || null };
        writePlayer(p); return { ok: true };
    }

    // ---------- 戦闘エンジンへ：常時強化を、A() が読む値に足す ----------
    function passiveStats() {
        const st = state(), out = {};
        [st.main, st.sub].filter(Boolean).forEach(cid => {
            const sc = scaleOf(cid, st);
            BY_ID[cid].passives.forEach((ps, i) => {
                if (!nodeActive(st, cid, { id: cid + ':p' + (i + 1), idx: i })) return;
                Object.keys(ps.e).forEach(k => { out[k] = (out[k] || 0) + ps.e[k] * sc; });
            });
        });
        return out;
    }
    function mergeInto(agg) {
        const cs = passiveStats();
        agg.stats = agg.stats || {};
        Object.keys(cs).forEach(k => { agg.stats[k] = (agg.stats[k] || 0) + cs[k]; });
        return agg;
    }
    // 今ついている固有効果：[{ id, scale }]
    function activeUniques() { const st = state(); return [st.main, st.sub].filter(Boolean).map(cid => ({ id: cid, scale: scaleOf(cid, st) })); }

    global.ClassSys = {
        CLASSES, ROLES, BY_ID, FORM_OWNER, GLYPH_OWNER, SUB_SCALE, SUB_SLOTS, POINTS_PER_LEVEL, KIND_RANGE,
        treeNodes, state, pointsInfo, scaleOf, slotsOf, canUnlock, unlock, resetTree, setClasses,
        isFormUnlocked, isGlyphUnlocked, unlockedGlyphKeys, glyphScale, weaponOk, canUseWeaponType, passiveStats, mergeInto, activeUniques, describeEffect,
        isUnlockedNode, nodeActive
    };
    if (global.ActionSkills && global.ActionSkills.registerClass) global.ActionSkills.registerClass(CLASSES);     // action-skills.js が先に読まれていれば、ここで専用の形・グリフを登録する
})(typeof window !== 'undefined' ? window : globalThis);
