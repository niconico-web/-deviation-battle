// ============================================
// 勉強連携システム拡張
// ============================================

// 既存の勉強システムを拡張して、MMO機能と連携させる

// 拡張勉強報酬計算
function calculateEnhancedStudyRewards(seconds, player) {
    const minutes = Math.floor(seconds / 60);
    
    // 基礎報酬
    let baseExp = minutes * 10;
    let baseCoins = Math.floor(minutes * 2);
    let baseStatGrowth = minutes;
    
    // プレステージボーナス
    const prestigeCount = player.prestigeCount || 0;
    const prestigeBonus = 1 + (prestigeCount * 0.05);
    
    // ギルドボーナス
    let guildBonus = 1.0;
    if (player.guild && player.guild.level) {
        guildBonus = 1 + (player.guild.level * 0.02);
    }
    
    // オーブ特殊能力ボーナス
    let orbBonus = 1.0;
    if (player.equippedWeapon && player.equippedWeapon.uniqueAbilities) {
        const hasDoubleGrowth = player.equippedWeapon.uniqueAbilities.some(
            ability => ability.effect === 'double_study_growth'
        );
        if (hasDoubleGrowth) {
            orbBonus = 2.0;
        }
    }
    
    // 総合ボーナス
    const totalBonus = prestigeBonus * guildBonus * orbBonus;
    
    return {
        exp: Math.floor(baseExp * totalBonus),
        coins: Math.floor(baseCoins * totalBonus),
        statGrowth: Math.floor(baseStatGrowth * totalBonus),
        adventurerExp: Math.floor(minutes * 5 * totalBonus),
        bonusMultiplier: totalBonus
    };
}

// 勉強完了時の追加処理
function handleStudyCompletion(seconds) {
    const player = getPlayerData();
    if (!player) return;
    
    const rewards = calculateEnhancedStudyRewards(seconds, player);
    
    // チャットで通知
    if (typeof addChatMessage === 'function') {
        addChatMessage({
            type: 'system',
            playerName: '勉強',
            playerLevel: 0,
            message: `📖 勉強完了！${formatTime(seconds)}勉強しました。\nEXP+${rewards.exp} コイン+${rewards.coins} 冒険者EXP+${rewards.adventurerExp} (ボーナスx${rewards.bonusMultiplier.toFixed(2)})`,
            timestamp: Date.now()
        });
    }
    
    // クエスト進行更新（勉強関連クエストがあれば）
    if (typeof updateQuestProgress === 'function') {
        // 勉強時間クエストがあれば進行を更新
        Object.keys(window.playerQuests || {}).forEach(questId => {
            const quest = (window.QUESTS || []).find(q => q.id === questId);
            if (quest && quest.type === 'study_time') {
                updateQuestProgress(questId, Math.floor(seconds / 60));
            }
        });
    }
    
    // ギルド貢献度（ギルドに所属している場合）
    if (player.guild && window.socket && window.socket.connected) {
        window.socket.emit('guild:contribute', {
            guildId: player.guild.id,
            playerId: player.id,
            contribution: Math.floor(seconds / 60) // 1分ごとに1貢献度
        });
    }
}

// 既存のapplyStudyRewards関数を拡張
// 注意：この関数は既存のscript.jsのapplyStudyRewardsの後に呼ばれることを想定
function enhanceStudySystem() {
    // 既存のapplyStudyRewards関数をフック
    const originalApplyStudyRewards = window.applyStudyRewards;
    
    if (originalApplyStudyRewards) {
        window.applyStudyRewards = function(seconds) {
            // 元の関数を実行
            const result = originalApplyStudyRewards.apply(this, arguments);
            
            // 拡張機能を実行
            setTimeout(() => {
                handleStudyCompletion(seconds);
            }, 100);
            
            return result;
        };
    }
}

// 勉強スタイルボーナスUIを表示
function showStudyStyleBonusUI() {
    const player = getPlayerData();
    if (!player) return;
    
    const prestigeCount = player.prestigeCount || 0;
    const prestigeBonus = 1 + (prestigeCount * 0.05);
    
    let guildBonusInfo = 'なし';
    let guildBonusValue = 1.0;
    if (player.guild && player.guild.level) {
        guildBonusInfo = `Lv.${player.guild.level} (+${(player.guild.level * 2).toFixed(0)}%)`;
        guildBonusValue = 1 + (player.guild.level * 0.02);
    }
    
    let orbBonusInfo = 'なし';
    let orbBonusValue = 1.0;
    if (player.equippedWeapon && player.equippedWeapon.uniqueAbilities) {
        const hasDoubleGrowth = player.equippedWeapon.uniqueAbilities.some(
            ability => ability.effect === 'double_study_growth'
        );
        if (hasDoubleGrowth) {
            orbBonusInfo = '圧倒的成長性 (x2.0)';
            orbBonusValue = 2.0;
        }
    }
    
    const totalBonus = prestigeBonus * guildBonusValue * orbBonusValue;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'studyBonusModal';
    
    modal.innerHTML = `
        <div class="modal-content study-bonus-modal">
            <button type="button" class="close btn btn-secondary">閉じる</button>
            <h2>📖 勉強ボーナス確認</h2>
            
            <div class="bonus-list">
                <div class="bonus-item">
                    <span class="bonus-label">プレステージボーナス</span>
                    <span class="bonus-value">x${prestigeBonus.toFixed(2)} (${prestigeCount}回)</span>
                </div>
                <div class="bonus-item">
                    <span class="bonus-label">ギルドボーナス</span>
                    <span class="bonus-value">x${guildBonusValue.toFixed(2)} (${guildBonusInfo})</span>
                </div>
                <div class="bonus-item">
                    <span class="bonus-label">オーブボーナス</span>
                    <span class="bonus-value">x${orbBonusValue.toFixed(2)} (${orbBonusInfo})</span>
                </div>
                <div class="bonus-item total">
                    <span class="bonus-label">総合ボーナス</span>
                    <span class="bonus-value">x${totalBonus.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="bonus-example">
                <h3>計算例（1分勉強した場合）</h3>
                <div class="example-stats">
                    <span>基礎: EXP+10 コイン+2</span>
                    <span>ボーナス適用後: EXP+${Math.floor(10 * totalBonus)} コイン+${Math.floor(2 * totalBonus)}</span>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // イベントリスナー
    modal.querySelector('.close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// グローバル関数として公開
window.calculateEnhancedStudyRewards = calculateEnhancedStudyRewards;
window.handleStudyCompletion = handleStudyCompletion;
window.enhanceStudySystem = enhanceStudySystem;
window.showStudyStyleBonusUI = showStudyStyleBonusUI;

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        enhanceStudySystem();
    }, 200);
});