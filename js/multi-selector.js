// Multi-Selector Module

function setupMultiSelector() {
    const container = document.getElementById('pages-container');
    const isHorizontal = appState.layoutMode === 'horizontal';

    // Different layouts for horizontal vs vertical mode
    if (isHorizontal) {
        container.innerHTML = `
            <div id="multi-select-wrapper" class="flex flex-col gap-4 h-[calc(100vh-150px)]">
                <!-- Selected Panel - Fixed height, stable layout -->
                <div id="multi-selected-panel" class="bg-blue-50 dark:bg-gray-800 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-900 shadow-inner shrink-0" style="min-height: 180px; max-height: 200px;">
                    <div class="flex justify-between items-center mb-3">
                        <h2 class="text-xl font-bold text-blue-800 dark:text-blue-300">Selected (<span id="multi-count">0</span>/5)</h2>
                        <button id="multi-copy-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded shadow font-bold hover-popout shake-on-hover">📋 Copy All</button>
                    </div>
                    <div id="multi-selected-grid" class="flex gap-3 overflow-x-auto pb-2" style="min-height: 100px;"></div>
                </div>
                
                <!-- Source Pages - Horizontal layout with 5 columns -->
                <div class="flex-1 flex gap-4 overflow-x-auto" id="multi-source-pages-container">
                    <!-- Source pages will be rendered here as columns -->
                </div>
            </div>
        `;

        // Render source pages as horizontal columns
        renderHorizontalSourcePages();
    } else {
        container.innerHTML = `
            <div id="multi-select-wrapper" class="flex flex-col gap-6 h-[calc(100vh-150px)]">
                <!-- Selected Panel - Fixed height -->
                <div id="multi-selected-panel" class="bg-blue-50 dark:bg-gray-800 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-900 shadow-inner overflow-y-auto shrink-0" style="min-height: 200px; max-height: 250px;">
                    <div class="flex justify-between items-center mb-4 sticky top-0 bg-inherit z-[15] py-1">
                        <h2 class="text-xl font-bold text-blue-800 dark:text-blue-300">Selected (<span id="multi-count">0</span>/5)</h2>
                        <button id="multi-copy-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded shadow font-bold hover-popout shake-on-hover">📋 Copy All</button>
                    </div>
                    <div id="multi-selected-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"></div>
                </div>
                
                <!-- Source Panel with Page and Category dropdowns -->
                <div class="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                    <div class="p-3 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 shadow-sm flex items-center gap-4 flex-wrap">
                        <div class="flex items-center gap-2">
                            <span class="font-bold">Source Page:</span>
                            <select id="multi-source-select" class="bg-white dark:bg-gray-700 border dark:border-gray-600 rounded px-3 py-1 outline-none min-w-[150px]"></select>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold">Category:</span>
                            <select id="multi-category-select" class="bg-white dark:bg-gray-700 border dark:border-gray-600 rounded px-3 py-1 outline-none min-w-[150px]">
                                <option value="">All Categories</option>
                            </select>
                        </div>
                    </div>
                    <div id="multi-source-grid" class="p-4 overflow-y-auto grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6"></div>
                </div>
            </div>
        `;

        // Setup vertical mode dropdowns
        setupVerticalModeDropdowns();
    }

    // Setup copy button
    const copyBtn = document.getElementById('multi-copy-btn');
    copyBtn.onclick = () => {
        if (appState.selectedPrompts.length) {
            const textToCopy = appState.selectedPrompts.map(p => {
                if (p.variants) {
                    const activeVariant = p.variants[p.activeVariant] || p.variants[Object.keys(p.variants)[0]];
                    return `${activeVariant.tag}: ${activeVariant.description}`;
                } else {
                    return `${p.tag}: ${p.description}`;
                }
            }).join('\n\n');

            navigator.clipboard.writeText(textToCopy);
            utils.showWarning("Copied All!");
        }
    };

    // Setup sortable for selected grid
    new Sortable(document.getElementById('multi-selected-grid'), {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
            const i = appState.selectedPrompts.splice(evt.oldIndex, 1)[0];
            appState.selectedPrompts.splice(evt.newIndex, 0, i);
            updateMultiView();
        }
    });

    updateMultiView();
}

function setupVerticalModeDropdowns() {
    const pageSelect = document.getElementById('multi-source-select');
    const catSelect = document.getElementById('multi-category-select');

    // Populate page dropdown
    Object.keys(utils.getState().prompts.pages).forEach(p => {
        if (!p.startsWith('Z')) {
            const o = document.createElement('option');
            o.value = p;
            o.textContent = p;
            pageSelect.appendChild(o);
        }
    });

    // Page change handler
    pageSelect.onchange = (e) => {
        updateCategoryDropdown(e.target.value);
        renderMultiSource(e.target.value, catSelect.value);
    };

    // Category change handler
    catSelect.onchange = (e) => {
        renderMultiSource(pageSelect.value, e.target.value);
    };

    // Initialize
    if (pageSelect.options.length) {
        updateCategoryDropdown(pageSelect.options[0].value);
        renderMultiSource(pageSelect.options[0].value, '');
    }
}

function updateCategoryDropdown(pageName) {
    const catSelect = document.getElementById('multi-category-select');
    if (!catSelect) return;

    catSelect.innerHTML = '<option value="">All Categories</option>';

    const pageData = utils.getState().prompts.pages[pageName];
    if (pageData) {
        Object.keys(pageData).forEach(cat => {
            const o = document.createElement('option');
            o.value = cat;
            o.textContent = cat;
            catSelect.appendChild(o);
        });
    }
}

function renderHorizontalSourcePages() {
    const container = document.getElementById('multi-source-pages-container');
    container.innerHTML = '';

    const allPages = Object.keys(utils.getState().prompts.pages).filter(p => !p.startsWith('Z'));

    // Create 5 panel columns that fill the space evenly
    for (let i = 0; i < 5; i++) {
        const column = document.createElement('div');
        // Changed width to flex-1 with min-width to ensure they stretch but don't shrink too much
        column.className = 'flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden';
        column.style.cssText = 'min-width: 250px;';

        column.innerHTML = `
            <div class="p-3 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 shadow-sm">
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold shrink-0">Page:</span>
                        <select class="multi-h-page-select flex-1 w-full min-w-0 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded px-1 py-1 outline-none text-xs" data-panel="${i}">
                            <option value="">Select Page</option>
                            ${allPages.map(p => `<option value="${p}" ${i < allPages.length && allPages[i] === p ? 'selected' : ''}>${p}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold shrink-0">Category:</span>
                        <select class="multi-h-category-select flex-1 w-full min-w-0 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded px-1 py-1 outline-none text-xs" data-panel="${i}">
                            <option value="">All Categories</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="multi-h-source-grid flex-1 overflow-y-auto p-3" data-panel="${i}" style="display: grid; grid-template-columns: 1fr; gap: 0.75rem; align-content: start;"></div>
        `;

        container.appendChild(column);

        const pageSelect = column.querySelector('.multi-h-page-select');
        const catSelect = column.querySelector('.multi-h-category-select');

        // Page change handler
        pageSelect.onchange = (e) => {
            updateHorizontalCategoryDropdown(i, e.target.value);
            renderHorizontalPanelPrompts(i, e.target.value, '');
            catSelect.value = '';
        };

        // Category change handler
        catSelect.onchange = (e) => {
            renderHorizontalPanelPrompts(i, pageSelect.value, e.target.value);
        };

        // Initialize with default page if available
        if (i < allPages.length) {
            pageSelect.value = allPages[i];
            updateHorizontalCategoryDropdown(i, allPages[i]);
            renderHorizontalPanelPrompts(i, allPages[i], '');
        }
    }
}

function updateHorizontalCategoryDropdown(panelIndex, pageName) {
    const catSelect = document.querySelector(`.multi-h-category-select[data-panel="${panelIndex}"]`);
    if (!catSelect) return;

    catSelect.innerHTML = '<option value="">All Categories</option>';

    if (!pageName) return;

    const pageData = utils.getState().prompts.pages[pageName];
    if (pageData) {
        Object.keys(pageData).forEach(cat => {
            const o = document.createElement('option');
            o.value = cat;
            o.textContent = cat;
            catSelect.appendChild(o);
        });
    }
}

function renderHorizontalPanelPrompts(panelIndex, pageName, categoryFilter) {
    const grid = document.querySelector(`.multi-h-source-grid[data-panel="${panelIndex}"]`);
    if (!grid) return;

    grid.innerHTML = '';

    if (!pageName) {
        grid.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">Select a page</div>';
        return;
    }

    const pageData = utils.getState().prompts.pages[pageName];
    if (!pageData) return;

    Object.keys(pageData).forEach(cat => {
        if (categoryFilter && cat !== categoryFilter) return;

        pageData[cat].forEach(p => {
            // Apply variant filtering
            if (!appState.currentVariantFilter) {
                grid.appendChild(createHorizontalPromptCard(p));
            } else {
                const variants = p.variants || { "Default": p };
                if (Object.keys(variants).includes(appState.currentVariantFilter)) {
                    grid.appendChild(createHorizontalPromptCard(p));
                }
            }
        });
    });

    if (grid.children.length === 0) {
        grid.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">No prompts found</div>';
    }
}

function createHorizontalPromptCard(p) {
    const variants = p.variants || { "Default": p };
    const activeVariant = variants[p.activeVariant || "Default"] || variants[Object.keys(variants)[0]];

    const div = document.createElement('div');
    // Added flex-shrink-0 to prevent shrinking and ensured min-height
    div.className = "bg-gray-50 dark:bg-gray-700 rounded-lg shadow border dark:border-gray-600 overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all flex-shrink-0";
    div.style.cssText = "min-height: 64px;";

    // Smart image loading logic to handle extensions
    const imgId = `img-h-${Math.random().toString(36).substr(2, 9)}`;
    const imagePath = activeVariant.image ? `/images/${activeVariant.image}` : null;

    div.innerHTML = `
        <div class="flex items-center gap-2 p-2 h-full">
            <img id="${imgId}" src="/images/default.png" 
                 class="w-12 h-12 object-cover rounded flex-shrink-0" 
                 onerror="this.src='/images/default.png'">
            <div class="flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
                <div class="font-bold text-sm truncate leading-tight">${activeVariant.tag}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight">${activeVariant.description.substring(0, 40)}...</div>
            </div>
            <button class="multi-add-btn px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-bold flex-shrink-0 self-center">+</button>
        </div>
    `;

    // Handle image loading with extensions if no explicit image is set
    const img = div.querySelector(`#${imgId}`);
    if (imagePath) {
        img.src = imagePath;
    } else {
        const extensions = ['.png', '.jpg', '.jpeg'];
        let extIndex = 0;
        const tryNextExtension = () => {
            if (extIndex >= extensions.length) {
                img.src = '/images/default.png';
            } else {
                const ext = extensions[extIndex++];
                img.src = `/images/${activeVariant.tag.replace(/ /g, '_')}${ext}`;
                img.onerror = tryNextExtension;
            }
        };
        tryNextExtension();
    }

    div.querySelector('.multi-add-btn').onclick = (e) => {
        e.stopPropagation();
        addPromptToSelection(p, activeVariant, div);
    };

    return div;
}

function renderMultiSource(page, categoryFilter) {
    const g = document.getElementById('multi-source-grid');
    if (!g) return;

    g.innerHTML = "";
    const data = utils.getState().prompts.pages[page];

    Object.keys(data).forEach(cat => {
        if (categoryFilter && cat !== categoryFilter) return;

        data[cat].forEach(p => {
            // Apply variant filtering
            if (!appState.currentVariantFilter) {
                g.appendChild(createMultiCard(p, true, false));
            } else {
                const variants = p.variants || { "Default": p };
                if (Object.keys(variants).includes(appState.currentVariantFilter)) {
                    g.appendChild(createMultiCard(p, true, false));
                }
            }
        });
    });
}

function createMultiCard(p, isSource, isCompact = false) {
    const variants = p.variants || { "Default": p };
    const activeVariant = variants[p.activeVariant || "Default"] || variants[Object.keys(variants)[0]];

    const div = document.createElement('div');

    if (isSource) {
        if (isCompact) {
            // Compact card for horizontal layout
            div.className = "bg-gray-50 dark:bg-gray-700 rounded-lg shadow border dark:border-gray-600 overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer";
            div.innerHTML = `
                <div class="flex items-center gap-2 p-2">
                    <img src="${activeVariant.image ? `/images/${activeVariant.image}` : '/images/default.png'}" 
                         class="w-12 h-12 object-cover rounded" 
                         onerror="this.src='/images/default.png'">
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-sm truncate">${activeVariant.tag}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 truncate">${activeVariant.description.substring(0, 50)}...</div>
                    </div>
                    <button class="multi-add-btn px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-bold shrink-0">+</button>
                </div>
            `;

            div.querySelector('.multi-add-btn').onclick = (e) => {
                e.stopPropagation();
                addPromptToSelection(p, activeVariant, div);
            };
        } else {
            // Full card for vertical layout
            div.className = "bg-white dark:bg-gray-700 rounded-lg shadow-lg border-2 dark:border-gray-600 overflow-hidden flex flex-col h-full min-h-[18rem] hover-popout transition-all";

            const imgContainer = document.createElement('div');
            imgContainer.className = "bg-gray-100 dark:bg-gray-800 border-b-2 dark:border-gray-600 min-h-[120px] flex items-center justify-center relative";

            const img = document.createElement('img');
            img.className = "max-w-full max-h-[250px] object-contain";
            if (activeVariant.image) {
                img.src = `/images/${activeVariant.image}`;
            } else {
                const t = ['.png', '.jpg', '.jpeg'];
                let i = 0;
                const n = () => { if (i >= 3) img.src = '/images/default.png'; else img.src = `/images/${activeVariant.tag.replace(/ /g, '_')}${t[i++]}`; };
                img.onerror = n;
                n();
            }
            imgContainer.appendChild(img);

            const titleOverlay = document.createElement('div');
            titleOverlay.className = "absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2 text-center title-overlay";
            const variantInfo = p.activeVariant && p.activeVariant !== "Default" ? ` <span class="text-xs font-normal">(${p.activeVariant})</span>` : "";
            titleOverlay.innerHTML = `<div class="font-bold text-sm truncate" title="${activeVariant.tag}${variantInfo}">${activeVariant.tag}${variantInfo}</div>`;
            imgContainer.appendChild(titleOverlay);

            div.appendChild(imgContainer);

            const btnContainer = document.createElement('div');
            btnContainer.className = "p-3";
            const btn = document.createElement('button');
            btn.className = "w-full text-sm font-bold py-3 rounded text-white shadow bg-green-600 hover-popout shake-on-hover";
            btn.textContent = "+ Add";
            btn.onclick = () => addPromptToSelection(p, activeVariant, div);
            btnContainer.appendChild(btn);
            div.appendChild(btnContainer);
        }
    } else {
        // Selected card (fixed size for stability)
        div.className = "bg-white dark:bg-gray-700 rounded-lg shadow-lg border-2 dark:border-gray-600 p-3 flex flex-col justify-center items-center hover-popout selected-card";
        div.style.cssText = "min-width: 140px; max-width: 180px; min-height: 100px;";

        const variantInfo = p.selectedVariant && p.selectedVariant !== "Default" ? ` (${p.selectedVariant})` : "";
        div.innerHTML = `<div class="font-bold text-sm text-center truncate mb-2 selected-card-text w-full" title="${activeVariant.tag}${variantInfo}">${activeVariant.tag}${variantInfo}</div>`;

        const btn = document.createElement('button');
        btn.className = "w-full text-xs font-bold py-1.5 rounded text-white shadow bg-red-500 hover-popout";
        btn.textContent = "Remove";
        btn.onclick = () => {
            appState.selectedPrompts = appState.selectedPrompts.filter(x => x.tag !== activeVariant.tag);
            updateMultiView();
        };
        div.appendChild(btn);
    }

    return div;
}

function addPromptToSelection(p, activeVariant, cardElement) {
    if (appState.selectedPrompts.length >= 5) {
        utils.showWarning("Max 5!");
        return;
    }

    if (!appState.selectedPrompts.find(x => x.tag === activeVariant.tag && x.activeVariant === p.activeVariant)) {
        appState.selectedPrompts.push({
            ...p,
            tag: activeVariant.tag,
            description: activeVariant.description,
            selectedVariant: p.activeVariant
        });
        cardElement.classList.add('ring-2', 'ring-green-500');
        setTimeout(() => cardElement.classList.remove('ring-2', 'ring-green-500'), 1000);
    }
    updateMultiView();
}

function updateMultiView() {
    const g = document.getElementById('multi-selected-grid');
    if (!g) return;

    g.innerHTML = "";
    document.getElementById('multi-count').textContent = appState.selectedPrompts.length;
    appState.selectedPrompts.forEach(p => g.appendChild(createMultiCard(p, false)));
}