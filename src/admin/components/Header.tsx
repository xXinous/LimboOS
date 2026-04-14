import React from 'react';
import { User } from 'firebase/auth';
interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}
export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 shadow-[0_0_15px_rgba(255,140,0,0.1)]">
      <div className="flex items-center gap-4">
        <span className="text-xl font-bold tracking-tighter text-orange-500 italic font-headline">SYS_ADMIN_v2.0</span>
        <div className="h-4 w-px bg-zinc-700"></div>
        <span className="font-label uppercase tracking-widest text-[10px] text-orange-500 animate-pulse">STATUS_OPERACIONAL: ATIVO</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-4">
          {user && (
            <button 
              onClick={onLogout} 
              className="material-symbols-outlined text-zinc-500 hover:bg-zinc-800 hover:text-error transition-colors duration-150 p-2 rounded-sm" 
              title="Sair"
            >
              logout
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 ml-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-label uppercase tracking-tighter text-zinc-400">ID_do_Operador</p>
            <p className="text-xs font-bold text-on-surface">GM.MPG</p>
          </div>
          <div className="w-8 h-8 rounded-full border border-orange-500/50 bg-linear-to-br from-orange-600 to-orange-800 flex items-center justify-center">
            <span className="text-white text-xs font-black">GM</span>
          </div>
        </div>
      </div>
    </header>
  );
}
