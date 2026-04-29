import OpenAI from 'openai';

function getOpenAIBaseURL(): string | undefined {
    const baseURL = (process.env.OPENAI_API_BASE_URL || process.env.OPENAI_BASE_URL || '').trim();
    return baseURL || undefined;
}

export function createOpenAIClient(): OpenAI {
    const baseURL = getOpenAIBaseURL();

    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        ...(baseURL ? { baseURL } : {})
    });
}
