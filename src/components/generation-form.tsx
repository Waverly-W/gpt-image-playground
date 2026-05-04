'use client';

import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    createBatchCsvTemplate,
    parseBatchCsv,
    type BatchGenerationDefaults,
    type BatchGenerationRow
} from '@/lib/batch-csv';
import type { GptImageModel } from '@/lib/cost-utils';
import { IMAGE_MODEL_OPTIONS } from '@/lib/image-models';
import { buildPrompt } from '@/lib/prompt-builder/build-prompt';
import { SCENE_CATALOG, STYLE_CATALOG } from '@/lib/prompt-builder/catalogs';
import type {
    PromptBlock,
    PromptBuilderConfig,
    PromptBuilderMode,
    PromptIntentMode,
    PromptOutputLanguage,
    PromptTextPolicy
} from '@/lib/prompt-builder/types';
import { getPresetDimensions, getPresetTooltip, validateGptImage2Size } from '@/lib/size-utils';
import type { SizePreset } from '@/lib/size-utils';
import {
    Square,
    RectangleHorizontal,
    RectangleVertical,
    Sparkles,
    Eraser,
    ShieldCheck,
    ShieldAlert,
    FileImage,
    Tally1,
    Tally2,
    Tally3,
    Loader2,
    BrickWall,
    HelpCircle,
    SquareDashed,
    Download,
    Upload,
    ListPlus
} from 'lucide-react';
import * as React from 'react';

export type GenerationFormData = {
    prompt: string;
    promptMode: PromptBuilderMode;
    promptBuilderConfig?: PromptBuilderConfig;
    fullPrompt?: string;
    promptBlocks?: PromptBlock[];
    promptWarnings?: string[];
    n: number;
    size: SizePreset;
    customWidth: number;
    customHeight: number;
    quality: 'low' | 'medium' | 'high' | 'auto';
    output_format: 'png' | 'jpeg' | 'webp';
    output_compression?: number;
    background: 'transparent' | 'opaque' | 'auto';
    moderation: 'low' | 'auto';
    model: GptImageModel;
};

type GenerationFormProps = {
    onSubmit: (data: GenerationFormData) => void;
    onBatchSubmit: (rows: BatchGenerationRow[]) => Promise<void>;
    isLoading: boolean;
    batchProgress: string | null;
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
    model: GenerationFormData['model'];
    setModel: React.Dispatch<React.SetStateAction<GenerationFormData['model']>>;
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
    n: number[];
    setN: React.Dispatch<React.SetStateAction<number[]>>;
    size: GenerationFormData['size'];
    setSize: React.Dispatch<React.SetStateAction<GenerationFormData['size']>>;
    customWidth: number;
    setCustomWidth: React.Dispatch<React.SetStateAction<number>>;
    customHeight: number;
    setCustomHeight: React.Dispatch<React.SetStateAction<number>>;
    quality: GenerationFormData['quality'];
    setQuality: React.Dispatch<React.SetStateAction<GenerationFormData['quality']>>;
    outputFormat: GenerationFormData['output_format'];
    setOutputFormat: React.Dispatch<React.SetStateAction<GenerationFormData['output_format']>>;
    compression: number[];
    setCompression: React.Dispatch<React.SetStateAction<number[]>>;
    background: GenerationFormData['background'];
    setBackground: React.Dispatch<React.SetStateAction<GenerationFormData['background']>>;
    moderation: GenerationFormData['moderation'];
    setModeration: React.Dispatch<React.SetStateAction<GenerationFormData['moderation']>>;
    enableStreaming: boolean;
    setEnableStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    partialImages: 1 | 2 | 3;
    setPartialImages: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
    importedPromptBuilderConfig?: PromptBuilderConfig | null;
};

type GenerationMode = 'single' | 'batch';

const TEXT_POLICY_OPTIONS: Array<{ value: PromptTextPolicy; label: string }> = [
    { value: 'allow-short-text', label: '短文字' },
    { value: 'no-text', label: '无文字' },
    { value: 'text-first', label: '文字优先' },
    { value: 'structured-labels', label: '结构标签' }
];

const LANGUAGE_OPTIONS: Array<{ value: PromptOutputLanguage; label: string }> = [
    { value: 'auto', label: '自动' },
    { value: 'zh', label: '中文' },
    { value: 'en', label: '英文' },
    { value: 'ja', label: '日文' },
    { value: 'ko', label: '韩文' }
];

const BLOCK_TITLE_LABELS: Record<string, string> = {
    TASK: '任务',
    SPECS: '规格',
    DESC: '描述',
    STYLE: '风格',
    'TEXT POLICY': '文字策略',
    QUALITY: '质量'
};

function getBlockTitleLabel(title: string): string {
    return BLOCK_TITLE_LABELS[title] ?? title;
}

const RadioItemWithIcon = ({
    value,
    id,
    label,
    Icon
}: {
    value: string;
    id: string;
    label: string;
    Icon: React.ElementType;
}) => (
    <div className='flex items-center space-x-2'>
        <RadioGroupItem
            value={value}
            id={id}
            className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
        />
        <Label htmlFor={id} className='flex cursor-pointer items-center gap-2 text-base text-white/80'>
            <Icon className='h-5 w-5 text-white/60' />
            {label}
        </Label>
    </div>
);

export function GenerationForm({
    onSubmit,
    onBatchSubmit,
    isLoading,
    batchProgress,
    currentMode,
    onModeChange,
    model,
    setModel,
    prompt,
    setPrompt,
    n,
    setN,
    size,
    setSize,
    customWidth,
    setCustomWidth,
    customHeight,
    setCustomHeight,
    quality,
    setQuality,
    outputFormat,
    setOutputFormat,
    compression,
    setCompression,
    background,
    setBackground,
    moderation,
    setModeration,
    enableStreaming,
    setEnableStreaming,
    partialImages,
    setPartialImages,
    importedPromptBuilderConfig
}: GenerationFormProps) {
    const showCompression = outputFormat === 'jpeg' || outputFormat === 'webp';
    const isGptImage2 = model === 'gpt-image-2';
    const customSizeValidation =
        size === 'custom' ? validateGptImage2Size(customWidth, customHeight) : { valid: true as const };
    const customSizeInvalid = size === 'custom' && !customSizeValidation.valid;
    const batchFileInputRef = React.useRef<HTMLInputElement>(null);
    const [generationMode, setGenerationMode] = React.useState<GenerationMode>('single');
    const [promptMode, setPromptMode] = React.useState<PromptBuilderMode>('free');
    const [sceneId, setSceneId] = React.useState<PromptIntentMode>('poster');
    const [styleId, setStyleId] = React.useState('minimal');
    const [textPolicy, setTextPolicy] = React.useState<PromptTextPolicy>('allow-short-text');
    const [outputLanguage, setOutputLanguage] = React.useState<PromptOutputLanguage>('auto');
    const [batchRows, setBatchRows] = React.useState<BatchGenerationRow[]>([]);
    const [batchErrors, setBatchErrors] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (!importedPromptBuilderConfig) return;

        setPromptMode('guided');
        setSceneId((importedPromptBuilderConfig.sceneId || 'poster') as PromptIntentMode);
        setStyleId(importedPromptBuilderConfig.styleId || 'editorial');
        setTextPolicy(importedPromptBuilderConfig.textPolicy || 'allow-short-text');
        setOutputLanguage(importedPromptBuilderConfig.outputLanguage || 'auto');
    }, [importedPromptBuilderConfig]);

    const batchDefaults = React.useMemo<BatchGenerationDefaults>(
        () => ({
            model,
            n: n[0],
            size,
            customWidth,
            customHeight,
            quality,
            output_format: outputFormat,
            output_compression: compression[0],
            background,
            moderation,
            stream: enableStreaming && n[0] === 1,
            partial_images: partialImages
        }),
        [
            model,
            n,
            size,
            customWidth,
            customHeight,
            quality,
            outputFormat,
            compression,
            background,
            moderation,
            enableStreaming,
            partialImages
        ]
    );
    const resolvedGenerationSize =
        size === 'custom' ? `${customWidth}x${customHeight}` : (getPresetDimensions(size, model) ?? size);
    const promptBuilderConfig = React.useMemo<PromptBuilderConfig>(
        () => ({
            promptMode,
            rawDescription: prompt,
            sceneId,
            styleId,
            textPolicy,
            outputLanguage,
            size: resolvedGenerationSize
        }),
        [promptMode, prompt, sceneId, styleId, textPolicy, outputLanguage, resolvedGenerationSize]
    );
    const builtPrompt = React.useMemo(() => buildPrompt(promptBuilderConfig), [promptBuilderConfig]);

    // Disable streaming when n > 1 (OpenAI limitation)
    React.useEffect(() => {
        if (n[0] > 1 && enableStreaming) {
            setEnableStreaming(false);
        }
    }, [n, enableStreaming, setEnableStreaming]);

    // 'custom' is only valid on gpt-image-2; reset when switching to a legacy model
    React.useEffect(() => {
        if (!isGptImage2 && size === 'custom') {
            setSize('auto');
        }
    }, [isGptImage2, size, setSize]);

    // Reset transparent background when switching to gpt-image-2 (not supported)
    React.useEffect(() => {
        if (isGptImage2 && background === 'transparent') {
            setBackground('auto');
        }
    }, [isGptImage2, background, setBackground]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (customSizeInvalid) {
            return;
        }
        const formData: GenerationFormData = {
            prompt,
            promptMode,
            promptBuilderConfig,
            fullPrompt: builtPrompt.fullPrompt,
            promptBlocks: builtPrompt.blocks,
            promptWarnings: builtPrompt.warnings,
            n: n[0],
            size,
            customWidth,
            customHeight,
            quality,
            output_format: outputFormat,
            background,
            moderation,
            model
        };
        if (showCompression) {
            formData.output_compression = compression[0];
        }
        onSubmit(formData);
    };

    const handleDownloadTemplate = () => {
        const template = createBatchCsvTemplate(batchDefaults);
        const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'image-batch-template.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleBatchFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const result = parseBatchCsv(text, batchDefaults);
        setBatchRows(result.rows);
        setBatchErrors(result.errors);
        event.target.value = '';
    };

    const handleCreateBatchJobs = async () => {
        if (batchRows.length === 0 || batchErrors.length > 0) return;
        await onBatchSubmit(batchRows);
        setBatchRows([]);
        setBatchErrors([]);
    };

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-950'>
            <CardHeader className='flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0'>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-xl font-semibold text-white'>
                            {generationMode === 'batch' ? '批量生成' : '生成图片'}
                        </CardTitle>
                    </div>
                    <CardDescription className='mt-1 text-white/60'>
                        {generationMode === 'batch'
                            ? '导入 CSV 后一次性创建任务，由队列自动调度。'
                            : '根据文字提示词创建新图片。'}
                    </CardDescription>
                </div>
                {generationMode === 'single' && <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />}
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex flex-1 flex-col gap-5 overflow-y-auto p-4'>
                    <div
                        role='tablist'
                        aria-label='生成模式'
                        className='grid min-h-10 grid-cols-2 overflow-hidden rounded-md border border-white/15 bg-black p-1'>
                        <button
                            type='button'
                            role='tab'
                            aria-selected={generationMode === 'single'}
                            onClick={() => setGenerationMode('single')}
                            disabled={isLoading}
                            className={`rounded px-3 text-sm transition-colors ${
                                generationMode === 'single'
                                    ? 'bg-white text-black'
                                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                            } disabled:cursor-not-allowed disabled:opacity-50`}>
                            单张生成
                        </button>
                        <button
                            type='button'
                            role='tab'
                            aria-selected={generationMode === 'batch'}
                            onClick={() => setGenerationMode('batch')}
                            disabled={isLoading}
                            className={`rounded px-3 text-sm transition-colors ${
                                generationMode === 'batch'
                                    ? 'bg-white text-black'
                                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                            } disabled:cursor-not-allowed disabled:opacity-50`}>
                            批量生成
                        </button>
                    </div>

                    {generationMode === 'single' && (
                        <>
                            <div className='flex flex-col gap-1.5'>
                                <Label htmlFor='model-select' className='text-white'>
                                    模型
                                </Label>
                                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4'>
                                    <Select
                                        value={model}
                                        onValueChange={(value) => setModel(value as GenerationFormData['model'])}
                                        disabled={isLoading}>
                                        <SelectTrigger
                                            id='model-select'
                                            className='w-full rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50 sm:w-[180px]'>
                                            <SelectValue placeholder='选择模型' />
                                        </SelectTrigger>
                                        <SelectContent className='z-[100] border-white/20 bg-black text-white'>
                                            {IMAGE_MODEL_OPTIONS.map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                    className='focus:bg-white/10'>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className='flex items-center gap-2'>
                                                <Checkbox
                                                    id='enable-streaming'
                                                    checked={enableStreaming}
                                                    onCheckedChange={(checked) => setEnableStreaming(!!checked)}
                                                    disabled={isLoading || n[0] > 1}
                                                    className='border-white/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black'
                                                />
                                                <Label
                                                    htmlFor='enable-streaming'
                                                    className={`text-sm ${n[0] > 1 ? 'cursor-not-allowed text-white/40' : 'cursor-pointer text-white/80'}`}>
                                                    启用流式预览
                                                </Label>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className='max-w-[250px]'>
                                            {n[0] > 1
                                                ? '流式预览仅支持一次生成 1 张图片（n=1）。'
                                                : '生成过程中显示阶段性预览图，交互反馈更及时。'}
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>

                            {enableStreaming && (
                                <div className='space-y-3'>
                                    <div className='flex items-center gap-2'>
                                        <Label className='text-white'>预览图片数</Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <HelpCircle className='h-4 w-4 cursor-help text-white/40 hover:text-white/60' />
                                            </TooltipTrigger>
                                            <TooltipContent className='max-w-[250px]'>
                                                每张预览图约增加 $0.003 成本（额外 100 个输出 token）。
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <RadioGroup
                                        value={String(partialImages)}
                                        onValueChange={(value) => setPartialImages(Number(value) as 1 | 2 | 3)}
                                        disabled={isLoading}
                                        className='flex gap-x-5'>
                                        <div className='flex items-center space-x-2'>
                                            <RadioGroupItem
                                                value='1'
                                                id='partial-1'
                                                className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                            />
                                            <Label htmlFor='partial-1' className='cursor-pointer text-white/80'>
                                                1
                                            </Label>
                                        </div>
                                        <div className='flex items-center space-x-2'>
                                            <RadioGroupItem
                                                value='2'
                                                id='partial-2'
                                                className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                            />
                                            <Label htmlFor='partial-2' className='cursor-pointer text-white/80'>
                                                2
                                            </Label>
                                        </div>
                                        <div className='flex items-center space-x-2'>
                                            <RadioGroupItem
                                                value='3'
                                                id='partial-3'
                                                className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                            />
                                            <Label htmlFor='partial-3' className='cursor-pointer text-white/80'>
                                                3
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            )}
                        </>
                    )}

                    {generationMode === 'batch' && (
                        <div className='flex flex-col gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3'>
                            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                                <div className='min-w-0'>
                                    <Label className='text-white'>批量生成</Label>
                                    <p className='mt-1 text-xs leading-5 text-white/50'>
                                        下载模板后填写提示词和参数，空参数会使用当前表单默认值。
                                    </p>
                                </div>
                                <div className='flex flex-wrap gap-2'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleDownloadTemplate}
                                        disabled={isLoading}
                                        className='h-9 rounded-md px-2 text-white/70 hover:bg-white/10 hover:text-white'>
                                        <Download className='mr-1.5 h-4 w-4' />
                                        下载模板
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => batchFileInputRef.current?.click()}
                                        disabled={isLoading}
                                        className='h-9 rounded-md px-2 text-white/70 hover:bg-white/10 hover:text-white'>
                                        <Upload className='mr-1.5 h-4 w-4' />
                                        导入 CSV
                                    </Button>
                                </div>
                            </div>

                            <input
                                ref={batchFileInputRef}
                                type='file'
                                accept='.csv,text/csv'
                                onChange={handleBatchFileChange}
                                className='hidden'
                                aria-label='导入批量生成 CSV'
                            />

                            {(batchRows.length > 0 || batchErrors.length > 0 || batchProgress) && (
                                <div className='flex flex-col gap-2 rounded-md border border-white/10 bg-black p-3 text-sm'>
                                    {batchRows.length > 0 && (
                                        <div className='flex flex-col gap-2'>
                                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                                <span className='text-white/75'>已解析 {batchRows.length} 个任务</span>
                                                <Button
                                                    type='button'
                                                    size='sm'
                                                    onClick={handleCreateBatchJobs}
                                                    disabled={isLoading || batchErrors.length > 0}
                                                    className='h-9 rounded-md bg-white px-3 text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                                                    {isLoading ? (
                                                        <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />
                                                    ) : (
                                                        <ListPlus className='mr-1.5 h-4 w-4' />
                                                    )}
                                                    创建批量任务
                                                </Button>
                                            </div>
                                            <div className='max-h-24 overflow-y-auto rounded border border-white/10'>
                                                {batchRows.slice(0, 5).map((row) => (
                                                    <div
                                                        key={row.line}
                                                        className='border-b border-white/10 px-2 py-1.5 text-xs text-white/55 last:border-b-0'>
                                                        第 {row.line} 行 · {row.model} · {row.size} ·{' '}
                                                        <span className='text-white/75'>{row.prompt}</span>
                                                    </div>
                                                ))}
                                                {batchRows.length > 5 && (
                                                    <div className='px-2 py-1.5 text-xs text-white/45'>
                                                        还有 {batchRows.length - 5} 个任务会按 CSV 顺序创建。
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {batchProgress && <p className='text-xs text-sky-200'>{batchProgress}</p>}
                                    {batchErrors.length > 0 && (
                                        <div className='flex flex-col gap-1 text-xs text-red-300'>
                                            {batchErrors.slice(0, 8).map((error) => (
                                                <p key={error}>{error}</p>
                                            ))}
                                            {batchErrors.length > 8 && <p>还有 {batchErrors.length - 8} 个错误。</p>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {generationMode === 'single' && (
                        <>
                            <div className='space-y-1.5'>
                                <div className='flex items-center justify-between gap-3'>
                                    <Label htmlFor='prompt' className='text-white'>
                                        {promptMode === 'guided' ? '创作意图' : '提示词'}
                                    </Label>
                                    <div
                                        role='tablist'
                                        aria-label='提示词模式'
                                        className='grid min-h-9 w-40 grid-cols-2 overflow-hidden rounded-md border border-white/15 bg-black p-1'>
                                        <button
                                            type='button'
                                            role='tab'
                                            aria-selected={promptMode === 'free'}
                                            onClick={() => setPromptMode('free')}
                                            disabled={isLoading}
                                            className={`rounded px-2 text-xs transition-colors ${
                                                promptMode === 'free'
                                                    ? 'bg-white text-black'
                                                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                                            } disabled:cursor-not-allowed disabled:opacity-50`}>
                                            自由
                                        </button>
                                        <button
                                            type='button'
                                            role='tab'
                                            aria-selected={promptMode === 'guided'}
                                            onClick={() => setPromptMode('guided')}
                                            disabled={isLoading}
                                            className={`rounded px-2 text-xs transition-colors ${
                                                promptMode === 'guided'
                                                    ? 'bg-white text-black'
                                                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                                            } disabled:cursor-not-allowed disabled:opacity-50`}>
                                            引导
                                        </button>
                                    </div>
                                </div>
                                <Textarea
                                    id='prompt'
                                    placeholder={
                                        promptMode === 'guided'
                                            ? '例如：做一张关于长期主义的中文大字海报'
                                            : '例如：一只写实风格的猫宇航员漂浮在太空中'
                                    }
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    className='min-h-[80px] rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                />
                            </div>

                            {promptMode === 'guided' && (
                                <div className='space-y-3 rounded-md border border-white/10 bg-white/[0.03] p-3'>
                                    <div className='grid gap-3 sm:grid-cols-2'>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='prompt-scene' className='text-xs text-white/70'>
                                                场景
                                            </Label>
                                            <Select
                                                value={sceneId}
                                                onValueChange={(value) => setSceneId(value as PromptIntentMode)}
                                                disabled={isLoading}>
                                                <SelectTrigger
                                                    id='prompt-scene'
                                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className='z-[100] border-white/20 bg-black text-white'>
                                                    {SCENE_CATALOG.map((scene) => (
                                                        <SelectItem
                                                            key={scene.id}
                                                            value={scene.id}
                                                            className='focus:bg-white/10'>
                                                            {scene.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='prompt-style' className='text-xs text-white/70'>
                                                风格
                                            </Label>
                                            <Select value={styleId} onValueChange={setStyleId} disabled={isLoading}>
                                                <SelectTrigger
                                                    id='prompt-style'
                                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className='z-[100] border-white/20 bg-black text-white'>
                                                    {STYLE_CATALOG.map((style) => (
                                                        <SelectItem
                                                            key={style.id}
                                                            value={style.id}
                                                            className='focus:bg-white/10'>
                                                            {style.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='prompt-text-policy' className='text-xs text-white/70'>
                                                文字策略
                                            </Label>
                                            <Select
                                                value={textPolicy}
                                                onValueChange={(value) => setTextPolicy(value as PromptTextPolicy)}
                                                disabled={isLoading}>
                                                <SelectTrigger
                                                    id='prompt-text-policy'
                                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className='z-[100] border-white/20 bg-black text-white'>
                                                    {TEXT_POLICY_OPTIONS.map((option) => (
                                                        <SelectItem
                                                            key={option.value}
                                                            value={option.value}
                                                            className='focus:bg-white/10'>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='prompt-language' className='text-xs text-white/70'>
                                                语言
                                            </Label>
                                            <Select
                                                value={outputLanguage}
                                                onValueChange={(value) =>
                                                    setOutputLanguage(value as PromptOutputLanguage)
                                                }
                                                disabled={isLoading}>
                                                <SelectTrigger
                                                    id='prompt-language'
                                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className='z-[100] border-white/20 bg-black text-white'>
                                                    {LANGUAGE_OPTIONS.map((option) => (
                                                        <SelectItem
                                                            key={option.value}
                                                            value={option.value}
                                                            className='focus:bg-white/10'>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className='space-y-2 rounded-md border border-white/10 bg-black p-3'>
                                        <div className='flex items-center justify-between gap-3'>
                                            <Label className='text-xs font-medium text-white'>提示词检查器</Label>
                                            <span className='text-xs text-white/45'>
                                                {builtPrompt.blocks.length} 个控制块
                                            </span>
                                        </div>
                                        <pre className='max-h-44 overflow-y-auto rounded border border-white/10 bg-neutral-950 p-2 text-xs leading-5 break-words whitespace-pre-wrap text-white/70'>
                                            {builtPrompt.fullPrompt}
                                        </pre>
                                        <div className='flex flex-wrap gap-1.5'>
                                            {builtPrompt.blocks.map((promptBlock) => (
                                                <span
                                                    key={promptBlock.id}
                                                    className='rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-white/55'>
                                                    {getBlockTitleLabel(promptBlock.title)}
                                                </span>
                                            ))}
                                        </div>
                                        {builtPrompt.warnings.length > 0 && (
                                            <div className='space-y-1 text-xs text-amber-200'>
                                                {builtPrompt.warnings.map((warning) => (
                                                    <p key={warning}>{warning}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className='space-y-2'>
                                <Label htmlFor='n-slider' className='text-white'>
                                    图片数量：{n[0]}
                                </Label>
                                <Slider
                                    id='n-slider'
                                    min={1}
                                    max={10}
                                    step={1}
                                    value={n}
                                    onValueChange={setN}
                                    disabled={isLoading}
                                    className='mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                                />
                            </div>

                            <div className='space-y-3'>
                                <Label className='block text-white'>尺寸</Label>
                                <RadioGroup
                                    value={size}
                                    onValueChange={(value) => setSize(value as GenerationFormData['size'])}
                                    disabled={isLoading}
                                    className='flex flex-wrap gap-x-5 gap-y-3'>
                                    <RadioItemWithIcon value='auto' id='size-auto' label='自动' Icon={Sparkles} />
                                    {isGptImage2 && (
                                        <RadioItemWithIcon
                                            value='custom'
                                            id='size-custom'
                                            label='自定义'
                                            Icon={SquareDashed}
                                        />
                                    )}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div>
                                                <RadioItemWithIcon
                                                    value='square'
                                                    id='size-square'
                                                    label='方形'
                                                    Icon={Square}
                                                />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>{getPresetTooltip('square', model)}</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div>
                                                <RadioItemWithIcon
                                                    value='landscape'
                                                    id='size-landscape'
                                                    label='横向'
                                                    Icon={RectangleHorizontal}
                                                />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>{getPresetTooltip('landscape', model)}</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div>
                                                <RadioItemWithIcon
                                                    value='portrait'
                                                    id='size-portrait'
                                                    label='纵向'
                                                    Icon={RectangleVertical}
                                                />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>{getPresetTooltip('portrait', model)}</TooltipContent>
                                    </Tooltip>
                                </RadioGroup>
                                {isGptImage2 && size === 'custom' && (
                                    <div className='space-y-2 rounded-md border border-white/10 bg-white/5 p-3'>
                                        <div className='flex items-center gap-3'>
                                            <div className='flex-1 space-y-1'>
                                                <Label htmlFor='custom-width' className='text-xs text-white/70'>
                                                    宽度（px）
                                                </Label>
                                                <Input
                                                    id='custom-width'
                                                    type='number'
                                                    min={16}
                                                    max={3840}
                                                    step={16}
                                                    value={customWidth}
                                                    onChange={(e) => setCustomWidth(parseInt(e.target.value, 10) || 0)}
                                                    disabled={isLoading}
                                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'
                                                />
                                            </div>
                                            <span className='pt-5 text-white/60'>×</span>
                                            <div className='flex-1 space-y-1'>
                                                <Label htmlFor='custom-height' className='text-xs text-white/70'>
                                                    高度（px）
                                                </Label>
                                                <Input
                                                    id='custom-height'
                                                    type='number'
                                                    min={16}
                                                    max={3840}
                                                    step={16}
                                                    value={customHeight}
                                                    onChange={(e) => setCustomHeight(parseInt(e.target.value, 10) || 0)}
                                                    disabled={isLoading}
                                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'
                                                />
                                            </div>
                                        </div>
                                        <p className='text-xs text-white/50'>
                                            {(customWidth * customHeight).toLocaleString()} 像素（最大值的{' '}
                                            {(((customWidth * customHeight) / 8_294_400) * 100).toFixed(1)}%） ·{' '}
                                            {customWidth > 0 && customHeight > 0
                                                ? `${(Math.max(customWidth, customHeight) / Math.min(customWidth, customHeight)).toFixed(2)}:1 比例`
                                                : '—'}
                                        </p>
                                        {!customSizeValidation.valid && (
                                            <p className='text-xs text-red-400'>{customSizeValidation.reason}</p>
                                        )}
                                        <p className='text-xs text-white/40'>
                                            约束：宽高需为 16 的倍数，单边最大 3840px，宽高比不超过 3:1，总像素需在
                                            655,360 到 8,294,400 之间。
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className='space-y-3'>
                                <Label className='block text-white'>质量</Label>
                                <RadioGroup
                                    value={quality}
                                    onValueChange={(value) => setQuality(value as GenerationFormData['quality'])}
                                    disabled={isLoading}
                                    className='flex flex-wrap gap-x-5 gap-y-3'>
                                    <RadioItemWithIcon value='auto' id='quality-auto' label='自动' Icon={Sparkles} />
                                    <RadioItemWithIcon value='low' id='quality-low' label='低' Icon={Tally1} />
                                    <RadioItemWithIcon value='medium' id='quality-medium' label='中' Icon={Tally2} />
                                    <RadioItemWithIcon value='high' id='quality-high' label='高' Icon={Tally3} />
                                </RadioGroup>
                            </div>

                            {!isGptImage2 && (
                                <div className='space-y-3'>
                                    <Label className='block text-white'>背景</Label>
                                    <RadioGroup
                                        value={background}
                                        onValueChange={(value) =>
                                            setBackground(value as GenerationFormData['background'])
                                        }
                                        disabled={isLoading}
                                        className='flex flex-wrap gap-x-5 gap-y-3'>
                                        <RadioItemWithIcon value='auto' id='bg-auto' label='自动' Icon={Sparkles} />
                                        <RadioItemWithIcon
                                            value='opaque'
                                            id='bg-opaque'
                                            label='不透明'
                                            Icon={BrickWall}
                                        />
                                        <RadioItemWithIcon
                                            value='transparent'
                                            id='bg-transparent'
                                            label='透明'
                                            Icon={Eraser}
                                        />
                                    </RadioGroup>
                                </div>
                            )}

                            <div className='space-y-3'>
                                <Label className='block text-white'>输出格式</Label>
                                <RadioGroup
                                    value={outputFormat}
                                    onValueChange={(value) =>
                                        setOutputFormat(value as GenerationFormData['output_format'])
                                    }
                                    disabled={isLoading}
                                    className='flex flex-wrap gap-x-5 gap-y-3'>
                                    <RadioItemWithIcon value='png' id='format-png' label='PNG' Icon={FileImage} />
                                    <RadioItemWithIcon value='jpeg' id='format-jpeg' label='JPEG' Icon={FileImage} />
                                    <RadioItemWithIcon value='webp' id='format-webp' label='WebP' Icon={FileImage} />
                                </RadioGroup>
                            </div>

                            {showCompression && (
                                <div className='space-y-2 pt-2 transition-opacity duration-300'>
                                    <Label htmlFor='compression-slider' className='text-white'>
                                        压缩：{compression[0]}%
                                    </Label>
                                    <Slider
                                        id='compression-slider'
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={compression}
                                        onValueChange={setCompression}
                                        disabled={isLoading}
                                        className='mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                                    />
                                </div>
                            )}

                            <div className='space-y-3'>
                                <Label className='block text-white'>内容审核级别</Label>
                                <RadioGroup
                                    value={moderation}
                                    onValueChange={(value) => setModeration(value as GenerationFormData['moderation'])}
                                    disabled={isLoading}
                                    className='flex flex-wrap gap-x-5 gap-y-3'>
                                    <RadioItemWithIcon value='auto' id='mod-auto' label='自动' Icon={ShieldCheck} />
                                    <RadioItemWithIcon value='low' id='mod-low' label='低' Icon={ShieldAlert} />
                                </RadioGroup>
                            </div>
                        </>
                    )}
                </CardContent>
                {generationMode === 'single' && (
                    <CardFooter className='border-t border-white/10 p-4'>
                        <Button
                            type='submit'
                            disabled={isLoading || !prompt || customSizeInvalid}
                            className='flex w-full items-center justify-center gap-2 rounded-md bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                            {isLoading && <Loader2 className='h-4 w-4 animate-spin' />}
                            {isLoading ? '生成中...' : '生成'}
                        </Button>
                    </CardFooter>
                )}
            </form>
        </Card>
    );
}
