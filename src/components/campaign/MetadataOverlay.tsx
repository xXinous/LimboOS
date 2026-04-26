import React from 'react';
import { motion } from 'motion/react';

interface MetadataOverlayProps {
  onClose: () => void;
}

export const MetadataOverlay = ({ onClose }: MetadataOverlayProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="absolute inset-0 z-[60] bg-black/75 backdrop-blur-md flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.8, y: 20 }} 
        animate={{ scale: 1, y: 0 }} 
        className="bg-cardboard p-8 rounded-3xl border-4 border-cardboard-dark shadow-2xl w-full max-w-[340px] relative overflow-hidden"
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none scanlines" />

        <div className="indented-box p-6 mb-6 font-mono text-[11px] space-y-3 text-ink text-left relative z-10">
          <div className="text-analog-orange font-black border-b-2 border-ink/10 pb-2 mb-3 text-sm tracking-widest uppercase flex justify-between items-center">
            <span>Metadata_Hardware</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-analog-orange rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-analog-orange/30 rounded-full" />
            </div>
          </div>
          <p><span className="opacity-50 font-bold">ID:</span> RM-2099-ALPHA</p>
          <p><span className="opacity-50 font-bold">LINK:</span> SECTOR_011_BR</p>
          <p><span className="opacity-50 font-bold">ENCRYPT:</span> ANALOG_DEEP_v4</p>
          <p><span className="opacity-50 font-bold">SPOOL:</span> HIGH_DENSITY</p>
          <div className="pt-3 opacity-70 italic border-t border-ink/10 mt-3 font-chakra leading-snug">
            "As memórias estão gravadas na fita. O papelão é apenas para manter o sinal no lugar."
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="btn-sk-orange w-full py-4 uppercase font-black tracking-widest text-sm shadow-md active:translate-y-0.5 transition-transform"
        >
          Voltar_Terminal
        </button>
      </motion.div>
    </motion.div>
  );
};
