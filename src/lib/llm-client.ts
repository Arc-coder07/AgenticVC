import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export type ProviderType = "google" | "groq" | "openrouter" | "ollama";

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

  if (provider === "ollama") {
    return createOpenAI({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama', // Ollama doesn't need a real key, but the SDK requires a non-empty string
    });
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
