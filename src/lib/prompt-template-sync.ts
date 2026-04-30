import fs from 'fs/promises';
import { lookup } from 'mime-types';
import { putR2Image } from '@/lib/image-storage';
import { PROMPT_TEMPLATES } from '@/lib/prompt-template-data';
import { getPromptTemplateObjectKey, resolvePromptTemplateImagePath } from '@/lib/prompt-templates';

export type PromptTemplateUpload = {
    filename: string;
    key: string;
    filePath: string;
    contentType: string;
};

export function listPromptTemplateUploads(): PromptTemplateUpload[] {
    return PROMPT_TEMPLATES.map((template) => {
        const filePath = resolvePromptTemplateImagePath(template.imageFilename);
        if (!filePath) {
            throw new Error(`Missing prompt template image path for ${template.imageFilename}`);
        }

        return {
            filename: template.imageFilename,
            key: getPromptTemplateObjectKey(template.imageFilename),
            filePath,
            contentType: lookup(template.imageFilename) || 'application/octet-stream'
        };
    });
}

export async function syncPromptTemplateImagesToR2(): Promise<{ uploaded: number }> {
    const uploads = listPromptTemplateUploads();

    for (const upload of uploads) {
        const buffer = await fs.readFile(upload.filePath);
        await putR2Image(upload.key, buffer, upload.contentType);
    }

    return { uploaded: uploads.length };
}
