import { NextResponse } from 'next/server';
import { authErrorResponse, requireAdmin } from '@/lib/server-auth';
import { resetModelsToDefault } from '@/lib/models';

export async function POST() {
    try {
        await requireAdmin();
        const models = resetModelsToDefault();
        return NextResponse.json({ models });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: '重置模型配置失败。' }, { status: 500 });
    }
}
