import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { mediaService } from '../../services/MediaService';
import { MediaAsset, MediaType } from '../../types/media';
import { useModal } from './ConfirmModal';
import RetroSpinner from '../../components/player/RetroSpinner';
import Screw from '../../components/player/Screw';

interface MediaLibraryPanelProps {
  onSelect?: (asset: MediaAsset) => void;
  selectionMode?: boolean;
  allowedTypes?: MediaType[];
}

export default function MediaLibraryPanel({ onSelect, selectionMode = false, allowedTypes }: MediaLibraryPanelProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filter, setFilter] = useState<MediaType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showAlert, showConfirm } = useModal();

  useEffect(() => {
    const unsub = mediaService.subscribeToMedia(
      (newAssets) => {
        setAssets(newAssets);
        setLoading(false);
      },
      filter === 'all' ? undefined : filter
    );
    return () => unsub();
  }, [filter]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Skip if not in allowed types (if selection mode)
        if (allowedTypes && !allowedTypes.some(t => file.type.startsWith(t))) {
          continue;
        }
        await mediaService.uploadMedia(file, 'gm.mpg', (progress) => {
          setUploadProgress(progress);
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('Erro de Upload', 'Falha ao enviar um ou mais arquivos.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (asset: MediaAsset) => {
    const confirmed = await showConfirm(
      'DELETAR ARQUIVO',
      `Tem certeza que deseja remover permanentemente "${asset.filename}"? Isso pode quebrar links existentes.`
    );
    if (confirmed) {
      try {
        await mediaService.deleteMedia(asset);
      } catch (error) {
        showAlert('Erro', 'Falha ao deletar arquivo.');
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredAssets = assets.filter(a => 
    a.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.metadata.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {uploading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex flex-col items-center justify-center gap-6">
          <RetroSpinner />
          <div className="space-y-2 text-center">
            <div className="text-primary font-display font-bold uppercase tracking-[0.4em] animate-pulse text-lg">Transferindo_Dados...</div>
            <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden border border-primary/10">
              <motion.div 
                className="h-full bg-primary glow-orange"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-[10px] font-display font-bold text-industrial-silver/40 tracking-widest uppercase">{Math.round(uploadProgress)}% COMPLETO</div>
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_15px_rgba(255,140,0,0.5)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-xl text-white">Central de Mídia</h2>
            <p className="text-[10px] font-display font-bold text-industrial-silver/40 tracking-[0.2em] uppercase">
              {assets.length} Itens Armazenados // Protocolo de Acesso RM-84
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/30 text-base group-focus-within:text-primary transition-colors">search</span>
            <input
              type="text"
              placeholder="BUSCAR_ARQUIVO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-container-lowest border border-primary/10 text-[10px] font-display font-bold uppercase tracking-[0.2em] focus:border-primary/50 w-full sm:w-64 placeholder:text-industrial-silver/20 text-white pl-10 pr-4 py-2.5 outline-none rounded-sm transition-all"
            />
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => handleUpload(e.target.files)} 
            multiple 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-primary hover:bg-primary-container text-black px-5 py-2.5 rounded-sm font-display font-bold text-[10px] tracking-widest transition-all group active:scale-95 glow-orange shadow-lg"
          >
            <span className="material-symbols-outlined text-base">{uploading ? 'sync' : 'add_circle'}</span>
            NOVO_UPLOAD
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      {!selectionMode && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleUpload(e.dataTransfer.files); }}
          className={`relative border-2 border-dashed rounded-sm p-10 text-center transition-all group overflow-hidden ${
            isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-primary/10 bg-black/20 hover:border-primary/20 hover:bg-black/40'
          }`}
        >
          <div className="absolute top-2 left-2 opacity-20"><Screw size="xs" /></div>
          <div className="absolute top-2 right-2 opacity-20"><Screw size="xs" /></div>
          <div className="absolute bottom-2 left-2 opacity-20"><Screw size="xs" /></div>
          <div className="absolute bottom-2 right-2 opacity-20"><Screw size="xs" /></div>
          
          <div className="relative inline-block mb-3">
            <span className={`material-symbols-outlined text-4xl transition-all duration-300 ${isDragOver ? 'text-primary scale-110' : 'text-industrial-silver/20 group-hover:text-primary/40'}`}>
              {isDragOver ? 'downloading' : 'cloud_upload'}
            </span>
          </div>
          <p className="text-industrial-silver/60 text-[10px] font-display font-bold uppercase tracking-[0.3em] group-hover:text-industrial-silver/80">
            {isDragOver ? 'SOLTAR AGORA' : 'ARRASTAR E SOLTAR ARQUIVOS PARA CENTRALIZAR'}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex border-b border-primary/10">
        <FilterTab label="Todos" active={filter === 'all'} onClick={() => setFilter('all')} icon="grid_view" />
        <FilterTab label="Áudio" active={filter === 'audio'} onClick={() => setFilter('audio')} icon="audiotrack" />
        <FilterTab label="Imagens" active={filter === 'image'} onClick={() => setFilter('image')} icon="image" />
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] font-display font-bold text-primary/40 uppercase tracking-[0.4em]">Indexando_Acervo...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredAssets.map((asset) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={asset.id}
                className={`group relative aspect-square bg-surface-container-low border border-primary/10 overflow-hidden hover:border-primary/50 transition-all ${selectionMode ? 'cursor-pointer' : ''}`}
                onClick={() => selectionMode && onSelect?.(asset)}
              >
                {/* Preview Overlay */}
                <div className="absolute inset-0 z-0">
                  {asset.type === 'image' ? (
                    <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/40">
                      <span className="material-symbols-outlined text-4xl text-primary/20 group-hover:text-primary/60 transition-colors">
                        {asset.type === 'audio' ? 'audiotrack' : 'description'}
                      </span>
                      {asset.type === 'audio' && (
                         <div className="flex gap-0.5 mt-2 h-4 items-end">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className="w-1 bg-primary/20 group-hover:animate-pulse" style={{ height: `${Math.random() * 100}%` }} />
                            ))}
                         </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Info Overlay */}
                <div className="absolute inset-0 z-10 bg-linear-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                  <p className="text-[9px] font-display font-bold text-white uppercase truncate tracking-widest">{asset.metadata.title || asset.filename}</p>
                  <p className="text-[8px] font-display text-industrial-silver/60 uppercase tracking-widest">{formatSize(asset.size)}</p>
                </div>

                {/* Actions */}
                {!selectionMode && (
                  <div className="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                      className="p-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                )}
                
                {asset.type === 'audio' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const a = new Audio(asset.url);
                      a.play();
                    }}
                    className="absolute top-1 left-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-primary/20 hover:bg-primary text-primary hover:text-black rounded-sm"
                  >
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      
      {!loading && filteredAssets.length === 0 && (
        <div className="text-center py-20 border border-primary/5 bg-black/10">
          <span className="material-symbols-outlined text-4xl text-industrial-silver/10 mb-2">folder_off</span>
          <p className="text-[10px] font-display font-bold text-industrial-silver/20 uppercase tracking-[0.3em]">Nenhum arquivo encontrado no setor selecionado</p>
        </div>
      )}
    </div>
  );
}

function FilterTab({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 text-[10px] font-display font-bold tracking-[0.2em] transition-all border-r border-primary/10 uppercase ${active ? 'bg-primary/10 text-primary border-b-2 border-b-primary' : 'text-industrial-silver/50 hover:bg-primary/5 hover:text-primary'}`}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      {label}
    </button>
  );
}
