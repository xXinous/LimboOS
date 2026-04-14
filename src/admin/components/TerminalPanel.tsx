import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { setTerminalStateForUsers, setMacStateForUsers, fetchLimboGlobalState, setLimboMilitarySeizureGlobal, LimboGlobalState, PlayerMeta } from '../../store/firestore';
import { Terminal, ShieldBan, ShieldCheck, UserCheck, Apple } from 'lucide-react';
import { activityLogger } from '../../services/ActivityLogger';
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
    const uids: string[] = [...selectedUids];
    activityLogger.logTrace('gm.mpg', 'force_terminal_step', `Iniciando injeção de evento DOS para ${uids.length} usuário(s)...`);
    await setTerminalStateForUsers(uids, true, true);
    const names = users.filter(u => uids.includes(u.uid)).map(u => u.username).join(', ');
    activityLogger.logAdmin('gm.mpg', 'force_terminal', `Forçou terminal DOS para: ${names}`, { uids });
    setSelectedUids(new Set());
  };
  const handleRevokeAccess = async () => {
    if (selectedUids.size === 0) return;
    const uids: string[] = [...selectedUids];
    activityLogger.logTrace('gm.mpg', 'revoke_terminal_step', `Iniciando revogação de acesso DOS para ${uids.length} usuário(s)...`);
    await setTerminalStateForUsers(uids, false, false);
    const names = users.filter(u => uids.includes(u.uid)).map(u => u.username).join(', ');
    activityLogger.logAdmin('gm.mpg', 'revoke_terminal', `Revogou acesso DOS de: ${names}`, { uids });
    setSelectedUids(new Set());
  };
  const handleForceMac = async () => {
    if (selectedUids.size === 0) return;
    const uids: string[] = [...selectedUids];
    activityLogger.logTrace('gm.mpg', 'force_mac_step', `Iniciando injeção de boot MacOS para ${uids.length} usuário(s)...`);
    await setMacStateForUsers(uids, true, true);
    const names = users.filter(u => uids.includes(u.uid)).map(u => u.username).join(', ');
    activityLogger.logAdmin('gm.mpg', 'force_mac', `Forçou MacOS para: ${names}`, { uids });
    setSelectedUids(new Set());
  };
  const handleRevokeMac = async () => {
    if (selectedUids.size === 0) return;
    const uids: string[] = [...selectedUids];
    activityLogger.logTrace('gm.mpg', 'revoke_mac_step', `Iniciando revogação de acesso MacOS para ${uids.length} usuário(s)...`);
    await setMacStateForUsers(uids, false, false);
    const names = users.filter(u => uids.includes(u.uid)).map(u => u.username).join(', ');
    activityLogger.logAdmin('gm.mpg', 'revoke_mac', `Revogou acesso Mac de: ${names}`, { uids });
    setSelectedUids(new Set());
  };
  const toggleLimboMilitary = async () => {
    const next = !limboState.seized;
    activityLogger.logTrace('gm.mpg', 'limbo_military_step', `Limbo USArmy → ${next ? 'ATIVO' : 'INATIVO'}`);
    await setLimboMilitarySeizureGlobal(next);
    activityLogger.logAdmin('gm.mpg', 'limbo_military_toggle', `Limbo USArmy ${next ? 'ATIVADO' : 'DESATIVADO'} globalmente`, { seized: next });
  };
  const toggleDiskRepair = async () => {
    const newState = !diskRepairAllowed;
    await setDoc(doc(db, 'system', 'gameEvents'), { diskRepairAllowed: newState }, { merge: true });
    activityLogger.logAdmin('gm.mpg', 'disk_repair_toggle', `DiskRepair ${newState ? 'ATIVADO' : 'DESATIVADO'}`, { diskRepairAllowed: newState });
  };
  return (
    <div className="bg-surface-container border border-zinc-800 p-6 machined-edge mb-8">
      <div className="flex items-center gap-3 mb-6">
        <Terminal className="text-orange-500" size={24} />
        <h2 className="text-xl font-headline font-black text-on-surface uppercase tracking-tight">Controle de Terminais</h2>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        {}
        <div className="lg:w-1/3 flex flex-col gap-4">
          <div className={`p-4 border machined-edge flex flex-col gap-4 ${limboState.seized ? 'bg-red-900/20 border-red-500' : 'bg-surface-container-highest border-zinc-800'}`}>
            <h3 className="font-label uppercase text-xs tracking-widest text-zinc-400">Status Global LIMBO_01</h3>
            <div className="flex items-center gap-2 font-bold uppercase text-lg">
              {limboState.seized ? <span className="text-red-500 flex items-center gap-2"><ShieldBan size={20}/> USArmy / BLOQUEADO</span> : <span className="text-green-500 flex items-center gap-2"><ShieldCheck size={20}/> ACESSÍVEL</span>}
            </div>
            <p className="text-xs text-zinc-500">
              O bloqueio global é **colaborativo**. Ele é ativado quando todos os tópicos forem explorados pela comunidade. Como administrador, você tem controle total sobre este estado.
            </p>
            <div className="flex items-center justify-between p-3 bg-surface-container border border-zinc-700/50 rounded-sm">
              <div>
                <p className="font-bold text-sm text-zinc-300 uppercase">{limboState.seized ? 'Restaurar Acesso' : 'Forçar Bloqueio'}</p>
                <p className="text-[10px] text-zinc-500">{limboState.seized ? 'O sistema voltará ao normal' : 'Ativa a tela militar para todos'}</p>
              </div>
              <button
                type="button"
                onClick={toggleLimboMilitary}
                className={`px-4 py-2 border font-label uppercase text-[10px] tracking-wider transition-all ${limboState.seized ? 'bg-red-600 border-red-400 text-white hover:bg-red-500' : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700'} active:scale-95`}
              >
                {limboState.seized ? 'Resetar Sistema' : 'Ativar Bloqueio'}
              </button>
            </div>
          </div>
          {}
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
        {}
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
