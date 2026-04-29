import type { SessionUser } from './auth';

export type HistoryOwnerMetadata = {
    ownerUserId?: string | null;
};

export function filterHistoryBySession<T extends HistoryOwnerMetadata>(entries: T[], session: Pick<SessionUser, 'id' | 'role'>): T[] {
    if (session.role === 'admin') return entries;
    return entries.filter((entry) => entry.ownerUserId === session.id);
}
