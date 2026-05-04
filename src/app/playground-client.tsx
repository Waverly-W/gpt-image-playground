'use client';

import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { PromptTemplateGallery } from '@/components/prompt-template-gallery';
import { TaskQueuePanel, type QueueImageJob } from '@/components/task-queue-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { type SessionUser } from '@/lib/auth';
import { createBatchJobFormData, type BatchGenerationRow } from '@/lib/batch-csv';
import type { CostDetails, GptImageModel } from '@/lib/cost-utils';
import type { PromptTemplate, PromptTemplateScene } from '@/lib/prompt-template-data';
import { getPresetDimensions } from '@/lib/size-utils';
import { Images, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Shield, WandSparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

type HistoryImage = {
    filename: string;
};

export type HistoryMetadata = {
    timestamp: number;
    images: HistoryImage[];
    storageModeUsed?: 'fs' | 'indexeddb' | 'r2';
    durationMs: number;
    quality: GenerationFormData['quality'];
    background: GenerationFormData['background'];
    moderation: GenerationFormData['moderation'];
    prompt: string;
    mode: 'generate' | 'edit';
    costDetails: CostDetails | null;
    output_format?: GenerationFormData['output_format'];
    model?: GptImageModel;
    ownerUserId?: string | null;
};

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

type ActiveSection = 'generate' | 'gallery';

const MAX_EDIT_IMAGES = 10;

export default function ImagePlaygroundClient({
    initialUser,
    promptTemplates,
    promptTemplateScenes
}: {
    initialUser: SessionUser;
    promptTemplates: Array<PromptTemplate & { imageUrl: string }>;
    promptTemplateScenes: PromptTemplateScene[];
}) {
    const [mode, setMode] = React.useState<'generate' | 'edit'>('generate');
    const [activeSection, setActiveSection] = React.useState<ActiveSection>('generate');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
    const [isCreatingJob, setIsCreatingJob] = React.useState(false);
    const [batchProgress, setBatchProgress] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [jobs, setJobs] = React.useState<QueueImageJob[]>([]);
    const formPanelRef = React.useRef<HTMLDivElement>(null);

    const router = useRouter();
    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
    const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
    const [editPrompt, setEditPrompt] = React.useState('');
    const [editN, setEditN] = React.useState([1]);
    const [editSize, setEditSize] = React.useState<EditingFormData['size']>('auto');
    const [editCustomWidth, setEditCustomWidth] = React.useState<number>(1024);
    const [editCustomHeight, setEditCustomHeight] = React.useState<number>(1024);
    const [editQuality, setEditQuality] = React.useState<EditingFormData['quality']>('auto');
    const [editBrushSize, setEditBrushSize] = React.useState([20]);
    const [editShowMaskEditor, setEditShowMaskEditor] = React.useState(false);
    const [editGeneratedMaskFile, setEditGeneratedMaskFile] = React.useState<File | null>(null);
    const [editIsMaskSaved, setEditIsMaskSaved] = React.useState(false);
    const [editOriginalImageSize, setEditOriginalImageSize] = React.useState<{ width: number; height: number } | null>(
        null
    );
    const [editDrawnPoints, setEditDrawnPoints] = React.useState<DrawnPoint[]>([]);
    const [editMaskPreviewUrl, setEditMaskPreviewUrl] = React.useState<string | null>(null);

    const [genModel, setGenModel] = React.useState<GenerationFormData['model']>('gpt-image-2');
    const [genPrompt, setGenPrompt] = React.useState('');
    const [genN, setGenN] = React.useState([1]);
    const [genSize, setGenSize] = React.useState<GenerationFormData['size']>('auto');
    const [genCustomWidth, setGenCustomWidth] = React.useState<number>(1024);
    const [genCustomHeight, setGenCustomHeight] = React.useState<number>(1024);
    const [genQuality, setGenQuality] = React.useState<GenerationFormData['quality']>('auto');
    const [genOutputFormat, setGenOutputFormat] = React.useState<GenerationFormData['output_format']>('png');
    const [genCompression, setGenCompression] = React.useState([100]);
    const [genBackground, setGenBackground] = React.useState<GenerationFormData['background']>('auto');
    const [genModeration, setGenModeration] = React.useState<GenerationFormData['moderation']>('auto');

    const [editModel, setEditModel] = React.useState<EditingFormData['model']>('gpt-image-2');
    const [enableStreaming, setEnableStreaming] = React.useState(false);
    const [partialImages, setPartialImages] = React.useState<1 | 2 | 3>(2);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (mode !== 'edit' || !event.clipboardData) {
                return;
            }

            if (editImageFiles.length >= MAX_EDIT_IMAGES) {
                alert(`无法粘贴：最多支持 ${MAX_EDIT_IMAGES} 张图片。`);
                return;
            }

            const items = event.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();
                        const previewUrl = URL.createObjectURL(file);
                        setEditImageFiles((prevFiles) => [...prevFiles, file]);
                        setEditSourceImagePreviewUrls((prevUrls) => [...prevUrls, previewUrl]);
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [mode, editImageFiles.length]);

    const loadJobs = React.useCallback(async () => {
        try {
            const response = await fetch('/api/image-jobs');
            if (!response.ok) return;

            const result = (await response.json()) as { jobs?: QueueImageJob[] };
            if (Array.isArray(result.jobs)) {
                setJobs(result.jobs);
            }
        } catch (jobLoadError) {
            console.error('Failed to load image jobs:', jobLoadError);
        }
    }, []);

    React.useEffect(() => {
        loadJobs();
        const interval = window.setInterval(loadJobs, 2000);
        return () => window.clearInterval(interval);
    }, [loadJobs]);

    const createApiFormData = (formData: GenerationFormData | EditingFormData): FormData => {
        const apiFormData = new FormData();
        apiFormData.append('mode', mode);

        if (mode === 'generate') {
            const genData = formData as GenerationFormData;
            apiFormData.append('model', genModel);
            apiFormData.append('prompt', genData.prompt);
            apiFormData.append('prompt_mode', genData.promptMode);
            if (genData.promptMode === 'guided' && genData.promptBuilderConfig) {
                apiFormData.append('prompt_builder_config', JSON.stringify(genData.promptBuilderConfig));
            }
            apiFormData.append('n', genN[0].toString());
            apiFormData.append(
                'size',
                genSize === 'custom'
                    ? `${genCustomWidth}x${genCustomHeight}`
                    : (getPresetDimensions(genSize, genModel) ?? genSize)
            );
            apiFormData.append('quality', genQuality);
            apiFormData.append('output_format', genOutputFormat);
            if (
                (genOutputFormat === 'jpeg' || genOutputFormat === 'webp') &&
                genData.output_compression !== undefined
            ) {
                apiFormData.append('output_compression', genData.output_compression.toString());
            }
            apiFormData.append('background', genBackground);
            apiFormData.append('moderation', genModeration);
            if (enableStreaming && genN[0] === 1) {
                apiFormData.append('stream', 'true');
                apiFormData.append('partial_images', partialImages.toString());
            }
            return apiFormData;
        }

        apiFormData.append('model', editModel);
        apiFormData.append('prompt', editPrompt);
        apiFormData.append('n', editN[0].toString());
        apiFormData.append(
            'size',
            editSize === 'custom'
                ? `${editCustomWidth}x${editCustomHeight}`
                : (getPresetDimensions(editSize, editModel) ?? editSize)
        );
        apiFormData.append('quality', editQuality);
        editImageFiles.forEach((file, index) => {
            apiFormData.append(`image_${index}`, file, file.name);
        });
        if (editGeneratedMaskFile) {
            apiFormData.append('mask', editGeneratedMaskFile, editGeneratedMaskFile.name);
        }
        if (enableStreaming && editN[0] === 1) {
            apiFormData.append('stream', 'true');
            apiFormData.append('partial_images', partialImages.toString());
        }

        return apiFormData;
    };

    const handleApiCall = async (formData: GenerationFormData | EditingFormData) => {
        setIsCreatingJob(true);
        setError(null);

        try {
            const response = await fetch('/api/image-jobs', {
                method: 'POST',
                body: createApiFormData(formData)
            });
            const result = (await response.json()) as { job?: QueueImageJob; error?: string };

            if (!response.ok || !result.job) {
                throw new Error(result.error || `任务请求失败，状态码 ${response.status}`);
            }

            setJobs((prev) => [result.job!, ...prev.filter((job) => job.id !== result.job!.id)]);
            void loadJobs();
        } catch (err: unknown) {
            console.error('Job creation error:', err);
            setError(err instanceof Error ? err.message : '创建任务失败。');
        } finally {
            setIsCreatingJob(false);
        }
    };

    const handleBatchApiCall = async (rows: BatchGenerationRow[]) => {
        setIsCreatingJob(true);
        setError(null);
        setBatchProgress(`正在创建 ${rows.length} 个批量任务`);

        try {
            const createdJobs = await Promise.all(
                rows.map(async (row, index) => {
                    const response = await fetch('/api/image-jobs', {
                        method: 'POST',
                        body: createBatchJobFormData(row)
                    });
                    const result = (await response.json()) as { job?: QueueImageJob; error?: string };

                    if (!response.ok || !result.job) {
                        throw new Error(result.error || `第 ${index + 1} 个任务创建失败，状态码 ${response.status}`);
                    }

                    return result.job;
                })
            );

            const newestFirst = [...createdJobs].reverse();
            setJobs((prev) => [
                ...newestFirst,
                ...prev.filter((job) => !createdJobs.some((created) => created.id === job.id))
            ]);
            setBatchProgress(`已创建 ${createdJobs.length} 个批量任务，队列将自动调度生成`);
            void loadJobs();
        } catch (batchError) {
            console.error('Batch job creation error:', batchError);
            setError(batchError instanceof Error ? batchError.message : '批量任务创建失败。');
        } finally {
            setIsCreatingJob(false);
            window.setTimeout(() => setBatchProgress(null), 3000);
        }
    };

    const handleCancelPendingJob = React.useCallback(
        async (jobId: string) => {
            try {
                const response = await fetch(`/api/image-jobs/${jobId}`, { method: 'DELETE' });
                if (!response.ok) {
                    const result = (await response.json()) as { error?: string };
                    throw new Error(result.error || `取消失败，状态码 ${response.status}`);
                }
                setJobs((prev) => prev.filter((job) => job.id !== jobId));
                setError(null);
                void loadJobs();
            } catch (cancelError) {
                console.error('Failed to cancel pending image job:', cancelError);
                setError(cancelError instanceof Error ? cancelError.message : '取消排队任务失败。');
            }
        },
        [loadJobs]
    );

    const handleClearQueue = React.useCallback(async () => {
        if (!window.confirm('确定清空任务队列吗？这会移除当前用户的任务记录。')) {
            return;
        }

        try {
            const response = await fetch('/api/image-jobs', { method: 'DELETE' });
            if (!response.ok) {
                const result = (await response.json()) as { error?: string };
                throw new Error(result.error || `清空失败，状态码 ${response.status}`);
            }
            setJobs([]);
            setError(null);
        } catch (clearError) {
            console.error('Failed to clear task queue:', clearError);
            setError(clearError instanceof Error ? clearError.message : '清空任务队列失败。');
        }
    }, []);

    const handleNavigate = React.useCallback((section: ActiveSection) => {
        setActiveSection(section);
        setIsMobileSidebarOpen(false);
    }, []);

    const handleImportPromptTemplate = React.useCallback((prompt: string) => {
        setActiveSection('generate');
        setMode('generate');
        setGenPrompt(prompt);
        setIsMobileSidebarOpen(false);
        formPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const navItems = [
        { id: 'generate' as const, label: '图片生成', Icon: Images },
        { id: 'gallery' as const, label: '提示词画廊', Icon: WandSparkles }
    ];

    const sidebarContent = (
        <div className='flex h-full flex-col bg-neutral-950 text-white'>
            <div className='flex min-h-16 items-center justify-between gap-3 border-b border-white/10 px-4'>
                <div className={`min-w-0 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
                    <p className='truncate text-lg font-semibold text-white'>Imgen</p>
                </div>
                <button
                    type='button'
                    onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
                    className='hidden min-h-10 min-w-10 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:inline-flex'
                    aria-label={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
                    {isSidebarCollapsed ? (
                        <PanelLeftOpen className='h-5 w-5' />
                    ) : (
                        <PanelLeftClose className='h-5 w-5' />
                    )}
                </button>
                <button
                    type='button'
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className='inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:hidden'
                    aria-label='关闭侧边栏'>
                    <X className='h-5 w-5' />
                </button>
            </div>

            <nav className='flex flex-1 flex-col gap-2 px-3 py-4' aria-label='主导航'>
                {navItems.map(({ id, label, Icon }) => {
                    const isActive = activeSection === id;

                    return (
                        <button
                            key={id}
                            type='button'
                            onClick={() => handleNavigate(id)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm transition-colors ${
                                isActive ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
                            } ${isSidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}>
                            <Icon className='h-5 w-5 shrink-0' aria-hidden='true' />
                            <span className={isSidebarCollapsed ? 'lg:sr-only' : ''}>{label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className='border-t border-white/10 p-3'>
                <div
                    className={`mb-3 rounded-md border border-white/10 bg-black px-3 py-2 ${
                        isSidebarCollapsed ? 'lg:hidden' : ''
                    }`}>
                    <span className='block truncate text-sm text-white/75'>{initialUser.email}</span>
                    <span className='text-xs text-white/40'>{initialUser.role === 'admin' ? '管理员' : '用户'}</span>
                </div>
                <div className='flex flex-col gap-2'>
                    {initialUser.role === 'admin' && (
                        <Link
                            href='/admin'
                            className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white ${
                                isSidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
                            }`}>
                            <Shield className='h-4 w-4 shrink-0' aria-hidden='true' />
                            <span className={isSidebarCollapsed ? 'lg:sr-only' : ''}>管理员面板</span>
                        </Link>
                    )}
                    <button
                        type='button'
                        onClick={handleLogout}
                        className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white ${
                            isSidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
                        }`}>
                        <LogOut className='h-4 w-4 shrink-0' aria-hidden='true' />
                        <span className={isSidebarCollapsed ? 'lg:sr-only' : ''}>退出登录</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <main className='min-h-screen bg-black text-white'>
            {isMobileSidebarOpen && (
                <button
                    type='button'
                    className='fixed inset-0 z-40 bg-black/70 lg:hidden'
                    onClick={() => setIsMobileSidebarOpen(false)}
                    aria-label='关闭侧边栏遮罩'
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 transition-transform duration-200 lg:translate-x-0 ${
                    isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
                {sidebarContent}
            </aside>

            <div
                className={`min-h-screen transition-[padding] duration-200 ${
                    isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
                }`}>
                <header className='sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-white/10 bg-black/95 px-4 backdrop-blur md:px-6 lg:px-8'>
                    <div className='flex min-w-0 items-center gap-3'>
                        <button
                            type='button'
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className='inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-white/10 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden'
                            aria-label='打开侧边栏'>
                            <Menu className='h-5 w-5' />
                        </button>
                        <div className='min-w-0'>
                            <h1 className='truncate text-lg font-semibold text-white'>
                                {activeSection === 'generate' ? '图片生成' : '提示词画廊'}
                            </h1>
                        </div>
                    </div>
                </header>

                <div className='px-4 py-6 md:px-6 lg:px-8'>
                    {activeSection === 'generate' ? (
                        <section className='grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(380px,480px)_minmax(0,1fr)]'>
                            <div
                                ref={formPanelRef}
                                data-panel='form'
                                className='relative flex min-h-[640px] flex-col lg:sticky lg:top-22 lg:h-[calc(100dvh-7rem)]'>
                                {error && (
                                    <Alert
                                        variant='destructive'
                                        className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                                        <AlertTitle className='text-red-200'>错误</AlertTitle>
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
                                <div className={mode === 'generate' ? 'block h-full w-full' : 'hidden'}>
                                    <GenerationForm
                                        onSubmit={handleApiCall}
                                        onBatchSubmit={handleBatchApiCall}
                                        isLoading={isCreatingJob}
                                        batchProgress={batchProgress}
                                        currentMode={mode}
                                        onModeChange={setMode}
                                        model={genModel}
                                        setModel={setGenModel}
                                        prompt={genPrompt}
                                        setPrompt={setGenPrompt}
                                        n={genN}
                                        setN={setGenN}
                                        size={genSize}
                                        setSize={setGenSize}
                                        customWidth={genCustomWidth}
                                        setCustomWidth={setGenCustomWidth}
                                        customHeight={genCustomHeight}
                                        setCustomHeight={setGenCustomHeight}
                                        quality={genQuality}
                                        setQuality={setGenQuality}
                                        outputFormat={genOutputFormat}
                                        setOutputFormat={setGenOutputFormat}
                                        compression={genCompression}
                                        setCompression={setGenCompression}
                                        background={genBackground}
                                        setBackground={setGenBackground}
                                        moderation={genModeration}
                                        setModeration={setGenModeration}
                                        enableStreaming={enableStreaming}
                                        setEnableStreaming={setEnableStreaming}
                                        partialImages={partialImages}
                                        setPartialImages={setPartialImages}
                                    />
                                </div>
                                <div className={mode === 'edit' ? 'block h-full w-full' : 'hidden'}>
                                    <EditingForm
                                        onSubmit={handleApiCall}
                                        isLoading={isCreatingJob}
                                        currentMode={mode}
                                        onModeChange={setMode}
                                        editModel={editModel}
                                        setEditModel={setEditModel}
                                        imageFiles={editImageFiles}
                                        sourceImagePreviewUrls={editSourceImagePreviewUrls}
                                        setImageFiles={setEditImageFiles}
                                        setSourceImagePreviewUrls={setEditSourceImagePreviewUrls}
                                        maxImages={MAX_EDIT_IMAGES}
                                        editPrompt={editPrompt}
                                        setEditPrompt={setEditPrompt}
                                        editN={editN}
                                        setEditN={setEditN}
                                        editSize={editSize}
                                        setEditSize={setEditSize}
                                        editCustomWidth={editCustomWidth}
                                        setEditCustomWidth={setEditCustomWidth}
                                        editCustomHeight={editCustomHeight}
                                        setEditCustomHeight={setEditCustomHeight}
                                        editQuality={editQuality}
                                        setEditQuality={setEditQuality}
                                        editBrushSize={editBrushSize}
                                        setEditBrushSize={setEditBrushSize}
                                        editShowMaskEditor={editShowMaskEditor}
                                        setEditShowMaskEditor={setEditShowMaskEditor}
                                        editGeneratedMaskFile={editGeneratedMaskFile}
                                        setEditGeneratedMaskFile={setEditGeneratedMaskFile}
                                        editIsMaskSaved={editIsMaskSaved}
                                        setEditIsMaskSaved={setEditIsMaskSaved}
                                        editOriginalImageSize={editOriginalImageSize}
                                        setEditOriginalImageSize={setEditOriginalImageSize}
                                        editDrawnPoints={editDrawnPoints}
                                        setEditDrawnPoints={setEditDrawnPoints}
                                        editMaskPreviewUrl={editMaskPreviewUrl}
                                        setEditMaskPreviewUrl={setEditMaskPreviewUrl}
                                        enableStreaming={enableStreaming}
                                        setEnableStreaming={setEnableStreaming}
                                        partialImages={partialImages}
                                        setPartialImages={setPartialImages}
                                    />
                                </div>
                            </div>

                            <div data-panel='task-queue' className='min-h-[640px] lg:h-[calc(100dvh-7rem)]'>
                                <TaskQueuePanel
                                    jobs={jobs}
                                    onClearQueue={handleClearQueue}
                                    onCancelPendingJob={handleCancelPendingJob}
                                />
                            </div>
                        </section>
                    ) : (
                        <PromptTemplateGallery
                            templates={promptTemplates}
                            scenes={promptTemplateScenes}
                            onImportPrompt={handleImportPromptTemplate}
                        />
                    )}
                </div>
            </div>
        </main>
    );
}
