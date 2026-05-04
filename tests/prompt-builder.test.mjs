import assert from 'node:assert/strict';
import test from 'node:test';

const promptBuilder = await import('../src/lib/prompt-builder/build-prompt.ts');

test('free prompt mode sends the raw prompt unchanged', () => {
    const built = promptBuilder.buildPrompt({
        promptMode: 'free',
        rawDescription: 'A clean product photo of a ceramic mug on a desk.'
    });

    assert.equal(built.rawPrompt, 'A clean product photo of a ceramic mug on a desk.');
    assert.equal(built.fullPrompt, 'A clean product photo of a ceramic mug on a desk.');
    assert.deepEqual(built.blocks, []);
    assert.deepEqual(built.warnings, []);
});

test('guided prompt mode composes ordered control blocks', () => {
    const built = promptBuilder.buildPrompt({
        promptMode: 'guided',
        rawDescription: 'Explain how caffeine affects sleep with clear Chinese labels.',
        sceneId: 'infographic',
        styleId: 'editorial',
        aspectRatio: '16:9',
        size: '1536x1024',
        outputLanguage: 'zh',
        textPolicy: 'structured-labels'
    });

    assert.deepEqual(
        built.blocks.map((block) => block.title),
        ['TASK', 'SPECS', 'DESC', 'STYLE', 'TEXT POLICY', 'QUALITY']
    );
    assert.match(built.fullPrompt, /^\*\*TASK\*\*:/);
    assert.match(built.fullPrompt, /\*\*SPECS\*\*: Canvas: 16:9, size: 1536x1024\./);
    assert.match(built.fullPrompt, /\*\*DESC\*\*: Explain how caffeine affects sleep/);
    assert.match(built.fullPrompt, /Use structured labels, callouts, captions, and section headers/);
    assert.match(built.fullPrompt, /Use SIMPLIFIED CHINESE for all visible text/);
    assert.equal(built.warnings.length, 0);
});

test('guided prompt mode warns about unknown catalog ids and empty descriptions', () => {
    const built = promptBuilder.buildPrompt({
        promptMode: 'guided',
        rawDescription: '   ',
        sceneId: 'missing-scene',
        styleId: 'missing-style',
        textPolicy: 'no-text',
        outputLanguage: 'en'
    });

    assert.deepEqual(built.warnings, [
        'rawDescription is empty; the generated prompt will rely on builder controls only.',
        'Unknown sceneId "missing-scene"; scene-specific guidance was skipped.',
        'Unknown styleId "missing-style"; style guidance was skipped.'
    ]);
    assert.deepEqual(
        built.blocks.map((block) => block.title),
        ['TASK', 'SPECS', 'TEXT POLICY', 'QUALITY']
    );
});

test('builds server-authoritative prompt metadata from FormData', () => {
    const formData = new FormData();
    formData.append('prompt', 'Design a poster about long-term thinking.');
    formData.append('prompt_mode', 'guided');
    formData.append('size', '1024x1536');
    formData.append(
        'prompt_builder_config',
        JSON.stringify({
            promptMode: 'guided',
            rawDescription: 'Design a poster about long-term thinking.',
            sceneId: 'poster',
            styleId: 'minimal',
            textPolicy: 'text-first',
            outputLanguage: 'en'
        })
    );

    const built = promptBuilder.buildPromptFromFormData(formData);
    const params = promptBuilder.serializeBuiltPromptForParams(built);

    assert.equal(built.rawPrompt, 'Design a poster about long-term thinking.');
    assert.match(built.fullPrompt, /\*\*TASK\*\*: Generate a poster image/);
    assert.equal(params.prompt_mode, 'guided');
    assert.equal(params.raw_prompt, 'Design a poster about long-term thinking.');
    assert.equal(params.full_prompt, built.fullPrompt);
    assert.equal(params.prompt_builder_config.promptMode, 'guided');
    assert.deepEqual(
        params.prompt_blocks.map((block) => block.title),
        ['TASK', 'SPECS', 'DESC', 'STYLE', 'TEXT POLICY', 'QUALITY']
    );
    assert.deepEqual(params.prompt_warnings, []);
});
