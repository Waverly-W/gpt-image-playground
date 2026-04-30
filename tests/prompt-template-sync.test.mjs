import assert from 'node:assert/strict';
import test from 'node:test';

const sync = await import('../src/lib/prompt-template-sync.ts');

test('lists prompt template upload payloads with stable R2 keys', () => {
    const uploads = sync.listPromptTemplateUploads();

    assert.equal(uploads.length, 306);
    assert.equal(
        uploads[0].key,
        'prompt-templates/ai-outfit-upgrade-report__french-parisian-style-reset.webp'
    );
    assert.match(uploads[0].filePath, /docs[/\\]gpt-image-prompt_templates[/\\]images/);
    assert.equal(uploads[0].contentType, 'image/webp');
});

test('sync helper reports progress while uploading prompt template images', async () => {
    const progressEvents = [];
    const uploadedKeys = [];

    const result = await sync.syncPromptTemplateImagesToR2(
        {
            openaiApiKey: '',
            openaiBaseUrl: '',
            imageStorageMode: 'r2',
            r2AccountId: 'account',
            r2AccessKeyId: 'access',
            r2SecretAccessKey: 'secret',
            r2Bucket: 'bucket',
            r2Endpoint: 'https://account.r2.cloudflarestorage.com',
            r2PublicBaseUrl: 'https://cdn.example/assets',
            authCookieSecure: 'auto',
            registrationEnabled: true
        },
        {
            uploads: sync.listPromptTemplateUploads().slice(0, 2),
            readFile: async () => Buffer.from('image'),
            uploadObject: async (key) => {
                uploadedKeys.push(key);
            },
            onProgress: (event) => {
                progressEvents.push(event);
            }
        }
    );

    assert.deepEqual(uploadedKeys, [
        'prompt-templates/ai-outfit-upgrade-report__french-parisian-style-reset.webp',
        'prompt-templates/ai-outfit-upgrade-report__german-minimal-streetwear-scorecard.webp'
    ]);
    assert.equal(result.uploaded, 2);
    assert.equal(progressEvents.length, 2);
    assert.deepEqual(progressEvents.map((event) => event.completed), [1, 2]);
    assert.equal(progressEvents[0].total, 2);
});
