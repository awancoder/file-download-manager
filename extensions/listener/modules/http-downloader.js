/**
 * HTTP Downloader Module
 * Handles standard HTTP/HTTPS downloads with multi-threading
 */

const EventEmitter = require('events');
const MultiThreadEngine = require('../MultiThreadEngine');

class HttpDownloader extends EventEmitter {
    constructor(logger) {
        super();
        this.logger = logger;
        this.downloads = {};
    }

    /**
     * Start HTTP download
     * @param {string} id - Download ID
     * @param {string} url - Download URL
     * @param {string} downloadPath - Destination folder
     * @param {string} filename - File name
     * @param {object} options - Additional options (cookie, userAgent, referrer, etc)
     */
    start(id, url, downloadPath, filename, options = {}) {
        const title = filename || url.split('/').pop().split('?')[0] || 'Unknown_File';
        
        this.logger.log(`[HTTP-DL] [${id}] Starting HTTP download`);
        this.logger.log(`[HTTP-DL] [${id}] URL: ${url}`);
        this.logger.log(`[HTTP-DL] [${id}] Folder: ${downloadPath}`);
        this.logger.log(`[HTTP-DL] [${id}] Filename: ${title}`);

        let dynamicHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        if (options.cookie && !url.includes('amazonaws.com')) {
            dynamicHeaders['Cookie'] = options.cookie;
        }
        if (options.userAgent) {
            dynamicHeaders['User-Agent'] = options.userAgent;
        }
        if (options.referrer && !url.includes('amazonaws.com')) {
            dynamicHeaders['Referer'] = options.referrer;
        }

        try {
            const dl = new MultiThreadEngine(url, downloadPath, {
                fileName: title,
                threads: 16,
                headers: dynamicHeaders
            });

            dl.on('download', (info) => {
                this.logger.log(`[HTTP-DL] [${id}] ✅ Download STARTED. Engine: ${info.engine}, File: ${info.fileName || title}`);
                this.emit('started', { id, engine: info.engine, fileName: info.fileName || title });
            });

            dl.on('progress', (stats) => {
                this.emit('progress', { id, progress: stats.progress, speed: stats.speed, downloaded: stats.downloaded, total: stats.total });
            });

            dl.on('end', (info) => {
                this.logger.log(`[HTTP-DL] [${id}] ✅ Download COMPLETED: ${info.filePath}`);
                this.emit('complete', { id, filePath: info.filePath, fileName: title });
                delete this.downloads[id];
            });

            dl.on('error', (err) => {
                this.logger.log(`[HTTP-DL] [${id}] ❌ Download ERROR: ${err.message}`);
                this.emit('error', { id, error: err.message });
                delete this.downloads[id];
            });

            dl.start().catch(err => {
                this.logger.log(`[HTTP-DL] [${id}] ❌ Start FAILED: ${err.message}`);
                this.emit('error', { id, error: err.message });
            });

            this.downloads[id] = dl;
            this.logger.log(`[HTTP-DL] [${id}] Engine initialized. Threads: 16. Ready.`);

        } catch(err) {
            this.logger.log(`[HTTP-DL] [${id}] ❌ Engine INIT FAILED: ${err.message}`);
            this.emit('error', { id, error: err.message });
        }
    }

    /**
     * Pause HTTP download
     * @param {string} id - Download ID
     */
    pause(id) {
        if (this.downloads[id]) {
            this.logger.log(`[HTTP-DL] [${id}] ⏸️ PAUSE requested`);
            this.downloads[id].pause();
            this.logger.log(`[HTTP-DL] [${id}] ⏸️ PAUSED`);
        } else {
            this.logger.log(`[HTTP-DL] [${id}] ⚠️ Download not found for pause`);
        }
    }

    /**
     * Resume HTTP download
     * @param {string} id - Download ID
     */
    resume(id) {
        if (this.downloads[id]) {
            this.logger.log(`[HTTP-DL] [${id}] ▶️ RESUME requested`);
            this.downloads[id].resume();
            this.logger.log(`[HTTP-DL] [${id}] ▶️ RESUMED`);
        } else {
            this.logger.log(`[HTTP-DL] [${id}] ⚠️ Download not found for resume`);
        }
    }

    /**
     * Cancel HTTP download
     * @param {string} id - Download ID
     */
    cancel(id) {
        if (this.downloads[id]) {
            this.logger.log(`[HTTP-DL] [${id}] 🛑 CANCEL requested`);
            this.downloads[id].stop();
            delete this.downloads[id];
            this.logger.log(`[HTTP-DL] [${id}] 🛑 CANCELLED`);
        } else {
            this.logger.log(`[HTTP-DL] [${id}] ⚠️ Download not found for cancel`);
        }
    }

    /**
     * Check if download exists
     * @param {string} id - Download ID
     */
    exists(id) {
        return !!this.downloads[id];
    }

    /**
     * Get aggregate download speed from all active HTTP downloads
     */
    getActiveDownloadSpeeds() {
        let totalDown = 0;
        for (const id in this.downloads) {
            const dl = this.downloads[id];
            if (dl && dl.getStats) {
                try {
                    const stats = dl.getStats();
                    totalDown += stats.speed || 0;
                } catch (e) { /* ignore */ }
            }
        }
        return { download: totalDown };
    }

    /**
     * Kill ALL active HTTP downloads
     */
    killAll() {
        let killed = 0;
        for (const id of Object.keys(this.downloads)) {
            try {
                this.downloads[id].stop();
                this.logger.log(`[HTTP-DL] [KILLALL] Stopped: ${id}`);
                killed++;
            } catch (e) { }
            delete this.downloads[id];
        }
        this.logger.log(`[HTTP-DL] [KILLALL] Total killed: ${killed}`);
        return killed;
    }
}

module.exports = HttpDownloader;
