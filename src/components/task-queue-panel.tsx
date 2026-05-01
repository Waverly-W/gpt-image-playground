'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CostDetails, GptImageModel } from '@/lib/cost-utils';
import { Image as AntImage } from 'antd';
import { CheckCircle2, Clock3, Cloud, ImageIcon, Layers, Loader2, Trash2, XCircle } from 'lucide-react';
import * as React from 'react';

export type QueueImageJob = {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    mode: 'generate' | 'edit';
    prompt: string;
    model: GptImageModel;
    params: Record<string, unknown>;
    images: Array<{ filename: string; path?: string; output_format?: string }>;
    previewImage: {
        b64_json: string;
        partial_image_index: number;
        output_format?: string;
        updatedAt: string;
    } | null;
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

function previewImageSrc(previewImage: NonNullable<QueueImageJob['previewImage']>): string {
    const format = previewImage.output_format === 'jpeg' ? 'jpeg' : (previewImage.output_format ?? 'png');
    return `data:image/${format};base64,${previewImage.b64_json}`;
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
            <AntImage.PreviewGroup
                items={job.images.map((image) => ({
                    src: imageSrc(image),
                    alt: '生成结果大图'
                }))}
                preview={{
                    countRender: (current, total) => `${current} / ${total}`
                }}>
                <div className='relative aspect-square w-24 shrink-0 overflow-hidden rounded-md border border-white/15 bg-neutral-900 focus-within:ring-2 focus-within:ring-white focus-within:ring-offset-2 focus-within:ring-offset-black'>
                    <AntImage
                        src={imageSrc(firstImage)}
                        alt='任务缩略图'
                        width='100%'
                        height='100%'
                        rootClassName='block h-full w-full'
                        className='h-full w-full object-cover'
                        preview={{
                            mask: '查看大图'
                        }}
                    />
                    {job.images.length > 1 && (
                        <span className='pointer-events-none absolute right-1 bottom-1 inline-flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white'>
                            <Layers className='h-3 w-3' />
                            {job.images.length}
                        </span>
                    )}
                </div>
            </AntImage.PreviewGroup>
        );
    }

    if ((job.status === 'running' || job.status === 'failed') && job.previewImage) {
        return (
            <div className='relative aspect-square w-24 shrink-0 overflow-hidden rounded-md border border-white/15 bg-neutral-900 focus-within:ring-2 focus-within:ring-white focus-within:ring-offset-2 focus-within:ring-offset-black'>
                <AntImage
                    src={previewImageSrc(job.previewImage)}
                    alt={job.status === 'failed' ? '任务失败前预览图' : '任务流式预览图'}
                    width='100%'
                    height='100%'
                    rootClassName='block h-full w-full'
                    className='h-full w-full object-cover'
                    preview={{
                        mask: job.status === 'failed' ? '查看最后预览' : '查看预览'
                    }}
                />
                <span className='pointer-events-none absolute right-1 bottom-1 rounded bg-black/75 px-1.5 py-0.5 text-xs text-white'>
                    预览
                </span>
            </div>
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
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-950'>
            <CardHeader className='flex flex-row items-center justify-between gap-3 border-b border-white/10 px-4 py-4'>
                <div className='min-w-0'>
                    <CardTitle className='text-xl font-semibold text-white'>任务队列</CardTitle>
                    <p className='mt-1 text-sm text-white/50'>最多 5 个任务同时生成，最新任务显示在顶部。</p>
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
                    <div className='flex h-full min-h-[420px] items-center justify-center rounded-md border border-dashed border-white/10 bg-black text-center text-white/45'>
                        <div className='flex max-w-xs flex-col items-center gap-3 px-6'>
                            <ImageIcon className='h-8 w-8 text-white/25' />
                            <p className='text-sm leading-6'>点击左侧生成或编辑按钮后，任务进度和结果会显示在这里。</p>
                        </div>
                    </div>
                ) : (
                    <div className='flex flex-col gap-3'>
                        {jobs.map((job) => (
                            <article
                                key={job.id}
                                className='flex gap-3 rounded-md border border-white/10 bg-neutral-950/70 p-3'>
                                <JobPreview job={job} />
                                <div className='flex min-w-0 flex-1 flex-col gap-2'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <TaskStatusBadge status={job.status} />
                                        <span className='rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/55'>
                                            {job.mode === 'edit' ? '编辑' : '生成'}
                                        </span>
                                        <span className='rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/55'>
                                            {job.model}
                                        </span>
                                        {job.storageModeUsed === 'r2' && (
                                            <span className='inline-flex items-center gap-1 rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-200'>
                                                <Cloud className='h-3.5 w-3.5' />
                                                R2
                                            </span>
                                        )}
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
