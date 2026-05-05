import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '../../lib/firebase';
import { collection, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp, query, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { User } from 'firebase/auth';
import { parseBlob } from 'music-metadata';
import { useModal } from './ConfirmModal';
import QRCode from 'react-qr-code';
import Screw from '../../components/player/Screw';

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
    <section className="space-y-6 font-chakra">
      {modal}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
          <h2 className="font-black uppercase tracking-widest text-lg text-white">Buffer_de_Stream_de_Áudio</h2>
          <span className="text-[10px] font-bold text-zinc-600 tracking-[0.2em] uppercase">{audios.length} ARQUIVOS SINC // {formatSize(totalSize)}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-600 text-xs">search</span>
            <input
              type="text"
              placeholder="BUSCAR_ÁUDIO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/40 border border-[#1a1a1a] text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-primary w-56 placeholder:text-zinc-800 text-white px-10 py-2.5 outline-none rounded-sm"
            />
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" multiple className="hidden" />
          <button 
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center gap-2 bg-primary/10 text-primary px-6 py-2.5 rounded-sm font-black text-[10px] tracking-widest hover:bg-primary/20 transition-all border border-primary/20 uppercase group active:scale-95 glow-orange"
          >
            <span className="material-symbols-outlined text-xs group-hover:rotate-90 transition-transform">
              {isUploading ? 'sync' : 'add'}
            </span>
            {isUploading ? 'ENVIANDO...' : 'NOVO_ÁUDIO'}
          </button>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-4 border-dashed rounded-xl p-10 text-center transition-all group ${
          isDragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-[#1a1a1a] bg-black/20 hover:border-primary/20 hover:bg-black/40'
        }`}
      >
        <span className="material-symbols-outlined text-5xl text-zinc-800 mb-4 block group-hover:text-primary/40 transition-colors">
          {isDragOver ? 'downloading' : 'album'}
        </span>
        <p className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.4em] group-hover:text-zinc-400">
          {isDragOver ? 'SOLTAR_ARQUIVOS_AGORA' : 'ARRASTAR_E_SOLTAR_ÁUDIO_AQUI'}
        </p>
        <p className="text-zinc-800 text-[9px] font-bold mt-2 tracking-widest">LIMITE_MÁX: 50MB POR UNIDADE</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredAudios.map((audio, index) => (
          <div key={audio.id} className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-5 flex items-center justify-between rounded-xl shadow-lg group hover:border-primary/20 transition-all active:scale-[0.995]">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => {
                  const a = new Audio(audio.url);
                  a.play();
                }}
                className={`w-12 h-12 rounded-sm flex items-center justify-center border-2 transition-all active:scale-90 ${
                  index % 2 === 0 
                    ? 'bg-primary text-black border-primary' 
                    : 'bg-black text-primary border-white/5 group-hover:border-primary/40'
                }`}
              >
                <span className="material-symbols-outlined text-2xl fill" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
              <div>
                <h4 className="font-black text-sm text-white uppercase tracking-wider group-hover:text-primary transition-colors">{audio.originalName}</h4>
                <div className="flex items-center gap-3 mt-1">
                   <p className="text-[10px] font-bold uppercase text-zinc-600 tracking-widest">
                     Proprietário: <span className="text-zinc-400">{audio.ownerName}</span> // {formatSize(audio.size)}
                   </p>
                   {playCountMap[audio.id] !== undefined && (
                     <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-sm border border-white/5">
                        <div className="w-1 h-1 bg-tertiary rounded-full animate-pulse" />
                        <span className="text-[9px] font-black text-tertiary uppercase">{playCountMap[audio.id]} REPRODUÇÕES</span>
                     </div>
                   )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="hidden md:flex gap-1">
                {[1,2,3,4,5,6,7,8].map(i => (
                  <div key={i} className={`w-1 h-4 rounded-full ${index % 2 === 0 && i <= 5 ? 'bg-primary shadow-[0_0_5px_rgba(255,140,0,0.5)]' : 'bg-black'}`}></div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <button onClick={() => openEditMetadata(audio)} className="p-2 text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-sm transition-all material-symbols-outlined text-xl">edit</button>
                )}
                <button onClick={() => setQrCodeModal(audio)} className="p-2 text-zinc-600 hover:text-primary hover:bg-primary/10 rounded-sm transition-all material-symbols-outlined text-xl">qr_code_2</button>
                {(isAdmin || audio.ownerUid === user?.uid) && (
                  <button onClick={() => handleDelete(audio)} className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all material-symbols-outlined text-xl">delete</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredAudios.length === 0 && (
          <div className="bg-black/20 p-24 text-center border-4 border-dashed border-[#1a1a1a] rounded-2xl opacity-20">
            <p className="text-zinc-500 font-black text-[12px] uppercase tracking-[0.4em]">
              {searchQuery ? 'Sem_Correspondência_de_Sinal' : 'Buffer_de_Áudio_Vazio'}
            </p>
          </div>
        )}
      </div>

      {qrCodeModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] p-10 w-full max-w-sm rounded-[32px] shadow-2xl flex flex-col items-center relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <h3 className="font-black text-xl mb-8 text-primary uppercase tracking-[0.3em] border-b-4 border-[#1a1a1a] w-full text-center pb-6 relative z-10">
              Assinatura_Digital
            </h3>
            <div id="qr-code-container" className="bg-white p-6 rounded-lg mb-8 shadow-2xl relative z-10">
              <QRCode value={qrCodeModal.id} size={200} />
            </div>
            <p className="font-mono text-[10px] text-zinc-600 mb-10 text-center tracking-widest break-all font-bold px-4 relative z-10 bg-black/40 py-2 rounded border border-white/5">
              ID: {qrCodeModal.id}
            </p>
            <div className="flex gap-4 mb-8 w-full justify-center relative z-10">
              <button
                onClick={handleCopyQrCode}
                className="flex-1 flex items-center justify-center gap-3 px-4 py-3 text-[10px] font-black border-2 border-white/5 text-zinc-400 hover:text-white hover:border-primary/40 hover:bg-primary/5 transition-all rounded-sm"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                COPIAR
              </button>
              <button
                onClick={handleDownloadQrCode}
                className="flex-1 flex items-center justify-center gap-3 px-4 py-3 text-[10px] font-black border-2 border-white/5 text-zinc-400 hover:text-white hover:border-primary/40 hover:bg-primary/5 transition-all rounded-sm"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                SALVAR
              </button>
            </div>
            <button
              onClick={() => setQrCodeModal(null)}
              className="px-10 py-4 text-[10px] font-black bg-[#333] hover:bg-[#444] text-white transition-all rounded-sm w-full relative z-10"
            >
              ENCERRAR_MODAL
            </button>
          </div>
        </div>
      )}

      {editAudio && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <div className="bg-[#222] border-8 border-[#1a1a1a] p-10 w-full max-w-xl rounded-[32px] shadow-2xl flex flex-col relative overflow-hidden">
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="flex items-center gap-4 mb-8 border-b-4 border-[#1a1a1a] pb-6 relative z-10">
              <div className="p-3 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-sm">
                <span className="material-symbols-outlined text-emerald-400 text-2xl">edit_note</span>
              </div>
              <div>
                <h3 className="font-black text-xl text-white uppercase tracking-widest">Ajustar_Metadados</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1 truncate max-w-xs">Arquivo: <span className="text-emerald-400">{editAudio.originalName}</span></p>
              </div>
            </div>

            <div className="space-y-5 mb-10 relative z-10">
              <div className="grid grid-cols-2 gap-5">
                {[
                  { label: 'TÍTULO_DA_FITA', value: editTitle, set: setEditTitle, placeholder: 'Identificador do Arquivo' },
                  { label: 'ARTISTA_/_AUTOR', value: editArtist, set: setEditArtist, placeholder: 'Origem do Áudio' },
                  { label: 'NPC_RELACIONADO', value: editNpc, set: setEditNpc, placeholder: 'Assinatura Biológica' },
                  { label: 'CAPÍTULO_/_NÓ', value: editChapter, set: setEditChapter, placeholder: 'Setor de Armazenamento' },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label}>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2">{label}</label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      placeholder={placeholder}
                      className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold text-white px-4 py-3 focus:border-emerald-500/40 outline-none placeholder:text-zinc-800 rounded-sm transition-all"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2">DESCRIÇÃO_E_DADOS_ADICIONAIS</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Informações classificadas..."
                  rows={3}
                  className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold text-white px-4 py-3 focus:border-emerald-500/40 outline-none placeholder:text-zinc-800 rounded-sm transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2">NÍVEL_DE_CRIPTOGRAFIA</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setEditLevel(lvl)}
                      className={`flex-1 py-3 text-[9px] font-black uppercase border-2 transition-all rounded-sm ${editLevel === lvl ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-[#1a1a1a] bg-black/40 text-zinc-700 hover:text-zinc-500 hover:border-white/5'}`}
                    >
                      {lvl === 1 ? 'RESTRITO' : lvl === 2 ? 'CONFIDENCIAL' : lvl === 3 ? 'SIGILOSO' : 'TOP SECRET'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-5 relative z-10 pt-6 border-t-4 border-[#1a1a1a]">
              <button
                onClick={() => setEditAudio(null)}
                disabled={editSaving}
                className="px-8 py-3 text-[10px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
              >
                ABORTAR
              </button>
              <button
                onClick={saveEditMetadata}
                disabled={editSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                {editSaving ? 'GRAVANDO...' : 'SALVAR_ALTERAÇÕES'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
