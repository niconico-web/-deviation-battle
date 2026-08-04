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

        item.innerHTML =
            `<div class="quest-item-info">
                <strong>${weapon.name}</strong>
                <span>倍率: ${weapon.multiplier.toFixed(3)}x (${progress}%)</span>
                <span class="quest-progress">${bonusText || "補正なし"}</span>
                ${abilityText ? `<span class="quest-progress">★${abilityText}★</span>` : ''}
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

    // 基本武器を作成（補正なし）
    const baseWeapon = createOriginalWeapon(name.trim(), selectedType, {});
    
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
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        // script.jsの関数が利用可能になるのを待ってから初期化
        setTimeout(initShop, 100);
    });
} else {
    setTimeout(initShop, 100);
}
