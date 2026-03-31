import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ModalVariant = 'confirm' | 'alert';

interface ModalState {
  open: boolean;
  variant: ModalVariant;
  title: string;
  message: string;
  confirmLabel?: string;
  resolve?: (v: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  state: ModalState;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ state, onConfirm, onCancel }: ConfirmModalProps) {
  const isDanger = state.title.toLowerCase().includes('atenção') || state.title.toLowerCase().includes('delete') || state.title.toLowerCase().includes('apagar') || state.title.toLowerCase().includes('zerar') || state.title.toLowerCase().includes('reset');

  // Trap focus on the modal
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.open) setTimeout(() => confirmRef.current?.focus(), 50);
  }, [state.open]);

  return (
    <AnimatePresence>
      {state.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="bg-zinc-900 border border-zinc-700 w-full max-w-md mx-4 shadow-2xl machined-edge"
          >
            {/* Header */}
            <div className={`px-6 py-4 border-b ${isDanger ? 'border-red-800/50 bg-red-950/30' : 'border-zinc-800'} flex items-center gap-3`}>
              <span className={`material-symbols-outlined text-lg ${isDanger ? 'text-red-400' : 'text-orange-500'}`}>
                {isDanger ? 'warning' : 'info'}
              </span>
              <h2 className="font-label text-[11px] uppercase tracking-widest text-zinc-200 font-bold">{state.title}</h2>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-zinc-300 text-sm font-mono leading-relaxed">{state.message}</p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-5 flex gap-3 justify-end">
              {state.variant === 'confirm' && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-[10px] font-label font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                ref={confirmRef}
                onClick={onConfirm}
                className={`px-5 py-2 text-[10px] font-label font-bold uppercase tracking-widest transition-colors ${
                  isDanger
                    ? 'bg-red-700 hover:bg-red-600 text-white border border-red-600'
                    : 'bg-orange-600 hover:bg-orange-500 text-white border border-orange-500'
                }`}
              >
                {state.confirmLabel ?? (state.variant === 'confirm' ? 'Confirmar' : 'OK')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useModal() {
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    variant: 'alert',
    title: '',
    message: '',
  });

  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const showConfirm = useCallback((title: string, message: string, confirmLabel?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({ open: true, variant: 'confirm', title, message, confirmLabel });
    });
  }, []);

  const showAlert = useCallback((title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = (v: boolean) => { resolve(); };
      setModalState({ open: true, variant: 'alert', title, message });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setModalState((s) => ({ ...s, open: false }));
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setModalState((s) => ({ ...s, open: false }));
    resolveRef.current?.(false);
  }, []);

  const modal = (
    <ConfirmModal state={modalState} onConfirm={handleConfirm} onCancel={handleCancel} />
  );

  return { showConfirm, showAlert, modal };
}
