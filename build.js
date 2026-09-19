/**
 * Build Script — neu build + Inno Setup compiler.
 * Automatically disables enableInspector for production build,
 * builds and packages browser extension zip files,
 * then restores inspector back to true for development.
 *
 * Usage: node build.js  (or: npm run build)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const configFile = 'neutralino.config.json';

function setInspector(enabled) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.modes.window.enableInspector = enabled;
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
}

function findISCC() {
    const candidates = [
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Inno Setup 6', 'ISCC.exe'),
        path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Inno Setup 6', 'ISCC.exe'),
        path.join(process.env['LOCALAPPDATA'] || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return `"${c}"`;
    }
    return 'iscc';
}

try {
    // 1. Disable inspector for production
    console.log('\n[1/4] Disabling enableInspector for production...');
    setInspector(false);

    // 2. Build and zip WXT extensions
    console.log('\n[2/4] Building and zipping WXT extensions (Chrome & Firefox)...');
    const wxtDir = path.join(__dirname, 'wxt');
    execSync('bun run zip', { cwd: wxtDir, stdio: 'inherit' });
    execSync('bun run zip:firefox', { cwd: wxtDir, stdio: 'inherit' });

    // Copy zip files to browser-extensions directory
    const browserExtDir = path.join(__dirname, 'browser-extensions');
    if (!fs.existsSync(browserExtDir)) fs.mkdirSync(browserExtDir, { recursive: true });

    // Clean older zips from browser-extensions
    for (const f of fs.readdirSync(browserExtDir)) {
        if (f.endsWith('.zip')) fs.unlinkSync(path.join(browserExtDir, f));
    }

    const wxtOutput = path.join(wxtDir, '.output');
    for (const f of fs.readdirSync(wxtOutput)) {
        if (f.endsWith('.zip')) {
            const src = path.join(wxtOutput, f);
            const dst = path.join(browserExtDir, f);
            fs.copyFileSync(src, dst);

            // Also provide friendly short aliases: chrome.zip & firefox.zip
            if (f.includes('chrome.zip')) {
                fs.copyFileSync(src, path.join(browserExtDir, 'chrome.zip'));
            } else if (f.includes('firefox.zip')) {
                fs.copyFileSync(src, path.join(browserExtDir, 'firefox.zip'));
            }
        }
    }
    console.log('✅ Extension zip packages prepared in ./browser-extensions');

    // 3. Run neu build
    console.log('\n[3/4] Running neu build...\n');
    execSync('neu build', { stdio: 'inherit' });

    // 4. Run Inno Setup compiler
    console.log('\n[4/4] Compiling installer with Inno Setup...\n');
    const iscc = findISCC();
    console.log(`Using Inno Setup compiler: ${iscc}`);
    execSync(`${iscc} setup.iss`, { stdio: 'inherit' });

    console.log('\n🎉 Build and Installer generation complete! Check the Output/ folder.\n');
} catch (err) {
    console.error('\n❌ Build failed:', err.message);
    process.exit(1);
} finally {
    // Always restore inspector for development
    setInspector(true);
    console.log('Restored enableInspector to true for development.');
}
