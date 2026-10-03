// ============================================================
// アクションバトル用 モジュール式スキル（アルスヌーボー風）
//
//   スキル = 「形(form)」 + 「効果(effects)」 + 「強化(augments)」
//
//   形    : 投射 / レーザー / 斬撃 / 衝撃波 のどれか1つ
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
        nova:       { name: "衝撃波", icon: "💥", cost: 30, desc: "自分を中心に周囲を吹き飛ばす", cd: 1.6 }
    };

    const EFFECTS = {
        damage:    { name: "ダメージ", icon: "⚔️", cost: 0,  desc: "敵にダメージを与える" },
        burn:      { name: "燃焼", icon: "🔥", cost: 10, desc: "3秒間継続ダメージ" },
        freeze:    { name: "凍結", icon: "❄️", cost: 10, desc: "2秒間移動速度を半減" },
        knockback: { name: "衝撃", icon: "💨", cost: 5,  desc: "敵を大きく吹き飛ばす" },
        drain:     { name: "吸収", icon: "🩸", cost: 15, desc: "与ダメージの一部でHP回復" },
        stun:      { name: "麻痺", icon: "⚡", cost: 20, desc: "敵を1秒間行動不能にする" }
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

    // スキルの定義を検証・正規化する
    function normalize(skill) {
        const s = Object.assign({ id: "", name: "スキル", form: "projectile", effects: ["damage"], augments: [] }, skill || {});
        if (!FORMS[s.form]) s.form = "projectile";
        s.effects = (s.effects || []).filter((e, i, a) => EFFECTS[e] && a.indexOf(e) === i).slice(0, MAX_EFFECTS);
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

    function hashStr(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    // tier: "normal" | "elite" | "boss"
    function enemySkillsFor(enemyId, tier) {
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
        enemySkillsFor
    };
})(window);
