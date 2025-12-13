// Prompt Manager Module

// Create prompt card
function createPromptCard(prompt, category) {
    // Handle legacy prompts (convert to variant format if needed)
    if (!prompt.variants) {
        // Convert old format to new variant format
        prompt.variants = {
            "Default": {
                tag: prompt.tag || "New",
                description: prompt.description || "...",
                image: prompt.image || null
            }
        };
        prompt.activeVariant = "Default";
    }

    // Ensure active variant exists
    if (!prompt.activeVariant || !prompt.variants[prompt.activeVariant]) {
        const availableVariants = Object.keys(prompt.variants);
        prompt.activeVariant = availableVariants[0] || "Default";
    }

    // Ensure all variants have proper structure
    Object.keys(prompt.variants).forEach(variantName => {
        if (!prompt.variants[variantName].tag) {
            prompt.variants[variantName].tag = "New";
        }
        if (!prompt.variants[variantName].description) {
            prompt.variants[variantName].description = "...";
        }
        if (!prompt.variants[variantName].note) {
            prompt.variants[variantName].note = "";
        }
    });

    // Generate unique ID for this prompt if it doesn't have one
    if (!prompt.id) {
        prompt.id = 'p' + Math.random().toString(36).substr(2, 9);
    }

    // Use filtered variant if filter is active and variant exists
    let activeVariant;
    if (appState.currentVariantFilter && prompt.variants[appState.currentVariantFilter]) {
        activeVariant = prompt.variants[appState.currentVariantFilter];
    } else if (prompt.variants[prompt.activeVariant]) {
        activeVariant = prompt.variants[prompt.activeVariant];
    } else {
        // Fallback to first available variant if activeVariant is invalid
        const availableVariants = Object.keys(prompt.variants);
        activeVariant = prompt.variants[availableVariants[0]];
    }

    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden cursor-pointer transition-all hover-popout border border-gray-200 dark:border-gray-700 prompt-card flex flex-col';

    // Variant navigation controls
    const variantNav = document.createElement('div');
    variantNav.className = 'bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-1 flex items-center justify-between';

    // Add filtering indicator if filter is active
    if (appState.currentVariantFilter) {
        variantNav.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900');
    }

    const variantName = document.createElement('span');
    variantName.className = 'text-xs text-gray-300 dark:text-white font-semibold truncate flex-1 text-center';

    // Show the actual displayed variant (could be different from activeVariant due to filtering)
    const displayedVariant = appState.currentVariantFilter && prompt.variants[appState.currentVariantFilter]
        ? appState.currentVariantFilter
        : prompt.activeVariant;
    variantName.textContent = displayedVariant;

    const variantControls = document.createElement('div');
    variantControls.className = 'flex gap-1';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'text-xs px-2 py-1 bg-gray-300 dark:bg-gray-700 rounded hover:bg-gray-400 dark:hover:bg-gray-600 variant-nav-btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = !!appState.currentVariantFilter;
    prevBtn.title = appState.currentVariantFilter ? 'Navigation disabled during filtering' : 'Previous variant';
    prevBtn.onclick = (e) => {
        e.stopPropagation();
        if (!appState.currentVariantFilter) {
            navigateVariant(prompt, -1);
            renderPages();
        }
    };

    const nextBtn = document.createElement('button');
    nextBtn.className = 'text-xs px-2 py-1 bg-gray-300 dark:bg-gray-700 rounded hover:bg-gray-400 dark:hover:bg-gray-600 variant-nav-btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = !!appState.currentVariantFilter;
    nextBtn.title = appState.currentVariantFilter ? 'Navigation disabled during filtering' : 'Next variant';
    nextBtn.onclick = (e) => {
        e.stopPropagation();
        if (!appState.currentVariantFilter) {
            navigateVariant(prompt, 1);
            renderPages();
        }
    };

    variantControls.appendChild(prevBtn);
    variantControls.appendChild(nextBtn);
    variantNav.appendChild(variantName);
    variantNav.appendChild(variantControls);
    card.appendChild(variantNav);

    // Add note display and edit functionality
    const noteContainer = document.createElement('div');
    noteContainer.className = 'bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-2 py-1 note-container';

    const noteDisplay = document.createElement('div');
    noteDisplay.className = 'flex items-center justify-between';

    const noteText = document.createElement('span');
    noteText.className = 'text-xs text-gray-600 dark:text-gray-300 truncate flex-1 note-text';
    noteText.textContent = activeVariant.note || 'Add note...';
    noteText.title = activeVariant.note || 'Add note...';

    const noteEditBtn = document.createElement('button');
    noteEditBtn.className = 'text-xs px-2 py-1 bg-yellow-600 dark:bg-green-600 rounded hover:bg-yellow-300 dark:hover:bg-yellow-600 note-edit-btn';
    noteEditBtn.textContent = '📝';
    noteEditBtn.title = 'Edit note';
    noteEditBtn.onclick = (e) => {
        e.stopPropagation();
        editPromptNote(prompt, displayedVariant);
    };

    noteDisplay.appendChild(noteText);
    noteDisplay.appendChild(noteEditBtn);
    noteContainer.appendChild(noteDisplay);
    card.appendChild(noteContainer);

    const imgBox = document.createElement('div');
    imgBox.className = 'relative border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 img-handle aspect-square';
    const img = document.createElement('img');
    img.className = 'w-full h-full object-cover block';

    if (activeVariant.image) {
        img.src = `/images/${activeVariant.image}`;
    } else {
        const t = ['.png', '.jpg', '.jpeg', '.webp'];
        let i = 0;
        const n = () => {
            if (i >= 4) { img.src = '/images/default.png'; return; }
            img.src = `/images/${activeVariant.tag.replace(/ /g, '_')}${t[i++]}`;
        };
        img.onerror = n;
        n();
    }
    imgBox.appendChild(img);

    // Add overlay message for default prompts
    if (activeVariant.tag === "New" && activeVariant.description === "...") {
        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 transition-opacity';
        overlay.innerHTML = `<p class="text-white text-sm text-center font-medium drop-shadow-md">Edit the Prompt to Add an image</p>`;
        imgBox.appendChild(overlay);
    }

    // Drag-Drop Upload
    imgBox.ondragover = e => { e.preventDefault(); imgBox.classList.add('opacity-50'); };
    imgBox.ondragleave = () => imgBox.classList.remove('opacity-50');
    imgBox.ondrop = e => {
        e.preventDefault();
        imgBox.classList.remove('opacity-50');
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) {
            // Check if this is a default "New" prompt that hasn't been edited
            const activeVariantData = prompt.variants[prompt.activeVariant];
            if (activeVariantData.tag === "New" && activeVariantData.description === "...") {
                utils.showWarning("Edit the Prompt to Add an image");
                return;
            }

            const r = new FileReader();
            r.onload = ev => img.src = ev.target.result;
            r.readAsDataURL(f);
            const fd = new FormData();
            fd.append('image', f);
            fd.append('page', utils.getState().currentPage);
            fd.append('category', category);
            fd.append('prompt_tag', prompt.variants[prompt.activeVariant].tag);
            fd.append('variant_name', displayedVariant); // Pass the variant name
            fd.append('prompt_id', prompt.id); // Pass the unique prompt ID
            fetch('/api/upload-image', { method: 'POST', body: fd }).then(res => res.json()).then(d => { if (!d.error) prompt.variants[prompt.activeVariant].image = d.filename; });
        }
    };

    const overlay = document.createElement('div');
    overlay.className = 'hidden absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 transition-opacity';
    overlay.innerHTML = `<p class="text-white text-sm text-center font-medium drop-shadow-md">${activeVariant.description}</p>`;
    imgBox.appendChild(overlay);
    imgBox.onmouseenter = () => { overlay.classList.remove('hidden'); overlay.classList.add('flex'); };
    imgBox.onmouseleave = () => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); };
    card.appendChild(imgBox);

    const tag = document.createElement('div');
    tag.className = 'px-4 py-3 font-bold text-lg text-center leading-tight break-words prompt-card-text';
    tag.textContent = activeVariant.tag;
    card.appendChild(tag);

    const btnRow = document.createElement('div');
    btnRow.className = 'flex justify-between gap-1 p-2 edit-buttons bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 mt-auto';
    const mkBtn = (t, c, fn) => {
        const b = document.createElement('button');
        b.textContent = t;
        b.className = c;
        b.onclick = (e) => { e.stopPropagation(); fn() };
        return b;
    };
    btnRow.appendChild(mkBtn('Edit', 'flex-1 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded mr-1', () => {
        appState.currentEditPrompt = prompt;
        appState.currentEditVariant = prompt.activeVariant;
        const activeVariant = prompt.variants[prompt.activeVariant];
        document.getElementById('edit-text').value = `${activeVariant.tag}\n${activeVariant.description}`;
        document.getElementById('edit-note').value = activeVariant.note || '';

        // Show modal first, then update selector to ensure DOM is ready
        document.getElementById('edit-modal').classList.remove('hidden');
        setTimeout(updateVariantSelector, 50);
    }));
    btnRow.appendChild(mkBtn('Del', 'flex-1 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded mr-1', () => {
        const variantCount = Object.keys(prompt.variants).length;
        const confirmMessage = variantCount > 1
            ? `Delete entire prompt (all ${variantCount} variants)?`
            : "Delete this prompt?";
        if (confirm(confirmMessage)) {
            const l = appState.prompts.pages[appState.currentPage][category];
            l.splice(l.indexOf(prompt), 1);
            renderPages();
        }
    }));
    card.appendChild(btnRow);

    card.onclick = (e) => {
        if (!e.target.closest('button')) {
            // Use the same variant that's being displayed (respects filtering)
            const displayedVariant = appState.currentVariantFilter && prompt.variants[appState.currentVariantFilter]
                ? prompt.variants[appState.currentVariantFilter]
                : prompt.variants[prompt.activeVariant];
            navigator.clipboard.writeText(`${displayedVariant.tag}: ${displayedVariant.description}`);
            utils.showWarning("Copied!");
        }
    };
    return card;
}

// Edit prompt note function - uses modal instead of prompt
function editPromptNote(promptData, variantName) {
    const modal = document.getElementById('note-modal');
    const textarea = document.getElementById('note-textarea');
    const variantInfo = document.getElementById('note-modal-variant-info');
    const saveBtn = document.getElementById('save-note');
    const cancelBtn = document.getElementById('cancel-note');

    // Set current values
    textarea.value = promptData.variants[variantName].note || '';
    variantInfo.textContent = `Variant: ${variantName}`;

    // Show modal
    modal.classList.remove('hidden');
    textarea.focus();

    // Save handler
    const handleSave = () => {
        promptData.variants[variantName].note = textarea.value;
        modal.classList.add('hidden');
        renderPages();
        cleanup();
    };

    // Cancel handler
    const handleCancel = () => {
        modal.classList.add('hidden');
        cleanup();
    };

    // Cleanup event listeners
    const cleanup = () => {
        saveBtn.removeEventListener('click', handleSave);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);
}

// Variant navigation function
function navigateVariant(prompt, direction) {
    const variantNames = Object.keys(prompt.variants);
    const currentIndex = variantNames.indexOf(prompt.activeVariant);

    if (currentIndex === -1) {
        prompt.activeVariant = variantNames[0];
        return;
    }

    let newIndex = currentIndex + direction;

    // Wrap around
    if (newIndex < 0) {
        newIndex = variantNames.length - 1;
    } else if (newIndex >= variantNames.length) {
        newIndex = 0;
    }

    prompt.activeVariant = variantNames[newIndex];
}