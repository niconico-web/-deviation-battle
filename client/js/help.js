document.addEventListener('DOMContentLoaded', () => {
    const uniqueAbilitiesList = document.getElementById('unique-abilities-list');

    if (uniqueAbilitiesList && typeof ORB_UNIQUE_ABILITIES !== 'undefined') {
        uniqueAbilitiesList.innerHTML = ''; // 既存のコンテンツをクリア
        // ORB_UNIQUE_ABILITIES オブジェクトをループ処理
        for (const key in ORB_UNIQUE_ABILITIES) {
            if (Object.hasOwnProperty.call(ORB_UNIQUE_ABILITIES, key)) {
                const ability = ORB_UNIQUE_ABILITIES[key];

                // 能力を表示するHTML要素を作成
                const abilityElement = document.createElement('div');
                abilityElement.className = 'ability-item';

                const nameElement = document.createElement('h3');
                nameElement.textContent = ability.name;

                const descriptionElement = document.createElement('p');
                descriptionElement.textContent = ability.description;

                // 要素を組み立て
                abilityElement.appendChild(nameElement);
                abilityElement.appendChild(descriptionElement);

                // リストに追加
                uniqueAbilitiesList.appendChild(abilityElement);
            }
        }
    } else {
        if (!uniqueAbilitiesList) {
            console.error('Element with ID "unique-abilities-list" not found.');
        }
        if (typeof ORB_UNIQUE_ABILITIES === 'undefined') {
            console.error('ORB_UNIQUE_ABILITIES is not defined. Make sure weapons.js is loaded.');
        }
    }
});
