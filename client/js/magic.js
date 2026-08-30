// client/js/magic.js
// 魔術システム

const MAGIC_DATA = {
    // 魔法系
    harpy_feather: { id: 'harpy_feather', name: 'ハーピーの羽', type: 'magic', effect: 'damage_boost_1.2', duration: 20 * 60 * 1000, description: '20分間、ダメージが1.2倍になる' },
    magic_powder: { id: 'magic_powder', name: '魔法の粉', type: 'magic', effect: 'damage_boost_1.15', duration: 15 * 60 * 1000, description: '15分間、ダメージが1.15倍になる' },
    ancient_scroll: { id: 'ancient_scroll', name: '古代の巻物', type: 'magic', effect: 'damage_boost_1.25', duration: 25 * 60 * 1000, description: '25分間、ダメージが1.25倍になる' },
    phoenix_feather: { id: 'phoenix_feather', name: 'フェニックスの羽', type: 'magic', effect: 'revive_battle', duration: 0, description: '次のバトルで一度だけ復活する' },
    unicorn_horn: { id: 'unicorn_horn', name: 'ユニコーンの角', type: 'magic', effect: 'heal_30', duration: 0, description: '次のバトル開始時にHPを30%回復' },
    chimera_eye: { id: 'chimera_eye', name: 'キメラの目', type: 'magic', effect: 'predict_enemy', duration: 0, description: '次のバトルで相手のステータスを下げる' },
    elemental_core: { id: 'elemental_core', name: 'エレメンタルの核', type: 'magic', effect: 'damage_boost_1.3', duration: 30 * 60 * 1000, description: '30分間、ダメージが1.3倍になる' },
    moon_stone: { id: 'moon_stone', name: 'ムーンストーン', type: 'magic', effect: 'enemy_speed_debuff', duration: 1, description: '次のバトルで相手の速さを下げる' },
    sun_crystal: { id: 'sun_crystal', name: 'サンクリスタル', type: 'magic', effect: 'damage_boost_1.35', duration: 35 * 60 * 1000, description: '35分間、ダメージが1.35倍になる' },
    abyss_gem: { id: 'abyss_gem', name: 'アビスジェム', type: 'magic', effect: 'enemy_all_debuff', duration: 1, description: '次のバトルで相手の全ステータスを下げる' },
    world_tree_leaf: { id: 'world_tree_leaf', name: '世界樹の葉', type: 'magic', effect: 'heal_50', duration: 0, description: '次のバトル開始時にHPを50%回復' },
    time_sand: { id: 'time_sand', name: '時の砂', type: 'magic', effect: 'skip_turn', duration: 0, description: '次のバトルで相手を1ターンスキップさせる' },
    void_essence: { id: 'void_essence', name: '虚空のエッセンス', type: 'magic', effect: 'damage_boost_1.4', duration: 40 * 60 * 1000, description: '40分間、ダメージが1.4倍になる' },
    firefly_light: { id: 'firefly_light', name: 'ホタルの光', type: 'magic', effect: 'damage_boost_1.1', duration: 10 * 60 * 1000, description: '10分間、ダメージが1.1倍になる' },
    shaman_totem: { id: 'shaman_totem', name: 'シャーマンの護符', type: 'magic', effect: 'damage_boost_1.15', duration: 15 * 60 * 1000, description: '15分間、ダメージが1.15倍になる' },
    kappa_plate: { id: 'kappa_plate', name: '河童の皿', type: 'magic', effect: 'enemy_def_debuff', duration: 1, description: '次のバトルで相手の防御を下げる' },
    tengu_fan: { id: 'tengu_fan', name: '天狗の羽団扇', type: 'magic', effect: 'damage_boost_1.2', duration: 20 * 60 * 1000, description: '20分間、ダメージが1.2倍になる' },
    banshee_wail: { id: 'banshee_wail', name: 'バンシーの絶叫石', type: 'magic', effect: 'enemy_accuracy_debuff', duration: 1, description: '次のバトルで相手の命中率を下げる' },
    lich_phylactery: { id: 'lich_phylactery', name: 'リッチの魂器', type: 'magic', effect: 'revive_full', duration: 0, description: '次のバトルで一度だけ完全に復活する' },
    storm_feather: { id: 'storm_feather', name: '嵐の羽根', type: 'magic', effect: 'damage_boost_1.25', duration: 25 * 60 * 1000, description: '25分間、ダメージが1.25倍になる' },
    serpent_scale: { id: 'serpent_scale', name: 'シーサーペントの鱗', type: 'magic', effect: 'enemy_atk_debuff', duration: 1, description: '次のバトルで相手の攻撃を下げる' },
    crystal_shard: { id: 'crystal_shard', name: 'クリスタルの欠片', type: 'magic', effect: 'damage_boost_1.1', duration: 10 * 60 * 1000, description: '10分間、ダメージが1.1倍になる' },
    star_dragon_scale: { id: 'star_dragon_scale', name: '星龍の鱗', type: 'magic', effect: 'damage_boost_1.4', duration: 40 * 60 * 1000, description: '40分間、ダメージが1.4倍になる' },
    reaper_scythe_shard: { id: 'reaper_scythe_shard', name: '死神の鎌の欠片', type: 'magic', effect: 'instant_kill_chance', duration: 1, description: '次のバトルで10%の確率で即死させる' },
    dream_dust: { id: 'dream_dust', name: '夢の砂', type: 'magic', effect: 'enemy_sleep', duration: 1, description: '次のバトルで相手を眠らせる' },
    gravity_orb: { id: 'gravity_orb', name: '重力の球', type: 'magic', effect: 'enemy_speed_debuff_strong', duration: 1, description: '次のバトルで相手の速さを大幅に下げる' },
    sphinx_riddle_stone: { id: 'sphinx_riddle_stone', name: 'スフィンクスの謎石', type: 'magic', effect: 'damage_boost_1.3', duration: 30 * 60 * 1000, description: '30分間、ダメージが1.3倍になる' },
    
    // 呪術系
    crow_feather: { id: 'crow_feather', name: 'カラスの羽', type: 'curse', effect: 'enemy_atk_debuff', duration: 1, description: '次のバトルで相手の攻撃を下げる' },
    hag_eye: { id: 'hag_eye', name: '魔女の目', type: 'curse', effect: 'enemy_def_debuff', duration: 1, description: '次のバトルで相手の防御を下げる' },
    cursed_thread: { id: 'cursed_thread', name: '呪いの糸', type: 'curse', effect: 'enemy_speed_debuff', duration: 1, description: '次のバトルで相手の速さを下げる' },
    basilisk_eye: { id: 'basilisk_eye', name: 'バジリスクの目', type: 'curse', effect: 'enemy_petrify', duration: 1, description: '次のバトルで相手を石化させる' },
    wraith_shroud: { id: 'wraith_shroud', name: 'レイスの死装束', type: 'curse', effect: 'drain_hp', duration: 1, description: '次のバトルで与えたダメージの20%を吸収' },
    celestial_ash: { id: 'celestial_ash', name: '天界の灰', type: 'curse', effect: 'revive_full', duration: 0, description: '次のバトルで一度だけ完全に復活する' },
    blight_scale: { id: 'blight_scale', name: '疫龍の鱗', type: 'curse', effect: 'enemy_poison', duration: 3, description: '次のバトルで相手を毒状態にする' },
};

// 武器素材として使用できる素材ID
const WEAPON_MATERIALS = [
    'goblin_fang',
    'orc_horn',
    'minotaur_horn',
    'ogre_fist',
    'silver_ore',
    'dragon_bone',
    'griffin_claw',
    'titan_stone',
    'dragon_soul',
    'divine_crystal',
    'hornet_stinger',
    'scorpion_tail',
    'jackal_fang',
    'oni_horn_fragment',
    'manticore_stinger',
    'werebear_claw',
    'world_serpent_fang'
];

/**
 * プレイヤーのアクティブな魔術効果を取得
 */
function getActiveMagicEffects() {
    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    if (!player) return [];
    
    const effects = player.activeMagicEffects || [];
    const now = Date.now();
    
    // 期限切れの効果を削除
    const validEffects = effects.filter(effect => {
        if (effect.duration === 0) return true; // バトル限定効果は削除しない
        return effect.expiryTime > now;
    });
    
    // 期限切れの効果があれば保存
    if (validEffects.length !== effects.length) {
        player.activeMagicEffects = validEffects;
        localStorage.setItem("player", JSON.stringify(player));
    }
    
    return validEffects;
}

/**
 * 魔術を使用する
 */
function useMagic(materialId) {
    const magic = MAGIC_DATA[materialId];
    if (!magic) {
        alert('不明な魔術です');
        return false;
    }
    
    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    if (!player) {
        alert('キャラクターを作成してください');
        return false;
    }
    
    const materials = player.materials || {};
    if (!materials[materialId] || materials[materialId] < 1) {
        alert('素材がありません');
        return false;
    }
    
    // 素材を消費
    materials[materialId]--;
    if (materials[materialId] <= 0) {
        delete materials[materialId];
    }
    
    // 効果を適用
    player.activeMagicEffects = player.activeMagicEffects || [];
    
    if (magic.duration > 0) {
        // 時間制限のある効果
        const expiryTime = Date.now() + magic.duration;
        player.activeMagicEffects.push({
            effect: magic.effect,
            expiryTime: expiryTime,
            description: magic.description
        });
    } else {
        // バトル限定効果（次のバトルで使用）
        player.pendingMagicEffect = {
            effect: magic.effect,
            description: magic.description
        };
    }
    
    localStorage.setItem("player", JSON.stringify(player));
    
    alert(`${magic.name}を使用しました！\n${magic.description}`);
    return true;
}

/**
 * 魔術によるダメージ倍率を計算
 */
function getMagicDamageMultiplier() {
    const effects = getActiveMagicEffects();
    let multiplier = 1.0;
    
    for (const effect of effects) {
        switch (effect.effect) {
            case 'damage_boost_1.1':
                multiplier *= 1.1;
                break;
            case 'damage_boost_1.15':
                multiplier *= 1.15;
                break;
            case 'damage_boost_1.2':
                multiplier *= 1.2;
                break;
            case 'damage_boost_1.25':
                multiplier *= 1.25;
                break;
            case 'damage_boost_1.3':
                multiplier *= 1.3;
                break;
            case 'damage_boost_1.35':
                multiplier *= 1.35;
                break;
            case 'damage_boost_1.4':
                multiplier *= 1.4;
                break;
        }
    }
    
    return multiplier;
}

/**
 * 魔術メニューを表示
 */
function showMagicMenu() {
    const container = document.getElementById('magicMenuContainer');
    if (!container) {
        console.warn("Magic menu container not found");
        return;
    }
    
    const player = typeof getPlayerData === 'function' ? getPlayerData() : null;
    if (!player) {
        container.innerHTML = '<p>キャラクターを作成してください。</p>';
        return;
    }
    
    const materials = player.materials || {};
    const activeEffects = getActiveMagicEffects();
    const pendingEffect = player.pendingMagicEffect;
    
    let html = '<h3>魔術</h3>';
    
    // アクティブな効果を表示
    if (activeEffects.length > 0 || pendingEffect) {
        html += '<div class="active-magic-effects"><h4>発動中の効果</h4>';
        
        for (const effect of activeEffects) {
            const remainingTime = Math.max(0, Math.floor((effect.expiryTime - Date.now()) / 1000));
            const minutes = Math.floor(remainingTime / 60);
            const seconds = remainingTime % 60;
            html += `<div class="magic-effect-active">${effect.description} (残り${minutes}分${seconds}秒)</div>`;
        }
        
        if (pendingEffect) {
            html += `<div class="magic-effect-pending">${pendingEffect.description} (次のバトルで発動)</div>`;
        }
        
        html += '</div>';
    }
    
    // 使用可能な魔術を表示
    html += '<div class="magic-list"><h4>使用可能な魔術</h4>';
    
    let hasMagic = false;
    for (const [materialId, magic] of Object.entries(MAGIC_DATA)) {
        if (materials[materialId] && materials[materialId] > 0) {
            hasMagic = true;
            html += `
                <div class="magic-item">
                    <div class="magic-info">
                        <strong>${magic.name}</strong>
                        <span class="magic-count">x ${materials[materialId]}</span>
                        <p class="magic-description">${magic.description}</p>
                    </div>
                    <button class="btn btn-small use-magic-btn" data-material="${materialId}">使用</button>
                </div>
            `;
        }
    }
    
    if (!hasMagic) {
        html += '<p>使用可能な魔術素材がありません。</p>';
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // イベントリスナーを設定
    container.querySelectorAll('.use-magic-btn').forEach(btn => {
        btn.onclick = () => {
            if (useMagic(btn.dataset.material)) {
                showMagicMenu(); // メニューを再描画
            }
        };
    });
}

/**
 * 魔術システムを初期化
 */
function initMagicSystem() {
    console.log("Initializing magic system.");
    
    // メニューボタンのイベントリスナーを設定
    const magicMenuBtn = document.querySelector('.menu-btn[data-section="magic"]');
    if (magicMenuBtn) {
        magicMenuBtn.onclick = () => {
            showMagicMenu();
        };
    }
}
