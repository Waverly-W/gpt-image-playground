import { testR2Connection } from '@/lib/image-storage';
import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { getRuntimeConfig } from '@/lib/settings';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json().catch(() => ({}));
        const runtimeConfig = { ...getRuntimeConfig(), ...body };

        await testR2Connection(runtimeConfig);

        return NextResponse.json({ ok: true });
    } catch (error) {
        const authResponse = authErrorResponse(error);
        if (authResponse) return authResponse;

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'R2 connection test failed.' },
            { status: 400 }
        );
    }
}
