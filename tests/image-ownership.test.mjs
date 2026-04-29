import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const dbPath = path.join(tmpdir(), `gpt-image-playground-image-ownership-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
process.env.SQLITE_DB_PATH = dbPath;
process.env.JWT_SECRET = 'test-secret-for-image-ownership-signing';

const db = await import('../src/lib/sqlite-db.ts');
const historyVisibility = await import('../src/lib/history-visibility.ts');
const imageOwnership = await import('../src/lib/image-ownership.ts');

const userA = { id: 'u_a', email: 'a@example.com', role: 'user' };
const userB = { id: 'u_b', email: 'b@example.com', role: 'user' };
const admin = { id: 'admin', email: 'admin@example.com', role: 'admin' };

test.after(() => {
  db.closeDbForTests?.();
  if (existsSync(dbPath)) rmSync(dbPath, { force: true });
});

test('recorded generated images are visible only to their owner and admins', () => {
  imageOwnership.recordImageOwner('owned-by-a.png', userA.id);

  assert.equal(imageOwnership.canAccessImage('owned-by-a.png', userA), true);
  assert.equal(imageOwnership.canAccessImage('owned-by-a.png', userB), false);
  assert.equal(imageOwnership.canAccessImage('owned-by-a.png', admin), true);
});

test('images without owner metadata are hidden from regular users but visible to admins', () => {
  assert.equal(imageOwnership.getImageOwner('legacy-without-owner.png'), null);
  assert.equal(imageOwnership.canAccessImage('legacy-without-owner.png', userA), false);
  assert.equal(imageOwnership.canAccessImage('legacy-without-owner.png', admin), true);
});

test('image history filtering keeps own entries for users and includes unowned entries only for admins', () => {
  const entries = [
    { timestamp: 1, ownerUserId: 'u_a', prompt: 'A' },
    { timestamp: 2, ownerUserId: 'u_b', prompt: 'B' },
    { timestamp: 3, prompt: 'legacy' }
  ];

  assert.deepEqual(historyVisibility.filterHistoryBySession(entries, userA).map((entry) => entry.prompt), ['A']);
  assert.deepEqual(historyVisibility.filterHistoryBySession(entries, userB).map((entry) => entry.prompt), ['B']);
  assert.deepEqual(historyVisibility.filterHistoryBySession(entries, admin).map((entry) => entry.prompt), ['A', 'B', 'legacy']);
});

test('deleting image ownership removes the access grant for regular users', () => {
  imageOwnership.recordImageOwner('delete-me.png', userA.id);
  assert.equal(imageOwnership.canAccessImage('delete-me.png', userA), true);

  imageOwnership.deleteImageOwnership('delete-me.png');

  assert.equal(imageOwnership.canAccessImage('delete-me.png', userA), false);
  assert.equal(imageOwnership.canAccessImage('delete-me.png', admin), true);
});
