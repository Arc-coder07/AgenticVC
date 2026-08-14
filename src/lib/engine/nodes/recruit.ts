/**
 * AgenticVC Pipeline Node — Persona Recruitment
 *
 * Generates 3 specialized adversarial expert personas tailored to the
 * user's pitch. Uses the pitch text and optional market research data
 * to create highly relevant personas.
 *
 * Dependencies: ['research'] (waits for market research to complete/skip)
 *
 * This is a critical node — if recruitment fails, the pipeline cannot continue
 * because all downstream nodes (critique, cross-examine, synthesize) need personas.
 */

import type { PipelineNode, ExecutionContext, EventEmitter, SessionData } from '../types';
import { generateObject } from 'ai';
import { getLLMClient } from '@/lib/llm-client';
import { PersonaSchema } from '@/lib/schemas';
import { z } from 'zod';
import { createNodeLogger } from '../logger';

const nodeLog = createNodeLogger('recruit');

// ---------------------------------------------------------------------------
// System Prompts by Mode
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS = {
  vc: `You are an expert Chief of Staff and recruiter. Based on the user's business pitch and any provided market context, identify the 3 most critical, distinct, and adversarial expert personas needed to form an "Investment Committee" to brutally stress-test the idea. The personas must be highly specialized to the specific industry of the pitch (e.g., Regulatory Lawyer, Cynical CFO, Gen-Z Growth Hacker). Provide a name, title, background, and a strict system prompt for each.`,
  board: `You are an expert Chief of Staff and recruiter. Based on the user's business pitch and any provided market context, identify the 3 most critical, distinct, and adversarial expert personas needed to form a "Board of Directors" to brutally stress-test the idea. The personas must be highly specialized to the specific industry of the pitch (e.g., Regulatory Lawyer, Cynical CFO, Gen-Z Growth Hacker). Provide a name, title, background, and a strict system prompt for each.`,
};

// ---------------------------------------------------------------------------
// Node Definition
// ---------------------------------------------------------------------------

export const recruitNode: PipelineNode<Partial<SessionData>> = {
  id: 'recruit',
  label: 'Persona Recruitment',
  dependencies: ['research'], // Wait for market research
  retryConfig: {
    maxRetries: 3,
    baseDelayMs: 1500,
    maxDelayMs: 30_000,
    critical: true, // Pipeline cannot continue without personas
  },

  async execute(ctx: ExecutionContext, emit: EventEmitter): Promise<Partial<SessionData>> {
    const { config, data } = ctx;

    nodeLog('info', 'Recruiting adversarial personas...');

    const llm = getLLMClient(config.provider, config.apiKey);
    const model = llm(config.model);

    // Truncate pitch for token efficiency
    const corePitch =
      data.pitch.substring(0, 2000) +
      (data.pitch.length > 2000 ? '\n...[Pitch truncated to save tokens]' : '');

    // Build the prompt with optional market context
    let prompt = `The pitch: ${corePitch}`;
    if (data.marketAnalysis) {
      prompt += `\n\nReal-world Market Context (from live web search):\n${data.marketAnalysis}\n\nFactor this real-world data into your persona selection.`;
    }

    const schema = z.object({
      personas: z.array(PersonaSchema).length(3),
    });

    const { object } = await generateObject({
      model,
      schema,
      system: SYSTEM_PROMPTS[config.mode],
      prompt,
    });

    nodeLog('info', `Recruited ${object.personas.length} personas: ${object.personas.map((p) => p.name).join(', ')}`);

    // Emit each persona as partial data for real-time UI updates
    for (const persona of object.personas) {
      emit({
        type: 'node:partial',
        sessionId: ctx.sessionId,
        nodeId: 'recruit',
        data: { persona },
        timestamp: Date.now(),
      });
    }

    return { personas: object.personas };
  },
};
