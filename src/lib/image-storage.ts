import { getRuntimeConfig, type ImageStorageMode } from './settings';
import type { RuntimeConfig } from './settings';
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
    type GetObjectCommandOutput
} from '@aws-sdk/client-s3';
import { lookup } from 'mime-types';

export type { ImageStorageMode } from './settings';

export type R2Config = {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint: string;
    publicBaseUrl: string;
};

export function resolveImageStorageMode(): ImageStorageMode {
    const explicitMode = getRuntimeConfig().imageStorageMode;
    const isOnVercel = process.env.VERCEL === '1';

    if (explicitMode === 'fs' || explicitMode === 'indexeddb' || explicitMode === 'r2') {
        return explicitMode;
    }

    if (isOnVercel) {
        return 'indexeddb';
    }

    return 'fs';
}

function requireConfigValue(value: string): string | null {
    const normalized = value.trim();
    return normalized ? normalized : null;
}

export function getR2ConfigFromRuntimeConfig(runtimeConfig: RuntimeConfig): R2Config {
    const values = {
        accountId: requireConfigValue(runtimeConfig.r2AccountId),
        accessKeyId: requireConfigValue(runtimeConfig.r2AccessKeyId),
        secretAccessKey: requireConfigValue(runtimeConfig.r2SecretAccessKey),
        bucket: requireConfigValue(runtimeConfig.r2Bucket)
    };

    const missing = [
        ['CLOUDFLARE_R2_ACCOUNT_ID', values.accountId],
        ['CLOUDFLARE_R2_ACCESS_KEY_ID', values.accessKeyId],
        ['CLOUDFLARE_R2_SECRET_ACCESS_KEY', values.secretAccessKey],
        ['CLOUDFLARE_R2_BUCKET', values.bucket]
    ]
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Missing required Cloudflare R2 environment variables: ${missing.join(', ')}`);
    }

    const endpoint = runtimeConfig.r2Endpoint.trim() || `https://${values.accountId}.r2.cloudflarestorage.com`;
    const publicBaseUrl = runtimeConfig.r2PublicBaseUrl.trim().replace(/\/+$/, '');

    return {
        accountId: values.accountId!,
        accessKeyId: values.accessKeyId!,
        secretAccessKey: values.secretAccessKey!,
        bucket: values.bucket!,
        endpoint,
        publicBaseUrl
    };
}

export function getR2Config(): R2Config {
    return getR2ConfigFromRuntimeConfig(getRuntimeConfig());
}

function createR2Client(config: R2Config): S3Client {
    return new S3Client({
        region: 'auto',
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey
        },
        forcePathStyle: true
    });
}

export async function testR2Connection(runtimeConfig: RuntimeConfig): Promise<void> {
    const config = getR2ConfigFromRuntimeConfig(runtimeConfig);
    await createR2Client(config).send(
        new HeadBucketCommand({
            Bucket: config.bucket
        })
    );
}

export async function putR2Image(filename: string, body: Buffer, contentType?: string): Promise<void> {
    const config = getR2Config();
    await createR2Client(config).send(
        new PutObjectCommand({
            Bucket: config.bucket,
            Key: filename,
            Body: body,
            ContentType: contentType || lookup(filename) || 'application/octet-stream'
        })
    );
}

export function getR2PublicUrl(key: string, runtimeConfig: RuntimeConfig = getRuntimeConfig()): string | null {
    const publicBaseUrl = runtimeConfig.r2PublicBaseUrl.trim().replace(/\/+$/, '');
    if (!publicBaseUrl) {
        return null;
    }

    return `${publicBaseUrl}/${key.replace(/^\/+/, '')}`;
}

async function readBody(output: GetObjectCommandOutput): Promise<Buffer> {
    if (!output.Body) {
        throw new Error('R2 object response did not include a body.');
    }

    const body = output.Body as {
        transformToByteArray?: () => Promise<Uint8Array>;
    };

    if (body.transformToByteArray) {
        return Buffer.from(await body.transformToByteArray());
    }

    const stream = output.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
}

export async function getR2Image(filename: string): Promise<{ buffer: Buffer; contentType: string }> {
    const config = getR2Config();
    const output = await createR2Client(config).send(
        new GetObjectCommand({
            Bucket: config.bucket,
            Key: filename
        })
    );

    return {
        buffer: await readBody(output),
        contentType: output.ContentType || lookup(filename) || 'application/octet-stream'
    };
}

export async function deleteR2Image(filename: string): Promise<void> {
    const config = getR2Config();
    await createR2Client(config).send(
        new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: filename
        })
    );
}
