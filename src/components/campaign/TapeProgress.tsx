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
    <div className="flex flex-col items-center w-full max-w-[180px] cursor-pointer group">
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
        <div className="relative w-full h-3 bg-ink/10 rounded-full border border-cardboard-dark overflow-hidden shadow-inner transition-colors group-hover:bg-ink/20">
          <div className="absolute inset-0 flex justify-between px-3 pointer-events-none opacity-20">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-px h-full bg-ink" />
            ))}
          </div>
          
          <motion.div 
            className="absolute top-0 bottom-0 bg-analog-orange shadow-[0_0_10px_rgba(217,88,24,0.5)] rounded-sm"
            initial={false}
            animate={{ 
              left: `${(current / Math.max(1, total - 1)) * 100}%`,
              width: '16px',
              x: '-50%'
            }}
            transition={INDICATOR_SPRING}
          />
        </div>
      </div>
      <div className="mt-2 text-[8px] font-mono font-bold opacity-30 tracking-tighter uppercase">
        Scrub_Navigator
      </div>
    </div>
  );
};
