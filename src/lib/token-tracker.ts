'use client';

import { useState, useCallback, useMemo } from 'react';

export type StageUsage = {
  stage: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type TokenUsage = {
  stages: StageUsage[];
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
};

export function useTokenTracker() {
  const [stages, setStages] = useState<StageUsage[]>([]);

  const addUsage = useCallback((stage: string, promptTokens: number, completionTokens: number) => {
    setStages(prev => [
      ...prev,
      {
        stage,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    ]);
  }, []);

  const reset = useCallback(() => {
    setStages([]);
  }, []);

  const totals = useMemo<TokenUsage>(() => {
    const totalPromptTokens = stages.reduce((sum, s) => sum + s.promptTokens, 0);
    const totalCompletionTokens = stages.reduce((sum, s) => sum + s.completionTokens, 0);
    return {
      stages,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
    };
  }, [stages]);

  return { ...totals, addUsage, reset };
}

/**
 * Parse token usage from the custom X-Token-Usage response header.
 * The header format is: promptTokens,completionTokens
 */
export function parseTokenHeader(headerValue: string | null): { promptTokens: number; completionTokens: number } | null {
  if (!headerValue) return null;
  const parts = headerValue.split(',');
  if (parts.length !== 2) return null;
  const promptTokens = parseInt(parts[0], 10);
  const completionTokens = parseInt(parts[1], 10);
  if (isNaN(promptTokens) || isNaN(completionTokens)) return null;
  return { promptTokens, completionTokens };
}
