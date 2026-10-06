// ============================================================
// アクションバトル用 モジュール式スキル（アルスヌーボー風）
//
//   スキル = 「形(form)」 + 「効果(effects)」 + 「強化(augments)」
//
//   形    : 投射 / レーザー / 斬撃 / 衝撃波 / 流星 / 旋回 のどれか1つ
//   効果  : ヒット時に起きること（ダメージ・燃焼・凍結…）。最大3つ
//   強化  : 形の性能を伸ばす。同じ強化は重ねがけ可（例：レーザーを+2本）。最大4つ
//
// プレイヤーのスキルも敵（ボス含む）のスキルも、同じこの定義で作られ、
// 同じ実行エンジン（action-battle.js）で発動する。
// ============================================================
(function (global) {
    const FORMS = {
        projectile: { name: "投射", icon: "🔮", cost: 20, desc: "弾を撃ち出す。遠距離向き", cd: 1.2 },
        laser:      { name: "レーザー", icon: "🔆", cost: 35, desc: "直線状の光線が敵を貫く", cd: 1.8 },
        slash:      { name: "斬撃", icon: "🌙", cost: 25, desc: "前方に超広い斬撃を放つ", cd: 1.4 },
        nova:       { name: "衝撃波", icon: "💥", cost: 30, desc: "自分を中心に周囲を吹き飛ばす", cd: 1.6 },
        meteor:     { name: "流星", icon: "☄️", cost: 38, desc: "狙った場所に隕石を降らせる。着弾まで少し遅れる範囲攻撃（増殖で落下数が増える）", cd: 2.2 },
        orbit:      { name: "旋回", icon: "🌀", cost: 32, desc: "光球が自分の周りを約3秒回り、触れた敵を連続で斬る（増殖で光球が増える）", cd: 2.0 }
    };

    // グリフ（効果）。damage以外は基本的にグリフ工房（action-skills.html）で
    // 対応する素材を組み合わせて作成するまで選べない。self:trueのものは
    // ヒットした相手ではなく発動者自身にかかる（自己強化系グリフ）。
    const EFFECTS = {
        damage:      { name: "ダメージ", icon: "⚔️", cost: 0,  desc: "敵にダメージを与える" },
        burn:        { name: "燃焼", icon: "🔥", cost: 10, desc: "3秒間継続ダメージ" },
        freeze:      { name: "凍結", icon: "❄️", cost: 10, desc: "2秒間移動速度を半減" },
        knockback:   { name: "衝撃", icon: "💨", cost: 5,  desc: "敵を大きく吹き飛ばす" },
        drain:       { name: "吸収", icon: "🩸", cost: 15, desc: "与ダメージの一部でHP回復" },
        stun:        { name: "麻痺", icon: "⚡", cost: 20, desc: "敵を1秒間行動不能にする" },
        poison:      { name: "毒", icon: "🧪", cost: 12, desc: "4秒間、燃焼とは別枠の継続ダメージ" },
        weaken:      { name: "弱体", icon: "🔻", cost: 12, desc: "3秒間、敵の攻撃力を下げる" },
        shatter:     { name: "防御破砕", icon: "🛡️‍💥", cost: 14, desc: "そのヒットだけ敵の防御力を無視しやすくする" },
        blind:       { name: "目眩まし", icon: "💫", cost: 10, desc: "2.5秒間、敵の攻撃を外れやすくする" },
        petrify:     { name: "石化", icon: "🗿", cost: 26, desc: "敵を1.6秒間、完全に行動不能にする" },
        explosion:   { name: "爆発", icon: "💥", cost: 16, desc: "命中時に追加の爆発ダメージ" },
        frostbite:   { name: "凍傷", icon: "🥶", cost: 18, desc: "継続ダメージ＋移動速度低下を同時に与える" },
        soulburn:    { name: "魂焦がし", icon: "👻🔥", cost: 22, desc: "燃焼よりずっと強い継続ダメージ" },
        voidrend:    { name: "虚空裂傷", icon: "🌌", cost: 24, desc: "吸収よりずっと多くHPを吸い取る" },
        chronowarp:  { name: "時間凍結", icon: "⏳", cost: 28, desc: "麻痺よりずっと長く敵の動きを止める" },
        gravity:     { name: "重力", icon: "🌀", cost: 14, desc: "敵を自分の方へ強く引き寄せる" },
        fortify:     { name: "鉄壁の加護", icon: "🛡️", self: true, cost: 10, desc: "3秒間、自分の防御力が上がる" },
        haste:       { name: "疾風の加護", icon: "🌬️", self: true, cost: 10, desc: "3秒間、自分の移動速度が上がる" },
        regenerate:  { name: "再生の加護", icon: "💚", self: true, cost: 14, desc: "4秒間、自分のHPが少しずつ回復する" },
        empower:     { name: "剛力の加護", icon: "💪", self: true, cost: 14, desc: "3秒間、自分の攻撃力が上がる" },
        barrier:     { name: "障壁の加護", icon: "🔵", self: true, cost: 18, desc: "一定量のダメージを肩代わりするバリアを張る" }
    };

    // forms: この強化が使える形（空なら全部）。stack: 重ねがけできる最大数
    const AUGMENTS = {
        multi:   { name: "増殖", icon: "✚", cost: 15, stack: 3, forms: [], desc: "本数・発数・回数を+1（レーザーが1本増える等）" },
        extend:  { name: "拡大", icon: "⤢", cost: 10, stack: 3, forms: [], desc: "射程・幅・半径が大きくなる" },
        amplify: { name: "増幅", icon: "⬆", cost: 10, stack: 3, forms: [], desc: "威力が+25%" },
        pierce:  { name: "貫通", icon: "➤", cost: 10, stack: 2, forms: ["projectile"], desc: "弾が敵を貫通する" },
        swift:   { name: "迅速", icon: "≫", cost: 5,  stack: 2, forms: [], desc: "弾速上昇＆クールタイム短縮" }
    };

    const MAX_EFFECTS = 3;
    const MAX_AUGMENTS = 4;

    // グリフ工房のレシピ：このグリフ（効果）を作成・解放するのに必要な素材。
    // 素材IDはclient/js/materials.jsのMATERIAL_DATAに実在するものを使用。
    // damage/burn/freeze/knockback/drain/stunは最初から使える基本グリフなので
    // レシピ不要（GLYPH_RECIPESに無いキーは「最初から解放済み」扱い）。
    const GLYPH_RECIPES = {
        poison:     [{ id: "poison_fang", count: 2 }, { id: "hydra_venom", count: 1 }],
        weaken:     [{ id: "cursed_thread", count: 2 }, { id: "dark_essence", count: 1 }],
        shatter:    [{ id: "rock_fragment", count: 2 }, { id: "titan_stone", count: 1 }],
        blind:      [{ id: "bat_wing", count: 2 }, { id: "ghost_essence", count: 1 }],
        petrify:    [{ id: "basilisk_eye", count: 1 }, { id: "chimera_eye", count: 1 }],
        explosion:  [{ id: "fire_crystal", count: 2 }, { id: "elemental_core", count: 1 }],
        frostbite:  [{ id: "ice_shard", count: 2 }, { id: "frost_core", count: 1 }],
        soulburn:   [{ id: "eternal_flame", count: 1 }, { id: "dragon_heart", count: 1 }],
        voidrend:   [{ id: "void_essence", count: 1 }, { id: "abyss_gem", count: 1 }],
        chronowarp: [{ id: "time_sand", count: 1 }, { id: "star_fragment", count: 1 }],
        gravity:    [{ id: "gravity_orb", count: 1 }, { id: "moon_stone", count: 1 }],
        fortify:    [{ id: "turtle_shell", count: 2 }, { id: "titan_stone", count: 1 }],
        haste:      [{ id: "crow_feather", count: 2 }, { id: "storm_feather", count: 1 }],
        regenerate: [{ id: "phoenix_feather", count: 1 }, { id: "herb_leaf", count: 3 }],
        empower:    [{ id: "lightning_gem", count: 2 }, { id: "storm_feather", count: 1 }],
        barrier:    [{ id: "crystal_shard", count: 2 }, { id: "elemental_core", count: 1 }]
    };
    const DEFAULT_UNLOCKED_GLYPHS = ["damage", "burn", "freeze", "knockback", "drain", "stun"];
    const KEY_GLYPHS = "sb_unlocked_glyphs";

    function loadUnlockedGlyphs() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY_GLYPHS) || "null");
            if (Array.isArray(raw) && raw.length) {
                const set = new Set(raw.concat(DEFAULT_UNLOCKED_GLYPHS));
                return Array.from(set);
            }
        } catch (e) { /* 壊れていたら初期化 */ }
        return DEFAULT_UNLOCKED_GLYPHS.slice();
    }
    function saveUnlockedGlyphs(list) { localStorage.setItem(KEY_GLYPHS, JSON.stringify(list)); }
    function isGlyphUnlocked(key) { return loadUnlockedGlyphs().indexOf(key) !== -1; }

    // 素材を消費してグリフを作成する。playerMaterials: { materialId: count, ... }
    // 戻り値: { success, reason } / 成功時は呼び出し側がplayer.materialsを更新する必要がある
    function craftGlyph(key, playerMaterials) {
        const recipe = GLYPH_RECIPES[key];
        if (!recipe) return { success: false, reason: "no_recipe" };
        if (isGlyphUnlocked(key)) return { success: false, reason: "already_unlocked" };
        for (const r of recipe) {
            if ((playerMaterials[r.id] || 0) < r.count) return { success: false, reason: "missing_material", need: r };
        }
        const consumed = {};
        recipe.forEach(r => { consumed[r.id] = r.count; });
        const unlocked = loadUnlockedGlyphs();
        unlocked.push(key);
        saveUnlockedGlyphs(unlocked);
        return { success: true, consumed: consumed };
    }

    // スキルの定義を検証・正規化する
    function normalize(skill, restrictToUnlocked) {
        const s = Object.assign({ id: "", name: "スキル", form: "projectile", effects: ["damage"], augments: [] }, skill || {});
        if (!FORMS[s.form]) s.form = "projectile";
        const unlocked = restrictToUnlocked ? loadUnlockedGlyphs() : null;
        s.effects = (s.effects || []).filter((e, i, a) => EFFECTS[e] && a.indexOf(e) === i && (!unlocked || unlocked.indexOf(e) !== -1)).slice(0, MAX_EFFECTS);
        if (!s.effects.length) s.effects = ["damage"];
        const aug = [];
        (s.augments || []).forEach(a => {
            const def = AUGMENTS[a];
            if (!def) return;
            if (def.forms.length && def.forms.indexOf(s.form) === -1) return;
            if (aug.filter(x => x === a).length >= def.stack) return;
            if (aug.length >= MAX_AUGMENTS) return;
            aug.push(a);
        });
        s.augments = aug;
        return s;
    }

    function countAug(s, key) { return s.augments.filter(a => a === key).length; }

    // 実際の性能を計算する（プレイヤーも敵も共通）
    function compute(skillInput) {
        const s = normalize(skillInput);
        const multi = countAug(s, "multi"), extend = countAug(s, "extend"),
              amplify = countAug(s, "amplify"), pierce = countAug(s, "pierce"), swift = countAug(s, "swift");

        let cost = FORMS[s.form].cost;
        s.effects.forEach(e => cost += EFFECTS[e].cost);
        s.augments.forEach(a => cost += AUGMENTS[a].cost);

        const dmgMult = (1 + 0.25 * amplify);
        const cooldown = Math.max(0.6, (FORMS[s.form].cd + cost * 0.02) * (1 - 0.15 * swift));
        const count = 1 + multi;

        const p = { form: s.form, count: count, dmgMult: dmgMult, effects: s.effects.slice() };
        if (s.form === "projectile") {
            Object.assign(p, {
                speed: 420 * (1 + 0.3 * swift), radius: 11 * (1 + 0.25 * extend),
                pierce: pierce > 0 ? 1 + pierce * 2 : 0, spread: 0.2, baseMult: 1.7, range: 640
            });
        } else if (s.form === "laser") {
            Object.assign(p, {
                length: Math.min(760, 440 * (1 + 0.3 * extend)), width: 24 * (1 + 0.2 * extend),
                spread: 0.26, baseMult: 1.9, duration: 0.35, range: 440 * (1 + 0.3 * extend)
            });
        } else if (s.form === "slash") {
            Object.assign(p, {
                radius: 135 * (1 + 0.3 * extend), arc: Math.min(Math.PI * 1.7, Math.PI * (1.05 + 0.15 * extend)),
                baseMult: 2.2, delay: 0.2, range: 135 * (1 + 0.3 * extend)
            });
        } else if (s.form === "nova") {
            Object.assign(p, {
                radius: 150 * (1 + 0.3 * extend), baseMult: 2.0, delay: 0.28, range: 150 * (1 + 0.3 * extend)
            });
        } else if (s.form === "meteor") {
            // count = 隕石の数。1発目は狙った場所、2発目以降はその周りにばらけて落ちる
            Object.assign(p, {
                radius: 85 * (1 + 0.25 * extend), baseMult: 2.4, delay: 0.55, stagger: 0.25, range: 560
            });
        } else if (s.form === "orbit") {
            // 光球が orbs 個、半径 orbitR で duration 秒まわる。同じ敵には tick 秒に1回ヒット
            Object.assign(p, {
                orbs: 2 + multi, orbitR: 95 * (1 + 0.25 * extend), duration: 3.0, tick: 0.4, spin: 4.2,
                baseMult: 0.85, range: 95 * (1 + 0.25 * extend) + 20
            });
        }
        return { skill: s, cost: Math.round(cost), cooldown: cooldown, params: p };
    }

    function describe(skillInput) {
        const c = compute(skillInput);
        const s = c.skill;
        const parts = [FORMS[s.form].name];
        if (c.params.count > 1) parts.push("×" + c.params.count);
        s.effects.forEach(e => parts.push(EFFECTS[e].name));
        const augCount = {};
        s.augments.forEach(a => augCount[a] = (augCount[a] || 0) + 1);
        Object.keys(augCount).forEach(a => parts.push(AUGMENTS[a].name + (augCount[a] > 1 ? "×" + augCount[a] : "")));
        return parts.join(" / ");
    }

    // ---------- 保存（プレイヤーデータ本体とは別のlocalStorageキーに保存する） ----------
    const KEY_SKILLS = "sb_action_skills";
    const KEY_LOADOUT = "sb_action_loadout";

    const STARTER_SKILLS = [
        { id: "starter_wide_slash", name: "ワイドスラッシュ", form: "slash", effects: ["damage"], augments: ["extend"] },
        { id: "starter_laser", name: "レーザービーム", form: "laser", effects: ["damage"], augments: [] },
        { id: "starter_fire_bolt", name: "ファイアボルト", form: "projectile", effects: ["damage", "burn"], augments: [] },
        { id: "starter_shockwave", name: "ショックウェーブ", form: "nova", effects: ["damage", "knockback"], augments: [] }
    ];

    function loadSkills() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY_SKILLS) || "null");
            if (Array.isArray(raw) && raw.length) return raw.map(normalize);
        } catch (e) { /* 壊れていたら初期スキルに戻す */ }
        return STARTER_SKILLS.map(normalize);
    }
    function saveSkills(list) { localStorage.setItem(KEY_SKILLS, JSON.stringify(list.map(normalize))); }

    function loadLoadout() {
        const skills = loadSkills();
        let ids = [];
        try { ids = JSON.parse(localStorage.getItem(KEY_LOADOUT) || "[]"); } catch (e) { ids = []; }
        if (!Array.isArray(ids) || !ids.length) ids = skills.slice(0, 4).map(s => s.id);
        return ids.slice(0, 4).map(id => skills.find(s => s.id === id) || null);
    }
    function saveLoadout(ids) { localStorage.setItem(KEY_LOADOUT, JSON.stringify((ids || []).slice(0, 4))); }
    function newId() { return "sk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    // ---------- 敵（ボス含む）のスキル ----------
    // プレイヤーと同じ形式。強い敵ほど強化がたくさん付く。
    const ENEMY_POOL = [
        { name: "衝撃波", form: "nova", effects: ["damage", "knockback"], augments: [] },
        { name: "ダークレーザー", form: "laser", effects: ["damage"], augments: [] },
        { name: "魔弾", form: "projectile", effects: ["damage"], augments: [] },
        { name: "大薙ぎ", form: "slash", effects: ["damage"], augments: ["extend"] },
        { name: "火炎弾", form: "projectile", effects: ["damage", "burn"], augments: ["multi"] },
        { name: "氷結の波動", form: "nova", effects: ["damage", "freeze"], augments: ["extend"] },
        { name: "雷光の連撃", form: "laser", effects: ["damage", "stun"], augments: ["multi"] },
        { name: "連続斬り", form: "slash", effects: ["damage"], augments: ["multi"] },
        { name: "拡散魔弾", form: "projectile", effects: ["damage"], augments: ["multi", "multi"] },
        { name: "終焉の光条", form: "laser", effects: ["damage", "burn"], augments: ["multi", "multi", "extend"] },
        { name: "破滅の大津波", form: "nova", effects: ["damage", "knockback", "stun"], augments: ["extend", "extend", "multi"] },
        { name: "冥府の大鎌", form: "slash", effects: ["damage", "drain"], augments: ["extend", "extend", "multi"] }
    ];

    // bosses.json（サーバー側データ）に元から定義されていた各ボスの固有スキルを、
    // アクションバトルの形（投射/レーザー/斬撃/衝撃波）+効果+強化に翻案したもの。
    // 名前・演出は本来のスキルをそのまま使い、「このボスだけの専用スキル」を再現する。
    const BOSS_UNIQUE_SKILLS = {
        goblin_king: [
            { name: "ゴブリンラッシュ", form: "slash", effects: ["damage"], augments: ["multi"] },
            { name: "王の号令", form: "nova", effects: ["damage", "knockback"], augments: [] }
        ],
        forest_witch: [
            { name: "呪いの霧", form: "nova", effects: ["damage", "freeze"], augments: ["extend"] },
            { name: "ヘクスボルト", form: "projectile", effects: ["damage"], augments: ["amplify"] }
        ],
        orc_warlord: [
            { name: "ウォーハンマー", form: "slash", effects: ["damage"], augments: ["amplify"] },
            { name: "ウォークライ", form: "nova", effects: ["damage", "knockback"], augments: ["extend"] }
        ],
        rock_troll: [
            { name: "ロックスマッシュ", form: "slash", effects: ["damage", "knockback"], augments: ["amplify"] },
            { name: "石化の咆哮", form: "nova", effects: ["damage", "freeze"], augments: ["extend"] }
        ],
        shadow_serpent: [
            { name: "ポイズンバイト", form: "projectile", effects: ["damage", "burn"], augments: [] },
            { name: "シャドウダイブ", form: "slash", effects: ["damage"], augments: ["swift"] }
        ],
        sand_worm: [
            { name: "サンドストーム", form: "nova", effects: ["damage", "freeze"], augments: ["extend"] },
            { name: "バーストダイブ", form: "projectile", effects: ["damage"], augments: ["amplify", "swift"] }
        ],
        ice_golem: [
            { name: "アイスプリズン", form: "nova", effects: ["damage", "freeze"], augments: ["extend", "extend"] },
            { name: "ブリザードブレス", form: "laser", effects: ["damage", "freeze"], augments: ["amplify"] }
        ],
        thunder_garuda: [
            { name: "サンダーストライク", form: "laser", effects: ["damage", "stun"], augments: ["amplify"] },
            { name: "疾風の舞", form: "projectile", effects: ["damage"], augments: ["swift", "swift"] }
        ],
        flame_dragon: [
            { name: "インフェルノ", form: "nova", effects: ["damage", "burn"], augments: ["amplify", "extend"] },
            { name: "ドラゴニックロア", form: "laser", effects: ["damage", "burn"], augments: ["extend"] }
        ],
        kraken: [
            { name: "テンタクルバインド", form: "nova", effects: ["damage", "stun"], augments: ["extend"] },
            { name: "深海の渦潮", form: "nova", effects: ["damage", "knockback"], augments: ["amplify", "extend"] }
        ],
        abyssal_knight: [
            { name: "ソウルドレイン", form: "slash", effects: ["damage", "drain"], augments: [] },
            { name: "ヴォイドスラッシュ", form: "slash", effects: ["damage"], augments: ["amplify", "amplify"] }
        ],
        blood_count: [
            { name: "ブラッドサック", form: "projectile", effects: ["damage", "drain"], augments: [] },
            { name: "ミッドナイトウェイブ", form: "nova", effects: ["damage"], augments: ["amplify", "amplify", "extend"] }
        ],
        celestial_guardian: [
            { name: "ジャッジメント", form: "laser", effects: ["damage", "stun"], augments: ["amplify", "amplify"] },
            { name: "スターアルケミー", form: "nova", effects: ["damage", "knockback"], augments: ["extend", "multi"] }
        ],
        fallen_lucifer: [
            { name: "ダークジャッジメント", form: "laser", effects: ["damage", "burn"], augments: ["amplify", "amplify", "multi"] },
            { name: "フォールンプロテクション", form: "nova", effects: ["damage", "stun"], augments: ["extend", "extend"] }
        ],
        abyss_warden: [
            { name: "ジ・インファーナル", form: "laser", effects: ["damage", "burn"], augments: ["amplify", "amplify", "multi", "extend"] },
            { name: "アフェスト・ベルゼバブ", form: "nova", effects: ["damage", "knockback", "stun"], augments: ["extend", "extend", "multi"] }
        ]
    };

    function hashStr(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    // tier: "normal" | "elite" | "boss"
    function enemySkillsFor(enemyId, tier) {
        // 地域ボスは、本来のbosses.jsonに定義されている自分専用のスキルを使う
        if (tier === "boss" && BOSS_UNIQUE_SKILLS[enemyId]) {
            return BOSS_UNIQUE_SKILLS[enemyId].map((s, i) => normalize(Object.assign({ id: "boss_" + enemyId + "_" + i }, s)));
        }

        const h = hashStr(String(enemyId || "x"));
        const pick = (offset, from, to) => {
            const span = to - from + 1;
            return ENEMY_POOL[from + ((h >> offset) + offset * 7) % span];
        };
        const out = [];
        if (tier === "boss") {
            out.push(pick(0, 4, 8), pick(3, 6, 10), pick(5, 8, 11));
        } else if (tier === "elite") {
            out.push(pick(0, 0, 5), pick(4, 3, 8));
        } else {
            if (h % 5 !== 0) out.push(pick(0, 0, 3));
        }
        return out.map((s, i) => normalize(Object.assign({ id: "enemy_" + i }, s)));
    }

    global.ActionSkills = {
        FORMS, EFFECTS, AUGMENTS, MAX_EFFECTS, MAX_AUGMENTS,
        normalize, compute, describe,
        loadSkills, saveSkills, loadLoadout, saveLoadout, newId,
        enemySkillsFor,
        GLYPH_RECIPES, DEFAULT_UNLOCKED_GLYPHS,
        loadUnlockedGlyphs, isGlyphUnlocked, craftGlyph
    };
})(window);
