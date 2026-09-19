const API_HOST = 'http://127.0.0.1:5050';

let payload = null;
let confirmId = '';
let payloadFilePath = '';
let decisionSent = false;

function getArgValue(flag) {
    const args = typeof NL_ARGS !== 'undefined' ? NL_ARGS : [];
    const prefix = `--${flag}=`;
    const found = args.find(a => a.startsWith(prefix));
    return found ? found.substring(prefix.length) : '';
}

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function sendDecision(decision) {
    if (decisionSent) return;
    decisionSent = true;

    const body = { decision, id: confirmId };

    if (decision === 'start' && payload) {
        body.url = payload.isTorrentFile ? payload.url : document.getElementById('fUrl').value;
        body.filename = document.getElementById('fFilename').value;
        body.downloadPath = document.getElementById('fFolder').value;
        body.cookie = payload.cookie || '';
        body.userAgent = payload.userAgent || '';
        body.referrer = payload.referrer || '';
        body.isTorrentFile = payload.isTorrentFile || false;
        body.torrentFileName = payload.torrentFileName || '';
        body.fileSize = payload.fileSize || 0;
    }

    try {
        await fetch(`${API_HOST}/api/confirm-download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (e) {
        console.error('Gagal mengirim keputusan ke backend:', e);
    }

    try {
        if (payloadFilePath) await Neutralino.filesystem.removeFile(payloadFilePath);
    } catch (e) { }

    Neutralino.app.exit();
}

async function init() {
    Neutralino.init();

    Neutralino.events.on('windowClose', () => {
        sendDecision('cancel');
    });

    confirmId = getArgValue('confirm-id');
    payloadFilePath = (getArgValue('confirm-payload') || '').replace(/\\/g, '/');

    try {
        const raw = await Neutralino.filesystem.readFile(payloadFilePath);
        payload = JSON.parse(raw);
    } catch (e) {
        console.error('Gagal membaca payload:', e);
        payload = {};
    }

    const isTorrent = payload.isTorrentFile ||
        (typeof payload.url === 'string' && (payload.url.startsWith('magnet:') || payload.url.includes('.torrent')));
    const isHls = typeof payload.url === 'string' && (payload.url.includes('.m3u8') ||
        (payload.filename && payload.filename.toLowerCase().endsWith('.m3u8')));

    document.getElementById('typeBadge').textContent = isTorrent ? '🧲 Torrent' : (isHls ? '📺 HLS' : '🌐 HTTP');

    const urlDisplay = payload.isTorrentFile ? `[Torrent File: ${payload.torrentFileName || ''}]` : (payload.url || '');
    document.getElementById('fUrl').value = urlDisplay;

    let title = payload.torrentFileName || payload.filename || (payload.url || '').split('/').pop().split('?')[0] || 'Unknown_File';
    title = title.replace(/\\/g, '/').split('/').pop() || 'file_download';
    document.getElementById('fFilename').value = title;

    document.getElementById('fFolder').value = payload.downloadPath || '';

    const sizeStr = formatBytes(payload.fileSize);
    document.getElementById('fSizeInfo').textContent = sizeStr ? `Size: ${sizeStr}` : '';

    document.getElementById('btnChangeFolder').addEventListener('click', async () => {
        try {
            const selected = await Neutralino.os.showFolderDialog('Select Download Folder', {
                defaultPath: document.getElementById('fFolder').value
            });
            if (selected) document.getElementById('fFolder').value = selected;
        } catch (e) { }
    });

    document.getElementById('btnStart').addEventListener('click', () => sendDecision('start'));
    document.getElementById('btnCancel').addEventListener('click', () => sendDecision('cancel'));
}

init();
