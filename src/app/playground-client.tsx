'use client';

import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { TaskQueuePanel, type QueueImageJob } from '@/components/task-queue-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { type SessionUser } from '@/lib/auth';
import type { CostDetails, GptImageModel } from '@/lib/cost-utils';
import { getPresetDimensions } from '@/lib/size-utils';
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

const MAX_EDIT_IMAGES = 10;

export default function ImagePlaygroundClient({ initialUser }: { initialUser: SessionUser }) {
    const [mode, setMode] = React.useState<'generate' | 'edit'>('generate');
    const [isCreatingJob, setIsCreatingJob] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [jobs, setJobs] = React.useState<QueueImageJob[]>([]);

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
            apiFormData.append('prompt', genPrompt);
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

    return (
        <main className='flex min-h-screen flex-col items-center bg-black p-4 text-white md:p-8 lg:p-12'>
            <div className='mb-4 flex w-full max-w-screen-2xl items-center justify-between text-sm text-white/70'>
                <div>
                    当前登录：{initialUser.email}（{initialUser.role === 'admin' ? '管理员' : '用户'}）
                </div>
                <div className='flex gap-3'>
                    {initialUser.role === 'admin' && (
                        <Link href='/admin' className='underline'>
                            管理员面板
                        </Link>
                    )}
                    <button type='button' onClick={handleLogout} className='underline'>
                        退出登录
                    </button>
                </div>
            </div>
            <div className='grid w-full max-w-screen-2xl grid-cols-1 gap-6 lg:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.05fr)]'>
                <div className='h-[78vh] min-h-[620px]'>
                    <TaskQueuePanel jobs={jobs} onClearQueue={handleClearQueue} />
                </div>

                <div className='relative flex h-[78vh] min-h-[620px] flex-col'>
                    {error && (
                        <Alert variant='destructive' className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                            <AlertTitle className='text-red-200'>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <div className={mode === 'generate' ? 'block h-full w-full' : 'hidden'}>
                        <GenerationForm
                            onSubmit={handleApiCall}
                            isLoading={isCreatingJob}
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
            </div>
        </main>
    );
}
