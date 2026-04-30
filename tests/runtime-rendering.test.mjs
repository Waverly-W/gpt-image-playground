import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const promptTemplateGallery = fs.readFileSync(
    new URL('../src/components/prompt-template-gallery.tsx', import.meta.url),
    'utf8'
);
const modeToggle = fs.readFileSync(new URL('../src/components/mode-toggle.tsx', import.meta.url), 'utf8');
const themeProvider = fs.readFileSync(new URL('../src/components/theme-provider.tsx', import.meta.url), 'utf8');
const rootLayout = fs.readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
const nextConfig = fs.readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');

test('prompt template gallery uses the configured R2 image host', () => {
    assert.match(promptTemplateGallery, /from 'antd'/);
    assert.match(promptTemplateGallery, /<AntImage/);
    assert.match(nextConfig, /pic\.waverlywang\.top/);
});

test('prompt template gallery keeps scene filters in a visible content sidebar', () => {
    assert.match(promptTemplateGallery, /aria-label='提示词场景筛选'/);
    assert.match(promptTemplateGallery, /scene\.count\.toLocaleString\(\)/);
    assert.match(promptTemplateGallery, /filteredTemplates\.length\.toLocaleString\(\)/);
    assert.doesNotMatch(promptTemplateGallery, /Select value=\{sceneSlug\}/);
});

test('prompt template gallery uses Ant Design image preview', () => {
    assert.match(promptTemplateGallery, /import \{ Image as AntImage \} from 'antd'/);
    assert.match(promptTemplateGallery, /preview=\{\{\s*mask: '预览图片'/);
});

test('task queue image preview uses Ant Design preview group', () => {
    const taskQueuePanel = fs.readFileSync(new URL('../src/components/task-queue-panel.tsx', import.meta.url), 'utf8');

    assert.match(taskQueuePanel, /import \{ Image as AntImage \} from 'antd'/);
    assert.match(taskQueuePanel, /<AntImage\.PreviewGroup/);
    assert.doesNotMatch(taskQueuePanel, /DialogContent/);
});

test('mode toggle renders as a prominent sliding tab control', () => {
    assert.match(modeToggle, /aria-hidden='true'/);
    assert.match(modeToggle, /translate-x-full/);
    assert.match(modeToggle, /h-10 min-h-0/);
    assert.match(modeToggle, /shadow/);
    assert.match(modeToggle, /data-\[state=active\]:!text-neutral-950/);
});

test('theme provider does not inject next-themes script during client rendering', () => {
    assert.doesNotMatch(themeProvider, /next-themes/);
    assert.match(rootLayout, /className='dark'/);
});
