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

// 召喚モンスターの追加攻撃倍率の範囲。モンスターのstatMultiplier（BOT_MONSTERS）に応じて
// この範囲に線形マッピングする。
// 例: 最弱モンスター(statMultiplier最小)は自分の攻撃力の10%、最強モンスターは60%の追加攻撃。
const SUMMON_MULTIPLIER_MIN = 0.1;
const SUMMON_MULTIPLIER_MAX = 0.6;

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
 * モンスターのstatMultiplierから、召喚モンスターの追加攻撃倍率を計算する。
 * @param {object} monster - BOT_MONSTERSの要素
 * @param {boolean} isSubType - サモンズロッドがサブ武器種（デュアルウェポン）として使われているか
 * @returns {number} 自分の攻撃力に対する倍率
 */
function calculateSummonMultiplier(monster, isSubType) {
    const { min, max } = getMonsterStatMultiplierRange();
    const statMult = (monster && monster.statMultiplier != null) ? monster.statMultiplier : 1.0;
    const ratio = Math.max(0, Math.min(1, (statMult - min) / (max - min)));
    let mult = SUMMON_MULTIPLIER_MIN + ratio * (SUMMON_MULTIPLIER_MAX - SUMMON_MULTIPLIER_MIN);
    if (isSubType) {
        mult *= SUMMON_SUB_TYPE_MULTIPLIER_RATIO;
    }
    return Math.round(mult * 1000) / 1000;
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
        if (summoned.length === 0) {
            listEl.innerHTML = '<p>配下のモンスターはいません。</p>';
        } else {
            listEl.innerHTML = summoned.map((s, index) => `
                <div class="summoned-monster-item">
                    <span>${s.monsterEmoji || ''} ${s.monsterName}（追加攻撃: 自分の攻撃力の${(s.multiplier * 100).toFixed(1)}%）</span>
                    <button type="button" class="btn btn-small btn-danger-outline" data-summon-index="${index}">解放する</button>
                </div>
            `).join('');
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

        if (atMax) {
            select.innerHTML = `<option value="">配下は既に${SUMMON_MAX_MONSTERS}体（上限）です</option>`;
            select.disabled = true;
        } else if (summonableEntries.length === 0) {
            select.innerHTML = '<option value="">召喚に使える素材がありません</option>';
            select.disabled = true;
        } else {
            select.disabled = false;
            select.innerHTML = summonableEntries.map(entry => {
                const previewMult = calculateSummonMultiplier(entry.monster, isSubType);
                const matName = (typeof MATERIAL_DATA !== 'undefined' && MATERIAL_DATA[entry.matId])
                    ? MATERIAL_DATA[entry.matId].name
                    : entry.matId;
                return `<option value="${entry.matId}">${matName}（${entry.monster.monsterEmoji || ''}${entry.monster.name} / 追加攻撃${(previewMult * 100).toFixed(1)}%・所持${materials[entry.matId]}個）</option>`;
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

    const multiplier = calculateSummonMultiplier(monster, isSubType);
    const newSummon = {
        materialId,
        monsterId: monster.id,
        monsterName: monster.name,
        monsterEmoji: monster.monsterEmoji,
        multiplier
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
    alert(`${monster.monsterEmoji || ''}${monster.name}を配下にしました！（追加攻撃: 自分の攻撃力の${(multiplier * 100).toFixed(1)}%）`);
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
