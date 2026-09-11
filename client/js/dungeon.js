// ============================================
// Dungeon Frontend Handler
// dungeon.js
// ============================================
//
// 依頼により全面リニューアル：
// ・難易度選択と初回クリア報酬を廃止
// ・1階は弱く、階層を下るごとにどんどん強くなる「無限に続くダンジョン」に変更
// ・10階ごとにチェックポイントとして記録し、次回そこから再開できる
// ・モンスター／ボスは完全ランダム出現（強力なボスは低確率）
// ・敵を倒すと、階クリアのたびに一定確率で「宝箱」（オーブ／ステータス再分配チケット／
//   武器オーブスロット追加チケット）が手に入る
// ・モンスターは「ボットマッチ」で戦えるモンスター（BOT_MONSTERS、online.js）も
//   混ざって出現し、倒すとそのモンスター本来の素材がドロップする
// ・低確率で、通常のボス戦で戦える強力なボス（ダークロード／インフェルノドラゴン／
//   古の神／至高の存在の技構成を流用）も出現する
//
// 実際のモンスター・ボスの抽選とステータス計算はこのファイル（クライアント側）で行う。
// サーバー側（DungeonEngine.js）は階層の進行状況・報酬・宝箱抽選のみを管理する
// （既存のボット戦・ダンジョン戦がもともとクライアント主導で戦闘処理される
// 仕組みになっているため、これに合わせている）。

let currentDungeon = null;
let currentDungeonBattle = null;

// ===================================
// ソケット取得ヘルパー
// ===================================
// dungeon.jsはindex.html内でscript.jsより先に読み込まれているため、
// DOMContentLoaded時点ではまだwindow.socketが生成されておらず(script.js側の
// initializeSocket()がまだ実行されていない)、その場でdungeonSocket変数に
// キャッシュしてしまうと常にnullのままになり「接続エラーです」の誤警告が
// 出続けていた。呼び出しの都度window.socketを直接参照することで、
// スクリプトの読み込み順に依存しないようにする。
function getDungeonSocket() {
    return (typeof window !== "undefined" && window.socket) ? window.socket : null;
}

// ===================================
// 無限ダンジョン：階層スケーリング
// ===================================
// 1階はプレイヤー自身の実ステータス（武器・パッシブ・転生ボーナス込み）よりは弱めだが、
// 明確に脅威になる程度（70%程度）からスタートし、階層が深くなるほどこの倍率が
// どんどん上がっていく。上限を設けないため、理論上どこまでも潜れば潜るほど
// 敵が強くなり続ける。
// （注意：この値を極端に下げると、不正解時のダメージやhp_regen等の継続効果の回復量が
// 何もかも1〜2程度の誤差レベルになってしまい、「ペナルティが無い」「効果が機能していない」
// ように見えてしまうため、下限は0.6〜0.7程度を維持すること）
// 1階でもプレイヤー自身の実ステータス（武器・パッシブ・転生ボーナス込み）と
// ほぼ同等（95%程度）の強さからスタートし、階層が深くなるほどこの倍率が
// どんどん上がっていく。上限を設けないため、理論上どこまでも潜れば潜るほど
// 敵が強くなり続ける。
// （前回0.7スタートに調整したが「まだ最初の方が簡単すぎる」との報告を受けて
// さらに底上げ。1階から気を抜けない強さにする）
function getDungeonFloorFactor(floor) {
    const f = Math.max(1, floor);
    return 0.95 + (f - 1) * 0.12;
}

// ボスは同じ階の通常モンスターよりもずっと強い（依頼：「ボスはとても強いです」）
const DUNGEON_BOSS_STAT_MULTIPLIER = 2.4;

// 通常モンスターの中からボスが出現する確率（依頼：「低確率だけど、ボスバトルのボスも
// たまに出てくるようにして」）
const DUNGEON_BOSS_ENCOUNTER_CHANCE = 0.05;
// ボットマッチのモンスターが出現する確率（それ以外はダンジョン専用モンスター）
const DUNGEON_BOT_MONSTER_CHANCE = 0.5;

// ダンジョン専用モンスターの一覧（既存のダンジョン1〜9階に登場していたモンスター名を流用）。
// ボットマッチのモンスターと違い、倒しても素材はドロップしない（宝箱報酬のみ）。
const DUNGEON_FLAVOR_MONSTERS = [
    { id: 'slime', name: 'スライム', emoji: '🟢', statMultiplier: 0.55 },
    { id: 'rat', name: 'ネズミ', emoji: '🐀', statMultiplier: 0.6 },
    { id: 'goblin', name: 'ゴブリン', emoji: '👺', statMultiplier: 0.7 },
    { id: 'spider', name: 'クモ', emoji: '🕷️', statMultiplier: 0.75 },
    { id: 'bat', name: 'バット', emoji: '🦇', statMultiplier: 0.7 },
    { id: 'orc', name: 'オーク', emoji: '👹', statMultiplier: 0.9 },
    { id: 'wolf', name: 'ウルフ', emoji: '🐺', statMultiplier: 0.85 },
    { id: 'skeleton', name: 'スケルトン', emoji: '💀', statMultiplier: 0.85 },
    { id: 'goblin_shaman', name: 'ゴブリン・シャーマン', emoji: '🧙', statMultiplier: 0.95 },
    { id: 'ghoul', name: 'グール', emoji: '🧟', statMultiplier: 1.0 },
    { id: 'lizard', name: 'リザード', emoji: '🦎', statMultiplier: 0.95 },
    { id: 'harpy', name: 'ハーピー', emoji: '🦅', statMultiplier: 1.05 },
    { id: 'stone_golem', name: 'ストーン・ゴーレム', emoji: '🗿', statMultiplier: 1.2 },
    { id: 'wyvern', name: 'ワイバーン', emoji: '🐉', statMultiplier: 1.25 },
    { id: 'dark_knight', name: 'ダークナイト', emoji: '⚔️', statMultiplier: 1.2 },
    { id: 'necromancer', name: 'ネクロマンサー', emoji: '☠️', statMultiplier: 1.2 },
    { id: 'shadow_mage', name: 'シャドー・メイジ', emoji: '🌑', statMultiplier: 1.15 },
    { id: 'demon', name: 'デーモン', emoji: '😈', statMultiplier: 1.3 },
    { id: 'chimera', name: 'キメラ', emoji: '🐐', statMultiplier: 1.3 },
    { id: 'basilisk', name: 'バジリスク', emoji: '🐍', statMultiplier: 1.25 },
    { id: 'hydra', name: 'ヒドラ', emoji: '🐲', statMultiplier: 1.4 },
    { id: 'arch_mage', name: 'アーチメイジ', emoji: '🧙‍♂️', statMultiplier: 1.35 },
    { id: 'titan', name: 'タイタン', emoji: '🗿', statMultiplier: 1.5 },
    { id: 'seraph', name: 'セラフ', emoji: '👼', statMultiplier: 1.45 },
    { id: 'phoenix', name: 'フェニックス', emoji: '🔥', statMultiplier: 1.5 }
];

// 低確率で出現する強力なボスの一覧。技構成は既存のダンジョンボス（monsters-data.js）から流用。
const DUNGEON_STRONG_BOSSES = [
    {
        id: 'boss_dark_lord', name: 'ダークロード',
        skills: [
            { name: 'ダークネスブラスト', effect: { damageMultiplier: 2.0, ignoreDef: true } },
            { name: '絶望の波動', effect: { debuff: { type: 'atk_def', reduction: 0.3, turns: 3 } } },
            { name: 'ライフスティール', effect: { lifeSteal: 0.35 } },
            { name: '完全防壁', effect: { damageReduction: 0.5, turns: 1 } }
        ]
    },
    {
        id: 'boss_infernal_dragon', name: 'インフェルノドラゴン',
        skills: [
            { name: 'インフェルノブレス', effect: { damageMultiplier: 2.4, burn: { turns: 4 } } },
            { name: '龍の咆哮', effect: { damageMultiplier: 1.8, debuff: { type: 'speed', reduction: 0.35, turns: 2 } } },
            { name: 'フレイムシールド', effect: { damageReduction: 0.5, turns: 2 } },
            { name: 'レジリエンス', effect: { heal: 0.3 } },
            { name: '絶対のカタストロフ', effect: { damageMultiplier: 2.2, ignoreDef: true, sureHit: true } }
        ]
    },
    {
        id: 'boss_ancient_god', name: '古の神',
        skills: [
            { name: '絶対のカタストロフ', effect: { damageMultiplier: 3.0, ignoreDef: true, sureHit: true } },
            { name: '神聖なる制裁', effect: { damageMultiplier: 2.2, debuff: { type: 'def', reduction: 60, isFlat: true, turns: 2 } } },
            { name: '全能の盾', effect: { damageReduction: 0.7, turns: 1 } },
            { name: 'リジェネレーション', effect: { heal: 0.35, selfBuff: { type: 'def', amount: 1.3, turns: 2 } } },
            { name: '神聖試練', effect: { debuff: { type: 'atk', reduction: 0.4, turns: 2 }, damageMultiplier: 1.6 } },
            { name: 'コスミック・スラッシュ', effect: { damageMultiplier: 2.6, poison: { turns: 4 }, burn: { turns: 4 } } }
        ]
    },
    {
        id: 'boss_supreme_entity', name: '至高の存在',
        skills: [
            { name: 'エクシステンシャルシュレッド', effect: { damageMultiplier: 5.5, ignoreDef: true, sureHit: true, multiHit: 2 } },
            { name: '絶望のヴェール', effect: { debuff: { type: 'atk_def_speed', reduction: 0.5, turns: 3 }, damageMultiplier: 2.0 } },
            { name: '完全防壁', effect: { damageReduction: 0.9, turns: 2 } },
            { name: 'アビサル・ヒーリング', effect: { heal: 0.45, selfBuff: { type: 'def', amount: 1.4, turns: 2 } } },
            { name: 'コスミック・スラッシュ', effect: { damageMultiplier: 2.8, poison: { turns: 5 }, burn: { turns: 5 } } },
            { name: '超越的な力', effect: { selfBuff: { type: 'all_stats', amount: 1.6, turns: 3 }, damageMultiplier: 2.2 } }
        ]
    }
];

/**
 * 現在の階層で戦う敵を1体、完全ランダムに生成する。
 * @param {number} floor - 現在の階層
 * @param {object} battleStats - プレイヤーの実ステータス（getMatchPlayer().battleStats）
 * @returns {object} battle.htmlにそのまま渡せる敵オブジェクト
 */
function generateDungeonEncounter(floor, battleStats) {
    const stats = battleStats || { maxHp: 100, atk: 20, def: 10, speed: 20 };
    const floorFactor = getDungeonFloorFactor(floor);

    // 低確率で強力なボスが出現する
    if (Math.random() < DUNGEON_BOSS_ENCOUNTER_CHANCE) {
        const boss = DUNGEON_STRONG_BOSSES[Math.floor(Math.random() * DUNGEON_STRONG_BOSSES.length)];
        const mult = floorFactor * DUNGEON_BOSS_STAT_MULTIPLIER;
        const maxHp = Math.max(1, Math.round(stats.maxHp * mult));
        return {
            id: 'dungeon_' + boss.id + '_' + Date.now(),
            name: boss.name,
            maxHp, hp: maxHp,
            atk: Math.max(1, Math.round(stats.atk * mult)),
            def: Math.max(1, Math.round(stats.def * mult)),
            speed: Math.max(1, Math.round(stats.speed * mult)),
            level: floor,
            isBoss: true,
            skills: boss.skills,
            monsterType: 'ボス',
            monsterEmoji: '👑'
        };
    }

    // ボットマッチのモンスター（素材ドロップあり）か、ダンジョン専用モンスター（宝箱のみ）か
    const useBotMonster = (typeof BOT_MONSTERS !== 'undefined' && BOT_MONSTERS.length > 0)
        && Math.random() < DUNGEON_BOT_MONSTER_CHANCE;

    if (useBotMonster) {
        const monster = BOT_MONSTERS[Math.floor(Math.random() * BOT_MONSTERS.length)];
        const mult = floorFactor * (monster.statMultiplier != null ? monster.statMultiplier : 1.0);
        const maxHp = Math.max(1, Math.round(stats.maxHp * mult));
        return {
            id: 'dungeon_bot_' + monster.id + '_' + Date.now(),
            name: monster.name,
            maxHp, hp: maxHp,
            atk: Math.max(1, Math.round(stats.atk * mult)),
            def: Math.max(1, Math.round(stats.def * mult)),
            speed: Math.max(1, Math.round(stats.speed * mult)),
            level: floor,
            isBot: true,
            isBoss: false,
            monsterType: monster.monsterType,
            monsterEmoji: monster.monsterEmoji,
            materialDrops: monster.materialDrops
        };
    }

    const flavor = DUNGEON_FLAVOR_MONSTERS[Math.floor(Math.random() * DUNGEON_FLAVOR_MONSTERS.length)];
    const mult = floorFactor * flavor.statMultiplier;
    const maxHp = Math.max(1, Math.round(stats.maxHp * mult));
    return {
        id: 'dungeon_flavor_' + flavor.id + '_' + Date.now(),
        name: flavor.name,
        maxHp, hp: maxHp,
        atk: Math.max(1, Math.round(stats.atk * mult)),
        def: Math.max(1, Math.round(stats.def * mult)),
        speed: Math.max(1, Math.round(stats.speed * mult)),
        level: floor,
        isBoss: false,
        monsterType: flavor.name,
        monsterEmoji: flavor.emoji
    };
}

// ===================================
// チェックポイント関連ヘルパー
// ===================================
function getDungeonCheckpoint(player) {
    return (player && player.dungeonCheckpoint) ? Math.max(0, Math.floor(player.dungeonCheckpoint)) : 0;
}

// ===================================
// ダンジョン選択画面の初期化
// ===================================
function initializeDungeonUI() {
    const dungeonSection = document.getElementById('section-dungeon');
    if (!dungeonSection) return;

    renderDungeonStartPanel();

    // ダンジョン放棄ボタン（もしHTML上に残っていれば流用）
    const abandonBtn = document.getElementById('abandonDungeonBtn');
    if (abandonBtn) {
        abandonBtn.addEventListener('click', abandonDungeon);
    }
}

// ===================================
// ダンジョン開始パネルの描画（難易度選択を廃止し、開始階層のみ選べるようにする）
// ===================================
function renderDungeonStartPanel() {
    const infoContainer = document.getElementById('dungeonInfoContainer');
    if (!infoContainer) return;

    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    const checkpoint = getDungeonCheckpoint(player);

    const html = `
        <div class="dungeon-info-panel">
            <h3>無限ダンジョン</h3>
            <div class="dungeon-info-details">
                <p><strong>階層:</strong> 無限（潜れば潜るほど敵がどんどん強くなります）</p>
                <p><strong>モンスター・ボスの出現:</strong> 完全ランダム。低確率でとても強いボスも出現します。</p>
                <p><strong>宝箱:</strong> 階をクリアするたびに、一定確率でオーブ・ステータス再分配チケット・
                武器オーブスロット追加チケットのいずれかが手に入ります。</p>
                <p><strong>素材:</strong> モンスターの中にはボットマッチでもおなじみの敵が混ざって出現し、
                倒すとそのモンスター本来の素材がドロップします。</p>
                <p class="dungeon-floor-reward-note">各階を突破するたびにコイン・経験値がもらえます。階を突破した後は「次の階へ」進むか、その時点までの報酬を持って「撤退する」かを選べます。ただし敗北するとそのダンジョンで得た報酬は全て失われ、さらに所持金の半分を失うので注意してください。</p>
                <p><strong>チェックポイント:</strong> 10階ごとに記録され、次回そこから再開できます。${checkpoint > 0 ? `（現在の最深チェックポイント: 第${checkpoint}階）` : '（まだチェックポイントはありません）'}</p>
            </div>
            <div class="dungeon-start-buttons">
                <button id="startDungeonFromBeginningBtn" class="btn btn-primary">1階から挑戦</button>
                ${checkpoint > 0 ? `<button id="startDungeonFromCheckpointBtn" class="btn btn-secondary">第${checkpoint}階から挑戦（チェックポイント）</button>` : ''}
            </div>
        </div>
    `;

    infoContainer.innerHTML = html;

    const fromStartBtn = document.getElementById('startDungeonFromBeginningBtn');
    if (fromStartBtn) {
        fromStartBtn.addEventListener('click', () => startDungeon(1));
    }
    const fromCheckpointBtn = document.getElementById('startDungeonFromCheckpointBtn');
    if (fromCheckpointBtn) {
        fromCheckpointBtn.addEventListener('click', () => startDungeon(checkpoint));
    }
}

// ===================================
// ダンジョン開始
// ===================================
function startDungeon(startFloor) {
    const dungeonSocket = getDungeonSocket();
    if (!dungeonSocket) {
        console.error('Socket not connected');
        alert('接続エラーです。ページをリロードしてください。');
        return;
    }

    const safeStartFloor = Math.max(1, Math.floor(startFloor) || 1);
    console.log(`[Dungeon] Starting dungeon from floor: ${safeStartFloor}`);

    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;

    dungeonSocket.emit('dungeon:start', { startFloor: safeStartFloor, playerId: player ? player.id : null }, (response) => {
        if (response.error) {
            alert(`エラー: ${response.error}`);
            return;
        }

        currentDungeon = response.dungeon;
        currentDungeonBattle = {
            players: {}
        };

        // ダンジョン画面へ遷移
        switchToDungeonBattle(response);
    });
}

// ===================================
// ダンジョンバトル画面へ切り替え
// ===================================
function switchToDungeonBattle(dungeonData) {
    // ダンジョンの情報を保存
    localStorage.setItem('dungeonData', JSON.stringify(dungeonData));
    localStorage.setItem('isDungeonBattle', 'true');

    // プレイヤーデータを設定
    // 通常のボス戦・オンライン対戦で使われているgetMatchPlayer()
    // （script.js。getBattleStats()で武器補正・パッシブ・転生ボーナスを反映した
    // 実効ステータスをHPも含めて計算し、フルHPで開始する）と同じ処理に統一する。
    const player = (typeof getMatchPlayer === 'function')
        ? getMatchPlayer()
        : (typeof getPlayerData === 'function' ? getPlayerData() : null);
    if (player) {
        localStorage.setItem('battlePlayer', JSON.stringify(player));
    }

    // 敵は階層番号とプレイヤーの実ステータスから完全ランダムに生成する
    const floor = dungeonData.dungeon ? dungeonData.dungeon.currentFloor : 1;
    const battleStats = player ? (player.battleStats || player) : null;
    const enemy = generateDungeonEncounter(floor, battleStats);
    localStorage.setItem('enemy', JSON.stringify(enemy));

    // ボットバトルモードを設定
    localStorage.setItem('isBotBattle', 'true');

    // 出現した敵がボスかどうかでisBossBattleフラグを設定する
    // （未設定のままだとボス専用の問題・スキル演出が有効にならないため）
    if (enemy.isBoss) {
        localStorage.setItem('isBossBattle', 'true');
    } else {
        localStorage.removeItem('isBossBattle');
    }

    // battle.htmlに遷移
    window.location.href = 'battle.html';
}

// ===================================
// ダンジョン放棄
// ===================================
function abandonDungeon() {
    if (!confirm('本当にダンジョンを放棄しますか？獲得した報酬は失われます。')) {
        return;
    }

    const dungeonSocket = getDungeonSocket();
    if (!dungeonSocket) {
        console.error('Socket not connected');
        return;
    }

    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    dungeonSocket.emit('dungeon:abandon', { playerId: player ? player.id : null }, (response) => {
        if (response.error) {
            alert(`エラー: ${response.error}`);
            return;
        }

        returnToDungeonMenu();
    });
}

// ===================================
// メニューに戻る
// ===================================
function returnToDungeonMenu() {
    const dungeonContainer = document.getElementById('dungeonBattleContainer');
    if (dungeonContainer) {
        dungeonContainer.remove();
    }

    // ダンジョンセクションを表示
    const dungeonSection = document.getElementById('section-dungeon');
    if (dungeonSection) {
        dungeonSection.style.display = 'block';
    }

    // 開始パネルを最新のチェックポイント状態で再描画する
    renderDungeonStartPanel();

    currentDungeon = null;
    currentDungeonBattle = null;
}

// ===================================
// ページ読み込み時の初期化
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    // socket自体はscript.js側のinitializeSocket()で生成される。
    // dungeon.jsはscript.jsより先に読み込まれるためこの時点ではまだ存在しないことがあるが、
    // 各操作関数はgetDungeonSocket()でその都度window.socketを見に行くので、
    // ここで変数にキャッシュする必要はない。
    initializeDungeonUI();
});

// ===================================
// エクスポート（必要な場合）
// ===================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        startDungeon,
        abandonDungeon,
        returnToDungeonMenu,
        generateDungeonEncounter,
        getDungeonFloorFactor
    };
}
