import { NextResponse } from 'next/server';
import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { deleteUser, getUserById, resetUserPassword, updateUser } from '@/lib/users';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
    try {
        await requireAdmin();
        const { id } = await params;
        const user = getUserById(id);
        if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        return NextResponse.json({ user });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to get user.' }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: RouteContext) {
    try {
        await requireAdmin();
        const { id } = await params;
        const body = await request.json().catch(() => ({}));

        if (typeof body.password === 'string' && body.password.length > 0) {
            await resetUserPassword(id, body.password);
        }

        const user = updateUser(id, {
            email: typeof body.email === 'string' ? body.email : undefined,
            name: typeof body.name === 'string' || body.name === null ? body.name : undefined,
            disabled: typeof body.disabled === 'boolean' ? body.disabled : undefined
        });

        return NextResponse.json({ user });
    } catch (error) {
        const authError = authErrorResponse(error);
        if (authError) return authError;
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update user.' }, { status: 400 });
    }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
    try {
        await requireAdmin();
        const { id } = await params;
        const deleted = deleteUser(id);
        if (!deleted) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to delete user.' }, { status: 500 });
    }
}
