import type { BuiltPrompt, PromptBlock, ReferenceImageRole } from './types';

const REFERENCE_IMAGE_ROLES = new Set<ReferenceImageRole>([
    'source-image',
    'style-reference',
    'color-reference',
    'layout-reference',
    'content-asset'
]);

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

function normalizeReferenceImageRole(value: FormDataEntryValue | null, index: number): ReferenceImageRole {
    if (typeof value === 'string' && REFERENCE_IMAGE_ROLES.has(value as ReferenceImageRole)) {
        return value as ReferenceImageRole;
    }

    return index === 0 ? 'source-image' : 'content-asset';
}

function countImageFiles(formData: FormData): number {
    let count = 0;
    for (const [key, value] of formData.entries()) {
        if (key.startsWith('image_') && value instanceof File) {
            count++;
        }
    }
    return count;
}

export function getReferenceImageRolesFromFormData(formData: FormData): ReferenceImageRole[] {
    const explicitIndexes = Array.from(formData.keys())
        .map((key) => /^image_role_(\d+)$/.exec(key)?.[1])
        .filter((value): value is string => Boolean(value))
        .map(Number);
    const imageCount = Math.max(
        countImageFiles(formData),
        explicitIndexes.length ? Math.max(...explicitIndexes) + 1 : 0
    );

    return Array.from({ length: imageCount }, (_, index) =>
        normalizeReferenceImageRole(formData.get(`image_role_${index}`), index)
    );
}

function buildRoleBlock(role: ReferenceImageRole, imageIndexes: number[]): PromptBlock {
    const imageText = imageIndexes.map((index) => `Image ${index + 1}`).join(', ');

    switch (role) {
        case 'source-image':
            return block(
                'source-image',
                'SOURCE IMAGE',
                `${imageText} is the primary subject/content source. Preserve identity, structure, and important content unless the edit instruction explicitly changes them.`
            );
        case 'style-reference':
            return block(
                'style-reference',
                'STYLE REFERENCE',
                `${imageText} provides style only. Use it for visual style, not identity or subject replacement.`
            );
        case 'color-reference':
            return block(
                'color-reference',
                'COLOR REFERENCE',
                `${imageText} provides color palette only. Transfer color mood without replacing the source subject.`
            );
        case 'layout-reference':
            return block(
                'layout-reference',
                'LAYOUT REFERENCE',
                `${imageText} provides layout/composition only. Use structure and framing without replacing source content.`
            );
        case 'content-asset':
            return block(
                'content-asset',
                'CONTENT ASSET',
                `${imageText} provides additional usable content assets. Integrate them only when requested by the edit instruction.`
            );
    }
}

function groupRoleIndexes(referenceImageRoles: ReferenceImageRole[]): Array<[ReferenceImageRole, number[]]> {
    const orderedRoles: ReferenceImageRole[] = [
        'source-image',
        'style-reference',
        'color-reference',
        'layout-reference',
        'content-asset'
    ];

    return orderedRoles
        .map((role): [ReferenceImageRole, number[]] => [
            role,
            referenceImageRoles.flatMap((candidate, index) => (candidate === role ? [index] : []))
        ])
        .filter(([, indexes]) => indexes.length > 0);
}

export function wrapEditPrompt({
    builtPrompt,
    referenceImageRoles,
    hasMask
}: {
    builtPrompt: BuiltPrompt;
    referenceImageRoles: ReferenceImageRole[];
    hasMask: boolean;
}): BuiltPrompt {
    const editBlocks: PromptBlock[] = [
        block('edit-task', 'EDIT TASK', 'Modify the provided source image(s) according to the instruction.')
    ];

    groupRoleIndexes(referenceImageRoles).forEach(([role, indexes]) => {
        editBlocks.push(buildRoleBlock(role, indexes));
    });

    if (hasMask) {
        editBlocks.push(
            block(
                'repaint-instruction',
                'REPAINT INSTRUCTION',
                builtPrompt.fullPrompt || 'Regenerate this area seamlessly.'
            )
        );
        editBlocks.push(
            block(
                'mask-policy',
                'MASK POLICY',
                'Change only the masked area. Preserve all unmasked regions exactly. Make the changed area blend seamlessly with lighting, perspective, texture, and style.'
            )
        );
    }

    editBlocks.push(block('edit-instruction', 'EDIT INSTRUCTION', builtPrompt.fullPrompt));

    return {
        ...builtPrompt,
        fullPrompt: editBlocks.map(formatBlock).join('\n'),
        blocks: [...editBlocks, ...builtPrompt.blocks],
        referenceImageRoles
    };
}
