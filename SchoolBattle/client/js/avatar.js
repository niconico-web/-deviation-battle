// ============================================
// アバターカスタマイズシステム
// ============================================

// アバターカスタマイズの設定
const AVATAR_CUSTOMIZATION = {
    hairStyles: [
        { id: 'short', name: 'ショート', icon: '👱' },
        { id: 'long', name: 'ロング', icon: '👩' },
        { id: 'spiky', name: 'スパイク', icon: '👦' },
        { id: 'curly', name: 'カーリー', icon: '👧' },
        { id: 'bald', name: 'スキンヘッド', icon: '👴' },
        { id: 'ponytail', name: 'ポニーテール', icon: '👸' }
    ],
    hairColors: [
        { id: 'black', name: '黒', color: '#333333' },
        { id: 'brown', name: '茶', color: '#8B4513' },
        { id: 'blonde', name: '金', color: '#FFD700' },
        { id: 'red', name: '赤', color: '#FF4500' },
        { id: 'blue', name: '青', color: '#1E90FF' },
        { id: 'pink', name: 'ピンク', color: '#FF69B4' },
        { id: 'purple', name: '紫', color: '#9370DB' },
        { id: 'white', name: '白', color: '#F5F5F5' }
    ],
    skinColors: [
        { id: 'light', name: '明るい', color: '#FFE4C4' },
        { id: 'medium', name: '中間', color: '#DEB887' },
        { id: 'dark', name: '暗い', color: '#8B4513' },
        { id: 'very_dark', name: '非常に暗い', color: '#4A3728' }
    ],
    outfits: [
        { id: 'school_uniform', name: '学生服', icon: '🎓' },
        { id: 'casual', name: 'カジュアル', icon: '👕' },
        { id: 'armor', name: '鎧', icon: '🛡️' },
        { id: 'robe', name: 'ローブ', icon: '🧙' },
        { id: 'sport', name: 'スポーツ', icon: '🏃' }
    ],
    accessories: [
        { id: 'none', name: 'なし', icon: '❌' },
        { id: 'glasses', name: '眼鏡', icon: '👓' },
        { id: 'hat', name: '帽子', icon: '🎩' },
        { id: 'headband', name: 'バンダナ', icon: '🧣' },
        { id: 'earrings', name: 'イヤリング', icon: '💎' }
    ]
};

// デフォルトアバター設定
const DEFAULT_AVATAR = {
    hairStyle: 'short',
    hairColor: 'black',
    skinColor: 'medium',
    outfit: 'school_uniform',
    accessory: 'none'
};

// プレイヤーデータからアバター設定を取得
function getAvatarFromPlayer(player) {
    if (!player || !player.avatar) {
        return { ...DEFAULT_AVATAR };
    }
    return { ...DEFAULT_AVATAR, ...player.avatar };
}

// アバター設定をプレイヤーデータに保存
function saveAvatarToPlayer(player, avatar) {
    if (!player) return;
    player.avatar = avatar;
    localStorage.setItem('player', JSON.stringify(player));
}

// アバターカスタマイズUIを表示
function showAvatarCustomizationUI() {
    const player = getPlayerData();
    if (!player) {
        alert('キャラクターを作成してください');
        return;
    }

    const currentAvatar = getAvatarFromPlayer(player);
    
    // モーダルを作成
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'avatarCustomizationModal';
    
    modal.innerHTML = `
        <div class="modal-content avatar-customization-modal">
            <button type="button" class="close btn btn-secondary">閉じる</button>
            <h2>アバターカスタマイズ</h2>
            
            <div class="avatar-preview">
                <canvas id="avatarPreviewCanvas" width="128" height="128"></canvas>
            </div>
            
            <div class="avatar-options">
                <div class="avatar-option-group">
                    <h3>髪型</h3>
                    <div class="avatar-option-list" id="hairStyleOptions"></div>
                </div>
                
                <div class="avatar-option-group">
                    <h3>髪色</h3>
                    <div class="avatar-option-list" id="hairColorOptions"></div>
                </div>
                
                <div class="avatar-option-group">
                    <h3>肌色</h3>
                    <div class="avatar-option-list" id="skinColorOptions"></div>
                </div>
                
                <div class="avatar-option-group">
                    <h3>服装</h3>
                    <div class="avatar-option-list" id="outfitOptions"></div>
                </div>
                
                <div class="avatar-option-group">
                    <h3>アクセサリー</h3>
                    <div class="avatar-option-list" id="accessoryOptions"></div>
                </div>
            </div>
            
            <button type="button" id="saveAvatarBtn" class="btn btn-primary">保存</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 選択肢を生成
    renderAvatarOptions('hairStyleOptions', AVATAR_CUSTOMIZATION.hairStyles, currentAvatar.hairStyle, 'hairStyle');
    renderAvatarOptions('hairColorOptions', AVATAR_CUSTOMIZATION.hairColors, currentAvatar.hairColor, 'hairColor');
    renderAvatarOptions('skinColorOptions', AVATAR_CUSTOMIZATION.skinColors, currentAvatar.skinColor, 'skinColor');
    renderAvatarOptions('outfitOptions', AVATAR_CUSTOMIZATION.outfits, currentAvatar.outfit, 'outfit');
    renderAvatarOptions('accessoryOptions', AVATAR_CUSTOMIZATION.accessories, currentAvatar.accessory, 'accessory');
    
    // プレビューを描画
    drawAvatarPreview(currentAvatar);
    
    // イベントリスナー
    setupAvatarCustomizationEvents(modal, currentAvatar);
}

// アバター選択肢を描画
function renderAvatarOptions(containerId, options, selectedValue, category) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    options.forEach(option => {
        const button = document.createElement('button');
        button.className = `avatar-option-btn ${option.id === selectedValue ? 'selected' : ''}`;
        button.dataset.value = option.id;
        button.dataset.category = category;
        
        if (option.color) {
            button.innerHTML = `<span class="color-swatch" style="background-color: ${option.color}"></span>${option.name}`;
        } else {
            button.innerHTML = `${option.icon} ${option.name}`;
        }
        
        button.addEventListener('click', () => {
            // 選択状態を更新
            container.querySelectorAll('.avatar-option-btn').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            
            // プレビューを更新
            const currentAvatar = getCurrentAvatarFromModal();
            currentAvatar[category] = option.id;
            drawAvatarPreview(currentAvatar);
        });
        
        container.appendChild(button);
    });
}

// モーダルから現在のアバター設定を取得
function getCurrentAvatarFromModal() {
    return {
        hairStyle: document.querySelector('#hairStyleOptions .selected')?.dataset.value || DEFAULT_AVATAR.hairStyle,
        hairColor: document.querySelector('#hairColorOptions .selected')?.dataset.value || DEFAULT_AVATAR.hairColor,
        skinColor: document.querySelector('#skinColorOptions .selected')?.dataset.value || DEFAULT_AVATAR.skinColor,
        outfit: document.querySelector('#outfitOptions .selected')?.dataset.value || DEFAULT_AVATAR.outfit,
        accessory: document.querySelector('#accessoryOptions .selected')?.dataset.value || DEFAULT_AVATAR.accessory
    };
}

// アバタープレビューを描画
function drawAvatarPreview(avatar) {
    const canvas = document.getElementById('avatarPreviewCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 色設定を取得
    const hairColor = AVATAR_CUSTOMIZATION.hairColors.find(c => c.id === avatar.hairColor)?.color || '#333333';
    const skinColor = AVATAR_CUSTOMIZATION.skinColors.find(c => c.id === avatar.skinColor)?.color || '#DEB887';
    
    // 基本的なキャラクター形状
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // 体（服装ベース）
    ctx.fillStyle = getOutfitColor(avatar.outfit);
    ctx.fillRect(centerX - 20, centerY + 20, 40, 40);
    
    // 頭（肌色）
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 10, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // 髪型に応じた髪を描画
    drawHairStyle(ctx, centerX, centerY - 10, avatar.hairStyle, hairColor);
    
    // アクセサリーを描画
    drawAccessory(ctx, centerX, centerY - 10, avatar.accessory);
    
    // 顔の特徴
    ctx.fillStyle = '#000000';
    // 目
    ctx.beginPath();
    ctx.arc(centerX - 8, centerY - 15, 3, 0, Math.PI * 2);
    ctx.arc(centerX + 8, centerY - 15, 3, 0, Math.PI * 2);
    ctx.fill();
    // 口
    ctx.beginPath();
    ctx.arc(centerX, centerY - 5, 5, 0, Math.PI);
    ctx.stroke();
}

// 髪型を描画
function drawHairStyle(ctx, x, y, hairStyle, color) {
    ctx.fillStyle = color;
    
    switch(hairStyle) {
        case 'short':
            ctx.beginPath();
            ctx.arc(x, y - 5, 28, Math.PI, Math.PI * 2);
            ctx.fill();
            break;
        case 'long':
            ctx.beginPath();
            ctx.arc(x, y - 5, 28, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(x - 28, y - 5, 56, 40);
            break;
        case 'spiky':
            ctx.beginPath();
            ctx.arc(x, y - 5, 28, Math.PI, Math.PI * 2);
            ctx.fill();
            // スパイク
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(x - 20 + i * 10, y - 30);
                ctx.lineTo(x - 15 + i * 10, y - 45);
                ctx.lineTo(x - 10 + i * 10, y - 30);
                ctx.fill();
            }
            break;
        case 'curly':
            ctx.beginPath();
            ctx.arc(x, y - 5, 30, Math.PI, Math.PI * 2);
            ctx.fill();
            // カール
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(x - 15 + i * 15, y + 10, 8, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        case 'bald':
            // 髪なし
            break;
        case 'ponytail':
            ctx.beginPath();
            ctx.arc(x, y - 5, 28, Math.PI, Math.PI * 2);
            ctx.fill();
            // ポニーテール
            ctx.beginPath();
            ctx.arc(x + 20, y + 5, 10, 0, Math.PI * 2);
            ctx.fill();
            break;
        default:
            ctx.beginPath();
            ctx.arc(x, y - 5, 28, Math.PI, Math.PI * 2);
            ctx.fill();
    }
}

// アクセサリーを描画
function drawAccessory(ctx, x, y, accessory) {
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    
    switch(accessory) {
        case 'glasses':
            ctx.beginPath();
            ctx.arc(x - 8, y - 15, 6, 0, Math.PI * 2);
            ctx.arc(x + 8, y - 15, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - 2, y - 15);
            ctx.lineTo(x + 2, y - 15);
            ctx.stroke();
            break;
        case 'hat':
            ctx.fillStyle = '#333333';
            ctx.fillRect(x - 25, y - 35, 50, 5);
            ctx.fillRect(x - 15, y - 50, 30, 20);
            break;
        case 'headband':
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y - 10, 27, Math.PI, Math.PI * 2);
            ctx.stroke();
            break;
        case 'earrings':
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(x - 25, y - 5, 3, 0, Math.PI * 2);
            ctx.arc(x + 25, y - 5, 3, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'none':
        default:
            // アクセサリーなし
            break;
    }
}

// 服装の色を取得
function getOutfitColor(outfit) {
    const colors = {
        'school_uniform': '#2C3E50',
        'casual': '#3498DB',
        'armor': '#7F8C8D',
        'robe': '#9B59B6',
        'sport': '#E74C3C'
    };
    return colors[outfit] || '#2C3E50';
}

// アバターカスタマイズのイベントを設定
function setupAvatarCustomizationEvents(modal, currentAvatar) {
    // 閉じるボタン
    modal.querySelector('.close').addEventListener('click', () => {
        modal.remove();
    });
    
    // 保存ボタン
    document.getElementById('saveAvatarBtn').addEventListener('click', () => {
        const newAvatar = getCurrentAvatarFromModal();
        const player = getPlayerData();
        
        if (player) {
            saveAvatarToPlayer(player, newAvatar);
            syncPlayerToServer(true);
            alert('アバターを保存しました！');
            modal.remove();
            
            // 町画面でアバターを更新
            if (typeof updateTownPlayerAvatar === 'function') {
                updateTownPlayerAvatar(newAvatar);
            }
        }
    });
    
    // モーダル外クリックで閉じる
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// キャラクター作成画面にアバターカスタマイズを追加
function addAvatarCustomizationToCharacterCreation() {
    const createCharSection = document.getElementById('section-stats');
    if (!createCharSection) return;
    
    // アバターカスタマイズボタンを追加
    const settingBox = createCharSection.querySelector('.setting-box');
    if (!settingBox) return;
    
    const avatarButton = document.createElement('button');
    avatarButton.type = 'button';
    avatarButton.className = 'btn btn-secondary';
    avatarButton.id = 'avatarCustomizationBtn';
    avatarButton.textContent = '🎨 アバターカスタマイズ';
    avatarButton.style.marginTop = '10px';
    
    settingBox.appendChild(avatarButton);
    
    avatarButton.addEventListener('click', showAvatarCustomizationUI);
}

// アバター表示用のSVGを生成（町画面などで使用）
function getAvatarSVG(avatar, size = 32) {
    if (!avatar) {
        avatar = DEFAULT_AVATAR;
    }
    
    const hairColor = AVATAR_CUSTOMIZATION.hairColors.find(c => c.id === avatar.hairColor)?.color || '#333333';
    const skinColor = AVATAR_CUSTOMIZATION.skinColors.find(c => c.id === avatar.skinColor)?.color || '#DEB887';
    const outfitColor = getOutfitColor(avatar.outfit);
    
    let hairSVG = '';
    switch(avatar.hairStyle) {
        case 'short':
            hairSVG = `<path d="M16 4 A12 12 0 0 1 16 28" fill="${hairColor}" transform="translate(0, -8)"/>`;
            break;
        case 'long':
            hairSVG = `<path d="M16 4 A12 12 0 0 1 16 28 L16 48" fill="${hairColor}" transform="translate(0, -8)"/>`;
            break;
        case 'spiky':
            hairSVG = `<path d="M16 4 A12 12 0 0 1 16 28" fill="${hairColor}" transform="translate(0, -8)"/>
                      <path d="M8 8 L10 0 L12 8" fill="${hairColor}"/>
                      <path d="M20 8 L22 0 L24 8" fill="${hairColor}"/>`;
            break;
        default:
            hairSVG = `<circle cx="16" cy="8" r="12" fill="${hairColor}"/>`;
    }
    
    let accessorySVG = '';
    if (avatar.accessory === 'glasses') {
        accessorySVG = `<circle cx="12" cy="12" r="3" stroke="#333" fill="none" stroke-width="1"/>
                       <circle cx="20" cy="12" r="3" stroke="#333" fill="none" stroke-width="1"/>
                       <line x1="15" y1="12" x2="17" y2="12" stroke="#333" stroke-width="1"/>`;
    }
    
    return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <!-- 体 -->
            <rect x="8" y="20" width="16" height="12" fill="${outfitColor}"/>
            <!-- 頭 -->
            <circle cx="16" cy="14" r="10" fill="${skinColor}"/>
            <!-- 髪 -->
            ${hairSVG}
            <!-- アクセサリー -->
            ${accessorySVG}
            <!-- 目 -->
            <circle cx="12" cy="12" r="2" fill="#000"/>
            <circle cx="20" cy="12" r="2" fill="#000"/>
        </svg>
    `;
}

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    // キャラクター作成画面にアバターカスタマイズボタンを追加
    setTimeout(() => {
        addAvatarCustomizationToCharacterCreation();
    }, 100);
});