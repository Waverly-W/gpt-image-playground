import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/server-auth';
import ImagePlaygroundClient, { type HistoryMetadata } from './playground-client';

export type { HistoryMetadata };

export default async function HomePage() {
    const session = await getSessionFromCookie();
    if (!session) redirect('/login');

    return <ImagePlaygroundClient initialUser={session} />;
}
