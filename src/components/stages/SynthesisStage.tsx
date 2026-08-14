/**
 * SynthesisStage — Final report with viability score, risks, and mitigations.
 *
 * Displayed when session.stage === 'compiling' or 'done'.
 * Shows the full report with PDF export capability.
 */

'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ShieldAlert, Flame, CheckCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Persona, Critique, FinalReport } from '@/lib/schemas';
import type { NodeState } from '@/lib/engine/types';

interface SynthesisStageProps {
  personas: Persona[];
  critiques: Critique[];
  finalReport: FinalReport | null;
  nodeStates: Record<string, NodeState>;
  mode: 'vc' | 'board';
  onReset: () => void;
}

export default function SynthesisStage({
  personas,
  critiques,
  finalReport,
  nodeStates,
  mode,
  onReset,
}: SynthesisStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const synthNode = nodeStates['synthesize'];
  const isLoading = synthNode?.status === 'running';

  const exportPDF = async () => {
    if (!containerRef.current) return;
    const canvas = await html2canvas(containerRef.current, {
      backgroundColor: '#000000',
      scale: 2,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${mode === 'vc' ? 'agenticvc' : 'boardroom'}-premortem.pdf`);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
      {isLoading && (
        <h2 className="text-2xl font-serif text-white animate-pulse text-center mt-8">
          Synthesizing final risk assessment...
        </h2>
      )}

      <div ref={containerRef} className="space-y-6 p-4 -m-4 bg-black">
        {/* Score + Verdict */}
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 rounded-3xl border border-white/10 bg-black p-8 flex flex-col items-center justify-center relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-white/5 animate-pulse" />
            )}
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">
              Index
            </div>
            <div
              className={`text-7xl font-serif tracking-tighter ${
                (finalReport?.viabilityScore ?? 0) >= 75
                  ? 'text-emerald-400'
                  : (finalReport?.viabilityScore ?? 0) >= 50
                    ? 'text-slate-300'
                    : 'text-slate-500'
              }`}
            >
              {finalReport?.viabilityScore || '--'}
            </div>
            <div className="text-xs text-slate-600 mt-2 font-medium">/ 100</div>
          </div>

          <div className="lg:col-span-3 rounded-3xl border border-white/10 bg-black p-8 flex flex-col justify-center relative">
            <h3 className="font-serif text-2xl text-white mb-4">
              {mode === 'vc' ? "Lead Partner's Verdict" : "Chairman's Verdict"}
            </h3>
            <p className="text-slate-400 text-lg leading-relaxed font-light">
              {finalReport?.summary || (
                <span className="animate-pulse">
                  Synthesizing internal debate and user defense...
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Critiques Grid (condensed) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {personas.map((persona, idx) => {
            const critique = critiques.find((c) => c.personaName === persona.name);
            return (
              <div
                key={idx}
                className="rounded-3xl border border-white/10 bg-black flex flex-col h-full overflow-hidden opacity-70"
              >
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
                  <p className="text-sm text-slate-400 leading-relaxed font-light line-clamp-3">
                    &quot;{critique?.critique}&quot;
                  </p>
                  <div className="mt-auto pt-4 border-t border-white/5">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 flex items-center">
                      <ShieldAlert className="w-3 h-3 mr-2" /> Identified Flaw
                    </div>
                    <p className="text-sm text-white font-medium">{critique?.biggestRisk}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Risks + Mitigations */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/10 bg-black p-8">
            <h4 className="font-serif text-lg text-white mb-6 flex items-center">
              <Flame className="w-4 h-4 mr-3 text-slate-400" />
              Critical Red Flags
            </h4>
            <ul className="space-y-4">
              {finalReport?.criticalRisks?.map((risk, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-slate-600 mr-4 mt-1 text-[10px]">■</span>
                  <span className="text-slate-300 text-sm leading-relaxed font-light">
                    {risk}
                  </span>
                </li>
              ))}
              {isLoading && !finalReport?.criticalRisks && (
                <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse" />
              )}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black p-8">
            <h4 className="font-serif text-lg text-white mb-6 flex items-center">
              <CheckCircle className="w-4 h-4 mr-3 text-slate-400" />
              Strategic Mitigations
            </h4>
            <ul className="space-y-4">
              {finalReport?.pivotRecommendations?.map((rec, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-slate-600 mr-4 mt-1 text-[10px]">◆</span>
                  <span className="text-slate-300 text-sm leading-relaxed font-light">
                    {rec}
                  </span>
                </li>
              ))}
              {isLoading && !finalReport?.pivotRecommendations && (
                <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse" />
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isLoading && finalReport && (
        <div className="flex justify-center space-x-6 pt-8 pb-12">
          <Button
            onClick={exportPDF}
            className="bg-white text-black hover:bg-slate-200 rounded-full px-8 h-12 text-xs uppercase tracking-widest font-semibold transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            Export Pre-Mortem PDF
          </Button>
          <Button
            onClick={onReset}
            className="bg-transparent border border-white/20 text-white hover:bg-white hover:text-black rounded-full px-8 h-12 text-xs uppercase tracking-widest font-semibold transition-all"
          >
            Reset Sequence
          </Button>
        </div>
      )}
    </div>
  );
}
