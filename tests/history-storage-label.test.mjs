import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('history panel displays R2 storage entries with an uppercase R2 label', () => {
    const historyPanel = readFileSync(new URL('../src/components/history-panel.tsx', import.meta.url), 'utf8');

    assert.match(historyPanel, /originalStorageMode === 'r2'[\s\S]*\? 'R2'/);
});
