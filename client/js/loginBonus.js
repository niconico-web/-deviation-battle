// client/js/loginBonus.js
// 連続ログインボーナス。ログインするたびに（1日1回）報酬がもらえ、
// 連続でログインするほど報酬が豪華になっていく（7日サイクル、8日目以降はDay1からループ）。

const LOGIN_BONUS_REWARDS = [
    { day: 1, coins: 50, xp: 0, label: "ログインボーナス" },
    { day: 2, coins: 100, xp: 50, label: "ログインボーナス" },
    { day: 3, coins: 150, xp: 100, label: "ログインボーナス" },
    { day: 4, coins: 200, xp: 150, materialId: "iron_ore", materialCount: 2, label: "ログインボーナス" },
    { day: 5, coins: 300, xp: 200, label: "ログインボーナス" },
    { day: 6, coins: 400, xp: 300, materialId: "silver_ore", materialCount: 2, label: "ログインボーナス" },
    { day: 7, coins: 600, xp: 500, orbTier: "tier2", label: "7日連続ログイン達成！豪華ボーナス" },
];

/**
 * 昨日の日付文字列（'YYYY-MM-DD'）を取得する。
 */
function getYesterdayDateString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * ログイン状況を確認し、まだ今日のボーナスを受け取っていなければ付与してモーダルを表示する。
 * ページ読み込み時に一度呼び出す。
 */
function checkAndGrantLoginBonus() {
    const player = getPlayerData();
    if (!player) return;

    const today = typeof getTodayDateString === "function" ? getTodayDateString() : null;
    if (!today) return;

    if (player.lastLoginDate === today) {
        // 本日分は受け取り済み
        return;
    }

    // 連続ログイン日数を計算：前回ログインが「昨日」なら連続、そうでなければ1日目にリセット
    const yesterday = getYesterdayDateString();
    const newStreak = (player.lastLoginDate === yesterday) ? (player.loginStreak || 0) + 1 : 1;
    const cycleIndex = (newStreak - 1) % LOGIN_BONUS_REWARDS.length;
    const reward = LOGIN_BONUS_REWARDS[cycleIndex];

    const grantedList = [];

    player.coins = (player.coins || 0) + reward.coins;
    grantedList.push(`コイン +${reward.coins}`);

    if (reward.xp > 0) {
        player.xp = (player.xp || 0) + reward.xp;
        grantedList.push(`XP +${reward.xp}`);
    }

    if (reward.materialId) {
        player.materials = player.materials || {};
        player.materials[reward.materialId] = (player.materials[reward.materialId] || 0) + (reward.materialCount || 1);
        const materialName = (typeof MATERIAL_DATA !== "undefined" && MATERIAL_DATA[reward.materialId])
            ? MATERIAL_DATA[reward.materialId].name
            : reward.materialId;
        grantedList.push(`${materialName} ×${reward.materialCount || 1}`);
    }

    let orb = null;
    if (reward.orbTier && typeof createOrb === "function") {
        orb = createOrb(reward.orbTier);
        if (orb) {
            player.orbs = player.orbs || [];
            player.orbs.push(orb);
            const orbName = typeof getOrbDisplayName === "function" ? getOrbDisplayName(orb) : reward.orbTier;
            grantedList.push(orbName);
        }
    }

    player.lastLoginDate = today;
    player.loginStreak = newStreak;
    localStorage.setItem("player", JSON.stringify(player));

    if (typeof updateStatus === "function") updateStatus(player);
    if (typeof updateXpDisplay === "function") updateXpDisplay(player);
    if (typeof renderMaterialsInventory === "function") renderMaterialsInventory();
    if (typeof renderOrbInventory === "function") renderOrbInventory();
    if (typeof syncPlayerToServer === "function") syncPlayerToServer(true);

    showLoginBonusModal(newStreak, reward, grantedList);
}

/**
 * ログインボーナスモーダルを（無ければ生成して）取得する。
 */
function ensureLoginBonusModal() {
    let modal = document.getElementById('loginBonusModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'loginBonusModal';
    modal.className = 'modal login-bonus-modal';
    modal.innerHTML = `
        <div class="modal-content login-bonus-content">
            <button type="button" class="close btn btn-secondary" style="align-self: flex-end;">閉じる</button>
            <div id="loginBonusBody" class="login-bonus-body"></div>
            <button type="button" id="loginBonusClaimBtn" class="btn btn-primary">受け取る！</button>
        </div>`;
    document.body.appendChild(modal);

    const closeModal = () => modal.classList.remove('show');
    modal.querySelector('.close').onclick = closeModal;
    modal.querySelector('#loginBonusClaimBtn').onclick = closeModal;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    return modal;
}

/**
 * ログインボーナス獲得モーダルを表示する。
 * @param {number} streak - 現在の連続ログイン日数
 * @param {object} reward - LOGIN_BONUS_REWARDS内の該当エントリ
 * @param {string[]} grantedList - 実際に付与された報酬の表示文字列一覧
 */
function showLoginBonusModal(streak, reward, grantedList) {
    const modal = ensureLoginBonusModal();
    const body = modal.querySelector('#loginBonusBody');

    const cycleIndex = (streak - 1) % LOGIN_BONUS_REWARDS.length;
    const isJackpot = cycleIndex === LOGIN_BONUS_REWARDS.length - 1;

    const rewardRows = grantedList.map(text => `<li>${text}</li>`).join('');

    body.innerHTML = `
        <h2 class="login-bonus-title">${isJackpot ? "🎉 " : ""}${reward.label}</h2>
        <p class="login-bonus-streak">連続ログイン ${streak}日目</p>
        <ul class="login-bonus-reward-list">${rewardRows}</ul>
        <p class="login-bonus-hint">${isJackpot
            ? "次の日からまた1日目としてボーナスが積み上がっていきます。毎日ログインして豪華な報酬を狙おう！"
            : "毎日ログインを続けると、7日目にもっと豪華な報酬がもらえます！"}</p>
    `;

    modal.classList.add('show');
}
