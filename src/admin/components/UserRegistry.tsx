import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useModal } from './ConfirmModal';
import { userService } from "../../services/UserService";
import { MasterAccount, CharacterData } from "../../types/player";
import { activityLogger } from "../../services/ActivityLogger";
import GroupManager from "./GroupManager";
import AgentDossierView from "./AgentDossierView";
import Screw from "../../components/player/Screw";

type SubTab = 'users' | 'agents' | 'groups';

export default function UserRegistry({ isAdmin }: { isAdmin: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('users');
  const [accounts, setAccounts] = useState<MasterAccount[]>([]);
  const [allCharacters, setAllCharacters] = useState<{uid: string, char: CharacterData}[]>([]);
  const { modal } = useModal();
  const [searchQuery, setSearchQuery] = useState("");
  
  const [editingAccount, setEditingAccount] = useState<MasterAccount | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<{uid: string, char: CharacterData} | null>(null);
  
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserCodinome, setNewUserCodinome] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("player");
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserFeedback, setCreateUserFeedback] = useState<string | null>(null);

  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordFeedback, setResetPasswordFeedback] = useState<string | null>(null);

  const refreshAgents = async () => {
    const agents: {uid: string, char: CharacterData}[] = [];
    for (const acc of accounts) {
      const chars = await userService.fetchCharactersForUser(acc.uid);
      chars.forEach(char => agents.push({ uid: acc.uid, char }));
    }
    setAllCharacters(agents);
  };

  useEffect(() => {
    const unsubUsers = userService.subscribeToUsers(async (fetchedAccounts) => {
      setAccounts(fetchedAccounts);
      
      const agents: {uid: string, char: CharacterData}[] = [];
      for (const acc of fetchedAccounts) {
        const chars = await userService.fetchCharactersForUser(acc.uid);
        chars.forEach(char => agents.push({ uid: acc.uid, char }));
      }
      setAllCharacters(agents);
    });
    return () => unsubUsers();
  }, [accounts.length]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserCodinome.trim() || !newUserPassword.trim()) return;
    setCreateUserLoading(true);
    try {
      await userService.createSyntheticUser(newUserCodinome, newUserPassword, newUserRole as any);
      setCreateUserFeedback(`Sucesso: "${newUserCodinome}" registrado.`);
      setNewUserCodinome(""); setNewUserPassword("");
    } catch (error: any) { setCreateUserFeedback(`ERRO: ${error.message}`); }
    finally { setCreateUserLoading(false); }
  };

  const handleResetPassword = async (uid: string) => {
    if (!resetPasswordValue.trim() || resetPasswordLoading) return;
    setResetPasswordLoading(true);
    setResetPasswordFeedback(null);
    try {
      await userService.resetUserPassword(uid, resetPasswordValue.trim());
      setResetPasswordFeedback("✓ Senha alterada com sucesso.");
      setResetPasswordValue("");
    } catch (err: any) {
      setResetPasswordFeedback(`ERRO: ${err.message}`);
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleUpdateAccountFlag = async (uid: string, flag: keyof MasterAccount, value: boolean) => {
    try {
      await userService.updateMasterAccount(uid, { [flag]: value });
      setEditingAccount(prev => prev ? { ...prev, [flag]: value } : null);
    } catch (err) {
      console.error("Error updating account flag:", err);
    }
  };

  const filteredAccounts = accounts.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (a.email || "").toLowerCase().includes(q) || 
           (a.uid || "").toLowerCase().includes(q) || 
           (a.masterName || "").toLowerCase().includes(q);
  });

  const filteredAgents = allCharacters.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (item.char.codinome || "").toLowerCase().includes(q) || (item.char.id || "").toLowerCase().includes(q);
  });

  return (
    <section className="bg-[#222] border-4 border-[#1a1a1a] relative overflow-hidden rounded-2xl shadow-2xl text-zinc-300 font-chakra">
      {modal}
      
      {/* Header & Tabs */}
      <div className="flex flex-col border-b-4 border-[#1a1a1a] bg-black/40">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="w-2 h-8 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
            <h2 className="font-black uppercase tracking-widest text-lg text-white">Central_de_Inteligência_de_Usuários</h2>
          </div>
          <div className="flex bg-black/60 p-1 rounded-sm border border-[#1a1a1a]">
            <TabButton active={activeSubTab === 'users'} onClick={() => setActiveSubTab('users')} label="CONTAS_MESTRAS" />
            <TabButton active={activeSubTab === 'agents'} onClick={() => setActiveSubTab('agents')} label="DIRETÓRIO_DE_AGENTES" />
            <TabButton active={activeSubTab === 'groups'} onClick={() => setActiveSubTab('groups')} label="GESTÃO_DE_GRUPOS" />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 pb-6 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
              {activeSubTab === 'users' ? `${accounts.length} Contas Ativas` : activeSubTab === 'agents' ? `${allCharacters.length} Identidades em Campo` : 'Sincronização de Esquadrões'}
            </span>
          </div>
          <div className="flex flex-1 max-w-xl gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-600 text-xs">search</span>
              <input 
                type="text" 
                placeholder={`BUSCAR_${activeSubTab === 'users' ? 'ID_OU_EMAIL' : 'CODINOME_OU_ID'}...`} 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full bg-black/40 border border-[#1a1a1a] text-[10px] font-bold uppercase tracking-widest text-white pl-10 pr-3 py-2.5 focus:ring-1 focus:ring-primary outline-none rounded-sm" 
              />
            </div>
            {isAdmin && activeSubTab === 'users' && (
              <button onClick={() => setShowCreateUser(true)} className="flex items-center gap-2 bg-primary/10 text-primary px-6 py-2.5 rounded-sm font-black text-[10px] tracking-widest hover:bg-primary/20 transition-all border border-primary/20 uppercase active:scale-95 glow-orange">
                <span className="material-symbols-outlined text-xs">person_add</span> Novo_Acesso
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 min-h-[500px] bg-black/20">
        {activeSubTab === 'groups' && <GroupManager isAdmin={isAdmin} />}

        {activeSubTab === 'users' && (
          <div className="overflow-x-auto bg-[#1a1a1a] rounded-xl border border-white/5 shadow-inner">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-[#1a1a1a] text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <th className="p-5">Nome_Mestre</th>
                  <th className="p-5">Identificação_de_Rede</th>
                  <th className="p-5">Autoridade</th>
                  <th className="p-5">Registro</th>
                  <th className="p-5 text-right">Controle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.uid} className="hover:bg-primary/5 transition-all group">
                    <td className="p-5 font-black text-xs text-white">
                      {acc.masterName || <span className="text-zinc-700 italic text-[10px]">PENDENTE...</span>}
                    </td>
                    <td className="p-5">
                      <p className="font-mono text-[11px] text-zinc-400 group-hover:text-primary transition-colors">{acc.email || "SEM_EMAIL_VINCULADO"}</p>
                      <p className="font-mono text-[9px] text-zinc-600 opacity-40 mt-1 uppercase">UID: {(acc.uid || "").slice(0, 16)}...</p>
                    </td>
                    <td className="p-5">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-sm uppercase tracking-widest ${acc.role === 'admin' ? 'bg-primary text-black' : 'bg-[#333] text-zinc-500'}`}>
                        {acc.role}
                      </span>
                    </td>
                    <td className="p-5 font-bold text-[10px] text-zinc-600">{acc.createdAt ? format(acc.createdAt.toDate(), "yyyy/MM/dd") : "---"}</td>
                    <td className="p-5 text-right">
                       <button onClick={() => setEditingAccount(acc)} className="p-2.5 text-zinc-600 hover:text-primary hover:bg-primary/10 rounded-sm material-symbols-outlined text-lg transition-all active:scale-90">settings</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeSubTab === 'agents' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAgents.map((item) => (
              <div 
                key={item.char.id} 
                onClick={() => setSelectedAgent(item)}
                className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-6 hover:border-primary/40 transition-all cursor-pointer group rounded-xl shadow-lg relative overflow-hidden active:scale-95"
              >
                <div className="absolute top-0 right-0 w-12 h-12 bg-primary/5 rotate-45 translate-x-6 -translate-y-6 border-b border-primary/10" />
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-12 h-12 rounded-sm bg-black border-2 border-[#1a1a1a] group-hover:border-primary/30 flex items-center justify-center font-black text-xl transition-all ${item.char.agentStatus === 'vivo' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {(item.char.codinome || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
                      item.char.agentStatus === 'vivo' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 
                      item.char.agentStatus === 'morto' ? 'border-red-500/30 text-red-500 bg-red-500/5' : 
                      'border-zinc-800 text-zinc-500'
                    }`}>
                      {item.char.agentStatus}
                    </span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= (item.char.dangerLevel || 1) ? 'bg-primary' : 'bg-black'}`} />)}
                    </div>
                  </div>
                </div>
                <h4 className="font-black text-sm text-white uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">{item.char.codinome}</h4>
                <p className="font-mono text-[10px] text-zinc-600 uppercase truncate">ID: {item.char.id}</p>
                <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center opacity-40 group-hover:opacity-100 transition-all">
                  <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Sincronizar_Dossiê</span>
                  <span className="material-symbols-outlined text-sm text-primary">arrow_forward_ios</span>
                </div>
              </div>
            ))}
            {filteredAgents.length === 0 && (
              <div className="col-span-full p-24 text-center border-4 border-dashed border-[#1a1a1a] rounded-2xl opacity-20 flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-5xl mb-4">person_search</span>
                <p className="text-[12px] font-black uppercase tracking-[0.4em]">Sinal_de_Agente_Não_Encontrado</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agent Dossier Modal */}
      {selectedAgent && (
        <AgentDossierView 
          uid={selectedAgent.uid} 
          character={selectedAgent.char} 
          onClose={() => setSelectedAgent(null)}
          onUpdate={refreshAgents}
        />
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] p-10 w-full max-w-xl rounded-[32px] shadow-2xl space-y-10 relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="flex justify-between items-center border-b-4 border-[#1a1a1a] pb-6 relative z-10">
               <h3 className="font-black text-xl text-white uppercase tracking-widest">Protocolos_da_Conta</h3>
               <button onClick={() => setEditingAccount(null)} className="p-2 hover:bg-white/5 text-zinc-500 hover:text-white transition-all material-symbols-outlined rounded-sm">close</button>
            </div>
            
            <div className="space-y-8 relative z-10">
              <div className="bg-black/40 p-4 border border-white/5 rounded-lg">
                 <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-2">Canal_de_Acesso (Email)</span>
                 <span className="text-sm font-black text-primary tracking-widest">{editingAccount.email}</span>
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Permissões_de_Sistema</label>
                    <ToggleButton 
                      label="ACESSO_TERMINAL" 
                      active={!!editingAccount.hasTerminalAccess} 
                      onClick={() => handleUpdateAccountFlag(editingAccount.uid, 'hasTerminalAccess', !editingAccount.hasTerminalAccess)} 
                    />
                    <ToggleButton 
                      label="ACESSO_MACOS" 
                      active={!!editingAccount.hasMacAccess} 
                      onClick={() => handleUpdateAccountFlag(editingAccount.uid, 'hasMacAccess', !editingAccount.hasMacAccess)} 
                    />
                 </div>
                 <div className="space-y-4">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Nível_de_Autoridade</label>
                    <select 
                      value={editingAccount.role}
                      onChange={(e) => handleUpdateAccountFlag(editingAccount.uid, 'role', e.target.value as any)}
                      className="w-full bg-black/60 border-2 border-[#1a1a1a] text-primary text-[10px] font-black px-4 py-3 outline-none focus:border-primary uppercase rounded-sm"
                    >
                      <option value="player">PLAYER (RECRUTA)</option>
                      <option value="admin">ADMIN (COMANDO)</option>
                    </select>
                 </div>
              </div>

              <div className="pt-8 border-t-4 border-[#1a1a1a]">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Redefinição_de_Credenciais</label>
                <div className="flex gap-3">
                  <input 
                    type="password" 
                    value={resetPasswordValue} 
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    placeholder="DIGITAR_NOVA_SENHA..."
                    className="flex-1 bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-mono focus:border-primary outline-none uppercase rounded-sm"
                  />
                  <button 
                    onClick={() => handleResetPassword(editingAccount.uid)}
                    disabled={resetPasswordLoading || !resetPasswordValue}
                    className="bg-primary hover:bg-primary-container disabled:opacity-30 text-black px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm active:scale-95 glow-orange"
                  >
                    Resetar
                  </button>
                </div>
                {resetPasswordFeedback && (
                  <p className={`text-[10px] font-bold mt-3 uppercase tracking-tighter ${resetPasswordFeedback.startsWith('ERRO') ? 'text-red-500' : 'text-emerald-500'}`}>
                    {resetPasswordFeedback}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-6 flex justify-end relative z-10">
              <button 
                onClick={() => { setEditingAccount(null); setResetPasswordFeedback(null); setResetPasswordValue(""); }} 
                className="bg-[#333] hover:bg-[#444] text-zinc-300 px-10 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm"
              >
                Concluir_Operação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] p-10 w-full max-w-md rounded-[32px] shadow-2xl relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <h3 className="font-black text-xl text-white uppercase tracking-widest mb-8 border-b-4 border-[#1a1a1a] pb-6 relative z-10">Nova_Conexão_Mestra</h3>
            <form onSubmit={handleCreateUser} className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Identificador (ID)</label>
                <input type="text" value={newUserCodinome} onChange={(e) => setNewUserCodinome(e.target.value)} placeholder="ex: agt_silva" className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-5 py-4 text-[11px] font-mono focus:border-emerald-500 outline-none uppercase rounded-sm" required />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Senha_Provisória</label>
                <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••" className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-5 py-4 text-[11px] font-mono focus:border-emerald-500 outline-none rounded-sm" required minLength={6} />
              </div>
              {createUserFeedback && (<p className={`text-[10px] font-black mt-2 uppercase tracking-tighter ${createUserFeedback.startsWith('ERRO') ? 'text-red-500' : 'text-emerald-500'}`}>{createUserFeedback}</p>)}
              <div className="pt-8 flex justify-end gap-6 items-center">
                <button type="button" onClick={() => setShowCreateUser(false)} className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors">ABORTAR</button>
                <button type="submit" disabled={createUserLoading} className="bg-emerald-600 text-white px-10 py-4 text-[10px] font-black tracking-widest uppercase hover:bg-emerald-500 transition-all rounded-sm active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.2)]">{createUserLoading ? 'SINC...' : 'REGISTRAR'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button 
      onClick={onClick} 
      className={`px-5 py-2 text-[10px] font-black tracking-widest transition-all uppercase rounded-sm ${
        active ? 'bg-primary text-black' : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  );
}

function ToggleButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 border-2 transition-all rounded-sm ${
        active ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-black/40 border-[#1a1a1a] text-zinc-700'
      }`}
    >
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      <span className={`material-symbols-outlined text-xl ${active ? 'text-primary' : 'text-zinc-800'}`}>{active ? 'toggle_on' : 'toggle_off'}</span>
    </button>
  );
}
