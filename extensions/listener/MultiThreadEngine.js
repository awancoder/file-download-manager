const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const EventEmitter = require('events');
const { URL } = require('url');
const { DownloaderHelper } = require('node-downloader-helper');

class MultiThreadEngine extends EventEmitter {
    constructor(url, destFolder, options = {}) {
        super();
        this.url = url;
        this.destFolder = destFolder;
        this.fileName = options.fileName || 'download';
        this.headers = options.headers || {};
        this.threads = options.threads || 16;
        
        this.totalSize = 0;
        this.downloaded = 0;
        this.startTime = Date.now();
        this.lastProgressTime = 0;
        this.lastDownloaded = 0;

        this.fallbackDl = null;
        this.aborted = false;
        this.streams = [];
        this.reqs = [];
        
        let ext = path.extname(this.fileName);
        let base = path.basename(this.fileName, ext);
        
        // Ensure unique filename (Do not overwrite existing)
        let finalName = this.fileName;
        let counter = 1;
        while(fs.existsSync(path.join(this.destFolder, finalName))) {
            finalName = `${base} (${counter})${ext}`;
            counter++;
        }
        this.filePath = path.join(this.destFolder, finalName);
    }

    start() {
        this.getMetadata().then(meta => {
            
            // Override nama file jika UI sebelumnya menyerah dengan sebutan generic 'download'
            if (meta.serverFileName && (this.fileName === 'download' || this.fileName === 'file_download' || !this.fileName.includes('.'))) {
                this.fileName = meta.serverFileName.replace(/[<>:"/\\|?*]/g, '_'); // Sanitasi illegal chars Windows
                let ext = path.extname(this.fileName);
                let base = path.basename(this.fileName, ext);
                let finalName = this.fileName;
                let counter = 1;
                while(fs.existsSync(path.join(this.destFolder, finalName))) {
                    finalName = `${base} (${counter})${ext}`;
                    counter++;
                }
                this.filePath = path.join(this.destFolder, finalName);
            }

            if (!meta.supportsRange || meta.size < 5 * 1024 * 1024) { 
                // Under 5MB or old server, use normal Single Thread
                console.log("[MT-Engine] Fallback to Single-Thread (Server doesn't support Range / Small Size)");
                this.fallbackToSingleThread();
            } else {
                console.log(`[MT-Engine] Starting EXTREME Operation 🚀 (${this.threads} Simultaneous TCP Paths) Size: ${meta.size}`);
                this.totalSize = meta.size;
                this.emit('download', { totalSize: this.totalSize, engine: 'multi', fileName: path.basename(this.filePath) });
                this.startMultiThread();
            }
        }).catch(err => {
            console.error("[MT-Engine] Failed to scan S3/Server Metadata:", err.message);
            console.log("[MT-Engine] Emergency Fallback to Conventional Single-Thread Mode");
            this.fallbackToSingleThread();
        });
        
        // Pseudo promise so external .catch() caller doesn't crash
        return Promise.resolve();
    }

    getMetadata() {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(this.url);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            // Use Range 0-0 instead of pure HEAD because Amazon S3 with GET presigned often rejects HEAD.
            let options = {
                method: 'GET',
                headers: Object.assign({}, this.headers, { 'Range': 'bytes=0-0' })
            };

            const req = client.request(this.url, options, (res) => {
                if (res.statusCode >= 400) {
                    return reject(new Error('Site rejected initial access with HTTP status ' + res.statusCode));
                }
                
                let cd = res.headers['content-disposition'];
                let serverFileName = null;
                if (cd) {
                    let utf8Match = cd.match(/filename\*=UTF-8''([^;\s]+)/i);
                    if (utf8Match && utf8Match[1]) {
                        serverFileName = decodeURIComponent(utf8Match[1]);
                    } else {
                        let standardMatch = cd.match(/filename=["']?([^;"'\r\n]+)["']?/i);
                        if (standardMatch && standardMatch[1]) {
                            try { serverFileName = decodeURIComponent(standardMatch[1]); } catch(e) { serverFileName = standardMatch[1]; }
                        }
                    }
                    if (serverFileName) {
                        console.log(`[MT-Engine] Header Content-Disposition terdeteksi! Nama Asli Server: ${serverFileName}`);
                    }
                }

                let supportsRange = res.statusCode === 206 && res.headers['content-range'];
                let size = 0;
                if (supportsRange) {
                    let match = res.headers['content-range'].match(/\/(\d+)$/);
                    if (match) size = parseInt(match[1]);
                } else {
                    size = parseInt(res.headers['content-length'] || 0);
                }
                res.destroy(); // Close interrogation
                resolve({ supportsRange, size, serverFileName });
            });
            req.on('error', reject);
            req.end();
        });
    }

    startMultiThread() {
        // Instant allocation (Sparse Pre-Allocation) in Windows NTFS to accommodate full file without freezing:
        let fd = fs.openSync(this.filePath, 'w');
        fs.ftruncateSync(fd, this.totalSize);
        fs.closeSync(fd);

        let chunkSize = Math.floor(this.totalSize / this.threads);
        let promises = [];

        this.startTime = Date.now();
        this.lastProgressTime = Date.now();
        this.lastDownloaded = 0;

        for (let i = 0; i < this.threads; i++) {
            let startByte = i * chunkSize;
            let endByte = (i === this.threads - 1) ? this.totalSize - 1 : (startByte + chunkSize - 1);
            promises.push(this.downloadChunk(i, startByte, endByte));
        }

        Promise.all(promises).then(() => {
            if (!this.aborted) {
                this.emit('end', { filePath: this.filePath });
            }
        }).catch(err => {
            if (!this.aborted) {
                this.aborted = true;
                this.reqs.forEach(req => req.destroy());
                this.streams.forEach(s => s.close());
                this.emit('error', err);
            }
        });
    }

    async downloadChunk(index, originalStartByte, endByte, retryCount = 0) {
        const MAX_RETRIES = 10;
        let startByte = originalStartByte;

        while (retryCount < MAX_RETRIES) {
            if (this.aborted) return;
            
            try {
                await new Promise((resolve, reject) => {
                    const parsedUrl = new URL(this.url);
                    const client = parsedUrl.protocol === 'https:' ? https : http;
                    
                    let chunkHeaders = Object.assign({}, this.headers, {
                        'Range': `bytes=${startByte}-${endByte}`
                    });
                    
                    let options = { method: 'GET', headers: chunkHeaders };

                    let req = client.request(this.url, options, (res) => {
                        if (res.statusCode >= 400) {
                            return reject(new Error(`Chunk ${index} blocked, HTTP ${res.statusCode}`));
                        }

                        // Piping exactly in its own stream partition offset range
                        let stream = fs.createWriteStream(this.filePath, { flags: 'r+', start: startByte });
                        this.streams.push(stream);

                        res.on('data', chunk => {
                            if (this.aborted) { res.destroy(); return; }
                            this.downloaded += chunk.length;
                            startByte += chunk.length; // Majukan titik startResume secara presisi per byte
                            this.reportProgress();
                        });
                        
                        res.pipe(stream);

                        res.on('end', () => { resolve(); });
                        res.on('error', (err) => { reject(err); });
                    });

                    req.on('error', reject);
                    req.end();
                    this.reqs.push(req);
                });
                
                // Terkuras 100% tuntas tanpa error putus
                return;
                
            } catch (err) {
                if (this.aborted) return; // Silent jika dibatalkan secara disengaja
                retryCount++;
                console.log(`[MT-Engine] Chunk ${index} connection dropped (${err.message}). Auto-Resuming at byte ${startByte}... (${retryCount}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, 2000)); // Jeda 2 detik sebelum nyambung lagi
            }
        }
        throw new Error(`Chunk ${index} failed permanently after ${MAX_RETRIES} timeout/ECONNRESET retries.`);
    }

    reportProgress() {
        let now = Date.now();
        // Throttle aggregator to UI screen so desktop UI doesn't hang re-rendering 16 signals at once
        if (now - this.lastProgressTime >= 1000 || this.downloaded === this.totalSize) {
            let timeDiff = (now - this.lastProgressTime) / 1000;
            let byteDiff = this.downloaded - this.lastDownloaded;
            let speed = byteDiff / timeDiff;

            this.emit('progress', {
                progress: (this.downloaded / this.totalSize) * 100,
                downloaded: this.downloaded,
                total: this.totalSize,
                speed: speed
            });

            this.lastProgressTime = now;
            this.lastProgressTime = now;
            this.lastDownloaded = this.downloaded;
        }
    }

    stop() {
        return new Promise((resolve) => {
            this.aborted = true;
            this.reqs.forEach(req => {
                try { req.destroy(); } catch (e) {}
            });
            this.streams.forEach(stream => {
                try { stream.close(); } catch (e) {}
            });
            
            if (this.fallbackDl) {
                try { this.fallbackDl.stop(); } catch (e) {}
            }
            
            // Allow streams to safely flush and close Native OS handles
            // Then instantly delete the half-downloaded/corrupted sparse file from disk
            setTimeout(() => {
                if (fs.existsSync(this.filePath)) {
                    try { fs.unlinkSync(this.filePath); } catch(e) {}
                }
                
                // If Single Thread Fallback engine was used, attempt to delete its tracked file too
                if (this.fallbackDl && this.fallbackDl.getDownloadPath) {
                    let fallbackPath = this.fallbackDl.getDownloadPath();
                    if (fallbackPath && fs.existsSync(fallbackPath)) {
                        try { fs.unlinkSync(fallbackPath); } catch(e) {}
                    }
                }
                
                resolve();
            }, 500);
        });
    }

    pause() {
        if (this.fallbackDl) {
            try { this.fallbackDl.pause(); } catch(e) {}
        } else {
            console.log("Pause is not natively supported yet on MultiThread mode, falling back to soft-stop.");
            this.stop(); 
        }
    }

    resume() {
        if (this.fallbackDl) {
            try { this.fallbackDl.resume(); } catch(e) {}
        } else {
            console.log("Resume is not entirely supported yet on partial MT stream buffers.");
        }
    }

    fallbackToSingleThread() {
        let dhOptions = {
            override: false,
            resumeIfFileExists: true,
            removeOnFail: false,
            retry: false,
            headers: this.headers
        };
        
        // Jangan paksa terapkan nama dari MT-Engine jika ini sekadar placeholder kosong tanpa ekstensi
        let isPlaceholder = (this.fileName === 'download' || this.fileName === 'file_download' || this.fileName === 'export' || !this.fileName.includes('.'));
        if (!isPlaceholder) {
            dhOptions.fileName = path.basename(this.filePath);
        } else {
            console.log(`[MT-Engine] Single-Thread Fallback: Membiarkan node-downloader-helper menebak nama & ekstensi secara otomatis.`);
        }

        this.fallbackDl = new DownloaderHelper(this.url, this.destFolder, dhOptions);

        this.fallbackDl.on('download', info => this.emit('download', Object.assign(info || {}, { engine: 'single' })));
        this.fallbackDl.on('progress', stats => this.emit('progress', Object.assign(stats, { total: stats.total })));
        this.fallbackDl.on('end', info => this.emit('end', info));
        this.fallbackDl.on('error', err => this.emit('error', err));
        
        this.fallbackDl.start().catch(err => this.emit('error', err));
    }
}

module.exports = MultiThreadEngine;
