// Utility Functions

// Global state variables - define immediately
window.appState = {
    prompts: { pages: {} },
    globalVariants: new Set(['Default']), // Global list of all available variants
    currentPage: null,
    selectedPrompts: [],
    currentEditPrompt: null,
    currentEditVariant: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    folderPageIndex: 0,
    pageSize: 100,
    currentVariantFilter: null,
    categoryOrder: {}, // Track the order of categories for each page
    collapsedCategories: {}, // Track collapsed state of categories for each page
    layoutMode: 'vertical' // 'vertical' or 'horizontal' for category/prompt layout
};

// DOM Elements - wait for DOM to be ready
let warnMsg, loader, loadText;

document.addEventListener('DOMContentLoaded', () => {
    warnMsg = document.getElementById('warning-message');
    loader = document.getElementById('loading-overlay');
    loadText = document.getElementById('loading-text');
});

// Utility functions
function showWarning(t) {
    if (warnMsg) {
        warnMsg.textContent = t;
        warnMsg.classList.add('show');
        setTimeout(() => warnMsg.classList.remove('show'), 2000);
    } else {
        console.warn('Warning message element not available:', t);
    }
}

function toggleLoader(show, text = "Processing...") {
    if (loader && loadText) {
        loadText.textContent = text;
        loader.classList.toggle('hidden', !show);
    } else {
        console.warn('Loader elements not available');
    }
}

function openLightbox(src) {
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxModal = document.getElementById('lightbox-modal');
    
    if (lightboxImage && lightboxModal) {
        lightboxImage.src = src;
        appState.zoom = 1;
        appState.panX = 0;
        appState.panY = 0;
        lightboxImage.style.transform = 'translate(0,0) scale(1)';
        lightboxModal.classList.remove('hidden');
    } else {
        console.warn('Lightbox elements not available');
    }
}

// Export functions for use in other modules
window.utils = window.utils || {};
Object.assign(window.utils, {
    showWarning,
    toggleLoader,
    openLightbox,
    getState: () => appState,
    setState: (newState) => {
        Object.assign(appState, newState);
    }
});

// Make file operations available globally for Explorer
window.renameFile = async function(oldPath, newPath) {
    try {
        const response = await fetch('/api/explorer/rename-file', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({old_path: oldPath, new_path: newPath})
        });
        
        if(!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to rename file');
        }
        
        return await response.json();
    } catch(e) {
        console.error("Error renaming file:", e);
        utils.showWarning("Error renaming file: " + e.message);
        throw e;
    }
};

window.deleteFile = async function(filePath) {
    try {
        const response = await fetch('/api/explorer/delete-file', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file_path: filePath})
        });
        
        if(!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete file');
        }
        
        return await response.json();
    } catch(e) {
        console.error("Error deleting file:", e);
        utils.showWarning("Error deleting file: " + e.message);
        throw e;
    }
};