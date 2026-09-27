const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { exec, spawn } = require('child_process');
const dnsConfig = require('./modules/dns-config');

let activeApiPort = 5050;

let logPath = '';
try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || '.';
    logPath = path.join(homeDir, 'fdm-extension.log');
} catch(e) {}

function log(msg) {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    const line = `[${timestamp}] ${msg}\n`;
    console.log(msg);
    if (logPath) {
        fs.appendFile(logPath, line, (err) => {});
    }
}

process.on('uncaughtException', (err) => {
    if (err.code === 'ENOBUFS') {
        log(`[WARNING] System buffer limit reached (ENOBUFS). Silently dropping uTP/UDP packet.`);
    } else {
        log(`[CRITICAL] Uncaught EXCEPTION: ${err.message}\n${err.stack}`);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    log(`[CRITICAL] Unhandled REJECTION: ${reason}`);
});

log("=== Ekstensi Memulai (Startup) ===");
log(`CWD: ${process.cwd()}`);
log(`Args: ${process.argv.join(' ')}`);

let express, cors, WebSocket, MultiThreadEngine, HttpDownloader, TorrentDownloader, HlsDownloader;

try {
    log("Memuat module dependencies...");
    express = require('express');
    cors = require('cors');
    WebSocket = require('ws').WebSocket;
    MultiThreadEngine = require('./MultiThreadEngine');
    HttpDownloader = require('./modules/http-downloader');
    TorrentDownloader = require('./modules/torrent-downloader');
    HlsDownloader = require('./modules/hls-downloader');
    log("Semua module berhasil dimuat.");
} catch(err) {
    log(`GAGAL memuat module: ${err.message}`);
    process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

let nlPort = '';
let nlToken = '';
let nlConnectToken = '';
let nlExtensionId = 'listener';

// Buffer untuk data STDIN dari Neutralino
let stdinData = '';
let stdinResolved = false;

// Neutralino v5+ mengirim info koneksi lewat STDIN sebagai JSON
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    stdinData += chunk;
    log(`STDIN data diterima: ${chunk.trim()}`);
    
    // Coba parse sebagai JSON
    try {
        const parsed = JSON.parse(stdinData.trim());
        if (parsed.nlPort || parsed.port) {
            nlPort = String(parsed.nlPort || parsed.port);
            nlToken = parsed.nlToken || parsed.accessToken || '';
            nlConnectToken = parsed.nlConnectToken || parsed.connectToken || nlToken;
            nlExtensionId = parsed.nlExtensionId || parsed.extensionId || nlExtensionId;
            stdinResolved = true;
            log(`SUCCESS: Auth dari STDIN! (Port: ${nlPort})`);
        }
    } catch(e) {
        // Belum lengkap, tunggu data selanjutnya
    }
});

async function getAuthEvents() {
    log("=== Mencari Konfigurasi Autentikasi ===");
    
    // FASE 1: Tunggu STDIN dari Neutralino (2 detik)
    // STDIN memberikan connectToken ASLI, bridge file tidak!
    log("Fase 1: Menunggu STDIN dari Neutralino (max 2 detik)...");
    for (let i = 0; i < 4; i++) {
        if (stdinResolved && nlPort && nlToken) {
            log(`✅ AUTH OK via STDIN (Port: ${nlPort}, ConnectToken: ${nlConnectToken.substring(0,5)}...)`);
            return true;
        }
        
        // Cek juga environment variables (langsung tersedia)
        if (process.env.NL_PORT && process.env.NL_TOKEN) {
            nlPort = process.env.NL_PORT;
            nlToken = process.env.NL_TOKEN;
            nlConnectToken = process.env.NL_CONNECT_TOKEN || nlToken;
            nlExtensionId = process.env.NL_EXTENSION_ID || nlExtensionId;
            log(`✅ AUTH OK via ENV VARS (Port: ${nlPort})`);
            return true;
        }

        // Cek CLI args (langsung tersedia)
        process.argv.forEach((val) => {
            if (val.startsWith('--nl-port=')) nlPort = val.split('=')[1];
            if (val.startsWith('--nl-token=')) nlToken = val.split('=')[1];
            if (val.startsWith('--nl-extension-id=')) nlExtensionId = val.split('=')[1];
            if (val.startsWith('--nl-connect-token=')) nlConnectToken = val.split('=')[1];
        });
        if (nlPort && nlToken) {
            nlConnectToken = nlConnectToken || nlToken;
            log(`✅ AUTH OK via CLI Args (Port: ${nlPort})`);
            return true;
        }

        await new Promise(r => setTimeout(r, 500));
    }

    // FASE 2: STDIN tidak datang, fallback ke bridge files (max 28 detik lagi)
    log("Fase 2: STDIN tidak datang, mencoba bridge files...");
    for (let i = 0; i < 56; i++) {
        // Tetap cek STDIN (mungkin terlambat)
        if (stdinResolved && nlPort && nlToken) {
            log(`✅ AUTH OK via STDIN (terlambat) (Port: ${nlPort})`);
            return true;
        }

        // Bridge file di AppData
        const appDataPath = process.env.APPDATA;
        if (appDataPath) {
            const p = path.join(appDataPath, 'com.awandigitals.file-download-manager', '.fdm_auth.json');
            if (tryReadBridge(p, i === 0)) return true;
        }

        // Bridge file di OS Temp
        const osTempPath = process.env.TEMP || process.env.TMP;
        if (osTempPath) {
            const p = path.join(osTempPath, '.fdm_auth.json');
            if (tryReadBridge(p, i === 0)) return true;
        }

        // .tmp/auth_info.json (Neutralino internal)
        for (let j = 0, dir = __dirname; j < 4; j++, dir = path.dirname(dir)) {
            const p = path.join(dir, '.tmp', 'auth_info.json');
            if (fs.existsSync(p)) {
                try {
                    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
                    nlPort = String(d.port || d.nlPort);
                    nlToken = d.accessToken || d.nlToken;
                    nlConnectToken = d.connectToken || nlToken;
                    log(`✅ AUTH OK dari .tmp/auth_info.json! (Port: ${nlPort})`);
                    return true;
                } catch(e) {}
            }
        }

        if (i % 10 === 0) log(`Masih menunggu... (${2 + i * 0.5} detik)`);
        await new Promise(r => setTimeout(r, 500));
    }
    
    log("KRITIKAL: Gagal mendapatkan konfigurasi autentikasi setelah 30 detik!");
    return false;
}

// Helper: Baca bridge file, tolak jika lebih tua dari 60 detik
function tryReadBridge(filePath, verbose) {
    if (!fs.existsSync(filePath)) {
        if (verbose) log(`Bridge tidak ada: ${filePath}`);
        return false;
    }
    try {
        const authData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Tolak file basi (lebih dari 60 detik)
        if (authData.timestamp) {
            const ageSec = Math.round((Date.now() - authData.timestamp) / 1000);
            if (ageSec > 60) {
                if (verbose) log(`REJECTED: Bridge basi (${ageSec}s): ${filePath}`);
                return false;
            }
        }
        
        if (!authData.nlPort || !authData.nlToken) return false;
        
        nlPort = String(authData.nlPort);
        nlToken = authData.nlToken;
        nlConnectToken = authData.nlConnectToken || nlToken;
        log(`SUCCESS: Auth dari bridge file! (Port: ${nlPort}) - ${filePath}`);
        return true;
    } catch(e) {
        return false;
    }
}


// Global state
let ws = null;
let isConnected = false;
let httpDownloader = null;
let torrentDownloader = null;
let hlsDownloader = null;
let downloadTypes = {}; // Track download type per ID: { id: 'http' | 'torrent' | 'hls' }

// === Confirm Dialog (separate window) state ===
let openDialogCount = 0;
const DIALOG_BASE_X = 200;
const DIALOG_BASE_Y = 150;
const DIALOG_OFFSET_STEP = 32;
const DIALOG_OFFSET_WRAP = 8;

function getAppRoot() {
    return path.join(__dirname, '..', '..');
}

// Cari executable Neutralino yang tepat untuk spawn window kedua:
// dev (`neu run`) pakai binary mentah di bin/, production pakai exe hasil neu build.
function getMainBinaryPath() {
    const appRoot = getAppRoot();
    const prodExe = path.join(appRoot, 'FileDownloadManager.exe');
    if (fs.existsSync(prodExe)) return prodExe;

    const devBinary = path.join(appRoot, 'bin', 'neutralino-win_x64.exe');
    if (fs.existsSync(devBinary)) return devBinary;

    return null;
}

function isS3ExpiringLink(url) {
    return typeof url === 'string' && (url.includes('X-Amz-Expires=') || url.includes('Expires='));
}

// Baca folder download default dari settings yang sama dipakai window utama
// (resources/js/main.js), supaya dialog konfirmasi & auto-bypass konsisten
// dengan preferensi user tanpa perlu tanya ke Neutralino API.
function getDefaultDownloadDir() {
    try {
        const appDataPath = process.env.APPDATA;
        if (appDataPath) {
            const settingsPath = path.join(appDataPath, 'com.awandigitals.file-download-manager', '.fdm_settings.json');
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (settings.downloadDir) return settings.downloadDir;
            }
        }
    } catch (e) { }

    try {
        return path.join(os.homedir(), 'Downloads');
    } catch (e) {
        return '.';
    }
}

// Buka window dialog konfirmasi terpisah (proses Neutralino baru, mode confirmDialog).
// Payload ditulis ke file temp karena bisa besar (cookie, headers) dan tidak aman/muat lewat CLI arg.
function spawnConfirmDialog(id, payload) {
    if (isS3ExpiringLink(payload.url)) {
        log(`[${id}] Deteksi S3 expiring link, auto-start tanpa dialog konfirmasi.`);
        confirmAndStartDownload(id, payload);
        return;
    }

    const binaryPath = getMainBinaryPath();
    if (!binaryPath) {
        log(`❌ Tidak bisa menemukan binary Neutralino untuk dialog konfirmasi. Fallback: auto-start.`);
        confirmAndStartDownload(id, payload);
        return;
    }

    const tempPath = path.join(os.tmpdir(), `fdm-confirm-${id}.json`).replace(/\\/g, '/');
    try {
        fs.writeFileSync(tempPath, JSON.stringify(payload));
    } catch (err) {
        log(`❌ Gagal menulis payload dialog konfirmasi: ${err.message}`);
        confirmAndStartDownload(id, payload);
        return;
    }

    const slot = openDialogCount % DIALOG_OFFSET_WRAP;
    const offsetX = DIALOG_BASE_X + slot * DIALOG_OFFSET_STEP;
    const offsetY = DIALOG_BASE_Y + slot * DIALOG_OFFSET_STEP;
    openDialogCount++;

    const isNeuBundle = fs.existsSync(path.join(getAppRoot(), 'resources.neu'));

    const args = [
        `--path=${getAppRoot()}`,
        '--mode=window',
        '--url=/dialog/confirm.html',
        '--window-title=New Download',
        '--window-width=500',
        '--window-height=410',
        '--window-min-width=500',
        '--window-min-height=410',
        '--window-resizable=false',
        '--window-maximize=false',
        '--window-always-on-top=true',
        '--window-enable-inspector=false',
        '--window-exit-process-on-close=false',
        '--enable-extensions=false',
        '--export-auth-info=false',
        `--window-x=${offsetX}`,
        `--window-y=${offsetY}`,
        `--confirm-payload=${tempPath}`,
        `--confirm-id=${id}`,
        `--api-port=${activeApiPort}`
    ];

    // Hanya gunakan --load-dir-res di mode development (ketika resources.neu belum di-bundle)
    if (!isNeuBundle) {
        args.unshift('--load-dir-res');
    }

    log(`🪟 Membuka dialog konfirmasi untuk ${id} (posisi ${offsetX},${offsetY})...`);

    // Isolasi user data folder WebView2 agar tidak konflik dengan jendela utama di Windows
    const dialogUdf = path.join(os.tmpdir(), 'fdm-webview2-dialog');
    const childEnv = Object.assign({}, process.env, {
        WEBVIEW2_USER_DATA_FOLDER: dialogUdf
    });

    try {
        const child = spawn(binaryPath, args, {
            cwd: getAppRoot(),
            detached: true,
            stdio: 'ignore',
            env: childEnv
        });
        child.on('error', (err) => {
            log(`❌ Gagal spawn dialog konfirmasi: ${err.message}`);
        });
        child.unref();
    } catch (err) {
        log(`❌ Exception saat spawn dialog konfirmasi: ${err.message}`);
        confirmAndStartDownload(id, payload);
    }
}

// Logger object for modules
const moduleLogger = {
    log: (msg) => log(msg)
};

// Initialize downloader modules
function initializeDownloaders() {
    try {
        httpDownloader = new HttpDownloader(moduleLogger);
        torrentDownloader = new TorrentDownloader(moduleLogger);
        hlsDownloader = new HlsDownloader(moduleLogger);
        
        log("✅ All downloader modules initialized (HTTP, Torrent, HLS)");

        // Listen to HLS downloader events
        hlsDownloader.on('started', (data) => {
            log(`[HLS] Download started: ${data.id}`);
            broadcastEvent('dl-started', { id: data.id, engine: 'hls', fileName: data.fileName });
        });

        hlsDownloader.on('progress', (data) => {
            broadcastEvent('dl-progress', {
                id: data.id,
                progress: data.progress,
                speed: data.speed,
                downloaded: data.downloaded,
                total: data.total
            });
        });

        hlsDownloader.on('complete', (data) => {
            log(`[HLS] Download completed: ${data.id}`);
            broadcastEvent('dl-end', { id: data.id, info: { filePath: data.filePath } });
            delete downloadTypes[data.id];
        });

        hlsDownloader.on('error', (data) => {
            log(`[HLS] Download error: ${data.id} - ${data.error}`);
            broadcastEvent('dl-error', { id: data.id, error: data.error });
            delete downloadTypes[data.id];
        });

        // Listen to HTTP downloader events
        httpDownloader.on('started', (data) => {
            log(`[HTTP] Download started: ${data.id}`);
            broadcastEvent('dl-started', { id: data.id, engine: data.engine, fileName: data.fileName });
        });

        httpDownloader.on('progress', (data) => {
            broadcastEvent('dl-progress', {
                id: data.id,
                progress: data.progress,
                speed: data.speed,
                downloaded: data.downloaded,
                total: data.total
            });
        });

        httpDownloader.on('complete', (data) => {
            log(`[HTTP] Download completed: ${data.id}`);
            broadcastEvent('dl-end', { id: data.id, info: { filePath: data.filePath } });
            delete downloadTypes[data.id];
        });

        httpDownloader.on('error', (data) => {
            log(`[HTTP] Download error: ${data.id} - ${data.error}`);
            broadcastEvent('dl-error', { id: data.id, error: data.error });
            delete downloadTypes[data.id];
        });

        // Listen to Torrent downloader events
        torrentDownloader.on('started', (data) => {
            log(`[TORRENT] Download started: ${data.id} | Seeders: ${data.seeders || 0}, Leechers: ${data.leechers || 0}`);
            broadcastEvent('dl-started', { 
                id: data.id, 
                engine: 'torrent', 
                fileName: data.torrentName,
                seeders: data.seeders,
                leechers: data.leechers,
                totalPeers: data.totalPeers
            });
        });

        torrentDownloader.on('progress', (data) => {
            broadcastEvent('dl-progress', {
                id: data.id,
                progress: data.progress,
                speed: data.speed,
                downloaded: data.downloaded,
                total: data.total,
                peers: data.peers,
                eta: data.eta
            });
        });

        torrentDownloader.on('paused', (data) => {
            log(`[TORRENT] Download paused: ${data.id}`);
            broadcastEvent('dl-paused', { id: data.id });
        });

        torrentDownloader.on('resumed', (data) => {
            log(`[TORRENT] Download resumed: ${data.id}`);
            broadcastEvent('dl-resumed', { id: data.id });
        });

        torrentDownloader.on('complete', (data) => {
            log(`[TORRENT] Download completed: ${data.id}`);
            broadcastEvent('dl-end', { id: data.id, info: { filePath: data.filePath } });
            delete downloadTypes[data.id];
        });

        torrentDownloader.on('error', (data) => {
            log(`[TORRENT] Download error: ${data.id} - ${data.error}`);
            broadcastEvent('dl-error', { id: data.id, error: data.error });
            delete downloadTypes[data.id];
        });

        torrentDownloader.on('warning', (data) => {
            log(`[TORRENT] Warning: ${data.id} - ${data.warning}`);
            broadcastEvent('dl-warning', { id: data.id, warning: data.warning });
        });

    } catch(err) {
        log(`❌ Failed to initialize downloaders: ${err.message}`);
    }
}

function broadcastEvent(event, data) {
    if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
        if (event !== 'app-stats' && event !== 'dl-progress') log(`Broadcasting event: ${event}`);
        // Format HARUS sesuai neutralino.js client: { id, method, data: {event, data}, accessToken }
        ws.send(JSON.stringify({
            id: 'evt_' + Date.now(),
            method: 'app.broadcast',
            accessToken: nlToken,
            data: {
                event: event,
                data: data
            }
        }));
    } else {
        log(`WARNING: Gagal broadcast ${event}. isConnected: ${isConnected}, ReadyState: ${ws ? ws.readyState : 'none'}`);
    }
}

// Titik tunggal untuk benar-benar memulai download setelah keputusan dibuat
// (baik dari dialog konfirmasi, maupun auto-bypass S3). Dipanggil dari backend
// langsung sehingga tidak bergantung pada window utama aktif/visible.
function confirmAndStartDownload(id, payload) {
    const isTorrent = payload.isTorrentFile || TorrentDownloader.isTorrentUrl(payload.url);
    const isHls = typeof payload.url === 'string' && (payload.url.includes('.m3u8') ||
        (payload.filename && payload.filename.toLowerCase().endsWith('.m3u8')));
    const engineType = isTorrent ? 'torrent' : (isHls ? 'hls' : 'http');

    broadcastEvent('new-download-confirmed', {
        id,
        url: payload.url,
        filename: payload.filename,
        downloadPath: payload.downloadPath,
        fileSize: payload.fileSize || 0,
        engineType
    });

    handleDownloadAction({
        task: 'start',
        id,
        url: payload.url,
        downloadPath: payload.downloadPath,
        filename: payload.filename,
        cookie: payload.cookie || '',
        userAgent: payload.userAgent || '',
        referrer: payload.referrer || '',
        isTorrentFile: payload.isTorrentFile || false,
        torrentFileName: payload.torrentFileName || ''
    });
}

function handleDownloadAction(payload) {
    log(`[handleDownloadAction] Called with payload keys: ${Object.keys(payload || {}).join(', ')}`);
    
    const { task, id, url, downloadPath, filename } = payload;
    log(`========================================`);
    log(`[ACTION] Task: '${task}' | ID: ${id}`);
    log(`[ACTION] URL length: ${url ? url.length : 0} chars`);
    log(`[ACTION] Download Path: ${downloadPath}`);
    
    if (task === 'start') {
        // Detect download type
        log(`[${id}] Checking if torrent URL...`);
        const isTorrent = payload.isTorrentFile || TorrentDownloader.isTorrentUrl(url);
        const isHls = typeof url === 'string' && (url.includes('.m3u8') || (filename && filename.toLowerCase().endsWith('.m3u8')));
        
        log(`[${id}] Download Type: ${isTorrent ? 'TORRENT' : (isHls ? 'HLS' : 'HTTP')}`);

        if (isTorrent) {
            // Route to Torrent Downloader
            log(`[${id}] Routing to Torrent Downloader...`);
            if (!torrentDownloader) {
                log(`[${id}] ❌ Torrent downloader not initialized`);
                broadcastEvent('dl-error', { id, error: 'Torrent downloader not available' });
                return;
            }
            downloadTypes[id] = 'torrent';
            log(`[${id}] Calling torrentDownloader.start()...`);
            torrentDownloader.start(id, url, downloadPath, filename, payload);
            log(`[${id}] torrentDownloader.start() called successfully`);
        } else if (isHls) {
            // Route to HLS Downloader
            log(`[${id}] Routing to HLS Downloader...`);
            if (!hlsDownloader) {
                log(`[${id}] ❌ HLS downloader not initialized`);
                broadcastEvent('dl-error', { id, error: 'HLS downloader not available' });
                return;
            }
            downloadTypes[id] = 'hls';
            log(`[${id}] Calling hlsDownloader.start()...`);
            hlsDownloader.start(id, url, downloadPath, filename, payload);
        } else {
            // Route to HTTP Downloader
            if (!httpDownloader) {
                log(`[${id}] ❌ HTTP downloader not initialized`);
                broadcastEvent('dl-error', { id, error: 'HTTP downloader not available' });
                return;
            }
            downloadTypes[id] = 'http';
            log(`[${id}] [START] URL: ${url}`);
            log(`[${id}] [START] Folder: ${downloadPath}`);
            log(`[${id}] [START] Filename: ${filename || 'auto'}`);
            log(`[${id}] [START] Cookie: ${payload.cookie ? 'ADA (' + payload.cookie.length + ' chars)' : 'TIDAK ADA'}`);
            log(`[${id}] [START] UserAgent: ${payload.userAgent ? 'ADA' : 'TIDAK ADA'}`);
            log(`[${id}] [START] Referrer: ${payload.referrer || 'TIDAK ADA'}`);
            httpDownloader.start(id, url, downloadPath, filename, payload);
        }

    } else if (task === 'pause') {
        const dlType = downloadTypes[id];
        if (dlType === 'http' && httpDownloader && httpDownloader.exists(id)) {
            httpDownloader.pause(id);
        } else if (dlType === 'torrent' && torrentDownloader && torrentDownloader.exists(id)) {
            torrentDownloader.pause(id);
        } else {
            log(`[${id}] ⚠️ Download not found for pause`);
            broadcastEvent('dl-error', { id, error: 'Download not found for pause' });
        }

    } else if (task === 'resume') {
        const dlType = downloadTypes[id];
        if (dlType === 'http' && httpDownloader && httpDownloader.exists(id)) {
            httpDownloader.resume(id);
        } else if (dlType === 'torrent' && torrentDownloader && torrentDownloader.exists(id)) {
            torrentDownloader.resume(id);
        } else {
            log(`[${id}] ⚠️ Download not found for resume`);
            broadcastEvent('dl-error', { id, error: 'Download not found for resume' });
        }

    } else if (task === 'cancel') {
        const dlType = downloadTypes[id];
        let found = false;

        if (dlType === 'http' && httpDownloader && httpDownloader.exists(id)) {
            httpDownloader.cancel(id);
            found = true;
        } else if (dlType === 'torrent' && torrentDownloader && torrentDownloader.exists(id)) {
            torrentDownloader.cancel(id);
            found = true;
        } else if (dlType === 'hls' && hlsDownloader && hlsDownloader.exists(id)) {
            hlsDownloader.cancel(id);
            found = true;
        }

        // If not found by tracking, try all modules (handles orphaned/completed-but-still-alive downloads)
        if (!found) {
            if (httpDownloader && httpDownloader.exists(id)) {
                httpDownloader.cancel(id);
                found = true;
            }
            if (torrentDownloader && torrentDownloader.exists(id)) {
                torrentDownloader.cancel(id);
                found = true;
            }
            if (hlsDownloader && hlsDownloader.exists(id)) {
                hlsDownloader.cancel(id);
                found = true;
            }
        }

        if (!found) {
            log(`[${id}] ⚠️ Download not found for cancel (may already be destroyed)`);
        }

        delete downloadTypes[id];

    } else if (task === 'config') {
        const { key, value } = payload;
        log(`⚙️ Config update: ${key} = ${JSON.stringify(value)}`);
        if (key === 'torrentMaxConns' && torrentDownloader && torrentDownloader.setMaxConns) {
            torrentDownloader.setMaxConns(value);
        }
        if (key === 'dnsServers') {
            dnsConfig.setDnsServers(value);
            const active = dnsConfig.activeLookup;
            if (active) {
                log(`🌐 Custom DNS active: ${value.primary} / ${value.secondary || value.primary}`);
            } else {
                log(`🌐 DNS restored to System Default`);
            }
        }

    } else if (task === 'killall') {
        log(`🛑 KILL ALL DOWNLOADS received`);
        let killedCount = 0;

        // Kill ALL HTTP downloads (including untracked)
        if (httpDownloader && httpDownloader.killAll) {
            killedCount += httpDownloader.killAll();
        }

        // Kill ALL Torrent downloads (including orphaned from previous sessions)
        if (torrentDownloader && torrentDownloader.killAll) {
            killedCount += torrentDownloader.killAll();
        }

        // Clear download type tracking
        const trackKeys = Object.keys(downloadTypes);
        for (const k of trackKeys) {
            delete downloadTypes[k];
        }

        log(`🛑 KILL ALL COMPLETE: ${killedCount} downloads destroyed`);

    } else if (task === 'shutdown') {
        log(`🔌 SHUTDOWN signal received`);
        if (torrentDownloader) {
            torrentDownloader.shutdown();
        }
        setTimeout(() => process.exit(0), 500);

    } else if (task === 'webtorrent-check') {
        (async () => {
            log(`🔍 WebTorrent version check requested`);
            try {
                // Get installed version from package.json
                const pkgPath = path.join(__dirname, 'node_modules', 'webtorrent', 'package.json');
                let installedVersion = 'unknown';
                try {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    installedVersion = pkg.version;
                } catch (e) {
                    log(`Could not read installed webtorrent version: ${e.message}`);
                }

                // Fetch latest version from npm registry
                let latestVersion = 'unknown';
                try {
                    const https = require('https');
                    latestVersion = await new Promise((resolve, reject) => {
                        https.get('https://registry.npmjs.org/webtorrent/latest', {
                            headers: { 'Accept': 'application/json' },
                            timeout: 10000
                        }, (res) => {
                            let data = '';
                            res.on('data', chunk => data += chunk);
                            res.on('end', () => {
                                try {
                                    const json = JSON.parse(data);
                                    resolve(json.version || 'unknown');
                                } catch (e) { reject(e); }
                            });
                        }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
                    });
                } catch (e) {
                    log(`Could not fetch latest webtorrent version: ${e.message}`);
                }

                broadcastEvent('webtorrent-version', { installed: installedVersion, latest: latestVersion });
                log(`📦 WebTorrent installed: ${installedVersion}, latest: ${latestVersion}`);
            } catch (e) {
                log(`❌ webtorrent-check error: ${e.message}`);
                broadcastEvent('webtorrent-version', { installed: 'error', latest: 'error', error: e.message });
            }
        })();

    } else if (task === 'webtorrent-update') {
        (async () => {
            log(`📦 WebTorrent update requested`);
            broadcastEvent('webtorrent-update-status', { status: 'updating', message: 'Installing latest WebTorrent...' });
            try {
                const listenerDir = __dirname;
                await new Promise((resolve, reject) => {
                    exec('npm install webtorrent@latest', { cwd: listenerDir, timeout: 120000 }, (error, stdout, stderr) => {
                        if (error) {
                            log(`npm install error: ${error.message}`);
                            log(`stderr: ${stderr}`);
                            reject(error);
                        } else {
                            log(`npm install stdout: ${stdout}`);
                            resolve();
                        }
                    });
                });

                // Read new version
                const pkgPath = path.join(__dirname, 'node_modules', 'webtorrent', 'package.json');
                let newVersion = 'unknown';
                try {
                    // Clear require cache so we read fresh
                    delete require.cache[require.resolve(pkgPath)];
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    newVersion = pkg.version;
                } catch (e) {}

                broadcastEvent('webtorrent-update-status', { status: 'success', message: `Updated to v${newVersion}. Restart app to apply.`, version: newVersion });
                log(`✅ WebTorrent updated to ${newVersion}`);
            } catch (e) {
                broadcastEvent('webtorrent-update-status', { status: 'error', message: 'Update failed: ' + e.message });
                log(`❌ WebTorrent update failed: ${e.message}`);
            }
        })();

    } else {
        log(`[${id}] ⚠️ Task '${task}' tidak dikenali`);
    }

    log(`========================================`);
}


function connectToNeutralino() {
    if(!nlPort || !nlToken || !nlExtensionId) return;
    // Gunakan 127.0.0.1 (IPv4) bukan localhost agar tidak resolve ke IPv6 di Windows
    const connectToken = nlConnectToken || nlToken;
    const wsUrl = `ws://127.0.0.1:${nlPort}?extensionId=${nlExtensionId}&connectToken=${connectToken}`;
    
    log(`Connecting to Neutralino WS: ws://127.0.0.1:${nlPort}?extensionId=${nlExtensionId}&connectToken=***`);
    ws = new WebSocket(wsUrl);

    ws.on('error', (err) => {
        log(`WebSocket Error: ${err.message}`);
    });

    ws.on('open', () => { 
        isConnected = true; 
        log("✅ WebSocket Ke Neutralino Berhasil!"); 
    });

    ws.on('close', () => { 
        isConnected = false; 
        log("Koneksi WebSocket terputus.");
        if (!process.stdin.closed) {
            setTimeout(connectToNeutralino, 2000); 
        }
    });
    
    ws.on('message', (data) => {
        try {
            let msg = JSON.parse(data.toString());
            if(msg.event === 'action-download') {
                log(`[WS Event] ${msg.data.task} received.`);
                log(`[WS Event] Payload: ${JSON.stringify(msg.data).substring(0, 200)}...`);
                if (msg.data.task === 'shutdown') {
                    log("Menerima sinyal shutdown via WebSocket...");
                    process.exit(0);
                }
                try {
                    handleDownloadAction(msg.data);
                } catch (actionErr) {
                    log(`❌ ERROR in handleDownloadAction: ${actionErr.message}`);
                    log(`Stack: ${actionErr.stack}`);
                    if (msg.data.id) {
                        broadcastEvent('dl-error', { id: msg.data.id, error: 'Internal error: ' + actionErr.message });
                    }
                }
            }
        } catch(e) {
            log(`Error parsing message: ${e.message}`);
        }
    });
}

function saveActivePort(port) {
    activeApiPort = port;
    try {
        const tempPortFile = path.join(os.tmpdir(), '.fdm_backend_port');
        fs.writeFileSync(tempPortFile, String(port));
    } catch (e) {
        log(`Gagal menulis .fdm_backend_port: ${e.message}`);
    }
    try {
        const appDataPath = process.env.APPDATA;
        if (appDataPath) {
            const dir = path.join(appDataPath, 'com.awandigitals.file-download-manager');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, '.fdm_backend_port'), String(port));
        }
    } catch (e) { }
    broadcastEvent('backend-port-ready', { port });
}

const startServer = (preferredPort = 5050, maxPort = 5070) => {
    // Ping endpoint: Chrome & Firefox extension cek apakah app running dan port aktif
    app.get('/api/ping', (req, res) => {
        res.json({ success: true, status: 'running', port: activeApiPort });
    });

    app.post('/api/download', (req, res) => {
        const payload = req.body;
        log(`API Request received: POST /api/download - ${payload.url}`);

        // Sesuaikan payload agar cocok dengan ekspektasi downloader (cookie singular)
        let filename = payload.filename || '';
        if (filename) filename = filename.replace(/\\/g, '/').split('/').pop();

        const mappedPayload = {
            ...payload,
            filename: filename || undefined,
            cookie: payload.cookies || payload.cookie || '',
            downloadPath: payload.downloadPath || getDefaultDownloadDir()
        };

        const id = 'dl_' + Date.now();
        spawnConfirmDialog(id, mappedPayload);

        res.json({ success: true, message: 'Task received by Download Manager' });
    });

    app.post('/api/confirm-download', (req, res) => {
        const body = req.body || {};
        const { decision, id } = body;
        log(`API Request received: POST /api/confirm-download - decision: ${decision}, id: ${id}`);

        if (decision === 'start') {
            confirmAndStartDownload(id, body);
        } else {
            log(`[${id}] Download dibatalkan oleh user di dialog konfirmasi.`);
        }

        res.json({ success: true });
    });

    app.post('/api/shutdown', (req, res) => {
        log("API Request received: POST /api/shutdown");
        res.json({ success: true });
        process.exit(0);
    });

    function tryBind(currentPort) {
        const server = http.createServer(app);

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                log(`⚠️ Port ${currentPort} sedang digunakan aplikasi lain.`);
                if (currentPort > 0 && currentPort < maxPort) {
                    const nextPort = currentPort + 1;
                    log(`Mencoba port cadangan: ${nextPort}...`);
                    tryBind(nextPort);
                } else if (currentPort !== 0) {
                    log(`Semua port range 5050-${maxPort} terpakai. Menggunakan port dinamis acak dari OS...`);
                    tryBind(0);
                } else {
                    log(`❌ Gagal binding ke port manapun: ${err.message}`);
                }
            } else {
                log(`❌ Error saat menjalankan server: ${err.message}`);
            }
        });

        server.listen(currentPort, '127.0.0.1', () => {
            const actualPort = server.address().port;
            log(`🚀 API Server running at http://127.0.0.1:${actualPort}`);
            saveActivePort(actualPort);
        });
    }

    tryBind(preferredPort);
};

(async () => {
    const success = await getAuthEvents();
    if (!success) {
        log("Ekstensi berhenti karena gagal mendapatkan konfigurasi autentikasi.");
        process.exit(1);
    }

    connectToNeutralino();
    startServer(5050);
    initializeDownloaders(); // Initialize downloader modules after setting up server and connection

    // === Process Stats Monitor ===
    // Track network bytes for this process only
    let prevCpuUsage = process.cpuUsage();
    let prevTime = Date.now();
    let netDownloadSpeed = 0;
    let netUploadSpeed = 0;

    // Collect download/upload speed from active torrents and HTTP downloads
    setInterval(() => {
        try {
            // CPU usage (only this process)
            const currentCpuUsage = process.cpuUsage(prevCpuUsage);
            const elapsed = (Date.now() - prevTime) * 1000; // microseconds
            const cpuPercent = Math.min(100, ((currentCpuUsage.user + currentCpuUsage.system) / elapsed * 100)).toFixed(1);
            prevCpuUsage = process.cpuUsage();
            prevTime = Date.now();

            // RAM usage (only this process)
            const memUsage = process.memoryUsage();
            const ramMB = (memUsage.rss / 1024 / 1024).toFixed(1);

            // Network: aggregate speeds from active downloads
            let totalDownSpeed = 0;
            let totalUpSpeed = 0;

            // From WebTorrent client
            if (torrentDownloader && torrentDownloader.client) {
                totalDownSpeed += torrentDownloader.client.downloadSpeed || 0;
                totalUpSpeed += torrentDownloader.client.uploadSpeed || 0;
            }

            // From HTTP downloader active downloads
            if (httpDownloader && httpDownloader.getActiveDownloadSpeeds) {
                const httpSpeeds = httpDownloader.getActiveDownloadSpeeds();
                totalDownSpeed += httpSpeeds.download || 0;
            }

            netDownloadSpeed = totalDownSpeed;
            netUploadSpeed = totalUpSpeed;

            broadcastEvent('app-stats', {
                cpu: parseFloat(cpuPercent),
                ram: parseFloat(ramMB),
                netDown: netDownloadSpeed,
                netUp: netUploadSpeed
            });
        } catch (e) {
            // Silently ignore stats errors
        }
    }, 2000);
})();
