import { ProviderType } from './llm-client';

export type ModelInfo = {
  id: string;
  label: string;
  deprecated?: boolean;
  deprecationNote?: string;
  context?: number; // context window size in tokens
  description?: string;
};

export type ProviderInfo = {
  id: ProviderType;
  label: string;
  icon: string; // Lucide icon name or emoji
  requiresApiKey: boolean;
  apiKeyPlaceholder?: string;
  description?: string;
  models: ModelInfo[];
};

export const PROVIDER_CATALOG: ProviderInfo[] = [
  {
    id: 'google',
    label: 'Google Gemini',
    icon: '✦',
    requiresApiKey: true,
    apiKeyPlaceholder: 'AIza••••••••••••',
    description: 'Google AI Studio',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', context: 1048576, description: 'Most capable reasoning model' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', context: 1048576, description: 'Fast and efficient' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', context: 1048576, description: 'Previous gen flash' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', context: 1048576, description: 'Lightweight model' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', context: 2097152, description: 'Previous gen pro', deprecated: true, deprecationNote: 'Use Gemini 2.5 Pro instead' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', context: 1048576, deprecated: true, deprecationNote: 'Use Gemini 2.5 Flash instead' },
      { id: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro', deprecated: true, deprecationNote: 'This model is end-of-life. Use Gemini 2.5 Pro.' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    icon: '⚡',
    requiresApiKey: true,
    apiKeyPlaceholder: 'gsk_••••••••••••',
    description: 'Ultra-fast inference',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', context: 131072, description: 'Best overall Groq model' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', context: 131072, description: 'Fast and light' },
      { id: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90B Vision', context: 8192, description: 'Vision model (preview)' },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B', context: 8192, description: 'Google Gemma on Groq' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', context: 32768, description: 'MoE model' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    icon: '🔀',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-or-••••••••••••',
    description: 'Multi-provider gateway',
    models: [
      { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', context: 200000, description: 'Anthropic latest' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', context: 200000, description: 'Previous gen Sonnet' },
      { id: 'openai/gpt-4o', label: 'GPT-4o', context: 128000, description: 'OpenAI flagship' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', context: 128000, description: 'OpenAI efficient' },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', context: 1048576, description: 'Google via OpenRouter' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', context: 131072, description: 'Meta open source' },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    icon: '🦙',
    requiresApiKey: false,
    description: 'Local models — no API key needed',
    models: [
      { id: 'llama3.1', label: 'Llama 3.1 8B', context: 131072, description: 'Meta\'s latest open model' },
      { id: 'llama3.1:70b', label: 'Llama 3.1 70B', context: 131072, description: 'Larger Llama variant' },
      { id: 'gemma2', label: 'Gemma 2 9B', context: 8192, description: 'Google\'s open model' },
      { id: 'gemma2:27b', label: 'Gemma 2 27B', context: 8192, description: 'Larger Gemma variant' },
      { id: 'mistral', label: 'Mistral 7B', context: 32768, description: 'Mistral AI open model' },
      { id: 'mixtral', label: 'Mixtral 8x7B', context: 32768, description: 'MoE architecture' },
      { id: 'qwen2.5', label: 'Qwen 2.5 7B', context: 131072, description: 'Alibaba open model' },
      { id: 'deepseek-r1', label: 'DeepSeek R1', context: 65536, description: 'Reasoning model' },
      { id: 'phi3', label: 'Phi-3 Mini', context: 128000, description: 'Microsoft small model' },
    ],
  },
];

export function getProviderInfo(providerId: ProviderType): ProviderInfo | undefined {
  return PROVIDER_CATALOG.find(p => p.id === providerId);
}

export function getModelsForProvider(providerId: ProviderType): ModelInfo[] {
  return getProviderInfo(providerId)?.models ?? [];
}

export function getDefaultModel(providerId: ProviderType): string {
  const models = getModelsForProvider(providerId);
  const nonDeprecated = models.find(m => !m.deprecated);
  return nonDeprecated?.id ?? models[0]?.id ?? '';
}

export function getModelInfo(providerId: ProviderType, modelId: string): ModelInfo | undefined {
  return getModelsForProvider(providerId).find(m => m.id === modelId);
}
