import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory token usage store keyed by a session identifier
const tokenStore = new Map<string, Array<{ stage: string; promptTokens: number; completionTokens: number; timestamp: number }>>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, stage, promptTokens, completionTokens } = body;

    if (!sessionId || !stage) {
      return NextResponse.json({ error: 'Missing sessionId or stage' }, { status: 400 });
    }

    const existing = tokenStore.get(sessionId) || [];
    existing.push({
      stage,
      promptTokens: promptTokens || 0,
      completionTokens: completionTokens || 0,
      timestamp: Date.now(),
    });
    tokenStore.set(sessionId, existing);

    // Cleanup old sessions (> 1 hour)
    const cutoff = Date.now() - 3600000;
    for (const [key, entries] of tokenStore.entries()) {
      if (entries.every(e => e.timestamp < cutoff)) {
        tokenStore.delete(key);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to record token usage' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const entries = tokenStore.get(sessionId) || [];
  const totalPrompt = entries.reduce((sum, e) => sum + e.promptTokens, 0);
  const totalCompletion = entries.reduce((sum, e) => sum + e.completionTokens, 0);

  return NextResponse.json({
    stages: entries,
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    totalTokens: totalPrompt + totalCompletion,
  });
}
