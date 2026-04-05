import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { setTerminalStateForUsers, setMacStateForUsers, fetchLimboGlobalState, resetLimboSeized, LimboGlobalState, PlayerMeta } from '../../store/firestore';
import { Terminal, ShieldBan, ShieldCheck, UserCheck, Apple } from 'lucide-react';

export default function TerminalPanel() {
  const [users, setUsers] = useState<PlayerMeta[]>([]);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [limboState, setLimboState] = useState<LimboGlobalState>({ seized: false });
  const [diskRepairAllowed, setDiskRepairAllowed] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const u = snap.docs.map(d => d.data() as PlayerMeta);
      setUsers(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchLimboGlobalState().then(setLimboState);
    const unsubLimbo = onSnapshot(collection(db, 'system'), (snap) => {
      fetchLimboGlobalState().then(setLimboState);
      
      const gameEventsDoc = snap.docs.find(d => d.id === 'gameEvents');
      if (gameEventsDoc) {
        setDiskRepairAllowed(!!gameEventsDoc.data().diskRepairAllowed);
      }
    });
    return () => unsubLimbo();
  }, []);

  const toggleSelect = (uid: string) => {
    const newSet = new Set(selectedUids);
    if (newSet.has(uid)) newSet.delete(uid);
    else newSet.add(uid);
    setSelectedUids(newSet);
  };

  const selectAll = () => {
    if (selectedUids.size === users.length) setSelectedUids(newSet => new Set());
    else setSelectedUids(new Set(users.map(u => u.uid)));
  };

  const handleForceTerminal = async () => {
    if (selectedUids.size === 0) return;
    await setTerminalStateForUsers(Array.from(selectedUids), true, true);
    setSelectedUids(new Set());
  };

  const handleRevokeAccess = async () => {
    if (selectedUids.size === 0) return;
    await setTerminalStateForUsers(Array.from(selectedUids), false, false);
    setSelectedUids(new Set());
  };

  const handleForceMac = async () => {
    if (selectedUids.size === 0) return;
    await setMacStateForUsers(Array.from(selectedUids), true, true);
    setSelectedUids(new Set());
  };

  const handleRevokeMac = async () => {
    if (selectedUids.size === 0) return;
    await setMacStateForUsers(Array.from(selectedUids), false, false);
    setSelectedUids(new Set());
  };

  const handleResetGlobalLimbo = async () => {
    if (confirm('Tem certeza que deseja desativar o bloqueio militar do Limbo para todo o mundo?')) {
      await resetLimboSeized();
    }
  };

  const toggleDiskRepair = async () => {
    const newState = !diskRepairAllowed;
    await setDoc(doc(db, 'system', 'gameEvents'), { diskRepairAllowed: newState }, { merge: true });
  };

  return (
    <div className="bg-surface-container border border-zinc-800 p-6 machined-edge mb-8">
      <div className="flex items-center gap-3 mb-6">
        <Terminal className="text-orange-500" size={24} />
        <h2 className="text-xl font-headline font-black text-on-surface uppercase tracking-tight">Controle de Terminais</h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Global Controls */}
        <div className="lg:w-1/3 flex flex-col gap-4">
          <div className={`p-4 border machined-edge flex flex-col gap-4 ${limboState.seized ? 'bg-red-900/20 border-red-500' : 'bg-surface-container-highest border-zinc-800'}`}>
            <h3 className="font-label uppercase text-xs tracking-widest text-zinc-400">Status Global LIMBO_01</h3>
            <div className="flex items-center gap-2 font-bold uppercase text-lg">
              {limboState.seized ? <span className="text-red-500 flex items-center gap-2"><ShieldBan size={20}/> MILITARY SEIZED</span> : <span className="text-green-500 flex items-center gap-2"><ShieldCheck size={20}/> NORMAL</span>}
            </div>
            {limboState.seized && (
              <button onClick={handleResetGlobalLimbo} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs tracking-widest transition-colors machined-edge">
                Resetar Evento Global
              </button>
            )}
            {!limboState.seized && (
               <p className="text-xs text-zinc-500">Nenhum evento em andamento. Administre os terminais individuais à direita.</p>
            )}
          </div>

          {/* RPG Events */}
          <div className="p-4 border machined-edge bg-surface-container-highest border-zinc-800 flex flex-col gap-4">
            <h3 className="font-label uppercase text-xs tracking-widest text-zinc-400">Eventos de RPG (Mestre)</h3>
            <div className="flex items-center justify-between p-3 bg-surface-container border border-zinc-700/50">
              <div>
                <p className="font-bold text-sm text-zinc-300 uppercase">DiskRepair.exe</p>
                <p className="text-[10px] text-zinc-500">Permitir desmagnetização do disquete</p>
              </div>
              <button
                onClick={toggleDiskRepair}
                className={`relative w-12 h-6 rounded-full transition-colors ${diskRepairAllowed ? 'bg-orange-500' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${diskRepairAllowed ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

        </div>

        {/* User Selection */}
        <div className="lg:w-2/3 flex flex-col">
          <div className="flex flex-wrap gap-4 mb-4">
             <button onClick={handleForceTerminal} disabled={selectedUids.size === 0} className="px-4 py-2 bg-primary text-on-primary font-label uppercase text-xs tracking-wider machined-edge hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                <Terminal size={16}/> Abrir Terminal Remotamente
             </button>
             <button onClick={handleRevokeAccess} disabled={selectedUids.size === 0} className="px-4 py-2 bg-surface-container-highest border border-zinc-700 text-zinc-300 font-label uppercase text-xs tracking-wider machined-edge hover:bg-zinc-800 disabled:opacity-50">
                Revogar DOS
             </button>
             <div className="w-px h-8 bg-zinc-800 self-center hidden sm:block" />
             <button onClick={handleForceMac} disabled={selectedUids.size === 0} className="px-4 py-2 bg-[#eee] text-black font-label uppercase text-xs tracking-wider machined-edge hover:bg-white disabled:opacity-50 flex items-center gap-2">
                <Apple size={16}/> Abrir MacOS Remotamente
             </button>
             <button onClick={handleRevokeMac} disabled={selectedUids.size === 0} className="px-4 py-2 bg-surface-container-highest border border-zinc-700 text-zinc-300 font-label uppercase text-xs tracking-wider machined-edge hover:bg-zinc-800 disabled:opacity-50">
                Revogar Mac
             </button>
          </div>

          <div className="bg-surface-container-lowest border border-zinc-800 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container-highest border-b border-zinc-800">
                <tr>
                  <th className="p-3 w-12 text-center">
                    <input type="checkbox" onChange={selectAll} checked={selectedUids.size > 0 && selectedUids.size === users.length} className="accent-orange-500 w-4 h-4" />
                  </th>
                  <th className="p-3 font-label uppercase text-[10px] tracking-widest text-zinc-500">Usuário</th>
                  <th className="p-3 font-label uppercase text-[10px] tracking-widest text-zinc-500 text-center">PC/Mac Liberado</th>
                  <th className="p-3 font-label uppercase text-[10px] tracking-widest text-zinc-500 text-center">Na Tela (Forçado)</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.uid} className={`border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors ${selectedUids.has(u.uid) ? 'bg-orange-500/5' : ''}`}>
                    <td className="p-3 text-center">
                       <input type="checkbox" checked={selectedUids.has(u.uid)} onChange={() => toggleSelect(u.uid)} className="accent-orange-500 w-4 h-4" />
                    </td>
                    <td className="p-3 font-mono text-zinc-300 flex items-center gap-2">
                       <UserCheck size={14} className={u.hasTerminalAccess ? 'text-green-500' : 'text-zinc-600'} />
                       {u.username}
                    </td>
                     <td className="p-3 text-center flex flex-col items-center gap-1">
                        <div className="flex gap-4">
                          <span className={u.hasTerminalAccess ? 'text-green-500' : 'text-zinc-600'}>DOS: {u.hasTerminalAccess ? 'OK' : '-'}</span>
                          <span className={u.hasMacAccess ? 'text-blue-400' : 'text-zinc-600'}>MAC: {u.hasMacAccess ? 'OK' : '-'}</span>
                        </div>
                    </td>
                    <td className="p-3 text-center">
                       <div className="flex flex-col gap-1">
                        {u.forceTerminalOpen && <span className="text-orange-500 text-[10px] animate-pulse">DOS ATIVO</span>}
                        {u.forceMacOpen && <span className="text-blue-500 text-[10px] animate-pulse">MAC ATIVO</span>}
                        {!u.forceTerminalOpen && !u.forceMacOpen && <span className="text-zinc-600">-</span>}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
