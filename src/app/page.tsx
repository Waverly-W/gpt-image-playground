import { redirect } from 'next/navigation';
import { getPromptTemplates, PROMPT_TEMPLATE_SCENES } from '@/lib/prompt-templates';
import { getSessionFromCookie } from '@/lib/server-auth';
import ImagePlaygroundClient, { type HistoryMetadata } from './playground-client';

export type { HistoryMetadata };

export default async function HomePage() {
    const session = await getSessionFromCookie();
    if (!session) redirect('/login');

    return (
        <ImagePlaygroundClient
            initialUser={session}
            promptTemplates={getPromptTemplates()}
            promptTemplateScenes={PROMPT_TEMPLATE_SCENES}
        />
    );
}
