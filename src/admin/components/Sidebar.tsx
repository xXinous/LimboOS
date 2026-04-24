import React from 'react';
import { clsx } from 'clsx';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const groups = [
    {
      title: "Monitoramento",
      items: [
        { id: 'dashboard', label: 'Painel Central', icon: 'monitoring' }, // Analytics + Logs
      ]
    },
    {
      title: "Mesa de Jogo",
      items: [
        { id: 'missions', label: 'Missões e Campanhas', icon: 'map' },
        { id: 'players', label: 'Jogadores e Grupos', icon: 'group' }, // Usuários + Grupos
        { id: 'inventory', label: 'Inventário e Conquistas', icon: 'inventory_2' }, // Inventário + Achievements
      ]
    },
    {
      title: "Conteúdo",
      items: [
        { id: 'library', label: 'Biblioteca de Mídia', icon: 'library_music' }, // Jukebox + Galeria + QR
      ]
    },
    {
      title: "Sistema",
      items: [
        { id: 'systems', label: 'Controle de Acessos', icon: 'settings_input_component' }, // Terminais + Settings
      ]
    }
  ];

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col pt-8 pb-4 z-40 overflow-y-auto">
      <div className="px-6 mb-8">
        <h2 className="text-orange-500 font-black font-headline tracking-tighter text-2xl">NODE_04</h2>
        <p className="font-label uppercase font-medium tracking-wider text-[10px] text-zinc-500">ADMIN_CONTROL_INTERFACE</p>
      </div>

      <nav className="flex-1 px-3 space-y-6">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <h3 className="px-3 text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-2">
              {group.title}
            </h3>
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  "w-full flex items-center px-3 py-2.5 gap-3 transition-all duration-200 text-left rounded-lg",
                  activeTab === item.id 
                    ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" 
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 border border-transparent"
                )}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <span className="font-label uppercase font-semibold tracking-wider text-[10px]">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto px-6 pt-4 border-t border-zinc-900">
        <p className="text-[8px] text-zinc-700 font-mono">ESTADO: ONLINE</p>
      </div>
    </aside>
  );
}
