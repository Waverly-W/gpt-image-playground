import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const promptTemplateGallery = fs.readFileSync(
    new URL('../src/components/prompt-template-gallery.tsx', import.meta.url),
    'utf8'
);
const themeProvider = fs.readFileSync(new URL('../src/components/theme-provider.tsx', import.meta.url), 'utf8');
const rootLayout = fs.readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');

test('prompt template gallery uses a plain image element for runtime R2 host URLs', () => {
    assert.doesNotMatch(promptTemplateGallery, /from 'next\/image'/);
    assert.match(promptTemplateGallery, /<img/);
});

test('theme provider does not inject next-themes script during client rendering', () => {
    assert.doesNotMatch(themeProvider, /next-themes/);
    assert.match(rootLayout, /className='dark'/);
});
