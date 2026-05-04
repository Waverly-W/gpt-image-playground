import type { PromptCatalogItem, PromptOutputLanguage, PromptTextPolicy } from './types';

export const SCENE_CATALOG: PromptCatalogItem[] = [
    {
        id: 'poster',
        name: '海报',
        description: 'A designed poster with a clear focal idea, hierarchy, and composition.',
        promptModifier:
            'Build a poster composition with a strong visual hierarchy, intentional spacing, and one memorable focal point.',
        defaultAspectRatio: '3:4',
        defaultTextPolicy: 'text-first'
    },
    {
        id: 'product',
        name: '产品板',
        description: 'A product image or concept board focused on object presentation.',
        promptModifier:
            'Present the product clearly with controlled lighting, useful detail, and a polished commercial layout.',
        defaultAspectRatio: '1:1',
        defaultTextPolicy: 'allow-short-text'
    },
    {
        id: 'character',
        name: '角色设定',
        description: 'A character design, turnaround, or reference image.',
        promptModifier:
            'Keep the character identity consistent, readable, and suitable for a production reference sheet.',
        defaultAspectRatio: '3:4',
        defaultTextPolicy: 'allow-short-text'
    },
    {
        id: 'infographic',
        name: '信息图',
        description: 'A visual explanation with labels, callouts, and clear information hierarchy.',
        promptModifier:
            'Organize information into readable sections with concise labels, visual flow, and clear relationships.',
        defaultAspectRatio: '16:9',
        defaultTextPolicy: 'structured-labels'
    },
    {
        id: 'cover',
        name: '封面',
        description: 'A cover image for editorial, book, album, or article use.',
        promptModifier:
            'Create a cover-ready layout with a strong central image, clean title zone, and editorial polish.',
        defaultAspectRatio: '3:4',
        defaultTextPolicy: 'text-first'
    },
    {
        id: 'social-post',
        name: '社交图文',
        description: 'A social media image optimized for fast scanning.',
        promptModifier:
            'Make the image immediately scannable with a simple message, strong crop, and mobile-friendly details.',
        defaultAspectRatio: '1:1',
        defaultTextPolicy: 'allow-short-text'
    },
    {
        id: 'photo-edit',
        name: '照片编辑',
        description: 'A realistic image edit or enhancement.',
        promptModifier:
            'Preserve the believable camera perspective, lighting continuity, texture, and subject identity.',
        defaultAspectRatio: 'auto',
        defaultTextPolicy: 'allow-short-text'
    },
    {
        id: 'repaint',
        name: '局部重绘',
        description: 'A masked repaint or localized regeneration task.',
        promptModifier:
            'Regenerate only the requested area while matching surrounding lighting, perspective, texture, and style.',
        defaultAspectRatio: 'auto',
        defaultTextPolicy: 'allow-short-text'
    }
];

export const STYLE_CATALOG: PromptCatalogItem[] = [
    {
        id: 'minimal',
        name: '极简',
        description: 'Restrained, clean, and precise.',
        promptModifier:
            'Use a restrained visual system, clean geometry, generous spacing, precise alignment, and minimal clutter.'
    },
    {
        id: 'editorial',
        name: '编辑风',
        description: 'Magazine-like layout and art direction.',
        promptModifier:
            'Use editorial art direction with confident composition, refined typography zones, and polished visual rhythm.'
    },
    {
        id: 'retro',
        name: '复古',
        description: 'Vintage color, texture, and graphic language.',
        promptModifier:
            'Use a retro graphic language with period-aware color, tactile print texture, and composed nostalgia.'
    },
    {
        id: 'cinematic',
        name: '电影感',
        description: 'Film-like lighting, mood, and framing.',
        promptModifier: 'Use cinematic framing, motivated lighting, atmospheric depth, and coherent film still detail.'
    },
    {
        id: 'technical',
        name: '技术图解',
        description: 'Precise diagrams, labels, and production clarity.',
        promptModifier:
            'Use precise technical illustration, clean annotations, controlled linework, and unambiguous structure.'
    }
];

export const TEXT_POLICY_PROMPTS: Record<PromptTextPolicy, string> = {
    'no-text': 'No visible text. Use symbols, composition, and visual storytelling only.',
    'allow-short-text': 'Use short, legible text only. Avoid tiny unreadable paragraphs.',
    'text-first':
        'Text is the primary visual element. Make all typography large, accurate, and central to the composition.',
    'structured-labels':
        'Use structured labels, callouts, captions, and section headers. Keep every label concise and readable.'
};

export const LANGUAGE_PROMPTS: Record<Exclude<PromptOutputLanguage, 'auto'>, string> = {
    zh: 'Use SIMPLIFIED CHINESE for all visible text.',
    en: 'Use ENGLISH for all visible text.',
    ja: 'Use JAPANESE for all visible text.',
    ko: 'Use KOREAN for all visible text.'
};

export function findScene(sceneId: string | undefined): PromptCatalogItem | undefined {
    if (!sceneId) return undefined;
    return SCENE_CATALOG.find((item) => item.id === sceneId);
}

export function findStyle(styleId: string | undefined): PromptCatalogItem | undefined {
    if (!styleId) return undefined;
    return STYLE_CATALOG.find((item) => item.id === styleId);
}
