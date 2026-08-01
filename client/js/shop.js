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

    for (const type of Object.keys(WEAPON_TYPES)) {
        const typeName = getWeaponTypeLabel(type);
        for (const tier of ["tier1", "tier2", "tier3"]) {
            const weapon = createWeapon(type, tier, false);
            const price = TIER_PRICES[tier];
            const owned = playerOwnsWeapon(player, weapon.id);

            const item = document.createElement("div");
            item.className = "shop-item" + (owned ? " owned" : "");
            item.innerHTML =
                `<div class="shop-item-info">
                    <strong>${weapon.name}</strong>
                    <span class="shop-item-type">${typeName} / ${tier.toUpperCase()}</span>
                </div>
                <div class="shop-item-action">
                    ${owned
                        ? '<span class="owned-label">所持済</span>'
                        : `<button class="btn btn-small buy-btn" data-type="${type}" data-tier="${tier}">${price}コイン</button>`
                    }
                </div>`;
            container.appendChild(item);
        }
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
        item.innerHTML =
            `<div class="inventory-item-info">
                <strong>${getWeaponDisplayName(weapon)}</strong>
                <span>${getWeaponTypeLabel(weapon.type)}</span>
            </div>
            <div class="inventory-item-action">
                ${isEquipped
                    ? '<span class="equipped-label">装備中</span>'
                    : `<button class="btn btn-small equip-btn" data-id="${weapon.id}">装備</button>`
                }
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
}

function renderUniqueQuests() {
    const container = document.getElementById("uniqueQuestList");
    if (!container) return;
    container.innerHTML = "";

    const player = getPlayerData();
    if (!player) return;

    fetch("/api/unique/claims")
        .then(r => r.json())
        .then(claims => {
            for (const type of Object.keys(WEAPON_TYPES)) {
                const wins = getWeaponWinCount(player, type);
                const claim = claims[type];
                const uniqueWeapon = createWeapon(type, null, true);
                const owned = playerOwnsWeapon(player, uniqueWeapon.id);
                const canClaim = canClaimUniqueQuest(player, type) && !owned && !claim;

                const item = document.createElement("div");
                item.className = "quest-item";
                let statusText = "";
                if (owned) {
                    statusText = "✓ 獲得済";
                } else if (claim) {
                    statusText = `✗ ${claim.playerName} が先に獲得`;
                } else {
                    statusText = `${wins} / ${UNIQUE_QUEST_WINS} 勝`;
                }

                item.innerHTML =
                    `<div class="quest-item-info">
                        <strong>${uniqueWeapon.name}</strong>
                        <span>${getWeaponTypeLabel(type)}のユニーク武器</span>
                        <span class="quest-progress">${statusText}</span>
                    </div>`;

                if (canClaim) {
                    const btn = document.createElement("button");
                    btn.className = "btn btn-small claim-btn";
                    btn.textContent = "ユニーク武器を受け取る";
                    btn.dataset.type = type;
                    btn.onclick = () => claimUniqueWeapon(type);
                    item.appendChild(btn);
                }

                container.appendChild(item);
            }
        })
        .catch(() => {
            container.innerHTML = "<p>ユニーククエスト情報の取得に失敗しました。</p>";
        });
}

function claimUniqueWeapon(type) {
    const player = getPlayerData();
    if (!player) return;

    const wins = getWeaponWinCount(player, type);
    if (wins < UNIQUE_QUEST_WINS) {
        alert(`まだクエスト未達成です（${wins}/${UNIQUE_QUEST_WINS}勝）`);
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

function initShop() {
    renderShop();
    renderInventory();
    renderUniqueQuests();

    const refreshBtn = document.getElementById("refreshShop");
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            renderShop();
            renderInventory();
            renderUniqueQuests();
        };
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShop);
} else {
    initShop();
}
