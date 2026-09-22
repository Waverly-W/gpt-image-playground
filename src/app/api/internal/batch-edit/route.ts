import { createInternalBatchJobs, InternalBatchApiError } from '@/lib/internal-batch-api';
import { NextRequest, NextResponse } from 'next/server';

type InternalBatchRequestBody = {
    csv_path?: unknown;
    output_dir?: unknown;
    owner_user_id?: unknown;
    max_retries?: unknown;
};

function readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function readOptionalRetries(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as InternalBatchRequestBody;
        const result = await createInternalBatchJobs({
            mode: 'edit',
            csvPath: readString(body.csv_path),
            outputDir: readString(body.output_dir),
            ownerUserId: readString(body.owner_user_id) || undefined,
            maxRetries: readOptionalRetries(body.max_retries)
        });

        return NextResponse.json({ jobs: result.jobs, errors: result.errors }, { status: 202 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create internal batch edit jobs.';
        const status = error instanceof InternalBatchApiError ? error.status : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
