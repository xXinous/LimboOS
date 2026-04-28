import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { LogOut, User, X, ShieldAlert } from 'lucide-react';

interface SecurityMenuProps {
  onClose: () => void;
  onLogout: () => void;
  onShowProfile: () => void;
}

export const SecurityMenu = ({ onClose, onLogout, onShowProfile }: SecurityMenuProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ y: '-100%' }}
      animate={{ y: 0 }}
      exit={{ y: '-100%' }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="absolute inset-0 z-100 bg-cardboard/98 backdrop-blur-md flex flex-col border-b-12 border-cardboard-dark shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden touch-none"
    >
      {/* Camada Estética CRT (Scanlines e Brilho) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] z-10 scanlines" />
      <div className="absolute inset-0 pointer-events-none bg-linear-to-b from-transparent via-analog-orange/5 to-transparent h-40 animate-scanline z-10" />

      {/* Header do Painel */}
      <div className="p-8 border-b-2 border-cardboard-dark flex justify-between items-center bg-cardboard shadow-sm relative z-20">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-analog-orange/10 rounded-2xl border-2 border-analog-orange/20 shadow-inner">
             <ShieldAlert className="text-analog-orange" size={32} />
           </div>
           <div>
             <h4 className="font-oswald text-2xl uppercase tracking-[0.2em] text-ink leading-none">Segurança</h4>
             <div className="flex gap-1 mt-1">
                <div className="w-8 h-1 bg-analog-orange rounded-full" />
                <div className="w-2 h-1 bg-analog-orange/30 rounded-full" />
             </div>
           </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-3 hover:bg-black/5 active:bg-black/10 rounded-full transition-all text-ink border-2 border-cardboard-dark bg-cardboard shadow-sm group"
        >
          <X size={32} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>
      
      {/* Ações Centralizadas */}
      <div className="flex-1 p-8 flex flex-col gap-6 justify-center relative z-20">
        <button 
          onClick={onShowProfile}
          className="w-full flex items-center gap-6 p-7 bg-ink/5 text-ink rounded-[32px] border-4 border-cardboard-dark font-black hover:bg-ink/10 transition-all text-left uppercase shadow-xl active:translate-y-1 group"
        >
          <div className="w-16 h-16 rounded-2xl bg-ink flex items-center justify-center text-white shrink-0 shadow-lg group-hover:scale-110 transition-transform">
            <User size={32} />
          </div>
          <div>
            <div className="text-xl font-oswald tracking-wider">Perfil_Usuário</div>
            <div className="text-[10px] opacity-60 font-mono tracking-tight mt-1">GERENCIAR IDENTIDADE E CONQUISTAS</div>
          </div>
        </button>

        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-6 p-7 bg-red-900/10 text-analog-red rounded-[32px] border-4 border-analog-red/20 font-black hover:bg-red-900/20 transition-all text-left uppercase shadow-xl active:translate-y-1 group"
        >
          <div className="w-16 h-16 rounded-2xl bg-analog-red flex items-center justify-center text-white shrink-0 shadow-lg group-hover:scale-110 transition-transform">
            <LogOut size={32} />
          </div>
          <div>
            <div className="text-xl font-oswald tracking-wider">Desconectar_Link</div>
            <div className="text-[10px] opacity-60 font-mono tracking-tight mt-1">SAIR DO TERMINAL ATUAL</div>
          </div>
        </button>
      </div>

      {/* Footer Simples (Apenas Estético) */}
      <div className="p-10 border-t-2 border-cardboard-dark bg-black/5 flex flex-col items-center gap-4 relative z-20 mt-auto">
         <div className="w-32 h-1.5 bg-ink/10 rounded-full" />
      </div>
    </motion.div>
  );
};
