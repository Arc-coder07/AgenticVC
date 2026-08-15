import { ProviderType } from './llm-client';
import { getProviderInfo } from './model-catalog';

export type ParsedError = {
  message: string;
  code: 'AUTH_ERROR' | 'RATE_LIMIT' | 'MODEL_NOT_FOUND' | 'TIMEOUT' | 'CONNECTION_ERROR' | 'VALIDATION_ERROR' | 'PROVIDER_ERROR' | 'UNKNOWN';
  retryable: boolean;
  details?: string;
};

export function parseAPIError(error: unknown, provider: ProviderType, model: string): ParsedError {
  const providerLabel = getProviderInfo(provider)?.label ?? provider;
  const err = error as any;
  const message = err?.message ?? String(error);
  const statusCode = err?.statusCode ?? err?.status ?? err?.response?.status;

  // Connection errors (Ollama not running, network down)
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('ENOTFOUND')
  ) {
    if (provider === 'ollama') {
      return {
        message: 'Cannot connect to Ollama. Make sure it\'s running on localhost:11434.',
        code: 'CONNECTION_ERROR',
        retryable: true,
        details: 'Start Ollama with: ollama serve',
      };
    }
    return {
      message: `Cannot reach ${providerLabel}. Check your internet connection.`,
      code: 'CONNECTION_ERROR',
      retryable: true,
    };
  }

  // Auth errors
  if (statusCode === 401 || statusCode === 403 || message.includes('API key') || message.includes('authentication') || message.includes('unauthorized')) {
    return {
      message: `Invalid API key for ${providerLabel}. Please check your key and try again.`,
      code: 'AUTH_ERROR',
      retryable: false,
    };
  }

  // Rate limiting
  if (statusCode === 429 || message.includes('rate limit') || message.includes('quota')) {
    return {
      message: `Rate limited by ${providerLabel}. Please wait a moment and try again.`,
      code: 'RATE_LIMIT',
      retryable: true,
    };
  }

  // Model not found
  if (statusCode === 404 || message.includes('not found') || message.includes('does not exist') || message.includes('is not available')) {
    return {
      message: `Model '${model}' not found on ${providerLabel}. Please select a valid model.`,
      code: 'MODEL_NOT_FOUND',
      retryable: false,
    };
  }

  // Timeout
  if (message.includes('timeout') || message.includes('timed out') || message.includes('deadline')) {
    return {
      message: `Request timed out. ${providerLabel} may be overloaded — please try again.`,
      code: 'TIMEOUT',
      retryable: true,
    };
  }

  // Deprecated model
  if (message.includes('deprecated') || message.includes('decommissioned') || message.includes('no longer available')) {
    return {
      message: `Model '${model}' has been deprecated by ${providerLabel}. Please switch to a newer model.`,
      code: 'MODEL_NOT_FOUND',
      retryable: false,
    };
  }

  // Provider-specific 5xx errors
  if (statusCode >= 500) {
    return {
      message: `${providerLabel} is experiencing issues (${statusCode}). Please try again in a few moments.`,
      code: 'PROVIDER_ERROR',
      retryable: true,
    };
  }

  // Fallback
  return {
    message: `An unexpected error occurred with ${providerLabel}: ${message.substring(0, 200)}`,
    code: 'UNKNOWN',
    retryable: true,
    details: message,
  };
}

export type KeyValidation = {
  valid: boolean;
  hint?: string;
};

export function validateApiKeyFormat(provider: ProviderType, key: string): KeyValidation {
  if (provider === 'ollama') {
    return { valid: true }; // No key needed
  }

  if (!key || key.trim().length === 0) {
    return { valid: false, hint: 'API key is required' };
  }

  return { valid: true };
}
