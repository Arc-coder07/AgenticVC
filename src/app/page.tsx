'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ShieldAlert, CheckCircle, Flame, Layers, Settings2, Swords, MessageSquareWarning, FileUp, Loader2, XCircle, Cpu } from 'lucide-react';

import { ProviderType } from '@/lib/llm-client';
import { Persona, Critique, CrossExamination, FinalReport, PersonaSchema, CritiqueSchema, CrossExaminationSchema, FinalReportSchema } from '@/lib/schemas';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useRef, useMemo } from 'react';
import HowItWorksDiagram from '@/components/ui/HowItWorksDiagram';

// --- STAGE COMPONENTS ---

function PersonasStreamer({ pitch, config, onComplete }: { pitch: string, config: any, onComplete: (personas: Persona[]) => void }) {
  const { object, submit, isLoading } = useObject({
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

function CritiqueStreamerCard({ pitch, config, persona, onComplete }: { pitch: string, config: any, persona: Persona, onComplete: (critique: Critique) => void }) {
  const { object, submit, isLoading } = useObject({
    api: '/api/boardroom',
    schema: CritiqueSchema,
  });

  useEffect(() => {
    submit({ action: 'critique', pitch, config, persona });
  }, [pitch, config, persona, submit]);

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

function CrossExamineStreamerCard({ pitch, config, persona, critiques, onComplete }: { pitch: string, config: any, persona: Persona, critiques: Critique[], onComplete: (cx: CrossExamination) => void }) {
  const mode = config.mode || 'vc';
  const { object, submit, isLoading } = useObject({
    api: '/api/boardroom',
    schema: CrossExaminationSchema,
  });

  useEffect(() => {
    submit({ action: 'cross-examine', pitch, config, persona, critiques });
  }, [pitch, config, persona, critiques, submit]);

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

function SynthesisStreamer({ pitch, config, personas, critiques, crossExaminations, userRebuttal, onReset }: { pitch: string, config: any, personas: Persona[], critiques: Critique[], crossExaminations: CrossExamination[], userRebuttal: string, onReset: () => void }) {
  const mode = config.mode || 'vc';
  const containerRef = useRef<HTMLDivElement>(null);
  const { object, submit, isLoading } = useObject({
    api: '/api/boardroom',
    schema: FinalReportSchema,
  });

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

// --- MAIN PAGE ---

type Status = 'idle' | 'recruiting' | 'deliberating' | 'crossExamining' | 'userRebuttal' | 'compiling' | 'done';

export default function AgenticVCPage() {
  const [pitch, setPitch] = useState('');
  const [provider, setProvider] = useState<ProviderType>('google');
  const [model, setModel] = useState('gemini-2.5-pro');
  const [apiKey, setApiKey] = useState('');
  const [tavilyApiKey, setTavilyApiKey] = useState('');
  const [mode, setMode] = useState<'vc' | 'board'>('vc');

  const [status, setStatus] = useState<Status>('idle');
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [critiques, setCritiques] = useState<Critique[]>([]);
  const [crossExaminations, setCrossExaminations] = useState<CrossExamination[]>([]);
  const [userRebuttalText, setUserRebuttalText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleStart = () => {
    if (!pitch || !apiKey || !model) {
      setErrorMsg('Please provide a pitch, API key, and model.');
      return;
    }
    setErrorMsg('');
    setPersonas([]);
    setCritiques([]);
    setCrossExaminations([]);
    setUserRebuttalText('');
    setStatus('recruiting');
  };

  const handlePersonasComplete = (generatedPersonas: Persona[]) => {
    setPersonas(generatedPersonas);
    setStatus('deliberating');
  };

  const handleCritiqueComplete = (critique: Critique) => {
    setCritiques(prev => {
      const updated = [...prev, critique];
      if (updated.length === 3) {
        setStatus('crossExamining');
      }
      return updated;
    });
  };

  const handleCrossExaminationComplete = (cx: CrossExamination) => {
    setCrossExaminations(prev => {
      const updated = [...prev, cx];
      if (updated.length === 3) {
        setStatus('userRebuttal');
      }
      return updated;
    });
  };

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
        throw new Error('Failed to parse PDF');
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
  };

  // Approximate tokens: 1 token ≈ 4 characters. We count all data actively held or generated in state.
  const estimatedTokens = useMemo(() => {
    const textData = pitch + JSON.stringify(personas) + JSON.stringify(critiques) + JSON.stringify(crossExaminations) + userRebuttalText;
    return Math.floor(textData.length / 4).toLocaleString();
  }, [pitch, personas, critiques, crossExaminations, userRebuttalText]);

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
            <div className="hidden md:flex items-center space-x-2 text-[10px] uppercase tracking-widest text-slate-500 font-medium">
              <Cpu className="w-3 h-3" />
              <span>Tokens: ~{estimatedTokens}</span>
            </div>

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
                <div className="p-4 bg-red-950/30 border border-red-500/20 text-red-400 text-sm rounded-xl text-center">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col items-center space-y-6 pt-4">
                <Button 
                  onClick={handleStart} 
                  className="h-14 px-10 rounded-full bg-white text-black hover:bg-slate-200 font-semibold text-lg transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                  Initiate Sequence
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
                        <Select value={mode} onValueChange={(val) => setMode(val as 'vc' | 'board')}>
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
        )}

        {/* RECRUITING STATE */}
        {status === 'recruiting' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-500 w-full max-w-4xl mx-auto">
            <h2 className="text-2xl font-serif text-white animate-pulse">Initializing neural pathways...</h2>
            <PersonasStreamer pitch={pitch} config={{provider, model, apiKey, tavilyApiKey, mode}} onComplete={handlePersonasComplete} />
          </div>
        )}

        {/* DELIBERATING STATE */}
        {(status === 'deliberating' || status === 'crossExamining' || status === 'userRebuttal') && personas.length === 3 && (
          <div className="flex-1 flex flex-col space-y-12 animate-in fade-in duration-500 w-full max-w-5xl mx-auto">
            <h2 className="text-2xl font-serif text-white text-center animate-pulse">
              {status === 'deliberating' && "Cross-examining logical structures..."}
              {status === 'crossExamining' && (mode === 'vc' ? "Investment Committee Debate..." : "Internal Board Debate...")}
              {status === 'userRebuttal' && (mode === 'vc' ? "The Partners await your response..." : "The Board awaits your response...")}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              {personas.map((persona, idx) => {
                if (status === 'deliberating') {
                  return <CritiqueStreamerCard key={`crit-${idx}`} pitch={pitch} config={{provider, model, apiKey, tavilyApiKey, mode}} persona={persona} onComplete={handleCritiqueComplete} />
                } else {
                  return <CrossExamineStreamerCard key={`cx-${idx}`} pitch={pitch} config={{provider, model, apiKey, tavilyApiKey, mode}} persona={persona} critiques={critiques} onComplete={handleCrossExaminationComplete} />
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
              onReset={() => {
                setStatus('idle');
                setPersonas([]);
                setCritiques([]);
                setCrossExaminations([]);
                setUserRebuttalText('');
              }} 
            />
          </div>
        )}

      </main>
    </div>
  );
}
