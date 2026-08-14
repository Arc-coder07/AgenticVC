/**
 * IdleStage — Landing page with pitch input and configuration.
 *
 * Displayed when session.stage === 'idle'.
 * Contains the pitch textarea, PDF upload, configuration accordion,
 * and the "Initiate Sequence" button.
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Settings2, FileUp, Loader2 } from 'lucide-react';
import type { ProviderType, SimulationMode, SessionConfig } from '@/lib/engine/types';
import HowItWorksDiagram from '@/components/ui/HowItWorksDiagram';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IdleStageProps {
  onStart: (config: SessionConfig, pitch: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IdleStage({ onStart }: IdleStageProps) {
  const [pitch, setPitch] = useState('');
  const [provider, setProvider] = useState<ProviderType>('google');
  const [model, setModel] = useState('gemini-2.5-pro');
  const [apiKey, setApiKey] = useState('');
  const [tavilyApiKey, setTavilyApiKey] = useState('');
  const [mode, setMode] = useState<SimulationMode>('vc');
  const [errorMsg, setErrorMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (!pitch || !apiKey || !model) {
      setErrorMsg('Please provide a pitch, API key, and model.');
      return;
    }
    setErrorMsg('');
    setIsStarting(true);

    try {
      await onStart(
        { provider, model, apiKey, tavilyApiKey: tavilyApiKey || undefined, mode },
        pitch,
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start session.');
      setIsStarting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrorMsg('Only PDF files are supported.');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to parse PDF');
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPitch((prev) => prev + (prev ? '\n\n' : '') + data.text);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error uploading file.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 animate-in fade-in duration-700 max-w-2xl mx-auto w-full text-center space-y-12">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-serif font-medium text-white tracking-tight">
          Stress-test your logic.
        </h1>
        <p className="text-slate-400 font-light text-lg">
          Input your business pitch or system architecture. Our adversarial AI nodes will tear it apart to find the fatal flaws.
        </p>
      </div>

      <div className="w-full space-y-6 text-left">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-white/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
          <div className="relative">
            <Textarea
              className="relative min-h-[200px] text-base resize-y bg-black/80 border-white/[0.12] text-slate-200 focus-visible:ring-0 focus-visible:border-white/30 p-6 rounded-2xl shadow-2xl leading-relaxed pb-16"
              placeholder="Describe your architecture, product, or business plan..."
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
            />
            <div className="absolute bottom-4 left-4">
              <input
                type="file"
                id="pdf-upload"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <Label
                htmlFor="pdf-upload"
                className={`flex items-center space-x-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                <span>{isUploading ? 'Parsing PDF...' : 'Upload PDF Deck'}</span>
              </Label>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-950/30 border border-red-500/20 text-red-400 text-sm rounded-xl text-center">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col items-center space-y-6 pt-4">
          <Button
            onClick={handleStart}
            disabled={isStarting}
            className="h-14 px-10 rounded-full bg-white text-black hover:bg-slate-200 font-semibold text-lg transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Initializing...
              </>
            ) : (
              'Initiate Sequence'
            )}
          </Button>

          <Accordion className="w-full max-w-sm border-white/10 border rounded-xl bg-black/50 overflow-hidden">
            <AccordionItem value="settings" className="border-b-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 text-sm text-slate-400 data-[state=open]:text-white transition-colors">
                <div className="flex items-center space-x-2">
                  <Settings2 className="w-4 h-4" />
                  <span>API Configuration</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-slate-500 text-[10px] uppercase tracking-widest">Simulation Mode</Label>
                  <Select value={mode} onValueChange={(val) => setMode(val as SimulationMode)}>
                    <SelectTrigger className="bg-black border-white/10 text-slate-300 h-9 rounded-lg">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0A0A0A] border-white/10 text-slate-300">
                      <SelectItem value="vc">Investment Committee (VC)</SelectItem>
                      <SelectItem value="board">Board of Directors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500 text-[10px] uppercase tracking-widest">Provider</Label>
                  <Select value={provider} onValueChange={(val) => { if (val) setProvider(val as ProviderType); }}>
                    <SelectTrigger className="bg-black border-white/10 text-slate-300 h-9 rounded-lg">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0A0A0A] border-white/10 text-slate-300">
                      <SelectItem value="google">Google Gemini</SelectItem>
                      <SelectItem value="groq">Groq</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500 text-[10px] uppercase tracking-widest">Model ID</Label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="bg-black border-white/10 text-slate-300 h-9 rounded-lg focus-visible:ring-white/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500 text-[10px] uppercase tracking-widest">Provider API Key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="••••••••••••"
                    className="bg-black border-white/10 text-slate-300 h-9 rounded-lg focus-visible:ring-white/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500 text-[10px] uppercase tracking-widest">Tavily API Key (Optional)</Label>
                  <Input
                    type="password"
                    value={tavilyApiKey}
                    onChange={(e) => setTavilyApiKey(e.target.value)}
                    placeholder="tvly-••••••••••••"
                    className="bg-black border-white/10 text-slate-300 h-9 rounded-lg focus-visible:ring-white/20"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* How It Works Diagram */}
      <HowItWorksDiagram mode={mode} />
    </div>
  );
}
