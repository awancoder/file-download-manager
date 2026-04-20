const fs   = require('fs');
const path = require('path');
const http  = require('http');
const https = require('https');
const EventEmitter = require('events');
const { URL } = require('url');
const { DownloaderHelper } = require('node-downloader-helper');
const dnsConfig = require('./modules/dns-config');

class MultiThreadEngine extends EventEmitter {
    constructor(url, destFolder, options = {}) {
        super();
        this.url        = url;
        this.destFolder = destFolder;
        this.fileName   = options.fileName || 'download';
        this.headers    = options.headers  || {};
        this.threads    = options.threads  || 16;

        this.totalSize      = 0;
        this.downloaded     = 0;
        this.startTime      = Date.now();
        this.lastProgressTime = 0;
        this.lastDownloaded = 0;

        this.fallbackDl     = null;
        this.aborted        = false;
        this.isPaused       = false;
        this.pauseResolvers = [];
        this.streams        = [];
        this.reqs           = [];
        this.chunkProgress  = [];

        // Pre-resolved connection info (set in _resolveConnection)
        this._connUrl     = url;   // URL with hostname possibly replaced by IP
        this._connHost    = null;  // Original hostname (for Host: header & SNI)

        let ext  = path.extname(this.fileName);
        let base = path.basename(this.fileName, ext);
        let finalName = this.fileName;
        let counter = 1;
        while (fs.existsSync(path.join(this.destFolder, finalName))) {
            finalName = `${base} (${counter})${ext}`;
            counter++;
        }
        this.filePath = path.join(this.destFolder, finalName);
    }

    /**
     * Pre-resolve hostname via custom DNS (DoH) if configured.
     * Caches results so all subsequent requests use the same IP.
     */
    async _resolveConnection() {
        if (!dnsConfig.isActive()) return; // System DNS — nothing to do

        try {
            const parsed   = new URL(this.url);
            const hostname = parsed.hostname;

            const resolvedIp = await dnsConfig.resolveHostname(hostname);

            // Replace hostname with resolved IP in the URL
            const newParsed = new URL(this.url);
            newParsed.hostname = resolvedIp;
            this._connUrl  = newParsed.toString();
            this._connHost = hostname; // Keep for Host header & TLS SNI
            console.log(`[MT] DNS resolved: ${hostname} → ${resolvedIp}`);
        } catch (err) {
            console.error('[MT] DNS pre-resolve failed, using system DNS:', err.message);
            this._connUrl  = this.url;
            this._connHost = null;
        }
    }

    /**
     * Build request options. When _connHost is set we're connecting by IP,
     * so we need Host header and SNI for HTTPS to work correctly.
     */
    _makeOpts(extraHeaders = {}) {
        const headers = Object.assign({}, this.headers, extraHeaders);
        if (this._connHost) {
            headers['Host'] = this._connHost; // Required when IP used as hostname
        }
        const opts = { method: 'GET', headers };
        // For HTTPS with IP: must set servername (SNI) to original hostname
        if (this._connHost) {
            opts.servername = this._connHost;
        }
        return opts;
    }

    async start() {
        // Overall safety timeout — prevents "Connecting..." stuck forever
        const startTimeout = setTimeout(() => {
            if (!this.aborted) {
                this.aborted = true;
                this.emit('error', new Error('Connection timed out (35s)'));
            }
        }, 35000);

        try {
            // Step 1: Pre-resolve hostname via DoH if custom DNS active
            await this._resolveConnection();

            if (this.aborted) { clearTimeout(startTimeout); return; }

            // Step 2: Fetch metadata
            const meta = await this.getMetadata();
            clearTimeout(startTimeout);

            if (this.aborted) return;

            // Update filename from server headers
            if (meta.serverFileName && (this.fileName === 'download' || !this.fileName.includes('.'))) {
                this.fileName = meta.serverFileName.replace(/[<>:"/\\|?*]/g, '_');
                let ext  = path.extname(this.fileName);
                let base = path.basename(this.fileName, ext);
                let finalName = this.fileName;
                let counter = 1;
                while (fs.existsSync(path.join(this.destFolder, finalName))) {
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
        } catch (err) {
            clearTimeout(startTimeout);
            if (this.aborted) return;
            console.error('[MT-Engine] Error:', err.message);
            this.emit('error', new Error('Connection failed: ' + err.message));
        }

        return Promise.resolve();
    }

    getMetadata() {
        const TIMEOUT_MS = 30000;
        return new Promise((resolve, reject) => {
            const parsed = new URL(this._connUrl);
            const client = parsed.protocol === 'https:' ? https : http;
            const opts   = this._makeOpts({ 'Range': 'bytes=0-0' });

            let settled = false;
            const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };

            const req = client.request(this._connUrl, opts, (res) => {
                if (res.statusCode >= 400) {
                    return done(reject, new Error('HTTP ' + res.statusCode));
                }

                let serverFileName = null;
                const cd = res.headers['content-disposition'];
                if (cd) {
                    const m = cd.match(/filename\*=UTF-8''([^;\s]+)/i) || cd.match(/filename=["']?([^;"'\r\n]+)["']?/i);
                    if (m && m[1]) {
                        try { serverFileName = decodeURIComponent(m[1]); } catch (e) { serverFileName = m[1]; }
                    }
                }

                const supportsRange = res.statusCode === 206 && res.headers['content-range'];
                let size = 0;
                if (supportsRange) {
                    const m = res.headers['content-range'].match(/\/(\d+)$/);
                    if (m) size = parseInt(m[1]);
                } else {
                    size = parseInt(res.headers['content-length'] || 0);
                }
                res.destroy();
                done(resolve, { supportsRange, size, serverFileName });
            });

            req.setTimeout(TIMEOUT_MS, () => { req.destroy(); done(reject, new Error('Connection timed out (30s)')); });
            req.on('error', (err) => done(reject, err));
            req.end();
        });
    }

    startMultiThread() {
        try {
            const fd = fs.openSync(this.filePath, 'w');
            fs.ftruncateSync(fd, this.totalSize);
            fs.closeSync(fd);
        } catch (e) {
            return this.emit('error', new Error('Failed to pre-allocate file: ' + e.message));
        }

        const chunkSize = Math.floor(this.totalSize / this.threads);
        const promises  = [];
        this.startTime        = Date.now();
        this.lastProgressTime = Date.now();

        for (let i = 0; i < this.threads; i++) {
            const startByte = i * chunkSize;
            const endByte   = (i === this.threads - 1) ? this.totalSize - 1 : (startByte + chunkSize - 1);
            this.chunkProgress[i] = { startByte, endByte, currentByte: startByte };
            promises.push(this.downloadChunk(i, startByte, endByte));
        }

        Promise.all(promises).then(() => {
            if (!this.aborted) this.emit('end', { filePath: this.filePath });
        }).catch(err => {
            if (!this.aborted) {
                this.aborted = true;
                this.reqs.forEach(r => r.destroy());
                this.streams.forEach(s => s.close());
                this.emit('error', err);
            }
        });
    }

    async downloadChunk(index, startByte, endByte, retryCount = 0) {
        const MAX_RETRIES = 10;
        while (retryCount < MAX_RETRIES) {
            if (this.aborted) return;

            while (this.isPaused && !this.aborted) {
                await new Promise(r => this.pauseResolvers.push(r));
            }
            if (this.aborted) return;

            try {
                await new Promise((resolve, reject) => {
                    const parsed = new URL(this._connUrl);
                    const client = parsed.protocol === 'https:' ? https : http;
                    const opts   = this._makeOpts({ 'Range': `bytes=${startByte}-${endByte}` });

                    const req = client.request(this._connUrl, opts, (res) => {
                        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
                        const stream = fs.createWriteStream(this.filePath, { flags: 'r+', start: startByte });
                        this.streams.push(stream);
                        res.on('data', chunk => {
                            if (this.aborted) { res.destroy(); return; }
                            if (this.isPaused) { req.destroy(); return; }
                            this.downloaded += chunk.length;
                            startByte       += chunk.length;
                            if (this.chunkProgress[index]) this.chunkProgress[index].currentByte = startByte;
                            this.reportProgress();
                        });
                        res.pipe(stream);
                        res.on('end',   resolve);
                        res.on('error', reject);
                        stream.on('error', reject);
                    });
                    req.on('error', (err) => { if (this.isPaused) resolve(); else reject(err); });
                    req.end();
                    this.reqs.push(req);
                });
                return;
            } catch (err) {
                if (this.aborted) return;
                if (this.isPaused) continue;
                retryCount++;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        throw new Error(`Chunk ${index} failed after ${MAX_RETRIES} retries.`);
    }

    reportProgress() {
        const now = Date.now();
        if (now - this.lastProgressTime >= 1000 || this.downloaded === this.totalSize) {
            const timeDiff = (now - this.lastProgressTime) / 1000;
            const byteDiff = this.downloaded - this.lastDownloaded;
            this.emit('progress', {
                progress:   (this.downloaded / this.totalSize) * 100,
                downloaded: this.downloaded,
                total:      this.totalSize,
                speed:      byteDiff / timeDiff
            });
            this.lastProgressTime = now;
            this.lastDownloaded   = this.downloaded;
        }
    }

    stop() {
        this.aborted = true;
        this.reqs.forEach(r => { try { r.destroy(); } catch (e) {} });
        this.streams.forEach(s => { try { s.close();   } catch (e) {} });
        if (this.fallbackDl) this.fallbackDl.stop();
        this.pauseResolvers.forEach(r => r());
        this.pauseResolvers = [];
        setTimeout(() => {
            if (fs.existsSync(this.filePath)) {
                try { fs.unlinkSync(this.filePath); } catch (e) {}
            }
        }, 500);
    }

    pause() {
        if (this.fallbackDl) {
            this.fallbackDl.pause();
        } else {
            this.isPaused = true;
            this.reqs.forEach(r => { try { r.destroy(); } catch (e) {} });
            this.reqs = [];
            this.streams.forEach(s => { try { s.close(); } catch (e) {} });
            this.streams = [];
        }
    }

    resume() {
        if (this.fallbackDl) {
            this.fallbackDl.resume();
        } else {
            this.isPaused = false;
            this.pauseResolvers.forEach(r => r());
            this.pauseResolvers = [];
        }
    }

    fallbackToSingleThread() {
        const dhOptions = {
            override:            false,
            resumeIfFileExists:  true,
            removeOnFail:        false,
            retry:               false,
            headers:             Object.assign({}, this.headers, this._connHost ? { 'Host': this._connHost } : {})
        };
        if (this.fileName !== 'download' && this.fileName.includes('.')) {
            dhOptions.fileName = path.basename(this.filePath);
        }

        // Use resolved URL (IP-based) if available
        const downloadUrl = this._connUrl;

        // For HTTPS with IP: pass servername via agent so TLS works
        if (this._connHost) {
            const parsed = new URL(downloadUrl);
            if (parsed.protocol === 'https:') {
                dhOptions.httpsRequestOptions = {
                    agent:      new https.Agent({ servername: this._connHost }),
                    servername: this._connHost
                };
            }
        }

        this.fallbackDl = new DownloaderHelper(downloadUrl, this.destFolder, dhOptions);

        let started = false;
        const fallbackTimeout = setTimeout(() => {
            if (!started && !this.aborted) {
                this.aborted = true;
                if (this.fallbackDl) this.fallbackDl.stop().catch(() => {});
                this.emit('error', new Error('Connection timed out (35s)'));
            }
        }, 35000);

        this.fallbackDl.on('download', info => {
            started = true;
            clearTimeout(fallbackTimeout);
            this.emit('download', Object.assign(info || {}, { engine: 'single' }));
        });
        this.fallbackDl.on('progress', stats => {
            started = true;
            clearTimeout(fallbackTimeout);
            this.emit('progress', Object.assign(stats, { total: stats.total }));
        });
        this.fallbackDl.on('end',   info => { clearTimeout(fallbackTimeout); this.emit('end', info); });
        this.fallbackDl.on('error', err  => { clearTimeout(fallbackTimeout); this.emit('error', err); });
        this.fallbackDl.start().catch(err => { clearTimeout(fallbackTimeout); this.emit('error', err); });
    }
}

module.exports = MultiThreadEngine;
