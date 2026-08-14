/**
 * AgenticVC Pipeline Node — Market Research
 *
 * Optional, non-critical node that queries Tavily for live market context.
 * If the user doesn't provide a Tavily API key, or if the search fails,
 * the pipeline continues without market data (graceful degradation).
 *
 * This node runs in parallel with other early nodes since it has no
 * dependencies on generated content (only needs the raw pitch).
 */

import type { PipelineNode, ExecutionContext, EventEmitter, SessionData } from '../types';
import { tavily } from '@tavily/core';
import { createNodeLogger } from '../logger';

const nodeLog = createNodeLogger('research');

// ---------------------------------------------------------------------------
// Node Definition
// ---------------------------------------------------------------------------

export const researchNode: PipelineNode<Partial<SessionData>> = {
  id: 'research',
  label: 'Market Research',
  dependencies: [], // No dependencies — runs immediately
  retryConfig: {
    maxRetries: 2,
    baseDelayMs: 1000,
    maxDelayMs: 10_000,
    critical: false, // Non-critical: pipeline continues if research fails
  },

  async execute(ctx: ExecutionContext, emit: EventEmitter): Promise<Partial<SessionData>> {
    const { config, data } = ctx;

    // Skip if no Tavily key provided
    if (!config.tavilyApiKey) {
      nodeLog('info', 'No Tavily API key provided. Skipping market research.');
      return {};
    }

    nodeLog('info', 'Starting market research via Tavily...');

    // Use a brief version of the pitch for the search query
    const briefPitch = data.pitch.substring(0, 500);

    const tvly = tavily({ apiKey: config.tavilyApiKey });
    const searchResponse = await tvly.search(
      `Competitors and market risks for: ${briefPitch}`,
      {
        searchDepth: 'basic',
        maxResults: 3,
      },
    );

    const marketAnalysis = searchResponse.results
      .map((r) => `- ${r.title}: ${r.content}`)
      .join('\n');

    nodeLog('info', `Market research complete. Found ${searchResponse.results.length} results.`);

    // Emit partial data so the frontend can show it
    emit({
      type: 'node:partial',
      sessionId: ctx.sessionId,
      nodeId: 'research',
      data: { marketAnalysis },
      timestamp: Date.now(),
    });

    return { marketAnalysis };
  },
};
