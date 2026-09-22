import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';
import { runImageGeneration } from '@/lib/image-generation-service';
import { getR2PublicUrl, putR2Image } from '@/lib/image-storage';

function isAuthorized(request: NextRequest): boolean {
    const internalToken = process.env.INTERNAL_API_TOKEN || process.env.INTERNAL_TOKEN || 'magcraft_internal_token';
    const headerToken =
        request.headers.get('x-internal-token') ||
        request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (headerToken && headerToken === internalToken) {
        return true;
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const remoteIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '';
    const host = request.headers.get('host') || '';

    if (
        !remoteIp ||
        remoteIp === '127.0.0.1' ||
        remoteIp === '::1' ||
        remoteIp === '::ffff:127.0.0.1' ||
        remoteIp === 'localhost' ||
        host.startsWith('127.0.0.1:') ||
        host.startsWith('localhost:') ||
        host === '127.0.0.1' ||
        host === 'localhost'
    ) {
        return true;
    }

    return false;
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ status: 'ok', endpoint: '/api/internal/edits' });
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Forbidden: Local or token authentication required' }, { status: 403 });
    }

    const startTime = Date.now();
    const tempFilesToDelete: string[] = [];

    try {
        const contentType = request.headers.get('content-type') || '';
        const formData = new FormData();
        let requestedOutputDir = '';

        if (contentType.includes('application/json')) {
            const body = (await request.json()) as Record<string, any>;
            const prompt = body.prompt;
            if (!prompt || typeof prompt !== 'string') {
                return NextResponse.json({ error: 'Missing required parameter: prompt' }, { status: 400 });
            }

            formData.set('mode', 'edit');
            formData.set('prompt', prompt.trim());
            formData.set('model', body.model || 'gpt-image-2');
            formData.set('size', body.size || 'auto');
            if (body.quality) formData.set('quality', body.quality);
            if (body.n) formData.set('n', String(body.n));

            requestedOutputDir = (body.output_dir && typeof body.output_dir === 'string') ? body.output_dir.trim() : '';

            if (requestedOutputDir) {
                if (!path.isAbsolute(requestedOutputDir)) {
                    return NextResponse.json({ error: 'output_dir must be an absolute path' }, { status: 400 });
                }
                formData.set('output_dir', requestedOutputDir);
                formData.set('force_local_output', 'true');
                formData.set('storage_mode', 'fs');
                formData.set('return_absolute_paths', 'true');
            }

            if (body.image_base64 && typeof body.image_base64 === 'string') {
                const rawB64 = body.image_base64.includes(',')
                    ? body.image_base64.split(',', 2)[1]
                    : body.image_base64;
                const buffer = Buffer.from(rawB64, 'base64');
                const tempFilePath = path.join(os.tmpdir(), `magcraft_input_${Date.now()}_${crypto.randomUUID()}.png`);
                await fs.writeFile(tempFilePath, buffer);
                tempFilesToDelete.push(tempFilePath);
                formData.set('image_path_0', tempFilePath);
            } else if (body.image_path && typeof body.image_path === 'string') {
                formData.set('image_path_0', body.image_path.trim());
            } else if (Array.isArray(body.image_paths)) {
                body.image_paths.forEach((p: string, idx: number) => {
                    formData.set(`image_path_${idx}`, String(p).trim());
                });
            } else {
                return NextResponse.json({ error: 'Missing image: image_base64 or image_path is required' }, { status: 400 });
            }
        } else {
            const incomingForm = await request.formData();
            for (const [key, val] of incomingForm.entries()) {
                formData.append(key, val);
            }
            formData.set('mode', 'edit');
            if (!formData.get('model')) {
                formData.set('model', 'gpt-image-2');
            }
            if (!formData.get('size')) {
                formData.set('size', 'auto');
            }

            const b64 = formData.get('image_base64');
            if (b64 && typeof b64 === 'string') {
                const rawB64 = b64.includes(',') ? b64.split(',', 2)[1] : b64;
                const buffer = Buffer.from(rawB64, 'base64');
                const tempFilePath = path.join(os.tmpdir(), `magcraft_input_${Date.now()}_${crypto.randomUUID()}.png`);
                await fs.writeFile(tempFilePath, buffer);
                tempFilesToDelete.push(tempFilePath);
                formData.set('image_path_0', tempFilePath);
            }

            const outDir = formData.get('output_dir');
            if (outDir && typeof outDir === 'string') {
                requestedOutputDir = outDir.trim();
                formData.set('force_local_output', 'true');
                formData.set('storage_mode', 'fs');
                formData.set('return_absolute_paths', 'true');
            }
        }

        const ownerUserId = 'magcraft-service';
        const generationResult = await runImageGeneration(formData, ownerUserId);
        const durationMs = Date.now() - startTime;

        if (!generationResult.images || generationResult.images.length === 0) {
            return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
        }

        const firstImage = generationResult.images[0];
        let imageUrl = firstImage.path || `/api/image/${firstImage.filename}`;
        let localPath: string | null = null;

        if (requestedOutputDir) {
            localPath = path.join(requestedOutputDir, firstImage.filename);
            try {
                await fs.access(localPath);
            } catch {
                if (firstImage.b64_json) {
                    await fs.mkdir(requestedOutputDir, { recursive: true });
                    await fs.writeFile(localPath, Buffer.from(firstImage.b64_json, 'base64'));
                }
            }
        } else if (firstImage.path && path.isAbsolute(firstImage.path)) {
            localPath = firstImage.path;
        }

        try {
            const r2Url = getR2PublicUrl(firstImage.filename);
            if (r2Url) {
                if (firstImage.b64_json && generationResult.storageMode !== 'r2') {
                    await putR2Image(firstImage.filename, Buffer.from(firstImage.b64_json, 'base64'), 'image/png');
                }
                imageUrl = r2Url;
            }
        } catch {
            // R2 not configured
        }

        return NextResponse.json({
            success: true,
            image_url: imageUrl,
            local_path: localPath,
            duration_ms: durationMs,
            model: (formData.get('model') as string) || 'gpt-image-2',
            filename: firstImage.filename,
            b64_json: firstImage.b64_json
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal edits error';
        return NextResponse.json({ error: message, success: false }, { status: 500 });
    } finally {
        for (const f of tempFilesToDelete) {
            try {
                await fs.unlink(f);
            } catch {}
        }
    }
}
