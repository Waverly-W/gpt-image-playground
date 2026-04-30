import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const loginPage = readFileSync(new URL('../src/app/login/page.tsx', import.meta.url), 'utf8');

test('login success performs a full document navigation so auth cookies are visible to server components', () => {
  assert.match(loginPage, /window\.location\.assign\(targetPath\)/);
  assert.doesNotMatch(loginPage, /router\.push\(data\.user\?\.role === 'admin'/);
});

test('login page handles empty error responses without surfacing JSON parse failures', () => {
  assert.match(loginPage, /await response\.text\(\)/);
  assert.match(loginPage, /bodyText \? JSON\.parse\(bodyText\) : \{\}/);
  assert.doesNotMatch(loginPage, /await response\.json\(\)/);
});
