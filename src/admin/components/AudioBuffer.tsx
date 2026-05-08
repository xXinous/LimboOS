import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '../../lib/firebase';
import { collection, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp, query, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { User } from 'firebase/auth';
import { parseBlob } from 'music-metadata';
import { useModal } from './ConfirmModal';
import QRCode from 'react-qr-code';
import Screw from '../../components/player/Screw';
import RetroSpinner from '../../components/player/RetroSpinner';

interface AudioData {
  id: string;
  ownerUid: string;
  ownerName: string;
  filename: string;
  originalName: string;
  size: number;
  url: string;
  storagePath?: string;
  createdAt: any;
  level?: number;
}

export default function AudioBuffer({ user, isAdmin }: { user: User | null, isAdmin: boolean }) {
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playCountMap, setPlayCountMap] = useState<Record<string, number>>({});
  const [confirmDeleteAudio, setConfirmDeleteAudio] = useState<AudioData | null>(null);
  const [qrCodeModal, setQrCodeModal] = useState<AudioData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showAlert, modal } = useModal();
  const [editAudio, setEditAudio] = useState<AudioData | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editNpc, setEditNpc] = useState('');
  const [editChapter, setEditChapter] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLevel, setEditLevel] = useState<number>(1);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'audios'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const audioData: AudioData[] = [];
      snapshot.forEach((doc) => {
        audioData.push({ id: doc.id, ...doc.data() } as AudioData);
      });
      setAudios(audioData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'playEvents'), (snap) => {
      const counts: Record<string, number> = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.tapeId) {
          counts[data.tapeId] = (counts[data.tapeId] || 0) + 1;
        }
      });
      setPlayCountMap(counts);
    });
    return () => unsubscribe();
  }, []);

  const openEditMetadata = async (audio: AudioData) => {
    const snap = await getDoc(doc(db, 'audios', audio.id));
    const data = snap.exists() ? snap.data() : {};
    setEditTitle(data.title ?? '');
    setEditArtist(data.artist ?? '');
    setEditNpc(data.npc ?? '');
    setEditChapter(data.chapter ?? '');
    setEditDescription(data.description ?? '');
    setEditLevel(data.level ?? (data.isSecret ? 3 : 1));
    setEditAudio(audio);
  };

  const saveEditMetadata = async () => {
    if (!editAudio) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, 'audios', editAudio.id), {
        title: editTitle,
        artist: editArtist,
        npc: editNpc,
        chapter: editChapter,
        description: editDescription,
        level: editLevel,
      });
      setEditAudio(null);
    } catch (err) {
      console.error('Error updating metadata:', err);
      showAlert('Erro', 'Falha ao salvar metadados.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleUploadClick = () => {
    if (!user) {
      showAlert('Login Necessário', 'Você precisa estar logado para fazer upload.');
      return;
    }
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    if (file.size > 50 * 1024 * 1024) {
      showAlert('Arquivo muito grande', `O arquivo "${file.name}" excede o limite de 50MB.`);
      return;
    }
    let parsedTitle = file.name.replace(/\.[^/.]+$/, "");
    let parsedArtist = '';
    let parsedChapter = '';
    let parsedDescription = '';
    let parsedIsSecret = false;
    let parsedDuration = 0;
    try {
      const meta = await parseBlob(file);
      const common = meta.common;
      const format = meta.format;
      if (common.title) parsedTitle = common.title;
      if (common.artist) parsedArtist = common.artist;
      if (common.album) parsedChapter = common.album;
      const rawComment = common.comment;
      if (Array.isArray(rawComment)) {
        for (const c of rawComment) {
          const text = typeof c === 'string' ? c : ((c as any).text ?? '');
          if (text && !/^\s*([0-9A-Fa-f]{8}\s*){2,}/.test(text)) {
            parsedDescription = text.trim();
            break;
          }
        }
      } else if (typeof rawComment === 'string' && !/^\s*([0-9A-Fa-f]{8}\s*){2,}/.test(rawComment as string)) {
        parsedDescription = (rawComment as string).trim();
      }
      if (format.duration) parsedDuration = Math.round(format.duration);
      parsedIsSecret = (common.genre?.[0] ?? '').trim().toLowerCase() === 'secret';
    } catch (err) {
      console.warn('ID3 parse in browser failed:', err);
    }
    const storageRef = ref(storage, `audios/${Date.now()}_${file.name}`);
    await uploadBytesResumable(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    await addDoc(collection(db, 'audios'), {
      ownerUid: user.uid,
      ownerName: user.displayName || 'Admin',
      filename: storageRef.name,
      originalName: file.name,
      size: file.size,
      url: downloadURL,
      storagePath: storageRef.fullPath,
      createdAt: serverTimestamp(),
      title: parsedTitle,
      artist: parsedArtist,
      chapter: parsedChapter,
      description: parsedDescription,
      duration: parsedDuration,
      isSecret: parsedIsSecret,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files) as File[]) {
        await uploadFile(file);
      }
    } catch (error) {
      console.error("Upload error:", error);
      showAlert('Erro de Upload', 'Falha ao fazer upload do arquivo de áudio.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!user) return;
    const files = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('audio/'));
    if (files.length === 0) {
      showAlert('Formato inválido', 'Apenas arquivos de áudio são aceitos.');
      return;
    }
    setIsUploading(true);
    try {
      for (const file of files) {
        await uploadFile(file);
      }
    } catch (error) {
      console.error("Upload error:", error);
      showAlert('Erro de Upload', 'Falha ao fazer upload do áudio.');
    } finally {
      setIsUploading(false);
    }
  }, [user]);

  const handleDelete = (audio: AudioData) => {
    if (!isAdmin && audio.ownerUid !== user?.uid) {
      showAlert('Não Autorizado', 'Você não tem permissão para deletar este arquivo.');
      return;
    }
    executeDelete(audio);
  };

  const executeDelete = async (audio: AudioData) => {
    setConfirmDeleteAudio(null);
    try {
      if (audio.storagePath || audio.filename) {
        const fileRef = ref(storage, audio.storagePath || `audios/${audio.filename}`);
        await deleteObject(fileRef).catch(e => {
          console.error("Storage delete error (might not exist):", e);
        });
      }
      await deleteDoc(doc(db, 'audios', audio.id));
    } catch (error) {
      console.error("Delete error:", error);
      showAlert('Erro ao Deletar', 'Falha ao deletar o arquivo de áudio.');
    }
  };

  const getQrCodeSvgDataUri = () => {
    const container = document.getElementById("qr-code-container");
    if (!container) return null;
    const svgElement = container.querySelector("svg");
    if (!svgElement) return null;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDownloadQrCode = () => {
    const dataUri = getQrCodeSvgDataUri();
    if (!dataUri) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const padding = 20;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `qrcode_${qrCodeModal?.originalName || 'audio'}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = dataUri;
  };

  const handleCopyQrCode = () => {
    const dataUri = getQrCodeSvgDataUri();
    if (!dataUri) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const padding = 20;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding);
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              showAlert('Sucesso', 'QR Code copiado para a área de transferência!');
            } catch (err) {
              console.error('Failed to copy', err);
              showAlert('Erro', 'Falha ao copiar QR Code. Verifique as permissões.');
            }
          }
        }, 'image/png');
      }
    };
    img.src = dataUri;
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? mb.toFixed(1) + ' MB' : (bytes / 1024).toFixed(0) + ' KB';
  };

  const filteredAudios = audios.filter((a) =>
    (a.originalName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalSize = audios.reduce((acc, a) => acc + a.size, 0);

  return (
    <section className="space-y-6 font-sans">
      {modal}
      
      {isUploading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4">
          <RetroSpinner />
          <div className="text-primary font-display font-bold uppercase tracking-[0.3em] animate-pulse">Sincronizando_Buffers...</div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-lg text-white">Buffer de Áudio</h2>
            <p className="text-[10px] font-display font-bold text-industrial-silver/40 tracking-[0.2em] uppercase">
              {audios.length} Arquivos // {formatSize(totalSize)} Total
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/30 text-base group-focus-within:text-primary transition-colors">search</span>
            <input
              type="text"
              placeholder="BUSCAR_ÁUDIO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-container-lowest border border-primary/10 text-[11px] font-display font-bold uppercase tracking-[0.2em] focus:border-primary/50 w-full sm:w-64 placeholder:text-industrial-silver/20 text-white pl-10 pr-4 py-3 outline-none rounded-sm transition-all"
            />
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" multiple className="hidden" />
          <button 
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center gap-3 bg-primary hover:bg-primary-container text-black px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest transition-all group active:scale-95 glow-orange shadow-lg"
          >
            <span className="material-symbols-outlined text-base group-hover:rotate-90 transition-transform">
              {isUploading ? 'sync' : 'upload_file'}
            </span>
            {isUploading ? 'ENVIANDO...' : 'UPLOAD ÁUDIO'}
          </button>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-sm p-12 text-center transition-all group ${
          isDragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-primary/10 bg-black/20 hover:border-primary/30 hover:bg-black/40'
        }`}
      >
        <div className="relative inline-block mb-4">
          <span className={`material-symbols-outlined text-5xl transition-all duration-300 ${isDragOver ? 'text-primary scale-110' : 'text-industrial-silver/20 group-hover:text-primary/40'}`}>
            {isDragOver ? 'downloading' : 'cloud_upload'}
          </span>
          {isDragOver && <div className="absolute -inset-2 border border-primary/30 rounded-full animate-ping" />}
        </div>
        <p className="text-industrial-silver/60 text-[12px] font-display font-bold uppercase tracking-[0.3em] group-hover:text-industrial-silver/80">
          {isDragOver ? 'SOLTAR ARQUIVOS AGORA' : 'ARRASTAR E SOLTAR ÁUDIO PARA UPLOAD'}
        </p>
        <p className="text-industrial-silver/20 text-[9px] font-display font-bold mt-2 tracking-[0.2em] uppercase">LIMITE MÁXIMO: 50MB POR UNIDADE</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredAudios.map((audio, index) => (
          <div key={audio.id} className="bg-surface-container-low border border-primary/10 p-4 sm:p-5 flex items-center justify-between group hover:border-primary/30 transition-all">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => {
                  const a = new Audio(audio.url);
                  a.play();
                }}
                className="w-12 h-12 rounded-sm flex items-center justify-center bg-surface-container-high border border-primary/20 text-primary group-hover:bg-primary group-hover:text-black transition-all active:scale-90"
              >
                <span className="material-symbols-outlined text-2xl fill" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
              <div>
                <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider group-hover:text-primary transition-colors">{audio.originalName}</h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                   <p className="text-[10px] font-display font-bold uppercase text-industrial-silver/40 tracking-widest">
                     Operador: <span className="text-industrial-silver/60">{audio.ownerName}</span> // {formatSize(audio.size)}
                   </p>
                   {playCountMap[audio.id] !== undefined && (
                     <div className="flex items-center gap-1.5 bg-primary/5 px-2 py-0.5 border border-primary/10 rounded-sm">
                        <div className="w-1 h-1 bg-primary rounded-full animate-pulse glow-orange" />
                        <span className="text-[9px] font-display font-bold text-primary/70 uppercase tracking-widest">{playCountMap[audio.id]} REPRODUÇÕES</span>
                     </div>
                   )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-8">
              <div className="hidden lg:flex gap-1.5">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className={`w-1 h-4 rounded-full ${i <= 3 ? 'bg-primary/20' : 'bg-white/5'}`}></div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button onClick={() => openEditMetadata(audio)} className="p-2.5 text-industrial-silver/30 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-sm transition-all material-symbols-outlined text-xl" title="Editar Metadados">edit_note</button>
                )}
                <button onClick={() => setQrCodeModal(audio)} className="p-2.5 text-industrial-silver/30 hover:text-primary hover:bg-primary/10 rounded-sm transition-all material-symbols-outlined text-xl" title="Gerar QR Code">qr_code_2</button>
                {(isAdmin || audio.ownerUid === user?.uid) && (
                  <button onClick={() => handleDelete(audio)} className="p-2.5 text-industrial-silver/30 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all material-symbols-outlined text-xl" title="Deletar Arquivo">delete</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredAudios.length === 0 && (
          <div className="py-24 text-center border border-dashed border-primary/10 rounded-sm opacity-30">
            <span className="material-symbols-outlined text-4xl mb-2 text-industrial-silver/20">search_off</span>
            <p className="text-industrial-silver/50 font-display font-bold text-[12px] uppercase tracking-[0.4em]">
              {searchQuery ? 'Sem Correspondência de Sinal' : 'Buffer de Áudio Vazio'}
            </p>
          </div>
        )}
      </div>

      {qrCodeModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/30 p-8 w-full max-w-sm rounded-sm shadow-2xl flex flex-col items-center relative">
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              ASSINATURA-DIGITAL
            </div>
            
            <h3 className="font-display font-bold text-xl mb-8 text-white uppercase tracking-widest text-center mt-2">
              Gerador de <span className="text-primary">QR Code</span>
            </h3>
            
            <div id="qr-code-container" className="bg-white p-6 rounded-sm mb-8 shadow-inner ring-4 ring-primary/20">
              <QRCode value={qrCodeModal.id} size={200} />
            </div>
            
            <div className="w-full bg-black/40 p-3 rounded-sm border border-primary/10 mb-8">
              <p className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-1">Identificador Único</p>
              <p className="font-mono text-[10px] text-primary tracking-widest break-all font-bold">
                {qrCodeModal.id}
              </p>
            </div>

            <div className="flex gap-3 mb-6 w-full">
              <button
                onClick={handleCopyQrCode}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-display font-bold border border-primary/20 text-industrial-silver/60 hover:text-primary hover:bg-primary/5 transition-all rounded-sm uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                Copiar
              </button>
              <button
                onClick={handleDownloadQrCode}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-display font-bold border border-primary/20 text-industrial-silver/60 hover:text-primary hover:bg-primary/5 transition-all rounded-sm uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Salvar
              </button>
            </div>
            
            <button
              onClick={() => setQrCodeModal(null)}
              className="px-10 py-4 text-[11px] font-display font-bold text-industrial-silver/40 hover:text-white transition-all w-full border-t border-primary/5 uppercase tracking-[0.3em]"
            >
              Fechar Terminal
            </button>
          </div>
        </div>
      )}

      {editAudio && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/30 p-8 w-full max-w-xl rounded-sm shadow-2xl flex flex-col relative">
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              MODIFICAÇÃO-DE-SINAL
            </div>
            
            <div className="flex items-center gap-5 mb-10 mt-2">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-sm">
                <span className="material-symbols-outlined text-emerald-400 text-2xl">edit_note</span>
              </div>
              <div>
                <h3 className="font-display font-bold text-2xl text-white uppercase tracking-tighter">Ajustar <span className="text-emerald-400">Metadados</span></h3>
                <p className="text-[10px] text-industrial-silver/40 font-display font-bold uppercase tracking-widest mt-1">Origem: {editAudio.originalName}</p>
              </div>
            </div>

            <div className="space-y-6 mb-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'TÍTULO DA FITA', value: editTitle, set: setEditTitle, placeholder: 'Identificador do Arquivo' },
                  { label: 'ARTISTA / AUTOR', value: editArtist, set: setEditArtist, placeholder: 'Origem do Áudio' },
                  { label: 'NPC RELACIONADO', value: editNpc, set: setEditNpc, placeholder: 'Assinatura Biológica' },
                  { label: 'CAPÍTULO / NÓ', value: editChapter, set: setEditChapter, placeholder: 'Setor de Armazenamento' },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label} className="group">
                    <label className="block text-[9px] font-display font-bold uppercase tracking-[0.2em] text-industrial-silver/40 mb-2 group-focus-within:text-emerald-400 transition-colors">{label}</label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      placeholder={placeholder}
                      className="w-full bg-surface-container-lowest border-none py-4 px-4 text-white font-sans text-sm tracking-wide focus:ring-0 placeholder:text-industrial-silver/10 outline-none transition-all"
                    />
                    <div className="h-0.5 w-0 bg-emerald-500 transition-all duration-300 group-focus-within:w-full" />
                  </div>
                ))}
              </div>
              <div className="group">
                <label className="block text-[9px] font-display font-bold uppercase tracking-[0.2em] text-industrial-silver/40 mb-2 group-focus-within:text-emerald-400 transition-colors">DESCRIÇÃO E DADOS ADICIONAIS</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Informações classificadas..."
                  rows={3}
                  className="w-full bg-surface-container-lowest border-none py-4 px-4 text-white font-sans text-sm tracking-wide focus:ring-0 placeholder:text-industrial-silver/10 outline-none transition-all resize-none"
                />
                <div className="h-0.5 w-0 bg-emerald-500 transition-all duration-300 group-focus-within:w-full" />
              </div>
              <div>
                <label className="block text-[9px] font-display font-bold uppercase tracking-[0.2em] text-industrial-silver/40 mb-3">NÍVEL DE CRIPTOGRAFIA</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setEditLevel(lvl)}
                      className={`flex-1 py-3 text-[9px] font-display font-bold uppercase tracking-widest border transition-all rounded-sm ${editLevel === lvl ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-white/5 bg-black/20 text-industrial-silver/30 hover:text-industrial-silver/60 hover:border-white/10'}`}
                    >
                      {lvl === 1 ? 'RESTRITO' : lvl === 2 ? 'CONFIDENCIAL' : lvl === 3 ? 'SIGILOSO' : 'TOP SECRET'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-primary/5">
              <button
                onClick={() => setEditAudio(null)}
                disabled={editSaving}
                className="px-8 py-4 text-[10px] font-display font-bold text-industrial-silver/30 hover:text-white transition-colors uppercase tracking-[0.3em]"
              >
                Abortar Missão
              </button>
              <button
                onClick={saveEditMetadata}
                disabled={editSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-black px-12 py-4 rounded-sm font-display font-bold text-[11px] tracking-widest uppercase transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
              >
                {editSaving ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Gravando...</> : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
