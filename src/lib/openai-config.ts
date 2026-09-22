import { getRuntimeConfig } from './settings';
import OpenAI from 'openai';

export function getOpenAIConfig(): {
    apiKey: string;
    baseURL?: string;
    timeout: number;
    maxRetries: number;
    defaultHeaders: Record<string, string>;
} {
    const config = getRuntimeConfig();
    const baseURL = config.openaiBaseUrl.trim();

    return {
        apiKey: config.openaiApiKey,
        ...(baseURL ? { baseURL } : {}),
        timeout: 180 * 1000,
        maxRetries: 1,
        defaultHeaders: {
            'User-Agent': 'OpenAI/NodeJS/4.77.0'
        }
    };
}

export function createOpenAIClient(): OpenAI {
    return new OpenAI(getOpenAIConfig());
}
