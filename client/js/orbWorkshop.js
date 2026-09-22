// orbWorkshop.js
// ============================================================
// オーブ工房：オーブに関する操作を1か所にまとめたもの。
//   ・素材からオーブを作る（materials.jsのshowMaterialCraftingUIを埋め込み表示）
//   ・オーブ合成（低ティア→1つ上のティア）
//   ・勉強時間で貯まる「結晶」を使って、手持ちのオーブを厳選（リロール）する
//
// 結晶は player.craftCurrency = { chaos, divine, imprint } に保存する。
// 累計勉強時間（player.totalStudySeconds）が一定の間隔をまたぐたびに1個ずつ貯まる方式なので、
// 「25分＋10分」のように短い勉強を重ねても端数が失われない（追加の進捗フィールド不要）。
//
//   混沌の結晶 … 累計10分ごとに1個：ステータスの種類と数値を両方リロール
//   神聖の結晶 … 累計30分ごとに1個：ステータスの種類はそのまま、数値だけをリロール
//   刻印の結晶 … 累計60分ごとに1個：Tier4オーブの固有能力を3候補から選び直す
//                （ごくまれに、Tier4オーブが「ティア5オーブ」に覚醒する候補が追加で現れる）
//
// リロール結果は「新しい方にする／元のままにする」を選べる（結晶はどちらでも消費される）。
// 工房で触れるのは「所持オーブ（player.orbs）」だけで、武器に組み込み済みのオーブには影響しない。
//
// ※読み込み順：weapons.js（ORB_TIERS/ORB_UNIQUE_ABILITIES/ORB_STAT_TYPES）より後、
//   questionLists.js・script.js より前。index.html と battle.html（模擬戦闘の報酬用）の両方で読み込む。
// ============================================================

const CRAFT_CURRENCY_KEYS = ["chaos", "divine", "imprint"];

const CRAFT_CURRENCY_INFO = {
    chaos: {
        name: "混沌の結晶",
        icon: "🌀",
        studySeconds: 10 * 60,
        shortDesc: "ステータスの種類と数値を両方リロール"
    },
    divine: {
        name: "神聖の結晶",
        icon: "✨",
        studySeconds: 30 * 60,
        shortDesc: "ステータスの種類はそのまま、数値だけをリロール"
    },
    imprint: {
        name: "刻印の結晶",
        icon: "🔱",
        studySeconds: 60 * 60,
        shortDesc: "Tier4オーブの固有能力を3候補から選び直す"
    }
};

// 1回の勉強（勉強タイマー／模擬戦闘）で結晶の計算に含める時間の上限。
// タイマーを付けっぱなしにしても、結晶が際限なく増えないようにするためのガード。
const CRAFT_CURRENCY_MAX_SESSION_SECONDS = 3 * 60 * 60;

// 混沌の結晶のコスト（オーブのティアが高いほど高い）。神聖・刻印は一律1個。
const CHAOS_COST_BY_TIER = { tier1: 1, tier2: 1, tier3: 2, tier4: 3, tier5: 5 };
const DIVINE_COST = 1;
const IMPRINT_COST = 1;
const IMPRINT_CANDIDATE_COUNT = 3;
// 刻印の結晶を使ったとき、Tier4オーブが「ティア5オーブ」に覚醒する候補が追加で現れる確率。
// 刻印の結晶は累計60分の勉強で1個なので、平均すると約50個＝約50時間ぶんの勉強に1回の計算（ごくまれ）。
const IMPRINT_TIER5_CHANCE = 0.02;

// ------------------------------------------------------------
// 結晶の管理（純粋関数：battle.htmlの模擬戦闘報酬からも使う）
// ------------------------------------------------------------

function normalizeCraftCurrency(raw) {
    const result = {};
    for (const key of CRAFT_CURRENCY_KEYS) {
        const v = raw && Number.isFinite(raw[key]) ? Math.floor(raw[key]) : 0;
        result[key] = Math.max(0, v);
    }
    return result;
}

/**
 * 勉強時間に応じて貯まる結晶を計算する（保存はしない）。
 * @param {object} player - 勉強を反映する「前」のプレイヤー（totalStudySecondsが加算される前の値が必要）
 * @param {number} seconds - 今回の勉強時間（秒）
 * @returns {{currency:object, gain:object, capped:boolean}} currency=加算後の所持数, gain=今回の獲得数
 */
function grantStudyCraftCurrency(player, seconds) {
    const current = normalizeCraftCurrency(player && player.craftCurrency);
    const oldTotal = Math.max(0, Math.floor((player && player.totalStudySeconds) || 0));
    const sessionSeconds = Math.max(0, Math.floor(seconds || 0));
    const counted = Math.min(sessionSeconds, CRAFT_CURRENCY_MAX_SESSION_SECONDS);
    const newTotal = oldTotal + counted;

    const gain = {};
    const next = {};
    for (const key of CRAFT_CURRENCY_KEYS) {
        const step = CRAFT_CURRENCY_INFO[key].studySeconds;
        gain[key] = Math.max(0, Math.floor(newTotal / step) - Math.floor(oldTotal / step));
        next[key] = current[key] + gain[key];
    }
    return { currency: next, gain, capped: sessionSeconds > CRAFT_CURRENCY_MAX_SESSION_SECONDS };
}

/** 獲得した結晶を「混沌の結晶 +2 / 神聖の結晶 +1」の形に整形する。何も無ければ空文字。 */
function formatCraftCurrencyGain(gain) {
    if (!gain) return "";
    const parts = [];
    for (const key of CRAFT_CURRENCY_KEYS) {
        if (gain[key] > 0) parts.push(`${CRAFT_CURRENCY_INFO[key].icon}${CRAFT_CURRENCY_INFO[key].name} +${gain[key]}`);
    }
    return parts.join(" / ");
}

// ------------------------------------------------------------
// オーブのリロール（純粋関数：元のオーブは書き換えず、新しいオーブオブジェクトを返す）
// ------------------------------------------------------------

/** オーブの数値が、そのティアの範囲内のどのあたりか（0〜1）。範囲外は丸める。 */
function getOrbRollQuality(orb) {
    const range = orb && ORB_TIERS[orb.tier] && ORB_TIERS[orb.tier].statRange;
    if (!range) return 0;
    const [min, max] = range;
    if (max <= min) return 1;
    return Math.max(0, Math.min(1, (orb.bonus - min) / (max - min)));
}

function rollOrbBonusValue(tier) {
    const [min, max] = ORB_TIERS[tier].statRange;
    return Math.round((min + Math.random() * (max - min)) * 1000) / 1000;
}

function rollOrbStatType() {
    return ORB_STAT_TYPES[Math.floor(Math.random() * ORB_STAT_TYPES.length)];
}

function getOrbCraftCost(orb, kind) {
    if (!orb) return null;
    if (kind === "chaos") return CHAOS_COST_BY_TIER[orb.tier] || 1;
    if (kind === "divine") return DIVINE_COST;
    if (kind === "imprint") return orb.tier === "tier4" ? IMPRINT_COST : null;
    return null;
}

/**
 * Tier4オーブをTier5オーブに覚醒させた結果を作る（ステータスの種類はそのまま、数値はTier5の範囲で再抽選、
 * 固有能力はTier5専用のものからランダム）。IDは同じなので、採用すると元のオーブと入れ替わる。
 */
function rollTier5Orb(orb) {
    const keys = Object.keys(ORB_TIER5_ABILITIES);
    const key = keys[Math.floor(Math.random() * keys.length)];
    return {
        ...orb,
        tier: "tier5",
        rarity: (typeof ORB_TIER_RARITY_KEY !== "undefined" && ORB_TIER_RARITY_KEY.tier5) || "mythic",
        bonus: rollOrbBonusValue("tier5"),
        uniqueAbility: { key, ...ORB_TIER5_ABILITIES[key] }
    };
}

function rerollOrbChaos(orb) {
    return { ...orb, statType: rollOrbStatType(), bonus: rollOrbBonusValue(orb.tier) };
}

function rerollOrbDivine(orb) {
    return { ...orb, bonus: rollOrbBonusValue(orb.tier) };
}

function getImprintAbilityPool(excludeKey) {
    return Object.keys(ORB_UNIQUE_ABILITIES).filter(key => !key.startsWith("boss_") && key !== excludeKey);
}

/** 現在の能力を除いた固有能力から、重複なしでIMPRINT_CANDIDATE_COUNT個の候補オーブを作る。 */
function rollImprintCandidates(orb) {
    const pool = getImprintAbilityPool(orb.uniqueAbility && orb.uniqueAbility.key);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, IMPRINT_CANDIDATE_COUNT).map(key => ({
        ...orb,
        uniqueAbility: { key, ...ORB_UNIQUE_ABILITIES[key] }
    }));
}

// ------------------------------------------------------------
// 工房UI（index.htmlの「オーブ工房」セクション）
// ------------------------------------------------------------

// 結晶を消費済みで、まだ「採用／元のまま」を選んでいないリロール結果（画面を閉じたら破棄＝元のまま）
let workshopPending = null;
let workshopTierFilter = "all";

function escapeWorkshopHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function getWorkshopTierLabel(tier) {
    return (ORB_TIERS[tier] && ORB_TIERS[tier].name) || tier;
}

function describeWorkshopRoll(orb) {
    const statLabel = ORB_STAT_LABELS[orb.statType] || orb.statType;
    const quality = getOrbRollQuality(orb);
    const percent = Math.round(quality * 100);
    const perfect = quality >= 0.995;
    const cls = perfect ? "workshop-quality-perfect" : (quality >= 0.8 ? "workshop-quality-high" : (quality >= 0.4 ? "workshop-quality-mid" : "workshop-quality-low"));
    const label = perfect ? "★ 最高値！" : `品質 ${percent}%`;
    return `<strong>${escapeWorkshopHtml(statLabel)} +${Math.round(orb.bonus * 1000) / 10}%</strong> <span class="workshop-quality ${cls}">${label}</span>`;
}

/** ダンジョン産オーブが持つランダム付与効果（アフィックス）を表示する。無ければ空文字。 */
function describeWorkshopAffixes(orb) {
    if (!Array.isArray(orb.affixes) || orb.affixes.length === 0) return "";
    const lines = orb.affixes
        .map(a => `<div class="workshop-affix">・${escapeWorkshopHtml(a.label)} +${Math.round(a.bonus * 1000) / 10}%</div>`)
        .join("");
    return `<div class="workshop-affixes">${lines}</div>`;
}

function describeWorkshopAbility(orb) {
    if (!orb.uniqueAbility) return "";
    return `<div class="workshop-ability">★ ${escapeWorkshopHtml(orb.uniqueAbility.name)}<span class="workshop-ability-desc">${escapeWorkshopHtml(orb.uniqueAbility.description || "")}</span></div>`;
}

function renderWorkshopCurrency() {
    const box = document.getElementById("workshopCurrency");
    if (!box) return;
    const player = getPlayerData();
    const currency = normalizeCraftCurrency(player && player.craftCurrency);
    box.innerHTML = CRAFT_CURRENCY_KEYS.map(key => {
        const info = CRAFT_CURRENCY_INFO[key];
        return `<div class="workshop-currency-item">
            <div class="workshop-currency-icon">${info.icon}</div>
            <div class="workshop-currency-main">
                <div><strong>${info.name}</strong> × <span class="workshop-currency-count">${currency[key]}</span></div>
                <div class="workshop-currency-desc">${info.shortDesc}（累計${info.studySeconds / 60}分の勉強ごとに+1）</div>
            </div>
        </div>`;
    }).join("");
}

function renderOrbWorkshop() {
    renderWorkshopCurrency();
    const list = document.getElementById("workshopOrbList");
    if (!list) return;

    const player = getPlayerData();
    if (!player) {
        list.innerHTML = "<p>キャラクターを作成してください。</p>";
        return;
    }
    const currency = normalizeCraftCurrency(player.craftCurrency);
    let orbs = (player.orbs || []).filter(o => o && ORB_TIERS[o.tier]);
    if (workshopTierFilter !== "all") orbs = orbs.filter(o => o.tier === workshopTierFilter);

    if (orbs.length === 0) {
        list.innerHTML = workshopTierFilter === "all"
            ? "<p>オーブを所持していません。勉強・バトル・ダンジョンでオーブを集めましょう。</p>"
            : "<p>このティアのオーブは所持していません。</p>";
        return;
    }

    // ティアが高い順→品質が高い順に並べる（良いものが上に来る）
    orbs = orbs.slice().sort((a, b) => {
        if (a.tier !== b.tier) return b.tier.localeCompare(a.tier);
        return getOrbRollQuality(b) - getOrbRollQuality(a);
    });

    list.innerHTML = "";
    for (const orb of orbs) {
        const item = document.createElement("div");
        item.className = "workshop-orb-item";

        const info = document.createElement("div");
        info.className = "workshop-orb-info";
        const rarityBadge = (typeof getOrbRarityKey === "function" && typeof getRarityBadgeHtml === "function")
            ? getRarityBadgeHtml(getOrbRarityKey(orb))
            : "";
        info.innerHTML = `<div class="workshop-orb-title">${rarityBadge} ${escapeWorkshopHtml(getWorkshopTierLabel(orb.tier))}オーブ</div>
            <div>${describeWorkshopRoll(orb)}</div>
            ${describeWorkshopAffixes(orb)}
            ${describeWorkshopAbility(orb)}`;
        item.appendChild(info);

        const actions = document.createElement("div");
        actions.className = "workshop-orb-actions";
        for (const kind of CRAFT_CURRENCY_KEYS) {
            const cost = getOrbCraftCost(orb, kind);
            if (cost == null) continue;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-small btn-secondary";
            const cinfo = CRAFT_CURRENCY_INFO[kind];
            btn.textContent = `${cinfo.icon} ${cinfo.name.replace("の結晶", "")} ×${cost}`;
            btn.title = cinfo.shortDesc;
            if (currency[kind] < cost) {
                btn.disabled = true;
                btn.title = `${cinfo.name}が足りません（所持: ${currency[kind]}）`;
            }
            btn.addEventListener("click", () => startOrbCraft(orb.id, kind));
            actions.appendChild(btn);
        }
        item.appendChild(actions);
        list.appendChild(item);
    }
}

// ------------------------------------------------------------
// オーブ合成（以前はショップにあった機能。低ティアのオーブを複数消費して1つ上のティアを1個合成する）
// ------------------------------------------------------------
const ORB_SYNTHESIS_RECIPES = [
    { from: "tier1", to: "tier2", count: 5 },
    { from: "tier2", to: "tier3", count: 5 },
    { from: "tier3", to: "tier4", count: 10 }
];

function renderWorkshopSynthesis() {
    const box = document.getElementById("workshopSynthesis");
    if (!box) return;
    const player = getPlayerData();
    const orbs = (player && player.orbs) || [];
    box.innerHTML = "";
    for (const recipe of ORB_SYNTHESIS_RECIPES) {
        const have = orbs.filter(o => o && o.tier === recipe.from).length;
        const row = document.createElement("div");
        row.className = "workshop-synthesis-row";

        const label = document.createElement("div");
        label.className = "workshop-synthesis-label";
        label.textContent = `${getWorkshopTierLabel(recipe.from)}オーブ 所持 ${have}個`;
        row.appendChild(label);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-small btn-primary";
        btn.textContent = `${recipe.count}個で${getWorkshopTierLabel(recipe.to)}を合成`;
        btn.disabled = have < recipe.count;
        btn.addEventListener("click", () => synthesizeWorkshopOrbs(recipe));
        row.appendChild(btn);

        box.appendChild(row);
    }
}

/** 低ティアのオーブを指定数消費して、1つ上のティアのオーブを1個作る。品質の低いものから先に消費する。 */
function synthesizeWorkshopOrbs(recipe) {
    if (workshopPending) return; // 厳選の結果を選んでいる最中は合成しない
    const player = getPlayerData();
    if (!player) return;
    const orbs = player.orbs || [];

    // ID未設定の古いオーブがあってもまとめて消えないよう、IDではなく位置(index)で消費対象を決める
    const candidates = orbs
        .map((orb, index) => ({ orb, index }))
        .filter(item => item.orb && item.orb.tier === recipe.from);
    if (candidates.length < recipe.count) {
        alert(`${getWorkshopTierLabel(recipe.from)}オーブが${recipe.count}個必要です（現在: ${candidates.length}個）`);
        return;
    }
    candidates.sort((a, b) => getOrbRollQuality(a.orb) - getOrbRollQuality(b.orb));
    const consumeIndexes = new Set(candidates.slice(0, recipe.count).map(item => item.index));
    const remaining = orbs.filter((orb, index) => !consumeIndexes.has(index));

    const newOrb = createOrb(recipe.to);
    if (!newOrb) {
        alert("オーブの合成に失敗しました。");
        return;
    }
    remaining.push(newOrb);

    localStorage.setItem("player", JSON.stringify({ ...player, orbs: remaining }));
    // ミッション進捗はlocalStorageのプレイヤーを直接読み書きするので、保存の後に呼ぶ
    if (typeof updateMissionProgress === "function") updateMissionProgress("synthesize_orb");

    alert(`オーブを合成しました！\n新しいオーブ: ${getOrbDisplayName(newOrb)}`);
    savePlayerAfterWorkshop(getPlayerData());
}

/** 工房の全パーツ（結晶・素材からの作成・合成・厳選一覧）を最新の状態で描画し直す。 */
function refreshOrbWorkshopAll() {
    renderOrbWorkshop();
    renderWorkshopSynthesis();
    if (typeof showMaterialCraftingUI === "function" && document.getElementById("materialCraftingContainer")) {
        showMaterialCraftingUI();
    }
}

function savePlayerAfterWorkshop(player) {
    localStorage.setItem("player", JSON.stringify(player));
    if (typeof updateStatus === "function") {
        try { updateStatus(player); } catch (e) { console.warn("[Workshop] updateStatus failed:", e); }
    }
    if (typeof syncPlayerToServer === "function") syncPlayerToServer(true);
    if (typeof renderOrbInventory === "function") renderOrbInventory();
    renderOrbWorkshop();
    renderWorkshopSynthesis();
}

/** 結晶を消費してリロール結果を作り、「採用／元のまま」の選択モーダルを開く。 */
function startOrbCraft(orbId, kind) {
    if (workshopPending) return; // 前回の結果を選んでいる最中は新しいリロールを始めない
    const player = getPlayerData();
    if (!player) return;
    const orb = (player.orbs || []).find(o => o && o.id === orbId);
    if (!orb) { alert("オーブが見つかりません。"); renderOrbWorkshop(); return; }

    const cost = getOrbCraftCost(orb, kind);
    if (cost == null) { alert("このオーブにはこの結晶は使えません。"); return; }
    const currency = normalizeCraftCurrency(player.craftCurrency);
    if (currency[kind] < cost) {
        alert(`${CRAFT_CURRENCY_INFO[kind].name}が足りません（必要: ${cost}、所持: ${currency[kind]}）`);
        return;
    }

    let after = null;
    let candidates = null;
    let tier5 = null;
    if (kind === "chaos") after = rerollOrbChaos(orb);
    else if (kind === "divine") after = rerollOrbDivine(orb);
    else if (kind === "imprint") {
        candidates = rollImprintCandidates(orb);
        if (candidates.length === 0) { alert("選べる固有能力がありません。"); return; }
        // ごくまれに、ティア5オーブへの覚醒候補が追加で現れる
        if (Math.random() < IMPRINT_TIER5_CHANCE) tier5 = rollTier5Orb(orb);
    }

    // 結晶はここで先に消費して保存する（結果を見てから画面を閉じても再抽選できないようにするため）
    currency[kind] -= cost;
    savePlayerAfterWorkshop({ ...player, craftCurrency: currency });

    workshopPending = { orbId, kind, cost, before: orb, after, candidates, tier5 };
    renderWorkshopResultModal();
}

function renderWorkshopResultModal() {
    const modal = document.getElementById("workshopResultModal");
    const body = document.getElementById("workshopResultBody");
    if (!modal || !body || !workshopPending) return;
    const { kind, before, after, candidates, tier5 } = workshopPending;
    const info = CRAFT_CURRENCY_INFO[kind];

    let html = `<h3>${info.icon} ${info.name}を使いました</h3>`;
    html += `<p class="workshop-result-note">結晶は消費済みです。気に入らなければ「元のままにする」を選べます。</p>`;
    html += `<div class="workshop-result-block"><div class="workshop-result-label">今のオーブ（${escapeWorkshopHtml(getWorkshopTierLabel(before.tier))}）</div>
        <div>${describeWorkshopRoll(before)}</div>${describeWorkshopAbility(before)}</div>`;

    if (after) {
        html += `<div class="workshop-result-arrow">▼</div>`;
        html += `<div class="workshop-result-block workshop-result-new"><div class="workshop-result-label">リロール結果</div>
            <div>${describeWorkshopRoll(after)}</div>${describeWorkshopAbility(after)}</div>`;
        html += `<div class="workshop-result-buttons">
            <button type="button" class="btn btn-primary" id="workshopAcceptBtn">この結果にする</button>
            <button type="button" class="btn btn-secondary" id="workshopKeepBtn">元のままにする</button>
        </div>`;
    } else {
        if (tier5) {
            html += `<div class="workshop-result-block workshop-result-tier5">
                <div class="workshop-result-tier5-title">🌟 オーブが覚醒した！ ティア5オーブ 🌟</div>
                <div>${describeWorkshopRoll(tier5)}</div>${describeWorkshopAbility(tier5)}
                <button type="button" class="btn btn-primary" id="workshopTier5Btn">ティア5オーブにする</button>
            </div>`;
        }
        html += `<div class="workshop-result-arrow">▼ 新しい固有能力の候補（1つ選べます）</div>`;
        html += `<div class="workshop-candidate-list">`;
        candidates.forEach((c, i) => {
            html += `<div class="workshop-result-block workshop-result-new">
                ${describeWorkshopAbility(c)}
                <button type="button" class="btn btn-primary workshop-candidate-btn" data-candidate="${i}">この能力にする</button>
            </div>`;
        });
        html += `</div><div class="workshop-result-buttons">
            <button type="button" class="btn btn-secondary" id="workshopKeepBtn">元のままにする</button>
        </div>`;
    }
    body.innerHTML = html;
    modal.style.display = "flex";

    const acceptBtn = document.getElementById("workshopAcceptBtn");
    if (acceptBtn) acceptBtn.addEventListener("click", () => finishOrbCraft(after));
    body.querySelectorAll(".workshop-candidate-btn").forEach(btn => {
        btn.addEventListener("click", () => finishOrbCraft(candidates[Number(btn.dataset.candidate)]));
    });
    const tier5Btn = document.getElementById("workshopTier5Btn");
    if (tier5Btn) tier5Btn.addEventListener("click", () => finishOrbCraft(tier5));
    const keepBtn = document.getElementById("workshopKeepBtn");
    if (keepBtn) keepBtn.addEventListener("click", () => finishOrbCraft(null));
}

/** 選んだ結果（null＝元のまま）を確定して、モーダルを閉じる。 */
function finishOrbCraft(chosenOrb) {
    const pending = workshopPending;
    workshopPending = null;
    const modal = document.getElementById("workshopResultModal");
    if (modal) modal.style.display = "none";
    if (!pending) return;

    if (chosenOrb) {
        // 選んでいる間に状態が変わっている可能性があるので、保存済みの最新データを読み直して差し替える
        const player = getPlayerData();
        const index = player ? (player.orbs || []).findIndex(o => o && o.id === pending.orbId) : -1;
        if (index === -1) {
            alert("オーブが見つからなかったため、結果を反映できませんでした。");
        } else {
            const orbs = player.orbs.slice();
            orbs[index] = chosenOrb;
            savePlayerAfterWorkshop({ ...player, orbs });
            if (chosenOrb.tier === "tier5" && pending.before.tier !== "tier5") {
                alert("🌟 ティア5オーブが誕生しました！\n" + (chosenOrb.uniqueAbility ? "固有能力：" + chosenOrb.uniqueAbility.name : ""));
            }
            return;
        }
    }
    renderOrbWorkshop();
}

function initOrbWorkshopUI() {
    const filter = document.getElementById("workshopTierFilter");
    if (filter) {
        filter.addEventListener("change", () => {
            workshopTierFilter = filter.value;
            renderOrbWorkshop();
        });
    }
    refreshOrbWorkshopAll();
}

// ------------------------------------------------------------
// デバッグ用（ブラウザのコンソールから）：giveDebugCraftCurrency(10, 5, 3)
// ------------------------------------------------------------
function giveDebugCraftCurrency(chaos = 0, divine = 0, imprint = 0) {
    const player = getPlayerData();
    if (!player) { console.warn("キャラクターがありません"); return null; }
    const current = normalizeCraftCurrency(player.craftCurrency);
    current.chaos += Math.max(0, Math.floor(chaos));
    current.divine += Math.max(0, Math.floor(divine));
    current.imprint += Math.max(0, Math.floor(imprint));
    localStorage.setItem("player", JSON.stringify({ ...player, craftCurrency: current }));
    if (typeof renderOrbWorkshop === "function") renderOrbWorkshop();
    console.log("[Workshop] 結晶を付与しました:", current);
    return current;
}
window.giveDebugCraftCurrency = giveDebugCraftCurrency;
window.renderOrbWorkshop = renderOrbWorkshop;
window.refreshOrbWorkshopAll = refreshOrbWorkshopAll;
window.renderWorkshopSynthesis = renderWorkshopSynthesis;
window.initOrbWorkshopUI = initOrbWorkshopUI;
