import { canAccessImage } from '@/lib/image-ownership';
import { getR2Image, resolveImageStorageMode } from '@/lib/image-storage';
import { authErrorResponse, requireSession } from '@/lib/server-auth';
import fs from 'fs/promises';
import { lookup } from 'mime-types';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// Base directory where images are stored (outside nextjs-app)
const imageBaseDir = path.resolve(process.cwd(), 'generated-images');

function isMissingImageError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
        return false;
    }

    return (
        ('code' in error && error.code === 'ENOENT') ||
        ('name' in error && (error.name === 'NoSuchKey' || error.name === 'NotFound'))
    );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
    let session;
    try {
        session = await requireSession();
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename } = await params;

    if (!filename) {
        return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Basic security: Prevent directory traversal
    if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    if (!canAccessImage(filename, session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storageMode = resolveImageStorageMode();
    const filepath = path.join(imageBaseDir, filename);

    try {
        const image =
            storageMode === 'r2'
                ? await getR2Image(filename)
                : {
                      buffer: await fs.readFile(filepath),
                      contentType: lookup(filename) || 'application/octet-stream'
                  };

        return new NextResponse(image.buffer, {
            status: 200,
            headers: {
                'Content-Type': image.contentType,
                'Content-Length': image.buffer.length.toString()
            }
        });
    } catch (error: unknown) {
        console.error(`Error serving image ${filename}:`, error);
        if (isMissingImageError(error)) {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
