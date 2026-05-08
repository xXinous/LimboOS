import React from 'react';
import { motion } from 'motion/react';

interface RetroSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function RetroSpinner({ size = 'md', className = '' }: RetroSpinnerProps) {
  const dimensions = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4'
  }[size];

  const dotSize = {
    sm: 'w-0.5 h-0.5',
    md: 'w-1 h-1',
    lg: 'w-2 h-2'
  }[size];

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div className={`${dimensions} rounded-full border-surface-bright flex items-center justify-center`}>
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className={`absolute inset-0 ${dimensions} border-t-retro-orange rounded-full`}
          style={{ borderTopColor: 'var(--color-retro-orange)', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent' }}
        />
        <div className={`${dotSize} bg-retro-orange rounded-full animate-pulse`} />
      </div>
    </div>
  );
}
