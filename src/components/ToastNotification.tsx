import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface Toast {
  id: string;
  type: 'tape' | 'achievement' | 'error';
  title: string;
  subtitle?: string;
  icon?: string;
}

interface ToastNotificationProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-9999 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  key?: string;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const colors = {
    tape: 'border-orange-500/60 bg-[#1a1a1a]',
    achievement: 'border-yellow-500/60 bg-[#1a1a1a]',
    error: 'border-red-500/60 bg-[#1a1a1a]',
  };

  const glows = {
    tape: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]',
    achievement: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]',
    error: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
  };

  const textColors = {
    tape: 'text-orange-400',
    achievement: 'text-yellow-400',
    error: 'text-red-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 border rounded-lg backdrop-blur-sm min-w-[200px] max-w-[260px] ${colors[toast.type]} ${glows[toast.type]}`}
      onClick={() => onDismiss(toast.id)}
    >
      {toast.icon && <span className="text-xl shrink-0">{toast.icon}</span>}
      <div className="min-w-0">
        <p className={`text-xs font-bold uppercase tracking-wider truncate ${textColors[toast.type]}`}>
          {toast.title}
        </p>
        {toast.subtitle && (
          <p className="text-[10px] text-gray-400 truncate mt-0.5">{toast.subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}
