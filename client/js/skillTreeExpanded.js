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
    
    // 耐久ルート（右上方向へ - 削減）
    const durabilityNodes = generateLinearRoute("start_durability", "upright", 3, "def", 5, 1);
    nodes.push(...durabilityNodes);
    
    // 耐久ブランチ（HP - 削減）
    const durabilityHP = generateLinearRoute("start_durability_path_3", "right", 2, "maxHp", 10, 2);
    durabilityHP.forEach((n, i) => {
        n.x = 2 + (i + 1);
        n.y = -2;
        n.requires = i === 0 ? "start_durability" : durabilityHP[i - 1].id;
    });
    nodes.push(...durabilityHP);
    
    // 火力ルート（左上方向へ - 削減）
    const offenseNodes = generateLinearRoute("start_offense", "upleft", 3, "atk", 5, 1);
    nodes.push(...offenseNodes);
    
    // 火力ブランチ（クリティカル - 削減）
    const offenseCrit = generateLinearRoute("start_offense_path_3", "left", 2, "critChance", 0.01, 2);
    offenseCrit.forEach((n, i) => {
        n.x = -2 - (i + 1);
        n.y = -2;
        n.requires = i === 0 ? "start_offense" : offenseCrit[i - 1].id;
    });
    nodes.push(...offenseCrit);
    
    // バランスルート（全方向に広がる - 削減）
    const balanceNodes = generateCluster("start_balance", 1, "balance", "all", 3, 1);
    balanceNodes.forEach(n => {
        n.x = n.x;
        n.y = n.y;
        n.effect = { maxHp: 5, atk: 5, def: 5, speed: 5 };
    });
    nodes.push(...balanceNodes);
    
    // 魔法ルート（下方向へ - 削減）
    const magicNodes = generateLinearRoute("start_magic", "down", 3, "special", 5, 1);
    nodes.push(...magicNodes);
    
    // 魔法ブランチ（魔法ダメージ - 削減）
    const magicDmg = generateLinearRoute("start_magic_path_3", "downleft", 2, "atk", 5, 2);
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
