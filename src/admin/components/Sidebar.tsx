import React from 'react';
import { clsx } from 'clsx';
interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}
export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: 'users', label: 'Registro de Usuários', icon: 'group' },
    { id: 'inventory', label: 'Gerenciador de Inventário', icon: 'inventory_2' },
    { id: 'achievements', label: 'Conquistas', icon: 'stars' },
    { id: 'analytics', label: 'Análise / BI', icon: 'insights' },
    { id: 'terminals', label: 'Controle de Sistemas', icon: 'terminal' },
    { id: 'logs', label: 'Logs do Sistema', icon: 'list_alt' },
    { id: 'redirects', label: 'Redirecionamentos QR', icon: 'alt_route' },
    { id: 'settings', label: 'Configuração do Sistema', icon: 'settings_suggest' },
  ];
  return (
    <aside className="fixed left-0 top-14 bottom-0 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col pt-8 pb-4 z-40">
      <div className="px-6 mb-8">
        <h2 className="text-orange-500 font-black font-headline tracking-tighter text-2xl">NODE_04</h2>
        <p className="font-label uppercase font-medium tracking-wider text-[10px] text-zinc-500">ADMIN_CONTROL_INTERFACE</p>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={clsx(
              "w-full flex items-center px-6 py-3 gap-3 transition-all duration-200 text-left",
              activeTab === item.id 
                ? "bg-zinc-900 text-orange-500 border-l-4 border-orange-500" 
                : "text-zinc-400 hover:bg-zinc-900/50 hover:text-orange-300 hover:translate-x-1 border-l-4 border-transparent"
            )}
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span className="font-label uppercase font-medium tracking-wider text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="mt-auto px-4 space-y-4">
      </div>
    </aside>
  );
}
