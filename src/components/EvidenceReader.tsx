import React from 'react';
import { motion } from 'motion/react';
import type { Tape } from '../data/tapes';
interface EvidenceReaderProps {
  evidence: Tape;
  onClose: () => void;
}
export default function EvidenceReader({ evidence, onClose }: EvidenceReaderProps) {
  const isPista = evidence.type === 'gallery-pista';
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`absolute inset-0 z-50 flex flex-col ${isPista ? 'bg-[#0a0a0f] text-cyan-400' : 'bg-[#0a0a0a] text-[#00ff00]'} font-mono p-4 sm:p-6 sm:rounded-[32px] overflow-hidden`}
    >
      {}
      <div className="absolute inset-0 pointer-events-none z-10" style={{
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02))',
        backgroundSize: '100% 2px, 3px 100%'
      }} />
      <div className="absolute inset-0 pointer-events-none z-20" style={{
        background: 'radial-gradient(circle, transparent 70%, rgba(0,0,0,0.3) 100%)'
      }} />
      {}
      <div className={`flex items-center justify-between border-b ${isPista ? 'border-cyan-400/30' : 'border-[#00ff00]/30'} pb-4 mb-4 shrink-0`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isPista ? '📷' : '💾'}</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest">{evidence.title}</h2>
            <p className="text-[10px] opacity-70 italic">{isPista ? 'Categoria: Pista' : `Recuperado por: ${evidence.artist}`}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className={`px-3 py-1 border ${isPista ? 'border-cyan-400 hover:bg-cyan-400 hover:text-[#0a0a0f]' : 'border-[#00ff00] hover:bg-[#00ff00] hover:text-[#0a0a0a]'} text-[10px] transition-colors uppercase font-bold`}
        >
          [ FECHARV_ ]
        </button>
      </div>
      {}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: ${isPista ? '#22d3ee' : '#00ff00'}; border-radius: 2px; }
        `}</style>
        {isPista && evidence.imageUrl ? (
          <div className="flex flex-col items-center py-4 gap-4">
            <img
              src={evidence.imageUrl}
              alt={evidence.title}
              className="w-full max-h-[50vh] object-contain rounded-lg border border-cyan-500/30"
            />
            {evidence.description && (
              <div className="w-full text-sm leading-relaxed whitespace-pre-wrap selection:bg-cyan-400 selection:text-[#0a0a0f] text-cyan-300/90">
                {evidence.description}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap py-4 selection:bg-[#00ff00] selection:text-[#0a0a0a]">
            {evidence.content}
          </div>
        )}
      </div>
      {}
      <div className={`mt-4 pt-4 border-t ${isPista ? 'border-cyan-400/30' : 'border-[#00ff00]/30'} text-[9px] opacity-50 flex justify-between uppercase`}>
        <span>Setor: {evidence.chapter}</span>
        <span>Checksum: OK</span>
      </div>
    </motion.div>
  );
}

