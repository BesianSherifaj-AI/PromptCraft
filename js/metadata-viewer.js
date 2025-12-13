// Metadata Viewer Module

function setupMetadataViewer() {
    const container = document.getElementById('pages-container');
    container.innerHTML = `<div id="metadata-dropzone" class="border-4 border-dashed border-gray-400 dark:border-gray-600 p-10 text-center mb-6 rounded-lg cursor-pointer hover:border-primary-500 transition-colors"><p class="text-xl font-semibold mb-2">📁 Drag & Drop Images</p><p class="text-sm text-gray-600 dark:text-gray-400">Supports ComfyUI, Automatic1111, and Forge formats</p></div><div id="metadata-container" class="grid gap-6"></div>`;
    
    const d = document.getElementById("metadata-dropzone");
    d.ondragover=e=>{e.preventDefault();d.classList.add("border-primary-500")};
    d.ondragleave=()=>d.classList.remove("border-primary-500");
    d.ondrop=e=>{e.preventDefault();d.classList.remove("border-primary-500");procMeta(e.dataTransfer.files)};
    d.onclick=()=>{const i=document.createElement("input");i.type="file";i.multiple=true;i.accept=".png,.jpg,.jpeg,.webp";i.onchange=e=>procMeta(e.target.files);i.click()};
}

function extractMetadataFromFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            if (file.type === 'image/png') {
                const arrayBuffer = event.target.result;
                const uint8Array = new Uint8Array(arrayBuffer);
                
                let textContent = '';
                try {
                    textContent = String.fromCharCode.apply(null, uint8Array);
                } catch (e) {
                    textContent = '';
                    const chunkSize = 10000;
                    for (let i = 0; i < uint8Array.length; i += chunkSize) {
                        const chunk = uint8Array.subarray(i, i + chunkSize);
                        textContent += String.fromCharCode.apply(null, chunk);
                    }
                }
                
                const prompts = extractPromptFromMetadataString(textContent);
                
                if (prompts.length > 0) {
                    callback({
                        success: true,
                        filename: file.name,
                        metadata: {
                            filename: file.name,
                            source: "ComfyUI",
                            prompts: {
                                positive: prompts,
                                negative: []
                            },
                            raw_metadata: {}
                        }
                    });
                    return;
                }
            }
            
            callback(null);
        } catch (error) {
            callback(null);
        }
    };
    reader.readAsArrayBuffer(file);
}

function extractPromptFromMetadataString(metadataString) {
    const prompts = [];
    
    const regex1 = /"text"\s*:\s*"([^"]*?(?:\\.[^"]*)*)"\s*,\s*"clip"/g;
    let match;
    while ((match = regex1.exec(metadataString)) !== null) {
        if (match[1]) {
            let prompt = match[1].trim();
            prompt = decodeURIComponent(escape(prompt));
            if (prompt.startsWith('"') && prompt.endsWith('"')) {
                prompt = prompt.substring(1, prompt.length - 1);
            }
            prompt = prompt.replace(/\\"/g, '"');
            if (prompt.length > 5) {
                prompts.push(prompt);
            }
        }
    }
    
    if (prompts.length === 0) {
        const regex2 = /"text"\s*:\s*"((?:[^"]|\\.)*)"/g;
        while ((match = regex2.exec(metadataString)) !== null) {
            if (match[1]) {
                let prompt = match[1].trim();
                prompt = decodeURIComponent(escape(prompt));
                if (prompt.startsWith('"') && prompt.endsWith('"')) {
                    prompt = prompt.substring(1, prompt.length - 1);
                }
                prompt = prompt.replace(/\\"/g, '"');
                if (prompt.length > 5) {
                    prompts.push(prompt);
                }
            }
        }
    }
    
    if (prompts.length === 0) {
        const regex3 = /"text"\s*:\s*"([^"]*)"/g;
        while ((match = regex3.exec(metadataString)) !== null) {
            if (match[1]) {
                let prompt = match[1].trim();
                prompt = decodeURIComponent(escape(prompt));
                prompt = prompt.replace(/\\"/g, '"');
                if (prompt.length > 5) {
                    prompts.push(prompt);
                }
            }
        }
    }
    
    return prompts;
}

async function procMeta(files) {
    utils.toggleLoader(true, "Extracting metadata...");
    const container = document.getElementById("metadata-container");
    container.innerHTML = "";
    
    const filesArray = Array.from(files);
    
    for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        if (!file.type.startsWith('image/')) continue;
        
        try {
            extractMetadataFromFile(file, async function(clientSideResult) {
                let finalResult = clientSideResult;
                
                if (!clientSideResult) {
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    try {
                        const response = await fetch('/api/extract-metadata', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const serverResult = await response.json();
                        
                        if (serverResult.success === true) {
                            finalResult = serverResult;
                        } else if (serverResult.metadata && serverResult.metadata.source !== "unknown") {
                            finalResult = serverResult;
                        }
                    } catch (serverError) {
                        console.log("Server extraction failed:", serverError);
                    }
                }
                
                if (finalResult) {
                    displayMetadataResult(finalResult, file);
                } else {
                    displayMetadataError({
                        filename: file.name,
                        error: "No metadata found in the image"
                    }, file);
                }
            });
        } catch (error) {
            displayMetadataError({
                filename: file.name,
                error: "Failed to process image: " + error.message
            }, file);
        }
    }
    
    utils.toggleLoader(false);
}

function displayMetadataResult(result, fileObject) {
    const container = document.getElementById("metadata-container");
    const filename = result.filename;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgSrc = e.target.result;
        
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700';
        
        const header = document.createElement('div');
        header.className = 'bg-primary-600 text-white px-4 py-3 flex justify-between items-center';
        header.innerHTML = `
            <h3 class="font-bold text-lg truncate">${filename}</h3>
            <span class="bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-300 px-2 py-1 rounded text-xs font-semibold">
                ${result.metadata.source.toUpperCase()}
            </span>
        `;
        card.appendChild(header);
        
        const content = document.createElement('div');
        content.className = 'flex flex-col md:flex-row gap-4 p-4';
        
        const imgPreview = document.createElement('div');
        imgPreview.className = 'w-full md:w-64 flex-shrink-0';
        imgPreview.innerHTML = `<img src="${imgSrc}" class="w-full h-auto rounded border dark:border-gray-600 max-h-80 object-contain">`;
        content.appendChild(imgPreview);
        
        const metaContent = document.createElement('div');
        metaContent.className = 'flex-1 overflow-hidden';
        
        const metadata = result.metadata;
        
        if (metadata.prompts && (metadata.prompts.positive || metadata.prompts.negative)) {
            const promptsSection = document.createElement('div');
            promptsSection.className = 'mb-4';
            
            if (metadata.prompts.positive && metadata.prompts.positive.length > 0) {
                const positiveDiv = document.createElement('div');
                positiveDiv.className = 'mb-3';
                positiveDiv.innerHTML = `
                    <h4 class="font-bold text-green-600 dark:text-green-400 mb-2">✅ Positive Prompts:</h4>
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm whitespace-pre-wrap">
                        ${metadata.prompts.positive.map((p, i) => `<div class="mb-2"><strong>${i+1}.</strong> ${p}</div>`).join('')}
                    </div>
                `;
                promptsSection.appendChild(positiveDiv);
            }
            
            if (metadata.prompts.negative && metadata.prompts.negative.length > 0) {
                const negativeDiv = document.createElement('div');
                negativeDiv.innerHTML = `
                    <h4 class="font-bold text-red-600 dark:text-red-400 mb-2">❌ Negative Prompts:</h4>
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm whitespace-pre-wrap">
                        ${metadata.prompts.negative.map((p, i) => `<div class="mb-2"><strong>${i+1}.</strong> ${p}</div>`).join('')}
                    </div>
                `;
                promptsSection.appendChild(negativeDiv);
            }
            
            metaContent.appendChild(promptsSection);
        }
        
        if (metadata.parameters) {
            const paramsSection = document.createElement('div');
            paramsSection.className = 'mb-4';
            paramsSection.innerHTML = `<h4 class="font-bold text-blue-600 dark:text-blue-400 mb-2">⚙️ Parameters:</h4>`;
            
            const paramsGrid = document.createElement('div');
            paramsGrid.className = 'grid grid-cols-2 gap-2 text-sm';
            
            for (const [key, value] of Object.entries(metadata.parameters)) {
                const paramItem = document.createElement('div');
                paramItem.className = 'bg-gray-100 dark:bg-gray-700 p-2 rounded';
                paramItem.innerHTML = `<strong class="text-blue-600 dark:text-blue-300">${key}:</strong> ${value}`;
                paramsGrid.appendChild(paramItem);
            }
            
            paramsSection.appendChild(paramsGrid);
            metaContent.appendChild(paramsSection);
        }
        
        if (metadata.raw_metadata) {
            const rawSection = document.createElement('details');
            rawSection.className = 'mb-4';
            rawSection.innerHTML = `
                <summary class="font-bold text-gray-600 dark:text-gray-300 cursor-pointer mb-2">📊 Raw Metadata</summary>
                <pre class="bg-gray-900 text-gray-100 text-xs p-3 rounded overflow-auto max-h-64">${JSON.stringify(metadata.raw_metadata, null, 2)}</pre>
            `;
            metaContent.appendChild(rawSection);
        }
        
        content.appendChild(metaContent);
        card.appendChild(content);
        
        const actions = document.createElement('div');
        actions.className = 'flex gap-2 p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800';
        
        if (metadata.prompts && metadata.prompts.positive && metadata.prompts.positive.length > 0) {
            const copyPositiveBtn = document.createElement('button');
            copyPositiveBtn.className = 'flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold';
            copyPositiveBtn.textContent = '📋 Copy Positive Prompts';
            copyPositiveBtn.onclick = () => {
                navigator.clipboard.writeText(metadata.prompts.positive.join('\n'));
                utils.showWarning('Positive prompts copied!');
            };
            actions.appendChild(copyPositiveBtn);
        }
        
        if (metadata.prompts && metadata.prompts.negative && metadata.prompts.negative.length > 0) {
            const copyNegativeBtn = document.createElement('button');
            copyNegativeBtn.className = 'flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-semibold';
            copyNegativeBtn.textContent = '📋 Copy Negative Prompts';
            copyNegativeBtn.onclick = () => {
                navigator.clipboard.writeText(metadata.prompts.negative.join('\n'));
                utils.showWarning('Negative prompts copied!');
            };
            actions.appendChild(copyNegativeBtn);
        }
        
        if (metadata.prompts && (metadata.prompts.positive || metadata.prompts.negative)) {
            const copyAllBtn = document.createElement('button');
            copyAllBtn.className = 'flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold';
            copyAllBtn.textContent = '📋 Copy All Prompts';
            copyAllBtn.onclick = () => {
                const allPrompts = [
                    ...(metadata.prompts.positive || []),
                    ...(metadata.prompts.negative || [])
                ].join('\n\n');
                navigator.clipboard.writeText(allPrompts);
                utils.showWarning('All prompts copied!');
            };
            actions.appendChild(copyAllBtn);
        }
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-semibold';
        removeBtn.textContent = '🗑️ Remove';
        removeBtn.onclick = () => {
            card.remove();
            utils.showWarning('Image removed!');
        };
        actions.appendChild(removeBtn);
        
        card.appendChild(actions);
        container.appendChild(card);
    };
    
    reader.readAsDataURL(fileObject);
}

function displayMetadataError(errorResult, fileObject) {
    const container = document.getElementById("metadata-container");
    
    const card = document.createElement('div');
    card.className = 'bg-red-50 dark:bg-red-900 rounded-lg shadow-lg p-4 border border-red-200 dark:border-red-800';
    
    const content = document.createElement('div');
    content.className = 'flex items-start gap-3';
    
    const errorIcon = document.createElement('div');
    errorIcon.className = 'text-red-600 dark:text-red-400 text-2xl flex-shrink-0';
    errorIcon.textContent = '⚠️';
    content.appendChild(errorIcon);
    
    const details = document.createElement('div');
    details.className = 'flex-1';
    details.innerHTML = `
        <h3 class="font-bold text-red-800 dark:text-red-200 mb-2">${errorResult.filename}</h3>
        <p class="text-red-700 dark:text-red-300 text-sm">${errorResult.error}</p>
        <p class="text-gray-600 dark:text-gray-400 text-xs mt-2">This image may not contain AI generation metadata, or the format is not supported.</p>
    `;
    content.appendChild(details);
    
    card.appendChild(content);
    
    if (fileObject && fileObject.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgPreview = document.createElement('div');
            imgPreview.className = 'mt-4 p-2 bg-gray-100 dark:bg-gray-800 rounded';
            imgPreview.innerHTML = `<img src="${e.target.result}" class="max-w-full h-auto max-h-32 rounded">`;
            card.appendChild(imgPreview);
        };
        reader.readAsDataURL(fileObject);
    }
    
    container.appendChild(card);
}