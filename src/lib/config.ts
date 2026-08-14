/**
 * AgenticVC — Configuration Validation
 *
 * Zod schemas for validating user-provided configuration before
 * creating a session. Catches invalid inputs early with clear error messages.
 *
 * This replaces the ad-hoc validation in the old page.tsx
 * (which was just `if (!pitch || !apiKey || !model)`).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Configuration Schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for session configuration.
 * Validates provider, model, API key, and optional Tavily key.
 */
export const SessionConfigSchema = z.object({
  provider: z.enum(['google', 'groq', 'openrouter'], {
    error: 'Provider must be one of: google, groq, openrouter',
  }),

  model: z
    .string()
    .min(1, 'Model ID is required.')
    .max(100, 'Model ID is too long.'),

  apiKey: z
    .string()
    .min(1, 'API key is required.')
    .max(500, 'API key is too long.'),

  tavilyApiKey: z
    .string()
    .max(500, 'Tavily API key is too long.')
    .optional()
    .transform((val) => (val === '' ? undefined : val)),

  mode: z.enum(['vc', 'board'], {
    error: 'Mode must be one of: vc, board',
  }),
});

/**
 * Zod schema for session creation requests.
 * Includes the config plus the pitch text.
 */
export const CreateSessionSchema = z.object({
  config: SessionConfigSchema,
  pitch: z
    .string()
    .min(10, 'Pitch must be at least 10 characters.')
    .max(50_000, 'Pitch is too long (max 50,000 characters).'),
});

/**
 * Zod schema for user defense submission.
 */
export const UserDefenseSchema = z.object({
  userRebuttal: z
    .string()
    .max(10_000, 'Defense text is too long (max 10,000 characters).')
    .default(''),
});

// ---------------------------------------------------------------------------
// Type exports (inferred from schemas)
// ---------------------------------------------------------------------------

export type ValidatedSessionConfig = z.infer<typeof SessionConfigSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type UserDefenseInput = z.infer<typeof UserDefenseSchema>;
