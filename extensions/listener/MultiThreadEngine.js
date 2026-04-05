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
        this.isPaused = false;
        this.pauseResolvers = [];
        this.streams = [];
        this.reqs = [];
        this.chunkProgress = []; // Track progress per chunk
        
        let ext = path.extname(this.fileName);
        let base = path.basename(this.fileName, ext);
        
        // Ensure unique filename
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
            if (meta.serverFileName && (this.fileName === 'download' || !this.fileName.includes('.'))) {
                this.fileName = meta.serverFileName.replace(/[<>:"/\\|?*]/g, '_');
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
                this.fallbackToSingleThread();
            } else {
                this.totalSize = meta.size;
                this.emit('download', { totalSize: this.totalSize, engine: 'multi', fileName: path.basename(this.filePath) });
                this.startMultiThread();
            }
        }).catch(err => {
            console.error("[MT-Engine] Metadata Error, falling back:", err.message);
            this.fallbackToSingleThread();
        });
        return Promise.resolve();
    }

    getMetadata() {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(this.url);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            let options = {
                method: 'GET',
                headers: Object.assign({}, this.headers, { 'Range': 'bytes=0-0' })
            };

            const req = client.request(this.url, options, (res) => {
                if (res.statusCode >= 400) return reject(new Error('HTTP status ' + res.statusCode));
                
                let cd = res.headers['content-disposition'];
                let serverFileName = null;
                if (cd) {
                    let match = cd.match(/filename\*=UTF-8''([^;\s]+)/i) || cd.match(/filename=["']?([^;"'\r\n]+)["']?/i);
                    if (match && match[1]) {
                        try { serverFileName = decodeURIComponent(match[1]); } catch(e) { serverFileName = match[1]; }
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
                res.destroy();
                resolve({ supportsRange, size, serverFileName });
            });
            req.on('error', reject);
            req.end();
        });
    }

    startMultiThread() {
        try {
            let fd = fs.openSync(this.filePath, 'w');
            fs.ftruncateSync(fd, this.totalSize);
            fs.closeSync(fd);
        } catch(e) {
            return this.emit('error', new Error('Failed to pre-allocate file: ' + e.message));
        }

        let chunkSize = Math.floor(this.totalSize / this.threads);
        let promises = [];
        this.startTime = Date.now();
        this.lastProgressTime = Date.now();

        for (let i = 0; i < this.threads; i++) {
            let startByte = i * chunkSize;
            let endByte = (i === this.threads - 1) ? this.totalSize - 1 : (startByte + chunkSize - 1);
            this.chunkProgress[i] = { startByte, endByte, currentByte: startByte };
            promises.push(this.downloadChunk(i, startByte, endByte));
        }

        Promise.all(promises).then(() => {
            if (!this.aborted) this.emit('end', { filePath: this.filePath });
        }).catch(err => {
            if (!this.aborted) {
                this.aborted = true;
                this.reqs.forEach(req => req.destroy());
                this.streams.forEach(s => s.close());
                this.emit('error', err);
            }
        });
    }

    async downloadChunk(index, startByte, endByte, retryCount = 0) {
        const MAX_RETRIES = 10;
        while (retryCount < MAX_RETRIES) {
            if (this.aborted) return;
            
            // Tunggu jika sedang dipause
            while (this.isPaused && !this.aborted) {
                await new Promise(resolve => {
                    this.pauseResolvers.push(resolve);
                });
            }
            if (this.aborted) return;

            try {
                await new Promise((resolve, reject) => {
                    const parsedUrl = new URL(this.url);
                    const client = parsedUrl.protocol === 'https:' ? https : http;
                    let options = { 
                        method: 'GET', 
                        headers: Object.assign({}, this.headers, { 'Range': `bytes=${startByte}-${endByte}` }) 
                    };
                    let req = client.request(this.url, options, (res) => {
                        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
                        let stream = fs.createWriteStream(this.filePath, { flags: 'r+', start: startByte });
                        this.streams.push(stream);
                        res.on('data', chunk => {
                            if (this.aborted) { res.destroy(); return; }
                            if (this.isPaused) { 
                                req.destroy(); 
                                return; 
                            }
                            this.downloaded += chunk.length;
                            startByte += chunk.length;
                            if (this.chunkProgress[index]) {
                                this.chunkProgress[index].currentByte = startByte;
                            }
                            this.reportProgress();
                        });
                        res.pipe(stream);
                        res.on('end', resolve);
                        res.on('error', reject);
                        stream.on('error', reject);
                    });
                    req.on('error', (err) => {
                        if (this.isPaused) resolve(); // Jangan count sebagai error saat pause
                        else reject(err);
                    });
                    req.end();
                    this.reqs.push(req);
                });
                return;
            } catch (err) {
                if (this.aborted) return;
                if (this.isPaused) continue; // Retry dari posisi terakhir setelah resume
                retryCount++;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        throw new Error(`Chunk ${index} failed after ${MAX_RETRIES} retries.`);
    }

    reportProgress() {
        let now = Date.now();
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
            this.lastDownloaded = this.downloaded;
        }
    }

    stop() {
        this.aborted = true;
        this.reqs.forEach(req => { try { req.destroy(); } catch (e) {} });
        this.streams.forEach(stream => { try { stream.close(); } catch (e) {} });
        if (this.fallbackDl) this.fallbackDl.stop();
        // Bangunkan semua pause waiters
        this.pauseResolvers.forEach(r => r());
        this.pauseResolvers = [];
        setTimeout(() => {
            if (fs.existsSync(this.filePath)) {
                try { fs.unlinkSync(this.filePath); } catch(e) {}
            }
        }, 500);
    }

    pause() {
        if (this.fallbackDl) {
            this.fallbackDl.pause();
        } else {
            // Multi-thread: set flag dan destroy koneksi aktif (file TIDAK dihapus)
            this.isPaused = true;
            this.reqs.forEach(req => { try { req.destroy(); } catch (e) {} });
            this.reqs = [];
            this.streams.forEach(stream => { try { stream.close(); } catch (e) {} });
            this.streams = [];
        }
    }

    resume() {
        if (this.fallbackDl) {
            this.fallbackDl.resume();
        } else {
            // Multi-thread: lepas flag pause, bangunkan semua chunk workers
            this.isPaused = false;
            this.pauseResolvers.forEach(r => r());
            this.pauseResolvers = [];
        }
    }

    fallbackToSingleThread() {
        let dhOptions = { override: false, resumeIfFileExists: true, removeOnFail: false, retry: false, headers: this.headers };
        if (this.fileName !== 'download' && this.fileName.includes('.')) {
            dhOptions.fileName = path.basename(this.filePath);
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
