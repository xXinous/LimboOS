import React, { useState, useEffect } from 'react';
import { subscribeToQrRedirects, saveQrRedirect, deleteQrRedirect } from '../../store/firestore';
import { activityLogger } from '../../services/ActivityLogger';
import { useModal } from './ConfirmModal';
import { format } from 'date-fns';
import Screw from '../../components/player/Screw';

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

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToQrRedirects((data) => {
      setRedirects(data as QrRedirect[]);
      setLoading(false);
    });
    return unsub;
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
      showAlert('Sucesso', 'Mapeamento sintonizado.');
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
      // Real-time listener handles state update
    } catch (err) {
      console.error('Error deleting redirect:', err);
      showAlert('Erro', 'Falha ao remover redirecionamento.');
    }
  };

  const filteredRedirects = redirects.filter(r => 
    (r.sourceId || '').toLowerCase().includes(search.toLowerCase()) || 
    (r.targetId || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.reason || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="space-y-8 font-chakra">
      {modal}
      <div className="flex items-center gap-4">
        <div className="w-2 h-8 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
        <h2 className="font-black uppercase tracking-widest text-lg text-white">
          Interface_de_Redirecionamento_de_Sinal_QR
        </h2>
        <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">
          {redirects.length} MAPEAMENTOS_ATIVOS_NO_GRID
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-1">
          <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-8 rounded-xl shadow-xl space-y-8 relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/5 pb-6">
              <span className="material-symbols-outlined text-emerald-500 text-2xl">add_link</span>
              <h3 className="font-black text-xs uppercase tracking-widest text-white">Injetar_Novo_Mapeamento</h3>
            </div>
            
            <form onSubmit={handleAddRedirect} className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">ID_ORIGEM (QR_FÍSICO)</label>
                <input
                  type="text"
                  required
                  value={newSourceId}
                  onChange={(e) => setNewSourceId(e.target.value)}
                  placeholder="EX: IJZ0IE..."
                  className="w-full bg-black/40 border-2 border-[#1a1a1a] text-[11px] font-mono font-bold uppercase tracking-widest focus:border-emerald-500 outline-none text-emerald-400 px-4 py-3 rounded-sm transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">ID_DESTINO (DADO_CORRETO)</label>
                <input
                  type="text"
                  required
                  value={newTargetId}
                  onChange={(e) => setNewTargetId(e.target.value)}
                  placeholder="EX: TAPE-ID-123..."
                  className="w-full bg-black/40 border-2 border-[#1a1a1a] text-[11px] font-mono font-bold uppercase tracking-widest focus:border-primary outline-none text-primary px-4 py-3 rounded-sm transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">NOTAS_DO_OPERADOR</label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="MOTIVO DO REDIRECIONAMENTO..."
                  rows={2}
                  className="w-full bg-black/40 border-2 border-[#1a1a1a] text-[10px] font-bold text-white px-4 py-3 focus:border-white/20 outline-none rounded-sm resize-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 font-black text-[10px] uppercase tracking-[0.3em] transition-all rounded-sm active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-20"
              >
                {isSaving ? 'SINC_DADOS...' : 'VINCULAR_FREQUÊNCIAS'}
              </button>
            </form>

            <div className="bg-black/60 border-2 border-[#1a1a1a] p-5 rounded-xl">
              <p className="text-[10px] text-zinc-600 leading-relaxed font-bold uppercase tracking-wide">
                <span className="text-emerald-500 font-black">LOG:</span> Mapeie IDs de QR impressos para novos endereços de memória. O sinal físico permanece o mesmo, mas o núcleo processará o destino.
              </p>
            </div>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
          <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl shadow-2xl flex flex-col min-h-[500px] overflow-hidden">
            <div className="p-6 border-b-4 border-[#1a1a1a] bg-black/40 flex items-center justify-between">
              <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-zinc-600">Sequência_de_Mapeamento_Ativa</h3>
              <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-xs">search</span>
                 <input
                   type="text"
                   placeholder="LOCALIZAR_VETOR..."
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="bg-black/60 border-2 border-[#1a1a1a] text-[9px] font-black uppercase tracking-widest focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-900 text-white px-10 py-2 w-56 rounded-sm transition-all"
                 />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-black/20 custom-scrollbar">
              {loading ? (
                <div className="p-24 text-center">
                  <span className="material-symbols-outlined text-3xl text-emerald-900 animate-spin block mb-4">sync</span>
                  <p className="font-black text-xs text-zinc-700 tracking-[0.4em]">CARREGANDO_GRID...</p>
                </div>
              ) : filteredRedirects.length === 0 ? (
                <div className="p-24 text-center opacity-10">
                  <span className="material-symbols-outlined text-6xl block mb-4">link_off</span>
                  <p className="font-black text-sm uppercase tracking-[0.4em]">Grid_de_Mapeamento_Inativo</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredRedirects.map((r) => (
                    <div key={r.sourceId} className="p-6 hover:bg-primary/5 transition-all group">
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-8 flex-1">
                          <div className="flex flex-col gap-2">
                            <p className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">Origem</p>
                            <code className="text-[11px] font-mono bg-black px-4 py-2 border-2 border-[#1a1a1a] text-emerald-400 group-hover:border-emerald-500/30 transition-all rounded-sm font-black">
                              {r.sourceId}
                            </code>
                          </div>
                          <div className="pt-4">
                             <span className="material-symbols-outlined text-zinc-800 text-2xl group-hover:text-primary transition-colors">double_arrow</span>
                          </div>
                          <div className="flex flex-col gap-2">
                            <p className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">Destino</p>
                            <code className="text-[11px] font-mono bg-black px-4 py-2 border-2 border-[#1a1a1a] text-primary group-hover:border-primary/30 transition-all rounded-sm font-black">
                              {r.targetId}
                            </code>
                          </div>
                          <div className="flex-1 min-w-0 ml-4 pt-4">
                            {r.reason && (
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight truncate group-hover:text-zinc-300" title={r.reason}>"{r.reason}"</p>
                            )}
                            <p className="text-[8px] font-black text-zinc-800 mt-2 uppercase tracking-widest">
                              SINC: {r.updatedAt?.toDate ? format(r.updatedAt.toDate(), 'dd/MM/yy HH:mm') : '---'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(r.sourceId)}
                          className="w-10 h-10 flex items-center justify-center text-zinc-800 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 material-symbols-outlined rounded-sm border border-transparent hover:border-red-500/20"
                          title="ELIMINAR MAPEAMENTO"
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-black/40 border-t-4 border-[#1a1a1a] p-6 px-10 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.6)]" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Integridade_de_Mapeamento: Ótima</span>
               </div>
               <span className="text-[9px] font-black text-zinc-800 uppercase tracking-widest">RM-REDIRECT-SYS-v4</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
