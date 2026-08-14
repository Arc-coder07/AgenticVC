/**
 * AgenticVC Pipeline Engine — Structured Logger
 *
 * Provides structured logging with:
 *   - Log levels (debug, info, warn, error)
 *   - ISO timestamps
 *   - Configurable minimum level (defaults to 'info' in production, 'debug' in dev)
 *   - Structured JSON output for machine parsing
 *
 * This logger is intentionally simple — no dependencies, no file I/O.
 * In a SaaS future, replace this with a proper logging service (e.g., Pino → Datadog).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Ordered log levels (lower number = more verbose) */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // gray
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
};

const RESET = '\x1b[0m';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Minimum log level. Messages below this level are silently dropped.
 * Defaults to 'debug' in development, 'info' in production.
 */
let minLevel: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

/**
 * Set the minimum log level at runtime.
 * Useful for enabling debug logging in production for troubleshooting.
 */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

/**
 * Log a structured message.
 *
 * @param level - Log level
 * @param message - Human-readable message
 * @param meta - Optional structured metadata (serialized to JSON)
 *
 * @example
 *   log('info', 'Node completed', { nodeId: 'recruit', duration: 2340 });
 *   // Output: [2026-08-14T08:15:32.123Z] [INFO] [AgenticVC] Node completed {"nodeId":"recruit","duration":2340}
 */
export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  const timestamp = new Date().toISOString();
  const prefix = `${LEVEL_COLORS[level]}[${timestamp}] [${level.toUpperCase()}] [AgenticVC]${RESET}`;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  const fullMessage = `${prefix} ${message}${metaStr}`;

  switch (level) {
    case 'debug':
      console.debug(fullMessage);
      break;
    case 'info':
      console.info(fullMessage);
      break;
    case 'warn':
      console.warn(fullMessage);
      break;
    case 'error':
      console.error(fullMessage);
      break;
  }
}

/**
 * Create a child logger with a fixed prefix.
 * Useful for creating node-specific loggers.
 *
 * @param prefix - Prefix to prepend to all messages
 * @returns A namespaced log function
 *
 * @example
 *   const nodeLog = createNodeLogger('recruit');
 *   nodeLog('info', 'Generating personas...');
 *   // Output: [timestamp] [INFO] [AgenticVC] [recruit] Generating personas...
 */
export function createNodeLogger(prefix: string) {
  return (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    log(level, `[${prefix}] ${message}`, meta);
  };
}
