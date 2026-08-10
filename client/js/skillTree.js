// ============================================
// スキルツリーシステム
// Path of Exile style extensive skill trees
// ============================================

// スキルポイント獲得量（レベルアップごと）
const SKILL_POINTS_PER_LEVEL = 2;

// 武器種別ごとのスキルツリー定義
const SKILL_TREES = {
    sword_shield: {
        name: "片手剣＋盾",
        description: "防御と攻撃のバランスを重視したスキルツリー",
        nodes: [
            // 基礎ステータスノード
            { id: "ss_hp_1", name: "体力強化", description: "HP+5", effect: { maxHp: 5 }, cost: 1, x: 0, y: 0, type: "stat" },
            { id: "ss_hp_2", name: "体力強化II", description: "HP+10", effect: { maxHp: 10 }, cost: 2, x: 0, y: 1, requires: "ss_hp_1", type: "stat" },
            { id: "ss_hp_3", name: "体力強化III", description: "HP+15", effect: { maxHp: 15 }, cost: 3, x: 0, y: 2, requires: "ss_hp_2", type: "stat" },
            
            { id: "ss_def_1", name: "防御強化", description: "防御+5", effect: { def: 5 }, cost: 1, x: 1, y: 0, type: "stat" },
            { id: "ss_def_2", name: "防御強化II", description: "防御+10", effect: { def: 10 }, cost: 2, x: 1, y: 1, requires: "ss_def_1", type: "stat" },
            { id: "ss_def_3", name: "防御強化III", description: "防御+15", effect: { def: 15 }, cost: 3, x: 1, y: 2, requires: "ss_def_2", type: "stat" },
            
            { id: "ss_atk_1", name: "攻撃強化", description: "攻撃+5", effect: { atk: 5 }, cost: 1, x: -1, y: 0, type: "stat" },
            { id: "ss_atk_2", name: "攻撃強化II", description: "攻撃+10", effect: { atk: 10 }, cost: 2, x: -1, y: 1, requires: "ss_atk_1", type: "stat" },
            { id: "ss_atk_3", name: "攻撃強化III", description: "攻撃+15", effect: { atk: 15 }, cost: 3, x: -1, y: 2, requires: "ss_atk_2", type: "stat" },
            
            // アクティブスキルノード
            { id: "ss_shield_bash", name: "シールドバッシュ", description: "次の攻撃のダメージ1.2倍", effect: { type: "active", damageMultiplier: 1.2 }, cost: 3, x: 2, y: 1, requires: "ss_def_2", type: "active" },
            { id: "ss_guard_stance", name: "ガードスタンス", description: "次に受けるダメージを30%軽減", effect: { type: "active", damageReduction: 0.3 }, cost: 3, x: 2, y: 2, requires: "ss_shield_bash", type: "active" },
            { id: "ss_counter", name: "カウンター", description: "攻撃を受けた後、次の攻撃のダメージ1.5倍", effect: { type: "active", counterAttack: 1.5 }, cost: 4, x: 3, y: 2, requires: "ss_guard_stance", type: "active" },
            
            { id: "ss_heavy_strike", name: "ヘヴィストライク", description: "次の攻撃のダメージ1.3倍", effect: { type: "active", damageMultiplier: 1.3 }, cost: 3, x: -2, y: 1, requires: "ss_atk_2", type: "active" },
            { id: "ss_berserk", name: "バーサーク", description: "HPが50%以下の時、次の攻撃のダメージ2倍", effect: { type: "active", berserk: 2.0 }, cost: 4, x: -2, y: 2, requires: "ss_heavy_strike", type: "active" },
            
            // パッシブスキルノード
            { id: "ss_iron_skin", name: "アイアンスキン", description: "常時防御+10", effect: { type: "passive", def: 10 }, cost: 4, x: 0, y: 3, requires: ["ss_hp_3", "ss_def_3"], type: "passive" },
            { id: "ss_weapon_mastery", name: "ウェポンマスタリー", description: "常時攻撃+10", effect: { type: "passive", atk: 10 }, cost: 4, x: -1, y: 3, requires: "ss_atk_3", type: "passive" },
            { id: "ss_fortress", name: "要塞", description: "常時HP+20、防御+5", effect: { type: "passive", maxHp: 20, def: 5 }, cost: 5, x: 1, y: 3, requires: "ss_iron_skin", type: "passive" },
        ]
    },
    
    spear: {
        name: "長槍",
        description: "攻撃と速さを重視したスキルツリー",
        nodes: [
            { id: "sp_atk_1", name: "攻撃強化", description: "攻撃+5", effect: { atk: 5 }, cost: 1, x: 0, y: 0, type: "stat" },
            { id: "sp_atk_2", name: "攻撃強化II", description: "攻撃+10", effect: { atk: 10 }, cost: 2, x: 0, y: 1, requires: "sp_atk_1", type: "stat" },
            { id: "sp_atk_3", name: "攻撃強化III", description: "攻撃+15", effect: { atk: 15 }, cost: 3, x: 0, y: 2, requires: "sp_atk_2", type: "stat" },
            
            { id: "sp_speed_1", name: "速さ強化", description: "速さ+5", effect: { speed: 5 }, cost: 1, x: 1, y: 0, type: "stat" },
            { id: "sp_speed_2", name: "速さ強化II", description: "速さ+10", effect: { speed: 10 }, cost: 2, x: 1, y: 1, requires: "sp_speed_1", type: "stat" },
            { id: "sp_speed_3", name: "速さ強化III", description: "速さ+15", effect: { speed: 15 }, cost: 3, x: 1, y: 2, requires: "sp_speed_2", type: "stat" },
            
            { id: "sp_pierce", name: "ピアス", description: "次の攻撃が相手の防御を50%無視", effect: { type: "active", pierceDef: 0.5 }, cost: 3, x: 2, y: 1, requires: "sp_atk_2", type: "active" },
            { id: "sp_charge", name: "チャージ", description: "次の攻撃のダメージ1.4倍", effect: { type: "active", damageMultiplier: 1.4 }, cost: 3, x: 2, y: 2, requires: "sp_pierce", type: "active" },
            { id: "sp_spear_throw", name: "スロウ", description: "次の攻撃のダメージ1.3倍、相手の速さを一時的に低下", effect: { type: "active", damageMultiplier: 1.3, slowEnemy: true }, cost: 4, x: 3, y: 2, requires: "sp_charge", type: "active" },
            
            { id: "sp_agility", name: "アジリティ", description: "次の攻撃の命中率大幅上昇", effect: { type: "active", accuracyBoost: true }, cost: 3, x: -1, y: 1, requires: "sp_speed_2", type: "active" },
            { id: "sp_evasion", name: "エヴェイジョン", description: "次の攻撃を50%の確率で回避", effect: { type: "active", evasionChance: 0.5 }, cost: 4, x: -1, y: 2, requires: "sp_agility", type: "active" },
            
            { id: "sp_combat_mastery", name: "コンバットマスタリー", description: "常時攻撃+15、速さ+5", effect: { type: "passive", atk: 15, speed: 5 }, cost: 5, x: 0, y: 3, requires: ["sp_atk_3", "sp_speed_3"], type: "passive" },
            { id: "sp_lancer", name: "ランサー", description: "常時攻撃+20", effect: { type: "passive", atk: 20 }, cost: 4, x: 1, y: 3, requires: "sp_speed_3", type: "passive" },
        ]
    },
    
    greatsword: {
        name: "大剣",
        description: "攻撃力特化のスキルツリー",
        nodes: [
            { id: "gs_atk_1", name: "攻撃強化", description: "攻撃+8", effect: { atk: 8 }, cost: 1, x: 0, y: 0, type: "stat" },
            { id: "gs_atk_2", name: "攻撃強化II", description: "攻撃+15", effect: { atk: 15 }, cost: 2, x: 0, y: 1, requires: "gs_atk_1", type: "stat" },
            { id: "gs_atk_3", name: "攻撃強化III", description: "攻撃+25", effect: { atk: 25 }, cost: 3, x: 0, y: 2, requires: "gs_atk_2", type: "stat" },
            
            { id: "gs_hp_1", name: "体力強化", description: "HP+10", effect: { maxHp: 10 }, cost: 1, x: 1, y: 0, type: "stat" },
            { id: "gs_hp_2", name: "体力強化II", description: "HP+20", effect: { maxHp: 20 }, cost: 2, x: 1, y: 1, requires: "gs_hp_1", type: "stat" },
            
            { id: "gs_power_strike", name: "パワーストライク", description: "次の攻撃のダメージ1.5倍", effect: { type: "active", damageMultiplier: 1.5 }, cost: 3, x: 2, y: 1, requires: "gs_atk_2", type: "active" },
            { id: "gs_cleave", name: "クリーブ", description: "次の攻撃のダメージ1.6倍", effect: { type: "active", damageMultiplier: 1.6 }, cost: 4, x: 2, y: 2, requires: "gs_power_strike", type: "active" },
            { id: "gs_execute", name: "エクスキュート", description: "相手のHPが30%以下の時、次の攻撃のダメージ2.5倍", effect: { type: "active", execute: 2.5 }, cost: 5, x: 3, y: 2, requires: "gs_cleave", type: "active" },
            
            { id: "gs_rage", name: "レイジ", description: "HPが減るほど攻撃力上昇", effect: { type: "active", rage: true }, cost: 4, x: -1, y: 1, requires: "gs_hp_2", type: "active" },
            { id: "gs_blood_thirst", name: "ブラッドサースト", description: "攻撃時に与えたダメージの10%回復", effect: { type: "active", lifeSteal: 0.1 }, cost: 4, x: -1, y: 2, requires: "gs_rage", type: "active" },
            
            { id: "gs_giant_strength", name: "ジャイアントストレングス", description: "常時攻撃+30", effect: { type: "passive", atk: 30 }, cost: 5, x: 0, y: 3, requires: "gs_atk_3", type: "passive" },
            { id: "gs_titan", name: "タイタン", description: "常時攻撃+25、HP+30", effect: { type: "passive", atk: 25, maxHp: 30 }, cost: 6, x: 1, y: 3, requires: ["gs_hp_2", "gs_giant_strength"], type: "passive" },
        ]
    },
    
    dual_swords: {
        name: "双剣",
        description: "速さと連続攻撃を重視したスキルツリー",
        nodes: [
            { id: "ds_speed_1", name: "速さ強化", description: "速さ+8", effect: { speed: 8 }, cost: 1, x: 0, y: 0, type: "stat" },
            { id: "ds_speed_2", name: "速さ強化II", description: "速さ+15", effect: { speed: 15 }, cost: 2, x: 0, y: 1, requires: "ds_speed_1", type: "stat" },
            { id: "ds_speed_3", name: "速さ強化III", description: "速さ+25", effect: { speed: 25 }, cost: 3, x: 0, y: 2, requires: "ds_speed_2", type: "stat" },
            
            { id: "ds_atk_1", name: "攻撃強化", description: "攻撃+5", effect: { atk: 5 }, cost: 1, x: 1, y: 0, type: "stat" },
            { id: "ds_atk_2", name: "攻撃強化II", description: "攻撃+10", effect: { atk: 10 }, cost: 2, x: 1, y: 1, requires: "ds_atk_1", type: "stat" },
            
            { id: "ds_dual_strike", name: "デュアルストライク", description: "次の攻撃のダメージ1.3倍", effect: { type: "active", damageMultiplier: 1.3 }, cost: 3, x: 2, y: 1, requires: "ds_atk_2", type: "active" },
            { id: "ds_blade_dance", name: "ブレードダンス", description: "次の攻撃のダメージ1.4倍", effect: { type: "active", damageMultiplier: 1.4 }, cost: 3, x: 2, y: 2, requires: "ds_dual_strike", type: "active" },
            { id: "ds_phantom_blade", name: "ファントムブレード", description: "次の攻撃のダメージ1.8倍、回避率無視", effect: { type: "active", damageMultiplier: 1.8, ignoreEvasion: true }, cost: 5, x: 3, y: 2, requires: "ds_blade_dance", type: "active" },
            
            { id: "ds_quick_step", name: "クイックステップ", description: "次の攻撃の回避率+20%", effect: { type: "active", evasionBoost: 0.2 }, cost: 3, x: -1, y: 1, requires: "ds_speed_2", type: "active" },
            { id: "ds_wind_walker", name: "ウィンドウォーカー", description: "次の2回の攻撃を50%確率で回避", effect: { type: "active", doubleEvasion: 0.5 }, cost: 4, x: -1, y: 2, requires: "ds_quick_step", type: "active" },
            
            { id: "ds_blade_master", name: "ブレードマスター", description: "常時攻撃+15、速さ+15", effect: { type: "passive", atk: 15, speed: 15 }, cost: 5, x: 0, y: 3, requires: ["ds_speed_3", "ds_atk_2"], type: "passive" },
            { id: "ds_assassin", name: "アサシン", description: "常時速さ+30", effect: { type: "passive", speed: 30 }, cost: 4, x: 1, y: 3, requires: "ds_speed_3", type: "passive" },
        ]
    },
    
    scythe: {
        name: "鎌",
        description: "全ステータスバランス型のスキルツリー",
        nodes: [
            { id: "sc_all_1", name: "全ステ強化", description: "全ステータス+3", effect: { maxHp: 3, atk: 3, def: 3, speed: 3 }, cost: 2, x: 0, y: 0, type: "stat" },
            { id: "sc_all_2", name: "全ステ強化II", description: "全ステータス+6", effect: { maxHp: 6, atk: 6, def: 6, speed: 6 }, cost: 3, x: 0, y: 1, requires: "sc_all_1", type: "stat" },
            { id: "sc_all_3", name: "全ステ強化III", description: "全ステータス+10", effect: { maxHp: 10, atk: 10, def: 10, speed: 10 }, cost: 4, x: 0, y: 2, requires: "sc_all_2", type: "stat" },
            
            { id: "sc_soul_reap", name: "ソウルリープ", description: "次の攻撃のダメージ1.2倍、与ダメージの15%回復", effect: { type: "active", damageMultiplier: 1.2, lifeSteal: 0.15 }, cost: 4, x: 1, y: 1, requires: "sc_all_2", type: "active" },
            { id: "sc_death_scythe", name: "デスサイズ", description: "次の攻撃のダメージ1.5倍", effect: { type: "active", damageMultiplier: 1.5 }, cost: 4, x: 2, y: 1, requires: "sc_soul_reap", type: "active" },
            { id: "sc_grim_reaper", name: "グリムリーパー", description: "相手のHPが20%以下の時、次の攻撃で即死確率30%", effect: { type: "active", instantDeathChance: 0.3 }, cost: 6, x: 3, y: 1, requires: "sc_death_scythe", type: "active" },
            
            { id: "sc_curse", name: "カース", description: "相手の全ステータスを一時的に10%低下", effect: { type: "active", curse: 0.1 }, cost: 4, x: -1, y: 1, requires: "sc_all_2", type: "active" },
            { id: "sc_doom", name: "ドゥーム", description: "相手の全ステータスを一時的に20%低下", effect: { type: "active", curse: 0.2 }, cost: 5, x: -2, y: 1, requires: "sc_curse", type: "active" },
            
            { id: "sc_reaper_form", name: "リーパーフォーム", description: "常時全ステータス+15", effect: { type: "passive", maxHp: 15, atk: 15, def: 15, speed: 15 }, cost: 6, x: 0, y: 3, requires: "sc_all_3", type: "passive" },
            { id: "sc_immortal", name: "イモータル", description: "常時HP+40", effect: { type: "passive", maxHp: 40 }, cost: 4, x: 1, y: 3, requires: "sc_all_3", type: "passive" },
        ]
    },
    
    pistol: {
        name: "ピストル",
        description: "速さとHPを重視したスキルツリー",
        nodes: [
            { id: "pi_speed_1", name: "速さ強化", description: "速さ+8", effect: { speed: 8 }, cost: 1, x: 0, y: 0, type: "stat" },
            { id: "pi_speed_2", name: "速さ強化II", description: "速さ+15", effect: { speed: 15 }, cost: 2, x: 0, y: 1, requires: "pi_speed_1", type: "stat" },
            { id: "pi_speed_3", name: "速さ強化III", description: "速さ+25", effect: { speed: 25 }, cost: 3, x: 0, y: 2, requires: "pi_speed_2", type: "stat" },
            
            { id: "pi_hp_1", name: "体力強化", description: "HP+10", effect: { maxHp: 10 }, cost: 1, x: 1, y: 0, type: "stat" },
            { id: "pi_hp_2", name: "体力強化II", description: "HP+20", effect: { maxHp: 20 }, cost: 2, x: 1, y: 1, requires: "pi_hp_1", type: "stat" },
            
            { id: "pi_quick_draw", name: "クイックドロー", description: "次の攻撃のダメージ1.3倍、先制攻撃", effect: { type: "active", damageMultiplier: 1.3, firstStrike: true }, cost: 3, x: 2, y: 1, requires: "pi_speed_2", type: "active" },
            { id: "pi_rapid_fire", name: "ラピッドファイア", description: "次の攻撃のダメージ1.4倍", effect: { type: "active", damageMultiplier: 1.4 }, cost: 3, x: 2, y: 2, requires: "pi_quick_draw", type: "active" },
            { id: "pi_headshot", name: "ヘッドショット", description: "次の攻撃のダメージ2.0倍、命中率低下", effect: { type: "active", damageMultiplier: 2.0, accuracyPenalty: 0.2 }, cost: 5, x: 3, y: 2, requires: "pi_rapid_fire", type: "active" },
            
            { id: "pi_dodge", name: "ドッジ", description: "次の攻撃を40%確率で回避", effect: { type: "active", evasionChance: 0.4 }, cost: 3, x: -1, y: 1, requires: "pi_hp_2", type: "active" },
            { id: "pi_roll", name: "ロール", description: "次の2回の攻撃を30%確率で回避", effect: { type: "active", doubleEvasion: 0.3 }, cost: 4, x: -1, y: 2, requires: "pi_dodge", type: "active" },
            
            { id: "pi_gunslinger", name: "ガンスリンガー", description: "常時速さ+20、HP+15", effect: { type: "passive", speed: 20, maxHp: 15 }, cost: 5, x: 0, y: 3, requires: ["pi_speed_3", "pi_hp_2"], type: "passive" },
            { id: "pi_survivor", name: "サバイバー", description: "常時HP+30", effect: { type: "passive", maxHp: 30 }, cost: 4, x: 1, y: 3, requires: "pi_hp_2", type: "passive" },
        ]
    },
    
    katana: {
        name: "刀",
        description: "防御と速さを重視したスキルツリー",
        nodes: [
            { id: "ka_def_1", name: "防御強化", description: "防御+8", effect: { def: 8 }, cost: 1, x: 0, y: 0, type: "stat" },
            { id: "ka_def_2", name: "防御強化II", description: "防御+15", effect: { def: 15 }, cost: 2, x: 0, y: 1, requires: "ka_def_1", type: "stat" },
            { id: "ka_def_3", name: "防御強化III", description: "防御+25", effect: { def: 25 }, cost: 3, x: 0, y: 2, requires: "ka_def_2", type: "stat" },
            
            { id: "ka_speed_1", name: "速さ強化", description: "速さ+8", effect: { speed: 8 }, cost: 1, x: 1, y: 0, type: "stat" },
            { id: "ka_speed_2", name: "速さ強化II", description: "速さ+15", effect: { speed: 15 }, cost: 2, x: 1, y: 1, requires: "ka_speed_1", type: "stat" },
            
            { id: "ka_iaigiri", name: "居合斬り", description: "次の攻撃のダメージ1.4倍", effect: { type: "active", damageMultiplier: 1.4 }, cost: 3, x: 2, y: 1, requires: "ka_speed_2", type: "active" },
            { id: "ka_issen", name: "一閃", description: "次の攻撃のダメージ1.6倍、回避率無視", effect: { type: "active", damageMultiplier: 1.6, ignoreEvasion: true }, cost: 4, x: 2, y: 2, requires: "ka_iaigiri", type: "active" },
            { id: "ka_muramasa", name: "村正", description: "次の攻撃のダメージ2.0倍、自分も10%ダメージ", effect: { type: "active", damageMultiplier: 2.0, selfDamage: 0.1 }, cost: 5, x: 3, y: 2, requires: "ka_issen", type: "active" },
            
            { id: "ka_parry", name: "パリー", description: "次の攻撃を50%確率で無効化", effect: { type: "active", parryChance: 0.5 }, cost: 3, x: -1, y: 1, requires: "ka_def_2", type: "active" },
            { id: "ka_counter_stance", name: "カウンタースタンス", description: "攻撃を無効化した場合、反撃で1.5倍ダメージ", effect: { type: "active", counterParry: 1.5 }, cost: 4, x: -1, y: 2, requires: "ka_parry", type: "active" },
            
            { id: "ka_samurai", name: "サムライ", description: "常時防御+20、速さ+10", effect: { type: "passive", def: 20, speed: 10 }, cost: 5, x: 0, y: 3, requires: ["ka_def_3", "ka_speed_2"], type: "passive" },
            { id: "ka_bushido", name: "武士道", description: "常時防御+30", effect: { type: "passive", def: 30 }, cost: 4, x: 1, y: 3, requires: "ka_def_3", type: "passive" },
        ]
    },
    
    magic_wand: {
        name: "魔法の杖",
        description: "攻撃とHPを重視したスキルツリー",
        nodes: [
            { id: "mw_atk_1", name: "攻撃強化", description: "攻撃+8", effect: { atk: 8 }, cost: 1, x: 0, y: 0, type: "stat" },
            { id: "mw_atk_2", name: "攻撃強化II", description: "攻撃+15", effect: { atk: 15 }, cost: 2, x: 0, y: 1, requires: "mw_atk_1", type: "stat" },
            { id: "mw_atk_3", name: "攻撃強化III", description: "攻撃+25", effect: { atk: 25 }, cost: 3, x: 0, y: 2, requires: "mw_atk_2", type: "stat" },
            
            { id: "mw_hp_1", name: "体力強化", description: "HP+10", effect: { maxHp: 10 }, cost: 1, x: 1, y: 0, type: "stat" },
            { id: "mw_hp_2", name: "体力強化II", description: "HP+20", effect: { maxHp: 20 }, cost: 2, x: 1, y: 1, requires: "mw_hp_1", type: "stat" },
            
            { id: "mw_fireball", name: "ファイアボール", description: "次の攻撃のダメージ1.4倍", effect: { type: "active", damageMultiplier: 1.4 }, cost: 3, x: 2, y: 1, requires: "mw_atk_2", type: "active" },
            { id: "mw_meteor", name: "メテオ", description: "次の攻撃のダメージ1.7倍", effect: { type: "active", damageMultiplier: 1.7 }, cost: 4, x: 2, y: 2, requires: "mw_fireball", type: "active" },
            { id: "mw_apocalypse", name: "アポカリプス", description: "次の攻撃のダメージ2.2倍", effect: { type: "active", damageMultiplier: 2.2 }, cost: 6, x: 3, y: 2, requires: "mw_meteor", type: "active" },
            
            { id: "mw_heal", name: "ヒール", description: "HPを20%回復", effect: { type: "active", healPercent: 0.2 }, cost: 3, x: -1, y: 1, requires: "mw_hp_2", type: "active" },
            { id: "mw_regenerate", name: "リジェネレート", description: "HPを30%回復", effect: { type: "active", healPercent: 0.3 }, cost: 4, x: -1, y: 2, requires: "mw_heal", type: "active" },
            
            { id: "mw_archmage", name: "アークメイジ", description: "常時攻撃+25、HP+20", effect: { type: "passive", atk: 25, maxHp: 20 }, cost: 5, x: 0, y: 3, requires: ["mw_atk_3", "mw_hp_2"], type: "passive" },
            { id: "mw_wizard", name: "ウィザード", description: "常時攻撃+30", effect: { type: "passive", atk: 30 }, cost: 4, x: 1, y: 3, requires: "mw_atk_3", type: "passive" },
        ]
    }
};

// カスタムスキル作成コスト
const CUSTOM_SKILL_COST = 100;

// カスタムスキルのバリデーションルール
const CUSTOM_SKILL_VALIDATION = {
    // 禁止される効果（ゲームバランスを崩壊させるもの）
    bannedEffects: [
        "instantDeath", // 即死
        "fullHeal", // 完全回復
        "infiniteDamage", // 無限ダメージ
        "invincible", // 無敵
        "stealWeapon", // 武器奪取
        "deleteEnemy", // 敵削除
        "setEnemyStatsToZero", // 敵ステータス0化
        "multiplyStatsByLargeAmount", // ステータス大幅増加
    ],
    
    // 効果の強度に基づく必要ステータス合計値
    statRequirements: {
        weak: { totalStats: 200, maxMultiplier: 1.1 },
        medium: { totalStats: 400, maxMultiplier: 1.3 },
        strong: { totalStats: 600, maxMultiplier: 1.5 },
        veryStrong: { totalStats: 800, maxMultiplier: 1.8 },
        extreme: { totalStats: 1000, maxMultiplier: 2.0 }
    }
};

// プレイヤーのスキルデータ初期化
function initializeSkillData(player) {
    if (!player.skillTrees) {
        player.skillTrees = {};
    }
    
    // 全武器種のスキルツリーを初期化
    for (const weaponType in SKILL_TREES) {
        if (!player.skillTrees[weaponType]) {
            player.skillTrees[weaponType] = {
                unlockedNodes: [], // アンロックしたノードIDのリスト
                availablePoints: 0 // その武器種で使用可能なスキルポイント
            };
        }
    }
    
    // 総スキルポイントを初期化
    if (player.totalSkillPoints == null) {
        player.totalSkillPoints = 0;
    }
    
    return player;
}

// レベルアップ時のスキルポイント付与
function addSkillPointsOnLevelUp(player, oldLevel, newLevel) {
    const levelsGained = newLevel - oldLevel;
    const pointsGained = levelsGained * SKILL_POINTS_PER_LEVEL;
    
    player.totalSkillPoints = (player.totalSkillPoints || 0) + pointsGained;
    
    // 全武器種の使用可能ポイントを増加
    player = initializeSkillData(player);
    for (const weaponType in player.skillTrees) {
        player.skillTrees[weaponType].availablePoints += pointsGained;
    }
    
    return player;
}

// スキルノードのアンロック
function unlockSkillNode(player, weaponType, nodeId) {
    player = initializeSkillData(player);
    
    const skillTree = SKILL_TREES[weaponType];
    if (!skillTree) {
        return { success: false, error: "不明な武器種です" };
    }
    
    const node = skillTree.nodes.find(n => n.id === nodeId);
    if (!node) {
        return { success: false, error: "不明なスキルノードです" };
    }
    
    const playerTreeData = player.skillTrees[weaponType];
    
    // 既にアンロック済み
    if (playerTreeData.unlockedNodes.includes(nodeId)) {
        return { success: false, error: "既にアンロック済みです" };
    }
    
    // スキルポイント不足
    if (playerTreeData.availablePoints < node.cost) {
        return { success: false, error: `スキルポイントが不足しています（必要: ${node.cost}、所持: ${playerTreeData.availablePoints}）` };
    }
    
    // 前提条件チェック
    if (node.requires) {
        const requirements = Array.isArray(node.requires) ? node.requires : [node.requires];
        for (const reqId of requirements) {
            if (!playerTreeData.unlockedNodes.includes(reqId)) {
                return { success: false, error: "前提条件を満たしていません" };
            }
        }
    }
    
    // アンロック処理
    playerTreeData.unlockedNodes.push(nodeId);
    playerTreeData.availablePoints -= node.cost;
    
    return { success: true, player };
}

// スキルノードの効果を取得
function getSkillNodeEffects(player, weaponType) {
    player = initializeSkillData(player);
    
    const effects = {
        passive: { maxHp: 0, atk: 0, def: 0, speed: 0 },
        active: []
    };
    
    const playerTreeData = player.skillTrees[weaponType];
    if (!playerTreeData) return effects;
    
    const skillTree = SKILL_TREES[weaponType];
    if (!skillTree) return effects;
    
    for (const nodeId of playerTreeData.unlockedNodes) {
        const node = skillTree.nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        if (node.type === "stat" || node.type === "passive") {
            // パッシブ効果を適用
            for (const stat in node.effect) {
                if (stat !== "type" && effects.passive[stat] !== undefined) {
                    effects.passive[stat] += node.effect[stat];
                }
            }
        } else if (node.type === "active") {
            // アクティブスキルをリストに追加
            effects.active.push({
                id: node.id,
                name: node.name,
                description: node.description,
                effect: node.effect
            });
        }
    }
    
    return effects;
}

// スキル効果をステータスに適用
function applySkillEffectsToStats(baseStats, player, weaponType) {
    const effects = getSkillNodeEffects(player, weaponType);
    
    const stats = { ...baseStats };
    stats.maxHp += effects.passive.maxHp;
    stats.atk += effects.passive.atk;
    stats.def += effects.passive.def;
    stats.speed += effects.passive.speed;
    
    return stats;
}

// カスタムスキルのバリデーション
function validateCustomSkill(skillDescription, playerStats) {
    const totalStats = playerStats.maxHp + playerStats.atk + playerStats.def + playerStats.speed;
    
    // 禁止効果チェック
    for (const banned of CUSTOM_SKILL_VALIDATION.bannedEffects) {
        if (skillDescription.toLowerCase().includes(banned.toLowerCase())) {
            return { 
                valid: false, 
                reason: `この効果はゲームバランスを崩壊させるため許可されていません: ${banned}` 
            };
        }
    }
    
    // 効果の強度を推定（簡易的なキーワードベース）
    let estimatedStrength = "weak";
    const desc = skillDescription.toLowerCase();
    
    if (desc.includes("2倍") || desc.includes("2.0") || desc.includes("double")) {
        estimatedStrength = "strong";
    } else if (desc.includes("1.5") || desc.includes("1.5倍") || desc.includes("50%")) {
        estimatedStrength = "medium";
    } else if (desc.includes("1.8") || desc.includes("1.8倍")) {
        estimatedStrength = "veryStrong";
    } else if (desc.includes("2.2") || desc.includes("2.2倍") || desc.includes("2.5")) {
        estimatedStrength = "extreme";
    }
    
    const requirement = CUSTOM_SKILL_VALIDATION.statRequirements[estimatedStrength];
    
    if (totalStats < requirement.totalStats) {
        return { 
            valid: false, 
            reason: `ステータスが不足しています。必要: 合計${requirement.totalStats}、現在: 合計${totalStats}` 
        };
    }
    
    return { valid: true, strength: estimatedStrength };
}

// カスタムスキルの作成
function createCustomSkill(player, skillName, skillDescription, effect) {
    // コインチェック
    if ((player.coins || 0) < CUSTOM_SKILL_COST) {
        return { success: false, error: `コインが不足しています（必要: ${CUSTOM_SKILL_COST}）` };
    }
    
    // ステータスチェック
    const stats = getStatsFromPlayer(player);
    const validation = validateCustomSkill(skillDescription, stats);
    
    if (!validation.valid) {
        return { success: false, error: validation.reason };
    }
    
    // カスタムスキルを追加
    if (!player.customSkills) {
        player.customSkills = [];
    }
    
    const customSkill = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: skillName,
        description: skillDescription,
        effect: effect,
        strength: validation.strength,
        createdAt: Date.now()
    };
    
    player.customSkills.push(customSkill);
    player.coins -= CUSTOM_SKILL_COST;
    
    return { success: true, player, skill: customSkill };
}

// グローバル関数としてエクスポート
if (typeof window !== 'undefined') {
    window.SKILL_TREES = SKILL_TREES;
    window.SKILL_POINTS_PER_LEVEL = SKILL_POINTS_PER_LEVEL;
    window.CUSTOM_SKILL_COST = CUSTOM_SKILL_COST;
    window.initializeSkillData = initializeSkillData;
    window.addSkillPointsOnLevelUp = addSkillPointsOnLevelUp;
    window.unlockSkillNode = unlockSkillNode;
    window.getSkillNodeEffects = getSkillNodeEffects;
    window.applySkillEffectsToStats = applySkillEffectsToStats;
    window.validateCustomSkill = validateCustomSkill;
    window.createCustomSkill = createCustomSkill;
}
