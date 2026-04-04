import React from 'react';
import { motion } from 'motion/react';
import type { Tape } from '../data/tapes';

interface EvidenceReaderProps {
  evidence: Tape;
  onClose: () => void;
}

export default function EvidenceReader({ evidence, onClose }: EvidenceReaderProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 z-50 flex flex-col bg-[#0a0a0a] text-[#00ff00] font-mono p-4 sm:p-6 sm:rounded-[32px] overflow-hidden"
    >
      {/* CRT Effects */}
      <div className="absolute inset-0 pointer-events-none z-10" style={{
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02))',
        backgroundSize: '100% 2px, 3px 100%'
      }} />
      <div className="absolute inset-0 pointer-events-none z-20" style={{
        background: 'radial-gradient(circle, transparent 70%, rgba(0,0,0,0.3) 100%)'
      }} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#00ff00]/30 pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💾</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest">{evidence.title}</h2>
            <p className="text-[10px] opacity-70 italic">Recuperado por: {evidence.artist}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="px-3 py-1 border border-[#00ff00] text-[10px] hover:bg-[#00ff00] hover:text-[#0a0a0a] transition-colors uppercase font-bold"
        >
          [ FECHARV_ ]
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #00ff00; border-radius: 2px; }
        `}</style>
        <div className="text-sm leading-relaxed whitespace-pre-wrap py-4 selection:bg-[#00ff00] selection:text-[#0a0a0a]">
          {evidence.content}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-4 border-t border-[#00ff00]/30 text-[9px] opacity-50 flex justify-between uppercase">
        <span>Setor: {evidence.chapter}</span>
        <span>Checksum: OK</span>
      </div>
    </motion.div>
  );
}
