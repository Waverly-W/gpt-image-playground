import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

const promptTemplates = await import('../src/lib/prompt-templates.ts');

test('loads GPT image prompt templates with local gallery image URLs', () => {
    const templates = promptTemplates.getPromptTemplates({
        openaiApiKey: '',
        openaiBaseUrl: '',
        imageStorageMode: 'fs',
        r2AccountId: '',
        r2AccessKeyId: '',
        r2SecretAccessKey: '',
        r2Bucket: '',
        r2Endpoint: '',
        r2PublicBaseUrl: '',
        authCookieSecure: 'auto',
        registrationEnabled: true
    });

    assert.equal(templates.length, 306);
    assert.equal(promptTemplates.PROMPT_TEMPLATE_SCENES.length, 34);

    const first = templates[0];
    assert.equal(first.sceneSlug, 'ai-outfit-upgrade-report');
    assert.equal(first.sceneTitle, '衣品升级模板');
    assert.equal(first.title, '法式 Parisian Style Reset');
    assert.equal(
        first.imageUrl,
        '/api/prompt-template-images/ai-outfit-upgrade-report__french-parisian-style-reset.webp'
    );
    assert.match(first.prompt, /French Parisian understated style upgrade report/);
    assert.deepEqual(first.promptBuilderConfig, {
        promptMode: 'guided',
        rawDescription: first.prompt,
        sceneId: 'style-report',
        styleId: 'editorial',
        aspectRatio: '16:9',
        textPolicy: 'structured-labels',
        outputLanguage: 'auto'
    });
});

test('resolves only known prompt template image filenames from docs directory', () => {
    const imagePath = promptTemplates.resolvePromptTemplateImagePath(
        'ai-outfit-upgrade-report__french-parisian-style-reset.webp'
    );

    assert.ok(imagePath);
    assert.equal(path.basename(imagePath), 'ai-outfit-upgrade-report__french-parisian-style-reset.webp');
    assert.match(imagePath, /docs[/\\]gpt-image-prompt_templates[/\\]images/);

    assert.equal(promptTemplates.resolvePromptTemplateImagePath('../package.json'), null);
    assert.equal(promptTemplates.resolvePromptTemplateImagePath('missing.webp'), null);
});

test('prefers R2 public URLs for prompt templates when configured', () => {
    const templates = promptTemplates.getPromptTemplates({
        openaiApiKey: '',
        openaiBaseUrl: '',
        imageStorageMode: 'r2',
        r2AccountId: 'account',
        r2AccessKeyId: 'access',
        r2SecretAccessKey: 'secret',
        r2Bucket: 'bucket',
        r2Endpoint: 'https://account.r2.cloudflarestorage.com',
        r2PublicBaseUrl: 'https://cdn.example/assets/',
        authCookieSecure: 'auto',
        registrationEnabled: true
    });

    assert.equal(
        templates[0].imageUrl,
        'https://cdn.example/assets/prompt-templates/ai-outfit-upgrade-report__french-parisian-style-reset.webp'
    );
});

test('omits bucket segment from R2 custom domain template URLs', () => {
    const templates = promptTemplates.getPromptTemplates({
        openaiApiKey: '',
        openaiBaseUrl: '',
        imageStorageMode: 'r2',
        r2AccountId: 'account',
        r2AccessKeyId: 'access',
        r2SecretAccessKey: 'secret',
        r2Bucket: 'image-2',
        r2Endpoint: 'https://account.r2.cloudflarestorage.com',
        r2PublicBaseUrl: 'https://pic.waverlywang.top/image-2/',
        authCookieSecure: 'auto',
        registrationEnabled: true
    });

    assert.equal(
        templates[0].imageUrl,
        'https://pic.waverlywang.top/prompt-templates/ai-outfit-upgrade-report__french-parisian-style-reset.webp'
    );
});

test('maps prompt template scenes to guided builder configs', () => {
    const templates = promptTemplates.PROMPT_TEMPLATES;
    const bySlug = new Map(templates.map((template) => [template.sceneSlug, template]));

    assert.equal(bySlug.get('big-type-posters')?.promptBuilderConfig.sceneId, 'poster');
    assert.equal(bySlug.get('evolution-history-infographics')?.promptBuilderConfig.sceneId, 'infographic');
    assert.equal(bySlug.get('character-design-charts')?.promptBuilderConfig.sceneId, 'character');
    assert.equal(bySlug.get('biomimicry-product-concepts')?.promptBuilderConfig.sceneId, 'product');
    assert.equal(bySlug.get('cutaway-educational-picture-books')?.promptBuilderConfig.sceneId, 'educational');
    assert.equal(bySlug.get('double-exposure-character-posters')?.promptBuilderConfig.sceneId, 'portrait');
});
