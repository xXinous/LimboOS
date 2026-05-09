import React from 'react';
import RetroSpinner from './RetroSpinner';

interface RetroLoadingProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export default function RetroLoading({
  message = "SINTONIZANDO...",
  subMessage = "Buscando sinal na frequência 87.5 MHz",
  fullScreen = false
}: RetroLoadingProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${fullScreen ? 'fixed inset-0 z-100 bg-surface' : 'w-full h-full p-8'}`}>
      <div className="noise-overlay" />
      <div className="scanlines" />

      <RetroSpinner size="lg" />

      <div className="mt-6 flex flex-col items-center gap-2">
        <div className="text-retro-orange font-mono text-sm tracking-[0.3em] font-black uppercase text-center animate-[pulse_2s_ease-in-out_infinite]">
          {message}
        </div>

        {subMessage && (
          <div className="text-industrial-silver/40 font-mono text-[9px] uppercase tracking-widest text-center opacity-50">
            {subMessage}
          </div>
        )}
      </div>
    </div>
  );
}