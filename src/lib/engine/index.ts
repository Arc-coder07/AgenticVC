/**
 * AgenticVC Pipeline Engine — Barrel Export
 *
 * Single entry point for all engine exports.
 * Import everything from '@/lib/engine' instead of individual files.
 *
 * @example
 *   import { PipelineBuilder, sessionManager, researchNode } from '@/lib/engine';
 */

// Core types
export type {
  ProviderType,
  SimulationMode,
  SessionConfig,
  NodeStatus,
  RetryConfig,
  NodeState,
  PipelineNode,
  ExecutionContext,
  EventEmitter,
  SessionData,
  SessionStatus,
  Session,
  PipelineEvent,
  ExtractEvent,
} from './types';

// Pipeline
export { PipelineBuilder, PipelineExecutor, WaitForInputSignal } from './pipeline';
export type { PipelineDefinition } from './pipeline';

// Session management
export { SessionManager, sessionManager } from './session';
export type { SessionStore } from './session';

// Errors
export {
  PipelineError,
  NodeExecutionError,
  RetryExhaustedError,
  RateLimitError,
  ConfigValidationError,
  SessionNotFoundError,
  classifyError,
} from './errors';

// Retry utility
export { withRetry, DEFAULT_RETRY_CONFIG } from './retry';

// Logger
export { log, setLogLevel, createNodeLogger } from './logger';
export type { LogLevel } from './logger';

// Nodes
export { researchNode } from './nodes/research';
export { recruitNode } from './nodes/recruit';
export { critiqueNode } from './nodes/critique';
export { crossExamineNode } from './nodes/cross-examine';
export { userDefenseNode } from './nodes/user-defense';
export { synthesizeNode } from './nodes/synthesize';
