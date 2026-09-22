import { getDb } from './sqlite-db';

export type ModelRecord = {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    isDefault: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
};

type ModelRow = {
    id: string;
    name: string;
    description: string;
    enabled: number;
    is_default: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
};

export type CreateModelInput = {
    id: string;
    name: string;
    description?: string;
    enabled?: boolean;
    isDefault?: boolean;
    sortOrder?: number;
};

export type UpdateModelInput = {
    name?: string;
    description?: string;
    enabled?: boolean;
    isDefault?: boolean;
    sortOrder?: number;
};

export const BUILTIN_MODEL_DEFINITIONS = [
    {
        id: 'gpt-image-2',
        name: 'gpt-image-2',
        description: 'OpenAI 旗舰生图模型，画质优异，支持多样化尺寸与精细修图。',
        enabled: 1,
        is_default: 1,
        sort_order: 1
    },
    {
        id: 'gpt-image-1.5',
        name: 'gpt-image-1.5',
        description: '平衡型生图模型，兼具高质量画质与较快推理速度。',
        enabled: 1,
        is_default: 0,
        sort_order: 2
    },
    {
        id: 'gpt-image-1',
        name: 'gpt-image-1',
        description: '经典基础图像生成模型，支持基础尺寸与通用风格。',
        enabled: 1,
        is_default: 0,
        sort_order: 3
    },
    {
        id: 'gpt-image-1-mini',
        name: 'gpt-image-1-mini',
        description: '超轻量低延迟模型，极低单图成本，适合快速草图与预览。',
        enabled: 1,
        is_default: 0,
        sort_order: 4
    }
] as const;

export const BUILTIN_MODEL_IDS: readonly string[] = BUILTIN_MODEL_DEFINITIONS.map((m) => m.id);

export function isBuiltinModel(id: string): boolean {
    return BUILTIN_MODEL_IDS.includes(id);
}

function nowIso(): string {
    return new Date().toISOString();
}

function toModelRecord(row: ModelRow): ModelRecord {
    return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        enabled: Boolean(row.enabled),
        isDefault: Boolean(row.is_default),
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export function initDefaultModelsIfEmpty(): void {
    const db = getDb();
    const countRow = db.prepare('SELECT count(*) as count FROM models').get() as { count: number } | undefined;
    if (!countRow || countRow.count === 0) {
        const now = nowIso();
        const insert = db.prepare(`
            INSERT INTO models (id, name, description, enabled, is_default, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMany = db.transaction(() => {
            for (const item of BUILTIN_MODEL_DEFINITIONS) {
                insert.run(item.id, item.name, item.description, item.enabled, item.is_default, item.sort_order, now, now);
            }
        });
        insertMany();
    }
}

export function listAllModels(): ModelRecord[] {
    initDefaultModelsIfEmpty();
    const rows = getDb()
        .prepare('SELECT * FROM models ORDER BY sort_order ASC, created_at ASC')
        .all() as ModelRow[];
    return rows.map(toModelRecord);
}

export function listEnabledModels(): ModelRecord[] {
    initDefaultModelsIfEmpty();
    const rows = getDb()
        .prepare('SELECT * FROM models WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC')
        .all() as ModelRow[];
    return rows.map(toModelRecord);
}

export function getDefaultModel(): ModelRecord | null {
    initDefaultModelsIfEmpty();
    const db = getDb();
    const defaultRow = db.prepare('SELECT * FROM models WHERE is_default = 1 LIMIT 1').get() as ModelRow | undefined;
    if (defaultRow) return toModelRecord(defaultRow);

    const firstEnabled = db.prepare('SELECT * FROM models WHERE enabled = 1 ORDER BY sort_order ASC LIMIT 1').get() as
        | ModelRow
        | undefined;
    if (firstEnabled) return toModelRecord(firstEnabled);

    const firstAny = db.prepare('SELECT * FROM models ORDER BY sort_order ASC LIMIT 1').get() as ModelRow | undefined;
    return firstAny ? toModelRecord(firstAny) : null;
}

export function getModelById(id: string): ModelRecord | null {
    initDefaultModelsIfEmpty();
    const row = getDb().prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow | undefined;
    return row ? toModelRecord(row) : null;
}

const MODEL_ID_REGEX = /^[a-zA-Z0-9_./-]{1,128}$/;

export function createModel(input: CreateModelInput): ModelRecord {
    initDefaultModelsIfEmpty();
    const db = getDb();

    const normalizedId = (input.id || '').trim();
    const normalizedName = (input.name || '').trim();
    const description = (input.description || '').trim();
    const sortOrder = Number.isInteger(input.sortOrder) ? Number(input.sortOrder) : 0;
    const enabled = input.enabled !== undefined ? Boolean(input.enabled) : true;
    const isDefault = Boolean(input.isDefault);

    if (!normalizedId) {
        throw new Error('模型 ID 不能为空。');
    }
    if (!MODEL_ID_REGEX.test(normalizedId) || normalizedId.startsWith('/') || normalizedId.endsWith('/') || normalizedId.includes('//')) {
        throw new Error('模型 ID 格式不正确，支持英文字母、数字、下划线、短横线、斜杠和点（例如 ag/gemini-3.1-flash-image）。');
    }
    if (!normalizedName) {
        throw new Error('模型名称不能为空。');
    }

    const existing = db.prepare('SELECT id FROM models WHERE id = ?').get(normalizedId);
    if (existing) {
        throw new Error(`模型 ID "${normalizedId}" 已存在。`);
    }

    const now = nowIso();

    db.transaction(() => {
        if (isDefault) {
            db.prepare('UPDATE models SET is_default = 0').run();
        }
        db.prepare(`
            INSERT INTO models (id, name, description, enabled, is_default, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(normalizedId, normalizedName, description, enabled ? 1 : 0, isDefault ? 1 : 0, sortOrder, now, now);
    })();

    const created = getModelById(normalizedId);
    if (!created) {
        throw new Error('模型创建失败。');
    }
    return created;
}

export function updateModel(id: string, patch: UpdateModelInput): ModelRecord {
    initDefaultModelsIfEmpty();
    const db = getDb();
    const current = getModelById(id);
    if (!current) {
        throw new Error(`未找到 ID 为 "${id}" 的模型。`);
    }

    const newName = patch.name !== undefined ? patch.name.trim() : current.name;
    if (patch.name !== undefined && !newName) {
        throw new Error('模型名称不能为空。');
    }

    const newDescription = patch.description !== undefined ? patch.description.trim() : current.description;
    const newSortOrder = patch.sortOrder !== undefined && Number.isInteger(patch.sortOrder) ? patch.sortOrder : current.sortOrder;
    let newEnabled = patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled;
    let newIsDefault = patch.isDefault !== undefined ? Boolean(patch.isDefault) : current.isDefault;

    if (patch.enabled === false) {
        if (current.isDefault && patch.isDefault !== false) {
            throw new Error('默认模型不可直接禁用，请先将其他可用模型设为默认。');
        }
    }

    if (patch.isDefault === true) {
        newIsDefault = true;
        newEnabled = true;
    } else if (patch.isDefault === false) {
        newIsDefault = false;
    }

    if (!newEnabled) {
        const otherEnabled = db.prepare('SELECT count(*) as count FROM models WHERE enabled = 1 AND id != ?').get(id) as {
            count: number;
        };
        if (otherEnabled.count === 0) {
            throw new Error('系统中必须保留至少一个已启用的模型。');
        }
    }

    const now = nowIso();

    db.transaction(() => {
        if (newIsDefault) {
            db.prepare('UPDATE models SET is_default = 0 WHERE id != ?').run(id);
        }
        db.prepare(`
            UPDATE models
            SET name = ?, description = ?, enabled = ?, is_default = ?, sort_order = ?, updated_at = ?
            WHERE id = ?
        `).run(newName, newDescription, newEnabled ? 1 : 0, newIsDefault ? 1 : 0, newSortOrder, now, id);
    })();

    const updated = getModelById(id);
    if (!updated) {
        throw new Error('模型更新失败。');
    }
    return updated;
}

export function deleteModel(id: string): boolean {
    initDefaultModelsIfEmpty();
    const db = getDb();
    const current = getModelById(id);
    if (!current) {
        throw new Error(`未找到 ID 为 "${id}" 的模型。`);
    }
    if (isBuiltinModel(id)) {
        throw new Error('内置核心模型不可删除，可通过禁用开关停用该模型。');
    }
    if (current.isDefault) {
        throw new Error('默认模型不可删除，请先将其他模型设为默认模型。');
    }

    const result = db.prepare('DELETE FROM models WHERE id = ?').run(id);
    return result.changes > 0;
}

export function resetModelsToDefault(): ModelRecord[] {
    const db = getDb();
    const now = nowIso();

    db.transaction(() => {
        db.prepare('DELETE FROM models').run();
        const insert = db.prepare(`
            INSERT INTO models (id, name, description, enabled, is_default, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of BUILTIN_MODEL_DEFINITIONS) {
            insert.run(item.id, item.name, item.description, item.enabled, item.is_default, item.sort_order, now, now);
        }
    })();

    return listAllModels();
}
