import React, { useState, useMemo, useCallback } from 'react';
import { intelRegistry, type EvidenceIntelAdmin } from '../../data/intel_registry';
import type { IntelItem, IntelType, AccessLevel, VisualCategory } from '../../types/intel';
import { ACCESS_LEVEL_LABELS } from '../../types/intel';
import Screw from '../../components/player/Screw';

/**
 * IntelCreatorPanel — Interface administrativa para criar e gerenciar 
 * itens no IntelRegistry em tempo real.
 */

const TYPE_OPTIONS: { value: IntelType; label: string; icon: string }[] = [
  { value: 'AUDIO', label: 'Áudio', icon: 'album' },
  { value: 'TEXT', label: 'Texto', icon: 'save' },
  { value: 'VISUAL', label: 'Visual', icon: 'photo_library' },
  { value: 'META', label: 'Meta', icon: 'emoji_events' },
];

const LEVEL_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: 1, label: 'RESTRITO' },
  { value: 2, label: 'CONFIDENCIAL' },
  { value: 3, label: 'SIGILOSO' },
  { value: 4, label: 'TOP SECRET' },
];

const CATEGORY_OPTIONS: VisualCategory[] = ['locais', 'pistas', 'pessoas', 'itens'];

const EMPTY_ITEM: Omit<IntelItem, 'id'> = {
  type: 'TEXT',
  level: 2,
  title: '',
  description: '',
  textContent: '',
  mediaUrl: '',
  metadata: {
    npc: '',
    artist: '',
    chapter: '',
    duration: 0,
    isSecret: false,
  },
};

export default function IntelCreatorPanel() {
  const [allItems, setAllItems] = useState<IntelItem[]>(() => intelRegistry.getAll());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<IntelType | 'ALL'>('ALL');
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<IntelItem | null>(null);
  const [formData, setFormData] = useState<Omit<IntelItem, 'id'> & { id: string }>({ id: '', ...EMPTY_ITEM });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showExport, setShowExport] = useState(false);

  const refreshItems = useCallback(() => {
    setAllItems(intelRegistry.getAll());
  }, []);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      const matchesType = filterType === 'ALL' || item.type === filterType;
      const matchesSearch = search === '' || 
        (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.id || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [allItems, search, filterType]);

  const handleNewItem = () => {
    setEditingItem(null);
    setFormData({ id: `intel_${Date.now()}`, ...EMPTY_ITEM });
    setShowEditor(true);
    setFeedback(null);
  };

  const handleEditItem = (item: IntelItem) => {
    setEditingItem(item);
    setFormData({
      id: item.id,
      type: item.type,
      level: item.level,
      title: item.title,
      description: item.description,
      textContent: item.textContent || '',
      mediaUrl: item.mediaUrl || '',
      campaignId: item.campaignId,
      metadata: {
        npc: item.metadata?.npc || '',
        artist: item.metadata?.artist || '',
        chapter: item.metadata?.chapter || '',
        duration: item.metadata?.duration || 0,
        isSecret: item.metadata?.isSecret || false,
        visualCategory: item.metadata?.visualCategory,
        imageUrl: item.metadata?.imageUrl || '',
        icon: item.metadata?.icon || '',
        hint: item.metadata?.hint || '',
        unlockCondition: item.metadata?.unlockCondition || '',
        achievementRuleId: item.metadata?.achievementRuleId || '',
      },
    });
    setShowEditor(true);
    setFeedback(null);
  };

  const handleSave = () => {
    if (!formData.id.trim() || !formData.title.trim()) {
      setFeedback({ type: 'error', text: 'ID e Título são obrigatórios.' });
      return;
    }
    const cleanMeta = { ...formData.metadata };
    Object.keys(cleanMeta).forEach(key => {
      const val = (cleanMeta as any)[key];
      if (val === '' || val === 0 || val === false || val === undefined) {
        delete (cleanMeta as any)[key];
      }
    });
    const intelItem: IntelItem = {
      id: formData.id.trim(),
      type: formData.type,
      level: formData.level,
      title: formData.title.trim(),
      description: formData.description.trim(),
      ...(formData.textContent ? { textContent: formData.textContent } : {}),
      ...(formData.mediaUrl ? { mediaUrl: formData.mediaUrl } : {}),
      ...(formData.campaignId ? { campaignId: formData.campaignId } : {}),
      ...(Object.keys(cleanMeta).length > 0 ? { metadata: cleanMeta } : {}),
    };
    intelRegistry.register(intelItem);
    refreshItems();
    setShowEditor(false);
    setFeedback({ type: 'success', text: `✓ "${intelItem.title}" ${editingItem ? 'atualizado' : 'registrado'} com sucesso.` });
  };

  const handleExportJSON = () => setShowExport(true);

  const exportJSON = useMemo(() => JSON.stringify(intelRegistry.getAll(), null, 2), [showExport, allItems]);

  const updateField = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));
  const updateMeta = (field: string, value: any) => setFormData(prev => ({ ...prev, metadata: { ...prev.metadata, [field]: value } }));

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = { AUDIO: 0, TEXT: 0, VISUAL: 0, META: 0, total: 0 };
    allItems.forEach(item => { stats[item.type]++; stats.total++; });
    return stats;
  }, [allItems]);

  return (
    <section className="space-y-8 font-chakra">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
          <div>
            <h2 className="font-black uppercase tracking-widest text-lg text-white">Criador_de_Intel_Registry</h2>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Banco de Dados Mestre de Colecionáveis</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={handleExportJSON} className="bg-[#333] text-zinc-300 px-6 py-2.5 text-[10px] font-black border border-white/5 uppercase hover:bg-[#444] transition-all rounded-sm active:scale-95">
            <span className="material-symbols-outlined text-sm">download</span> EXPORTAR_JSON
          </button>
          <button onClick={handleNewItem} className="bg-primary text-black px-6 py-2.5 text-[10px] font-black border-2 border-primary/20 uppercase hover:bg-primary-container transition-all rounded-sm active:scale-95 glow-orange">
            <span className="material-symbols-outlined text-sm">add</span> NOVA_INTEL
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-5 rounded-xl shadow-inner relative overflow-hidden group">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">TOTAL_REGISTROS</p>
          <p className="text-3xl font-black text-primary tracking-tighter">{typeStats.total}</p>
        </div>
        {TYPE_OPTIONS.map(t => (
          <div key={t.value} className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-5 rounded-xl shadow-inner group">
            <div className="flex items-center gap-2 mb-1">
               <span className="material-symbols-outlined text-xs text-zinc-700">{t.icon}</span>
               <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{t.label}</p>
            </div>
            <p className="text-3xl font-black text-white/40 group-hover:text-white transition-colors tracking-tighter">{typeStats[t.value]}</p>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-4 border-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-sm shadow-lg animate-in slide-in-from-top-4 ${feedback.type === 'success' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-red-500/30 text-red-400 bg-red-500/5'}`}>
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full animate-pulse ${feedback.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
             {feedback.text}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center bg-black/20 p-4 rounded-xl border border-white/5">
        <div className="relative max-w-xs flex-1">
           <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-sm">search</span>
           <input
             type="text"
             placeholder="BUSCAR_ID_OU_TÍTULO..."
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full bg-black/40 border border-[#1a1a1a] text-[10px] font-black uppercase px-10 py-2.5 text-white focus:ring-1 focus:ring-primary outline-none rounded-sm"
           />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all rounded-sm ${filterType === 'ALL' ? 'border-primary text-primary bg-primary/10' : 'border-[#1a1a1a] text-zinc-700 hover:text-zinc-500 hover:bg-white/5'}`}
          >
            TODOS
          </button>
          {TYPE_OPTIONS.map(t => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all flex items-center gap-2 rounded-sm ${filterType === t.value ? 'border-primary text-primary bg-primary/10' : 'border-[#1a1a1a] text-zinc-700 hover:text-zinc-500 hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined text-xs">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-[60px_1fr_120px_120px_120px_80px] gap-0 text-[10px] font-black uppercase text-zinc-700 tracking-widest px-6 py-4 border-b-4 border-[#1a1a1a] bg-black/40">
          <span>TIPO</span>
          <span>IDENTIFICADOR_/_TÍTULO</span>
          <span>CAPÍTULO</span>
          <span>VÍNCULO_NPC</span>
          <span>ACESSO</span>
          <span className="text-right">AÇÃO</span>
        </div>
        <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5 custom-scrollbar bg-black/20">
          {filteredItems.length === 0 ? (
            <div className="p-24 text-center text-zinc-800 text-[11px] font-black uppercase tracking-[0.4em]">
              SINAL_DE_INTEL_INEXISTENTE
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="grid grid-cols-[60px_1fr_120px_120px_120px_80px] gap-0 px-6 py-4 items-center group hover:bg-primary/5 transition-all">
                <span className="material-symbols-outlined text-lg text-zinc-700 group-hover:text-primary transition-colors">
                  {TYPE_OPTIONS.find(t => t.value === item.type)?.icon || 'description'}
                </span>
                <div className="min-w-0 pr-4">
                  <p className="text-xs font-black text-zinc-300 truncate uppercase tracking-wide group-hover:text-white transition-colors">{item.title}</p>
                  <p className="text-[9px] font-mono text-zinc-700 truncate font-bold">{item.id}</p>
                </div>
                <span className="text-[10px] font-bold text-zinc-600 truncate uppercase tracking-widest pr-4">{item.metadata?.chapter || '---'}</span>
                <span className="text-[10px] font-bold text-zinc-600 truncate uppercase tracking-widest pr-4">{item.metadata?.npc || '---'}</span>
                <div className="pr-4">
                   <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border ${item.level >= 4 ? 'border-red-500/30 text-red-500 bg-red-500/5' : item.level >= 2 ? 'border-primary/30 text-primary/70' : 'border-zinc-800 text-zinc-700'}`}>
                     {ACCESS_LEVEL_LABELS[item.level]}
                   </span>
                </div>
                <div className="text-right">
                  <button
                    onClick={() => handleEditItem(item)}
                    className="p-2 text-zinc-800 hover:text-primary hover:bg-primary/10 rounded-sm transition-all material-symbols-outlined text-lg"
                  >
                    edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="p-8 border-b-4 border-[#1a1a1a] flex justify-between items-center relative z-10 bg-black/40">
              <div>
                <h3 className="font-black text-xl text-white uppercase tracking-[0.2em]">
                  {editingItem ? 'Ajustar_Propriedades_Intel' : 'Injetar_Novo_Dado'}
                </h3>
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">
                  {editingItem ? `Nó: ${editingItem.id}` : 'Registro de nova entrada no registro mestre'}
                </p>
              </div>
              <button onClick={() => setShowEditor(false)} className="p-2 text-zinc-600 hover:text-white transition-all rounded-sm material-symbols-outlined">close</button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-8 relative z-10 custom-scrollbar">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Identificador_ID (Permanente)</label>
                  <input
                    value={formData.id}
                    onChange={e => updateField('id', e.target.value)}
                    disabled={!!editingItem}
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-mono px-4 py-3 text-white disabled:opacity-20 rounded-sm focus:border-primary transition-all"
                    placeholder="intel_nome_do_item"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Vínculo_com_Campanha</label>
                  <input
                    value={formData.campaignId || ''}
                    onChange={e => updateField('campaignId', e.target.value)}
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-mono px-4 py-3 text-white rounded-sm focus:border-primary transition-all"
                    placeholder="id_da_missao"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Classificação_de_Tipo</label>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => updateField('type', t.value)}
                      className={`flex-1 py-3 text-[10px] font-black uppercase border-2 transition-all flex items-center justify-center gap-2 rounded-sm ${formData.type === t.value ? 'border-primary text-primary bg-primary/10' : 'border-[#1a1a1a] bg-black/40 text-zinc-700 hover:text-zinc-500'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Nível_de_Autorização</label>
                <div className="flex gap-2">
                  {LEVEL_OPTIONS.map(l => (
                    <button
                      key={l.value}
                      onClick={() => updateField('level', l.value)}
                      className={`flex-1 py-3 text-[10px] font-black uppercase border-2 transition-all rounded-sm ${formData.level === l.value ? 'border-primary text-primary bg-primary/10' : 'border-[#1a1a1a] bg-black/40 text-zinc-700 hover:text-zinc-500'}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Título_Operacional</label>
                <input
                  value={formData.title}
                  onChange={e => updateField('title', e.target.value)}
                  className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold px-4 py-3 text-white rounded-sm focus:border-primary transition-all uppercase tracking-widest"
                  placeholder="NOME_DA_ENTRADA"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Resumo_Executivo (Descrição)</label>
                <textarea
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  rows={2}
                  className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold px-4 py-3 text-white rounded-sm focus:border-primary transition-all resize-none"
                  placeholder="Descrição breve..."
                />
              </div>

              {formData.type === 'TEXT' && (
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Corpo_do_Documento_Digital</label>
                  <textarea
                    value={formData.textContent || ''}
                    onChange={e => updateField('textContent', e.target.value)}
                    rows={6}
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-mono px-4 py-3 text-primary/80 rounded-sm focus:border-primary transition-all resize-none"
                    placeholder="Conteúdo textual..."
                  />
                </div>
              )}

              {(formData.type === 'AUDIO' || formData.type === 'VISUAL') && (
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">
                    Vetor_de_Mídia (URL {formData.type === 'AUDIO' ? 'Áudio' : 'Imagem'})
                  </label>
                  <input
                    value={formData.mediaUrl || ''}
                    onChange={e => updateField('mediaUrl', e.target.value)}
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-mono px-4 py-3 text-white rounded-sm focus:border-primary transition-all"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="border-t-4 border-[#1a1a1a] pt-8">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Metadados_Sistêmicos</p>
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <label className="text-[8px] font-black text-zinc-700 uppercase block mb-1 tracking-widest">NPC_RESPONSÁVEL</label>
                    <input value={formData.metadata?.npc || ''} onChange={e => updateMeta('npc', e.target.value)} className="w-full bg-black/60 border border-[#1a1a1a] text-[10px] font-bold px-3 py-2 text-white rounded-sm focus:border-primary transition-all" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-zinc-700 uppercase block mb-1 tracking-widest">AUTOR_/_ORIGEM</label>
                    <input value={formData.metadata?.artist || ''} onChange={e => updateMeta('artist', e.target.value)} className="w-full bg-black/60 border border-[#1a1a1a] text-[10px] font-bold px-3 py-2 text-white rounded-sm focus:border-primary transition-all" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-zinc-700 uppercase block mb-1 tracking-widest">CAPÍTULO_/_SETOR</label>
                    <input value={formData.metadata?.chapter || ''} onChange={e => updateMeta('chapter', e.target.value)} className="w-full bg-black/60 border border-[#1a1a1a] text-[10px] font-bold px-3 py-2 text-white rounded-sm focus:border-primary transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-5 mt-6">
                  {formData.type === 'AUDIO' && (
                    <div>
                      <label className="text-[8px] font-black text-zinc-700 uppercase block mb-1 tracking-widest">DURAÇÃO (SEG)</label>
                      <input type="number" value={formData.metadata?.duration || ''} onChange={e => updateMeta('duration', parseInt(e.target.value) || 0)} className="w-full bg-black/60 border border-[#1a1a1a] text-[10px] font-bold px-3 py-2 text-white rounded-sm focus:border-primary transition-all" />
                    </div>
                  )}
                  {formData.type === 'VISUAL' && (
                    <div>
                      <label className="text-[8px] font-black text-zinc-700 uppercase block mb-1 tracking-widest">CATEGORIA_VISUAL</label>
                      <select value={formData.metadata?.visualCategory || ''} onChange={e => updateMeta('visualCategory', e.target.value || undefined)} className="w-full bg-black/60 border border-[#1a1a1a] text-[10px] font-bold px-3 py-2 text-primary rounded-sm focus:border-primary transition-all uppercase">
                        <option value="">—</option>
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                         <input type="checkbox" checked={formData.metadata?.isSecret || false} onChange={e => updateMeta('isSecret', e.target.checked)} className="peer hidden" />
                         <div className="w-5 h-5 border-2 border-[#1a1a1a] bg-black/60 rounded-sm peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                            <span className="material-symbols-outlined text-black text-sm font-black opacity-0 peer-checked:opacity-100 transition-opacity">check</span>
                         </div>
                      </div>
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest group-hover:text-primary transition-colors">SINAL_SIGILOSO</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t-4 border-[#1a1a1a] flex justify-end gap-6 relative z-10 bg-black/40">
              <button onClick={() => setShowEditor(false)} className="px-8 py-3 text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors">
                ABORTAR
              </button>
              <button onClick={handleSave} className="bg-primary hover:bg-primary-container text-black px-12 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 glow-orange shadow-lg">
                {editingItem ? 'SINCRONIZAR_ALTERAÇÕES' : 'REGISTRAR_DADO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-3xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="p-8 border-b-4 border-[#1a1a1a] flex justify-between items-center relative z-10 bg-black/40">
              <div>
                <h3 className="font-black text-xl text-white uppercase tracking-[0.2em]">Exportar_Registro_Mestre</h3>
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Cópia do IntelRegistry ({allItems.length} entradas localizadas)</p>
              </div>
              <button onClick={() => setShowExport(false)} className="p-2 text-zinc-600 hover:text-white material-symbols-outlined rounded-sm">close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar bg-black/20">
              <pre className="bg-black/60 border-2 border-[#1a1a1a] p-8 text-[11px] font-mono text-primary/60 whitespace-pre-wrap break-all rounded-xl leading-relaxed shadow-inner">
                 {exportJSON}
              </pre>
            </div>
            <div className="p-8 border-t-4 border-[#1a1a1a] flex justify-end gap-6 relative z-10 bg-black/40">
              <button
                onClick={() => { navigator.clipboard.writeText(exportJSON); setFeedback({ type: 'success', text: '✓ JSON_REGISTRY_COPIADO_COM_SUCESSO' }); setShowExport(false); }}
                className="bg-primary text-black px-12 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-primary-container transition-all rounded-sm active:scale-95 glow-orange shadow-lg flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                COPIAR_PARA_ÁREA_DE_TRANSFERÊNCIA
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
