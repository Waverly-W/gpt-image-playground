import { NextResponse } from 'next/server';
import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { isRegistrationEnabled, setRegistrationEnabled } from '@/lib/settings';

export async function GET() {
    try {
        await requireAdmin();
        return NextResponse.json({ registrationEnabled: isRegistrationEnabled() });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to get settings.' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json().catch(() => ({}));
        if (typeof body.registrationEnabled !== 'boolean') {
            return NextResponse.json({ error: 'registrationEnabled must be a boolean.' }, { status: 400 });
        }

        setRegistrationEnabled(body.registrationEnabled);
        return NextResponse.json({ registrationEnabled: isRegistrationEnabled() });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 });
    }
}
