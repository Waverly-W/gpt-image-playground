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
const playgroundClient = fs.readFileSync(new URL('../src/app/playground-client.tsx', import.meta.url), 'utf8');

test('prompt inspector exposes final prompt blocks and warnings in Chinese', () => {
    const promptInspectorPath = new URL('../src/components/prompt-inspector.tsx', import.meta.url);

    assert.equal(fs.existsSync(promptInspectorPath), true, 'PromptInspector component should exist');

    const promptInspector = fs.readFileSync(promptInspectorPath, 'utf8');

    assert.match(promptInspector, /最终提示词/);
    assert.match(promptInspector, /启用控制块/);
    assert.match(promptInspector, /原始提示词/);
    assert.match(promptInspector, /警告/);
    assert.match(promptInspector, /getPromptBlockTitleLabel/);
    assert.match(promptInspector, /['"]SOURCE IMAGE['"]:\s*'源图'/);
    assert.match(promptInspector, /['"]MASK POLICY['"]:\s*'蒙版策略'/);
});

test('generation form uses the shared prompt inspector for guided prompts', () => {
    const generationForm = fs.readFileSync(new URL('../src/components/generation-form.tsx', import.meta.url), 'utf8');

    assert.match(generationForm, /import \{ PromptInspector \} from '@\/components\/prompt-inspector'/);
    assert.match(generationForm, /<PromptInspector/);
    assert.match(generationForm, /rawPrompt=\{builtPrompt\.rawPrompt\}/);
    assert.match(generationForm, /fullPrompt=\{builtPrompt\.fullPrompt\}/);
    assert.match(generationForm, /blocks=\{builtPrompt\.blocks\}/);
    assert.match(generationForm, /warnings=\{builtPrompt\.warnings\}/);
});

test('task queue shows saved prompt inspector metadata for completed jobs', () => {
    const taskQueuePanel = fs.readFileSync(new URL('../src/components/task-queue-panel.tsx', import.meta.url), 'utf8');

    assert.match(taskQueuePanel, /import \{ PromptInspector, type PromptInspectorBlock \} from '@\/components\/prompt-inspector'/);
    assert.match(taskQueuePanel, /getJobPromptInspectorData/);
    assert.match(taskQueuePanel, /job\.params\.full_prompt/);
    assert.match(taskQueuePanel, /job\.params\.raw_prompt/);
    assert.match(taskQueuePanel, /job\.params\.prompt_blocks/);
    assert.match(taskQueuePanel, /job\.params\.prompt_warnings/);
    assert.match(taskQueuePanel, /<PromptInspector/);
});

test('task queue keeps thumbnails square when prompt inspector expands', () => {
    const taskQueuePanel = fs.readFileSync(new URL('../src/components/task-queue-panel.tsx', import.meta.url), 'utf8');

    assert.match(taskQueuePanel, /className='flex flex-col gap-3 rounded-md border border-white\/10 bg-neutral-950\/70 p-3'/);
    assert.match(taskQueuePanel, /className='flex items-start gap-3'/);
    assert.match(taskQueuePanel, /relative h-24 w-24 shrink-0 self-start overflow-hidden rounded-md/);
    assert.match(taskQueuePanel, /className='sm:pl-\[6\.75rem\]'/);
});

test('task queue exposes quality feedback controls for completed jobs', () => {
    const taskQueuePanel = fs.readFileSync(new URL('../src/components/task-queue-panel.tsx', import.meta.url), 'utf8');
    const playgroundClient = fs.readFileSync(new URL('../src/app/playground-client.tsx', import.meta.url), 'utf8');
    const jobRoute = fs.readFileSync(new URL('../src/app/api/image-jobs/[id]/route.ts', import.meta.url), 'utf8');
    const qualityFeedback = fs.readFileSync(new URL('../src/lib/image-quality-feedback.ts', import.meta.url), 'utf8');

    assert.match(taskQueuePanel, /QUALITY_FAILURE_REASON_OPTIONS/);
    assert.match(taskQueuePanel, /质量反馈/);
    assert.match(qualityFeedback, /文字错/);
    assert.match(qualityFeedback, /构图错/);
    assert.match(qualityFeedback, /风格错/);
    assert.match(qualityFeedback, /不听参考图/);
    assert.match(qualityFeedback, /主体不一致/);
    assert.match(qualityFeedback, /信息密度不对/);
    assert.match(taskQueuePanel, /onUpdateQualityFeedback/);
    assert.match(taskQueuePanel, /job\.status === 'completed'/);
    assert.match(playgroundClient, /handleUpdateQualityFeedback/);
    assert.match(playgroundClient, /method: 'PATCH'/);
    assert.match(jobRoute, /updateImageJobQualityFeedbackForUser/);
    assert.match(jobRoute, /export async function PATCH/);
});

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

test('prompt template gallery card grid adapts to available width', () => {
    assert.match(promptTemplateGallery, /<section className='w-full space-y-4'/);
    assert.match(promptTemplateGallery, /repeat\(auto-fit,minmax\(min\(100%,14rem\),1fr\)\)/);
    assert.doesNotMatch(promptTemplateGallery, /sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4/);
    assert.doesNotMatch(promptTemplateGallery, /max-w-screen-2xl/);
});

test('task queue image preview uses Ant Design preview group', () => {
    const taskQueuePanel = fs.readFileSync(new URL('../src/components/task-queue-panel.tsx', import.meta.url), 'utf8');

    assert.match(taskQueuePanel, /import \{ Image as AntImage \} from 'antd'/);
    assert.match(taskQueuePanel, /<AntImage\.PreviewGroup/);
    assert.doesNotMatch(taskQueuePanel, /DialogContent/);
});

test('task queue renders clickable streaming preview images', () => {
    const taskQueuePanel = fs.readFileSync(new URL('../src/components/task-queue-panel.tsx', import.meta.url), 'utf8');

    assert.match(taskQueuePanel, /previewImageSrc/);
    assert.match(taskQueuePanel, /job\.previewImage/);
    assert.match(taskQueuePanel, /mask: job\.status === 'failed' \? '查看最后预览' : '查看预览'/);
    assert.match(taskQueuePanel, /预览/);
});

test('playground submits streaming settings to queued image jobs', () => {
    assert.match(playgroundClient, /apiFormData\.append\('stream', 'true'\)/);
    assert.match(playgroundClient, /apiFormData\.append\('partial_images', partialImages\.toString\(\)\)/);
    assert.match(playgroundClient, /enableStreaming && genN\[0\] === 1/);
    assert.match(playgroundClient, /enableStreaming && editN\[0\] === 1/);
});

test('playground supports CSV batch generation through the existing job queue', () => {
    const generationForm = fs.readFileSync(new URL('../src/components/generation-form.tsx', import.meta.url), 'utf8');

    assert.match(generationForm, /createBatchCsvTemplate/);
    assert.match(generationForm, /parseBatchCsv/);
    assert.match(generationForm, /批量生成/);
    assert.match(generationForm, /generationMode/);
    assert.match(generationForm, /generationMode === 'batch'/);
    assert.match(generationForm, /generationMode === 'single'/);
    assert.match(playgroundClient, /createBatchJobFormData/);
    assert.match(playgroundClient, /handleBatchApiCall/);
    assert.doesNotMatch(playgroundClient, /waitForBatchJobToFinish/);
    assert.match(playgroundClient, /Promise\.all\(\s*rows\.map/);
});

test('prompt template gallery imports templates as guided prompt configs', () => {
    assert.match(promptTemplateGallery, /onImportTemplate/);
    assert.match(promptTemplateGallery, /template\.promptBuilderConfig/);
    assert.doesNotMatch(promptTemplateGallery, /onImportPrompt\(template\.prompt\)/);
    assert.match(playgroundClient, /handleImportPromptTemplate = React\.useCallback\(\(template: PromptTemplate\)/);
    assert.match(playgroundClient, /setGenPrompt\(template\.promptBuilderConfig\.rawDescription\)/);
});

test('edit mode submits semantic reference image roles', () => {
    const editingForm = fs.readFileSync(new URL('../src/components/editing-form.tsx', import.meta.url), 'utf8');

    assert.match(editingForm, /ReferenceImageRole/);
    assert.match(editingForm, /imageRoles/);
    assert.match(editingForm, /source-image/);
    assert.match(editingForm, /style-reference/);
    assert.match(editingForm, /layout-reference/);
    assert.match(playgroundClient, /apiFormData\.append\(`image_role_\$\{index\}`, role\)/);
});

test('task queue exposes cancellation for pending jobs', () => {
    const taskQueuePanel = fs.readFileSync(new URL('../src/components/task-queue-panel.tsx', import.meta.url), 'utf8');
    const jobRoute = fs.readFileSync(new URL('../src/app/api/image-jobs/[id]/route.ts', import.meta.url), 'utf8');

    assert.match(taskQueuePanel, /onCancelPendingJob/);
    assert.match(taskQueuePanel, /job\.status === 'pending'/);
    assert.match(taskQueuePanel, /取消生成/);
    assert.match(playgroundClient, /handleCancelPendingJob/);
    assert.match(playgroundClient, /method: 'DELETE'/);
    assert.match(jobRoute, /cancelPendingImageJobForUser/);
    assert.match(jobRoute, /DELETE/);
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
