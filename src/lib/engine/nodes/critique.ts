/**
 * AgenticVC Pipeline Node — Critique Generation
 *
 * Runs 3 parallel LLM calls — one for each recruited persona — to generate
 * brutally honest critiques of the user's pitch.
 *
 * Architecture note:
 *   Although this node internally runs 3 parallel operations, it's modeled as
 *   a single pipeline node. This keeps the DAG simpler and avoids needing
 *   a "join" node to collect results. The parallelism is internal to the node.
 *
 * Dependencies: ['recruit'] (needs the generated personas)
 */

import type { PipelineNode, ExecutionContext, EventEmitter, SessionData } from '../types';
import { generateObject } from 'ai';
import { getLLMClient } from '@/lib/llm-client';
import { CritiqueSchema, Persona, Critique } from '@/lib/schemas';
import { createNodeLogger } from '../logger';

const nodeLog = createNodeLogger('critique');

// ---------------------------------------------------------------------------
// Node Definition
// ---------------------------------------------------------------------------

export const critiqueNode: PipelineNode<Partial<SessionData>> = {
  id: 'critique',
  label: 'Adversarial Critique',
  dependencies: ['recruit'], // Needs personas
  retryConfig: {
    maxRetries: 3,
    baseDelayMs: 1500,
    maxDelayMs: 30_000,
    critical: true, // Pipeline needs critiques for cross-examination and synthesis
  },

  async execute(ctx: ExecutionContext, emit: EventEmitter): Promise<Partial<SessionData>> {
    const { config, data } = ctx;

    if (!data.personas || data.personas.length === 0) {
      throw new Error('No personas available for critique generation.');
    }

    nodeLog('info', `Generating critiques from ${data.personas.length} personas in parallel...`);

    const llm = getLLMClient(config.provider, config.apiKey);
    const model = llm(config.model);

    // Truncate pitch for token efficiency
    const corePitch =
      data.pitch.substring(0, 2000) +
      (data.pitch.length > 2000 ? '\n...[Pitch truncated to save tokens]' : '');

    // Run all 3 critiques in parallel
    const critiquePromises = data.personas.map(async (persona: Persona, index: number) => {
      nodeLog('debug', `Starting critique from ${persona.name}...`);

      const { object } = await generateObject({
        model,
        schema: CritiqueSchema,
        system: `You are ${persona.name}, ${persona.title}. Background: ${persona.background}.\n\nYour instructions: ${persona.systemPrompt}\n\nYour task is to brutally and honestly critique the provided business pitch. Do not be polite. Find the fatal flaws.`,
        prompt: `The pitch: ${corePitch}\n\nProvide your critique.`,
      });

      const critique: Critique = {
        personaName: persona.name,
        critique: object.critique,
        biggestRisk: object.biggestRisk,
      };

      // Emit each critique as it completes for real-time streaming
      emit({
        type: 'node:partial',
        sessionId: ctx.sessionId,
        nodeId: 'critique',
        data: { critique, index },
        timestamp: Date.now(),
      });

      nodeLog('info', `Critique from ${persona.name} complete.`);
      return critique;
    });

    // Wait for all critiques to complete
    // If any individual critique fails, the whole Promise.all rejects,
    // which triggers the retry mechanism at the node level.
    const critiques = await Promise.all(critiquePromises);

    nodeLog('info', `All ${critiques.length} critiques generated.`);

    return { critiques };
  },
};
