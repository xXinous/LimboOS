import React, { memo } from 'react';

export const Barcode = memo(({ onClick }: { onClick: () => void }) => {
  const lines = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 2];
  return (
    <button 
      onClick={onClick}
      className="flex items-end h-8 gap-[2px] opacity-80 hover:opacity-100 transition-opacity cursor-help"
      title="Ver Metadata do Terminal"
    >
      {lines.map((w, i) => (
        <div key={i} className="barcode-line" style={{ width: `${w * 1.5}px` }} />
      ))}
    </button>
  );
});

export const AnalogLogo = memo(() => (
  <div className="flex items-center gap-1 font-oswald text-2xl font-bold tracking-tight text-ink">
    <div className="flex items-center">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-analog-orange mr-1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 17c-2 0-3.5-1-5-1s-3 1-5 1-3.5-1-5-1-3 1-5 1" />
        <path d="M12 16c0-6 2-9 6-11" />
        <circle cx="15" cy="5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    </div>
    <span className="mt-1 uppercase">Analog</span>
  </div>
));
