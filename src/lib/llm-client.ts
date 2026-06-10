import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export type ProviderType = "google" | "groq" | "openrouter";

export function getLLMClient(provider: ProviderType, apiKey: string) {
  if (provider === "google") {
    return createGoogleGenerativeAI({
      apiKey,
    });
  }

  if (provider === "groq") {
    return createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey,
    });
  }

  if (provider === "openrouter") {
    return createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    });
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
