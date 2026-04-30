import fs from 'fs/promises';
import { lookup } from 'mime-types';
import { putR2Image, r2ObjectExists } from '@/lib/image-storage';
import { PROMPT_TEMPLATES } from '@/lib/prompt-template-data';
import { getPromptTemplateObjectKey, resolvePromptTemplateImagePath } from '@/lib/prompt-templates';
import type { RuntimeConfig } from '@/lib/settings';

export type PromptTemplateUpload = {
    filename: string;
    key: string;
    filePath: string;
    contentType: string;
};

export type PromptTemplateSyncProgress = {
    completed: number;
    total: number;
    filename: string;
    uploaded: number;
    skipped: number;
    action: 'uploaded' | 'skipped';
};

export type PromptTemplateSyncStatus = {
    status: 'idle' | 'running' | 'completed' | 'failed';
    completed: number;
    total: number;
    uploaded: number;
    skipped: number;
    currentFilename: string | null;
    error: string | null;
    startedAt: string | null;
    finishedAt: string | null;
};

type SyncDeps = {
    uploads?: PromptTemplateUpload[];
    readFile?: (filePath: string) => Promise<Buffer>;
    objectExists?: (key: string, runtimeConfig: RuntimeConfig) => Promise<boolean>;
    uploadObject?: (key: string, buffer: Buffer, contentType: string, runtimeConfig: RuntimeConfig) => Promise<void>;
    onCurrentFile?: (filename: string) => void | Promise<void>;
    onProgress?: (event: PromptTemplateSyncProgress) => void | Promise<void>;
};

let currentSyncStatus: PromptTemplateSyncStatus = {
    status: 'idle',
    completed: 0,
    total: 0,
    uploaded: 0,
    skipped: 0,
    currentFilename: null,
    error: null,
    startedAt: null,
    finishedAt: null
};

export function listPromptTemplateUploads(): PromptTemplateUpload[] {
    return PROMPT_TEMPLATES.map((template) => {
        const filePath = resolvePromptTemplateImagePath(template.imageFilename);
        if (!filePath) {
            throw new Error(`Missing prompt template image path for ${template.imageFilename}`);
        }

        return {
            filename: template.imageFilename,
            key: getPromptTemplateObjectKey(template.imageFilename),
            filePath,
            contentType: lookup(template.imageFilename) || 'application/octet-stream'
        };
    });
}

export function getPromptTemplateSyncStatus(): PromptTemplateSyncStatus {
    return currentSyncStatus;
}

export async function syncPromptTemplateImagesToR2(
    runtimeConfig: RuntimeConfig,
    deps: SyncDeps = {}
): Promise<{ uploaded: number; skipped: number }> {
    const uploads = deps.uploads ?? listPromptTemplateUploads();
    const readFile = deps.readFile ?? fs.readFile;
    const objectExists = deps.objectExists ?? r2ObjectExists;
    const uploadObject = deps.uploadObject ?? putR2Image;
    let uploaded = 0;
    let skipped = 0;

    for (const [index, upload] of uploads.entries()) {
        await deps.onCurrentFile?.(upload.filename);

        if (await objectExists(upload.key, runtimeConfig)) {
            skipped += 1;
            await deps.onProgress?.({
                completed: index + 1,
                total: uploads.length,
                filename: upload.filename,
                uploaded,
                skipped,
                action: 'skipped'
            });
            continue;
        }

        const buffer = await readFile(upload.filePath);
        await uploadObject(upload.key, buffer, upload.contentType, runtimeConfig);
        uploaded += 1;
        await deps.onProgress?.({
            completed: index + 1,
            total: uploads.length,
            filename: upload.filename,
            uploaded,
            skipped,
            action: 'uploaded'
        });
    }

    return { uploaded, skipped };
}

export function startPromptTemplateSync(runtimeConfig: RuntimeConfig): PromptTemplateSyncStatus {
    if (currentSyncStatus.status === 'running') {
        return currentSyncStatus;
    }

    const uploads = listPromptTemplateUploads();
    currentSyncStatus = {
        status: 'running',
        completed: 0,
        total: uploads.length,
        uploaded: 0,
        skipped: 0,
        currentFilename: uploads[0]?.filename ?? null,
        error: null,
        startedAt: new Date().toISOString(),
        finishedAt: null
    };

    void syncPromptTemplateImagesToR2(runtimeConfig, {
        uploads,
        onCurrentFile: (filename) => {
            currentSyncStatus = {
                ...currentSyncStatus,
                currentFilename: filename
            };
        },
        onProgress: ({ completed, total, filename, uploaded, skipped }) => {
            currentSyncStatus = {
                ...currentSyncStatus,
                status: 'running',
                completed,
                total,
                uploaded,
                skipped,
                currentFilename: filename
            };
        }
    })
        .then(({ uploaded, skipped }) => {
            currentSyncStatus = {
                ...currentSyncStatus,
                status: 'completed',
                completed: uploaded + skipped,
                total: uploads.length,
                uploaded,
                skipped,
                currentFilename: null,
                finishedAt: new Date().toISOString()
            };
        })
        .catch((error: unknown) => {
            currentSyncStatus = {
                ...currentSyncStatus,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Prompt template sync failed.',
                currentFilename: null,
                finishedAt: new Date().toISOString()
            };
        });

    return currentSyncStatus;
}
