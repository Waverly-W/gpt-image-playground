import crypto from 'crypto';
import { getDb } from './sqlite-db';
import type { CostDetails, GptImageModel } from './cost-utils';
import type { ImageStorageMode } from './settings';

export type ImageJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ImageJobMode = 'generate' | 'edit';

export type ImageJobImage = {
    filename: string;
    output_format?: string;
    path?: string;
};

export type ImageJobPreviewImage = {
    b64_json: string;
    partial_image_index: number;
    output_format?: string;
    updatedAt: string;
};

export type ImageJob = {
    id: string;
    ownerUserId: string;
    status: ImageJobStatus;
    mode: ImageJobMode;
    prompt: string;
    model: GptImageModel;
    params: Record<string, unknown>;
    images: ImageJobImage[];
    previewImage: ImageJobPreviewImage | null;
    usage: unknown | null;
    costDetails: CostDetails | null;
    storageModeUsed: ImageStorageMode | null;
    durationMs: number | null;
    error: string | null;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
};

type ImageJobRow = {
    id: string;
    owner_user_id: string;
    status: ImageJobStatus;
    mode: ImageJobMode;
    prompt: string;
    model: GptImageModel;
    params_json: string;
    images_json: string;
    preview_image_json: string | null;
    usage_json: string | null;
    cost_json: string | null;
    storage_mode_used: ImageStorageMode | null;
    duration_ms: number | null;
    error: string | null;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    finished_at: string | null;
};

type CreateImageJobInput = {
    ownerUserId: string;
    mode: ImageJobMode;
    prompt: string;
    model: GptImageModel;
    params: Record<string, unknown>;
};

type CompleteImageJobInput = {
    images: ImageJobImage[];
    usage?: unknown;
    costDetails: CostDetails | null;
    storageModeUsed: ImageStorageMode;
    durationMs: number;
};

type UpdateImageJobPreviewInput = Omit<ImageJobPreviewImage, 'updatedAt'>;

function nowIso(): string {
    return new Date().toISOString();
}

function parseJson<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function toImageJob(row: ImageJobRow): ImageJob {
    return {
        id: row.id,
        ownerUserId: row.owner_user_id,
        status: row.status,
        mode: row.mode,
        prompt: row.prompt,
        model: row.model,
        params: parseJson<Record<string, unknown>>(row.params_json, {}),
        images: parseJson<ImageJobImage[]>(row.images_json, []),
        previewImage: parseJson<ImageJobPreviewImage | null>(row.preview_image_json, null),
        usage: parseJson<unknown | null>(row.usage_json, null),
        costDetails: parseJson<CostDetails | null>(row.cost_json, null),
        storageModeUsed: row.storage_mode_used,
        durationMs: row.duration_ms,
        error: row.error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at
    };
}

function getImageJobById(id: string): ImageJob {
    const row = getDb().prepare('SELECT * FROM image_jobs WHERE id = ?').get(id) as ImageJobRow | undefined;
    if (!row) {
        throw new Error('Image job not found.');
    }

    return toImageJob(row);
}

export function createImageJob(input: CreateImageJobInput): ImageJob {
    const id = `job_${crypto.randomUUID()}`;
    const now = nowIso();

    getDb()
        .prepare(
            `INSERT INTO image_jobs (
                id, owner_user_id, status, mode, prompt, model, params_json, images_json,
                created_at, updated_at
            )
            VALUES (?, ?, 'pending', ?, ?, ?, ?, '[]', ?, ?)`
        )
        .run(id, input.ownerUserId, input.mode, input.prompt, input.model, JSON.stringify(input.params), now, now);

    return getImageJobById(id);
}

export function markImageJobRunning(id: string, startedAt = nowIso()): ImageJob {
    getDb()
        .prepare(
            `UPDATE image_jobs
             SET status = 'running', updated_at = ?, started_at = COALESCE(started_at, ?), error = NULL
             WHERE id = ?`
        )
        .run(startedAt, startedAt, id);

    return getImageJobById(id);
}

export function completeImageJob(id: string, input: CompleteImageJobInput): ImageJob {
    const now = nowIso();
    getDb()
        .prepare(
            `UPDATE image_jobs
             SET status = 'completed',
                 images_json = ?,
                 usage_json = ?,
                 cost_json = ?,
                 storage_mode_used = ?,
                 duration_ms = ?,
                 preview_image_json = NULL,
                 error = NULL,
                 updated_at = ?,
                 finished_at = ?
             WHERE id = ?`
        )
        .run(
            JSON.stringify(input.images),
            input.usage === undefined ? null : JSON.stringify(input.usage),
            input.costDetails ? JSON.stringify(input.costDetails) : null,
            input.storageModeUsed,
            input.durationMs,
            now,
            now,
            id
        );

    return getImageJobById(id);
}

export function updateImageJobPreview(id: string, input: UpdateImageJobPreviewInput): ImageJob {
    const now = nowIso();
    const previewImage: ImageJobPreviewImage = {
        ...input,
        updatedAt: now
    };

    getDb()
        .prepare(
            `UPDATE image_jobs
             SET preview_image_json = ?, updated_at = ?
             WHERE id = ?`
        )
        .run(JSON.stringify(previewImage), now, id);

    return getImageJobById(id);
}

export function failImageJob(id: string, error: string): ImageJob {
    const now = nowIso();
    getDb()
        .prepare(
            `UPDATE image_jobs
             SET status = 'failed', error = ?, updated_at = ?, finished_at = ?
             WHERE id = ?`
        )
        .run(error, now, now, id);

    return getImageJobById(id);
}

export function getImageJobForUser(id: string, ownerUserId: string): ImageJob | null {
    const row = getDb()
        .prepare('SELECT * FROM image_jobs WHERE id = ? AND owner_user_id = ?')
        .get(id, ownerUserId) as ImageJobRow | undefined;

    return row ? toImageJob(row) : null;
}

export function listImageJobsForUser(ownerUserId: string, limit = 100): ImageJob[] {
    const rows = getDb()
        .prepare('SELECT * FROM image_jobs WHERE owner_user_id = ? ORDER BY updated_at DESC LIMIT ?')
        .all(ownerUserId, limit) as ImageJobRow[];

    return rows.map(toImageJob);
}

export function deleteImageJobsForUser(ownerUserId: string): number {
    const result = getDb().prepare('DELETE FROM image_jobs WHERE owner_user_id = ?').run(ownerUserId);
    return result.changes;
}

export function countRunningImageJobs(): number {
    const row = getDb().prepare("SELECT COUNT(*) AS count FROM image_jobs WHERE status = 'running'").get() as
        | { count: number }
        | undefined;
    return row?.count ?? 0;
}

export function listPendingImageJobs(limit: number): ImageJob[] {
    const rows = getDb()
        .prepare("SELECT * FROM image_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?")
        .all(limit) as ImageJobRow[];

    return rows.map(toImageJob);
}

export function failStaleRunningImageJobs(timeoutMs: number, now = nowIso()): ImageJob[] {
    const cutoff = new Date(new Date(now).getTime() - timeoutMs).toISOString();
    const rows = getDb()
        .prepare("SELECT * FROM image_jobs WHERE status = 'running' AND started_at <= ? ORDER BY started_at ASC")
        .all(cutoff) as ImageJobRow[];

    if (rows.length === 0) return [];

    const failedAt = now;
    const update = getDb().prepare(
        `UPDATE image_jobs
         SET status = 'failed',
             error = 'Image generation timed out after 5 minutes.',
             updated_at = ?,
             finished_at = ?
         WHERE id = ? AND status = 'running'`
    );

    getDb().transaction((jobs: ImageJobRow[]) => {
        jobs.forEach((job) => update.run(failedAt, failedAt, job.id));
    })(rows);

    return rows.map((row) => getImageJobById(row.id));
}
