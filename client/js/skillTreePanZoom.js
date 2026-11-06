// ============================================
// スキルツリー パン・ズーム機能
// ============================================

let panZoomState = {
    scale: 1,
    panning: false,
    pointX: 0,
    pointY: 0,
    startX: 0,
    startY: 0
};

function initPanZoom(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const innerContent = container.querySelector('.skill-tree-inner') || container;
    
    // マウスホイールでズーム
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(panZoomState.scale * delta, 0.3), 3);
        
        // マウス位置を基準にズーム
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        panZoomState.pointX = mouseX - (mouseX - panZoomState.pointX) * (newScale / panZoomState.scale);
        panZoomState.pointY = mouseY - (mouseY - panZoomState.pointY) * (newScale / panZoomState.scale);
        panZoomState.scale = newScale;
        
        updateTransform(innerContent);
    }, { passive: false });
    
    // マウスドラッグでパン
    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // 左クリックのみ
        panZoomState.panning = true;
        panZoomState.startX = e.clientX - panZoomState.pointX;
        panZoomState.startY = e.clientY - panZoomState.pointY;
        container.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!panZoomState.panning) return;
        e.preventDefault();
        panZoomState.pointX = e.clientX - panZoomState.startX;
        panZoomState.pointY = e.clientY - panZoomState.startY;
        updateTransform(innerContent);
    });
    
    document.addEventListener('mouseup', () => {
        panZoomState.panning = false;
        container.style.cursor = 'grab';
    });
    
    // タッチ操作（モバイル対応）
    let lastTouchDistance = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // ピンチズーム
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
            lastTouchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
        } else if (e.touches.length === 1) {
            // パン
            panZoomState.panning = true;
            panZoomState.startX = e.touches[0].clientX - panZoomState.pointX;
            panZoomState.startY = e.touches[0].clientY - panZoomState.pointY;
        }
    });
    
    container.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 2) {
            // ピンチズーム
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (lastTouchDistance > 0) {
                const delta = distance / lastTouchDistance;
                const newScale = Math.min(Math.max(panZoomState.scale * delta, 0.3), 3);
                
                const rect = container.getBoundingClientRect();
                const centerX = lastTouchCenter.x - rect.left;
                const centerY = lastTouchCenter.y - rect.top;
                
                panZoomState.pointX = centerX - (centerX - panZoomState.pointX) * (newScale / panZoomState.scale);
                panZoomState.pointY = centerY - (centerY - panZoomState.pointY) * (newScale / panZoomState.scale);
                panZoomState.scale = newScale;
                
                updateTransform(innerContent);
            }
            
            lastTouchDistance = distance;
            lastTouchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
        } else if (e.touches.length === 1 && panZoomState.panning) {
            // パン
            panZoomState.pointX = e.touches[0].clientX - panZoomState.startX;
            panZoomState.pointY = e.touches[0].clientY - panZoomState.startY;
            updateTransform(innerContent);
        }
    }, { passive: false });
    
    container.addEventListener('touchend', () => {
        panZoomState.panning = false;
        lastTouchDistance = 0;
    });
    
    // リセットボタン
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'リセット';
    resetBtn.className = 'skill-tree-reset-btn';
    resetBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        padding: 5px 10px;
        background: rgba(0,0,0,0.7);
        color: white;
        border: 1px solid #444;
        border-radius: 4px;
        cursor: pointer;
    `;
    resetBtn.onclick = () => {
        panZoomState.scale = 1;
        panZoomState.pointX = 0;
        panZoomState.pointY = 0;
        updateTransform(innerContent);
    };
    container.appendChild(resetBtn);
    
    // 初期変換
    updateTransform(innerContent);
}

function updateTransform(element) {
    element.style.transform = `translate(${panZoomState.pointX}px, ${panZoomState.pointY}px) scale(${panZoomState.scale})`;
    element.style.transformOrigin = '0 0';
}

// 初期化時に呼び出す
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initPanZoom('skillTreeCanvas');
    }, 500);
});
