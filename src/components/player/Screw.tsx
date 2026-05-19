import React from 'react';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { activityLogger } from '../../services/ActivityLogger';

export interface ScrewProps {
  key?: React.Key;
  className?: string;
  innerClassName?: string;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export class ScrewBehavior {
  static registerClick() {
    analyticsTracker.incrementStat('screwClicks');
    analyticsTracker.incrementStat('fidgetClicks');
    activityLogger.logAction('fidget', 'Interação tátil (parafuso)');
  }
}

export default function Screw({ className = '', innerClassName = '', onClick, size = 'md' }: ScrewProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ScrewBehavior.registerClick();
    if (onClick) onClick();
  };

  const sizeMap = {
    'xs': 'w-2 h-2',
    'sm': 'w-3 h-3',
    'md': 'w-4 h-4',
    'lg': 'w-6 h-6'
  };

  const innerSizeMap = {
    'xs': 'w-1 h-[0.5px]',
    'sm': 'w-1.5 h-0.5',
    'md': 'w-2 h-0.5',
    'lg': 'w-3 h-1'
  };

  const outer = className.includes('w-') ? className : `${sizeMap[size]} rounded-full bg-[#1a1a1a] border border-[#3a3a3a] ${className}`;
  const inner = innerClassName || `${innerSizeMap[size]} bg-[#3a3a3a] rotate-45`;

  return (
    <div onClick={handleClick} className={`absolute flex items-center justify-center cursor-pointer hover:brightness-125 transition-all z-20 ${outer}`}>
      <div className={`pointer-events-none ${inner}`} />
    </div>
  );
}
