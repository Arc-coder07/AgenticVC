/**
 * DeliberationStage — Shows critique cards from each persona.
 *
 * Displayed when session.stage === 'deliberating'.
 * Each persona's critique card shows their analysis and identified flaw.
 */

'use client';

import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ShieldAlert } from 'lucide-react';
import type { Persona, Critique } from '@/lib/schemas';
import type { NodeState } from '@/lib/engine/types';

interface DeliberationStageProps {
  personas: Persona[];
  critiques: Critique[];
  nodeStates: Record<string, NodeState>;
  mode: 'vc' | 'board';
}

export default function DeliberationStage({ personas, critiques, nodeStates, mode }: DeliberationStageProps) {
  const critiqueNode = nodeStates['critique'];
  const isLoading = critiqueNode?.status === 'running';

  return (
    <div className="flex-1 flex flex-col space-y-12 animate-in fade-in duration-500 w-full max-w-5xl mx-auto">
      <h2 className="text-2xl font-serif text-white text-center animate-pulse">
        Cross-examining logical structures...
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {personas.map((persona, idx) => {
          const critique = critiques.find((c) => c.personaName === persona.name);

          return (
            <div
              key={idx}
              className="rounded-3xl border border-white/10 bg-black flex flex-col h-full overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              {isLoading && !critique && (
                <div className="absolute top-0 left-0 w-full h-1 bg-white/10 animate-pulse" />
              )}
              <div className="p-6 border-b border-white/5 flex items-center space-x-4">
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarFallback className="bg-white/5 text-white font-serif">
                    {persona.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-serif text-white">{persona.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                    {persona.title}
                  </div>
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col space-y-6">
                <p className="text-sm text-slate-400 leading-relaxed font-light min-h-[60px]">
                  {critique?.critique ? (
                    `"${critique.critique}"`
                  ) : (
                    <span className="animate-pulse">Typing critique...</span>
                  )}
                </p>
                <div className="mt-auto pt-4 border-t border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 flex items-center">
                    <ShieldAlert className="w-3 h-3 mr-2" /> Identified Flaw
                  </div>
                  <p className="text-sm text-white font-medium">
                    {critique?.biggestRisk || (
                      <span className="animate-pulse">Analyzing risks...</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
