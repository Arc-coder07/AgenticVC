/**
 * AgenticVC — useSession Hook
 *
 * Custom React hook that manages the entire client-side session lifecycle:
 *   1. Create a session via POST /api/session
 *   2. Connect to the SSE stream at GET /api/session/[id]/stream
 *   3. Parse incoming events and update local state
 *   4. Submit user defense via POST /api/session/[id]/defend
 *   5. Track per-node status, partial data, and final results
 *
 * This replaces the 15+ useState calls and 7 useEffect hooks in the old page.tsx.
 *
 * State machine (derived from SSE events):
 *   idle → creating → recruiting → deliberating → crossExamining → userRebuttal → compiling → done
 *   Any state → error (on pipeline:error)
 *   Any state → idle (on reset)
 */

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import type {
  SessionConfig,
  Session,
  PipelineEvent,
  SessionStatus,
  NodeState,
} from '@/lib/engine/types';
import type { Persona, Critique, CrossExamination, FinalReport } from '@/lib/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * UI-level stage — maps from the engine's session/node states to
 * what the user sees. This is a higher-level abstraction than SessionStatus.
 */
export type UIStage =
  | 'idle'
  | 'creating'
  | 'recruiting'
  | 'deliberating'
  | 'crossExamining'
  | 'userRebuttal'
  | 'compiling'
  | 'done'
  | 'error';

/**
 * Complete session state exposed to UI components.
 */
export interface SessionState {
  /** Current UI stage */
  stage: UIStage;
  /** Session ID (set after creation) */
  sessionId: string | null;
  /** Raw session data from the engine */
  session: Session | null;
  /** Accumulated personas (updated in real-time) */
  personas: Persona[];
  /** Accumulated critiques (updated in real-time) */
  critiques: Critique[];
  /** Accumulated cross-examinations (updated in real-time) */
  crossExaminations: CrossExamination[];
  /** Final report (available after synthesis completes) */
  finalReport: FinalReport | null;
  /** Market analysis text (from research node) */
  marketAnalysis: string | null;
  /** Per-node status map */
  nodeStates: Record<string, NodeState>;
  /** Error message (if stage is 'error') */
  error: string | null;
  /** Whether the SSE connection is active */
  isConnected: boolean;
}

/**
 * Actions exposed by the useSession hook.
 */
export interface SessionActions {
  /** Start a new session with the given config and pitch */
  startSession: (config: SessionConfig, pitch: string) => Promise<void>;
  /** Submit user defense/rebuttal */
  submitDefense: (rebuttalText: string) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
  /** Cancel the current session */
  cancel: () => void;
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const INITIAL_STATE: SessionState = {
  stage: 'idle',
  sessionId: null,
  session: null,
  personas: [],
  critiques: [],
  crossExaminations: [],
  finalReport: null,
  marketAnalysis: null,
  nodeStates: {},
  error: null,
  isConnected: false,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Core session management hook.
 *
 * @returns [state, actions] — the current session state and action functions
 *
 * @example
 *   const [session, actions] = useSession();
 *
 *   // Start a session
 *   await actions.startSession(config, pitch);
 *
 *   // Submit defense
 *   await actions.submitDefense('My rebuttal...');
 *
 *   // Read state
 *   console.log(session.stage, session.personas, session.critiques);
 */
export function useSession(): [SessionState, SessionActions] {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // -------------------------------------------------------------------------
  // SSE Event Handler
  // -------------------------------------------------------------------------

  /**
   * Process a single SSE event and update local state accordingly.
   */
  const handleEvent = useCallback((event: PipelineEvent) => {
    setState((prev) => {
      const next = { ...prev };

      switch (event.type) {
        case 'session:status':
          next.stage = mapSessionStatusToStage(event.status, prev);
          break;

        case 'node:status':
          next.nodeStates = {
            ...prev.nodeStates,
            [event.nodeId]: {
              nodeId: event.nodeId,
              status: event.status,
              attempts: event.attempt ?? 0,
              error: event.error,
            },
          };
          // Derive UI stage from node status changes
          next.stage = deriveStageFromNodes(next.nodeStates, prev.stage);
          break;

        case 'node:partial':
          handlePartialData(next, event.nodeId, event.data);
          break;

        case 'node:result':
          handleResultData(next, event.nodeId, event.data);
          break;

        case 'pipeline:error':
          next.stage = 'error';
          next.error = event.error;
          next.isConnected = false;
          break;

        case 'pipeline:done':
          next.stage = 'done';
          next.isConnected = false;
          break;
      }

      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /**
   * Create a session and connect to the SSE stream.
   */
  const startSession = useCallback(async (config: SessionConfig, pitch: string) => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setState((prev) => ({ ...prev, ...INITIAL_STATE, stage: 'creating' }));

    try {
      // Step 1: Create session via REST
      const createRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, pitch }),
      });

      if (!createRes.ok) {
        const errorData = await createRes.json();
        throw new Error(errorData.details?.join('; ') || errorData.error || 'Failed to create session.');
      }

      const { sessionId, session } = await createRes.json();
      sessionIdRef.current = sessionId;

      setState((prev) => ({
        ...prev,
        sessionId,
        session,
        stage: 'recruiting',
      }));

      // Step 2: Connect to SSE stream
      const eventSource = new EventSource(`/api/session/${sessionId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (e) => {
        try {
          const event: PipelineEvent = JSON.parse(e.data);
          handleEvent(event);
        } catch (err) {
          console.error('Failed to parse SSE event:', err, e.data);
        }
      };

      eventSource.onerror = () => {
        // EventSource will auto-reconnect, but if it keeps failing,
        // we should surface the error
        setState((prev) => {
          // Only show error if we're not already done or in a terminal state
          if (prev.stage === 'done' || prev.stage === 'idle' || prev.stage === 'error') {
            return prev;
          }
          return { ...prev, isConnected: false };
        });
      };

      eventSource.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true }));
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start session.';
      setState((prev) => ({
        ...prev,
        stage: 'error',
        error: message,
      }));
    }
  }, [handleEvent]);

  /**
   * Submit user defense/rebuttal to the paused pipeline.
   */
  const submitDefense = useCallback(async (rebuttalText: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    setState((prev) => ({ ...prev, stage: 'compiling' }));

    try {
      const res = await fetch(`/api/session/${sessionId}/defend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRebuttal: rebuttalText }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit defense.');
      }
      // Pipeline resumes via the existing SSE connection
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit defense.';
      setState((prev) => ({
        ...prev,
        stage: 'error',
        error: message,
      }));
    }
  }, []);

  /**
   * Reset everything to idle state.
   */
  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    sessionIdRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  /**
   * Cancel the current session.
   */
  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  // -------------------------------------------------------------------------
  // Estimated tokens (for the UI counter)
  // -------------------------------------------------------------------------

  const estimatedTokens = useMemo(() => {
    const textData =
      JSON.stringify(state.personas) +
      JSON.stringify(state.critiques) +
      JSON.stringify(state.crossExaminations) +
      (state.marketAnalysis || '') +
      JSON.stringify(state.finalReport || '');
    return Math.floor(textData.length / 4);
  }, [state.personas, state.critiques, state.crossExaminations, state.marketAnalysis, state.finalReport]);

  // Return state with computed estimatedTokens and actions
  const stateWithTokens = useMemo(
    () => ({ ...state, estimatedTokens }),
    [state, estimatedTokens],
  );

  const actions = useMemo(
    () => ({ startSession, submitDefense, reset, cancel }),
    [startSession, submitDefense, reset, cancel],
  );

  return [stateWithTokens, actions];
}

// ---------------------------------------------------------------------------
// State Derivation Helpers
// ---------------------------------------------------------------------------

/**
 * Map the engine's SessionStatus to a UI stage.
 * This handles the broad lifecycle; node-level changes are handled by deriveStageFromNodes.
 */
function mapSessionStatusToStage(status: SessionStatus, prev: SessionState): UIStage {
  switch (status) {
    case 'created': return 'creating';
    case 'running': return prev.stage === 'idle' || prev.stage === 'creating' ? 'recruiting' : prev.stage;
    case 'waiting': return 'userRebuttal';
    case 'completed': return 'done';
    case 'failed': return 'error';
    case 'cancelled': return 'idle';
    default: return prev.stage;
  }
}

/**
 * Derive the UI stage from per-node status changes.
 * This provides more granular stage transitions than session-level status.
 */
function deriveStageFromNodes(nodeStates: Record<string, NodeState>, currentStage: UIStage): UIStage {
  const get = (id: string) => nodeStates[id]?.status;

  // If synthesize is running or done, we're compiling/done
  if (get('synthesize') === 'running') return 'compiling';
  if (get('synthesize') === 'done') return 'done';

  // If user-defense is waiting, show the rebuttal UI
  if (get('user-defense') === 'waiting') return 'userRebuttal';

  // If cross-examine is running, show cross-examination
  if (get('cross-examine') === 'running') return 'crossExamining';
  if (get('cross-examine') === 'done' && get('user-defense') !== 'done') return 'crossExamining';

  // If critique is running, show deliberation
  if (get('critique') === 'running') return 'deliberating';
  if (get('critique') === 'done' && get('cross-examine') === 'pending') return 'deliberating';

  // If recruit is running, show recruiting
  if (get('recruit') === 'running') return 'recruiting';

  return currentStage;
}

/**
 * Handle partial streaming data from nodes.
 * Merges partial data into the accumulated state.
 */
function handlePartialData(state: SessionState, nodeId: string, data: unknown): void {
  const payload = data as Record<string, unknown>;

  switch (nodeId) {
    case 'research':
      if (payload.marketAnalysis) {
        state.marketAnalysis = payload.marketAnalysis as string;
      }
      break;

    case 'recruit':
      if (payload.persona) {
        // Add persona if not already present
        const persona = payload.persona as Persona;
        if (!state.personas.find((p) => p.name === persona.name)) {
          state.personas = [...state.personas, persona];
        }
      }
      break;

    case 'critique':
      if (payload.critique) {
        const critique = payload.critique as Critique;
        if (!state.critiques.find((c) => c.personaName === critique.personaName)) {
          state.critiques = [...state.critiques, critique];
        }
      }
      break;

    case 'cross-examine':
      if (payload.crossExamination) {
        const cx = payload.crossExamination as CrossExamination;
        if (!state.crossExaminations.find((c) => c.personaName === cx.personaName)) {
          state.crossExaminations = [...state.crossExaminations, cx];
        }
      }
      break;

    case 'synthesize':
      if (payload.finalReport) {
        state.finalReport = payload.finalReport as FinalReport;
      }
      break;
  }
}

/**
 * Handle final result data from completed nodes.
 * Similar to partial data but for complete results.
 */
function handleResultData(state: SessionState, nodeId: string, data: unknown): void {
  const payload = data as Record<string, unknown>;

  switch (nodeId) {
    case 'research':
      if (payload.marketAnalysis) {
        state.marketAnalysis = payload.marketAnalysis as string;
      }
      break;

    case 'recruit':
      if (payload.personas) {
        state.personas = payload.personas as Persona[];
      }
      break;

    case 'critique':
      if (payload.critiques) {
        state.critiques = payload.critiques as Critique[];
      }
      break;

    case 'cross-examine':
      if (payload.crossExaminations) {
        state.crossExaminations = payload.crossExaminations as CrossExamination[];
      }
      break;

    case 'synthesize':
      if (payload.finalReport) {
        state.finalReport = payload.finalReport as FinalReport;
      }
      break;
  }
}
