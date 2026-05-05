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
    <div className="min-h-screen bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-[0.03] z-100 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_2px,3px_100%]"></div>

      <Header user={user} onLogout={onLogout} />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="ml-64 pt-20 px-8 pb-12">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Usuários Ativos" value={stats.totalUsers} color="primary" />
            <StatCard label="Arquivos de Áudio" value={stats.totalAudios} color="tertiary" />
            <StatCard label="Reproduções" value={stats.totalPlays} color="secondary" />
            <div className="bg-surface-container-highest/80 backdrop-blur-xl border border-orange-500/20 p-5 flex flex-col justify-center machined-edge">
              <p className="font-label text-[10px] uppercase tracking-widest text-orange-500/70 mb-1">Sessão_Ativa</p>
              <p className="text-2xl font-headline font-bold text-on-surface tracking-tighter">{sessionTime}</p>
              <p className="font-label text-[8px] uppercase tracking-widest text-zinc-600 mt-1">MODO_ADMIN</p>
            </div>
          </div>

          {/* Renderização de Abas */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <AnalyticsPanel />
              <div className="border-t border-zinc-800 pt-8">
                <h3 className="text-zinc-500 font-label text-[10px] uppercase tracking-widest mb-4">Log_Central_do_Nucleo</h3>
                <SystemLogPanel />
              </div>
            </div>
          )}

          {activeTab === 'missions' && <CampaignsPanel />}

          {activeTab === 'players' && <UserRegistry isAdmin={isAdmin} />}

          {activeTab === 'inventory' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <InventoryManager />
              <div className="border-t border-zinc-800 pt-8">
                <h3 className="text-zinc-500 font-label text-[10px] uppercase tracking-widest mb-4">Conquistas_do_Sistema</h3>
                <AchievementsPanel />
              </div>
            </div>
          )}

          {activeTab === 'library' && (
            <div className="bg-surface border border-zinc-800 machined-edge overflow-hidden animate-in fade-in duration-500">
              {/* Navegação da Biblioteca */}
              <div className="flex border-b border-zinc-800 bg-zinc-900/30">
                <LibrarySubTab label="Acervo de Fitas" active={libraryTab === 'acervo'} onClick={() => setLibraryTab('acervo')} icon="album" />
                <LibrarySubTab label="Jukebox" active={libraryTab === 'jukebox'} onClick={() => setLibraryTab('jukebox')} icon="queue_music" />
                <LibrarySubTab label="Galeria" active={libraryTab === 'galeria'} onClick={() => setLibraryTab('galeria')} icon="photo_library" />
                <LibrarySubTab label="QR Codes" active={libraryTab === 'qr'} onClick={() => setLibraryTab('qr')} icon="qr_code" />
              </div>

              <div className="p-6">
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
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  const colorMap: any = {
    primary: 'text-primary-container',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary'
  };
  return (
    <div className="bg-surface-container-lowest border border-zinc-800 p-5 relative overflow-hidden machined-edge">
      <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{label.replace(/ /g, '_')}</p>
      <p className={`text-3xl font-headline font-bold ${colorMap[color]} tracking-tighter`}>{value}</p>
      <div className="mt-2 flex gap-0.5">
        {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-3 ${i <= Math.min(5, Math.ceil(value/10)) ? 'bg-orange-500' : 'bg-zinc-800'}`}></div>)}
      </div>
    </div>
  );
}

function LibrarySubTab({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 text-[10px] font-label font-bold tracking-widest transition-all border-r border-zinc-800 uppercase ${active ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </button>
  );
}

