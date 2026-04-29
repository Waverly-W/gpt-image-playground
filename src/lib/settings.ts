import { getDb } from './sqlite-db';

const REGISTRATION_ENABLED_KEY = 'registration_enabled';
const OPENAI_API_KEY = 'openai_api_key';
const OPENAI_BASE_URL_KEY = 'openai_base_url';
const IMAGE_STORAGE_MODE_KEY = 'image_storage_mode';
const R2_ACCOUNT_ID_KEY = 'r2_account_id';
const R2_ACCESS_KEY_ID_KEY = 'r2_access_key_id';
const R2_SECRET_ACCESS_KEY_KEY = 'r2_secret_access_key';
const R2_BUCKET_KEY = 'r2_bucket';
const R2_ENDPOINT_KEY = 'r2_endpoint';
const AUTH_COOKIE_SECURE_KEY = 'auth_cookie_secure';

export type ImageStorageMode = 'fs' | 'indexeddb' | 'r2';

export type RuntimeConfig = {
    openaiApiKey: string;
    openaiBaseUrl: string;
    imageStorageMode: ImageStorageMode | '';
    r2AccountId: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
    r2Bucket: string;
    r2Endpoint: string;
    authCookieSecure: 'auto' | 'true' | 'false';
    registrationEnabled: boolean;
};

export type RuntimeConfigPatch = Partial<RuntimeConfig>;

function nowIso(): string {
    return new Date().toISOString();
}

export function getSetting(key: string): string | null {
    const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
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

export function deleteSetting(key: string): void {
    getDb().prepare('DELETE FROM app_settings WHERE key = ?').run(key);
}

function getDbSettingOrEnv(key: string, envNames: string[]): string {
    const dbValue = getSetting(key);
    if (dbValue !== null) return dbValue;

    for (const envName of envNames) {
        const envValue = process.env[envName]?.trim();
        if (envValue) return envValue;
    }

    return '';
}

function setOptionalSetting(key: string, value: unknown): void {
    if (typeof value !== 'string') return;

    const normalized = value.trim();
    if (normalized) {
        setSetting(key, normalized);
    } else {
        deleteSetting(key);
    }
}

export function getRuntimeConfig(): RuntimeConfig {
    const storageMode = getDbSettingOrEnv(IMAGE_STORAGE_MODE_KEY, ['NEXT_PUBLIC_IMAGE_STORAGE_MODE']);
    const authCookieSecure = getDbSettingOrEnv(AUTH_COOKIE_SECURE_KEY, ['AUTH_COOKIE_SECURE']);

    return {
        openaiApiKey: getDbSettingOrEnv(OPENAI_API_KEY, ['OPENAI_API_KEY']),
        openaiBaseUrl: getDbSettingOrEnv(OPENAI_BASE_URL_KEY, ['OPENAI_API_BASE_URL', 'OPENAI_BASE_URL']),
        imageStorageMode:
            storageMode === 'fs' || storageMode === 'indexeddb' || storageMode === 'r2' ? storageMode : '',
        r2AccountId: getDbSettingOrEnv(R2_ACCOUNT_ID_KEY, ['CLOUDFLARE_R2_ACCOUNT_ID']),
        r2AccessKeyId: getDbSettingOrEnv(R2_ACCESS_KEY_ID_KEY, ['CLOUDFLARE_R2_ACCESS_KEY_ID']),
        r2SecretAccessKey: getDbSettingOrEnv(R2_SECRET_ACCESS_KEY_KEY, ['CLOUDFLARE_R2_SECRET_ACCESS_KEY']),
        r2Bucket: getDbSettingOrEnv(R2_BUCKET_KEY, ['CLOUDFLARE_R2_BUCKET']),
        r2Endpoint: getDbSettingOrEnv(R2_ENDPOINT_KEY, ['CLOUDFLARE_R2_ENDPOINT']),
        authCookieSecure:
            authCookieSecure === 'true' || authCookieSecure === 'false' || authCookieSecure === 'auto'
                ? authCookieSecure
                : 'auto',
        registrationEnabled: isRegistrationEnabled()
    };
}

export function setRuntimeConfig(config: RuntimeConfigPatch): void {
    setOptionalSetting(OPENAI_API_KEY, config.openaiApiKey);
    setOptionalSetting(OPENAI_BASE_URL_KEY, config.openaiBaseUrl);
    setOptionalSetting(R2_ACCOUNT_ID_KEY, config.r2AccountId);
    setOptionalSetting(R2_ACCESS_KEY_ID_KEY, config.r2AccessKeyId);
    setOptionalSetting(R2_SECRET_ACCESS_KEY_KEY, config.r2SecretAccessKey);
    setOptionalSetting(R2_BUCKET_KEY, config.r2Bucket);
    setOptionalSetting(R2_ENDPOINT_KEY, config.r2Endpoint);

    if (
        config.imageStorageMode === 'fs' ||
        config.imageStorageMode === 'indexeddb' ||
        config.imageStorageMode === 'r2'
    ) {
        setSetting(IMAGE_STORAGE_MODE_KEY, config.imageStorageMode);
    } else if (config.imageStorageMode === '') {
        deleteSetting(IMAGE_STORAGE_MODE_KEY);
    }

    if (
        config.authCookieSecure === 'auto' ||
        config.authCookieSecure === 'true' ||
        config.authCookieSecure === 'false'
    ) {
        setSetting(AUTH_COOKIE_SECURE_KEY, config.authCookieSecure);
    }

    if (typeof config.registrationEnabled === 'boolean') {
        setRegistrationEnabled(config.registrationEnabled);
    }
}

export function isRegistrationEnabled(): boolean {
    const dbValue = getSetting(REGISTRATION_ENABLED_KEY);
    if (dbValue === null) {
        const envValue = process.env.REGISTRATION_ENABLED?.trim().toLowerCase();
        if (envValue === 'true' || envValue === '1') return true;
        if (envValue === 'false' || envValue === '0') return false;
        return true;
    }

    return dbValue === 'true';
}

export function setRegistrationEnabled(enabled: boolean): void {
    setSetting(REGISTRATION_ENABLED_KEY, enabled ? 'true' : 'false');
}
