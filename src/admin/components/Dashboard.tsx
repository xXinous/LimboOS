import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, onSnapshot, query } from 'firebase/firestore';
import Sidebar from './Sidebar';
import Header from './Header';
import UserRegistry from './UserRegistry';
import AudioBuffer from './AudioBuffer';
import AnalyticsPanel from './AnalyticsPanel';
import TechSpecs from './TechSpecs';
import AchievementsPanel from './AchievementsPanel';
import TerminalPanel from './TerminalPanel';
import InventoryManager from './InventoryManager';

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
  const [activeTab, setActiveTab] = useState('users');
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalAudios: 0, totalPlays: 0 });
  const [sessionTime, setSessionTime] = useState(() => new Date().toISOString().substr(11, 8));

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { setIsAdmin(false); return; }
      // The admin dashboard only allows gm.mpg to login, so they're always admin
      setIsAdmin(true);
    };
    checkAdmin();
  }, [user]);

  // Real-time session clock — ticks every second
  useEffect(() => {
    const tick = () => setSessionTime(new Date().toISOString().substr(11, 8));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time stats
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Users count
    unsubs.push(onSnapshot(collection(db, 'users'), (snap) => {
      setStats(prev => ({ ...prev, totalUsers: snap.size }));
    }));

    // Audios count
    unsubs.push(onSnapshot(collection(db, 'audios'), (snap) => {
      setStats(prev => ({ ...prev, totalAudios: snap.size }));
    }));

    // Play events count
    unsubs.push(onSnapshot(collection(db, 'playEvents'), (snap) => {
      setStats(prev => ({ ...prev, totalPlays: snap.size }));
    }));

    return () => unsubs.forEach(u => u());
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-[0.03] z-100 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_2px,3px_100%]"></div>
      
      <Header user={user} onLogout={onLogout} />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="ml-64 pt-20 px-8 pb-12">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Stats Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-zinc-800 p-5 relative overflow-hidden machined-edge">
              <div className="absolute top-0 right-0 p-2 text-[8px] font-label text-zinc-700">MOD-001</div>
              <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Total_Users</p>
              <p className="text-3xl font-headline font-bold text-primary-container tracking-tighter">{stats.totalUsers}</p>
              <div className="mt-2 flex gap-0.5">
                {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-3 ${i <= Math.min(5, stats.totalUsers) ? 'bg-orange-500' : 'bg-zinc-800'}`}></div>)}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-zinc-800 p-5 relative overflow-hidden machined-edge">
              <div className="absolute top-0 right-0 p-2 text-[8px] font-label text-zinc-700">MOD-002</div>
              <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Audio_Files</p>
              <p className="text-3xl font-headline font-bold text-tertiary tracking-tighter">{stats.totalAudios}</p>
              <div className="mt-2 flex gap-0.5">
                {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-3 ${i <= Math.min(5, stats.totalAudios) ? 'bg-tertiary' : 'bg-zinc-800'}`}></div>)}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-zinc-800 p-5 relative overflow-hidden machined-edge">
              <div className="absolute top-0 right-0 p-2 text-[8px] font-label text-zinc-700">MOD-003</div>
              <p className="font-label text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Total_Plays</p>
              <p className="text-3xl font-headline font-bold text-secondary tracking-tighter">{stats.totalPlays}</p>
              <div className="mt-2 flex gap-0.5">
                {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-3 ${i <= Math.min(5, Math.ceil(stats.totalPlays / 10)) ? 'bg-secondary' : 'bg-zinc-800'}`}></div>)}
              </div>
            </div>

            <div className="bg-surface-container-highest/80 backdrop-blur-xl border border-orange-500/20 p-5 flex flex-col justify-center machined-edge">
              <p className="font-label text-[10px] uppercase tracking-widest text-orange-500/70 mb-1">Session_Active</p>
              <p className="text-2xl font-headline font-bold text-on-surface tracking-tighter">
                {sessionTime}
              </p>
              <p className="font-label text-[8px] uppercase tracking-widest text-zinc-600 mt-1">ADMIN_MODE</p>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'users' && <UserRegistry isAdmin={isAdmin} />}
          {activeTab === 'inventory' && <InventoryManager />}
          {activeTab === 'audio' && (
            <AudioBuffer user={user} isAdmin={isAdmin} />
          )}
          {activeTab === 'achievements' && <AchievementsPanel />}
          {activeTab === 'analytics' && <AnalyticsPanel />}
          {activeTab === 'terminals' && <TerminalPanel />}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <AudioBuffer user={user} isAdmin={isAdmin} />
              </div>
              <div>
                <TechSpecs />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
