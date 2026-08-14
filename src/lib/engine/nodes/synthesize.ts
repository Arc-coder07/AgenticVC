/**
 * AgenticVC Pipeline Node — Final Report Synthesis
 *
 * The Lead Partner (VC mode) or Chairman (Board mode) synthesizes the
 * entire debate — critiques, cross-examinations, and the user's defense —
 * into a final actionable Risk & Viability Report.
 *
 * This is the terminal node of the pipeline.
 *
 * Dependencies: ['user-defense'] (waits for user defense to be submitted)
 */

import type { PipelineNode, ExecutionContext, EventEmitter, SessionData } from '../types';
import { generateObject } from 'ai';
import { getLLMClient } from '@/lib/llm-client';
import { FinalReportSchema, Critique, CrossExamination } from '@/lib/schemas';
import { createNodeLogger } from '../logger';

const nodeLog = createNodeLogger('synthesize');

// ---------------------------------------------------------------------------
// System Prompts by Mode
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS = {
  vc: `You are the Lead Partner of the VC firm. You have heard the business pitch, the brutal critiques, the investment committee's internal debate, and the user's defense. Your job is to synthesize this into a final, actionable Risk & Viability Report. Be highly objective, lean towards the cynical side to protect the firm's capital, and provide actionable pivot recommendations.`,
  board: `You are the Chairman of the Board. You have heard the business pitch, the brutal critiques, the board's internal debate, and the user's defense. Your job is to synthesize this into a final, actionable Risk & Viability Report. Be highly objective, lean towards the cynical side to protect the founder, and provide actionable pivot recommendations.`,
};

// ---------------------------------------------------------------------------
// Node Definition
// ---------------------------------------------------------------------------

export const synthesizeNode: PipelineNode<Partial<SessionData>> = {
  id: 'synthesize',
  label: 'Final Synthesis',
  dependencies: ['user-defense'], // Waits for user defense
  retryConfig: {
    maxRetries: 3,
    baseDelayMs: 2000,
    maxDelayMs: 30_000,
    critical: true,
  },

  async execute(ctx: ExecutionContext, emit: EventEmitter): Promise<Partial<SessionData>> {
    const { config, data } = ctx;

    nodeLog('info', 'Synthesizing final report...');

    const llm = getLLMClient(config.provider, config.apiKey);
    const model = llm(config.model);

    const modeLabel = config.mode === 'vc' ? 'Investment Committee' : 'Board';

    // Brief pitch for token efficiency
    const briefPitch =
      data.pitch.substring(0, 500) +
      (data.pitch.length > 500 ? '\n...[Pitch truncated]' : '');

    // Build the synthesis context with all accumulated debate data
    const context = `
Pitch Summary: ${briefPitch}

Critiques from the ${modeLabel}:
${data.critiques.map((c: Critique) => `--- ${c.personaName} ---\nCritique: ${c.critique}\nBiggest Risk: ${c.biggestRisk}`).join('\n\n')}

Cross-Examinations (${modeLabel} Debate):
${data.crossExaminations.map((cx: CrossExamination) => `[${cx.personaName}]: ${cx.rebuttal}`).join('\n\n')}

User's Defense / Rebuttal:
${data.userRebuttal ? data.userRebuttal : 'The user chose not to defend the pitch.'}
    `.trim();

    const { object } = await generateObject({
      model,
      schema: FinalReportSchema,
      system: SYSTEM_PROMPTS[config.mode],
      prompt: context,
    });

    nodeLog('info', `Final report generated. Viability score: ${object.viabilityScore}/100`);

    // Emit partial data for real-time streaming
    emit({
      type: 'node:partial',
      sessionId: ctx.sessionId,
      nodeId: 'synthesize',
      data: { finalReport: object },
      timestamp: Date.now(),
    });

    return { finalReport: object };
  },
};
