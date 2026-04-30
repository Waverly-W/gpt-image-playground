'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PromptTemplate, PromptTemplateScene } from '@/lib/prompt-template-data';
import { ImagePlus, Search, WandSparkles } from 'lucide-react';
import Image from 'next/image';
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
        <section className='w-full max-w-screen-2xl space-y-4' aria-labelledby='prompt-template-gallery-title'>
            <div className='flex flex-col gap-4 border-t border-white/10 pt-6 md:flex-row md:items-end md:justify-between'>
                <div className='space-y-1'>
                    <div className='flex items-center gap-2 text-white/70'>
                        <WandSparkles className='h-4 w-4' aria-hidden='true' />
                        <span className='text-xs uppercase tracking-normal'>Prompt Templates</span>
                    </div>
                    <h2 id='prompt-template-gallery-title' className='text-xl font-medium text-white'>
                        GPT Image 提示词画廊
                    </h2>
                    <p className='max-w-2xl text-sm leading-6 text-white/60'>
                        浏览 docs 中的 {templates.length} 个参考模板，选择一个后可直接导入到生成提示词。
                    </p>
                </div>

                <div className='grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_220px] md:w-[560px]'>
                    <div className='space-y-1.5'>
                        <Label htmlFor='prompt-template-search' className='text-xs text-white/70'>
                            搜索
                        </Label>
                        <div className='relative'>
                            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40' />
                            <Input
                                id='prompt-template-search'
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder='标题、场景或提示词'
                                className='rounded-md border-white/20 bg-black pl-9 text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                            />
                        </div>
                    </div>
                    <div className='space-y-1.5'>
                        <Label htmlFor='prompt-template-scene' className='text-xs text-white/70'>
                            场景
                        </Label>
                        <Select value={sceneSlug} onValueChange={setSceneSlug}>
                            <SelectTrigger
                                id='prompt-template-scene'
                                className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                <SelectValue placeholder='选择场景' />
                            </SelectTrigger>
                            <SelectContent className='z-[100] border-white/20 bg-black text-white'>
                                <SelectItem value='all' className='focus:bg-white/10'>
                                    全部场景
                                </SelectItem>
                                {scenes.map((scene) => (
                                    <SelectItem key={scene.slug} value={scene.slug} className='focus:bg-white/10'>
                                        {scene.title} ({scene.count})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {filteredTemplates.length > 0 ? (
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'>
                    {filteredTemplates.map((template) => (
                        <Card
                            key={template.id}
                            className='overflow-hidden rounded-lg border border-white/10 bg-zinc-950 text-white'>
                            <div className='aspect-[4/3] overflow-hidden bg-white/5'>
                                <Image
                                    src={template.imageUrl}
                                    alt={template.imageAlt}
                                    width={640}
                                    height={480}
                                    loading='lazy'
                                    className='h-full w-full object-cover'
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
                                    <h3 className='text-base font-medium leading-6 text-white'>{template.title}</h3>
                                </div>
                                <p className='h-20 overflow-hidden text-sm leading-5 text-white/60'>{template.prompt}</p>
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
        </section>
    );
}
