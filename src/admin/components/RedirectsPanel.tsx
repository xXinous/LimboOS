import React, { useState, useEffect } from 'react';
import { fetchAllQrRedirects, saveQrRedirect, deleteQrRedirect } from '../../store/firestore';
import { activityLogger } from '../../services/ActivityLogger';
import { useModal } from './ConfirmModal';
import { format } from 'date-fns';
interface QrRedirect {
  sourceId: string;
  targetId: string;
  updatedAt: any;
  reason?: string;
}
export default function RedirectsPanel() {
  const [redirects, setRedirects] = useState<QrRedirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newSourceId, setNewSourceId] = useState('');
  const [newTargetId, setNewTargetId] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showAlert, modal } = useModal();
  const loadRedirects = async () => {
    setLoading(true);
    try {
      const data = await fetchAllQrRedirects();
      setRedirects(data as QrRedirect[]);
    } catch (err) {
      console.error('Error loading redirects:', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadRedirects();
  }, []);
  const handleAddRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceId || !newTargetId) return;
    setIsSaving(true);
    try {
      await saveQrRedirect(newSourceId.trim(), newTargetId.trim(), newReason.trim());
      activityLogger.logAdmin('gm.mpg', 'qr_redirect_add', `Criou redirecionamento: ${newSourceId} -> ${newTargetId}`, { sourceId: newSourceId, targetId: newTargetId });
      setNewSourceId('');
      setNewTargetId('');
      setNewReason('');
      await loadRedirects();
      showAlert('Sucesso', 'Redirecionamento salvo com sucesso.');
    } catch (err) {
      console.error('Error saving redirect:', err);
      showAlert('Erro', 'Falha ao salvar redirecionamento.');
    } finally {
      setIsSaving(false);
    }
  };
  const handleDelete = async (sourceId: string) => {
    try {
      await deleteQrRedirect(sourceId);
      activityLogger.logAdmin('gm.mpg', 'qr_redirect_remove', `Removeu redirecionamento: ${sourceId}`, { sourceId });
      await loadRedirects();
    } catch (err) {
      console.error('Error deleting redirect:', err);
      showAlert('Erro', 'Falha ao remover redirecionamento.');
    }
  };
  const filteredRedirects = redirects.filter(r => 
    r.sourceId.toLowerCase().includes(search.toLowerCase()) || 
    r.targetId.toLowerCase().includes(search.toLowerCase()) ||
    (r.reason || '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <section className="space-y-6">
      {modal}
      {}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-2 h-6 bg-emerald-500" />
        <h2 className="font-headline font-bold uppercase tracking-widest text-lg">
          Redirecionamentos_QR
        </h2>
        <span className="text-[10px] font-label text-zinc-500 tracking-wider">
          {redirects.length} MAPEAMENTOS_ATIVOS
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {}
        <div className="lg:col-span-1">
          <div className="bg-surface-container-lowest border border-zinc-800 machined-edge p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-emerald-500 text-sm">add_link</span>
              <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Adicionar_Novo_Mapeamento</h3>
            </div>
            <form onSubmit={handleAddRedirect} className="space-y-4">
              <div>
                <label className="block text-[9px] font-label uppercase tracking-widest text-zinc-500 mb-1">ID de Origem (QR Físico)</label>
                <input
                  type="text"
                  required
                  value={newSourceId}
                  onChange={(e) => setNewSourceId(e.target.value)}
                  placeholder="Ex: Ijz0Ie..."
                  className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-label uppercase tracking-widest focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-zinc-700 text-emerald-400 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[9px] font-label uppercase tracking-widest text-zinc-500 mb-1">ID de Destino (Áudio Correto)</label>
                <input
                  type="text"
                  required
                  value={newTargetId}
                  onChange={(e) => setNewTargetId(e.target.value)}
                  placeholder="Ex: new-tape-id-123"
                  className="w-full bg-zinc-900 border border-zinc-800 text-[10px] font-label uppercase tracking-widest focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-zinc-700 text-orange-400 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[9px] font-label uppercase tracking-widest text-zinc-500 mb-1">Motivo / Nota</label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="O que aconteceu?"
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-zinc-700 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-900/40 text-emerald-300 py-3 font-label text-[10px] font-bold tracking-widest hover:bg-emerald-800/40 transition-all machined-edge border border-emerald-700/30 disabled:opacity-50"
              >
                {isSaving ? 'SALVANDO...' : 'SALVAR_REDIRECIONAMENTO'}
              </button>
            </form>
            <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded">
              <p className="text-[10px] font-label text-zinc-500 leading-relaxed italic">
                <span className="text-emerald-500 font-bold">INFO:</span> Use isso para mapear um ID de QR impresso que aponta para dados errados para um novo ID de upload. O código QR físico permanecerá o mesmo, mas o app tocará o conteúdo de destino.
              </p>
            </div>
          </div>
        </div>
        {}
        <div className="lg:col-span-2">
          <div className="bg-surface-container-lowest border border-zinc-800 machined-edge flex flex-col min-h-[400px]">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">Redirecionamentos_Ativos</h3>
              <input
                type="text"
                placeholder="BUSCAR_POR_ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-[9px] font-label uppercase tracking-widest focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-zinc-700 text-zinc-300 px-3 py-1.5 w-48"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-12 text-center">
                  <span className="material-symbols-outlined text-2xl text-zinc-600 animate-spin block mb-2">sync</span>
                  <p className="font-label text-xs text-zinc-600 tracking-widest">CARREGANDO_MAPEAMENTOS...</p>
                </div>
              ) : filteredRedirects.length === 0 ? (
                <div className="p-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-zinc-800 block mb-3">link_off</span>
                  <p className="font-label text-xs text-zinc-600 uppercase tracking-widest">Nenhum redirecionamento encontrado</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {filteredRedirects.map((r) => (
                    <div key={r.sourceId} className="p-4 hover:bg-zinc-800/20 transition-colors group">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="text-center">
                            <p className="text-[8px] font-label text-zinc-600 uppercase mb-1">Origem</p>
                            <code className="text-[10px] font-mono bg-zinc-900 px-2 py-1 rounded text-emerald-400 border border-emerald-500/10">
                              {r.sourceId}
                            </code>
                          </div>
                          <span className="material-symbols-outlined text-zinc-600">arrow_forward</span>
                          <div className="text-center">
                            <p className="text-[8px] font-label text-zinc-600 uppercase mb-1">Destino</p>
                            <code className="text-[10px] font-mono bg-zinc-900 px-2 py-1 rounded text-orange-400 border border-orange-500/10">
                              {r.targetId}
                            </code>
                          </div>
                          <div className="flex-1 min-w-0 ml-4">
                            {r.reason && (
                              <p className="text-[10px] text-zinc-500 italic truncate" title={r.reason}>"{r.reason}"</p>
                            )}
                            <p className="text-[8px] font-label text-zinc-700 mt-0.5 uppercase tracking-tighter">
                              Atualizado: {r.updatedAt?.toDate ? format(r.updatedAt.toDate(), 'dd/MM/yy HH:mm') : 'Desconhecido'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(r.sourceId)}
                          className="material-symbols-outlined text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remover Redirecionamento"
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
