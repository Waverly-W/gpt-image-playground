import fs from 'fs/promises';
import { lookup } from 'mime-types';
import { putR2Image } from '@/lib/image-storage';
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
};

export type PromptTemplateSyncStatus = {
    status: 'idle' | 'running' | 'completed' | 'failed';
    completed: number;
    total: number;
    currentFilename: string | null;
    error: string | null;
    startedAt: string | null;
    finishedAt: string | null;
};

type SyncDeps = {
    uploads?: PromptTemplateUpload[];
    readFile?: (filePath: string) => Promise<Buffer>;
    uploadObject?: (key: string, buffer: Buffer, contentType: string, runtimeConfig: RuntimeConfig) => Promise<void>;
    onProgress?: (event: PromptTemplateSyncProgress) => void | Promise<void>;
};

let currentSyncStatus: PromptTemplateSyncStatus = {
    status: 'idle',
    completed: 0,
    total: 0,
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
): Promise<{ uploaded: number }> {
    const uploads = deps.uploads ?? listPromptTemplateUploads();
    const readFile = deps.readFile ?? fs.readFile;
    const uploadObject = deps.uploadObject ?? putR2Image;

    for (const upload of uploads) {
        const buffer = await readFile(upload.filePath);
        await uploadObject(upload.key, buffer, upload.contentType, runtimeConfig);
        await deps.onProgress?.({
            completed: uploads.indexOf(upload) + 1,
            total: uploads.length,
            filename: upload.filename
        });
    }

    return { uploaded: uploads.length };
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
        currentFilename: uploads[0]?.filename ?? null,
        error: null,
        startedAt: new Date().toISOString(),
        finishedAt: null
    };

    void syncPromptTemplateImagesToR2(runtimeConfig, {
        uploads,
        onProgress: ({ completed, total, filename }) => {
            currentSyncStatus = {
                ...currentSyncStatus,
                status: 'running',
                completed,
                total,
                currentFilename: filename
            };
        }
    })
        .then(({ uploaded }) => {
            currentSyncStatus = {
                ...currentSyncStatus,
                status: 'completed',
                completed: uploaded,
                total: uploaded,
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
