/**
 * AgenticVC — Main Page
 *
 * Thin orchestrator component that renders the correct stage based on
 * session state. All logic lives in the useSession hook and individual
 * stage components.
 *
 * This replaces the original 660-line monolithic page.tsx with a clean
 * ~100-line component that delegates everything to specialized modules.
 *
 * Component hierarchy:
 *   page.tsx (this file)
 *   ├── useSession() hook — manages all state
 *   ├── IdleStage — pitch input + config
 *   ├── RecruitingStage — persona generation
 *   ├── DeliberationStage — critiques
 *   ├── CrossExaminationStage — rebuttals
 *   ├── UserRebuttalStage — user defense
 *   ├── SynthesisStage — final report
 *   └── ErrorStage — error display
 */

'use client';

import React from 'react';
import { Layers, XCircle, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';

// Stage components
import IdleStage from '@/components/stages/IdleStage';
import RecruitingStage from '@/components/stages/RecruitingStage';
import DeliberationStage from '@/components/stages/DeliberationStage';
import CrossExaminationStage from '@/components/stages/CrossExaminationStage';
import UserRebuttalStage from '@/components/stages/UserRebuttalStage';
import SynthesisStage from '@/components/stages/SynthesisStage';
import ErrorStage from '@/components/stages/ErrorStage';

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AgenticVCPage() {
  const [session, actions] = useSession();

  // Derive mode for child components (default to 'vc' before session exists)
  const mode = (session.session?.config?.mode ?? 'vc') as 'vc' | 'board';

  // Approximate token count for the header display
  const estimatedTokens = (session as any).estimatedTokens ?? 0;

  return (
    <div className="min-h-screen bg-black text-slate-200 selection:bg-white/20 flex flex-col font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/[0.08] bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-white/80" />
            <span className="font-serif font-bold text-lg tracking-tight text-white">
              AgenticVC
            </span>
          </div>
          <div className="flex items-center space-x-6">
            {/* Token Counter */}
            <div className="hidden md:flex items-center space-x-2 text-[10px] uppercase tracking-widest text-slate-500 font-medium">
              <Cpu className="w-3 h-3" />
              <span>Tokens: ~{estimatedTokens.toLocaleString()}</span>
            </div>

            {/* Cancel Button */}
            {session.stage !== 'idle' && session.stage !== 'done' && session.stage !== 'error' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={actions.cancel}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-[10px] uppercase tracking-widest font-semibold px-3"
              >
                <XCircle className="w-3 h-3 mr-1.5" /> Cancel Sequence
              </Button>
            )}

            {/* Status indicator */}
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 flex items-center space-x-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  session.isConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : session.stage === 'idle' || session.stage === 'done'
                      ? 'bg-slate-600'
                      : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span className="hidden sm:inline">
                {session.isConnected
                  ? 'Connected'
                  : session.stage === 'idle'
                    ? 'System Online'
                    : session.stage === 'done'
                      ? 'Complete'
                      : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content — renders the active stage */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-12 md:py-20 relative z-10">
        {/* IDLE */}
        {session.stage === 'idle' && (
          <IdleStage onStart={actions.startSession} />
        )}

        {/* CREATING (brief transition state) */}
        {session.stage === 'creating' && (
          <div className="flex-1 flex items-center justify-center">
            <h2 className="text-2xl font-serif text-white animate-pulse">
              Preparing session...
            </h2>
          </div>
        )}

        {/* RECRUITING */}
        {session.stage === 'recruiting' && (
          <RecruitingStage personas={session.personas} />
        )}

        {/* DELIBERATING */}
        {session.stage === 'deliberating' && (
          <DeliberationStage
            personas={session.personas}
            critiques={session.critiques}
            nodeStates={session.nodeStates}
            mode={mode}
          />
        )}

        {/* CROSS-EXAMINING */}
        {session.stage === 'crossExamining' && (
          <CrossExaminationStage
            personas={session.personas}
            crossExaminations={session.crossExaminations}
            nodeStates={session.nodeStates}
            mode={mode}
          />
        )}

        {/* USER REBUTTAL */}
        {session.stage === 'userRebuttal' && (
          <div className="flex-1 flex flex-col space-y-12 animate-in fade-in duration-500 w-full max-w-5xl mx-auto">
            <h2 className="text-2xl font-serif text-white text-center">
              {mode === 'vc'
                ? 'The Partners await your response...'
                : 'The Board awaits your response...'}
            </h2>
            {/* Show cross-examination cards (read-only) */}
            <CrossExaminationStage
              personas={session.personas}
              crossExaminations={session.crossExaminations}
              nodeStates={session.nodeStates}
              mode={mode}
            />
            {/* Defense input */}
            <UserRebuttalStage mode={mode} onSubmit={actions.submitDefense} />
          </div>
        )}

        {/* COMPILING / DONE */}
        {(session.stage === 'compiling' || session.stage === 'done') && (
          <SynthesisStage
            personas={session.personas}
            critiques={session.critiques}
            finalReport={session.finalReport}
            nodeStates={session.nodeStates}
            mode={mode}
            onReset={actions.reset}
          />
        )}

        {/* ERROR */}
        {session.stage === 'error' && (
          <ErrorStage
            error={session.error}
            nodeStates={session.nodeStates}
            onReset={actions.reset}
          />
        )}
      </main>
    </div>
  );
}
