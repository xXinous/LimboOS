import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { LogOut, User, X, ShieldAlert, Users } from 'lucide-react';

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

  const ActionBtn = ({ onClick, icon: Icon, title, sub, color = 'text-ink' }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-6 p-7 bg-ink/5 ${color} rounded-[32px] border-4 border-cardboard-dark hover:bg-ink/10 transition-all text-left uppercase shadow-xl active:translate-y-1 group`}>
      <div className={`w-16 h-16 rounded-2xl ${color.includes('red') ? 'bg-analog-red' : 'bg-ink'} flex items-center justify-center text-white shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>
        <Icon size={32} />
      </div>
      <div>
        <div className="text-xl font-oswald tracking-wider">{title}</div>
        <div className="text-[10px] opacity-60 font-mono tracking-tight mt-1">{sub}</div>
      </div>
    </button>
  );

  return (
    <motion.div initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="absolute inset-0 z-100 bg-cardboard/98 backdrop-blur-md flex flex-col border-b-12 border-cardboard-dark shadow-2xl overflow-hidden touch-none">
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] z-10 scanlines" />
      <div className="absolute inset-0 pointer-events-none bg-linear-to-b from-transparent via-analog-orange/5 to-transparent h-40 animate-scanline z-10" />

      <header className="p-8 border-b-2 border-cardboard-dark flex justify-between items-center bg-cardboard relative z-20">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-analog-orange/10 rounded-2xl border-2 border-analog-orange/20"><ShieldAlert className="text-analog-orange" size={32} /></div>
           <div>
             <h4 className="font-oswald text-2xl uppercase tracking-[0.2em] text-ink leading-none">Segurança</h4>
             <div className="w-8 h-1 bg-analog-orange rounded-full mt-1" />
           </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-black/5 rounded-full transition-all text-ink border-2 border-cardboard-dark bg-cardboard group"><X size={32} className="group-hover:rotate-90 transition-transform" /></button>
      </header>
      
      <div className="flex-1 p-8 flex flex-col gap-6 justify-center relative z-20">
        <ActionBtn onClick={onShowProfile} icon={User} title="Perfil_Usuário" sub="GERENCIAR IDENTIDADE E CONQUISTAS" />
        <ActionBtn onClick={onChangeCharacter} icon={Users} title="Alternar_Agente" sub="ASSUMIR NOVA IDENTIDADE DE CAMPO" color="text-analog-orange" />
        <ActionBtn onClick={onLogout} icon={LogOut} title="Desconectar_Link" sub="SAIR DO TERMINAL ATUAL" color="text-analog-red" />
      </div>

      <footer className="p-10 border-t-2 border-cardboard-dark bg-black/5 flex justify-center mt-auto"><div className="w-32 h-1.5 bg-ink/10 rounded-full" /></footer>
    </motion.div>
  );
};
