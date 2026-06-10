'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Layers, BrainCircuit, Users, FileOutput, ArrowRight } from 'lucide-react';

export default function HowItWorksDiagram() {
  return (
    <div className="w-full max-w-4xl mx-auto mt-32 mb-20 px-4">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-serif text-white tracking-tight mb-4">How the Synthetic Boardroom Works</h2>
        <p className="text-slate-400 font-light">A multi-agent autonomous debate system.</p>
      </div>

      <div className="relative flex flex-col items-center">
        {/* Step 1: Input */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-16 relative z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Layers className="text-white/80 w-8 h-8" />
          </div>
          <div className="text-white font-medium text-lg">1. The Pitch</div>
          <div className="text-slate-500 text-sm max-w-[200px] text-center mt-2 font-light">You submit your business plan or architecture logic.</div>
        </motion.div>

        {/* Step 2: Orchestrator */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center mb-16 relative z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-4 relative">
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-md"
            />
            <BrainCircuit className="text-indigo-400 w-8 h-8 relative z-10" />
          </div>
          <div className="text-white font-medium text-lg">2. The Orchestrator</div>
          <div className="text-slate-500 text-sm max-w-[200px] text-center mt-2 font-light">An AI agent analyzes the market context and recruits 3 specialized expert personas.</div>
        </motion.div>

        {/* Connecting Line 1 */}
        <div className="absolute top-16 bottom-0 left-1/2 w-[1px] bg-gradient-to-b from-white/10 via-white/10 to-transparent -translate-x-1/2 z-0 hidden md:block"></div>

        {/* Step 3: Debate Loop */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full bg-black border border-white/10 rounded-3xl p-8 mb-16 relative z-10"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-b from-white/5 to-transparent rounded-3xl blur pointer-events-none" />
          <div className="relative text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 mb-4">
              <Users className="text-rose-400 w-5 h-5" />
            </div>
            <div className="text-white font-medium text-xl">3. The Cross-Examination Loop</div>
            <div className="text-slate-400 text-sm mt-2 font-light max-w-md mx-auto">The personas brutally critique the pitch, then argue with each other to expose hidden logical flaws.</div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 relative">
            {/* Animated arrows between personas */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
              className="absolute inset-0 border border-dashed border-white/10 rounded-full w-[300px] h-[300px] -ml-[150px] left-1/2 top-1/2 -mt-[150px] pointer-events-none hidden md:block opacity-50"
            />
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 3, delay: i * 0.5 }}
                className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative z-10 backdrop-blur-md"
              >
                <span className="font-serif text-white/50 text-2xl">P{i}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Step 4: Final Report */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-col items-center relative z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
            <FileOutput className="text-emerald-400 w-8 h-8" />
          </div>
          <div className="text-white font-medium text-lg">4. The Chairman's Report</div>
          <div className="text-slate-500 text-sm max-w-[250px] text-center mt-2 font-light">The Chairman synthesizes the debate and your defense into an actionable Pre-Mortem PDF.</div>
        </motion.div>

      </div>
    </div>
  );
}
