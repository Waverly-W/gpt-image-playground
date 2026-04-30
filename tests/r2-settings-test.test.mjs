import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('r2 config can be resolved from unsaved runtime settings', async () => {
    const storage = await import(`../src/lib/image-storage.ts?case=unsaved-${Date.now()}`);

    assert.deepEqual(
        storage.getR2ConfigFromRuntimeConfig({
            openaiApiKey: '',
            openaiBaseUrl: '',
            imageStorageMode: 'r2',
            r2AccountId: 'settings-account',
            r2AccessKeyId: 'settings-access',
            r2SecretAccessKey: 'settings-secret',
            r2Bucket: 'settings-bucket',
            r2Endpoint: '',
            authCookieSecure: 'auto',
            registrationEnabled: true
        }),
        {
            accountId: 'settings-account',
            accessKeyId: 'settings-access',
            secretAccessKey: 'settings-secret',
            bucket: 'settings-bucket',
            endpoint: 'https://settings-account.r2.cloudflarestorage.com'
        }
    );
});

test('admin runtime settings include an r2 connection test action', () => {
    const adminPageSource = readFileSync(new URL('../src/app/admin/page.tsx', import.meta.url), 'utf8');

    assert.match(adminPageSource, /测试 R2 连接/);
    assert.match(adminPageSource, /\/api\/admin\/settings\/r2-test/);
});
