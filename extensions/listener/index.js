const express = require('express');
const cors = require('cors');
const { WebSocket } = require('ws');
const MultiThreadEngine = require('./MultiThreadEngine');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

console.log("=== Mengambil Konfigurasi Auth dari .tmp/auth_info.json ===");

let nlPort = '';
let nlToken = '';
let nlConnectToken = '';
let nlExtensionId = 'listener';

try {
    const authFilePath = path.join(__dirname, '..', '..', '.tmp', 'auth_info.json');
    if (fs.existsSync(authFilePath)) {
        const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
        nlPort = authData.nlPort;
        nlToken = authData.nlToken;
        nlConnectToken = authData.nlConnectToken || '';
        console.log(`Auth Info Terbaca Berhasil! Port: ${nlPort}`);
    } else {
        console.error("Gagal menemukan " + authFilePath);
    }
} catch(err) {
    console.error("Gagal parse auth_info.json:", err.message);
}

let ws = null;
let isConnected = false;
let downloaders = {};

function broadcastEvent(event, data) {
    if (isConnected && ws) {
        ws.send(JSON.stringify({
            id: 'evt_' + Date.now(),
            method: 'app.broadcast',
            accessToken: nlToken,
            data: { event: event, data: data }
        }));
    }
}

function handleDownloadAction(payload) {
    const { task, id, url, downloadPath, filename } = payload;
    
    if (task === 'start') {
        const title = filename || url.split('/').pop().split('?')[0] || 'Unknown_File';
        let dynamicHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9'
        };
        // Amazon S3 is very strict regarding unsigned Cookie injection, bypassing cookie if domain is S3
        if (payload.cookie && !url.includes('amazonaws.com')) dynamicHeaders['Cookie'] = payload.cookie;
        if (payload.userAgent) dynamicHeaders['User-Agent'] = payload.userAgent;
        if (payload.referrer && !url.includes('amazonaws.com')) dynamicHeaders['Referer'] = payload.referrer;

        // Execute Using New Multi-Thread Turbo Engine (Default 16 TCP Paths)
        let dl = new MultiThreadEngine(url, downloadPath, {
            fileName: title,
            threads: 16,
            headers: dynamicHeaders
        });

        dl.on('download', info => {
            console.log(`[${id}] Native File Stream Execution Started. Mode: ${info.engine} | Size: ${info.totalSize} | Filename: ${info.fileName || 'N/A'}`);
            broadcastEvent('dl-started', { id, engine: info.engine, fileName: info.fileName || '' });
        });

        dl.on('progress', stats => {
            // Mengirim speed dalam bytes/sec, downloaded/total dalam bytes
            broadcastEvent('dl-progress', { id, progress: stats.progress, speed: stats.speed, downloaded: stats.downloaded, total: stats.total });
        });
        dl.on('end', downloadInfo => {
            console.log(`[${id}] Download completed. Saved at: ${downloadInfo.filePath}`);
            broadcastEvent('dl-end', { id, info: downloadInfo });
            delete downloaders[id];
        });
        dl.on('error', err => {
            console.error('\n========== ERROR DETAIL ==========');
            console.error(`URL     : ${url}`);
            console.error(`File    : ${title}`);
            console.error(`Error   : ${err.message}`);
            console.error(`Headers :`, JSON.stringify(dynamicHeaders, null, 2));
            console.error('==================================\n');
            broadcastEvent('dl-error', { id, error: err.message });
        });
        
        dl.start().catch(err => {
            console.error('\n========== START ERROR ==========');
            console.error(`URL     : ${url}`);
            console.error(`File    : ${title}`);
            console.error(`Error   : ${err.message}`);
            console.error(`Headers :`, JSON.stringify(dynamicHeaders, null, 2));
            console.error('=================================\n');
            broadcastEvent('dl-error', { id, error: err.message });
        });
        
        downloaders[id] = dl;
    } else if (task === 'pause' && downloaders[id]) {
        downloaders[id].pause().catch(console.error);
    } else if (task === 'resume' && downloaders[id]) {
        downloaders[id].resume().catch(console.error);
    } else if (task === 'cancel' && downloaders[id]) {
        downloaders[id].stop().catch(console.error);
        delete downloaders[id];
    }
}

function connectToNeutralino() {
    if(!nlPort || !nlToken || !nlExtensionId) return;
    let wsUrl = `ws://localhost:${nlPort}?extensionId=${nlExtensionId}`;
    if (nlConnectToken) {
        wsUrl += `&connectToken=${nlConnectToken}`;
    }
    ws = new WebSocket(wsUrl);

    ws.on('error', (err) => {
        console.error("WebSocket rute terputus:", err.message);
    });

    ws.on('open', () => { isConnected = true; console.log("✅ WebSocket Ke Neutralino Berhasil!"); });
    ws.on('close', () => { isConnected = false; setTimeout(connectToNeutralino, 2000); });
    
    ws.on('message', (data) => {
        try {
            let msg = JSON.parse(data.toString());
            if(msg.event === 'action-download') {
                console.log(`[WS] Antarmuka mengirim tugas '${msg.data.task}' untuk antrean ${msg.data.filename || msg.data.id}`);
                handleDownloadAction(msg.data);
            }
        } catch(e) {}
    });
}

connectToNeutralino();

app.post('/api/download', (req, res) => {
    const data = req.body;
    broadcastEvent('new-download', data);
    res.json({ success: true, message: 'URL diterima' });
});

app.post('/api/shutdown', (req, res) => {
    res.json({ success: true });
    console.log("Menerima perintah antarmuka untuk menutup paksa sistem...");
    process.exit(0);
});

function killZombiePort5050() {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            exec('netstat -ano | findstr :5050', (err, stdout) => {
                if (!stdout) return resolve();
                const lines = stdout.split('\n');
                let promises = [];
                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 5 && parts[1].includes(':5050')) {
                        const pid = parts[parts.length - 1]; // PID usually at the end
                        promises.push(new Promise(res => {
                            exec(`taskkill /PID ${pid} /F /T`, () => res());
                        }));
                    }
                });
                Promise.all(promises).then(resolve);
            });
        } else {
            // Linux/Mac fallback (optional)
            exec('lsof -t -i:5050 | xargs kill -9', () => resolve());
        }
    });
}

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`Background Downloader Engine Ready at port ${port}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${port} sedang digunakan oleh zombie proses. Mencoba mematikan...`);
            
            // Coba panggil shutdown API-nya dulu (kalau ini proses hasil buatan kita sendiri)
            fetch(`http://localhost:${port}/api/shutdown`, { method: 'POST' })
                .then(() => setTimeout(() => startServer(port), 1000))
                .catch(() => {
                    // Kalau alamat tidak sah (Error 404 dari zombie versi kuno), gunakan eksekusi kill paksa.
                    killZombiePort5050().then(() => {
                        console.log("OS Process Taskkill dieksekusi, menyalakan ulang 5050...");
                        setTimeout(() => startServer(port), 1500);
                    });
                });
        }
    });
}

startServer(5050);
