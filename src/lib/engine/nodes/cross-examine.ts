/**
 * AgenticVC Pipeline Node — Cross-Examination
 *
 * Each persona reviews the other personas' critiques and attacks them.
 * This creates the "debate loop" — personas don't just critique the pitch,
 * they argue with each other, exposing hidden logical inconsistencies.
 *
 * Like the critique node, this runs 3 parallel LLM calls internally.
 *
 * Dependencies: ['critique'] (needs critiques to cross-examine)
 */

import type { PipelineNode, ExecutionContext, EventEmitter, SessionData } from '../types';
import { generateObject } from 'ai';
import { getLLMClient } from '@/lib/llm-client';
import { CrossExaminationSchema, Persona, Critique, CrossExamination } from '@/lib/schemas';
import { z } from 'zod';
import { createNodeLogger } from '../logger';

const nodeLog = createNodeLogger('cross-examine');

// ---------------------------------------------------------------------------
// System Prompts by Mode
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS = {
  vc: (persona: Persona) =>
    `You are ${persona.name}, ${persona.title}. You must review the critiques from your fellow Investment Committee members and attack them.\nYour task is to aggressively cross-examine their critiques. If they missed something, call it out. If they are wrong, attack their logic. Be brutal but highly analytical.`,
  board: (persona: Persona) =>
    `You are ${persona.name}, ${persona.title}. You must review the critiques from your fellow board members and attack them.\nYour task is to aggressively cross-examine their critiques. If they missed something, call it out. If they are wrong, attack their logic. Be brutal but highly analytical.`,
};

// ---------------------------------------------------------------------------
// Node Definition
// ---------------------------------------------------------------------------

export const crossExamineNode: PipelineNode<Partial<SessionData>> = {
  id: 'cross-examine',
  label: 'Cross-Examination',
  dependencies: ['critique'], // Needs critiques to cross-examine
  retryConfig: {
    maxRetries: 3,
    baseDelayMs: 1500,
    maxDelayMs: 30_000,
    critical: true,
  },

  async execute(ctx: ExecutionContext, emit: EventEmitter): Promise<Partial<SessionData>> {
    const { config, data } = ctx;

    if (!data.personas || !data.critiques) {
      throw new Error('Missing personas or critiques for cross-examination.');
    }

    nodeLog('info', `Starting cross-examination with ${data.personas.length} personas...`);

    const llm = getLLMClient(config.provider, config.apiKey);
    const model = llm(config.model);

    // Brief pitch summary for token efficiency
    const briefPitch =
      data.pitch.substring(0, 500) +
      (data.pitch.length > 500 ? '\n...[Pitch truncated]' : '');

    // Run all 3 cross-examinations in parallel
    const crossExamPromises = data.personas.map(async (persona: Persona, index: number) => {
      // Each persona only sees the OTHER personas' critiques
      const otherCritiques = data.critiques.filter(
        (c: Critique) => c.personaName !== persona.name,
      );
      const otherCritiquesText = otherCritiques
        .map((c: Critique) => `[${c.personaName}]: ${c.critique}`)
        .join('\n\n');

      nodeLog('debug', `${persona.name} cross-examining ${otherCritiques.length} critiques...`);

      const schema = z.object({
        personaName: z.string(),
        rebuttal: z.string(),
      });

      const { object } = await generateObject({
        model,
        schema,
        system: SYSTEM_PROMPTS[config.mode](persona),
        prompt: `Pitch summary: ${briefPitch}\n\nCritiques from others:\n${otherCritiquesText}\n\nProvide your counter-argument / rebuttal.`,
      });

      const crossExam: CrossExamination = {
        personaName: persona.name,
        rebuttal: object.rebuttal,
      };

      // Emit each cross-examination as it completes
      emit({
        type: 'node:partial',
        sessionId: ctx.sessionId,
        nodeId: 'cross-examine',
        data: { crossExamination: crossExam, index },
        timestamp: Date.now(),
      });

      nodeLog('info', `${persona.name} cross-examination complete.`);
      return crossExam;
    });

    const crossExaminations = await Promise.all(crossExamPromises);

    nodeLog('info', `All ${crossExaminations.length} cross-examinations complete.`);

    return { crossExaminations };
  },
};
