/**
 * AgenticVC API — Session Creation
 *
 * POST /api/session
 *
 * Creates a new pipeline session, validates the configuration,
 * and returns the session ID. The client then connects to the
 * SSE stream at /api/session/[id]/stream to receive real-time updates.
 *
 * Request body:
 *   {
 *     config: { provider, model, apiKey, tavilyApiKey?, mode },
 *     pitch: string
 *   }
 *
 * Response:
 *   201 { sessionId: string, session: Session }
 *   400 { error: string, details?: string[] }  (validation error)
 *   500 { error: string }                       (internal error)
 */

import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/engine';
import { CreateSessionSchema } from '@/lib/config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate the request body
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return Response.json(
        { error: 'Invalid request.', details: errors },
        { status: 400 },
      );
    }

    const { config, pitch } = parsed.data;

    // Create the session
    const session = sessionManager.createSession(config, pitch);

    return Response.json(
      { sessionId: session.id, session },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('POST /api/session error:', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
