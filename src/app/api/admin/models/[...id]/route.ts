import { NextResponse } from 'next/server';
import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { deleteModel, getModelById, updateModel } from '@/lib/models';

type RouteContext = { params: Promise<{ id: string | string[] }> };

async function resolveModelId(paramsPromise: Promise<{ id: string | string[] }>): Promise<string> {
    const { id } = await paramsPromise;
    if (Array.isArray(id)) {
        return id.map(decodeURIComponent).join('/');
    }
    return decodeURIComponent(id || '');
}

export async function GET(_request: Request, { params }: RouteContext) {
    try {
        await requireAdmin();
        const id = await resolveModelId(params);
        const model = getModelById(id);
        if (!model) {
            return NextResponse.json({ error: '模型不存在。' }, { status: 404 });
        }
        return NextResponse.json({ model });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: '获取模型失败。' }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: RouteContext) {
    try {
        await requireAdmin();
        const id = await resolveModelId(params);
        const body = await request.json().catch(() => ({}));

        const model = updateModel(id, {
            name: typeof body.name === 'string' ? body.name : undefined,
            description: typeof body.description === 'string' ? body.description : undefined,
            enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
            isDefault: typeof body.isDefault === 'boolean' ? body.isDefault : undefined,
            sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined
        });

        return NextResponse.json({ model });
    } catch (error) {
        const authError = authErrorResponse(error);
        if (authError) return authError;
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '更新模型失败。' },
            { status: 400 }
        );
    }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
    try {
        await requireAdmin();
        const id = await resolveModelId(params);
        const deleted = deleteModel(id);
        if (!deleted) {
            return NextResponse.json({ error: '模型不存在。' }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        const authError = authErrorResponse(error);
        if (authError) return authError;
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '删除模型失败。' },
            { status: 400 }
        );
    }
}
