/**
 * AgenticVC API — User Defense Submission
 *
 * POST /api/session/[id]/defend
 *
 * Submits the user's defense/rebuttal to a paused pipeline.
 * The pipeline resumes execution from the 'user-defense' node.
 *
 * Request body:
 *   { userRebuttal: string }
 *
 * Response:
 *   200 { message: string }  (defense accepted, pipeline resuming)
 *   400 { error: string }     (validation error or pipeline not waiting)
 *   404 { error: string }     (session not found)
 */

import { NextRequest } from 'next/server';
import { sessionManager, log } from '@/lib/engine';
import { UserDefenseSchema } from '@/lib/config';
import { executorRegistry, emitterRegistry } from '../stream/route';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Validate session exists
    const session = sessionManager.getSession(id);

    // Validate session is waiting for input
    if (session.status !== 'waiting') {
      return Response.json(
        { error: `Session is not waiting for input (current status: ${session.status}).` },
        { status: 400 },
      );
    }

    // Validate request body
    const body = await req.json();
    const parsed = UserDefenseSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return Response.json(
        { error: 'Invalid request.', details: errors },
        { status: 400 },
      );
    }

    const { userRebuttal } = parsed.data;

    // Get the active executor for this session
    const executor = executorRegistry.get(id);
    if (!executor) {
      return Response.json(
        { error: 'No active executor for this session. The SSE stream may have been disconnected.' },
        { status: 400 },
      );
    }

    log('info', `Defense submitted for session ${id}. Resuming pipeline.`);

    // Provide input to the waiting node and resume execution.
    // This is async — the pipeline continues in the background,
    // streaming events via the already-open SSE connection.
    executor
      .provideInput('user-defense', { userRebuttal })
      .then((updatedSession) => {
        sessionManager.updateSession(updatedSession);

        // If pipeline completed, close the SSE stream
        if (updatedSession.status === 'completed' || updatedSession.status === 'failed') {
          executorRegistry.delete(id);
          emitterRegistry.delete(id);
        }
      })
      .catch((error) => {
        log('error', `Pipeline resume error for session ${id}: ${error}`);
        const emit = emitterRegistry.get(id);
        if (emit) {
          emit({
            type: 'pipeline:error',
            sessionId: id,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          });
        }
        executorRegistry.delete(id);
        emitterRegistry.delete(id);
      });

    return Response.json({ message: 'Defense accepted. Pipeline resuming.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(`POST /api/session/${id}/defend error:`, error);
    return Response.json({ error: message }, { status: (error as any)?.statusCode ?? 500 });
  }
}
