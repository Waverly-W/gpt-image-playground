import type { PromptCatalogItem } from '../types';

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
    },
    {
        id: 'luxury',
        name: '高级质感',
        description: 'Premium materials, elegant composition, and refined lighting.',
        promptModifier:
            'Use premium art direction with refined lighting, tactile materials, elegant restraint, and polished detail.'
    },
    {
        id: 'playful',
        name: '活泼插画',
        description: 'Friendly illustration with approachable shapes and color.',
        promptModifier:
            'Use friendly illustrated forms, approachable color, clear silhouettes, and a light playful tone.'
    },
    {
        id: 'documentary',
        name: '纪实摄影',
        description: 'Natural, believable, and observational.',
        promptModifier:
            'Use a documentary photographic feel with natural light, believable texture, and unstaged realism.'
    },
    {
        id: 'anime-card',
        name: '动漫卡牌',
        description: 'Stylized card composition with foil-like energy and character focus.',
        promptModifier:
            'Use collectible card composition, stylized character energy, crisp graphic framing, and luminous detail.'
    },
    {
        id: 'ink',
        name: '水墨东方',
        description: 'Ink, paper, and East Asian poetic atmosphere.',
        promptModifier:
            'Use ink-inspired atmosphere, paper texture, poetic negative space, and restrained East Asian visual rhythm.'
    },
    {
        id: 'clean-commercial',
        name: '商业清爽',
        description: 'Clean product or campaign styling.',
        promptModifier:
            'Use clean commercial styling with direct readability, bright controlled lighting, and practical campaign polish.'
    },
    {
        id: 'zine',
        name: '独立杂志',
        description: 'Raw graphic texture, expressive type, and independent publishing energy.',
        promptModifier:
            'Use independent zine-inspired composition with expressive type zones, raw texture, and bold graphic tension.'
    }
];
