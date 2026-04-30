import path from 'path';
import {
    PROMPT_TEMPLATE_IMAGE_FILENAMES,
    PROMPT_TEMPLATE_SCENES,
    PROMPT_TEMPLATES
} from '@/lib/prompt-template-data';

const promptTemplateImageDir = path.resolve(process.cwd(), 'docs/gpt-image-prompt_templates/images');

export { PROMPT_TEMPLATE_SCENES, PROMPT_TEMPLATES };
export type { PromptTemplate, PromptTemplateScene } from '@/lib/prompt-template-data';

export function resolvePromptTemplateImagePath(filename: string): string | null {
    if (!PROMPT_TEMPLATE_IMAGE_FILENAMES.has(filename)) {
        return null;
    }

    return path.join(promptTemplateImageDir, filename);
}
