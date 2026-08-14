/**
 * AgenticVC Pipeline Engine — Custom Error Types
 *
 * Provides a hierarchy of typed errors that enable:
 *   1. Retry classification — Is this error transient (retry) or permanent (abort)?
 *   2. Structured error context — Which node failed? What attempt? What was the cause?
 *   3. User-friendly messages — Map internal errors to actionable UI messages.
 *
 * Error hierarchy:
 *   PipelineError (base)
 *   ├── NodeExecutionError    — A specific node failed during execution
 *   ├── RetryExhaustedError   — A node exhausted all retry attempts
 *   ├── RateLimitError        — Provider returned 429 (auto-detected for backoff)
 *   ├── ConfigValidationError — Invalid session configuration
 *   └── SessionNotFoundError  — Session ID doesn't exist
 */

// ---------------------------------------------------------------------------
// Base Error
// ---------------------------------------------------------------------------

/**
 * Base error class for all pipeline-related errors.
 * Extends native Error with structured metadata.
 */
export class PipelineError extends Error {
  /** Whether this error is transient and the operation should be retried */
  readonly retryable: boolean;
  /** HTTP-like status code for API responses */
  readonly statusCode: number;

  constructor(
    message: string,
    options: {
      retryable?: boolean;
      statusCode?: number;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'PipelineError';
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode ?? 500;
  }

  /**
   * Convert to a plain object for JSON serialization (SSE events, API responses).
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      retryable: this.retryable,
      statusCode: this.statusCode,
    };
  }
}

// ---------------------------------------------------------------------------
// Specific Error Types
// ---------------------------------------------------------------------------

/**
 * Thrown when a specific pipeline node fails during execution.
 * Includes the node ID and attempt number for debugging.
 */
export class NodeExecutionError extends PipelineError {
  readonly nodeId: string;
  readonly attempt: number;

  constructor(
    nodeId: string,
    attempt: number,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(`Node "${nodeId}" failed on attempt ${attempt}: ${message}`, {
      retryable: options.retryable ?? true,
      statusCode: 500,
      cause: options.cause,
    });
    this.name = 'NodeExecutionError';
    this.nodeId = nodeId;
    this.attempt = attempt;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      nodeId: this.nodeId,
      attempt: this.attempt,
    };
  }
}

/**
 * Thrown when a node has exhausted all retry attempts.
 * Contains the history of all attempt errors for debugging.
 */
export class RetryExhaustedError extends PipelineError {
  readonly nodeId: string;
  readonly totalAttempts: number;
  readonly attemptErrors: string[];

  constructor(nodeId: string, totalAttempts: number, attemptErrors: string[]) {
    super(
      `Node "${nodeId}" failed after ${totalAttempts} attempts. Last error: ${attemptErrors[attemptErrors.length - 1]}`,
      { retryable: false, statusCode: 500 },
    );
    this.name = 'RetryExhaustedError';
    this.nodeId = nodeId;
    this.totalAttempts = totalAttempts;
    this.attemptErrors = attemptErrors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      nodeId: this.nodeId,
      totalAttempts: this.totalAttempts,
      attemptErrors: this.attemptErrors,
    };
  }
}

/**
 * Thrown when a provider returns HTTP 429 (Too Many Requests).
 * The retry system uses the retryAfterMs hint to delay the next attempt.
 */
export class RateLimitError extends PipelineError {
  /** Suggested wait time from the provider's Retry-After header (if available) */
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number = 5000, cause?: unknown) {
    super(`Rate limited by provider. Retry after ${retryAfterMs}ms.`, {
      retryable: true,
      statusCode: 429,
      cause,
    });
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Thrown when session configuration fails Zod validation.
 */
export class ConfigValidationError extends PipelineError {
  readonly validationErrors: string[];

  constructor(validationErrors: string[]) {
    super(`Invalid configuration: ${validationErrors.join('; ')}`, {
      retryable: false,
      statusCode: 400,
    });
    this.name = 'ConfigValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Thrown when a requested session ID doesn't exist in storage.
 */
export class SessionNotFoundError extends PipelineError {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session "${sessionId}" not found.`, {
      retryable: false,
      statusCode: 404,
    });
    this.name = 'SessionNotFoundError';
    this.sessionId = sessionId;
  }
}

// ---------------------------------------------------------------------------
// Error Classification Utility
// ---------------------------------------------------------------------------

/**
 * Classify an unknown error as retryable or permanent.
 * Used by the retry utility to decide whether to retry.
 *
 * Heuristics:
 *   - HTTP 429 → RateLimitError (retryable)
 *   - HTTP 5xx → retryable (server issues are often transient)
 *   - HTTP 4xx (except 429) → permanent (client error, won't fix on retry)
 *   - Network errors → retryable
 *   - PipelineError → use its own retryable flag
 *   - Unknown → retryable (optimistic)
 *
 * @param error - The caught error
 * @returns An object with retryable flag and optional delay hint
 */
export function classifyError(error: unknown): {
  retryable: boolean;
  delayHintMs?: number;
  message: string;
} {
  // Already classified
  if (error instanceof RateLimitError) {
    return {
      retryable: true,
      delayHintMs: error.retryAfterMs,
      message: error.message,
    };
  }

  if (error instanceof PipelineError) {
    return {
      retryable: error.retryable,
      message: error.message,
    };
  }

  // Vercel AI SDK and fetch errors often have a status or statusCode property
  const statusCode = (error as any)?.statusCode ?? (error as any)?.status ?? (error as any)?.response?.status;

  if (statusCode === 429) {
    const retryAfter = (error as any)?.response?.headers?.get?.('retry-after');
    const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
    return {
      retryable: true,
      delayHintMs: delayMs,
      message: `Rate limited (429). Retrying after ${delayMs}ms.`,
    };
  }

  if (typeof statusCode === 'number') {
    if (statusCode >= 500) {
      return { retryable: true, message: `Server error (${statusCode})` };
    }
    if (statusCode >= 400) {
      return { retryable: false, message: `Client error (${statusCode})` };
    }
  }

  // Network-level errors (fetch failures, DNS, timeouts)
  const message = error instanceof Error ? error.message : String(error);
  const isNetworkError =
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('socket hang up');

  if (isNetworkError) {
    return { retryable: true, message: `Network error: ${message}` };
  }

  // Default: optimistic retry for unknown errors
  return {
    retryable: true,
    message: error instanceof Error ? error.message : String(error),
  };
}
