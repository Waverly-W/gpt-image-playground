import { calculateApiCost, type GptImageModel } from '@/lib/cost-utils';
import {
    createImageJob,
    deleteImageJobsForUser,
    failImageJob,
    listImageJobsForUser,
    markImageJobRunning,
    completeImageJob
} from '@/lib/image-jobs';
import { runImageGeneration } from '@/lib/image-generation-service';
import { authErrorResponse, requireSession } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';

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
        markImageJobRunning(jobId);
        const result = await runImageGeneration(formData, ownerUserId);
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
    }
}

export async function GET() {
    try {
        const session = await requireSession();
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
        const prompt = formData.get('prompt') as string | null;
        const model = (formData.get('model') as GptImageModel | null) || 'gpt-image-2';

        if (!mode || !prompt) {
            return NextResponse.json({ error: 'Missing required parameters: mode and prompt' }, { status: 400 });
        }

        const job = createImageJob({
            ownerUserId: session.id,
            mode,
            prompt,
            model,
            params: serializeJobParams(formData)
        });

        void runJobInBackground(job.id, session.id, formData, model);

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
