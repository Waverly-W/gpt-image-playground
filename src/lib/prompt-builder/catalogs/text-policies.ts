import type { PromptOutputLanguage, PromptTextPolicy } from '../types';

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
