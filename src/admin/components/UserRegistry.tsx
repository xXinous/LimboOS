import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useModal } from './ConfirmModal';
import { userService } from "../../services/UserService";
import { MasterAccount, CharacterData, PlayerStats } from "../../types/player";
import { db } from "../../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { activityLogger } from "../../services/ActivityLogger";
import GroupManager from "./GroupManager";

interface AudioData {
  id: string;
  originalName: string;
}

export default function UserRegistry({ isAdmin }: { isAdmin: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'groups'>('users');
  const [accounts, setAccounts] = useState<MasterAccount[]>([]);
  const { showAlert, modal } = useModal();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingAccount, setEditingAccount] = useState<MasterAccount | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [accountCharacters, setAccountCharacters] = useState<Record<string, CharacterData[]>>({});
  const [selectedChar, setSelectedChar] = useState<{ uid: string; char: CharacterData } | null>(null);
  
  const [charDetails, setCharDetails] = useState<Record<string, any>>({});
  const [userTotalPlays, setUserTotalPlays] = useState<Record<string, number>>({});
  const [availableAudios, setAvailableAudios] = useState<AudioData[]>([]);
  
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserCodinome, setNewUserCodinome] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("player");
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserFeedback, setCreateUserFeedback] = useState<string | null>(null);

  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordFeedback, setResetPasswordFeedback] = useState<string | null>(null);

  const [addTapeModal, setAddTapeModal] = useState<{ uid: string; charId: string } | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");

  useEffect(() => {
    const unsubUsers = userService.subscribeToUsers(setAccounts);
    const unsubPlays = userService.subscribeToUserTotalPlays(setUserTotalPlays);
    const unsubAudios = onSnapshot(collection(db, "audios"), (snapshot) => {
      const audios: AudioData[] = [];
      snapshot.forEach((d) => audios.push({ id: d.id, originalName: d.data().originalName || d.id }));
      setAvailableAudios(audios);
    });
    return () => { unsubUsers(); unsubPlays(); unsubAudios(); };
  }, []);

  const loadAccountCharacters = async (uid: string) => {
    try {
      const chars = await userService.fetchCharactersForUser(uid);
      setAccountCharacters(prev => ({ ...prev, [uid]: chars }));
    } catch (err) { console.error(err); }
  };

  const loadCharacterDetails = async (uid: string, charId: string) => {
    try {
      const details = await userService.loadUserDetails(uid, charId);
      setCharDetails(prev => ({ ...prev, [charId]: details }));
    } catch (error: any) { console.error("Error loading character details:", error); }
  };

  const toggleExpandAccount = (uid: string) => {
    if (expandedAccount === uid) {
      setExpandedAccount(null);
    } else {
      setExpandedAccount(uid);
      loadAccountCharacters(uid);
    }
  };

  const handleSelectCharacter = (uid: string, char: CharacterData) => {
    if (selectedChar?.char.id === char.id) {
      setSelectedChar(null);
    } else {
      setSelectedChar({ uid, char });
      if (!charDetails[char.id]) loadCharacterDetails(uid, char.id);
    }
  };

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

  const handleDeleteCharacter = async (uid: string, charId: string, codinome: string) => {
    if (!window.confirm(`TEM CERTEZA? Isso excluirá permanentemente o agente "${codinome}" e todo o seu progresso.`)) return;
    try {
      await userService.deleteCharacter(uid, charId);
      loadAccountCharacters(uid);
      if (selectedChar?.char.id === charId) setSelectedChar(null);
      activityLogger.logAdmin('gm.mpg', 'character_delete', `Excluiu agente ${codinome} (${uid})`);
    } catch (err) {
      console.error("Error deleting character:", err);
    }
  };

  const executeAddTape = async () => {
    if (!addTapeModal || !selectedAudioId) return;
    try {
      await userService.addUserTape(addTapeModal.uid, addTapeModal.charId, selectedAudioId);
      await loadCharacterDetails(addTapeModal.uid, addTapeModal.charId);
      setAddTapeModal(null);
      setSelectedAudioId("");
    } catch (error: any) { console.error("Error adding tape:", error); }
  };

  const filteredAccounts = accounts.filter(
    (a) => a.email.toLowerCase().includes(searchQuery.toLowerCase()) || a.uid.includes(searchQuery)
  );

  return (
    <section className="bg-surface border border-zinc-800 relative overflow-hidden machined-edge text-zinc-300">
      {modal}
      <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="w-2 h-6 bg-orange-600"></div>
            <h2 className="font-headline font-bold uppercase tracking-widest text-lg">Central_de_Contas_Mestras</h2>
          </div>
          <div className="flex bg-zinc-950 p-1 rounded-sm border border-zinc-800">
            <button onClick={() => setActiveSubTab('users')} className={`px-4 py-1.5 text-[10px] font-label font-bold tracking-widest transition-all ${activeSubTab === 'users' ? 'bg-orange-600 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>LISTA_DE_CONTAS</button>
            <button onClick={() => setActiveSubTab('groups')} className={`px-4 py-1.5 text-[10px] font-label font-bold tracking-widest transition-all ${activeSubTab === 'groups' ? 'bg-orange-600 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>GESTÃO_DE_GRUPOS</button>
          </div>
        </div>

        {activeSubTab === 'users' && (
          <div className="flex items-center justify-between px-6 pb-6 gap-4">
            <span className="text-[10px] font-label text-zinc-500 tracking-wider uppercase">{accounts.length} Contas Registradas</span>
            <div className="flex flex-1 max-w-xl gap-2">
              <input type="text" placeholder="BUSCAR_ID_OU_EMAIL..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 text-[10px] font-label uppercase tracking-widest focus:ring-1 focus:ring-orange-500 px-3 py-2 outline-none" />
              {isAdmin && (
                <button onClick={() => setShowCreateUser(true)} className="flex items-center gap-1.5 bg-emerald-900/30 text-emerald-400 px-4 py-2 rounded-sm font-label text-[10px] font-bold tracking-widest hover:bg-emerald-800/40 transition-all border border-emerald-700/20">
                  <span className="material-symbols-outlined text-xs">person_add</span> NOVO_ACESSO
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 min-h-[400px]">
        {activeSubTab === 'groups' ? (
          <GroupManager isAdmin={isAdmin} />
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-800 font-label text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="p-4">Identificador Mestre</th>
                  <th className="p-4">Email de Link</th>
                  <th className="p-4">Criação</th>
                  <th className="p-4 text-center">Agentes</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredAccounts.map((acc) => (
                  <React.Fragment key={acc.uid}>
                    <tr className={`hover:bg-zinc-900/50 transition-colors cursor-pointer ${expandedAccount === acc.uid ? 'bg-zinc-900/30' : ''}`} onClick={() => toggleExpandAccount(acc.uid)}>
                      <td className="p-4 font-headline font-bold text-sm text-zinc-200">{acc.uid.slice(0, 12)}...</td>
                      <td className="p-4 font-body text-[11px] text-zinc-500">{acc.email}</td>
                      <td className="p-4 font-body text-[11px] text-zinc-500">{acc.createdAt ? format(acc.createdAt.toDate(), "yyyy/MM/dd") : "---"}</td>
                      <td className="p-4 text-center"><span className="bg-zinc-800 px-2 py-0.5 rounded-full text-[10px] text-orange-500 font-bold">{accountCharacters[acc.uid]?.length || 0}</span></td>
                      <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                         <button onClick={() => setEditingAccount(acc)} className="p-1.5 text-zinc-500 hover:text-orange-400 material-symbols-outlined text-sm">settings</button>
                         <button onClick={() => toggleExpandAccount(acc.uid)} className={`p-1.5 material-symbols-outlined text-sm ${expandedAccount === acc.uid ? 'text-orange-500' : 'text-zinc-500'}`}>{expandedAccount === acc.uid ? 'expand_less' : 'expand_more'}</button>
                      </td>
                    </tr>
                    {expandedAccount === acc.uid && (
                      <tr>
                        <td colSpan={5} className="bg-zinc-950 p-4 border-l-2 border-orange-600">
                          <div className="space-y-4">
                            <h4 className="font-label text-[10px] text-zinc-600 uppercase tracking-widest font-black ml-2">Sub-Personagens (Agentes Ativos)</h4>
                            <div className="grid grid-cols-1 gap-2">
                              {accountCharacters[acc.uid]?.map(char => (
                                <div key={char.id} className="group">
                                  <div onClick={() => handleSelectCharacter(acc.uid, char)} className={`flex items-center justify-between p-4 border ${selectedChar?.char.id === char.id ? 'border-orange-500/50 bg-orange-950/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40'} transition-all cursor-pointer`}>
                                    <div className="flex items-center gap-4">
                                      <div className={`w-8 h-8 rounded-sm bg-zinc-800 flex items-center justify-center font-bold text-xs ${char.agentStatus === 'vivo' ? 'text-green-500' : 'text-red-500'}`}>{char.codinome[0]}</div>
                                      <div>
                                        <div className="text-xs font-headline font-bold uppercase">{char.codinome}</div>
                                        <div className="text-[8px] font-mono opacity-40">Status: {char.agentStatus} // Nível: {char.dangerLevel}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(acc.uid, char.id, char.codinome); }} className="p-1.5 text-zinc-700 hover:text-red-500 material-symbols-outlined text-xs transition-colors">delete</button>
                                      <span className="material-symbols-outlined text-sm opacity-20 group-hover:opacity-100 transition-opacity">{selectedChar?.char.id === char.id ? 'expand_less' : 'expand_more'}</span>
                                    </div>
                                  </div>
                                  {selectedChar?.char.id === char.id && (
                                    <div className="p-6 bg-zinc-900/20 border-x border-b border-orange-500/20 space-y-6 animate-in slide-in-from-top-1 duration-200">
                                      <div className="flex justify-between items-center">
                                        <div className="text-[10px] font-label font-bold uppercase tracking-widest text-zinc-500">Registros do Agente</div>
                                        <button onClick={() => setAddTapeModal({ uid: acc.uid, charId: char.id })} className="text-[9px] font-label font-bold text-orange-500 border border-orange-500/20 px-3 py-1 hover:bg-orange-500/10 uppercase transition-all">Liberar Arquivo</button>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <StatBox label="Tempo Escuta" value={formatSecs(charDetails[char.id]?.stats?.totalListenTime || 0)} />
                                        <StatBox label="Fitas" value={charDetails[char.id]?.tapes?.length || 0} />
                                        <StatBox label="Cliques" value={charDetails[char.id]?.stats?.fidgetClicks || 0} />
                                        <StatBox label="Danger" value={char.dangerLevel} />
                                      </div>
                                      {charDetails[char.id]?.tapes?.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                                          {charDetails[char.id].tapes.map((t: any) => (
                                            <div key={t.id} className="text-[9px] bg-zinc-950 p-2 border border-zinc-800 flex justify-between uppercase">
                                              <span>{availableAudios.find(a => a.id === t.id)?.originalName || t.id}</span>
                                              <button onClick={async () => { await userService.removeUserTape(acc.uid, char.id, t.id); loadCharacterDetails(acc.uid, char.id); }} className="text-red-500 opacity-50 hover:opacity-100 material-symbols-outlined text-xs">close</button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {accountCharacters[acc.uid]?.length === 0 && <div className="p-8 text-center text-[10px] uppercase opacity-30 border border-dashed border-zinc-800">Nenhum agente vinculado</div>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Tape Modal */}
      {addTapeModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-zinc-900 border border-orange-500/20 p-8 w-full max-w-md machined-edge shadow-2xl">
            <h3 className="font-headline text-lg text-zinc-100 uppercase tracking-widest font-bold mb-6">Liberar_Audio_para_Agente</h3>
            <select value={selectedAudioId} onChange={(e) => setSelectedAudioId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-3 text-sm focus:border-orange-500 outline-none mb-8">
              <option value="">-- SELECIONAR RECURSO --</option>
              {availableAudios.map((audio) => (<option key={audio.id} value={audio.id}>{audio.originalName}</option>))}
            </select>
            <div className="flex justify-end gap-4">
              <button onClick={() => setAddTapeModal(null)} className="text-[10px] font-label font-bold text-zinc-500 hover:text-white uppercase tracking-widest">Cancelar</button>
              <button onClick={executeAddTape} disabled={!selectedAudioId} className="bg-orange-600 text-white px-8 py-2 text-[10px] font-label font-bold tracking-widest uppercase">Vincular</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 w-full max-w-md machined-edge shadow-2xl space-y-8">
            <h3 className="font-headline text-lg text-zinc-100 uppercase tracking-widest font-bold mb-6 border-b border-zinc-800 pb-4">Ajustes_da_Conta: {editingAccount.email}</h3>
            
            <div className="space-y-4">
              <label className="block font-label text-[10px] text-zinc-500 uppercase tracking-widest">Segurança_e_Credenciais</label>
              <div className="flex gap-2">
                <input 
                  type="password" 
                  value={resetPasswordValue} 
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  placeholder="NOVA_SENHA..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 text-xs focus:border-orange-500 outline-none"
                />
                <button 
                  onClick={() => handleResetPassword(editingAccount.uid)}
                  disabled={resetPasswordLoading || !resetPasswordValue}
                  className="bg-orange-600 hover:bg-orange-700 disabled:opacity-30 text-white px-4 py-2 text-[10px] font-label font-bold uppercase transition-all"
                >
                  Resetar
                </button>
              </div>
              {resetPasswordFeedback && (
                <p className={`text-[9px] font-mono ${resetPasswordFeedback.startsWith('ERRO') ? 'text-red-500' : 'text-emerald-500'}`}>
                  {resetPasswordFeedback}
                </p>
              )}
            </div>

            <div className="pt-8 border-t border-zinc-800 flex justify-end gap-4">
              <button 
                onClick={() => { setEditingAccount(null); setResetPasswordFeedback(null); setResetPasswordValue(""); }} 
                className="text-[10px] font-label font-bold text-zinc-500 hover:text-white uppercase tracking-widest"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 w-full max-w-md machined-edge shadow-2xl">
            <h3 className="font-headline text-lg text-zinc-100 uppercase tracking-widest font-bold mb-6">Registrar_Nova_Conta_Mestra</h3>
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div><label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">ID Mestre (Login)</label><input type="text" value={newUserCodinome} onChange={(e) => setNewUserCodinome(e.target.value)} placeholder="ex: silva_01" className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-sm focus:border-emerald-500 outline-none" required /></div>
              <div><label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Senha Provisória</label><input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••" className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-sm focus:border-emerald-500 outline-none" required minLength={6} /></div>
              {createUserFeedback && (<p className={`text-[10px] font-mono mt-2 ${createUserFeedback.startsWith('ERRO') ? 'text-red-500' : 'text-emerald-500'}`}>{createUserFeedback}</p>)}
              <div className="pt-6 flex justify-end gap-4">
                <button type="button" onClick={() => setShowCreateUser(false)} className="text-[10px] font-label font-bold text-zinc-500 hover:text-white uppercase tracking-widest">Cancelar</button>
                <button type="submit" disabled={createUserLoading} className="bg-emerald-700 text-white px-8 py-2 text-[10px] font-label font-bold tracking-widest uppercase">{createUserLoading ? '...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 p-4 flex flex-col justify-center rounded-sm">
      <span className="font-label text-[8px] uppercase tracking-widest text-zinc-600 mb-1 font-bold">{label}</span>
      <span className="font-headline font-bold text-[11px] text-zinc-300">{value}</span>
    </div>
  );
}

function formatSecs(secs: number) {
  if (!secs) return '0s';
  if (secs < 60) return `${Math.floor(secs)}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${(mins / 60).toFixed(1)}h`;
}
