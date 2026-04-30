import assert from 'node:assert/strict';
import test from 'node:test';

const originalEnv = { ...process.env };

test.afterEach(() => {
    process.env = { ...originalEnv };
});

test('image storage mode ignores legacy environment selection', async () => {
    process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE = 'r2';
    delete process.env.VERCEL;

    const storage = await import(`../src/lib/image-storage.ts?case=env-ignored-${Date.now()}`);

    assert.equal(storage.resolveImageStorageMode(), 'fs');
});

test('r2 storage validates required environment variables', async () => {
    delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    delete process.env.CLOUDFLARE_R2_BUCKET;

    const storage = await import(`../src/lib/image-storage.ts?case=missing-${Date.now()}`);

    assert.throws(
        () => storage.getR2Config(),
        /Missing required Cloudflare R2 environment variables: CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET/
    );
});
