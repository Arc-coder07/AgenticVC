/**
 * UserRebuttalStage — "Take the Stand" defense input.
 *
 * Displayed when session.stage === 'userRebuttal'.
 * The user can type their defense or skip it.
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquareWarning, Loader2 } from 'lucide-react';

interface UserRebuttalStageProps {
  mode: 'vc' | 'board';
  onSubmit: (rebuttalText: string) => Promise<void>;
}

export default function UserRebuttalStage({ mode, onSubmit }: UserRebuttalStageProps) {
  const [rebuttalText, setRebuttalText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (text: string) => {
    setIsSubmitting(true);
    try {
      await onSubmit(text);
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center space-x-3 mb-6">
        <MessageSquareWarning className="w-6 h-6 text-white" />
        <h3 className="font-serif text-2xl text-white">Take the Stand</h3>
      </div>
      <p className="text-slate-400 mb-6 font-light">
        {mode === 'vc'
          ? 'The Investment Committee has torn apart your logic. Before the Lead Partner delivers the final verdict, you have one chance to defend your pitch or clarify assumptions.'
          : 'The Board has torn apart your logic. Before the Chairman delivers the final verdict, you have one chance to defend your pitch or clarify assumptions.'}
      </p>
      <Textarea
        className="min-h-[120px] bg-black/50 border-white/10 text-white rounded-xl p-4 mb-6 focus-visible:ring-white/20"
        placeholder="Defend your position (or leave blank to yield)..."
        value={rebuttalText}
        onChange={(e) => setRebuttalText(e.target.value)}
        disabled={isSubmitting}
      />
      <div className="flex justify-end space-x-4">
        <Button
          variant="ghost"
          className="text-slate-400 hover:text-white"
          onClick={() => handleSubmit('')}
          disabled={isSubmitting}
        >
          Skip Defense
        </Button>
        <Button
          className="bg-white text-black hover:bg-slate-200 px-8 rounded-full font-semibold disabled:opacity-50"
          onClick={() => handleSubmit(rebuttalText)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            mode === 'vc' ? 'Submit to Lead Partner' : 'Submit to Chairman'
          )}
        </Button>
      </div>
    </div>
  );
}
