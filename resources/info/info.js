/**
 * Info Module - Icon & Symbol Reference Guide
 * Loads info.html template and manages the info modal
 */

let _infoModalLoaded = false;

async function showInfoModal() {
    // If already loaded, just show it
    const existing = document.getElementById('infoModal');
    if (existing) {
        existing.style.display = 'flex';
        return;
    }

    // Fetch the HTML template
    try {
        const response = await fetch('/info/info.html');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();

        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'infoModal';
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = html;

        document.body.appendChild(modal);
        _infoModalLoaded = true;
    } catch (err) {
        console.error('[INFO] Failed to load info.html:', err);
    }
}

function closeInfoModal() {
    const modal = document.getElementById('infoModal');
    if (modal) modal.style.display = 'none';
}
