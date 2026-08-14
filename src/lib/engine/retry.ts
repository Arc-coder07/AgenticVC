/**
 * AgenticVC Pipeline Engine — Retry Utility
 *
 * Implements exponential backoff with jitter for retrying failed node executions.
 *
 * Strategy:
 *   1. On failure, classify the error (see errors.ts)
 *   2. If retryable and attempts remain, wait with exponential backoff + jitter
 *   3. If rate-limited (429), use the provider's suggested delay instead
 *   4. Emit retry events via the event emitter so the UI can show attempt count
 *   5. If all retries exhausted, throw RetryExhaustedError
 *
 * Backoff formula:
 *   delay = min(baseDelay * 2^attempt + randomJitter, maxDelay)
 *
 * The jitter prevents thundering herd when multiple parallel nodes retry simultaneously.
 */

import type { RetryConfig, EventEmitter } from './types';
import { classifyError, RetryExhaustedError } from './errors';
import { log } from './logger';

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

/**
 * Default retry configuration applied to all nodes.
 * Individual nodes can override these values.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  critical: true,
};

// ---------------------------------------------------------------------------
// Retry Executor
// ---------------------------------------------------------------------------

/**
 * Execute an async function with retry logic.
 *
 * @param nodeId - ID of the node being retried (for logging and events)
 * @param fn - The async function to execute
 * @param config - Retry configuration (merged with defaults)
 * @param emit - Optional event emitter for SSE notifications
 * @returns The result of the function if it succeeds
 * @throws RetryExhaustedError if all attempts fail
 *
 * @example
 *   const result = await withRetry(
 *     'recruit',
 *     async () => generatePersonas(pitch, config),
 *     { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, critical: true },
 *     emitEvent,
 *   );
 */
export async function withRetry<T>(
  nodeId: string,
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  emit?: EventEmitter,
): Promise<T> {
  const attemptErrors: string[] = [];

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      log('debug', `[${nodeId}] Attempt ${attempt}/${config.maxRetries + 1}`);
      const result = await fn();
      
      if (attempt > 1) {
        log('info', `[${nodeId}] Succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error: unknown) {
      const classified = classifyError(error);
      attemptErrors.push(classified.message);

      log('warn', `[${nodeId}] Attempt ${attempt} failed: ${classified.message}`);

      // If error is not retryable, don't waste time retrying
      if (!classified.retryable) {
        log('error', `[${nodeId}] Non-retryable error. Aborting.`);
        throw new RetryExhaustedError(nodeId, attempt, attemptErrors);
      }

      // If this was the last attempt, throw
      if (attempt > config.maxRetries) {
        log('error', `[${nodeId}] All ${config.maxRetries + 1} attempts exhausted.`);
        throw new RetryExhaustedError(nodeId, attempt, attemptErrors);
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * config.baseDelayMs * 0.5;
      const delay = Math.min(
        classified.delayHintMs ?? (exponentialDelay + jitter),
        config.maxDelayMs,
      );

      log('info', `[${nodeId}] Retrying in ${Math.round(delay)}ms...`);

      // Notify the frontend about the retry
      if (emit) {
        emit({
          type: 'node:status',
          sessionId: '',  // Filled in by the pipeline executor
          nodeId,
          status: 'running',
          attempt: attempt + 1,
          error: `Retrying (${classified.message})`,
          timestamp: Date.now(),
        });
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // TypeScript needs this, but it's unreachable
  throw new RetryExhaustedError(nodeId, config.maxRetries + 1, attemptErrors);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Promise-based sleep utility */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
