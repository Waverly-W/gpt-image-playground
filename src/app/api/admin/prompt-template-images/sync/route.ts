import { getPromptTemplateSyncStatus, startPromptTemplateSync } from '@/lib/prompt-template-sync';
import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { getRuntimeConfig } from '@/lib/settings';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        await requireAdmin();
        return NextResponse.json(getPromptTemplateSyncStatus());
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get sync status.' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json().catch(() => ({}));
        const runtimeConfig = { ...getRuntimeConfig(), ...body };
        const status = startPromptTemplateSync(runtimeConfig);
        return NextResponse.json(status, { status: 202 });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync prompt template images.' },
            { status: 500 }
        );
    }
}
