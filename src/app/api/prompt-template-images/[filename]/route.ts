import { resolvePromptTemplateImagePath } from '@/lib/prompt-templates';
import fs from 'fs/promises';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
    const { filename } = await params;
    const imagePath = resolvePromptTemplateImagePath(filename);

    if (!imagePath) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    try {
        const image = await fs.readFile(imagePath);
        return new NextResponse(image, {
            status: 200,
            headers: {
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Content-Length': image.length.toString(),
                'Content-Type': 'image/webp'
            }
        });
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }

        console.error(`Error serving prompt template image ${filename}:`, error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
