import { type GptImageModel } from '@/lib/cost-utils';
import { deleteQueuedImageJobPayloadsForUser, enqueueImageJobPayload, scheduleImageJobs } from '@/lib/image-job-queue';
import {
    createImageJob,
    deleteImageJobsForUser,
    failStaleRunningImageJobs,
    listAllImageJobs,
    listImageJobsForUser
} from '@/lib/image-jobs';
import { buildPromptFromFormData, serializeBuiltPromptForParams } from '@/lib/prompt-builder/build-prompt';
import { authErrorResponse, requireSession } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';

const IMAGE_JOB_TIMEOUT_MS = 5 * 60 * 1000;

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

export async function GET(request: NextRequest) {
    try {
        const session = await requireSession();
        failStaleRunningImageJobs(IMAGE_JOB_TIMEOUT_MS);
        scheduleImageJobs();

        const scope = request.nextUrl.searchParams.get('scope');
        const jobs =
            session.role === 'admin' && scope !== 'mine'
                ? listAllImageJobs(200)
                : listImageJobsForUser(session.id, 200);

        return NextResponse.json({
            jobs,
            canViewAll: session.role === 'admin',
            currentScope: session.role === 'admin' ? (scope === 'mine' ? 'mine' : 'all') : 'mine'
        });
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

        enqueueImageJobPayload(job.id, { ownerUserId: session.id, formData, model });
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
        deleteQueuedImageJobPayloadsForUser(session.id);
        return NextResponse.json({ deleted });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to clear image jobs.' }, { status: 500 });
    }
}
