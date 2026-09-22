import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const root = path.join(tmpdir(), `gpt-image-playground-internal-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const dbPath = path.join(root, 'jobs.db');
process.env.SQLITE_DB_PATH = dbPath;
mkdirSync(root, { recursive: true });

const db = await import('../src/lib/sqlite-db.ts');
const jobs = await import('../src/lib/image-jobs.ts');
const queue = await import('../src/lib/image-job-queue.ts');
const internalApi = await import('../src/lib/internal-batch-api.ts');

test.after(() => {
    db.closeDbForTests?.();
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
});

test('internal batch generate creates local queued jobs from an absolute CSV path', async () => {
    const outputDir = path.join(root, 'outputs');
    const csvPath = path.join(root, 'generate.csv');
    writeFileSync(
        csvPath,
        [
            'prompt,model,n,size,width,height,quality,output_format,output_compression,background,moderation,stream,partial_images',
            '"first prompt",gpt-image-2,1,auto,,,auto,png,100,auto,auto,false,2',
            '"second prompt",gpt-image-2,1,auto,,,auto,png,100,auto,auto,false,2'
        ].join('\n')
    );

    const result = await internalApi.createInternalBatchJobs({
        mode: 'generate',
        csvPath,
        outputDir,
        ownerUserId: 'internal-test',
        schedule: false
    });

    assert.equal(result.jobs.length, 2);
    assert.equal(result.errors.length, 0);
    assert.deepEqual(
        result.jobs.map((job) => job.status),
        ['pending', 'pending']
    );

    const firstJob = jobs.getImageJobForUser(result.jobs[0].id, 'internal-test');
    assert.equal(firstJob.params.storage_mode, 'fs');
    assert.equal(firstJob.params.output_dir, outputDir);
    assert.equal(firstJob.params.return_absolute_paths, 'true');
    assert.equal(firstJob.params.auto_retry, 'true');
    assert.equal(firstJob.params.max_auto_retries, '3');
    assert.equal(queue.hasQueuedImageJobPayload(result.jobs[0].id), true);
});

test('internal batch edit rejects relative CSV image paths', async () => {
    const outputDir = path.join(root, 'edit-outputs');
    const csvPath = path.join(root, 'edit.csv');
    writeFileSync(
        csvPath,
        [
            'prompt,input_image_paths,model,n,size,width,height,quality,stream,partial_images',
            '"edit prompt","./relative.png",gpt-image-2,1,auto,,,auto,false,2'
        ].join('\n')
    );

    await assert.rejects(
        () =>
            internalApi.createInternalBatchJobs({
                mode: 'edit',
                csvPath,
                outputDir,
                ownerUserId: 'internal-test',
                schedule: false
            }),
        /第 2 行：input_image_paths 只支持本机绝对路径。/
    );
});

test('internal batch requests require absolute CSV and output paths', async () => {
    await assert.rejects(
        () =>
            internalApi.createInternalBatchJobs({
                mode: 'generate',
                csvPath: 'relative.csv',
                outputDir: path.join(root, 'outputs'),
                schedule: false
            }),
        /csv_path 必须是本机绝对路径。/
    );

    await assert.rejects(
        () =>
            internalApi.createInternalBatchJobs({
                mode: 'generate',
                csvPath: path.join(root, 'missing.csv'),
                outputDir: 'relative-output',
                schedule: false
            }),
        /output_dir 必须是本机绝对路径。/
    );
});
