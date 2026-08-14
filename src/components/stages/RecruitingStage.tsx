/**
 * RecruitingStage — Shows persona cards streaming in as they're generated.
 *
 * Displayed when session.stage === 'recruiting'.
 * Shows 3 persona slots: populated ones show the persona data,
 * empty ones show skeleton loading states.
 */

'use client';

import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Persona } from '@/lib/schemas';

interface RecruitingStageProps {
  personas: Persona[];
}

export default function RecruitingStage({ personas }: RecruitingStageProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-500 w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-serif text-white animate-pulse">
        Initializing neural pathways...
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-8">
        {Array.from({ length: 3 }).map((_, i) => {
          const p = personas[i];
          if (!p) {
            return (
              <div
                key={i}
                className="flex flex-col items-center space-y-4 p-6 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse"
              >
                <div className="w-16 h-16 rounded-full bg-white/5" />
                <div className="h-4 w-24 bg-white/5 rounded" />
                <div className="h-3 w-32 bg-white/5 rounded" />
              </div>
            );
          }
          return (
            <div
              key={i}
              className="flex flex-col items-center space-y-4 p-6 bg-black border border-white/10 rounded-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <Avatar className="h-16 w-16 border border-white/20 bg-black">
                <AvatarFallback className="bg-black text-white font-serif text-2xl">
                  {p.name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <div className="font-serif text-white text-lg">{p.name || 'Recruiting...'}</div>
                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">
                  {p.title || 'Analyzing Role...'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
