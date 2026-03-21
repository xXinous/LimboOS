import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp, query, orderBy, where, getDocs } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface AudioData {
  id: string;
  ownerUid: string;
  ownerName: string;
  filename: string;
  originalName: string;
  size: number;
  url: string;
  createdAt: any;
}

export default function AudioBuffer({ user, isAdmin }: { user: User | null, isAdmin: boolean }) {
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playCountMap, setPlayCountMap] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUploadClick = () => {
    if (!user) {
      alert("Please login to upload audio.");
      return;
    }
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    if (file.size > 50 * 1024 * 1024) {
      alert(`File "${file.name}" too large. Max 50MB.`);
      return;
    }

    const formData = new FormData();
    formData.append('audio', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload failed');
    const data = await response.json();

    await addDoc(collection(db, 'audios'), {
      ownerUid: user.uid,
      ownerName: user.displayName || 'Admin',
      filename: data.filename,
      originalName: data.originalName,
      size: data.size,
      url: data.url,
      createdAt: serverTimestamp(),
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload audio.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!user) return;

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    if (files.length === 0) {
      alert("Please drop audio files only.");
      return;
    }

    setIsUploading(true);
    try {
      for (const file of files) {
        await uploadFile(file);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload audio.");
    } finally {
      setIsUploading(false);
    }
  }, [user]);

  const handleDelete = async (audio: AudioData) => {
    if (!isAdmin && audio.ownerUid !== user?.uid) {
      return alert("Unauthorized to delete this file.");
    }
    
    if (confirm(`Delete ${audio.originalName}?`)) {
      try {
        await fetch(`/api/upload/${audio.filename}`, { method: 'DELETE' });
        await deleteDoc(doc(db, 'audios', audio.id));
      } catch (error) {
        console.error("Delete error:", error);
        alert("Failed to delete audio.");
      }
    }
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
    </section>
  );
}
