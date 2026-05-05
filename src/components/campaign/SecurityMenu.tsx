import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { LogOut, User, X, ShieldAlert, Users, ChevronRight } from 'lucide-react';

interface SecurityMenuProps {
  onClose: () => void;
  onLogout: () => void;
  onShowProfile: () => void;
  onChangeCharacter?: () => void;
}

export const SecurityMenu = ({ onClose, onLogout, onShowProfile, onChangeCharacter }: SecurityMenuProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const ActionBtn = ({ onClick, icon: Icon, title, sub, color = 'text-primary' }: any) => (
    <button 
      onClick={onClick} 
      className="w-full flex items-center gap-6 p-6 bg-surface-container-low border border-primary/10 hover:border-primary/40 hover:bg-primary/5 transition-all group relative overflow-hidden"
    >
      <div className={`w-16 h-16 rounded-sm bg-black border border-primary/20 flex items-center justify-center ${color} shrink-0 shadow-lg group-hover:scale-105 transition-transform group-hover:border-primary/40`}>
        <Icon size={32} />
      </div>
      <div className="text-left flex-1">
        <h3 className={`font-display text-xl font-bold uppercase tracking-tight group-hover:text-white transition-colors ${color}`}>{title}</h3>
        <p className="text-[9px] font-display text-industrial-silver/30 uppercase tracking-[0.2em] mt-1 group-hover:text-industrial-silver/50 transition-colors">{sub}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={24} className="text-primary" />
      </div>
    </button>
  );

  return (
    <motion.div initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ type: "spring", damping: 30, stiffness: 300 }} 
      className="absolute inset-0 z-100 bg-surface/98 backdrop-blur-xl flex flex-col border-b border-primary/20 shadow-2xl overflow-hidden touch-none">
      
      <div className="noise-overlay" />
      <div className="scanlines" />
      <div className="absolute inset-0 pointer-events-none bg-linear-to-b from-primary/5 via-transparent to-transparent h-60 z-10" />

      <header className="p-8 border-b border-primary/20 flex justify-between items-center bg-surface-container-low/50 relative z-20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-sm border border-primary/20">
            <ShieldAlert className="text-primary" size={32} />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-white uppercase tracking-tighter">Menu de <span className="text-primary">Segurança</span></h2>
            <p className="text-[10px] font-display text-primary/40 uppercase tracking-[0.3em]">Protocolos de Acesso RM-84</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-primary/10 rounded-sm transition-all text-primary border border-primary/20 bg-surface group">
          <X size={32} className="group-hover:rotate-90 transition-transform" />
        </button>
      </header>

      <div className="flex-1 p-8 space-y-4 relative z-20 overflow-y-auto">
        <ActionBtn onClick={onShowProfile} icon={User} title="Dossiê_do_Agente" sub="VISUALIZAR REGISTROS E CONQUISTAS" color="text-primary" />
        <ActionBtn onClick={onChangeCharacter} icon={Users} title="Alternar_Agente" sub="ASSUMIR NOVA IDENTIDADE DE CAMPO" color="text-primary/70" />
        <ActionBtn onClick={onLogout} icon={LogOut} title="Desconectar_Link" sub="SAIR DO TERMINAL ATUAL" color="text-red-500" />
      </div>

      <footer className="p-8 border-t border-primary/10 bg-surface-container-low/30 relative z-20">
        <div className="flex justify-between items-center opacity-30">
          <div className="font-display text-[10px] uppercase tracking-[0.4em] text-industrial-silver">Indústrias Smile © 2026</div>
          <div className="font-display text-[10px] uppercase tracking-[0.2em] text-industrial-silver">Grid: RM-NODE-ALPHA</div>
        </div>
      </footer>
    </motion.div>
  );
};
