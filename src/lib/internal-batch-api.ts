import {
    createBatchEditJobFormData,
    createBatchJobFormData,
    parseBatchCsv,
    parseBatchEditCsv,
    type BatchEditRow,
    type BatchGenerationDefaults,
    type BatchGenerationRow
} from '@/lib/batch-csv';
import { type GptImageModel } from '@/lib/cost-utils';
import { enqueueImageJobPayload, scheduleImageJobs } from '@/lib/image-job-queue';
import { createImageJob, type ImageJob } from '@/lib/image-jobs';
import { buildPromptFromFormData, serializeBuiltPromptForParams } from '@/lib/prompt-builder/build-prompt';
import fs from 'fs/promises';
import path from 'path';

export type InternalBatchMode = 'generate' | 'edit';

export type InternalBatchJobInput = {
    mode: InternalBatchMode;
    csvPath: string;
    outputDir: string;
    ownerUserId?: string;
    maxRetries?: number;
    schedule?: boolean;
};

export type InternalBatchJobResult = {
    jobs: ImageJob[];
    errors: string[];
};

export class InternalBatchApiError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = 'InternalBatchApiError';
        this.status = status;
    }
}

const INTERNAL_OWNER_USER_ID = 'internal-api';
const DEFAULT_MAX_AUTO_RETRIES = 3;

const GENERATION_DEFAULTS: BatchGenerationDefaults = {
    model: 'gpt-image-2',
    n: 1,
    size: 'auto',
    customWidth: 1024,
    customHeight: 1024,
    quality: 'auto',
    output_format: 'png',
    output_compression: 100,
    background: 'auto',
    moderation: 'auto',
    stream: false,
    partial_images: 2
};

const EDIT_DEFAULTS = {
    model: 'gpt-image-2' as GptImageModel,
    n: 1,
    size: 'auto' as const,
    customWidth: 1024,
    customHeight: 1024,
    quality: 'auto' as const,
    stream: false,
    partial_images: 2 as const
};

function assertAbsolutePath(value: string, fieldName: string): void {
    if (!value || !path.isAbsolute(value)) {
        throw new InternalBatchApiError(`${fieldName} 必须是本机绝对路径。`);
    }
}

function appendInternalFields(formData: FormData, outputDir: string, maxRetries: number): void {
    formData.append('storage_mode', 'fs');
    formData.append('force_local_output', 'true');
    formData.append('return_absolute_paths', 'true');
    formData.append('output_dir', outputDir);
    formData.append('auto_retry', 'true');
    formData.append('max_auto_retries', String(maxRetries));
}

function serializeJobParams(formData: FormData): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
            params[key] = { name: value.name, type: value.type, size: value.size };
        } else {
            params[key] = value;
        }
    }
    return params;
}

function assertEditImagePathsAreAbsolute(rows: BatchEditRow[]): void {
    const errors = rows.flatMap((row) =>
        row.inputImagePaths
            .filter((imagePath) => !path.isAbsolute(imagePath))
            .map(() => `第 ${row.line} 行：input_image_paths 只支持本机绝对路径。`)
    );

    if (errors.length > 0) {
        throw new InternalBatchApiError(errors.join('\n'));
    }
}

function createJobFormData(row: BatchGenerationRow | BatchEditRow, mode: InternalBatchMode): FormData {
    return mode === 'generate'
        ? createBatchJobFormData(row as BatchGenerationRow)
        : createBatchEditJobFormData(row as BatchEditRow);
}

export async function createInternalBatchJobs(input: InternalBatchJobInput): Promise<InternalBatchJobResult> {
    assertAbsolutePath(input.csvPath, 'csv_path');
    assertAbsolutePath(input.outputDir, 'output_dir');

    const csvText = await fs.readFile(input.csvPath, 'utf8');
    const parsed =
        input.mode === 'generate'
            ? parseBatchCsv(csvText, GENERATION_DEFAULTS)
            : parseBatchEditCsv(csvText, EDIT_DEFAULTS);

    if (parsed.errors.length > 0) {
        throw new InternalBatchApiError(parsed.errors.join('\n'));
    }

    if (input.mode === 'edit') {
        assertEditImagePathsAreAbsolute(parsed.rows as BatchEditRow[]);
    }

    await fs.mkdir(input.outputDir, { recursive: true });

    const maxRetries =
        typeof input.maxRetries === 'number' && Number.isInteger(input.maxRetries) && input.maxRetries >= 0
            ? input.maxRetries
            : DEFAULT_MAX_AUTO_RETRIES;
    const ownerUserId = input.ownerUserId || INTERNAL_OWNER_USER_ID;

    const jobs = parsed.rows.map((row) => {
        const formData = createJobFormData(row, input.mode);
        appendInternalFields(formData, input.outputDir, maxRetries);

        const builtPrompt = buildPromptFromFormData(formData);
        const model = (formData.get('model') as GptImageModel | null) || 'gpt-image-2';
        const job = createImageJob({
            ownerUserId,
            mode: input.mode,
            prompt: builtPrompt.fullPrompt,
            model,
            params: {
                ...serializeJobParams(formData),
                ...serializeBuiltPromptForParams(builtPrompt)
            }
        });

        enqueueImageJobPayload(job.id, { ownerUserId, formData, model });
        return job;
    });

    if (input.schedule !== false) {
        scheduleImageJobs();
    }

    return { jobs, errors: [] };
}
