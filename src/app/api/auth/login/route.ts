import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, createSessionToken, shouldUseSecureAuthCookie, verifyCredentials } from '@/lib/auth';

export async function POST(request: Request) {
    const { email, password } = await request.json().catch(() => ({ email: '', password: '' }));

    if (typeof email !== 'string' || typeof password !== 'string') {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = await createSessionToken(user);
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: shouldUseSecureAuthCookie(request),
        path: '/',
        maxAge: 60 * 60 * 24 * 7
    });

    return NextResponse.json({ user });
}
