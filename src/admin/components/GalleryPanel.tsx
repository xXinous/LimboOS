import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useModal } from './ConfirmModal';
import { activityLogger } from '../../services/ActivityLogger';
import {
  uploadGalleryImage,
  deleteGalleryImage,
  fetchAllGalleryImages,
  grantGalleryImage,
  revokeGalleryImage,
  grantGalleryImageToMultiple,
  fetchUserGalleryGrants,
} from '../../store/firestore';
import type { GalleryImage, GalleryCategory } from '../../store/firestore';
interface UserData {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  role: string;
}
const CATEGORIES: { id: GalleryCategory; label: string; icon: string }[] = [
  { id: 'locais', label: 'Locais', icon: 'location_on' },
  { id: 'pistas', label: 'Pistas', icon: 'search' },
  { id: 'pessoas', label: 'Pessoas', icon: 'person' },
  { id: 'itens', label: 'Itens', icon: 'inventory_2' },
];
export default function GalleryPanel() {
  const { showAlert, modal } = useModal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<GalleryCategory | 'all'>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState<GalleryCategory>('locais');
  const [uploading, setUploading] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState<GalleryImage | null>(null);
  const [grantedUids, setGrantedUids] = useState<Set<string>>(new Set());
  const [grantLoading, setGrantLoading] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);
  const loadImages = useCallback(async () => {
    try {
      const data = await fetchAllGalleryImages();
      setImages(data);
    } catch (err) {
      console.error('Error loading gallery:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadImages();
  }, [loadImages]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserData[] = [];
      snap.forEach((d) => list.push(d.data() as UserData));
      setUsers(list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
    });
    return () => unsub();
  }, []);
  const filteredImages = useMemo(() => {
    if (activeCategory === 'all') return images;
    return images.filter(img => img.category === activeCategory);
  }, [images, activeCategory]);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      await uploadGalleryImage(uploadFile, uploadCategory, uploadTitle.trim(), uploadDesc.trim(), 'gm.mpg');
      activityLogger.logAdmin('gm.mpg', 'gallery_upload', `Enviou imagem: ${uploadTitle.trim()}`, { category: uploadCategory });
      await loadImages();
      setShowUpload(false);
      resetUploadForm();
    } catch (err) {
      console.error('Upload error:', err);
      showAlert('Erro', 'Falha ao enviar imagem.');
    } finally {
      setUploading(false);
    }
  };
  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setUploadTitle('');
    setUploadDesc('');
    setUploadCategory('locais');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleDelete = async (image: GalleryImage) => {
    try {
      await deleteGalleryImage(image.id);
      activityLogger.logAdmin('gm.mpg', 'gallery_delete', `Removeu imagem: ${image.title}`, { imageId: image.id });
      setImages(prev => prev.filter(i => i.id !== image.id));
    } catch (err) {
      console.error('Delete error:', err);
      showAlert('Erro', 'Falha ao remover imagem.');
    }
  };
  const openGrantModal = async (image: GalleryImage) => {
    setShowGrantModal(image);
    setPlayerSearch('');
    setGrantLoading(true);
    try {
      const uids = await fetchUserGalleryGrants(image.id);
      setGrantedUids(new Set(uids));
    } catch (err) {
      console.error('Error fetching grants:', err);
    } finally {
      setGrantLoading(false);
    }
  };
  const toggleGrant = async (uid: string) => {
    if (!showGrantModal) return;
    const imageId = showGrantModal.id;
    const isGranted = grantedUids.has(uid);
    try {
      if (isGranted) {
        await revokeGalleryImage(uid, imageId);
        setGrantedUids(prev => { const n = new Set(prev); n.delete(uid); return n; });
        activityLogger.logAdmin('gm.mpg', 'gallery_revoke', `Revogou acesso à imagem ${showGrantModal.title} de ${uid}`, { uid, imageId });
      } else {
        await grantGalleryImage(uid, imageId);
        setGrantedUids(prev => new Set(prev).add(uid));
        activityLogger.logAdmin('gm.mpg', 'gallery_grant', `Liberou imagem ${showGrantModal.title} para ${uid}`, { uid, imageId });
      }
    } catch (err) {
      console.error('Grant toggle error:', err);
    }
  };
  const grantToAll = async () => {
    if (!showGrantModal) return;
    setGrantLoading(true);
    try {
      const playerUids = users.filter(u => u.role !== 'admin').map(u => u.uid);
      await grantGalleryImageToMultiple(playerUids, showGrantModal.id);
      setGrantedUids(new Set(playerUids));
      activityLogger.logAdmin('gm.mpg', 'gallery_grant_all', `Liberou imagem ${showGrantModal.title} para todos os jogadores`, { imageId: showGrantModal.id, count: playerUids.length });
    } catch (err) {
      console.error('Grant all error:', err);
    } finally {
      setGrantLoading(false);
    }
  };
  const filteredPlayers = useMemo(() => {
    return users.filter(u => {
      if (u.role === 'admin') return false;
      const q = playerSearch.toLowerCase();
      if (!q) return true;
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [users, playerSearch]);
  const getCategoryInfo = (cat: GalleryCategory) => CATEGORIES.find(c => c.id === cat)!;
  return (
    <section className="space-y-0">
      {modal}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-2 h-6 bg-cyan-500" />
        <h2 className="font-headline font-bold uppercase tracking-widest text-lg">
          Galeria_de_Imagens
        </h2>
        <span className="text-[10px] font-label text-zinc-500 tracking-wider">
          {images.length} IMAGENS
        </span>
      </div>
      {}
      <div className="bg-surface-container-lowest border border-zinc-800 machined-edge mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 text-[10px] font-label uppercase tracking-widest transition-all ${
                activeCategory === 'all'
                  ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              Todos ({images.length})
            </button>
            {CATEGORIES.map(cat => {
              const count = images.filter(i => i.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 text-[10px] font-label uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                    activeCategory === cat.id
                      ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">{cat.icon}</span>
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
          <button
            onClick={() => { setShowUpload(true); resetUploadForm(); }}
            className="flex items-center gap-2 bg-cyan-900/40 text-cyan-300 px-4 py-2 font-label text-[10px] font-bold tracking-widest hover:bg-cyan-800/40 transition-all machined-edge border border-cyan-700/30"
          >
            <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
            ENVIAR_IMAGEM
          </button>
        </div>
        {}
        {loading ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-2xl text-zinc-600 animate-spin block mb-2">sync</span>
            <p className="font-label text-xs text-zinc-600 tracking-widest">CARREGANDO_GALERIA...</p>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-zinc-700 block mb-3">photo_library</span>
            <p className="font-label text-xs uppercase tracking-widest text-zinc-600">
              {activeCategory === 'all' ? 'NENHUMA_IMAGEM_NA_GALERIA' : 'NENHUMA_IMAGEM_NESTA_CATEGORIA'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
            {filteredImages.map(img => {
              const catInfo = getCategoryInfo(img.category);
              return (
                <div
                  key={img.id}
                  className="bg-zinc-900 border border-zinc-800 group relative overflow-hidden hover:border-cyan-500/30 transition-all"
                >
                  <div
                    className="aspect-square bg-zinc-800 overflow-hidden cursor-pointer"
                    onClick={() => setPreviewImage(img)}
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-[10px] text-cyan-500">{catInfo.icon}</span>
                      <span className="text-[8px] font-label uppercase tracking-widest text-cyan-500/70">{catInfo.label}</span>
                    </div>
                    <p className="font-headline text-xs font-bold text-zinc-200 truncate">{img.title}</p>
                    {img.description && (
                      <p className="text-[9px] text-zinc-500 truncate mt-0.5">{img.description}</p>
                    )}
                  </div>
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openGrantModal(img)}
                      className="w-7 h-7 bg-black/70 backdrop-blur-sm border border-cyan-500/30 flex items-center justify-center hover:bg-cyan-900/50 transition-colors"
                      title="Gerenciar acesso"
                    >
                      <span className="material-symbols-outlined text-cyan-400 text-xs">group_add</span>
                    </button>
                    <button
                      onClick={() => handleDelete(img)}
                      className="w-7 h-7 bg-black/70 backdrop-blur-sm border border-red-500/30 flex items-center justify-center hover:bg-red-900/50 transition-colors"
                      title="Deletar imagem"
                    >
                      <span className="material-symbols-outlined text-red-400 text-xs">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-cyan-500/30 w-full max-w-lg machined-edge flex flex-col max-h-[85vh]">
            <div className="px-6 pt-5 pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3 mb-1">
                <span className="material-symbols-outlined text-cyan-400 text-xl">add_photo_alternate</span>
                <h3 className="font-headline text-lg text-zinc-200">ENVIAR_IMAGEM</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {}
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-2 uppercase tracking-widest">Categoria</label>
                <div className="flex gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setUploadCategory(cat.id)}
                      className={`flex-1 py-2 text-[10px] font-label uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border ${
                        uploadCategory === cat.id
                          ? 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10'
                          : 'text-zinc-500 border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              {}
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-1 uppercase tracking-widest">Título</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="NOME_DA_IMAGEM..."
                  className="w-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 px-3 py-2 focus:border-cyan-500 outline-none placeholder:text-zinc-700 font-label"
                />
              </div>
              {}
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-1 uppercase tracking-widest">Descrição</label>
                <textarea
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="Descrição da imagem..."
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 px-3 py-2 focus:border-cyan-500 outline-none placeholder:text-zinc-700 font-body resize-none"
                />
              </div>
              {}
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-2 uppercase tracking-widest">Arquivo</label>
                {uploadPreview ? (
                  <div className="relative">
                    <img src={uploadPreview} alt="Preview" className="w-full max-h-48 object-contain bg-zinc-800 border border-zinc-700" />
                    <button
                      onClick={resetUploadForm}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/70 border border-zinc-600 flex items-center justify-center hover:bg-red-900/50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs text-zinc-300">close</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-zinc-700 py-8 flex flex-col items-center gap-2 hover:border-cyan-500/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-3xl text-zinc-600">cloud_upload</span>
                    <span className="text-[10px] font-label text-zinc-500 tracking-widest uppercase">Clique para selecionar</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => { setShowUpload(false); resetUploadForm(); }}
                className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadTitle.trim() || uploading}
                className="px-5 py-2 text-xs font-label bg-cyan-900/60 text-cyan-300 font-bold tracking-wider hover:bg-cyan-800/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-cyan-700/30"
              >
                {uploading ? 'ENVIANDO...' : 'ENVIAR'}
              </button>
            </div>
          </div>
        </div>
      )}
      {}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-cyan-500/30 w-full max-w-lg machined-edge flex flex-col max-h-[85vh]">
            <div className="px-6 pt-5 pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3 mb-1">
                <span className="material-symbols-outlined text-cyan-400 text-xl">group_add</span>
                <h3 className="font-headline text-lg text-zinc-200">GERENCIAR_ACESSO</h3>
              </div>
              <div className="flex items-center gap-3 mt-3 bg-zinc-900 p-3 border border-zinc-800">
                <img src={showGrantModal.imageUrl} alt="" className="w-12 h-12 object-cover border border-zinc-700" />
                <div className="flex-1 min-w-0">
                  <p className="font-headline text-xs font-bold text-zinc-200 truncate">{showGrantModal.title}</p>
                  <p className="text-[9px] font-label text-cyan-500/70 uppercase tracking-widest">{getCategoryInfo(showGrantModal.category).label}</p>
                </div>
                <span className="text-[10px] font-label text-zinc-500 tracking-wider shrink-0">{grantedUids.size} LIBERADOS</span>
              </div>
            </div>
            <div className="px-5 py-3 border-b border-zinc-800 flex gap-2">
              <input
                type="text"
                placeholder="BUSCAR_JOGADOR..."
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 text-[10px] font-label uppercase tracking-widest focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 placeholder:text-zinc-700 text-zinc-300 px-3 py-2"
              />
              <button
                onClick={grantToAll}
                disabled={grantLoading}
                className="px-3 py-2 text-[10px] font-label uppercase tracking-widest bg-cyan-900/30 text-cyan-400 border border-cyan-700/30 hover:bg-cyan-800/30 transition-colors disabled:opacity-30 shrink-0"
              >
                LIBERAR_TODOS
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {grantLoading ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-xl text-zinc-600 animate-spin block mb-2">sync</span>
                  <p className="font-label text-xs text-zinc-600 tracking-widest">CARREGANDO...</p>
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="p-8 text-center text-zinc-600 font-label text-xs tracking-widest">
                  NENHUM_JOGADOR_ENCONTRADO
                </div>
              ) : (
                filteredPlayers.map(u => {
                  const isGranted = grantedUids.has(u.uid);
                  return (
                    <button
                      key={u.uid}
                      onClick={() => toggleGrant(u.uid)}
                      className={`w-full text-left px-5 py-3 border-b border-zinc-800/40 last:border-b-0 transition-all flex items-center gap-3 ${
                        isGranted ? 'bg-cyan-500/5' : 'hover:bg-zinc-800/30'
                      }`}
                    >
                      <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${
                        isGranted ? 'bg-cyan-500 border-cyan-500' : 'border-zinc-600'
                      }`}>
                        {isGranted && <span className="material-symbols-outlined text-white text-xs">check</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-headline text-xs font-bold truncate ${isGranted ? 'text-cyan-300' : 'text-zinc-200'}`}>
                          {u.displayName || u.username || 'UNKNOWN'}
                        </p>
                        <p className="text-[9px] font-label text-zinc-600 truncate">{u.email}</p>
                      </div>
                      <span className={`text-[8px] font-label uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${
                        isGranted
                          ? 'border-cyan-500/30 text-cyan-400'
                          : 'border-zinc-700 text-zinc-600'
                      }`}>
                        {isGranted ? 'LIBERADO' : 'BLOQUEADO'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => { setShowGrantModal(null); setGrantedUids(new Set()); }}
                className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}
      {}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full mx-4" onClick={e => e.stopPropagation()}>
            <img
              src={previewImage.imageUrl}
              alt={previewImage.title}
              className="w-full h-auto max-h-[75vh] object-contain"
            />
            <div className="mt-3 px-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-xs text-cyan-500">{getCategoryInfo(previewImage.category).icon}</span>
                <span className="text-[9px] font-label uppercase tracking-widest text-cyan-500/70">{getCategoryInfo(previewImage.category).label}</span>
              </div>
              <p className="font-headline text-lg font-bold text-white">{previewImage.title}</p>
              {previewImage.description && (
                <p className="text-sm text-zinc-400 mt-1">{previewImage.description}</p>
              )}
            </div>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/70 border border-zinc-600 flex items-center justify-center hover:bg-zinc-800 transition-colors"
            >
              <span className="material-symbols-outlined text-white text-sm">close</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
