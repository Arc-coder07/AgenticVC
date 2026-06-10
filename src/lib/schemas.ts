import { z } from "zod";

export const PersonaSchema = z.object({
  name: z.string().describe("The name of the AI persona"),
  title: z.string().describe("The professional title or role of the persona"),
  background: z.string().describe("A brief background describing their expertise"),
  systemPrompt: z.string().describe("A detailed system prompt dictating how they should behave, their tone, and what they should focus on when critiquing a pitch"),
});

export const CritiqueSchema = z.object({
  personaName: z.string().describe("The name of the persona providing the critique"),
  critique: z.string().describe("A detailed, brutal, and honest critique of the pitch from the perspective of the persona"),
  biggestRisk: z.string().describe("The single biggest risk or flaw identified by this persona"),
});

export const FinalReportSchema = z.object({
  viabilityScore: z.number().min(1).max(100).describe("An overall viability score from 1 to 100"),
  summary: z.string().describe("A high-level summary of the board's overall sentiment"),
  criticalRisks: z.array(z.string()).describe("A list of the most critical risks identified during the debate"),
  pivotRecommendations: z.array(z.string()).describe("Actionable pivot recommendations or mitigations to address the risks"),
});

export const CrossExaminationSchema = z.object({
  personaName: z.string().describe("The name of the persona providing the cross-examination"),
  rebuttal: z.string().describe("A brutal counter-argument attacking the flaws in the other personas' critiques"),
});

export type Persona = z.infer<typeof PersonaSchema>;
export type Critique = z.infer<typeof CritiqueSchema>;
export type FinalReport = z.infer<typeof FinalReportSchema>;
export type CrossExamination = z.infer<typeof CrossExaminationSchema>;
