import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (relativePath) => readFileSync(new URL(relativePath, root), 'utf8');

test('legacy APP_PASSWORD client flow is removed from playground UI', () => {
  const playground = read('src/app/playground-client.tsx');
  const generationForm = read('src/components/generation-form.tsx');
  const editingForm = read('src/components/editing-form.tsx');
  const imageDeleteRoute = read('src/app/api/image-delete/route.ts');

  for (const source of [playground, generationForm, editingForm, imageDeleteRoute]) {
    assert.equal(source.includes('PasswordDialog'), false);
    assert.equal(source.includes('clientPasswordHash'), false);
    assert.equal(source.includes('isPasswordRequiredByBackend'), false);
    assert.equal(source.includes('onOpenPasswordDialog'), false);
    assert.equal(source.includes('passwordHash'), false);
  }

  assert.equal(playground.includes('sha256Client'), false);
  assert.equal(playground.includes('localStorage.getItem(\'clientPasswordHash\')'), false);
});

test('admin page exposes a richer dashboard layout instead of raw row editing only', () => {
  const adminPage = read('src/app/admin/page.tsx');

  assert.match(adminPage, /const activeUsers/);
  assert.match(adminPage, /const disabledUsers/);
  assert.match(adminPage, /仪表盘/);
  assert.match(adminPage, /用户总数/);
  assert.match(adminPage, /活跃用户/);
  assert.match(adminPage, /已禁用/);
  assert.match(adminPage, /最近更新/);
  assert.match(adminPage, /启用注册|暂停注册/);
  assert.match(adminPage, /重置密码/);
});

test('playground uses task queue instead of fixed output preview history layout', () => {
  const playground = read('src/app/playground-client.tsx');
  const taskQueue = read('src/components/task-queue-panel.tsx');

  assert.equal(playground.includes("import { ImageOutput }"), false);
  assert.equal(playground.includes("import { HistoryPanel }"), false);
  assert.match(playground, /TaskQueuePanel/);
  assert.match(taskQueue, /任务队列/);
  assert.match(taskQueue, /查看大图/);
  assert.match(taskQueue, /生成中|排队中|已完成|失败/);
});

test('playground places task queue on the right and image viewer supports zoom', () => {
  const playground = read('src/app/playground-client.tsx');
  const taskQueue = read('src/components/task-queue-panel.tsx');

  assert.ok(playground.indexOf("data-panel='form'") < playground.indexOf("data-panel='task-queue'"));
  assert.match(taskQueue, /useState\(1\)/);
  assert.match(taskQueue, /放大/);
  assert.match(taskQueue, /缩小/);
  assert.match(taskQueue, /重置/);
  assert.match(taskQueue, /max-w-\[96vw\]/);
});

test('task queue shows an R2 badge for R2-backed image jobs', () => {
  const taskQueue = read('src/components/task-queue-panel.tsx');

  assert.match(taskQueue, /storageModeUsed === 'r2'/);
  assert.match(taskQueue, /R2/);
});
