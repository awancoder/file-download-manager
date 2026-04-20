/**
 * dns-config.js
 * DNS-over-HTTPS (DoH) resolver.
 * Exposes resolveHostname() for pre-resolving before http.request().
 */
const https = require('https');
const dns   = require('dns');

const DOH_ENDPOINTS = {
    '8.8.8.8':         { ip: '8.8.8.8',         sni: 'dns.google',         path: '/resolve' },
    '8.8.4.4':         { ip: '8.8.4.4',         sni: 'dns.google',         path: '/resolve' },
    '1.1.1.1':         { ip: '1.1.1.1',         sni: 'cloudflare-dns.com', path: '/dns-query' },
    '1.0.0.1':         { ip: '1.0.0.1',         sni: 'cloudflare-dns.com', path: '/dns-query' },
    '1.1.1.2':         { ip: '1.1.1.2',         sni: 'cloudflare-dns.com', path: '/dns-query' },
    '1.0.0.2':         { ip: '1.0.0.2',         sni: 'cloudflare-dns.com', path: '/dns-query' },
    '9.9.9.9':         { ip: '9.9.9.9',         sni: 'dns.quad9.net',      path: '/dns-query' },
    '149.112.112.112': { ip: '149.112.112.112', sni: 'dns.quad9.net',      path: '/dns-query' },
};

let _primaryIp   = null;
let _secondaryIp = null;
let _active      = false;

function setDnsServers(servers) {
    _primaryIp   = null;
    _secondaryIp = null;
    _active      = false;

    if (!servers || typeof servers !== 'object') return;

    const p = (typeof servers.primary   === 'string') ? servers.primary.trim()   : '';
    const s = (typeof servers.secondary === 'string') ? servers.secondary.trim() : '';

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(p)) {
        _primaryIp   = p;
        _secondaryIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(s) ? s : p;
        _active      = true;
        console.log('[dns-config] Active. Primary:', _primaryIp, 'Secondary:', _secondaryIp);
    }
}

/** true when custom DNS is configured */
function isActive() { return _active; }

/**
 * Resolve hostname via DoH then regular DNS fallback.
 * Returns Promise<string> (IPv4 address).
 */
function resolveHostname(hostname) {
    return new Promise((resolve, reject) => {
        if (!_active || !_primaryIp) {
            return reject(new Error('Custom DNS not active'));
        }

        // Already an IP, no resolution needed
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
            return resolve(hostname);
        }

        const primaryEndpoint   = DOH_ENDPOINTS[_primaryIp];
        const secondaryEndpoint = _secondaryIp ? DOH_ENDPOINTS[_secondaryIp] : null;

        if (primaryEndpoint) {
            // Use DoH for known providers
            _dohQuery(primaryEndpoint, hostname, (err, ip) => {
                if (!err && ip) {
                    console.log('[DoH]', hostname, '→', ip, 'via', _primaryIp);
                    return resolve(ip);
                }
                // Try secondary
                if (secondaryEndpoint && secondaryEndpoint.ip !== primaryEndpoint.ip) {
                    _dohQuery(secondaryEndpoint, hostname, (err2, ip2) => {
                        if (!err2 && ip2) {
                            console.log('[DoH-2]', hostname, '→', ip2, 'via', _secondaryIp);
                            return resolve(ip2);
                        }
                        reject(new Error('DoH failed for ' + hostname + ': ' + (err2 || err || new Error('unknown')).message));
                    });
                } else {
                    reject(new Error('DoH failed for ' + hostname + ': ' + (err || new Error('unknown')).message));
                }
            });
        } else {
            // Unknown provider IP → use dns.Resolver (UDP)
            try {
                const resolver = new dns.Resolver();
                resolver.setServers([_primaryIp, _secondaryIp].filter(Boolean));
                resolver.resolve4(hostname, (err, addrs) => {
                    if (!err && addrs && addrs.length && addrs[0]) {
                        console.log('[dns.Resolver]', hostname, '→', addrs[0], 'via', _primaryIp);
                        resolve(addrs[0]);
                    } else {
                        reject(new Error('Resolver failed for ' + hostname));
                    }
                });
            } catch (e) {
                reject(e);
            }
        }
    });
}

/** Internal: single DoH query */
function _dohQuery(endpoint, hostname, cb) {
    const qs = `?name=${encodeURIComponent(hostname)}&type=A`;
    let done = false;
    const finish = (err, addr) => {
        if (done) return;
        done = true;
        cb(err, addr);
    };

    const req = https.request({
        hostname:           endpoint.ip,
        servername:         endpoint.sni,
        path:               endpoint.path + qs,
        method:             'GET',
        headers:            { 'Accept': 'application/dns-json' },
        timeout:            8000,
        rejectUnauthorized: true
    }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
            try {
                const j = JSON.parse(body);
                if (j.Status !== 0) return finish(new Error('RCODE ' + j.Status), null);
                const a = (j.Answer || []).filter(r => r.type === 1 && r.data);
                if (!a.length) return finish(new Error('No A records'), null);
                finish(null, a[0].data);
            } catch (e) { finish(e, null); }
        });
    });
    req.on('error', e => finish(e, null));
    req.on('timeout', () => { req.destroy(); finish(new Error('DoH timeout'), null); });
    req.end();
}

module.exports = { setDnsServers, isActive, resolveHostname };
