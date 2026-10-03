// ============================================
// モンスターシステム
// ============================================

// モンスターデータ定義
const MONSTERS = [
    {
        id: 'slime',
        name: 'スライム',
        level: 1,
        hp: 50,
        atk: 8,
        def: 5,
        speed: 6,
        special: 4,
        exp: 10,
        coins: 5,
        color: '#4CAF50',
        size: 20,
        moveSpeed: 30,
        icon: '🟢'
    },
    {
        id: 'goblin',
        name: 'ゴブリン',
        level: 3,
        hp: 80,
        atk: 15,
        def: 8,
        speed: 10,
        special: 6,
        exp: 25,
        coins: 12,
        color: '#8BC34A',
        size: 24,
        moveSpeed: 50,
        icon: '👺'
    },
    {
        id: 'wolf',
        name: 'ウルフ',
        level: 5,
        hp: 120,
        atk: 22,
        def: 12,
        speed: 18,
        special: 8,
        exp: 40,
        coins: 20,
        color: '#795548',
        size: 28,
        moveSpeed: 80,
        icon: '🐺'
    },
    {
        id: 'forest_mage',
        name: '森の魔術師',
        level: 8,
        hp: 150,
        atk: 35,
        def: 15,
        speed: 12,
        special: 30,
        exp: 80,
        coins: 35,
        color: '#9C27B0',
        size: 26,
        moveSpeed: 40,
        icon: '🧙'
    },
    {
        id: 'golem',
        name: 'ゴーレム',
        level: 12,
        hp: 300,
        atk: 40,
        def: 35,
        speed: 5,
        special: 10,
        exp: 150,
        coins: 60,
        color: '#607D8B',
        size: 35,
        moveSpeed: 20,
        icon: '🗿'
    },
    {
        id: 'dragon',
        name: 'ドラゴン',
        level: 20,
        hp: 500,
        atk: 80,
        def: 50,
        speed: 25,
        special: 60,
        exp: 300,
        coins: 150,
        color: '#F44336',
        size: 45,
        moveSpeed: 60,
        icon: '🐉'
    }
];

// 地域ごとの通常モンスター出現設定（15地域+町）
// tierが高い地域ほど強いモンスターの割合が増える。既存6種のモンスターを
// 難易度帯（弱→強）で使い分け、regionTierMultiplierで数値も緩やかに強化する
// 地域ボス用のダンジョン入口ボタン（■3：ボスはマップごとに、専用のボスダンジョンとして出現）。
// bosses.json（弱い順）の15体を難易度順の地域に1体ずつ割り当てる
const REGION_BOSS = {
    'grassland': { id: 'goblin_king', name: 'ゴブリンキング', icon: '👑' },
    'forest': { id: 'forest_witch', name: '森の魔女', icon: '🧙‍♀️' },
    'wasteland': { id: 'orc_warlord', name: 'オークの戦将', icon: '🪓' },
    'mountain': { id: 'rock_troll', name: '岩石トロール', icon: '🗿' },
    'swamp': { id: 'shadow_serpent', name: 'ヨルムンガンド', icon: '🐍' },
    'desert': { id: 'sand_worm', name: 'サンドワーム', icon: '🏜️' },
    'ice_lab': { id: 'ice_golem', name: 'アイスゴーレム', icon: '❄️' },
    'canyon': { id: 'thunder_garuda', name: '雷神ガルーダ', icon: '⚡' },
    'volcano': { id: 'flame_dragon', name: 'フレイムドラゴン', icon: '🔥' },
    'deep_sea': { id: 'kraken', name: '深海クラーケン', icon: '🐙' },
    'ruins': { id: 'abyssal_knight', name: 'アビサルナイト', icon: '⚔️' },
    'graveyard': { id: 'blood_count', name: '血の伯爵', icon: '🧛' },
    'sky_castle': { id: 'celestial_guardian', name: 'セレスティアルガーディアン', icon: '😇' },
    'fallen_church': { id: 'fallen_lucifer', name: '堕天使ルシフェル', icon: '😈' },
    'abyssal_rift': { id: 'abyss_warden', name: '深淵ヲ廻ルモノ', icon: '🌀' }
};

const FIELD_BOSS_STAT_MULTIPLIER = 2.4; // 地域ボスのステータス倍率（ダンジョンの強ボスと同倍率）

// フィールドの徘徊モンスターは、ボットマッチと全く同じ考え方で生成する：
// BOT_MONSTERS（ボットマッチで戦える約100種すべて）から抽選し、
// プレイヤーの実戦闘ステータス（武器・スキル補正込み）にそのモンスターの
// statMultiplierを掛けてステータスを決める。素材ドロップもBOT_MONSTERSの
// materialDropsをそのまま使うので、tier4素材モンスターも自然にフィールドへ出る。
// statMultiplierが高いモンスターほど出現重みを下げ、「強い個体ほどレア」を再現する。
// フィールドに出す徘徊モンスターを選ぶ。MMO化前のSchoolBattle本来の
// 「おまかせボットマッチ」と全く同じ選出方法（pickRandomBotMonsterForPlayer）を
// 使うことで、ボットマッチで戦えるモンスターがほぼすべてフィールドにも
// 出現するようにする（プレイヤーの強さの0.3〜6倍の範囲からランダムに選ばれる）。
function pickFieldBotMonster(playerBattleStats) {
    if (typeof BOT_MONSTERS === 'undefined' || !BOT_MONSTERS.length) return null;
    if (playerBattleStats && typeof pickRandomBotMonsterForPlayer === 'function') {
        return pickRandomBotMonsterForPlayer(playerBattleStats);
    }
    return BOT_MONSTERS[Math.floor(Math.random() * BOT_MONSTERS.length)];
}

// BOT_MONSTERSの1体をフィールド用モンスターに変換する。
// ステータスはプレイヤーには左右されない「モンスターごとの固定合計ステータス」
// （monster-stats.js）を、通常のボットバトルと同じgenerateFixedBotStats()で
// 5つのステータスにランダム振り分けする＝MMO化前と完全に同じ基準になる。
function buildFieldMonsterFromTemplate(template, playerBattleStats, worldW, worldH) {
    const totalStat = (typeof getMonsterTotalStat === 'function') ? getMonsterTotalStat(template) : 500;
    const built = (typeof generateFixedBotStats === 'function')
        ? generateFixedBotStats(totalStat)
        : { maxHp: Math.round(totalStat * 0.4), atk: Math.round(totalStat * 0.2), def: Math.round(totalStat * 0.15), speed: Math.round(totalStat * 0.1), special: Math.round(totalStat * 0.15) };

    // プレイヤーの強さと比べてどれくらい強い個体かで、レア個体の見た目を付ける
    const playerTotal = (playerBattleStats && typeof getStatTotalForBotMatch === 'function') ? getStatTotalForBotMatch(playerBattleStats) : totalStat;
    const ratio = totalStat / Math.max(1, playerTotal);
    const isElite = ratio > 1.6;

    return {
        id: template.id,
        name: template.name,
        icon: template.monsterEmoji || '👾',
        level: (playerBattleStats && playerBattleStats.grade) || 1,
        hp: built.maxHp, maxHp: built.maxHp, atk: built.atk, def: built.def, speed: built.speed, special: built.special,
        exp: Math.max(5, Math.round(built.maxHp * 0.15)),
        coins: Math.max(3, Math.round(built.maxHp * 0.08)),
        color: ratio > 3 ? '#c0392b' : (isElite ? '#d4a017' : '#4CAF50'),
        size: ratio > 3 ? 44 : (isElite ? 36 : 28),
        moveSpeed: 40,
        isEliteField: isElite,
        materialDrops: template.materialDrops || [],
        uid: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: Math.random() * (worldW - 100) + 50,
        y: Math.random() * (worldH - 100) + 50,
        targetX: null, targetY: null, dir: 'down', lastMoveTime: 0,
        moveInterval: 2000 + Math.random() * 3000
    };
}

// 地域ボスをプレイヤーの実戦闘ステータス基準で組み立てる（ボスダンジョン入口用）
function buildFieldBossMonster(regionId, playerBattleStats) {
    const bossDef = REGION_BOSS[regionId];
    if (!bossDef) return null;
    const stats = playerBattleStats || { maxHp: 100, atk: 20, def: 10, speed: 10, grade: 1 };
    const maxHp = Math.max(1, Math.round(stats.maxHp * FIELD_BOSS_STAT_MULTIPLIER));
    const atk = Math.max(1, Math.round(stats.atk * FIELD_BOSS_STAT_MULTIPLIER));
    const def = Math.max(1, Math.round(stats.def * FIELD_BOSS_STAT_MULTIPLIER));
    const speed = Math.max(1, Math.round(stats.speed * FIELD_BOSS_STAT_MULTIPLIER));
    return {
        id: bossDef.id, name: bossDef.name, icon: bossDef.icon,
        level: (stats.grade || 1) + 10,
        hp: maxHp, maxHp, atk, def, speed,
        special: Math.max(1, Math.round(atk * 0.6)),
        exp: Math.round(maxHp * 1.5), coins: Math.round(maxHp * 0.8),
        color: '#c0392b', size: 46, moveSpeed: 0,
        isFieldBoss: true,
        materialDrops: [],
        uid: `boss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
}

// モンスターを出現させる関数（フィールド徘徊モンスター用。ボスはここでは生成しない）
function spawnMonster(regionId, worldW, worldH, playerBattleStats) {
    const template = pickFieldBotMonster(playerBattleStats);
    if (template) {
        return buildFieldMonsterFromTemplate(template, playerBattleStats, worldW, worldH);
    }

    // BOT_MONSTERSが読み込まれていない場合のフォールバック（簡易モンスター）
    const monsterTemplate = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
    if (!monsterTemplate) return null;
    return {
        ...monsterTemplate,
        uid: `monster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: Math.random() * (worldW - 100) + 50,
        y: Math.random() * (worldH - 100) + 50,
        targetX: null, targetY: null, dir: 'down', lastMoveTime: 0,
        moveInterval: 2000 + Math.random() * 3000
    };
}

// 複数のモンスターを生成
function spawnMonsters(regionId, worldW, worldH, count, playerBattleStats) {
    const monsters = [];
    for (let i = 0; i < count; i++) {
        const monster = spawnMonster(regionId, worldW, worldH, playerBattleStats);
        if (monster) {
            monsters.push(monster);
        }
    }
    return monsters;
}

// モンスターのAI移動を更新
function updateMonsterAI(monster, worldW, worldH, dt) {
    const now = Date.now();
    
    // 移動インターバルチェック
    if (now - monster.lastMoveTime < monster.moveInterval) {
        return;
    }
    
    monster.lastMoveTime = now;
    
    // ランダムな方向に移動
    const moveDistance = 50 + Math.random() * 100;
    const angle = Math.random() * Math.PI * 2;
    
    let newX = monster.x + Math.cos(angle) * moveDistance;
    let newY = monster.y + Math.sin(angle) * moveDistance;
    
    // ワールド境界内に収める
    newX = Math.max(50, Math.min(worldW - 50, newX));
    newY = Math.max(50, Math.min(worldH - 50, newY));
    
    monster.targetX = newX;
    monster.targetY = newY;
    
    // 方向を更新
    const dx = newX - monster.x;
    const dy = newY - monster.y;
    if (Math.abs(dx) > Math.abs(dy)) {
        monster.dir = dx > 0 ? 'right' : 'left';
    } else {
        monster.dir = dy > 0 ? 'down' : 'up';
    }
}

// モンスターの位置補間
function interpolateMonsterPosition(monster, dt) {
    if (monster.targetX !== null && monster.targetY !== null) {
        const t = Math.min(1, dt * 3); // 補間速度
        monster.x += (monster.targetX - monster.x) * t;
        monster.y += (monster.targetY - monster.y) * t;
        
        // 目標位置に近づいたら移動完了
        if (Math.abs(monster.x - monster.targetX) < 1 && Math.abs(monster.y - monster.targetY) < 1) {
            monster.x = monster.targetX;
            monster.y = monster.targetY;
            monster.targetX = null;
            monster.targetY = null;
        }
    }
}

// モンスターとの遭遇判定
function checkMonsterEncounter(playerX, playerY, monsters, encounterRadius = 30) {
    for (const monster of monsters) {
        const distance = Math.hypot(playerX - monster.x, playerY - monster.y);
        if (distance < encounterRadius) {
            return monster;
        }
    }
    return null;
}

// モンスターを既存のバトルシステム用に変換
function convertMonsterToBattlePlayer(monster) {
    return {
        id: monster.uid,
        name: monster.name,
        level: monster.level,
        hp: monster.hp,
        maxHp: monster.hp,
        atk: monster.atk,
        def: monster.def,
        speed: monster.speed,
        special: monster.special,
        isMonster: true,
        monsterData: monster
    };
}

// モンスター描画用のSVGを生成
function getMonsterSVG(monster, size = 32) {
    const color = monster.color || '#4CAF50';
    
    return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <!-- 影 -->
            <ellipse cx="16" cy="28" rx="12" ry="4" fill="rgba(0,0,0,0.3)"/>
            <!-- 体 -->
            <circle cx="16" cy="16" r="14" fill="${color}"/>
            <!-- 目 -->
            <circle cx="12" cy="14" r="3" fill="#000"/>
            <circle cx="20" cy="14" r="3" fill="#000"/>
            <!-- 口 -->
            <path d="M12 22 Q16 26 20 22" stroke="#000" stroke-width="2" fill="none"/>
        </svg>
    `;
}

// モンスターのドロップアイテムを生成
function generateMonsterDrop(monster) {
    const drops = [];
    
    // コインは必ずドロップ
    drops.push({
        type: 'coins',
        amount: monster.coins + Math.floor(Math.random() * 5)
    });

    // 地域ボス・tier4レア個体は明示的なmaterialDropsを持っている（BOT_MONSTERSと同形式）
    if (monster.materialDrops && monster.materialDrops.length) {
        monster.materialDrops.forEach(d => {
            if (Math.random() < d.chance) {
                drops.push({ type: 'material', materialId: d.materialId, amount: 1 });
            }
        });
    } else if (Math.random() < 0.3) { // 通常モンスターは30%で素材ドロップ
        const materials = ['slime_gel', 'goblin_ear', 'wolf_fang', 'magic_crystal', 'stone_shard', 'dragon_scale'];
        const materialTypes = {
            'slime': ['slime_gel'],
            'goblin': ['goblin_ear'],
            'wolf': ['wolf_fang'],
            'forest_mage': ['magic_crystal'],
            'golem': ['stone_shard'],
            'dragon': ['dragon_scale']
        };
        
        const possibleMaterials = materialTypes[monster.id] || materials;
        const material = possibleMaterials[Math.floor(Math.random() * possibleMaterials.length)];
        
        drops.push({
            type: 'material',
            materialId: material,
            amount: 1
        });
    }
    
    // オーブのドロップ
    if (monster.isFieldBoss) {
        // 地域ボスは確定でtier4オーブをドロップ（探索の目玉報酬）
        drops.push({ type: 'orb', tier: 'tier4' });
    } else if (monster.isEliteField) {
        // tier4レア個体はtier3〜4のオーブを高確率でドロップ
        if (Math.random() < 0.5) {
            drops.push({ type: 'orb', tier: Math.random() < 0.5 ? 'tier3' : 'tier4' });
        }
    } else if (Math.random() < 0.05) { // 通常モンスターは5%でオーブドロップ
        drops.push({
            type: 'orb',
            tier: ['tier1', 'tier1', 'tier1', 'tier2'][Math.floor(Math.random() * 4)] // tier1が75%、tier2が25%
        });
    }
    
    return drops;
}

// グローバル関数として公開
window.MONSTERS = MONSTERS;
window.REGION_BOSS = REGION_BOSS;
window.spawnMonster = spawnMonster;
window.spawnMonsters = spawnMonsters;
window.buildFieldBossMonster = buildFieldBossMonster;
window.updateMonsterAI = updateMonsterAI;
window.interpolateMonsterPosition = interpolateMonsterPosition;
window.checkMonsterEncounter = checkMonsterEncounter;
window.convertMonsterToBattlePlayer = convertMonsterToBattlePlayer;
window.getMonsterSVG = getMonsterSVG;
window.generateMonsterDrop = generateMonsterDrop;