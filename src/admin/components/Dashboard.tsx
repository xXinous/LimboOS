import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, onSnapshot, query } from 'firebase/firestore';
import { userService } from '../../services/UserService';
import { MasterAccount, CharacterData } from '../../types/player';
import SpotlightSearch, { buildSearchItems } from './SpotlightSearch';
import Sidebar from './Sidebar';
import Header from './Header';
const UserRegistry = React.lazy(() => import('./UserRegistry'));
const GroupManager = React.lazy(() => import('./GroupManager'));
const AnalyticsPanel = React.lazy(() => import('./AnalyticsPanel'));
const AchievementsPanel = React.lazy(() => import('./AchievementsPanel'));
const TerminalPanel = React.lazy(() => import('./TerminalPanel'));
const SystemLogPanel = React.lazy(() => import('./SystemLogPanel'));
const RedirectsPanel = React.lazy(() => import('./RedirectsPanel'));
const JukeboxPanel = React.lazy(() => import('./JukeboxPanel'));
const CampaignsPanel = React.lazy(() => import('./CampaignsPanel'));
const IntelCreatorPanel = React.lazy(() => import('./IntelCreatorPanel'));
const MediaLibraryPanel = React.lazy(() => import('./MediaLibraryPanel'));

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
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['dashboard']));
  const [intelTab, setIntelTab] = useState<'catalogo' | 'jukebox' | 'qr' | 'conquistas'>('catalogo');
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalAudios: 0, totalPlays: 0 });
  const [sessionTime, setSessionTime] = useState(() => new Date().toISOString().substr(11, 8));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [allAccounts, setAllAccounts] = useState<MasterAccount[]>([]);
  const [allCharacters, setAllCharacters] = useState<{uid: string, char: CharacterData}[]>([]);

  useEffect(() => {
    setMountedTabs(prev => new Set(prev).add(activeTab));
  }, [activeTab]);

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

  // Load accounts + characters for spotlight search
  useEffect(() => {
    if (!isAdmin) return;
    const unsubUsers = userService.subscribeToUsers((accs) => {
      setAllAccounts(accs);
    });
    const unsubChars = userService.subscribeToAllCharacters((chars) => {
      setAllCharacters(chars);
    });
    return () => {
      unsubUsers();
      unsubChars();
    };
  }, [isAdmin]);

  // Keyboard shortcuts: Cmd+K for spotlight, Cmd+1-8 for tabs
  useEffect(() => {
    const tabOrder = ['dashboard', 'missions', 'players', 'squads', 'media', 'intel', 'systems'];
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSpotlightOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '8') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (tabOrder[idx]) setActiveTab(tabOrder[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const spotlightItems = useMemo(() => {
    return buildSearchItems(allAccounts, allCharacters, setActiveTab);
  }, [allAccounts, allCharacters]);

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
        <Header user={user} onLogout={onLogout} onSpotlight={() => setSpotlightOpen(true)} />

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
              <React.Suspense fallback={
                <div className="flex items-center justify-center p-24">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-[10px] font-display font-bold text-primary uppercase tracking-[0.4em] animate-pulse">Acessando_Dados...</p>
                  </div>
                </div>
              }>
                {mountedTabs.has('dashboard') && (
                  <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
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
                  </div>
                )}

                {mountedTabs.has('missions') && (
                  <div className={activeTab === 'missions' ? 'block' : 'hidden'}>
                    <CampaignsPanel />
                  </div>
                )}
                
                {mountedTabs.has('players') && (
                  <div className={activeTab === 'players' ? 'block' : 'hidden'}>
                    <UserRegistry isAdmin={isAdmin} />
                  </div>
                )}
                
                {mountedTabs.has('squads') && (
                  <div className={activeTab === 'squads' ? 'block' : 'hidden'}>
                    <GroupManager isAdmin={isAdmin} />
                  </div>
                )}

                {mountedTabs.has('media') && (
                  <div className={activeTab === 'media' ? 'block' : 'hidden'}>
                    <MediaLibraryPanel />
                  </div>
                )}

                {mountedTabs.has('intel') && (
                  <div className={activeTab === 'intel' ? 'block' : 'hidden'}>
                    <div className="bg-surface-container-low border border-primary/20 overflow-hidden rounded-sm shadow-xl">
                      {/* Navegação do Acervo de Intel */}
                      <div className="flex flex-wrap border-b border-primary/10 bg-black/20">
                        <IntelSubTab label="Catálogo" active={intelTab === 'catalogo'} onClick={() => setIntelTab('catalogo')} icon="hub" />
                        <IntelSubTab label="Jukebox" active={intelTab === 'jukebox'} onClick={() => setIntelTab('jukebox')} icon="queue_music" />
                        <IntelSubTab label="QR & Links" active={intelTab === 'qr'} onClick={() => setIntelTab('qr')} icon="qr_code" />
                        <IntelSubTab label="Conquistas" active={intelTab === 'conquistas'} onClick={() => setIntelTab('conquistas')} icon="emoji_events" />
                      </div>

                      <div className="p-4 sm:p-8">
                        {intelTab === 'catalogo' && <IntelCreatorPanel />}
                        {intelTab === 'jukebox' && <JukeboxPanel />}
                        {intelTab === 'qr' && <RedirectsPanel />}
                        {intelTab === 'conquistas' && <AchievementsPanel />}
                      </div>
                    </div>
                  </div>
                )}

                {mountedTabs.has('systems') && (
                  <div className={activeTab === 'systems' ? 'block' : 'hidden'}>
                    <div className="space-y-8">
                      <TerminalPanel />
                    </div>
                  </div>
                )}
              </React.Suspense>
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

      {/* Spotlight Search */}
      <SpotlightSearch open={spotlightOpen} onClose={() => setSpotlightOpen(false)} items={spotlightItems} />
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

function IntelSubTab({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon: string }) {
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

