// ============================================
// 拡張スキルツリーシステム
// Mine and Slash style: 4 start points (Durability, Offense, Balance, Magic)
// ============================================

// スキルポイント獲得量（レベルアップごと）
const SKILL_POINTS_PER_LEVEL = 3; // 増加

// スタート地点の定義
const START_POINTS = {
    durability: { id: "start_durability", name: "耐久の起点", description: "防御とHPに特化", x: 2, y: -2, type: "start", class: "durability" },
    offense: { id: "start_offense", name: "火力の起点", description: "攻撃とクリティカルに特化", x: -2, y: -2, type: "start", class: "offense" },
    balance: { id: "start_balance", name: "均衡の起点", description: "全ステータスのバランス", x: 0, y: 0, type: "start", class: "balance" },
    magic: { id: "start_magic", name: "魔法の起点", description: "特殊ステータスと魔法に特化", x: 0, y: 2, type: "start", class: "magic" }
};

// ノード生成ヘルパー関数
function generateStatNode(id, name, desc, cost, x, y, requires, effect) {
    return { id, name, description: desc, cost, x, y, requires, type: "stat", effect };
}

function generatePassiveNode(id, name, desc, cost, x, y, requires, effect) {
    return { id, name, description: desc, cost, x, y, requires, type: "passive", effect };
}

function generateActiveNode(id, name, desc, cost, x, y, requires, effect) {
    return { id, name, description: desc, cost, x, y, requires, type: "active", effect };
}

// ルート生成関数（特定の方向にノードを並べる）
function generateLinearRoute(startId, direction, count, baseStat, baseValue, startCost) {
    const nodes = [];
    const dirs = {
        up: { dx: 0, dy: -1 },
        down: { dx: 0, dy: 1 },
        left: { dx: -1, dy: 0 },
        right: { dx: 1, dy: 0 },
        upleft: { dx: -1, dy: -1 },
        upright: { dx: 1, dy: -1 },
        downleft: { dx: -1, dy: 1 },
        downright: { dx: 1, dy: 1 }
    };
    const dir = dirs[direction] || dirs.up;
    
    let prevId = startId;
    for (let i = 0; i < count; i++) {
        const node = generateStatNode(
            `${startId}_path_${i + 1}`,
            `${baseStat}+${(i + 1) * baseValue}`,
            `${baseStat}+${(i + 1) * baseValue}`,
            startCost + i,
            dir.dx * (i + 1),
            dir.dy * (i + 1),
            prevId,
            { [baseStat]: (i + 1) * baseValue }
        );
        nodes.push(node);
        prevId = node.id;
    }
    return nodes;
}

// クラスター生成関数（広がりのあるノード群）
function generateCluster(centerId, radius, baseId, baseStat, baseValue, startCost) {
    const nodes = [];
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dy === 0) continue;
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist > radius) continue;
            
            const node = generateStatNode(
                `${baseId}_cluster_${dx}_${dy}`,
                `${baseStat}+${dist * baseValue}`,
                `${baseStat}+${dist * baseValue}`,
                startCost + dist,
                dx,
                dy,
                centerId,
                { [baseStat]: dist * baseValue }
            );
            nodes.push(node);
        }
    }
    return nodes;
}

// 拡張スキルツリー生成
function generateExpandedSkillTree() {
    const nodes = [];
    
    // スタート地点を追加
    Object.values(START_POINTS).forEach(sp => {
        nodes.push({
            id: sp.id,
            name: sp.name,
            description: sp.description,
            cost: 0,
            x: sp.x,
            y: sp.y,
            type: "start",
            class: sp.class,
            effect: { 
                maxHp: 10, 
                atk: 10, 
                def: 10, 
                speed: 10,
                special: 10
            }
        });
    });
    
    // 耐久ルート（右上方向へ）
    const durabilityNodes = generateLinearRoute("start_durability", "upright", 8, "def", 5, 1);
    nodes.push(...durabilityNodes);
    
    // 耐久ブランチ（HP）
    const durabilityHP = generateLinearRoute("start_durability_path_4", "right", 6, "maxHp", 10, 2);
    durabilityHP.forEach((n, i) => {
        n.x = 2 + (i + 1);
        n.y = -2;
        n.requires = i === 0 ? "start_durability" : durabilityHP[i - 1].id;
    });
    nodes.push(...durabilityHP);
    
    // 火力ルート（左上方向へ）
    const offenseNodes = generateLinearRoute("start_offense", "upleft", 8, "atk", 5, 1);
    nodes.push(...offenseNodes);
    
    // 火力ブランチ（クリティカル）
    const offenseCrit = generateLinearRoute("start_offense_path_4", "left", 6, "critChance", 0.01, 2);
    offenseCrit.forEach((n, i) => {
        n.x = -2 - (i + 1);
        n.y = -2;
        n.requires = i === 0 ? "start_offense" : offenseCrit[i - 1].id;
    });
    nodes.push(...offenseCrit);
    
    // バランスルート（全方向に広がる）
    const balanceNodes = generateCluster("start_balance", 2, "balance", "all", 3, 1);
    balanceNodes.forEach(n => {
        n.x = n.x;
        n.y = n.y;
        n.effect = { maxHp: 5, atk: 5, def: 5, speed: 5 };
    });
    nodes.push(...balanceNodes);
    
    // 魔法ルート（下方向へ）
    const magicNodes = generateLinearRoute("start_magic", "down", 8, "special", 5, 1);
    nodes.push(...magicNodes);
    
    // 魔法ブランチ（魔法ダメージ）
    const magicDmg = generateLinearRoute("start_magic_path_4", "downleft", 6, "atk", 5, 2);
    magicDmg.forEach((n, i) => {
        n.x = -(i + 1);
        n.y = 2 + (i + 1);
        n.requires = i === 0 ? "start_magic" : magicDmg[i - 1].id;
    });
    nodes.push(...magicDmg);
    
    // パッシブスキル（頂点）
    nodes.push(generatePassiveNode(
        "durability_mastery",
        "耐久の極意",
        "常時防御+20%, HP+20%",
        7,
        4,
        -6,
        "start_durability_path_8",
        { defPercent: 0.2, maxHpPercent: 0.2 }
    ));
    
    nodes.push(generatePassiveNode(
        "offense_mastery",
        "火力の極意",
        "常時攻撃+25%, クリティカル率+10%",
        7,
        -6,
        -4,
        "start_offense_path_8",
        { atkPercent: 0.25, critChance: 0.1 }
    ));
    
    nodes.push(generatePassiveNode(
        "balance_mastery",
        "均衡の極意",
        "常時全ステータス+10%",
        7,
        0,
        0,
        "start_balance",
        { maxHpPercent: 0.1, atkPercent: 0.1, defPercent: 0.1, speedPercent: 0.1 }
    ));
    
    nodes.push(generatePassiveNode(
        "magic_mastery",
        "魔法の極意",
        "常時特殊+25%, 攻撃+15%",
        7,
        0,
        6,
        "start_magic_path_8",
        { specialPercent: 0.25, atkPercent: 0.15 }
    ));
    
    // アクティブスキル
    nodes.push(generateActiveNode(
        "iron_wall",
        "鉄壁",
        "次に受けるダメージを50%軽減",
        5,
        3,
        -4,
        "durability_mastery",
        { type: "active", damageReduction: 0.5 }
    ));
    
    nodes.push(generateActiveNode(
        "fury_strike",
        "憤怒の一撃",
        "次の攻撃2.5倍ダメージ",
        5,
        -5,
        -3,
        "offense_mastery",
        { type: "active", damageMultiplier: 2.5 }
    ));
    
    nodes.push(generateActiveNode(
        "perfect_balance",
        "完全なる均衡",
        "次のターン、全ステータス+20%",
        5,
        0,
        0,
        "balance_mastery",
        { type: "active", allStatsBuff: 0.2 }
    ));
    
    nodes.push(generateActiveNode(
        "arcane_burst",
        "魔導の爆発",
        "次の攻撃3.0倍ダメージ（特殊基準）",
        5,
        0,
        5,
        "magic_mastery",
        { type: "active", damageMultiplier: 3.0, useSpecialStat: true }
    ));
    
    // ===== 追加ルート（耐久拡張） =====
    const durabilityExt1 = generateLinearRoute("durability_mastery", "up", 10, "def", 8, 3);
    durabilityExt1.forEach((n, i) => {
        n.x = 4;
        n.y = -6 - (i + 1);
        n.requires = i === 0 ? "durability_mastery" : durabilityExt1[i - 1].id;
    });
    nodes.push(...durabilityExt1);
    
    const durabilityExt2 = generateLinearRoute("durability_mastery", "right", 10, "maxHp", 15, 3);
    durabilityExt2.forEach((n, i) => {
        n.x = 4 + (i + 1);
        n.y = -6;
        n.requires = i === 0 ? "durability_mastery" : durabilityExt2[i - 1].id;
    });
    nodes.push(...durabilityExt2);
    
    // ===== 追加ルート（火力拡張） =====
    const offenseExt1 = generateLinearRoute("offense_mastery", "up", 10, "atk", 8, 3);
    offenseExt1.forEach((n, i) => {
        n.x = -6;
        n.y = -4 - (i + 1);
        n.requires = i === 0 ? "offense_mastery" : offenseExt1[i - 1].id;
    });
    nodes.push(...offenseExt1);
    
    const offenseExt2 = generateLinearRoute("offense_mastery", "left", 10, "critMultiplier", 0.05, 3);
    offenseExt2.forEach((n, i) => {
        n.x = -6 - (i + 1);
        n.y = -4;
        n.requires = i === 0 ? "offense_mastery" : offenseExt2[i - 1].id;
    });
    nodes.push(...offenseExt2);
    
    // ===== 追加ルート（バランス拡張） =====
    const balanceExt1 = generateLinearRoute("balance_mastery", "up", 8, "all", 5, 2);
    balanceExt1.forEach((n, i) => {
        n.x = 0;
        n.y = -(i + 1);
        n.requires = i === 0 ? "balance_mastery" : balanceExt1[i - 1].id;
        n.effect = { maxHp: 5, atk: 5, def: 5, speed: 5 };
    });
    nodes.push(...balanceExt1);
    
    const balanceExt2 = generateLinearRoute("balance_mastery", "down", 8, "all", 5, 2);
    balanceExt2.forEach((n, i) => {
        n.x = 0;
        n.y = (i + 1);
        n.requires = i === 0 ? "balance_mastery" : balanceExt2[i - 1].id;
        n.effect = { maxHp: 5, atk: 5, def: 5, speed: 5 };
    });
    nodes.push(...balanceExt2);
    
    const balanceExt3 = generateLinearRoute("balance_mastery", "left", 8, "all", 5, 2);
    balanceExt3.forEach((n, i) => {
        n.x = -(i + 1);
        n.y = 0;
        n.requires = i === 0 ? "balance_mastery" : balanceExt3[i - 1].id;
        n.effect = { maxHp: 5, atk: 5, def: 5, speed: 5 };
    });
    nodes.push(...balanceExt3);
    
    const balanceExt4 = generateLinearRoute("balance_mastery", "right", 8, "all", 5, 2);
    balanceExt4.forEach((n, i) => {
        n.x = (i + 1);
        n.y = 0;
        n.requires = i === 0 ? "balance_mastery" : balanceExt4[i - 1].id;
        n.effect = { maxHp: 5, atk: 5, def: 5, speed: 5 };
    });
    nodes.push(...balanceExt4);
    
    // ===== 追加ルート（魔法拡張） =====
    const magicExt1 = generateLinearRoute("magic_mastery", "down", 10, "special", 8, 3);
    magicExt1.forEach((n, i) => {
        n.x = 0;
        n.y = 6 + (i + 1);
        n.requires = i === 0 ? "magic_mastery" : magicExt1[i - 1].id;
    });
    nodes.push(...magicExt1);
    
    const magicExt2 = generateLinearRoute("magic_mastery", "downright", 10, "atk", 8, 3);
    magicExt2.forEach((n, i) => {
        n.x = (i + 1);
        n.y = 6 + (i + 1);
        n.requires = i === 0 ? "magic_mastery" : magicExt2[i - 1].id;
    });
    nodes.push(...magicExt2);
    
    // ===== さらに拡張（サブルート） =====
    // 耐久サブ
    for (let i = 0; i < 5; i++) {
        nodes.push(generateStatNode(
            `durability_sub_${i}`,
            `耐久+${(i + 1) * 3}`,
            `防御+${(i + 1) * 3}, HP+${(i + 1) * 5}`,
            2,
            4 + (i + 1) * 2,
            -6 - (i + 1) * 2,
            `durability_mastery_path_${i + 1}`,
            { def: (i + 1) * 3, maxHp: (i + 1) * 5 }
        ));
    }
    
    // 火力サブ
    for (let i = 0; i < 5; i++) {
        nodes.push(generateStatNode(
            `offense_sub_${i}`,
            `火力+${(i + 1) * 3}`,
            `攻撃+${(i + 1) * 3}, クリティカル率+${(i + 1) * 0.5}%`,
            2,
            -6 - (i + 1) * 2,
            -4 - (i + 1) * 2,
            `offense_mastery_path_${i + 1}`,
            { atk: (i + 1) * 3, critChance: (i + 1) * 0.005 }
        ));
    }
    
    // 魔法サブ
    for (let i = 0; i < 5; i++) {
        nodes.push(generateStatNode(
            `magic_sub_${i}`,
            `魔力+${(i + 1) * 3}`,
            `特殊+${(i + 1) * 3}, 攻撃+${(i + 1) * 2}`,
            2,
            (i + 1) * 2,
            6 + (i + 1) * 2,
            `magic_mastery_path_${i + 1}`,
            { special: (i + 1) * 3, atk: (i + 1) * 2 }
        ));
    }
    
    // ===== 頂点スキル =====
    nodes.push(generatePassiveNode(
        "durability_apex",
        "耐久の頂点",
        "常時防御+40%, HP+40%, 回避率+10%",
        10,
        4,
        -16,
        "durability_mastery_path_10",
        { defPercent: 0.4, maxHpPercent: 0.4, dodgeChance: 0.1 }
    ));
    
    nodes.push(generatePassiveNode(
        "offense_apex",
        "火力の頂点",
        "常時攻撃+50%, クリティカル率+20%, クリティカルダメージ+30%",
        10,
        -16,
        -4,
        "offense_mastery_path_10",
        { atkPercent: 0.5, critChance: 0.2, critMultiplier: 0.3 }
    ));
    
    nodes.push(generatePassiveNode(
        "balance_apex",
        "均衡の頂点",
        "常時全ステータス+25%",
        10,
        0,
        0,
        "balance_mastery",
        { maxHpPercent: 0.25, atkPercent: 0.25, defPercent: 0.25, speedPercent: 0.25 }
    ));
    
    nodes.push(generatePassiveNode(
        "magic_apex",
        "魔法の頂点",
        "常時特殊+50%, 攻撃+30%, 全魔法ダメージ+20%",
        10,
        0,
        16,
        "magic_mastery_path_10",
        { specialPercent: 0.5, atkPercent: 0.3, magicDamagePercent: 0.2 }
    ));
    
    // ===== 超拡張ルート（対角線方向） =====
    // 耐久対角線（左下方向）
    const durabilityDiag = generateLinearRoute("durability_apex", "downleft", 15, "def", 10, 4);
    durabilityDiag.forEach((n, i) => {
        n.x = 4 - (i + 1) * 1.5;
        n.y = -16 + (i + 1) * 1.5;
        n.requires = i === 0 ? "durability_apex" : durabilityDiag[i - 1].id;
    });
    nodes.push(...durabilityDiag);
    
    // 火力対角線（右下方向）
    const offenseDiag = generateLinearRoute("offense_apex", "downright", 15, "atk", 10, 4);
    offenseDiag.forEach((n, i) => {
        n.x = -16 + (i + 1) * 1.5;
        n.y = -4 + (i + 1) * 1.5;
        n.requires = i === 0 ? "offense_apex" : offenseDiag[i - 1].id;
    });
    nodes.push(...offenseDiag);
    
    // 魔法対角線（左上方向）
    const magicDiag = generateLinearRoute("magic_apex", "upleft", 15, "special", 10, 4);
    magicDiag.forEach((n, i) => {
        n.x = -(i + 1) * 1.5;
        n.y = 16 - (i + 1) * 1.5;
        n.requires = i === 0 ? "magic_apex" : magicDiag[i - 1].id;
    });
    nodes.push(...magicDiag);
    
    // ===== 追加ブランチ（拡張） =====
    // 耐久追加ブランチ（再生・ライフスティール）
    for (let i = 0; i < 10; i++) {
        nodes.push(generateStatNode(
            `durability_regen_${i}`,
            `再生力+${i + 1}`,
            `HP回復+${(i + 1) * 2}%, ライフスティール+${(i + 1) * 1}%`,
            3,
            6 + (i + 1) * 2,
            -16 + (i + 1),
            `durability_mastery_path_${Math.min(i + 1, 10)}`,
            { hpRegen: (i + 1) * 0.02, lifeSteal: (i + 1) * 0.01 }
        ));
    }
    
    // 火力追加ブランチ（攻撃速度・ダメージ倍率）
    for (let i = 0; i < 10; i++) {
        nodes.push(generateStatNode(
            `offense_speed_${i}`,
            `攻撃速度+${i + 1}`,
            `攻撃+${(i + 1) * 3}, ダメージ倍率+${(i + 1) * 0.05}`,
            3,
            -16 + (i + 1),
            -4 - (i + 1) * 2,
            `offense_mastery_path_${Math.min(i + 1, 10)}`,
            { atk: (i + 1) * 3, damageMultiplier: (i + 1) * 0.05 }
        ));
    }
    
    // 魔法追加ブランチ（魔法効果範囲・持続時間）
    for (let i = 0; i < 10; i++) {
        nodes.push(generateStatNode(
            `magic_range_${i}`,
            `魔法範囲+${i + 1}`,
            `特殊+${(i + 1) * 3}, 魔法範囲+${(i + 1) * 5}%`,
            3,
            -(i + 1) * 2,
            16 + (i + 1),
            `magic_mastery_path_${Math.min(i + 1, 10)}`,
            { special: (i + 1) * 3, magicRangePercent: (i + 1) * 0.05 }
        ));
    }
    
    // バランス追加ブランチ（全ステータス）
    for (let i = 0; i < 12; i++) {
        nodes.push(generateStatNode(
            `balance_all_${i}`,
            `全能力+${i + 1}`,
            `全ステータス+${(i + 1) * 2}`,
            2,
            (i % 4 - 1.5) * 3,
            (Math.floor(i / 4) - 1.5) * 3,
            "balance_mastery",
            { maxHp: (i + 1) * 2, atk: (i + 1) * 2, def: (i + 1) * 2, speed: (i + 1) * 2 }
        ));
    }
    
    // ===== セカンドブランチ（耐久・火力の交差） =====
    const hybridNodes = [];
    for (let i = 0; i < 8; i++) {
        hybridNodes.push(generateStatNode(
            `hybrid_dur_off_${i}`,
            `攻防+${i + 1}`,
            `攻撃+${(i + 1) * 4}, 防御+${(i + 1) * 4}`,
            3,
            -6 - (i + 1),
            -6 - (i + 1),
            "durability_mastery",
            { atk: (i + 1) * 4, def: (i + 1) * 4 }
        ));
    }
    nodes.push(...hybridNodes);
    
    // ===== サードブランチ（魔法・速さの交差） =====
    const magicSpeedNodes = [];
    for (let i = 0; i < 8; i++) {
        magicSpeedNodes.push(generateStatNode(
            `magic_speed_${i}`,
            `魔速+${i + 1}`,
            `特殊+${(i + 1) * 4}, 速さ+${(i + 1) * 4}`,
            3,
            (i + 1),
            6 + (i + 1),
            "magic_mastery",
            { special: (i + 1) * 4, speed: (i + 1) * 4 }
        ));
    }
    nodes.push(...magicSpeedNodes);
    
    // ===== 超頂点スキル（究極） =====
    nodes.push(generatePassiveNode(
        "durability_ultimate",
        "不滅の盾",
        "常時防御+60%, HP+60%, 回避率+20%, 全状態異常無効",
        15,
        4,
        -30,
        "durability_apex_path_15",
        { defPercent: 0.6, maxHpPercent: 0.6, dodgeChance: 0.2, statusImmunity: true }
    ));
    
    nodes.push(generatePassiveNode(
        "offense_ultimate",
        "破壊の化身",
        "常時攻撃+80%, クリティカル率+40%, クリティカルダメージ+50%, 必中",
        15,
        -30,
        -10,
        "offense_apex_path_15",
        { atkPercent: 0.8, critChance: 0.4, critMultiplier: 0.5, sureHit: true }
    ));
    
    nodes.push(generatePassiveNode(
        "balance_ultimate",
        "全能の均衡",
        "常時全ステータス+50%, 全効果+30%",
        15,
        0,
        0,
        "balance_apex",
        { maxHpPercent: 0.5, atkPercent: 0.5, defPercent: 0.5, speedPercent: 0.5, allEffectsBuff: 0.3 }
    ));
    
    nodes.push(generatePassiveNode(
        "magic_ultimate",
        "魔導の頂点",
        "常時特殊+80%, 攻撃+50%, 全魔法ダメージ+50%, 魔法効果範囲+100%",
        15,
        0,
        30,
        "magic_apex_path_15",
        { specialPercent: 0.8, atkPercent: 0.5, magicDamagePercent: 0.5, magicRangePercent: 1.0 }
    ));
    
    // ===== アクティブスキル（究極） =====
    nodes.push(generateActiveNode(
        "absolute_defense",
        "絶対防御",
        "次に受けるダメージを完全無効化（3ターン）",
        8,
        6,
        -28,
        "durability_ultimate",
        { type: "active", invincible: true, duration: 3 }
    ));
    
    nodes.push(generateActiveNode(
        "world_breaker",
        "世界破壊者",
        "次の攻撃5.0倍ダメージ、全防御無視",
        8,
        -28,
        -8,
        "offense_ultimate",
        { type: "active", damageMultiplier: 5.0, defenseIgnore: true }
    ));
    
    nodes.push(generateActiveNode(
        "chaos_mode",
        "カオスモード",
        "5ターン、全ステータス+100%、全攻撃2.0倍",
        8,
        0,
        0,
        "balance_ultimate",
        { type: "active", allStatsBuff: 1.0, damageMultiplier: 2.0, duration: 5 }
    ));
    
    nodes.push(generateActiveNode(
        "reality_reshape",
        "現実改変",
        "次の攻撃10.0倍ダメージ（特殊基準）、敵の全ステータス-50%",
        8,
        0,
        28,
        "magic_ultimate",
        { type: "active", damageMultiplier: 10.0, useSpecialStat: true, enemyDebuff: 0.5 }
    ));
    
    // ===== 追加のサブルート網（さらに拡張） =====
    // 耐久外周
    for (let ring = 1; ring <= 3; ring++) {
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const radius = ring * 3;
            nodes.push(generateStatNode(
                `durability_ring_${ring}_${i}`,
                `堅牢${ring}-${i}`,
                `防御+${ring * 5}, HP+${ring * 8}`,
                2 + ring,
                4 + Math.cos(angle) * radius,
                -16 + Math.sin(angle) * radius,
                ring === 1 ? "durability_apex" : `durability_ring_${ring - 1}_${i}`,
                { def: ring * 5, maxHp: ring * 8 }
            ));
        }
    }
    
    // 火力外周
    for (let ring = 1; ring <= 3; ring++) {
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const radius = ring * 3;
            nodes.push(generateStatNode(
                `offense_ring_${ring}_${i}`,
                `破壊${ring}-${i}`,
                `攻撃+${ring * 5}, クリティカル率+${ring * 0.02}`,
                2 + ring,
                -16 + Math.cos(angle) * radius,
                -4 + Math.sin(angle) * radius,
                ring === 1 ? "offense_apex" : `offense_ring_${ring - 1}_${i}`,
                { atk: ring * 5, critChance: ring * 0.02 }
            ));
        }
    }
    
    // 魔法外周
    for (let ring = 1; ring <= 3; ring++) {
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const radius = ring * 3;
            nodes.push(generateStatNode(
                `magic_ring_${ring}_${i}`,
                `魔導${ring}-${i}`,
                `特殊+${ring * 5}, 魔法ダメージ+${ring * 0.05}`,
                2 + ring,
                Math.cos(angle) * radius,
                16 + Math.sin(angle) * radius,
                ring === 1 ? "magic_apex" : `magic_ring_${ring - 1}_${i}`,
                { special: ring * 5, magicDamagePercent: ring * 0.05 }
            ));
        }
    }
    
    // バランス外周（全方位）
    for (let ring = 1; ring <= 2; ring++) {
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const radius = ring * 4;
            nodes.push(generateStatNode(
                `balance_ring_${ring}_${i}`,
                `均衡${ring}-${i}`,
                `全ステータス+${ring * 3}`,
                2 + ring,
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                ring === 1 ? "balance_apex" : `balance_ring_${ring - 1}_${i}`,
                { maxHp: ring * 3, atk: ring * 3, def: ring * 3, speed: ring * 3 }
            ));
        }
    }
    
    // ===== スペシャルスキル（レア） =====
    const specialSkills = [
        { id: "durability_special_1", name: "不死鳥の魂", desc: "戦闘不能時HP100%で復活（1回/戦闘）", x: 8, y: -20, requires: "durability_ultimate", effect: { revive: true, revivePercent: 1.0 } },
        { id: "durability_special_2", name: "鉄の意志", desc: "HPが1以下にならない", x: 6, y: -22, requires: "durability_ultimate", effect: { minHp: 1 } },
        { id: "offense_special_1", name: "瞬殺", desc: "HP50%以下の敵を即死させる（10%確率）", x: -20, y: -12, requires: "offense_ultimate", effect: { instantKill: 0.1 } },
        { id: "offense_special_2", name: "狂戦士の怒り", desc: "HPが低いほど攻撃力UP（最大+100%）", x: -22, y: -14, requires: "offense_ultimate", effect: { lowHpBuff: 1.0 } },
        { id: "magic_special_1", name: "時空操作", desc: "次の攻撃を時空転送して3回発動", x: 4, y: 32, requires: "magic_ultimate", effect: { timeWarp: 3 } },
        { id: "magic_special_2", name: "元素の支配", desc: "全属性ダメージ+50%", x: -4, y: 32, requires: "magic_ultimate", effect: { allElementDamage: 0.5 } },
        { id: "balance_special_1", name: "完全なる調和", desc: "全ステータスの相乗効果+50%", x: 12, y: 0, requires: "balance_ultimate", effect: { synergyBonus: 0.5 } },
        { id: "balance_special_2", name: "無限の可能性", desc: "スキルポイント消費-50%", x: -12, y: 0, requires: "balance_ultimate", effect: { pointCostReduction: 0.5 } }
    ];
    
    specialSkills.forEach(skill => {
        nodes.push(generateActiveNode(
            skill.id,
            skill.name,
            skill.desc,
            10,
            skill.x,
            skill.y,
            skill.requires,
            { type: "active", ...skill.effect }
        ));
    });
    
    // ===== パッシブスキル（補助） =====
    const passiveSkills = [
        { id: "passive_gold_finder", name: "金の運", desc: "コイン獲得+20%", x: 10, y: 10, requires: "balance_apex", effect: { coinBonus: 0.2 } },
        { id: "passive_exp_boost", name: "経験の求道者", desc: "経験値+30%", x: -10, y: 10, requires: "balance_apex", effect: { expBonus: 0.3 } },
        { id: "passive_lucky_drop", name: "幸運", desc: "レアドロップ率+15%", x: 10, y: -10, requires: "balance_apex", effect: { rareDropBonus: 0.15 } },
        { id: "passive_quick_learner", name: "早熟", desc: "スキルポイント+1/レベル", x: -10, y: -10, requires: "balance_apex", effect: { extraSkillPoint: 1 } }
    ];
    
    passiveSkills.forEach(skill => {
        nodes.push(generatePassiveNode(
            skill.id,
            skill.name,
            skill.desc,
            5,
            skill.x,
            skill.y,
            skill.requires,
            skill.effect
        ));
    });
    
    // ===== 超大規模拡張（5000ノードを目指す） =====
    
    // 耐久ルート超拡張（8方向×20層）
    const durabilityDirections = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
    ];
    
    const offenseDirections = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
    ];
    
    const magicDirections = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
    ];
    
    durabilityDirections.forEach((dir, dirIdx) => {
        for (let layer = 1; layer <= 20; layer++) {
            nodes.push(generateStatNode(
                `durability_massive_${dirIdx}_${layer}`,
                `堅牢-${dirIdx}-${layer}`,
                `防御+${layer * 3}, HP+${layer * 5}`,
                2 + Math.floor(layer / 5),
                4 + dir.dx * layer * 2,
                -16 + dir.dy * layer * 2,
                layer === 1 ? "durability_ultimate" : `durability_massive_${dirIdx}_${layer - 1}`,
                { def: layer * 3, maxHp: layer * 5 }
            ));
        }
    });
    
    // 火力ルート超拡張（8方向×20層）
    offenseDirections.forEach((dir, dirIdx) => {
        for (let layer = 1; layer <= 20; layer++) {
            nodes.push(generateStatNode(
                `offense_massive_${dirIdx}_${layer}`,
                `破壊-${dirIdx}-${layer}`,
                `攻撃+${layer * 3}, クリティカル率+${layer * 0.01}`,
                2 + Math.floor(layer / 5),
                -16 + dir.dx * layer * 2,
                -4 + dir.dy * layer * 2,
                layer === 1 ? "offense_ultimate" : `offense_massive_${dirIdx}_${layer - 1}`,
                { atk: layer * 3, critChance: layer * 0.01 }
            ));
        }
    });
    
    // 魔法ルート超拡張（8方向×20層）
    magicDirections.forEach((dir, dirIdx) => {
        for (let layer = 1; layer <= 20; layer++) {
            nodes.push(generateStatNode(
                `magic_massive_${dirIdx}_${layer}`,
                `魔導-${dirIdx}-${layer}`,
                `特殊+${layer * 3}, 魔法ダメージ+${layer * 0.02}`,
                2 + Math.floor(layer / 5),
                dir.dx * layer * 2,
                16 + dir.dy * layer * 2,
                layer === 1 ? "magic_ultimate" : `magic_massive_${dirIdx}_${layer - 1}`,
                { special: layer * 3, magicDamagePercent: layer * 0.02 }
            ));
        }
    });
    
    // バランスルート超拡張（全方位×40層）
    for (let layer = 1; layer <= 40; layer++) {
        const nodesInLayer = Math.max(8, layer * 2);
        for (let i = 0; i < nodesInLayer; i++) {
            const angle = (i / nodesInLayer) * Math.PI * 2;
            const radius = layer * 2;
            nodes.push(generateStatNode(
                `balance_massive_${layer}_${i}`,
                `均衡-${layer}-${i}`,
                `全ステータス+${layer * 2}`,
                2 + Math.floor(layer / 8),
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                layer === 1 && i === 0 ? "balance_ultimate" : `balance_massive_${layer - 1}_${Math.floor(i / (nodesInLayer / 2))}`,
                { maxHp: layer * 2, atk: layer * 2, def: layer * 2, speed: layer * 2 }
            ));
        }
    }
    
    // ハイブリッドルート網（耐久×火力、耐久×魔法、火力×魔法、バランス×全て）
    const hybridPairs = [
        { base1: "durability_ultimate", base2: "offense_ultimate", stat1: "def", stat2: "atk", count: 30 },
        { base1: "durability_ultimate", base2: "magic_ultimate", stat1: "def", stat2: "special", count: 30 },
        { base1: "offense_ultimate", base2: "magic_ultimate", stat1: "atk", stat2: "special", count: 30 },
        { base1: "balance_ultimate", base2: "durability_ultimate", stat1: "all", stat2: "def", count: 25 },
        { base1: "balance_ultimate", base2: "offense_ultimate", stat1: "all", stat2: "atk", count: 25 },
        { base1: "balance_ultimate", base2: "magic_ultimate", stat1: "all", stat2: "special", count: 25 }
    ];
    
    hybridPairs.forEach((pair, pairIdx) => {
        for (let i = 0; i < pair.count; i++) {
            const midX = (pair.base1 === "durability_ultimate" ? 4 : pair.base1 === "offense_ultimate" ? -16 : pair.base1 === "magic_ultimate" ? 0 : 0);
            const midY = (pair.base1 === "durability_ultimate" ? -16 : pair.base1 === "offense_ultimate" ? -4 : pair.base1 === "magic_ultimate" ? 16 : 0);
            
            nodes.push(generateStatNode(
                `hybrid_${pairIdx}_${i}`,
                `融合-${pairIdx}-${i}`,
                `${pair.stat1}+${(i + 1) * 3}, ${pair.stat2}+${(i + 1) * 3}`,
                3,
                midX + (i % 5 - 2) * 3,
                midY + (Math.floor(i / 5) - 2) * 3,
                i === 0 ? pair.base1 : `hybrid_${pairIdx}_${i - 1}`,
                { [pair.stat1]: (i + 1) * 3, [pair.stat2]: (i + 1) * 3 }
            ));
        }
    });
    
    // 無限ルート（純粋なステータスアップ）
    const pureRoutes = [
        { name: "攻撃の極限", base: "offense_ultimate", stat: "atk", count: 50, dir: "left" },
        { name: "防御の極限", base: "durability_ultimate", stat: "def", count: 50, dir: "up" },
        { name: "HPの極限", base: "durability_ultimate", stat: "maxHp", count: 50, dir: "right" },
        { name: "速さの極限", base: "balance_ultimate", stat: "speed", count: 50, dir: "down" },
        { name: "特殊の極限", base: "magic_ultimate", stat: "special", count: 50, dir: "down" }
    ];
    
    pureRoutes.forEach((route, routeIdx) => {
        const dirMap = { left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 }, up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 } };
        const dir = dirMap[route.dir];
        
        for (let i = 0; i < route.count; i++) {
            nodes.push(generateStatNode(
                `pure_${route.stat}_${i}`,
                `${route.name}-${i}`,
                `${route.stat}+${(i + 1) * 5}`,
                2,
                dir.dx * (i + 1) * 2,
                dir.dy * (i + 1) * 2,
                i === 0 ? route.base : `pure_${route.stat}_${i - 1}`,
                { [route.stat]: (i + 1) * 5 }
            ));
        }
    });
    
    // 特殊ルート（パーセンテージブースト）
    const percentRoutes = [
        { name: "攻撃%", base: "offense_ultimate", stat: "atkPercent", count: 40 },
        { name: "防御%", base: "durability_ultimate", stat: "defPercent", count: 40 },
        { name: "HP%", base: "durability_ultimate", stat: "maxHpPercent", count: 40 },
        { name: "速さ%", base: "balance_ultimate", stat: "speedPercent", count: 40 },
        { name: "特殊%", base: "magic_ultimate", stat: "specialPercent", count: 40 }
    ];
    
    percentRoutes.forEach((route, routeIdx) => {
        for (let i = 0; i < route.count; i++) {
            nodes.push(generatePassiveNode(
                `percent_${route.stat}_${i}`,
                `${route.name}-${i}`,
                `常時${route.stat}+${(i + 1) * 0.5}%`,
                4,
                (routeIdx % 2 === 0 ? 1 : -1) * (i + 1) * 1.5,
                (routeIdx % 2 === 0 ? -1 : 1) * (i + 1) * 1.5,
                i === 0 ? route.base : `percent_${route.stat}_${i - 1}`,
                { [route.stat]: (i + 1) * 0.005 }
            ));
        }
    });
    
    // ミニクラスター（小さなグループ） - 拡張
    for (let cluster = 0; cluster < 200; cluster++) {
        const clusterX = (cluster % 20 - 10) * 6;
        const clusterY = (Math.floor(cluster / 20) - 5) * 6;
        const clusterBase = cluster % 4 === 0 ? "durability_ultimate" : cluster % 4 === 1 ? "offense_ultimate" : cluster % 4 === 2 ? "magic_ultimate" : "balance_ultimate";
        
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            nodes.push(generateStatNode(
                `mini_cluster_${cluster}_${i}`,
                `小集-${cluster}-${i}`,
                `全ステータス+${(cluster + 1) * 2}`,
                2,
                clusterX + Math.cos(angle) * 3,
                clusterY + Math.sin(angle) * 3,
                i === 0 ? clusterBase : `mini_cluster_${cluster}_${i - 1}`,
                { maxHp: (cluster + 1) * 2, atk: (cluster + 1) * 2, def: (cluster + 1) * 2, speed: (cluster + 1) * 2 }
            ));
        }
    }
    
    // 超大規模グリッド（100×100の範囲にノードを配置）
    for (let gx = -30; gx <= 30; gx++) {
        for (let gy = -30; gy <= 30; gy++) {
            if (Math.abs(gx) + Math.abs(gy) > 40) continue; // 八角形の範囲
            if (Math.random() > 0.7) continue; // 30%のみ生成
            
            const statType = Math.random();
            let effect = {};
            if (statType < 0.25) {
                effect = { atk: Math.floor(Math.random() * 10) + 1 };
            } else if (statType < 0.5) {
                effect = { def: Math.floor(Math.random() * 10) + 1 };
            } else if (statType < 0.75) {
                effect = { maxHp: Math.floor(Math.random() * 15) + 1 };
            } else {
                effect = { speed: Math.floor(Math.random() * 10) + 1 };
            }
            
            nodes.push(generateStatNode(
                `grid_${gx}_${gy}`,
                `広域-${gx}_${gy}`,
                `ステータス+${Object.values(effect)[0]}`,
                1,
                gx * 3,
                gy * 3,
                null, // グリッドは独立ノード
                effect
            ));
        }
    }
    
    // ランダムブランチ（各ルートから分岐）
    const randomBranchCount = 100;
    for (let i = 0; i < randomBranchCount; i++) {
        const baseNode = ["durability_ultimate", "offense_ultimate", "magic_ultimate", "balance_ultimate"][i % 4];
        const branchLength = Math.floor(Math.random() * 10) + 5;
        const angle = Math.random() * Math.PI * 2;
        
        for (let j = 0; j < branchLength; j++) {
            const dist = j + 1;
            nodes.push(generateStatNode(
                `random_branch_${i}_${j}`,
                `乱-${i}-${j}`,
                `ステータス+${dist * 2}`,
                2,
                Math.cos(angle) * dist * 2,
                Math.sin(angle) * dist * 2,
                j === 0 ? baseNode : `random_branch_${i}_${j - 1}`,
                { maxHp: dist * 2, atk: dist * 2, def: dist * 2, speed: dist * 2 }
            ));
        }
    }
    
    // ===== 最終頂点 =====
    nodes.push(generatePassiveNode(
        "absolute_apex",
        "絶対の頂点",
        "常時全ステータス+100%, 全効果+100%, 無限の力",
        20,
        0,
        0,
        "balance_ultimate",
        { maxHpPercent: 1.0, atkPercent: 1.0, defPercent: 1.0, speedPercent: 1.0, specialPercent: 1.0, allEffectsBuff: 1.0 }
    ));
    
    return {
        name: "拡張スキルツリー",
        description: "4つのスタート地点から選択できる拡張スキルツリー",
        startPoints: START_POINTS,
        nodes: nodes
    };
}

// スキルツリーを生成
const SKILL_TREE_EXPANDED = generateExpandedSkillTree();

// 既存のSKILL_TREEと互換性を保つためのエクスポート
if (typeof SKILL_TREE === 'undefined') {
    window.SKILL_TREE = SKILL_TREE_EXPANDED;
}
