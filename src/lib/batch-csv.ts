import type { GptImageModel } from '@/lib/cost-utils';
import { getPresetDimensions, validateGptImage2Size, type SizePreset } from '@/lib/size-utils';

export type BatchGenerationDefaults = {
    model: GptImageModel;
    n: number;
    size: SizePreset;
    customWidth: number;
    customHeight: number;
    quality: 'low' | 'medium' | 'high' | 'auto';
    output_format: 'png' | 'jpeg' | 'webp';
    output_compression: number;
    background: 'transparent' | 'opaque' | 'auto';
    moderation: 'low' | 'auto';
    stream: boolean;
    partial_images: 1 | 2 | 3;
};

export type BatchGenerationRow = BatchGenerationDefaults & {
    line: number;
    prompt: string;
};

export type BatchCsvParseResult = {
    rows: BatchGenerationRow[];
    errors: string[];
};

const CSV_COLUMNS = [
    'prompt',
    'model',
    'n',
    'size',
    'width',
    'height',
    'quality',
    'output_format',
    'output_compression',
    'background',
    'moderation',
    'stream',
    'partial_images'
] as const;

const MODELS: GptImageModel[] = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'];
const SIZES: SizePreset[] = ['auto', 'custom', 'square', 'landscape', 'portrait'];
const QUALITIES: BatchGenerationDefaults['quality'][] = ['auto', 'low', 'medium', 'high'];
const OUTPUT_FORMATS: BatchGenerationDefaults['output_format'][] = ['png', 'jpeg', 'webp'];
const BACKGROUNDS: BatchGenerationDefaults['background'][] = ['auto', 'opaque', 'transparent'];
const MODERATIONS: BatchGenerationDefaults['moderation'][] = ['auto', 'low'];
const PARTIAL_IMAGE_COUNTS = [1, 2, 3] as const;

function escapeCsvCell(value: string | number | boolean, forceQuotes = false): string {
    const text = String(value);
    if (!forceQuotes && !/[",\n\r]/.test(text)) return text;
    return `"${text.replaceAll('"', '""')}"`;
}

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        const next = text[index + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                cell += '"';
                index++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && char === ',') {
            row.push(cell);
            cell = '';
            continue;
        }

        if (!inQuotes && (char === '\n' || char === '\r')) {
            if (char === '\r' && next === '\n') index++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            continue;
        }

        cell += char;
    }

    row.push(cell);
    rows.push(row);
    return rows.filter((csvRow) => csvRow.some((value) => value.trim() !== ''));
}

function readInteger(value: string, fallback: number): number {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return Number(trimmed);
}

function readDimension(value: string, fallback: number, size: SizePreset): number {
    const parsed = readInteger(value, fallback);
    if (Number.isFinite(parsed) || size === 'custom') return parsed;
    return fallback;
}

function readBoolean(value: string, fallback: boolean): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
}

function getCell(cells: string[], index: number): string {
    return cells[index]?.trim() ?? '';
}

export function createBatchCsvTemplate(defaults: BatchGenerationDefaults): string {
    const example = [
        '一只写实风格的猫宇航员漂浮在太空中',
        defaults.model,
        defaults.n,
        defaults.size,
        defaults.customWidth,
        defaults.customHeight,
        defaults.quality,
        defaults.output_format,
        defaults.output_compression,
        defaults.background,
        defaults.moderation,
        defaults.stream,
        defaults.partial_images
    ];

    return `${CSV_COLUMNS.join(',')}\n${example.map((value, index) => escapeCsvCell(value, index === 0)).join(',')}\n`;
}

export function parseBatchCsv(text: string, defaults: BatchGenerationDefaults): BatchCsvParseResult {
    const csvRows = parseCsv(text);
    const [header, ...body] = csvRows;
    const errors: string[] = [];
    const rows: BatchGenerationRow[] = [];

    if (!header || header.map((cell) => cell.trim()).join(',') !== CSV_COLUMNS.join(',')) {
        return { rows: [], errors: [`CSV 表头必须是：${CSV_COLUMNS.join(',')}`] };
    }

    body.forEach((cells, index) => {
        const line = index + 2;
        const rowErrors: string[] = [];
        const prompt = getCell(cells, 0);
        const model = (getCell(cells, 1) || defaults.model) as GptImageModel;
        const n = readInteger(getCell(cells, 2), defaults.n);
        const size = (getCell(cells, 3) || defaults.size) as SizePreset;
        const customWidth = readDimension(getCell(cells, 4), defaults.customWidth, size);
        const customHeight = readDimension(getCell(cells, 5), defaults.customHeight, size);
        const quality = (getCell(cells, 6) || defaults.quality) as BatchGenerationDefaults['quality'];
        const outputFormat = (getCell(cells, 7) || defaults.output_format) as BatchGenerationDefaults['output_format'];
        const outputCompression = readInteger(getCell(cells, 8), defaults.output_compression);
        const background = (getCell(cells, 9) || defaults.background) as BatchGenerationDefaults['background'];
        const moderation = (getCell(cells, 10) || defaults.moderation) as BatchGenerationDefaults['moderation'];
        const stream = readBoolean(getCell(cells, 11), defaults.stream);
        const partialImages = readInteger(getCell(cells, 12), defaults.partial_images) as 1 | 2 | 3;

        if (!prompt) rowErrors.push('prompt 不能为空。');
        if (!MODELS.includes(model)) {
            rowErrors.push('model 必须是 gpt-image-2、gpt-image-1.5、gpt-image-1 或 gpt-image-1-mini。');
        }
        if (!Number.isInteger(n) || n < 1 || n > 10) rowErrors.push('n 必须是 1 到 10 的整数。');
        if (!SIZES.includes(size)) rowErrors.push('size 必须是 auto、custom、square、landscape 或 portrait。');
        if (size === 'custom') {
            const validation = validateGptImage2Size(customWidth, customHeight);
            if (!validation.valid) rowErrors.push(`custom 尺寸需要合法的 width 和 height。${validation.reason}`);
        }
        if (!QUALITIES.includes(quality)) rowErrors.push('quality 必须是 auto、low、medium 或 high。');
        if (!OUTPUT_FORMATS.includes(outputFormat)) rowErrors.push('output_format 必须是 png、jpeg 或 webp。');
        if (!Number.isInteger(outputCompression) || outputCompression < 0 || outputCompression > 100) {
            rowErrors.push('output_compression 必须是 0 到 100 的整数。');
        }
        if (!BACKGROUNDS.includes(background)) rowErrors.push('background 必须是 auto、opaque 或 transparent。');
        if (!MODERATIONS.includes(moderation)) rowErrors.push('moderation 必须是 auto 或 low。');
        if (!PARTIAL_IMAGE_COUNTS.includes(partialImages)) rowErrors.push('partial_images 必须是 1、2 或 3。');

        if (rowErrors.length > 0) {
            rowErrors.forEach((error) => errors.push(`第 ${line} 行：${error}`));
            return;
        }

        rows.push({
            line,
            prompt,
            model,
            n,
            size,
            customWidth,
            customHeight,
            quality,
            output_format: outputFormat,
            output_compression: outputCompression,
            background,
            moderation,
            stream,
            partial_images: partialImages
        });
    });

    return { rows, errors };
}

export function createBatchJobFormData(row: BatchGenerationRow): FormData {
    const formData = new FormData();
    const size =
        row.size === 'custom'
            ? `${row.customWidth}x${row.customHeight}`
            : (getPresetDimensions(row.size, row.model) ?? row.size);

    formData.append('mode', 'generate');
    formData.append('model', row.model);
    formData.append('prompt', row.prompt);
    formData.append('n', row.n.toString());
    formData.append('size', size);
    formData.append('quality', row.quality);
    formData.append('output_format', row.output_format);
    if (row.output_format === 'jpeg' || row.output_format === 'webp') {
        formData.append('output_compression', row.output_compression.toString());
    }
    formData.append('background', row.background);
    formData.append('moderation', row.moderation);
    if (row.stream && row.n === 1) {
        formData.append('stream', 'true');
        formData.append('partial_images', row.partial_images.toString());
    }

    return formData;
}
