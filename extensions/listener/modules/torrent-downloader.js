/**
 * Torrent Downloader Module
 * Handles magnet links and .torrent files using WebTorrent
 * 
 * WebTorrent is a pure JavaScript torrent client - no external daemon needed!
 */

const EventEmitter = require('events');
const WebTorrent = require('webtorrent');
const fs = require('fs');
const path = require('path');
const os = require('os');

class TorrentDownloader extends EventEmitter {
    constructor(logger) {
        super();
        this.logger = logger;
        this.client = null;
        this.torrents = {}; // Map download ID to torrent object
        this.pausedState = {}; // Track paused state per download ID
        this.isInitialized = false;
        this.maxConns = 500; // Default, can be overridden via setMaxConns()
        
        this.initWebTorrent();
    }

    /**
     * Initialize WebTorrent client
     */
    initWebTorrent() {
        try {
            this.client = new WebTorrent({
                maxConns: this.maxConns, // Configurable via settings
                uploadLimit: -1,      // Unlimited upload (tit-for-tat needs this)
                downloadLimit: -1,    // Unlimited download
                torrentPort: 6881,    // Required by bittorrent-tracker
                dht: true,            // Enable DHT for peer discovery
                webSeeds: true        // Enable web seeds
            });

            // Public trackers for better peer discovery
            this.defaultTrackers = [
                'udp://tracker.opentrackr.org:1337/announce',
                'udp://open.stealth.si:80/announce',
                'udp://tracker.torrent.eu.org:451/announce',
                'udp://tracker.bittor.pw:1337/announce',
                'udp://public.popcorn-tracker.org:6969/announce',
                'udp://tracker.dler.org:6969/announce',
                'udp://exodus.desync.com:6969/announce',
                'udp://open.demonii.com:1337/announce',
                'udp://tracker.openbittorrent.com:6969/announce',
                'udp://tracker.moeking.me:6969/announce',
                'wss://tracker.openwebtorrent.com',
                'wss://tracker.btorrent.xyz',
                'wss://tracker.files.fm:7073/announce'
            ];

            this.client.on('error', (err) => {
                this.logger.log(`[TORRENT] ❌ WebTorrent error: ${err.message}`);
            });

            this.logger.log(`[TORRENT] ✅ WebTorrent client initialized (maxConns: ${this.maxConns})`);
            this.isInitialized = true;

        } catch (err) {
            this.logger.log(`[TORRENT] ❌ Failed to initialize WebTorrent: ${err.message}`);
            this.isInitialized = false;
        }
    }

    /**
     * Detects if URL is torrent (magnet or .torrent file)
     * @param {string} url - URL to check
     */
    static isTorrentUrl(url) {
        if (!url) return false;
        return url.toLowerCase().startsWith('magnet:') || 
               url.toLowerCase().endsWith('.torrent') ||
               url.startsWith('data:'); // Base64 torrent file
    }

    /**
     * Save base64/data URL torrent file to temp folder
     * @param {string} dataUrl - Data URL (data:application/octet-stream;base64,...)
     * @param {string} filename - Original filename
     * @returns {Buffer} Torrent file buffer
     */
    parseBase64TorrentFile(dataUrl, filename) {
        try {
            // Extract base64 data from data URL
            const base64Data = dataUrl.split(',')[1];
            if (!base64Data) {
                throw new Error('Invalid data URL format');
            }

            // Decode base64 to buffer
            const buffer = Buffer.from(base64Data, 'base64');
            this.logger.log(`[TORRENT] Parsed torrent file: ${filename} (${buffer.length} bytes)`);
            return buffer;

        } catch (err) {
            this.logger.log(`[TORRENT] ❌ Failed to parse base64 torrent file: ${err.message}`);
            throw err;
        }
    }

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Start torrent download
     * @param {string} id - Download ID
     * @param {string} url - Magnet link, .torrent URL, or data URL (base64)
     * @param {string} downloadPath - Destination folder
     * @param {string} filename - Preferred filename (optional for torrents)
     * @param {object} options - Additional options
     */
    start(id, url, downloadPath, filename, options = {}) {
        if (!this.isInitialized || !this.client) {
            const errorMsg = 'WebTorrent client not initialized';
            this.logger.log(`[TORRENT] [${id}] ❌ ${errorMsg}`);
            this.emit('error', { id, error: errorMsg });
            return;
        }

        this.logger.log(`[TORRENT] [${id}] 🚀 Starting torrent download`);
        this.logger.log(`[TORRENT] [${id}] Filename: ${filename || 'auto'}`);
        this.logger.log(`[TORRENT] [${id}] Folder: ${downloadPath}`);

        try {
            let torrentInput = url;

            // Check if URL is base64/data URL (torrent file uploaded)
            if (url && url.startsWith('data:')) {
                this.logger.log(`[TORRENT] [${id}] Detected base64 torrent file, parsing...`);
                try {
                    torrentInput = this.parseBase64TorrentFile(url, filename);
                } catch (err) {
                    this.logger.log(`[TORRENT] [${id}] ❌ Failed to parse torrent file: ${err.message}`);
                    this.emit('error', { id, error: 'Failed to parse torrent file: ' + err.message });
                    return;
                }
            }

            // Guard: check for duplicate torrent (same infoHash already active)
            if (typeof torrentInput === 'string' && torrentInput.startsWith('magnet:')) {
                try {
                    const hashMatch = torrentInput.match(/btih:([a-fA-F0-9]{40})/i) ||
                                      torrentInput.match(/btih:([a-zA-Z2-7]{32})/i);
                    if (hashMatch) {
                        const existing = this.client.torrents.find(t => t.infoHash && 
                            t.infoHash.toLowerCase() === hashMatch[1].toLowerCase());
                        if (existing) {
                            this.logger.log(`[TORRENT] [${id}] ⚠️ Duplicate torrent detected (hash: ${hashMatch[1]})`);
                            this.emit('error', { id, error: 'This torrent is already being downloaded.' });
                            return;
                        }
                    }
                } catch (e) { /* ignore hash parse errors */ }
            }

            // Add torrent to WebTorrent client with extra trackers
            const torrent = this.client.add(torrentInput, {
                path: downloadPath,
                announce: this.defaultTrackers,  // Add public trackers for more peers
                maxWebConns: 10                   // Max WebRTC connections per web seed
            });

            // Store reference
            this.torrents[id] = torrent;
            this.pausedState[id] = false;
            let isCompleted = false; // Flag to stop progress after done

            // Timeout for metadata (30 seconds)
            const metadataTimeout = setTimeout(() => {
                if (!torrent.ready) {
                    this.logger.log(`[TORRENT] [${id}] ⚠️ Timeout waiting for metadata (30s)`);
                    this.emit('error', { id, error: 'Timeout: Could not fetch torrent metadata. Check if torrent is valid or has peers.' });
                    this.cancel(id);
                }
            }, 30000);

            // When torrent metadata is ready
            torrent.on('ready', () => {
                clearTimeout(metadataTimeout);
                
                const seeders = torrent.numPeers;
                const name = torrent.name;
                const totalSize = torrent.length;

                this.logger.log(`[TORRENT] [${id}] ✅ Torrent ready: ${name}`);
                this.logger.log(`[TORRENT] [${id}] 📊 Size: ${this.formatBytes(totalSize)}, Peers: ${seeders}`);

                // Emit started event with peer info
                this.emit('started', {
                    id,
                    torrentName: name,
                    hash: torrent.infoHash,
                    seeders: seeders,
                    leechers: 0, // WebTorrent doesn't distinguish
                    totalPeers: seeders,
                    totalSize: totalSize
                });
            });

            // Progress updates
            let lastProgressEmit = 0;
            torrent.on('download', () => {
                // Don't emit progress after completed or while paused
                if (isCompleted || this.pausedState[id]) return;
                
                // Throttle progress events to max once per 500ms
                const now = Date.now();
                if (now - lastProgressEmit < 500) return;
                lastProgressEmit = now;

                const progress = parseFloat((torrent.progress * 100).toFixed(2));
                const speed = torrent.downloadSpeed;
                const downloaded = torrent.downloaded;
                const total = torrent.length;
                const peers = torrent.numPeers;
                const eta = torrent.timeRemaining;

                this.emit('progress', {
                    id,
                    progress,
                    speed,
                    downloaded,
                    total,
                    peers,
                    eta
                });
            });

            // When download completes
            torrent.on('done', () => {
                isCompleted = true; // Stop progress events
                this.logger.log(`[TORRENT] [${id}] ✅ Download COMPLETED: ${torrent.name}`);
                
                // Get main file path
                let filePath = downloadPath;
                if (torrent.files && torrent.files.length > 0) {
                    filePath = torrent.files[0].path;
                }

                this.emit('complete', {
                    id,
                    filePath: path.join(downloadPath, torrent.name),
                    fileName: torrent.name
                });

                // Destroy immediately - don't seed
                if (this.torrents[id]) {
                    torrent.destroy({ destroyStore: false }, () => {
                        this.logger.log(`[TORRENT] [${id}] 🗑️ Torrent destroyed (no seeding)`);
                    });
                    delete this.torrents[id];
                    delete this.pausedState[id];
                } else {
                    // Fallback: destroy directly on the torrent object
                    try {
                        torrent.destroy({ destroyStore: false });
                        this.logger.log(`[TORRENT] [${id}] 🗑️ Torrent force-destroyed (no seeding)`);
                    } catch (e) { }
                }
            });

            // Error handling
            torrent.on('error', (err) => {
                this.logger.log(`[TORRENT] [${id}] ❌ Error: ${err.message}`);
                this.emit('error', { id, error: err.message });
                delete this.torrents[id];
                delete this.pausedState[id];
            });

            // Warning (non-fatal)
            torrent.on('warning', (warn) => {
                this.logger.log(`[TORRENT] [${id}] ⚠️ Warning: ${warn}`);
            });

            // Wire events (peer connections) - only log first 5 then summary
            let wireCount = 0;
            torrent.on('wire', (wire, addr) => {
                wireCount++;
                let shortName = torrent.name || filename || 'File_Tahap_Loading';
                if (shortName.endsWith('.torrent')) shortName = shortName.slice(0, -8);
                if (shortName.length > 150) shortName = shortName.substring(0, 150) + '...';
                
                if (wireCount <= 5) {
                    this.logger.log(`[TORRENT] [${id}] ("${shortName}") 🔗 Peer ${wireCount}: ${addr} (active: ${torrent.numPeers})`);
                } else if (wireCount % 20 === 0) {
                    this.logger.log(`[TORRENT] [${id}] ("${shortName}") 🔗 Total connections: ${wireCount}, Active peers: ${torrent.numPeers}`);
                }
            });

            // No peers warning after 30 seconds — cancel and notify
            setTimeout(() => {
                if (this.torrents[id] && torrent.numPeers === 0 && torrent.progress === 0) {
                    this.logger.log(`[TORRENT] [${id}] ⚠️ No peers found after 30 seconds, cancelling`);
                    this.emit('warning', { id, warning: 'No Peer' });
                    this.cancel(id);
                }
            }, 30000);

            // Remove 2-minute auto-cancel (already cancelled at 30s)
            setTimeout(() => {
                if (this.torrents[id] && torrent.numPeers === 0 && torrent.progress === 0) {
                    this.logger.log(`[TORRENT] [${id}] ❌ No peers after 2 minutes (already cancelled at 30s)`);
                }
            }, 120000);

        } catch (err) {
            this.logger.log(`[TORRENT] [${id}] ❌ Exception: ${err.message}`);
            this.emit('error', { id, error: err.message });
        }
    }

    /**
     * Pause torrent download
     * @param {string} id - Download ID
     */
    pause(id) {
        const torrent = this.torrents[id];
        if (!torrent) {
            this.logger.log(`[TORRENT] [${id}] ⚠️ Torrent not found for pause`);
            return false;
        }

        try {
            this.logger.log(`[TORRENT] [${id}] ⏸️ PAUSING...`);
            this.pausedState[id] = true;
            
            // 1. Set paused flag (prevents new peers)
            torrent.pause();
            
            // 2. Disconnect all active wires to fully stop data transfer
            const wireCount = torrent.wires ? torrent.wires.length : 0;
            this.logger.log(`[TORRENT] [${id}] Disconnecting ${wireCount} active wires...`);
            if (torrent.wires) {
                for (let i = torrent.wires.length - 1; i >= 0; i--) {
                    try { torrent.wires[i].destroy(); } catch (e) { }
                }
            }
            
            // 3. Deselect all pieces to stop any pending requests
            try {
                if (torrent.pieces && torrent.pieces.length > 0) {
                    torrent.deselect(0, torrent.pieces.length - 1, false);
                }
            } catch (e) {
                this.logger.log(`[TORRENT] [${id}] Deselect warning: ${e.message}`);
            }
            
            this.logger.log(`[TORRENT] [${id}] ✅ Paused successfully (wires: ${wireCount} disconnected)`);
            this.emit('paused', { id });
            return true;
        } catch (err) {
            this.logger.log(`[TORRENT] [${id}] ❌ Pause error: ${err.message}`);
            return false;
        }
    }

    /**
     * Resume torrent download
     * @param {string} id - Download ID
     */
    resume(id) {
        const torrent = this.torrents[id];
        if (!torrent) {
            this.logger.log(`[TORRENT] [${id}] ⚠️ Torrent not found for resume`);
            return false;
        }

        try {
            this.logger.log(`[TORRENT] [${id}] ▶️ RESUMING...`);
            this.pausedState[id] = false;
            
            // 1. Re-select all files to resume piece requests
            if (torrent.files && torrent.files.length > 0) {
                torrent.files.forEach(file => file.select());
            }
            
            // 2. Resume: set paused=false and trigger reconnection
            torrent.resume();
            
            // 3. Force re-discovery of peers
            try {
                if (torrent.discovery) {
                    const port = (torrent.client && torrent.client._port) || 6881;
                    torrent.discovery.updatePort(port);
                }
            } catch (e) {
                this.logger.log(`[TORRENT] [${id}] Discovery re-announce warning: ${e.message}`);
            }
            
            this.logger.log(`[TORRENT] [${id}] ✅ Resumed successfully`);
            this.emit('resumed', { id });
            return true;
        } catch (err) {
            this.logger.log(`[TORRENT] [${id}] ❌ Resume error: ${err.message}`);
            return false;
        }
    }

    /**
     * Cancel torrent download
     * @param {string} id - Download ID
     */
    cancel(id) {
        const torrent = this.torrents[id];
        if (!torrent) {
            this.logger.log(`[TORRENT] [${id}] ⚠️ Torrent not found for cancel`);
            return;
        }

        this.logger.log(`[TORRENT] [${id}] 🛑 CANCELLING...`);
        torrent.destroy({ destroyStore: false }); // Keep downloaded files
        delete this.torrents[id];
        delete this.pausedState[id];
    }

    /**
     * Check if torrent exists
     * @param {string} id - Download ID
     */
    exists(id) {
        return !!this.torrents[id];
    }

    /**
     * Get torrent info
     * @param {string} id - Download ID
     */
    getInfo(id) {
        const torrent = this.torrents[id];
        if (!torrent) return null;

        return {
            name: torrent.name,
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            numPeers: torrent.numPeers,
            downloaded: torrent.downloaded,
            length: torrent.length,
            timeRemaining: torrent.timeRemaining,
            infoHash: torrent.infoHash
        };
    }

    /**
     * Update max connections setting
     * Takes effect on the next torrent added
     * @param {number} maxConns
     */
    setMaxConns(maxConns) {
        this.maxConns = parseInt(maxConns) || 500;
        if (this.client) {
            this.client.maxConns = this.maxConns;
        }
        this.logger.log(`[TORRENT] ⚙️ maxConns updated to: ${this.maxConns}`);
    }

    /**
     * Shutdown - cleanup
     */
    shutdown() {
        if (this.client) {
            this.logger.log(`[TORRENT] Shutting down WebTorrent client...`);
            this.client.destroy(() => {
                this.logger.log(`[TORRENT] ✅ WebTorrent client destroyed`);
            });
        }
    }

    /**
     * Kill ALL torrents - including untracked ones from previous sessions
     */
    killAll() {
        let killed = 0;

        // 1. Destroy all tracked torrents
        for (const id of Object.keys(this.torrents)) {
            try {
                this.torrents[id].destroy({ destroyStore: false });
                this.logger.log(`[TORRENT] [KILLALL] Destroyed tracked torrent: ${id}`);
                killed++;
            } catch (e) { }
            delete this.torrents[id];
            delete this.pausedState[id];
        }

        // 2. Destroy ALL torrents in WebTorrent client (catches orphaned ones)
        if (this.client && this.client.torrents) {
            const orphans = [...this.client.torrents];
            for (const torrent of orphans) {
                try {
                    const hash = torrent.infoHash || 'unknown';
                    torrent.destroy({ destroyStore: false });
                    this.logger.log(`[TORRENT] [KILLALL] Destroyed client torrent (hash: ${hash})`);
                    killed++;
                } catch (e) { }
            }
        }

        this.torrents = {};
        this.pausedState = {};
        this.logger.log(`[TORRENT] [KILLALL] Total killed: ${killed}`);
        return killed;
    }
}

module.exports = TorrentDownloader;
