import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');

test('root layout renders a fixed app version badge from package metadata', () => {
    const layoutSource = readFileSync(path.join(rootDir, 'src/app/layout.tsx'), 'utf8');

    assert.match(layoutSource, /version\s+as\s+appVersion/);
    assert.match(layoutSource, /from\s+['"]\.\.\/\.\.\/package\.json['"]/);
    assert.match(layoutSource, /data-testid=['"]app-version-badge['"]/);
    assert.match(layoutSource, /fixed\s+right-3\s+bottom-3/);
});

test('commit version script increments and stages package metadata', async () => {
    const { bumpPackageVersion } = await import('../scripts/bump-version.mjs');
    const fixtureDir = path.join(
        tmpdir(),
        `gpt-image-playground-version-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    mkdirSync(fixtureDir, { recursive: true });

    try {
        writeFileSync(
            path.join(fixtureDir, 'package.json'),
            `${JSON.stringify({ name: 'fixture', version: '1.2.3' }, null, 2)}\n`
        );
        writeFileSync(
            path.join(fixtureDir, 'package-lock.json'),
            `${JSON.stringify(
                {
                    name: 'fixture',
                    version: '1.2.3',
                    packages: {
                        '': {
                            name: 'fixture',
                            version: '1.2.3'
                        },
                        'node_modules/example': {
                            version: '9.9.9'
                        }
                    }
                },
                null,
                2
            )}\n`
        );

        const nextVersion = bumpPackageVersion(fixtureDir);
        const packageJson = JSON.parse(readFileSync(path.join(fixtureDir, 'package.json'), 'utf8'));
        const packageLockJson = JSON.parse(readFileSync(path.join(fixtureDir, 'package-lock.json'), 'utf8'));

        assert.equal(nextVersion, '1.2.4');
        assert.equal(packageJson.version, '1.2.4');
        assert.equal(packageLockJson.version, '1.2.4');
        assert.equal(packageLockJson.packages[''].version, '1.2.4');
        assert.equal(packageLockJson.packages['node_modules/example'].version, '9.9.9');
    } finally {
        rmSync(fixtureDir, { recursive: true, force: true });
    }
});
