import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db: Database.Database | null = null;

function resolveDbPath(): string {
    if (process.env.SQLITE_DB_PATH?.trim()) {
        return process.env.SQLITE_DB_PATH.trim();
    }

    return path.join(process.cwd(), 'data', 'app.db');
}

function migrate(database: Database.Database) {
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');

    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            disabled INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS image_owners (
            filename TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    `);
}

export function getDb(): Database.Database {
    if (!db) {
        const dbPath = resolveDbPath();
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        db = new Database(dbPath);
        migrate(db);
    }

    return db;
}

export function closeDbForTests() {
    if (db) {
        db.close();
        db = null;
    }
}
