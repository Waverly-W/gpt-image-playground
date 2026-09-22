import { NextResponse } from 'next/server';
import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { createModel, listAllModels } from '@/lib/models';

export async function GET() {
    try {
        await requireAdmin();
        return NextResponse.json({ models: listAllModels() });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: '获取模型列表失败。' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = await request.json().catch(() => ({}));
        const { id, name, description, enabled, isDefault, sortOrder } = body;

        if (!id || typeof id !== 'string') {
            return NextResponse.json({ error: '模型 ID 不能为空。' }, { status: 400 });
        }
        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: '模型名称不能为空。' }, { status: 400 });
        }

        const model = createModel({
            id,
            name,
            description: typeof description === 'string' ? description : '',
            enabled: typeof enabled === 'boolean' ? enabled : true,
            isDefault: typeof isDefault === 'boolean' ? isDefault : false,
            sortOrder: typeof sortOrder === 'number' ? sortOrder : 0
        });

        return NextResponse.json({ model }, { status: 201 });
    } catch (error) {
        const authError = authErrorResponse(error);
        if (authError) return authError;
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '创建模型失败。' },
            { status: 400 }
        );
    }
}
