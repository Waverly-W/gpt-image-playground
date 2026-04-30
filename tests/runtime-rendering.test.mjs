import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const promptTemplateGallery = fs.readFileSync(
    new URL('../src/components/prompt-template-gallery.tsx', import.meta.url),
    'utf8'
);
const themeProvider = fs.readFileSync(new URL('../src/components/theme-provider.tsx', import.meta.url), 'utf8');
const rootLayout = fs.readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
const nextConfig = fs.readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');

test('prompt template gallery uses next image with the configured R2 image host', () => {
    assert.match(promptTemplateGallery, /from 'next\/image'/);
    assert.match(promptTemplateGallery, /<Image/);
    assert.match(promptTemplateGallery, /unoptimized/);
    assert.match(nextConfig, /pic\.waverlywang\.top/);
});

test('theme provider does not inject next-themes script during client rendering', () => {
    assert.doesNotMatch(themeProvider, /next-themes/);
    assert.match(rootLayout, /className='dark'/);
});
