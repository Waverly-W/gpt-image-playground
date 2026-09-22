import { recordImageOwner } from '@/lib/image-ownership';
import { putR2Image, resolveImageStorageMode, type ImageStorageMode } from '@/lib/image-storage';
import { createOpenAIClient, getOpenAIConfig } from '@/lib/openai-config';
import { buildPromptFromFormData } from '@/lib/prompt-builder/build-prompt';
import crypto from 'crypto';
import fs from 'fs/promises';
import { lookup } from 'mime-types';
import type OpenAI from 'openai';
import path from 'path';

const outputDir = path.resolve(process.cwd(), 'generated-images');
const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
type ValidOutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

export type GeneratedImageResult = {
    filename: string;
    b64_json: string;
    path?: string;
    output_format: string;
};

export type ImageGenerationResult = {
    images: GeneratedImageResult[];
    usage: OpenAI.Images.ImagesResponse['usage'];
    storageMode: ImageStorageMode;
};

export type ImageGenerationPreview = {
    b64_json: string;
    partial_image_index: number;
    output_format: string;
};

function validateOutputFormat(format: unknown): ValidOutputFormat {
    const normalized = String(format || 'png').toLowerCase();
    const mapped = normalized === 'jpg' ? 'jpeg' : normalized;

    if (VALID_OUTPUT_FORMATS.includes(mapped as ValidOutputFormat)) {
        return mapped as ValidOutputFormat;
    }

    return 'png';
}

function createImageFilename(fileExtension: ValidOutputFormat, index: number, timestamp = Date.now()): string {
    return `${timestamp}-${crypto.randomUUID()}-${index}.${fileExtension}`;
}

async function ensureOutputDirExists(directory = outputDir) {
    try {
        await fs.access(directory);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            await fs.mkdir(directory, { recursive: true });
            return;
        }

        throw new Error(
            `Failed to access image output directory. Original error: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

function resolvePersistedStorageMode(formData: FormData): ImageStorageMode {
    if (formData.get('storage_mode') === 'fs' || formData.get('force_local_output') === 'true') {
        return 'fs';
    }

    const mode = resolveImageStorageMode();
    return mode === 'indexeddb' ? 'fs' : mode;
}

function getLocalOutputDir(formData: FormData): string {
    const requestedOutputDir = formData.get('output_dir');
    if (typeof requestedOutputDir === 'string' && requestedOutputDir.trim()) {
        if (!path.isAbsolute(requestedOutputDir)) {
            throw new Error('output_dir must be an absolute local path.');
        }

        return requestedOutputDir;
    }

    return outputDir;
}

function shouldReturnAbsolutePaths(formData: FormData): boolean {
    return formData.get('return_absolute_paths') === 'true';
}

async function persistGeneratedImage({
    b64Json,
    filename,
    ownerUserId,
    storageMode,
    localOutputDir
}: {
    b64Json: string;
    filename: string;
    ownerUserId: string;
    storageMode: ImageStorageMode;
    localOutputDir: string;
}): Promise<string | undefined> {
    const buffer = Buffer.from(b64Json, 'base64');

    if (storageMode === 'fs') {
        const filepath = path.join(localOutputDir, filename);
        await fs.writeFile(filepath, buffer);
        recordImageOwner(filename, ownerUserId);
        return filepath;
    } else {
        await putR2Image(filename, buffer, lookup(filename) || undefined);
    }

    recordImageOwner(filename, ownerUserId);
    return undefined;
}

function getIndexedEntries<T extends FormDataEntryValue>(
    formData: FormData,
    pattern: RegExp,
    predicate: (value: FormDataEntryValue) => value is T
): T[] {
    return Array.from(formData.entries())
        .map(([key, value]) => ({ match: pattern.exec(key), value }))
        .filter(
            (entry): entry is { match: RegExpExecArray; value: T } => Boolean(entry.match) && predicate(entry.value)
        )
        .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
        .map((entry) => entry.value);
}

function isFile(value: FormDataEntryValue): value is File {
    return value instanceof File;
}

function isNonEmptyString(value: FormDataEntryValue): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

async function fileFromPath(inputPath: string): Promise<File> {
    const resolvedPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
    const bytes = await fs.readFile(resolvedPath);
    const filename = path.basename(resolvedPath);
    return new File([bytes], filename, { type: lookup(filename) || 'application/octet-stream' });
}

async function getEditImageFilesFromFormData(formData: FormData): Promise<File[]> {
    const uploadedFiles = getIndexedEntries(formData, /^image_(\d+)$/, isFile);
    const imagePaths = getIndexedEntries(formData, /^image_path_(\d+)$/, isNonEmptyString);
    const pathFiles = await Promise.all(imagePaths.map(fileFromPath));

    return [...uploadedFiles, ...pathFiles];
}

export async function runImageGeneration(formData: FormData, ownerUserId: string): Promise<ImageGenerationResult> {
    const openaiConfig = getOpenAIConfig();
    if (!openaiConfig.apiKey) {
        throw new Error('Server configuration error: API key not found.');
    }

    const effectiveStorageMode = resolvePersistedStorageMode(formData);
    const localOutputDir = getLocalOutputDir(formData);
    const returnAbsolutePaths = shouldReturnAbsolutePaths(formData);
    if (effectiveStorageMode === 'fs') {
        await ensureOutputDirExists(localOutputDir);
    }

    const mode = formData.get('mode') as 'generate' | 'edit' | null;
    const builtPrompt = buildPromptFromFormData(formData);
    const prompt = builtPrompt.fullPrompt;
    const model =
        (formData.get('model') as 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2' | null) ||
        'gpt-image-2';

    if (!mode || !prompt) {
        throw new Error('Missing required parameters: mode and prompt');
    }

    const openai = createOpenAIClient();
    let result: OpenAI.Images.ImagesResponse;

    if (mode === 'generate') {
        const n = parseInt((formData.get('n') as string) || '1', 10);
        const size = ((formData.get('size') as string) || '1024x1024') as OpenAI.Images.ImageGenerateParams['size'];
        const quality = (formData.get('quality') as OpenAI.Images.ImageGenerateParams['quality']) || 'auto';
        const output_format =
            (formData.get('output_format') as OpenAI.Images.ImageGenerateParams['output_format']) || 'png';
        const output_compression_str = formData.get('output_compression') as string | null;
        const background = (formData.get('background') as OpenAI.Images.ImageGenerateParams['background']) || 'auto';
        const moderation = (formData.get('moderation') as OpenAI.Images.ImageGenerateParams['moderation']) || 'auto';

        const params = {
            model,
            prompt,
            n: Math.max(1, Math.min(n || 1, 10)),
            size,
            quality,
            output_format,
            background,
            moderation
        };

        if ((output_format === 'jpeg' || output_format === 'webp') && output_compression_str) {
            const compression = parseInt(output_compression_str, 10);
            if (!isNaN(compression) && compression >= 0 && compression <= 100) {
                (params as OpenAI.Images.ImageGenerateParams).output_compression = compression;
            }
        }

        result = await openai.images.generate(params);
    } else if (mode === 'edit') {
        const n = parseInt((formData.get('n') as string) || '1', 10);
        const size = ((formData.get('size') as string) || 'auto') as OpenAI.Images.ImageEditParams['size'];
        const quality = (formData.get('quality') as OpenAI.Images.ImageEditParams['quality']) || 'auto';
        const imageFiles = await getEditImageFilesFromFormData(formData);

        if (imageFiles.length === 0) {
            throw new Error('No image file provided for editing.');
        }

        const maskFile = formData.get('mask') as File | null;
        result = await openai.images.edit({
            model,
            prompt,
            image: imageFiles,
            n: Math.max(1, Math.min(n || 1, 10)),
            size: size === 'auto' ? undefined : size,
            quality: quality === 'auto' ? undefined : quality,
            ...(maskFile ? { mask: maskFile } : {})
        });
    } else {
        throw new Error('Invalid mode specified');
    }

    if (!result || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('Failed to retrieve image data from API.');
    }

    const savedImagesData = await Promise.all(
        result.data.map(async (imageData, index) => {
            if (!imageData.b64_json) {
                throw new Error(`Image data at index ${index} is missing base64 data.`);
            }

            const fileExtension = validateOutputFormat(mode === 'edit' ? 'png' : formData.get('output_format'));
            const filename = createImageFilename(fileExtension, index);

            const absolutePath = await persistGeneratedImage({
                b64Json: imageData.b64_json,
                filename,
                ownerUserId,
                storageMode: effectiveStorageMode,
                localOutputDir
            });

            return {
                filename,
                b64_json: imageData.b64_json,
                path: returnAbsolutePaths && absolutePath ? absolutePath : `/api/image/${filename}`,
                output_format: fileExtension
            };
        })
    );

    return { images: savedImagesData, usage: result.usage, storageMode: effectiveStorageMode };
}

export async function runStreamingImageGeneration(
    formData: FormData,
    ownerUserId: string,
    onPreview: (preview: ImageGenerationPreview) => void | Promise<void>
): Promise<ImageGenerationResult> {
    const openaiConfig = getOpenAIConfig();
    if (!openaiConfig.apiKey) {
        throw new Error('Server configuration error: API key not found.');
    }

    const effectiveStorageMode = resolvePersistedStorageMode(formData);
    const localOutputDir = getLocalOutputDir(formData);
    const returnAbsolutePaths = shouldReturnAbsolutePaths(formData);
    if (effectiveStorageMode === 'fs') {
        await ensureOutputDirExists(localOutputDir);
    }

    const mode = formData.get('mode') as 'generate' | 'edit' | null;
    const builtPrompt = buildPromptFromFormData(formData);
    const prompt = builtPrompt.fullPrompt;
    const model =
        (formData.get('model') as 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2' | null) ||
        'gpt-image-2';
    const partialImages = Math.max(1, Math.min(parseInt((formData.get('partial_images') as string) || '2', 10), 3)) as
        | 1
        | 2
        | 3;

    if (!mode || !prompt) {
        throw new Error('Missing required parameters: mode and prompt');
    }

    const openai = createOpenAIClient();
    const completedImages: GeneratedImageResult[] = [];
    let usage: OpenAI.Images.ImagesResponse['usage'];
    const timestamp = Date.now();

    if (mode === 'generate') {
        const n = parseInt((formData.get('n') as string) || '1', 10);
        if (Math.max(1, Math.min(n || 1, 10)) !== 1) {
            throw new Error('Streaming preview only supports n=1.');
        }

        const size = ((formData.get('size') as string) || '1024x1024') as OpenAI.Images.ImageGenerateParams['size'];
        const quality = (formData.get('quality') as OpenAI.Images.ImageGenerateParams['quality']) || 'auto';
        const output_format =
            (formData.get('output_format') as OpenAI.Images.ImageGenerateParams['output_format']) || 'png';
        const output_compression_str = formData.get('output_compression') as string | null;
        const background = (formData.get('background') as OpenAI.Images.ImageGenerateParams['background']) || 'auto';
        const moderation = (formData.get('moderation') as OpenAI.Images.ImageGenerateParams['moderation']) || 'auto';
        const fileExtension = validateOutputFormat(output_format);

        const params = {
            model,
            prompt,
            n: 1,
            size,
            quality,
            output_format,
            background,
            moderation,
            stream: true as const,
            partial_images: partialImages
        };

        if ((output_format === 'jpeg' || output_format === 'webp') && output_compression_str) {
            const compression = parseInt(output_compression_str, 10);
            if (!isNaN(compression) && compression >= 0 && compression <= 100) {
                (params as OpenAI.Images.ImageGenerateParams).output_compression = compression;
            }
        }

        const stream = await openai.images.generate(params);

        for await (const event of stream) {
            if (event.type === 'image_generation.partial_image' && event.b64_json) {
                await onPreview({
                    b64_json: event.b64_json,
                    partial_image_index: event.partial_image_index,
                    output_format: fileExtension
                });
            } else if (event.type === 'image_generation.completed' && event.b64_json) {
                const filename = createImageFilename(fileExtension, completedImages.length, timestamp);
                const absolutePath = await persistGeneratedImage({
                    b64Json: event.b64_json,
                    filename,
                    ownerUserId,
                    storageMode: effectiveStorageMode,
                    localOutputDir
                });
                completedImages.push({
                    filename,
                    b64_json: event.b64_json,
                    path: returnAbsolutePaths && absolutePath ? absolutePath : `/api/image/${filename}`,
                    output_format: fileExtension
                });
                if ('usage' in event && event.usage) {
                    usage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                }
            }
        }
    } else if (mode === 'edit') {
        const n = parseInt((formData.get('n') as string) || '1', 10);
        if (Math.max(1, Math.min(n || 1, 10)) !== 1) {
            throw new Error('Streaming preview only supports n=1.');
        }

        const size = ((formData.get('size') as string) || 'auto') as OpenAI.Images.ImageEditParams['size'];
        const quality = (formData.get('quality') as OpenAI.Images.ImageEditParams['quality']) || 'auto';
        const imageFiles = await getEditImageFilesFromFormData(formData);

        if (imageFiles.length === 0) {
            throw new Error('No image file provided for editing.');
        }

        const maskFile = formData.get('mask') as File | null;
        const stream = await openai.images.edit({
            model,
            prompt,
            image: imageFiles,
            n: 1,
            size: size === 'auto' ? undefined : size,
            quality: quality === 'auto' ? undefined : quality,
            stream: true,
            partial_images: partialImages,
            ...(maskFile ? { mask: maskFile } : {})
        });

        for await (const event of stream) {
            if (event.type === 'image_edit.partial_image' && event.b64_json) {
                await onPreview({
                    b64_json: event.b64_json,
                    partial_image_index: event.partial_image_index,
                    output_format: 'png'
                });
            } else if (event.type === 'image_edit.completed' && event.b64_json) {
                const filename = createImageFilename('png', completedImages.length, timestamp);
                const absolutePath = await persistGeneratedImage({
                    b64Json: event.b64_json,
                    filename,
                    ownerUserId,
                    storageMode: effectiveStorageMode,
                    localOutputDir
                });
                completedImages.push({
                    filename,
                    b64_json: event.b64_json,
                    path: returnAbsolutePaths && absolutePath ? absolutePath : `/api/image/${filename}`,
                    output_format: 'png'
                });
                if ('usage' in event && event.usage) {
                    usage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                }
            }
        }
    } else {
        throw new Error('Invalid mode specified');
    }

    if (completedImages.length === 0) {
        throw new Error('Failed to retrieve image data from API.');
    }

    return { images: completedImages, usage, storageMode: effectiveStorageMode };
}
