/**
 * Bump Version — Update versi di semua file sekaligus.
 *
 * Usage:
 *   node versioning.js <version>
 *
 * Example:
 *   node versioning.js 26.3.25
 */

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
    console.error('Usage: node versioning.js <version>');
    console.error('Example: node versioning.js 26.3.25');
    process.exit(1);
}

// Validasi format versi (angka dan titik saja)
if (!/^\d+(\.\d+)*$/.test(newVersion)) {
    console.error(`Invalid version format: "${newVersion}". Use format like 26.3.25`);
    process.exit(1);
}

const root = __dirname;
let updatedCount = 0;

function updateJsonFile(relPath, keys) {
    const filePath = path.join(root, relPath);
    if (!fs.existsSync(filePath)) {
        console.warn(`  SKIP: ${relPath} (not found)`);
        return;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(raw);

    for (const key of keys) {
        const parts = key.split('.');
        let target = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]];
        }
        const lastKey = parts[parts.length - 1];
        if (target[lastKey] !== undefined) {
            target[lastKey] = newVersion;
        }
    }

    // Preserve original indentation (detect from file)
    const indent = raw.match(/^(\s+)"/m)?.[1] || '  ';
    fs.writeFileSync(filePath, JSON.stringify(obj, null, indent) + '\n', 'utf8');
    console.log(`  OK: ${relPath} -> ${newVersion}`);
    updatedCount++;
}

function updateIssFile(relPath) {
    const filePath = path.join(root, relPath);
    if (!fs.existsSync(filePath)) {
        console.warn(`  SKIP: ${relPath} (not found)`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    const pattern = /(#define\s+MyAppVersion\s+")([^"]+)(")/;
    const match = content.match(pattern);
    if (!match) {
        console.warn(`  WARN: ${relPath} (MyAppVersion pattern not found)`);
        return;
    }
    if (match[2] === newVersion) {
        console.log(`  OK: ${relPath} -> ${newVersion} (already up to date)`);
        updatedCount++;
        return;
    }
    const replaced = content.replace(pattern, `$1${newVersion}$3`);
    fs.writeFileSync(filePath, replaced, 'utf8');
    console.log(`  OK: ${relPath} -> ${newVersion}`);
    updatedCount++;
}

console.log(`\nBumping version to: ${newVersion}\n`);

// 1. package.json
updateJsonFile('package.json', ['version']);

// 2. package-lock.json (has version in root + packages."")
const lockPath = path.join(root, 'package-lock.json');
if (fs.existsSync(lockPath)) {
    const raw = fs.readFileSync(lockPath, 'utf8');
    const obj = JSON.parse(raw);
    if (obj.version) obj.version = newVersion;
    if (obj.packages?.['']?.version) obj.packages[''].version = newVersion;
    const indent = raw.match(/^(\s+)"/m)?.[1] || '  ';
    fs.writeFileSync(lockPath, JSON.stringify(obj, null, indent) + '\n', 'utf8');
    console.log(`  OK: package-lock.json -> ${newVersion}`);
    updatedCount++;
}

// 3. neutralino.config.json
updateJsonFile('neutralino.config.json', ['version']);

// 4. setup.iss
updateIssFile('setup.iss');

// 5. chrome-extension/manifest.json
updateJsonFile('chrome-extension/manifest.json', ['version']);

console.log(`\nDone! Updated ${updatedCount} file(s).\n`);
