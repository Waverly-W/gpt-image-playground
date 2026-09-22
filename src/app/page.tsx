import { redirect } from 'next/navigation';
import { getPromptTemplates, PROMPT_TEMPLATE_SCENES } from '@/lib/prompt-templates';
import { getSessionFromCookie } from '@/lib/server-auth';
import { listEnabledModels, getDefaultModel } from '@/lib/models';
import ImagePlaygroundClient, { type HistoryMetadata } from './playground-client';

export type { HistoryMetadata };

export default async function HomePage() {
    const session = await getSessionFromCookie();
    if (!session) redirect('/login');

    const enabledModels = listEnabledModels();
    const defaultModel = getDefaultModel();

    return (
        <ImagePlaygroundClient
            initialUser={session}
            promptTemplates={getPromptTemplates()}
            promptTemplateScenes={PROMPT_TEMPLATE_SCENES}
            initialModels={enabledModels.map((m) => ({ value: m.id, label: m.name || m.id }))}
            defaultModelId={defaultModel?.id || 'gpt-image-2'}
        />
    );
}
