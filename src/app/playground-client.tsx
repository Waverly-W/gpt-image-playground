'use client';

import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { type SessionUser } from '@/lib/auth';
import { calculateApiCost, type CostDetails, type GptImageModel } from '@/lib/cost-utils';
import { db, type ImageRecord } from '@/lib/db';
import { filterHistoryBySession } from '@/lib/history-visibility';
import { getPresetDimensions } from '@/lib/size-utils';
import { useLiveQuery } from 'dexie-react-hooks';
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

let effectiveStorageModeClient: 'fs' | 'indexeddb' | 'r2' = 'fs';

type ApiImageResponseItem = {
    filename: string;
    b64_json?: string;
    output_format: string;
    path?: string;
};

type ApiStorageMode = 'fs' | 'indexeddb' | 'r2';

type DisplayImage = {
    path: string;
    filename: string;
    storageMode?: ApiStorageMode;
};

type ImageJobDto = {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    mode: 'generate' | 'edit';
    prompt: string;
    model: GptImageModel;
    params: Record<string, unknown>;
    images: Array<{ filename: string; path?: string; output_format?: string }>;
    storageModeUsed: ApiStorageMode | null;
    durationMs: number | null;
    costDetails: CostDetails | null;
    error: string | null;
    createdAt: string;
    updatedAt: string;
    finishedAt: string | null;
};

export default function ImagePlaygroundClient({ initialUser }: { initialUser: SessionUser }) {
    const [mode, setMode] = React.useState<'generate' | 'edit'>('generate');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSendingToEdit, setIsSendingToEdit] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [latestImageBatch, setLatestImageBatch] = React.useState<DisplayImage[] | null>(null);
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [activeJobIds, setActiveJobIds] = React.useState<string[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState<boolean>(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState<boolean>(false);

    const router = useRouter();
    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    const allDbImages = useLiveQuery<ImageRecord[] | undefined>(() => db.images.toArray(), []);

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

    // Streaming state (shared between generate and edit modes)
    const [enableStreaming, setEnableStreaming] = React.useState(false);
    const [partialImages, setPartialImages] = React.useState<1 | 2 | 3>(2);
    // Streaming preview images (base64 data URLs for partial images during streaming)
    const [streamingPreviewImages, setStreamingPreviewImages] = React.useState<Map<number, string>>(new Map());

    const getImageSrc = React.useCallback(
        (filename: string): string | undefined => {
            const cached = blobUrlCacheRef.current.get(filename);
            if (cached) return cached;

            const record = allDbImages?.find((img) => img.filename === filename);
            if (record?.blob) {
                const url = URL.createObjectURL(record.blob);
                blobUrlCacheRef.current.set(filename, url);
                return url;
            }

            return undefined;
        },
        [allDbImages]
    );

    React.useEffect(() => {
        const cache = blobUrlCacheRef.current;
        return () => {
            cache.forEach((url) => URL.revokeObjectURL(url));
            cache.clear();
        };
    }, []);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('openaiImageHistory');
            if (storedHistory) {
                const parsedHistory: HistoryMetadata[] = JSON.parse(storedHistory);
                if (Array.isArray(parsedHistory)) {
                    setHistory(filterHistoryBySession(parsedHistory, initialUser));
                } else {
                    console.warn('Invalid history data found in localStorage.');
                    localStorage.removeItem('openaiImageHistory');
                }
            }
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem('openaiImageHistory');
        }
        setIsInitialLoad(false);
    }, [initialUser]);

    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem('openaiImageHistory', JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        const storedPref = localStorage.getItem('imageGenSkipDeleteConfirm');
        if (storedPref === 'true') {
            setSkipDeleteConfirmation(true);
        } else if (storedPref === 'false') {
            setSkipDeleteConfirmation(false);
        }
    }, []);

    React.useEffect(() => {
        localStorage.setItem('imageGenSkipDeleteConfirm', String(skipDeleteConfirmation));
    }, [skipDeleteConfirmation]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (mode !== 'edit' || !event.clipboardData) {
                return;
            }

            if (editImageFiles.length >= MAX_EDIT_IMAGES) {
                alert(`Cannot paste: Maximum of ${MAX_EDIT_IMAGES} images reached.`);
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

        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [mode, editImageFiles.length]);

    const getMimeTypeFromFormat = (format: string): string => {
        if (format === 'jpeg') return 'image/jpeg';
        if (format === 'webp') return 'image/webp';

        return 'image/png';
    };

    const jobToHistoryEntry = React.useCallback(
        (job: ImageJobDto): HistoryMetadata | null => {
            if (job.status !== 'completed' || job.images.length === 0) return null;
            const quality =
                typeof job.params.quality === 'string'
                    ? (job.params.quality as GenerationFormData['quality'])
                    : ('auto' as const);
            const background =
                typeof job.params.background === 'string'
                    ? (job.params.background as GenerationFormData['background'])
                    : ('auto' as const);
            const moderation =
                typeof job.params.moderation === 'string'
                    ? (job.params.moderation as GenerationFormData['moderation'])
                    : ('auto' as const);
            const outputFormat =
                typeof job.params.output_format === 'string'
                    ? (job.params.output_format as GenerationFormData['output_format'])
                    : ((job.images[0]?.output_format as GenerationFormData['output_format']) ?? 'png');

            return {
                timestamp: new Date(job.finishedAt ?? job.updatedAt).getTime(),
                images: job.images.map((img) => ({ filename: img.filename })),
                storageModeUsed: job.storageModeUsed ?? 'fs',
                durationMs: job.durationMs ?? 0,
                quality,
                background,
                moderation,
                output_format: outputFormat,
                prompt: job.prompt,
                mode: job.mode,
                costDetails: job.costDetails,
                model: job.model,
                ownerUserId: initialUser.id
            };
        },
        [initialUser.id]
    );

    const imageBatchFromJob = React.useCallback((job: ImageJobDto): DisplayImage[] => {
        const storageMode = job.storageModeUsed ?? 'fs';
        return job.images.map((image) => ({
            filename: image.filename,
            path: image.path ?? `/api/image/${image.filename}`,
            storageMode
        }));
    }, []);

    const upsertCompletedJobHistory = React.useCallback(
        (job: ImageJobDto) => {
            const entry = jobToHistoryEntry(job);
            if (!entry) return;

            setHistory((prevHistory) => {
                const withoutDuplicate = prevHistory.filter(
                    (item) =>
                        !(
                            item.images.length === entry.images.length &&
                            item.images.every((image, index) => image.filename === entry.images[index]?.filename)
                        )
                );
                return [entry, ...withoutDuplicate].sort((a, b) => b.timestamp - a.timestamp);
            });
        },
        [jobToHistoryEntry]
    );

    React.useEffect(() => {
        let cancelled = false;

        const loadJobs = async () => {
            try {
                const response = await fetch('/api/image-jobs');
                if (!response.ok) return;
                const result = (await response.json()) as { jobs?: ImageJobDto[] };
                if (cancelled || !Array.isArray(result.jobs)) return;

                const activeIds: string[] = [];
                result.jobs.forEach((job) => {
                    if (job.status === 'completed') {
                        upsertCompletedJobHistory(job);
                    } else if (job.status === 'pending' || job.status === 'running') {
                        activeIds.push(job.id);
                    }
                });
                setActiveJobIds(activeIds);
            } catch (jobLoadError) {
                console.error('Failed to load image jobs:', jobLoadError);
            }
        };

        loadJobs();

        return () => {
            cancelled = true;
        };
    }, [upsertCompletedJobHistory]);

    React.useEffect(() => {
        if (activeJobIds.length === 0) return;

        let cancelled = false;
        const poll = async () => {
            try {
                const settledIds = new Set<string>();
                await Promise.all(
                    activeJobIds.map(async (jobId) => {
                        const response = await fetch(`/api/image-jobs/${jobId}`);
                        if (!response.ok) return;

                        const result = (await response.json()) as { job?: ImageJobDto };
                        const job = result.job;
                        if (!job || cancelled) return;

                        if (job.status === 'completed') {
                            settledIds.add(job.id);
                            upsertCompletedJobHistory(job);
                            const batch = imageBatchFromJob(job);
                            setLatestImageBatch(batch);
                            setImageOutputView(batch.length > 1 ? 'grid' : 0);
                            setError(null);
                        } else if (job.status === 'failed') {
                            settledIds.add(job.id);
                            setError(job.error || 'Image generation failed.');
                        }
                    })
                );

                if (!cancelled && settledIds.size > 0) {
                    setActiveJobIds((prev) => prev.filter((id) => !settledIds.has(id)));
                }
            } catch (pollError) {
                console.error('Failed to poll image jobs:', pollError);
            }
        };

        poll();
        const interval = window.setInterval(poll, 2000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [activeJobIds, imageBatchFromJob, upsertCompletedJobHistory]);

    const handleApiCall = async (formData: GenerationFormData | EditingFormData) => {
        const startTime = Date.now();
        let durationMs = 0;

        setIsLoading(true);
        setError(null);
        setLatestImageBatch(null);
        setImageOutputView('grid');
        setStreamingPreviewImages(new Map());

        const apiFormData = new FormData();
        apiFormData.append('mode', mode);

        // Add streaming parameters if enabled
        if (enableStreaming) {
            apiFormData.append('stream', 'true');
            apiFormData.append('partial_images', partialImages.toString());
        }

        if (mode === 'generate') {
            const genData = formData as GenerationFormData;
            apiFormData.append('model', genModel);
            apiFormData.append('prompt', genPrompt);
            apiFormData.append('n', genN[0].toString());
            const genSizeToSend =
                genSize === 'custom'
                    ? `${genCustomWidth}x${genCustomHeight}`
                    : (getPresetDimensions(genSize, genModel) ?? genSize);
            apiFormData.append('size', genSizeToSend);
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
        } else {
            apiFormData.append('model', editModel);
            apiFormData.append('prompt', editPrompt);
            apiFormData.append('n', editN[0].toString());
            const editSizeToSend =
                editSize === 'custom'
                    ? `${editCustomWidth}x${editCustomHeight}`
                    : (getPresetDimensions(editSize, editModel) ?? editSize);
            apiFormData.append('size', editSizeToSend);
            apiFormData.append('quality', editQuality);

            editImageFiles.forEach((file, index) => {
                apiFormData.append(`image_${index}`, file, file.name);
            });
            if (editGeneratedMaskFile) {
                apiFormData.append('mask', editGeneratedMaskFile, editGeneratedMaskFile.name);
            }
        }

        try {
            if (!enableStreaming) {
                const response = await fetch('/api/image-jobs', {
                    method: 'POST',
                    body: apiFormData
                });
                const result = (await response.json()) as { job?: ImageJobDto; error?: string };

                if (!response.ok || !result.job) {
                    throw new Error(result.error || `Job request failed with status ${response.status}`);
                }

                setActiveJobIds((prev) => (prev.includes(result.job!.id) ? prev : [result.job!.id, ...prev]));
                return;
            }

            const response = await fetch('/api/images', {
                method: 'POST',
                body: apiFormData
            });

            // Check if response is SSE (streaming)
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/event-stream')) {
                if (!response.body) {
                    throw new Error('Response body is null');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Process complete SSE events
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep incomplete event in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.slice(6);
                            try {
                                const event = JSON.parse(jsonStr);

                                if (event.type === 'partial_image') {
                                    // Update streaming preview with partial image
                                    const imageIndex = event.index ?? 0;
                                    const dataUrl = `data:image/png;base64,${event.b64_json}`;
                                    setStreamingPreviewImages((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(imageIndex, dataUrl);
                                        return newMap;
                                    });
                                } else if (event.type === 'error') {
                                    throw new Error(event.error || 'Streaming error occurred');
                                } else if (event.type === 'done') {
                                    // Finalize with all completed images
                                    durationMs = Date.now() - startTime;

                                    if (event.images && event.images.length > 0) {
                                        const responseStorageMode: ApiStorageMode =
                                            event.storageMode === 'indexeddb' || event.storageMode === 'r2'
                                                ? event.storageMode
                                                : 'fs';
                                        effectiveStorageModeClient = responseStorageMode;
                                        let historyQuality: GenerationFormData['quality'] = 'auto';
                                        let historyBackground: GenerationFormData['background'] = 'auto';
                                        let historyModeration: GenerationFormData['moderation'] = 'auto';
                                        let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                                        let historyPrompt: string = '';

                                        if (mode === 'generate') {
                                            historyQuality = genQuality;
                                            historyBackground = genBackground;
                                            historyModeration = genModeration;
                                            historyOutputFormat = genOutputFormat;
                                            historyPrompt = genPrompt;
                                        } else {
                                            historyQuality = editQuality;
                                            historyBackground = 'auto';
                                            historyModeration = 'auto';
                                            historyOutputFormat = 'png';
                                            historyPrompt = editPrompt;
                                        }

                                        const currentModel = mode === 'generate' ? genModel : editModel;
                                        const costDetails = calculateApiCost(event.usage, currentModel);

                                        const batchTimestamp = Date.now();
                                        const newHistoryEntry: HistoryMetadata = {
                                            timestamp: batchTimestamp,
                                            images: event.images.map((img: { filename: string }) => ({
                                                filename: img.filename
                                            })),
                                            storageModeUsed: responseStorageMode,
                                            durationMs: durationMs,
                                            quality: historyQuality,
                                            background: historyBackground,
                                            moderation: historyModeration,
                                            output_format: historyOutputFormat,
                                            prompt: historyPrompt,
                                            mode: mode,
                                            costDetails: costDetails,
                                            model: currentModel,
                                            ownerUserId: initialUser.id
                                        };

                                        let newImageBatchPromises: Promise<DisplayImage | null>[] = [];
                                        if (responseStorageMode === 'indexeddb') {
                                            newImageBatchPromises = event.images.map(
                                                async (img: ApiImageResponseItem) => {
                                                    if (img.b64_json) {
                                                        try {
                                                            const byteCharacters = atob(img.b64_json);
                                                            const byteNumbers = new Array(byteCharacters.length);
                                                            for (let i = 0; i < byteCharacters.length; i++) {
                                                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                                                            }
                                                            const byteArray = new Uint8Array(byteNumbers);

                                                            const actualMimeType = getMimeTypeFromFormat(
                                                                img.output_format
                                                            );
                                                            const blob = new Blob([byteArray], {
                                                                type: actualMimeType
                                                            });

                                                            await db.images.put({ filename: img.filename, blob });

                                                            const blobUrl = URL.createObjectURL(blob);
                                                            blobUrlCacheRef.current.set(img.filename, blobUrl);

                                                            return {
                                                                filename: img.filename,
                                                                path: blobUrl,
                                                                storageMode: responseStorageMode
                                                            };
                                                        } catch (dbError) {
                                                            console.error(
                                                                `Error saving blob ${img.filename} to IndexedDB:`,
                                                                dbError
                                                            );
                                                            setError(
                                                                `Failed to save image ${img.filename} to local database.`
                                                            );
                                                            return null;
                                                        }
                                                    } else {
                                                        console.warn(
                                                            `Image ${img.filename} missing b64_json in indexeddb mode.`
                                                        );
                                                        return null;
                                                    }
                                                }
                                            );
                                        } else {
                                            newImageBatchPromises = event.images
                                                .filter((img: ApiImageResponseItem) => !!img.path)
                                                .map((img: ApiImageResponseItem) =>
                                                    Promise.resolve({
                                                        path: img.path!,
                                                        filename: img.filename,
                                                        storageMode: responseStorageMode
                                                    })
                                                );
                                        }

                                        const processedImages = (await Promise.all(newImageBatchPromises)).filter(
                                            Boolean
                                        ) as DisplayImage[];

                                        setLatestImageBatch(processedImages);
                                        setImageOutputView(processedImages.length > 1 ? 'grid' : 0);
                                        setStreamingPreviewImages(new Map()); // Clear streaming previews

                                        setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
                                    }
                                }
                            } catch (parseError) {
                                console.error('Error parsing SSE event:', parseError);
                            }
                        }
                    }
                }

                return; // Exit early for streaming
            }

            // Non-streaming response handling (original code)
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `API request failed with status ${response.status}`);
            }

            if (result.images && result.images.length > 0) {
                durationMs = Date.now() - startTime;
                const responseStorageMode: ApiStorageMode =
                    result.storageMode === 'indexeddb' || result.storageMode === 'r2' ? result.storageMode : 'fs';
                effectiveStorageModeClient = responseStorageMode;

                let historyQuality: GenerationFormData['quality'] = 'auto';
                let historyBackground: GenerationFormData['background'] = 'auto';
                let historyModeration: GenerationFormData['moderation'] = 'auto';
                let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                let historyPrompt: string = '';

                if (mode === 'generate') {
                    historyQuality = genQuality;
                    historyBackground = genBackground;
                    historyModeration = genModeration;
                    historyOutputFormat = genOutputFormat;
                    historyPrompt = genPrompt;
                } else {
                    historyQuality = editQuality;
                    historyBackground = 'auto';
                    historyModeration = 'auto';
                    historyOutputFormat = 'png';
                    historyPrompt = editPrompt;
                }

                const currentModel = mode === 'generate' ? genModel : editModel;
                const costDetails = calculateApiCost(result.usage, currentModel);

                const batchTimestamp = Date.now();
                const newHistoryEntry: HistoryMetadata = {
                    timestamp: batchTimestamp,
                    images: result.images.map((img: { filename: string }) => ({ filename: img.filename })),
                    storageModeUsed: responseStorageMode,
                    durationMs: durationMs,
                    quality: historyQuality,
                    background: historyBackground,
                    moderation: historyModeration,
                    output_format: historyOutputFormat,
                    prompt: historyPrompt,
                    mode: mode,
                    costDetails: costDetails,
                    model: currentModel,
                    ownerUserId: initialUser.id
                };

                let newImageBatchPromises: Promise<DisplayImage | null>[] = [];
                if (responseStorageMode === 'indexeddb') {
                    newImageBatchPromises = result.images.map(async (img: ApiImageResponseItem) => {
                        if (img.b64_json) {
                            try {
                                const byteCharacters = atob(img.b64_json);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);

                                const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                const blob = new Blob([byteArray], { type: actualMimeType });

                                await db.images.put({ filename: img.filename, blob });

                                const blobUrl = URL.createObjectURL(blob);
                                blobUrlCacheRef.current.set(img.filename, blobUrl);

                                return { filename: img.filename, path: blobUrl, storageMode: responseStorageMode };
                            } catch (dbError) {
                                console.error(`Error saving blob ${img.filename} to IndexedDB:`, dbError);
                                setError(`Failed to save image ${img.filename} to local database.`);
                                return null;
                            }
                        } else {
                            console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
                            return null;
                        }
                    });
                } else {
                    newImageBatchPromises = result.images
                        .filter((img: ApiImageResponseItem) => !!img.path)
                        .map((img: ApiImageResponseItem) =>
                            Promise.resolve({
                                path: img.path!,
                                filename: img.filename,
                                storageMode: responseStorageMode
                            })
                        );
                }

                const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as DisplayImage[];

                setLatestImageBatch(processedImages);
                setImageOutputView(processedImages.length > 1 ? 'grid' : 0);

                setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
            } else {
                setLatestImageBatch(null);
                throw new Error('API response did not contain valid image data or filenames.');
            }
        } catch (err: unknown) {
            durationMs = Date.now() - startTime;
            console.error(`API Call Error after ${durationMs}ms:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);
            setLatestImageBatch(null);
            setStreamingPreviewImages(new Map());
        } finally {
            if (durationMs === 0) durationMs = Date.now() - startTime;
            setIsLoading(false);
        }
    };

    const handleHistorySelect = React.useCallback(
        (item: HistoryMetadata) => {
            const originalStorageMode = item.storageModeUsed || 'fs';

            const selectedBatchPromises = item.images.map(async (imgInfo) => {
                let path: string | undefined;
                if (originalStorageMode === 'indexeddb') {
                    path = getImageSrc(imgInfo.filename);
                } else {
                    path = `/api/image/${imgInfo.filename}`;
                }

                if (path) {
                    return { path, filename: imgInfo.filename, storageMode: originalStorageMode };
                } else {
                    console.warn(
                        `Could not get image source for history item: ${imgInfo.filename} (mode: ${originalStorageMode})`
                    );
                    setError(`Image ${imgInfo.filename} could not be loaded.`);
                    return null;
                }
            });

            Promise.all(selectedBatchPromises).then((resolvedBatch) => {
                const validImages = resolvedBatch.filter(Boolean) as DisplayImage[];

                if (validImages.length !== item.images.length) {
                    setError(
                        'Some images from this history entry could not be loaded (they might have been cleared or are missing).'
                    );
                } else {
                    setError(null);
                }

                setLatestImageBatch(validImages.length > 0 ? validImages : null);
                setImageOutputView(validImages.length > 1 ? 'grid' : 0);
            });
        },
        [getImageSrc]
    );

    const handleClearHistory = React.useCallback(async () => {
        const confirmationMessage =
            effectiveStorageModeClient === 'indexeddb'
                ? 'Are you sure you want to clear the entire image history? In IndexedDB mode, this will also permanently delete all stored images. This cannot be undone.'
                : 'Are you sure you want to clear the entire image history? This cannot be undone.';

        if (window.confirm(confirmationMessage)) {
            setHistory([]);
            setLatestImageBatch(null);
            setImageOutputView('grid');
            setError(null);

            try {
                localStorage.removeItem('openaiImageHistory');
                await fetch('/api/image-jobs', { method: 'DELETE' });
                setActiveJobIds([]);

                if (effectiveStorageModeClient === 'indexeddb') {
                    await db.images.clear();
                    blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                    blobUrlCacheRef.current.clear();
                }
            } catch (e) {
                console.error('Failed during history clearing:', e);
                setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }, []);

    const handleSendToEdit = async (filename: string) => {
        if (isSendingToEdit) return;
        setIsSendingToEdit(true);
        setError(null);

        const alreadyExists = editImageFiles.some((file) => file.name === filename);
        if (mode === 'edit' && alreadyExists) {
            setIsSendingToEdit(false);
            return;
        }

        if (mode === 'edit' && editImageFiles.length >= MAX_EDIT_IMAGES) {
            setError(`Cannot add more than ${MAX_EDIT_IMAGES} images to the edit form.`);
            setIsSendingToEdit(false);
            return;
        }

        try {
            let blob: Blob | undefined;
            let mimeType: string = 'image/png';

            const sourceStorageMode =
                latestImageBatch?.find((image) => image.filename === filename)?.storageMode ??
                effectiveStorageModeClient;

            if (sourceStorageMode === 'indexeddb') {
                const record = allDbImages?.find((img) => img.filename === filename);
                if (record?.blob) {
                    blob = record.blob;
                    mimeType = blob.type || mimeType;
                } else {
                    throw new Error(`Image ${filename} not found in local database.`);
                }
            } else {
                const response = await fetch(`/api/image/${filename}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.statusText}`);
                }
                blob = await response.blob();
                mimeType = response.headers.get('Content-Type') || mimeType;
            }

            if (!blob) {
                throw new Error(`Could not retrieve image data for ${filename}.`);
            }

            const newFile = new File([blob], filename, { type: mimeType });
            const newPreviewUrl = URL.createObjectURL(blob);

            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

            setEditImageFiles([newFile]);
            setEditSourceImagePreviewUrls([newPreviewUrl]);

            if (mode === 'generate') {
                setMode('edit');
            }
        } catch (err: unknown) {
            console.error('Error sending image to edit:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to send image to edit form.';
            setError(errorMessage);
        } finally {
            setIsSendingToEdit(false);
        }
    };

    const executeDeleteItem = React.useCallback(async (item: HistoryMetadata) => {
        if (!item) return;
        setError(null);

        const { images: imagesInEntry, storageModeUsed, timestamp } = item;
        const filenamesToDelete = imagesInEntry.map((img) => img.filename);

        try {
            if (storageModeUsed === 'indexeddb') {
                await db.images.where('filename').anyOf(filenamesToDelete).delete();
                filenamesToDelete.forEach((fn) => {
                    const url = blobUrlCacheRef.current.get(fn);
                    if (url) URL.revokeObjectURL(url);
                    blobUrlCacheRef.current.delete(fn);
                });
            } else if (storageModeUsed === 'fs' || storageModeUsed === 'r2') {
                const apiPayload: { filenames: string[] } = {
                    filenames: filenamesToDelete
                };

                const response = await fetch('/api/image-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiPayload)
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || `API deletion failed with status ${response.status}`);
                }
            }

            setHistory((prevHistory) => prevHistory.filter((h) => h.timestamp !== timestamp));
            setLatestImageBatch((prev) =>
                prev && prev.some((img) => filenamesToDelete.includes(img.filename)) ? null : prev
            );
        } catch (e: unknown) {
            console.error('Error during item deletion:', e);
            setError(e instanceof Error ? e.message : 'An unexpected error occurred during deletion.');
        } finally {
            setItemToDeleteConfirm(null);
        }
    }, []);

    const handleRequestDeleteItem = React.useCallback(
        (item: HistoryMetadata) => {
            if (!skipDeleteConfirmation) {
                setDialogCheckboxStateSkipConfirm(skipDeleteConfirmation);
                setItemToDeleteConfirm(item);
            } else {
                executeDeleteItem(item);
            }
        },
        [skipDeleteConfirmation, executeDeleteItem]
    );

    const handleConfirmDeletion = React.useCallback(() => {
        if (itemToDeleteConfirm) {
            executeDeleteItem(itemToDeleteConfirm);
            setSkipDeleteConfirmation(dialogCheckboxStateSkipConfirm);
        }
    }, [itemToDeleteConfirm, executeDeleteItem, dialogCheckboxStateSkipConfirm]);

    const handleCancelDeletion = React.useCallback(() => {
        setItemToDeleteConfirm(null);
    }, []);

    const isGenerationBusy = isLoading || activeJobIds.length > 0;
    const isOutputBusy = isGenerationBusy || isSendingToEdit;

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
            <div className='w-full max-w-screen-2xl space-y-6'>
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                    <div className='relative flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        <div className={mode === 'generate' ? 'block h-full w-full' : 'hidden'}>
                            <GenerationForm
                                onSubmit={handleApiCall}
                                isLoading={isGenerationBusy}
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
                                isLoading={isOutputBusy}
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
                    <div className='flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        {error && (
                            <Alert variant='destructive' className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                                <AlertTitle className='text-red-200'>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <ImageOutput
                            imageBatch={latestImageBatch}
                            viewMode={imageOutputView}
                            onViewChange={setImageOutputView}
                            altText='Generated image output'
                            isLoading={isOutputBusy}
                            onSendToEdit={handleSendToEdit}
                            currentMode={mode}
                            baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
                            streamingPreviewImages={streamingPreviewImages}
                        />
                    </div>
                </div>

                <div className='min-h-[450px]'>
                    <HistoryPanel
                        history={history}
                        onSelectImage={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getImageSrc={getImageSrc}
                        onDeleteItemRequest={handleRequestDeleteItem}
                        itemPendingDeleteConfirmation={itemToDeleteConfirm}
                        onConfirmDeletion={handleConfirmDeletion}
                        onCancelDeletion={handleCancelDeletion}
                        deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                        onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                    />
                </div>
            </div>
        </main>
    );
}
