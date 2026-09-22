import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, beforeEach, after } from 'node:test';

const testDbPath = path.join(tmpdir(), `gpt-image-playground-models-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
process.env.SQLITE_DB_PATH = testDbPath;

const {
    listAllModels,
    listEnabledModels,
    getDefaultModel,
    getModelById,
    createModel,
    updateModel,
    deleteModel,
    resetModelsToDefault,
    isBuiltinModel
} = await import('../src/lib/models.ts');
const { closeDbForTests } = await import('../src/lib/sqlite-db.ts');

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

test('initializes with 4 built-in models and gpt-image-2 as default', () => {
    const all = listAllModels();
    assert.equal(all.length, 4);

    const defaultModel = getDefaultModel();
    assert.ok(defaultModel);
    assert.equal(defaultModel?.id, 'gpt-image-2');
    assert.equal(defaultModel?.isDefault, true);

    const ids = all.map((m) => m.id);
    assert.deepEqual(ids, ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini']);
});

test('supports creating a new custom model', () => {
    const custom = createModel({
        id: 'gpt-image-hd',
        name: 'GPT Image HD',
        description: '高精生图模型',
        sortOrder: 10
    });

    assert.equal(custom.id, 'gpt-image-hd');
    assert.equal(custom.name, 'GPT Image HD');
    assert.equal(custom.enabled, true);
    assert.equal(custom.isDefault, false);

    const all = listAllModels();
    assert.equal(all.length, 5);
});

test('updating model name, description, and status', () => {
    const updated = updateModel('gpt-image-1.5', {
        name: 'GPT-Image 1.5 Turbo',
        description: '加速版本',
        enabled: false
    });

    assert.equal(updated.name, 'GPT-Image 1.5 Turbo');
    assert.equal(updated.description, '加速版本');
    assert.equal(updated.enabled, false);

    const enabledList = listEnabledModels();
    assert.equal(enabledList.some((m) => m.id === 'gpt-image-1.5'), false);
});

test('setting a model as default automatically clears previous default', () => {
    const updated = updateModel('gpt-image-1.5', { isDefault: true });
    assert.equal(updated.isDefault, true);

    const prevDefault = getModelById('gpt-image-2');
    assert.equal(prevDefault?.isDefault, false);

    const currentDefault = getDefaultModel();
    assert.equal(currentDefault?.id, 'gpt-image-1.5');
});

test('prevents deleting built-in models', () => {
    assert.throws(() => {
        deleteModel('gpt-image-2');
    }, /内置核心模型不可删除/);
});

test('supports deleting custom models', () => {
    createModel({ id: 'custom-model', name: 'Custom' });
    assert.ok(getModelById('custom-model'));

    const deleted = deleteModel('custom-model');
    assert.equal(deleted, true);
    assert.equal(getModelById('custom-model'), null);
});

test('prevents disabling default model without reassigning default', () => {
    assert.throws(() => {
        updateModel('gpt-image-2', { enabled: false });
    }, /默认模型不可直接禁用/);
});

test('prevents disabling all models', () => {
    updateModel('gpt-image-1', { enabled: false });
    updateModel('gpt-image-1-mini', { enabled: false });
    updateModel('gpt-image-1.5', { isDefault: true });
    updateModel('gpt-image-2', { enabled: false });

    assert.throws(() => {
        updateModel('gpt-image-1.5', { enabled: false, isDefault: false });
    }, /系统中必须保留至少一个已启用的模型/);
});

test('supports creating a model with slash in id like ag/gemini-3.1-flash-image', () => {
    const slashModel = createModel({
        id: 'ag/gemini-3.1-flash-image',
        name: 'Gemini 3.1 Flash Image',
        description: 'Google Gemini 图像模型',
        sortOrder: 20
    });

    assert.equal(slashModel.id, 'ag/gemini-3.1-flash-image');
    assert.equal(slashModel.name, 'Gemini 3.1 Flash Image');

    const fetched = getModelById('ag/gemini-3.1-flash-image');
    assert.ok(fetched);
    assert.equal(fetched.id, 'ag/gemini-3.1-flash-image');

    const updated = updateModel('ag/gemini-3.1-flash-image', { name: 'Gemini 3.1 Flash Updated' });
    assert.equal(updated.name, 'Gemini 3.1 Flash Updated');

    const deleted = deleteModel('ag/gemini-3.1-flash-image');
    assert.equal(deleted, true);
});
