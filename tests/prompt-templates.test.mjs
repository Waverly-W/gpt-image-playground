import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

const promptTemplates = await import('../src/lib/prompt-templates.ts');

test('loads GPT image prompt templates with local gallery image URLs', () => {
    assert.equal(promptTemplates.PROMPT_TEMPLATES.length, 306);
    assert.equal(promptTemplates.PROMPT_TEMPLATE_SCENES.length, 34);

    const first = promptTemplates.PROMPT_TEMPLATES[0];
    assert.equal(first.sceneSlug, 'ai-outfit-upgrade-report');
    assert.equal(first.sceneTitle, '衣品升级模板');
    assert.equal(first.title, '法式 Parisian Style Reset');
    assert.equal(
        first.imageUrl,
        '/api/prompt-template-images/ai-outfit-upgrade-report__french-parisian-style-reset.webp'
    );
    assert.match(first.prompt, /French Parisian understated style upgrade report/);
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
