import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/server-auth';

export async function GET() {
    const user = await getSessionFromCookie();
    return NextResponse.json({ user, authenticated: Boolean(user) });
}
