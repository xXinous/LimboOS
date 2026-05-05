import React from 'react';
import { User } from 'firebase/auth';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="w-full z-50 flex justify-between items-center px-8 h-16 bg-black/40 border-b-4 border-[#1a1a1a] shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-xl font-black tracking-tighter text-primary italic font-chakra">SYS_ADMIN_v3.0</span>
        <div className="h-4 w-1 bg-[#1a1a1a]"></div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,140,0,0.4)]" />
          <span className="font-chakra uppercase font-bold tracking-[0.2em] text-[10px] text-primary">STATUS_OPERACIONAL: ATIVO</span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[9px] font-chakra font-bold uppercase tracking-tighter text-zinc-500">Operador_Geral</p>
            <p className="text-xs font-chakra font-black text-white tracking-widest uppercase">{user?.email?.split('@')[0] || 'GM.MPG'}</p>
          </div>
          <div className="w-9 h-9 border-2 border-primary/30 bg-black flex items-center justify-center text-primary font-chakra font-black text-xs shadow-lg">
            GM
          </div>
        </div>
        
        {user && (
          <button 
            onClick={onLogout} 
            className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-all rounded-sm border border-transparent hover:border-red-500/20" 
            title="Encerrar Sessão"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
