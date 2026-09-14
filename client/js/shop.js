function renderShop() {
    const container = document.getElementById("shopList");
    if (!container) return;
    container.innerHTML = "";

    const player = getPlayerData();
    if (!player) {
        container.innerHTML = "<p>キャラクターを作成してください。</p>";
        return;
    }

    document.getElementById("coinDisplay").textContent = (player.coins || 0);

    // 武器種類ごとにグループ化
    for (const type of Object.keys(WEAPON_TYPES)) {
        const typeName = getWeaponTypeLabel(type);
        
        // 武器種類ごとのセクションを作成
        const typeSection = document.createElement("div");
        typeSection.className = "weapon-type-section";
        
        const typeHeader = document.createElement("h3");
        typeHeader.className = "weapon-type-header";
        const typeIconHtml = (typeof getWeaponIconSVG === "function")
            ? `<span class="weapon-icon-wrap">${getWeaponIconSVG(type, 32)}</span>`
            : "";
        typeHeader.innerHTML = `${typeIconHtml}<span>${typeName}</span>`;
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
            const itemIconHtml = (typeof getWeaponIconSVG === "function")
                ? `<span class="weapon-icon-wrap weapon-icon-wrap-sm">${getWeaponIconSVG(type, 28)}</span>`
                : "";
            item.innerHTML =
                `<div class="shop-item-info">
                    ${itemIconHtml}
                    <div class="item-text-col">
                        <strong>${weapon.name}</strong>
                        <span class="shop-item-tier">${tier.toUpperCase()}</span>
                    </div>
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
        // ステータス上昇の無い武器種（サモンズロッド等）は購入可能なtier1〜3が
        // カタログに存在しないため、tierGridが空になる。見出しだけの空セクションを
        // 表示しないよう、中身が無ければセクションごとスキップする。
        if (tierGrid.children.length > 0) {
            container.appendChild(typeSection);
        }
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
        
        const itemIconHtml = (typeof getWeaponIconSVG === "function")
            ? `<span class="weapon-icon-wrap">${getWeaponIconSVG(weapon.type, 40)}</span>`
            : "";
        item.innerHTML =
            `<div class="inventory-item-info">
                ${itemIconHtml}
                <div class="item-text-col">
                    <strong>${getWeaponDisplayName(weapon)}</strong>
                    <span>${typeLabel}</span>
                    ${weaponDetails}
                </div>
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

        // オーブスロット数表示
        const currentOrbCount = (weapon.orbs || []).length;
        const maxOrbSlots = weapon.maxOrbSlots || MAX_WEAPON_ORBS;
        const orbSlotText = `<span class="quest-progress">オーブスロット: ${currentOrbCount}/${maxOrbSlots}</span>`;

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
                ${orbSlotText}
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

            const bulkUpgradeBtn = document.createElement("button");
            bulkUpgradeBtn.className = "btn btn-small";
            bulkUpgradeBtn.textContent = "一括強化";
            bulkUpgradeBtn.disabled = player.coins < upgradeCost;
            bulkUpgradeBtn.onclick = () => bulkUpgradeOriginalWeaponUI(weapon);
            actionContainer.appendChild(bulkUpgradeBtn);
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

        // オーブスロット追加ボタン（currentOrbCount/maxOrbSlotsは上でオーブスロット数表示用に定義済みのものを再利用）
        // 以前は「currentOrbCount < maxOrbSlots」の場合だけボタンを表示していたが、
        // 武器作成時に選べるオーブは最大3つ＝maxOrbSlotsの初期値も3つのため、
        // オーブを3つ選んで作った武器は常に currentOrbCount === maxOrbSlots となり、
        // ボタンが一度も表示されない不具合があった（スロットを拡張したくても
        // 拡張ボタンが出ない「鶏と卵」状態）。スロットが埋まっていてもチケットで
        // 拡張できるよう、絶対上限（5つ）未満かどうかだけを条件にする。
        const hasOrbSlotTicket = (player.dungeonItems || []).some(item => item.id === 'extra_orb_slot');
        
        if (weapon.isOriginal && maxOrbSlots < MAX_WEAPON_ORB_SLOTS_ABSOLUTE && hasOrbSlotTicket) {
            const addOrbSlotBtn = document.createElement("button");
            addOrbSlotBtn.className = "btn btn-small btn-info";
            addOrbSlotBtn.textContent = "オーブスロット拡張";
            addOrbSlotBtn.onclick = () => addOrbSlotToWeapon(weapon);
            actionContainer.appendChild(addOrbSlotBtn);
        }

        // 武器合成ボタン（ダンジョン報酬「武器合成チケット」使用。他のオリジナル武器が
        // 1つ以上必要なので、合成できる相手がいる場合のみボタンを表示する）
        const hasWeaponSynthesisTicket = (player.dungeonItems || []).some(item => item.id === 'weapon_synthesis_ticket');
        const otherOriginalWeaponsCount = (player.weapons || []).filter(w => w.isOriginal && w.id !== weapon.id).length;
        if (weapon.isOriginal && hasWeaponSynthesisTicket && otherOriginalWeaponsCount > 0) {
            const synthesizeWeaponBtn = document.createElement("button");
            synthesizeWeaponBtn.className = "btn btn-small btn-warning";
            synthesizeWeaponBtn.textContent = "武器合成";
            synthesizeWeaponBtn.onclick = () => openWeaponSynthesisDialog(weapon);
            actionContainer.appendChild(synthesizeWeaponBtn);
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

// renderMaterialsInventory() は materials.js 側で定義されている（通常素材とボス限界突破素材の両方に対応）。
// 以前はここにも同名の関数が重複定義されており、materials.js より後に読み込まれるこちらの定義で
// 上書きされてしまい、「素材インベントリ」に素材名・説明が表示されず素材IDがそのまま表示される
// 不具合の原因になっていた。

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

/**
 * 「一括強化」ボタン用：コインが続く限り、または上限倍率に達するまで
 * 強化を繰り返し実行する。1回ごとにコストは変わらない（ORIGINAL_WEAPON_UPGRADE_COST固定）ため、
 * 単純にループで消費・適用していく。
 */
function bulkUpgradeOriginalWeaponUI(weapon) {
    const player = getPlayerData();
    if (!player) return;

    const cost = getOriginalWeaponUpgradeCost(weapon);
    if (player.coins < cost) {
        alert(`コインが足りません（必要: ${cost}）`);
        return;
    }

    let remainingCoins = player.coins;
    let updatedWeapon = { ...weapon };
    const abilitiesBefore = (updatedWeapon.uniqueAbilities || []).length;
    let upgradeCount = 0;

    while (remainingCoins >= cost && canUpgradeOriginalWeapon(updatedWeapon)) {
        remainingCoins -= cost;
        updatedWeapon = upgradeOriginalWeapon(updatedWeapon);
        upgradeCount++;
    }

    if (upgradeCount === 0) {
        alert(`コインが足りません（必要: ${cost}）`);
        return;
    }

    const updatedPlayer = { ...player, coins: remainingCoins };
    updatedPlayer.weapons = updatedPlayer.weapons.map(w => w.id === weapon.id ? updatedWeapon : w);

    // 装備中の武器も更新
    if (updatedPlayer.equippedWeapon && updatedPlayer.equippedWeapon.id === weapon.id) {
        updatedPlayer.equippedWeapon = updatedWeapon;
    }

    localStorage.setItem("player", JSON.stringify(updatedPlayer));
    // ミッション進捗はまとめて1回、強化した回数分だけ加算する
    // （毎回呼ぶとlocalStorageから古いプレイヤー情報を読み直してしまい、
    //  ここで行った一括強化の結果が上書きされてしまうため）
    if (typeof updateMissionProgress === 'function') updateMissionProgress('upgrade_weapon', upgradeCount);

    let message = `${weapon.name} を一括強化しました！（${upgradeCount}回強化）\n倍率: ${updatedWeapon.multiplier.toFixed(3)}x`;

    if ((updatedWeapon.uniqueAbilities || []).length > abilitiesBefore) {
        const newAbility = updatedWeapon.uniqueAbilities[updatedWeapon.uniqueAbilities.length - 1];
        if (newAbility) {
            message += `\n\n★武器を極めし者よ…\n固有能力「${newAbility.name}」が解放されました！`;
        }
    }

    if (canUpgradeOriginalWeapon(updatedWeapon)) {
        message += `\n\n（コインが不足したため、上限まで強化することはできませんでした）`;
    } else {
        message += `\n\n上限倍率まで強化が完了しました！`;
    }

    alert(message);

    renderOriginalWeapons();
    updateStatus(updatedPlayer);
}

// オリジナル武器作成時に組み込めるオーブの最大数（help.htmlの説明と一致させる）
const MAX_WEAPON_ORBS = 3;
// オーブスロット拡張チケットで拡張できる、武器1つあたりのオーブスロット数の絶対上限
// （依頼により、初期3つ→チケット使用で最大5つまで拡張できるようにする）
const MAX_WEAPON_ORB_SLOTS_ABSOLUTE = 5;

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
                    // この素材1つを選んだ場合に付与されるステータスボーナスをプレビュー表示する
                    let bonusPreview = '';
                    if (typeof calculateWeaponMaterialBonus === 'function' && typeof formatStatBonusSummary === 'function') {
                        const previewBonus = calculateWeaponMaterialBonus([matId]);
                        const previewText = formatStatBonusSummary(previewBonus);
                        if (previewText) bonusPreview = ` [${previewText}]`;
                    }
                    const checkbox = document.createElement('div');
                    checkbox.className = 'material-checkbox';
                    checkbox.innerHTML = `<input type="checkbox" id="mat-${matId}" value="${matId}"> <label for="mat-${matId}">${material.name} (レア度${material.rarity} / x${materials[matId]})${bonusPreview}</label>`;
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

// 武器にオーブスロットを追加する関数
// （以前はinitShop()内のローカル関数として定義されていたため、initShop()の外にある
// renderOriginalWeapons()のボタンからは実際には呼び出せず「ReferenceError」になる
// 不具合があった。他の武器操作系関数（upgradeOriginalWeaponUI等）と同様に
// トップレベル関数として定義し直す）
function addOrbSlotToWeapon(weapon) {
    const player = getPlayerData();
    if (!player) return;

    // オーブ追加チケットの所持チェック
    const ticketIndex = (player.dungeonItems || []).findIndex(item => item.id === 'extra_orb_slot');
    if (ticketIndex === -1) {
        alert('オーブ追加チケットを持っていません。');
        return;
    }

    // オーブスロット上限チェック（依頼により絶対上限は5つ。埋まっているかどうかではなく
    // 上限に達しているかどうかで判定する）
    const maxOrbSlots = weapon.maxOrbSlots || MAX_WEAPON_ORBS;

    if (maxOrbSlots >= MAX_WEAPON_ORB_SLOTS_ABSOLUTE) {
        alert(`オーブスロットはこれ以上拡張できません（上限${MAX_WEAPON_ORB_SLOTS_ABSOLUTE}つ）。`);
        return;
    }

    // オーブ選択ダイアログを表示
    showOrbSelectionDialog(weapon, ticketIndex);
}

// オーブ選択ダイアログを表示
function showOrbSelectionDialog(weapon, ticketIndex) {
    const player = getPlayerData();
    if (!player) return;

    // ダイアログを作成
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.id = 'orbSelectionModal';
    dialog.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>オーブを選択</h2>
            <p>${weapon.name} に追加するオーブを選択してください。</p>
            <div id="orbSelectionContainer"></div>
            <button id="confirmOrbSelection" class="btn btn-primary">確定</button>
        </div>
    `;
    document.body.appendChild(dialog);

    // オーブ選択肢を生成
    const orbContainer = document.getElementById('orbSelectionContainer');
    const orbs = player.orbs || [];

    if (orbs.length === 0) {
        orbContainer.innerHTML = '<p>追加できるオーブがありません。</p>';
    } else {
        orbs.forEach((orb, index) => {
            const orbDiv = document.createElement('div');
            orbDiv.className = 'orb-selection-item';
            orbDiv.innerHTML = `
                <input type="radio" name="orbSelection" value="${index}" id="orb-${index}">
                <label for="orb-${index}">${getOrbDisplayName(orb)}</label>
            `;
            orbContainer.appendChild(orbDiv);
        });
    }

    // イベントリスナー
    dialog.querySelector('.close').onclick = () => {
        document.body.removeChild(dialog);
    };

    document.getElementById('confirmOrbSelection').onclick = () => {
        const selectedOrbRadio = document.querySelector('input[name="orbSelection"]:checked');
        if (!selectedOrbRadio) {
            alert('オーブを選択してください。');
            return;
        }

        const orbIndex = parseInt(selectedOrbRadio.value);
        const selectedOrb = orbs[orbIndex];

        if (!selectedOrb) {
            alert('オーブの取得に失敗しました。');
            return;
        }

        // 武器にオーブを追加
        const weaponIndex = player.weapons.findIndex(w => w.id === weapon.id);
        if (weaponIndex === -1) {
            alert('武器が見つかりません。');
            return;
        }

        // オーブを武器に追加
        const updatedWeapon = { ...player.weapons[weaponIndex] };
        updatedWeapon.orbs = updatedWeapon.orbs || [];
        updatedWeapon.orbs.push(selectedOrb.id);

        // 以前はオーブIDを記録するだけで、ステータスボーナス・倍率・tier4固有能力が
        // 一切反映されておらず「オーブが消費されるだけで何も起きない」不具合があった。
        // 武器作成時（applyOrbToWeapon）と同じ計算式で、既存の効果に追加分を上乗せする。
        updatedWeapon.statBonuses = mergeStatBonuses(
            updatedWeapon.statBonuses,
            { [selectedOrb.statType]: selectedOrb.bonus }
        );

        const tierMult = ORB_TIER_MULTIPLIER_FACTORS[selectedOrb.tier] || 1.0;
        updatedWeapon.multiplier = (updatedWeapon.multiplier || ORIGINAL_WEAPON_BASE_MULTIPLIER) * tierMult;
        // 強化（訓練）の上限倍率が、追加後の倍率より低いままだと以後強化できなくなるため、
        // 武器合成の時と同様に上限も引き上げておく
        const currentMaxMult = typeof getWeaponMaxMultiplier === 'function'
            ? getWeaponMaxMultiplier(player.weapons[weaponIndex])
            : updatedWeapon.multiplier;
        updatedWeapon.maxMultiplier = Math.max(currentMaxMult, updatedWeapon.multiplier);

        // Tier4オーブなら固有能力を付与する（既に同じ能力を持っていれば重複させない）
        if (selectedOrb.uniqueAbility) {
            const existingAbilities = updatedWeapon.uniqueAbilities || [];
            const alreadyHasAbility = existingAbilities.some(a => a.effect === selectedOrb.uniqueAbility.effect);
            updatedWeapon.uniqueAbilities = alreadyHasAbility
                ? existingAbilities
                : [...existingAbilities, selectedOrb.uniqueAbility];
        }

        // オーブスロット上限を増加（絶対上限5つを超えないようにする）
        updatedWeapon.maxOrbSlots = Math.min(
            MAX_WEAPON_ORB_SLOTS_ABSOLUTE,
            (updatedWeapon.maxOrbSlots || MAX_WEAPON_ORBS) + 1
        );

        // オーブをプレイヤーから削除
        const remainingOrbs = player.orbs.filter((o, i) => i !== orbIndex);

        // チケットを消費
        const remainingItems = player.dungeonItems.filter((item, i) => i !== ticketIndex);

        // 武器を更新
        player.weapons[weaponIndex] = updatedWeapon;
        player.orbs = remainingOrbs;
        player.dungeonItems = remainingItems;

        // 装備中の武器だった場合は、装備データ側も同じ内容に同期する
        if (player.equippedWeapon && player.equippedWeapon.id === weapon.id) {
            player.equippedWeapon = updatedWeapon;
        }

        localStorage.setItem("player", JSON.stringify(player));

        const abilityNote = selectedOrb.uniqueAbility ? `固有能力「${selectedOrb.uniqueAbility.name}」も引き継ぎました！` : '';
        alert(`${getOrbDisplayName(selectedOrb)} を ${weapon.name} に追加しました！オーブスロット上限が ${updatedWeapon.maxOrbSlots} になりました。${abilityNote}`);
        document.body.removeChild(dialog);
        renderOriginalWeapons();
        updateStatus(player);
    };

    dialog.style.display = 'flex';
}

// 武器合成チケットを使った合成後の倍率上限（依頼により20倍固定）
const WEAPON_SYNTHESIS_MAX_MULTIPLIER = 20;

// 武器合成ダイアログを表示（weaponが「ベース」、選択した方が「素材」として消費される）
function openWeaponSynthesisDialog(weapon) {
    const player = getPlayerData();
    if (!player) return;

    const ticketIndex = (player.dungeonItems || []).findIndex(item => item.id === 'weapon_synthesis_ticket');
    if (ticketIndex === -1) {
        alert('武器合成チケットを持っていません。');
        return;
    }

    const materialCandidates = (player.weapons || []).filter(w => w.isOriginal && w.id !== weapon.id);
    if (materialCandidates.length === 0) {
        alert('合成に使える他のオリジナル武器がありません。');
        return;
    }

    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.id = 'weaponSynthesisModal';
    dialog.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>武器合成</h2>
            <p>${weapon.name}（倍率${weapon.multiplier.toFixed(3)}x）に合成する武器を選んでください。</p>
            <p style="font-size:0.85em;color:#ccc;">選んだ武器は消滅し、倍率がベースの武器に加算されます（上限${WEAPON_SYNTHESIS_MAX_MULTIPLIER}倍）。tier4固有能力は両方の武器から引き継がれます。</p>
            <div id="weaponSynthesisSelectContainer"></div>
            <button id="confirmWeaponSynthesis" class="btn btn-primary">合成する</button>
        </div>
    `;
    document.body.appendChild(dialog);

    const selectContainer = document.getElementById('weaponSynthesisSelectContainer');
    materialCandidates.forEach((candidate, index) => {
        const abilityNames = (candidate.uniqueAbilities || []).map(a => a.name).join('、');
        const div = document.createElement('div');
        div.className = 'orb-selection-item';
        div.innerHTML = `
            <input type="radio" name="weaponSynthesisSelection" value="${index}" id="synth-weapon-${index}">
            <label for="synth-weapon-${index}">${candidate.name}（倍率${candidate.multiplier.toFixed(3)}x）${abilityNames ? `★${abilityNames}★` : ''}</label>
        `;
        selectContainer.appendChild(div);
    });

    dialog.querySelector('.close').onclick = () => {
        document.body.removeChild(dialog);
    };

    document.getElementById('confirmWeaponSynthesis').onclick = () => {
        const selectedRadio = document.querySelector('input[name="weaponSynthesisSelection"]:checked');
        if (!selectedRadio) {
            alert('合成する武器を選択してください。');
            return;
        }
        const materialWeapon = materialCandidates[parseInt(selectedRadio.value)];
        if (!materialWeapon) {
            alert('武器の取得に失敗しました。');
            return;
        }
        document.body.removeChild(dialog);
        synthesizeWeapons(weapon, materialWeapon);
    };

    dialog.style.display = 'flex';
}

// 武器合成の実処理：baseWeaponにmaterialWeaponを合成する
// ・倍率はお互いの倍率を単純加算し、上限20倍でキャップする
// ・tier4固有能力は両方の武器から引き継ぐ（同じ能力が重複する場合は1つにまとめる）
// ・素材武器と武器合成チケットは消費される
function synthesizeWeapons(baseWeapon, materialWeapon) {
    const player = getPlayerData();
    if (!player) return;

    const ticketIndex = (player.dungeonItems || []).findIndex(item => item.id === 'weapon_synthesis_ticket');
    if (ticketIndex === -1) {
        alert('武器合成チケットを持っていません。');
        return;
    }

    const baseIndex = player.weapons.findIndex(w => w.id === baseWeapon.id);
    const materialIndex = player.weapons.findIndex(w => w.id === materialWeapon.id);
    if (baseIndex === -1 || materialIndex === -1 || baseIndex === materialIndex) {
        alert('武器が見つかりません。');
        return;
    }

    const currentBase = player.weapons[baseIndex];
    const currentMaterial = player.weapons[materialIndex];

    // 倍率を加算（上限20倍）
    const combinedMultiplier = Math.min(
        WEAPON_SYNTHESIS_MAX_MULTIPLIER,
        (currentBase.multiplier || 0) + (currentMaterial.multiplier || 0)
    );

    // tier4固有能力を両方から引き継ぐ（effectが重複するものは1つにまとめる）
    const mergedAbilities = [...(currentBase.uniqueAbilities || []), ...(currentMaterial.uniqueAbilities || [])];
    const dedupedAbilities = [];
    const seenEffects = new Set();
    mergedAbilities.forEach(ability => {
        if (ability && ability.effect && !seenEffects.has(ability.effect)) {
            seenEffects.add(ability.effect);
            dedupedAbilities.push(ability);
        }
    });

    const updatedWeapon = { ...currentBase };
    updatedWeapon.multiplier = combinedMultiplier;
    // 合成後の倍率が既存の上限倍率（maxMultiplier）を超える場合、上限倍率も
    // 合成後の値まで引き上げておく（そうしないとcanUpgradeOriginalWeapon()が
    // 常にfalseを返し、進捗バーの計算もおかしくなってしまうため）
    const currentMaxMult = typeof getWeaponMaxMultiplier === 'function' ? getWeaponMaxMultiplier(currentBase) : combinedMultiplier;
    updatedWeapon.maxMultiplier = Math.max(currentMaxMult, combinedMultiplier);
    updatedWeapon.uniqueAbilities = dedupedAbilities;

    // 素材武器を削除（idで除外。装備中だった場合は解除する）
    const remainingWeapons = player.weapons.filter(w => w.id !== currentMaterial.id);
    const updatedRemainingWeapons = remainingWeapons.map(w => w.id === currentBase.id ? updatedWeapon : w);

    let equippedWeapon = player.equippedWeapon;
    if (equippedWeapon && equippedWeapon.id === currentMaterial.id) {
        equippedWeapon = null;
    } else if (equippedWeapon && equippedWeapon.id === currentBase.id) {
        equippedWeapon = updatedWeapon;
    }

    const remainingItems = player.dungeonItems.filter((item, i) => i !== ticketIndex);

    player.weapons = updatedRemainingWeapons;
    player.equippedWeapon = equippedWeapon;
    player.dungeonItems = remainingItems;

    localStorage.setItem("player", JSON.stringify(player));

    alert(`${currentBase.name} に ${currentMaterial.name} を合成しました！新しい倍率: ${combinedMultiplier.toFixed(3)}x`);
    renderOriginalWeapons();
    renderInventory();
    updateStatus(player);
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
            
            // 武器を作成（ボーナス素材を含む。素材によるステータスボーナスはcreateOriginalWeapon内で計算・付与される）
            let weapon = createOriginalWeapon(name, type, {}, ultimateName, selectedBonusMaterials);

            weapon = applyOrbToWeapon(weapon, selectedOrbs);
            
            // デュアルウェポン情報を追加
            if (secondaryType) {
                weapon.secondaryType = secondaryType;
            }
            
            const updatedPlayer = addWeaponToPlayer(playerAfterCost, weapon);
            
            localStorage.setItem("player", JSON.stringify(updatedPlayer));
            if (typeof updateMissionProgress === 'function') updateMissionProgress('create_weapon');
            
            let createMessage = `オリジナル武器「${weapon.name}」を作成しました！`;
            if (weapon.materialBonuses && typeof formatStatBonusSummary === 'function') {
                const materialBonusText = formatStatBonusSummary(weapon.materialBonuses);
                if (materialBonusText) {
                    createMessage += `\n\nボーナス素材の効果: ${materialBonusText}`;
                }
            }
            alert(createMessage);
            
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
