'use server';

import { generateObject } from 'ai';
import { getLLMClient, ProviderType } from '@/lib/llm-client';
import { z } from 'zod';
import {
  PersonaSchema,
  CritiqueSchema,
  FinalReportSchema,
  Persona,
  Critique
} from '@/lib/schemas';

export type Config = {
  provider: ProviderType;
  model: string;
  apiKey: string;
};

export async function generatePersonasAction(pitch: string, config: Config): Promise<Persona[]> {
  const llm = getLLMClient(config.provider, config.apiKey);
  const model = llm(config.model);

  const { object } = await generateObject({
    model,
    schema: z.object({
      personas: z.array(PersonaSchema).length(3),
    }),
    system: `You are an expert Chief of Staff and recruiter. Based on the user's business pitch, identify the 3 most critical, distinct, and adversarial expert personas needed to form a "Board of Directors" to brutally stress-test the idea. The personas must be highly specialized to the specific industry of the pitch (e.g., Regulatory Lawyer, Cynical CFO, Gen-Z Growth Hacker). Provide a name, title, background, and a strict system prompt for each.`,
    prompt: `The pitch: ${pitch}`,
  });

  return object.personas;
}

export async function generateCritiquesAction(pitch: string, personas: Persona[], config: Config): Promise<Critique[]> {
  const llm = getLLMClient(config.provider, config.apiKey);
  const model = llm(config.model);

  // Run all 3 critiques in parallel
  const critiquePromises = personas.map(async (persona) => {
    const { object } = await generateObject({
      model,
      schema: CritiqueSchema,
      system: `You are ${persona.name}, ${persona.title}. Background: ${persona.background}.\n\nYour instructions: ${persona.systemPrompt}\n\nYour task is to brutally and honestly critique the provided business pitch. Do not be polite. Find the fatal flaws.`,
      prompt: `The pitch: ${pitch}\n\nProvide your critique.`,
    });
    return object;
  });

  return await Promise.all(critiquePromises);
}

export async function generateFinalReportAction(pitch: string, personas: Persona[], critiques: Critique[], config: Config) {
  const llm = getLLMClient(config.provider, config.apiKey);
  const model = llm(config.model);

  const context = `
Pitch: ${pitch}

Critiques from the Board:
${critiques.map((c) => `--- ${c.personaName} ---\nCritique: ${c.critique}\nBiggest Risk: ${c.biggestRisk}`).join('\n\n')}
  `;

  const { object } = await generateObject({
    model,
    schema: FinalReportSchema,
    system: `You are the Chairman of the Board. You have heard the business pitch and the brutal critiques from your specialized board members. Your job is to synthesize this debate into a final, actionable Risk & Viability Report. Be highly objective, lean towards the cynical side to protect the founder, and provide actionable pivot recommendations.`,
    prompt: context,
  });

  return object;
}
