'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ShieldAlert, CheckCircle, Flame, Layers, Swords, MessageSquareWarning, FileUp, Loader2, XCircle, Cpu, Eye, EyeOff, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react';

import { ProviderType } from '@/lib/llm-client';
import { PROVIDER_CATALOG, getModelsForProvider, getDefaultModel, getModelInfo } from '@/lib/model-catalog';
import { validateApiKeyFormat } from '@/lib/error-utils';
import { useTokenTracker } from '@/lib/token-tracker';
import { Persona, Critique, CrossExamination, FinalReport, PersonaSchema, CritiqueSchema, CrossExaminationSchema, FinalReportSchema } from '@/lib/schemas';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useRef, useMemo, useCallback } from 'react';
import HowItWorksDiagram from '@/components/ui/HowItWorksDiagram';

// --- ERROR BANNER ---

function ErrorBanner({ message, retryable, onRetry, onDismiss }: { message: string; retryable?: boolean; onRetry?: () => void; onDismiss: () => void }) {
  return (
    <div className="w-full p-4 bg-red-950/40 border border-red-500/30 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-red-300 leading-relaxed">{message}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {retryable && onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-3">
            <RefreshCw className="w-3 h-3 mr-1.5" /> Retry
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDismiss} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0">
          <XCircle className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// --- TOKEN DISPLAY ---

function TokenDisplay({ totalPromptTokens, totalCompletionTokens, totalTokens, stages }: { totalPromptTokens: number; totalCompletionTokens: number; totalTokens: number; stages: any[] }) {
  const [expanded, setExpanded] = useState(false);

  if (totalTokens === 0) {
    return (
      <div className="hidden md:flex items-center space-x-2 text-[10px] uppercase tracking-widest text-slate-500 font-medium">
        <Cpu className="w-3 h-3" />
        <span>Tokens: --</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="hidden md:flex items-center space-x-2 text-[10px] uppercase tracking-widest text-emerald-400/80 font-medium hover:text-emerald-300 transition-colors"
      >
        <Cpu className="w-3 h-3" />
        <span>{totalPromptTokens.toLocaleString()} in / {totalCompletionTokens.toLocaleString()} out</span>
        <span className="text-slate-500">({totalTokens.toLocaleString()})</span>
        {stages.length > 0 && (expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>

      {expanded && stages.length > 0 && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[#0A0A0A] border border-white/10 rounded-xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium mb-2">Token Breakdown</div>
          <div className="space-y-1.5">
            {stages.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-400 truncate mr-2">{s.stage}</span>
                <span className="text-slate-300 font-mono tabular-nums">{s.totalTokens.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs font-medium">
            <span className="text-white">Total</span>
            <span className="text-emerald-400 font-mono tabular-nums">{totalTokens.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}


// --- STAGE COMPONENTS ---

function PersonasStreamer({ pitch, config, onComplete, onError }: { pitch: string, config: any, onComplete: (personas: Persona[]) => void, onError: (msg: string) => void }) {
  const { object, submit, isLoading, error } = useObject({
    api: '/api/boardroom',
    schema: z.object({ 
      marketAnalysis: z.string().optional(),
      personas: z.array(PersonaSchema).length(3) 
    }),
  });

  useEffect(() => {
    submit({ action: 'personas', pitch, config });
  }, [pitch, config, submit]);

  useEffect(() => {
    if (error) {
      const msg = error.message || 'Failed to generate personas. Please check your configuration.';
      onError(msg);
    }
  }, [error, onError]);

  useEffect(() => {
    if (!isLoading && object?.personas?.length === 3) {
      onComplete(object.personas as Persona[]);
    }
  }, [isLoading, object, onComplete]);

  const personas = object?.personas || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-8">
      {Array.from({ length: 3 }).map((_, i) => {
        const p = personas[i];
        if (!p) {
          return (
            <div key={i} className="flex flex-col items-center space-y-4 p-6 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse">
              <div className="w-16 h-16 rounded-full bg-white/5" />
              <div className="h-4 w-24 bg-white/5 rounded" />
              <div className="h-3 w-32 bg-white/5 rounded" />
            </div>
          );
        }
        return (
          <div key={i} className="flex flex-col items-center space-y-4 p-6 bg-black border border-white/10 rounded-2xl relative overflow-hidden">
            <Avatar className="h-16 w-16 border border-white/20 bg-black">
              <AvatarFallback className="bg-black text-white font-serif text-2xl">{p.name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <div className="font-serif text-white text-lg">{p.name || 'Recruiting...'}</div>
              <div className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">{p.title || 'Analyzing Role...'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CritiqueStreamerCard({ pitch, config, persona, onComplete, onError }: { pitch: string, config: any, persona: Persona, onComplete: (critique: Critique) => void, onError: (msg: string) => void }) {
  const { object, submit, isLoading, error } = useObject({
    api: '/api/boardroom',
    schema: CritiqueSchema,
  });

  useEffect(() => {
    submit({ action: 'critique', pitch, config, persona });
  }, [pitch, config, persona, submit]);

  useEffect(() => {
    if (error) {
      onError(`Critique from ${persona.name} failed: ${error.message || 'Unknown error'}`);
    }
  }, [error, onError, persona.name]);

  useEffect(() => {
    if (!isLoading && object?.critique && object?.biggestRisk) {
      onComplete({ personaName: persona.name, critique: object.critique, biggestRisk: object.biggestRisk });
    }
  }, [isLoading, object, onComplete, persona.name]);

  return (
    <div className="rounded-3xl border border-white/10 bg-black flex flex-col h-full overflow-hidden relative">
      {isLoading && <div className="absolute top-0 left-0 w-full h-1 bg-white/10 animate-pulse" />}
      <div className="p-6 border-b border-white/5 flex items-center space-x-4">
        <Avatar className="h-10 w-10 border border-white/10">
          <AvatarFallback className="bg-white/5 text-white font-serif">{persona.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-serif text-white">{persona.name}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{persona.title}</div>
        </div>
      </div>
      <div className="p-6 flex-grow flex flex-col space-y-6">
        <p className="text-sm text-slate-400 leading-relaxed font-light min-h-[60px]">
          {object?.critique ? `"${object.critique}"` : <span className="animate-pulse">Typing critique...</span>}
        </p>
        <div className="mt-auto pt-4 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 flex items-center">
            <ShieldAlert className="w-3 h-3 mr-2" /> Identified Flaw
          </div>
          <p className="text-sm text-white font-medium">
            {object?.biggestRisk || <span className="animate-pulse">Analyzing risks...</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function CrossExamineStreamerCard({ pitch, config, persona, critiques, onComplete, onError }: { pitch: string, config: any, persona: Persona, critiques: Critique[], onComplete: (cx: CrossExamination) => void, onError: (msg: string) => void }) {
  const mode = config.mode || 'vc';
  const { object, submit, isLoading, error } = useObject({
    api: '/api/boardroom',
    schema: CrossExaminationSchema,
  });

  useEffect(() => {
    submit({ action: 'cross-examine', pitch, config, persona, critiques });
  }, [pitch, config, persona, critiques, submit]);

  useEffect(() => {
    if (error) {
      onError(`Cross-examination from ${persona.name} failed: ${error.message || 'Unknown error'}`);
    }
  }, [error, onError, persona.name]);

  useEffect(() => {
    if (!isLoading && object?.rebuttal) {
      onComplete({ personaName: persona.name, rebuttal: object.rebuttal });
    }
  }, [isLoading, object, onComplete, persona.name]);

  return (
    <div className="rounded-3xl border border-red-500/20 bg-black flex flex-col h-full overflow-hidden relative shadow-[0_0_30px_rgba(239,68,68,0.05)]">
      {isLoading && <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50 animate-pulse" />}
      <div className="p-6 border-b border-white/5 flex items-center space-x-4">
        <Avatar className="h-10 w-10 border border-red-500/20 bg-red-500/5">
          <AvatarFallback className="text-red-400 font-serif">{persona.name.charAt(0)}</AvatarFallback>
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
          {object?.rebuttal ? `"${object.rebuttal}"` : <span className="animate-pulse text-red-400/50">Cross-examining {mode === 'vc' ? 'VC partners' : 'board members'}...</span>}
        </p>
      </div>
    </div>
  );
}

function SynthesisStreamer({ pitch, config, personas, critiques, crossExaminations, userRebuttal, onReset, onError }: { pitch: string, config: any, personas: Persona[], critiques: Critique[], crossExaminations: CrossExamination[], userRebuttal: string, onReset: () => void, onError: (msg: string) => void }) {
  const mode = config.mode || 'vc';
  const containerRef = useRef<HTMLDivElement>(null);
  const { object, submit, isLoading, error } = useObject({
    api: '/api/boardroom',
    schema: FinalReportSchema,
  });

  useEffect(() => {
    if (error) {
      onError(`Synthesis failed: ${error.message || 'Unknown error'}`);
    }
  }, [error, onError]);

  const exportPDF = async () => {
    if (!containerRef.current) return;
    const canvas = await html2canvas(containerRef.current, { backgroundColor: '#000000', scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${mode === 'vc' ? 'agenticvc' : 'boardroom'}-premortem.pdf`);
  };

  useEffect(() => {
    submit({ action: 'synthesis', pitch, config, personas, critiques, crossExaminations, userRebuttal });
  }, [pitch, config, personas, critiques, crossExaminations, userRebuttal, submit]);

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
      <div ref={containerRef} className="space-y-6 p-4 -m-4 bg-black">
        <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 rounded-3xl border border-white/10 bg-black p-8 flex flex-col items-center justify-center relative overflow-hidden">
          {isLoading && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">Index</div>
          <div className={`text-7xl font-serif tracking-tighter ${
            (object?.viabilityScore ?? 0) >= 75 ? 'text-emerald-400' : 
            (object?.viabilityScore ?? 0) >= 50 ? 'text-slate-300' : 'text-slate-500'
          }`}>
            {object?.viabilityScore || '--'}
          </div>
          <div className="text-xs text-slate-600 mt-2 font-medium">/ 100</div>
        </div>

        <div className="lg:col-span-3 rounded-3xl border border-white/10 bg-black p-8 flex flex-col justify-center relative">
          <h3 className="font-serif text-2xl text-white mb-4">{mode === 'vc' ? "Lead Partner's Verdict" : "Chairman's Verdict"}</h3>
          <p className="text-slate-400 text-lg leading-relaxed font-light">
            {object?.summary || <span className="animate-pulse">Synthesizing internal debate and user defense...</span>}
          </p>
        </div>
      </div>

      {/* Critiques Grid - Simplified for dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {personas.map((persona, idx) => {
          const critique = critiques.find(c => c.personaName === persona.name);
          return (
            <div key={idx} className="rounded-3xl border border-white/10 bg-black flex flex-col h-full overflow-hidden opacity-70">
              <div className="p-6 border-b border-white/5 flex items-center space-x-4">
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarFallback className="bg-white/5 text-white font-serif">{persona.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-serif text-white">{persona.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{persona.title}</div>
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col space-y-6">
                <p className="text-sm text-slate-400 leading-relaxed font-light line-clamp-3">"{critique?.critique}"</p>
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

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-white/10 bg-black p-8">
          <h4 className="font-serif text-lg text-white mb-6 flex items-center">
            <Flame className="w-4 h-4 mr-3 text-slate-400" />
            Critical Red Flags
          </h4>
          <ul className="space-y-4">
            {object?.criticalRisks?.map((risk, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-slate-600 mr-4 mt-1 text-[10px]">■</span>
                <span className="text-slate-300 text-sm leading-relaxed font-light">{risk}</span>
              </li>
            ))}
            {isLoading && !object?.criticalRisks && <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse" />}
          </ul>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black p-8">
          <h4 className="font-serif text-lg text-white mb-6 flex items-center">
            <CheckCircle className="w-4 h-4 mr-3 text-slate-400" />
            Strategic Mitigations
          </h4>
          <ul className="space-y-4">
            {object?.pivotRecommendations?.map((rec, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-slate-600 mr-4 mt-1 text-[10px]">◆</span>
                <span className="text-slate-300 text-sm leading-relaxed font-light">{rec}</span>
              </li>
            ))}
            {isLoading && !object?.pivotRecommendations && <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse" />}
          </ul>
        </div>
      </div>
      </div>

      {!isLoading && (
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

// --- COMMAND CENTER ---

function CommandCenter({ 
  provider, setProvider, 
  model, setModel,
  apiKey, setApiKey, 
  tavilyApiKey, setTavilyApiKey,
  mode, setMode,
  ollamaStatus
}: {
  provider: ProviderType; setProvider: (p: ProviderType) => void;
  model: string; setModel: (m: string) => void;
  apiKey: string; setApiKey: (k: string) => void;
  tavilyApiKey: string; setTavilyApiKey: (k: string) => void;
  mode: 'vc' | 'board'; setMode: (m: 'vc' | 'board') => void;
  ollamaStatus: 'checking' | 'online' | 'offline';
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [showTavily, setShowTavily] = useState(false);

  const providerInfo = PROVIDER_CATALOG.find(p => p.id === provider);
  const models = getModelsForProvider(provider);
  const currentModelInfo = getModelInfo(provider, model);
  const keyValidation = validateApiKeyFormat(provider, apiKey);

  // Custom model state
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [customModelId, setCustomModelId] = useState('');

  const effectiveModel = useCustomModel ? customModelId : model;

  return (
    <div className="w-full space-y-5">
      {/* Mode Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex bg-white/[0.04] border border-white/10 rounded-full p-1">
          <button
            onClick={() => setMode('vc')}
            className={`px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-300 ${
              mode === 'vc' 
                ? 'bg-white text-black shadow-lg' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            VC Mode
          </button>
          <button
            onClick={() => setMode('board')}
            className={`px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-300 ${
              mode === 'board' 
                ? 'bg-white text-black shadow-lg' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Board Mode
          </button>
        </div>
      </div>

      {/* Provider Cards */}
      <div>
        <Label className="text-slate-500 text-[10px] uppercase tracking-widest block mb-3">Provider</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROVIDER_CATALOG.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setProvider(p.id);
                setModel(getDefaultModel(p.id));
                setUseCustomModel(false);
                setCustomModelId('');
              }}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 group ${
                provider === p.id
                  ? 'border-white/30 bg-white/[0.06] shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
              }`}
            >
              <span className="text-2xl">{p.icon}</span>
              <span className={`text-xs font-semibold tracking-wide ${provider === p.id ? 'text-white' : 'text-slate-400'}`}>
                {p.label}
              </span>
              {p.id === 'ollama' && (
                <span className={`absolute top-2 right-2 flex items-center gap-1 text-[9px] font-medium ${
                  ollamaStatus === 'online' ? 'text-emerald-400' : ollamaStatus === 'offline' ? 'text-red-400' : 'text-slate-500'
                }`}>
                  {ollamaStatus === 'online' ? <Wifi className="w-2.5 h-2.5" /> : ollamaStatus === 'offline' ? <WifiOff className="w-2.5 h-2.5" /> : <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                </span>
              )}
              {!p.requiresApiKey && (
                <span className="text-[9px] text-emerald-400/70 font-medium">No key needed</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Model Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-500 text-[10px] uppercase tracking-widest">Model</Label>
          {!useCustomModel ? (
            <Select value={model} onValueChange={(val) => {
              if (!val) return;
              if (val === '__custom__') {
                setUseCustomModel(true);
              } else {
                setModel(val);
              }
            }}>
              <SelectTrigger className="bg-black border-white/10 text-slate-300 h-10 rounded-xl">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent className="bg-[#0A0A0A] border-white/10 text-slate-300 max-h-[300px]">
                {models.map(m => (
                  <SelectItem key={m.id} value={m.id} className="flex items-center">
                    <div className="flex items-center gap-2 w-full">
                      <span className={m.deprecated ? 'text-slate-500 line-through' : ''}>{m.label}</span>
                      {m.deprecated && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium ml-1">
                          ⚠ Deprecated
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="__custom__" className="border-t border-white/5">
                  <span className="text-slate-400 italic">Custom model ID...</span>
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex gap-2">
              <Input
                value={customModelId}
                onChange={(e) => {
                  setCustomModelId(e.target.value);
                  setModel(e.target.value);
                }}
                placeholder="e.g. my-custom-model"
                className="bg-black border-white/10 text-slate-300 h-10 rounded-xl flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUseCustomModel(false);
                  setModel(getDefaultModel(provider));
                }}
                className="text-slate-400 hover:text-white h-10 px-3"
              >
                Cancel
              </Button>
            </div>
          )}
          {/* Deprecation warning */}
          {currentModelInfo?.deprecated && !useCustomModel && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-950/30 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-300 leading-relaxed">
                {currentModelInfo.deprecationNote || 'This model is deprecated. Consider switching to a newer version.'}
              </p>
            </div>
          )}
          {/* Model description */}
          {currentModelInfo && !currentModelInfo.deprecated && !useCustomModel && (
            <p className="text-[10px] text-slate-500">{currentModelInfo.description}{currentModelInfo.context ? ` · ${(currentModelInfo.context / 1000).toLocaleString()}K context` : ''}</p>
          )}
        </div>

        {/* API Key */}
        <div className="space-y-2">
          {providerInfo?.requiresApiKey ? (
            <>
              <Label className="text-slate-500 text-[10px] uppercase tracking-widest">API Key</Label>
              <div className="relative">
                <Input 
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder={providerInfo?.apiKeyPlaceholder || '••••••••••••'}
                  className={`bg-black border-white/10 text-slate-300 h-10 rounded-xl pr-20 ${
                    apiKey && !keyValidation.valid ? 'border-amber-500/40' : apiKey && keyValidation.valid ? 'border-emerald-500/30' : ''
                  }`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {apiKey && (
                    <span className={`w-2 h-2 rounded-full ${keyValidation.valid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  )}
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="p-1.5 text-slate-500 hover:text-white transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {apiKey && !keyValidation.valid && keyValidation.hint && (
                <p className="text-[10px] text-amber-400">{keyValidation.hint}</p>
              )}
            </>
          ) : (
            <div className="flex flex-col justify-center h-full">
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                ollamaStatus === 'online' 
                  ? 'border-emerald-500/20 bg-emerald-950/20' 
                  : ollamaStatus === 'offline'
                  ? 'border-red-500/20 bg-red-950/20'
                  : 'border-white/5 bg-white/[0.02]'
              }`}>
                {ollamaStatus === 'online' ? (
                  <>
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs text-emerald-300 font-medium">Ollama Connected</p>
                      <p className="text-[10px] text-emerald-400/60">localhost:11434</p>
                    </div>
                  </>
                ) : ollamaStatus === 'offline' ? (
                  <>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <div>
                      <p className="text-xs text-red-300 font-medium">Ollama Not Running</p>
                      <p className="text-[10px] text-red-400/60">Run: ollama serve</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    <p className="text-xs text-slate-400">Checking connection...</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tavily (Optional, collapsible) */}
      <div>
        <button 
          onClick={() => setShowTavily(!showTavily)}
          className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors font-medium"
        >
          {showTavily ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Tavily Web Search (Optional)
        </button>
        {showTavily && (
          <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="relative">
              <Input 
                type={showTavilyKey ? 'text' : 'password'}
                value={tavilyApiKey} 
                onChange={(e) => setTavilyApiKey(e.target.value)} 
                placeholder="tvly-••••••••••••"
                className="bg-black border-white/10 text-slate-300 h-9 rounded-xl pr-10"
              />
              <button
                onClick={() => setShowTavilyKey(!showTavilyKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white transition-colors"
              >
                {showTavilyKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Enables real-time market intelligence during persona generation</p>
          </div>
        )}
      </div>
    </div>
  );
}


// --- MAIN PAGE ---

type Status = 'idle' | 'recruiting' | 'deliberating' | 'crossExamining' | 'userRebuttal' | 'compiling' | 'done';

export default function AgenticVCPage() {
  const [pitch, setPitch] = useState('');
  const [provider, setProvider] = useState<ProviderType>('google');
  const [model, setModel] = useState('gemini-3.1-pro-preview');
  const [apiKey, setApiKey] = useState('');
  const [tavilyApiKey, setTavilyApiKey] = useState('');
  const [mode, setMode] = useState<'vc' | 'board'>('vc');

  const [status, setStatus] = useState<Status>('idle');
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [critiques, setCritiques] = useState<Critique[]>([]);
  const [crossExaminations, setCrossExaminations] = useState<CrossExamination[]>([]);
  const [userRebuttalText, setUserRebuttalText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);

  // Token tracking
  const tokenTracker = useTokenTracker();

  // Check Ollama connectivity
  useEffect(() => {
    if (provider !== 'ollama') return;
    setOllamaStatus('checking');
    
    const checkOllama = async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setOllamaStatus('online');
        } else {
          setOllamaStatus('offline');
        }
      } catch {
        setOllamaStatus('offline');
      }
    };

    checkOllama();
    const interval = setInterval(checkOllama, 15000); // Re-check every 15s
    return () => clearInterval(interval);
  }, [provider]);

  useEffect(() => {
    if (status === 'recruiting') {
      const interval = setInterval(() => {
        setLoadingStepIdx(prev => Math.min(prev + 1, 4));
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setLoadingStepIdx(0);
    }
  }, [status]);

  const handleError = useCallback((msg: string) => {
    // Try to parse JSON error from streaming response
    let errorMessage = msg;
    let retryable = true;
    
    try {
      // The useObject error often wraps the JSON error
      const jsonMatch = msg.match(/\{.*"error".*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        errorMessage = parsed.error || msg;
        retryable = parsed.retryable !== false;
      }
    } catch {
      // Use the raw message
    }

    setErrorMsg(errorMessage);
    setErrorRetryable(retryable);
    setStatus('idle');
  }, []);

  const handleStart = () => {
    // Validate pitch
    if (!pitch.trim()) {
      setErrorMsg('Please provide a pitch or upload a PDF deck.');
      setErrorRetryable(false);
      return;
    }

    // Validate API key (unless Ollama)
    if (provider !== 'ollama') {
      if (!apiKey.trim()) {
        setErrorMsg(`API key is required for ${PROVIDER_CATALOG.find(p => p.id === provider)?.label || provider}.`);
        setErrorRetryable(false);
        return;
      }
      const validation = validateApiKeyFormat(provider, apiKey);
      if (!validation.valid) {
        setErrorMsg(validation.hint || 'Invalid API key format.');
        setErrorRetryable(false);
        return;
      }
    }

    // Validate Ollama connection
    if (provider === 'ollama' && ollamaStatus === 'offline') {
      setErrorMsg('Ollama is not running. Start it with: ollama serve');
      setErrorRetryable(true);
      return;
    }

    // Validate model
    if (!model.trim()) {
      setErrorMsg('Please select a model.');
      setErrorRetryable(false);
      return;
    }

    // Check for deprecated model
    const modelInfo = getModelInfo(provider, model);
    if (modelInfo?.deprecated) {
      // Allow but warn — don't block
      console.warn(`Using deprecated model: ${model}`);
    }

    setErrorMsg('');
    setErrorRetryable(false);
    setPersonas([]);
    setCritiques([]);
    setCrossExaminations([]);
    setUserRebuttalText('');
    tokenTracker.reset();
    setStatus('recruiting');
  };

  const handlePersonasComplete = useCallback((generatedPersonas: Persona[]) => {
    setPersonas(generatedPersonas);
    tokenTracker.addUsage('Persona Generation', 0, 0); // Placeholder — real counts logged server-side
    setStatus('deliberating');
  }, [tokenTracker]);

  const handleCritiqueComplete = useCallback((critique: Critique) => {
    setCritiques(prev => {
      const updated = [...prev, critique];
      if (updated.length === 3) {
        setStatus('crossExamining');
      }
      return updated;
    });
  }, []);

  const handleCrossExaminationComplete = useCallback((cx: CrossExamination) => {
    setCrossExaminations(prev => {
      const updated = [...prev, cx];
      if (updated.length === 3) {
        setStatus('userRebuttal');
      }
      return updated;
    });
  }, []);

  const submitDefense = () => {
    setStatus('compiling');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrorMsg('Only PDF files are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('PDF file must be under 10 MB.');
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to parse PDF (${res.status})`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setPitch(prev => prev + (prev ? '\n\n' : '') + data.text);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error uploading file.');
    } finally {
      setIsUploading(false);
      // Reset input value to allow uploading same file again
      e.target.value = '';
    }
  };

  const handleCancel = () => {
    setStatus('idle');
    setPersonas([]);
    setCritiques([]);
    setCrossExaminations([]);
    setUserRebuttalText('');
    setErrorMsg('');
  };

  const handleReset = useCallback(() => {
    setStatus('idle');
    setPersonas([]);
    setCritiques([]);
    setCrossExaminations([]);
    setUserRebuttalText('');
    setErrorMsg('');
    tokenTracker.reset();
  }, [tokenTracker]);

  return (
    <div className="min-h-screen bg-black text-slate-200 selection:bg-white/20 flex flex-col font-sans relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

      <header className="border-b border-white/[0.08] bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-white/80" />
            <span className="font-serif font-bold text-lg tracking-tight text-white">AgenticVC</span>
          </div>
          <div className="flex items-center space-x-6">
            {/* Token Counter */}
            <TokenDisplay {...tokenTracker} />

            {/* Cancel Button */}
            {status !== 'idle' && status !== 'done' && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCancel}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-[10px] uppercase tracking-widest font-semibold px-3"
              >
                <XCircle className="w-3 h-3 mr-1.5" /> Cancel Sequence
              </Button>
            )}

            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">System Online</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-12 md:py-20 relative z-10">
        
        {/* IDLE STATE */}
        {status === 'idle' && (
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
                <div className="absolute -inset-0.5 bg-white/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
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
                <ErrorBanner 
                  message={errorMsg} 
                  retryable={errorRetryable}
                  onRetry={errorRetryable ? handleStart : undefined}
                  onDismiss={() => { setErrorMsg(''); setErrorRetryable(false); }} 
                />
              )}

              {/* Command Center */}
              <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-6 space-y-1">
                <CommandCenter
                  provider={provider} setProvider={setProvider}
                  model={model} setModel={setModel}
                  apiKey={apiKey} setApiKey={setApiKey}
                  tavilyApiKey={tavilyApiKey} setTavilyApiKey={setTavilyApiKey}
                  mode={mode} setMode={setMode}
                  ollamaStatus={ollamaStatus}
                />
              </div>

              <div className="flex flex-col items-center space-y-4 pt-2">
                <Button 
                  onClick={handleStart} 
                  className="h-14 px-10 rounded-full bg-white text-black hover:bg-slate-200 font-semibold text-lg transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                  Initiate Sequence
                </Button>
              </div>
            </div>
            
            {/* How It Works Diagram */}
            <HowItWorksDiagram mode={mode} />
          </div>
        )}

        {/* RECRUITING STATE */}
        {status === 'recruiting' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-500 w-full max-w-4xl mx-auto">
            {errorMsg && (
              <ErrorBanner 
                message={errorMsg} 
                retryable={errorRetryable}
                onRetry={() => { setErrorMsg(''); handleCancel(); }}
                onDismiss={() => { setErrorMsg(''); handleCancel(); }} 
              />
            )}
            <h2 className="text-2xl font-serif text-white animate-pulse">
              {[
                "Parsing business architecture...",
                "Analyzing market context...",
                "Querying knowledge graph...",
                "Identifying adversarial vectors...",
                "Assembling committee personas..."
              ][loadingStepIdx]}
            </h2>
            <PersonasStreamer pitch={pitch} config={{provider, model, apiKey, tavilyApiKey, mode}} onComplete={handlePersonasComplete} onError={handleError} />
          </div>
        )}

        {/* DELIBERATING STATE */}
        {(status === 'deliberating' || status === 'crossExamining' || status === 'userRebuttal') && personas.length === 3 && (
          <div className="flex-1 flex flex-col space-y-12 animate-in fade-in duration-500 w-full max-w-5xl mx-auto">
            {errorMsg && (
              <ErrorBanner 
                message={errorMsg} 
                retryable={errorRetryable}
                onRetry={() => { setErrorMsg(''); setErrorRetryable(false); }}
                onDismiss={() => { setErrorMsg(''); setErrorRetryable(false); }} 
              />
            )}
            <h2 className="text-2xl font-serif text-white text-center animate-pulse">
              {status === 'deliberating' && "Cross-examining logical structures..."}
              {status === 'crossExamining' && (mode === 'vc' ? "Investment Committee Debate..." : "Internal Board Debate...")}
              {status === 'userRebuttal' && (mode === 'vc' ? "The Partners await your response..." : "The Board awaits your response...")}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              {personas.map((persona, idx) => {
                if (status === 'deliberating') {
                  return <CritiqueStreamerCard key={`crit-${idx}`} pitch={pitch} config={{provider, model, apiKey, tavilyApiKey, mode}} persona={persona} onComplete={handleCritiqueComplete} onError={handleError} />;
                } else {
                  return <CrossExamineStreamerCard key={`cx-${idx}`} pitch={pitch} config={{provider, model, apiKey, tavilyApiKey, mode}} persona={persona} critiques={critiques} onComplete={handleCrossExaminationComplete} onError={handleError} />;
                }
              })}
            </div>

            {/* USER REBUTTAL INTERACTIVE UI */}
            {status === 'userRebuttal' && (
              <div className="w-full max-w-3xl mx-auto mt-12 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center space-x-3 mb-6">
                  <MessageSquareWarning className="w-6 h-6 text-white" />
                  <h3 className="font-serif text-2xl text-white">Take the Stand</h3>
                </div>
                <p className="text-slate-400 mb-6 font-light">
                  {mode === 'vc' 
                    ? "The Investment Committee has torn apart your logic. Before the Lead Partner delivers the final verdict, you have one chance to defend your pitch or clarify assumptions."
                    : "The Board has torn apart your logic. Before the Chairman delivers the final verdict, you have one chance to defend your pitch or clarify assumptions."}
                </p>
                <Textarea 
                  className="min-h-[120px] bg-black/50 border-white/10 text-white rounded-xl p-4 mb-6 focus-visible:ring-white/20"
                  placeholder="Defend your position (or leave blank to yield)..."
                  value={userRebuttalText}
                  onChange={(e) => setUserRebuttalText(e.target.value)}
                />
                <div className="flex justify-end space-x-4">
                  <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={submitDefense}>
                    Skip Defense
                  </Button>
                  <Button className="bg-white text-black hover:bg-slate-200 px-8 rounded-full font-semibold" onClick={submitDefense}>
                    {mode === 'vc' ? "Submit to Lead Partner" : "Submit to Chairman"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* COMPILING & DONE STATE */}
        {(status === 'compiling' || status === 'done') && (
          <div className="flex-1 flex flex-col space-y-12 animate-in fade-in duration-500 w-full">
            {errorMsg && (
              <ErrorBanner 
                message={errorMsg} 
                retryable={errorRetryable}
                onRetry={() => { setErrorMsg(''); setErrorRetryable(false); }}
                onDismiss={() => { setErrorMsg(''); setErrorRetryable(false); }} 
              />
            )}
            {status === 'compiling' && (
              <h2 className="text-2xl font-serif text-white animate-pulse text-center mt-8">Synthesizing final risk assessment...</h2>
            )}
            <SynthesisStreamer 
              pitch={pitch} 
              config={{provider, model, apiKey, tavilyApiKey, mode}} 
              personas={personas} 
              critiques={critiques} 
              crossExaminations={crossExaminations}
              userRebuttal={userRebuttalText}
              onReset={handleReset}
              onError={handleError}
            />
          </div>
        )}

      </main>
    </div>
  );
}
