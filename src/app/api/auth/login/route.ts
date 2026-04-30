import { AUTH_COOKIE_NAME, createSessionToken, shouldUseSecureAuthCookie, verifyCredentials } from '@/lib/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { email, password } = await request.json().catch(() => ({ email: '', password: '' }));

    if (typeof email !== 'string' || typeof password !== 'string') {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    try {
        const token = await createSessionToken(user);
        const cookieStore = await cookies();
        cookieStore.set(AUTH_COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: shouldUseSecureAuthCookie(request),
            path: '/',
            maxAge: 60 * 60 * 24 * 7
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'JWT_SECRET or AUTH_SECRET must be set in production.') {
            return NextResponse.json({ error: 'Authentication is not configured on the server.' }, { status: 500 });
        }

        throw error;
    }

    return NextResponse.json({ user });
}
