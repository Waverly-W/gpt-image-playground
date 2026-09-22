import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const adminPage = readFileSync(new URL('src/app/admin/page.tsx', root), 'utf8');

test('admin page includes model management module and tab navigation', () => {
    assert.match(adminPage, /activeTab === 'models'/);
    assert.match(adminPage, /模型管理/);
    assert.match(adminPage, /模型总数/);
    assert.match(adminPage, /已启用/);
    assert.match(adminPage, /已停用/);
    assert.match(adminPage, /默认模型/);
    assert.match(adminPage, /\+ 添加自定义模型/);
    assert.match(adminPage, /恢复预设模型/);
});

test('admin page model card handles default, toggle and editing operations', () => {
    assert.match(adminPage, /function ModelCard/);
    assert.match(adminPage, /设为默认/);
    assert.match(adminPage, /启用该模型/);
    assert.match(adminPage, /handleUpdateModel/);
    assert.match(adminPage, /handleSetDefaultModel/);
    assert.match(adminPage, /handleDeleteModel/);
    assert.match(adminPage, /handleResetModels/);
});
