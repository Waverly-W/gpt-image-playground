import { syncPromptTemplateImagesToR2 } from '@/lib/prompt-template-sync';
import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        await requireAdmin();
        const result = await syncPromptTemplateImagesToR2();
        return NextResponse.json(result);
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync prompt template images.' },
            { status: 500 }
        );
    }
}
