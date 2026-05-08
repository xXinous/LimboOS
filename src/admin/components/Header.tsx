import React from 'react';
import { User } from 'firebase/auth';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="w-full z-50 flex justify-between items-center px-8 h-20 bg-surface-container-low/50 backdrop-blur-md border-b border-primary/20 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 px-4 py-1.5 rounded-sm">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,140,0,0.4)]" />
          <span className="font-display uppercase font-bold tracking-[0.2em] text-[10px] text-primary">Status: Conectado</span>
        </div>
        <span className="text-[9px] font-display uppercase font-bold tracking-[0.4em] text-industrial-silver/30 hidden md:inline">Terminal_de_Comando_Geral</span>
      </div>
      
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-industrial-silver/40">Operador Autenticado</p>
            <p className="text-sm font-display font-bold text-white tracking-widest uppercase">{user?.email?.split('@')[0] || 'GM.MPG'}</p>
          </div>
          <div className="w-10 h-10 border border-primary/20 bg-surface-container-high flex items-center justify-center text-primary font-display font-bold text-xs shadow-lg rounded-sm group hover:border-primary/50 transition-all">
            <span className="group-hover:scale-110 transition-transform">GM</span>
          </div>
        </div>
        
        {user && (
          <button 
            onClick={onLogout} 
            className="flex items-center gap-2 px-4 py-2 bg-red-500/5 hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all border border-red-500/10 hover:border-red-500/30 group" 
            title="Encerrar Sessão"
          >
            <span className="font-display font-bold uppercase tracking-widest text-[10px]">Logout</span>
            <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </header>
  );
}
