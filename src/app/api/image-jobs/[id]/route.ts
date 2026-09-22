import { hasQueuedImageJobPayload, scheduleImageJobs } from '@/lib/image-job-queue';
import {
    cancelPendingImageJobForUser,
    getImageJobForUser,
    retryFailedImageJobForUser,
    updateImageJobQualityFeedbackForUser
} from '@/lib/image-jobs';
import { authErrorResponse, requireSession } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const session = await requireSession();
        const { id } = await context.params;
        const job = getImageJobForUser(id, session.id, session.role === 'admin');

        if (!job) {
            return NextResponse.json({ error: 'Image job not found.' }, { status: 404 });
        }

        return NextResponse.json({ job });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load image job.' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const session = await requireSession();
        const isAdmin = session.role === 'admin';
        const { id } = await context.params;
        const body = (await request.json()) as unknown;

        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid quality feedback payload.' }, { status: 400 });
        }

        const payload = body as Record<string, unknown>;

        if (payload.action === 'retry') {
            const existingJob = getImageJobForUser(id, session.id, isAdmin);

            if (!existingJob) {
                return NextResponse.json({ error: 'Image job not found.' }, { status: 404 });
            }

            if (existingJob.status !== 'failed') {
                return NextResponse.json({ error: '只能重试失败任务。' }, { status: 409 });
            }

            if (!hasQueuedImageJobPayload(id)) {
                return NextResponse.json(
                    { error: '这个失败任务的重试数据已失效，请重新提交。' },
                    { status: 409 }
                );
            }

            const job = retryFailedImageJobForUser(id, session.id, isAdmin);
            if (!job) {
                return NextResponse.json({ error: '只能重试失败任务。' }, { status: 409 });
            }

            scheduleImageJobs();
            return NextResponse.json({ job });
        }

        const job = updateImageJobQualityFeedbackForUser(
            id,
            session.id,
            {
                failureReasons: payload.failureReasons,
                note: payload.note
            },
            undefined,
            isAdmin
        );

        if (!job) {
            return NextResponse.json({ error: 'Image job not found.' }, { status: 404 });
        }

        return NextResponse.json({ job });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to update quality feedback.' }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    try {
        const session = await requireSession();
        const { id } = await context.params;
        const canceled = cancelPendingImageJobForUser(id, session.id, session.role === 'admin');

        if (!canceled) {
            return NextResponse.json({ error: 'Only pending image jobs can be canceled.' }, { status: 409 });
        }

        return NextResponse.json({ canceled: true });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to cancel image job.' }, { status: 500 });
    }
}
