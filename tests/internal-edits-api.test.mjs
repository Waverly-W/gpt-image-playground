import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

process.env.NODE_ENV = 'test';

const editsRoute = await import('../src/app/api/internal/edits/route.ts');

test('internal edits GET returns status ok for localhost', async () => {
    const req = new NextRequest('http://127.0.0.1:3005/api/internal/edits', {
        method: 'GET',
        headers: { host: '127.0.0.1:3005' }
    });
    const res = await editsRoute.GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
});

test('internal edits rejects non-local unauthorized requests', async () => {
    const req = new NextRequest('http://example.com/api/internal/edits', {
        method: 'GET',
        headers: {
            host: 'example.com',
            'x-forwarded-for': '203.0.113.1'
        }
    });
    const res = await editsRoute.GET(req);
    assert.equal(res.status, 403);
});

test('internal edits POST rejects request without prompt', async () => {
    const req = new NextRequest('http://127.0.0.1:3005/api/internal/edits', {
        method: 'POST',
        headers: {
            host: '127.0.0.1:3005',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        })
    });
    const res = await editsRoute.POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Missing required parameter: prompt/);
});

test('internal edits POST rejects request without image', async () => {
    const req = new NextRequest('http://127.0.0.1:3005/api/internal/edits', {
        method: 'POST',
        headers: {
            host: '127.0.0.1:3005',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            prompt: 'test prompt'
        })
    });
    const res = await editsRoute.POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Missing image/);
});
