import fs from 'fs/promises';
import { lookup } from 'mime-types';
import { putR2Image, r2ObjectExists } from '@/lib/image-storage';
import { PROMPT_TEMPLATES } from '@/lib/prompt-template-data';
import { getPromptTemplateObjectKey, resolvePromptTemplateImagePath } from '@/lib/prompt-templates';
import { getSetting, setSetting, type RuntimeConfig } from '@/lib/settings';

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
    updatedAt: string | null;
};

type SyncDeps = {
    uploads?: PromptTemplateUpload[];
    readFile?: (filePath: string) => Promise<Buffer>;
    objectExists?: (key: string, runtimeConfig: RuntimeConfig) => Promise<boolean>;
    uploadObject?: (key: string, buffer: Buffer, contentType: string, runtimeConfig: RuntimeConfig) => Promise<void>;
    onCurrentFile?: (filename: string) => void | Promise<void>;
    onProgress?: (event: PromptTemplateSyncProgress) => void | Promise<void>;
};

const PROMPT_TEMPLATE_SYNC_STATUS_KEY = 'prompt_template_sync_status';
const DEFAULT_OPERATION_TIMEOUT_MS = 20_000;
const DEFAULT_OPERATION_RETRIES = 3;

function createIdleStatus(): PromptTemplateSyncStatus {
    return {
        status: 'idle',
        completed: 0,
        total: 0,
        uploaded: 0,
        skipped: 0,
        currentFilename: null,
        error: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: null
    };
}

function loadStoredSyncStatus(): PromptTemplateSyncStatus {
    const raw = getSetting(PROMPT_TEMPLATE_SYNC_STATUS_KEY);
    if (!raw) {
        return createIdleStatus();
    }

    try {
        const parsed = JSON.parse(raw) as Partial<PromptTemplateSyncStatus>;
        return {
            ...createIdleStatus(),
            ...parsed
        };
    } catch {
        return createIdleStatus();
    }
}

function persistSyncStatus(status: PromptTemplateSyncStatus) {
    setSetting(PROMPT_TEMPLATE_SYNC_STATUS_KEY, JSON.stringify(status));
}

let currentSyncStatus: PromptTemplateSyncStatus = loadStoredSyncStatus();
let activeSyncPromise: Promise<void> | null = null;

if (currentSyncStatus.status === 'running') {
    currentSyncStatus = {
        ...currentSyncStatus,
        status: 'failed',
        error: currentSyncStatus.error || '同步任务在服务重启后中断，请重新开始。',
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    persistSyncStatus(currentSyncStatus);
}

function updateSyncStatus(patch: Partial<PromptTemplateSyncStatus>) {
    currentSyncStatus = {
        ...currentSyncStatus,
        ...patch,
        updatedAt: new Date().toISOString()
    };
    persistSyncStatus(currentSyncStatus);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
            })
        ]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

async function withRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= DEFAULT_OPERATION_RETRIES; attempt++) {
        try {
            return await withTimeout(operation(), DEFAULT_OPERATION_TIMEOUT_MS, `${label} attempt ${attempt}`);
        } catch (error) {
            lastError = error;
            if (attempt === DEFAULT_OPERATION_RETRIES) {
                break;
            }
        }
    }

    throw lastError;
}

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

        if (await withRetry(() => objectExists(upload.key, runtimeConfig), `Check ${upload.filename}`)) {
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
        await withRetry(
            () => uploadObject(upload.key, buffer, upload.contentType, runtimeConfig),
            `Upload ${upload.filename}`
        );
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
    if (activeSyncPromise) {
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
        finishedAt: null,
        updatedAt: new Date().toISOString()
    };
    persistSyncStatus(currentSyncStatus);

    activeSyncPromise = syncPromptTemplateImagesToR2(runtimeConfig, {
        uploads,
        onCurrentFile: (filename) => {
            updateSyncStatus({ currentFilename: filename });
        },
        onProgress: ({ completed, total, filename, uploaded, skipped }) => {
            updateSyncStatus({
                status: 'running',
                completed,
                total,
                uploaded,
                skipped,
                currentFilename: filename
            });
        }
    })
        .then(({ uploaded, skipped }) => {
            updateSyncStatus({
                status: 'completed',
                completed: uploaded + skipped,
                total: uploads.length,
                uploaded,
                skipped,
                currentFilename: null,
                finishedAt: new Date().toISOString(),
                error: null
            });
        })
        .catch((error: unknown) => {
            updateSyncStatus({
                status: 'failed',
                error: error instanceof Error ? error.message : 'Prompt template sync failed.',
                currentFilename: null,
                finishedAt: new Date().toISOString()
            });
        })
        .finally(() => {
            activeSyncPromise = null;
        });

    return currentSyncStatus;
}
