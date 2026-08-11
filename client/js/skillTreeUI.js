// ============================================
// スキルツリーUI
// ============================================

let selectedNode = null;

// スキルツリーの初期化（skillTree.jsを使用するため無効化）
function initializeSkillTreeUI() {
    // skillTree.jsのrenderSkillTreeUIを使用するため、ここでは何もしない
    console.log("initializeSkillTreeUI: Using skillTree.js instead");
    return;
}

// スキルツリーのレンダリング
function renderSkillTree() {
    const canvas = document.getElementById('skillTreeCanvas');
    if (!canvas) return;
    
    const skillTree = SKILL_TREES[currentWeaponType];
    if (!skillTree) return;
    
    const player = getPlayerData();
    if (!player) return;
    
    const playerTreeData = player.skillTrees?.[currentWeaponType] || { unlockedNodes: [], availablePoints: 0 };
    
    // キャンバスをクリア
    canvas.innerHTML = '';
    
    // ノードの座標計算（グリッドベース）
    const gridSize = 80;
    const offsetX = 300;
    const offsetY = 50;
    
    // 接続線の描画
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'skill-tree-connections');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1';
    
    skillTree.nodes.forEach(node => {
        if (node.requires) {
            const requirements = Array.isArray(node.requires) ? node.requires : [node.requires];
            requirements.forEach(reqId => {
                const reqNode = skillTree.nodes.find(n => n.id === reqId);
                if (reqNode) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', (reqNode.x * gridSize) + offsetX + 30);
                    line.setAttribute('y1', (reqNode.y * gridSize) + offsetY + 30);
                    line.setAttribute('x2', (node.x * gridSize) + offsetX + 30);
                    line.setAttribute('y2', (node.y * gridSize) + offsetY + 30);
                    line.setAttribute('stroke', '#666');
                    line.setAttribute('stroke-width', '2');
                    svg.appendChild(line);
                }
            });
        }
    });
    
    canvas.appendChild(svg);
    
    // ノードの描画
    skillTree.nodes.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'skill-node';
        nodeEl.dataset.nodeId = node.id;
        
        // アンロック状態の判定
        const isUnlocked = playerTreeData.unlockedNodes.includes(node.id);
        const canUnlock = canUnlockNode(node, playerTreeData);
        
        // スタイルの設定
        nodeEl.style.position = 'absolute';
        nodeEl.style.left = `${(node.x * gridSize) + offsetX}px`;
        nodeEl.style.top = `${(node.y * gridSize) + offsetY}px`;
        nodeEl.style.width = '60px';
        nodeEl.style.height = '60px';
        nodeEl.style.borderRadius = '50%';
        nodeEl.style.display = 'flex';
        nodeEl.style.alignItems = 'center';
        nodeEl.style.justifyContent = 'center';
        nodeEl.style.cursor = 'pointer';
        nodeEl.style.zIndex = '2';
        nodeEl.style.fontSize = '24px';
        nodeEl.style.fontWeight = 'bold';
        nodeEl.style.border = '3px solid';
        nodeEl.style.transition = 'all 0.3s';
        
        // ノードタイプに基づく色設定
        if (node.type === 'stat') {
            nodeEl.style.backgroundColor = isUnlocked ? '#4CAF50' : '#2196F3';
            nodeEl.textContent = '📊';
        } else if (node.type === 'active') {
            nodeEl.style.backgroundColor = isUnlocked ? '#FF9800' : '#FF5722';
            nodeEl.textContent = '⚔️';
        } else if (node.type === 'passive') {
            nodeEl.style.backgroundColor = isUnlocked ? '#9C27B0' : '#673AB7';
            nodeEl.textContent = '🛡️';
        }
        
        // ボーダー色
        if (isUnlocked) {
            nodeEl.style.borderColor = '#FFD700';
            nodeEl.style.boxShadow = '0 0 10px #FFD700';
        } else if (canUnlock) {
            nodeEl.style.borderColor = '#00FF00';
        } else {
            nodeEl.style.borderColor = '#666';
            nodeEl.style.opacity = '0.5';
        }
        
        // ホバー効果
        nodeEl.addEventListener('mouseenter', () => {
            nodeEl.style.transform = 'scale(1.1)';
        });
        nodeEl.addEventListener('mouseleave', () => {
            nodeEl.style.transform = 'scale(1)';
        });
        
        // クリックイベント
        nodeEl.addEventListener('click', () => {
            selectSkillNode(node);
        });
        
        // ツールチップ
        const tooltip = document.createElement('div');
        tooltip.className = 'skill-node-tooltip';
        tooltip.textContent = node.name;
        tooltip.style.position = 'absolute';
        tooltip.style.bottom = '70px';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '5px 10px';
        tooltip.style.borderRadius = '5px';
        tooltip.style.fontSize = '12px';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'opacity 0.3s';
        tooltip.style.pointerEvents = 'none';
        
        nodeEl.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
        });
        nodeEl.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });
        
        nodeEl.appendChild(tooltip);
        canvas.appendChild(nodeEl);
    });
}

// ノードが解放可能かチェック
function canUnlockNode(node, playerTreeData) {
    // 既に解放済み
    if (playerTreeData.unlockedNodes.includes(node.id)) return false;
    
    // スキルポイント不足
    if (playerTreeData.availablePoints < node.cost) return false;
    
    // 前提条件チェック
    if (node.requires) {
        const requirements = Array.isArray(node.requires) ? node.requires : [node.requires];
        for (const reqId of requirements) {
            if (!playerTreeData.unlockedNodes.includes(reqId)) {
                return false;
            }
        }
    }
    
    return true;
}

// スキルノードの選択
function selectSkillNode(node) {
    selectedNode = node;
    
    const nameEl = document.getElementById('skillNodeName');
    const descEl = document.getElementById('skillNodeDescription');
    const costEl = document.getElementById('skillNodeCost');
    const unlockBtn = document.getElementById('unlockSkillBtn');
    
    if (nameEl) nameEl.textContent = node.name;
    if (descEl) descEl.textContent = node.description;
    if (costEl) costEl.textContent = `コスト: ${node.cost} スキルポイント`;
    
    const player = getPlayerData();
    const playerTreeData = player.skillTree || { unlockedNodes: [], availablePoints: 0 };
    
    if (unlockBtn) {
        const isUnlocked = playerTreeData.unlockedNodes.includes(node.id);
        const canUnlock = canUnlockNode(node, playerTreeData);
        
        unlockBtn.disabled = isUnlocked || !canUnlock;
        
        if (isUnlocked) {
            unlockBtn.textContent = '解放済み';
        } else if (!canUnlock) {
            unlockBtn.textContent = '解放不可';
        } else {
            unlockBtn.textContent = 'スキル解放';
        }
    }
}

// スキルの解放
function unlockSelectedSkill() {
    if (!selectedNode) return;
    
    const player = getPlayerData();
    if (!player) return;
    
    const result = unlockSkillNode(player, selectedNode.id);
    
    if (result.success) {
        localStorage.setItem("player", JSON.stringify(result.player));
        renderSkillTree();
        updateSkillPointsDisplay();
        selectSkillNode(selectedNode); // 選択状態を更新
        alert('スキルを解放しました！');
    } else {
        alert(result.error);
    }
}

// スキルポイント表示の更新
function updateSkillPointsDisplay() {
    const player = getPlayerData();
    if (!player) return;
    
    const initializedPlayer = initializeSkillData(player);
    const totalPoints = initializedPlayer.skillTree.availablePoints;
    
    const totalDisplay = document.getElementById('totalSkillPointsDisplay');
    if (totalDisplay) {
        totalDisplay.textContent = `総スキルポイント: ${totalPoints}`;
    }
}

// オリジナルスキル作成のハンドリング
function handleCustomSkillCreation() {
    const nameInput = document.getElementById('customSkillName');
    const descInput = document.getElementById('customSkillDescription');
    
    const skillName = nameInput.value.trim();
    const skillDescription = descInput.value.trim();
    
    console.log("Skill name:", skillName);
    console.log("Skill description:", skillDescription);
    
    if (!skillName || skillName.length === 0) {
        alert('スキル名を入力してください');
        return;
    }
    
    if (!skillDescription || skillDescription.length === 0) {
        alert('スキルの説明を入力してください');
        return;
    }
    
    const player = getPlayerData();
    if (!player) return;
    
    // AIによる効果の推定と実装
    const effect = estimateSkillEffect(skillDescription);
    
    const result = createCustomSkill(player, skillName, skillDescription, effect);
    
    if (result.success) {
        localStorage.setItem("player", JSON.stringify(result.player));
        
        // 入力をクリア
        nameInput.value = '';
        descInput.value = '';
        
        renderCustomSkillList();
        updateSkillPointsDisplay();
        
        alert(`オリジナルスキル「${skillName}」を作成しました！\n必要ステータス: 合計${result.skill.requiredStats || '計算中'}\n効果強度: ${result.skill.strength}`);
    } else {
        alert(result.error);
    }
}

// AIによるスキル効果の推定（より広範な解釈）
function estimateSkillEffect(description) {
    const desc = description.toLowerCase();
    const effect = { type: 'active' };
    
    // ダメージ倍率の推定（より広範なパターンマッチング）
    const multiplierMatches = desc.match(/(\d+\.?\d*)\s*倍|(\d+\.?\d*)\s*%|(\d+\.?\d*)x|(\d+\.?\d*)\s*times/i);
    if (multiplierMatches) {
        const num = parseFloat(multiplierMatches[1] || multiplierMatches[2] || multiplierMatches[3] || multiplierMatches[4]);
        if (!isNaN(num)) {
            if (desc.includes('%')) {
                effect.damageMultiplier = 1 + (num / 100);
            } else {
                effect.damageMultiplier = num;
            }
        }
    }
    
    // ダメージ関連のキーワード
    if (desc.includes('ダメージ') && !effect.damageMultiplier) {
        effect.damageMultiplier = 1.2; // デフォルト倍率
    }
    if (desc.includes('強力') || desc.includes('強化')) {
        effect.damageMultiplier = (effect.damageMultiplier || 1.0) * 1.2;
    }
    
    // 回復効果の推定
    if (desc.includes('回復') || desc.includes('ヒール') || desc.includes('heal') || desc.includes('cure')) {
        effect.healPercent = 0.2;
        if (desc.includes('30%') || desc.includes('1/3')) effect.healPercent = 0.3;
        if (desc.includes('50%') || desc.includes('半分')) effect.healPercent = 0.5;
        if (desc.includes('大幅') || desc.includes('強力')) effect.healPercent = 0.4;
    }
    
    // 防御効果の推定
    if (desc.includes('防御') || desc.includes('軽減') || desc.includes('reduce') || desc.includes('protect')) {
        effect.damageReduction = 0.2;
        if (desc.includes('30%')) effect.damageReduction = 0.3;
        if (desc.includes('50%') || desc.includes('半分')) effect.damageReduction = 0.5;
        if (desc.includes('大幅')) effect.damageReduction = 0.4;
    }
    
    // 回避効果の推定
    if (desc.includes('回避') || desc.includes('ドッジ') || desc.includes('dodge') || desc.includes('evade') || desc.includes('miss')) {
        effect.evasionChance = 0.3;
        if (desc.includes('50%') || desc.includes('半分')) effect.evasionChance = 0.5;
        if (desc.includes('確実') || desc.includes('完全')) effect.evasionChance = 1.0;
    }
    
    // その他の特殊効果（拡張）
    if (desc.includes('貫通') || desc.includes('ピアス') || desc.includes('pierce') || desc.includes('penetrate') || desc.includes('ignore')) {
        effect.pierceDef = 0.5;
    }
    
    if (desc.includes('ライフスティール') || desc.includes('吸収') || desc.includes('lifesteal') || desc.includes('drain') || desc.includes('vampiric')) {
        effect.lifeSteal = 0.15;
        if (desc.includes('30%')) effect.lifeSteal = 0.3;
    }
    
    if (desc.includes('クリティカル') || desc.includes('会心') || desc.includes('critical') || desc.includes('crit')) {
        effect.nextAttackCrit = true;
    }
    
    if (desc.includes('火傷') || desc.includes('burn') || desc.includes('burning')) {
        effect.burn = true;
    }
    
    if (desc.includes('毒') || desc.includes('poison')) {
        effect.poison = true;
    }
    
    if (desc.includes('スタン') || desc.includes('気絶') || desc.includes('stun') || desc.includes('paralyze')) {
        effect.stun = true;
    }
    
    if (desc.includes('シールド') || desc.includes('バリア') || desc.includes('shield') || desc.includes('barrier')) {
        effect.shield = true;
    }
    
    if (desc.includes('カウンター') || desc.includes('反撃') || desc.includes('counter') || desc.includes('retaliate')) {
        effect.counter = true;
    }
    
    if (desc.includes('連続') || desc.includes('複数') || desc.includes('multi') || desc.includes('combo')) {
        effect.multiHit = 2;
        if (desc.includes('3')) effect.multiHit = 3;
    }
    
    if (desc.includes('速さ') && (desc.includes('低下') || desc.includes('遅く') || desc.includes('slow') || desc.includes('debuff'))) {
        effect.speedDebuff = 0.2;
    }
    
    return effect;
}

// オリジナルスキルリストのレンダリング
function renderCustomSkillList() {
    const container = document.getElementById('customSkillList');
    if (!container) return;
    
    const player = getPlayerData();
    if (!player || !player.customSkills) {
        container.innerHTML = '<p>オリジナルスキルなし</p>';
        return;
    }
    
    container.innerHTML = '';
    
    player.customSkills.forEach(skill => {
        const skillEl = document.createElement('div');
        skillEl.className = 'custom-skill-item';
        skillEl.innerHTML = `
            <div class="skill-info">
                <div class="skill-name"><strong>${skill.name}</strong></div>
                <div class="skill-description">${skill.description}</div>
                <div class="skill-strength">強度: ${skill.strength}</div>
                <div class="skill-date">作成日: ${new Date(skill.createdAt).toLocaleDateString()}</div>
            </div>
        `;
        container.appendChild(skillEl);
    });
}

// レベルアップ時のスキルポイント付与をstats.jsのbuildPlayerに統合
const originalBuildPlayer = window.buildPlayer;
window.buildPlayer = function(name, stats, xp, options = {}) {
    const player = originalBuildPlayer(name, stats, xp, options);
    
    // レベルアップ時のスキルポイント付与
    const oldLevel = options.oldLevel || 1;
    const newLevel = player.level;
    
    if (newLevel > oldLevel) {
        const updatedPlayer = addSkillPointsOnLevelUp(player, oldLevel, newLevel);
        return updatedPlayer;
    }
    
    return player;
};

// グローバル関数としてエクスポート
if (typeof window !== 'undefined') {
    window.initializeSkillTreeUI = initializeSkillTreeUI;
    window.renderSkillTree = renderSkillTree;
    window.selectSkillNode = selectSkillNode;
    window.unlockSelectedSkill = unlockSelectedSkill;
    window.updateSkillPointsDisplay = updateSkillPointsDisplay;
    window.handleCustomSkillCreation = handleCustomSkillCreation;
}

// DOM読み込み後に初期化（無効化 - skillTree.jsを使用）
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', initializeSkillTreeUI);
// } else {
//     initializeSkillTreeUI();
// }
