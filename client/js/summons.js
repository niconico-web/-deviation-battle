// client/js/summons.js
//
// 「サモンズロッド」武器種の専用機能：素材を1つ消費して、その素材を落とすモンスターを
// 配下（召喚モンスター）にできる。配下は最大3体まで持て、戦闘中は正解するたびに
// それぞれが追加攻撃を行う（実際の攻撃処理はbattle.js側で行う。ここでは、召喚モンスター
// の管理UI＝index.html「装備スキル」タブの武器種選択のところに表示する）。
//
// 召喚モンスターは、召喚時点の武器（メイン武器種 or サブ武器種＝デュアルウェポン）に
// 紐付けて weapon.summonedMonsters に保存する。battle.js側（online.jsが読み込まれて
// いないbattle.html）はBOT_MONSTERSを参照せず、保存済みのmonsterId/baseTotalStatと、
// monster-stats.js（battle.htmlでも読み込む）の固定値の表だけで強さを求める。
// 追加攻撃の攻撃力は「プレイヤーの攻撃力の何割か」で、その割合をモンスターの強さで決める
// （詳しくは下の「召喚モンスターの攻撃力」を参照）。

const SUMMON_MAX_MONSTERS = 3;

// サブ武器種（デュアルウェポン）としてサモンズロッドを使う場合、追加攻撃の倍率を
// メインの場合よりも弱くする（武器種の恩恵をサブでは弱めるのと同じ考え方）。
const SUMMON_SUB_TYPE_MULTIPLIER_RATIO = 0.5;

// ============================================================
// 召喚モンスターの攻撃力
// 配下の攻撃力は「プレイヤー自身の攻撃力の何割か」で決まり、その割合をモンスターの強さで決める。
//   ・モンスターの強さ ＝ monster-stats.jsの固定の合計ステータス
//     （スライム=250、原初の巨人=1000000。ボットとして戦う時と同じ値）。
//   ・この合計ステータスを「桁数（対数）」で0〜1に換算し、
//     弱いモンスター＝プレイヤー攻撃力の1割 〜 最強クラス＝5割 に割り当てる。
// 以前は合計ステータスの35%をそのまま攻撃力にしていたため、強いモンスターほど
// プレイヤーとは桁違いの攻撃力になり、契約モンスターが強すぎた。
// 実際のダメージは、この攻撃力を使って相手の防御力も差し引いて計算する（calcSummonDamage）。
// ============================================================

// 攻撃力の割合（プレイヤーの攻撃力に対する）。最弱クラス=MIN（1割）、最強クラス=MAX（5割）。
const SUMMON_ATK_RATIO_MIN = 0.10;
const SUMMON_ATK_RATIO_MAX = 0.50;

// 割合を決めるときの「強さ」の基準（合計ステータス）。この範囲を対数で0〜1に換算する。
// MINより弱いモンスターは最小割合、MAXより強いモンスターは最大割合になる。
const SUMMON_STRENGTH_MIN_TOTAL = 150;
const SUMMON_STRENGTH_MAX_TOTAL = 1000000;

// プレイヤーのステータス情報が取れなかった場合に使う仮の攻撃力（新規キャラ相当）
const SUMMON_PLAYER_FALLBACK_ATK = 50;

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
 * モンスターの「基礎合計ステータス」（固定値）を求める。ボットバトルで戦う時と同じ値。
 * この関数はBOT_MONSTERSの要素を受け取るため、online.jsが読み込まれているindex.html側
 * （召喚時・プレビュー表示時）でのみ呼び出す。
 * @param {object} monster - BOT_MONSTERSの要素
 * @returns {number}
 */
function getMonsterSummonBaseTotalStat(monster) {
    return getMonsterTotalStat(monster);
}

/**
 * 配下モンスター1体分の「基礎合計ステータス」を返す。
 * monster-stats.jsの表に載っているモンスターは常にその最新の値を使う
 * （表の数値を調整した場合や、以前の計算方式で契約した配下にも反映される）。
 * 表に無い場合は、契約時に保存した値（weapon.summonedMonstersのbaseTotalStat）を使う。
 * @param {object} summon - weapon.summonedMonstersの要素
 * @returns {number}
 */
function getSummonBaseTotalStat(summon) {
    if (!summon) return 0;
    if (summon.monsterId != null && typeof getMonsterTotalStatById === 'function') {
        const fixed = getMonsterTotalStatById(summon.monsterId);
        if (fixed != null) return fixed;
    }
    return summon.baseTotalStat || 0;
}

/**
 * 配下の攻撃力の基準にする「プレイヤーの攻撃力」を求める。
 * 通常の連続攻撃（battle.jsのhandleATBAnswer）と同じく、攻撃タイプが「特殊」なら特殊攻撃力を使う。
 * @param {object} statsLike - maxHp/atk/def/speed/special（とattackType）を持つオブジェクト
 * @returns {number}
 */
function getPlayerAttackForSummon(statsLike) {
    if (!statsLike) return SUMMON_PLAYER_FALLBACK_ATK;
    const base = statsLike.attackType === 'special' ? (statsLike.special || statsLike.atk) : statsLike.atk;
    return Math.max(1, Math.floor(base || 0));
}

/**
 * モンスターの強さ（基礎合計ステータス）から、追加攻撃力が「プレイヤーの攻撃力の何割か」を求める。
 * 合計ステータスを対数で換算するので、桁が1つ上がるごとに少しずつ割合が上がる。
 * @param {number} baseTotalStat
 * @returns {number} SUMMON_ATK_RATIO_MIN〜SUMMON_ATK_RATIO_MAX
 */
function getSummonAtkRatio(baseTotalStat) {
    const total = Math.max(1, baseTotalStat || 0);
    const lo = Math.log10(SUMMON_STRENGTH_MIN_TOTAL);
    const hi = Math.log10(SUMMON_STRENGTH_MAX_TOTAL);
    const t = Math.max(0, Math.min(1, (Math.log10(total) - lo) / (hi - lo)));
    return SUMMON_ATK_RATIO_MIN + (SUMMON_ATK_RATIO_MAX - SUMMON_ATK_RATIO_MIN) * t;
}

/**
 * 召喚モンスターの「現在の追加攻撃力」を求める。battle.js側（実際のダメージ計算）と
 * index.html側（UIプレビュー）の両方から呼ばれる共通ロジック。
 * 追加攻撃力 ＝ プレイヤーの攻撃力 × （モンスターの強さで決まる割合）。
 * @param {object} summon - weapon.summonedMonstersの要素（monsterId/baseTotalStat・isSubTypeを含む）
 * @param {number} playerAttack - 現在のプレイヤーの攻撃力（getPlayerAttackForSummonで求めた値）
 * @returns {number}
 */
function getSummonCurrentAtk(summon, playerAttack) {
    if (!summon) return 0;
    const ratio = getSummonAtkRatio(getSummonBaseTotalStat(summon));
    let atk = Math.max(1, playerAttack || SUMMON_PLAYER_FALLBACK_ATK) * ratio;
    if (summon.isSubType) atk *= SUMMON_SUB_TYPE_MULTIPLIER_RATIO;
    return Math.max(1, Math.floor(atk));
}

// 配下の追加攻撃のダメージ計算式。プレイヤー自身の連続攻撃（battle.jsのhandleATBAnswer）と
// 同じく「攻撃力 × 0.5 − 相手の防御力 × 0.1」（最低1ダメージ）。
// 以前は相手の防御力を一切考慮せず「攻撃力 × 0.5」がそのまま入っていたため、
// 防御の高い相手にも配下の攻撃が素通しになっていた。
const SUMMON_DAMAGE_ATK_RATE = 0.5;
const SUMMON_DEFENSE_REDUCTION_RATE = 0.1;

/**
 * 配下1体の追加攻撃が相手に与えるダメージを求める。
 * @param {number} summonAtk - getSummonCurrentAtk()で求めた配下の現在の追加攻撃力
 * @param {number} enemyDef - 相手の防御力（防御ダウンのデバフ反映済みの値を渡す）
 * @returns {number} 最低1
 */
function calcSummonDamage(summonAtk, enemyDef) {
    const def = Math.max(0, Math.floor(enemyDef || 0));
    const raw = Math.floor((summonAtk || 0) * SUMMON_DAMAGE_ATK_RATE);
    const reduction = Math.floor(def * SUMMON_DEFENSE_REDUCTION_RATE);
    return Math.max(1, raw - reduction);
}

/**
 * 現在装備中の武器が「サモンズロッド」を(メイン or サブ武器種として)使っているかを調べる。
 * @param {object} player
 * @returns {{weapon: object, isSummonsRod: boolean, isSubType: boolean}}
 */
function getEquippedSummonsRodInfo(player) {
    const weapon = player && player.equippedWeapon;
    if (!weapon) return { weapon: null, isSummonsRod: false, isSubType: false };

    // サモンズロッドが無効化されている間（weapons.jsのSUMMONS_ROD_ENABLED=false）は、
    // どの武器を装備していてもサモンズロッド扱いにしない（召喚UIも追加攻撃も動かなくなる）。
    if (typeof SUMMONS_ROD_ENABLED !== 'undefined' && !SUMMONS_ROD_ENABLED) {
        return { weapon, isSummonsRod: false, isSubType: false };
    }

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
        const playerAttack = getPlayerAttackForSummon(typeof getStatsFromPlayer === 'function' ? getStatsFromPlayer(player) : player);
        if (summoned.length === 0) {
            listEl.innerHTML = '<p>配下のモンスターはいません。</p>';
        } else {
            listEl.innerHTML = summoned.map((s, index) => {
                const currentAtk = getSummonCurrentAtk(s, playerAttack);
                const ratioPercent = Math.round(getSummonAtkRatio(getSummonBaseTotalStat(s)) * (s.isSubType ? SUMMON_SUB_TYPE_MULTIPLIER_RATIO : 1) * 100);
                return `
                <div class="summoned-monster-item">
                    <span>${s.monsterEmoji || ''} ${s.monsterName}（追加攻撃力: ${currentAtk}＝あなたの攻撃力の${ratioPercent}%）</span>
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
        const playerAttackForPreview = getPlayerAttackForSummon(typeof getStatsFromPlayer === 'function' ? getStatsFromPlayer(player) : player);

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
                const previewAtk = getSummonCurrentAtk({ monsterId: entry.monster.id, baseTotalStat, isSubType }, playerAttackForPreview);
                const previewPercent = Math.round(getSummonAtkRatio(baseTotalStat) * (isSubType ? SUMMON_SUB_TYPE_MULTIPLIER_RATIO : 1) * 100);
                const matName = (typeof MATERIAL_DATA !== 'undefined' && MATERIAL_DATA[entry.matId])
                    ? MATERIAL_DATA[entry.matId].name
                    : entry.matId;
                return `<option value="${entry.matId}">${matName}（${entry.monster.monsterEmoji || ''}${entry.monster.name} / 強さ${baseTotalStat}・追加攻撃力${previewAtk}＝攻撃力の${previewPercent}%・所持${materials[entry.matId]}個）</option>`;
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

    // 召喚モンスターの「基礎合計ステータス」（モンスターごとの固定値＝強さ）を保存する。
    // 実際の追加攻撃力は、プレイヤーの攻撃力に「この強さで決まる割合」を掛けて、
    // 戦闘のたびに動的に計算される。
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
    const playerAttack = getPlayerAttackForSummon(typeof getStatsFromPlayer === 'function' ? getStatsFromPlayer(updatedPlayer) : updatedPlayer);
    const currentAtk = getSummonCurrentAtk(newSummon, playerAttack);
    alert(`${monster.monsterEmoji || ''}${monster.name}を配下にしました！（強さ${baseTotalStat}・追加攻撃力${currentAtk}）`);
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
