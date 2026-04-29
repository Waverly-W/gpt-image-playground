import { NextResponse } from 'next/server';
import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { createUser, listUsers } from '@/lib/users';

export async function GET() {
    try {
        await requireAdmin();
        return NextResponse.json({ users: listUsers() });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to list users.' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const { email, password, name } = await request.json().catch(() => ({ email: '', password: '', name: null }));

        if (typeof email !== 'string' || typeof password !== 'string') {
            return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
        }

        const user = await createUser({ email, password, name: typeof name === 'string' ? name : null });
        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        const authError = authErrorResponse(error);
        if (authError) return authError;
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create user.' }, { status: 400 });
    }
}
