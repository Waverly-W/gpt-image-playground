import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, beforeEach, after } from 'node:test';

const testDbPath = path.join(tmpdir(), `gpt-image-playground-models-api-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
process.env.SQLITE_DB_PATH = testDbPath;

const { GET: publicGetModels } = await import('../src/app/api/models/route.ts');
const { resetModelsToDefault } = await import('../src/lib/models.ts');
const { closeDbForTests } = await import('../src/lib/sqlite-db.ts');

const root = new URL('../', import.meta.url);
const read = (relativePath) => readFileSync(new URL(relativePath, root), 'utf8');

beforeEach(() => {
    resetModelsToDefault();
});

after(() => {
    closeDbForTests();
    if (existsSync(testDbPath)) {
        try {
            rmSync(testDbPath, { force: true });
        } catch {
            // ignore
        }
    }
});

test('admin models routes enforce admin permission', () => {
    const listRoute = read('src/app/api/admin/models/route.ts');
    const itemRoute = read('src/app/api/admin/models/[...id]/route.ts');
    const resetRoute = read('src/app/api/admin/models/reset/route.ts');

    assert.match(listRoute, /requireAdmin\(\)/);
    assert.match(listRoute, /authErrorResponse/);
    assert.match(itemRoute, /requireAdmin\(\)/);
    assert.match(itemRoute, /authErrorResponse/);
    assert.match(resetRoute, /requireAdmin\(\)/);
    assert.match(resetRoute, /authErrorResponse/);
});

test('admin models routes provide full CRUD operations including catch-all path for slash IDs', () => {
    const listRoute = read('src/app/api/admin/models/route.ts');
    const itemRoute = read('src/app/api/admin/models/[...id]/route.ts');
    const resetRoute = read('src/app/api/admin/models/reset/route.ts');

    assert.match(listRoute, /export async function GET/);
    assert.match(listRoute, /export async function POST/);
    assert.match(itemRoute, /export async function GET/);
    assert.match(itemRoute, /export async function PATCH/);
    assert.match(itemRoute, /export async function DELETE/);
    assert.match(itemRoute, /resolveModelId/);
    assert.match(resetRoute, /export async function POST/);
});

test('public models GET returns enabled models and default model', async () => {
    const res = await publicGetModels();
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.models));
    assert.equal(data.defaultModel?.id, 'gpt-image-2');
});
