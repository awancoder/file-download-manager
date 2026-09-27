/**
 * FDM Dynamic Host Discovery Utility
 * Automatically locates the active backend port if 5050 is busy
 */

const DEFAULT_HOST = 'http://127.0.0.1:5050';
const PORT_START = 5050;
const PORT_END = 5070;

let cachedHost: string | null = null;
let lastCheckTime = 0;

/**
 * Ping an address to check if FDM backend is running on it
 */
export async function pingHost(host: string, timeoutMs = 800): Promise<boolean> {
  try {
    const res = await fetch(`${host}/api/ping`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data && data.status === 'running';
  } catch {
    return false;
  }
}

/**
 * Scan port range 5050-5070 to find the active FDM backend port
 */
async function scanPorts(): Promise<string | null> {
  // Check cached / stored port first
  try {
    const stored = await chrome.storage.local.get(['fdmActiveHost']);
    if (stored.fdmActiveHost && (await pingHost(stored.fdmActiveHost, 500))) {
      return stored.fdmActiveHost;
    }
  } catch {}

  // Ping preferred port 5050 first
  if (await pingHost(DEFAULT_HOST, 500)) {
    try { await chrome.storage.local.set({ fdmActiveHost: DEFAULT_HOST }); } catch {}
    return DEFAULT_HOST;
  }

  // Probe ports 5051 to 5070 in parallel
  const portPromises: Promise<string | null>[] = [];
  for (let port = PORT_START + 1; port <= PORT_END; port++) {
    const host = `http://127.0.0.1:${port}`;
    portPromises.push(
      pingHost(host, 700).then((ok) => (ok ? host : null))
    );
  }

  const results = await Promise.all(portPromises);
  const found = results.find((h) => h !== null);
  if (found) {
    try { await chrome.storage.local.set({ fdmActiveHost: found }); } catch {}
    return found;
  }

  return null;
}

/**
 * Get active FDM host (cached with quick revalidation)
 */
export async function getFdmHost(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedHost && (now - lastCheckTime < 10000)) {
    return cachedHost;
  }

  // If we have cached host, quickly check if it's still alive
  if (cachedHost && (await pingHost(cachedHost, 400))) {
    lastCheckTime = now;
    return cachedHost;
  }

  const found = await scanPorts();
  if (found) {
    cachedHost = found;
    lastCheckTime = now;
    return found;
  }

  // Fallback to default
  cachedHost = DEFAULT_HOST;
  lastCheckTime = now;
  return DEFAULT_HOST;
}

export async function isFdmRunning(): Promise<boolean> {
  const host = await getFdmHost(true);
  return await pingHost(host, 800);
}
