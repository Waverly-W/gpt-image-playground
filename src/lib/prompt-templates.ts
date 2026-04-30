import path from 'path';
import { getR2PublicUrl } from '@/lib/image-storage';
import {
    PROMPT_TEMPLATE_IMAGE_FILENAMES,
    PROMPT_TEMPLATE_SCENES,
    PROMPT_TEMPLATES
} from '@/lib/prompt-template-data';
import { getRuntimeConfig, type RuntimeConfig } from '@/lib/settings';

const promptTemplateImageDir = path.resolve(process.cwd(), 'docs/gpt-image-prompt_templates/images');
const PROMPT_TEMPLATE_R2_PREFIX = 'prompt-templates';

export { PROMPT_TEMPLATE_SCENES, PROMPT_TEMPLATES };
export type { PromptTemplate, PromptTemplateScene } from '@/lib/prompt-template-data';

export function getPromptTemplateObjectKey(filename: string): string {
    return `${PROMPT_TEMPLATE_R2_PREFIX}/${filename}`;
}

export function getPromptTemplates(runtimeConfig: RuntimeConfig = getRuntimeConfig()) {
    return PROMPT_TEMPLATES.map((template) => ({
        ...template,
        imageUrl:
            runtimeConfig.imageStorageMode === 'r2'
                ? (getR2PublicUrl(getPromptTemplateObjectKey(template.imageFilename), runtimeConfig) ??
                  `/api/prompt-template-images/${template.imageFilename}`)
                : `/api/prompt-template-images/${template.imageFilename}`
    }));
}

export function resolvePromptTemplateImagePath(filename: string): string | null {
    if (!PROMPT_TEMPLATE_IMAGE_FILENAMES.has(filename)) {
        return null;
    }

    return path.join(promptTemplateImageDir, filename);
}
