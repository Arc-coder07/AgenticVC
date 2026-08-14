/**
 * AgenticVC API — Pipeline SSE Stream
 *
 * GET /api/session/[id]/stream
 *
 * Starts the pipeline for the given session and streams real-time events
 * to the client via Server-Sent Events (SSE).
 *
 * The client receives events as they happen:
 *   - session:status  → Session status changes
 *   - node:status     → Node lifecycle changes (pending → running → done)
 *   - node:partial    → Streaming partial data (personas appearing, critiques typing)
 *   - node:result     → Final results from completed nodes
 *   - pipeline:done   → Pipeline completed
 *   - pipeline:error  → Unrecoverable error
 *
 * When the pipeline hits a 'waiting' node (user defense), the stream stays
 * open. The client submits the defense via POST /api/session/[id]/defend,
 * which resumes the pipeline and continues streaming events.
 *
 * SSE Format:
 *   data: {"type":"node:status","nodeId":"recruit","status":"running",...}\n\n
 */

import {
  sessionManager,
  PipelineBuilder,
  PipelineExecutor,
  researchNode,
  recruitNode,
  critiqueNode,
  crossExamineNode,
  userDefenseNode,
  synthesizeNode,
  log,
} from '@/lib/engine';
import type { PipelineEvent } from '@/lib/engine';

export const maxDuration = 120; // Allow longer execution for full pipeline

// ---------------------------------------------------------------------------
// Global executor registry
// ---------------------------------------------------------------------------

/**
 * Store active pipeline executors keyed by session ID.
 * This allows the /defend endpoint to resume a paused pipeline.
 *
 * Uses globalThis to survive Next.js hot reloads in development.
 */
const globalForExecutors = globalThis as unknown as {
  __agenticvc_executors?: Map<string, PipelineExecutor>;
  __agenticvc_emitters?: Map<string, (event: PipelineEvent) => void>;
};

export const executorRegistry: Map<string, PipelineExecutor> =
  globalForExecutors.__agenticvc_executors ??
  (globalForExecutors.__agenticvc_executors = new Map());

export const emitterRegistry: Map<string, (event: PipelineEvent) => void> =
  globalForExecutors.__agenticvc_emitters ??
  (globalForExecutors.__agenticvc_emitters = new Map());

// ---------------------------------------------------------------------------
// SSE Stream Handler
// ---------------------------------------------------------------------------

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Validate session exists
  try {
    sessionManager.getSession(id);
  } catch {
    return Response.json({ error: 'Session not found.' }, { status: 404 });
  }

  const session = sessionManager.getSession(id);

  // Prevent starting a pipeline that's already running or completed
  if (session.status === 'running') {
    return Response.json({ error: 'Pipeline is already running.' }, { status: 409 });
  }
  if (session.status === 'completed') {
    return Response.json({ error: 'Pipeline already completed.', session }, { status: 200 });
  }

  // Build the pipeline DAG
  const pipeline = new PipelineBuilder()
    .addNode(researchNode)
    .addNode(recruitNode)
    .addNode(critiqueNode)
    .addNode(crossExamineNode)
    .addNode(userDefenseNode)
    .addNode(synthesizeNode)
    .build();

  // Create the SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Event emitter that writes SSE-formatted events to the stream
      const emit = (event: PipelineEvent) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Persist session state after each event
          sessionManager.updateSession(session);
        } catch (err) {
          // Stream may have been closed by the client
          log('warn', `Failed to emit SSE event: ${err}`);
        }
      };

      // Create and register the executor
      const executor = new PipelineExecutor(pipeline, session, emit);
      executorRegistry.set(id, executor);
      emitterRegistry.set(id, emit);

      // Start the pipeline (async, runs in background)
      executor
        .run()
        .then(() => {
          // If pipeline completed (all nodes done), close the stream
          if (session.status === 'completed' || session.status === 'failed') {
            try {
              controller.close();
            } catch {
              // Already closed
            }
            executorRegistry.delete(id);
            emitterRegistry.delete(id);
          }
          // If 'waiting', keep stream open for resume via /defend
        })
        .catch((error) => {
          log('error', `Pipeline stream error: ${error}`);
          try {
            const errorEvent: PipelineEvent = {
              type: 'pipeline:error',
              sessionId: id,
              error: error instanceof Error ? error.message : String(error),
              timestamp: Date.now(),
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
            controller.close();
          } catch {
            // Already closed
          }
          executorRegistry.delete(id);
          emitterRegistry.delete(id);
        });
    },
    cancel() {
      log('info', `SSE stream cancelled for session ${id}`);
      // Clean up if client disconnects
      executorRegistry.delete(id);
      emitterRegistry.delete(id);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
