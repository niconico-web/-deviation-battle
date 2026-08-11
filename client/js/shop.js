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
                continue;
            }
            
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
                    const statLabel = { atk: "攻撃", def: "防御", speed: "速さ", maxHp: "HP" }[stat] || stat;
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
        const progress = ((weapon.multiplier - ORIGINAL_WEAPON_BASE_MULTIPLIER) / (ORIGINAL_WEAPON_MAX_MULTIPLIER - ORIGINAL_WEAPON_BASE_MULTIPLIER) * 100).toFixed(1);
        
        let bonusText = "";
        if (weapon.statBonuses) {
            const bonusParts = [];
            for (const [stat, bonus] of Object.entries(weapon.statBonuses)) {
                const statLabel = { atk: "攻撃", def: "防御", speed: "速さ", maxHp: "HP" }[stat] || stat;
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

        item.innerHTML =
            `<div class="quest-item-info">
                <strong>${weapon.name}</strong>
                <span>倍率: ${weapon.multiplier.toFixed(3)}x (${progress}%)</span>
                <span class="quest-progress">${bonusText || "補正なし"}</span>
                ${abilityText ? `<span class="quest-progress">★${abilityText}★</span>` : ''}
                ${secondaryTypeText}
                <span class="quest-progress">必殺技: ${ultimateName}</span>
            </div>`;

        // 必殺技名設定ボタン
        const setUltimateBtn = document.createElement("button");
        setUltimateBtn.className = "btn btn-small";
        setUltimateBtn.textContent = "必殺技名設定";
        setUltimateBtn.onclick = () => setOriginalWeaponUltimateNameUI(weapon);
        item.appendChild(setUltimateBtn);

        if (canUpgrade) {
            const upgradeBtn = document.createElement("button");
            upgradeBtn.className = "btn btn-small";
            upgradeBtn.textContent = `強化 (${upgradeCost}コイン)`;
            upgradeBtn.onclick = () => upgradeOriginalWeaponUI(weapon);
            item.appendChild(upgradeBtn);

            const upgradeWithMaterialBtn = document.createElement("button");
            upgradeWithMaterialBtn.className = "btn btn-small btn-info";
            upgradeWithMaterialBtn.textContent = "素材で強化";
            upgradeWithMaterialBtn.onclick = () => upgradeOriginalWeaponWithMaterialUI(weapon);
            item.appendChild(upgradeWithMaterialBtn);
        } else {
            const maxLabel = document.createElement("span");
            maxLabel.className = "owned-label";
            maxLabel.textContent = "MAX";
            item.appendChild(maxLabel);
        }

        container.appendChild(item);
    }
}

function renderOrbInventory() {
    const container = document.getElementById("orbInventory");
    if (!container) return;
    container.innerHTML = "";

    const player = getPlayerData();
    if (!player) return;

    const orbs = player.orbs || [];
    
    if (orbs.length === 0) {
        container.innerHTML = "<p>オーブを所持していません。\n勉強タイマーを25分以上使用するか、戦闘で勝利して入手してください。</p>";
        return;
    }

    for (const orb of orbs) {
        const item = document.createElement("div");
        item.className = `inventory-item orb-item ${orb.tier}`;
        
        const orbName = typeof getOrbDisplayName === "function" ? getOrbDisplayName(orb) : "不明なオーブ";
        
        let abilityInfo = "";
        if (orb.uniqueAbility) {
            abilityInfo = `<div class="orb-unique-ability">★${orb.uniqueAbility.name}★</div>`;
        }
        
        const orbIndex = orbs.indexOf(orb);
        
        item.innerHTML =
            `<div class="inventory-item-info">
                <strong>${orbName}</strong>
                ${abilityInfo}
            </div>
            <button class="btn btn-danger" onclick="discardOrb(${orbIndex})">捨てる</button>`;
        
        container.appendChild(item);
    }
}

function discardOrb(orbIndex) {
    const player = getPlayerData();
    if (!player) return;
    
    if (!player.orbs || orbIndex < 0 || orbIndex >= player.orbs.length) {
        alert("無効なオーブです");
        return;
    }
    
    const orb = player.orbs[orbIndex];
    const orbName = typeof getOrbDisplayName === "function" ? getOrbDisplayName(orb) : "不明なオーブ";
    
    if (confirm(`${orbName} を捨てますか？この操作は取り消せません。`)) {
        player.orbs.splice(orbIndex, 1);
        localStorage.setItem("player", JSON.stringify(player));
        renderOrbInventory();
        updateStatus(player);
        alert(`${orbName} を捨てました`);
    }
}

function upgradeOriginalWeaponUI(weapon) {
    const player = getPlayerData();
    if (!player) return;

    const cost = getOriginalWeaponUpgradeCost(weapon);
    if (player.coins < cost) {
        alert(`コインが足りません（必要: ${cost}、所持: ${player.coins}）`);
        return;
    }

    const upgraded = upgradeOriginalWeapon(weapon);
    const weaponIndex = player.weapons.findIndex(w => w.id === weapon.id);
    if (weaponIndex === -1) return;

    player.weapons[weaponIndex] = upgraded;
    player.coins -= cost;
    
    localStorage.setItem("player", JSON.stringify(player));
    alert(`${weapon.name} を強化しました！倍率: ${upgraded.multiplier.toFixed(3)}x`);
    renderOriginalWeapons();
    renderInventory();
    updateStatus(player);
}

function upgradeOriginalWeaponWithMaterialUI(weapon) {
    const player = getPlayerData();
    if (!player) return;

    const materialWeapons = (player.weapons || []).filter(w => {
        // 強化対象の武器、装備中の武器、オリジナル武器は素材にできない
        if (w.id === weapon.id) return false;
        if (player.equippedWeapon && player.equippedWeapon.id === w.id) return false;
        if (w.isOriginal) return false;
        return true;
    });

    if (materialWeapons.length === 0) {
        alert("強化に使用できる素材武器がありません。\n装備中やオリジナル武器でない、不要な武器を素材として使用できます。");
        return;
    }

    let promptText = "強化の素材にする武器を選択してください:\n";
    const weaponOptions = materialWeapons.map((w, index) => {
        return `${index + 1}: ${getWeaponDisplayName(w)}`;
    });
    promptText += weaponOptions.join("\n");

    const choice = prompt(promptText);
    if (choice === null) return; // キャンセル

    const choiceIndex = parseInt(choice) - 1;
    if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= materialWeapons.length) {
        alert("無効な選択です。");
        return;
    }

    const materialWeapon = materialWeapons[choiceIndex];

    if (!confirm(`${getWeaponDisplayName(materialWeapon)} を素材にして ${weapon.name} を強化しますか？\n（${getWeaponDisplayName(materialWeapon)} は失われます）`)) {
        return;
    }

    // 武器を強化
    const upgraded = upgradeOriginalWeapon(weapon);
    const weaponIndex = player.weapons.findIndex(w => w.id === weapon.id);
    if (weaponIndex === -1) return;

    player.weapons[weaponIndex] = upgraded;

    // 素材武器を削除
    const updatedPlayer = removeWeaponFromPlayer(player, materialWeapon.id);

    localStorage.setItem("player", JSON.stringify(updatedPlayer));
    alert(`${weapon.name} を強化しました！倍率: ${upgraded.multiplier.toFixed(3)}x`);
    renderOriginalWeapons();
    renderInventory();
    updateStatus(updatedPlayer);
}

function showOriginalWeaponCreationDialog() {
    const player = getPlayerData();
    if (!player) return;

    if (player.coins < ORIGINAL_WEAPON_COST) {
        alert(`コインが足りません（必要: ${ORIGINAL_WEAPON_COST}、所持: ${player.coins}）`);
        return;
    }

    // オーブ所持チェック
    if (!player.orbs || player.orbs.length === 0) {
        alert("オリジナル武器を作成するにはオーブが必要です！\n勉強タイマーを25分以上使用するか、戦闘で勝利してオーブを入手してください。");
        return;
    }

    const name = prompt("オリジナル武器の名前を入力してください:");
    if (!name || name.trim() === "") return;

    // 名前のバリデーション
    const validation = validateName(name.trim());
    if (!validation.valid) {
        alert(validation.reason);
        return;
    }

    // 必殺技名の入力
    const ultimateName = prompt("必殺技の名前を入力してください（オプション）:");
    let validatedUltimateName = null;
    if (ultimateName && ultimateName.trim() !== "") {
        const ultimateValidation = validateName(ultimateName.trim());
        if (!ultimateValidation.valid) {
            alert("必殺技名: " + ultimateValidation.reason);
            return;
        }
        validatedUltimateName = ultimateName.trim();
    }

    // 武器種選択
    const weaponTypes = Object.keys(WEAPON_TYPES);
    let typeOptions = weaponTypes.map((type, index) => `${index + 1}. ${getWeaponTypeLabel(type)}`).join('\n');
    const typeInput = prompt(`武器種を選択してください:\n${typeOptions}\n番号を入力:`, "1");
    
    if (typeInput === null) return;
    const typeIndex = parseInt(typeInput) - 1;
    if (isNaN(typeIndex) || typeIndex < 0 || typeIndex >= weaponTypes.length) {
        alert("無効な番号です");
        return;
    }
    
    const selectedType = weaponTypes[typeIndex];

    // オーブ選択（1~3個）
    const availableOrbs = player.orbs;
    let orbOptions = availableOrbs.map((orb, index) => {
        const orbName = typeof getOrbDisplayName === "function" ? getOrbDisplayName(orb) : `Orb ${index + 1}`;
        return `${index + 1}. ${orbName}`;
    }).join('\n');
    
    const selectedOrbIndices = [];
    const maxOrbs = Math.min(3, availableOrbs.length);
    
    for (let i = 0; i < maxOrbs; i++) {
        const remainingOptions = availableOrbs
            .map((orb, index) => {
                if (selectedOrbIndices.includes(index)) return null;
                const orbName = typeof getOrbDisplayName === "function" ? getOrbDisplayName(orb) : `Orb ${index + 1}`;
                return `${index + 1}. ${orbName}`;
            })
            .filter(opt => opt !== null)
            .join('\n');
        
        const promptText = i === 0 
            ? `使用するオーブを選択してください（1~${maxOrbs}個）:\n${remainingOptions}\n番号を入力（キャンセルで終了）:`
            : `追加のオーブを選択してください（残り${maxOrbs - i}個まで）:\n${remainingOptions}\n番号を入力（キャンセルで終了）:`;
        
        const orbInput = prompt(promptText, "1");
        if (orbInput === null) break;
        
        const orbIndex = parseInt(orbInput) - 1;
        if (isNaN(orbIndex) || orbIndex < 0 || orbIndex >= availableOrbs.length || selectedOrbIndices.includes(orbIndex)) {
            alert("無効な番号です");
            i--;
            continue;
        }
        
        selectedOrbIndices.push(orbIndex);
    }

    if (selectedOrbIndices.length === 0) {
        alert("オーブを少なくとも1つ選択してください");
        return;
    }

    const selectedOrbs = selectedOrbIndices.map(index => availableOrbs[index]);

    // デュアルウェポン能力のチェック
    const hasDualWeapon = selectedOrbs.some(orb => orb.uniqueAbility && orb.uniqueAbility.effect === 'dual_weapon');
    let secondaryType = null;
    
    if (hasDualWeapon) {
        const secondaryTypeOptions = weaponTypes.map((type, index) => `${index + 1}. ${getWeaponTypeLabel(type)}`).join('\n');
        const secondaryTypeInput = prompt(`デュアルウェポン能力発動！二個目の武器種を選択してください:\n${secondaryTypeOptions}\n番号を入力（キャンセルでスキップ）:`, "1");
        
        if (secondaryTypeInput !== null) {
            const secondaryTypeIndex = parseInt(secondaryTypeInput) - 1;
            if (!isNaN(secondaryTypeIndex) && secondaryTypeIndex >= 0 && secondaryTypeIndex < weaponTypes.length) {
                secondaryType = weaponTypes[secondaryTypeIndex];
            }
        }
    }

    // 基本武器を作成（補正なし）
    const baseWeapon = createOriginalWeapon(name.trim(), selectedType, {}, validatedUltimateName);
    
    // 二個目の武器種を設定
    if (secondaryType) {
        baseWeapon.secondaryType = secondaryType;
    }
    
    // オーブを適用
    const weapon = applyOrbToWeapon(baseWeapon, selectedOrbs);
    
    // 使用したオーブを削除
    const remainingOrbs = player.orbs.filter((_, index) => !selectedOrbIndices.includes(index));
    
    const updated = addWeaponToPlayer({ ...player, coins: player.coins - ORIGINAL_WEAPON_COST, orbs: remainingOrbs }, weapon);
    
    localStorage.setItem("player", JSON.stringify(updated));
    
    let orbInfo = selectedOrbs.map(orb => typeof getOrbDisplayName === "function" ? getOrbDisplayName(orb) : "Orb").join(", ");
    alert(`オリジナル武器「${weapon.name}」を作成しました！\n使用オーブ: ${orbInfo}\n倍率: ${weapon.multiplier.toFixed(3)}x`);
    
    renderOriginalWeapons();
    renderInventory();
    renderOrbInventory(); // オーブインベントリを更新
    updateStatus(updated);
}

function showBuyWeaponDialog(type, tier) {
    const player = getPlayerData();
    if (!player) return;

    const baseWeapon = createWeapon(type, tier, false);
    if (!baseWeapon) return;

    const price = TIER_PRICES[tier];

    const choice = prompt(
        `${baseWeapon.name} (${price}コイン) の購入方法を選択してください:\n\n` +
        "1. そのまま購入する\n" +
        "2. オーブを付与してオリジナル武器として購入する\n\n" +
        "番号を入力してください:", "1"
    );

    if (choice === "1") {
        const result = buyWeapon(player, type, tier);
        if (!result.ok) {
            alert(result.message);
            return;
        }
        localStorage.setItem("player", JSON.stringify(result.player));
        alert(`${result.weapon.name} を購入しました！`);
        renderShop();
        renderInventory();
        updateStatus(result.player);
    } else if (choice === "2") {
        if (!player.orbs || player.orbs.length === 0) {
            alert("オーブを所持していません。オーブを付与するには、まずオーブを入手してください。");
            return;
        }

        // オーブ選択ロジック
        const availableOrbs = player.orbs;
        const selectedOrbIndices = [];
        const maxOrbs = Math.min(3, availableOrbs.length);

        for (let i = 0; i < maxOrbs; i++) {
            const remainingOptions = availableOrbs
                .map((orb, index) => {
                    if (selectedOrbIndices.includes(index)) return null;
                    const orbName = typeof getOrbDisplayName === "function" ? getOrbDisplayName(orb) : `Orb ${index + 1}`;
                    return `${index + 1}. ${orbName}`;
                })
                .filter(opt => opt !== null)
                .join('\n');
            
            if (remainingOptions.length === 0 && i > 0) {
                alert("選択できるオーブがもうありません。");
                break;
            }

            const promptText = i === 0 
                ? `使用するオーブを選択してください（1〜${maxOrbs}個）:\n${remainingOptions}\n番号を入力（キャンセルまたは空欄で終了）:`
                : `追加のオーブを選択してください（残り${maxOrbs - i}個まで）:\n${remainingOptions}\n番号を入力（キャンセルまたは空欄で終了）:`;

            const orbInput = prompt(promptText);
            if (orbInput === null || orbInput.trim() === "") break;

            const orbIndex = parseInt(orbInput) - 1;
            if (isNaN(orbIndex) || orbIndex < 0 || orbIndex >= availableOrbs.length || selectedOrbIndices.includes(orbIndex)) {
                alert("無効な番号です。");
                i--;
                continue;
            }
            selectedOrbIndices.push(orbIndex);
        }

        if (selectedOrbIndices.length === 0) {
            if (confirm("オーブを選択しませんでした。通常通り購入しますか？")) {
                const result = buyWeapon(player, type, tier);
                if (!result.ok) {
                    alert(result.message);
                    return;
                }
                localStorage.setItem("player", JSON.stringify(result.player));
                alert(`${result.weapon.name} を購入しました！`);
                renderShop();
                renderInventory();
                updateStatus(result.player);
            }
            return;
        }

        const selectedOrbs = selectedOrbIndices.map(index => availableOrbs[index]);
        buyWeaponWithOrbs(player, type, tier, selectedOrbs, selectedOrbIndices);
    }
}

function buyWeaponWithOrbs(player, type, tier, selectedOrbs, selectedOrbIndices) {
    const price = TIER_PRICES[tier];
    if (!price) return;

    const coins = player.coins || 0;
    if (coins < price) {
        alert(`コインが足りません（必要: ${price}、所持: ${coins}）`);
        return;
    }

    const baseWeaponInfo = WEAPON_CATALOG[type][tier];
    const customName = `(改) ${baseWeaponInfo.name}`;

    // 基本武器を作成（補正なし）
    const tempOriginal = createOriginalWeapon(customName, type, {}, baseWeaponInfo.ultimate);
    
    // オーブを適用
    const finalWeapon = applyOrbToWeapon(tempOriginal, selectedOrbs);

    // 使用したオーブを削除
    const remainingOrbs = player.orbs.filter((_, index) => !selectedOrbIndices.includes(index));
    
    const updatedPlayer = addWeaponToPlayer({ ...player, coins: player.coins - price, orbs: remainingOrbs }, finalWeapon);
    
    localStorage.setItem("player", JSON.stringify(updatedPlayer));
    
    let orbInfo = selectedOrbs.map(orb => (typeof getOrbDisplayName === "function" ? getOrbDisplayName(orb) : "Orb")).join(", ");
    alert(
        `オリジナル武器「${finalWeapon.name}」を作成しました！\n` +
        `使用オーブ: ${orbInfo}\n` +
        `倍率: ${finalWeapon.multiplier.toFixed(3)}x\n` +
        `価格: ${price}コイン`
    );
    
    renderShop();
    renderOriginalWeapons();
    renderInventory();
    renderOrbInventory();
    updateStatus(updatedPlayer);
}

function claimUniqueWeapon(type) {
    const player = getPlayerData();
    if (!player) return;

    const requiredWins = UNIQUE_QUEST_WINS;
    const wins = getWeaponWinCount(player, type);
    
    console.log(`[Shop] claimUniqueWeapon: type=${type}, wins=${wins}, requiredWins=${requiredWins}`);
    
    if (wins < requiredWins) {
        alert(`まだクエスト未達成です（${wins}/${requiredWins}勝）`);
        return;
    }

    fetch("/api/unique/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            type,
            playerId: player.id,
            playerName: player.name,
            wins
        })
    })
        .then(r => r.json())
        .then(data => {
            if (!data.success) {
                if (data.claimedBy) {
                    alert(`${data.claimedBy.playerName} が先にユニーク武器を獲得しました。`);
                } else {
                    alert(data.message || "獲得に失敗しました。");
                }
                renderUniqueQuests();
                return;
            }
            const weapon = createWeapon(type, null, true);
            const updated = addWeaponToPlayer(player, weapon);
            localStorage.setItem("player", JSON.stringify(updated));
            alert(`おめでとうございます！${weapon.name} を獲得しました！`);
            renderUniqueQuests();
            renderInventory();
            updateStatus(updated);
        })
        .catch(() => alert("サーバーとの通信に失敗しました。"));
}

function setOriginalWeaponUltimateNameUI(weapon) {
    const player = getPlayerData();
    if (!player) return;

    const currentUltimateName = weapon.ultimateName || "未設定";
    const newUltimateName = prompt(`必殺技名を入力してください:\n現在: ${currentUltimateName}`, currentUltimateName === "未設定" ? "" : currentUltimateName);
    
    if (newUltimateName === null) return; // キャンセル
    
    const trimmedName = newUltimateName.trim();
    
    // 空文字の場合は未設定に戻す
    if (trimmedName === "") {
        const weaponIndex = player.weapons.findIndex(w => w.id === weapon.id);
        if (weaponIndex !== -1) {
            player.weapons[weaponIndex].ultimateName = null;
            localStorage.setItem("player", JSON.stringify(player));
            alert("必殺技名を未設定にしました");
            renderOriginalWeapons();
        }
        return;
    }

    // バリデーション
    const validation = validateName(trimmedName);
    if (!validation.valid) {
        alert("必殺技名: " + validation.reason);
        return;
    }

    // 武器を更新
    const weaponIndex = player.weapons.findIndex(w => w.id === weapon.id);
    if (weaponIndex !== -1) {
        player.weapons[weaponIndex].ultimateName = trimmedName;
        
        // 装備中の武器も更新
        if (player.equippedWeapon && player.equippedWeapon.id === weapon.id) {
            player.equippedWeapon.ultimateName = trimmedName;
        }
        
        localStorage.setItem("player", JSON.stringify(player));
        alert(`必殺技名を「${trimmedName}」に設定しました`);
        renderOriginalWeapons();
    }
}

function claimDebugWeapon(type) {
    const player = getPlayerData();
    if (!player) return;

    const wins = getWeaponWinCount(player, type);

    if (wins < 1) {
        alert(`1勝が必要です（現在: ${wins}勝）`);
        return;
    }

    fetch("/api/unique/claimDebug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            type,
            playerId: player.id,
            playerName: player.name,
            wins
        })
    })
        .then(r => r.json())
        .then(data => {
            if (!data.success) {
                if (data.claimedBy) {
                    alert(`${data.claimedBy.playerName} が先にデバッガーランスを獲得しました。`);
                } else {
                    alert(data.message || "獲得に失敗しました。");
                }
                renderUniqueQuests();
                return;
            }
            const weapon = createWeapon(type, "debug", false);
            const updated = addWeaponToPlayer(player, weapon);
            localStorage.setItem("player", JSON.stringify(updated));
            alert(`おめでとうございます！${weapon.name} を獲得しました！`);
            renderUniqueQuests();
            renderInventory();
            updateStatus(updated);
        })
        .catch(() => alert("サーバーとの通信に失敗しました。"));
}

function initShop() {
    renderShop();
    renderInventory();
    renderOriginalWeapons();
    renderOrbInventory();

    const refreshBtn = document.getElementById("refreshShop");
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            renderShop();
            renderInventory();
            renderOriginalWeapons();
        };
    }

    // オリジナル武器作成ボタン
    const createBtn = document.getElementById("createOriginalWeaponBtn");
    if (createBtn) {
        createBtn.onclick = showOriginalWeaponCreationDialog;
    }
    
    // オーブ合成モーダルのイベントリスナー
    const openModalBtn = document.getElementById("openOrbSynthesisBtn");
    const closeModalBtn = document.getElementById("closeOrbSynthesisBtn");
    const modal = document.getElementById("orbSynthesisModal");

    if (openModalBtn && modal) {
        openModalBtn.addEventListener('click', openOrbSynthesisModal);
    }
    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    }
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    document.getElementById('synthesizeTier2Btn').addEventListener('click', () => synthesizeOrb('tier2'));
    document.getElementById('synthesizeTier3Btn').addEventListener('click', () => synthesizeOrb('tier3'));
    document.getElementById('synthesizeTier4Btn').addEventListener('click', () => synthesizeOrb('tier4'));
}

function openOrbSynthesisModal() {
    const modal = document.getElementById("orbSynthesisModal");
    if (!modal) return;

    const player = getPlayerData();
    if (!player) return;

    const orbs = player.orbs || [];
    const tier1Count = orbs.filter(o => o.tier === 'tier1').length;
    const tier2Count = orbs.filter(o => o.tier === 'tier2').length;
    const tier3Count = orbs.filter(o => o.tier === 'tier3').length;

    document.getElementById('tier1OrbCount').textContent = tier1Count;
    document.getElementById('tier2OrbCount').textContent = tier2Count;
    document.getElementById('tier3OrbCount').textContent = tier3Count;

    document.getElementById('synthesizeTier2Btn').disabled = tier1Count < 5;
    document.getElementById('synthesizeTier3Btn').disabled = tier2Count < 5;
    document.getElementById('synthesizeTier4Btn').disabled = tier3Count < 10;

    modal.style.display = 'flex';
}

function synthesizeOrb(targetTier) {
    const player = getPlayerData();
    if (!player) return;

    let requiredTier, requiredCount, newOrbTier;
    switch (targetTier) {
        case 'tier2':
            requiredTier = 'tier1';
            requiredCount = 5;
            newOrbTier = 'tier2';
            break;
        case 'tier3':
            requiredTier = 'tier2';
            requiredCount = 5;
            newOrbTier = 'tier3';
            break;
        case 'tier4':
            requiredTier = 'tier3';
            requiredCount = 10;
            newOrbTier = 'tier4';
            break;
        default:
            alert("無効な合成です。");
            return;
    }

    const materialOrbs = (player.orbs || []).filter(o => o.tier === requiredTier);
    if (materialOrbs.length < requiredCount) {
        alert(`${ORB_TIERS[requiredTier].name}オーブが足りません。`);
        return;
    }

    if (!confirm(`${ORB_TIERS[requiredTier].name}オーブを${requiredCount}個使用して、${ORB_TIERS[newOrbTier].name}オーブを1つ合成しますか？`)) {
        return;
    }
    
    // 素材オーブを消費
    let countToRemove = requiredCount;
    const remainingOrbs = (player.orbs || []).filter(orb => {
        if (orb.tier === requiredTier && countToRemove > 0) {
            countToRemove--;
            return false;
        }
        return true;
    });

    // 新しいオーブを生成
    const newOrb = createOrb(newOrbTier);
    if (!newOrb) {
        alert("オーブの生成に失敗しました。");
        return;
    }

    remainingOrbs.push(newOrb);
    player.orbs = remainingOrbs;

    localStorage.setItem("player", JSON.stringify(player));
    
    alert(`${getOrbDisplayName(newOrb)} を合成しました！`);

    // UIを更新
    renderOrbInventory();
    openOrbSynthesisModal(); // モーダル内の表示を更新
    updateStatus(player);
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        // script.jsの関数が利用可能になるのを待ってから初期化
        setTimeout(initShop, 100);
    });
} else {
    setTimeout(initShop, 100);
}
