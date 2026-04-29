import { getDb } from './sqlite-db';

const REGISTRATION_ENABLED_KEY = 'registration_enabled';

function nowIso(): string {
    return new Date().toISOString();
}

export function getSetting(key: string): string | null {
    const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
    getDb()
        .prepare(
            `INSERT INTO app_settings (key, value, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
        .run(key, value, nowIso());
}

export function isRegistrationEnabled(): boolean {
    const envValue = process.env.REGISTRATION_ENABLED?.trim().toLowerCase();
    if (envValue === 'true' || envValue === '1') return true;
    if (envValue === 'false' || envValue === '0') return false;

    const dbValue = getSetting(REGISTRATION_ENABLED_KEY);
    if (dbValue === null) return true;

    return dbValue === 'true';
}

export function setRegistrationEnabled(enabled: boolean): void {
    setSetting(REGISTRATION_ENABLED_KEY, enabled ? 'true' : 'false');
}
