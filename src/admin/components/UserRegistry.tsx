import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useModal } from './ConfirmModal';
import { userService } from "../../services/UserService";
import { MasterAccount, CharacterData } from "../../types/player";
import { activityLogger } from "../../services/ActivityLogger";
import RetroSpinner from '../../components/player/RetroSpinner';
import GroupManager from "./GroupManager";
import AgentDossierView from "./AgentDossierView";

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
    <section className="bg-surface-container-low border border-primary/10 relative overflow-hidden shadow-2xl text-industrial-silver/60 font-sans">
      {modal}
      
      {/* Header & Tabs */}
      <div className="flex flex-col border-b border-primary/10 bg-black/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between p-6 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-primary shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
            <div>
              <h2 className="font-display font-bold uppercase tracking-widest text-lg text-white">Gestão de Identidades</h2>
              <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">Diretório Central de Agentes e Operadores</p>
            </div>
          </div>
          <div className="flex bg-black/40 p-1 border border-white/5 rounded-sm self-start lg:self-auto">
            <TabButton active={activeSubTab === 'users'} onClick={() => setActiveSubTab('users')} label="CONTAS MESTRAS" />
            <TabButton active={activeSubTab === 'agents'} onClick={() => setActiveSubTab('agents')} label="DIRETÓRIO DE AGENTES" />
            <TabButton active={activeSubTab === 'groups'} onClick={() => setActiveSubTab('groups')} label="GESTÃO DE GRUPOS" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 pb-6 gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-display font-bold text-industrial-silver/40 tracking-widest uppercase">
              {activeSubTab === 'users' ? `${accounts.length} Contas Ativas` : activeSubTab === 'agents' ? `${allCharacters.length} Identidades em Campo` : 'Sincronização de Esquadrões'}
            </span>
          </div>
          <div className="flex flex-1 max-w-2xl gap-3">
            <div className="relative flex-1 group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/20 text-base group-focus-within:text-primary transition-colors">search</span>
              <input 
                type="text" 
                placeholder={`BUSCAR ${activeSubTab === 'users' ? 'ID OU EMAIL' : 'CODINOME OU ID'}...`} 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full bg-surface-container-lowest border border-white/5 text-[11px] font-display font-bold uppercase tracking-[0.2em] text-white pl-10 pr-3 py-3 focus:border-primary/40 outline-none rounded-sm transition-all" 
              />
            </div>
            {isAdmin && activeSubTab === 'users' && (
              <button onClick={() => setShowCreateUser(true)} className="flex items-center gap-3 bg-primary hover:bg-primary-container text-black px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest transition-all active:scale-95 glow-orange shadow-lg">
                <span className="material-symbols-outlined text-base">person_add</span> NOVO ACESSO
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 min-h-[600px] bg-black/10">
        {activeSubTab === 'groups' && <GroupManager isAdmin={isAdmin} />}

        {activeSubTab === 'users' && (
          <div className="overflow-x-auto bg-surface-container-lowest border border-white/5 shadow-inner">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-white/5 text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/30">
                  <th className="p-6">Nome Mestre</th>
                  <th className="p-6">Identificação de Rede</th>
                  <th className="p-6">Autoridade</th>
                  <th className="p-6">Registro</th>
                  <th className="p-6 text-right">Controle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.uid} className="hover:bg-primary/5 transition-all group">
                    <td className="p-6">
                      <span className="font-display font-bold text-xs text-white uppercase tracking-wider">
                        {acc.masterName || <span className="text-industrial-silver/20 italic text-[10px]">PENDENTE...</span>}
                      </span>
                    </td>
                    <td className="p-6">
                      <p className="font-mono text-[11px] text-industrial-silver/60 group-hover:text-primary transition-colors">{acc.email || "SEM_EMAIL_VINCULADO"}</p>
                      <p className="font-mono text-[9px] text-industrial-silver/20 mt-1 uppercase tracking-tighter">UID: {(acc.uid || "").slice(0, 16)}...</p>
                    </td>
                    <td className="p-6">
                      <span className={`text-[10px] font-display font-bold px-3 py-1 rounded-sm uppercase tracking-widest border ${acc.role === 'admin' ? 'border-primary/30 text-primary bg-primary/5' : 'border-white/5 text-industrial-silver/30'}`}>
                        {acc.role}
                      </span>
                    </td>
                    <td className="p-6 font-display font-bold text-[10px] text-industrial-silver/20">{acc.createdAt ? format(acc.createdAt.toDate(), "yyyy.MM.dd") : "---"}</td>
                    <td className="p-6 text-right">
                       <button onClick={() => setEditingAccount(acc)} className="p-2.5 text-industrial-silver/20 hover:text-primary hover:bg-primary/10 rounded-sm material-symbols-outlined text-xl transition-all active:scale-90" title="Configurações de Protocolo">settings</button>
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
                className="bg-surface-container-lowest border border-white/5 p-6 hover:border-primary/30 transition-all cursor-pointer group shadow-lg relative overflow-hidden active:scale-[0.98]"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rotate-45 translate-x-8 -translate-y-8 border-b border-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start justify-between mb-8">
                  <div className={`w-14 h-14 rounded-sm bg-black/40 border border-white/5 group-hover:border-primary/40 flex items-center justify-center font-display font-bold text-2xl transition-all ${item.char.agentStatus === 'vivo' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {(item.char.codinome || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <span className={`text-[9px] font-display font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
                      item.char.agentStatus === 'vivo' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 
                      item.char.agentStatus === 'morto' ? 'border-red-500/30 text-red-500 bg-red-500/5' : 
                      'border-white/5 text-industrial-silver/30'
                    }`}>
                      {item.char.agentStatus}
                    </span>
                    <div className="flex gap-1.5">
                      {[1,2,3,4,5].map(i => <div key={i} className={`w-1 h-3 rounded-full transition-all ${i <= (item.char.dangerLevel || 1) ? 'bg-primary' : 'bg-white/5'}`} />)}
                    </div>
                  </div>
                </div>
                <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">{item.char.codinome}</h4>
                <p className="font-mono text-[10px] text-industrial-silver/20 uppercase truncate tracking-tighter">ID: {item.char.id}</p>
                <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center opacity-30 group-hover:opacity-100 transition-all">
                  <span className="text-[10px] font-display font-bold text-primary uppercase tracking-[0.3em]">Sincronizar Dossiê</span>
                  <span className="material-symbols-outlined text-base text-primary">arrow_forward_ios</span>
                </div>
              </div>
            ))}
            {filteredAgents.length === 0 && (
              <div className="col-span-full py-32 text-center border border-dashed border-white/5 rounded-sm opacity-10 flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-5xl mb-4">person_search</span>
                <p className="text-[14px] font-display font-bold uppercase tracking-[0.5em]">Sinal de Agente não Localizado</p>
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
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/30 p-10 w-full max-w-xl rounded-sm shadow-2xl space-y-10 relative overflow-hidden">
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              MODIFICAÇÃO-DE-PROTOCOLO
            </div>
            
            <div className="flex justify-between items-center border-b border-white/5 pb-8 mt-2">
               <h3 className="font-display font-bold text-2xl text-white uppercase tracking-tighter">Ajustar <span className="text-primary">Diretrizes da Conta</span></h3>
               <button onClick={() => setEditingAccount(null)} className="p-3 text-industrial-silver/20 hover:text-white transition-all material-symbols-outlined rounded-sm">close</button>
            </div>
            
            <div className="space-y-10">
              <div className="bg-black/40 p-5 border border-white/5 rounded-sm shadow-inner group">
                 <span className="text-[9px] font-display font-bold text-industrial-silver/30 uppercase tracking-widest block mb-2 group-hover:text-primary transition-colors">Canal de Comunicação Autenticado</span>
                 <span className="text-sm font-mono font-bold text-primary tracking-widest">{editingAccount.email}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-4">
                    <label className="block text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mb-2">Permissões de Sistema</label>
                    <ToggleButton 
                      label="ACESSO TERMINAL" 
                      active={!!editingAccount.hasTerminalAccess} 
                      onClick={() => handleUpdateAccountFlag(editingAccount.uid, 'hasTerminalAccess', !editingAccount.hasTerminalAccess)} 
                    />
                    <ToggleButton 
                      label="ACESSO MACOS" 
                      active={!!editingAccount.hasMacAccess} 
                      onClick={() => handleUpdateAccountFlag(editingAccount.uid, 'hasMacAccess', !editingAccount.hasMacAccess)} 
                    />
                 </div>
                 <div className="space-y-4">
                    <label className="block text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mb-2">Nível de Autoridade</label>
                    <div className="relative group">
                      <select 
                        value={editingAccount.role}
                        onChange={(e) => handleUpdateAccountFlag(editingAccount.uid, 'role', e.target.value as any)}
                        className="w-full bg-surface-container-lowest border-none text-primary text-[11px] font-display font-bold px-4 py-4 outline-none transition-all uppercase rounded-sm cursor-pointer appearance-none shadow-inner"
                      >
                        <option value="player">PLAYER (RECRUTA)</option>
                        <option value="admin">ADMIN (COMANDO)</option>
                      </select>
                      <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-hover:w-full absolute bottom-0 left-0" />
                    </div>
                 </div>
              </div>

              <div className="pt-10 border-t border-white/5">
                <label className="block text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mb-6">Redefinição de Credenciais de Campo</label>
                <div className="flex gap-3">
                  <div className="relative flex-1 group">
                    <input 
                      type="password" 
                      value={resetPasswordValue} 
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                      placeholder="NOVA_SENHA_SIGILOSA..."
                      className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-mono outline-none uppercase rounded-sm transition-all shadow-inner placeholder:text-industrial-silver/10"
                    />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full absolute bottom-0 left-0" />
                  </div>
                  <button 
                    onClick={() => handleResetPassword(editingAccount.uid)}
                    disabled={resetPasswordLoading || !resetPasswordValue}
                    className="bg-primary hover:bg-primary-container disabled:opacity-20 text-black px-10 py-4 text-[11px] font-display font-bold uppercase tracking-widest transition-all rounded-sm active:scale-95 glow-orange shadow-lg"
                  >
                    Resetar
                  </button>
                </div>
                {resetPasswordFeedback && (
                  <p className={`text-[10px] font-display font-bold mt-4 uppercase tracking-widest ${resetPasswordFeedback.startsWith('ERRO') ? 'text-red-500' : 'text-emerald-500'}`}>
                    {resetPasswordFeedback}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-10 flex justify-end">
              <button 
                onClick={() => { setEditingAccount(null); setResetPasswordFeedback(null); setResetPasswordValue(""); }} 
                className="px-12 py-4 text-[11px] font-display font-bold text-industrial-silver/30 hover:text-white uppercase tracking-[0.3em] transition-all border border-transparent hover:border-white/5"
              >
                Concluir Operação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-emerald-500/30 p-10 w-full max-w-md rounded-sm shadow-2xl relative overflow-hidden">
            <div className="absolute -top-3 left-6 bg-emerald-500 px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              RECRUTAMENTO-SINTÉTICO
            </div>
            
            <h3 className="font-display font-bold text-2xl text-white uppercase tracking-tighter mb-10 border-b border-white/5 pb-8 mt-2">Nova <span className="text-emerald-500">Conexão Mestra</span></h3>
            <form onSubmit={handleCreateUser} className="space-y-8">
              <div className="group">
                <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mb-2 group-focus-within:text-emerald-500 transition-colors">Identificador Único (ID)</label>
                <input type="text" value={newUserCodinome} onChange={(e) => setNewUserCodinome(e.target.value)} placeholder="ex: agt_silva" className="w-full bg-surface-container-lowest border-none text-white px-5 py-4 text-[11px] font-mono outline-none uppercase rounded-sm shadow-inner transition-all" required />
                <div className="h-0.5 w-0 bg-emerald-500 transition-all duration-300 group-focus-within:w-full" />
              </div>
              <div className="group">
                <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mb-2 group-focus-within:text-emerald-500 transition-colors">Senha Provisória</label>
                <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••" className="w-full bg-surface-container-lowest border-none text-white px-5 py-4 text-[11px] font-mono outline-none uppercase rounded-sm shadow-inner transition-all" required minLength={6} />
                <div className="h-0.5 w-0 bg-emerald-500 transition-all duration-300 group-focus-within:w-full" />
              </div>
              {createUserFeedback && (<p className={`text-[10px] font-display font-bold mt-4 uppercase tracking-widest ${createUserFeedback.startsWith('ERRO') ? 'text-red-500' : 'text-emerald-500'}`}>{createUserFeedback}</p>)}
              <div className="pt-10 flex justify-end gap-6 items-center">
                <button type="button" onClick={() => setShowCreateUser(false)} className="text-[10px] font-display font-bold text-industrial-silver/30 hover:text-white uppercase tracking-widest transition-colors">Abortar</button>
                <button type="submit" disabled={createUserLoading} className="bg-emerald-600 text-black px-12 py-4 rounded-sm font-display font-bold text-[11px] tracking-widest uppercase hover:bg-emerald-500 transition-all active:scale-95 shadow-lg flex items-center gap-3">
                  {createUserLoading ? <RetroSpinner /> : 'REGISTRAR'}
                </button>
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
      className={`px-6 py-2.5 text-[10px] font-display font-bold tracking-[0.2em] transition-all uppercase rounded-sm ${
        active ? 'bg-primary text-black shadow-lg' : 'text-industrial-silver/30 hover:text-industrial-silver/60 hover:bg-white/5'
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
      className={`w-full flex items-center justify-between px-4 py-4 border transition-all rounded-sm shadow-inner ${
        active ? 'bg-primary/5 border-primary/40 text-primary shadow-[0_0_15px_rgba(255,140,0,0.05)]' : 'bg-surface-container-lowest border-white/5 text-industrial-silver/20 hover:border-white/10'
      }`}
    >
      <span className="text-[10px] font-display font-bold uppercase tracking-widest">{label}</span>
      <span className={`material-symbols-outlined text-2xl ${active ? 'text-primary' : 'text-industrial-silver/10'}`}>{active ? 'toggle_on' : 'toggle_off'}</span>
    </button>
  );
}
