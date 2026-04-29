import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, type SessionUser, verifySessionToken } from './auth';

export async function getSessionFromCookie(): Promise<SessionUser | null> {
    const cookieStore = await cookies();
    return verifySessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export async function requireSession(): Promise<SessionUser> {
    const session = await getSessionFromCookie();
    if (!session) {
        throw new Error('Unauthorized');
    }
    return session;
}

export async function requireAdmin(): Promise<SessionUser> {
    const session = await requireSession();
    if (session.role !== 'admin') {
        throw new Error('Forbidden');
    }
    return session;
}

export function authErrorResponse(error: unknown): NextResponse | null {
    if (error instanceof Error && error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return null;
}
