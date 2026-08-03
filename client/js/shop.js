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
            const p = getPlayerData();
            const result = buyWeapon(p, btn.dataset.type, btn.dataset.tier);
            if (!result.ok) {
                alert(result.message);
                return;
            }
            localStorage.setItem("player", JSON.stringify(result.player));
            alert(`${result.weapon.name} を購入しました！`);
            renderShop();
            renderInventory();
            updateStatus(result.player);
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
        
        item.innerHTML =
            `<div class="inventory-item-info">
                <strong>${getWeaponDisplayName(weapon)}</strong>
                <span>${typeLabel}</span>
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

        item.innerHTML =
            `<div class="quest-item-info">
                <strong>${weapon.name}</strong>
                <span>倍率: ${weapon.multiplier.toFixed(3)}x (${progress}%)</span>
                <span class="quest-progress">${bonusText || "補正なし"}</span>
            </div>`;

        if (canUpgrade) {
            const upgradeBtn = document.createElement("button");
            upgradeBtn.className = "btn btn-small";
            upgradeBtn.textContent = `強化 (${upgradeCost}コイン)`;
            upgradeBtn.onclick = () => upgradeOriginalWeaponUI(weapon);
            item.appendChild(upgradeBtn);
        } else {
            const maxLabel = document.createElement("span");
            maxLabel.className = "owned-label";
            maxLabel.textContent = "MAX";
            item.appendChild(maxLabel);
        }

        container.appendChild(item);
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

function showOriginalWeaponCreationDialog() {
    const player = getPlayerData();
    if (!player) return;

    if (player.coins < ORIGINAL_WEAPON_COST) {
        alert(`コインが足りません（必要: ${ORIGINAL_WEAPON_COST}、所持: ${player.coins}）`);
        return;
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

    // ステータス補正設定
    const statBonuses = {};
    let totalBonus = 0;

    const stats = [
        { key: 'atk', label: '攻撃' },
        { key: 'def', label: '防御' },
        { key: 'speed', label: '速さ' },
        { key: 'maxHp', label: 'HP' }
    ];

    for (const stat of stats) {
        const input = prompt(`${stat.label}の補正を入力してください（例: +0.1, -0.05, 0）\nプラスで強化、マイナスで弱体化、0で変更なし:`, "0");
        if (input !== null) {
            const value = parseFloat(input);
            if (!isNaN(value)) {
                statBonuses[stat.key] = value;
                totalBonus += value;
            }
        }
    }

    if (totalBonus > 0.5) {
        alert(`補正の合計が大きすぎます（${totalBonus.toFixed(2)}）。合計で0.5以下にしてください。`);
        return;
    }

    const weapon = createOriginalWeapon(selectedType, statBonuses);
    const updated = addWeaponToPlayer({ ...player, coins: player.coins - ORIGINAL_WEAPON_COST }, weapon);
    
    localStorage.setItem("player", JSON.stringify(updated));
    alert(`オリジナル武器「${weapon.name}」を作成しました！`);
    renderOriginalWeapons();
    renderInventory();
    updateStatus(updated);
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
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShop);
} else {
    initShop();
}
