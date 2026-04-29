import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/lib/openai-config.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/lib/settings.ts', import.meta.url), 'utf8');

test('OpenAI base URL config supports both env variable names', () => {
    assert.match(settingsSource, /OPENAI_API_BASE_URL/);
    assert.match(settingsSource, /OPENAI_BASE_URL/);
});

test('OpenAI client config omits empty baseURL values', () => {
    assert.match(source, /trim\(\)/);
    assert.match(source, /baseURL \? \{ baseURL \} : \{\}/);
});
