import { recordImageOwner } from '@/lib/image-ownership';
import { putR2Image, resolveImageStorageMode, type ImageStorageMode } from '@/lib/image-storage';
import { createOpenAIClient, getOpenAIConfig } from '@/lib/openai-config';
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

async function ensureOutputDirExists() {
    try {
        await fs.access(outputDir);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            await fs.mkdir(outputDir, { recursive: true });
            return;
        }

        throw new Error(
            `Failed to access image output directory. Original error: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

function resolvePersistedStorageMode(): ImageStorageMode {
    const mode = resolveImageStorageMode();
    return mode === 'indexeddb' ? 'fs' : mode;
}

async function persistGeneratedImage({
    b64Json,
    filename,
    ownerUserId,
    storageMode
}: {
    b64Json: string;
    filename: string;
    ownerUserId: string;
    storageMode: ImageStorageMode;
}) {
    const buffer = Buffer.from(b64Json, 'base64');

    if (storageMode === 'fs') {
        const filepath = path.join(outputDir, filename);
        await fs.writeFile(filepath, buffer);
    } else {
        await putR2Image(filename, buffer, lookup(filename) || undefined);
    }

    recordImageOwner(filename, ownerUserId);
}

export async function runImageGeneration(formData: FormData, ownerUserId: string): Promise<ImageGenerationResult> {
    const openaiConfig = getOpenAIConfig();
    if (!openaiConfig.apiKey) {
        throw new Error('Server configuration error: API key not found.');
    }

    const effectiveStorageMode = resolvePersistedStorageMode();
    if (effectiveStorageMode === 'fs') {
        await ensureOutputDirExists();
    }

    const mode = formData.get('mode') as 'generate' | 'edit' | null;
    const prompt = formData.get('prompt') as string | null;
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
        const imageFiles: File[] = [];

        for (const [key, value] of formData.entries()) {
            if (key.startsWith('image_') && value instanceof File) {
                imageFiles.push(value);
            }
        }

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

            const timestamp = Date.now();
            const fileExtension = validateOutputFormat(mode === 'edit' ? 'png' : formData.get('output_format'));
            const filename = `${timestamp}-${index}.${fileExtension}`;

            await persistGeneratedImage({
                b64Json: imageData.b64_json,
                filename,
                ownerUserId,
                storageMode: effectiveStorageMode
            });

            return {
                filename,
                b64_json: imageData.b64_json,
                path: `/api/image/${filename}`,
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

    const effectiveStorageMode = resolvePersistedStorageMode();
    if (effectiveStorageMode === 'fs') {
        await ensureOutputDirExists();
    }

    const mode = formData.get('mode') as 'generate' | 'edit' | null;
    const prompt = formData.get('prompt') as string | null;
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
                const filename = `${timestamp}-${completedImages.length}.${fileExtension}`;
                await persistGeneratedImage({
                    b64Json: event.b64_json,
                    filename,
                    ownerUserId,
                    storageMode: effectiveStorageMode
                });
                completedImages.push({
                    filename,
                    b64_json: event.b64_json,
                    path: `/api/image/${filename}`,
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
        const imageFiles: File[] = [];

        for (const [key, value] of formData.entries()) {
            if (key.startsWith('image_') && value instanceof File) {
                imageFiles.push(value);
            }
        }

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
                const filename = `${timestamp}-${completedImages.length}.png`;
                await persistGeneratedImage({
                    b64Json: event.b64_json,
                    filename,
                    ownerUserId,
                    storageMode: effectiveStorageMode
                });
                completedImages.push({
                    filename,
                    b64_json: event.b64_json,
                    path: `/api/image/${filename}`,
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
