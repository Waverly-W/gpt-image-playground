import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.NODE_ENV = 'test';
const originalEnv = { ...process.env };

const dbPath = path.join(
    tmpdir(),
    `gpt-image-playground-runtime-settings-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
);
process.env.SQLITE_DB_PATH = dbPath;

const db = await import('../src/lib/sqlite-db.ts');
const settings = await import('../src/lib/settings.ts');
const openaiConfig = await import('../src/lib/openai-config.ts');
const imageStorage = await import('../src/lib/image-storage.ts');

test.after(() => {
    db.closeDbForTests?.();
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
    process.env = { ...originalEnv };
});

test('runtime config stores OpenAI settings in the database with env fallback', () => {
    process.env.OPENAI_API_KEY = 'env-key';
    process.env.OPENAI_API_BASE_URL = 'https://env.example/v1';

    assert.deepEqual(openaiConfig.getOpenAIConfig(), {
        apiKey: 'env-key',
        baseURL: 'https://env.example/v1'
    });

    settings.setRuntimeConfig({
        openaiApiKey: 'db-key',
        openaiBaseUrl: 'https://db.example/v1'
    });

    assert.deepEqual(openaiConfig.getOpenAIConfig(), {
        apiKey: 'db-key',
        baseURL: 'https://db.example/v1'
    });
});

test('runtime config stores image storage and R2 settings in the database with env fallback', () => {
    process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE = 'fs';
    process.env.CLOUDFLARE_R2_ACCOUNT_ID = 'env-account';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'env-access';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'env-secret';
    process.env.CLOUDFLARE_R2_BUCKET = 'env-bucket';

    settings.setRuntimeConfig({
        imageStorageMode: 'r2',
        r2AccountId: 'db-account',
        r2AccessKeyId: 'db-access',
        r2SecretAccessKey: 'db-secret',
        r2Bucket: 'db-bucket',
        r2Endpoint: 'https://custom.example'
    });

    assert.equal(imageStorage.resolveImageStorageMode(), 'r2');
    assert.deepEqual(imageStorage.getR2Config(), {
        accountId: 'db-account',
        accessKeyId: 'db-access',
        secretAccessKey: 'db-secret',
        bucket: 'db-bucket',
        endpoint: 'https://custom.example'
    });
});

test('registration setting is controlled by database before legacy env fallback', () => {
    process.env.REGISTRATION_ENABLED = 'false';

    settings.setRegistrationEnabled(true);

    assert.equal(settings.isRegistrationEnabled(), true);
});
