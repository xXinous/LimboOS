import React from 'react';
import { clsx } from 'clsx';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: 'users', label: 'User Registry', icon: 'group' },
    { id: 'audio', label: 'Audio Library', icon: 'library_music' },
    { id: 'analytics', label: 'Analytics / BI', icon: 'insights' },
    { id: 'settings', label: 'System Config', icon: 'settings_suggest' },
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
        <div className="pt-4 border-t border-zinc-800 space-y-1">
          <a href="#" className="text-zinc-500 flex items-center justify-between px-2 py-1 hover:text-orange-400 transition-colors">
            <span className="font-label uppercase text-[10px] tracking-widest">Logs</span>
            <span className="material-symbols-outlined text-sm">list_alt</span>
          </a>
          <a href="#" className="text-zinc-500 flex items-center justify-between px-2 py-1 hover:text-orange-400 transition-colors">
            <span className="font-label uppercase text-[10px] tracking-widest">Terminal</span>
            <span className="material-symbols-outlined text-sm">keyboard_arrow_right</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
