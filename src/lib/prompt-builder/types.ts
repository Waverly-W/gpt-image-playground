export type PromptBuilderMode = 'free' | 'guided';

export type PromptIntentMode =
    | 'poster'
    | 'infographic'
    | 'character'
    | 'product'
    | 'style-report'
    | 'social-post'
    | 'educational'
    | 'portrait'
    | 'photo-edit'
    | 'repaint';

export type PromptAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | 'custom' | 'auto';

export type PromptOutputLanguage = 'zh' | 'en' | 'ja' | 'ko' | 'auto';

export type PromptTextPolicy = 'no-text' | 'allow-short-text' | 'text-first' | 'structured-labels';

export type ReferenceImageRole =
    | 'source-image'
    | 'style-reference'
    | 'color-reference'
    | 'layout-reference'
    | 'content-asset';

export type PromptDesignTokens = {
    enabled: boolean;
    aiColor?: boolean;
    primaryColor?: string;
    backgroundColor?: string;
    accentColor?: string;
    borderRadius?: string;
    density?: 'sparse' | 'balanced' | 'dense';
};

export type PromptBuilderConfig = {
    promptMode?: PromptBuilderMode;
    mode?: PromptBuilderMode | PromptIntentMode;
    rawDescription: string;
    subject?: string;
    scene?: string;
    sceneId?: PromptIntentMode | string;
    styleId?: string;
    mediumId?: string;
    aspectRatio?: PromptAspectRatio;
    size?: string;
    keywords?: string[];
    outputLanguage?: PromptOutputLanguage;
    textPolicy?: PromptTextPolicy;
    designTokens?: PromptDesignTokens;
    visualStyle?: string;
    layoutGuide?: string;
    strictSpecJson?: unknown;
    editInstruction?: string;
};

export type PromptBlock = {
    id: string;
    title: string;
    enabled: boolean;
    content: string;
};

export type BuiltPrompt = {
    rawPrompt: string;
    fullPrompt: string;
    builderConfig: PromptBuilderConfig;
    blocks: PromptBlock[];
    warnings: string[];
    referenceImageRoles?: ReferenceImageRole[];
};

export type PromptCatalogItem = {
    id: string;
    name: string;
    description: string;
    promptModifier: string;
    negativeHints?: string[];
    defaultAspectRatio?: PromptAspectRatio;
    defaultTextPolicy?: PromptTextPolicy;
};
