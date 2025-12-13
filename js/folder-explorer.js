// Folder Explorer Module

let currentFolderData = null;
let selectedFiles = new Set();

// Initialize global variables if they don't exist
if (typeof window.currentLightboxFiles === 'undefined') {
    window.currentLightboxFiles = [];
}
if (typeof window.currentLightboxIndex === 'undefined') {
    window.currentLightboxIndex = 0;
}

// Use the global variables
let currentLightboxFiles = window.currentLightboxFiles;
let currentLightboxIndex = window.currentLightboxIndex;

// Make loadDirectoryContents available globally
window.loadDirectoryContents = loadDirectoryContents;

// File operation helper functions
function getFileExtension(filename) {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

function getFileNameWithoutExtension(filename) {
    return filename.slice(0, (filename.lastIndexOf(".") === -1) ? filename.length : filename.lastIndexOf("."));
}

function setupFolderExplorer() {
    // Initialize state variables if they don't exist
    if (!appState.currentPath) appState.currentPath = [];
    if (!appState.currentDrive) appState.currentDrive = null;
    if (!appState.folderPageIndex) appState.folderPageIndex = 0;
    if (!appState.pageSize) appState.pageSize = 100;

    // Initialize lightbox variables
    currentLightboxFiles = [];
    currentLightboxIndex = 0;

    // Setup enhanced lightbox functionality
    setupExplorerLightbox();
    const container = document.getElementById('pages-container');
    container.innerHTML = `
        <div id="folder-bookmarks-bar" class="flex gap-3 mb-4 overflow-x-auto scrollbar-hide py-2 h-14 items-center"></div>
        <div class="flex items-center gap-4 mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md sticky top-20 z-[25]">
            <button id="folder-back-btn" class="px-3 py-2 bg-gray-300 dark:bg-gray-700 rounded hover:bg-gray-400 disabled:opacity-50">← Back</button>
            <span id="folder-current-path" class="font-medium flex-1 truncate px-2 text-lg">No Folder Selected</span>
            <button id="star-folder-btn" class="text-3xl hover:text-yellow-400 transition-colors pb-1" title="Bookmark current view">☆</button>
            <button id="folder-select-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow font-bold">📂 Open Folder</button>
        </div>
        <div class="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
            <div class="flex items-center gap-2">
                <input type="text" id="manual-path-input" placeholder="Enter path (e.g., C:/Images or /path/to/folder)" 
                       class="flex-1 px-4 py-2 text-sm rounded border dark:border-gray-600 bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500">
                <button id="go-to-path-btn" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow font-bold">Go</button>
            </div>
        </div>
        <div id="folder-exp-container" class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 pb-10"></div>
        <div id="pagination-controls" class="flex justify-center gap-4 py-8 hidden">
            <button id="prev-page" class="px-4 py-2 bg-gray-700 text-white rounded">Prev</button>
            <span id="page-info" class="self-center font-bold"></span>
            <button id="next-page" class="px-4 py-2 bg-gray-700 text-white rounded">Next</button>
        </div>
    `;

    renderBookmarks();

    document.getElementById('folder-select-btn').onclick = async () => {
        showDriveSelection();
    };

    document.getElementById('go-to-path-btn').onclick = async () => {
        const pathInput = document.getElementById('manual-path-input');
        const path = pathInput.value.trim();

        if (path) {
            try {
                if (path.includes(':')) {
                    appState.currentDrive = path.split(':')[0] + ':/';
                    const remainingPath = path.substring(path.indexOf(':') + 1).replace(/\\/g, '/');
                    const pathParts = remainingPath.split('/').filter(p => p);
                    await loadDirectoryContents(pathParts);
                } else if (path.startsWith('/')) {
                    appState.currentDrive = null;
                    const pathParts = path.substring(1).split('/').filter(p => p);
                    await loadDirectoryContents(pathParts);
                } else {
                    appState.currentDrive = null;
                    const pathParts = path.split('/').filter(p => p);
                    await loadDirectoryContents(pathParts);
                }

                pathInput.value = '';
            } catch (e) {
                utils.showWarning("Error navigating to path: " + e.message);
            }
        }
    };

    document.getElementById('manual-path-input').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            document.getElementById('go-to-path-btn').click();
        }
    });

    document.getElementById('folder-back-btn').onclick = async () => {
        if (appState.currentPath.length > 0) {
            appState.currentPath.pop();
            await loadDirectoryContents(appState.currentPath);
        }
    };

    const star = document.getElementById('star-folder-btn');
    star.onclick = async () => {
        if (appState.currentPath.length === 0 && !currentFolderData) {
            return utils.showWarning("Open a folder first!");
        }

        let key, dispName;
        if (appState.currentDrive) {
            let fullPath = appState.currentDrive;
            if (appState.currentPath.length > 0) {
                fullPath += appState.currentPath.join('/');
            }
            key = fullPath;
            dispName = appState.currentPath.length ? appState.currentPath[appState.currentPath.length - 1] : appState.currentDrive;
        } else {
            const pathStr = appState.currentPath.join('/');
            key = pathStr;
            dispName = appState.currentPath.length ? appState.currentPath[appState.currentPath.length - 1] : "Root";
        }

        const response = await fetch('/api/folder-bookmarks');
        let folderBookmarks = [];
        if (response.ok) {
            folderBookmarks = await response.json();
        }

        const exists = folderBookmarks.some(b => b.key === key);
        if (exists) {
            folderBookmarks = folderBookmarks.filter(b => b.key !== key);
            utils.showWarning("Bookmark Removed");
        } else {
            folderBookmarks.push({
                name: dispName,
                key: key,
                path: [...appState.currentPath],
                drive: appState.currentDrive,
                type: 'folder'
            });
            utils.showWarning("Bookmarked!");
        }

        await fetch('/api/folder-bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(folderBookmarks)
        });

        renderBookmarks();
        checkStar();
    };
}

async function loadDirectoryContents(pathArray) {
    utils.toggleLoader(true, "Loading folder...");

    try {
        if (appState.currentDrive) {
            let fullPath = appState.currentDrive;
            if (pathArray.length > 0) {
                fullPath += pathArray.join('/');
            }

            const urlPath = fullPath.replace(/\\/g, '/');
            const response = await fetch(`/api/folders/${urlPath}`);

            if (!response.ok) throw new Error("Failed to load folder");

            currentFolderData = await response.json();
            appState.currentPath = pathArray;
        } else {
            const pathStr = pathArray.join('/');
            const url = pathStr ? `/api/folders/${pathStr}` : '/api/folders';

            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to load folder");

            currentFolderData = await response.json();
            appState.currentPath = pathArray;
        }

        renderFolderContents();
    } catch (e) {
        utils.showWarning("Error loading folder: " + e.message);
    }

    utils.toggleLoader(false);
}

function renderFolderContents() {
    const grid = document.getElementById('folder-exp-container');
    grid.innerHTML = "";

    if (!currentFolderData) {
        document.getElementById('folder-current-path').textContent = "No Folder Selected";
        document.getElementById('folder-back-btn').disabled = true;
        return;
    }

    let disp;
    if (appState.currentDrive) {
        let fullPath = appState.currentDrive;
        if (appState.currentPath.length > 0) {
            fullPath += appState.currentPath.join(' / ');
        }
        disp = fullPath;
    } else {
        disp = appState.currentPath.length ? appState.currentPath.join(' / ') : "Root";
    }

    document.getElementById('folder-current-path').textContent = disp;
    document.getElementById('folder-back-btn').disabled = (appState.currentPath.length === 0);
    checkStar();

    if (currentFolderData.folders && currentFolderData.folders.length > 0) {
        currentFolderData.folders.forEach(folderName => {
            const div = document.createElement('div');
            div.className = "bg-gray-200 dark:bg-gray-700 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 shadow transition-all h-32";
            div.innerHTML = `<div class="text-4xl mb-1">📁</div><div class="font-bold text-center truncate w-full text-xs">${folderName}</div>`;
            div.onclick = async () => {
                const newPath = [...appState.currentPath, folderName];
                await loadDirectoryContents(newPath);
            };
            grid.appendChild(div);
        });
    }

    const files = currentFolderData.files || [];
    const imageFiles = files.filter(file => /\.(png|jpg|jpeg|webp|gif)$/i.test(file));

    const total = imageFiles.length;
    const start = appState.folderPageIndex * appState.pageSize;
    const end = start + appState.pageSize;
    const slice = imageFiles.slice(start, end);
    const pDiv = document.getElementById('pagination-controls');

    if (total > appState.pageSize) {
        pDiv.classList.remove('hidden');
        document.getElementById('page-info').textContent = `${appState.folderPageIndex + 1} / ${Math.ceil(total / appState.pageSize)}`;
        document.getElementById('prev-page').disabled = appState.folderPageIndex === 0;
        document.getElementById('next-page').disabled = end >= total;
        document.getElementById('prev-page').onclick = () => {
            appState.folderPageIndex--;
            renderFolderContents();
            window.scrollTo(0, 0);
        };
        document.getElementById('next-page').onclick = () => {
            appState.folderPageIndex++;
            renderFolderContents();
            window.scrollTo(0, 0);
        };
    } else {
        pDiv.classList.add('hidden');
    }

    slice.forEach(fileName => {
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-gray-800 rounded shadow border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-all flex flex-col relative group";

        const imgBox = document.createElement('div');
        imgBox.className = "h-32 bg-gray-100 dark:bg-gray-900 border-b dark:border-gray-700 flex items-center justify-center overflow-hidden relative";
        const img = document.createElement('img');
        img.className = "w-full h-full object-contain";

        let filePath;
        if (appState.currentDrive) {
            let fullPath = appState.currentDrive;
            if (appState.currentPath.length > 0) {
                fullPath += appState.currentPath.join('/') + '/';
            }
            filePath = fullPath + fileName;
        } else {
            filePath = appState.currentPath.length ? appState.currentPath.join('/') + '/' + fileName : fileName;
        }

        const urlPath = filePath.replace(/\\/g, '/');
        if (appState.currentDrive || filePath.includes(':')) {
            img.src = `/files/${urlPath}`;
        } else {
            img.src = `/${urlPath}`;
        }

        // Add hover buttons for file operations
        const actionButtons = document.createElement('div');
        actionButtons.className = "absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10";

        const renameBtn = document.createElement('button');
        renameBtn.className = "w-6 h-6 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center justify-center";
        renameBtn.title = "Rename File";
        renameBtn.textContent = "✍️";
        renameBtn.onclick = async (e) => {
            e.stopPropagation();
            const newName = prompt("Enter new filename:", fileName);
            if (newName && newName !== fileName) {
                try {
                    const oldFullPath = filePath;
                    const newFullPath = filePath.replace(fileName, newName);
                    await window.renameFile(oldFullPath, newFullPath);
                    utils.showWarning(`Renamed to: ${newName}`);
                    // Refresh the folder contents
                    await loadDirectoryContents(appState.currentPath);
                } catch (e) {
                    utils.showWarning("Error: " + e.message);
                }
            }
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = "w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold flex items-center justify-center";
        deleteBtn.title = "Delete File";
        deleteBtn.textContent = "🗑️";
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Delete ${fileName}? This cannot be undone!`)) {
                try {
                    await window.deleteFile(filePath);
                    utils.showWarning(`Deleted: ${fileName}`);
                    // Refresh the folder contents
                    await loadDirectoryContents(appState.currentPath);
                } catch (e) {
                    utils.showWarning("Error: " + e.message);
                }
            }
        };

        // Add Create Prompt Card button
        const createPromptBtn = document.createElement('button');
        createPromptBtn.className = "w-6 h-6 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold flex items-center justify-center";
        createPromptBtn.title = "Create Prompt Card";
        createPromptBtn.textContent = "🎨";
        createPromptBtn.onclick = async (e) => {
            e.stopPropagation();
            showCreatePromptModal(filePath, fileName);
        };

        actionButtons.appendChild(renameBtn);
        actionButtons.appendChild(deleteBtn);
        actionButtons.appendChild(createPromptBtn);
        imgBox.appendChild(actionButtons);

        imgBox.onclick = () => {
            // Store current files for lightbox navigation
            currentLightboxFiles = imageFiles;
            currentLightboxIndex = imageFiles.indexOf(fileName);
            utils.openLightbox(img.src);
        };
        imgBox.appendChild(img);
        card.appendChild(imgBox);

        // Make filename selectable and add selection functionality
        const meta = document.createElement('div');
        meta.className = "p-2 text-center text-xs font-bold truncate bg-gray-50 dark:bg-gray-800 selectable-filename";
        meta.textContent = fileName;
        meta.dataset.filename = fileName;
        meta.dataset.filepath = filePath;

        // Add click to select/deselect
        meta.onclick = (e) => {
            e.stopPropagation();
            const filename = meta.dataset.filename;
            const filepath = meta.dataset.filepath;

            if (selectedFiles.has(filepath)) {
                selectedFiles.delete(filepath);
                meta.classList.remove('bg-blue-200', 'dark:bg-blue-900');
            } else {
                selectedFiles.add(filepath);
                meta.classList.add('bg-blue-200', 'dark:bg-blue-900');
            }

            console.log('Selected files:', Array.from(selectedFiles));
        };

        // Double click to copy filename
        meta.ondblclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(fileName);
            utils.showWarning(`Copied: ${fileName}`);
        };

        card.appendChild(meta);

        card.onclick = (e) => {
            if (!e.target.closest('.h-32') && !e.target.closest('.selectable-filename')) {
                navigator.clipboard.writeText(fileName);
                utils.showWarning(`Copied: ${fileName}`);
            }
        };

        grid.appendChild(card);
    });
}

// Create Prompt Card Modal Functions
function showCreatePromptModal(filePath, fileName) {
    const modal = document.getElementById('create-prompt-modal');

    // Populate page dropdown
    const pageSelect = document.getElementById('create-prompt-page');
    pageSelect.innerHTML = '<option value="">Select a page</option>';

    // Filter out special pages (Z1-FOLDER-EXP, Z2-Metadata Viewer, Z3-Multi-Selector)
    const regularPages = Object.keys(appState.prompts.pages).filter(page => !page.startsWith('Z'));
    regularPages.forEach(page => {
        const option = document.createElement('option');
        option.value = page;
        option.textContent = page;
        pageSelect.appendChild(option);
    });

    // Reset other fields
    document.getElementById('create-prompt-category').innerHTML = '<option value="">Select a category</option>';
    document.getElementById('create-prompt-tag').value = getFileNameWithoutExtension(fileName);
    document.getElementById('create-prompt-description').value = '';

    // Set up event listeners
    pageSelect.onchange = () => {
        const selectedPage = pageSelect.value;
        const categorySelect = document.getElementById('create-prompt-category');

        if (selectedPage) {
            categorySelect.innerHTML = '<option value="">Select a category</option>';
            const categories = Object.keys(appState.prompts.pages[selectedPage] || {});
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        } else {
            categorySelect.innerHTML = '<option value="">Select a category</option>';
        }
    };

    // Set up save button
    document.getElementById('save-create-prompt').onclick = () => {
        saveCreatePrompt(filePath, fileName);
    };

    // Set up cancel button
    document.getElementById('cancel-create-prompt').onclick = () => {
        modal.classList.add('hidden');
        // Also close the lightbox if it was open
        if (typeof closeLightbox === 'function') {
            closeLightbox();
        }
    };

    // Show modal
    modal.classList.remove('hidden');
}

function saveCreatePrompt(filePath, fileName) {
    const pageSelect = document.getElementById('create-prompt-page');
    const categorySelect = document.getElementById('create-prompt-category');
    const tagInput = document.getElementById('create-prompt-tag');
    const descriptionInput = document.getElementById('create-prompt-description');

    const page = pageSelect.value;
    const category = categorySelect.value;
    const tag = tagInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!page) {
        utils.showWarning('Please select a page');
        return;
    }

    if (!category) {
        utils.showWarning('Please select a category');
        return;
    }

    if (!tag) {
        utils.showWarning('Please enter a prompt tag');
        return;
    }

    // Create the new prompt
    const newPrompt = {
        id: 'p' + Math.random().toString(36).substr(2, 9), // Unique ID
        variants: {
            "Default": {
                tag: tag,
                description: description || "...",
                note: "",
                image: fileName // Store the filename
            }
        },
        activeVariant: "Default"
    };

    // Add to the selected page and category
    if (!appState.prompts.pages[page][category]) {
        appState.prompts.pages[page][category] = [];
    }

    appState.prompts.pages[page][category].push(newPrompt);

    // Copy the image to the images folder
    copyImageToImagesFolder(filePath, fileName).then(result => {
        if (result && result.destination_name && result.destination_name !== fileName) {
            // Update the prompt with the new filename if it changed
            newPrompt.variants.Default.image = result.destination_name;
        }

        // Close modal and lightbox, show success message
        document.getElementById('create-prompt-modal').classList.add('hidden');
        if (typeof closeLightbox === 'function') {
            closeLightbox();
        }
        utils.showWarning('Prompt card created successfully!');

        // Re-render to show the new prompt
        if (!appState.currentPage.startsWith("Z")) {
            showPage(appState.currentPage);
        }
    }).catch(error => {
        console.error('Error copying image:', error);
        // Still close the modal/lightbox and show the prompt was created, but with a warning
        document.getElementById('create-prompt-modal').classList.add('hidden');
        if (typeof closeLightbox === 'function') {
            closeLightbox();
        }
        utils.showWarning('Prompt card created, but image copy failed!');

        // Re-render to show the new prompt
        if (!appState.currentPage.startsWith("Z")) {
            showPage(appState.currentPage);
        }
    });
}

async function copyImageToImagesFolder(filePath, fileName) {
    try {
        // Extract just the filename from the full path
        const sourcePath = filePath;
        const destinationName = fileName;

        // Create form data for the upload
        const response = await fetch('/api/copy-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_path: sourcePath,
                destination_name: destinationName
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to copy image');
        }

        const result = await response.json();
        console.log('Image copied successfully:', result);
        return result;

    } catch (error) {
        console.error('Error copying image:', error);
        utils.showWarning('Error copying image: ' + error.message);
        throw error;
    }
}

function checkStar() {
    const star = document.getElementById('star-folder-btn');
    if (!star || !currentFolderData) return;

    let key;
    if (appState.currentDrive) {
        let fullPath = appState.currentDrive;
        if (appState.currentPath.length > 0) {
            fullPath += appState.currentPath.join('/');
        }
        key = fullPath;
    } else {
        const pathStr = appState.currentPath.join('/');
        key = pathStr;
    }

    fetch('/api/folder-bookmarks')
        .then(response => response.json())
        .then(bookmarks => {
            star.textContent = bookmarks.some(b => b.key === key) ? "⭐" : "☆";
        })
        .catch(() => {
            star.textContent = "☆";
        });
}

async function showDriveSelection() {
    const modal = document.getElementById('drive-modal');
    const grid = document.getElementById('drive-grid');
    grid.innerHTML = "";

    try {
        utils.toggleLoader(true, "Loading drives...");

        const response = await fetch('/api/drives');
        if (!response.ok) throw new Error("Failed to load drives");

        const drives = await response.json();

        drives.forEach(drive => {
            const div = document.createElement('div');
            div.className = "bg-gray-100 dark:bg-gray-700 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 shadow transition-all h-24";
            div.innerHTML = `<div class="text-3xl mb-1 font-bold">${drive.letter}:</div><div class="text-sm font-medium">${drive.name}</div>`;
            div.onclick = () => {
                appState.currentDrive = drive.path;
                appState.currentPath = [];
                modal.classList.add('hidden');
                loadDirectoryContents([]);
            };
            grid.appendChild(div);
        });

        modal.classList.remove('hidden');

        document.getElementById('cancel-drive').onclick = () => {
            modal.classList.add('hidden');
        };

    } catch (e) {
        utils.showWarning("Error loading drives: " + e.message);
    } finally {
        utils.toggleLoader(false);
    }
}

async function renderBookmarks() {
    const bar = document.getElementById('folder-bookmarks-bar');
    bar.innerHTML = "";

    try {
        const response = await fetch('/api/folder-bookmarks');
        if (!response.ok) return;

        const folderBookmarks = await response.json();

        folderBookmarks.forEach(bm => {
            const chip = document.createElement('div');
            chip.className = "flex items-center gap-2 bg-gray-200 dark:bg-gray-700 px-4 py-1.5 rounded-full shadow cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors group border border-gray-300 dark:border-gray-600 flex-shrink-0";
            chip.innerHTML = `<span class="font-bold text-sm">📁 ${bm.name}</span><span class="text-red-500 opacity-0 group-hover:opacity-100 font-bold ml-2 hover:scale-125 transition-transform del">×</span>`;

            chip.onclick = async (e) => {
                if (e.target.classList.contains('del')) {
                    if (confirm("Delete Bookmark?")) {
                        const updatedBookmarks = folderBookmarks.filter(b => b.key !== bm.key);
                        await fetch('/api/folder-bookmarks', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updatedBookmarks)
                        });
                        renderBookmarks();
                        checkStar();
                    }
                    return;
                }

                appState.currentDrive = bm.drive || null;
                await loadDirectoryContents(bm.path || []);
            };
            bar.appendChild(chip);
        });
    } catch (e) {
        console.error("Error loading bookmarks:", e);
    }
}