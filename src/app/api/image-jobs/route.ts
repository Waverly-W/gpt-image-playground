import { calculateApiCost, type GptImageModel } from '@/lib/cost-utils';
import { runImageGeneration, runStreamingImageGeneration } from '@/lib/image-generation-service';
import {
    createImageJob,
    countRunningImageJobs,
    deleteImageJobsForUser,
    failImageJob,
    failStaleRunningImageJobs,
    listImageJobsForUser,
    listPendingImageJobs,
    markImageJobRunning,
    completeImageJob,
    updateImageJobPreview
} from '@/lib/image-jobs';
import { buildPromptFromFormData, serializeBuiltPromptForParams } from '@/lib/prompt-builder/build-prompt';
import { authErrorResponse, requireSession } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';

const MAX_PARALLEL_IMAGE_JOBS = 5;
const IMAGE_JOB_TIMEOUT_MS = 5 * 60 * 1000;

const queuedJobPayloads = new Map<string, { ownerUserId: string; formData: FormData; model: GptImageModel }>();
const activeJobIds = new Set<string>();

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

function getErrorStatus(error: unknown): number {
    if (error instanceof Error) {
        if (error.message.includes('API key not found')) return 500;
        if (error.message.includes('Missing required parameters')) return 400;
        if (error.message.includes('No image file provided')) return 400;
        if (error.message.includes('Invalid mode')) return 400;
    }
    return 500;
}

async function runJobInBackground(jobId: string, ownerUserId: string, formData: FormData, model: GptImageModel) {
    const startTime = Date.now();
    try {
        activeJobIds.add(jobId);
        markImageJobRunning(jobId);
        const streamEnabled = formData.get('stream') === 'true';
        const n = parseInt((formData.get('n') as string) || '1', 10);
        const result =
            streamEnabled && n === 1
                ? await runStreamingImageGeneration(formData, ownerUserId, (preview) => {
                      updateImageJobPreview(jobId, preview);
                  })
                : await runImageGeneration(formData, ownerUserId);
        const costDetails = calculateApiCost(result.usage, model);

        completeImageJob(jobId, {
            images: result.images.map((image) => ({
                filename: image.filename,
                output_format: image.output_format,
                path: image.path
            })),
            usage: result.usage,
            costDetails,
            storageModeUsed: result.storageMode,
            durationMs: Date.now() - startTime
        });
    } catch (error) {
        failImageJob(jobId, error instanceof Error ? error.message : 'Image generation failed.');
    } finally {
        activeJobIds.delete(jobId);
        queuedJobPayloads.delete(jobId);
        scheduleImageJobs();
    }
}

function scheduleImageJobs() {
    failStaleRunningImageJobs(IMAGE_JOB_TIMEOUT_MS);

    const availableSlots = MAX_PARALLEL_IMAGE_JOBS - countRunningImageJobs();
    if (availableSlots <= 0) return;

    const jobsToStart = listPendingImageJobs(100)
        .filter((job) => queuedJobPayloads.has(job.id))
        .slice(0, availableSlots);

    jobsToStart.forEach((job) => {
        const payload = queuedJobPayloads.get(job.id);
        if (!payload || activeJobIds.has(job.id)) return;
        void runJobInBackground(job.id, payload.ownerUserId, payload.formData, payload.model);
    });
}

export async function GET() {
    try {
        const session = await requireSession();
        failStaleRunningImageJobs(IMAGE_JOB_TIMEOUT_MS);
        scheduleImageJobs();
        return NextResponse.json({ jobs: listImageJobsForUser(session.id) });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to list image jobs.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    let session;
    try {
        session = await requireSession();
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const mode = formData.get('mode') as 'generate' | 'edit' | null;
        const builtPrompt = buildPromptFromFormData(formData);
        const prompt = builtPrompt.fullPrompt;
        const model = (formData.get('model') as GptImageModel | null) || 'gpt-image-2';

        if (!mode || !prompt) {
            return NextResponse.json({ error: 'Missing required parameters: mode and prompt' }, { status: 400 });
        }

        const job = createImageJob({
            ownerUserId: session.id,
            mode,
            prompt,
            model,
            params: {
                ...serializeJobParams(formData),
                ...serializeBuiltPromptForParams(builtPrompt)
            }
        });

        queuedJobPayloads.set(job.id, { ownerUserId: session.id, formData, model });
        scheduleImageJobs();

        return NextResponse.json({ job }, { status: 202 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create image job.';
        return NextResponse.json({ error: message }, { status: getErrorStatus(error) });
    }
}

export async function DELETE() {
    try {
        const session = await requireSession();
        const deleted = deleteImageJobsForUser(session.id);
        return NextResponse.json({ deleted });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to clear image jobs.' }, { status: 500 });
    }
}
