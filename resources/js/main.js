let targetDownloadDir = '';
let downloads = {};
let historyData = [];
let startupEnabled = false;
let torrentMaxConns = 500; // Default recommended
let dnsProvider = 'system';
let dnsCustomPrimary = '';
let dnsCustomSecondary = '';

let currentPage = 1;
const itemsPerPage = 25;
let sortColumn = 'date'; // Default sort by date
let sortDirection = 'desc'; // desc = newest first

let colWidths = {
    col_file: '28%',
    col_size: '12%',
    col_speed: '10%',
    col_seeders: '7%',
    col_status: '13%',
    col_progress: '13%',
    col_date: '12%',
    col_action: '12%'
};

async function saveWindowState() {
    try {
        let isMaximized = await Neutralino.window.isMaximized();
        let size = await Neutralino.window.getSize();
        let pos = await Neutralino.window.getPosition();

        let winState = {
            isMaximized: isMaximized,
            width: size.width,
            height: size.height,
            x: pos.x,
            y: pos.y
        };
        await Neutralino.storage.setData('windowState', JSON.stringify(winState));
    } catch (e) { }
}

async function loadColWidths() {
    try {
        let saved = await Neutralino.storage.getData('tableColWidths');
        if (saved) {
            let parsed = JSON.parse(saved);
            Object.assign(colWidths, parsed);
        }
    } catch (e) { }

    for (const [id, w] of Object.entries(colWidths)) {
        let el = document.getElementById(id);
        if (el) el.style.width = w;
    }
}

async function saveColWidths() {
    try {
        await Neutralino.storage.setData('tableColWidths', JSON.stringify(colWidths));
    } catch (e) { }
}

function initTableResizers() {
    const table = document.querySelector('.downloads-table');
    if (!table) return;
    const cols = table.querySelectorAll('th');

    Array.from(cols).forEach((col, idx) => {
        if (idx === cols.length - 1) return;

        const resizer = document.createElement('div');
        resizer.classList.add('th-resizer');
        col.appendChild(resizer);

        let x = 0; let w = 0; let nextW = 0; let tableWidth = 0;
        let nextCol = cols[idx + 1];

        const mouseDownHandler = function (e) {
            x = e.clientX;
            w = col.offsetWidth;
            nextW = nextCol.offsetWidth;
            tableWidth = table.offsetWidth;

            resizer.classList.add('th-resizing');
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        };

        const mouseMoveHandler = function (e) {
            const dx = e.clientX - x;
            const newW = w + dx;
            const newNextW = nextW - dx;

            if (newW > 50 && newNextW > 50) {
                const pct1 = (newW / tableWidth) * 100;
                const pct2 = (newNextW / tableWidth) * 100;
                col.style.width = pct1 + '%';
                nextCol.style.width = pct2 + '%';

                colWidths[col.id] = pct1 + '%';
                colWidths[nextCol.id] = pct2 + '%';
            }
        };

        const mouseUpHandler = function () {
            resizer.classList.remove('th-resizing');
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            saveColWidths();
        };

        resizer.addEventListener('mousedown', mouseDownHandler);
    });
}

async function initApp() {
    Neutralino.init();
    
    Neutralino.window.setTitle(`File Download Manager v${window.NL_APPVERSION || '1.0.0'}`);

    // Handler saat tombol [X] diklik (Hanya sembunyikan jendela, jangan matikan aplikasi)
    Neutralino.events.on('windowClose', () => {
        console.log("Jendela ditutup (X). Menyembunyikan ke tray...");
        Neutralino.window.hide();
    });

    // EXPORT AUTH INFO ke lokasi yang mudah diakses ekstensi
    const exportAuth = async () => {
        try {
            console.log("Memulai proses export bridge auth...");

            const port = typeof NL_PORT !== 'undefined' ? NL_PORT : (typeof window !== 'undefined' ? window.NL_PORT : '');
            const token = typeof NL_TOKEN !== 'undefined' ? NL_TOKEN : (typeof window !== 'undefined' ? window.NL_TOKEN : '');
            let connectToken = typeof NL_CONNECT_TOKEN !== 'undefined' ? NL_CONNECT_TOKEN : (typeof window !== 'undefined' ? window.NL_CONNECT_TOKEN : '');

            if (!connectToken && token) {
                connectToken = token;
            }

            if (!port || !token) {
                console.warn("NL_PORT atau NL_TOKEN belum tersedia.");
                return;
            }

            const authData = JSON.stringify({
                nlPort: port,
                nlToken: token,
                nlConnectToken: connectToken,
                timestamp: Date.now()
            });

            const tryWrite = async (pathStr, name) => {
                try {
                    if (!pathStr) return false;
                    const folder = pathStr.substring(0, pathStr.lastIndexOf('/'));
                    if (folder) try { await Neutralino.filesystem.createDirectory(folder); } catch (e) { }
                    await Neutralino.filesystem.writeFile(pathStr, authData);
                    console.log(`✅ SUCCESS: Bridge Auth Exported to ${name}: ${pathStr}`);
                    return true;
                } catch (e) {
                    console.error(`❌ FAILED: Export to ${name} failed:`, e);
                    return false;
                }
            };

            // Lokasi 1: AppData
            try {
                const roamingPath = (await Neutralino.os.getPath('data')).replace(/\\/g, '/');
                const appDataPath = `${roamingPath}/com.awandigitals.file-download-manager`;
                await tryWrite(`${appDataPath}/.fdm_auth.json`, "AppData");
            } catch (e) {
                console.error("getPath('data') gagal:", e);
            }

            // Lokasi 2: OS Temp
            try {
                const tempPath = (await Neutralino.os.getPath('temp')).replace(/\\/g, '/');
                await tryWrite(`${tempPath}/.fdm_auth.json`, "OSTemp");
            } catch (e) {
                console.error("getPath('temp') gagal:", e);
            }
        } catch (e) {
            console.error("Export auth error:", e);
        }
    };

    // LANGSUNG tulis, TANPA delay! Token sudah tersedia saat initApp dipanggil.
    exportAuth();
    setInterval(exportAuth, 10000); // Refresh setiap 10 detik

    Neutralino.events.on("windowClose", async () => {
        await saveWindowState();
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
            // FIRE AND FORGET: Jangan 'await' di sini karena proses aplikasi 
            // sedang di ujung maut, tertahan sedikit saja bisa bikin zombie.
            Neutralino.storage.setData('windowState', '').catch(() => { });

            // Beri tahu ekstensi lewat WebSocket (lebih instan daripada HTTP fetch)
            Neutralino.extensions.dispatch('listener', 'action-download', { task: 'shutdown' }).catch(() => { });

            // Backup shutdown lewat HTTP
            fetch('http://localhost:5050/api/shutdown', { method: 'POST' }).catch(() => { });

            // Eksekusi mati total secepat mungkin
            setTimeout(() => {
                // Skenario pamungkas: Suruh OS bunuh dirinya sendiri lewat PID 
                // agar icon di Taskbar langsung lenyap seketika.
                if (typeof NL_PID !== 'undefined') {
                    Neutralino.os.execCommand(`taskkill /F /PID ${NL_PID}`).catch(() => { });
                }
                Neutralino.app.exit(0);
            }, 400);
        }
    });

    Neutralino.events.on('new-download', (evt) => {
        console.log("Menerima event new-download:", evt.detail);
        const payload = evt.detail;
        if (payload && payload.url) {
            console.log("Detail payload valid, memproses download...");
            if (payload.url.startsWith('blob:') || payload.url.startsWith('data:')) {
                console.warn("URL blob/data diabaikan.");
                return;
            }
            if (payload.url.includes('X-Amz-Expires=') || payload.url.includes('Expires=')) {
                console.log("Deteksi Direct Link/Cloud Link, memulai download langsung...");
                startGenericDownload(payload);
            } else {
                console.log("Menampilkan modal konfirmasi...");
                showConfirmModal(payload);
            }
        } else {
            console.error("Payload new-download tidak valid:", payload);
        }
    });

    Neutralino.events.on('dl-started', (evt) => {
        const { id, engine, fileName, seeders, leechers, totalPeers } = evt.detail;
        const validFileName = fileName || evt.detail.filename;
        console.log(`[DL-STARTED] ID: ${id}, Engine: ${engine}, FileName: ${validFileName}, Peers: ${totalPeers || 0}`);
        if (downloads[id]) {
            downloads[id].error = null; // Clear previous errors
            // Store peer info if available
            if (totalPeers !== undefined) {
                downloads[id].seeders = seeders || 0;
                downloads[id].leechers = leechers || 0;
                downloads[id].totalPeers = totalPeers || 0;
            }
            if (engine === 'multi') {
                downloads[id].engineHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="gold" stroke="#ca8a04" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><svg width="14" height="14" viewBox="0 0 24 24" fill="gold" stroke="#ca8a04" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
            } else if (engine === 'torrent') {
                downloads[id].engineHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="2"><circle cx="12" cy="12" r="8"></circle><circle cx="5" cy="5" r="1"></circle><circle cx="19" cy="5" r="1"></circle><circle cx="19" cy="19" r="1"></circle><circle cx="5" cy="19" r="1"></circle></svg>`;
            } else {
                downloads[id].engineHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#10b981" stroke="#047857" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
            }
            if (validFileName) {
                let hIndex = historyData.findIndex(h => h.id === id);
                if (hIndex >= 0) historyData[hIndex].title = validFileName;
                downloads[id].filename = validFileName;

                let titleEl = document.getElementById(`title_${id}`);
                if (titleEl) titleEl.innerText = validFileName;
            }
            let engEl = document.getElementById(`engine_${id}`);
            if (engEl) engEl.innerHTML = downloads[id].engineHtml;
        }
    });

    Neutralino.events.on('dl-progress', (evt) => {
        const { id, progress, speed, downloaded, total, peers, eta } = evt.detail;
        if (downloads[id] && !downloads[id].completed) {
            // Update peer count in real-time (for torrent)
            if (peers !== undefined) {
                downloads[id].totalPeers = peers;
                downloads[id].seeders = peers;
                // Update seeders cell
                const seedersEl = document.getElementById(`seeders_${id}`);
                if (seedersEl) seedersEl.textContent = peers;
            }
            
            const sizeStr = `${formatBytes(downloaded)} / ${formatBytes(total)}`;
            const speedStr = formatBytes(speed) + '/s';
            updateProgressUI(id, {
                percent: progress.toFixed(2),
                speed: speedStr,
                downloaded: formatBytes(downloaded),
                total: formatBytes(total),
                sizeDisplay: sizeStr
            });
        }
    });

    Neutralino.events.on('dl-end', (evt) => {
        const { id, info } = evt.detail;
        if (downloads[id]) {
            downloads[id].completed = true;
            downloads[id].finalFilePath = info.filePath;
            downloads[id].percent = '100';

            let finalName = info.filePath ? info.filePath.replace(/\\/g, '/').split('/').pop() : '';
            if (finalName) downloads[id].filename = finalName;

            let hIndex = historyData.findIndex(h => h.id === id);
            if (hIndex >= 0) {
                if (finalName) historyData[hIndex].title = finalName;
                historyData[hIndex].finalFilePath = info.filePath;
                historyData[hIndex].status = "Completed";
                let sizeStr = downloads[id].totalSizeStr;
                if (sizeStr) historyData[hIndex].size = sizeStr.trim();

                try { Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
            }
            renderPage();
        }
    });

    Neutralino.events.on('dl-error', (evt) => {
        const { id, error } = evt.detail;
        console.error(`[DL-ERROR] ID: ${id}, Error Message:`, error);
        
        // Update status with error (shorten known messages)
        let errorMsg;
        if (error.toLowerCase().includes('duplicate')) {
            errorMsg = 'Duplicate';
            // Auto-cancel duplicate download
            if (downloads[id]) downloads[id].cancelled = true;
            Neutralino.extensions.dispatch('listener', 'action-download', { task: 'cancel', id }).catch(() => {});
        } else {
            errorMsg = 'Failed';
        }

        if (downloads[id]) {
            // Store error for debugging
            downloads[id].error = error;
            downloads[id].errorTime = new Date().toLocaleTimeString();
            downloads[id].completed = true;
        }
        updateStatus(id, errorMsg, true);
        
        // Log to history
        let hIndex = historyData.findIndex(h => h.id === id);
        if (hIndex >= 0) {
            historyData[hIndex].status = errorMsg;
            historyData[hIndex].error = error;
            historyData[hIndex].errorTime = new Date().toLocaleTimeString();
            try { Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
        }
        
        // Show error in UI
        renderPage();
    });

    // Handle torrent warning (non-fatal, e.g. no peers yet)
    Neutralino.events.on('dl-warning', (evt) => {
        const { id, warning } = evt.detail;
        console.warn(`[DL-WARNING] ID: ${id}, Warning:`, warning);

        if (warning === 'No Peer') {
            // Mark as cancelled in memory
            if (downloads[id]) downloads[id].cancelled = true;
            updateStatus(id, 'No Peer');

            let hIndex = historyData.findIndex(h => h.id === id);
            if (hIndex >= 0) {
                historyData[hIndex].status = 'No Peer';
                try { Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
            }
            renderPage();
        } else if (downloads[id]) {
            updateStatus(id, `⚠ ${warning}`);
        }
    });

    // Handle torrent pause event
    Neutralino.events.on('dl-paused', (evt) => {
        const { id } = evt.detail;
        console.log(`[DL-PAUSED] ID: ${id}`);
        if (downloads[id]) {
            downloads[id].isPaused = true;
            updateStatus(id, 'Paused');
            
            let hIndex = historyData.findIndex(h => h.id === id);
            if (hIndex >= 0) {
                historyData[hIndex].status = 'Paused';
                try { Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
            }

            // Update buttons
            let btnPause = document.getElementById(`btnPause_${id}`);
            let btnResume = document.getElementById(`btnResume_${id}`);
            if (btnPause) btnPause.style.display = 'none';
            if (btnResume) btnResume.style.display = 'inline-block';
        }
    });

    // Handle torrent resume event
    Neutralino.events.on('dl-resumed', (evt) => {
        const { id } = evt.detail;
        console.log(`[DL-RESUMED] ID: ${id}`);
        if (downloads[id]) {
            downloads[id].isPaused = false;
            updateStatus(id, 'Downloading...');
            
            let hIndex = historyData.findIndex(h => h.id === id);
            if (hIndex >= 0) {
                historyData[hIndex].status = 'Downloading';
                try { Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
            }

            // Update buttons
            let btnPause = document.getElementById(`btnPause_${id}`);
            let btnResume = document.getElementById(`btnResume_${id}`);
            if (btnPause) btnPause.style.display = 'inline-block';
            if (btnResume) btnResume.style.display = 'none';
        }
    });

    // Handle app resource stats (delegated to app-stats module)
    await appStatsInit();
    Neutralino.events.on('app-stats', (evt) => {
        const { cpu, ram, netDown, netUp } = evt.detail;
        appStatsUpdate(cpu, ram, netDown, netUp);
    });

    try {
        let hData = await Neutralino.storage.getData('downloadHistory');
        if (hData) historyData = JSON.parse(hData);
    } catch (err) { }

    let savedFolder = null;
    try {
        const appDataPath = (await Neutralino.os.getPath('data')).replace(/\\/g, '/');
        const settingsPath = `${appDataPath}/com.awandigitals.file-download-manager/.fdm_settings.json`;
        let raw = await Neutralino.filesystem.readFile(settingsPath);
        if (raw) {
            let settings = JSON.parse(raw);
            savedFolder = settings.downloadDir || null;
            if (typeof settings.startupEnabled === 'boolean') {
                startupEnabled = settings.startupEnabled;
            }
            if (typeof settings.torrentMaxConns === 'number') {
                torrentMaxConns = settings.torrentMaxConns;
            }
            if (settings.dnsProvider) {
                dnsProvider = settings.dnsProvider;
            }
            if (settings.dnsCustomPrimary) {
                dnsCustomPrimary = settings.dnsCustomPrimary;
            }
            if (settings.dnsCustomSecondary) {
                dnsCustomSecondary = settings.dnsCustomSecondary;
            }
        }
    } catch (err) { }

    try {
        if (savedFolder) targetDownloadDir = savedFolder;
        else targetDownloadDir = await Neutralino.os.getPath('downloads');
        document.getElementById('dirPathText').innerText = targetDownloadDir;
    } catch (e) {
        targetDownloadDir = `${NL_CWD}/downloads`;
        document.getElementById('dirPathText').innerText = targetDownloadDir;
    }

    // If launched with --autostart flag, stay hidden in tray
    try {
        const args = await Neutralino.app.getConfig();
        const cliArgs = typeof NL_ARGS !== 'undefined' ? NL_ARGS : [];
        if (cliArgs.includes('--autostart')) {
            console.log('Launched via startup. Hiding to tray...');
            await Neutralino.window.hide();
        }
    } catch (e) { }

    try {
        let winStateStr = await Neutralino.storage.getData('windowState');
        if (winStateStr) {
            let winState = JSON.parse(winStateStr);
            if (winState.width && winState.height) {
                await Neutralino.window.setSize({
                    width: winState.width,
                    height: winState.height
                });
            }
            if (winState.x !== undefined && winState.y !== undefined) {
                await Neutralino.window.move(winState.x, winState.y);
            }
            if (winState.isMaximized) {
                await Neutralino.window.maximize();
            }
        }
    } catch (e) { }

    await loadColWidths();
    initTableResizers();
    renderPage();

    // Send saved DNS config to backend on startup
    if (dnsProvider && dnsProvider !== 'system') {
        const DNS_MAP = {
            google: { primary: '8.8.8.8', secondary: '8.8.4.4' },
            cloudflare: { primary: '1.1.1.1', secondary: '1.0.0.1' },
            'cloudflare-security': { primary: '1.1.1.2', secondary: '1.0.0.2' },
            quad9: { primary: '9.9.9.9', secondary: '149.112.112.112' },
            opendns: { primary: '208.67.222.222', secondary: '208.67.220.220' },
            adguard: { primary: '94.140.14.14', secondary: '94.140.15.15' }
        };
        let dnsServers = null;
        if (dnsProvider === 'custom' && dnsCustomPrimary) {
            dnsServers = { primary: dnsCustomPrimary, secondary: dnsCustomSecondary || dnsCustomPrimary };
        } else {
            dnsServers = DNS_MAP[dnsProvider] || null;
        }
        if (dnsServers) {
            setTimeout(() => {
                Neutralino.extensions.dispatch('listener', 'action-download', {
                    task: 'config',
                    key: 'dnsServers',
                    value: dnsServers
                }).catch(() => { });
            }, 3000); // Wait for backend to connect first
        }
    }
}

async function changeDownloadDir() {
    try {
        let selectedFolder = await Neutralino.os.showFolderDialog('Select Download Folder', { defaultPath: targetDownloadDir });
        console.log("Folder dialog result:", selectedFolder);
        if (selectedFolder) {
            targetDownloadDir = selectedFolder;
            
            // Update UI DULU (sebelum storage, agar tidak terblokir error)
            document.getElementById('dirPathText').innerText = targetDownloadDir;
            
            let cdFolderElem = document.getElementById('cdFolder');
            if (cdFolderElem) cdFolderElem.value = targetDownloadDir;
            
            let settingDirElem = document.getElementById('settingDirText');
            if (settingDirElem) settingDirElem.value = targetDownloadDir;
            
            console.log("✅ Folder diubah ke:", targetDownloadDir);
            
            // Simpan ke file settings (filesystem lebih reliable daripada storage)
            try {
                const appDataPath = (await Neutralino.os.getPath('data')).replace(/\\/g, '/');
                const settingsDir = `${appDataPath}/com.awandigitals.file-download-manager`;
                const settingsPath = `${settingsDir}/.fdm_settings.json`;
                try { await Neutralino.filesystem.createDirectory(settingsDir); } catch (e) { }
                await Neutralino.filesystem.writeFile(settingsPath, JSON.stringify({ downloadDir: targetDownloadDir }));
                console.log('✅ Folder saved to settings file.');
            } catch (e) {
                console.warn('Gagal simpan folder:', e);
            }
        }
    } catch (e) {
        console.error("changeDownloadDir error:", e);
    }
}

function formatBytes(bytes) {
    if (bytes === 0 || bytes === '0') return '0 Bytes';
    if (!bytes || isNaN(bytes)) return '-';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

let confirmQueue = [];
let isConfirmModalOpen = false;

// isTorrentUrl() moved to /torrent/torrent.js

function processNextConfirm() {
    if (confirmQueue.length === 0) {
        document.getElementById('confirmDownloadModal').style.display = 'none';
        isConfirmModalOpen = false;
        return;
    }
    if (isConfirmModalOpen) return;

    isConfirmModalOpen = true;
    let payload = confirmQueue[0];

    // Handle torrent file (data URL) vs regular URL
    const isTorrentFile = payload.isTorrentFile || false;
    const urlDisplay = isTorrentFile ? `[Torrent File: ${payload.torrentFileName}]` : (payload.url || '');
    document.getElementById('cdUrl').value = urlDisplay;
    
    // Detect and display download type
    const isTorrent = isTorrentFile || isTorrentUrl(payload.url);
    const downloadTypeIndicator = document.getElementById('cdDownloadType');
    if (downloadTypeIndicator) {
        downloadTypeIndicator.textContent = isTorrent ? '🧲 Torrent' : '🌐 HTTP';
        downloadTypeIndicator.style.color = isTorrent ? '#f59e0b' : '#3b82f6';
    }
    
    let title = payload.torrentFileName || payload.filename || (payload.url || '').split('/').pop().split('?')[0] || 'Unknown_File';
    if (title) title = title.replace(/\\/g, '/').split('/').pop();
    if (!title) title = 'file_download';
    document.getElementById('cdFilename').value = title;
    document.getElementById('cdFolder').value = targetDownloadDir;
    document.getElementById('confirmDownloadModal').style.display = 'flex';
}

async function showConfirmModal(payload) {
    try { closeSettingsModal(); } catch (e) { }
    try {
        await Neutralino.window.unminimize();
        await Neutralino.window.show();
        await Neutralino.window.setAlwaysOnTop(true);
        setTimeout(() => Neutralino.window.setAlwaysOnTop(false).catch(() => { }), 500);
    } catch (e) { }

    confirmQueue.push(payload || {});
    processNextConfirm();
}

function closeConfirmModal() {
    document.getElementById('confirmDownloadModal').style.display = 'none';
    isConfirmModalOpen = false;
    confirmQueue.shift();
    if (confirmQueue.length > 0) {
        setTimeout(processNextConfirm, 300);
    }
}

function startConfirmedDownload() {
    if (confirmQueue.length === 0) return;

    let currentPayload = confirmQueue[0];
    
    // Don't overwrite URL for torrent files (it contains base64 data URL)
    // Only update URL from input field for regular HTTP downloads
    if (!currentPayload.isTorrentFile) {
        currentPayload.url = document.getElementById('cdUrl').value;
    }
    
    currentPayload.filename = document.getElementById('cdFilename').value;
    
    // Ambil folder dari input modal (bisa sudah diganti user)
    let selectedFolder = document.getElementById('cdFolder').value;
    if (selectedFolder) currentPayload.downloadPath = selectedFolder;
    
    startGenericDownload(currentPayload);
    closeConfirmModal();
}

// handleTorrentFileImport() moved to /torrent/torrent.js

function showAddModal() {
    let el = document.getElementById('addUrlInput');
    if (el) el.value = '';
    document.getElementById('addDownloadModal').style.display = 'flex';
}

function closeAddModal() {
    document.getElementById('addDownloadModal').style.display = 'none';
}

function submitAddUrl() {
    const urlInput = document.getElementById('addUrlInput');
    const targetUrl = urlInput.value.trim();
    if (!targetUrl) return;

    if (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:')) {
        let msg = "URL dengan format 'blob:' atau 'data:' tidak didukung karena file tersebut berada di dalam memori browser.";
        Neutralino.os.showMessageBox('URL Tidak Didukung', msg, 'OK', 'ERROR');
        return;
    }

    urlInput.value = '';
    closeAddModal();
    showConfirmModal({ url: targetUrl, filename: '' });
}

function startGenericDownload(payloadObj) {
    const url = payloadObj.url;
    let filename = payloadObj.filename || '';
    if (filename) filename = filename.replace(/\\/g, '/').split('/').pop();

    const dlId = 'dl_' + Date.now();
    Neutralino.window.show();

    let title = filename || url.split('/').pop().split('?')[0] || 'Unknown_File';
    if (!title) title = 'file_download';

    // Gunakan folder dari payload (dipilih di modal) atau default
    const downloadDir = payloadObj.downloadPath || targetDownloadDir;
    
    // Detect if torrent
    const isTorrent = payloadObj.isTorrentFile || (typeof url === 'string' && (url.startsWith('magnet:') || url.startsWith('data:')));
    const initMsg = isTorrent ? `Connecting` : `Connecting`;

    downloads[dlId] = {
        id: dlId,
        url: url,
        completed: false,
        cancelled: false,
        isPaused: false,
        outputFolder: downloadDir,
        percent: '0',
        detailStr: 'Speed: -',
        totalSizeStr: '-',
        engineHtml: '',
        engineType: isTorrent ? 'torrent' : 'http',
        error: null,
        errorTime: null,
        seeders: 0,
        leechers: 0,
        totalPeers: undefined
    };

    historyData.unshift({
        id: dlId,
        url: url,
        title: title,
        size: "-",
        status: initMsg,
        engineType: isTorrent ? 'torrent' : 'http',
        folder: downloadDir,
        finalFilePath: null,
        error: null,
        errorTime: null,
        date: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    });
    
    console.log(`[NEW-DOWNLOAD] ID: ${dlId}, Type: ${isTorrent ? 'TORRENT' : 'HTTP'}, Title: ${title}`);

    try { Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }

    currentPage = 1;
    renderPage();

    Neutralino.extensions.dispatch('listener', 'action-download', {
        task: 'start',
        id: dlId,
        url: payloadObj.url,
        downloadPath: downloadDir,
        filename: title,
        cookie: payloadObj.cookie || '',
        userAgent: payloadObj.userAgent || '',
        referrer: payloadObj.referrer || ''
    }).catch(e => {
        updateStatus(dlId, "Error: " + e.message, true);
    });
}

function updateProgressUI(dlId, data) {
    const entry = downloads[dlId];
    if (!entry || entry.cancelled) return;

    entry.percent = data.percent;
    let validSpeed = data.speed && !data.speed.includes('NaN') && !data.speed.includes('undefined') ? data.speed : '-';
    let validDown = data.downloaded && !data.downloaded.includes('NaN') && !data.downloaded.includes('undefined') ? data.downloaded : '-';
    let validTotal = data.total && !data.total.includes('NaN') && !data.total.includes('undefined') ? data.total : '-';

    // Include peer info jika torrent download
    let peerStr = '';
    if (entry.totalPeers !== undefined && entry.totalPeers > 0) {
        peerStr = ` | 👥 ${entry.totalPeers}P`; // P=peers
    }
    entry.detailStr = `${validDown} / ${validTotal} | ${validSpeed}${peerStr}`;
    entry.totalSizeStr = validTotal;
    entry.sizeDisplay = data.sizeDisplay;
    entry.speedDisplay = validSpeed;

    // update status in history quietly (no JSON resave per second)
    let hIndex = historyData.findIndex(h => h.id === dlId);
    if (hIndex >= 0) historyData[hIndex].status = "Downloading";

    let fillEl = document.getElementById(`fill_${dlId}`);
    if (fillEl) fillEl.style.width = data.percent + '%';

    let pctEl = document.getElementById(`percent_${dlId}`);
    if (pctEl) pctEl.innerText = data.percent + "%";

    let speedEl = document.getElementById(`speed_${dlId}`);
    if (speedEl) speedEl.innerText = validSpeed;

    let szEl = document.getElementById(`size_${dlId}`);
    if (szEl) szEl.innerText = entry.sizeDisplay || entry.totalSizeStr;

    let statEl = document.getElementById(`status_${dlId}`);
    if (statEl) {
        statEl.innerText = "Downloading";
        statEl.style.color = '#fbbf24'; // warning
    }
}

function updateStatus(dlId, msg, isError = false, isSuccess = false) {
    let hIndex = historyData.findIndex(h => h.id === dlId);
    if (hIndex >= 0) historyData[hIndex].status = msg;

    const statEl = document.getElementById(`status_${dlId}`);
    if (statEl) {
        statEl.innerText = msg;
        if (isError) statEl.style.color = '#ef4444';
        else if (isSuccess) statEl.style.color = '#10b981';
        else statEl.style.color = '#fbbf24';
    }
}

function pauseDownload(dlId) {
    if (downloads[dlId]) downloads[dlId].isPaused = true;
    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'pause', id: dlId }).catch(() => { });
    updateStatus(dlId, "Paused");

    let hIndex = historyData.findIndex(h => h.id === dlId);
    if (hIndex >= 0) {
        historyData[hIndex].status = 'Paused';
        try { Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
    }

    let bp = document.getElementById(`btnPause_${dlId}`);
    if (bp) bp.style.display = 'none';
    let br = document.getElementById(`btnResume_${dlId}`);
    if (br) br.style.display = 'inline-block';
}

function resumeDownload(dlId) {
    if (downloads[dlId]) downloads[dlId].isPaused = false;
    updateStatus(dlId, "Resuming");
    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'resume', id: dlId }).catch(() => { });

    let hIndex = historyData.findIndex(h => h.id === dlId);
    if (hIndex >= 0) {
        historyData[hIndex].status = 'Resuming';
        try { Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
    }

    let bp = document.getElementById(`btnPause_${dlId}`);
    if (bp) bp.style.display = 'inline-block';
    let br = document.getElementById(`btnResume_${dlId}`);
    if (br) br.style.display = 'none';
}

async function cancelDownload(dlId) {
    let response = await Neutralino.os.showMessageBox('Cancel Download', 'Are you sure you want to cancel this download?', 'YES_NO', 'QUESTION');
    if (response !== 'YES') return;

    if (downloads[dlId]) downloads[dlId].cancelled = true;
    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'cancel', id: dlId }).catch(() => { });

    let hIndex = historyData.findIndex(h => h.id === dlId);
    if (hIndex >= 0) {
        historyData[hIndex].status = "Cancelled";
        try { await Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
    }
    renderPage();
}

async function retryDownload(dlId) {
    let hIndex = historyData.findIndex(h => h.id === dlId);
    if (hIndex < 0) return;

    const item = historyData[hIndex];
    const url = item.url;
    if (!url) return;

    // Remove old entry from history and memory
    if (downloads[dlId]) delete downloads[dlId];
    historyData.splice(hIndex, 1);
    try { await Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }

    // Re-start download with same URL
    startGenericDownload({ url: url, filename: item.title || '', downloadPath: item.folder || targetDownloadDir });
}

function renderPage() {
    const listContainer = document.getElementById('downloadsList');
    if (!listContainer) return;

    // Sort before render
    const sorted = getSortedHistory();

    const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;

    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.innerText = `Page ${currentPage} of ${totalPages} (Total: ${sorted.length} items)`;

    const btnPrev = document.getElementById('btnPrevPage');
    if (btnPrev) btnPrev.disabled = currentPage <= 1;

    const btnNext = document.getElementById('btnNextPage');
    if (btnNext) btnNext.disabled = currentPage >= totalPages;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const slice = sorted.slice(startIndex, startIndex + itemsPerPage);

    listContainer.innerHTML = '';

    // Update sort indicators on headers
    updateSortIndicators();

    slice.forEach(item => {
        const tr = document.createElement('tr');
        tr.id = `row_${item.id}`;

        let isActive = downloads[item.id] && !downloads[item.id].completed && !downloads[item.id].cancelled;
        let isPaused = isActive && downloads[item.id].isPaused;

        let statusColor = 'var(--text-muted)';
        if (item.status === 'Completed') statusColor = 'var(--success)';
        else if (item.status === 'Cancelled' || item.status === 'Failed' || item.status === 'Duplicate' || item.status.startsWith('✖')) statusColor = 'var(--danger)';
        else if (item.status === 'Paused' || item.status === 'Downloading' || item.status === 'Downloading...' || item.status === 'No Peer' || isActive) statusColor = 'var(--warning)';

        // Build tooltip with error details if available
        let statusTooltip = item.status;
        if (item.error) {
            statusTooltip = `${item.status}\nError: ${item.error}\nTime: ${item.errorTime || 'unknown'}`;
        }
        let statusHtml = `<span id="status_${item.id}" class="status-text selectable-text" style="font-size: 0.75rem; color: ${statusColor};" title="${statusTooltip}">${item.status}</span>`;

        let progressHtml = '';
        if (isActive) {
            let pStr = downloads[item.id].percent || '0';
            progressHtml = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div class="progress-bar-container" style="flex: 1; margin: 0; height: 6px;">
                    <div id="fill_${item.id}" class="progress-fill" style="width: ${pStr}%;"></div>
                </div>
                <span id="percent_${item.id}" style="min-width: 35px; text-align: right; font-weight: 600; font-size: 0.8rem; color: var(--primary);">${pStr}%</span>
            </div>`;
        } else {
            let pVal = item.status === 'Completed' ? '100%' : '0%';
            let fillClass = item.status === 'Completed' ? 'progress-fill progress-bar-success' : 'progress-fill';
            let fillColor = item.status === 'Completed' ? 'var(--success)' : 'var(--text-muted)';
            progressHtml = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div class="progress-bar-container" style="flex: 1; margin: 0; height: 6px;">
                    <div id="fill_${item.id}" class="${fillClass}" style="width: ${pVal};"></div>
                </div>
                <span id="percent_${item.id}" style="min-width: 35px; text-align: right; font-weight: 600; font-size: 0.8rem; color: ${fillColor};">${pVal}</span>
            </div>`;
        }

        let sizeHtml = '';
        let speedHtml = '';
        if (isActive) {
            sizeHtml = downloads[item.id].sizeDisplay || downloads[item.id].totalSizeStr || '-';
            speedHtml = downloads[item.id].speedDisplay || '-';
        } else {
            sizeHtml = item.size || '-';
            speedHtml = '-';
        }
        if (sizeHtml.includes('NaN') || sizeHtml.includes('undefined') || sizeHtml === '?') sizeHtml = '-';

        let engineHtml = '';
        if (isActive && downloads[item.id].engineHtml) {
            engineHtml = `<span id="engine_${item.id}" style="min-width: 14px; display: inline-flex;">${downloads[item.id].engineHtml}</span>`;
        } else {
            engineHtml = `<span id="engine_${item.id}" style="min-width: 14px; display: inline-flex;"></span>`;
        }

        let actionHtml = '';
        if (isActive) {
            actionHtml = `
                <div class="dl-actions" id="dl-actions_${item.id}" style="display: flex; justify-content: flex-end; gap: 4px;">
                    <button id="btnPause_${item.id}" class="btn-warning" onclick="pauseDownload('${item.id}')" title="Pause" style="display: ${isPaused ? 'none' : 'inline-block'}; padding: 0.3rem 0.6rem; min-width: unset;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg></button>
                    <button id="btnResume_${item.id}" class="btn-success" onclick="resumeDownload('${item.id}')" title="Resume" style="display: ${isPaused ? 'inline-block' : 'none'}; padding: 0.3rem 0.6rem; min-width: unset;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
                    <button id="btnCancel_${item.id}" class="btn-danger" onclick="cancelDownload('${item.id}')" title="Cancel" style="padding: 0.3rem 0.6rem; min-width: unset;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
            `;
        } else {
            let btnOptions = '';
            if (item.status === 'No Peer') {
                btnOptions += `<button class="btn-warning" onclick="retryDownload('${item.id}')" title="Retry" style="padding: 0.3rem 0.6rem; min-width: unset;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg></button>`;
                btnOptions += `<button class="btn-danger" style="margin-left: 4px; padding: 0.3rem 0.6rem; min-width: unset;" onclick="deleteHistoryItem('${item.id}')" title="Delete record"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>`;
            } else if (item.status === 'Paused' || item.status === 'Downloading' || item.status === 'Downloading...' || item.status === 'Resuming') {
                if (item.status === 'Paused') {
                    btnOptions += `<button id="btnResume_${item.id}" class="btn-success" onclick="resumeDownload('${item.id}')" title="Resume" style="padding: 0.3rem 0.6rem; min-width: unset;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>`;
                } else {
                    btnOptions += `<button id="btnPause_${item.id}" class="btn-warning" onclick="pauseDownload('${item.id}')" title="Pause" style="padding: 0.3rem 0.6rem; min-width: unset;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg></button>`;
                }
                btnOptions += `<button id="btnCancel_${item.id}" class="btn-danger" onclick="cancelDownload('${item.id}')" title="Cancel" style="margin-left: 4px; padding: 0.3rem 0.6rem; min-width: unset;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`;
            } else {
                if (item.status === 'Completed' && item.folder) {
                    btnOptions += `<button class="btn-primary" onclick="safeOpenPath('${escapeHtmlPath(item.folder)}')" title="Open Folder" style="padding: 0.3rem 0.6rem; min-width: unset;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></button>`;
                }
                if (item.status === 'Completed' && item.finalFilePath) {
                    btnOptions += `<button class="btn-success" style="margin-left: 4px; padding: 0.3rem 0.6rem; min-width: unset;" onclick="safeOpenPath('${escapeHtmlPath(item.finalFilePath)}')" title="Open File"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></button>`;
                }
                btnOptions += `<button class="btn-danger" style="margin-left: 4px; padding: 0.3rem 0.6rem; min-width: unset;" onclick="deleteHistoryItem('${item.id}')" title="Delete record"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>`;
            }

            actionHtml = `<div class="dl-actions" style="display: flex; justify-content: flex-end; gap: 0;">${btnOptions}</div>`;
        }

        // Seeders/Peers column
        let seedersHtml = '-';
        const itemEngineType = (isActive && downloads[item.id]) ? downloads[item.id].engineType : (item.engineType || null);
        if (itemEngineType === 'torrent') {
            const peerCount = (isActive && downloads[item.id]) ? (downloads[item.id].totalPeers || 0) : 0;
            seedersHtml = `<span id="seeders_${item.id}" style="color: var(--warning); font-weight: 600;">${peerCount}</span>`;
        } else {
            seedersHtml = `<span id="seeders_${item.id}" style="color: var(--text-muted);">-</span>`;
        }

        tr.innerHTML = `
            <td title="${item.url}">
                <span id="title_${item.id}" class="dl-header selectable-text" style="margin: 0; padding: 0; font-size: 0.9rem;">${item.title}</span>
            </td>
            <td id="size_${item.id}" style="font-size: 0.8rem;">${sizeHtml}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);"><div style="display: flex; gap: 4px; align-items: center;"><span id="speed_${item.id}">${speedHtml}</span>${engineHtml}</div></td>
            <td style="font-size: 0.8rem; text-align: center;">${seedersHtml}</td>
            <td>${statusHtml}</td>
            <td>${progressHtml}</td>
            <td style="font-size: 0.75rem; color: var(--text-muted);">${item.date || '-'}</td>
            <td style="text-align: right;">${actionHtml}</td>
        `;
        listContainer.appendChild(tr);
    });
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPage();
    }
}

function nextPage() {
    const sorted = getSortedHistory();
    const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
    if (currentPage < totalPages) {
        currentPage++;
        renderPage();
    }
}

function toggleSort(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = column === 'date' ? 'desc' : 'asc';
    }
    currentPage = 1;
    renderPage();
}

function getSortedHistory() {
    const data = [...historyData];
    const dir = sortDirection === 'asc' ? 1 : -1;

    data.sort((a, b) => {
        switch (sortColumn) {
            case 'file': {
                const aName = (a.title || '').replace(/^[\ud83d\udce5\ud83e\uddf2]\s*/, '').toLowerCase();
                const bName = (b.title || '').replace(/^[\ud83d\udce5\ud83e\uddf2]\s*/, '').toLowerCase();
                return dir * aName.localeCompare(bName);
            }
            case 'status': {
                const statusOrder = { 'Downloading': 0, 'Paused': 1, 'Completed': 2, 'Cancelled': 3, 'Failed': 4, 'Duplicate': 4, 'No Peer': 5 };
                const aOrder = statusOrder[a.status] ?? 9;
                const bOrder = statusOrder[b.status] ?? 9;
                return dir * (aOrder - bOrder);
            }
            case 'progress': {
                const aActive = downloads[a.id] && !downloads[a.id].completed && !downloads[a.id].cancelled;
                const bActive = downloads[b.id] && !downloads[b.id].completed && !downloads[b.id].cancelled;
                const aPct = aActive ? (parseFloat(downloads[a.id].percent) || 0) : (a.status === 'Completed' ? 100 : 0);
                const bPct = bActive ? (parseFloat(downloads[b.id].percent) || 0) : (b.status === 'Completed' ? 100 : 0);
                return dir * (aPct - bPct);
            }
            case 'date': {
                const aDate = a.date ? new Date(a.date).getTime() : 0;
                const bDate = b.date ? new Date(b.date).getTime() : 0;
                return dir * (aDate - bDate);
            }
            default:
                return 0;
        }
    });
    return data;
}

function updateSortIndicators() {
    const sortableColumns = ['file', 'status', 'progress', 'date'];
    const headerMap = { file: 'col_file', status: 'col_status', progress: 'col_progress', date: 'col_date' };
    const labelMap = { file: 'File', status: 'Status', progress: 'Progress', date: 'Date' };

    sortableColumns.forEach(col => {
        const th = document.getElementById(headerMap[col]);
        if (!th) return;
        const span = th.querySelector('.sort-header');
        if (!span) return;
        const arrow = col === sortColumn ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
        span.textContent = labelMap[col] + arrow;
        if (col === sortColumn) {
            span.classList.add('sort-active');
        } else {
            span.classList.remove('sort-active');
        }
    });
}

async function deleteHistoryItem(id) {
    // Also cancel any active backend process for this download
    if (downloads[id] && !downloads[id].completed && !downloads[id].cancelled) {
        downloads[id].cancelled = true;
        Neutralino.extensions.dispatch('listener', 'action-download', { task: 'cancel', id }).catch(() => { });
    }
    // Even if marked completed, force cancel in case backend torrent is still alive (seeding)
    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'cancel', id }).catch(() => { });

    delete downloads[id];
    historyData = historyData.filter(item => item.id !== id);
    try { await Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
    renderPage();
}

function escapeHtmlPath(path) {
    if (!path) return '';
    return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function safeOpenPath(targetPath) {
    try {
        let stats = await Neutralino.filesystem.getStats(targetPath);
        if (stats) {
            await Neutralino.os.open(targetPath);
        }
    } catch (e) {
        Neutralino.os.showMessageBox('Not Found', 'Berkas / folder tidak ditemukan pada path:\n' + targetPath, 'OK', 'ERROR');
    }
}

async function exitApp() {
    console.log("🛑 Tombol Exit diklik. Mematikan aplikasi secara TOTAL...");
    
    // 1. Matikan listener extension dulu
    try {
        await fetch('http://127.0.0.1:5050/api/shutdown', { 
            method: 'POST',
            mode: 'no-cors',
            signal: AbortSignal.timeout(2000) 
        });
    } catch (e) { }

    // 2. Kill process aplikasi (akan mematikan tray dan background secara paksa)
    console.log("👋 Menghentikan semua proses Neutralino...");
    try {
        await Neutralino.app.killProcess();
    } catch (err) {
        // Fallback jika killProcess gagal (sangat jarang)
        window.close();
    }
}

initApp();
