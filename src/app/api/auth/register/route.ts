import { isRegistrationEnabled } from '@/lib/settings';
import { createUser } from '@/lib/users';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    if (!isRegistrationEnabled()) {
        return NextResponse.json({ error: 'Registration is disabled.' }, { status: 403 });
    }

    const { email, password, name } = await request.json().catch(() => ({ email: '', password: '', name: null }));

    if (typeof email !== 'string' || typeof password !== 'string') {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    try {
        const user = await createUser({ email, password, name: typeof name === 'string' ? name : null });
        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Registration failed.' },
            { status: 400 }
        );
    }
}
