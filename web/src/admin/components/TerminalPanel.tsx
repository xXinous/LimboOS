import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { setTerminalStateForUsers, setMacStateForUsers, fetchLimboGlobalState, setLimboMilitarySeizureGlobal, LimboGlobalState, PlayerMeta } from '../../store/firestore';
import { Terminal, ShieldBan, ShieldCheck, UserCheck, Apple } from 'lucide-react';
import { activityLogger } from '../../services/ActivityLogger';
import Screw from '../../components/player/Screw';

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
    if (selectedUids.size === users.length) setSelectedUids(new Set());
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
    <div className="space-y-8 font-chakra">
      <div className="flex items-center gap-4">
        <div className="w-2 h-8 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
        <h2 className="font-black uppercase tracking-widest text-lg text-white">Interface_de_Injeção_de_Terminais</h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* USArmy Seizure & RPG Events */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className={`bg-[#1a1a1a] border-4 p-8 rounded-xl shadow-xl flex flex-col gap-6 transition-all ${limboState.seized ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'border-[#1a1a1a]'}`}>
            <div className="flex items-center justify-between">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Estado_Global_LIMBO_01</h3>
               {limboState.seized && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </div>
            <div className="flex items-center gap-4 font-black uppercase text-xl">
              {limboState.seized ? (
                <span className="text-red-500 flex items-center gap-3"><ShieldBan size={24}/> MILITAR_LOCK</span>
              ) : (
                <span className="text-emerald-500 flex items-center gap-3"><ShieldCheck size={24}/> GRID_OPEN</span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed font-bold uppercase tracking-wide">
              O bloqueio global é **colaborativo**. Ativado automaticamente quando todos os setores forem explorados. Forçar este estado sobrescreve a lógica do grid.
            </p>
            <div className="bg-black/40 border border-white/5 p-5 rounded-sm space-y-4">
              <div className="flex justify-between items-center">
                 <span className="text-[11px] font-black text-white uppercase">{limboState.seized ? 'DESATIVAR_BLOQUEIO' : 'FORÇAR_USArmy'}</span>
                 <button
                   type="button"
                   onClick={toggleLimboMilitary}
                   className={`px-6 py-2 border-2 font-black uppercase text-[10px] tracking-widest transition-all rounded-sm ${limboState.seized ? 'bg-red-600 border-red-400 text-white' : 'bg-[#333] border-white/5 text-zinc-400 hover:bg-[#444]'} active:scale-95`}
                 >
                   {limboState.seized ? 'NORMALIZAR' : 'BLOQUEAR'}
                 </button>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-8 rounded-xl shadow-xl flex flex-col gap-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Protocolos_RPG_Mestre</h3>
            <div className="flex items-center justify-between p-5 bg-black/40 border border-white/5 rounded-sm">
              <div>
                <p className="font-black text-sm text-white uppercase">DiskRepair.exe</p>
                <p className="text-[9px] text-zinc-600 font-bold uppercase mt-1">Desmagnetização Remota</p>
              </div>
              <button
                onClick={toggleDiskRepair}
                className={`relative w-14 h-7 rounded-full transition-all border-2 ${diskRepairAllowed ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(255,140,0,0.2)]' : 'bg-zinc-900 border-zinc-800'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 ${diskRepairAllowed ? 'translate-x-7 bg-primary shadow-[0_0_8px_rgba(255,140,0,0.8)]' : 'translate-x-0 bg-zinc-800'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Remote Triggering */}
        <div className="lg:w-2/3 flex flex-col bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl shadow-xl overflow-hidden">
          <div className="p-6 border-b-4 border-[#1a1a1a] bg-black/40 flex flex-wrap gap-4 items-center">
             <button onClick={handleForceTerminal} disabled={selectedUids.size === 0} className="px-6 py-2 bg-primary text-black font-black uppercase text-[10px] tracking-widest hover:bg-primary-container transition-all disabled:opacity-10 rounded-sm flex items-center gap-3 glow-orange">
                <Terminal size={14}/> TRIGGER_DOS
             </button>
             <button onClick={handleRevokeAccess} disabled={selectedUids.size === 0} className="px-6 py-2 bg-[#333] border border-white/5 text-zinc-300 font-black uppercase text-[10px] tracking-widest hover:bg-[#444] transition-all disabled:opacity-10 rounded-sm">
                EXIT_DOS
             </button>
             <div className="w-px h-6 bg-white/5 mx-2" />
             <button onClick={handleForceMac} disabled={selectedUids.size === 0} className="px-6 py-2 bg-zinc-200 text-black font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all disabled:opacity-10 rounded-sm flex items-center gap-3 shadow-lg">
                <Apple size={14}/> BOOT_MACOS
             </button>
             <button onClick={handleRevokeMac} disabled={selectedUids.size === 0} className="px-6 py-2 bg-[#333] border border-white/5 text-zinc-300 font-black uppercase text-[10px] tracking-widest hover:bg-[#444] transition-all disabled:opacity-10 rounded-sm">
                EXIT_MAC
             </button>
          </div>

          <div className="flex-1 overflow-x-auto bg-black/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-[#1a1a1a] text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700">
                  <th className="p-5 w-16 text-center">
                    <div 
                      onClick={selectAll} 
                      className={`w-5 h-5 border-2 rounded-sm mx-auto cursor-pointer transition-all flex items-center justify-center ${selectedUids.size > 0 ? 'bg-primary border-primary' : 'border-zinc-800'}`}
                    >
                       {selectedUids.size > 0 && <span className="material-symbols-outlined text-black text-xs font-black">check</span>}
                    </div>
                  </th>
                  <th className="p-5">IDENTIFICADOR_AGENTE</th>
                  <th className="p-5 text-center">AUTORIZAÇÃO_HARDWARE</th>
                  <th className="p-5 text-right">ESTADO_EM_CAMPO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(u => (
                  <tr key={u.uid} className={`hover:bg-primary/5 transition-all group ${selectedUids.has(u.uid) ? 'bg-primary/5' : ''}`}>
                    <td className="p-5 text-center">
                       <div 
                         onClick={() => toggleSelect(u.uid)} 
                         className={`w-5 h-5 border-2 rounded-sm mx-auto cursor-pointer transition-all flex items-center justify-center ${selectedUids.has(u.uid) ? 'bg-primary border-primary' : 'border-zinc-800 group-hover:border-zinc-600'}`}
                       >
                          {selectedUids.has(u.uid) && <span className="material-symbols-outlined text-black text-xs font-black">check</span>}
                       </div>
                    </td>
                    <td className="p-5">
                       <div className="flex items-center gap-3">
                          <UserCheck size={16} className={u.hasTerminalAccess ? 'text-emerald-500' : 'text-zinc-800'} />
                          <div>
                             <p className={`text-xs font-black uppercase ${selectedUids.has(u.uid) ? 'text-primary' : 'text-zinc-400 group-hover:text-white'}`}>{u.username}</p>
                             <p className="text-[8px] font-mono text-zinc-700 font-bold uppercase mt-0.5 tracking-widest">UID: {(u.uid || "").slice(0,12)}</p>
                          </div>
                       </div>
                    </td>
                     <td className="p-5 text-center">
                        <div className="flex items-center justify-center gap-4">
                          <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border ${u.hasTerminalAccess ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' : 'border-zinc-900 text-zinc-800'}`}>DOS</div>
                          <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border ${u.hasMacAccess ? 'border-cyan-500/20 text-cyan-500 bg-cyan-500/5' : 'border-zinc-900 text-zinc-800'}`}>MAC</div>
                        </div>
                    </td>
                    <td className="p-5 text-right">
                       <div className="flex flex-col items-end gap-1">
                        {u.forceTerminalOpen && <span className="text-primary text-[9px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1"><div className="w-1 h-1 bg-primary rounded-full" /> DOS_LIVE</span>}
                        {u.forceMacOpen && <span className="text-cyan-500 text-[9px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1"><div className="w-1 h-1 bg-cyan-500 rounded-full" /> MAC_LIVE</span>}
                        {!u.forceTerminalOpen && !u.forceMacOpen && <span className="text-zinc-800 text-[9px] font-black uppercase tracking-widest">---</span>}
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
