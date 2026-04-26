import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { Menu, Loader2 } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { Campaign } from '../data/campaigns';
import { campaignService } from '../services/CampaignService';

// Modular Components
import { Screw, Barcode, AnalogLogo } from './campaign/Common';
import { CassetteCard } from './campaign/CassetteCard';
import { SecurityMenu } from './campaign/SecurityMenu';
import { MetadataOverlay } from './campaign/MetadataOverlay';
import { TapeProgress } from './campaign/TapeProgress';

interface CampaignSelectionProps {
  onSelect: (campaign: Campaign) => void;
  onLogout?: () => void;
}

export default function CampaignSelection({ onSelect, onLogout }: CampaignSelectionProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      const scaleW = window.innerWidth / 460;
      const scaleH = window.innerHeight / 850;
      setScale(Math.min(scaleW, scaleH, 1));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return campaignService.subscribeToActiveCampaigns((list) => {
      setCampaigns(list);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading || campaigns.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setCurrentIndex(Number(entry.target.getAttribute('data-index')));
        }
      });
    }, { root: scrollRef.current, threshold: 0.6 });
    cardsRef.current.forEach((card) => { if (card) observer.observe(card); });
    return () => observer.disconnect();
  }, [loading, campaigns]);

  const scrollTo = useCallback((index: number) => {
    if (index < 0 || index >= campaigns.length) return;
    cardsRef.current[index]?.scrollIntoView({
      behavior: 'smooth', block: 'nearest', inline: 'center'
    });
  }, [campaigns.length]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => scrollTo(currentIndex + 1),
    onSwipedRight: () => scrollTo(currentIndex - 1),
    preventScrollOnSwipe: true, trackMouse: true
  });

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center font-mono p-8 text-center bg-cardboard">
        <Loader2 className="w-12 h-12 text-analog-orange animate-spin mb-4" />
        <span className="text-ink font-black tracking-widest animate-pulse uppercase">Sincronizando...</span>
      </div>
    );
  }

  return (
    <div 
      style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
      className="bg-cardboard w-[460px] h-[850px] rounded-[20px] shadow-[0_35px_100px_rgba(0,0,0,0.9)] border-2 border-cardboard-dark relative flex flex-col mx-auto overflow-hidden text-ink font-chakra shrink-0"
    >
      
      {/* Elemento de profundidade superior (Edge) */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-white/30 z-10 hidden sm:block pointer-events-none" />

      {/* Header com Identidade Industrial */}
      <header className="flex justify-between items-center h-20 sm:h-24 px-6 relative z-40 border-b-2 border-cardboard-dark/30 bg-cardboard/20">
        <button 
          onClick={() => setShowMenu(true)}
          className="p-3 hover:bg-black/5 active:bg-black/10 rounded-2xl transition-all text-ink group"
        >
          <Menu size={32} className="group-hover:scale-110 transition-transform" />
        </button>
        <AnalogLogo />
        <div className="text-right hidden sm:block">
           <div className="text-[10px] font-mono font-bold opacity-30 leading-none">TERMINAL_093</div>
        </div>
      </header>

      {/* Info Bar */}
      <div className="px-8 py-5 flex justify-between items-center relative z-10 bg-cardboard/10">
        <div className="font-oswald text-2xl tracking-widest uppercase text-ink">
          Campanhas_Ativas
        </div>
        <Barcode onClick={() => setShowMetadata(true)} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col overflow-hidden shadow-[inset_0px_20px_40px_-20px_rgba(0,0,0,0.4)]">
        
        {/* Cassette List Container com Swipe */}
        <div 
          {...swipeHandlers}
          ref={scrollRef}
          className="flex-1 flex flex-row overflow-x-auto items-center gap-10 px-8 w-full snap-x snap-mandatory overflow-y-hidden campaign-no-scrollbar py-6"
        >
          <div className="min-w-[40px] shrink-0 sm:min-w-[60px]" />
          
          {campaigns.map((campaign, idx) => (
            <div key={campaign.id} data-index={idx} ref={el => cardsRef.current[idx] = el} className="snap-center shrink-0">
              <CassetteCard campaign={campaign} onSelect={onSelect} isActive={idx === currentIndex} index={idx} />
            </div>
          ))}

          <div className="min-w-[40px] shrink-0 sm:min-w-[60px]" />
        </div>

        {/* Tape Progress (Centralizado na área de fitas) */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
          <TapeProgress total={campaigns.length} current={currentIndex} />
        </div>

      </main>

      {/* Footer Industrial */}
      <footer className="p-5 flex justify-between items-center bg-cardboard/30 border-t-2 border-cardboard-dark/40 relative z-40">
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-[0.2em] uppercase opacity-60">
          <div className="w-2.5 h-2.5 bg-analog-green rounded-full animate-pulse shadow-[0_0_8px_#378b44]" />
          SINAL_ESTÁVEL
        </div>
        <div className="font-mono text-[9px] font-bold opacity-30">PORT_RM_84</div>
      </footer>

      {/* Sobreposição total do Menu */}
      <AnimatePresence>
        {showMenu && (
          <SecurityMenu 
            onClose={() => setShowMenu(false)}
            onLogout={() => { setShowMenu(false); onLogout?.(); }}
            onShowMetadata={() => { setShowMenu(false); setShowMetadata(true); }}
          />
        )}

        {showMetadata && (
          <MetadataOverlay onClose={() => setShowMetadata(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
