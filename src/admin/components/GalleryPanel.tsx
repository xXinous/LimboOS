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
  updateGalleryImage,
} from '../../store/firestore';
import type { GalleryImage, GalleryCategory } from '../../store/firestore';
import Screw from '../../components/player/Screw';

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
  const [uploadLevel, setUploadLevel] = useState<number>(1);
  const [uploading, setUploading] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState<GalleryImage | null>(null);
  const [editModalImage, setEditModalImage] = useState<GalleryImage | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState<GalleryCategory>('locais');
  const [editLevel, setEditLevel] = useState<number>(1);
  const [editSaving, setEditSaving] = useState(false);
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
      await uploadGalleryImage(uploadFile, uploadCategory, uploadTitle.trim(), uploadDesc.trim(), 'gm.mpg', uploadLevel);
      activityLogger.logAdmin('gm.mpg', 'gallery_upload', `Enviou imagem: ${uploadTitle.trim()}`, { category: uploadCategory, level: uploadLevel });
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
    setUploadLevel(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditModal = (img: GalleryImage) => {
    setEditTitle(img.title);
    setEditDesc(img.description);
    setEditCategory(img.category);
    setEditLevel(img.level || 1);
    setEditModalImage(img);
  };

  const saveEdit = async () => {
    if (!editModalImage || !editTitle.trim()) return;
    setEditSaving(true);
    try {
      await updateGalleryImage(editModalImage.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        category: editCategory,
        level: editLevel
      });
      activityLogger.logAdmin('gm.mpg', 'gallery_edit', `Editou imagem: ${editTitle.trim()}`, { imageId: editModalImage.id });
      await loadImages();
      setEditModalImage(null);
    } catch (err) {
      console.error('Edit error:', err);
      showAlert('Erro', 'Falha ao editar imagem.');
    } finally {
      setEditSaving(false);
    }
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
    <section className="space-y-6 font-chakra">
      {modal}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
          <h2 className="font-black uppercase tracking-widest text-lg text-white">
            Galeria_de_Registros_Visuais
          </h2>
          <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">
            {images.length} ARQUIVOS SINCRONIZADOS
          </span>
        </div>
        <button
          onClick={() => { setShowUpload(true); resetUploadForm(); }}
          className="flex items-center gap-2 bg-cyan-900/20 text-cyan-400 px-6 py-2.5 rounded-sm font-black text-[10px] tracking-widest hover:bg-cyan-900/40 transition-all border border-cyan-500/20 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
        >
          <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
          NOVO_REGISTRO
        </button>
      </div>

      <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-black/40 border-b-4 border-[#1a1a1a]">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm border-2 ${
                activeCategory === 'all'
                  ? 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
                  : 'text-zinc-600 border-transparent hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              TODOS ({images.length})
            </button>
            {CATEGORIES.map(cat => {
              const count = images.filter(i => i.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 rounded-sm border-2 ${
                    activeCategory === cat.id
                      ? 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
                      : 'text-zinc-600 border-transparent hover:text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">{cat.icon}</span>
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="p-24 text-center">
            <span className="material-symbols-outlined text-3xl text-cyan-900 animate-spin block mb-4">sync</span>
            <p className="font-black text-xs text-zinc-600 tracking-[0.4em]">CARREGANDO_GALERIA...</p>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="p-24 text-center border-4 border-dashed border-[#1a1a1a] m-6 rounded-xl opacity-20">
            <span className="material-symbols-outlined text-6xl text-zinc-800 block mb-4">photo_library</span>
            <p className="font-black text-sm uppercase tracking-[0.4em] text-zinc-600">
              {activeCategory === 'all' ? 'GALERIA_VAZIA' : 'SEM_REGISTROS_NESTA_CATEGORIA'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-6">
            {filteredImages.map(img => {
              const catInfo = getCategoryInfo(img.category);
              return (
                <div
                  key={img.id}
                  className="bg-black border-4 border-[#1a1a1a] group relative overflow-hidden hover:border-cyan-500/40 transition-all rounded-xl shadow-lg active:scale-95"
                >
                  <div
                    className="aspect-square bg-zinc-950 overflow-hidden cursor-pointer"
                    onClick={() => setPreviewImage(img)}
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.title}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 grayscale group-hover:grayscale-0"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4 bg-[#1a1a1a]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[12px] text-cyan-500">{catInfo.icon}</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-cyan-500/50">{catInfo.label}</span>
                    </div>
                    <p className="font-black text-xs text-white truncate uppercase tracking-wide group-hover:text-cyan-400 transition-colors">{img.title}</p>
                  </div>
                  <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    <button
                      onClick={() => openGrantModal(img)}
                      className="w-8 h-8 bg-black/80 backdrop-blur-md border border-cyan-500/30 flex items-center justify-center hover:bg-cyan-500 hover:text-black transition-all rounded-sm"
                      title="Liberar Acesso"
                    >
                      <span className="material-symbols-outlined text-xs">group_add</span>
                    </button>
                    <button
                      onClick={() => openEditModal(img)}
                      className="w-8 h-8 bg-black/80 backdrop-blur-md border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-all rounded-sm"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(img)}
                      className="w-8 h-8 bg-black/80 backdrop-blur-md border border-red-500/30 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all rounded-sm"
                      title="Remover"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="px-10 pt-10 pb-6 border-b-4 border-[#1a1a1a] relative z-10 bg-black/40">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-500/10 border-2 border-cyan-500/20 rounded-sm">
                   <span className="material-symbols-outlined text-cyan-400 text-2xl">add_photo_alternate</span>
                </div>
                <div>
                   <h3 className="font-black text-xl text-white uppercase tracking-widest">Enviar_Novo_Registro</h3>
                   <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1 tracking-widest">Documentação visual de campo</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-8 relative z-10 custom-scrollbar">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Classificação_por_Categoria</label>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setUploadCategory(cat.id)}
                      className={`py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border-2 rounded-sm ${
                        uploadCategory === cat.id
                          ? 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                          : 'text-zinc-700 border-[#1a1a1a] bg-black/40 hover:text-zinc-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nível_de_Criptografia</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setUploadLevel(lvl)}
                      className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center border-2 rounded-sm ${
                        uploadLevel === lvl
                          ? 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
                          : 'text-zinc-700 border-[#1a1a1a] bg-black/40 hover:text-zinc-500'
                      }`}
                    >
                      {lvl === 1 ? 'RESTRITO' : lvl === 2 ? 'CONFIDENCIAL' : lvl === 3 ? 'SIGILOSO' : 'TOP SECRET'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Identificador_do_Registro (Título)</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="DIGITAR_TÍTULO..."
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold text-white px-5 py-4 focus:border-cyan-500/40 outline-none placeholder:text-zinc-800 rounded-sm uppercase tracking-widest"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Notas_de_Campo (Descrição)</label>
                  <textarea
                    value={uploadDesc}
                    onChange={e => setUploadDesc(e.target.value)}
                    placeholder="Informações adicionais..."
                    rows={3}
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold text-white px-5 py-4 focus:border-cyan-500/40 outline-none placeholder:text-zinc-800 rounded-sm resize-none tracking-wide"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Arquivo_de_Imagem</label>
                {uploadPreview ? (
                  <div className="relative group">
                    <img src={uploadPreview} alt="Preview" className="w-full max-h-64 object-contain bg-black border-4 border-[#1a1a1a] rounded-xl shadow-2xl" />
                    <button
                      onClick={resetUploadForm}
                      className="absolute top-4 right-4 w-10 h-10 bg-black/80 border-2 border-white/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all rounded-full"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-4 border-dashed border-[#1a1a1a] bg-black/20 py-16 flex flex-col items-center gap-4 hover:border-cyan-500/20 transition-all rounded-xl group"
                  >
                    <span className="material-symbols-outlined text-5xl text-zinc-800 group-hover:text-cyan-900 transition-colors">cloud_upload</span>
                    <span className="text-[10px] font-black text-zinc-700 tracking-[0.4em] uppercase group-hover:text-zinc-500">Selecionar_Unidade_de_Dados</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </div>
            </div>
            
            <div className="px-10 py-8 border-t-4 border-[#1a1a1a] flex justify-end gap-6 relative z-10 bg-black/40">
              <button
                onClick={() => { setShowUpload(false); resetUploadForm(); }}
                className="px-8 py-3 text-[10px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
              >
                ABORTAR
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadTitle.trim() || uploading}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-12 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 disabled:opacity-20 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
              >
                {uploading ? 'TRANSMITINDO...' : 'ENVIAR_PARA_GRID'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGrantModal && (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="px-10 pt-10 pb-6 border-b-4 border-[#1a1a1a] relative z-10 bg-black/40">
              <div className="flex items-center gap-4 mb-8">
                <span className="material-symbols-outlined text-cyan-400 text-2xl">group_add</span>
                <h3 className="font-black text-xl text-white uppercase tracking-widest">Gerenciar_Sincronização</h3>
              </div>
              <div className="flex items-center gap-6 bg-black/60 p-5 border-2 border-[#1a1a1a] rounded-xl shadow-inner">
                <img src={showGrantModal.imageUrl} alt="" className="w-16 h-16 object-cover border-2 border-[#1a1a1a] rounded-sm grayscale" />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-white truncate uppercase tracking-wider">{showGrantModal.title}</p>
                  <p className="text-[10px] font-bold text-cyan-500/50 uppercase tracking-widest mt-1">{getCategoryInfo(showGrantModal.category).label}</p>
                </div>
                <div className="bg-black/80 px-3 py-1.5 border border-white/5 rounded-sm">
                   <span className="text-[10px] font-black text-cyan-400 tracking-widest">{grantedUids.size} ATIVOS</span>
                </div>
              </div>
            </div>

            <div className="px-10 py-6 border-b-2 border-[#1a1a1a] flex gap-4 relative z-10">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-sm">search</span>
                <input
                  type="text"
                  placeholder="BUSCAR_AGENTES..."
                  value={playerSearch}
                  onChange={e => setPlayerSearch(e.target.value)}
                  className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-cyan-500 placeholder:text-zinc-900 text-white px-12 py-3.5 rounded-sm transition-all"
                />
              </div>
              <button
                onClick={grantToAll}
                disabled={grantLoading}
                className="px-6 py-3 text-[10px] font-black uppercase tracking-widest bg-cyan-900/20 text-cyan-400 border-2 border-cyan-500/20 hover:bg-cyan-500 hover:text-black transition-all disabled:opacity-20 rounded-sm active:scale-95"
              >
                LIBERAR_GLOBAL
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-10 py-4 relative z-10 custom-scrollbar bg-black/20">
              {grantLoading ? (
                <div className="p-16 text-center">
                  <span className="material-symbols-outlined text-2xl text-cyan-900 animate-spin block mb-4">sync</span>
                  <p className="font-black text-[10px] text-zinc-700 tracking-[0.4em]">PROCESSANDO...</p>
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="p-16 text-center text-zinc-800 font-black text-[10px] uppercase tracking-[0.4em]">
                  SEM_AGENTES_LOCALIZADOS
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {filteredPlayers.map(u => {
                    const isGranted = grantedUids.has(u.uid);
                    return (
                      <button
                        key={u.uid}
                        onClick={() => toggleGrant(u.uid)}
                        className={`w-full text-left p-4 transition-all flex items-center gap-4 rounded-xl border-2 group ${
                          isGranted ? 'bg-cyan-500/5 border-cyan-500/30' : 'bg-transparent border-transparent hover:bg-white/5'
                        }`}
                      >
                        <div className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 transition-all rounded-sm ${
                          isGranted ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'border-zinc-800'
                        }`}>
                          {isGranted && <span className="material-symbols-outlined text-white text-[14px] font-black">check</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-black text-xs uppercase truncate transition-colors ${isGranted ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                            {u.displayName || u.username || 'AGENT_NULL'}
                          </p>
                          <p className="text-[9px] font-mono text-zinc-700 font-bold truncate tracking-widest">{u.email}</p>
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 border transition-all ${
                          isGranted
                            ? 'border-cyan-500/40 text-cyan-500 bg-cyan-500/5 shadow-inner'
                            : 'border-zinc-900 text-zinc-800'
                        }`}>
                          {isGranted ? 'SINC_OK' : 'OFFLINE'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-10 py-8 border-t-4 border-[#1a1a1a] flex justify-end relative z-10 bg-black/40">
              <button
                onClick={() => { setShowGrantModal(null); setGrantedUids(new Set()); }}
                className="bg-[#333] hover:bg-[#444] text-white px-12 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm active:scale-95"
              >
                CONCLUIR_SINC
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/98 backdrop-blur-2xl cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full mx-6 flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="bg-black border-4 border-[#1a1a1a] p-4 rounded-xl shadow-2xl relative">
               <img src={previewImage.imageUrl} alt={previewImage.title} className="max-w-full max-h-[70vh] object-contain grayscale-0 transition-all" />
               <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 border border-white/10 rounded-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs text-cyan-500">{getCategoryInfo(previewImage.category).icon}</span>
                  <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">{getCategoryInfo(previewImage.category).label}</span>
               </div>
            </div>
            <div className="mt-8 text-center max-w-2xl">
              <div className="flex items-center justify-center gap-3 mb-2">
                 <div className="h-px w-8 bg-zinc-800" />
                 <span className="text-[10px] font-black text-cyan-500/50 uppercase tracking-[0.3em]">Nível_de_Criptografia_{previewImage.level || 1}</span>
                 <div className="h-px w-8 bg-zinc-800" />
              </div>
              <h4 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">{previewImage.title}</h4>
              {previewImage.description && (
                <p className="text-sm text-zinc-500 font-bold uppercase tracking-wide leading-relaxed">{previewImage.description}</p>
              )}
            </div>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 w-12 h-12 bg-black/60 border-2 border-white/5 flex items-center justify-center hover:bg-white hover:text-black transition-all rounded-full group shadow-2xl"
            >
              <span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform">close</span>
            </button>
          </div>
        </div>
      )}

      {editModalImage && (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="px-10 pt-10 pb-6 border-b-4 border-[#1a1a1a] relative z-10 bg-black/40">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-emerald-400 text-2xl">edit</span>
                <h3 className="font-black text-xl text-white uppercase tracking-widest">Ajustar_Propriedades</h3>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-8 relative z-10 custom-scrollbar">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nova_Classificação</label>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEditCategory(cat.id)}
                      className={`py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border-2 rounded-sm ${
                        editCategory === cat.id
                          ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                          : 'text-zinc-700 border-[#1a1a1a] bg-black/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nível_de_Acesso</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEditLevel(lvl)}
                      className={`flex-1 py-3 text-[9px] font-black uppercase transition-all flex items-center justify-center border-2 rounded-sm ${
                        editLevel === lvl
                          ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                          : 'text-zinc-700 border-[#1a1a1a] bg-black/40'
                      }`}
                    >
                      {lvl === 1 ? 'RESTRITO' : lvl === 2 ? 'CONFIDENCIAL' : lvl === 3 ? 'SIGILOSO' : 'TOP SECRET'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Título_do_Registro</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold text-white px-5 py-4 focus:border-emerald-500/40 outline-none rounded-sm uppercase tracking-widest"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Descrição_do_Arquivo</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold text-white px-5 py-4 focus:border-emerald-500/40 outline-none rounded-sm resize-none tracking-wide"
                  />
                </div>
              </div>
            </div>

            <div className="px-10 py-8 border-t-4 border-[#1a1a1a] flex justify-end gap-6 relative z-10 bg-black/40">
              <button
                onClick={() => setEditModalImage(null)}
                className="px-8 py-3 text-[10px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
              >
                CANCELAR
              </button>
              <button
                onClick={saveEdit}
                disabled={!editTitle.trim() || editSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                {editSaving ? 'GRAVANDO...' : 'SALVAR_METADADOS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
