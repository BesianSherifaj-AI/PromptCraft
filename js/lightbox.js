// ===============================
// Shared Lightbox Close Function
// ===============================
function closeLightbox() {
    const m = document.getElementById('lightbox-modal');
    if (m) m.classList.add('hidden');
}

// ===============================
// Base Lightbox (zoom / pan)
// ===============================
function setupLightbox() {
    const m = document.getElementById('lightbox-modal');
    const i = document.getElementById('lightbox-image');
    const c = document.getElementById('lightbox-container');

    if (!m || !i || !c) {
        console.warn('Lightbox elements not available, setup deferred');
        return;
    }

    document.getElementById('lightbox-bg').onclick = closeLightbox;
    document.getElementById('lightbox-close').onclick = closeLightbox;

    document.getElementById('zoom-in').onclick = () => {
        appState.zoom += 0.2;
        apply();
    };

    document.getElementById('zoom-out').onclick = () => {
        appState.zoom = Math.max(0.2, appState.zoom - 0.2);
        apply();
    };

    document.getElementById('zoom-reset').onclick = () => {
        appState.zoom = 1;
        appState.panX = 0;
        appState.panY = 0;
        apply();
    };

    c.addEventListener('wheel', e => {
        e.preventDefault();
        appState.zoom += e.deltaY * -0.001;
        appState.zoom = Math.max(0.2, appState.zoom);
        apply();
    });

    i.addEventListener('mousedown', e => {
        e.preventDefault();
        appState.isDragging = true;
        appState.startX = e.clientX - appState.panX;
        appState.startY = e.clientY - appState.panY;
        i.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        appState.isDragging = false;
        i.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', e => {
        if (!appState.isDragging) return;
        e.preventDefault();
        appState.panX = e.clientX - appState.startX;
        appState.panY = e.clientY - appState.startY;
        apply();
    });

    function apply() {
        i.style.transform =
            `translate(${appState.panX}px, ${appState.panY}px) scale(${appState.zoom})`;
    }
}

// ===============================
// Explorer Lightbox Enhancements
// ===============================
function setupExplorerLightbox() {
    const container = document.getElementById('lightbox-container');
    const img = document.getElementById('lightbox-image');

    if (!container || !img) {
        console.warn('Explorer lightbox elements missing');
        return;
    }

    // Prevent duplicate setup
    if (container.dataset.explorerSetup) return;
    container.dataset.explorerSetup = 'true';

    // ---------- Navigation Buttons ----------
    const navLeft = document.createElement('button');
    navLeft.id = 'lightbox-nav-left';
    navLeft.textContent = '←';

    const navRight = document.createElement('button');
    navRight.id = 'lightbox-nav-right';
    navRight.textContent = '→';

    [navLeft, navRight].forEach(btn => {
        btn.className =
            'absolute top-1/2 transform -translate-y-1/2 ' +
            'bg-gray-700 text-white w-12 h-12 rounded-full text-2xl ' +
            'font-bold z-[101] hover:bg-gray-600';
    });

    navLeft.style.left = '1rem';
    navRight.style.right = '1rem';

    container.appendChild(navLeft);
    container.appendChild(navRight);

    // ---------- Action Buttons ----------
    const actionContainer = document.createElement('div');
    actionContainer.id = 'lightbox-file-actions';
    actionContainer.className =
        'absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-[101]';

    const renameBtn = document.createElement('button');
    renameBtn.textContent = '✍️ Rename';
    renameBtn.className = 'bg-blue-600 text-white px-4 py-2 rounded font-bold';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.className = 'bg-red-600 text-white px-4 py-2 rounded font-bold';

    const createPromptBtn = document.createElement('button');
    createPromptBtn.id = 'lightbox-create-prompt-btn';
    createPromptBtn.textContent = '🎨 Create Prompt';
    createPromptBtn.className = 'bg-green-600 text-white px-4 py-2 rounded font-bold';

    actionContainer.append(renameBtn, deleteBtn, createPromptBtn);
    container.appendChild(actionContainer);

    // ---------- Filename Display ----------
    const filenameDisplay = document.createElement('div');
    filenameDisplay.id = 'lightbox-filename';
    filenameDisplay.className =
        'absolute top-4 left-1/2 transform -translate-x-1/2 ' +
        'bg-black bg-opacity-50 text-white px-4 py-2 rounded ' +
        'z-[101] max-w-[80%] truncate';

    container.appendChild(filenameDisplay);

    // ---------- Core Update ----------
    function updateLightbox() {
        if (!currentLightboxFiles.length) return;

        const file = currentLightboxFiles[currentLightboxIndex];
        filenameDisplay.textContent = file;

        const cleanPath = appState.currentPath.filter(Boolean).join('/');
        const base = appState.currentDrive
            ? appState.currentDrive + (cleanPath ? cleanPath + '/' : '')
            : cleanPath ? cleanPath + '/' : '';

        const url = appState.currentDrive
            ? `/files/${base}${file}`
            : `/${base}${file}`;

        img.src = url;

        appState.zoom = 1;
        appState.panX = 0;
        appState.panY = 0;
        img.style.transform = 'translate(0,0) scale(1)';

        renameBtn.onclick = async () => {
            const newName = prompt('Enter new filename:', file);
            if (!newName || newName === file) return;

            const oldPath = base + file;
            const newPath = base + newName;

            await renameFile(oldPath, newPath);
            currentLightboxFiles[currentLightboxIndex] = newName;
            await loadDirectoryContents(appState.currentPath);
            closeLightbox();
        };

        deleteBtn.onclick = async () => {
            if (!confirm(`Delete ${file}?`)) return;

            await deleteFile(base + file);
            currentLightboxFiles.splice(currentLightboxIndex, 1);

            if (!currentLightboxFiles.length) {
                closeLightbox();
                return;
            }

            currentLightboxIndex %= currentLightboxFiles.length;
            await loadDirectoryContents(appState.currentPath);
            updateLightbox();
        };

        createPromptBtn.onclick = () => {
            const filePath = base + file;
            // Do NOT close lightbox - keep image visible while selecting where to save
            // Call the showCreatePromptModal function from folder-explorer.js
            if (typeof showCreatePromptModal === 'function') {
                showCreatePromptModal(filePath, file);
            } else {
                utils.showWarning('Create Prompt feature not available');
            }
        };
    }

    // ---------- Navigation ----------
    function navigate(dir) {
        if (!currentLightboxFiles.length) return;
        currentLightboxIndex =
            (currentLightboxIndex + dir + currentLightboxFiles.length) %
            currentLightboxFiles.length;
        updateLightbox();
    }

    navLeft.onclick = () => navigate(-1);
    navRight.onclick = () => navigate(1);

    document.addEventListener('keydown', e => {
        const modal = document.getElementById('lightbox-modal');
        if (!modal || modal.classList.contains('hidden')) return;

        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key === 'Escape') closeLightbox();
    });

    // ---------- Safe openLightbox hook ----------
    if (!utils._explorerWrapped) {
        utils._explorerWrapped = true;

        const original = utils.openLightbox;
        utils.openLightbox = function (src) {
            if (original) original(src);

            const idx = currentLightboxFiles.findIndex(file => src.includes(file));
            if (idx !== -1) {
                currentLightboxIndex = idx;
                setTimeout(updateLightbox, 30);
            }
        };
    }
}

// ===============================
// Globals / Init
// ===============================
window.currentLightboxFiles ||= [];
window.currentLightboxIndex ||= 0;
window.loadDirectoryContents ||= async () => { };

document.addEventListener('DOMContentLoaded', () => {
    setupLightbox();
    setupExplorerLightbox();
});
