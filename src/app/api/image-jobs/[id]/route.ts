import { getImageJobForUser } from '@/lib/image-jobs';
import { authErrorResponse, requireSession } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const session = await requireSession();
        const { id } = await context.params;
        const job = getImageJobForUser(id, session.id);

        if (!job) {
            return NextResponse.json({ error: 'Image job not found.' }, { status: 404 });
        }

        return NextResponse.json({ job });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load image job.' }, { status: 500 });
    }
}
