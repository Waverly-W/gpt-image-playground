import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const hooksDir = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
    cwd: process.cwd(),
    encoding: 'utf8'
}).trim();
const preCommitPath = path.join(hooksDir, 'pre-commit');
const hook = `#!/bin/sh
node scripts/bump-version.mjs
`;

mkdirSync(hooksDir, { recursive: true });
writeFileSync(preCommitPath, hook, { mode: 0o755 });
chmodSync(preCommitPath, 0o755);
