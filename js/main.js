// Main Application Logic

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');

    // Debug: Check if appState is available
    if (typeof appState === 'undefined') {
        console.error('appState is not defined!');
        return;
    }

    console.log('appState initialized:', appState);

    // Load data and setup UI
    loadPromptsFromJSON();
    setupShortcuts();
    setupLightbox();
    setupDelegation();

    // Check theme preference
    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.classList.remove('dark');
        document.getElementById('dark-mode-toggle').textContent = '🌙 Dark';
    }
});

// Backend API functions
async function loadPromptsFromJSON() {
    try {
        console.log('Loading prompts from API...');
        const r = await fetch('/api/pages');
        console.log('API response status:', r.status);
        if (!r.ok) throw new Error();
        const files = await r.json();
        console.log('Found JSON files:', files);

        for (const f of files.sort()) {
            console.log('Loading page:', f);
            const d = await fetch(`/api/pages/${f}`);
            if (d.ok) {
                const pageData = await d.json();

                // Handle both new format (with prompts/categoryOrder/collapsedCategories) and legacy format
                const rawPrompts = pageData.prompts || pageData;

                // Convert legacy format to new variant format
                const convertedPageData = {};
                for (const category in rawPrompts) {
                    convertedPageData[category] = rawPrompts[category].map(prompt => {
                        if (prompt.variants) {
                            // Already in new format
                            return prompt;
                        } else {
                            // Convert legacy format
                            return {
                                variants: {
                                    "Default": {
                                        tag: prompt.tag || "New",
                                        description: prompt.description || "...",
                                        image: prompt.image || null
                                    }
                                },
                                activeVariant: "Default"
                            };
                        }
                    });
                }

                // Store the page data
                const pageName = f.replace('.json', '');
                appState.prompts.pages[pageName] = convertedPageData;

                // Preserve category order and collapsed categories if they exist in the saved data
                if (pageData.categoryOrder) {
                    appState.categoryOrder[pageName] = pageData.categoryOrder;
                }
                if (pageData.collapsedCategories) {
                    Object.entries(pageData.collapsedCategories).forEach(([category, isCollapsed]) => {
                        if (isCollapsed) {
                            appState.collapsedCategories[`${pageName}-${category}`] = true;
                        }
                    });
                }

                console.log('Loaded page data:', f, convertedPageData);
            }
        }

        console.log('Final prompts state:', appState.prompts);
        renderPages();
    } catch (e) {
        console.error('Error loading prompts:', e);
        appState.prompts = { pages: { "Main Page": { "General": [] } } };
        renderPages();
    }
    ["Z1-FOLDER-EXP", "Z2-Metadata Viewer", "Z3-Multi-Selector"].forEach(p => {
        if (!appState.prompts.pages[p]) appState.prompts.pages[p] = {};
    });

    // Initialize global variants from all prompts
    initializeGlobalVariants();

    // Synchronize all prompts with global variants
    synchronizeAllPromptsWithGlobalVariants();

    renderPages();
}

function synchronizeAllPromptsWithGlobalVariants() {
    // DON'T automatically add missing global variants to prompts
    // This prevents automatic creation of variants in all prompt cards
    // Variants will only be created when explicitly selected by the user

    // Just ensure global variants list is up to date
    initializeGlobalVariants();
}

function initializeGlobalVariants() {
    // Clear existing global variants (keep Default)
    appState.globalVariants = new Set(['Default']);

    // Collect all variants from all prompts across all pages
    Object.keys(appState.prompts.pages).forEach(pageName => {
        const page = appState.prompts.pages[pageName];
        Object.keys(page).forEach(category => {
            page[category].forEach(prompt => {
                if (prompt.variants) {
                    Object.keys(prompt.variants).forEach(variantName => {
                        appState.globalVariants.add(variantName);
                    });
                }
            });
        });
    });
}



async function savePage(name, data) {
    try {
        // Create a save object that includes both the prompt data and UI state
        const saveData = {
            prompts: data,
            categoryOrder: appState.categoryOrder[name] || Object.keys(data),
            collapsedCategories: Object.fromEntries(
                Object.entries(appState.collapsedCategories)
                    .filter(([key]) => key.startsWith(`${name}-`))
                    .map(([key, value]) => [key.replace(`${name}-`, ''), value])
            )
        };

        await fetch('/api/pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `${name}.json`, content: saveData })
        });
        utils.showWarning(`Saved ${name}!`);
    } catch (e) {
        utils.showWarning("Offline Mode");
    }
}

// Page management functions
async function renamePage(oldName, newName) {
    if (!newName || newName.trim() === "") {
        utils.showWarning("Please enter a valid page name!");
        return;
    }

    newName = newName.trim();

    // Check if new name already exists
    if (appState.prompts.pages[newName]) {
        utils.showWarning(`A page named "${newName}" already exists!`);
        return;
    }

    // Check if old name exists
    if (!appState.prompts.pages[oldName]) {
        utils.showWarning(`Page "${oldName}" not found!`);
        return;
    }

    try {
        // Save the old page data first
        await savePage(oldName, appState.prompts.pages[oldName]);

        // Rename in memory
        const pageData = appState.prompts.pages[oldName];
        delete appState.prompts.pages[oldName];
        appState.prompts.pages[newName] = pageData;

        // Save the new page
        await savePage(newName, pageData);

        // Delete the old JSON file
        await fetch(`/api/delete-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `${oldName}.json` })
        });

        // Update current page if needed
        if (appState.currentPage === oldName) {
            appState.currentPage = newName;
        }

        // Re-render pages
        renderPages();
        utils.showWarning(`Page renamed from "${oldName}" to "${newName}"`);

    } catch (e) {
        console.error("Error renaming page:", e);
        utils.showWarning("Error renaming page. Changes may not be saved.");
        // Revert changes if error occurs
        appState.prompts.pages[oldName] = appState.prompts.pages[newName];
        delete appState.prompts.pages[newName];
        renderPages();
    }
}

async function deletePage(pageName) {
    if (!appState.prompts.pages[pageName]) {
        utils.showWarning(`Page "${pageName}" not found!`);
        return;
    }

    // Check if this is the last regular page
    const regularPages = Object.keys(appState.prompts.pages).filter(p => !p.startsWith("Z"));
    if (regularPages.length <= 1) {
        utils.showWarning("Cannot delete the last page!");
        return;
    }

    try {
        // Delete the JSON file
        await fetch(`/api/delete-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `${pageName}.json` })
        });

        // Remove from memory
        delete appState.prompts.pages[pageName];

        // Switch to another page if current page is being deleted
        if (appState.currentPage === pageName) {
            const remainingPages = Object.keys(appState.prompts.pages).filter(p => !p.startsWith("Z"));
            appState.currentPage = remainingPages[0];
        }

        // Re-render pages
        renderPages();
        utils.showWarning(`Page "${pageName}" deleted successfully!`);

    } catch (e) {
        console.error("Error deleting page:", e);
        utils.showWarning("Error deleting page. Please try again.");
    }
}

// Category reordering functions
function moveCategoryUp(pageName, categoryName) {
    // Initialize category order for this page if it doesn't exist
    if (!appState.categoryOrder[pageName]) {
        appState.categoryOrder[pageName] = Object.keys(appState.prompts.pages[pageName]);
    }

    const categories = appState.categoryOrder[pageName];
    const currentIndex = categories.indexOf(categoryName);

    if (currentIndex > 0) {
        // Swap with previous category in the order array
        const temp = categories[currentIndex - 1];
        categories[currentIndex - 1] = categoryName;
        categories[currentIndex] = temp;
    }
}

function moveCategoryDown(pageName, categoryName) {
    // Initialize category order for this page if it doesn't exist
    if (!appState.categoryOrder[pageName]) {
        appState.categoryOrder[pageName] = Object.keys(appState.prompts.pages[pageName]);
    }

    const categories = appState.categoryOrder[pageName];
    const currentIndex = categories.indexOf(categoryName);

    if (currentIndex < categories.length - 1) {
        // Swap with next category in the order array
        const temp = categories[currentIndex + 1];
        categories[currentIndex + 1] = categoryName;
        categories[currentIndex] = temp;
    }
}

// Category collapse/expand functionality
function toggleCategoryCollapse(e, categoryName) {
    const button = e.target;
    const container = button.closest('.prompt-grid-container');
    const grid = container.querySelector('.prompt-grid');

    if (grid.classList.contains('collapsed')) {
        // Expand
        grid.classList.remove('collapsed');
        button.textContent = '−';
        button.title = 'Collapse Category';

        // Remove from collapsed categories list
        delete appState.collapsedCategories[`${appState.currentPage}-${categoryName}`];
    } else {
        // Collapse
        grid.classList.add('collapsed');
        button.textContent = '+';
        button.title = 'Expand Category';

        // Add to collapsed categories list
        appState.collapsedCategories[`${appState.currentPage}-${categoryName}`] = true;
    }
}

// Helper function to get user input for renaming
function renamePagePrompt(oldName) {
    const newName = prompt("Enter new page name:", oldName);
    if (newName && newName !== oldName) {
        renamePageAsync(oldName, newName);
    }
}

async function renamePageAsync(oldName, newName) {
    await renamePageActual(oldName, newName);
}

// Actual rename function (renamed to avoid conflict)
async function renamePageActual(oldName, newName) {
    if (!newName || newName.trim() === "") {
        utils.showWarning("Please enter a valid page name!");
        return;
    }

    newName = newName.trim();

    // Check if new name already exists
    if (appState.prompts.pages[newName]) {
        utils.showWarning(`A page named "${newName}" already exists!`);
        return;
    }

    // Check if old name exists
    if (!appState.prompts.pages[oldName]) {
        utils.showWarning(`Page "${oldName}" not found!`);
        return;
    }

    try {
        // Save the old page data first
        await savePage(oldName, appState.prompts.pages[oldName]);

        // Rename in memory
        const pageData = appState.prompts.pages[oldName];
        delete appState.prompts.pages[oldName];
        appState.prompts.pages[newName] = pageData;

        // Save the new page
        await savePage(newName, pageData);

        // Delete the old JSON file
        await fetch(`/api/delete-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `${oldName}.json` })
        });

        // Update current page if needed
        if (appState.currentPage === oldName) {
            appState.currentPage = newName;
        }

        // Re-render pages
        renderPages();
        utils.showWarning(`Page renamed from "${oldName}" to "${newName}"`);

    } catch (e) {
        console.error("Error renaming page:", e);
        utils.showWarning("Error renaming page. Changes may not be saved.");
        // Revert changes if error occurs
        appState.prompts.pages[oldName] = appState.prompts.pages[newName];
        delete appState.prompts.pages[newName];
        renderPages();
    }
}

// Setup event delegation
function setupDelegation() {
    const container = document.getElementById('pages-container');

    container.addEventListener('click', e => {
        if (e.target.classList.contains('add-prompt-btn')) {
            // Create new prompt with only Default variant
            const newPrompt = {
                id: 'p' + Math.random().toString(36).substr(2, 9), // Unique ID
                variants: {
                    "Default": {
                        tag: "New",
                        description: "...",
                        image: null
                    }
                },
                activeVariant: "Default"
            };

            // DON'T add all global variants to the new prompt
            // Variants will be added on-demand when selected from the dropdown

            appState.prompts.pages[appState.currentPage][e.target.dataset.category].push(newPrompt);
            renderPages();
            updateVariantFilterDropdown();
        }
        if (e.target.classList.contains('delete-category-btn')) {
            if (confirm("Delete?")) {
                delete appState.prompts.pages[appState.currentPage][e.target.dataset.category];
                renderPages();
            }
        }

        if (e.target.classList.contains('rename-category-btn')) {
            const oldCategoryName = e.target.dataset.category;
            const newCategoryName = prompt("Enter new category name:", oldCategoryName);
            if (newCategoryName && newCategoryName.trim() !== "" && newCategoryName !== oldCategoryName) {
                const trimmedName = newCategoryName.trim();
                if (!appState.prompts.pages[appState.currentPage][trimmedName]) {
                    // Rename the category
                    appState.prompts.pages[appState.currentPage][trimmedName] =
                        appState.prompts.pages[appState.currentPage][oldCategoryName];
                    delete appState.prompts.pages[appState.currentPage][oldCategoryName];

                    // Update category order to reflect the rename
                    if (appState.categoryOrder[appState.currentPage]) {
                        const orderIndex = appState.categoryOrder[appState.currentPage].indexOf(oldCategoryName);
                        if (orderIndex !== -1) {
                            appState.categoryOrder[appState.currentPage][orderIndex] = trimmedName;
                        }
                    }

                    // Update collapsed categories to reflect the rename
                    const oldCollapsedKey = `${appState.currentPage}-${oldCategoryName}`;
                    const newCollapsedKey = `${appState.currentPage}-${trimmedName}`;
                    if (appState.collapsedCategories[oldCollapsedKey]) {
                        appState.collapsedCategories[newCollapsedKey] = true;
                        delete appState.collapsedCategories[oldCollapsedKey];
                    }

                    renderPages();
                } else {
                    utils.showWarning("A category with that name already exists!");
                }
            }
        }

        // Category reordering
        if (e.target.classList.contains('move-category-up-btn')) {
            const categoryName = e.target.dataset.category;
            moveCategoryUp(appState.currentPage, categoryName);
            renderPages();
        }

        if (e.target.classList.contains('move-category-down-btn')) {
            const categoryName = e.target.dataset.category;
            moveCategoryDown(appState.currentPage, categoryName);
            renderPages();
        }

        // Category collapse/expand
        if (e.target.classList.contains('collapse-category-btn')) {
            const categoryName = e.target.dataset.category;
            toggleCategoryCollapse(e, categoryName);
        }
    });

    // Setup main action buttons
    document.getElementById('add-page-btn').onclick = () => {
        const newPageName = prompt("Enter new page name:");
        if (newPageName && !appState.prompts.pages[newPageName]) {
            appState.prompts.pages[newPageName] = { "General": [] };
            renderPages();
        }
    };

    // Setup layout toggle button
    document.getElementById('layout-toggle').onclick = () => {
        // Disable horizontal layout on Explorer (Z1) and Metadata (Z2) pages
        if (appState.currentPage === 'Z1-FOLDER-EXP' || appState.currentPage === 'Z2-Metadata Viewer') {
            utils.showWarning('Horizontal layout is not available on this page');
            return;
        }

        appState.layoutMode = appState.layoutMode === 'vertical' ? 'horizontal' : 'vertical';
        document.body.classList.toggle('horizontal-layout', appState.layoutMode === 'horizontal');
        document.getElementById('layout-toggle').textContent = appState.layoutMode === 'horizontal' ? '⬌' : '⬍';
        document.getElementById('layout-toggle').title = appState.layoutMode === 'horizontal' ? 'Switch to Vertical Layout' : 'Switch to Horizontal Layout';

        // Re-render to apply layout changes
        if (!appState.currentPage.startsWith("Z")) {
            showPage(appState.currentPage);
        } else if (appState.currentPage === 'Z3-Multi-Selector') {
            setupMultiSelector();
        }
    };

    document.getElementById('save-page-btn').onclick = async () => {
        // Save all pages instead of just the current one
        for (const pageName in appState.prompts.pages) {
            if (!pageName.startsWith("Z")) { // Skip special pages
                await savePage(pageName, appState.prompts.pages[pageName]);
            }
        }
        utils.showWarning("All pages saved!");
    };

    document.getElementById('add-category-btn').onclick = () => {
        if (appState.currentPage && !appState.currentPage.startsWith("Z")) {
            const newCatName = prompt("Enter new category name:");
            if (newCatName && !appState.prompts.pages[appState.currentPage][newCatName]) {
                appState.prompts.pages[appState.currentPage][newCatName] = [];
                renderPages();
            }
        }
    };

    // Setup modal buttons
    document.getElementById('cancel-edit').onclick = () => {
        document.getElementById('edit-modal').classList.add('hidden');
    };

    document.getElementById('save-edit').onclick = () => {
        if (appState.currentEditPrompt && appState.currentEditVariant) {
            const lines = document.getElementById('edit-text').value.split('\n');
            const tag = lines[0] || "New";
            const description = lines.slice(1).join('\n') || "...";
            const note = document.getElementById('edit-note').value || "";

            // Update the specific variant
            appState.currentEditPrompt.variants[appState.currentEditVariant] = {
                tag: tag,
                description: description,
                note: note,
                image: appState.currentEditPrompt.variants[appState.currentEditVariant]?.image || null
            };

            document.getElementById('edit-modal').classList.add('hidden');
            renderPages();
            updateVariantFilterDropdown();
        }
    };

    // Variant management buttons
    document.getElementById('add-variant-btn').onclick = () => {
        if (appState.currentEditPrompt) {
            const newVariantName = prompt("Enter new variant name:", "Variant " + (Object.keys(appState.currentEditPrompt.variants).length + 1));
            if (newVariantName && newVariantName.trim()) {
                const variantName = newVariantName.trim();
                if (!appState.currentEditPrompt.variants[variantName]) {
                    // Add the new variant to the current prompt only
                    // Keep the same tag name as the original prompt
                    const originalTag = appState.currentEditPrompt.variants[appState.currentEditVariant].tag;
                    appState.currentEditPrompt.variants[variantName] = {
                        tag: originalTag,  // Keep the same name
                        description: "...",
                        note: "",  // Empty note - DO NOT copy from original variant
                        image: null
                    };

                    // Switch to the new variant
                    appState.currentEditVariant = variantName;
                    appState.currentEditPrompt.activeVariant = variantName;
                    updateVariantSelector();

                    // Update the edit text to show the new variant content
                    document.getElementById('edit-text').value = `${appState.currentEditPrompt.variants[variantName].tag}\n${appState.currentEditPrompt.variants[variantName].description}`;
                    // Clear the note field for new variant
                    document.getElementById('edit-note').value = '';

                } else {
                    utils.showWarning("Variant name already exists!");
                }
                // Add new variant to global variants list
                appState.globalVariants.add(variantName);

                // DON'T add this variant to all existing prompts - only create when explicitly selected
                // This prevents automatic creation of variants in all prompt cards

                updateVariantFilterDropdown();
            }
        }
    };

    document.getElementById('delete-variant-btn').onclick = () => {
        if (appState.currentEditPrompt && appState.currentEditVariant) {
            const variantCount = Object.keys(appState.currentEditPrompt.variants).length;
            if (variantCount <= 1) {
                utils.showWarning("Cannot delete the last variant!");
                return;
            }

            // Prevent deleting the Default variant
            if (appState.currentEditVariant === "Default") {
                utils.showWarning("Cannot delete the Default variant!");
                return;
            }

            const confirmMessage = `Delete variant "${appState.currentEditVariant}" only? (Other variants will remain)`;
            if (confirm(confirmMessage)) {
                delete appState.currentEditPrompt.variants[appState.currentEditVariant];

                // Switch to another variant
                const remainingVariants = Object.keys(appState.currentEditPrompt.variants);
                appState.currentEditVariant = remainingVariants[0];
                appState.currentEditPrompt.activeVariant = remainingVariants[0];

                // Update UI
                updateVariantSelector();
                updateVariantFilterDropdown();
                const activeVariant = appState.currentEditPrompt.variants[appState.currentEditVariant];
                document.getElementById('edit-text').value = `${activeVariant.tag}\n${activeVariant.description}`;
            }
        }
    };

    document.getElementById('rename-variant-btn').onclick = () => {
        if (appState.currentEditPrompt && appState.currentEditVariant) {
            const newName = document.getElementById('variant-name-input').value.trim();
            if (newName && newName !== appState.currentEditVariant) {
                if (!appState.currentEditPrompt.variants[newName]) {
                    // Special handling for Default variant renaming
                    const isRenamingDefault = appState.currentEditVariant === "Default";

                    // Copy the variant to new name
                    appState.currentEditPrompt.variants[newName] = {
                        ...appState.currentEditPrompt.variants[appState.currentEditVariant]
                    };

                    // Delete old variant
                    delete appState.currentEditPrompt.variants[appState.currentEditVariant];

                    // Update current variant
                    appState.currentEditVariant = newName;
                    appState.currentEditPrompt.activeVariant = newName;

                    // If we renamed the Default variant, create a new Default variant
                    // to ensure it always exists in the prompt
                    if (isRenamingDefault) {
                        appState.currentEditPrompt.variants["Default"] = {
                            tag: "New",
                            description: "...",
                            image: null
                        };
                        // Update global variants
                        appState.globalVariants.add("Default");
                    }

                    // Update UI
                    updateVariantSelector();
                    updateVariantFilterDropdown();
                    document.getElementById('variant-name-input').value = '';
                } else {
                    utils.showWarning("Variant name already exists!");
                }
            }
        }
    };

    document.getElementById('variant-selector').onchange = (e) => {
        if (appState.currentEditPrompt) {
            const selectedVariantName = e.target.value;

            // If the variant doesn't exist in the current prompt, create it with default content
            if (!appState.currentEditPrompt.variants[selectedVariantName]) {
                appState.currentEditPrompt.variants[selectedVariantName] = {
                    tag: "New " + selectedVariantName,
                    description: "...",
                    image: null
                };
                utils.showWarning(`Added "${selectedVariantName}" variant to this prompt!`);
            }

            // Switch to the selected variant
            appState.currentEditVariant = selectedVariantName;
            appState.currentEditPrompt.activeVariant = selectedVariantName;

            const activeVariant = appState.currentEditPrompt.variants[selectedVariantName];
            document.getElementById('edit-text').value = `${activeVariant.tag}\n${activeVariant.description}`;
            document.getElementById('edit-note').value = activeVariant.note || '';

            // Update the selector to reflect the change (remove "Available" marker)
            updateVariantSelector();
        }
    };

    document.getElementById('cancel-category').onclick = () => {
        document.getElementById('category-modal').classList.add('hidden');
    };

    document.getElementById('save-category').onclick = () => {
        const catName = document.getElementById('category-name').value.trim();
        if (catName && appState.currentPage && !appState.currentPage.startsWith("Z")) {
            if (!appState.prompts.pages[appState.currentPage][catName]) {
                appState.prompts.pages[appState.currentPage][catName] = [];
                renderPages();
            }
            document.getElementById('category-modal').classList.add('hidden');
            document.getElementById('category-name').value = '';
        }
    };
}

// Variant selector update function
function updateVariantSelector() {
    const selector = document.getElementById('variant-selector');
    const variantInput = document.getElementById('variant-name-input');

    if (!appState.currentEditPrompt) return;
    if (!selector) return;

    selector.innerHTML = '';

    // Get all variant names from ALL prompts across ALL pages (global variant names)
    const allVariantNames = new Set();

    // Collect variants from all pages
    Object.keys(appState.prompts.pages).forEach(pageName => {
        if (pageName.startsWith("Z")) return; // Skip special pages

        const page = appState.prompts.pages[pageName];
        Object.keys(page).forEach(category => {
            page[category].forEach(prompt => {
                if (prompt.variants) {
                    Object.keys(prompt.variants).forEach(variantName => {
                        allVariantNames.add(variantName);
                    });
                }
            });
        });
    });

    // Convert to array and sort
    const sortedVariantNames = Array.from(allVariantNames).sort();

    // Add all global variant names to the selector
    sortedVariantNames.forEach(variantName => {
        const option = document.createElement('option');
        option.value = variantName;
        option.textContent = variantName;

        // Mark variants that don't exist in current prompt (will be created when selected)
        if (!appState.currentEditPrompt.variants[variantName]) {
            option.classList.add('global-variant-option');
            option.textContent += ' (Available)';
        }

        if (variantName === appState.currentEditVariant) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    // Update the input field with current variant name
    variantInput.value = appState.currentEditVariant;


}

// Update variant filter dropdown using global variants
function updateVariantFilterDropdown() {
    const filter = document.getElementById('variant-filter');
    if (!filter) return;

    const currentValue = filter.value;

    // Use global variants list
    const allVariants = new Set(appState.globalVariants);
    allVariants.add(""); // All Variants option





    // Update dropdown
    filter.innerHTML = '';
    const sortedVariants = Array.from(allVariants).sort((a, b) => {
        // Sort with empty string (All Variants) first, then alphabetically
        if (a === "") return -1;
        if (b === "") return 1;
        return a.localeCompare(b);
    });

    sortedVariants.forEach(variant => {
        const option = document.createElement('option');
        option.value = variant;
        option.textContent = variant || "All Variants";
        if (variant === currentValue) {
            option.selected = true;
        }
        filter.appendChild(option);
    });
}

// Navigation functions
function renderPages() {
    const bar = document.getElementById("pages-bar");
    bar.innerHTML = "";
    Object.keys(appState.prompts.pages).sort().forEach(k => {
        // Skip special pages for page management buttons
        const isSpecialPage = k.startsWith("Z");

        // Create page button container
        const btnContainer = document.createElement("div");
        btnContainer.className = "relative group page-btn-container";

        const btn = document.createElement("button");
        btn.textContent = k === "Z1-FOLDER-EXP" ? "📁 Explorer" : k === "Z2-Metadata Viewer" ? "🖼️ Metadata" : k === "Z3-Multi-Selector" ? "✨ Multi-Select" : k;
        btn.className = "px-4 py-2 text-sm font-semibold rounded shadow-md transition-all border border-transparent whitespace-nowrap hover-popout shake-on-hover page-btn";
        btn.onclick = () => showPage(k);
        btnContainer.appendChild(btn);

        // Add page management buttons (only for non-special pages)
        if (!isSpecialPage) {
            const actionButtons = document.createElement("div");
            actionButtons.className = "absolute top-0 left-0 inline-flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 page-action-buttons";
            actionButtons.style.transform = "translate(-10%, -230%)"; // centers horizontally and moves above

            // Rename page button
            const renameBtn = document.createElement("button");
            renameBtn.textContent = "✍️";
            renameBtn.title = "Rename Page";
            renameBtn.className = "bg-blue-600 hover:bg-blue-700 text-white rounded-full relative inline-flex items-center justify-center w-6 h-6 p-0 hover-popout overflow-visible";
            renameBtn.innerHTML = '<span class="absolute text-[30px] top-1/1 left-1/1 -translate-x-1/2 -translate-y-1/2">✍️</span>';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                renamePagePrompt(k);
            };
            actionButtons.appendChild(renameBtn);

            // Delete page button
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "🗑️";
            deleteBtn.title = "Delete Page";
            deleteBtn.className = "bg-red-600 hover:bg-red-700 text-white rounded-full relative inline-flex items-center justify-center w-6 h-6 p-0 hover-popout overflow-visible";
            deleteBtn.innerHTML = '<span class="absolute text-[30px] top-1/1 left-1/1 -translate-x-1/2 -translate-y-1/2">🗑️</span>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete page "${k}" and its JSON file? This cannot be undone!`)) {
                    deletePage(k);
                }
            };
            actionButtons.appendChild(deleteBtn);

            btnContainer.appendChild(actionButtons);
        }

        bar.appendChild(btnContainer);
    });
    if (!appState.currentPage) appState.currentPage = Object.keys(appState.prompts.pages).sort()[0];
    showPage(appState.currentPage);

    // Small delay to ensure DOM is ready for filter dropdown
    setTimeout(updateVariantFilterDropdown, 100);
}

function showPage(name) {
    appState.currentPage = name;
    const container = document.getElementById('pages-container');
    container.innerHTML = "";
    document.querySelectorAll('#pages-bar button').forEach(b => {
        const match = (b.textContent === "📁 Explorer" && name === "Z1-FOLDER-EXP") || (b.textContent === "🖼️ Metadata" && name === "Z2-Metadata Viewer") || (b.textContent === "✨ Multi-Select" && name === "Z3-Multi-Selector") || (b.textContent === name);
        b.className = match ? "px-4 py-2 text-sm font-bold rounded shadow-md bg-primary-600 text-white scale-105" : "px-4 py-2 text-sm font-semibold rounded shadow-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600";
    });
    document.getElementById("action-buttons-group").style.display = name.startsWith("Z") ? "none" : "flex";

    // Update variant filter dropdown when switching pages to ensure all variants are visible
    // Use setTimeout to ensure this happens after the page content is rendered
    setTimeout(updateVariantFilterDropdown, 50);

    // Disable horizontal layout on Explorer and Metadata pages
    if (name === 'Z1-FOLDER-EXP' || name === 'Z2-Metadata Viewer') {
        if (appState.layoutMode === 'horizontal') {
            appState.layoutMode = 'vertical';
            document.body.classList.remove('horizontal-layout');
            document.getElementById('layout-toggle').textContent = '⬍';
            document.getElementById('layout-toggle').title = 'Switch to Horizontal Layout';
        }
    }

    if (name === "Z1-FOLDER-EXP") return setupFolderExplorer();
    if (name === "Z2-Metadata Viewer") return setupMetadataViewer();
    if (name === "Z3-Multi-Selector") return setupMultiSelector();

    const page = appState.prompts.pages[name];

    // Get the ordered list of categories for this page
    const categoriesToShow = appState.categoryOrder[name] || Object.keys(page);

    categoriesToShow.forEach(cat => {
        // Skip categories that don't exist in the page data (defensive check)
        if (!page[cat]) {
            console.warn(`Category "${cat}" not found in page "${name}", skipping...`);
            return;
        }

        const div = document.createElement("div");
        div.className = "mb-10 prompt-grid-container";

        // Check if this category is collapsed
        const isCollapsed = appState.collapsedCategories[`${name}-${cat}`] || false;
        const collapseButtonText = isCollapsed ? '+' : '−';
        const collapseButtonTitle = isCollapsed ? 'Expand Category' : 'Collapse Category';

        div.innerHTML = `
            <div class="category-header-controls flex items-center justify-between gap-1 mb-2 px-1">
                <!-- Left: Arrows -->
                <div class="flex items-center gap-1">
                    <button class="move-category-up-btn text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white text-xl font-bold hover-popout p-1" data-category="${cat}" title="Move Left/Up">↑</button>
                    <button class="move-category-down-btn text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white text-xl font-bold hover-popout p-1" data-category="${cat}" title="Move Right/Down">↓</button>
                </div>
                
                <!-- Center: Actions -->
                <div class="flex items-center gap-2">
                     <button class="add-prompt-btn px-2 py-1 bg-green-600 text-white rounded text-sm font-bold hover-popout shake-on-hover shadow-sm flex items-center justify-center w-8 h-8" data-category="${cat}" title="Add Prompt">✚</button>
                    <button class="rename-category-btn px-2 py-1 bg-blue-600 text-white rounded text-sm hover-popout shake-on-hover shadow-sm flex items-center justify-center w-8 h-8" data-category="${cat}" title="Rename Category">✏️</button>
                    <button class="delete-category-btn px-2 py-1 bg-red-600 text-white rounded text-sm hover-popout shake-on-hover shadow-sm flex items-center justify-center w-8 h-8" data-category="${cat}" title="Delete Category">🗑️</button>
                </div>

                <!-- Right: Collapse -->
                <button class="collapse-category-btn text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white text-xl font-bold hover-popout p-1" data-category="${cat}" title="${collapseButtonTitle}">${collapseButtonText}</button>
            </div>
            
            <!-- Bottom: Title -->
            <div class="mb-4 text-center">
                 <h2 class="text-xl font-bold border-b-2 border-gray-200 dark:border-gray-700 pb-1 category-title inline-block px-4 truncate max-w-full" style="color: inherit !important;" title="${cat}">${cat}</h2>
            </div>
            
            <div class="prompt-grid${isCollapsed ? ' collapsed' : ''}" id="${name}-${cat}-grid"></div>`;
        container.appendChild(div);
        const grid = div.querySelector('.prompt-grid');

        // Apply variant filtering
        const promptsToShow = page[cat].filter(p => {
            if (!appState.currentVariantFilter) return true;

            // Handle legacy and new format
            const variants = p.variants || { "Default": p };
            return Object.keys(variants).includes(appState.currentVariantFilter);
        });

        // Show message if variant filter is active but no prompts match
        if (appState.currentVariantFilter && promptsToShow.length === 0) {
            const noPromptsMsg = document.createElement('div');
            noPromptsMsg.className = 'text-center py-4 text-gray-500 dark:text-gray-400 italic';
            noPromptsMsg.textContent = `No prompts with variant "${appState.currentVariantFilter}" found on this page.`;
            grid.appendChild(noPromptsMsg);
        }

        promptsToShow.forEach(p => grid.appendChild(createPromptCard(p, cat)));
        new Sortable(grid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            handle: '.img-handle',
            onEnd: (evt) => {
                const list = appState.prompts.pages[appState.currentPage][cat];
                list.splice(evt.newIndex, 0, list.splice(evt.oldIndex, 1)[0]);
            }
        });
    });
}

// Variant filter functionality
document.getElementById('variant-filter').onchange = (e) => {
    appState.currentVariantFilter = e.target.value || null;
    if (!document.getElementById('search').value) {
        showPage(appState.currentPage);
    } else {
        document.getElementById('search').dispatchEvent(new Event('input'));
    }
};

// Rename All Variants functionality
function updateRenameVariantsDropdown() {
    const dropdown = document.getElementById('rename-variant-old-name');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Select variant to rename</option>';

    // Use global variants list (include Default variant for renaming)
    const allVariantNames = new Set(appState.globalVariants);

    // Add sorted variant names to dropdown
    const sortedVariants = Array.from(allVariantNames).sort();
    sortedVariants.forEach(variantName => {
        const option = document.createElement('option');
        option.value = variantName;
        option.textContent = variantName;
        dropdown.appendChild(option);
    });
}

// Rename all variants function
function renameAllVariants(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return false;

    let changesMade = false;

    // Rename variant in all pages and prompts
    Object.keys(appState.prompts.pages).forEach(pageName => {
        const page = appState.prompts.pages[pageName];
        Object.keys(page).forEach(category => {
            page[category].forEach(prompt => {
                if (prompt.variants && prompt.variants[oldName]) {
                    // Rename the variant
                    prompt.variants[newName] = prompt.variants[oldName];

                    // Update active variant if needed
                    if (prompt.activeVariant === oldName) {
                        prompt.activeVariant = newName;
                    }

                    // Remove old variant name
                    delete prompt.variants[oldName];
                    changesMade = true;

                    // If we renamed the Default variant, create a new Default variant
                    // to ensure it always exists in the prompt
                    if (oldName === "Default") {
                        prompt.variants["Default"] = {
                            tag: "New",
                            description: "...",
                            image: null
                        };
                        // Update global variants to include Default
                        appState.globalVariants.add("Default");
                    }
                }
            });
        });
    });

    // Update current variant filter if needed
    if (appState.currentVariantFilter === oldName) {
        appState.currentVariantFilter = newName;
    }

    // Update global variants list
    if (changesMade) {
        appState.globalVariants.delete(oldName);
        appState.globalVariants.add(newName);
    }

    return changesMade;
}

// Setup rename variants button
document.getElementById('rename-all-variants-btn')?.addEventListener('click', () => {
    updateRenameVariantsDropdown();
    document.getElementById('rename-variants-modal').classList.remove('hidden');
    document.getElementById('rename-variant-new-name').value = '';
});

document.getElementById('cancel-rename-variants')?.addEventListener('click', () => {
    document.getElementById('rename-variants-modal').classList.add('hidden');
});

document.getElementById('confirm-rename-variants')?.addEventListener('click', () => {
    const oldName = document.getElementById('rename-variant-old-name').value;
    const newName = document.getElementById('rename-variant-new-name').value.trim();

    if (!oldName) {
        utils.showWarning("Please select a variant to rename");
        return;
    }

    if (!newName) {
        utils.showWarning("Please enter a new name");
        return;
    }

    if (newName === "Default") {
        utils.showWarning("Cannot rename to 'Default' - this is a reserved name");
        return;
    }

    // Check if new name already exists
    let nameExists = false;
    Object.keys(appState.prompts.pages).forEach(pageName => {
        const page = appState.prompts.pages[pageName];
        Object.keys(page).forEach(category => {
            page[category].forEach(prompt => {
                if (prompt.variants && prompt.variants[newName]) {
                    nameExists = true;
                }
            });
        });
    });

    if (nameExists) {
        utils.showWarning(`Variant "${newName}" already exists!`);
        return;
    }

    // Perform the rename
    const changesMade = renameAllVariants(oldName, newName);

    if (changesMade) {
        if (oldName === "Default") {
            utils.showWarning(`Renamed "Default" variant to "${newName}" across all prompts! A new "Default" variant will be created in each prompt.`);
        } else {
            utils.showWarning(`Renamed "${oldName}" to "${newName}" across all prompts!`);
        }
        renderPages();
        updateVariantFilterDropdown();
        updateRenameVariantsDropdown();
    } else {
        utils.showWarning("No changes made - variant not found");
    }

    document.getElementById('rename-variants-modal').classList.add('hidden');
});

// Search functionality with debounce for performance
let searchTimeout = null;
document.getElementById('search').oninput = e => {
    const t = e.target.value.toLowerCase();

    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);

    // Debounce: wait 250ms before executing search
    searchTimeout = setTimeout(() => {
        if (!t) return showPage(appState.currentPage);
        const container = document.getElementById('pages-container');
        container.innerHTML = "";
        Object.keys(appState.prompts.pages).forEach(pName => {
            if (pName.startsWith("Z")) return;
            const matches = [];
            Object.keys(appState.prompts.pages[pName]).forEach(cat => {
                appState.prompts.pages[pName][cat].forEach(p => {
                    // Handle legacy and new format
                    const variants = p.variants || { "Default": p };
                    const activeVariant = variants[p.activeVariant || "Default"] || variants[Object.keys(variants)[0]];

                    const tagMatch = activeVariant.tag && activeVariant.tag.toLowerCase().includes(t);
                    const descMatch = activeVariant.description && activeVariant.description.toLowerCase().includes(t);

                    // Apply variant filter if set
                    if (appState.currentVariantFilter) {
                        const hasVariant = Object.keys(variants).includes(appState.currentVariantFilter);
                        if (!hasVariant) return;
                    }

                    if (tagMatch || descMatch) {
                        matches.push({ ...p, _c: cat });
                    }
                });
            });
            if (matches.length) {
                const div = document.createElement('div');
                div.className = "mb-8";
                div.innerHTML = `<h2 class="text-xl font-bold bg-white dark:bg-gray-800 p-2 rounded mb-2 shadow">${pName}</h2><div class="prompt-grid"></div>`;
                const g = div.querySelector('.prompt-grid');
                matches.forEach(m => g.appendChild(createPromptCard(m, m._c)));
                container.appendChild(div);
            }
        });
    }, 250);
};