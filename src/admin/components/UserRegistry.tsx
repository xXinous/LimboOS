import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useModal } from './ConfirmModal';
import { userService } from "../../services/UserService";
import { UserData, TapeData, PlayCountData } from "../../types/player";
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
  const [users, setUsers] = useState<UserData[]>([]);
  const { showAlert, modal } = useModal();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userTapes, setUserTapes] = useState<Record<string, TapeData[]>>({});
  const [userPlayCounts, setUserPlayCounts] = useState<Record<string, PlayCountData[]>>({});
  const [userTotalPlays, setUserTotalPlays] = useState<Record<string, number>>({});
  const [userStats, setUserStats] = useState<Record<string, any>>({});
  const [availableAudios, setAvailableAudios] = useState<AudioData[]>([]);
  const [addTapeModal, setAddTapeModal] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserCodinome, setNewUserCodinome] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("member");
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserFeedback, setCreateUserFeedback] = useState<string | null>(null);
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferTargetUid, setTransferTargetUid] = useState<string>("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordFeedback, setResetPasswordFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = userService.subscribeToUsers(setUsers);
    const unsubPlays = userService.subscribeToUserTotalPlays(setUserTotalPlays);
    const unsubAudios = onSnapshot(collection(db, "audios"), (snapshot) => {
      const audios: AudioData[] = [];
      snapshot.forEach((d) => audios.push({ id: d.id, originalName: d.data().originalName || d.id }));
      setAvailableAudios(audios);
    });
    return () => {
      unsubUsers();
      unsubPlays();
      unsubAudios();
    };
  }, []);

  const loadUserTapes = async (uid: string) => {
    try {
      const details = await userService.loadUserDetails(uid);
      setUserTapes((prev) => ({ ...prev, [uid]: details.tapes }));
      setUserPlayCounts((prev) => ({ ...prev, [uid]: details.playCounts }));
      if (details.stats) {
        setUserStats((prev) => ({ ...prev, [uid]: details.stats }));
      }
    } catch (error: any) {
      console.error("Error loading user tapes:", error);
    }
  };

  const toggleExpand = (uid: string) => {
    if (expandedUser === uid) {
      setExpandedUser(null);
    } else {
      setExpandedUser(uid);
      loadUserTapes(uid);
    }
  };

  const handleDelete = (uid: string) => {
    if (!isAdmin) return;
    executeDelete(uid);
  };

  const executeDelete = async (uid: string) => {
    try {
      await userService.deleteUser(uid);
      activityLogger.logAdmin('gm.mpg', 'user_deleted', `Usuário deletado: ${uid}`);
    } catch (error: any) {
      console.error("Error deleting user:", error);
    }
  };

  const handleBackup = async (user: UserData) => {
    try {
      const backupJson = await userService.generateUserBackup(user);
      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${user.displayName || user.username || user.uid}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error creating backup:", error);
      showAlert('Erro de Backup', 'Falha ao criar o backup.');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !isAdmin) return;
    try {
      const name = editingUser.displayName || editingUser.username || '';
      await userService.updateUserRole(editingUser.uid, {
        displayName: name,
        username: name,
        role: editingUser.role as any,
        spotifyPlaylistUrl: editingUser.spotifyPlaylistUrl ?? '',
        agentStatus: editingUser.agentStatus ?? 'vivo',
        dangerLevel: editingUser.dangerLevel ?? 1,
      });
      setEditingUser(null);
      activityLogger.logAdmin('gm.mpg', 'user_updated', `Perfil atualizado: ${name}`);
    } catch (error: any) {
      console.error("Error updating user:", error);
      showAlert('Erro ao Atualizar', 'Falha ao atualizar dados do usuário.');
    }
  };

  const handleDeleteTape = (uid: string, tapeId: string) => {
    if (!isAdmin) return;
    executeDeleteTape(uid, tapeId);
  };

  const executeDeleteTape = async (uid: string, tapeId: string) => {
    try {
      await userService.removeUserTape(uid, tapeId);
      loadUserTapes(uid);
    } catch (error: any) {
      console.error("Error removing tape:", error);
    }
  };

  const openAddTapeModal = (uid: string) => {
    setAddTapeModal(uid);
    setSelectedAudioId("");
  };

  const executeAddTape = async () => {
    if (!addTapeModal || !selectedAudioId) return;
    try {
      await userService.addUserTape(addTapeModal, selectedAudioId);
      loadUserTapes(addTapeModal);
      setAddTapeModal(null);
      setSelectedAudioId("");
    } catch (error: any) {
      console.error("Error adding tape:", error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserCodinome.trim() || !newUserPassword.trim()) return;
    setCreateUserLoading(true);
    setCreateUserFeedback(null);
    try {
      const uid = await userService.createSyntheticUser(newUserCodinome, newUserPassword, newUserRole as any);
      setCreateUserFeedback(`Usuário "${newUserCodinome.trim()}" criado com sucesso!`);
      setNewUserCodinome("");
      setNewUserPassword("");
      setNewUserRole("member");
    } catch (error: any) {
      console.error("Error creating user:", error);
      setCreateUserFeedback(`ERRO: ${error.message || "Falha ao criar usuário."}`);
    } finally {
      setCreateUserLoading(false);
    }
  };

  const openTransferModal = (sourceUid: string) => {
    setTransferModal(sourceUid);
    setTransferTargetUid("");
    setTransferFeedback(null);
  };

  const executeTransfer = async () => {
    if (!transferModal || !transferTargetUid || transferModal === transferTargetUid) {
      setTransferFeedback("ERRO: Selecione um destino diferente.");
      return;
    }
    setTransferLoading(true);
    setTransferFeedback(null);
    try {
      const result = await userService.transferData(transferModal, transferTargetUid);
      setTransferFeedback(`✓ Transferência concluída! ${result.tapes} fitas movidas.`);
      if (expandedUser === transferModal) loadUserTapes(transferModal);
      if (expandedUser === transferTargetUid) loadUserTapes(transferTargetUid);
    } catch (error) {
      console.error("Error transferring data:", error);
      setTransferFeedback("ERRO: Falha na migração.");
    } finally {
      setTransferLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const sourceUser = transferModal ? users.find((u) => u.uid === transferModal) : null;

  const handleResetPassword = async () => {
    if (!editingUser || resetPasswordValue.length < 6) return;
    setResetPasswordLoading(true);
    setResetPasswordFeedback(null);
    try {
      await userService.resetUserPassword(editingUser.uid, resetPasswordValue);
      setResetPasswordFeedback(`✓ Senha alterada.`);
      setResetPasswordValue('');
    } catch (error: any) {
      setResetPasswordFeedback(`ERRO: ${error?.message || 'Falha ao alterar senha.'}`);
    } finally {
      setResetPasswordLoading(false);
    }
  };

  return (
    <section className="bg-surface border border-zinc-800 relative overflow-hidden machined-edge">
      {modal}
      <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="w-2 h-6 bg-orange-600"></div>
            <h2 className="font-headline font-bold uppercase tracking-widest text-lg">
              Central_da_Mesa_de_Jogo
            </h2>
          </div>
          
          <div className="flex bg-zinc-950 p-1 rounded-sm border border-zinc-800">
            <button 
              onClick={() => setActiveSubTab('users')}
              className={`px-4 py-1.5 text-[10px] font-label font-bold tracking-widest transition-all ${activeSubTab === 'users' ? 'bg-orange-600 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              LISTA_DE_JOGADORES
            </button>
            <button 
              onClick={() => setActiveSubTab('groups')}
              className={`px-4 py-1.5 text-[10px] font-label font-bold tracking-widest transition-all ${activeSubTab === 'groups' ? 'bg-orange-600 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              GESTÃO_DE_GRUPOS
            </button>
          </div>
        </div>

        {activeSubTab === 'users' && (
          <div className="flex items-center justify-between px-6 pb-6 gap-4 animate-in fade-in duration-300">
            <span className="text-[10px] font-label text-zinc-500 tracking-wider whitespace-nowrap">{users.length} ATIVOS</span>
            <div className="flex flex-1 max-w-xl gap-2">
              <input
                type="text"
                placeholder="BUSCAR_PERSONAGEM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 text-[10px] font-label uppercase tracking-widest focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder:text-zinc-800 text-zinc-300 px-3 py-2 outline-none"
              />
              {isAdmin && (
                <button
                  onClick={() => setShowCreateUser(true)}
                  className="flex items-center gap-1.5 bg-emerald-900/30 text-emerald-400 px-4 py-2 rounded-sm font-label text-[10px] font-bold tracking-widest hover:bg-emerald-800/40 transition-all border border-emerald-700/20"
                >
                  <span className="material-symbols-outlined text-xs">person_add</span>
                  NOVO_PLAYER
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 min-h-[400px]">
        {activeSubTab === 'groups' ? (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <GroupManager isAdmin={isAdmin} />
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 animate-in slide-in-from-left-4 duration-300">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-800">
                  <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500">Personagem</th>
                  <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500">Email</th>
                  <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500">Visto por último</th>
                  <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500 text-center">Fitas</th>
                  <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredUsers.map((user) => (
                  <React.Fragment key={user.uid}>
                    <tr className="hover:bg-zinc-900/50 transition-colors group cursor-pointer" onClick={() => toggleExpand(user.uid)}>
                      <td className="p-4 font-headline font-bold text-sm text-zinc-200">
                        {user.displayName || user.username || "UNKNOWN"}
                      </td>
                      <td className="p-4 font-body text-[11px] text-zinc-500">{user.email}</td>
                      <td className="p-4 font-body text-[11px] text-zinc-500">
                        {user.lastLogin ? format(user.lastLogin.toDate(), "yyyy/MM/dd HH:mm") : "NUNCA"}
                      </td>
                      <td className="p-4 font-headline font-bold text-xs text-orange-500 text-center">
                        {userTotalPlays[user.uid] || 0}
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => { setEditingUser(user); setResetPasswordValue(''); setResetPasswordFeedback(null); }} className="p-1.5 rounded-sm hover:bg-zinc-800 text-zinc-500 hover:text-orange-400 transition-colors material-symbols-outlined text-sm">edit</button>
                          <button onClick={() => openTransferModal(user.uid)} className="p-1.5 rounded-sm hover:bg-zinc-800 text-zinc-500 hover:text-purple-400 transition-colors material-symbols-outlined text-sm">sync_alt</button>
                          <button onClick={() => handleBackup(user)} className="p-1.5 rounded-sm hover:bg-zinc-800 text-zinc-500 hover:text-blue-400 transition-colors material-symbols-outlined text-sm">download</button>
                          <button onClick={() => toggleExpand(user.uid)} className={`p-1.5 rounded-sm hover:bg-zinc-800 transition-colors material-symbols-outlined text-sm ${expandedUser === user.uid ? 'bg-zinc-800 text-tertiary' : 'text-zinc-500'}`}>
                            {expandedUser === user.uid ? 'expand_less' : 'expand_more'}
                          </button>
                          <button onClick={() => handleDelete(user.uid)} className="p-1.5 rounded-sm hover:bg-zinc-800 text-zinc-500 hover:text-red-500 transition-colors material-symbols-outlined text-sm">delete</button>
                        </div>
                      </td>
                    </tr>
                    {expandedUser === user.uid && (
                      <tr>
                        <td colSpan={5} className="bg-zinc-950 p-0 border-l-2 border-orange-500">
                          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-orange-500 text-sm">album</span>
                                <h4 className="font-label text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Arquivos_Desbloqueados ({userTapes[user.uid]?.length || 0})</h4>
                              </div>
                              <button onClick={() => openAddTapeModal(user.uid)} className="flex items-center gap-1.5 text-[10px] font-label uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-all font-bold">
                                <span className="material-symbols-outlined text-xs">add_circle</span>VINCULAR_AUDIO
                              </button>
                            </div>
                            
                            {userTapes[user.uid]?.length ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {userTapes[user.uid].map((tape) => {
                                  const playCount = userPlayCounts[user.uid]?.find((p) => p.tapeId === tape.tapeId)?.count || 0;
                                  const audioInfo = availableAudios.find((a) => a.id === tape.tapeId);
                                  return (
                                    <div key={tape.tapeId} className="bg-zinc-900 border border-zinc-800/50 p-3 flex items-center justify-between rounded-sm">
                                      <div className="min-w-0">
                                        <p className="font-headline text-[11px] font-bold text-zinc-300 truncate">{audioInfo?.originalName || tape.tapeId}</p>
                                        <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-zinc-500 uppercase">
                                          <span>Reproduções: {playCount}</span>
                                        </div>
                                      </div>
                                      <button onClick={() => handleDeleteTape(user.uid, tape.tapeId)} className="text-zinc-600 hover:text-red-500 transition-colors material-symbols-outlined text-sm">close</button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (<p className="text-zinc-700 text-[10px] font-label tracking-widest uppercase">Nenhum recurso de áudio vinculado a este perfil.</p>)}
                            
                            <div className="pt-6 border-t border-zinc-800/50">
                              <div className="flex items-center gap-3 mb-6">
                                <span className="material-symbols-outlined text-tertiary text-sm">analytics</span>
                                <h4 className="font-label text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Telemetria_do_Walkman</h4>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <StatBox label="Escuta Total" value={formatSecs(userStats[user.uid]?.totalListenTime || 0)} />
                                <StatBox label="Audio Crítico" value={formatSecs(userStats[user.uid]?.maxVolumeTime || 0)} />
                                <StatBox label="Interação Hardware" value={userStats[user.uid]?.screwClicks || 0} />
                                <StatBox label="Ejeções" value={userStats[user.uid]?.ejectWithoutPlay || 0} />
                                <StatBox label="Role" value={user.role} />
                              </div>
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

      {/* Modais de Edição e Criação (Compactos) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 w-full max-w-md machined-edge shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-headline text-lg text-zinc-100 mb-6 uppercase tracking-widest font-bold">Configurar_Perfil</h3>
            <form onSubmit={handleUpdateUser} className="space-y-5">
              <div>
                <label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Codinome Público</label>
                <input type="text" value={editingUser.displayName || ''} onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-sm focus:border-orange-500 outline-none" />
              </div>
              <div>
                <label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Nível de Acesso</label>
                <select value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-sm focus:border-orange-500 outline-none">
                  <option value="member">Membro</option>
                  <option value="premium">Premium</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="font-label text-[10px] text-zinc-500 mb-2 flex items-center gap-1.5 uppercase tracking-widest">
                  <span className="material-symbols-outlined text-[#1DB954] text-xs">music_note</span> Spotify Playlist
                </label>
                <input
                  type="url"
                  value={editingUser.spotifyPlaylistUrl || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, spotifyPlaylistUrl: e.target.value })}
                  placeholder="URL da Playlist"
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-sm focus:border-[#1DB954] outline-none"
                />
              </div>

              {/* Agent Dossier Section */}
              <div className="pt-4 border-t border-zinc-800/50">
                <h4 className="font-label text-[10px] uppercase tracking-widest text-orange-500/70 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs">shield</span> Dossiê_do_Agente
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Status do Agente</label>
                    <select
                      value={editingUser.agentStatus || 'vivo'}
                      onChange={(e) => setEditingUser({ ...editingUser, agentStatus: e.target.value as any })}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-sm focus:border-orange-500 outline-none"
                    >
                      <option value="vivo">🟢 Vivo (Ativo)</option>
                      <option value="morto">🔴 Morto (Eliminado)</option>
                      <option value="desaparecido">🟡 Desaparecido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Periculosidade</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={editingUser.dangerLevel || 1}
                        onChange={(e) => setEditingUser({ ...editingUser, dangerLevel: Number(e.target.value) })}
                        className="flex-1 accent-orange-500 h-2"
                      />
                      <span className={`font-headline font-bold text-lg min-w-[24px] text-center ${
                        (editingUser.dangerLevel || 1) >= 4 ? 'text-red-500' : 
                        (editingUser.dangerLevel || 1) >= 2 ? 'text-orange-500' : 'text-zinc-500'
                      }`}>{editingUser.dangerLevel || 1}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[8px] text-zinc-700 font-label">BAIXO</span>
                      <span className="text-[8px] text-zinc-700 font-label">CRÍTICO</span>
                    </div>
                  </div>
                </div>
                {editingUser.agentId && (
                  <div className="mt-3 p-2 bg-zinc-950 border border-zinc-800 rounded-sm">
                    <span className="text-[9px] font-mono text-zinc-600">AGENT_ID: </span>
                    <span className="text-[11px] font-mono font-bold text-orange-500 tracking-[0.2em]">RM-{editingUser.agentId}</span>
                  </div>
                )}
              </div>

              <div className="pt-6 flex justify-end gap-4">
                <button type="button" onClick={() => setEditingUser(null)} className="text-[10px] font-label font-bold text-zinc-500 hover:text-white uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="bg-orange-600 text-white px-6 py-2 text-[10px] font-label font-bold tracking-widest hover:brightness-110 machined-edge uppercase">Salvar Alterações</button>
              </div>
            </form>

            <div className="mt-10 pt-8 border-t border-zinc-800">
              <h4 className="font-label text-[10px] uppercase tracking-widest text-zinc-600 mb-4 flex items-center gap-2">Resetar_Acesso_Seguro</h4>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Nova Senha"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2 text-xs focus:border-orange-500 outline-none"
                />
                <button
                  onClick={handleResetPassword}
                  disabled={resetPasswordLoading || resetPasswordValue.length < 6}
                  className="px-4 py-2 text-[10px] font-label font-bold uppercase bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30 transition-all"
                >
                  {resetPasswordLoading ? '...' : 'Reset'}
                </button>
              </div>
              {resetPasswordFeedback && (
                <p className={`text-[9px] font-mono mt-3 ${resetPasswordFeedback.startsWith('ERRO') ? 'text-red-500' : 'text-emerald-500'}`}>
                  {resetPasswordFeedback}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-8 w-full max-w-md machined-edge shadow-2xl">
            <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-emerald-400 text-xl">person_add</span><h3 className="font-headline text-lg text-zinc-100 uppercase tracking-widest font-bold">Registrar_Jogador</h3></div>
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div><label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Codinome (Login)</label><input type="text" value={newUserCodinome} onChange={(e) => setNewUserCodinome(e.target.value)} placeholder="ex: silva_01" className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-sm focus:border-emerald-500 outline-none" required /></div>
              <div><label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Senha Provisória</label><input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••" className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-sm focus:border-emerald-500 outline-none" required minLength={6} /></div>
              <div><label className="block font-label text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Acesso</label><select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-2.5 text-sm focus:border-emerald-500 outline-none"><option value="member">Membro</option><option value="premium">Premium</option><option value="admin">Administrador</option></select></div>
              {createUserFeedback && (<p className={`text-[10px] font-mono mt-2 ${createUserFeedback.startsWith('ERRO') ? 'text-red-500' : 'text-emerald-500'}`}>{createUserFeedback}</p>)}
              <div className="pt-6 flex justify-end gap-4">
                <button type="button" onClick={() => setShowCreateUser(false)} className="text-[10px] font-label font-bold text-zinc-500 hover:text-white uppercase tracking-widest">Cancelar</button>
                <button type="submit" disabled={createUserLoading} className="bg-emerald-700 text-white px-8 py-2 text-[10px] font-label font-bold tracking-widest hover:brightness-110 machined-edge uppercase">{createUserLoading ? 'Processando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addTapeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-orange-500/20 p-8 w-full max-w-md machined-edge shadow-2xl">
            <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-orange-500 text-xl">album</span><h3 className="font-headline text-lg text-zinc-100 uppercase tracking-widest font-bold">Vincular_Audio</h3></div>
            <select value={selectedAudioId} onChange={(e) => setSelectedAudioId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 px-4 py-3 text-sm focus:border-orange-500 outline-none mb-8">
              <option value="">-- SELECIONAR RECURSO --</option>
              {availableAudios.map((audio) => (<option key={audio.id} value={audio.id}>{audio.originalName}</option>))}
            </select>
            <div className="flex justify-end gap-4">
              <button onClick={() => setAddTapeModal(null)} className="text-[10px] font-label font-bold text-zinc-500 hover:text-white uppercase tracking-widest">Cancelar</button>
              <button onClick={executeAddTape} disabled={!selectedAudioId} className="bg-orange-600 text-white px-8 py-2 text-[10px] font-label font-bold tracking-widest hover:brightness-110 transition-all disabled:opacity-30 uppercase">Liberar</button>
            </div>
          </div>
        </div>
      )}

      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-purple-500/20 p-8 w-full max-w-lg machined-edge shadow-2xl">
            <div className="flex items-center gap-3 mb-6"><span className="material-symbols-outlined text-purple-400 text-xl">sync_alt</span><h3 className="font-headline text-lg text-zinc-100 uppercase tracking-widest font-bold">Migrar_Dados</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center mb-8">
               <div className="bg-zinc-950 p-4 border border-zinc-800">
                  <p className="text-[8px] font-label text-zinc-600 mb-2 uppercase">Origem</p>
                  <p className="font-headline text-xs font-bold text-zinc-200 truncate">{sourceUser?.displayName || sourceUser?.username}</p>
               </div>
               <div className="bg-zinc-950 p-4 border border-zinc-800">
                  <p className="text-[8px] font-label text-zinc-600 mb-2 uppercase">Destino</p>
                  <select value={transferTargetUid} onChange={(e) => setTransferTargetUid(e.target.value)} className="w-full bg-transparent border-none text-zinc-200 p-0 text-xs focus:ring-0 outline-none">
                    <option value="">-- SELECIONAR --</option>
                    {users.filter(u => u.uid !== transferModal).map(u => (
                      <option key={u.uid} value={u.uid}>{u.displayName || u.username}</option>
                    ))}
                  </select>
               </div>
            </div>
            {transferFeedback && (<p className={`text-[10px] font-mono mb-6 ${transferFeedback.startsWith('ERRO') ? 'text-red-500' : 'text-emerald-500'}`}>{transferFeedback}</p>)}
            <div className="flex justify-end gap-4">
              <button onClick={() => setTransferModal(null)} className="text-[10px] font-label font-bold text-zinc-500 hover:text-white uppercase tracking-widest">Cancelar</button>
              <button onClick={executeTransfer} disabled={!transferTargetUid || transferLoading} className="bg-purple-700 text-white px-8 py-2 text-[10px] font-label font-bold tracking-widest hover:brightness-110 disabled:opacity-30 uppercase">Executar</button>
            </div>
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
