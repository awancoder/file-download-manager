const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class HlsDownloader extends EventEmitter {
    constructor(logger) {
        super();
        this.logger = logger;
        this.downloads = {};
    }

    /**
     * Start HLS download
     */
    async start(id, url, downloadPath, filename, options = {}) {
        let title = filename || 'video_stream.mp4';
        if (title.toLowerCase().endsWith('.m3u8')) {
            title = title.substring(0, title.length - 5) + '.mp4';
        }
        if (!title.endsWith('.ts') && !title.endsWith('.mp4')) {
            title += '.mp4';
        }
        
        const finalFilePath = path.join(downloadPath, title);
        const tempDir = path.join(downloadPath, `.temp_hls_${id}`);
        const shortTitle = title.length > 50 ? title.substring(0, 50) + '...' : title;

        this.logger.log(`[HLS-DL] [${id}] ("${shortTitle}") Starting HLS download`);
        this.logger.log(`[HLS-DL] [${id}] ("${shortTitle}") URL: ${url}`);
        this.logger.log(`[HLS-DL] [${id}] ("${shortTitle}") Destination: ${finalFilePath}`);

        this.downloads[id] = {
            status: 'downloading',
            tempDir,
            finalFilePath,
            title,
            activeRequests: [],
            isCancelled: false
        };

        try {
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            this.emit('started', { id, engine: 'hls', fileName: title });

            this.logger.log(`[HLS-DL] [${id}] Fetching manifest...`);
            let manifestText = await this.fetchText(url, options);
            let playlistUrl = url;

            if (manifestText.includes('#EXT-X-STREAM-INF')) {
                this.logger.log(`[HLS-DL] [${id}] Master Playlist detected. Finding media playlist...`);
                const lines = manifestText.split('\n');
                let subPlaylistPath = '';
                
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                        for (let j = i + 1; j < lines.length; j++) {
                            const line = lines[j].trim();
                            if (line && !line.startsWith('#')) {
                                subPlaylistPath = line;
                                break;
                            }
                        }
                        break;
                    }
                }

                if (!subPlaylistPath) {
                    throw new Error('No media playlist found in Master Playlist');
                }

                playlistUrl = this.resolveUrl(url, subPlaylistPath);
                this.logger.log(`[HLS-DL] [${id}] Media playlist resolved: ${playlistUrl}`);
                manifestText = await this.fetchText(playlistUrl, options);
            }

            const segments = [];
            const lines = manifestText.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    segments.push(this.resolveUrl(playlistUrl, line));
                }
            }

            const totalSegments = segments.length;
            if (totalSegments === 0) {
                throw new Error('No media segments found in playlist');
            }

            this.logger.log(`[HLS-DL] [${id}] Found ${totalSegments} segments to download.`);

            const concurrency = 6;
            let activeDownloads = 0;
            let currentIndex = 0;
            let completedSegments = 0;
            let totalDownloadedBytes = 0;
            const startTime = Date.now();

            const downloadNext = () => {
                if (this.downloads[id].isCancelled) return;

                if (completedSegments === totalSegments) {
                    this.logger.log(`[HLS-DL] [${id}] All segments downloaded. Starting merge...`);
                    this.mergeAndComplete(id);
                    return;
                }

                while (activeDownloads < concurrency && currentIndex < totalSegments) {
                    const index = currentIndex++;
                    const segmentUrl = segments[index];
                    const segmentPath = path.join(tempDir, `segment_${index}.ts`);

                    activeDownloads++;
                    this.downloadSegment(id, segmentUrl, segmentPath, options)
                        .then((bytes) => {
                            activeDownloads--;
                            completedSegments++;
                            totalDownloadedBytes += bytes;

                            const progress = Math.round((completedSegments / totalSegments) * 100);
                            const elapsedSec = (Date.now() - startTime) / 1000;
                            const speed = elapsedSec > 0 ? Math.round(totalDownloadedBytes / elapsedSec) : 0;

                            this.emit('progress', {
                                id,
                                progress,
                                speed,
                                downloaded: totalDownloadedBytes,
                                total: totalSegments * 1.5 * 1024 * 1024 // estimasi total size
                            });

                            downloadNext();
                        })
                        .catch((err) => {
                            this.logger.log(`[HLS-DL] [${id}] Segment ${index} failed: ${err.message}. Retrying once...`);
                            this.downloadSegment(id, segmentUrl, segmentPath, options)
                                .then((bytes) => {
                                    activeDownloads--;
                                    completedSegments++;
                                    totalDownloadedBytes += bytes;
                                    downloadNext();
                                })
                                .catch((retryErr) => {
                                    this.logger.log(`[HLS-DL] [${id}] Segment ${index} retry failed.`);
                                    this.handleError(id, new Error(`Failed to download segment ${index}: ${retryErr.message}`));
                                });
                        });
                }
            };

            downloadNext();

        } catch (err) {
            this.handleError(id, err);
        }
    }

    /**
     * Merge segments and clean up
     */
    async mergeAndComplete(id) {
        const download = this.downloads[id];
        if (!download || download.isCancelled) return;

        try {
            const tempDir = download.tempDir;
            const finalFilePath = download.finalFilePath;
            
            const files = fs.readdirSync(tempDir)
                .filter(f => f.startsWith('segment_'))
                .sort((a, b) => {
                    const numA = parseInt(a.split('_')[1], 10);
                    const numB = parseInt(b.split('_')[1], 10);
                    return numA - numB;
                });

            const totalSegments = files.length;
            const writeStream = fs.createWriteStream(finalFilePath);

            for (let i = 0; i < totalSegments; i++) {
                const segmentPath = path.join(tempDir, `segment_${i}.ts`);
                if (fs.existsSync(segmentPath)) {
                    const readStream = fs.createReadStream(segmentPath);
                    await new Promise((resolve, reject) => {
                        readStream.pipe(writeStream, { end: false });
                        readStream.on('end', resolve);
                        readStream.on('error', reject);
                    });
                }
            }

            writeStream.end();

            this.cleanTempDir(tempDir);

            this.logger.log(`[HLS-DL] [${id}] ✅ Merge completed: ${finalFilePath}`);
            this.emit('complete', { id, filePath: finalFilePath, fileName: download.title });
            delete this.downloads[id];

        } catch (err) {
            this.handleError(id, err);
        }
    }

    /**
     * Download individual segment
     */
    downloadSegment(id, url, destPath, options) {
        return new Promise((resolve, reject) => {
            if (this.downloads[id]?.isCancelled) {
                return reject(new Error('Download cancelled'));
            }

            const parsedUrl = new URL(url);
            const reqLib = parsedUrl.protocol === 'https:' ? https : http;

            const headers = {
                'User-Agent': options.userAgent || 'Mozilla/5.0',
                'Accept': '*/*'
            };
            if (options.cookie) headers['Cookie'] = options.cookie;
            if (options.referrer) headers['Referer'] = options.referrer;

            const reqOptions = {
                headers,
                timeout: 15000
            };

            const req = reqLib.get(url, reqOptions, (res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Server status ${res.statusCode}`));
                }

                const fileStream = fs.createWriteStream(destPath);
                let bytes = 0;

                res.on('data', (chunk) => {
                    bytes += chunk.length;
                });

                res.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(bytes);
                });

                fileStream.on('error', (err) => {
                    fs.unlink(destPath, () => {});
                    reject(err);
                });
            });

            req.on('error', (err) => {
                reject(err);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (this.downloads[id]) {
                this.downloads[id].activeRequests.push(req);
            }
        });
    }

    /**
     * Fetch manifest text
     */
    fetchText(url, options) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const reqLib = parsedUrl.protocol === 'https:' ? https : http;

            const headers = {
                'User-Agent': options.userAgent || 'Mozilla/5.0',
                'Accept': 'text/html,*/*'
            };
            if (options.cookie) headers['Cookie'] = options.cookie;
            if (options.referrer) headers['Referer'] = options.referrer;

            const req = reqLib.get(url, { headers, timeout: 10000 }, (res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Failed to fetch manifest: status ${res.statusCode}`));
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Manifest timeout'));
            });
        });
    }

    /**
     * Resolve relative URL
     */
    resolveUrl(baseUrl, relativeUrl) {
        if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
            return relativeUrl;
        }
        const base = new URL(baseUrl);
        if (relativeUrl.startsWith('/')) {
            return base.origin + relativeUrl;
        }
        const pathname = base.pathname;
        const lastSlash = pathname.lastIndexOf('/');
        const basePath = pathname.substring(0, lastSlash + 1);
        return base.origin + basePath + relativeUrl;
    }

    /**
     * Cancel/Stop download
     */
    cancel(id) {
        const download = this.downloads[id];
        if (download) {
            this.logger.log(`[HLS-DL] [${id}] 🛑 HLS download cancel requested`);
            download.isCancelled = true;

            for (let req of download.activeRequests) {
                try { req.destroy(); } catch (e) {}
            }

            setTimeout(() => {
                try {
                    if (fs.existsSync(download.finalFilePath)) {
                        fs.unlinkSync(download.finalFilePath);
                    }
                    this.cleanTempDir(download.tempDir);
                } catch (e) {}
            }, 1000);

            delete this.downloads[id];
            this.emit('error', { id, error: 'Download cancelled by user' });
        }
    }

    /**
     * Clean temp dir
     */
    cleanTempDir(dirPath) {
        if (fs.existsSync(dirPath)) {
            try {
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    fs.unlinkSync(path.join(dirPath, file));
                }
                fs.rmdirSync(dirPath);
            } catch (e) {
                this.logger.log(`[HLS-DL] Failed to clean temp dir: ${e.message}`);
            }
        }
    }

    /**
     * Check if download exists
     */
    exists(id) {
        return !!this.downloads[id];
    }

    /**
     * Handle error
     */
    handleError(id, err) {
        const download = this.downloads[id];
        if (download && !download.isCancelled) {
            this.logger.log(`[HLS-DL] [${id}] ❌ HLS Download Error: ${err.message}`);
            this.emit('error', { id, error: err.message });
            this.cleanTempDir(download.tempDir);
            delete this.downloads[id];
        }
    }
}

module.exports = HlsDownloader;
