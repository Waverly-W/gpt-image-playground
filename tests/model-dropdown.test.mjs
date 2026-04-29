import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const generationForm = fs.readFileSync(new URL('../src/components/generation-form.tsx', import.meta.url), 'utf8');
const editingForm = fs.readFileSync(new URL('../src/components/editing-form.tsx', import.meta.url), 'utf8');
const imageModels = fs.readFileSync(new URL('../src/lib/image-models.ts', import.meta.url), 'utf8');

const expectedModels = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'];

test('shared image model options include all supported GPT image models', () => {
    for (const model of expectedModels) {
        assert.match(imageModels, new RegExp(`value:\\s*'${model.replace('.', '\\.')}'.*label:\\s*'${model.replace('.', '\\.')}'`));
    }
});

test('generation and editing forms render model options from shared list', () => {
    assert.match(generationForm, /IMAGE_MODEL_OPTIONS\.map/);
    assert.match(editingForm, /IMAGE_MODEL_OPTIONS\.map/);
});

test('model dropdown content is explicitly layered above the app chrome', () => {
    assert.match(generationForm, /SelectContent className='z-\[100\]/);
    assert.match(editingForm, /SelectContent className='z-\[100\]/);
});
