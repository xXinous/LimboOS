import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '../../lib/firebase';
import { collection, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp, query, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { User } from 'firebase/auth';
import { parseBlob } from 'music-metadata';
import { useModal } from './ConfirmModal';
import QRCode from 'react-qr-code';

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

  // Edit Metadata state
  const [editAudio, setEditAudio] = useState<AudioData | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editNpc, setEditNpc] = useState('');
  const [editChapter, setEditChapter] = useState('');
  const [editDescription, setEditDescription] = useState('');
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

  // Load play counts for audios
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

  // ── Edit Metadata ──────────────────────────────────────────────────────────
  const openEditMetadata = async (audio: AudioData) => {
    // Fetch fresh data from Firestore to get the metadata fields
    const snap = await getDoc(doc(db, 'audios', audio.id));
    const data = snap.exists() ? snap.data() : {};
    setEditTitle(data.title ?? '');
    setEditArtist(data.artist ?? '');
    setEditNpc(data.npc ?? '');
    setEditChapter(data.chapter ?? '');
    setEditDescription(data.description ?? '');
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

    // Parse ID3 metadata in browser
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
    setConfirmDeleteAudio(audio);
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
    a.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSize = audios.reduce((acc, a) => acc + a.size, 0);

  return (
    <section className="space-y-4">
      {modal}
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="w-2 h-6 bg-zinc-400"></div>
          <h2 className="font-headline font-bold uppercase tracking-widest text-lg">Audio_Stream_Buffer</h2>
          <span className="text-[10px] font-label text-zinc-500 tracking-wider">{audios.length} FILES • {formatSize(totalSize)}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="SEARCH_AUDIO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface-container-lowest border-zinc-800 text-[10px] font-label uppercase tracking-widest focus:ring-1 focus:ring-orange-500 focus:border-orange-500 w-48 placeholder:text-zinc-700 text-zinc-300 px-3 py-2"
          />
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="audio/*" 
            multiple
            className="hidden" 
          />
          <button 
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2 rounded-sm font-label text-[10px] font-bold tracking-widest hover:bg-zinc-700 transition-all machined-edge group disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xs group-hover:rotate-90 transition-transform">
              {isUploading ? 'sync' : 'add'}
            </span>
            {isUploading ? 'UPLOADING...' : 'UPLOAD'}
          </button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-sm p-6 text-center transition-all ${
          isDragOver 
            ? 'border-orange-500 bg-orange-500/10' 
            : 'border-zinc-800 hover:border-zinc-700'
        }`}
      >
        <span className="material-symbols-outlined text-2xl text-zinc-600 mb-2 block">
          {isDragOver ? 'downloading' : 'cloud_upload'}
        </span>
        <p className="text-zinc-500 text-[10px] font-label uppercase tracking-widest">
          {isDragOver ? 'DROP_FILES_HERE' : 'DRAG_&_DROP_AUDIO_FILES_HERE'}
        </p>
        <p className="text-zinc-700 text-[8px] font-label mt-1">MAX 50MB PER FILE</p>
      </div>

      {/* Audio List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredAudios.map((audio, index) => (
          <div key={audio.id} className={`bg-surface-container-low p-4 flex items-center justify-between border-l-2 machined-edge ${index % 2 === 0 ? 'border-orange-500' : 'border-zinc-700'}`}>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  const a = new Audio(audio.url);
                  a.play();
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center border hover:scale-105 active:scale-90 transition-all ${
                  index % 2 === 0 
                    ? 'bg-primary-container/20 text-orange-500 border-orange-500/20' 
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}
              >
                <span className="material-symbols-outlined fill" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
              <div>
                <h4 className="font-headline font-bold text-sm tracking-tight">{audio.originalName}</h4>
                <p className="text-[10px] font-label uppercase text-zinc-500 tracking-tighter">
                  Owner: <span className="text-zinc-300">{audio.ownerName}</span> • {formatSize(audio.size)}
                  {playCountMap[audio.id] !== undefined && (
                    <> • <span className="text-tertiary">{playCountMap[audio.id]} plays</span></>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:block">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-1 h-3 ${index % 2 === 0 && i <= 3 ? 'bg-orange-500' : 'bg-zinc-700'}`}></div>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => openEditMetadata(audio)}
                  className="material-symbols-outlined text-zinc-500 hover:text-emerald-400 transition-colors"
                  title="Editar Metadados"
                >
                  edit
                </button>
              )}
              <button 
                onClick={() => setQrCodeModal(audio)}
                className="material-symbols-outlined text-zinc-500 hover:text-orange-500 transition-colors"
                title="Mostrar QR Code"
              >
                qr_code_2
              </button>
              {(isAdmin || audio.ownerUid === user?.uid) && (
                <button 
                  onClick={() => handleDelete(audio)}
                  className="material-symbols-outlined text-zinc-500 hover:text-error transition-colors" 
                  title="Delete Audio"
                >
                  delete
                </button>
              )}
            </div>
          </div>
        ))}
        
        {filteredAudios.length === 0 && (
          <div className="bg-surface-container-low p-8 text-center border-l-2 border-zinc-800 machined-edge">
            <p className="text-zinc-500 font-label text-xs tracking-widest">
              {searchQuery ? 'NO_MATCHING_AUDIO_FILES' : 'NO_AUDIO_FILES_FOUND'}
            </p>
          </div>
        )}
      </div>

      {/* Confirm Delete Audio Modal */}
      {confirmDeleteAudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-error/40 p-6 w-full max-w-sm machined-edge">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-error text-xl">warning</span>
              <h3 className="font-headline text-lg text-error">DELETE_AUDIO_FILE</h3>
            </div>
            <p className="font-body text-sm text-zinc-300 mb-6">
              Remover permanentemente o arquivo de áudio{" "}
              <span className="text-orange-400 font-bold">{confirmDeleteAudio.originalName}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteAudio(null)}
                className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={() => executeDelete(confirmDeleteAudio)}
                className="px-4 py-2 text-xs font-label bg-error text-white font-bold tracking-wider hover:brightness-110 transition-all"
              >
                CONFIRMAR_DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-zinc-700 p-6 w-full max-w-sm machined-edge flex flex-col items-center">
            <h3 className="font-headline font-bold text-lg mb-4 text-orange-500 tracking-wider">
              CÓDIGO DA FITA
            </h3>
            <div id="qr-code-container" className="bg-white p-4 rounded mb-4">
              <QRCode value={qrCodeModal.id} size={200} />
            </div>
            <p className="font-label text-xs text-zinc-400 mb-6 text-center tracking-widest break-all">
              ID: {qrCodeModal.id}
            </p>
            <div className="flex gap-3 mb-6 w-full justify-center">
              <button
                onClick={handleCopyQrCode}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-label border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors machined-edge"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                COPIAR
              </button>
              <button
                onClick={handleDownloadQrCode}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-label border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors machined-edge"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                SALVAR
              </button>
            </div>
            <button
              onClick={() => setQrCodeModal(null)}
              className="px-6 py-2 text-xs font-label bg-zinc-800 text-white hover:bg-zinc-700 transition-colors machined-edge w-full"
            >
              FECHAR
            </button>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editAudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-emerald-500/30 p-6 w-full max-w-md machined-edge flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-emerald-400 text-xl">edit_note</span>
              <h3 className="font-headline text-lg text-zinc-200">EDITAR_METADADOS</h3>
            </div>
            <p className="font-body text-xs text-zinc-500 mb-5 truncate">
              Áudio: <span className="text-orange-400 font-bold">{editAudio.originalName}</span>
            </p>

            <div className="space-y-3 mb-6">
              {[
                { label: 'TITLE', value: editTitle, set: setEditTitle, placeholder: 'Nome da fita' },
                { label: 'ARTIST', value: editArtist, set: setEditArtist, placeholder: 'Artista / Autor' },
                { label: 'NPC', value: editNpc, set: setEditNpc, placeholder: 'NPC associado' },
                { label: 'CHAPTER', value: editChapter, set: setEditChapter, placeholder: 'Capítulo / Álbum' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-[9px] font-label uppercase tracking-widest text-zinc-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-surface-container-lowest border border-zinc-800 text-sm font-body text-zinc-200 px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-zinc-700"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[9px] font-label uppercase tracking-widest text-zinc-500 mb-1">DESCRIPTION</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descrição da fita"
                  rows={3}
                  className="w-full bg-surface-container-lowest border border-zinc-800 text-sm font-body text-zinc-200 px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-zinc-700 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditAudio(null)}
                disabled={editSaving}
                className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={saveEditMetadata}
                disabled={editSaving}
                className="px-5 py-2 text-xs font-label bg-emerald-900/60 text-emerald-300 font-bold tracking-wider hover:bg-emerald-800/60 transition-all disabled:opacity-50 border border-emerald-700/30"
              >
                {editSaving ? 'SALVANDO...' : 'SALVAR'}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
