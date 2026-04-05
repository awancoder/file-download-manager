// App Stats Module - lazy loads app-stats.html and handles app-stats event
let appStatsLoaded = false;

async function appStatsInit() {
    if (appStatsLoaded) return;
    const container = document.getElementById('appStatsContainer');
    if (!container) return;
    try {
        const resp = await fetch('/app-stats/app-stats.html');
        if (resp.ok) {
            container.innerHTML = await resp.text();
            appStatsLoaded = true;
        }
    } catch (e) {
        console.error('Failed to load app-stats template:', e);
    }
}

function appStatsUpdate(cpu, ram, netDown, netUp) {
    const cpuEl = document.getElementById('statCpu');
    const ramEl = document.getElementById('statRam');
    const netDownEl = document.getElementById('statNetDown');
    const netUpEl = document.getElementById('statNetUp');
    if (cpuEl) cpuEl.textContent = cpu + '%';
    if (ramEl) ramEl.textContent = ram + ' MB';
    if (netDownEl) netDownEl.textContent = formatBytes(netDown) + '/s';
    if (netUpEl) netUpEl.textContent = formatBytes(netUp) + '/s';
}
