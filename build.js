/**
 * Build Script — neu build + Inno Setup compiler.
 * Automatically disables enableInspector for production build,
 * then restores it back to true for development.
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

try {
    // 1. Disable inspector for production
    console.log('\n[1/4] Disabling enableInspector for production...');
    setInspector(false);

    // 2. Build and zip WXT extensions
    console.log('\n[2/4] Building and zipping WXT extensions (Chrome & Firefox)...');
    const wxtDir = path.join(__dirname, 'wxt');
    execSync('bun run zip', { cwd: wxtDir, stdio: 'inherit' });
    execSync('bun run zip:firefox', { cwd: wxtDir, stdio: 'inherit' });

    // 3. Run neu build
    console.log('\n[3/4] Running neu build...\n');
    execSync('neu build', { stdio: 'inherit' });

    // 4. Run Inno Setup compiler
    console.log('\n[4/4] Compiling installer with Inno Setup...\n');
    const iscc = `"${process.env['ProgramFiles(x86)']}\\Inno Setup 6\\ISCC.exe"`;
    execSync(`${iscc} setup.iss`, { stdio: 'inherit' });

    console.log('\nBuild complete!\n');
} catch (err) {
    console.error('\nBuild failed:', err.message);
    process.exit(1);
} finally {
    // Always restore inspector for development
    setInspector(true);
    console.log('Restored enableInspector to true for development.');
}
