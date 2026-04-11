/**
 * About & Help Menu Module
 */

let _helpMenuEl = null;
let _aboutModal = null;
let _helpMenuLoaded = false;
let _aboutModalLoaded = false;

// ── Submenu ──────────────────────────────────────────────

async function helpToggleMenu(btnElement) {
    // Close if already open
    if (_helpMenuEl && _helpMenuEl.style.display !== 'none') {
        helpCloseMenu();
        return;
    }

    // Lazy-load template on first use
    if (!_helpMenuLoaded) {
        try {
            const resp = await fetch('/about/help-menu.html');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const html = await resp.text();

            _helpMenuEl = document.createElement('div');
            _helpMenuEl.id = 'helpSubmenu';
            _helpMenuEl.className = 'torrent-submenu'; // Reusing styling from torrent submenu
            _helpMenuEl.innerHTML = html;
            document.body.appendChild(_helpMenuEl);
            _helpMenuLoaded = true;
        } catch (err) {
            console.error('[HELP] Failed to load help-menu.html:', err);
            return;
        }
    }

    // Position below the button
    const rect = btnElement.getBoundingClientRect();
    _helpMenuEl.style.top = (rect.bottom + 4) + 'px';
    _helpMenuEl.style.left = (rect.left - 100) + 'px'; // Shift a bit to left if needed, or keep same
    _helpMenuEl.style.display = 'flex';

    // Ensure it doesn't go off-screen
    const menuRect = _helpMenuEl.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        _helpMenuEl.style.left = (window.innerWidth - menuRect.width - 10) + 'px';
    }

    // Close on outside click (one-time listener)
    setTimeout(() => {
        document.addEventListener('click', _helpOutsideClick, { once: true });
    }, 0);
}

function _helpOutsideClick(e) {
    if (_helpMenuEl && !_helpMenuEl.contains(e.target)) {
        helpCloseMenu();
    }
}

function helpCloseMenu() {
    if (_helpMenuEl) _helpMenuEl.style.display = 'none';
    document.removeEventListener('click', _helpOutsideClick);
}

// ── About Modal ──────────────────────────────────────────

async function showAboutModal() {
    helpCloseMenu();

    // Lazy-load template
    if (!_aboutModalLoaded) {
        try {
            const resp = await fetch('/about/about-modal.html');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const html = await resp.text();

            _aboutModal = document.createElement('div');
            _aboutModal.id = 'aboutModal';
            _aboutModal.className = 'modal-overlay';
            _aboutModal.innerHTML = html;
            document.body.appendChild(_aboutModal);

            const versionEl = document.getElementById('appVersionAbout');
            if (versionEl) {
                versionEl.innerText = window.NL_APPVERSION ? ('v' + window.NL_APPVERSION) : 'v1.0.0';
            }

            _aboutModalLoaded = true;
        } catch (err) {
            console.error('[HELP] Failed to load about-modal.html:', err);
            return;
        }
    }

    _aboutModal.style.display = 'flex';
}

function closeAboutModal() {
    if (_aboutModal) _aboutModal.style.display = 'none';
}
