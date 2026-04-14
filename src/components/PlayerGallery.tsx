import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Search, User, Package } from 'lucide-react';
import type { GalleryImage, GalleryCategory } from '../store/firestore';
interface PlayerGalleryProps {
  images: GalleryImage[];
}
const TABS: { id: GalleryCategory; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'locais', label: 'Locais', Icon: MapPin },
  { id: 'pistas', label: 'Pistas', Icon: Search },
  { id: 'pessoas', label: 'Pessoas', Icon: User },
  { id: 'itens', label: 'Itens', Icon: Package },
];
export default function PlayerGallery({ images }: PlayerGalleryProps) {
  const [activeTab, setActiveTab] = useState<GalleryCategory>('locais');
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const filtered = images.filter(img => img.category === activeTab);
  const getCounts = (cat: GalleryCategory) => images.filter(i => i.category === cat).length;
  if (images.length === 0) {
    return (
      <div className="border border-dashed border-[#333] rounded-lg p-5 text-center">
        <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-2">
          <MapPin size={20} className="text-cyan-500/60" />
        </div>
        <p className="text-gray-500 text-xs uppercase tracking-widest mb-0.5">Galeria vazia</p>
        <p className="text-gray-700 text-[10px]">Novas imagens aparecerão aqui quando forem liberadas.</p>
      </div>
    );
  }
  return (
    <>
      {}
      <div className="flex gap-1 mb-3 bg-[#1a1a1a] border border-[#333] rounded-lg p-1">
        {TABS.map(tab => {
          const count = getCounts(tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[9px] uppercase tracking-wider font-bold transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-600 hover:text-gray-400 border border-transparent'
              }`}
            >
              <tab.Icon size={10} />
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`text-[8px] px-1 py-0 rounded-full ${
                  isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-[#333] text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {filtered.length === 0 ? (
            <div className="border border-dashed border-[#333] rounded-lg p-6 text-center">
              <p className="text-gray-600 text-[10px] uppercase tracking-widest">
                Nenhuma imagem nesta categoria
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((img, idx) => (
                <motion.div
                  key={img.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  onClick={() => setSelectedImage(img)}
                  className="relative rounded-lg overflow-hidden border border-[#333] bg-[#1a1a1a] cursor-pointer group active:scale-95 transition-transform"
                >
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={img.imageUrl}
                      alt={img.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-linear-to-t from-black/90 to-transparent">
                    <p className="text-[10px] font-bold text-white truncate leading-tight">{img.title}</p>
                    {img.description && (
                      <p className="text-[8px] text-gray-400 truncate mt-0.5">{img.description}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 bg-black/95 flex flex-col items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.title}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
              />
              <div className="mt-3 px-1">
                <p className="text-white font-bold text-sm">{selectedImage.title}</p>
                {selectedImage.description && (
                  <p className="text-gray-400 text-xs mt-1 leading-relaxed">{selectedImage.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  {(() => {
                    const tab = TABS.find(t => t.id === selectedImage.category);
                    if (!tab) return null;
                    return (
                      <>
                        <tab.Icon size={10} className="text-cyan-500" />
                        <span className="text-[9px] text-cyan-500/70 uppercase tracking-widest">{tab.label}</span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 border border-[#444] flex items-center justify-center hover:bg-[#333] transition-colors"
              >
                <X size={14} className="text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
