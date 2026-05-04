import promptTemplateData from '../../docs/gpt-image-prompt_templates/prompts.json';
import type {
    PromptAspectRatio,
    PromptBuilderConfig,
    PromptIntentMode,
    PromptTextPolicy
} from './prompt-builder/types';

type RawPromptTemplate = {
    scene_slug: string;
    scene_title: string;
    index: number;
    id: string;
    slug: string;
    title: string;
    prompt: string;
    imageAlt: string;
    defaultOptions?: string;
    metadata?: string;
};

export type PromptTemplate = {
    id: string;
    sceneSlug: string;
    sceneTitle: string;
    index: number;
    slug: string;
    title: string;
    prompt: string;
    imageAlt: string;
    imageFilename: string;
    aspectRatio: string | null;
    editableVariables: string[];
    promptBuilderConfig: PromptBuilderConfig;
};

export type PromptTemplateScene = {
    slug: string;
    title: string;
    count: number;
};

function parseJsonObject(value: string | undefined): Record<string, unknown> {
    if (!value) return {};

    try {
        const parsed = JSON.parse(value) as unknown;
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

function toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

const rawPromptTemplates = promptTemplateData as RawPromptTemplate[];

const KNOWN_ASPECT_RATIOS = new Set<PromptAspectRatio>(['1:1', '16:9', '9:16', '4:3', '3:4', 'custom', 'auto']);

const SCENE_SLUG_TO_BUILDER_SCENE: Record<string, PromptIntentMode> = {
    'ai-outfit-upgrade-report': 'style-report',
    'big-type-posters': 'poster',
    'biomimicry-product-concepts': 'product',
    'character-design-charts': 'character',
    'concept-posters': 'poster',
    'cutaway-educational-picture-books': 'educational',
    'double-exposure-character-posters': 'portrait',
    'eastern-myth-portraits': 'portrait',
    'evolution-history-infographics': 'infographic',
    'exploded-assembly-drawings': 'educational',
    'facial-aesthetic-report': 'style-report',
    'hairstyle-upgrade-report': 'style-report',
    'lipstick-recommendation-report': 'style-report',
    'luxury-skincare-storyboards': 'product',
    'matchday-posters': 'poster',
    'object-fashion-concepts': 'product',
    'palmistry-infographics': 'infographic',
    'personal-color-analysis': 'style-report',
    'poetry-analysis-posters': 'poster',
    'premium-typography-posters': 'poster',
    'sports-fashion-ad-posters': 'poster',
    'style-persona-choice-posters': 'style-report',
    'travel-memory-poster': 'poster',
    'word-visuals': 'poster'
};

function resolveBuilderScene(sceneSlug: string): PromptIntentMode {
    if (SCENE_SLUG_TO_BUILDER_SCENE[sceneSlug]) return SCENE_SLUG_TO_BUILDER_SCENE[sceneSlug];
    if (sceneSlug.includes('infographic')) return 'infographic';
    if (sceneSlug.includes('character')) return 'character';
    if (sceneSlug.includes('product') || sceneSlug.includes('skincare') || sceneSlug.includes('object'))
        return 'product';
    if (sceneSlug.includes('report') || sceneSlug.includes('style') || sceneSlug.includes('outfit'))
        return 'style-report';
    if (sceneSlug.includes('cutaway') || sceneSlug.includes('educational')) return 'educational';
    if (sceneSlug.includes('portrait') || sceneSlug.includes('myth')) return 'portrait';
    if (sceneSlug.includes('social')) return 'social-post';
    return 'poster';
}

function resolveBuilderStyle(sceneSlug: string): string {
    if (sceneSlug.includes('retro') || sceneSlug.includes('punk')) return 'retro';
    if (sceneSlug.includes('cinematic') || sceneSlug.includes('sports')) return 'cinematic';
    if (sceneSlug.includes('technical') || sceneSlug.includes('exploded') || sceneSlug.includes('cutaway')) {
        return 'technical';
    }
    if (sceneSlug.includes('holographic') || sceneSlug.includes('anime')) return 'anime-card';
    if (sceneSlug.includes('luxury') || sceneSlug.includes('skincare')) return 'luxury';
    if (sceneSlug.includes('satirical') || sceneSlug.includes('big-type')) return 'zine';
    if (sceneSlug.includes('silk') || sceneSlug.includes('poetry') || sceneSlug.includes('eastern')) return 'ink';
    if (sceneSlug.includes('product') || sceneSlug.includes('biomimicry')) return 'clean-commercial';
    if (sceneSlug.includes('picture-book')) return 'playful';
    return 'editorial';
}

function resolveTextPolicy(sceneId: PromptIntentMode): PromptTextPolicy {
    if (sceneId === 'infographic' || sceneId === 'style-report' || sceneId === 'educational') {
        return 'structured-labels';
    }
    if (sceneId === 'poster') return 'text-first';
    return 'allow-short-text';
}

function resolveAspectRatio(aspectRatio: string | null): PromptAspectRatio | undefined {
    if (!aspectRatio) return undefined;
    return KNOWN_ASPECT_RATIOS.has(aspectRatio as PromptAspectRatio) ? (aspectRatio as PromptAspectRatio) : 'custom';
}

function buildTemplatePromptBuilderConfig({
    prompt,
    sceneSlug,
    aspectRatio
}: {
    prompt: string;
    sceneSlug: string;
    aspectRatio: string | null;
}): PromptBuilderConfig {
    const sceneId = resolveBuilderScene(sceneSlug);

    return {
        promptMode: 'guided',
        rawDescription: prompt,
        sceneId,
        styleId: resolveBuilderStyle(sceneSlug),
        aspectRatio: resolveAspectRatio(aspectRatio),
        textPolicy: resolveTextPolicy(sceneId),
        outputLanguage: 'auto'
    };
}

export const PROMPT_TEMPLATES: PromptTemplate[] = rawPromptTemplates.map((template) => {
    const defaultOptions = parseJsonObject(template.defaultOptions);
    const metadata = parseJsonObject(template.metadata);
    const imageFilename = `${template.scene_slug}__${template.slug}.webp`;
    const aspectRatio = typeof defaultOptions.aspect_ratio === 'string' ? defaultOptions.aspect_ratio : null;

    return {
        id: template.id,
        sceneSlug: template.scene_slug,
        sceneTitle: template.scene_title,
        index: template.index,
        slug: template.slug,
        title: template.title,
        prompt: template.prompt,
        imageAlt: template.imageAlt || template.title,
        imageFilename,
        aspectRatio,
        editableVariables: toStringArray(metadata.editableVariables),
        promptBuilderConfig: buildTemplatePromptBuilderConfig({
            prompt: template.prompt,
            sceneSlug: template.scene_slug,
            aspectRatio
        })
    };
});

export const PROMPT_TEMPLATE_SCENES: PromptTemplateScene[] = Array.from(
    PROMPT_TEMPLATES.reduce((scenes, template) => {
        const existing = scenes.get(template.sceneSlug);
        scenes.set(template.sceneSlug, {
            slug: template.sceneSlug,
            title: template.sceneTitle,
            count: (existing?.count ?? 0) + 1
        });
        return scenes;
    }, new Map<string, PromptTemplateScene>()).values()
);

export const PROMPT_TEMPLATE_IMAGE_FILENAMES = new Set(PROMPT_TEMPLATES.map((template) => template.imageFilename));
