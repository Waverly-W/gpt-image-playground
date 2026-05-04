import type { PromptAspectRatio, PromptBuilderConfig, PromptBuilderMode, PromptIntentMode } from './types';

const INTENT_MODES = new Set<string>([
    'poster',
    'product',
    'character',
    'infographic',
    'cover',
    'social-post',
    'photo-edit',
    'repaint'
]);

export function cleanupPromptText(value: unknown): string {
    return String(value ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

export function normalizeKeywords(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((keyword) => cleanupPromptText(keyword)).filter(Boolean);
}

export function inferAspectRatioFromSize(size: string | undefined): PromptAspectRatio {
    if (!size || size === 'auto') return 'auto';

    const match = /^(\d+)x(\d+)$/.exec(size);
    if (!match) return 'custom';

    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return 'custom';
    if (width === height) return '1:1';

    const ratio = width / height;
    if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
    if (Math.abs(ratio - 9 / 16) < 0.02) return '9:16';
    if (Math.abs(ratio - 4 / 3) < 0.02) return '4:3';
    if (Math.abs(ratio - 3 / 4) < 0.02) return '3:4';
    return 'custom';
}

export function normalizePromptBuilderConfig(input: PromptBuilderConfig): PromptBuilderConfig {
    const legacyMode = input.mode;
    let promptMode: PromptBuilderMode = 'guided';
    if (input.promptMode) {
        promptMode = input.promptMode;
    } else if (legacyMode === 'free' || legacyMode === 'guided') {
        promptMode = legacyMode;
    }
    const sceneId =
        input.sceneId ||
        (typeof legacyMode === 'string' && INTENT_MODES.has(legacyMode) ? (legacyMode as PromptIntentMode) : undefined);
    const size = cleanupPromptText(input.size) || undefined;

    return {
        ...input,
        promptMode,
        sceneId,
        rawDescription: String(input.rawDescription ?? ''),
        subject: cleanupPromptText(input.subject) || undefined,
        scene: cleanupPromptText(input.scene) || undefined,
        styleId: cleanupPromptText(input.styleId) || undefined,
        mediumId: cleanupPromptText(input.mediumId) || undefined,
        aspectRatio: input.aspectRatio || inferAspectRatioFromSize(size),
        size,
        keywords: normalizeKeywords(input.keywords),
        outputLanguage: input.outputLanguage || 'auto',
        textPolicy: input.textPolicy || undefined,
        visualStyle: cleanupPromptText(input.visualStyle) || undefined,
        layoutGuide: cleanupPromptText(input.layoutGuide) || undefined,
        editInstruction: cleanupPromptText(input.editInstruction) || undefined
    };
}
