/**
 * AgenticVC Pipeline Engine — Core Type System
 *
 * Defines the foundational types for the DAG-based pipeline engine.
 * Every other engine module imports from here.
 *
 * Architecture:
 *   Session → Pipeline → Nodes (DAG) → Events (SSE) → Frontend
 *
 * Key concepts:
 *   - PipelineNode: A unit of work (e.g., recruit personas, generate critiques)
 *   - Session: A complete run of the pipeline with all accumulated state
 *   - PipelineEvent: SSE events streamed to the frontend in real-time
 *   - NodeStatus: Tracks the lifecycle of each node (pending → running → done/error)
 */

import type { Persona, Critique, CrossExamination, FinalReport } from '@/lib/schemas';

// ---------------------------------------------------------------------------
// Provider & Configuration Types
// ---------------------------------------------------------------------------

/** Supported LLM providers */
export type ProviderType = 'google' | 'groq' | 'openrouter';

/** Simulation mode — determines the personas' framing and language */
export type SimulationMode = 'vc' | 'board';

/**
 * User-provided configuration for a session.
 * Validated with Zod before use (see config.ts).
 */
export interface SessionConfig {
  provider: ProviderType;
  model: string;
  apiKey: string;
  tavilyApiKey?: string;
  mode: SimulationMode;
}

// ---------------------------------------------------------------------------
// Node Types
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a pipeline node.
 *
 *   pending  → The node hasn't started yet (dependencies unmet)
 *   running  → Actively executing
 *   done     → Completed successfully
 *   error    → Failed after exhausting retries
 *   skipped  → Skipped due to upstream failure (graceful degradation)
 *   waiting  → Paused, waiting for external input (e.g., user defense)
 */
export type NodeStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped' | 'waiting';

/**
 * Configuration for retry behavior on a per-node basis.
 * Defaults are provided in retry.ts.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds before first retry (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs: number;
  /** Whether this node is critical — if false, pipeline continues on failure */
  critical: boolean;
}

/**
 * Runtime state of a single node within the pipeline.
 * Tracked by the pipeline executor and surfaced via SSE events.
 */
export interface NodeState {
  nodeId: string;
  status: NodeStatus;
  /** Number of retry attempts so far */
  attempts: number;
  /** Error message if status is 'error' */
  error?: string;
  /** Timestamp when the node started executing */
  startedAt?: number;
  /** Timestamp when the node completed (success or final failure) */
  completedAt?: number;
}

/**
 * A pipeline node — the fundamental unit of work in the DAG.
 *
 * Each node declares its dependencies (other node IDs that must complete first),
 * an execute function, and retry configuration.
 *
 * The execute function receives the full session context and returns partial
 * session data to be merged into the session.
 *
 * @template T - The shape of the data this node produces
 */
export interface PipelineNode<T = Partial<SessionData>> {
  /** Unique identifier for this node */
  id: string;
  /** Human-readable label shown in the UI */
  label: string;
  /** IDs of nodes that must complete before this node can run */
  dependencies: string[];
  /** Retry configuration (merged with defaults) */
  retryConfig: RetryConfig;
  /**
   * The execution function. Receives the current session context and an
   * event emitter to stream partial results.
   *
   * @param ctx - Current session context (config, accumulated data)
   * @param emit - Function to emit SSE events to the frontend
   * @returns Partial session data to merge into the session
   */
  execute: (
    ctx: ExecutionContext,
    emit: EventEmitter,
  ) => Promise<T>;
}

// ---------------------------------------------------------------------------
// Execution Context
// ---------------------------------------------------------------------------

/**
 * Context provided to each node's execute function.
 * Contains the session config and all data accumulated so far.
 */
export interface ExecutionContext {
  sessionId: string;
  config: SessionConfig;
  data: SessionData;
}

/**
 * Function type for emitting pipeline events to the SSE stream.
 */
export type EventEmitter = (event: PipelineEvent) => void;

// ---------------------------------------------------------------------------
// Session Types
// ---------------------------------------------------------------------------

/**
 * All data accumulated during a pipeline run.
 * Each node's output is merged into this structure.
 */
export interface SessionData {
  pitch: string;
  marketAnalysis?: string;
  personas: Persona[];
  critiques: Critique[];
  crossExaminations: CrossExamination[];
  userRebuttal?: string;
  finalReport?: FinalReport;
}

/**
 * Top-level session status — a higher-level state machine than individual nodes.
 *
 *   created      → Session exists but pipeline hasn't started
 *   running      → Pipeline is actively executing nodes
 *   waiting      → Pipeline is paused, waiting for user input (defense)
 *   completed    → Pipeline finished successfully
 *   failed       → Pipeline failed (critical node errored)
 *   cancelled    → User cancelled mid-run
 */
export type SessionStatus = 'created' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';

/**
 * Complete session state — persisted to localStorage.
 * Contains configuration, accumulated data, node states, and metadata.
 */
export interface Session {
  id: string;
  status: SessionStatus;
  config: SessionConfig;
  data: SessionData;
  /** Per-node runtime state */
  nodeStates: Record<string, NodeState>;
  /** ISO timestamp of session creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Pipeline Events (SSE)
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all events the pipeline can emit via SSE.
 * The frontend subscribes to these to update the UI in real-time.
 *
 * Event types:
 *   session:status   → Session-level status change
 *   node:status      → A node's status changed (started, completed, failed)
 *   node:partial     → Partial streaming data from a node (e.g., persona being generated)
 *   node:result      → Final result data from a completed node
 *   pipeline:error   → Unrecoverable pipeline-level error
 *   pipeline:done    → Pipeline completed (all nodes finished)
 */
export type PipelineEvent =
  | {
      type: 'session:status';
      sessionId: string;
      status: SessionStatus;
      timestamp: number;
    }
  | {
      type: 'node:status';
      sessionId: string;
      nodeId: string;
      status: NodeStatus;
      attempt?: number;
      error?: string;
      timestamp: number;
    }
  | {
      type: 'node:partial';
      sessionId: string;
      nodeId: string;
      /** Partial data being streamed (schema depends on node type) */
      data: unknown;
      timestamp: number;
    }
  | {
      type: 'node:result';
      sessionId: string;
      nodeId: string;
      /** Final result data from the node */
      data: unknown;
      timestamp: number;
    }
  | {
      type: 'pipeline:error';
      sessionId: string;
      error: string;
      timestamp: number;
    }
  | {
      type: 'pipeline:done';
      sessionId: string;
      timestamp: number;
    };

/**
 * Helper to extract a specific event type from the PipelineEvent union.
 * Useful for type-safe event handlers on the frontend.
 *
 * @example
 *   type NodeStatusEvent = ExtractEvent<'node:status'>;
 *   // { type: 'node:status'; sessionId: string; nodeId: string; ... }
 */
export type ExtractEvent<T extends PipelineEvent['type']> = Extract<PipelineEvent, { type: T }>;
