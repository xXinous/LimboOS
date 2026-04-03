import React from 'react';
import { analyticsTracker } from '../../services/AnalyticsTracker';

export interface ScrewProps {
  key?: React.Key;
  className?: string;
  innerClassName?: string;
  onClick?: () => void;
}

export class ScrewBehavior {
  static registerClick() {
    analyticsTracker.incrementStat('screwClicks');
    analyticsTracker.incrementStat('fidgetClicks');
  }
}

export default function Screw({ className = '', innerClassName = '', onClick }: ScrewProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ScrewBehavior.registerClick();
    if (onClick) onClick();
  };

  // Determine standard or overridden classes
  const outer = className.includes('w-') ? className : `w-4 h-4 rounded-full bg-[#1a1a1a] border border-[#3a3a3a] ${className}`;
  const inner = innerClassName || `w-2 h-0.5 bg-[#3a3a3a] rotate-45`;

  return (
    <div onClick={handleClick} className={`absolute flex items-center justify-center cursor-pointer hover:brightness-125 transition-all z-20 ${outer}`}>
      <div className={`pointer-events-none ${inner}`} />
    </div>
  );
}
