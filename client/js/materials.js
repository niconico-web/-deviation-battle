// client/js/materials.js

const MATERIAL_DATA = {
    goblin_fang: { id: 'goblin_fang', name: 'ゴブリンの牙', description: 'ゴブリンキングから得られる牙。武器の強化素材として使われる。' },
    goblin_hide: { id: 'goblin_hide', name: 'ゴブリンの皮', description: 'ゴブリンキングから得られる丈夫な皮。防具の強化素材として使われる。' },
    slime_jelly: { id: 'slime_jelly', name: 'スライムゼリー', description: 'スライムクイーンから得られる粘液。オーブの融合に役立つ。' },
    slime_core: { id: 'slime_core', name: 'スライムコア', description: 'スライムクイーンの核。強力なオーブの触媒になる。' },
    dragon_scale: { id: 'dragon_scale', name: 'ドラゴンの鱗', description: 'フレイムドラゴンから得られる硬い鱗。頑丈な防具の素材。' },
    dragon_heart: { id: 'dragon_heart', name: 'ドラゴンの心臓', description: 'フレイムドラゴンを倒した証。究極のオーブの触媒。' },
};

/**
 * プレイヤーの素材インベントリを取得します。
 * @returns {object} 素材IDをキー、個数を値とするオブジェクト。
 */
function getPlayerMaterials() {
    const player = getPlayerData();
    return player ? (player.materials || {}) : {};
}

/**
 * プレイヤーの素材インベントリに素材を追加します。
 * @param {string} materialId - 追加する素材のID。
 * @param {number} count - 追加する個数。
 */
function addMaterialToPlayer(materialId, count = 1) {
    let player = getPlayerData();
    if (!player) return;

    player.materials = player.materials || {};
    player.materials[materialId] = (player.materials[materialId] || 0) + count;
    localStorage.setItem("player", JSON.stringify(player));
    console.log(`Added ${count} of ${materialId}. Current: ${player.materials[materialId]}`);
    renderMaterialsInventory();
}

/**
 * プレイヤーの素材インベントリから素材を削除します。
 * @param {string} materialId - 削除する素材のID。
 * @param {number} count - 削除する個数。
 * @returns {boolean} 削除に成功したかどうか。
 */
function removeMaterialFromPlayer(materialId, count = 1) {
    let player = getPlayerData();
    if (!player || !player.materials || (player.materials[materialId] || 0) < count) {
        console.warn(`Not enough ${materialId} to remove.`);
        return false;
    }

    player.materials[materialId] -= count;
    if (player.materials[materialId] <= 0) {
        delete player.materials[materialId];
    }
    localStorage.setItem("player", JSON.stringify(player));
    console.log(`Removed ${count} of ${materialId}. Current: ${player.materials[materialId] || 0}`);
    renderMaterialsInventory();
    return true;
}

/**
 * 素材インベントリのUIをレンダリングします。
 */
function renderMaterialsInventory() {
    const container = document.getElementById('materialsInventoryList');
    if (!container) return;

    const materials = getPlayerMaterials();
    container.innerHTML = '';

    if (Object.keys(materials).length === 0) {
        container.innerHTML = '<p>素材を所持していません。</p>';
        return;
    }

    for (const materialId in materials) {
        const materialInfo = MATERIAL_DATA[materialId];
        if (materialInfo) {
            const materialEl = document.createElement('div');
            materialEl.className = 'material-item';
            materialEl.innerHTML = `
                <span class="material-name">${materialInfo.name}</span>
                <span class="material-count">x ${materials[materialId]}</span>
                <p class="material-description">${materialInfo.description}</p>
            `;
            container.appendChild(materialEl);
        }
    }
}

/**
 * 素材システムを初期化します。
 */
function initMaterials() {
    console.log("Initializing materials system.");
    renderMaterialsInventory();
}
