import { getRuntimeConfig } from './settings';
import OpenAI from 'openai';

export function getOpenAIConfig(): { apiKey: string; baseURL?: string } {
    const config = getRuntimeConfig();
    const baseURL = config.openaiBaseUrl.trim();

    return {
        apiKey: config.openaiApiKey,
        ...(baseURL ? { baseURL } : {})
    };
}

export function createOpenAIClient(): OpenAI {
    return new OpenAI(getOpenAIConfig());
}
