import React from 'react';

interface RetroSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function RetroSpinner({ size = 'md', className = '' }: RetroSpinnerProps) {
  const dimensions = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  }[size];

  const borderSize = {
    sm: 'border-2',
    md: 'border-3',
    lg: 'border-4'
  }[size];

  const dotSize = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  }[size];

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div className={`${dimensions} relative flex items-center justify-center`}>
        <div className={`absolute inset-0 rounded-full ${borderSize} border-surface-bright`} />
        <div className={`absolute inset-0 rounded-full ${borderSize} border-transparent border-t-retro-orange animate-[spin_1s_linear_infinite]`} />
        <div className={`${dotSize} bg-retro-orange rounded-full animate-pulse`} />
      </div>
    </div>
  );
}
