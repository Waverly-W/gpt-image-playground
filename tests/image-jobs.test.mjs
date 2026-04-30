import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const dbPath = path.join(
    tmpdir(),
    `gpt-image-playground-jobs-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
);
process.env.SQLITE_DB_PATH = dbPath;

const db = await import('../src/lib/sqlite-db.ts');
const jobs = await import('../src/lib/image-jobs.ts');

test.after(() => {
    db.closeDbForTests?.();
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
});

test('creates pending image job and lists jobs by owner only', () => {
    const first = jobs.createImageJob({
        ownerUserId: 'usr_1',
        mode: 'generate',
        prompt: 'a red kite',
        model: 'gpt-image-2',
        params: { n: 1, size: '1024x1024', quality: 'auto' }
    });
    const second = jobs.createImageJob({
        ownerUserId: 'usr_2',
        mode: 'edit',
        prompt: 'make it blue',
        model: 'gpt-image-1',
        params: { n: 1, size: 'auto' }
    });

    assert.match(first.id, /^job_/);
    assert.equal(first.status, 'pending');
    assert.equal(first.ownerUserId, 'usr_1');
    assert.equal(first.prompt, 'a red kite');
    assert.deepEqual(first.params, { n: 1, size: '1024x1024', quality: 'auto' });
    assert.equal(first.images.length, 0);
    assert.equal(first.error, null);

    assert.deepEqual(
        jobs.listImageJobsForUser('usr_1').map((job) => job.id),
        [first.id]
    );
    assert.deepEqual(
        jobs.listImageJobsForUser('usr_2').map((job) => job.id),
        [second.id]
    );
});

test('transitions image jobs through running completed and failed states', () => {
    const job = jobs.createImageJob({
        ownerUserId: 'usr_status',
        mode: 'generate',
        prompt: 'status test',
        model: 'gpt-image-2',
        params: { n: 1 }
    });

    const running = jobs.markImageJobRunning(job.id);
    assert.equal(running.status, 'running');
    assert.ok(running.startedAt);

    const completed = jobs.completeImageJob(job.id, {
        storageModeUsed: 'fs',
        durationMs: 1234,
        images: [{ filename: 'example.png', output_format: 'png', path: '/api/image/example.png' }],
        usage: { output_tokens: 10, input_tokens_details: { text_tokens: 5 } },
        costDetails: {
            estimated_cost_usd: 0.0003,
            text_input_tokens: 5,
            image_input_tokens: 0,
            image_output_tokens: 10
        }
    });

    assert.equal(completed.status, 'completed');
    assert.equal(completed.storageModeUsed, 'fs');
    assert.equal(completed.durationMs, 1234);
    assert.deepEqual(completed.images, [
        { filename: 'example.png', output_format: 'png', path: '/api/image/example.png' }
    ]);
    assert.deepEqual(completed.costDetails, {
        estimated_cost_usd: 0.0003,
        text_input_tokens: 5,
        image_input_tokens: 0,
        image_output_tokens: 10
    });
    assert.ok(completed.finishedAt);

    const failedJob = jobs.createImageJob({
        ownerUserId: 'usr_status',
        mode: 'generate',
        prompt: 'failure test',
        model: 'gpt-image-2',
        params: {}
    });
    const failed = jobs.failImageJob(failedJob.id, 'OpenAI timed out');

    assert.equal(failed.status, 'failed');
    assert.equal(failed.error, 'OpenAI timed out');
    assert.ok(failed.finishedAt);
});

test('returns null when fetching a job with the wrong owner', () => {
    const job = jobs.createImageJob({
        ownerUserId: 'usr_owner',
        mode: 'generate',
        prompt: 'owned',
        model: 'gpt-image-2',
        params: {}
    });

    assert.equal(jobs.getImageJobForUser(job.id, 'usr_other'), null);
    assert.equal(jobs.getImageJobForUser(job.id, 'usr_owner')?.id, job.id);
});

test('clears image job records for one owner without deleting other users jobs', () => {
    const first = jobs.createImageJob({
        ownerUserId: 'usr_clear_1',
        mode: 'generate',
        prompt: 'clear one',
        model: 'gpt-image-2',
        params: {}
    });
    const second = jobs.createImageJob({
        ownerUserId: 'usr_clear_2',
        mode: 'generate',
        prompt: 'keep two',
        model: 'gpt-image-2',
        params: {}
    });

    assert.equal(jobs.deleteImageJobsForUser('usr_clear_1'), 1);
    assert.equal(jobs.getImageJobForUser(first.id, 'usr_clear_1'), null);
    assert.equal(jobs.getImageJobForUser(second.id, 'usr_clear_2')?.id, second.id);
});
