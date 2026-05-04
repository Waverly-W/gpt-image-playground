'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PromptTemplate, PromptTemplateScene } from '@/lib/prompt-template-data';
import { Image as AntImage } from 'antd';
import { ImagePlus, Search, WandSparkles } from 'lucide-react';
import * as React from 'react';

type PromptTemplateGalleryProps = {
    templates: Array<PromptTemplate & { imageUrl: string }>;
    scenes: PromptTemplateScene[];
    onImportPrompt: (prompt: string) => void;
};

export function PromptTemplateGallery({ templates, scenes, onImportPrompt }: PromptTemplateGalleryProps) {
    const [query, setQuery] = React.useState('');
    const [sceneSlug, setSceneSlug] = React.useState('all');

    const normalizedQuery = query.trim().toLowerCase();
    const filteredTemplates = React.useMemo(() => {
        return templates.filter((template) => {
            const matchesScene = sceneSlug === 'all' || template.sceneSlug === sceneSlug;
            const matchesQuery =
                !normalizedQuery ||
                [template.title, template.sceneTitle, template.prompt, template.slug]
                    .join(' ')
                    .toLowerCase()
                    .includes(normalizedQuery);

            return matchesScene && matchesQuery;
        });
    }, [normalizedQuery, sceneSlug, templates]);

    return (
        <section className='w-full space-y-4' aria-labelledby='prompt-template-gallery-title'>
            <div className='flex flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:items-end md:justify-between'>
                <div className='space-y-1'>
                    <div className='flex items-center gap-2 text-white/70'>
                        <WandSparkles className='h-4 w-4' aria-hidden='true' />
                        <span className='text-xs tracking-normal'>提示词模板</span>
                    </div>
                    <h2 id='prompt-template-gallery-title' className='text-xl font-medium text-white'>
                        GPT Image 提示词画廊
                    </h2>
                    <p className='max-w-2xl text-sm leading-6 text-white/60'>
                        浏览 docs 中的 {templates.length} 个参考模板，选择一个后可直接导入到生成提示词。
                    </p>
                </div>
            </div>

            <div className='grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start'>
                <aside
                    aria-label='提示词场景筛选'
                    className='rounded-lg border border-white/10 bg-zinc-950 p-3 lg:sticky lg:top-6'>
                    <div className='mb-3 flex items-center justify-between gap-3 px-1'>
                        <h3 className='text-sm font-medium text-white'>场景</h3>
                        <span className='text-xs text-white/45'>{scenes.length.toLocaleString()} 类</span>
                    </div>
                    <div className='flex max-h-[360px] flex-col gap-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-9rem)]'>
                        <button
                            type='button'
                            aria-pressed={sceneSlug === 'all'}
                            onClick={() => setSceneSlug('all')}
                            className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors ${
                                sceneSlug === 'all'
                                    ? 'bg-white text-black'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                            }`}>
                            <span className='truncate'>全部场景</span>
                            <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                                    sceneSlug === 'all' ? 'bg-black/10 text-black/70' : 'bg-white/10 text-white/55'
                                }`}>
                                {templates.length.toLocaleString()}
                            </span>
                        </button>
                        {scenes.map((scene) => {
                            const isSelected = sceneSlug === scene.slug;

                            return (
                                <button
                                    key={scene.slug}
                                    type='button'
                                    aria-pressed={isSelected}
                                    onClick={() => setSceneSlug(scene.slug)}
                                    className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors ${
                                        isSelected
                                            ? 'bg-white text-black'
                                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                                    }`}>
                                    <span className='truncate'>{scene.title}</span>
                                    <span
                                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                                            isSelected ? 'bg-black/10 text-black/70' : 'bg-white/10 text-white/55'
                                        }`}>
                                        {scene.count.toLocaleString()}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <div className='min-w-0 space-y-4'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div className='w-full space-y-1.5 md:max-w-md'>
                            <Label htmlFor='prompt-template-search' className='text-xs text-white/70'>
                                搜索
                            </Label>
                            <div className='relative'>
                                <Search className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/40' />
                                <Input
                                    id='prompt-template-search'
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder='标题、场景或提示词'
                                    className='rounded-md border-white/20 bg-black pl-9 text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                />
                            </div>
                        </div>
                        <p className='text-sm text-white/55'>
                            显示 {filteredTemplates.length.toLocaleString()} / {templates.length.toLocaleString()}{' '}
                            个模板
                        </p>
                    </div>

                    {filteredTemplates.length > 0 ? (
                        <div className='grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4'>
                            {filteredTemplates.map((template) => (
                                <Card
                                    key={template.id}
                                    className='overflow-hidden rounded-lg border border-white/10 bg-zinc-950 text-white'>
                                    <div className='aspect-[4/3] overflow-hidden bg-white/5'>
                                        <AntImage
                                            src={template.imageUrl}
                                            alt={template.imageAlt}
                                            loading='lazy'
                                            width='100%'
                                            height='100%'
                                            rootClassName='block h-full w-full'
                                            className='h-full w-full object-cover'
                                            preview={{
                                                mask: '预览图片'
                                            }}
                                        />
                                    </div>
                                    <CardContent className='space-y-3 p-4'>
                                        <div className='space-y-1'>
                                            <div className='flex items-center justify-between gap-2 text-xs text-white/50'>
                                                <span className='truncate'>{template.sceneTitle}</span>
                                                {template.aspectRatio && (
                                                    <span className='shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-white/60'>
                                                        {template.aspectRatio}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className='text-base leading-6 font-medium text-white'>
                                                {template.title}
                                            </h3>
                                        </div>
                                        <p className='h-20 overflow-hidden text-sm leading-5 text-white/60'>
                                            {template.prompt}
                                        </p>
                                        <Button
                                            type='button'
                                            onClick={() => onImportPrompt(template.prompt)}
                                            className='flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-white text-black hover:bg-white/90'>
                                            <ImagePlus className='h-4 w-4' aria-hidden='true' />
                                            导入提示词
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className='rounded-lg border border-white/10 bg-zinc-950 p-8 text-center text-sm text-white/60'>
                            没有匹配的提示词模板。
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
