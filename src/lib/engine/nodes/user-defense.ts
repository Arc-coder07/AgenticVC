/**
 * AgenticVC Pipeline Node — User Defense (Wait Node)
 *
 * This is a special "gate" node that pauses the pipeline and waits for
 * user input. When the cross-examination completes, this node triggers
 * and immediately signals the pipeline to pause.
 *
 * The frontend displays the defense UI, and when the user submits their
 * response (or skips), the API calls provideInput() on the pipeline executor,
 * which marks this node as 'done' and resumes execution.
 *
 * Dependencies: ['cross-examine']
 */

import type { PipelineNode, ExecutionContext, EventEmitter, SessionData } from '../types';
import { WaitForInputSignal } from '../pipeline';
import { createNodeLogger } from '../logger';

const nodeLog = createNodeLogger('user-defense');

// ---------------------------------------------------------------------------
// Node Definition
// ---------------------------------------------------------------------------

export const userDefenseNode: PipelineNode<Partial<SessionData>> = {
  id: 'user-defense',
  label: 'User Defense',
  dependencies: ['cross-examine'], // Wait for cross-examination to complete
  retryConfig: {
    maxRetries: 0, // No retries — this is a user input gate
    baseDelayMs: 0,
    maxDelayMs: 0,
    critical: true,
  },

  async execute(ctx: ExecutionContext, emit: EventEmitter): Promise<Partial<SessionData>> {
    nodeLog('info', 'Cross-examination complete. Waiting for user defense input...');

    // Signal the pipeline to pause and wait for external input.
    // The pipeline executor catches this and sets the node to 'waiting' status.
    // When the user submits their defense via the API, provideInput() is called
    // with { userRebuttal: "..." }, which marks this node as 'done' and resumes.
    throw new WaitForInputSignal(
      'user-defense',
      'Waiting for user to submit their defense.',
    );
  },
};
