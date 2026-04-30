import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

let hooksDir;
try {
    hooksDir = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
} catch {
    console.log('Skipping git hook installation because this is not a git repository.');
    process.exit(0);
}
const preCommitPath = path.join(hooksDir, 'pre-commit');
const hook = `#!/bin/sh
node scripts/bump-version.mjs
`;

mkdirSync(hooksDir, { recursive: true });
writeFileSync(preCommitPath, hook, { mode: 0o755 });
chmodSync(preCommitPath, 0o755);
