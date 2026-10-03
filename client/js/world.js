// ============================================
// School Battle - 町フィールド (world.js)
// ============================================
// ・Canvasで描画する2Dトップダウンの町フィールド
// ・WASD / 矢印キー / 画面上の十字キーで自由移動
// ・Socket.IOで他プレイヤーの位置をリアルタイムに同期
// ・建物に近づいてEnter（またはタップ）すると、既存の
//   ショップ／勉強／オンライン対戦などの画面がそのまま開く
// ============================================

(function () {
    const MOVE_SPEED = 210; // px/sec
    const INTERACT_RADIUS = 70;
    const MOVE_SEND_INTERVAL = 90; // ms

    // 町の建物定義：既存のサイドバー機能をそのまま「町の設備」として配置する
    const TOWN_BUILDINGS = [
        { id: "inn", section: "stats", label: "宿屋（ステータス）", icon: "🏠", x: 180, y: 180, w: 140, h: 110, color: "#8d6e63" },
        { id: "school", section: "study", label: "学習所", icon: "📖", x: 460, y: 140, w: 140, h: 110, color: "#5b9bd5" },
        { id: "board", section: "missions", label: "掲示板（ミッション）", icon: "🎯", x: 760, y: 160, w: 130, h: 100, color: "#ffc107" },
        { id: "shop", section: "shop", label: "武器屋・道具屋", icon: "🛒", x: 1040, y: 150, w: 150, h: 110, color: "#c9812f" },
        { id: "dojo", section: "skills", label: "修行場（スキル）", icon: "⚔️", x: 1300, y: 200, w: 140, h: 110, color: "#9b59b6" },
        { id: "arena", section: "online", label: "闘技場（オンライン対戦）", icon: "🌐", x: 1300, y: 520, w: 160, h: 120, color: "#e85a7a" },
        { id: "shrine", section: "boss-battle", label: "ボスの祠", icon: "👹", x: 1020, y: 600, w: 150, h: 110, color: "#4a3b6b" },
        { id: "records", section: "ranking", label: "記録所（ランキング）", icon: "🏆", x: 740, y: 640, w: 140, h: 100, color: "#3ddc84" },
        { id: "workshop", section: "workshop", label: "オーブ工房", icon: "💎", x: 460, y: 610, w: 150, h: 110, color: "#6a5acd" },
        { id: "info", section: "help", label: "案内所", icon: "❓", x: 200, y: 560, w: 120, h: 100, color: "#607d8b" },
        { id: "dungeon", section: "dungeon", label: "ダンジョン入口", icon: "🚪", x: 100, y: 400, w: 120, h: 100, color: "#5D4037", isDungeon: true },
        { id: "library", section: "questionlists", label: "問題リスト", icon: "📚", x: 660, y: 460, w: 130, h: 100, color: "#3d5a80" },
        { id: "gate_grassland", isExit: true, to: "grassland", label: "草原へ", icon: "🌾", x: 1520, y: 440, w: 70, h: 110, color: "#7cb342" }
    ];

    // 町のNPC定義
    const TOWN_NPCS = [
        { id: "village_head", name: "村長", icon: "👴", x: 300, y: 300 },
        { id: "healer", name: "治療師", icon: "👩‍⚕️", x: 500, y: 400 }
    ];

    // ワールド・地域定義：design doc「■11 世界・地域」の
    // はじまりの町 → 草原 → 知識の森 → 数学砂漠 → 氷の研究所 → 天空城
    // をつなぐ。REGION_MONSTERS（monsters.js）は既にこのIDで
    // 地域別モンスターを定義済みなので、そのまま利用する。
    const REGIONS = {
        town_main: {
            name: "はじまりの町", w: 1600, h: 1000, spawn: { x: 800, y: 500 },
            bg: "#2f5233", buildings: TOWN_BUILDINGS, npcs: TOWN_NPCS
        },
        grassland: {
            name: "草原", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#6b9b3a", npcs: [],
            buildings: [
                { id: "gate_town_main_from_grassland", isExit: true, to: "town_main", label: "はじまりの町へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_forest", isExit: true, to: "forest", label: "知識の森へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_grassland", isBossGate: true, regionId: "grassland", label: "ゴブリンキングの巣", icon: "👑", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        forest: {
            name: "知識の森", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#1f4d3a", npcs: [],
            buildings: [
                { id: "gate_grassland_from_forest", isExit: true, to: "grassland", label: "草原へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_wasteland", isExit: true, to: "wasteland", label: "荒野の戦場へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_forest", isBossGate: true, regionId: "forest", label: "森の魔女の巣", icon: "🧙‍♀️", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        wasteland: {
            name: "荒野の戦場", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#8a7355", npcs: [],
            buildings: [
                { id: "gate_forest_from_wasteland", isExit: true, to: "forest", label: "知識の森へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_mountain", isExit: true, to: "mountain", label: "岩山へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_wasteland", isBossGate: true, regionId: "wasteland", label: "オークの戦将の巣", icon: "🪓", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        mountain: {
            name: "岩山", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#6e6e6e", npcs: [],
            buildings: [
                { id: "gate_wasteland_from_mountain", isExit: true, to: "wasteland", label: "荒野の戦場へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_swamp", isExit: true, to: "swamp", label: "呪われた沼地へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_mountain", isBossGate: true, regionId: "mountain", label: "岩石トロールの巣", icon: "🗿", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        swamp: {
            name: "呪われた沼地", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#3d4a3a", npcs: [],
            buildings: [
                { id: "gate_mountain_from_swamp", isExit: true, to: "mountain", label: "岩山へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_desert", isExit: true, to: "desert", label: "数学砂漠へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_swamp", isBossGate: true, regionId: "swamp", label: "ヨルムンガンドの巣", icon: "🐍", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        desert: {
            name: "数学砂漠", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#c9a15a", npcs: [],
            buildings: [
                { id: "gate_swamp_from_desert", isExit: true, to: "swamp", label: "呪われた沼地へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_ice_lab", isExit: true, to: "ice_lab", label: "氷の研究所へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_desert", isBossGate: true, regionId: "desert", label: "サンドワームの巣", icon: "🏜️", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        ice_lab: {
            name: "氷の研究所", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#a7d8e8", npcs: [],
            buildings: [
                { id: "gate_desert_from_ice_lab", isExit: true, to: "desert", label: "数学砂漠へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_canyon", isExit: true, to: "canyon", label: "雷鳴の峡谷へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_ice_lab", isBossGate: true, regionId: "ice_lab", label: "アイスゴーレムの巣", icon: "❄️", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        canyon: {
            name: "雷鳴の峡谷", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#5a4a6e", npcs: [],
            buildings: [
                { id: "gate_ice_lab_from_canyon", isExit: true, to: "ice_lab", label: "氷の研究所へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_volcano", isExit: true, to: "volcano", label: "火山地帯へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_canyon", isBossGate: true, regionId: "canyon", label: "雷神ガルーダの巣", icon: "⚡", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        volcano: {
            name: "火山地帯", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#7a2e1d", npcs: [],
            buildings: [
                { id: "gate_canyon_from_volcano", isExit: true, to: "canyon", label: "雷鳴の峡谷へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_deep_sea", isExit: true, to: "deep_sea", label: "深海の海岸へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_volcano", isBossGate: true, regionId: "volcano", label: "フレイムドラゴンの巣", icon: "🔥", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        deep_sea: {
            name: "深海の海岸", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#1a4a6e", npcs: [],
            buildings: [
                { id: "gate_volcano_from_deep_sea", isExit: true, to: "volcano", label: "火山地帯へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_ruins", isExit: true, to: "ruins", label: "廃墟の要塞へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_deep_sea", isBossGate: true, regionId: "deep_sea", label: "深海クラーケンの巣", icon: "🐙", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        ruins: {
            name: "廃墟の要塞", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#4a4a3a", npcs: [],
            buildings: [
                { id: "gate_deep_sea_from_ruins", isExit: true, to: "deep_sea", label: "深海の海岸へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_graveyard", isExit: true, to: "graveyard", label: "夜霧の墓地へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_ruins", isBossGate: true, regionId: "ruins", label: "アビサルナイトの巣", icon: "⚔️", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        graveyard: {
            name: "夜霧の墓地", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#2e2e3a", npcs: [],
            buildings: [
                { id: "gate_ruins_from_graveyard", isExit: true, to: "ruins", label: "廃墟の要塞へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_sky_castle", isExit: true, to: "sky_castle", label: "天空城へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_graveyard", isBossGate: true, regionId: "graveyard", label: "血の伯爵の巣", icon: "🧛", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        sky_castle: {
            name: "天空城", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#4a3b6b", npcs: [],
            buildings: [
                { id: "gate_graveyard_from_sky_castle", isExit: true, to: "graveyard", label: "夜霧の墓地へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_fallen_church", isExit: true, to: "fallen_church", label: "堕天の廃教会へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_sky_castle", isBossGate: true, regionId: "sky_castle", label: "セレスティアルガーディアンの巣", icon: "😇", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        fallen_church: {
            name: "堕天の廃教会", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#3a1a2e", npcs: [],
            buildings: [
                { id: "gate_sky_castle_from_fallen_church", isExit: true, to: "sky_castle", label: "天空城へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "gate_abyssal_rift", isExit: true, to: "abyssal_rift", label: "深淵の裂け目へ", icon: "▶️", x: 2510, y: 845, w: 70, h: 110, color: "#37474f" },
                { id: "boss_gate_fallen_church", isBossGate: true, regionId: "fallen_church", label: "堕天使ルシフェルの巣", icon: "😈", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        },
        abyssal_rift: {
            name: "深淵の裂け目", w: 2600, h: 1800, spawn: { x: 240, y: 900 },
            bg: "#1a0a2e", npcs: [],
            buildings: [
                { id: "gate_fallen_church_from_abyssal_rift", isExit: true, to: "fallen_church", label: "堕天の廃教会へ戻る", icon: "◀️", x: 20, y: 855, w: 60, h: 90, color: "#8d6e63" },
                { id: "boss_gate_abyssal_rift", isBossGate: true, regionId: "abyssal_rift", label: "深淵ヲ廻ルモノの巣", icon: "🌀", x: 1300, y: 600, w: 100, h: 100, color: "#c0392b" }
            ]
        }
    };

    // 現在いる地域（ワールド）。移動時にtravelToRegion()で切り替える
    let currentRegionId = "town_main";
    let BUILDINGS = REGIONS[currentRegionId].buildings;
    let NPCS = REGIONS[currentRegionId].npcs;

    // ダンジョン用の設定（ダンジョンに入った時に更新される）
    let currentWorldW = REGIONS[currentRegionId].w;
    let currentWorldH = REGIONS[currentRegionId].h;

    const SPAWN = REGIONS[currentRegionId].spawn;

    let canvas, ctx, prompt, playerListEl, interactBtn;
    let viewportW = 800, viewportH = 500;

    let joined = false;
    let joinInFlight = false;
    let sectionActive = false;
    let rafId = null;
    let lastFrameTime = null;
    let lastSendTime = 0;
    let lastSentX = null, lastSentY = null, lastSentDir = null;

    const local = { x: SPAWN.x, y: SPAWN.y, dir: "down", moving: false };
    // リモートプレイヤー: id -> { name, level, x, y, dir, targetX, targetY, avatar }
    const remotePlayers = {};
    // フィールド上のモンスター
    const fieldMonsters = [];
    // パーティーメンバーのインジケーター
    const partyIndicators = {};

    const keys = { up: false, down: false, left: false, right: false };
    const dpadKeys = { up: false, down: false, left: false, right: false };

    function colorForId(id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
        const hue = hash % 360;
        return `hsl(${hue}, 62%, 55%)`;
    }

    function getMyPlayer() {
        try {
            return typeof getPlayerData === "function" ? getPlayerData() : null;
        } catch (e) {
            return null;
        }
    }

    function initDom() {
        console.log('[World] initDom() called');
        canvas = document.getElementById("townCanvas");
        if (!canvas) {
            console.error('[World] townCanvas element not found');
            return false;
        }
        console.log('[World] townCanvas found:', canvas);
        ctx = canvas.getContext("2d");
        prompt = document.getElementById("townPrompt");
        playerListEl = document.getElementById("townPlayerList");
        interactBtn = document.getElementById("townInteractBtn");
        viewportW = canvas.width;
        viewportH = canvas.height;
        console.log('[World] Canvas dimensions:', viewportW, viewportH);

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        canvas.addEventListener("click", onCanvasClick);

        if (interactBtn) {
            interactBtn.addEventListener("click", () => {
                const b = findNearbyBuilding();
                if (b) enterBuilding(b);
            });
        }

        document.querySelectorAll(".town-dpad-btn").forEach(btn => {
            const dir = btn.dataset.dir;
            const setState = (v) => { dpadKeys[dir] = v; };
            btn.addEventListener("touchstart", (e) => { e.preventDefault(); setState(true); }, { passive: false });
            btn.addEventListener("touchend", (e) => { e.preventDefault(); setState(false); }, { passive: false });
            btn.addEventListener("mousedown", () => setState(true));
            btn.addEventListener("mouseup", () => setState(false));
            btn.addEventListener("mouseleave", () => setState(false));
        });

        return true;
    }

    function onKeyDown(e) {
        if (!sectionActive) return;
        console.log('[World] Key down:', e.key);
        switch (e.key) {
            case "w": case "W": case "ArrowUp": keys.up = true; break;
            case "s": case "S": case "ArrowDown": keys.down = true; break;
            case "a": case "A": case "ArrowLeft": keys.left = true; break;
            case "d": case "D": case "ArrowRight": keys.right = true; break;
            case "Enter": case " ": {
                const b = findNearbyBuilding();
                if (b) {
                    enterBuilding(b);
                } else {
                    const npc = findNearbyNPC();
                    if (npc) talkToNPC(npc);
                }
                break;
            }
        }
    }

    function onKeyUp(e) {
        switch (e.key) {
            case "w": case "W": case "ArrowUp": keys.up = false; break;
            case "s": case "S": case "ArrowDown": keys.down = false; break;
            case "a": case "A": case "ArrowLeft": keys.left = false; break;
            case "d": case "D": case "ArrowRight": keys.right = false; break;
        }
    }

    function onCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX + camera().x;
        const clickY = (e.clientY - rect.top) * scaleY + camera().y;

        // 建物のクリック判定
        for (const b of BUILDINGS) {
            if (clickX >= b.x && clickX <= b.x + b.w && clickY >= b.y && clickY <= b.y + b.h) {
                enterBuilding(b);
                return;
            }
        }
        
        // NPCのクリック判定
        for (const npc of NPCS) {
            const dist = Math.hypot(clickX - npc.x, clickY - npc.y);
            if (dist < 30) {
                talkToNPC(npc);
                return;
            }
        }
    }

    function enterBuilding(building) {
        if (building.isExit) {
            // 地域の出入口ゲート：別の地域（ワールド）へ移動する
            travelToRegion(building.to);
        } else if (building.isBossGate) {
            // その地域専用のボスダンジョン：入ると即座にボス戦が始まる
            enterRegionBossBattle(building.regionId);
        } else if (building.isDungeon) {
            // ダンジョン入口の場合はダンジョン選択UIを表示
            if (typeof showDungeonSelectionUI === "function") {
                showDungeonSelectionUI();
            }
        } else if (typeof window.activateSection === "function") {
            window.activateSection(building.section, true); // fromTown = true
        }
    }

    // 地域ボスとの戦闘を開始する（■3：ボスはランダム湧きではなく、
    // マップごとに対応した専用のボスダンジョンとして用意する）
    function enterRegionBossBattle(regionId) {
        const player = getMyPlayer();
        if (!player) {
            alert('キャラクターデータが見つかりません');
            return;
        }
        if (typeof buildFieldBossMonster !== 'function' || typeof convertMonsterToBattlePlayer !== 'function') return;

        const playerBattleStats = typeof getBattleStats === 'function' ? getBattleStats(player) : null;
        const bossMonster = buildFieldBossMonster(regionId, playerBattleStats);
        if (!bossMonster) return;

        const battleMonster = convertMonsterToBattlePlayer(bossMonster);
        localStorage.removeItem("pendingQuestMonster");
        startBattleWithMonster(battleMonster);
    }

    // 別の地域（ワールド）へ移動する：今のワールドから退出し、
    // 新しいワールドへworld:joinし直す
    function travelToRegion(regionId) {
        const region = REGIONS[regionId];
        if (!region || regionId === currentRegionId) return;

        const player = getMyPlayer();
        if (window.socket && window.socket.connected && player && player.id) {
            window.socket.emit("world:leave", { worldId: currentRegionId, playerId: player.id });
        }

        currentRegionId = regionId;
        BUILDINGS = region.buildings;
        NPCS = region.npcs;
        currentWorldW = region.w;
        currentWorldH = region.h;
        local.x = region.spawn.x;
        local.y = region.spawn.y;

        for (const key in remotePlayers) delete remotePlayers[key];
        lastSentX = lastSentY = lastSentDir = null;

        fieldMonsters.length = 0;
        initializeMonsters();

        joined = false;
        tryJoinWorld();
    }

    function setDungeonWorld(dungeon) {
        if (!dungeon) return;
        
        // ワールドサイズをダンジョン用に更新
        currentWorldW = dungeon.width;
        currentWorldH = dungeon.height;
        
        // モンスターをクリアして再生成
        fieldMonsters.length = 0;
        initializeMonsters();
    }

    function resetToWorldDefaults() {
        // 今いる地域のデフォルト設定に戻す
        currentWorldW = REGIONS[currentRegionId].w;
        currentWorldH = REGIONS[currentRegionId].h;
        
        // モンスターをクリアして再生成
        fieldMonsters.length = 0;
        initializeMonsters();
    }

    function talkToNPC(npc) {
        if (typeof showNPCDialogue === "function") {
            showNPCDialogue(npc.id);
        }
    }

    function findNearbyBuilding() {
        let closest = null;
        let closestDist = Infinity;
        for (const b of BUILDINGS) {
            const cx = b.x + b.w / 2;
            const cy = b.y + b.h + 10; // 入口はだいたい建物の手前（下側）
            const d = Math.hypot(local.x - cx, local.y - cy);
            if (d < INTERACT_RADIUS && d < closestDist) {
                closest = b;
                closestDist = d;
            }
        }
        return closest;
    }

    function findNearbyNPC() {
        let closest = null;
        let closestDist = Infinity;
        for (const npc of NPCS) {
            const d = Math.hypot(local.x - npc.x, local.y - npc.y);
            if (d < INTERACT_RADIUS && d < closestDist) {
                closest = npc;
                closestDist = d;
            }
        }
        return closest;
    }

    function camera() {
        let cx = local.x - viewportW / 2;
        let cy = local.y - viewportH / 2;
        cx = Math.max(0, Math.min(currentWorldW - viewportW, cx));
        cy = Math.max(0, Math.min(currentWorldH - viewportH, cy));
        return { x: cx, y: cy };
    }

    function collidesWithBuilding(x, y) {
        const r = 16; // プレイヤーの当たり判定半径
        for (const b of BUILDINGS) {
            if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
                return true;
            }
        }
        return false;
    }

    function updateLocalMovement(dt) {
        const up = keys.up || dpadKeys.up;
        const down = keys.down || dpadKeys.down;
        const left = keys.left || dpadKeys.left;
        const right = keys.right || dpadKeys.right;

        let dx = 0, dy = 0;
        if (up) dy -= 1;
        if (down) dy += 1;
        if (left) dx -= 1;
        if (right) dx += 1;

        local.moving = dx !== 0 || dy !== 0;

        if (local.moving) {
            console.log('[World] Moving:', dx, dy, 'position:', local.x, local.y);
        }

        if (local.moving) {
            const len = Math.hypot(dx, dy) || 1;
            dx /= len; dy /= len;

            if (Math.abs(dx) > Math.abs(dy)) {
                local.dir = dx > 0 ? "right" : "left";
            } else {
                local.dir = dy > 0 ? "down" : "up";
            }

            const nx = local.x + dx * MOVE_SPEED * dt;
            const ny = local.y + dy * MOVE_SPEED * dt;

            const margin = 16;
            const clampedX = Math.max(margin, Math.min(currentWorldW - margin, nx));
            const clampedY = Math.max(margin, Math.min(currentWorldH - margin, ny));

            // X軸・Y軸を別々に判定して、壁沿いに滑れるようにする
            if (!collidesWithBuilding(clampedX, local.y)) local.x = clampedX;
            if (!collidesWithBuilding(local.x, clampedY)) local.y = clampedY;
        }
    }

    function maybeSendPosition() {
        const now = Date.now();
        if (now - lastSendTime < MOVE_SEND_INTERVAL) return;
        if (local.x === lastSentX && local.y === lastSentY && local.dir === lastSentDir) return;
        if (!window.socket || !window.socket.connected) return;

        const player = getMyPlayer();
        if (!player || !player.id) return;

        window.socket.emit("world:move", {
            worldId: currentRegionId,
            playerId: player.id,
            x: local.x,
            y: local.y,
            dir: local.dir
        });

        // パーティーメンバーにも位置を送信
        window.socket.emit("party:updatePosition", {
            playerId: player.id,
            x: local.x,
            y: local.y,
            worldId: currentRegionId
        });

        lastSendTime = now;
        lastSentX = local.x; lastSentY = local.y; lastSentDir = local.dir;
    }

    function updateRemoteInterpolation(dt) {
        for (const id in remotePlayers) {
            const p = remotePlayers[id];
            const t = Math.min(1, dt * 10);
            p.x += (p.targetX - p.x) * t;
            p.y += (p.targetY - p.y) * t;
        }
    }

    function drawBackground(cam) {
        ctx.fillStyle = (REGIONS[currentRegionId] && REGIONS[currentRegionId].bg) || "#2f5233";
        ctx.fillRect(0, 0, viewportW, viewportH);

        // 簡易的な地面のタイル模様
        const tile = 40;
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.lineWidth = 1;
        const offsetX = -cam.x % tile;
        const offsetY = -cam.y % tile;
        for (let x = offsetX; x < viewportW; x += tile) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewportH); ctx.stroke();
        }
        for (let y = offsetY; y < viewportH; y += tile) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewportW, y); ctx.stroke();
        }

        // 建物同士を結ぶ簡易的な道
        ctx.fillStyle = "#c9b894";
        ctx.globalAlpha = 0.35;
        for (const b of BUILDINGS) {
            const cx = b.x + b.w / 2 - cam.x;
            const cy = b.y + b.h - cam.y;
            ctx.beginPath();
            ctx.arc(cx, cy + 20, 46, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawBuildings(cam) {
        for (const b of BUILDINGS) {
            const x = b.x - cam.x;
            const y = b.y - cam.y;
            if (x + b.w < 0 || x > viewportW || y + b.h < 0 || y > viewportH) continue;

            ctx.fillStyle = b.color;
            roundRect(x, y, b.w, b.h, 10);
            ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.lineWidth = 2;
            roundRect(x, y, b.w, b.h, 10);
            ctx.stroke();

            ctx.font = "28px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(b.icon, x + b.w / 2, y + b.h / 2 + 10);

            ctx.font = "bold 12px sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(b.label, x + b.w / 2, y + b.h + 16);
        }
    }

    function drawNPCs(cam) {
        for (const npc of NPCS) {
            const x = npc.x - cam.x;
            const y = npc.y - cam.y;
            
            // 画面外の場合は描画しない
            if (x < 0 || x > viewportW || y < 0 || y > viewportH) continue;
            
            // 影
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.ellipse(x, y + 16, 14, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // NPC本体
            ctx.fillStyle = "#FFC107";
            ctx.beginPath();
            ctx.arc(x, y, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // アイコン
            ctx.font = "24px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(npc.icon, x, y);
            
            // 名前
            ctx.font = "bold 11px sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.textBaseline = "bottom";
            const label = npc.name;
            const labelW = ctx.measureText(label).width;
            ctx.fillStyle = "rgba(255, 193, 7, 0.8)";
            roundRect(x - labelW / 2 - 5, y - 35, labelW + 10, 16, 6);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.fillText(label, x, y - 23);
        }
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawPlayer(x, y, color, name, level, dir, isMe, avatar = null) {
        ctx.save();
        
        // アバターデータがある場合はアバターを描画
        if (avatar && typeof getAvatarSVG === 'function') {
            // 影
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.ellipse(x, y + 16, 14, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // アバターSVGを描画
            const avatarSize = 32;
            const img = new Image();
            const svgString = getAvatarSVG(avatar, avatarSize);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            img.onload = () => {
                ctx.drawImage(img, x - avatarSize/2, y - avatarSize/2 - 8, avatarSize, avatarSize);
                URL.revokeObjectURL(url);
            };
            img.src = url;
            
            // 向き（三角形）
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            const dirVec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] || [0, 1];
            const tipX = x + dirVec[0] * 20;
            const tipY = y + dirVec[1] * 20;
            const perpX = -dirVec[1] * 5;
            const perpY = dirVec[0] * 5;
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(x + perpX, y + perpY);
            ctx.lineTo(x - perpX, y - perpY);
            ctx.closePath();
            ctx.fill();
        } else {
            // 従来のシンプルな描画（アバターがない場合）
            // 影
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.ellipse(x, y + 16, 14, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // 体
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = isMe ? "#ffffff" : "rgba(0,0,0,0.4)";
            ctx.lineWidth = isMe ? 2.5 : 1.5;
            ctx.stroke();

            // 向き（三角形）
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            const dirVec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] || [0, 1];
            const tipX = x + dirVec[0] * 18;
            const tipY = y + dirVec[1] * 18;
            const perpX = -dirVec[1] * 5;
            const perpY = dirVec[0] * 5;
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(x + perpX, y + perpY);
            ctx.lineTo(x - perpX, y - perpY);
            ctx.closePath();
            ctx.fill();
        }

        // 名前ラベル
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        const label = `${name} Lv.${level || 1}`;
        const labelW = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(15,17,21,0.7)";
        roundRect(x - labelW / 2 - 5, y - 38, labelW + 10, 16, 6);
        ctx.fill();
        ctx.fillStyle = isMe ? "#3ddc84" : "#f0f2f5";
        ctx.fillText(label, x, y - 26);

        ctx.restore();
    }

    function updatePromptUI() {
        const b = findNearbyBuilding();
        if (b) {
            if (prompt) {
                prompt.style.display = "block";
                prompt.textContent = `Enterキーで「${b.label}」に入る`;
            }
            if (interactBtn) {
                interactBtn.style.display = "inline-flex";
                interactBtn.textContent = `入る（${b.label}）`;
            }
        } else {
            if (prompt) prompt.style.display = "none";
            if (interactBtn) interactBtn.style.display = "none";
        }
    }

    function updatePlayerListUI() {
        if (!playerListEl) return;
        const count = Object.keys(remotePlayers).length + 1;
        const regionName = (REGIONS[currentRegionId] && REGIONS[currentRegionId].name) || "町";
        let html = `<strong>現在地：${regionName}（人数: ${count}）</strong>`;
        playerListEl.innerHTML = html;
    }

    function render() {
        if (!ctx) return;
        const cam = camera();
        drawBackground(cam);
        drawBuildings(cam);
        drawNPCs(cam);
        drawMonsters(cam);
        drawPartyIndicators(cam);

        for (const id in remotePlayers) {
            const p = remotePlayers[id];
            drawPlayer(p.x - cam.x, p.y - cam.y, colorForId(id), p.name, p.level, p.dir, false, p.avatar);
        }

        const player = getMyPlayer();
        const myAvatar = player && player.avatar ? player.avatar : null;
        drawPlayer(local.x - cam.x, local.y - cam.y, "#3ddc84", (player && player.name) || "あなた", player && player.level, local.dir, true, myAvatar);

        drawRegionLabel();
    }

    function drawRegionLabel() {
        const name = (REGIONS[currentRegionId] && REGIONS[currentRegionId].name) || "";
        if (!name) return;
        ctx.save();
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const label = `📍 ${name}`;
        const w = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(15,17,21,0.6)";
        roundRect(10, 10, w + 16, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, 18, 16);
        ctx.restore();
    }

    function loop(timestamp) {
        if (!sectionActive) { rafId = null; return; }
        if (lastFrameTime == null) lastFrameTime = timestamp;
        const dt = Math.min(0.1, (timestamp - lastFrameTime) / 1000);
        lastFrameTime = timestamp;

        updateLocalMovement(dt);
        updateRemoteInterpolation(dt);
        updateMonsters(dt);
        maybeSendPosition();
        checkEncounter();
        updatePromptUI();
        updatePlayerListUI();
        render();

        rafId = requestAnimationFrame(loop);
    }

    function startLoop() {
        if (rafId != null) {
            console.log('[World] Loop already running');
            return;
        }
        console.log('[World] Starting loop');
        lastFrameTime = null;
        rafId = requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (rafId != null) {
            console.log('[World] Stopping loop');
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        keys.up = keys.down = keys.left = keys.right = false;
        dpadKeys.up = dpadKeys.down = dpadKeys.left = dpadKeys.right = false;
    }

    function setupSocketListeners() {
        if (!window.socket) return;

        window.socket.on("world:state", (data) => {
            if (!data || data.worldId !== currentRegionId) return;
            for (const key in remotePlayers) delete remotePlayers[key];
            (data.players || []).forEach(p => {
                remotePlayers[p.id] = { 
                    name: p.name, 
                    level: p.level, 
                    x: p.x, 
                    y: p.y, 
                    targetX: p.x, 
                    targetY: p.y, 
                    dir: p.dir || "down",
                    avatar: p.avatar || null
                };
            });
            if (data.me) {
                local.x = data.me.x;
                local.y = data.me.y;
                local.dir = data.me.dir || "down";
            }
        });

        window.socket.on("world:playerJoined", (p) => {
            if (!p || !p.id) return;
            const myPlayer = getMyPlayer();
            if (myPlayer && myPlayer.id === p.id) return;
            remotePlayers[p.id] = { 
                name: p.name, 
                level: p.level, 
                x: p.x, 
                y: p.y, 
                targetX: p.x, 
                targetY: p.y, 
                dir: p.dir || "down",
                avatar: p.avatar || null
            };
        });

        window.socket.on("world:playerMoved", (p) => {
            if (!p || !p.id) return;
            const existing = remotePlayers[p.id];
            if (existing) {
                existing.targetX = p.x;
                existing.targetY = p.y;
                existing.dir = p.dir || existing.dir;
            }
        });

        window.socket.on("world:playerLeft", (p) => {
            if (!p || !p.id) return;
            delete remotePlayers[p.id];
        });

        window.socket.on("connect", () => {
            // 再接続時は再度参加しなおす
            joined = false;
            tryJoinWorld();
        });
    }

    function tryJoinWorld() {
        if (joined || joinInFlight) return;
        if (!window.socket || !window.socket.connected) return;
        const player = getMyPlayer();
        if (!player || !player.id) return;

        joinInFlight = true;
        window.socket.emit("world:join", {
            worldId: currentRegionId,
            player: { 
                id: player.id, 
                name: player.name, 
                level: player.level,
                avatar: player.avatar || null
            },
            spawn: { x: local.x, y: local.y }
        });
        joined = true;
        joinInFlight = false;
    }

    // script.jsのメニュー切り替えから呼ばれる：町タブがアクティブになったか
    window.onTownSectionActivated = function (isActive) {
        console.log('[World] onTownSectionActivated called:', isActive);
        sectionActive = isActive;
        if (isActive) {
            tryJoinWorld();
            startLoop();
        } else {
            stopLoop();
        }
    };

    function init() {
        console.log('[World] init() called');
        if (!initDom()) {
            console.error('[World] initDom() failed');
            return;
        }
        console.log('[World] initDom() succeeded');
        setupSocketListeners();

        // モンスターを初期化
        initializeMonsters();

        // ソケット・キャラクターがまだ準備できていないケースに備えて、
        // 準備が整うまで軽くポーリングして参加を試みる
        const readyPoll = setInterval(() => {
            if (window.socket && window.socket.connected && getMyPlayer()) {
                tryJoinWorld();
                if (joined) clearInterval(readyPoll);
            }
        }, 1500);
    }

    function initializeMonsters() {
        // モンスターをスポーン（ボットマッチと同じ「プレイヤーの実戦闘ステータス
        // （武器・スキル補正込み）× BOT_MONSTERSのstatMultiplier」でステータスを決める）
        // ただし町（はじまりの町）は安全地帯としてモンスターを出現させない
        if (currentRegionId !== 'town_main' && typeof spawnMonsters === 'function') {
            const monsterCount = 16; // フィールドを広くしたのでモンスター数も増やす
            const player = getMyPlayer();
            const playerBattleStats = player && typeof getBattleStats === 'function' ? getBattleStats(player) : null;
            const newMonsters = spawnMonsters(currentRegionId, currentWorldW, currentWorldH, monsterCount, playerBattleStats);
            fieldMonsters.push(...newMonsters);
        }
        
        // ダンジョンの場合はダンジョン固有のモンスターをスポーン
        const currentDungeon = typeof getCurrentDungeon === 'function' ? getCurrentDungeon() : null;
        if (currentDungeon && currentDungeon.monsters && currentDungeon.monsterCount) {
            if (typeof spawnMonster === 'function') {
                const dungeonMonsters = [];
                for (let i = 0; i < currentDungeon.monsterCount; i++) {
                    const monsterTemplateId = currentDungeon.monsters[Math.floor(Math.random() * currentDungeon.monsters.length)];
                    if (typeof spawnMonster === 'function') {
                        // ダンジョン用のモンスター生成
                        const monster = spawnMonster(currentDungeon.worldId, currentDungeon.width, currentDungeon.height);
                        if (monster) {
                            // モンスターIDをダンジョン固有のものに上書き
                            const template = window.MONSTERS?.find(m => m.id === monsterTemplateId);
                            if (template) {
                                Object.assign(monster, {
                                    id: template.id,
                                    name: template.name,
                                    level: template.level,
                                    hp: template.hp,
                                    atk: template.atk,
                                    def: template.def,
                                    speed: template.speed,
                                    special: template.special,
                                    exp: template.exp,
                                    coins: template.coins,
                                    color: template.color,
                                    size: template.size,
                                    moveSpeed: template.moveSpeed,
                                    icon: template.icon
                                });
                            }
                            dungeonMonsters.push(monster);
                        }
                    }
                }
                fieldMonsters.push(...dungeonMonsters);
            }
        }
    }

    function updateMonsters(dt) {
        for (const monster of fieldMonsters) {
            if (typeof updateMonsterAI === 'function') {
                updateMonsterAI(monster, currentWorldW, currentWorldH, dt);
            }
            if (typeof interpolateMonsterPosition === 'function') {
                interpolateMonsterPosition(monster, dt);
            }
        }
    }

    function drawMonsters(cam) {
        for (const monster of fieldMonsters) {
            const x = monster.x - cam.x;
            const y = monster.y - cam.y;
            
            // 画面外の場合は描画しない
            if (x + monster.size < 0 || x > viewportW || y + monster.size < 0 || y > viewportH) continue;
            
            // 影
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.ellipse(x, y + monster.size/2 + 5, monster.size/2, monster.size/4, 0, 0, Math.PI * 2);
            ctx.fill();

            // 地域ボス／tier4レア個体は特別なオーラを描く
            if (monster.isFieldBoss || monster.isEliteField) {
                const auraColor = monster.isFieldBoss ? "rgba(224,60,60,0.35)" : "rgba(212,160,23,0.35)";
                ctx.fillStyle = auraColor;
                ctx.beginPath();
                ctx.arc(x, y, monster.size / 2 + 8, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // モンスター本体
            ctx.fillStyle = monster.color || '#4CAF50';
            ctx.beginPath();
            ctx.arc(x, y, monster.size/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = monster.isFieldBoss ? "#e03c3c" : (monster.isEliteField ? "#d4a017" : "rgba(0,0,0,0.4)");
            ctx.lineWidth = (monster.isFieldBoss || monster.isEliteField) ? 4 : 2;
            ctx.stroke();
            
            // アイコン
            ctx.font = `${monster.size}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(monster.icon || '👾', x, y);
            
            // 名前とレベル（ボス／レア個体は目印を付ける）
            ctx.font = "bold 10px sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.textBaseline = "bottom";
            const badge = monster.isFieldBoss ? "⚠️BOSS " : (monster.isEliteField ? "✨レア " : "");
            const label = `${badge}${monster.name} Lv.${monster.level}`;
            const labelW = ctx.measureText(label).width;
            ctx.fillStyle = monster.isFieldBoss ? "rgba(120,20,20,0.85)" : (monster.isEliteField ? "rgba(110,80,10,0.85)" : "rgba(15,17,21,0.7)");
            roundRect(x - labelW / 2 - 4, y - monster.size/2 - 18, labelW + 8, 14, 4);
            ctx.fill();
            ctx.fillStyle = (monster.isFieldBoss || monster.isEliteField) ? "#ffe08a" : "#ff6b6b";
            ctx.fillText(label, x, y - monster.size/2 - 6);
        }
    }

    function drawPartyIndicators(cam) {
        if (typeof getPartyMembersInCurrentWorld !== 'function') return;
        
        const partyMembers = getPartyMembersInCurrentWorld(currentRegionId);
        const player = getMyPlayer();
        
        for (const member of partyMembers) {
            // 自分は表示しない
            if (player && member.playerId === player.id) continue;
            
            const x = member.x - cam.x;
            const y = member.y - cam.y;
            
            // 画面外の場合は描画しない
            if (x < 0 || x > viewportW || y < 0 || y > viewportH) continue;
            
            // パーティーメンバーインジケーター
            ctx.fillStyle = "#2196F3";
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // パーティーアイコン
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("👥", x, y);
        }
    }

    function updatePartyMemberIndicators() {
        // パーティーメンバーの位置情報を更新
        if (typeof getPartyMemberPositions === 'function') {
            const positions = getPartyMemberPositions();
            for (const [playerId, pos] of Object.entries(positions)) {
                if (pos.worldId === currentRegionId) {
                    partyIndicators[playerId] = pos;
                } else {
                    delete partyIndicators[playerId];
                }
            }
        }
    }

    function checkEncounter() {
        if (typeof checkMonsterEncounter === 'function') {
            const encounteredMonster = checkMonsterEncounter(local.x, local.y, fieldMonsters);
            if (encounteredMonster) {
                startMonsterBattle(encounteredMonster);
            }
        }
    }

    function startMonsterBattle(monster) {
        // モンスターとの戦闘を開始（衝突したら即戦闘、確認ダイアログは出さない）
        if (typeof convertMonsterToBattlePlayer === 'function') {
            const battleMonster = convertMonsterToBattlePlayer(monster);

            // 既存の戦闘システムへ遷移（location.hrefで即座にページ移動するため、
            // クエスト進行に必要な情報は遷移前にlocalStorageへ保存しておく。
            // 結果はbattle.html→result.jsのresolveFieldMonsterQuestProgress()で判定する）
            localStorage.setItem("pendingQuestMonster", JSON.stringify({
                monsterId: monster.id,
                region: currentRegionId
            }));

            startBattleWithMonster(battleMonster);
        }
    }

    function startBattleWithMonster(battleMonster) {
        const player = getMyPlayer();
        if (!player) {
            alert('キャラクターデータが見つかりません');
            return;
        }
        
        // プレイヤーデータのコピーを作成（バトル用に準備）
        const battlePlayer = {
            ...player,
            hp: player.maxHp || player.hp || 100,
            maxHp: player.maxHp || player.hp || 100
        };
        
        // 既存の戦闘システムに必要なデータをlocalStorageに保存
        localStorage.setItem("isBotBattle", "true");
        localStorage.setItem("isBossBattle", "false");
        localStorage.setItem("roomId", "monster_battle_" + Date.now());
        localStorage.setItem("battlePlayer", JSON.stringify(battlePlayer));
        localStorage.setItem("enemy", JSON.stringify(battleMonster));
        localStorage.removeItem("rewardsApplied");
        
        // 戦闘画面へ遷移（フィールドのモンスター／ボスはアクションバトルで戦う）
        location.href = "action-battle.html";
    }

    // グローバル関数として公開
    window.setDungeonWorld = setDungeonWorld;
    window.resetToWorldDefaults = resetToWorldDefaults;

    document.addEventListener("DOMContentLoaded", init);
})();
