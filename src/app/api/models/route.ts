import { NextResponse } from 'next/server';
import { getDefaultModel, listEnabledModels } from '@/lib/models';

export async function GET() {
    try {
        const models = listEnabledModels();
        const defaultModel = getDefaultModel();
        return NextResponse.json({ models, defaultModel });
    } catch (error) {
        return NextResponse.json({ error: '获取模型列表失败。' }, { status: 500 });
    }
}
