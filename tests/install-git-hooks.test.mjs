import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');

test('install git hooks script skips when not running in a git repository', () => {
    const fixtureDir = path.join(
        tmpdir(),
        `gpt-image-playground-hooks-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    mkdirSync(fixtureDir, { recursive: true });

    try {
        const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts/install-git-hooks.mjs')], {
            cwd: fixtureDir,
            encoding: 'utf8'
        });

        assert.equal(result.status, 0);
        assert.doesNotMatch(result.stderr, /fatal: not a git repository/);
    } finally {
        rmSync(fixtureDir, { recursive: true, force: true });
    }
});
