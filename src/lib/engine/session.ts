/**
 * AgenticVC Pipeline Engine — Session Manager
 *
 * Manages the lifecycle of pipeline sessions:
 *   - Create new sessions with validated configuration
 *   - Retrieve existing sessions by ID
 *   - Update session state during pipeline execution
 *   - List all sessions (for history view)
 *   - Delete sessions
 *
 * Storage strategy (current: in-memory Map):
 *   For the open-source version, sessions are stored in a server-side Map.
 *   This means sessions don't survive server restarts.
 *
 *   For a future SaaS version, swap the storage implementation to use:
 *     - SQLite via Prisma (self-hosted)
 *     - Supabase/Neon Postgres (cloud)
 *
 *   The SessionStore interface makes this swap straightforward.
 */

import type { Session, SessionConfig, SessionData } from './types';
import { SessionNotFoundError } from './errors';
import { log } from './logger';

// ---------------------------------------------------------------------------
// Session Store Interface
// ---------------------------------------------------------------------------

/**
 * Abstract storage interface for sessions.
 * Implement this to swap backends (in-memory → SQLite → Postgres).
 */
export interface SessionStore {
  get(id: string): Session | undefined;
  set(id: string, session: Session): void;
  delete(id: string): boolean;
  list(): Session[];
  has(id: string): boolean;
}

// ---------------------------------------------------------------------------
// In-Memory Store (Default)
// ---------------------------------------------------------------------------

/**
 * Simple in-memory session store using a Map.
 * Sessions are lost on server restart — acceptable for open-source/dev usage.
 */
class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, Session> = new Map();

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  set(id: string, session: Session): void {
    this.sessions.set(id, session);
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }
}

// ---------------------------------------------------------------------------
// Session Manager
// ---------------------------------------------------------------------------

/**
 * High-level session management — the public API for session operations.
 * Used by the API routes to create, retrieve, and update sessions.
 */
export class SessionManager {
  private store: SessionStore;

  constructor(store?: SessionStore) {
    this.store = store || new InMemorySessionStore();
  }

  /**
   * Create a new session with the given configuration and pitch.
   *
   * @param config - Validated session configuration
   * @param pitch - The user's pitch text
   * @returns The newly created session
   */
  createSession(config: SessionConfig, pitch: string): Session {
    const id = generateSessionId();
    const now = new Date().toISOString();

    const session: Session = {
      id,
      status: 'created',
      config,
      data: {
        pitch,
        personas: [],
        critiques: [],
        crossExaminations: [],
      },
      nodeStates: {},
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(id, session);
    log('info', `Session created: ${id}`);
    return session;
  }

  /**
   * Retrieve a session by ID.
   * @throws SessionNotFoundError if the session doesn't exist
   */
  getSession(id: string): Session {
    const session = this.store.get(id);
    if (!session) {
      throw new SessionNotFoundError(id);
    }
    return session;
  }

  /**
   * Update a session in storage.
   * Called by the pipeline executor after each state change.
   */
  updateSession(session: Session): void {
    session.updatedAt = new Date().toISOString();
    this.store.set(session.id, session);
  }

  /**
   * List all sessions, most recent first.
   */
  listSessions(): Session[] {
    return this.store
      .list()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Delete a session by ID.
   * @returns true if the session was found and deleted
   */
  deleteSession(id: string): boolean {
    const deleted = this.store.delete(id);
    if (deleted) {
      log('info', `Session deleted: ${id}`);
    }
    return deleted;
  }

  /**
   * Check if a session exists.
   */
  hasSession(id: string): boolean {
    return this.store.has(id);
  }
}

// ---------------------------------------------------------------------------
// Singleton Instance
// ---------------------------------------------------------------------------

/**
 * Global session manager instance.
 * Using a singleton so all API routes share the same session store.
 *
 * This pattern works in both development (hot reload preserves globals via
 * globalThis) and production (single process).
 */
const globalForSessions = globalThis as unknown as {
  __agenticvc_session_manager?: SessionManager;
};

export const sessionManager: SessionManager =
  globalForSessions.__agenticvc_session_manager ??
  (globalForSessions.__agenticvc_session_manager = new SessionManager());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a URL-safe session ID.
 * Format: "ses_" + 12 random alphanumeric characters.
 *
 * @example "ses_a3bF7kX9mQ2p"
 */
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'ses_';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
