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
    <div className="min-h-screen bg-surface flex items-center justify-center p-0 sm:p-6 overflow-hidden">
      <div className="noise-overlay" /><div className="scanlines" />

      <div className="relative w-full h-full max-w-7xl max-h-[95vh] bg-surface-container-high rounded-[32px] border-8 border-[#1a1a1a] shadow-2xl flex flex-col overflow-hidden z-10">
        <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
        
        <Header user={user} onLogout={onLogout} />
        
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-black/20">
            <div className="space-y-8">

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Usuários Ativos" value={stats.totalUsers} color="primary" />
                <StatCard label="Arquivos de Áudio" value={stats.totalAudios} color="tertiary" />
                <StatCard label="Reproduções" value={stats.totalPlays} color="secondary" />
                <div className="bg-[#222] border-4 border-[#1a1a1a] p-5 flex flex-col justify-center shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] rounded-xl relative">
                   <div className="absolute top-2 right-2 flex gap-1"><div className="w-1 h-1 rounded-full bg-primary animate-pulse" /><div className="w-1 h-1 rounded-full bg-primary/20" /></div>
                  <p className="font-chakra text-[10px] uppercase font-bold tracking-widest text-primary/70 mb-1">Sessão_Ativa</p>
                  <p className="text-2xl font-chakra font-black text-white tracking-tighter">{sessionTime}</p>
                  <p className="font-chakra text-[8px] uppercase tracking-widest text-zinc-600 mt-1">NÚCLEO_OPERACIONAL</p>
                </div>
              </div>

              {/* Renderização de Abas */}
              {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <AnalyticsPanel />
                  <div className="border-t border-white/5 pt-8">
                    <h3 className="text-zinc-500 font-chakra text-[10px] uppercase font-bold tracking-widest mb-4">Log_Central_do_Nucleo</h3>
                    <SystemLogPanel />
                  </div>
                </div>
              )}

              {activeTab === 'missions' && <CampaignsPanel />}
              {activeTab === 'players' && <UserRegistry isAdmin={isAdmin} />}
              {activeTab === 'inventory' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <InventoryManager />
                  <div className="border-t border-white/5 pt-8">
                    <h3 className="text-zinc-500 font-chakra text-[10px] uppercase font-bold tracking-widest mb-4">Conquistas_do_Sistema</h3>
                    <AchievementsPanel />
                  </div>
                </div>
              )}

              {activeTab === 'library' && (
                <div className="bg-[#222] border-4 border-[#1a1a1a] overflow-hidden animate-in fade-in duration-500 rounded-2xl shadow-2xl">
                  {/* Navegação da Biblioteca */}
                  <div className="flex border-b-4 border-[#1a1a1a] bg-black/40">
                    <LibrarySubTab label="Acervo" active={libraryTab === 'acervo'} onClick={() => setLibraryTab('acervo')} icon="album" />
                    <LibrarySubTab label="Jukebox" active={libraryTab === 'jukebox'} onClick={() => setLibraryTab('jukebox')} icon="queue_music" />
                    <LibrarySubTab label="Galeria" active={libraryTab === 'galeria'} onClick={() => setLibraryTab('galeria')} icon="photo_library" />
                    <LibrarySubTab label="QR Codes" active={libraryTab === 'qr'} onClick={() => setLibraryTab('qr')} icon="qr_code" />
                  </div>

                  <div className="p-6 bg-[#222]">
                    {libraryTab === 'acervo' && <AudioBuffer user={user} isAdmin={isAdmin} />}
                    {libraryTab === 'jukebox' && <JukeboxPanel />}
                    {libraryTab === 'galeria' && <GalleryPanel />}
                    {libraryTab === 'qr' && <RedirectsPanel />}
                  </div>
                </div>
              )}

              {activeTab === 'intel' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <IntelCreatorPanel />
                </div>
              )}

              {activeTab === 'systems' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <TerminalPanel />
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  const colorMap: any = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary'
  };
  return (
    <div className="bg-[#222] border-4 border-[#1a1a1a] p-5 relative overflow-hidden rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] group">
      <div className="absolute top-2 right-3 opacity-10 group-hover:opacity-30 transition-opacity">
         {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-primary rounded-full mb-1" />)}
      </div>
      <p className="font-chakra text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-2">{label.replace(/ /g, '_')}</p>
      <p className={`text-3xl font-chakra font-black ${colorMap[color]} tracking-tighter`}>{value}</p>
      <div className="mt-3 flex gap-1">
        {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`h-1.5 flex-1 ${i <= Math.min(8, Math.ceil(value/5)) ? 'bg-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]' : 'bg-black/40'}`}></div>)}
      </div>
    </div>
  );
}

function LibrarySubTab({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 text-[10px] font-chakra font-black tracking-widest transition-all border-r-4 border-[#1a1a1a] uppercase ${active ? 'bg-primary text-black' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </button>
  );
}

