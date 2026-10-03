// client/js/summons.js
//
// 「サモンズロッド」武器種の専用機能：素材を1つ消費して、その素材を落とすモンスターを
// 配下（召喚モンスター）にできる。配下は最大3体まで持て、戦闘中は正解するたびに
// それぞれが追加攻撃を行う（実際の攻撃処理はbattle.js側で行う。ここでは、召喚モンスター
// の管理UI＝index.html「装備スキル」タブの武器種選択のところに表示する）。
//
// 召喚モンスターは、召喚時点の武器（メイン武器種 or サブ武器種＝デュアルウェポン）に
// 紐付けて weapon.summonedMonsters に保存する。倍率もこの時点で確定させて保存するので、
// battle.js側（online.jsが読み込まれていないbattle.html）はBOT_MONSTERSを一切参照せず、
// 保存済みの値をそのまま使うだけで済む。

const SUMMON_MAX_MONSTERS = 3;

// サブ武器種（デュアルウェポン）としてサモンズロッドを使う場合、追加攻撃の倍率を
// メインの場合よりも弱くする（武器種の恩恵をサブでは弱めるのと同じ考え方）。
const SUMMON_SUB_TYPE_MULTIPLIER_RATIO = 0.5;

// ============================================================
// 召喚モンスターのステータスシステム
// 以前は「プレイヤーの攻撃力の何%」という単純な倍率だったが、依頼により
// 「モンスターごとに固定の合計ステータスがあり、プレイヤーのステータスに応じて
// それが伸びていく」方式に変更。例：スライムは合計ステータス250、
// 原初の巨人のような最強クラスのモンスターは合計ステータス25000、というように、
// モンスターの強さ（BOT_MONSTERSのstatMultiplier）に応じて基礎値が決まり、
// そこからプレイヤー自身の合計ステータスの伸びに比例して成長する。
// ============================================================

// 召喚モンスターの基礎合計ステータスの範囲（最弱モンスター〜最強モンスター）
const SUMMON_BASE_TOTAL_STAT_MIN = 250;
const SUMMON_BASE_TOTAL_STAT_MAX = 25000;

// 「プレイヤーの合計ステータスがこの値の時、召喚モンスターは基礎値そのまま」という基準値。
// 新規キャラクター相当の合計ステータス（最弱モンスターの基礎値と同じ250）を基準にすることで、
// プレイヤーが成長するほど配下モンスターも一緒に強くなっていく。
const SUMMON_PLAYER_BASELINE_TOTAL_STAT = 250;

// 合計ステータスのうち、実際の追加攻撃力（atk相当）として使う割合
const SUMMON_ATTACK_STAT_SHARE = 0.35;

/**
 * BOT_MONSTERSに含まれるstatMultiplierの最小値・最大値を求める。
 * @returns {{min: number, max: number}}
 */
function getMonsterStatMultiplierRange() {
    if (typeof BOT_MONSTERS === 'undefined' || !BOT_MONSTERS.length) {
        return { min: 0.3, max: 2.2 };
    }
    let min = Infinity;
    let max = -Infinity;
    BOT_MONSTERS.forEach(m => {
        const v = m.statMultiplier != null ? m.statMultiplier : 1.0;
        if (v < min) min = v;
        if (v > max) max = v;
    });
    if (!isFinite(min) || !isFinite(max) || min === max) {
        return { min: 0.3, max: 2.2 };
    }
    return { min, max };
}

/**
 * 指定した素材IDをドロップするモンスターを1体探す（複数該当する場合は最初の1体）。
 * @param {string} materialId
 * @returns {object|null} BOT_MONSTERSの要素、またはnull
 */
function findMonsterForMaterial(materialId) {
    if (typeof BOT_MONSTERS === 'undefined') return null;
    return BOT_MONSTERS.find(m =>
        Array.isArray(m.materialDrops) && m.materialDrops.some(d => d.materialId === materialId)
    ) || null;
}

/**
 * モンスターのstatMultiplierから、召喚モンスターの「基礎合計ステータス」を求める。
 * 250〜25000という100倍の開きがあるため、線形補間ではなく対数（指数）補間を使う
 * （線形だと大半のモンスターが最低値付近に固まってしまうため）。
 * この関数はBOT_MONSTERSを必要とするため、online.jsが読み込まれているindex.html側
 * （召喚時・プレビュー表示時）でのみ呼び出す。
 * @param {object} monster - BOT_MONSTERSの要素
 * @returns {number}
 */
function getMonsterSummonBaseTotalStat(monster) {
    const { min, max } = getMonsterStatMultiplierRange();
    const statMult = (monster && monster.statMultiplier != null) ? monster.statMultiplier : 1.0;
    const ratio = Math.max(0, Math.min(1, (statMult - min) / (max - min)));
    const logMin = Math.log(SUMMON_BASE_TOTAL_STAT_MIN);
    const logMax = Math.log(SUMMON_BASE_TOTAL_STAT_MAX);
    const logValue = logMin + ratio * (logMax - logMin);
    return Math.round(Math.exp(logValue));
}

/**
 * ステータス一式（maxHp/atk/def/speed/special相当のオブジェクト）から
 * 召喚モンスターの成長計算に使う「プレイヤーの合計ステータス」を求める。
 * @param {object} statsLike
 * @returns {number}
 */
function getPlayerTotalStatForSummon(statsLike) {
    if (!statsLike) return SUMMON_PLAYER_BASELINE_TOTAL_STAT;
    return Math.max(1, (statsLike.maxHp || 0) + (statsLike.atk || 0) + (statsLike.def || 0) + (statsLike.speed || 0) + (statsLike.special || 0));
}

/**
 * 召喚モンスターの「現在の合計ステータス」を求める（基礎値 × プレイヤーの成長倍率）。
 * @param {number} baseTotalStat - 召喚時に固定保存された基礎合計ステータス
 * @param {number} playerTotalStat - 現在のプレイヤーの合計ステータス
 * @returns {number}
 */
function getSummonCurrentTotalStat(baseTotalStat, playerTotalStat) {
    const growthFactor = Math.max(1, (playerTotalStat || SUMMON_PLAYER_BASELINE_TOTAL_STAT) / SUMMON_PLAYER_BASELINE_TOTAL_STAT);
    return (baseTotalStat || 0) * growthFactor;
}

/**
 * 召喚モンスターの「現在の追加攻撃力」を求める。battle.js側（実際のダメージ計算）と
 * index.html側（UIプレビュー）の両方から呼ばれる共通ロジック。
 * @param {object} summon - weapon.summonedMonstersの要素（baseTotalStat・isSubTypeを含む）
 * @param {number} playerTotalStat - 現在のプレイヤーの合計ステータス
 * @returns {number}
 */
function getSummonCurrentAtk(summon, playerTotalStat) {
    if (!summon) return 0;
    const currentTotal = getSummonCurrentTotalStat(summon.baseTotalStat, playerTotalStat);
    let atk = currentTotal * SUMMON_ATTACK_STAT_SHARE;
    if (summon.isSubType) atk *= SUMMON_SUB_TYPE_MULTIPLIER_RATIO;
    return Math.max(1, Math.floor(atk));
}

/**
 * 現在装備中の武器が「サモンズロッド」を(メイン or サブ武器種として)使っているかを調べる。
 * @param {object} player
 * @returns {{weapon: object, isSummonsRod: boolean, isSubType: boolean}}
 */
function getEquippedSummonsRodInfo(player) {
    const weapon = player && player.equippedWeapon;
    if (!weapon) return { weapon: null, isSummonsRod: false, isSubType: false };

    const hasDualWeapon = weapon.uniqueAbilities && weapon.uniqueAbilities.some(a => a.effect === 'dual_weapon');

    if (weapon.type === 'summons_rod') {
        return { weapon, isSummonsRod: true, isSubType: false };
    }
    if (hasDualWeapon && weapon.secondaryType === 'summons_rod') {
        return { weapon, isSummonsRod: true, isSubType: true };
    }
    return { weapon, isSummonsRod: false, isSubType: false };
}

/**
 * 「装備スキル」タブの武器種選択のところに表示する、モンスター召喚UIを更新する。
 * サモンズロッドを（メイン・サブ問わず）使っていない場合は非表示にする。
 */
function renderSummonMonsterUI(player) {
    const box = document.getElementById('summonMonsterBox');
    if (!box) return;

    const { weapon, isSummonsRod, isSubType } = getEquippedSummonsRodInfo(player);

    if (!isSummonsRod) {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'block';

    const noteEl = document.getElementById('summonMonsterSubNote');
    if (noteEl) {
        noteEl.style.display = isSubType ? 'block' : 'none';
    }

    // 現在の配下モンスター一覧
    const listEl = document.getElementById('summonedMonsterList');
    if (listEl) {
        const summoned = weapon.summonedMonsters || [];
        const playerTotalStat = getPlayerTotalStatForSummon(typeof getStatsFromPlayer === 'function' ? getStatsFromPlayer(player) : player);
        if (summoned.length === 0) {
            listEl.innerHTML = '<p>配下のモンスターはいません。</p>';
        } else {
            listEl.innerHTML = summoned.map((s, index) => {
                const currentAtk = getSummonCurrentAtk(s, playerTotalStat);
                return `
                <div class="summoned-monster-item">
                    <span>${s.monsterEmoji || ''} ${s.monsterName}（現在の追加攻撃力: ${currentAtk}）</span>
                    <button type="button" class="btn btn-small btn-danger-outline" data-summon-index="${index}">解放する</button>
                </div>
            `;
            }).join('');
            listEl.querySelectorAll('[data-summon-index]').forEach(btn => {
                btn.onclick = () => removeSummonedMonster(parseInt(btn.dataset.summonIndex, 10));
            });
        }
    }

    // 召喚可能な素材の選択肢
    const select = document.getElementById('summonMaterialSelect');
    const summonBtn = document.getElementById('summonMonsterBtn');
    if (select) {
        const materials = player.materials || {};
        const summonableEntries = Object.keys(materials)
            .filter(matId => materials[matId] > 0)
            .map(matId => ({ matId, monster: findMonsterForMaterial(matId) }))
            .filter(entry => entry.monster);

        const currentCount = (weapon.summonedMonsters || []).length;
        const atMax = currentCount >= SUMMON_MAX_MONSTERS;
        const playerTotalStatForPreview = getPlayerTotalStatForSummon(typeof getStatsFromPlayer === 'function' ? getStatsFromPlayer(player) : player);

        if (atMax) {
            select.innerHTML = `<option value="">配下は既に${SUMMON_MAX_MONSTERS}体（上限）です</option>`;
            select.disabled = true;
        } else if (summonableEntries.length === 0) {
            select.innerHTML = '<option value="">召喚に使える素材がありません</option>';
            select.disabled = true;
        } else {
            select.disabled = false;
            select.innerHTML = summonableEntries.map(entry => {
                const baseTotalStat = getMonsterSummonBaseTotalStat(entry.monster);
                const previewAtk = getSummonCurrentAtk({ baseTotalStat, isSubType }, playerTotalStatForPreview);
                const matName = (typeof MATERIAL_DATA !== 'undefined' && MATERIAL_DATA[entry.matId])
                    ? MATERIAL_DATA[entry.matId].name
                    : entry.matId;
                return `<option value="${entry.matId}">${matName}（${entry.monster.monsterEmoji || ''}${entry.monster.name} / 合計ステータス${baseTotalStat}・現在の追加攻撃力${previewAtk}・所持${materials[entry.matId]}個）</option>`;
            }).join('');
        }

        if (summonBtn) summonBtn.disabled = atMax || summonableEntries.length === 0;
    }
}

/**
 * 選択中の素材を1つ消費して、その素材を落とすモンスターを配下にする。
 */
function summonMonsterFromMaterial() {
    const player = getPlayerData();
    if (!player) return;

    const { weapon, isSummonsRod, isSubType } = getEquippedSummonsRodInfo(player);
    if (!isSummonsRod || !weapon) {
        alert('サモンズロッドを武器種、またはサブ武器種として装備してください。');
        return;
    }

    const select = document.getElementById('summonMaterialSelect');
    const materialId = select ? select.value : null;
    if (!materialId) {
        alert('召喚に使う素材を選択してください。');
        return;
    }

    const materials = player.materials || {};
    if (!materials[materialId] || materials[materialId] < 1) {
        alert('その素材を持っていません。');
        return;
    }

    const monster = findMonsterForMaterial(materialId);
    if (!monster) {
        alert('この素材を落とすモンスターが見つかりませんでした。');
        return;
    }

    const currentWeaponIndex = (player.weapons || []).findIndex(w => w.id === weapon.id);
    if (currentWeaponIndex === -1) {
        alert('武器が見つかりません。');
        return;
    }

    const currentSummons = weapon.summonedMonsters || [];
    if (currentSummons.length >= SUMMON_MAX_MONSTERS) {
        alert(`配下は最大${SUMMON_MAX_MONSTERS}体までです。`);
        return;
    }

    // 召喚モンスターの「基礎合計ステータス」を固定保存する。実際の追加攻撃力は
    // これとプレイヤーの現在の合計ステータスから戦闘のたびに動的に計算される
    // （プレイヤーが成長するほど、配下モンスターも一緒に強くなっていく）。
    const baseTotalStat = getMonsterSummonBaseTotalStat(monster);
    const newSummon = {
        materialId,
        monsterId: monster.id,
        monsterName: monster.name,
        monsterEmoji: monster.monsterEmoji,
        baseTotalStat,
        isSubType
    };

    const updatedWeapon = {
        ...weapon,
        summonedMonsters: [...currentSummons, newSummon]
    };

    const updatedMaterials = { ...materials };
    updatedMaterials[materialId]--;
    if (updatedMaterials[materialId] <= 0) delete updatedMaterials[materialId];

    const updatedWeapons = player.weapons.map(w => (w.id === weapon.id ? updatedWeapon : w));
    const updatedPlayer = {
        ...player,
        weapons: updatedWeapons,
        materials: updatedMaterials,
        equippedWeapon: (player.equippedWeapon && player.equippedWeapon.id === weapon.id) ? updatedWeapon : player.equippedWeapon
    };

    localStorage.setItem("player", JSON.stringify(updatedPlayer));
    const playerTotalStat = getPlayerTotalStatForSummon(typeof getStatsFromPlayer === 'function' ? getStatsFromPlayer(updatedPlayer) : updatedPlayer);
    const currentAtk = getSummonCurrentAtk(newSummon, playerTotalStat);
    alert(`${monster.monsterEmoji || ''}${monster.name}を配下にしました！（合計ステータス${baseTotalStat}・現在の追加攻撃力${currentAtk}）`);
    renderSummonMonsterUI(updatedPlayer);
    if (typeof updateStatus === 'function') updateStatus(updatedPlayer);
}

/**
 * 配下モンスターを1体解放する（素材の返却は無し）。
 */
function removeSummonedMonster(index) {
    const player = getPlayerData();
    if (!player) return;

    const { weapon, isSummonsRod } = getEquippedSummonsRodInfo(player);
    if (!isSummonsRod || !weapon) return;

    const currentSummons = weapon.summonedMonsters || [];
    if (index < 0 || index >= currentSummons.length) return;

    if (!confirm('この配下モンスターを解放しますか？（消費した素材は戻りません）')) return;

    const updatedWeapon = {
        ...weapon,
        summonedMonsters: currentSummons.filter((_, i) => i !== index)
    };
    const updatedWeapons = player.weapons.map(w => (w.id === weapon.id ? updatedWeapon : w));
    const updatedPlayer = {
        ...player,
        weapons: updatedWeapons,
        equippedWeapon: (player.equippedWeapon && player.equippedWeapon.id === weapon.id) ? updatedWeapon : player.equippedWeapon
    };

    localStorage.setItem("player", JSON.stringify(updatedPlayer));
    renderSummonMonsterUI(updatedPlayer);
}
