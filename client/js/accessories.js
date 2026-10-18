// ============================================================
// アクセサリー (accessories.js)
//  ・装備してもステータスは上がらない。かわりに「特殊なスキル」が使えるようになる（自動で発動する範囲攻撃が中心）
//  ・装備枠は3つ。ステージ・ボスラッシュ・無限回廊のドロップで手に入る（武器庫の「✨ アクセサリー」で装備する）
//  ・発動のしかた（trigger）：
//      timer  = 一定時間ごと（近くに敵がいるとき）／ kills = 敵をN体倒すごと／ hurt = 攻撃を受けたとき
//      dash   = ダッシュしたとき／ hit = 攻撃が命中したとき（確率）／ lowhp = HPが少ないとき（大技）／ skill = スキルを使ったとき（確率）
//  ・効果（kind）の中身は stage.js の accFire が実行する
//      nova=周囲に衝撃波 / chain=連鎖雷 / meteor=流星群 / spin=旋風（連続の衝撃波） / quake=地鳴り（広がる輪） / radial=全方位の弾
//      blackhole=重力の渦 / heal=回復＋衝撃波 / rain=刃の雨 / beam=放射状のビーム / shield=バリア＋衝撃波
//  ・データは武器庫のデータ（HW）に入る：d.accs（持ち物）、d.accEq（装備中のid 3つ）
// ============================================================
(function () {
    const H = () => window.HW;
    const SLOTS = 3;

    // tier: 出てくる目安のレベル帯（武器と同じ 1〜46）。mult: 威力の倍率（武器の攻撃力 × プレイヤーの攻撃倍率に対して）。cd: 秒
    const BASES = [
        // ---- 一定時間ごと ----
        { id: 'ac_thunder_ring', name: '雷光のリング', icon: '⚡', tier: 1, trig: { t: 'timer', cd: 6 }, fx: { kind: 'chain', n: 5, range: 360, mult: 1.6, col: '#ffe44a' }, desc: '6秒ごとに、近くの敵へ連鎖する雷を落とす' },
        { id: 'ac_meteor_brooch', name: '流星のブローチ', icon: '☄️', tier: 8, trig: { t: 'timer', cd: 9 }, fx: { kind: 'meteor', n: 6, r: 95, mult: 2.2, col: '#ff9a4a' }, desc: '9秒ごとに、敵の頭上へ流星群を降らせる' },
        { id: 'ac_flame_pendant', name: '炎帝のペンダント', icon: '🔥', tier: 3, trig: { t: 'timer', cd: 7 }, fx: { kind: 'nova', r: 270, mult: 2.0, eff: ['burn'], col: '#ff6a3a' }, desc: '7秒ごとに、周囲を焼き払う炎の波を放つ（燃焼）' },
        { id: 'ac_frost_earring', name: '氷結のイヤリング', icon: '❄️', tier: 4, trig: { t: 'timer', cd: 8 }, fx: { kind: 'nova', r: 310, mult: 1.4, eff: ['freeze'], col: '#8fe0ff' }, desc: '8秒ごとに、周囲を凍らせる冷気の波（鈍足）' },
        { id: 'ac_whirl_bracelet', name: '旋風のブレスレット', icon: '🌪️', tier: 6, trig: { t: 'timer', cd: 8 }, fx: { kind: 'spin', r: 210, ticks: 7, gap: 0.22, mult: 0.9, col: '#b8ffd0' }, desc: '8秒ごとに、体のまわりに旋風を起こして敵を刻み続ける' },
        { id: 'ac_quake_anklet', name: '地鳴りの足輪', icon: '🌋', tier: 10, trig: { t: 'timer', cd: 10 }, fx: { kind: 'quake', rings: 3, r: 380, mult: 1.8, eff: ['knockback'], col: '#c99a6a' }, desc: '10秒ごとに、大地を揺らして衝撃波を3連続で放つ（吹き飛ばし）' },
        { id: 'ac_stardust_ring', name: '星屑の指輪', icon: '✨', tier: 2, trig: { t: 'timer', cd: 5 }, fx: { kind: 'radial', n: 16, speed: 520, mult: 0.9, pierce: 1, col: '#fff3a0' }, desc: '5秒ごとに、全方位へ星屑の弾をばらまく' },
        { id: 'ac_viper_bangle', name: '毒蛇の腕輪', icon: '☠️', tier: 5, trig: { t: 'timer', cd: 7 }, fx: { kind: 'nova', r: 250, mult: 1.2, eff: ['poison'], col: '#8aff6a' }, desc: '7秒ごとに、毒の霧を広げる（持続ダメージ）' },
        { id: 'ac_halo_circlet', name: '光輪のサークレット', icon: '😇', tier: 12, trig: { t: 'timer', cd: 12 }, fx: { kind: 'heal', pct: 0.1, r: 280, mult: 1.2, col: '#fff0b0' }, desc: '12秒ごとに、HPを回復しつつ聖なる光で周囲を焼く' },
        { id: 'ac_gravity_magatama', name: '重力の勾玉', icon: '🕳️', tier: 16, trig: { t: 'timer', cd: 14 }, fx: { kind: 'blackhole', r: 340, dur: 2.6, mult: 0.55, col: '#9a6aff' }, desc: '14秒ごとに、敵を引きずり込む重力の渦を作る' },
        { id: 'ac_storm_necklace', name: '雷雲のネックレス', icon: '⛈️', tier: 14, trig: { t: 'timer', cd: 10 }, fx: { kind: 'rain', n: 16, spread: 420, mult: 1.3, col: '#9ad8ff' }, desc: '10秒ごとに、周囲へ刃の雨を降らせる' },
        { id: 'ac_flash_pierce', name: '閃光のピアス', icon: '💥', tier: 18, trig: { t: 'timer', cd: 6 }, fx: { kind: 'beam', n: 6, len: 540, w: 46, mult: 1.4, col: '#ffffff' }, desc: '6秒ごとに、放射状に光の筋を走らせる' },
        // ---- 敵を倒すごと ----
        { id: 'ac_slaughter_ring', name: '殲滅の指輪', icon: '💀', tier: 7, trig: { t: 'kills', n: 8 }, fx: { kind: 'nova', r: 340, mult: 2.4, eff: ['explosion'], col: '#ff4a6a' }, desc: '敵を8体倒すごとに、大爆発を起こす' },
        { id: 'ac_blaze_necklace', name: '爆炎の首飾り', icon: '🧨', tier: 13, trig: { t: 'kills', n: 12 }, fx: { kind: 'meteor', n: 8, r: 100, mult: 2.4, col: '#ff7a3a' }, desc: '敵を12体倒すごとに、流星を8つ降らせる' },
        { id: 'ac_reaper_sickle', name: '収穫の鎌飾り', icon: '🌙', tier: 9, trig: { t: 'kills', n: 10 }, fx: { kind: 'spin', r: 260, ticks: 8, gap: 0.2, mult: 1.0, col: '#d0a0ff' }, desc: '敵を10体倒すごとに、大きな旋風で刈り取る' },
        { id: 'ac_chain_orb', name: '連鎖の宝珠', icon: '🔮', tier: 11, trig: { t: 'kills', n: 6 }, fx: { kind: 'chain', n: 8, range: 420, mult: 1.9, col: '#c8a0ff' }, desc: '敵を6体倒すごとに、連鎖する雷が走る' },
        { id: 'ac_bloodied_charm', name: '血染めの護符', icon: '🩸', tier: 15, trig: { t: 'kills', n: 15 }, fx: { kind: 'heal', pct: 0.18, r: 300, mult: 2.0, col: '#ff6a8a' }, desc: '敵を15体倒すごとに、HPを回復しつつ衝撃波を放つ' },
        // ---- 攻撃を受けたとき ----
        { id: 'ac_counter_shield', name: '反撃の盾飾り', icon: '🛡️', tier: 4, trig: { t: 'hurt', cd: 4 }, fx: { kind: 'nova', r: 290, mult: 2.2, eff: ['knockback'], col: '#ffd070' }, desc: '攻撃を受けると、周囲の敵を吹き飛ばす衝撃波で反撃（4秒に1回）' },
        { id: 'ac_wrath_ring', name: '憤怒の指輪', icon: '😡', tier: 9, trig: { t: 'hurt', cd: 6 }, fx: { kind: 'radial', n: 28, speed: 560, mult: 1.0, pierce: 1, col: '#ff5a5a' }, desc: '攻撃を受けると、全方位へ怒りの弾を撃ち出す（6秒に1回）' },
        { id: 'ac_guardian_locket', name: '守護のロケット', icon: '🧿', tier: 12, trig: { t: 'hurt', cd: 9 }, fx: { kind: 'shield', pct: 0.22, r: 300, mult: 1.6, col: '#7fc8ff' }, desc: '攻撃を受けると、バリアを張って衝撃波を放つ（9秒に1回）' },
        { id: 'ac_vengeance_bolt', name: '報復の雷', icon: '🌩️', tier: 17, trig: { t: 'hurt', cd: 5 }, fx: { kind: 'chain', n: 7, range: 440, mult: 2.2, col: '#ffee66' }, desc: '攻撃を受けると、近くの敵へ雷で報復する（5秒に1回）' },
        // ---- ダッシュしたとき ----
        { id: 'ac_gale_boots', name: '疾風の靴飾り', icon: '👟', tier: 2, trig: { t: 'dash', cd: 2.5 }, fx: { kind: 'nova', r: 190, mult: 1.1, col: '#c8fff0' }, desc: 'ダッシュすると、その場に衝撃波を残す（2.5秒に1回）' },
        { id: 'ac_shadow_earring', name: '影走りの耳飾り', icon: '🥷', tier: 8, trig: { t: 'dash', cd: 3 }, fx: { kind: 'radial', n: 12, speed: 600, mult: 1.1, pierce: 2, col: '#a08aff' }, desc: 'ダッシュすると、影の刃が四方へ飛ぶ（3秒に1回）' },
        { id: 'ac_bolt_anklet', name: '迅雷の足輪', icon: '⚡', tier: 13, trig: { t: 'dash', cd: 3 }, fx: { kind: 'chain', n: 5, range: 380, mult: 1.7, col: '#ffe44a' }, desc: 'ダッシュすると、雷が敵へ走る（3秒に1回）' },
        // ---- 攻撃が命中したとき（確率）----
        { id: 'ac_crit_ring', name: '会心の指輪', icon: '🎯', tier: 3, trig: { t: 'hit', chance: 0.08, cd: 1.5 }, fx: { kind: 'chain', n: 4, range: 340, mult: 1.5, col: '#ffd84a' }, desc: '攻撃が当たると、8%で連鎖する雷を放つ' },
        { id: 'ac_burst_bangle', name: '爆裂の腕輪', icon: '💣', tier: 6, trig: { t: 'hit', chance: 0.06, cd: 1.0 }, fx: { kind: 'nova', r: 210, mult: 1.3, eff: ['explosion'], col: '#ff9a4a' }, desc: '攻撃が当たると、6%で爆発を起こす' },
        { id: 'ac_thunder_fang', name: '雷霆の牙', icon: '🦷', tier: 15, trig: { t: 'hit', chance: 0.07, cd: 1.2 }, fx: { kind: 'meteor', n: 3, r: 90, mult: 2.0, col: '#ffe08a' }, desc: '攻撃が当たると、7%で流星を落とす' },
        // ---- HPが少ないとき（大技）----
        { id: 'ac_phoenix_feather', name: '不死鳥の羽根', icon: '🪶', tier: 14, trig: { t: 'lowhp', cd: 40, hp: 0.35 }, fx: { kind: 'heal', pct: 0.4, r: 520, mult: 4.0, eff: ['burn'], col: '#ff8a3a' }, desc: 'HPが35%を下回ると、HPを大きく回復して辺り一面を焼き尽くす（40秒に1回）' },
        { id: 'ac_last_stand', name: '背水の勾玉', icon: '🌀', tier: 10, trig: { t: 'lowhp', cd: 30, hp: 0.3 }, fx: { kind: 'shield', pct: 0.35, r: 300, mult: 2.4, spinR: 280, col: '#9fe8ff' }, desc: 'HPが30%を下回ると、強いバリアと旋風で身を守る（30秒に1回）' },
        // ---- スキルを使ったとき（確率）----
        { id: 'ac_mage_ring', name: '魔導の指輪', icon: '💍', tier: 5, trig: { t: 'skill', chance: 0.4, cd: 3 }, fx: { kind: 'nova', r: 250, mult: 1.6, col: '#a0c8ff' }, desc: 'スキルを使うと、40%で魔力の衝撃波が走る' },
        { id: 'ac_resonance_bangle', name: '共鳴の腕輪', icon: '🔔', tier: 11, trig: { t: 'skill', chance: 0.35, cd: 3 }, fx: { kind: 'radial', n: 14, speed: 540, mult: 1.1, pierce: 1, col: '#ffe9a0' }, desc: 'スキルを使うと、35%で全方位へ共鳴の弾が飛ぶ' },
        { id: 'ac_astral_crown', name: '星読みの冠', icon: '👑', tier: 20, trig: { t: 'skill', chance: 0.3, cd: 4 }, fx: { kind: 'meteor', n: 5, r: 100, mult: 2.2, col: '#fff0a0' }, desc: 'スキルを使うと、30%で流星が降り注ぐ' }
    ];
    const BASE_BY_ID = {}; BASES.forEach(b => { BASE_BY_ID[b.id] = b; });

    // レア度ごとの威力・間隔（レジェンドは威力2倍、間隔も2割短い）
    const PW = { normal: 1.0, magic: 1.18, rare: 1.4, epic: 1.7, legendary: 2.1 };
    const CDM = { normal: 1.0, magic: 0.96, rare: 0.92, epic: 0.86, legendary: 0.78 };
    const PREFIX = { normal: ['古びた', 'ふつうの'], magic: ['輝く', '磨かれた'], rare: ['秘められた', '名工の'], epic: ['神秘の', '覇者の'], legendary: ['伝説の', '神話の'] };

    const rnd = (a, b) => a + Math.random() * (b - a);
    const uid = () => 'ac_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

    function ensure(d) { if (!Array.isArray(d.accs)) d.accs = []; if (!Array.isArray(d.accEq)) d.accEq = []; while (d.accEq.length < SLOTS) d.accEq.push(null); d.accEq.length = SLOTS; return d; }
    function rarityPick(luck, minRarity) {
        // 武器のドロップに近い割合（luck が高いほど高レア）
        const order = H().RARITY_ORDER, base = { normal: 56, magic: 30, rare: 11, epic: 2.6, legendary: 0.4 };
        const w = order.map((k, i) => base[k] * (1 + Math.max(0, luck) * i * 0.9));
        const minI = Math.max(0, order.indexOf(minRarity || 'normal'));
        for (let i = 0; i < minI; i++) w[i] = 0;
        let sum = w.reduce((a, b) => a + b, 0), r = Math.random() * sum;
        for (let i = 0; i < order.length; i++) { r -= w[i]; if (r <= 0) return order[i]; }
        return order[order.length - 1];
    }
    // ilvl に合うアクセサリーを1つ作る
    function roll(o) {
        o = o || {}; const il = Math.max(1, o.ilvl || 1);
        let pool = BASES.filter(b => b.tier <= il + 4 && b.tier >= il - 16);
        if (!pool.length) pool = BASES.filter(b => b.tier <= il + 6);
        if (!pool.length) pool = BASES.slice(0, 6);
        const b = pool[Math.floor(Math.random() * pool.length)], rar = rarityPick(o.luck || 0, o.minRarity);
        const pw = Math.round(PW[rar] * rnd(0.94, 1.08) * 100) / 100;
        const pre = PREFIX[rar][Math.floor(Math.random() * PREFIX[rar].length)];
        return { id: uid(), baseId: b.id, name: pre + b.name, rarity: rar, ilvl: il, pw: pw, source: o.source || '', at: Date.now() };
    }
    const baseOf = a => BASE_BY_ID[a && a.baseId] || null;
    function equippedList(d) { ensure(d); return d.accEq.map(id => (id && d.accs.find(a => a.id === id)) || null); }
    function equip(d, id) { ensure(d); const a = d.accs.find(x => x.id === id); if (!a || d.accEq.indexOf(id) >= 0) return false; let i = d.accEq.indexOf(null); if (i < 0) return false; d.accEq[i] = id; return true; }
    function unequip(d, id) { ensure(d); const i = d.accEq.indexOf(id); if (i < 0) return false; d.accEq[i] = null; return true; }
    function sellValue(a) { const idx = H().RARITY_ORDER.indexOf(a.rarity); return Math.max(2, Math.round((5 + a.ilvl * 1.6) * (1 + idx * 1.4))); }
    function sell(d, id) { ensure(d); const i = d.accs.findIndex(x => x.id === id); if (i < 0 || d.accEq.indexOf(id) >= 0 || d.accs[i].locked) return 0; const v = sellValue(d.accs[i]); d.accs.splice(i, 1); return v; }
    // 発動の間隔（レア度で短くなる）
    function cdOf(a) { const b = baseOf(a); if (!b) return 99; return Math.max(0.8, (b.trig.cd || 0) * (CDM[a.rarity] || 1)); }
    function triggerText(a) {
        const b = baseOf(a); if (!b) return ''; const t = b.trig;
        if (t.t === 'timer') return '一定時間ごと（' + cdOf(a).toFixed(1) + '秒）';
        if (t.t === 'kills') return '敵を' + t.n + '体倒すごと';
        if (t.t === 'hurt') return '攻撃を受けたとき（' + cdOf(a).toFixed(1) + '秒に1回）';
        if (t.t === 'dash') return 'ダッシュしたとき（' + cdOf(a).toFixed(1) + '秒に1回）';
        if (t.t === 'hit') return '攻撃が命中したとき（' + Math.round(t.chance * 100) + '%・' + cdOf(a).toFixed(1) + '秒に1回）';
        if (t.t === 'lowhp') return 'HPが' + Math.round(t.hp * 100) + '%未満（' + cdOf(a).toFixed(0) + '秒に1回）';
        if (t.t === 'skill') return 'スキルを使ったとき（' + Math.round(t.chance * 100) + '%）';
        return '';
    }
    function describe(a) {
        const b = baseOf(a); if (!b) return [];
        return [b.desc, '発動：' + triggerText(a), '威力：×' + (a.pw || 1).toFixed(2) + '（' + (H().RARITIES[a.rarity] ? H().RARITIES[a.rarity].label : a.rarity) + '）'];
    }
    window.SBAcc = { SLOTS: SLOTS, BASES: BASES, BASE_BY_ID: BASE_BY_ID, ensure: ensure, roll: roll, baseOf: baseOf, equippedList: equippedList, equip: equip, unequip: unequip, sell: sell, sellValue: sellValue, cdOf: cdOf, triggerText: triggerText, describe: describe, PW: PW };
})();
