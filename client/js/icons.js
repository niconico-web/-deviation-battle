// client/js/icons.js
// 武器タイプ・ボスごとのシンプルなアイコン風SVGイラストを提供する。
// 既存のテキストのみの表示に、視覚的なアイコンを追加するためのモジュール。

const WEAPON_ICON_DATA = {
    sword_shield: { color: "#9fb3c8", inner: `
        <path d="M32 14 L48 20 L48 34 C48 46 40 52 32 56 C24 52 16 46 16 34 L16 20 Z" fill="none"/>
        <line x1="32" y1="20" x2="32" y2="46"/>
        <line x1="25" y1="27" x2="39" y2="27"/>
    ` },
    spear: { color: "#c8c8c8", inner: `
        <line x1="16" y1="50" x2="44" y2="20"/>
        <path d="M44 20 L52 12 L56 20 L48 26 Z" fill="currentColor" stroke="none"/>
        <line x1="24" y1="42" x2="28" y2="38"/>
    ` },
    greatsword: { color: "#c8c8c8", inner: `
        <path d="M28 10 L36 10 L36 38 L32 44 L28 38 Z" fill="currentColor" stroke="none"/>
        <line x1="18" y1="40" x2="46" y2="40"/>
        <line x1="32" y1="40" x2="32" y2="52"/>
        <circle cx="32" cy="55" r="2.6" fill="currentColor" stroke="none"/>
    ` },
    dual_swords: { color: "#c8c8c8", inner: `
        <line x1="16" y1="48" x2="46" y2="18"/>
        <line x1="22" y1="34" x2="30" y2="26"/>
        <line x1="18" y1="18" x2="48" y2="48"/>
        <line x1="34" y1="26" x2="42" y2="34"/>
    ` },
    scythe: { color: "#b7d6b0", inner: `
        <line x1="18" y1="54" x2="36" y2="22"/>
        <path d="M36 22 C48 12 60 18 58 28 C56 36 46 38 40 32" fill="none" stroke-width="3.2"/>
    ` },
    pistol: { color: "#c8c8c8", inner: `
        <path d="M16 26 H46 V32 H32 L30 40 H26 V48 H18 V34 H16 Z" fill="currentColor" stroke="none"/>
    ` },
    katana: { color: "#dcdcdc", inner: `
        <path d="M18 48 Q28 22 46 16" fill="none" stroke-width="3.2"/>
        <circle cx="20" cy="45" r="3" fill="none"/>
        <line x1="16" y1="50" x2="12" y2="54"/>
    ` },
    magic_wand: { color: "#c9a6ff", inner: `
        <line x1="20" y1="52" x2="40" y2="24"/>
        <path d="M44 8 L46.5 15 L54 17 L46.5 19 L44 26 L41.5 19 L34 17 L41.5 15 Z" fill="currentColor" stroke="none"/>
    ` },
    gloves: { color: "#e0b98a", inner: `
        <rect x="20" y="26" width="24" height="20" rx="8" fill="none"/>
        <circle cx="17" cy="36" r="5" fill="none"/>
        <line x1="26" y1="26" x2="26" y2="20"/>
        <line x1="32" y1="26" x2="32" y2="18"/>
        <line x1="38" y1="26" x2="38" y2="20"/>
    ` },
    shoes: { color: "#8fd0e0", inner: `
        <path d="M20 44 V30 H30 V36 C34 36 40 34 44 34 C49 34 52 38 52 44 Z" fill="currentColor" stroke="none"/>
        <line x1="20" y1="44" x2="52" y2="44" stroke="#10151c" stroke-width="1.6"/>
    ` },
    bow: { color: "#d8c090", inner: `
        <path d="M22 14 Q40 32 22 50" fill="none"/>
        <line x1="22" y1="14" x2="22" y2="50"/>
        <line x1="16" y1="32" x2="42" y2="32"/>
        <path d="M42 32 L36 28 L36 36 Z" fill="currentColor" stroke="none"/>
    ` },
    esper: { color: "#ff9ad1", inner: `
        <ellipse cx="32" cy="32" rx="17" ry="9" fill="none"/>
        <circle cx="32" cy="32" r="5" fill="currentColor" stroke="none"/>
        <line x1="32" y1="16" x2="32" y2="21"/>
        <line x1="32" y1="43" x2="32" y2="48"/>
        <line x1="12" y1="32" x2="17" y2="32"/>
        <line x1="47" y1="32" x2="52" y2="32"/>
    ` },
};

const BOSS_ICON_DATA = {
    goblin_king: { color: "#8fbf5f", inner: `
        <path d="M16 42 L16 26 L24 34 L32 18 L40 34 L48 26 L48 42 Z" fill="currentColor" stroke="none"/>
        <rect x="16" y="42" width="32" height="6" fill="currentColor" stroke="none"/>
        <circle cx="24" cy="26" r="2" fill="none"/>
        <circle cx="40" cy="26" r="2" fill="none"/>
    ` },
    forest_witch: { color: "#a984d6", inner: `
        <path d="M32 12 L45 46 L19 46 Z" fill="currentColor" stroke="none"/>
        <ellipse cx="32" cy="46" rx="17" ry="4" fill="none"/>
        <path d="M32 12 L34.5 18 L41 19.5 L34.5 21 L32 27 L29.5 21 L23 19.5 L29.5 18 Z" fill="#1b232f" stroke="#1b232f" stroke-width="1"/>
    ` },
    orc_warlord: { color: "#c98a4b", inner: `
        <line x1="24" y1="14" x2="24" y2="52"/>
        <path d="M24 16 L44 20 C52 22 52 32 44 34 L24 30 L30 23 Z" fill="currentColor" stroke="none"/>
    ` },
    rock_troll: { color: "#9b9b9b", inner: `
        <path d="M20 46 L17 32 L26 19 L39 17 L49 27 L46 41 L35 49 L23 49 Z" fill="currentColor" stroke="none"/>
        <path d="M26 30 L31 35 L27 40" fill="none" stroke="#555" stroke-width="1.6"/>
        <path d="M38 26 L36 32" fill="none" stroke="#555" stroke-width="1.6"/>
    ` },
    shadow_serpent: { color: "#7a5fbf", inner: `
        <path d="M44 18 C52 24 50 34 42 36 C34 38 28 32 32 27 C34 24 38 26 37 30" fill="none"/>
        <path d="M44 18 L51 14 L50 22 Z" fill="currentColor" stroke="none"/>
        <circle cx="47" cy="18" r="1.4" fill="#fff" stroke="none"/>
    ` },
    sand_worm: { color: "#d9c07a", inner: `
        <circle cx="32" cy="44" r="10" fill="none"/>
        <circle cx="30" cy="30" r="7.5" fill="none"/>
        <circle cx="34" cy="19" r="5" fill="none"/>
        <path d="M29 16 L34 12 L39 16" fill="none"/>
        <line x1="16" y1="52" x2="48" y2="52"/>
    ` },
    ice_golem: { color: "#8fd3ff", inner: `
        <rect x="20" y="18" width="24" height="30" rx="7" fill="none"/>
        <g stroke-width="1.8">
        <line x1="32" y1="26" x2="32" y2="40"/>
        <line x1="25" y1="29.5" x2="39" y2="36.5"/>
        <line x1="25" y1="36.5" x2="39" y2="29.5"/>
        </g>
    ` },
    thunder_garuda: { color: "#f2d35c", inner: `
        <path d="M14 34 L28 29 L23 40 Z" fill="currentColor" stroke="none"/>
        <path d="M50 34 L36 29 L41 40 Z" fill="currentColor" stroke="none"/>
        <path d="M35 14 L26 34 L32 34 L28 50 L42 28 L34 28 Z" fill="currentColor" stroke="none"/>
    ` },
    flame_dragon: { color: "#f0703a", inner: `
        <path d="M32 50 C22 40 22 28 32 14 C42 28 42 40 32 50 Z" fill="currentColor" stroke="none"/>
        <path d="M27 20 L23 12" />
        <path d="M37 20 L41 12" />
    ` },
    kraken: { color: "#4fa3a3", inner: `
        <ellipse cx="32" cy="22" rx="11" ry="9" fill="none"/>
        <path d="M22 26 C14 32 18 42 12 50" fill="none"/>
        <path d="M28 30 C24 38 30 44 26 52" fill="none"/>
        <path d="M36 30 C40 38 34 44 38 52" fill="none"/>
        <path d="M42 26 C50 32 46 42 52 50" fill="none"/>
    ` },
    abyssal_knight: { color: "#7d8fa8", inner: `
        <path d="M20 40 C20 22 44 22 44 40 L44 46 L20 46 Z" fill="none"/>
        <rect x="24" y="34" width="16" height="4" fill="currentColor" stroke="none"/>
        <path d="M28 22 L32 12 L36 22" fill="none"/>
    ` },
    blood_count: { color: "#c23b5a", inner: `
        <ellipse cx="32" cy="30" rx="4" ry="6" fill="currentColor" stroke="none"/>
        <path d="M32 28 C24 20 14 24 18 33 C22 30 28 30 32 30 Z" fill="currentColor" stroke="none"/>
        <path d="M32 28 C40 20 50 24 46 33 C42 30 36 30 32 30 Z" fill="currentColor" stroke="none"/>
        <path d="M32 40 C29 44 29 48 32 51 C35 48 35 44 32 40 Z" fill="currentColor" stroke="none"/>
    ` },
    celestial_guardian: { color: "#f5e6a8", inner: `
        <circle cx="32" cy="16" r="5.5" fill="none"/>
        <path d="M31 26 L31 46" stroke-width="2.2"/>
        <path d="M31 30 C22 26 14 30 10 38 C18 38 24 38 30 34" fill="none" stroke-width="2.4"/>
        <path d="M31 30 C40 26 48 30 52 38 C44 38 38 38 32 34" fill="none" stroke-width="2.4"/>
    ` },
    fallen_lucifer: { color: "#c23b3b", inner: `
        <path d="M25 20 C20 14 22 8 26 12 C27 15 27 18 25 20 Z" fill="currentColor" stroke="none"/>
        <path d="M39 20 C44 14 42 8 38 12 C37 15 37 18 39 20 Z" fill="currentColor" stroke="none"/>
        <path d="M31 28 L31 46" stroke-width="2.2"/>
        <path d="M31 30 C22 28 12 32 10 42 C16 40 20 42 24 38 C22 44 18 46 14 50 C22 50 28 46 30 40" fill="none" stroke-width="2.2"/>
        <path d="M31 30 C40 28 50 32 52 42 C46 40 42 42 38 38 C40 44 44 46 48 50 C40 50 34 46 32 40" fill="none" stroke-width="2.2"/>
    ` },
    abyss_warden: { color: "#8a4fc2", inner: `
        <path d="M12 32 C18 22 46 22 52 32 C46 42 18 42 12 32 Z" fill="none" stroke-width="2.4"/>
        <ellipse cx="32" cy="32" rx="3" ry="7" fill="currentColor" stroke="none"/>
    ` },
};

// 未定義のタイプ・IDが来た場合のフォールバックアイコン（「？」マーク）
const FALLBACK_ICON = { color: "#8a8f98", inner: `
    <path d="M26 24 C26 18 38 18 38 24 C38 29 32 29 32 34" fill="none"/>
    <circle cx="32" cy="42" r="1.8" fill="currentColor" stroke="none"/>
` };

/**
 * 円形バッジ型のアイコンSVGを生成する。
 * @param {{color:string, inner:string}} data - アイコンの色と中身のSVGパス
 * @param {number} size - 表示サイズ(px)
 */
function renderIconBadgeSVG(data, size = 48) {
    const d = data || FALLBACK_ICON;
    return `<svg class="icon-badge" width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">` +
        `<circle cx="32" cy="32" r="30" fill="#1b232f" stroke="${d.color}" stroke-width="2.5"/>` +
        `<g fill="none" stroke="${d.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" color="${d.color}">${d.inner}</g>` +
        `</svg>`;
}

/**
 * 武器タイプに対応するアイコンSVGを取得する。
 * @param {string} type - 武器タイプ（例: "katana", "bow" など）
 * @param {number} size - 表示サイズ(px)
 */
function getWeaponIconSVG(type, size = 48) {
    return renderIconBadgeSVG(WEAPON_ICON_DATA[type], size);
}

/**
 * ボスIDに対応するアイコンSVGを取得する。
 * @param {string} bossId - ボスID（例: "goblin_king" など）
 * @param {number} size - 表示サイズ(px)
 */
function getBossIconSVG(bossId, size = 48) {
    return renderIconBadgeSVG(BOSS_ICON_DATA[bossId], size);
}
