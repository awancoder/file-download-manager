// Options Module - lazy loads options.html and handles all settings logic
let optionsLoaded = false;

async function optionsInit() {
    if (optionsLoaded) return;
    const container = document.getElementById('settingsModal');
    if (!container) return;
    const inner = container.querySelector('.modal-content');
    if (!inner) return;
    try {
        const resp = await fetch('/options/options.html');
        if (resp.ok) {
            inner.innerHTML = await resp.text();
            optionsLoaded = true;
        }
    } catch (e) {
        console.error('Failed to load options template:', e);
    }
}

async function showSettingsModal() {
    await optionsInit();

    let el = document.getElementById('settingDirText');
    if (el) el.value = targetDownloadDir;

    let startupCheckbox = document.getElementById('settingStartup');
    if (startupCheckbox) startupCheckbox.checked = startupEnabled;
    let statusText = document.getElementById('startupStatusText');
    if (statusText) statusText.innerText = startupEnabled ? 'On' : 'Off';

    let maxConnsInput = document.getElementById('settingTorrentMaxConns');
    if (maxConnsInput) {
        const cores = navigator.hardwareConcurrency || 4;
        const dynamicMax = Math.min(Math.max(cores * 500, 1000), 10000);
        maxConnsInput.max = dynamicMax;
        maxConnsInput.value = torrentMaxConns;

        let maxLabel = document.getElementById('torrentMaxConnsMax');
        if (maxLabel) maxLabel.innerText = dynamicMax;
    }
    let maxConnsValue = document.getElementById('torrentMaxConnsValue');
    if (maxConnsValue) maxConnsValue.innerText = torrentMaxConns;

    document.getElementById('settingsModal').style.display = 'flex';
    refreshLogFileSize();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

async function toggleStartupSetting(enabled) {
    startupEnabled = enabled;
    let statusText = document.getElementById('startupStatusText');
    if (statusText) statusText.innerText = enabled ? 'On' : 'Off';

    try {
        const appDataPath = (await Neutralino.os.getPath('data')).replace(/\\/g, '/');
        const settingsDir = `${appDataPath}/com.awandigitals.file-download-manager`;
        const settingsPath = `${settingsDir}/.fdm_settings.json`;

        let settings = {};
        try {
            let raw = await Neutralino.filesystem.readFile(settingsPath);
            if (raw) settings = JSON.parse(raw);
        } catch (e) { }

        settings.startupEnabled = enabled;
        try { await Neutralino.filesystem.createDirectory(settingsDir); } catch (e) { }
        await Neutralino.filesystem.writeFile(settingsPath, JSON.stringify(settings));

        const appName = 'FileDownloadManager';
        const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

        if (enabled) {
            let realExePath = '';
            try {
                const cliArgs = typeof NL_ARGS !== 'undefined' ? NL_ARGS : [];
                if (cliArgs.length > 0) {
                    realExePath = cliArgs[0].replace(/\//g, '\\');
                }
            } catch (e) { }

            if (!realExePath) {
                realExePath = `${NL_CWD}\\FileDownloadManager.exe`.replace(/\//g, '\\');
            }

            await Neutralino.os.execCommand(`reg add "${regKey}" /v "${appName}" /t REG_SZ /d "\\"${realExePath}\\" --autostart --window-hidden=true" /f`);
            console.log('✅ Startup registry entry added:', realExePath);
        } else {
            await Neutralino.os.execCommand(`reg delete "${regKey}" /v "${appName}" /f`);
            console.log('✅ Startup registry entry removed.');
        }
    } catch (e) {
        console.error('Startup setting error:', e);
    }
}

async function saveTorrentMaxConns(value) {
    torrentMaxConns = parseInt(value) || 500;
    let label = document.getElementById('torrentMaxConnsValue');
    if (label) label.innerText = torrentMaxConns;

    try {
        const appDataPath = (await Neutralino.os.getPath('data')).replace(/\\/g, '/');
        const settingsDir = `${appDataPath}/com.awandigitals.file-download-manager`;
        const settingsPath = `${settingsDir}/.fdm_settings.json`;
        let settings = {};
        try {
            let raw = await Neutralino.filesystem.readFile(settingsPath);
            if (raw) settings = JSON.parse(raw);
        } catch (e) { }
        settings.torrentMaxConns = torrentMaxConns;
        try { await Neutralino.filesystem.createDirectory(settingsDir); } catch (e) { }
        await Neutralino.filesystem.writeFile(settingsPath, JSON.stringify(settings));
    } catch (e) { }

    Neutralino.extensions.dispatch('listener', 'action-download', {
        task: 'config',
        key: 'torrentMaxConns',
        value: torrentMaxConns
    }).catch(() => { });
}

function getLogFilePath() {
    const home = NL_OS === 'Windows' ? window.__env?.USERPROFILE : window.__env?.HOME;
    if (home) return home.replace(/\\/g, '/') + '/fdm-extension.log';
    return null;
}

async function refreshLogFileSize() {
    const el = document.getElementById('logFileSize');
    if (!el) return;
    try {
        const logPath = await getLogFilePathAsync();
        if (!logPath) { el.innerText = ''; return; }
        const stats = await Neutralino.filesystem.getStats(logPath);
        const bytes = stats.size || 0;
        let sizeStr;
        if (bytes < 1024) sizeStr = bytes + ' B';
        else if (bytes < 1024 * 1024) sizeStr = (bytes / 1024).toFixed(1) + ' KB';
        else sizeStr = (bytes / 1024 / 1024).toFixed(2) + ' MB';
        el.innerText = '(' + sizeStr + ')';
    } catch (e) {
        el.innerText = '(not found)';
    }
}

async function getLogFilePathAsync() {
    try {
        let home = await Neutralino.os.getEnv(NL_OS === 'Windows' ? 'USERPROFILE' : 'HOME');
        if (home) return home.replace(/\\/g, '/') + '/fdm-extension.log';
    } catch (e) { }
    return null;
}

async function openLogFile() {
    try {
        const logPath = await getLogFilePathAsync();
        if (!logPath) return;
        await Neutralino.os.open(logPath);
    } catch (e) {
        await Neutralino.os.showMessageBox('Error', 'Log file not found.', 'OK', 'ERROR').catch(() => {});
    }
}

async function deleteLogFile() {
    const logPath = await getLogFilePathAsync();
    if (!logPath) return;
    let response = await Neutralino.os.showMessageBox('Delete Log', 'Delete fdm-extension.log?', 'YES_NO', 'QUESTION');
    if (response !== 'YES') return;
    try {
        await Neutralino.filesystem.remove(logPath);
        await Neutralino.os.showMessageBox('Deleted', 'Log file deleted.', 'OK', 'INFO').catch(() => {});
        refreshLogFileSize();
    } catch (e) {
        await Neutralino.os.showMessageBox('Error', 'Failed to delete: ' + e.message, 'OK', 'ERROR').catch(() => {});
    }
}

async function killAllDownloads() {
    let response = await Neutralino.os.showMessageBox(
        'Kill All Downloads',
        'Are you sure you want to stop ALL active downloads (HTTP & Torrent)?',
        'YES_NO',
        'WARNING'
    );
    if (response !== 'YES') return;

    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'killall' }).catch(() => { });

    let killedCount = 0;
    for (const dlId in downloads) {
        if (!downloads[dlId].completed && !downloads[dlId].cancelled) {
            downloads[dlId].cancelled = true;
            updateStatus(dlId, 'Cancelled');

            let hIndex = historyData.findIndex(h => h.id === dlId);
            if (hIndex >= 0) {
                historyData[hIndex].status = 'Cancelled';
            }
            killedCount++;
        }
    }

    try { await Neutralino.storage.setData('downloadHistory', JSON.stringify(historyData)); } catch (e) { }
    renderPage();
    closeSettingsModal();

    await Neutralino.os.showMessageBox('Kill All', `${killedCount} active download(s) have been stopped.`, 'OK', 'INFO').catch(() => {});
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
        Neutralino.os.open(extPath).catch(() => { });
    }
}

// --- WebTorrent Version Management ---
let wtCheckInProgress = false;
let wtUpdateInProgress = false;

function checkWebTorrentVersion() {
    if (wtCheckInProgress) return;
    wtCheckInProgress = true;
    let btn = document.getElementById('btnWtCheck');
    if (btn) { btn.disabled = true; btn.innerText = 'Checking...'; }
    let statusEl = document.getElementById('wtUpdateStatus');
    if (statusEl) statusEl.innerText = 'Checking npm registry...';
    document.getElementById('btnWtUpdate').disabled = true;

    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'webtorrent-check' }).catch(() => {
        wtCheckInProgress = false;
        if (btn) { btn.disabled = false; btn.innerText = 'Check Update'; }
        if (statusEl) statusEl.innerText = 'Failed to communicate with backend.';
    });
}

function updateWebTorrent() {
    if (wtUpdateInProgress) return;
    wtUpdateInProgress = true;
    let btn = document.getElementById('btnWtUpdate');
    if (btn) { btn.disabled = true; btn.innerText = 'Updating...'; }
    let checkBtn = document.getElementById('btnWtCheck');
    if (checkBtn) checkBtn.disabled = true;

    Neutralino.extensions.dispatch('listener', 'action-download', { task: 'webtorrent-update' }).catch(() => {
        wtUpdateInProgress = false;
        if (btn) { btn.disabled = false; btn.innerText = 'Update'; }
        if (checkBtn) checkBtn.disabled = false;
        let statusEl = document.getElementById('wtUpdateStatus');
        if (statusEl) statusEl.innerText = 'Failed to communicate with backend.';
    });
}

// Event listeners for WebTorrent version responses
Neutralino.events.on('webtorrent-version', (ev) => {
    const { installed, latest, error } = ev.detail;
    wtCheckInProgress = false;

    let btn = document.getElementById('btnWtCheck');
    if (btn) { btn.disabled = false; btn.innerText = 'Check Update'; }

    let installedEl = document.getElementById('wtInstalledVersion');
    let latestEl = document.getElementById('wtLatestVersion');
    let statusEl = document.getElementById('wtUpdateStatus');
    let updateBtn = document.getElementById('btnWtUpdate');

    if (installedEl) installedEl.innerText = installed !== 'unknown' ? 'v' + installed : '—';
    if (latestEl) latestEl.innerText = latest !== 'unknown' ? 'v' + latest : '—';

    if (error) {
        if (statusEl) statusEl.innerText = 'Error checking version: ' + error;
        return;
    }

    if (installed !== 'unknown' && latest !== 'unknown' && installed !== latest) {
        if (updateBtn) updateBtn.disabled = false;
        if (latestEl) latestEl.style.color = '#22c55e';
        if (statusEl) {
            statusEl.innerText = `New version available! v${installed} → v${latest}`;
            statusEl.style.color = '#22c55e';
        }
    } else if (installed === latest) {
        if (updateBtn) updateBtn.disabled = true;
        if (statusEl) statusEl.innerText = `You are on the latest version (v${installed}).`;
    } else {
        if (statusEl) statusEl.innerText = 'Could not determine version info.';
    }
});

Neutralino.events.on('webtorrent-update-status', (ev) => {
    const { status, message, version } = ev.detail;
    let statusEl = document.getElementById('wtUpdateStatus');
    let updateBtn = document.getElementById('btnWtUpdate');
    let checkBtn = document.getElementById('btnWtCheck');
    let installedEl = document.getElementById('wtInstalledVersion');

    if (status === 'updating') {
        if (statusEl) { statusEl.innerText = message; statusEl.style.color = 'var(--accent-secondary)'; }
    } else if (status === 'success') {
        wtUpdateInProgress = false;
        if (statusEl) { statusEl.innerText = message; statusEl.style.color = '#22c55e'; }
        if (updateBtn) { updateBtn.disabled = true; updateBtn.innerText = 'Update'; }
        if (checkBtn) checkBtn.disabled = false;
        if (installedEl && version) installedEl.innerText = 'v' + version;
        let latestEl = document.getElementById('wtLatestVersion');
        if (latestEl) latestEl.style.color = 'var(--text-main)';
    } else if (status === 'error') {
        wtUpdateInProgress = false;
        if (statusEl) { statusEl.innerText = message; statusEl.style.color = '#ef4444'; }
        if (updateBtn) { updateBtn.disabled = false; updateBtn.innerText = 'Update'; }
        if (checkBtn) checkBtn.disabled = false;
    }
});
