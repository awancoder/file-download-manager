/**
 * Torrent UI Module
 * Handles torrent submenu, file import, and magnet link input
 * Depends on: showConfirmModal() from main.js
 */

let _torrentMenuEl = null;
let _torrentMagnetModal = null;
let _torrentMenuLoaded = false;
let _torrentMagnetLoaded = false;

// ── Submenu ──────────────────────────────────────────────

async function torrentToggleMenu(btnElement) {
    // Close if already open
    if (_torrentMenuEl && _torrentMenuEl.style.display !== 'none') {
        torrentCloseMenu();
        return;
    }

    // Lazy-load template on first use
    if (!_torrentMenuLoaded) {
        try {
            const resp = await fetch('/torrent/torrent-menu.html');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const html = await resp.text();

            _torrentMenuEl = document.createElement('div');
            _torrentMenuEl.id = 'torrentSubmenu';
            _torrentMenuEl.className = 'torrent-submenu';
            _torrentMenuEl.innerHTML = html;
            document.body.appendChild(_torrentMenuEl);
            _torrentMenuLoaded = true;
        } catch (err) {
            console.error('[TORRENT] Failed to load torrent-menu.html:', err);
            return;
        }
    }

    // Position below the button
    const rect = btnElement.getBoundingClientRect();
    _torrentMenuEl.style.top = (rect.bottom + 4) + 'px';
    _torrentMenuEl.style.left = rect.left + 'px';
    _torrentMenuEl.style.display = 'flex';

    // Close on outside click (one-time listener)
    setTimeout(() => {
        document.addEventListener('click', _torrentOutsideClick, { once: true });
    }, 0);
}

function _torrentOutsideClick(e) {
    if (_torrentMenuEl && !_torrentMenuEl.contains(e.target)) {
        torrentCloseMenu();
    }
}

function torrentCloseMenu() {
    if (_torrentMenuEl) _torrentMenuEl.style.display = 'none';
    document.removeEventListener('click', _torrentOutsideClick);
}

// ── Import .torrent File ─────────────────────────────────

function torrentImportFile() {
    torrentCloseMenu();
    document.getElementById('torrentFileInput').click();
}

async function handleTorrentFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.torrent')) {
        Neutralino.os.showMessageBox('Invalid File', 'Please select a valid .torrent file', 'OK', 'ERROR');
        event.target.value = '';
        return;
    }

    try {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileData = e.target.result; // data URL

            showConfirmModal({
                url: fileData,
                filename: file.name,
                isTorrentFile: true,
                torrentFileName: file.name
            });
            event.target.value = '';
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('Error reading torrent file:', err);
        Neutralino.os.showMessageBox('Error', 'Failed to read torrent file: ' + err.message, 'OK', 'ERROR');
        event.target.value = '';
    }
}

// ── Magnet Link Modal ────────────────────────────────────

async function torrentShowMagnetInput() {
    torrentCloseMenu();

    // Lazy-load template
    if (!_torrentMagnetLoaded) {
        try {
            const resp = await fetch('/torrent/torrent-magnet.html');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const html = await resp.text();

            _torrentMagnetModal = document.createElement('div');
            _torrentMagnetModal.id = 'magnetModal';
            _torrentMagnetModal.className = 'modal-overlay';
            _torrentMagnetModal.innerHTML = html;
            document.body.appendChild(_torrentMagnetModal);
            _torrentMagnetLoaded = true;
        } catch (err) {
            console.error('[TORRENT] Failed to load torrent-magnet.html:', err);
            return;
        }
    }

    // Reset and show
    const input = document.getElementById('magnetLinkInput');
    if (input) input.value = '';
    _torrentMagnetModal.style.display = 'flex';

    // Auto-paste from clipboard if it looks like a magnet
    try {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim().toLowerCase().startsWith('magnet:')) {
            if (input) input.value = clip.trim();
        }
    } catch (e) { /* clipboard permission denied, ignore */ }
}

function torrentCloseMagnetModal() {
    if (_torrentMagnetModal) _torrentMagnetModal.style.display = 'none';
}

function torrentSubmitMagnet() {
    const input = document.getElementById('magnetLinkInput');
    const magnetUri = (input ? input.value : '').trim();

    if (!magnetUri) return;

    // Validate magnet link format
    if (!magnetUri.toLowerCase().startsWith('magnet:')) {
        Neutralino.os.showMessageBox('Invalid Magnet', 'Please enter a valid magnet link starting with magnet:', 'OK', 'ERROR');
        return;
    }

    torrentCloseMagnetModal();

    // Extract display name from magnet (dn= parameter)
    let displayName = '';
    try {
        const dnMatch = magnetUri.match(/[?&]dn=([^&]+)/i);
        if (dnMatch) displayName = decodeURIComponent(dnMatch[1]);
    } catch (e) { }

    showConfirmModal({
        url: magnetUri,
        filename: displayName || '',
        isTorrentFile: false
    });
}

// ── Helper ───────────────────────────────────────────────

function isTorrentUrl(url) {
    if (!url) return false;
    return url.toLowerCase().startsWith('magnet:') || url.toLowerCase().endsWith('.torrent');
}
