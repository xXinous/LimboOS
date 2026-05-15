import React, { memo } from 'react';

export const Barcode = memo(({ onClick, className }: { onClick: () => void, className?: string }) => {
  const lines = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 2];
  return (
    <button 
      onClick={onClick}
      className={`flex items-end h-8 gap-[2px] opacity-60 hover:opacity-100 transition-all cursor-help ${className}`}
      title="Ver Metadata do Terminal"
    >
      {lines.map((w, i) => (
        <div key={i} className="bg-current h-full" style={{ width: `${w * 1.5}px` }} />
      ))}
    </button>
  );
});

export const AnalogLogo = memo(() => (
  <div className="flex items-center gap-2 font-display text-xl font-bold tracking-tighter text-white">
    <div className="flex items-center">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-primary mr-1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
    <span className="uppercase tracking-widest"><span className="text-primary">RM</span>-LINK</span>
  </div>
));
