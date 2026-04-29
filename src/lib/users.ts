import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from './sqlite-db';

export type AppRole = 'user' | 'admin';

export type PublicUser = {
    id: string;
    email: string;
    name: string | null;
    role: 'user';
    disabled: boolean;
    createdAt: string;
    updatedAt: string;
};

type UserRow = {
    id: string;
    email: string;
    password_hash: string;
    name: string | null;
    role: string;
    disabled: number;
    created_at: string;
    updated_at: string;
};

export type UserWithPasswordHash = PublicUser & {
    passwordHash: string;
};

type UserLookupOptions = {
    includePasswordHash?: boolean;
};

function nowIso(): string {
    return new Date().toISOString();
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function assertValidEmail(email: string) {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error('Invalid email address.');
    }
}

function assertValidPassword(password: string) {
    if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
    }
}

function toPublicUser(row: UserRow): PublicUser {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: 'user',
        disabled: Boolean(row.disabled),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function toUser(row: UserRow, options: UserLookupOptions = {}): PublicUser | UserWithPasswordHash {
    const user = toPublicUser(row);
    if (options.includePasswordHash) {
        return { ...user, passwordHash: row.password_hash };
    }

    return user;
}

export async function hashPassword(password: string): Promise<string> {
    assertValidPassword(password);
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
}

export async function createUser(input: { email: string; password: string; name?: string | null }): Promise<PublicUser> {
    const email = normalizeEmail(input.email);
    assertValidEmail(email);
    const passwordHash = await hashPassword(input.password);
    const id = `usr_${crypto.randomUUID()}`;
    const now = nowIso();

    try {
        getDb()
            .prepare(
                `INSERT INTO users (id, email, password_hash, name, role, disabled, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'user', 0, ?, ?)`
            )
            .run(id, email, passwordHash, input.name?.trim() || null, now, now);
    } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE')) {
            throw new Error('Email already exists.');
        }
        throw error;
    }

    return getUserById(id)!;
}

export function listUsers(): PublicUser[] {
    const rows = getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRow[];
    return rows.map(toPublicUser);
}

export function getUserById(id: string, options: UserLookupOptions = {}): PublicUser | UserWithPasswordHash | null {
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? toUser(row, options) : null;
}

export function getUserByEmail(
    email: string,
    options: UserLookupOptions = {}
): PublicUser | UserWithPasswordHash | null {
    const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email)) as UserRow | undefined;
    return row ? toUser(row, options) : null;
}

export function updateUser(
    id: string,
    input: { email?: string; name?: string | null; disabled?: boolean }
): PublicUser {
    const current = getUserById(id);
    if (!current) {
        throw new Error('User not found.');
    }

    const email = input.email === undefined ? current.email : normalizeEmail(input.email);
    assertValidEmail(email);
    const name = input.name === undefined ? current.name : input.name?.trim() || null;
    const disabled = input.disabled === undefined ? current.disabled : input.disabled;

    try {
        getDb()
            .prepare('UPDATE users SET email = ?, name = ?, disabled = ?, updated_at = ? WHERE id = ?')
            .run(email, name, disabled ? 1 : 0, nowIso(), id);
    } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE')) {
            throw new Error('Email already exists.');
        }
        throw error;
    }

    return getUserById(id)!;
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
    if (!getUserById(id)) {
        throw new Error('User not found.');
    }

    const passwordHash = await hashPassword(password);
    getDb().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, nowIso(), id);
}

export function deleteUser(id: string): boolean {
    const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
}
