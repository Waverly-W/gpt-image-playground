import { findScene, findStyle, LANGUAGE_PROMPTS, TEXT_POLICY_PROMPTS } from './catalogs';
import { cleanupPromptText, normalizePromptBuilderConfig } from './cleanup';
import type { BuiltPrompt, PromptBlock, PromptBuilderConfig } from './types';

function block(id: string, title: string, content: string): PromptBlock {
    return {
        id,
        title,
        enabled: true,
        content
    };
}

function formatBlock(promptBlock: PromptBlock): string {
    return `**${promptBlock.title}**: ${promptBlock.content}`;
}

function parseJsonConfig(value: FormDataEntryValue | null): {
    config?: Partial<PromptBuilderConfig>;
    warning?: string;
} {
    if (typeof value !== 'string' || !value.trim()) return {};

    try {
        const parsed = JSON.parse(value) as unknown;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return { config: parsed as Partial<PromptBuilderConfig> };
        }
    } catch {
        return { warning: 'prompt_builder_config is invalid JSON; falling back to prompt fields.' };
    }

    return { warning: 'prompt_builder_config must be a JSON object; falling back to prompt fields.' };
}

function validatePromptConfig(config: PromptBuilderConfig): string[] {
    const warnings: string[] = [];

    if (!cleanupPromptText(config.rawDescription)) {
        warnings.push('rawDescription is empty; the generated prompt will rely on builder controls only.');
    }
    if (config.sceneId && !findScene(config.sceneId)) {
        warnings.push(`Unknown sceneId "${config.sceneId}"; scene-specific guidance was skipped.`);
    }
    if (config.styleId && !findStyle(config.styleId)) {
        warnings.push(`Unknown styleId "${config.styleId}"; style guidance was skipped.`);
    }

    return warnings;
}

function buildTextPolicyBlock(config: PromptBuilderConfig): PromptBlock | null {
    if (!config.textPolicy) return null;

    const policy = TEXT_POLICY_PROMPTS[config.textPolicy];
    if (!policy) return null;

    const language =
        config.outputLanguage && config.outputLanguage !== 'auto' ? LANGUAGE_PROMPTS[config.outputLanguage] : undefined;
    return block('text-policy', 'TEXT POLICY', [policy, language].filter(Boolean).join(' '));
}

export function buildPrompt(input: PromptBuilderConfig): BuiltPrompt {
    const builderConfig = normalizePromptBuilderConfig(input);
    const rawPrompt = String(builderConfig.rawDescription ?? '');

    if (builderConfig.promptMode === 'free') {
        return {
            rawPrompt,
            fullPrompt: rawPrompt,
            builderConfig,
            blocks: [],
            warnings: []
        };
    }

    const scene = findScene(builderConfig.sceneId);
    const style = findStyle(builderConfig.styleId);
    const description = cleanupPromptText(builderConfig.rawDescription);
    const subject =
        cleanupPromptText(builderConfig.subject) || description || scene?.description || 'the requested image';
    const aspectRatio = builderConfig.aspectRatio || scene?.defaultAspectRatio || 'auto';
    const size = builderConfig.size || 'auto';
    const textPolicy = buildTextPolicyBlock({
        ...builderConfig,
        textPolicy: builderConfig.textPolicy || scene?.defaultTextPolicy
    });
    const keywordText = builderConfig.keywords?.length ? ` Keywords: ${builderConfig.keywords.join(', ')}.` : '';

    const blocks = [
        block(
            'task',
            'TASK',
            `Generate a ${scene?.id || builderConfig.sceneId || 'guided'} image for: ${subject}.${scene ? ` ${scene.promptModifier}` : ''}`
        ),
        block('specs', 'SPECS', `Canvas: ${aspectRatio}, size: ${size}.${keywordText}`),
        description ? block('desc', 'DESC', description) : null,
        style ? block('style', 'STYLE', style.promptModifier) : null,
        textPolicy,
        block('quality', 'QUALITY', 'High-quality, coherent composition, legible details, production-ready image.')
    ].filter((promptBlock): promptBlock is PromptBlock => Boolean(promptBlock));

    return {
        rawPrompt,
        fullPrompt: blocks.map(formatBlock).join('\n'),
        builderConfig,
        blocks,
        warnings: validatePromptConfig(builderConfig)
    };
}

export function buildPromptFromFormData(formData: FormData): BuiltPrompt {
    const prompt = String(formData.get('prompt') ?? '');
    const promptMode = formData.get('prompt_mode') === 'guided' ? 'guided' : 'free';
    const parsed = parseJsonConfig(formData.get('prompt_builder_config'));
    const config = {
        ...parsed.config,
        promptMode,
        rawDescription: String(parsed.config?.rawDescription ?? prompt),
        size: String(parsed.config?.size ?? formData.get('size') ?? '') || undefined
    } satisfies PromptBuilderConfig;
    const built = buildPrompt(config);

    return parsed.warning ? { ...built, warnings: [parsed.warning, ...built.warnings] } : built;
}

export function serializeBuiltPromptForParams(builtPrompt: BuiltPrompt): Record<string, unknown> {
    return {
        prompt_mode: builtPrompt.builderConfig.promptMode || 'free',
        raw_prompt: builtPrompt.rawPrompt,
        full_prompt: builtPrompt.fullPrompt,
        prompt_builder_config: builtPrompt.builderConfig,
        prompt_blocks: builtPrompt.blocks,
        prompt_warnings: builtPrompt.warnings
    };
}
