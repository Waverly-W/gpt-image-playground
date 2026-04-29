import type { GptImageModel } from '@/lib/cost-utils';

export type ImageModelOption = {
    value: GptImageModel;
    label: string;
};

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
    { value: 'gpt-image-2', label: 'gpt-image-2' },
    { value: 'gpt-image-1.5', label: 'gpt-image-1.5' },
    { value: 'gpt-image-1', label: 'gpt-image-1' },
    { value: 'gpt-image-1-mini', label: 'gpt-image-1-mini' }
];
