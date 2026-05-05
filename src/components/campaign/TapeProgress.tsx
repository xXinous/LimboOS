import React, { useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { INDICATOR_SPRING } from './constants';

interface TapeProgressProps {
  total: number;
  current: number;
  onChange?: (index: number) => void;
}

export const TapeProgress = ({ total, current, onChange }: TapeProgressProps) => {
  const barRef = useRef<HTMLDivElement>(null);

  const resolveIndex = useCallback((clientX: number) => {
    if (!onChange || !barRef.current) return;
    const { left, width } = barRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - left) / width));
    const nextIndex = Math.round(percentage * (total - 1));
    onChange(Math.max(0, Math.min(total - 1, nextIndex)));
  }, [onChange, total]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    resolveIndex(e.clientX);
    
    const onMove = (ev: PointerEvent) => resolveIndex(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [resolveIndex]);

  return (
    <div className="flex flex-col items-center w-full max-w-[200px] cursor-pointer group">
      <div 
        ref={barRef}
        className="relative w-full py-4 -my-4 touch-none"
        onPointerDown={handlePointerDown}
        role="slider"
        aria-label="Navegação entre campanhas"
        aria-valuemin={0}
        aria-valuemax={total - 1}
        aria-valuenow={current}
      >
        <div className="relative w-full h-1.5 bg-primary/10 border border-primary/20 overflow-hidden shadow-inner transition-colors group-hover:bg-primary/20">
          <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-20">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-px h-full bg-primary" />
            ))}
          </div>
          
          <motion.div 
            className="absolute top-0 bottom-0 bg-primary shadow-[0_0_15px_rgba(255,183,125,0.6)]"
            initial={false}
            animate={{ 
              left: `${(current / Math.max(1, total - 1)) * 100}%`,
              width: '20px',
              x: '-50%'
            }}
            transition={INDICATOR_SPRING}
          />
        </div>
      </div>
      <div className="mt-3 text-[9px] font-display font-bold text-industrial-silver/20 tracking-[0.3em] uppercase group-hover:text-primary/30 transition-colors">
        Navegador de Registros
      </div>
    </div>
  );
};
