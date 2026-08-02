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

    console.log(`[Shop] renderUniqueQuests: player.weaponWins=${JSON.stringify(player.weaponWins)}`);

    fetch("/api/unique/claims")
        .then(r => r.json())
        .then(claims => {
            for (const type of Object.keys(WEAPON_TYPES)) {
                const typeConf = WEAPON_TYPES[type];
                const wins = getWeaponWinCount(player, type);
                const claim = claims[type];
                
                // 通常のユニーク武器
                const uniqueWeapon = createWeapon(type, null, true);
                
                console.log(`[Shop] Quest for ${type}: wins=${wins}, typeConf=${JSON.stringify(typeConf)}, claim=${claim}`);
                
                // 武器が作成できない場合はスキップ
                if (!uniqueWeapon) {
                    console.log(`[Shop] Skipping ${type} - weapon creation failed`);
                    continue;
                }
                
                const owned = playerOwnsWeapon(player, uniqueWeapon.id);
                const canClaim = canClaimUniqueQuest(player, type) && !owned && !claim;
                
                // クエストが完了している場合、または誰かが既に武器を持っている場合は表示しない
                if (claim && (claim.completed || claim.claimedAt)) {
                    console.log(`[Shop] ${type}: Quest completed by ${claim.playerName}, skipping display`);
                    continue;
                }
                
                console.log(`[Shop] ${type}: owned=${owned}, canClaim=${canClaim}`);

                const item = document.createElement("div");
                item.className = "quest-item";
                let statusText = "";
                if (owned) {
                    statusText = "✓ 獲得済";
                } else if (claim) {
                    statusText = `✗ ${claim.playerName} が先に獲得`;
                } else {
                    const requiredWins = UNIQUE_QUEST_WINS;
                    statusText = `${wins} / ${requiredWins} 勝`;
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
                
                // デバッグ武器がある場合は別枠で表示（槍のみ）
                if (type === "spear") {
                    const debugWeapon = createWeapon(type, "debug", false);
                    if (debugWeapon) {
                        const debugOwned = playerOwnsWeapon(player, debugWeapon.id);
                        const debugCanClaim = canClaimDebugWeapon(player, type) && !debugOwned;
                        
                        const debugItem = document.createElement("div");
                        debugItem.className = "quest-item debug-item";
                        let debugStatusText = "";
                        if (debugOwned) {
                            debugStatusText = "✓ 獲得済";
                        } else {
                            debugStatusText = `${wins} / 1 勝`;
                        }

                        debugItem.innerHTML =
                            `<div class="quest-item-info">
                                <strong>${debugWeapon.name} [DEBUG]</strong>
                                <span>${getWeaponTypeLabel(type)}のデバッグ武器</span>
                                <span class="quest-progress">${debugStatusText}</span>
                            </div>`;

                        if (debugCanClaim) {
                            const debugBtn = document.createElement("button");
                            debugBtn.className = "btn btn-small claim-btn";
                            debugBtn.textContent = "デバッグ武器を受け取る";
                            debugBtn.dataset.type = type;
                            debugBtn.dataset.isDebug = "true";
                            debugBtn.onclick = () => claimDebugWeapon(type);
                            debugItem.appendChild(debugBtn);
                        }

                        container.appendChild(debugItem);
                    }
                }
            }
        })
        .catch(() => {
            container.innerHTML = "<p>ユニーククエスト情報の取得に失敗しました。</p>";
        });
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

    const weapon = createWeapon(type, "debug", false);
    if (!weapon) {
        alert("武器の作成に失敗しました");
        return;
    }

    if (playerOwnsWeapon(player, weapon.id)) {
        alert("既に所持しています");
        return;
    }

    // デバッグ武器はサーバー認証なしで直接付与
    const updated = addWeaponToPlayer(player, weapon);
    localStorage.setItem("player", JSON.stringify(updated));
    alert(`${weapon.name} を獲得しました！`);
    renderUniqueQuests();
    renderInventory();
    updateStatus(updated);
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
    
    // ユニーク武器獲得通知を受信
    if (window.socket) {
        window.socket.on("uniqueWeaponClaimed", (data) => {
            const message = `${data.weaponName}が${data.playerName}によって入手されました！`;
            alert(message);
            // ショップページにいる場合のみUIを更新
            if (document.getElementById("uniqueQuestList")) {
                renderUniqueQuests();
            }
        });
        
        // ユニーククエスト完了通知を受信
        window.socket.on("uniqueQuestCompleted", (data) => {
            const message = `${data.weaponName}のクエストが${data.playerName}によって完了されました！世界にこの武器は1つしかありません。`;
            alert(message);
            // ショップページにいる場合のみUIを更新
            if (document.getElementById("uniqueQuestList")) {
                renderUniqueQuests();
            }
        });
    }
    
    // 定期的にクエスト状態を更新（他のプレイヤーが獲得した場合に対応）
    setInterval(() => {
        if (document.getElementById("uniqueQuestList")) {
            renderUniqueQuests();
        }
    }, 30000); // 30秒ごとに更新
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShop);
} else {
    initShop();
}
