/**
 * Tier4オーブの固有能力ポップアップシステム
 * Tier4オーブを入手したとき、その固有能力の説明をポップアップで表示します
 */

/**
 * 固有能力のポップアップを表示
 * @param {Object} ability - 固有能力オブジェクト
 */
function showAbilityPopup(ability) {
    if (!ability || !ability.name || !ability.description) {
        console.warn('Invalid ability object:', ability);
        return;
    }

    // 既存のポップアップがあれば削除
    const existingOverlay = document.querySelector('.ability-popup-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // オーバーレイとポップアップを作成
    const overlay = document.createElement('div');
    overlay.className = 'ability-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'ability-popup';

    // 能力別のアイコン
    const iconMap = {
        'life_drain': '💉',
        'overwhelming_growth': '📈',
        're_miserable': '⬇️',
        'penetration': '🎯',
        'iron_wall': '🛡️',
        'sure_hit': '🎲',
        'critical_hit': '⚡'
    };

    // 能力別の戦術説明
    const tacticMap = {
        'life_drain': '持久戦に強くなります。攻撃しながらHPを回復できるため、長期戦で有利です。',
        'overwhelming_growth': '勉強することで急速に強くなれます。長期的な成長を望むなら最高のオーブです。',
        're_miserable': '相手の能力を大幅に低下させます。強い相手との対戦時に活躍する戦略的な能力です。',
        'penetration': '防御が高い相手に非常に有効です。盾武器を使う相手に対して大きなアドバンテージを得られます。',
        'iron_wall': '受けるダメージが半減します。防御を重視したプレイスタイルで最強の能力です。',
        'sure_hit': '確実に相手にダメージを与えられます。安定した火力を求めるなら最適な選択肢です。',
        'critical_hit': '運次第で大ダメージが狙えます。一発逆転の可能性があり、ハイリスク・ハイリターン型です。'
    };

    const icon = iconMap[ability.key] || '✨';
    const tactic = tacticMap[ability.key] || 'この能力を活用して戦いに勝利しよう！';

    popup.innerHTML = `
        <div class="ability-popup-header">
            <div class="ability-popup-icon">${icon}</div>
            <div class="ability-popup-title">${ability.name}</div>
            <div class="ability-popup-tier">⭐⭐⭐⭐ Tier4オーブ固有能力</div>
        </div>

        <div class="ability-popup-content">
            <span class="ability-popup-label">📖 能力説明</span>
            <div class="ability-popup-effect">
                ${ability.description}
            </div>

            <span class="ability-popup-label">💡 戦術アドバイス</span>
            <div class="ability-popup-tactic">
                <div class="ability-popup-tactic-label">推奨戦術</div>
                ${tactic}
            </div>
        </div>

        <div class="ability-popup-footer">
            <button class="ability-popup-close">了解！</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // クローズボタンイベント
    const closeBtn = popup.querySelector('.ability-popup-close');
    closeBtn.addEventListener('click', () => {
        overlay.style.animation = 'none';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    });

    // オーバーレイクリックでも閉じる
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }
    });
}

/**
 * Tier4オーブ入手時の通知を表示
 * @param {Object} orb - オーブオブジェクト
 */
function showTier4OrbNotification(orb) {
    if (!orb || orb.tier !== 'tier4' || !orb.uniqueAbility) {
        return;
    }

    // 既存の通知があれば削除
    const existingNotification = document.querySelector('.tier4-popup-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'tier4-popup-notification';
    notification.innerHTML = `
        <div class="tier4-notification-title">🌟 レアなTier4オーブを入手しました！</div>
        <div class="tier4-notification-text">
            固有能力「${orb.uniqueAbility.name}」が付与されます。
            詳細はポップアップでご確認ください。
        </div>
    `;

    document.body.appendChild(notification);

    // 5秒後に自動削除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.5s ease-in-out reverse';
            setTimeout(() => notification.remove(), 500);
        }
    }, 5000);
}

/**
 * バトル勝利時にオーブがドロップされたときの処理
 * Tier4オーブがあればポップアップを表示
 * @param {Object} droppedOrb - ドロップされたオーブ
 */
function handleOrbDrop(droppedOrb) {
    if (!droppedOrb) return;

    // Tier4オーブの場合は通知を表示
    if (droppedOrb.tier === 'tier4' && droppedOrb.uniqueAbility) {
        showTier4OrbNotification(droppedOrb);
        
        // 少し遅れてポップアップを表示（通知が目立つように）
        setTimeout(() => {
            showAbilityPopup(droppedOrb.uniqueAbility);
        }, 2000);
    }
}

/**
 * オリジナル武器作成時にTier4オーブが使用された場合、固有能力を表示
 * @param {Array} selectedOrbs - 選択されたオーブの配列
 */
function handleOriginalWeaponCreation(selectedOrbs) {
    if (!selectedOrbs || selectedOrbs.length === 0) return;

    // Tier4オーブが含まれているかチェック
    const tier4Orbs = selectedOrbs.filter(orb => orb.tier === 'tier4' && orb.uniqueAbility);

    if (tier4Orbs.length > 0) {
        // 最初のTier4オーブの固有能力を表示
        setTimeout(() => {
            showAbilityPopup(tier4Orbs[0].uniqueAbility);
        }, 1500);
    }
}

// DOMContentLoaded時にスタイルシートを読み込む
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // スタイルシートが既に読み込まれていることを確認
        const styleLink = document.querySelector('link[href*="ability-popup.css"]');
        if (!styleLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/ability-popup.css';
            document.head.appendChild(link);
        }
    });
} else {
    // DOMが既に読み込まれている場合
    const styleLink = document.querySelector('link[href*="ability-popup.css"]');
    if (!styleLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/ability-popup.css';
        document.head.appendChild(link);
    }
}
