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
