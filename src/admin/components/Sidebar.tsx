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
        { id: 'dashboard', label: 'Painel Central', icon: 'monitoring' },
      ]
    },
    {
      title: "Mesa de Jogo",
      items: [
        { id: 'missions', label: 'Missões', icon: 'map' },
        { id: 'players', label: 'Agentes', icon: 'group' },
        { id: 'inventory', label: 'Inventário', icon: 'inventory_2' },
      ]
    },
    {
      title: "Conteúdo",
      items: [
        { id: 'library', label: 'Biblioteca', icon: 'library_music' },
        { id: 'intel', label: 'Intel Registry', icon: 'hub' },
      ]
    },
    {
      title: "Sistema",
      items: [
        { id: 'systems', label: 'Acessos', icon: 'settings_input_component' },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-black/40 border-r-4 border-[#1a1a1a] flex flex-col pt-8 pb-4 z-40 overflow-y-auto custom-scrollbar shrink-0">
      <div className="px-6 mb-8">
        <h2 className="text-primary font-black font-chakra tracking-tighter text-2xl">NODE_04</h2>
        <p className="font-chakra uppercase font-bold tracking-widest text-[9px] text-zinc-500">CONTROL_INTERFACE</p>
      </div>

      <nav className="flex-1 px-3 space-y-6">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <h3 className="px-4 text-[9px] font-chakra font-black text-zinc-600 uppercase tracking-[0.3em] mb-2">
              {group.title}
            </h3>
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  "w-full flex items-center px-4 py-3 gap-3 transition-all duration-200 text-left relative group",
                  activeTab === item.id 
                    ? "bg-primary text-black font-black" 
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                )}
              >
                {activeTab === item.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-black" />
                )}
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <span className="font-chakra uppercase font-bold tracking-widest text-[10px]">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto px-6 pt-4 border-t border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <p className="text-[8px] text-zinc-600 font-chakra font-bold tracking-widest uppercase">Sistema Online</p>
        </div>
      </div>
    </aside>
  );
}
