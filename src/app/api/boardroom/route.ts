import { streamObject } from 'ai';
import { getLLMClient } from '@/lib/llm-client';
import { parseAPIError } from '@/lib/error-utils';
import { z } from 'zod';
import { PersonaSchema, CritiqueSchema, FinalReportSchema } from '@/lib/schemas';
import { tavily } from '@tavily/core';

export const maxDuration = 60; // Allow edge functions to run longer if supported

export async function POST(req: Request) {
  const abortSignal = req.signal; // Used to stop streaming when client disconnects
  let body: any;

  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body', code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { action, pitch, config, personas, critiques, persona } = body;

  // --- Validate required fields ---
  if (!action) {
    return new Response(
      JSON.stringify({ error: 'Missing "action" field', code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!config?.provider || !config?.model) {
    return new Response(
      JSON.stringify({ error: 'Missing provider or model configuration', code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (config.provider !== 'ollama' && !config.apiKey) {
    return new Response(
      JSON.stringify({ error: `API key is required for ${config.provider}`, code: 'AUTH_ERROR' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!pitch) {
    return new Response(
      JSON.stringify({ error: 'Missing pitch content', code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let llm;
  try {
    llm = getLLMClient(config.provider, config.apiKey || '');
  } catch (error) {
    const parsed = parseAPIError(error, config.provider, config.model);
    return new Response(
      JSON.stringify({ error: parsed.message, code: parsed.code, details: parsed.details }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const model = llm(config.model);
  const mode = config.mode || 'vc';

  // ---------------------------------------------------------------------------
  // TOKEN OPTIMIZATION STRATEGY:
  // Aggressively truncate the pitch to save massive amounts of tokens.
  // ---------------------------------------------------------------------------
  const corePitch = pitch?.substring(0, 2000) + (pitch?.length > 2000 ? '\n...[Pitch truncated to save tokens]' : '');
  const briefPitch = pitch?.substring(0, 500) + (pitch?.length > 500 ? '\n...[Pitch truncated]' : '');

  let marketContext = '';

  try {
    if (action === 'personas') {
      if (config.tavilyApiKey) {
        try {
          const tvly = tavily({ apiKey: config.tavilyApiKey });
          const searchResponse = await tvly.search(`Competitors and market risks for: ${briefPitch}`, {
            searchDepth: "basic",
            maxResults: 3
          });
          marketContext = searchResponse.results.map(r => `- ${r.title}: ${r.content}`).join('\n');
        } catch (e) {
          console.error("Tavily search failed:", e);
          // Non-fatal: continue without market context
        }
      }

      const contextPrompt = marketContext 
        ? `The pitch: ${corePitch}\n\nReal-world Market Context (from live web search):\n${marketContext}\n\nFactor this real-world data into your persona selection.`
        : `The pitch: ${corePitch}`;

      const result = await streamObject({
        model,
        abortSignal,
        schema: z.object({ 
          marketAnalysis: z.string().describe("A brief summary of the market based on the real-world context provided."),
          personas: z.array(PersonaSchema).length(3) 
        }),
        system: mode === 'vc'
          ? `You are an expert Chief of Staff and recruiter. Based on the user's business pitch and any provided market context, identify the 3 most critical, distinct, and adversarial expert personas needed to form an "Investment Committee" to brutally stress-test the idea. Provide a name, title, background, and a strict system prompt for each.`
          : `You are an expert Chief of Staff and recruiter. Based on the user's business pitch and any provided market context, identify the 3 most critical, distinct, and adversarial expert personas needed to form a "Board of Directors" to brutally stress-test the idea. Provide a name, title, background, and a strict system prompt for each.`,
        prompt: contextPrompt,
      });

      // Get usage and attach as a custom header
      const response = result.toTextStreamResponse();
      result.usage.then(usage => {
        // Usage is resolved after streaming — logged server-side for now
        console.log(`[tokens:personas] prompt=${usage.inputTokens ?? 0} completion=${usage.outputTokens ?? 0} total=${(usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)}`);
      }).catch(() => {});
      return response;
    }

    if (action === 'critique') {
      if (!persona?.name || !persona?.title) {
        return new Response(
          JSON.stringify({ error: 'Missing persona data for critique', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const result = await streamObject({
        model,
        abortSignal,
        schema: CritiqueSchema,
        system: `You are ${persona.name}, ${persona.title}. Background: ${persona.background}.\n\nYour instructions: ${persona.systemPrompt}\n\nYour task is to brutally and honestly critique the provided business pitch. Do not be polite. Find the fatal flaws.`,
        prompt: `The pitch: ${corePitch}\n\nProvide your critique.`,
      });

      const response = result.toTextStreamResponse();
      result.usage.then(usage => {
        console.log(`[tokens:critique:${persona.name}] prompt=${usage.inputTokens ?? 0} completion=${usage.outputTokens ?? 0} total=${(usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)}`);
      }).catch(() => {});
      return response;
    }

    if (action === 'cross-examine') {
      if (!persona?.name || !critiques?.length) {
        return new Response(
          JSON.stringify({ error: 'Missing persona or critiques for cross-examination', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const otherCritiques = critiques.filter((c: any) => c.personaName !== persona.name);
      const otherCritiquesText = otherCritiques.map((c: any) => `[${c.personaName}]: ${c.critique}`).join('\n\n');

      const result = await streamObject({
        model,
        abortSignal,
        schema: z.object({ personaName: z.string(), rebuttal: z.string() }),
        system: mode === 'vc'
          ? `You are ${persona.name}, ${persona.title}. You must review the critiques from your fellow Investment Committee members and attack them.\nYour task is to aggressively cross-examine their critiques. If they missed something, call it out. If they are wrong, attack their logic. Be brutal but highly analytical.`
          : `You are ${persona.name}, ${persona.title}. You must review the critiques from your fellow board members and attack them.\nYour task is to aggressively cross-examine their critiques. If they missed something, call it out. If they are wrong, attack their logic. Be brutal but highly analytical.`,
        prompt: `Pitch summary: ${briefPitch}\n\nCritiques from others:\n${otherCritiquesText}\n\nProvide your counter-argument / rebuttal.`,
      });

      const response = result.toTextStreamResponse();
      result.usage.then(usage => {
        console.log(`[tokens:cross-examine:${persona.name}] prompt=${usage.inputTokens ?? 0} completion=${usage.outputTokens ?? 0} total=${(usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)}`);
      }).catch(() => {});
      return response;
    }

    if (action === 'synthesis') {
      const { crossExaminations, userRebuttal } = body;

      if (!critiques?.length || !crossExaminations?.length) {
        return new Response(
          JSON.stringify({ error: 'Missing critiques or cross-examinations for synthesis', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const context = `
Pitch Summary: ${briefPitch}

Critiques from the ${mode === 'vc' ? 'Investment Committee' : 'Board'}:
${critiques.map((c: any) => `--- ${c.personaName} ---\nCritique: ${c.critique}\nBiggest Risk: ${c.biggestRisk}`).join('\n\n')}

Cross-Examinations (${mode === 'vc' ? 'IC' : 'Board'} Debate):
${crossExaminations.map((cx: any) => `[${cx.personaName}]: ${cx.rebuttal}`).join('\n\n')}

User's Defense / Rebuttal:
${userRebuttal ? userRebuttal : "The user chose not to defend the pitch."}
      `;

      const result = await streamObject({
        model,
        abortSignal,
        schema: FinalReportSchema,
        system: mode === 'vc'
          ? `You are the Lead Partner of the VC firm. You have heard the business pitch, the brutal critiques, the investment committee's internal debate, and the user's defense. Your job is to synthesize this into a final, actionable Risk & Viability Report. Be highly objective, lean towards the cynical side to protect the firm's capital, and provide actionable pivot recommendations.`
          : `You are the Chairman of the Board. You have heard the business pitch, the brutal critiques, the board's internal debate, and the user's defense. Your job is to synthesize this into a final, actionable Risk & Viability Report. Be highly objective, lean towards the cynical side to protect the founder, and provide actionable pivot recommendations.`,
        prompt: context,
      });

      const response = result.toTextStreamResponse();
      result.usage.then(usage => {
        console.log(`[tokens:synthesis] prompt=${usage.inputTokens ?? 0} completion=${usage.outputTokens ?? 0} total=${(usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)}`);
      }).catch(() => {});
      return response;
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: "${action}"`, code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    // Ignore abort errors (client disconnected, Strict Mode cleanup)
    if (error?.name === 'AbortError' || error?.code === 'ERR_INVALID_STATE' || error?.message?.includes('Controller is already closed')) {
      return new Response(null, { status: 499 }); // Client Closed Request
    }

    console.error('API Route Error:', error);
    const parsed = parseAPIError(error, config.provider, config.model);
    return new Response(
      JSON.stringify({
        error: parsed.message,
        code: parsed.code,
        retryable: parsed.retryable,
        details: parsed.details,
      }),
      { status: parsed.code === 'AUTH_ERROR' ? 401 : parsed.code === 'RATE_LIMIT' ? 429 : 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
