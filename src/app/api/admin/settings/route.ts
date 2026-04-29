import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { getRuntimeConfig, setRuntimeConfig } from '@/lib/settings';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        await requireAdmin();
        return NextResponse.json(getRuntimeConfig());
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to get settings.' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json().catch(() => ({}));

        if ('registrationEnabled' in body && typeof body.registrationEnabled !== 'boolean') {
            return NextResponse.json({ error: 'registrationEnabled must be a boolean.' }, { status: 400 });
        }

        if (
            'imageStorageMode' in body &&
            body.imageStorageMode !== '' &&
            body.imageStorageMode !== 'fs' &&
            body.imageStorageMode !== 'indexeddb' &&
            body.imageStorageMode !== 'r2'
        ) {
            return NextResponse.json(
                { error: 'imageStorageMode must be fs, indexeddb, r2, or empty.' },
                { status: 400 }
            );
        }

        if (
            'authCookieSecure' in body &&
            body.authCookieSecure !== 'auto' &&
            body.authCookieSecure !== 'true' &&
            body.authCookieSecure !== 'false'
        ) {
            return NextResponse.json({ error: 'authCookieSecure must be auto, true, or false.' }, { status: 400 });
        }

        setRuntimeConfig(body);
        return NextResponse.json(getRuntimeConfig());
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 });
    }
}
