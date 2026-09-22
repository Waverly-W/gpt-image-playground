import { calculateApiCost, type GptImageModel } from '@/lib/cost-utils';
import { runImageGeneration, runStreamingImageGeneration } from '@/lib/image-generation-service';
import {
    completeImageJob,
    countRunningImageJobs,
    failImageJob,
    failStaleRunningImageJobs,
    getImageJobForUser,
    listPendingImageJobs,
    markImageJobRunning,
    requeueImageJobAfterFailure,
    updateImageJobPreview
} from '@/lib/image-jobs';

const MAX_PARALLEL_IMAGE_JOBS = 5;
const IMAGE_JOB_TIMEOUT_MS = 5 * 60 * 1000;

type QueuedImageJobPayload = {
    ownerUserId: string;
    formData: FormData;
    model: GptImageModel;
    retryAttempts?: number;
};

const queuedJobPayloads = new Map<string, QueuedImageJobPayload>();
const activeJobIds = new Set<string>();

async function runJobInBackground(jobId: string, ownerUserId: string, formData: FormData, model: GptImageModel) {
    const startTime = Date.now();
    console.log(`[Job ${jobId}] Starting generation for user '${ownerUserId}' with model '${model}'...`);
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
        console.log(`[Job ${jobId}] Completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s, ${result.images.length} image(s) created`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Image generation failed.';
        console.error(`[Job ${jobId}] Failed after ${((Date.now() - startTime) / 1000).toFixed(1)}s:`, error);
        const payload = queuedJobPayloads.get(jobId);
        const autoRetryEnabled = formData.get('auto_retry') === 'true';
        const maxAutoRetries = Math.max(0, parseInt((formData.get('max_auto_retries') as string) || '0', 10));
        const retryAttempts = payload?.retryAttempts ?? 0;

        if (autoRetryEnabled && payload && retryAttempts < maxAutoRetries) {
            const nextRetryAttempts = retryAttempts + 1;
            payload.retryAttempts = nextRetryAttempts;
            requeueImageJobAfterFailure(jobId, errorMessage, {
                auto_retry_attempts: nextRetryAttempts,
                last_error: errorMessage
            });
            queuedJobPayloads.delete(jobId);
            queuedJobPayloads.set(jobId, payload);
        } else {
            failImageJob(jobId, errorMessage);
        }
    } finally {
        activeJobIds.delete(jobId);

        const latestJob = getImageJobForUser(jobId, ownerUserId, true);
        if (!latestJob || latestJob.status === 'completed') {
            queuedJobPayloads.delete(jobId);
        }

        scheduleImageJobs();
    }
}

export function enqueueImageJobPayload(jobId: string, payload: QueuedImageJobPayload) {
    queuedJobPayloads.set(jobId, payload);
}

export function hasQueuedImageJobPayload(jobId: string): boolean {
    return queuedJobPayloads.has(jobId);
}

export function deleteQueuedImageJobPayloadsForUser(ownerUserId: string) {
    for (const [jobId, payload] of queuedJobPayloads.entries()) {
        if (payload.ownerUserId === ownerUserId) {
            queuedJobPayloads.delete(jobId);
        }
    }
}

export function scheduleImageJobs() {
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
