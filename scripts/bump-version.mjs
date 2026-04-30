import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function nextPatchVersion(version) {
    const parts = version.split('.').map((part) => Number.parseInt(part, 10));

    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
        throw new Error(`Expected a semantic version like 1.2.3, got ${version}`);
    }

    parts[2] += 1;
    return parts.join('.');
}

export function bumpPackageVersion(rootDir = process.cwd()) {
    const packagePath = path.join(rootDir, 'package.json');
    const lockPath = path.join(rootDir, 'package-lock.json');
    const packageJson = readJson(packagePath);
    const nextVersion = nextPatchVersion(packageJson.version);

    packageJson.version = nextVersion;
    writeJson(packagePath, packageJson);

    if (existsSync(lockPath)) {
        const packageLockJson = readJson(lockPath);
        packageLockJson.version = nextVersion;

        if (packageLockJson.packages?.['']) {
            packageLockJson.packages[''].version = nextVersion;
        }

        writeJson(lockPath, packageLockJson);
    }

    return nextVersion;
}

function stageVersionFiles(rootDir) {
    execFileSync('git', ['add', 'package.json', 'package-lock.json'], {
        cwd: rootDir,
        stdio: 'inherit'
    });
}

if (process.argv[1] === scriptPath) {
    const rootDir = process.cwd();
    const nextVersion = bumpPackageVersion(rootDir);
    stageVersionFiles(rootDir);
    console.log(`Bumped app version to ${nextVersion}`);
}
