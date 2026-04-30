import promptTemplateData from '../../docs/gpt-image-prompt_templates/prompts.json';

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
    imageUrl: string;
    aspectRatio: string | null;
    editableVariables: string[];
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

export const PROMPT_TEMPLATES: PromptTemplate[] = rawPromptTemplates.map((template) => {
    const defaultOptions = parseJsonObject(template.defaultOptions);
    const metadata = parseJsonObject(template.metadata);
    const imageFilename = `${template.scene_slug}__${template.slug}.webp`;

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
        imageUrl: `/api/prompt-template-images/${imageFilename}`,
        aspectRatio: typeof defaultOptions.aspect_ratio === 'string' ? defaultOptions.aspect_ratio : null,
        editableVariables: toStringArray(metadata.editableVariables)
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
