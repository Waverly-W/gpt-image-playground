import type { PromptCatalogItem } from '../types';

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
        id: 'infographic',
        name: '信息图',
        description: 'A visual explanation with labels, callouts, and clear information hierarchy.',
        promptModifier:
            'Organize information into readable sections with concise labels, visual flow, and clear relationships.',
        defaultAspectRatio: '16:9',
        defaultTextPolicy: 'structured-labels'
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
        id: 'product',
        name: '产品板',
        description: 'A product image or concept board focused on object presentation.',
        promptModifier:
            'Present the product clearly with controlled lighting, useful detail, and a polished commercial layout.',
        defaultAspectRatio: '1:1',
        defaultTextPolicy: 'allow-short-text'
    },
    {
        id: 'style-report',
        name: '风格报告',
        description: 'A structured styling, beauty, outfit, hair, or facial analysis board.',
        promptModifier:
            'Use a report-board layout with clear before/after comparison, concise labels, practical recommendations, and readable sections.',
        defaultAspectRatio: '4:3',
        defaultTextPolicy: 'structured-labels'
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
        id: 'educational',
        name: '科普图解',
        description: 'An educational cutaway, picture-book, or explanatory page.',
        promptModifier:
            'Explain the subject through friendly educational structure, clear visual hierarchy, simple labels, and approachable diagram detail.',
        defaultAspectRatio: '4:3',
        defaultTextPolicy: 'structured-labels'
    },
    {
        id: 'portrait',
        name: '角色海报',
        description: 'A character poster, mythic portrait, or identity-focused visual.',
        promptModifier:
            'Create a memorable character-led composition with clear identity, atmosphere, and poster-grade visual focus.',
        defaultAspectRatio: '3:4',
        defaultTextPolicy: 'allow-short-text'
    }
];
