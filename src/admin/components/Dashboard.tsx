import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, onSnapshot, query } from 'firebase/firestore';
import Sidebar from './Sidebar';
import Header from './Header';
import UserRegistry from './UserRegistry';
import AudioBuffer from './AudioBuffer';
import AnalyticsPanel from './AnalyticsPanel';
import AchievementsPanel from './AchievementsPanel';
import TerminalPanel from './TerminalPanel';
import InventoryManager from './InventoryManager';
import SystemLogPanel from './SystemLogPanel';
import RedirectsPanel from './RedirectsPanel';
import GalleryPanel from './GalleryPanel';
import JukeboxPanel from './JukeboxPanel';
import CampaignsPanel from './CampaignsPanel';
import IntelCreatorPanel from './IntelCreatorPanel';

interface DashboardProps {
  user: User | null;
  onLogout: () => void;
}

interface Stats {
  totalUsers: number;
  totalAudios: number;
  totalPlays: number;
}

import Screw from '../../components/player/Screw';

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [libraryTab, setLibraryTab] = useState<'acervo' | 'jukebox' | 'galeria' | 'qr'>('acervo');
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalAudios: 0, totalPlays: 0 });
  const [sessionTime, setSessionTime] = useState(() => new Date().toISOString().substr(11, 8));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { setIsAdmin(false); return; }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    const tick = () => setSessionTime(new Date().toISOString().substr(11, 8));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(collection(db, 'users'), (snap) => {
      setStats(prev => ({ ...prev, totalUsers: snap.size }));
    }));
    unsubs.push(onSnapshot(collection(db, 'audios'), (snap) => {
      setStats(prev => ({ ...prev, totalAudios: snap.size }));
    }));
    unsubs.push(onSnapshot(collection(db, 'playEvents'), (snap) => {
      setStats(prev => ({ ...prev, totalPlays: snap.size }));
    }));
    return () => unsubs.forEach(u => u());
  }, [isAdmin, user]);

  return (
    <div className="h-screen bg-surface flex relative overflow-hidden font-sans">
      <div className="noise-overlay" />
      <div className="scanlines" />
      
      {/* Sidebar — full height, fixed width, never resized by content */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
      />

      {/* Right column: Header (sticky) + scrollable content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header user={user} onLogout={onLogout} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-surface/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto space-y-8">

            {/* Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Usuários Ativos" value={stats.totalUsers} icon="group" color="primary" />
              <StatCard label="Arquivos de Áudio" value={stats.totalAudios} icon="library_music" color="tertiary" />
              <StatCard label="Reproduções" value={stats.totalPlays} icon="play_circle" color="secondary" />
              <div className="bg-surface-container-low border border-primary/20 p-5 flex flex-col justify-center relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 -rotate-45 translate-x-8 -translate-y-8" />
                <p className="font-display text-[10px] uppercase font-bold tracking-[0.2em] text-primary/60 mb-1">Sessão_Ativa</p>
                <p className="text-3xl font-display font-bold text-white tracking-tight">{sessionTime}</p>
                <p className="font-display text-[8px] uppercase tracking-[0.3em] text-industrial-silver/30 mt-1">NÚCLEO_OPERACIONAL</p>
              </div>
            </div>

            {/* Renderização de Abas */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <AnalyticsPanel />
                  <div className="border-t border-primary/10 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-px flex-1 bg-linear-to-r from-transparent to-primary/20" />
                      <h3 className="text-industrial-silver/40 font-display text-[10px] uppercase font-bold tracking-[0.3em]">Log_Central_do_Nucleo</h3>
                      <div className="h-px flex-1 bg-linear-to-l from-transparent to-primary/20" />
                    </div>
                    <SystemLogPanel />
                  </div>
                </div>
              )}

              {activeTab === 'missions' && <CampaignsPanel />}
              {activeTab === 'players' && <UserRegistry isAdmin={isAdmin} />}
              {activeTab === 'inventory' && (
                <div className="space-y-8">
                  <InventoryManager />
                  <div className="border-t border-primary/10 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-px flex-1 bg-linear-to-r from-transparent to-primary/20" />
                      <h3 className="text-industrial-silver/40 font-display text-[10px] uppercase font-bold tracking-[0.3em]">Conquistas_do_Sistema</h3>
                      <div className="h-px flex-1 bg-linear-to-l from-transparent to-primary/20" />
                    </div>
                    <AchievementsPanel />
                  </div>
                </div>
              )}

              {activeTab === 'library' && (
                <div className="bg-surface-container-low border border-primary/20 overflow-hidden rounded-sm shadow-xl">
                  {/* Navegação da Biblioteca */}
                  <div className="flex flex-wrap border-b border-primary/10 bg-black/20">
                    <LibrarySubTab label="Acervo" active={libraryTab === 'acervo'} onClick={() => setLibraryTab('acervo')} icon="album" />
                    <LibrarySubTab label="Jukebox" active={libraryTab === 'jukebox'} onClick={() => setLibraryTab('jukebox')} icon="queue_music" />
                    <LibrarySubTab label="Galeria" active={libraryTab === 'galeria'} onClick={() => setLibraryTab('galeria')} icon="photo_library" />
                    <LibrarySubTab label="QR Codes" active={libraryTab === 'qr'} onClick={() => setLibraryTab('qr')} icon="qr_code" />
                  </div>

                  <div className="p-4 sm:p-8">
                    {libraryTab === 'acervo' && <AudioBuffer user={user} isAdmin={isAdmin} />}
                    {libraryTab === 'jukebox' && <JukeboxPanel />}
                    {libraryTab === 'galeria' && <GalleryPanel />}
                    {libraryTab === 'qr' && <RedirectsPanel />}
                  </div>
                </div>
              )}

              {activeTab === 'intel' && (
                <div className="space-y-8">
                  <IntelCreatorPanel />
                </div>
              )}

              {activeTab === 'systems' && (
                <div className="space-y-8">
                  <TerminalPanel />
                </div>
              )}
            </div>

          </div>
        </main>

        <footer className="h-8 border-t border-primary/10 bg-surface-container-low/50 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse glow-orange" />
            <span className="text-[8px] font-display font-bold uppercase tracking-[0.3em] text-industrial-silver/40">Sincronização de Dados em Tempo Real</span>
          </div>
          <span className="text-[8px] font-display font-bold uppercase tracking-[0.3em] text-industrial-silver/20">RM_ADMIN_SYSTEM_V4.0 // ENCRYPTED_NODE</span>
        </footer>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: number, icon: string, color: string }) {
  const colorMap: any = {
    primary: 'text-primary border-primary/20',
    secondary: 'text-secondary border-secondary/20',
    tertiary: 'text-tertiary border-tertiary/20'
  };
  
  const iconColorMap: any = {
    primary: 'text-primary/20',
    secondary: 'text-secondary/20',
    tertiary: 'text-tertiary/20'
  };

  return (
    <div className={`bg-surface-container-low border p-5 relative overflow-hidden group transition-all hover:bg-surface-container-high ${colorMap[color]}`}>
      <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
        <span className={`material-symbols-outlined text-6xl ${iconColorMap[color]}`}>{icon}</span>
      </div>
      <p className="font-display text-[10px] uppercase font-bold tracking-[0.2em] text-industrial-silver/50 mb-2">{label.replace(/ /g, '_')}</p>
      <div className="flex items-end gap-2">
        <p className="text-4xl font-display font-bold text-white tracking-tighter">{value}</p>
        <div className="mb-1.5 flex gap-0.5">
          {[1,2,3].map(i => <div key={i} className={`w-1 h-3 rounded-full ${i <= 2 ? 'bg-primary/40' : 'bg-white/5'}`} />)}
        </div>
      </div>
    </div>
  );
}

function LibrarySubTab({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-6 py-4 text-[10px] font-display font-bold tracking-[0.2em] transition-all border-r border-primary/10 uppercase ${active ? 'bg-primary text-black' : 'text-industrial-silver/50 hover:bg-primary/5 hover:text-primary'}`}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      {label}
    </button>
  );
}

