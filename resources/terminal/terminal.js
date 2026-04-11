/**
 * Integrated Terminal Modul
 * Used to stream the extension log file
 */

let _terminalInterval = null;
let _isTerminalOpen = false;

// Format text replacing newlines with HTML breaks
function formatLogText(text) {
    // If the text has basic terminal color formatting, we could parse it,
    // but for now, we just escape HTML and convert newlines.
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
}

// Fetch log file continuously
async function refreshTerminalLog() {
    const outputEl = document.getElementById('terminalOutput');
    if (!outputEl) return;

    try {
        let home = await Neutralino.os.getEnv(NL_OS === 'Windows' ? 'USERPROFILE' : 'HOME');
        if (!home) return;
        const logPath = home.replace(/\\/g, '/') + '/fdm-extension.log';

        // Check if file exists by getting stats
        let stats;
        try {
            stats = await Neutralino.filesystem.getStats(logPath);
        } catch (e) {
            outputEl.innerHTML = "<span style='color: #ef4444;'>[Terminal Info] Log file not found.</span>";
            return;
        }

        if (stats.size === 0) {
            outputEl.innerHTML = "<span style='color: #666;'>[Terminal Info] Log file is empty.</span>";
            return;
        }

        // Read file (Neutralino doesn't support reading partial tail directly, 
        // so we read everything and slice if it's too large)
        let rawContent = await Neutralino.filesystem.readFile(logPath);
        
        // Retain only the last 15,000 characters to prevent UI lag on huge logs
        const MAX_CHARS = 15000;
        if (rawContent.length > MAX_CHARS) {
            rawContent = "... [Log truncated for performance] ...\n" + rawContent.slice(-MAX_CHARS);
        }

        // Jangan render ulang DOM jika user sedang menyeleksi (highlight) teks,
        // karena mengubah innerHTML akan menghilangkan blok pemilihannya.
        const currentSel = window.getSelection();
        if (currentSel && currentSel.toString().length > 0) {
            return;
        }

        const isScrolledToBottom = outputEl.scrollHeight - outputEl.clientHeight <= outputEl.scrollTop + 20;

        outputEl.innerHTML = formatLogText(rawContent);

        if (isScrolledToBottom) {
            outputEl.scrollTop = outputEl.scrollHeight;
        }
    } catch (err) {
    }
}

function toggleTerminal() {
    const panel = document.getElementById('terminalPanel');
    if (!panel) return;

    _isTerminalOpen = !_isTerminalOpen;

    if (_isTerminalOpen) {
        panel.style.display = 'flex';
        refreshTerminalLog().then(() => {
            const outputEl = document.getElementById('terminalOutput');
            if(outputEl) outputEl.scrollTop = outputEl.scrollHeight;
        });
        
        if (_terminalInterval) clearInterval(_terminalInterval);
        _terminalInterval = setInterval(refreshTerminalLog, 1500);
    } else {
        panel.style.display = 'none';
        if (_terminalInterval) {
            clearInterval(_terminalInterval);
            _terminalInterval = null;
        }
    }
}

function clearTerminal() {
    const outputEl = document.getElementById('terminalOutput');
    if (outputEl) {
        outputEl.innerHTML = "<span style='color: #666;'>[Terminal Info] Output cleared visually. Real file still exists.</span>";
    }
}

// ── Resizer Logic ──
(function setupTerminalResizer() {
    const resizer = document.getElementById('terminalResizer');
    const panel = document.getElementById('terminalPanel');
    if (!resizer || !panel) {
        setTimeout(setupTerminalResizer, 100);
        return;
    }

    let isResizing = false;
    let startY, startHeight;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = parseInt(window.getComputedStyle(panel).height, 10);
        document.body.style.cursor = 'ns-resize';
        e.preventDefault(); 
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const diff = startY - e.clientY;
        const newHeight = Math.max(100, Math.min(startHeight + diff, window.innerHeight * 0.8));
        panel.style.height = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
        }
    });

    // ── Custom Terminal Context Menu (Copy Text) ──
    let _textToCopy = ""; // Menyimpan cache teks agar tidak hilang

    const customCtx = document.createElement('div');
    customCtx.id = "terminalCtxMenu";
    customCtx.style.position = "absolute";
    customCtx.style.display = "none";
    customCtx.style.background = "#2d2d2d";
    customCtx.style.border = "1px solid #404040";
    customCtx.style.padding = "4px 0";
    customCtx.style.zIndex = "9999";
    customCtx.style.color = "#e5e5e5";
    customCtx.style.fontFamily = "sans-serif";
    customCtx.style.fontSize = "0.85rem";
    customCtx.style.boxShadow = "0 4px 6px rgba(0,0,0,0.5)";
    customCtx.style.borderRadius = "4px";

    const copyBtn = document.createElement('div');
    copyBtn.innerText = "Copy Selection";
    copyBtn.style.padding = "6px 16px";
    copyBtn.style.cursor = "pointer";
    copyBtn.addEventListener('mouseenter', () => copyBtn.style.background = "#404040");
    copyBtn.addEventListener('mouseleave', () => copyBtn.style.background = "transparent");

    copyBtn.onclick = async () => {
        if (_textToCopy) {
            try {
                await navigator.clipboard.writeText(_textToCopy);
            } catch (err) {
                // Fallback sistem lawas jika API browser diblokir sistem lokal
                const textArea = document.createElement("textarea");
                textArea.value = _textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
            }
        }
        customCtx.style.display = "none";
        // Hapus seleksi setelah dicopy
        window.getSelection().removeAllRanges();
    };

    customCtx.appendChild(copyBtn);
    document.body.appendChild(customCtx);

    const termOut = document.getElementById('terminalOutput');
    if (termOut) {
        termOut.addEventListener('contextmenu', (e) => {
            e.preventDefault(); 
            let sel = window.getSelection().toString();
            
            customCtx.style.left = e.pageX + "px";
            customCtx.style.top = e.pageY + "px";
            customCtx.style.display = "block";
            
            if (!sel || sel.trim() === '') {
                copyBtn.style.opacity = "0.5";
                copyBtn.style.pointerEvents = "none";
                _textToCopy = ""; // kosongkan
            } else {
                copyBtn.style.opacity = "1";
                copyBtn.style.pointerEvents = "auto";
                _textToCopy = sel; // Kunci teks saat right-click
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target !== customCtx && e.target !== copyBtn) {
            customCtx.style.display = "none";
        }
    });

})();
