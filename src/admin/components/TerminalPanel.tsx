import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { setTerminalStateForUsers, fetchLimboGlobalState, resetLimboSeized, LimboGlobalState, PlayerMeta } from '../../store/firestore';
import { Terminal, ShieldBan, ShieldCheck, UserCheck } from 'lucide-react';

export default function TerminalPanel() {
  const [users, setUsers] = useState<PlayerMeta[]>([]);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [limboState, setLimboState] = useState<LimboGlobalState>({ seized: false });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const u = snap.docs.map(d => d.data() as PlayerMeta);
      setUsers(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchLimboGlobalState().then(setLimboState);
    const unsubLimbo = onSnapshot(collection(db, 'system'), () => {
      fetchLimboGlobalState().then(setLimboState);
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

  const handleResetGlobalLimbo = async () => {
    if (confirm('Tem certeza que deseja desativar o bloqueio militar do Limbo para todo o mundo?')) {
      await resetLimboSeized();
    }
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
        </div>

        {/* User Selection */}
        <div className="lg:w-2/3 flex flex-col">
          <div className="flex gap-4 mb-4">
             <button onClick={handleForceTerminal} disabled={selectedUids.size === 0} className="px-4 py-2 bg-primary text-on-primary font-label uppercase text-xs tracking-wider machined-edge hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                <Terminal size={16}/> Abrir Remotamente na Tela
             </button>
             <button onClick={handleRevokeAccess} disabled={selectedUids.size === 0} className="px-4 py-2 bg-surface-container-highest border border-zinc-700 text-zinc-300 font-label uppercase text-xs tracking-wider machined-edge hover:bg-zinc-800 disabled:opacity-50">
                Revogar Acesso Limbo
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
                  <th className="p-3 font-label uppercase text-[10px] tracking-widest text-zinc-500 text-center">Acesso PC Liberado</th>
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
                    <td className="p-3 text-center">
                       {u.hasTerminalAccess ? <span className="text-green-500">SIM</span> : <span className="text-zinc-600">NÃO</span>}
                    </td>
                    <td className="p-3 text-center">
                       {u.forceTerminalOpen ? <span className="text-orange-500 animate-pulse">ABERTO</span> : <span className="text-zinc-600">-</span>}
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
