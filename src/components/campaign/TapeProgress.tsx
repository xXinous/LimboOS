import React from 'react';
import { motion } from 'motion/react';

interface TapeProgressProps {
  total: number;
  current: number;
}

export const TapeProgress = ({ total, current }: TapeProgressProps) => {
  return (
    <div className="flex flex-col items-center w-full max-w-[180px]">
      <div className="relative w-full h-3 bg-ink/10 rounded-full border border-cardboard-dark overflow-hidden shadow-inner">
        {/* Marcadores de escala simplificados */}
        <div className="absolute inset-0 flex justify-between px-3 pointer-events-none opacity-20">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[1px] h-full bg-ink" />
          ))}
        </div>
        
        {/* O Indicador "Fita" */}
        <motion.div 
          className="absolute top-0 bottom-0 bg-analog-orange shadow-[0_0_10px_rgba(217,88,24,0.5)]"
          initial={false}
          animate={{ 
            left: `${(current / (total - 1)) * 100}%`,
            width: '16px',
            x: '-50%'
          }}
          transition={{ type: "spring", stiffness: 350, damping: 35 }}
        />
      </div>
    </div>
  );
};
