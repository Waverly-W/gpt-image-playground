'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { CostDetails, GptImageModel } from '@/lib/cost-utils';
import { CheckCircle2, Clock3, ImageIcon, Layers, Loader2, Trash2, XCircle } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

export type QueueImageJob = {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    mode: 'generate' | 'edit';
    prompt: string;
    model: GptImageModel;
    params: Record<string, unknown>;
    images: Array<{ filename: string; path?: string; output_format?: string }>;
    storageModeUsed: 'fs' | 'indexeddb' | 'r2' | null;
    durationMs: number | null;
    costDetails: CostDetails | null;
    error: string | null;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
};

type TaskQueuePanelProps = {
    jobs: QueueImageJob[];
    onClearQueue: () => void;
};

const statusMeta = {
    pending: {
        label: '排队中',
        Icon: Clock3,
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    },
    running: {
        label: '生成中',
        Icon: Loader2,
        className: 'border-sky-500/30 bg-sky-500/10 text-sky-200'
    },
    completed: {
        label: '已完成',
        Icon: CheckCircle2,
        className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    },
    failed: {
        label: '失败',
        Icon: XCircle,
        className: 'border-red-500/30 bg-red-500/10 text-red-200'
    }
} satisfies Record<QueueImageJob['status'], { label: string; Icon: React.ElementType; className: string }>;

function formatTime(value: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleString();
}

function formatDuration(ms: number | null): string {
    if (!ms) return '';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function imageSrc(image: QueueImageJob['images'][number]): string {
    return image.path ?? `/api/image/${image.filename}`;
}

function TaskStatusBadge({ status }: { status: QueueImageJob['status'] }) {
    const meta = statusMeta[status];
    const Icon = meta.Icon;

    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${meta.className}`}>
            <Icon className={`h-3.5 w-3.5 ${status === 'running' ? 'animate-spin' : ''}`} />
            {meta.label}
        </span>
    );
}

function JobPreview({ job }: { job: QueueImageJob }) {
    const firstImage = job.images[0];

    if (job.status === 'completed' && firstImage) {
        return (
            <Dialog>
                <DialogTrigger asChild>
                    <button
                        type='button'
                        className='relative aspect-square w-24 shrink-0 overflow-hidden rounded-md border border-white/15 bg-neutral-900 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black focus:outline-none'
                        aria-label='查看大图'>
                        <Image
                            src={imageSrc(firstImage)}
                            alt='任务缩略图'
                            fill
                            sizes='96px'
                            className='object-cover'
                            unoptimized
                        />
                        {job.images.length > 1 && (
                            <span className='absolute right-1 bottom-1 inline-flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white'>
                                <Layers className='h-3 w-3' />
                                {job.images.length}
                            </span>
                        )}
                    </button>
                </DialogTrigger>
                <DialogContent className='max-h-[90vh] border-neutral-700 bg-neutral-950 text-white sm:max-w-5xl'>
                    <DialogHeader>
                        <DialogTitle>查看大图</DialogTitle>
                    </DialogHeader>
                    <div className='grid max-h-[75vh] gap-3 overflow-y-auto sm:grid-cols-2'>
                        {job.images.map((image) => (
                            <div
                                key={image.filename}
                                className='relative min-h-[280px] overflow-hidden rounded-md border border-white/10 bg-black'>
                                <Image
                                    src={imageSrc(image)}
                                    alt='生成结果大图'
                                    fill
                                    sizes='(max-width: 768px) 100vw, 50vw'
                                    className='object-contain'
                                    unoptimized
                                />
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <div className='flex aspect-square w-24 shrink-0 items-center justify-center rounded-md border border-white/10 bg-neutral-900 text-white/35'>
            {job.status === 'failed' ? <XCircle className='h-6 w-6' /> : <ImageIcon className='h-6 w-6' />}
        </div>
    );
}

export function TaskQueuePanel({ jobs, onClearQueue }: TaskQueuePanelProps) {
    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex flex-row items-center justify-between gap-3 border-b border-white/10 px-4 py-3'>
                <div>
                    <CardTitle className='text-lg font-medium text-white'>任务队列</CardTitle>
                    <p className='mt-1 text-xs text-white/45'>最多 5 个任务同时生成。</p>
                </div>
                {jobs.length > 0 && (
                    <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={onClearQueue}
                        className='h-9 rounded-md px-2 text-white/60 hover:bg-white/10 hover:text-white'>
                        <Trash2 className='mr-1.5 h-4 w-4' />
                        清空
                    </Button>
                )}
            </CardHeader>
            <CardContent className='flex-1 overflow-y-auto p-4'>
                {jobs.length === 0 ? (
                    <div className='flex h-full min-h-[360px] items-center justify-center text-white/40'>
                        <p>点击生成后，任务会显示在这里。</p>
                    </div>
                ) : (
                    <div className='space-y-3'>
                        {jobs.map((job) => (
                            <article
                                key={job.id}
                                className='flex gap-3 rounded-md border border-white/10 bg-neutral-950/70 p-3'>
                                <JobPreview job={job} />
                                <div className='min-w-0 flex-1 space-y-2'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <TaskStatusBadge status={job.status} />
                                        <span className='rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/55'>
                                            {job.mode === 'edit' ? '编辑' : '生成'}
                                        </span>
                                        <span className='rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/55'>
                                            {job.model}
                                        </span>
                                    </div>
                                    <p className='line-clamp-2 text-sm leading-5 text-white/85'>{job.prompt}</p>
                                    <div className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45'>
                                        <span>创建：{formatTime(job.createdAt)}</span>
                                        {job.startedAt && <span>开始：{formatTime(job.startedAt)}</span>}
                                        {job.durationMs !== null && <span>耗时：{formatDuration(job.durationMs)}</span>}
                                    </div>
                                    {job.status === 'failed' && job.error && (
                                        <p className='text-xs leading-5 text-red-300'>{job.error}</p>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
