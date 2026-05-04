export const IMAGE_QUALITY_FAILURE_REASON_OPTIONS = [
    { id: 'text-error', label: '文字错' },
    { id: 'composition-error', label: '构图错' },
    { id: 'style-error', label: '风格错' },
    { id: 'reference-mismatch', label: '不听参考图' },
    { id: 'subject-inconsistent', label: '主体不一致' },
    { id: 'density-mismatch', label: '信息密度不对' }
] as const;

export type ImageQualityFailureReason = (typeof IMAGE_QUALITY_FAILURE_REASON_OPTIONS)[number]['id'];

export type ImageJobQualityFeedback = {
    failureReasons: ImageQualityFailureReason[];
    note?: string;
    updatedAt: string;
};

const VALID_FAILURE_REASONS = new Set<ImageQualityFailureReason>(
    IMAGE_QUALITY_FAILURE_REASON_OPTIONS.map((option) => option.id)
);

export function normalizeQualityFailureReasons(values: unknown): ImageQualityFailureReason[] {
    if (!Array.isArray(values)) return [];

    const seen = new Set<ImageQualityFailureReason>();
    const normalized: ImageQualityFailureReason[] = [];

    values.forEach((value) => {
        if (typeof value !== 'string' || !VALID_FAILURE_REASONS.has(value as ImageQualityFailureReason)) {
            return;
        }

        const reason = value as ImageQualityFailureReason;
        if (seen.has(reason)) return;

        seen.add(reason);
        normalized.push(reason);
    });

    return normalized;
}

export function isImageJobQualityFeedback(value: unknown): value is ImageJobQualityFeedback {
    if (!value || typeof value !== 'object') return false;

    const candidate = value as Record<string, unknown>;
    if (typeof candidate.updatedAt !== 'string') return false;
    if (candidate.note !== undefined && typeof candidate.note !== 'string') return false;

    return (
        Array.isArray(candidate.failureReasons) &&
        normalizeQualityFailureReasons(candidate.failureReasons).length === candidate.failureReasons.length
    );
}
