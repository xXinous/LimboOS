import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Campaign } from '../data/campaigns';
import { campaignService } from '../services/CampaignService';
import { Play, ChevronLeft, ChevronRight, Zap, MapPin, Loader2 } from 'lucide-react';

// --- Sub-componentes Memorizados para Performance ---

const Screw = memo(({ className }: { className?: string }) => (
  <div className={`absolute w-4 h-4 rounded-full bg-[#1a1a1a] border border-[#3a3a3a] flex items-center justify-center ${className}`}>
    <div className="w-2 h-0.5 bg-[#3a3a3a] rotate-45" />
  </div>
));

const CassetteWheel = memo(() => (
  <motion.div 
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
    className="w-10 h-10 rounded-full bg-[#d4d4d4] flex items-center justify-center relative shadow-md"
  >
    <div className="absolute inset-0 rounded-full border-8 border-[#111] opacity-90" />
    <div className="w-4 h-4 rounded-full bg-[#222] flex items-center justify-center z-10">
      <div className="w-full h-0.5 bg-[#d4d4d4] absolute" />
      <div className="w-0.5 h-full bg-[#d4d4d4] absolute" />
    </div>
  </motion.div>
));

const StatusIndicator = memo(({ active }: { active: boolean }) => (
  <div className={`w-2 h-2 rounded-full shadow-[0_0_4px_rgba(239,68,68,0.8)] ${active ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'}`} />
));

// --- Componente Principal ---

interface CampaignSelectionProps {
  onSelect: (campaign: Campaign) => void;
}

export default function CampaignSelection({ onSelect }: CampaignSelectionProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [loading, setLoading] = useState(true);

  // Inscrição nos dados
  useEffect(() => {
    return campaignService.subscribeToActiveCampaigns((list) => {
      setCampaigns(list);
      setLoading(false);
    });
  }, []);

  // Helpers de navegação estáveis
  const navigate = useCallback((direction: number) => {
    if (campaigns.length === 0) return;
    setCurrentIndex(prev => (prev + direction + campaigns.length) % campaigns.length);
    setIsConfirming(false);
  }, [campaigns.length]);

  const currentCampaign = useMemo(() => campaigns[currentIndex], [campaigns, currentIndex]);
  const isLocked = currentCampaign?.status === 'Bloqueada';

  // --- Renderização de Estados de Carregamento/Vazio ---

  if (loading) {
    return (
      <div className="w-full max-w-[360px] h-[580px] bg-surface-container-high rounded-[40px] border-4 border-[#1a1a1a] flex flex-col items-center justify-center font-mono p-8 text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <span className="text-orange-500 font-black tracking-widest animate-pulse">INITIALIZING_INSTANCES...</span>
      </div>
    );
  }

  if (!currentCampaign) {
    return (
      <div className="w-full max-w-[360px] h-[580px] bg-surface-container-high rounded-[40px] border-4 border-[#1a1a1a] flex flex-col items-center justify-center font-mono p-8 text-center">
        <div className="bg-red-900/20 p-6 rounded-3xl border border-red-500/30">
          <Zap className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-zinc-400 font-bold uppercase text-xs">No active instances found in this sector.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[360px] bg-surface-container-high rounded-[40px] shadow-2xl border-4 border-[#1a1a1a] flex flex-col p-4 overflow-hidden font-mono select-none">
      <Screw className="top-4 left-4" />
      <Screw className="top-4 right-4 -rotate-90" />
      <Screw className="bottom-4 left-4 -rotate-90" />
      <Screw className="bottom-4 right-4" />

      {/* Header Branding */}
      <header className="flex justify-between items-center mb-4 px-2 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#ea580c] rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-black italic text-xl">W.</span>
          </div>
          <div>
            <h1 className="text-[#ea580c] text-xs font-black tracking-widest uppercase leading-none">Walkman</h1>
            <span className="text-gray-500 text-[8px] font-bold uppercase tracking-tighter">Instance Selector</span>
          </div>
        </div>
        <span className="text-[10px] font-black text-gray-400 bg-black/30 px-2 py-1 rounded-full border border-white/5">RM-2099</span>
      </header>

      {/* Visor de Cassete */}
      <section className="w-full h-[190px] bg-[#222] rounded-xl border-4 border-[#1a1a1a] shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] flex flex-col items-center relative overflow-hidden mb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCampaign.id}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex flex-col items-center"
          >
            {/* Label da Fita */}
            <div className="mt-4 w-[90%] max-w-[280px] h-[130px] bg-[#f4f1ea] rounded-md shadow-sm relative flex flex-col p-3 border-t-12 border-orange-600">
              <div className="flex justify-between items-start text-[9px] font-bold text-gray-500 mb-1">
                <div className="flex items-center gap-1">
                  <StatusIndicator active={!isLocked} />
                  <span className="uppercase tracking-tighter">REC</span>
                </div>
                <div className="tracking-widest text-orange-600/80 font-black">TYPE II</div>
                <span>60 MIN</span>
              </div>

              <div className="flex-1 flex flex-col text-center px-2 justify-center pb-4">
                <h2 className="text-[14px] font-black uppercase tracking-tight text-gray-800 leading-tight line-clamp-2">
                  {currentCampaign.name}
                </h2>
                <div className="text-[10px] font-bold text-gray-600 truncate mt-1 uppercase">
                  {currentCampaign.location}
                </div>
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[180px] h-[50px] bg-[#222] rounded-t-lg border-t-2 border-[#111]" />
            </div>

            {/* Janela de Movimento */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[170px] h-[46px] bg-black/40 rounded-md shadow-inner flex items-center justify-between px-4 overflow-hidden backdrop-blur-sm border border-white/5">
              <CassetteWheel />
              <div className="absolute bottom-1 left-8 right-8 h-[3px] bg-[#111] shadow-sm" />
              <CassetteWheel />
            </div>
          </motion.div>
        </AnimatePresence>

        {isLocked && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-red-600 text-white font-black px-4 py-2 rotate-[-5deg] shadow-2xl border-2 border-white text-lg uppercase tracking-tighter">
              LOCKED
            </div>
          </div>
        )}
      </section>

      {/* Campaign Details (LCD) */}
      <section className="flex-1 bg-[#1a1a1a] rounded-2xl border-2 border-[#333] p-4 flex flex-col gap-3 mb-6 relative">
        <div className="flex items-center gap-2 text-[10px] font-bold text-[#ea580c]">
          <Zap size={12} />
          <span className="uppercase tracking-widest opacity-80">Campaign Profile</span>
        </div>
        
        <p className="text-[10px] text-gray-400 leading-relaxed italic line-clamp-3">
          {currentCampaign.description}
        </p>

        <footer className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-[#333]">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-tighter">System:</span>
            <span className="text-[9px] font-black text-gray-300 uppercase truncate">
              {currentCampaign.rpgSystem}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={10} className="text-gray-500" />
            <span className="text-[9px] font-black text-gray-300 uppercase">
              {currentCampaign.year}
            </span>
          </div>
        </footer>
      </section>

      {/* Controles de Hardware */}
      <footer className="flex justify-between items-center gap-4 px-2 pb-2">
        <nav className="flex gap-2">
          <NavButton onClick={() => navigate(-1)} icon={<ChevronLeft size={20} />} />
          <NavButton onClick={() => navigate(1)} icon={<ChevronRight size={20} />} />
        </nav>

        <button
          disabled={isLocked}
          onClick={() => setIsConfirming(true)}
          className={`flex-1 h-12 rounded-xl border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center gap-2 transition-all active:translate-y-1 active:shadow-none uppercase font-black italic tracking-tighter ${
            isLocked 
              ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border-zinc-900' 
              : 'bg-[#ea580c] text-white hover:bg-[#f97316] shadow-[0_4px_0_#9a3412]'
          }`}
        >
          <Play size={18} className="fill-white" />
          Connect
        </button>
      </footer>

      {/* Modal de Confirmação */}
      <AnimatePresence>
        {isConfirming && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#111]/95 flex items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface-container-high p-6 rounded-[32px] border-4 border-[#ea580c] shadow-2xl flex flex-col gap-4 max-w-[280px]"
            >
              <div className="w-12 h-12 bg-[#ea580c] rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                <Play size={24} className="text-white fill-white ml-1" />
              </div>
              <h3 className="text-white font-black text-2xl italic tracking-tighter uppercase leading-none">Initializing...</h3>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Linking profile to instance:<br/>
                <span className="text-[#ea580c] mt-2 block text-sm">{currentCampaign.name}</span>
              </p>
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => setIsConfirming(false)}
                  className="flex-1 bg-[#333] text-zinc-400 py-3 rounded-xl border-2 border-[#1a1a1a] font-bold uppercase text-[10px] hover:bg-[#444]"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => onSelect(currentCampaign)}
                  className="flex-1 bg-[#ea580c] text-white py-3 rounded-xl border-2 border-[#1a1a1a] font-black uppercase text-[10px] shadow-[0_3px_0_#9a3412] hover:brightness-110"
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

// --- Sub-componente de Botão de Navegação ---

const NavButton = memo(({ onClick, icon }: { onClick: () => void, icon: React.ReactNode }) => (
  <button 
    onClick={onClick}
    className="w-10 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center active:bg-[#444] active:shadow-inner transition-all group"
  >
    <div className="text-[#ea580c] group-hover:scale-110 transition-transform">
      {icon}
    </div>
  </button>
));
