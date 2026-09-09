document.addEventListener('DOMContentLoaded', () => {
    const uniqueAbilitiesList = document.getElementById('unique-abilities-list');

    // 'unique-abilities-list' というIDを持つ要素がページに存在しない場合は、何もしない
    // これにより、help.html 以外のページでこのスクリプトが読み込まれてもエラーが発生しなくなります。
    if (!uniqueAbilitiesList) {
        return;
    }

    if (typeof ORB_UNIQUE_ABILITIES !== 'undefined') {
        uniqueAbilitiesList.innerHTML = ''; // 既存のコンテンツをクリア
        for (const key in ORB_UNIQUE_ABILITIES) {
            if (Object.hasOwnProperty.call(ORB_UNIQUE_ABILITIES, key)) {
                const ability = ORB_UNIQUE_ABILITIES[key];

                const abilityElement = document.createElement('div');
                abilityElement.className = 'ability-item'; // スタイルはCSSで調整してください

                const nameElement = document.createElement('h3');
                nameElement.textContent = ability.name;

                const descriptionElement = document.createElement('p');
                descriptionElement.textContent = ability.description;

                abilityElement.appendChild(nameElement);
                abilityElement.appendChild(descriptionElement);
                uniqueAbilitiesList.appendChild(abilityElement);
            }
        }
    } else {
        console.error('ORB_UNIQUE_ABILITIES is not defined. Make sure weapons.js is loaded.');
    }
});
