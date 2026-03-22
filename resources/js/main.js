let targetDownloadDir = '';
let downloads = {};
let historyData = [];

async function initApp() {
    Neutralino.init();

    Neutralino.events.on("windowClose", async () => {
        Neutralino.window.hide();
    });

    if (NL_OS !== 'Darwin') {
        let trayOpts = {
            icon: '/resources/icons/appIcon.png',
            menuItems: [
                { id: "show", text: "Show Downloader" },
                { id: "quit", text: "Exit" }
            ]
        };
        Neutralino.os.setTray(trayOpts).catch(e => console.log('Tray not supported', e));
    }
    
    Neutralino.events.on('trayMenuItemClicked', async (e) => {
        if (e.detail.id === 'show') {
            Neutralino.window.show();
        } else if (e.detail.id === 'quit') {
            try { await fetch('http://localhost:5050/api/shutdown', { method: 'POST' }); } catch(err) {}
            Neutralino.app.exit();
        }
    });

    // Receive message from Chrome Extension via localhost server listener
    Neutralino.events.on('new-download', (evt) => {
        const payload = evt.detail;
        if (payload && payload.url) {
            if (payload.url.startsWith('blob:') || payload.url.startsWith('data:')) {
                // Diabaikan karena file berada dalam memori browser
                return;
            }
            // Bypass Pop-up Confirmation if the link is a critical link that expires in X seconds!
            if (payload.url.includes('X-Amz-Expires=') || payload.url.includes('Expires=')) {
                startGenericDownload(payload);
            } else {
                showConfirmModal(payload);
            }
        }
    });

    Neutralino.events.on('dl-started', (evt) => {
        const { id, engine } = evt.detail;
        if (downloads[id] && downloads[id].ui.engineElem) {
            const el = downloads[id].ui.engineElem;
            if (engine === 'multi') {
                el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="gold" stroke="#ca8a04" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><svg width="14" height="14" viewBox="0 0 24 24" fill="gold" stroke="#ca8a04" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
                el.title = "Multi-Threaded (Ultra Fast)";
            } else {
                el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#10b981" stroke="#047857" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
                el.title = "Single-Thread (Normal)";
            }
            if (fileName) {
                downloads[id].ui.titleElem.innerText = fileName;
                downloads[id].ui.titleElem.title = fileName;
                downloads[id].filename = fileName; // Sinkronkan ke objek memory
                console.log(`[UI] Memperbarui nama file kartu ${id} menjadi: ${fileName}`);
            }
        }
    });

    // Event progress dari backend (node-downloader-helper)
    Neutralino.events.on('dl-progress', (evt) => {
        const { id, progress, speed, downloaded, total } = evt.detail;
        if (downloads[id]) {
            updateProgressUI(id, { percent: progress.toFixed(2), speed: formatBytes(speed) + '/s', downloaded: formatBytes(downloaded), total: formatBytes(total) });
        }
    });

    Neutralino.events.on('dl-end', (evt) => {
        const { id, info } = evt.detail;
        if (downloads[id]) {
            downloads[id].completed = true;
            downloads[id].finalFilePath = info.filePath;
            
            // Jaminan Mutlak: Paksa UI membaca nama riil OS
            if (info.filePath) {
                let finalNameFromOS = info.filePath.replace(/\\/g, '/').split('/').pop();
                if (finalNameFromOS) {
                    downloads[id].ui.titleElem.innerText = finalNameFromOS;
                    downloads[id].ui.titleElem.title = finalNameFromOS;
                    downloads[id].filename = finalNameFromOS;
                    console.log(`[UI] Memperbarui final nama kartu ${id} menjadi: ${finalNameFromOS}`);
                }
            }

            updateStatus(id, "Download Complete!", false, true);
            downloads[id].ui.fillElem.style.width = '100%';
            downloads[id].ui.fillElem.className = 'progress-fill progress-bar-success'; // Add success class
            downloads[id].ui.btnPause.style.display = 'none';
            downloads[id].ui.btnResume.style.display = 'none';
            downloads[id].ui.btnCancel.style.display = 'none';
            if (downloads[id].ui.btnOpenFolder) downloads[id].ui.btnOpenFolder.style.display = 'inline-flex';
            if (downloads[id].ui.btnOpenFile) downloads[id].ui.btnOpenFile.style.display = 'inline-flex';
            finalizeCard(id);
        }
    });

    Neutralino.events.on('dl-error', (evt) => {
        const { id, error } = evt.detail;
        if (downloads[id]) {
            updateStatus(id, "Error: " + error, true);
            downloads[id].ui.btnPause.style.display = 'none';
            downloads[id].ui.btnResume.style.display = 'none';
            downloads[id].ui.btnCancel.style.display = 'none';
        }
    });

    try {
        let hData = await Neutralino.storage.getData('downloadHistory');
        if (hData) historyData = JSON.parse(hData);
    } catch (err) { }

    let savedFolder = null;
    try { savedFolder = await Neutralino.storage.getData('savedDownloadDir'); } catch (err) { }

    try {
        if (savedFolder) targetDownloadDir = savedFolder;
        else targetDownloadDir = await Neutralino.os.getPath('downloads');
        document.getElementById('dirPathText').innerText = targetDownloadDir;
    } catch (e) {
        targetDownloadDir = `${NL_CWD}/downloads`;
        document.getElementById('dirPathText').innerText = targetDownloadDir;
    }
}

async function changeDownloadDir() {
    try {
        let selectedFolder = await Neutralino.os.showFolderDialog('Select Download Folder');
        if (selectedFolder) {
            targetDownloadDir = selectedFolder;
            await Neutralino.storage.setData('savedDownloadDir', targetDownloadDir);
            document.getElementById('dirPathText').innerText = targetDownloadDir;
            let cdFolderElem = document.getElementById('cdFolder');
            if (cdFolderElem) cdFolderElem.value = targetDownloadDir;
            let settingDirElem = document.getElementById('settingDirText');
            if (settingDirElem) settingDirElem.value = targetDownloadDir;
        }
    } catch (e) {
        console.error("Failed to open dialog", e);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function buildDownloadCard(dlId, url) {
    const container = document.getElementById('downloadsList');

    const card = document.createElement('div');
    card.className = 'download-item';
    card.id = `card_${dlId}`;

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div id="title_${dlId}" class="dl-header selectable-text" style="margin:0; padding:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:10px;" title="${url}">Initializing: ${url}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div id="engine_${dlId}" style="display: flex; gap: 2px;"></div>
                <span id="percent_${dlId}" style="font-weight: 700; font-size: 0.85rem; color: var(--primary);">0%</span>
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">
            <span id="status_${dlId}" class="status-text selectable-text" style="display:inline-block; font-size: 0.75rem;">Starting downloader...</span>
            <span id="detail_${dlId}">Size: ? / ? | Speed: -</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <div class="progress-bar-container" style="margin: 0; flex: 1; height: 8px;">
                <div id="fill_${dlId}" class="progress-fill"></div>
            </div>
            <div class="dl-actions" id="dl-actions_${dlId}" style="margin: 0; padding: 0;">
                <button id="btnPause_${dlId}" class="btn-warning" onclick="pauseDownload('${dlId}')">Pause</button>
                <button id="btnResume_${dlId}" class="btn-success" onclick="resumeDownload('${dlId}')" style="display:none;">Resume</button>
                <button id="btnCancel_${dlId}" class="btn-danger" onclick="cancelDownload('${dlId}')">Cancel</button>
            </div>
        </div>
    `;

    container.prepend(card);

    const controls = document.getElementById(`dl-actions_${dlId}`);

    const btnOpenFolder = document.createElement('button');
    btnOpenFolder.className = 'btn-primary';
    btnOpenFolder.style.display = 'none';
    btnOpenFolder.title = 'Open Folder';
    btnOpenFolder.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    btnOpenFolder.style.padding = '0.3rem 0.6rem';
    btnOpenFolder.onclick = () => {
        if (downloads[dlId] && downloads[dlId].outputFolder) {
            safeOpenPath(downloads[dlId].outputFolder);
        }
    };
    controls.appendChild(btnOpenFolder);

    const btnOpenFile = document.createElement('button');
    btnOpenFile.className = 'btn-success';
    btnOpenFile.style.display = 'none';
    btnOpenFile.title = 'Open File';
    btnOpenFile.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    btnOpenFile.style.padding = '0.3rem 0.6rem';
    btnOpenFile.onclick = () => {
        if (downloads[dlId] && downloads[dlId].finalFilePath) {
            safeOpenPath(downloads[dlId].finalFilePath);
        }
    };
    controls.appendChild(btnOpenFile);

    return {
        card,
        titleElem: document.getElementById(`title_${dlId}`),
        engineElem: document.getElementById(`engine_${dlId}`),
        percentElem: document.getElementById(`percent_${dlId}`),
        detailElem: document.getElementById(`detail_${dlId}`),
        fillElem: document.getElementById(`fill_${dlId}`),
        statusElem: document.getElementById(`status_${dlId}`),
        btnPause: document.getElementById(`btnPause_${dlId}`),
        btnResume: document.getElementById(`btnResume_${dlId}`),
        btnCancel: document.getElementById(`btnCancel_${dlId}`),
        btnOpenFolder: btnOpenFolder,
        btnOpenFile: btnOpenFile
    };
}

// Variabel antrean payload UI
let confirmQueue = [];
let isConfirmModalOpen = false;

function processNextConfirm() {
    if (confirmQueue.length === 0) {
        document.getElementById('confirmDownloadModal').style.display = 'none';
        isConfirmModalOpen = false;
        return;
    }
    if (isConfirmModalOpen) return;

    isConfirmModalOpen = true;
    let payload = confirmQueue[0];
    
    document.getElementById('cdUrl').value = payload.url || '';
    let title = payload.filename || (payload.url || '').split('/').pop().split('?')[0] || 'Unknown_File';
    if (title) title = title.replace(/\\/g, '/').split('/').pop();
    if (!title) title = 'file_download';
    document.getElementById('cdFilename').value = title;
    document.getElementById('cdFolder').value = targetDownloadDir;
    document.getElementById('confirmDownloadModal').style.display = 'flex';
}

// Fungsi modal Pop up Layaknya IDM
async function showConfirmModal(payload) {
    try { closeHistoryModal(); } catch(e) {}
    try { closeSettingsModal(); } catch(e) {}
    try {
        await Neutralino.window.unminimize();
        await Neutralino.window.show();
        await Neutralino.window.focus();
        await Neutralino.window.setAlwaysOnTop(true);
        setTimeout(() => Neutralino.window.setAlwaysOnTop(false), 500);
    } catch(e) {}

    confirmQueue.push(payload || {});
    processNextConfirm();
}

function closeConfirmModal() {
    document.getElementById('confirmDownloadModal').style.display = 'none';
    isConfirmModalOpen = false;
    confirmQueue.shift(); // Buang antrean yang sedang aktif
    if (confirmQueue.length > 0) {
        setTimeout(processNextConfirm, 300); // Munculkan pop-up selanjutnya setelah 0.3 dtk
    }
}

function startConfirmedDownload() {
    if (confirmQueue.length === 0) return;
    
    let currentPayload = confirmQueue[0];
    currentPayload.url = document.getElementById('cdUrl').value;
    currentPayload.filename = document.getElementById('cdFilename').value;
    startGenericDownload(currentPayload);
    
    // Fungsi close akan otomatis memandu ke pop-up antrean selanjutnya
    closeConfirmModal();
}

// Tergerak saat klik Download langsung dari UI input manual
function prepareDownload() {
    const urlInput = document.getElementById('urlInput');
    const targetUrl = urlInput.value.trim();
    if (!targetUrl) return;
    
    if (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:')) {
        let msg = "URL dengan format 'blob:' atau 'data:' (seperti Mega.nz) tidak dapat diunduh oleh aplikasi ini karena file tersebut berada di dalam memori browser. Silakan unduh menggunakan browser bawaan.";
        Neutralino.os.showMessageBox('URL Tidak Didukung', msg, 'OK', 'ERROR');
        return;
    }
    
    document.getElementById('urlInput').value = '';
    
    showConfirmModal({ url: targetUrl, filename: '' });
}

// Event utama pengiriman ke Nodejs
function startGenericDownload(payloadObj) {
    const url = payloadObj.url;
    let filename = payloadObj.filename || '';

    // Secure filename from hidden Chrome extension C:\ absolute path injection
    if (filename) filename = filename.replace(/\\/g, '/').split('/').pop();

    const dlId = 'dl_' + Date.now();
    Neutralino.window.show();
    
    let title = filename || url.split('/').pop().split('?')[0] || 'Unknown_File';
    if (!title) title = 'file_download';

    const uiRefs = buildDownloadCard(dlId, url);
    uiRefs.titleElem.innerText = title;

    downloads[dlId] = {
        id: dlId,
        url: url,
        ui: uiRefs,
        completed: false,
        cancelled: false,
        outputFolder: targetDownloadDir
    };

    // Instruct backend to start and include header cookies
    Neutralino.extensions.dispatch('listener', 'action-download', {
        task: 'start',
        id: dlId,
        url: payloadObj.url,
        downloadPath: targetDownloadDir,
        filename: title,
        cookie: payloadObj.cookie || '',
        userAgent: payloadObj.userAgent || '',
        referrer: payloadObj.referrer || ''
    }).catch(e => {
        updateStatus(dlId, "Failed to call backend downloader. Error: " + e.message, true);
    });
}

function updateProgressUI(dlId, data) {
    const entry = downloads[dlId];
    if (!entry || entry.cancelled) return;
    
    entry.ui.fillElem.style.width = data.percent + '%';

    entry.ui.percentElem.innerText = data.percent + "%";
    entry.ui.detailElem.innerText = `Size: ${data.downloaded} / ${data.total} | Speed: ${data.speed}`;
    updateStatus(dlId, "Downloading media...");
}

function updateStatus(dlId, msg, isError = false, isSuccess = false) {
    const entry = downloads[dlId];
    if (entry) {
        entry.ui.statusElem.innerText = msg;
        if (isError) entry.ui.statusElem.style.color = '#ef4444';
        else if (isSuccess) entry.ui.statusElem.style.color = '#10b981';
        else entry.ui.statusElem.style.color = '#fbbf24';
    }
}

function pauseDownload(dlId) {
    const entry = downloads[dlId];
    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'pause', id: dlId }).catch(()=>{});
    
    entry.ui.btnPause.style.display = 'none';
    entry.ui.btnResume.style.display = 'inline-block';
    entry.ui.btnResume.disabled = false;
    updateStatus(dlId, "Paused...");
}

function resumeDownload(dlId) {
    const entry = downloads[dlId];
    entry.ui.btnResume.disabled = true;
    updateStatus(dlId, "Resuming download...");
    
    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'resume', id: dlId }).catch(()=>{});
    entry.ui.btnResume.style.display = 'none';
    entry.ui.btnPause.style.display = 'inline-block';
}

async function cancelDownload(dlId) {
    let response = await Neutralino.os.showMessageBox('Cancel Download', 'Are you sure you want to cancel this download?', 'YES_NO', 'QUESTION');
    if (response !== 'YES') return;

    const entry = downloads[dlId];
    entry.cancelled = true;

    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'cancel', id: dlId }).catch(()=>{});

    entry.ui.fillElem.style.width = '0%';
    updateStatus(dlId, "Download cancelled.", true);
    entry.ui.btnPause.style.display = 'none';
    entry.ui.btnResume.style.display = 'none';
    entry.ui.btnCancel.style.display = 'none';
    if (entry.ui.btnOpenFolder) entry.ui.btnOpenFolder.style.display = 'none';
    if (entry.ui.btnOpenFile) entry.ui.btnOpenFile.style.display = 'none';

    saveToHistory(entry.url, entry.ui.titleElem.innerText, "0 MB", "Cancelled / Failed", entry.outputFolder, null);
}

function finalizeCard(dlId) {
    const entry = downloads[dlId];
    entry.ui.btnPause.style.display = 'none';
    entry.ui.btnResume.style.display = 'none';
    entry.ui.btnCancel.style.display = 'none';
    // These are now handled in dl-end event
    // entry.ui.btnOpenFolder.style.display = 'inline-block';
    // entry.ui.btnOpenFile.style.display = 'inline-block';

    let sizeStr = entry.ui.detailElem.innerText.split('|')[0].replace('Size:', '').split('/')[1];
    saveToHistory(entry.url, entry.ui.titleElem.innerText, sizeStr ? sizeStr.trim() : 'Unknown', "Completed", entry.outputFolder, entry.finalFilePath);
}

async function saveToHistory(url, title, sizeStr, status, folder, finalFilePath) {
    historyData.unshift({
        id: 'h_' + Date.now(),
        url: url,
        title: title !== `Initializing: ${url}` ? title : url,
        size: sizeStr,
        status: status,
        folder: folder,
        finalFilePath: finalFilePath, // Save final file path
        date: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    });
    if (historyData.length > 50) historyData.pop();
    try { await Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
}

function showHistoryModal() {
    const listContainer = document.getElementById('historyListContainer');
    listContainer.innerHTML = '';

    const clearBtn = document.getElementById('btnClearHistory');
    if (clearBtn) clearBtn.style.display = historyData.length > 0 ? 'inline-flex' : 'none';

    if (historyData.length === 0) {
        listContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 2rem;">No download history available yet.</div>';
    } else {
        historyData.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';

            const isCompleted = item.status === "Completed";
            let buttonsHtml = '';
            if (isCompleted && item.folder) {
                buttonsHtml += `<button class="btn-primary" onclick="safeOpenPath('${item.folder.replace(/\\/g, '\\\\')}')" title="Open Folder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </button>`;
            }
            if (isCompleted && item.finalFilePath) {
                buttonsHtml += `<button class="btn-success" style="margin-left: 0.5rem;" onclick="safeOpenPath('${item.finalFilePath.replace(/\\/g, '\\\\')}')" title="Open File">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </button>`;
            }
            buttonsHtml += `<button class="btn-danger" style="margin-left: 0.5rem;" onclick="deleteHistoryItem('${item.id}')" title="Remove from History">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>`;
            const actionHtml = `<div class="hi-actions">${buttonsHtml}</div>`;

            div.innerHTML = `
                <div class="hi-top">
                    <div class="hi-title selectable-text" title="${item.url}">${item.title}</div>
                    ${actionHtml}
                </div>
                <div class="hi-bottom selectable-text">
                    <span>${item.date} &bull; ${item.size}</span>
                    <span style="font-weight: 600; color: ${isCompleted ? 'var(--success)' : 'var(--danger)'};">${item.status}</span>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }

    document.getElementById('historyModal').style.display = 'flex';
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

function showSettingsModal() {
    let el = document.getElementById('settingDirText');
    if (el) el.value = targetDownloadDir;
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

async function safeOpenPath(targetPath) {
    try {
        let stats = await Neutralino.filesystem.getStats(targetPath);
        if (stats) {
            await Neutralino.os.open(targetPath);
        }
    } catch (e) {
        Neutralino.os.showMessageBox('Not Found', 'The file or folder you are trying to open no longer exists or has been moved.', 'OK', 'ERROR');
    }
}

async function deleteHistoryItem(id) {
    historyData = historyData.filter(item => item.id !== id);
    try { await Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
    showHistoryModal();
}

async function clearAllHistory() {
    let response = await Neutralino.os.showMessageBox('Clear History', 'Are you sure you want to clear all download history?', 'YES_NO', 'QUESTION');
    if (response === 'YES') {
        historyData = [];
        try { await Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
        showHistoryModal();
    }
}

async function installExtensionUI() {
    let msg = "How to enable automatic download interceptor in Google Chrome:\n\n" +
              "1. After clicking YES, the extension folder will open for you.\n" +
              "2. Open Google Chrome manually (if not open).\n" +
              "3. Type chrome://extensions/ in the address bar and press Enter.\n" +
              "4. Enable Developer mode at the top right of Chrome.\n" +
              "5. Drag and Drop the 'chrome-extension' folder into that page.\n\n" +
              "Open the extension folder now?";
    
    let res = await Neutralino.os.showMessageBox('Chrome Extension Setup', msg, 'YES_NO', 'INFO');
    if (res === 'YES') {
        const extPath = `${NL_CWD}/chrome-extension`.replace(/\\/g, '/');
        Neutralino.os.open(extPath).catch(() => {});
    }
}

initApp();
