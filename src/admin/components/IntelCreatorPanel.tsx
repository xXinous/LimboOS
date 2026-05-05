import React, { useState, useMemo, useCallback } from 'react';
import { intelRegistry, type EvidenceIntelAdmin } from '../../data/intel_registry';
import type { IntelItem, IntelType, AccessLevel, VisualCategory } from '../../types/intel';
import { ACCESS_LEVEL_LABELS } from '../../types/intel';

/**
 * IntelCreatorPanel — Interface administrativa para criar e gerenciar 
 * itens no IntelRegistry em tempo real.
 * 
 * Permite adicionar novos itens ao registro master sem editar código.
 * Itens criados aqui são registrados em memória (runtime) e podem ser
 * exportados como JSON para persistência no arquivo intel_registry.ts.
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
      const matchesSearch = !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());
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

    // Clean up empty metadata fields
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

  const handleExportJSON = () => {
    setShowExport(true);
  };

  const exportJSON = useMemo(() => {
    const items = intelRegistry.getAll();
    return JSON.stringify(items, null, 2);
  }, [showExport, allItems]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateMeta = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value },
    }));
  };

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = { AUDIO: 0, TEXT: 0, VISUAL: 0, META: 0, total: 0 };
    allItems.forEach(item => {
      stats[item.type]++;
      stats.total++;
    });
    return stats;
  }, [allItems]);

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-2 h-6 bg-orange-500" />
          <div>
            <h2 className="font-headline font-bold uppercase tracking-widest text-lg">Criador_de_Intel</h2>
            <p className="text-[9px] font-label text-zinc-500 uppercase tracking-widest">Registro mestre de colecionáveis</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportJSON} className="bg-zinc-800 text-zinc-300 px-4 py-2 text-[10px] font-bold border border-zinc-700 uppercase hover:bg-zinc-700 transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download</span>
            Exportar JSON
          </button>
          <button onClick={handleNewItem} className="bg-orange-900/40 text-orange-300 px-4 py-2 text-[10px] font-bold border border-orange-700/30 uppercase hover:bg-orange-800/40 transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">add</span>
            Nova Intel
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-surface-container-lowest border border-zinc-800 p-3 machined-edge">
          <p className="text-[9px] font-label text-zinc-500 uppercase tracking-widest">Total</p>
          <p className="text-xl font-headline font-bold text-primary-container">{typeStats.total}</p>
        </div>
        {TYPE_OPTIONS.map(t => (
          <div key={t.value} className="bg-surface-container-lowest border border-zinc-800 p-3 machined-edge">
            <p className="text-[9px] font-label text-zinc-500 uppercase tracking-widest">{t.label}</p>
            <p className="text-xl font-headline font-bold text-zinc-300">{typeStats[t.value]}</p>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-3 border text-[10px] font-mono uppercase tracking-wider ${feedback.type === 'success' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-red-500/30 text-red-400 bg-red-500/5'}`}>
          {feedback.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="BUSCAR_INTEL..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-800 text-[10px] font-label uppercase px-3 py-2 text-zinc-300 max-w-xs"
        />
        <div className="flex gap-1">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider border transition-colors ${filterType === 'ALL' ? 'border-orange-500 text-orange-400 bg-orange-500/10' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
          >
            Todos
          </button>
          {TYPE_OPTIONS.map(t => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1 ${filterType === t.value ? 'border-orange-500 text-orange-400 bg-orange-500/10' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
            >
              <span className="material-symbols-outlined text-xs">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="bg-surface-container-lowest border border-zinc-800 machined-edge overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_100px_100px_100px_60px] gap-0 text-[9px] font-label uppercase text-zinc-600 tracking-widest px-4 py-3 border-b border-zinc-800 bg-zinc-900/30">
          <span>Tipo</span>
          <span>Título / ID</span>
          <span>Capítulo</span>
          <span>NPC</span>
          <span>Nível</span>
          <span></span>
        </div>
        <div className="max-h-[400px] overflow-y-auto divide-y divide-zinc-800/50">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-zinc-700 text-[10px] uppercase font-label">
              Nenhum item encontrado
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="grid grid-cols-[40px_1fr_100px_100px_100px_60px] gap-0 px-4 py-3 items-center group hover:bg-zinc-800/20 transition-colors">
                <span className="material-symbols-outlined text-sm text-zinc-500">
                  {TYPE_OPTIONS.find(t => t.value === item.type)?.icon || 'description'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-300 truncate">{item.title}</p>
                  <p className="text-[8px] font-mono text-zinc-600 truncate">{item.id}</p>
                </div>
                <span className="text-[10px] text-zinc-500 truncate">{item.metadata?.chapter || '—'}</span>
                <span className="text-[10px] text-zinc-500 truncate">{item.metadata?.npc || '—'}</span>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${item.level >= 3 ? 'text-orange-400' : 'text-zinc-600'}`}>
                  {ACCESS_LEVEL_LABELS[item.level]}
                </span>
                <button
                  onClick={() => handleEditItem(item)}
                  className="material-symbols-outlined text-sm text-zinc-700 hover:text-orange-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  edit
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low border border-orange-500/30 w-full max-w-2xl machined-edge flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-headline text-lg text-zinc-200 uppercase">
                  {editingItem ? 'Editar Intel' : 'Nova Intel'}
                </h3>
                <p className="text-[9px] font-label text-zinc-500 uppercase">
                  {editingItem ? `Editando: ${editingItem.id}` : 'Criar novo item no registro'}
                </p>
              </div>
              <button onClick={() => setShowEditor(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* ID */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">ID (único)</label>
                  <input
                    value={formData.id}
                    onChange={e => updateField('id', e.target.value)}
                    disabled={!!editingItem}
                    className="w-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono px-3 py-2 text-zinc-300 disabled:opacity-40"
                    placeholder="intel_nome_do_item"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">Campanha (opcional)</label>
                  <input
                    value={formData.campaignId || ''}
                    onChange={e => updateField('campaignId', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono px-3 py-2 text-zinc-300"
                    placeholder="campaign_id"
                  />
                </div>
              </div>

              {/* Type + Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">Tipo</label>
                  <div className="flex gap-1">
                    {TYPE_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => updateField('type', t.value)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase border transition-colors flex items-center justify-center gap-1 ${formData.type === t.value ? 'border-orange-500 text-orange-400 bg-orange-500/10' : 'border-zinc-800 text-zinc-600'}`}
                      >
                        <span className="material-symbols-outlined text-xs">{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">Nível de Acesso</label>
                  <div className="flex gap-1">
                    {LEVEL_OPTIONS.map(l => (
                      <button
                        key={l.value}
                        onClick={() => updateField('level', l.value)}
                        className={`flex-1 py-2 text-[9px] font-bold uppercase border transition-colors ${formData.level === l.value ? 'border-orange-500 text-orange-400 bg-orange-500/10' : 'border-zinc-800 text-zinc-600'}`}
                      >
                        {l.value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">Título</label>
                <input
                  value={formData.title}
                  onChange={e => updateField('title', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-[11px] px-3 py-2 text-zinc-300"
                  placeholder="NOME_DO_ITEM"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-800 text-[11px] px-3 py-2 text-zinc-300 resize-none"
                  placeholder="Descrição breve do item..."
                />
              </div>

              {/* Type-specific fields */}
              {formData.type === 'TEXT' && (
                <div>
                  <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">Conteúdo Textual</label>
                  <textarea
                    value={formData.textContent || ''}
                    onChange={e => updateField('textContent', e.target.value)}
                    rows={5}
                    className="w-full bg-zinc-900 border border-zinc-800 text-[11px] px-3 py-2 text-zinc-300 resize-none font-mono"
                    placeholder="Conteúdo do disquete/documento..."
                  />
                </div>
              )}

              {(formData.type === 'AUDIO' || formData.type === 'VISUAL') && (
                <div>
                  <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">
                    URL de Mídia {formData.type === 'AUDIO' ? '(áudio)' : '(imagem/vídeo)'}
                  </label>
                  <input
                    value={formData.mediaUrl || ''}
                    onChange={e => updateField('mediaUrl', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-[11px] px-3 py-2 text-zinc-300 font-mono"
                    placeholder="https://..."
                  />
                </div>
              )}

              {formData.type === 'META' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">Ícone (emoji)</label>
                    <input
                      value={formData.metadata?.icon || ''}
                      onChange={e => updateMeta('icon', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-[11px] px-3 py-2 text-zinc-300"
                      placeholder="🏆"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-1 block">Condição de Desbloqueio</label>
                    <input
                      value={formData.metadata?.unlockCondition || ''}
                      onChange={e => updateMeta('unlockCondition', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-[11px] px-3 py-2 text-zinc-300"
                      placeholder="Completar missão X"
                    />
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="border-t border-zinc-800 pt-4">
                <p className="text-[9px] font-label text-zinc-500 uppercase tracking-widest mb-3">Metadados</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[8px] font-label text-zinc-600 uppercase block mb-0.5">NPC</label>
                    <input value={formData.metadata?.npc || ''} onChange={e => updateMeta('npc', e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 text-[10px] px-2 py-1.5 text-zinc-300" />
                  </div>
                  <div>
                    <label className="text-[8px] font-label text-zinc-600 uppercase block mb-0.5">Artista</label>
                    <input value={formData.metadata?.artist || ''} onChange={e => updateMeta('artist', e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 text-[10px] px-2 py-1.5 text-zinc-300" />
                  </div>
                  <div>
                    <label className="text-[8px] font-label text-zinc-600 uppercase block mb-0.5">Capítulo</label>
                    <input value={formData.metadata?.chapter || ''} onChange={e => updateMeta('chapter', e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 text-[10px] px-2 py-1.5 text-zinc-300" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {formData.type === 'AUDIO' && (
                    <div>
                      <label className="text-[8px] font-label text-zinc-600 uppercase block mb-0.5">Duração (s)</label>
                      <input type="number" value={formData.metadata?.duration || ''} onChange={e => updateMeta('duration', parseInt(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 text-[10px] px-2 py-1.5 text-zinc-300" />
                    </div>
                  )}
                  {formData.type === 'VISUAL' && (
                    <div>
                      <label className="text-[8px] font-label text-zinc-600 uppercase block mb-0.5">Categoria Visual</label>
                      <select value={formData.metadata?.visualCategory || ''} onChange={e => updateMeta('visualCategory', e.target.value || undefined)} className="w-full bg-zinc-900 border border-zinc-700 text-[10px] px-2 py-1.5 text-zinc-300">
                        <option value="">—</option>
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-[8px] font-label text-zinc-600 uppercase block mb-0.5">Dica</label>
                    <input value={formData.metadata?.hint || ''} onChange={e => updateMeta('hint', e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 text-[10px] px-2 py-1.5 text-zinc-300" />
                  </div>
                  <div className="flex items-end gap-2 pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.metadata?.isSecret || false} onChange={e => updateMeta('isSecret', e.target.checked)} className="accent-orange-500" />
                      <span className="text-[9px] font-label text-zinc-400 uppercase">Secreto</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-[10px] font-label text-zinc-500 uppercase hover:text-zinc-300 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} className="bg-orange-600 text-white px-6 py-2 text-[10px] font-label uppercase font-bold hover:bg-orange-500 transition-colors">
                {editingItem ? 'Salvar Alterações' : 'Registrar Intel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low border border-zinc-700 w-full max-w-2xl machined-edge flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-headline text-lg text-zinc-200 uppercase">Exportar_Registro</h3>
                <p className="text-[9px] font-label text-zinc-500 uppercase">JSON do IntelRegistry ({allItems.length} itens)</p>
              </div>
              <button onClick={() => setShowExport(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="bg-zinc-950 border border-zinc-800 p-4 text-[10px] font-mono text-zinc-400 whitespace-pre-wrap break-all">{exportJSON}</pre>
            </div>
            <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => { navigator.clipboard.writeText(exportJSON); setFeedback({ type: 'success', text: '✓ JSON copiado para a área de transferência.' }); setShowExport(false); }}
                className="bg-zinc-700 text-white px-6 py-2 text-[10px] font-label uppercase font-bold hover:bg-zinc-600 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Copiar JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
