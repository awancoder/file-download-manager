/**
 * Build Script — neu build + Inno Setup compiler.
 * Automatically disables enableInspector for production build,
 * then restores it back to true for development.
 *
 * Usage: node build.js  (or: npm run build)
 */

const fs = require('fs');
const { execSync } = require('child_process');

const configFile = 'neutralino.config.json';

function setInspector(enabled) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.modes.window.enableInspector = enabled;
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
}

try {
    // 1. Disable inspector for production
    console.log('\n[1/3] Disabling enableInspector for production...');
    setInspector(false);

    // 2. Run neu build
    console.log('[2/3] Running neu build...\n');
    execSync('neu build', { stdio: 'inherit' });

    // 3. Run Inno Setup compiler
    console.log('\n[3/3] Compiling installer with Inno Setup...\n');
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
