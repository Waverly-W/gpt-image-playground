import { getDb } from './sqlite-db';
import type { SessionUser } from './auth';

export function recordImageOwner(filename: string, ownerUserId: string): void {
    getDb()
        .prepare(
            `INSERT INTO image_owners (filename, owner_user_id, created_at)
             VALUES (@filename, @ownerUserId, @createdAt)
             ON CONFLICT(filename) DO UPDATE SET
                owner_user_id = excluded.owner_user_id,
                created_at = excluded.created_at`
        )
        .run({ filename, ownerUserId, createdAt: new Date().toISOString() });
}

export function recordImageOwners(filenames: string[], ownerUserId: string): void {
    const insert = getDb().transaction((items: string[]) => {
        for (const filename of items) {
            recordImageOwner(filename, ownerUserId);
        }
    });
    insert(filenames);
}

export function getImageOwner(filename: string): string | null {
    const row = getDb().prepare('SELECT owner_user_id AS ownerUserId FROM image_owners WHERE filename = ?').get(filename) as
        | { ownerUserId: string }
        | undefined;
    return row?.ownerUserId ?? null;
}

export function deleteImageOwnership(filename: string): void {
    getDb().prepare('DELETE FROM image_owners WHERE filename = ?').run(filename);
}

export function canAccessImage(filename: string, session: Pick<SessionUser, 'id' | 'role'>): boolean {
    if (session.role === 'admin') return true;

    const ownerUserId = getImageOwner(filename);
    return ownerUserId === session.id;
}
