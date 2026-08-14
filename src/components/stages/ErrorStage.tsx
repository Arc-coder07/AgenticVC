/**
 * ErrorStage — Displayed when the pipeline encounters an error.
 *
 * Shows the error message and provides a retry button.
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorStageProps {
  error: string | null;
  nodeStates: Record<string, { nodeId: string; status: string; error?: string; attempts: number }>;
  onReset: () => void;
}

export default function ErrorStage({ error, nodeStates, onReset }: ErrorStageProps) {
  // Find which nodes failed
  const failedNodes = Object.values(nodeStates).filter(
    (ns) => ns.status === 'error',
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500 max-w-lg mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-serif text-white">Pipeline Error</h2>
        <p className="text-slate-400 font-light">
          {error || 'An unexpected error occurred during the pipeline execution.'}
        </p>
      </div>

      {/* Show failed node details */}
      {failedNodes.length > 0 && (
        <div className="w-full space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
            Failed Nodes
          </div>
          {failedNodes.map((node) => (
            <div
              key={node.nodeId}
              className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 text-left"
            >
              <div className="text-sm text-white font-medium mb-1">
                {node.nodeId}
                <span className="text-red-400 ml-2 text-xs">
                  ({node.attempts} attempt{node.attempts !== 1 ? 's' : ''})
                </span>
              </div>
              {node.error && (
                <p className="text-xs text-slate-400 font-light">{node.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={onReset}
        className="bg-white text-black hover:bg-slate-200 rounded-full px-8 h-12 text-xs uppercase tracking-widest font-semibold transition-all"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Try Again
      </Button>
    </div>
  );
}
