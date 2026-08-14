/**
 * CrossExaminationStage — Shows personas arguing with each other.
 *
 * Displayed when session.stage === 'crossExamining'.
 * Each card has a red-tinted border to indicate the adversarial nature.
 */

'use client';

import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Swords } from 'lucide-react';
import type { Persona, CrossExamination } from '@/lib/schemas';
import type { NodeState } from '@/lib/engine/types';

interface CrossExaminationStageProps {
  personas: Persona[];
  crossExaminations: CrossExamination[];
  nodeStates: Record<string, NodeState>;
  mode: 'vc' | 'board';
}

export default function CrossExaminationStage({
  personas,
  crossExaminations,
  nodeStates,
  mode,
}: CrossExaminationStageProps) {
  const crossExamNode = nodeStates['cross-examine'];
  const isLoading = crossExamNode?.status === 'running';

  return (
    <div className="flex-1 flex flex-col space-y-12 animate-in fade-in duration-500 w-full max-w-5xl mx-auto">
      <h2 className="text-2xl font-serif text-white text-center animate-pulse">
        {mode === 'vc' ? 'Investment Committee Debate...' : 'Internal Board Debate...'}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {personas.map((persona, idx) => {
          const cx = crossExaminations.find((c) => c.personaName === persona.name);

          return (
            <div
              key={idx}
              className="rounded-3xl border border-red-500/20 bg-black flex flex-col h-full overflow-hidden relative shadow-[0_0_30px_rgba(239,68,68,0.05)] animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              {isLoading && !cx && (
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50 animate-pulse" />
              )}
              <div className="p-6 border-b border-white/5 flex items-center space-x-4">
                <Avatar className="h-10 w-10 border border-red-500/20 bg-red-500/5">
                  <AvatarFallback className="text-red-400 font-serif">
                    {persona.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-serif text-white">{persona.name}</div>
                  <div className="text-[10px] text-red-400 uppercase tracking-widest font-medium flex items-center">
                    <Swords className="w-3 h-3 mr-1" /> Rebuttal
                  </div>
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <p className="text-sm text-slate-300 leading-relaxed font-light min-h-[60px]">
                  {cx?.rebuttal ? (
                    `"${cx.rebuttal}"`
                  ) : (
                    <span className="animate-pulse text-red-400/50">
                      Cross-examining {mode === 'vc' ? 'VC partners' : 'board members'}...
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
