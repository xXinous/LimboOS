import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `toast_${++counterRef.current}_${Date.now()}`;
    setToasts((prev) => {
      const next = [...prev, { id, type, message }];
      // FIFO: keep only the latest MAX_TOASTS
      return next.slice(-MAX_TOASTS);
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const contextValue: ToastContextValue = {
    success: useCallback((msg: string) => addToast('success', msg), [addToast]),
    error: useCallback((msg: string) => addToast('error', msg), [addToast]),
    info: useCallback((msg: string) => addToast('info', msg), [addToast]),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Container — fixed bottom-right */}
      <div className="fixed bottom-6 right-6 z-[9998] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto flex items-center gap-4 px-6 py-4 border shadow-2xl backdrop-blur-md font-display ${getToastStyles(toast.type)}`}
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              <span className="material-symbols-outlined text-lg shrink-0">
                {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest flex-1 leading-relaxed">
                {toast.message}
              </span>
              {/* Auto-dismiss progress bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
                className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left ${getProgressColor(toast.type)}`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function getToastStyles(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'bg-surface-container-low/95 border-emerald-500/30 text-emerald-400';
    case 'error':
      return 'bg-surface-container-low/95 border-red-500/30 text-red-400';
    case 'info':
      return 'bg-surface-container-low/95 border-primary/30 text-primary';
  }
}

function getProgressColor(type: ToastType): string {
  switch (type) {
    case 'success': return 'bg-emerald-500';
    case 'error': return 'bg-red-500';
    case 'info': return 'bg-primary';
  }
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for components rendered outside ToastProvider (e.g. during tests)
    return {
      success: (msg) => console.log('[Toast] success:', msg),
      error: (msg) => console.error('[Toast] error:', msg),
      info: (msg) => console.info('[Toast] info:', msg),
    };
  }
  return ctx;
}
