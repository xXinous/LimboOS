import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { campaigns, Campaign } from '../data/campaigns';
import { Play, ChevronLeft, ChevronRight, Zap, Target, MapPin } from 'lucide-react';

interface CampaignSelectionProps {
  onSelect: (campaign: Campaign) => void;
}

const Screw = ({ className }: { className?: string }) => (
  <div className={`absolute w-3 h-3 rounded-full bg-[#1a1a1a] border border-[#3a3a3a] flex items-center justify-center ${className}`}>
    <div className="w-1.5 h-0.5 bg-[#3a3a3a] rotate-45"></div>
  </div>
);

export default function CampaignSelection({ onSelect }: CampaignSelectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);

  const currentCampaign = campaigns[currentIndex];
  const isLocked = currentCampaign.status === 'Bloqueada';

  const nextCampaign = () => {
    setCurrentIndex((prev) => (prev + 1) % campaigns.length);
    setIsConfirming(false);
  };

  const prevCampaign = () => {
    setCurrentIndex((prev) => (prev - 1 + campaigns.length) % campaigns.length);
    setIsConfirming(false);
  };

  return (
    <div className="relative w-full max-w-[360px] bg-surface-container-high rounded-[40px] shadow-2xl border-4 border-[#1a1a1a] flex flex-col p-4 overflow-hidden font-mono select-none">
      {/* Detalhes de Hardware */}
      <Screw className="top-4 left-4" />
      <Screw className="top-4 right-4 -rotate-90" />
      <Screw className="bottom-4 left-4 -rotate-90" />
      <Screw className="bottom-4 right-4" />

      {/* Header Branding */}
      <div className="flex justify-between items-center mb-4 px-2 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#ea580c] rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-black italic text-xl">W.</span>
          </div>
          <div>
            <h1 className="text-[#ea580c] text-xs font-black tracking-widest uppercase leading-none">Walkman</h1>
            <span className="text-gray-500 text-[8px] font-bold uppercase tracking-tighter">Instance Selector</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black text-gray-400 bg-black/30 px-2 py-1 rounded-full border border-white/5">RM-2099</span>
        </div>
      </div>

      {/* Visor de Cassete (Onde a campanha aparece) */}
      <div className="w-full h-[180px] bg-[#111] rounded-2xl border-4 border-[#1a1a1a] shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] relative overflow-hidden group mb-6">
        <div className="absolute inset-0 bg-linear-to-tr from-white/10 via-transparent to-white/5 pointer-events-none z-20" />
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCampaign.id}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="w-full h-full p-3"
          >
            {/* Rótulo da Fita */}
            <div className="w-full h-full bg-[#f4f1ea] rounded-md relative flex flex-col p-3 border-t-10 border-[#ea580c]">
              <div className="flex justify-between items-start text-[8px] font-bold text-gray-500 mb-1">
                <span className="uppercase tracking-widest">Type II / High-Bias</span>
                <span className="text-[#ea580c] font-black">60 MIN</span>
              </div>

              <div className="flex-1 flex flex-col justify-center items-center text-center px-2">
                <h2 className="text-sm font-black uppercase tracking-tight text-gray-800 leading-tight mb-1">
                  {currentCampaign.name}
                </h2>
                <div className="w-16 h-0.5 bg-gray-300 mb-1" />
                <span className="text-[9px] font-bold text-gray-600 truncate uppercase">
                  {currentCampaign.location}
                </span>
              </div>

              <div className="flex justify-between items-end">
                <div className="flex gap-1">
                  <div className="w-4 h-4 bg-gray-200 rounded-full border-2 border-gray-300 shadow-inner" />
                  <div className="w-4 h-4 bg-gray-200 rounded-full border-2 border-gray-300 shadow-inner" />
                </div>
                <span className="text-[8px] font-black text-gray-400 italic">SERIES 1.0</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {isLocked && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-red-600 text-white font-black px-4 py-2 rotate-[-5deg] shadow-2xl border-2 border-white text-lg uppercase">
              LOCKED
            </div>
          </div>
        )}
      </div>

      {/* Campaign Details - Estilo LCD */}
      <div className="flex-1 bg-[#1a1a1a] rounded-2xl border-2 border-[#333] p-4 flex flex-col gap-3 mb-6 relative">
        <div className="flex items-center gap-2 text-[10px] font-bold text-[#ea580c]">
          <Zap size={12} />
          <span className="uppercase tracking-widest opacity-80">Campaign Profile</span>
        </div>
        
        <p className="text-[10px] text-gray-400 leading-relaxed italic">
          {currentCampaign.description}
        </p>

        <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-[#333]">
          <div className="flex items-center gap-2">
            <Target size={10} className="text-gray-500" />
            <span className={`text-[9px] font-black ${
              currentCampaign.difficulty === 'Pesadelo' ? 'text-red-500' : 'text-gray-300'
            }`}>
              {currentCampaign.difficulty.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={10} className="text-gray-500" />
            <span className="text-[9px] font-black text-gray-300 uppercase">
              {currentCampaign.year}
            </span>
          </div>
        </div>
      </div>

      {/* Controles Estilo Aparelho */}
      <div className="flex justify-between items-center gap-4 px-2 pb-2">
        <div className="flex gap-2">
          <button 
            onClick={prevCampaign}
            className="w-10 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center active:bg-[#444] active:shadow-inner transition-all group"
          >
            <ChevronLeft size={20} className="text-[#ea580c] group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={nextCampaign}
            className="w-10 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center active:bg-[#444] active:shadow-inner transition-all group"
          >
            <ChevronRight size={20} className="text-[#ea580c] group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <button
          disabled={isLocked}
          onClick={() => setIsConfirming(true)}
          className={`flex-1 h-12 rounded-xl border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center gap-2 transition-all active:translate-y-1 active:shadow-none uppercase font-black italic tracking-tighter ${
            isLocked 
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
              : 'bg-[#ea580c] text-white hover:bg-[#f97316] shadow-[0_4px_0_#9a3412]'
          }`}
        >
          <Play size={18} className="fill-white" />
          Connect
        </button>
      </div>

      {/* Modal de Confirmação Retrô */}
      <AnimatePresence>
        {isConfirming && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#111]/95 flex items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface-container-high p-6 rounded-[32px] border-4 border-[#ea580c] shadow-2xl flex flex-col gap-4 max-w-[280px]"
            >
              <div className="w-12 h-12 bg-[#ea580c] rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                <Play size={24} className="text-white fill-white ml-1" />
              </div>
              <div className="text-white font-black text-2xl italic tracking-tighter uppercase leading-none">Initializing...</div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Linking profile to instance:<br/>
                <span className="text-[#ea580c] mt-2 block text-sm">{currentCampaign.name}</span>
              </p>
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => setIsConfirming(false)}
                  className="flex-1 bg-[#333] text-gray-400 py-3 rounded-xl border-2 border-[#1a1a1a] font-bold uppercase text-[10px]"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => onSelect(currentCampaign)}
                  className="flex-1 bg-[#ea580c] text-white py-3 rounded-xl border-2 border-[#1a1a1a] font-black uppercase text-[10px] shadow-[0_3px_0_#9a3412]"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
