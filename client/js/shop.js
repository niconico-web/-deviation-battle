function renderShop() {
    const container = document.getElementById("shopList");
    if (!container) return;
    container.innerHTML = "";

    const player = getPlayerData();
    if (!player) {
        container.innerHTML = "<p>キャラクターを作成してください。</p>";
        return;
    }

    document.getElementById("coinDisplay").textContent = "所持コイン: " + (player.coins || 0);

    // 武器種類ごとにグループ化
    for (const type of Object.keys(WEAPON_TYPES)) {
        const typeName = getWeaponTypeLabel(type);
        
        // 武器種類ごとのセクションを作成
        const typeSection = document.createElement("div");
        typeSection.className = "weapon-type-section";
        
        const typeHeader = document.createElement("h3");
        typeHeader.className = "weapon-type-header";
        typeHeader.textContent = typeName;
        typeSection.appendChild(typeHeader);
        
        // tierグリッドを作成
        const tierGrid = document.createElement("div");
        tierGrid.className = "tier-grid";
        
        for (const tier of ["tier1", "tier2", "tier3"]) {
            const weapon = createWeapon(type, tier, false);
            
            // 武器が作成できない場合はスキップ（デバッグ武器など）
            if (!weapon || !weapon.id) {
                console.log(`[Shop] Skipping weapon for type=${type}, tier=${tier} - weapon creation failed`);
                continue;
            }
            
            console.log(`[Shop] Creating shop item for ${weapon.name} (${type}/${tier})`);
            
            const price = TIER_PRICES[tier];
            const owned = playerOwnsWeapon(player, weapon.id);

            const item = document.createElement("div");
            item.className = "shop-item" + (owned ? " owned" : "");
            item.innerHTML =
                `<div class="shop-item-info">
                    <strong>${weapon.name}</strong>
                    <span class="shop-item-tier">${tier.toUpperCase()}</span>
                </div>
                <div class="shop-item-action">
                    ${owned
                        ? '<span class="owned-label">所持済</span>'
                        : `<button class="btn btn-small buy-btn" data-type="${type}" data-tier="${tier}">${price}コイン</button>`
                    }
                </div>`;
            tierGrid.appendChild(item);
        }
        
        typeSection.appendChild(tierGrid);
        container.appendChild(typeSection);
    }

    container.querySelectorAll(".buy-btn").forEach(btn => {
        btn.onclick = () => {
            showBuyWeaponDialog(btn.dataset.type, btn.dataset.tier);
        };
    });
}

function renderInventory() {
    const container = document.getElementById("inventoryList");
    if (!container) return;
    container.innerHTML = "";

    const player = getPlayerData();
    if (!player || !player.weapons || player.weapons.length === 0) {
        container.innerHTML = "<p>武器を所持していません。ショップで購入しましょう。</p>";
        return;
    }

    const equipped = player.equippedWeapon;

    for (const weapon of player.weapons) {
        const isEquipped = equipped && equipped.id === weapon.id;
        const item = document.createElement("div");
        item.className = "inventory-item" + (isEquipped ? " equipped" : "");
        
        let typeLabel = "";
        if (weapon.isOriginal) {
            typeLabel = "オリジナル武器";
        } else {
            typeLabel = getWeaponTypeLabel(weapon.type);
        }
        
        // オリジナル武器の詳細情報を生成
        let weaponDetails = "";
        if (weapon.isOriginal) {
            let details = [];

            // 倍率表示
            if (weapon.multiplier) {
                const multPercent = Math.round((weapon.multiplier - 1) * 100);
                details.push(`倍率: +${multPercent}%`);
            }

            // ステータス補正表示
            if (weapon.statBonuses) {
                const bonusParts = [];
                for (const [stat, bonus] of Object.entries(weapon.statBonuses)) {
                    const statLabel = { atk: "攻撃", def: "防御", speed: "速さ", maxHp: "HP", special: "特殊" }[stat] || stat;
                    const sign = bonus > 0 ? "+" : "";
                    bonusParts.push(`${statLabel}${sign}${(bonus * 100).toFixed(0)}%`);
                }
                if (bonusParts.length > 0) {
                    details.push(bonusParts.join(", "));
                }
            }

            // ユニーク能力表示
            if (weapon.uniqueAbilities && weapon.uniqueAbilities.length > 0) {
                const abilityNames = weapon.uniqueAbilities.map(ua => ua.name).join(", ");
                details.push(`★${abilityNames}★`);
            }

            if (details.length > 0) {
                weaponDetails = `<div class="weapon-details">${details.join("<br>")}</div>`;
            }
        } else if (weapon.sourceBossId) {
            // ボス武器の詳細情報
            let details = [];

            // 倍率表示
            if (weapon.multiplier) {
                const multPercent = Math.round((weapon.multiplier - 1) * 100);
                details.push(`倍率: +${multPercent}%`);
            }

            // 上限倍率表示
            if (weapon.maxMultiplier) {
                const maxMultPercent = Math.round((weapon.maxMultiplier - 1) * 100);
                details.push(`上限倍率: +${maxMultPercent}%`);
            }

            // 限界突破レベル表示
            const limitBreakLevel = weapon.limitBreakLevel || 0;
            const maxLimitBreak = weapon.maxLimitBreak || 4;
            details.push(`限界突破: ${limitBreakLevel}/${maxLimitBreak}`);

            // ユニーク能力表示
            if (weapon.uniqueAbilities && weapon.uniqueAbilities.length > 0) {
                const abilityNames = weapon.uniqueAbilities.map(ua => ua.name).join(", ");
                details.push(`★${abilityNames}★`);
            }

            if (details.length > 0) {
                weaponDetails = `<div class="weapon-details">${details.join("<br>")}</div>`;
            }
        }
        
        item.innerHTML =
            `<div class="inventory-item-info">
                <strong>${getWeaponDisplayName(weapon)}</strong>
                <span>${typeLabel}</span>
                ${weaponDetails}
            </div>
            <div class="inventory-item-action">
                ${isEquipped
                    ? '<span class="equipped-label">装備中</span>'
                    : `<button class="btn btn-small equip-btn" data-id="${weapon.id}">装備</button>`
                }
                ${weapon.sourceBossId && !isEquipped ? `<button class="btn btn-small limit-break-btn" data-id="${weapon.id}">限界突破</button>` : ''}
                ${!isEquipped ? `<button class="btn btn-small btn-danger discard-btn" data-id="${weapon.id}">捨てる</button>` : ''}
            </div>`;
        container.appendChild(item);
    }

    if (equipped) {
        const unequipBtn = document.createElement("button");
        unequipBtn.className = "btn btn-small";
        unequipBtn.textContent = "武器を外す";
        unequipBtn.onclick = () => {
            const p = getPlayerData();
            const updated = unequipWeapon(p);
            localStorage.setItem("player", JSON.stringify(updated));
            renderInventory();
            updateStatus(updated);
        };
        container.appendChild(unequipBtn);
    }

    container.querySelectorAll(".equip-btn").forEach(btn => {
        btn.onclick = () => {
            const p = getPlayerData();
            const result = equipWeapon(p, btn.dataset.id);
            if (!result.ok) {
                alert(result.message);
                return;
            }
            localStorage.setItem("player", JSON.stringify(result.player));
            renderInventory();
            updateStatus(result.player);
        };
    });

    container.querySelectorAll(".limit-break-btn").forEach(btn => {
        btn.onclick = () => {
            const p = getPlayerData();
            const weapon = (p.weapons || []).find(w => w.id === btn.dataset.id);
            if (!weapon) return;

            const result = limitBreakWeapon(p, weapon.id);
            if (!result.ok) {
                alert(result.message);
                return;
            }
            localStorage.setItem("player", JSON.stringify(result.player));
            alert(`${weapon.name} を限界突破しました！\n上限倍率: ${result.weapon.maxMultiplier.toFixed(1)}x (限界突破 ${result.weapon.limitBreakLevel}/${result.weapon.maxLimitBreak})\nさらに「強化」でこの上限まで倍率を伸ばせます。`);
            renderInventory();
            updateStatus(result.player);
        };
    });

    container.querySelectorAll(".discard-btn").forEach(btn => {
        btn.onclick = () => {
            const weaponName = (player.weapons || []).find(w => w.id === btn.dataset.id)?.name || "武器";
            if (!confirm(`${weaponName} を捨てますか？この操作は取り消せません。`)) return;
            
            const p = getPlayerData();
            const result = discardWeapon(p, btn.dataset.id);
            if (!result.ok) {
                alert(result.message);
                return;
            }
            localStorage.setItem("player", JSON.stringify(result.player));
            renderInventory();
            updateStatus(result.player);
        };
    });
}

function renderOriginalWeapons() {
    const container = document.getElementById("originalWeaponList");
    if (!container) return;
    container.innerHTML = "";

    const player = getPlayerData();
    if (!player) return;

    const originalWeapons = (player.weapons || []).filter(w => w.isOriginal);
    
    if (originalWeapons.length === 0) {
        container.innerHTML = "<p>オリジナル武器を所持していません。</p>";
        return;
    }

    for (const weapon of originalWeapons) {
        const item = document.createElement("div");
        item.className = "quest-item";
        
        const canUpgrade = canUpgradeOriginalWeapon(weapon);
        const upgradeCost = getOriginalWeaponUpgradeCost(weapon);
        const baseMult = getWeaponBaseMultiplierForProgress(weapon);
        const maxMult = getWeaponMaxMultiplier(weapon);
        const progress = maxMult > baseMult
            ? ((weapon.multiplier - baseMult) / (maxMult - baseMult) * 100).toFixed(1)
            : "100.0";
        
        let bonusText = "";
        if (weapon.statBonuses) {
            const bonusParts = [];
            for (const [stat, bonus] of Object.entries(weapon.statBonuses)) {
                const statLabel = { atk: "攻撃", def: "防御", speed: "速さ", maxHp: "HP", special: "特殊" }[stat] || stat;
                const sign = bonus > 0 ? "+" : "";
                bonusParts.push(`${statLabel}${sign}${(bonus * 100).toFixed(0)}%`);
            }
            if (bonusParts.length > 0) {
                bonusText = bonusParts.join(", ");
            }
        }

        // ユニーク能力表示
        let abilityText = "";
        if (weapon.uniqueAbilities && weapon.uniqueAbilities.length > 0) {
            abilityText = weapon.uniqueAbilities.map(ua => ua.name).join(", ");
        }

        // 必殺技名表示
        const ultimateName = weapon.ultimateName || "未設定";

        // 二個目の武器種表示
        let secondaryTypeText = "";
        if (weapon.secondaryType) {
            secondaryTypeText = `<span class="quest-progress">二個目武器種: ${getWeaponTypeLabel(weapon.secondaryType)}</span>`;
        }

        // 限界突破情報表示（ボス武器のみ）
        let limitBreakText = "";
        if (weapon.sourceBossId) {
            const materialId = getBossLimitBreakMaterialId(weapon.sourceBossId);
            const materialCount = getMaterialCount(player, materialId);
            const level = weapon.limitBreakLevel || 0;
            const maxLevel = weapon.maxLimitBreak != null ? weapon.maxLimitBreak : 4;
            limitBreakText = `<span class="quest-progress">限界突破: ${level}/${maxLevel}（上限倍率 ${maxMult.toFixed(1)}x） / 素材所持: ${materialCount}個</span>`;
        }

        // オリジナル武器の限界突破情報
        let originalLimitBreakText = "";
        if (weapon.isOriginal && !weapon.sourceBossId) {
            const level = weapon.originalLimitBreakLevel || 0;
            const maxLevel = weapon.maxOriginalLimitBreak != null ? weapon.maxOriginalLimitBreak : 16;
            const maxMult = getWeaponMaxMultiplier(weapon);
            originalLimitBreakText = `<span class="quest-progress">限界突破: ${level}/${maxLevel}（上限倍率 ${maxMult.toFixed(1)}x）</span>`;
        }

        item.innerHTML =
            `<div class="quest-item-info">
                <strong>${weapon.name}</strong>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                    <span class="progress-text">強化進捗: ${progress}% (倍率 ${weapon.multiplier.toFixed(3)}x / ${maxMult.toFixed(1)}x)</span>
                </div>
                <span class="quest-progress">${bonusText}</span>
                ${abilityText ? `<span class="quest-progress">★${abilityText}★</span>` : ''}
                ${secondaryTypeText}
                ${limitBreakText}
                ${originalLimitBreakText}
                <span class="quest-progress">必殺技: ${ultimateName}</span>
            </div>`;

        const actionContainer = document.createElement("div");
        actionContainer.className = "quest-item-action";
        item.appendChild(actionContainer);

        if (canUpgrade) {
            const upgradeBtn = document.createElement("button");
            upgradeBtn.className = "btn btn-small";
            upgradeBtn.textContent = `強化 (${upgradeCost}コイン)`;
            upgradeBtn.disabled = player.coins < upgradeCost;
            upgradeBtn.onclick = () => upgradeOriginalWeaponUI(weapon);
            actionContainer.appendChild(upgradeBtn);
        }

        // ボス武器の限界突破ボタン
        if (weapon.sourceBossId && canLimitBreakWeapon(weapon)) {
            const materialId = getBossLimitBreakMaterialId(weapon.sourceBossId);
            const materialCount = getMaterialCount(player, materialId);
            const limitBreakBtn = document.createElement("button");
            limitBreakBtn.className = "btn btn-small btn-warning";
            limitBreakBtn.textContent = `限界突破 (素材x${materialCount})`;
            limitBreakBtn.disabled = materialCount < 1;
            limitBreakBtn.onclick = () => limitBreakWeaponUI(weapon);
            actionContainer.appendChild(limitBreakBtn);
        }

        // オリジナル武器の限界突破ボタン（ボス武器でない場合）
        if (weapon.isOriginal && !weapon.sourceBossId && canLimitBreakOriginalWeapon(weapon)) {
            const tier4OrbCount = (player.orbs || []).filter(o => o.tier === 'tier4').length;
            const originalLimitBreakBtn = document.createElement("button");
            originalLimitBreakBtn.className = "btn btn-small btn-warning"; // 別の色にする
            originalLimitBreakBtn.textContent = `限界突破 (Tier4オーブx${tier4OrbCount})`;
            originalLimitBreakBtn.disabled = tier4OrbCount < 1;
            originalLimitBreakBtn.onclick = () => {
                // 新しいUIハンドラを呼ぶ
                limitBreakOriginalWeaponUI(weapon);
            };
            actionContainer.appendChild(originalLimitBreakBtn);
        }

        // デュアルウェポン能力を持つ武器のサブ武器種設定ボタン
        // （作成時にオーブでデュアルウェポン能力が付与された場合や、ボス武器のように
        //   最初からランダムでデュアルウェポン能力を持つ場合は、secondaryType が
        //   未設定のままになるため、ここから後付けで設定できるようにする）
        const hasDualWeaponAbility = (weapon.uniqueAbilities || []).some(a => a && a.effect === 'dual_weapon');
        if (hasDualWeaponAbility) {
            const secondaryWeaponBtn = document.createElement("button");
            secondaryWeaponBtn.className = "btn btn-small";
            secondaryWeaponBtn.textContent = weapon.secondaryType ? "サブ武器種を変更" : "サブ武器種を設定";
            secondaryWeaponBtn.onclick = () => openSecondaryWeaponTypeModal(weapon);
            actionContainer.appendChild(secondaryWeaponBtn);
        }

        container.appendChild(item);
    }
}

function renderMaterialsInventory() {
    const container = document.getElementById("materialsInventoryList");
    if (!container) return;
    container.innerHTML = "";

    const player = getPlayerData();
    if (!player || !player.materials || Object.keys(player.materials).length === 0) {
        container.innerHTML = "<p>素材を所持していません。</p>";
        return;
    }

    for (const [materialId, count] of Object.entries(player.materials)) {
        if (count <= 0) continue;
        // 素材IDからボス名を取得する（暫定的な方法）
        const bossId = materialId.replace('_limit_break_material', '');
        const bosses = window.bosses || [];
        const boss = bosses.find(b => b.id === bossId);
        const materialName = boss ? getBossLimitBreakMaterialName(boss.name) : materialId;

        const item = document.createElement("div");
        item.className = "inventory-item";
        item.innerHTML = `
            <div class="inventory-item-info">
                <strong>${materialName}</strong>
                <span>所持数: ${count}</span>
            </div>`;
        container.appendChild(item);
    }
}

function renderOrbInventory() {
    const container = document.getElementById("orbInventory");
    if (!container) return;
    container.innerHTML = "";

    const player = getPlayerData();
    if (!player || !player.orbs || !Array.isArray(player.orbs) || player.orbs.length === 0) {
        container.innerHTML = "<p>オーブを所持していません。</p>";
        return;
    }

    for (const orb of player.orbs) {
        if (!orb) continue;
        const item = document.createElement("div");
        item.className = "inventory-item";

        const tierName = (typeof ORB_TIERS !== "undefined" && ORB_TIERS[orb.tier]?.name) || orb.tier;
        const statLabel = (typeof ORB_STAT_LABELS !== "undefined" && ORB_STAT_LABELS[orb.statType]) || orb.statType;

        let abilityInfo = "";
        if (orb.uniqueAbility) {
            abilityInfo = `<div class="orb-ability">★ ${orb.uniqueAbility.name}</div>`;
        }

        item.innerHTML = `
            <div class="inventory-item-info">
                <strong>${tierName}オーブ</strong>
                <span>${statLabel} +${Math.round(orb.bonus * 100)}%</span>
                ${abilityInfo}
            </div>`;
        container.appendChild(item);
    }
}

function showBuyWeaponDialog(type, tier) {
    const weapon = createWeapon(type, tier, false);
    const price = TIER_PRICES[tier];
    if (!confirm(`${weapon.name} を ${price}コインで購入しますか？`)) return;
    
    const player = getPlayerData();
    const result = buyWeapon(player, type, tier);
    
    if (!result.ok) {
        alert(result.message);
        return;
    }
    
    localStorage.setItem("player", JSON.stringify(result.player));
    renderShop();
    renderInventory();
    updateStatus(result.player);
}

function limitBreakWeaponUI(weapon) {
    const player = getPlayerData();
    if (!player) return;

    const materialId = getBossLimitBreakMaterialId(weapon.sourceBossId);
    const materialCount = getMaterialCount(player, materialId);
    const materialName = getBossLimitBreakMaterialName(weapon.name.replace(/の武器$/, ''));

    if (!confirm(`${weapon.name} を限界突破しますか？\n（${materialName}を1つ消費します）`)) {
        return;
    }

    const result = limitBreakWeapon(player, weapon.id);
    if (!result.ok) {
        alert(result.message);
        return;
    }

    localStorage.setItem("player", JSON.stringify(result.player));
    if (typeof updateMissionProgress === 'function') updateMissionProgress('limit_break');

    let message = `${weapon.name} を限界突破しました！\n上限倍率: ${result.weapon.maxMultiplier.toFixed(1)}x (限界突破 ${result.weapon.limitBreakLevel}/${result.weapon.maxLimitBreak})\nさらに「強化」でこの上限まで倍率を伸ばせます。`;

    // 4回限界突破した時に固有能力が付与されたらメッセージを追加
    if (result.weapon.uniqueAbilities && result.weapon.uniqueAbilities.length > (weapon.uniqueAbilities || []).length) {
        const newAbility = result.weapon.uniqueAbilities[result.weapon.uniqueAbilities.length - 1];
        if (newAbility) {
            message += `\n\n★武器を極めし者よ…\n固有能力「${newAbility.name}」が解放されました！`;
        }
    }

    alert(message);

    renderOriginalWeapons();
    renderInventory();
    updateStatus(result.player);
}

function limitBreakOriginalWeaponUI(weapon) {
    const player = getPlayerData();
    if (!player) return;

    if (!confirm(`${weapon.name} を限界突破しますか？\n（Tier4オーブを1つ消費します）`)) {
        return;
    }

    const result = limitBreakOriginalWeapon(player, weapon.id);
    if (!result.ok) {
        alert(result.message);
        return;
    }

    localStorage.setItem("player", JSON.stringify(result.player));
    if (typeof updateMissionProgress === 'function') updateMissionProgress('limit_break');

    alert(`${weapon.name} を限界突破しました！\n上限倍率: ${result.weapon.maxMultiplier.toFixed(1)}x (限界突破 ${result.weapon.originalLimitBreakLevel}/${result.weapon.maxOriginalLimitBreak})`);

    renderOriginalWeapons();
    renderInventory();
    updateStatus(result.player);
}

/**
 * サブ武器種設定モーダルを（無ければ生成して）取得する。
 * オリジナル武器作成モーダルにある「サブ武器種（デュアルウェポン）」の選択肢と
 * 同じ考え方で、後付けでも同じ選択ができるようにするためのモーダル。
 * @returns {HTMLElement}
 */
function ensureSecondaryWeaponModal() {
    let modal = document.getElementById('secondaryWeaponModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'secondaryWeaponModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <button type="button" class="close btn btn-secondary" style="align-self: flex-end;">閉じる</button>
            <h3>サブ武器種を設定（デュアルウェポン）</h3>
            <p id="secondaryWeaponModalWeaponName"></p>
            <label class="field-label" for="secondaryWeaponTypeSelect">サブ武器種</label>
            <select id="secondaryWeaponTypeSelect"></select>
            <button type="button" id="confirmSecondaryWeaponBtn" class="btn btn-primary">設定する</button>
        </div>`;
    document.body.appendChild(modal);

    modal.querySelector('.close').onclick = () => {
        modal.style.display = 'none';
    };

    return modal;
}

/**
 * 指定した武器のサブ武器種を設定するモーダルを開く。
 * @param {object} weapon - サブ武器種を設定する対象の武器（デュアルウェポン能力を持つもの）
 */
function openSecondaryWeaponTypeModal(weapon) {
    const modal = ensureSecondaryWeaponModal();

    const nameEl = document.getElementById('secondaryWeaponModalWeaponName');
    if (nameEl) nameEl.textContent = `対象の武器: ${weapon.name}（メイン武器種: ${getWeaponTypeLabel(weapon.type)}）`;

    const select = document.getElementById('secondaryWeaponTypeSelect');
    select.innerHTML = '';
    for (const type of Object.keys(WEAPON_TYPES)) {
        if (type === weapon.type) continue; // メインと同じ武器種は選べない
        const option = document.createElement('option');
        option.value = type;
        option.textContent = getWeaponTypeLabel(type);
        if (type === weapon.secondaryType) option.selected = true;
        select.appendChild(option);
    }

    const confirmBtn = document.getElementById('confirmSecondaryWeaponBtn');
    confirmBtn.onclick = () => {
        const secondaryType = select.value;
        if (!secondaryType) return;

        const player = getPlayerData();
        if (!player) return;

        const updatedPlayer = { ...player };
        updatedPlayer.weapons = (updatedPlayer.weapons || []).map(w =>
            w.id === weapon.id ? { ...w, secondaryType } : w
        );
        if (updatedPlayer.equippedWeapon && updatedPlayer.equippedWeapon.id === weapon.id) {
            updatedPlayer.equippedWeapon = { ...updatedPlayer.equippedWeapon, secondaryType };
        }

        localStorage.setItem("player", JSON.stringify(updatedPlayer));

        modal.style.display = 'none';
        alert(`${weapon.name} のサブ武器種を「${getWeaponTypeLabel(secondaryType)}」に設定しました！`);

        renderOriginalWeapons();
        renderInventory();
        updateStatus(updatedPlayer);
    };

    modal.style.display = 'flex';
}

function upgradeOriginalWeaponUI(weapon) {
    const player = getPlayerData();
    if (!player) return;
    
    const cost = getOriginalWeaponUpgradeCost(weapon);
    if (player.coins < cost) {
        alert(`コインが足りません（必要: ${cost}）`);
        return;
    }
    
    const updatedPlayer = { ...player, coins: player.coins - cost };
    let updatedWeapon = upgradeOriginalWeapon(weapon);

    // プレイヤーの武器リストを更新
    const weapons = updatedPlayer.weapons.map(w => w.id === weapon.id ? updatedWeapon : w);
    updatedPlayer.weapons = weapons;

    // 装備中の武器も更新
    if (updatedPlayer.equippedWeapon && updatedPlayer.equippedWeapon.id === weapon.id) {
        updatedPlayer.equippedWeapon = updatedWeapon;
    }

    localStorage.setItem("player", JSON.stringify(updatedPlayer));
    if (typeof updateMissionProgress === 'function') updateMissionProgress('upgrade_weapon');
    
    let message = `${weapon.name} を強化しました！\n倍率: ${updatedWeapon.multiplier.toFixed(3)}x`;

    // 4回限界突破した武器が上限まで強化された時に固有能力が付与されたらメッセージを追加
    if (updatedWeapon.uniqueAbilities && updatedWeapon.uniqueAbilities.length > (weapon.uniqueAbilities || []).length) {
        const newAbility = updatedWeapon.uniqueAbilities[updatedWeapon.uniqueAbilities.length - 1];
        if (newAbility) {
            message += `\n\n★武器を極めし者よ…\n固有能力「${newAbility.name}」が解放されました！`;
        }
    }

    alert(message);
    
    renderOriginalWeapons();
    updateStatus(updatedPlayer);
}

// オリジナル武器作成時に組み込めるオーブの最大数（help.htmlの説明と一致させる）
const MAX_WEAPON_ORBS = 3;

function showCreateWeaponDialog() {
    const modal = document.getElementById('createWeaponModal');
    if (!modal) return;
    
    const player = getPlayerData();
    if (!player) return;
    
    const cost = ORIGINAL_WEAPON_COST;
    document.getElementById('createWeaponCost').textContent = `作成コスト: ${cost}コイン`;
    document.getElementById('createWeaponBtn').disabled = player.coins < cost;
    
    // オーブ選択肢を生成
    const orbSelectContainer = document.getElementById('orbSelectContainer');
    orbSelectContainer.innerHTML = '';
    const orbs = player.orbs || [];
    
    if (orbs.length === 0) {
        orbSelectContainer.innerHTML = '<p>使用できるオーブがありません。</p>';
    } else {
        const orbLimitNote = document.createElement('p');
        orbLimitNote.className = 'orb-select-note';
        orbLimitNote.textContent = `オーブは最大${MAX_WEAPON_ORBS}つまで選択できます。`;
        orbSelectContainer.appendChild(orbLimitNote);

        orbs.forEach((orb, index) => {
            const checkbox = document.createElement('div');
            checkbox.className = 'orb-checkbox';
            checkbox.innerHTML = `<input type="checkbox" id="orb-${index}" value="${index}"> <label for="orb-${index}">${getOrbDisplayName(orb)}</label>`;
            orbSelectContainer.appendChild(checkbox);
        });
    }
    
    // ボーナス素材選択肢を生成
    const materialSelectContainer = document.getElementById('materialSelectContainer');
    if (materialSelectContainer) {
        materialSelectContainer.innerHTML = '';
        const materials = player.materials || {};
        const weaponMaterials = typeof WEAPON_MATERIALS !== 'undefined' ? WEAPON_MATERIALS : [];
        
        const availableWeaponMaterials = weaponMaterials.filter(matId => materials[matId] && materials[matId] > 0);
        
        if (availableWeaponMaterials.length === 0) {
            materialSelectContainer.innerHTML = '<p>使用できる武器素材がありません。</p>';
        } else {
            const materialLimitNote = document.createElement('p');
            materialLimitNote.className = 'material-select-note';
            materialLimitNote.textContent = 'ボーナス素材は最大3つまで選択できます。オーブとは別に追加でボーナスを得られます。';
            materialSelectContainer.appendChild(materialLimitNote);

            availableWeaponMaterials.forEach(matId => {
                const material = typeof MATERIAL_DATA !== 'undefined' ? MATERIAL_DATA[matId] : null;
                if (material) {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'material-checkbox';
                    checkbox.innerHTML = `<input type="checkbox" id="mat-${matId}" value="${matId}"> <label for="mat-${matId}">${material.name} (x${materials[matId]})</label>`;
                    materialSelectContainer.appendChild(checkbox);
                }
            });
        }
    }
    
    // デュアルウェポン用の武器種選択を表示/非表示
    const dualWeaponSelect = document.getElementById('dualWeaponTypeSelect');
    dualWeaponSelect.style.display = 'none';

    // 選択中のオーブ数が上限に達したら、それ以上チェックできないようにする
    function updateOrbCheckboxLimit() {
        const allCheckboxes = orbSelectContainer.querySelectorAll('input[type="checkbox"]');
        const checkedCount = orbSelectContainer.querySelectorAll('input[type="checkbox"]:checked').length;
        allCheckboxes.forEach(cb => {
            cb.disabled = !cb.checked && checkedCount >= MAX_WEAPON_ORBS;
        });
    }

    orbSelectContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // 以前は選択数の上限チェックが無く、オーブを4つ以上選べてしまっていた
            updateOrbCheckboxLimit();

            const selectedOrbs = getSelectedOrbs();
            const hasDualWeapon = selectedOrbs.some(orb => orb.uniqueAbility && orb.uniqueAbility.effect === 'dual_weapon');
            dualWeaponSelect.style.display = hasDualWeapon ? 'block' : 'none';
        });
    });
    updateOrbCheckboxLimit();
    
    modal.style.display = 'flex';
}

function getSelectedOrbs() {
    const player = getPlayerData();
    const selectedOrbs = [];
    const orbCheckboxes = document.querySelectorAll('#orbSelectContainer input[type="checkbox"]:checked');
    orbCheckboxes.forEach(checkbox => {
        const index = parseInt(checkbox.value);
        if (player.orbs && player.orbs[index]) {
            selectedOrbs.push(player.orbs[index]);
        }
    });
    return selectedOrbs;
}

function getSelectedBonusMaterials() {
    const selectedMaterials = [];
    const materialCheckboxes = document.querySelectorAll('#materialSelectContainer input[type="checkbox"]:checked');
    materialCheckboxes.forEach(checkbox => {
        if (checkbox.value) {
            selectedMaterials.push(checkbox.value);
        }
    });
    // 最大3つに制限
    return selectedMaterials.slice(0, 3);
}

function initShop() {
    // 武器作成モーダル
    const createWeaponModalBtn = document.getElementById('showCreateWeaponModalBtn');
    if (createWeaponModalBtn) {
        createWeaponModalBtn.onclick = showCreateWeaponDialog;
    }
    
    const closeCreateModal = document.querySelector('#createWeaponModal .close');
    if (closeCreateModal) {
        closeCreateModal.onclick = () => document.getElementById('createWeaponModal').style.display = 'none';
    }
    
    const createWeaponBtn = document.getElementById('createWeaponBtn');
    if (createWeaponBtn) {
        createWeaponBtn.onclick = () => {
            const player = getPlayerData();
            if (!player) return;
            
            const name = document.getElementById('weaponName').value.trim();
            const type = document.getElementById('weaponType').value;
            const ultimateName = document.getElementById('ultimateName').value.trim();
            
            if (!name) { alert('武器名を入力してください'); return; }
            if (!ultimateName) { alert('必殺技名を入力してください'); return; }
            
            // 名前のバリデーション
            const nameValidation = validateName(name);
            if (!nameValidation.valid) {
                alert(`武器名エラー: ${nameValidation.reason}`);
                return;
            }
            
            // 必殺技名のバリデーション
            const ultimateValidation = validateName(ultimateName);
            if (!ultimateValidation.valid) {
                alert(`必殺技名エラー: ${ultimateValidation.reason}`);
                return;
            }
            
            const selectedOrbs = getSelectedOrbs();
            const selectedBonusMaterials = getSelectedBonusMaterials();
            
            // ボーナス素材の所持チェック
            const materials = player.materials || {};
            for (const matId of selectedBonusMaterials) {
                if (!materials[matId] || materials[matId] < 1) {
                    alert('素材が足りません');
                    return;
                }
            }
            
            // デュアルウェポン能力があるかチェック
            const hasDualWeapon = selectedOrbs.some(orb => orb.uniqueAbility && orb.uniqueAbility.effect === 'dual_weapon');
            const secondaryType = hasDualWeapon ? document.getElementById('dualWeaponType').value : null;
            
            if (hasDualWeapon && secondaryType === type) {
                alert('デュアルウェポンでは、メインと同じ武器種は選択できません。');
                return;
            }
            
            let playerAfterCost = { ...player, coins: player.coins - ORIGINAL_WEAPON_COST };
            
            // オーブを消費
            const remainingOrbs = (player.orbs || []).filter(orb => !selectedOrbs.some(selected => selected.id === orb.id));
            playerAfterCost.orbs = remainingOrbs;
            
            // ボーナス素材を消費
            const remainingMaterials = { ...materials };
            for (const matId of selectedBonusMaterials) {
                remainingMaterials[matId]--;
                if (remainingMaterials[matId] <= 0) {
                    delete remainingMaterials[matId];
                }
            }
            playerAfterCost.materials = remainingMaterials;
            
            // 武器を作成（ボーナス素材を含む）
            let weapon = createOriginalWeapon(name, type, {}, ultimateName, selectedBonusMaterials);
            weapon = applyOrbToWeapon(weapon, selectedOrbs);
            
            // デュアルウェポン情報を追加
            if (secondaryType) {
                weapon.secondaryType = secondaryType;
            }
            
            const updatedPlayer = addWeaponToPlayer(playerAfterCost, weapon);
            
            localStorage.setItem("player", JSON.stringify(updatedPlayer));
            if (typeof updateMissionProgress === 'function') updateMissionProgress('create_weapon');
            
            alert(`オリジナル武器「${weapon.name}」を作成しました！`);
            
            document.getElementById('createWeaponModal').style.display = 'none';
            renderOriginalWeapons();
            renderInventory();
            updateStatus(updatedPlayer);
        };
    }
    
    // オーブ合成モーダル
    const openOrbSynthesisBtn = document.getElementById('openOrbSynthesisBtn');
    const orbSynthesisModal = document.getElementById('orbSynthesisModal');
    const closeOrbSynthesisBtn = document.getElementById('closeOrbSynthesisBtn');

    function updateOrbSynthesisCounts() {
        const p = getPlayerData();
        const orbs = (p && p.orbs) || [];
        const tier1Count = orbs.filter(o => o.tier === 'tier1').length;
        const tier2Count = orbs.filter(o => o.tier === 'tier2').length;
        const tier3Count = orbs.filter(o => o.tier === 'tier3').length;
        const t1El = document.getElementById('tier1OrbCount');
        const t2El = document.getElementById('tier2OrbCount');
        const t3El = document.getElementById('tier3OrbCount');
        if (t1El) t1El.textContent = tier1Count;
        if (t2El) t2El.textContent = tier2Count;
        if (t3El) t3El.textContent = tier3Count;
    }

    if (openOrbSynthesisBtn && orbSynthesisModal) {
        openOrbSynthesisBtn.onclick = () => {
            updateOrbSynthesisCounts();
            orbSynthesisModal.style.display = 'flex';
        };
    }
    if (closeOrbSynthesisBtn && orbSynthesisModal) {
        closeOrbSynthesisBtn.onclick = () => {
            orbSynthesisModal.style.display = 'none';
        };
    }

    // 低ティアのオーブを指定数消費して、1つ上のティアのオーブを合成する
    function synthesizeOrbTier(fromTier, toTier, requiredCount) {
        const player = getPlayerData();
        if (!player || !player.orbs) return;

        const sourceOrbs = player.orbs.filter(o => o.tier === fromTier);
        if (sourceOrbs.length < requiredCount) {
            alert(`${fromTier}オーブが${requiredCount}個必要です（現在: ${sourceOrbs.length}個）`);
            return;
        }

        const idsToConsume = new Set(sourceOrbs.slice(0, requiredCount).map(o => o.id));
        const remainingOrbs = player.orbs.filter(o => !idsToConsume.has(o.id));

        const newOrb = createOrb(toTier);
        if (!newOrb) {
            alert('オーブの合成に失敗しました。');
            return;
        }
        remainingOrbs.push(newOrb);

        const updatedPlayer = { ...player, orbs: remainingOrbs };
        localStorage.setItem("player", JSON.stringify(updatedPlayer));
        if (typeof updateMissionProgress === 'function') updateMissionProgress('synthesize_orb');

        alert(`オーブを合成しました！\n新しいオーブ: ${getOrbDisplayName(newOrb)}`);
        updateOrbSynthesisCounts();
        renderOrbInventory();
        updateStatus(updatedPlayer);
    }

    const synthesizeTier2Btn = document.getElementById('synthesizeTier2Btn');
    if (synthesizeTier2Btn) {
        synthesizeTier2Btn.onclick = () => synthesizeOrbTier('tier1', 'tier2', 5);
    }
    const synthesizeTier3Btn = document.getElementById('synthesizeTier3Btn');
    if (synthesizeTier3Btn) {
        synthesizeTier3Btn.onclick = () => synthesizeOrbTier('tier2', 'tier3', 5);
    }
    const synthesizeTier4Btn = document.getElementById('synthesizeTier4Btn');
    if (synthesizeTier4Btn) {
        synthesizeTier4Btn.onclick = () => synthesizeOrbTier('tier3', 'tier4', 10);
    }
}
