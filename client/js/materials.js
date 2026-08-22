// client/js/materials.js

const MATERIAL_DATA = {
    goblin_fang: { id: 'goblin_fang', name: 'ゴブリンの牙', description: 'ゴブリンから採れる鋭い牙。武器の素材として使われる。' },
    goblin_hide: { id: 'goblin_hide', name: 'ゴブリンの皮', description: 'ゴブリンの丈夫な皮。防具の素材として使われる。' },
    slime_jelly: { id: 'slime_jelly', name: 'スライムゼリー', description: 'スライムから採れるゼリー。低ティアオーブの素材になる。' },
    slime_core: { id: 'slime_core', name: 'スライムコア', description: 'スライムの核。オーブの素材になる。' },
    dragon_scale: { id: 'dragon_scale', name: 'ドラゴンの鱗', description: 'フレイムドラゴンの硬い鱗。高い防御力を持つ素材。' },
    dragon_heart: { id: 'dragon_heart', name: 'ドラゴンの心臓', description: 'フレイムドラゴンの心臓。高ティアオーブの素材になる。' },
};

/**
 * ?v???C???[??f??C???x???g?????��??????B
 * @returns {object} ?f??ID???L?[?A??????l??????I?u?W?F?N?g?B
 */
function getPlayerMaterials() {
    const player = getPlayerData();
    return player ? (player.materials || {}) : {};
}

/**
 * ?v???C???[??f??C???x???g????f????????????B
 * @param {string} materialId - ????????f???ID?B
 * @param {number} count - ???????????B
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
 * ?v???C???[??f??C???x???g???????f???????????B
 * @param {string} materialId - ???????f???ID?B
 * @param {number} count - ??????????B
 * @returns {boolean} ???????????????????B
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
 * ?f??C???x???g????UI???????_?????O??????B
 */
function renderMaterialsInventory() {
    const container = document.getElementById('materialsInventoryList');
    if (!container) return;

    const materials = getPlayerMaterials();
    container.innerHTML = '';

    if (Object.keys(materials).length === 0) {
        container.innerHTML = '<p>�f�ނ��������Ă��܂���B</p>';
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
 * ?f??V?X?e????????????????B
 */
function initMaterials() {
    console.log("Initializing materials system.");
    renderMaterialsInventory();
}
