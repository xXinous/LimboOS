import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, animate } from 'motion/react';
import { Menu, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Campaign } from '../data/campaigns';
import { campaignService } from '../services/CampaignService';
import type { PlayerData } from '../types/player';

import { Barcode, AnalogLogo } from './campaign/Common';
import { CassetteCard } from './campaign/CassetteCard';
import { SecurityMenu } from './campaign/SecurityMenu';
import { MetadataOverlay } from './campaign/MetadataOverlay';
import { TapeProgress } from './campaign/TapeProgress';
import { getMetrics, SNAP_SPRING } from './campaign/constants';

interface CampaignSelectionProps {
  onSelect: (campaign: Campaign) => void;
  onLogout?: () => void;
  onShowProfile?: () => void;
  onChangeCharacter?: () => void;
  playerData?: PlayerData | null;
}

export default function CampaignSelection({ 
  onSelect, 
  onLogout, 
  onShowProfile, 
  onChangeCharacter,
  playerData 
}: CampaignSelectionProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [overlays, setOverlays] = useState({ menu: false, metadata: false });
  const [containerWidth, setContainerWidth] = useState(460);
  const containerRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => getMetrics(containerWidth), [containerWidth]);
  const x = useMotionValue(0);
  const springX = useSpring(x, SNAP_SPRING);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => el.clientWidth > 0 && setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return campaignService.subscribeToActiveCampaigns(list => {
      setCampaigns(list);
      setLoading(false);
    });
  }, []);

  const snapTo = useCallback((index: number) => {
    if (!campaigns.length) return;
    const clamped = Math.max(0, Math.min(campaigns.length - 1, index));
    animate(x, -clamped * metrics.step, SNAP_SPRING);
    setCurrentIndex(clamped);
  }, [x, campaigns.length, metrics.step]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (overlays.menu || overlays.metadata) return;
      if (e.key === 'ArrowLeft') snapTo(currentIndex - 1);
      else if (e.key === 'ArrowRight') snapTo(currentIndex + 1);
      else if ((e.key === 'Enter' || e.key === ' ') && campaigns[currentIndex]?.status !== 'Bloqueada') onSelect(campaigns[currentIndex]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, campaigns, overlays, snapTo, onSelect]);

  if (loading) return (
    <div className="w-full h-full flex flex-col items-center justify-center font-mono p-8 text-center bg-cardboard text-ink">
      <Loader2 className="w-12 h-12 text-analog-orange animate-spin mb-4" />
      <span className="font-black tracking-widest animate-pulse uppercase">Sincronizando...</span>
    </div>
  );

  return (
    <motion.div ref={containerRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-cardboard w-full h-full max-w-[520px] rounded-none sm:rounded-[20px] shadow-[0_35px_100px_rgba(0,0,0,0.9)] border-0 sm:border-2 sm:border-cardboard-dark relative flex flex-col mx-auto overflow-hidden text-ink font-chakra shrink-0">
      <header className="flex justify-between items-center h-14 sm:h-16 px-5 relative z-30 border-b border-cardboard-dark/30 bg-cardboard/20">
        <button onClick={() => setOverlays(v => ({ ...v, menu: true }))} className="p-2 hover:bg-black/5 rounded-xl group transition-all"><Menu size={26} className="group-hover:scale-110" /></button>
        <AnalogLogo />
        <div className="text-[10px] font-mono font-bold opacity-30 hidden sm:block">TERMINAL_093</div>
      </header>

      <div className="px-6 py-2 flex justify-between items-center relative z-10 bg-cardboard/10">
        <div className="font-oswald text-xl tracking-widest uppercase">Campanhas_Ativas</div>
        <Barcode onClick={() => setOverlays(v => ({ ...v, metadata: true }))} />
      </div>

      <main className="flex-1 relative flex flex-col overflow-hidden shadow-[inset_0px_20px_40px_-20px_rgba(0,0,0,0.4)]">
        <div className="flex-1 relative cursor-grab active:cursor-grabbing select-none touch-none overflow-hidden">
          <motion.div 
            drag="x" 
            dragConstraints={{ left: -(campaigns.length - 1) * metrics.step, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              const projectedX = x.get() + info.velocity.x * 0.2;
              snapTo(Math.round(-projectedX / metrics.step));
            }}
            style={{ x, paddingLeft: metrics.centerOffset, gap: metrics.gap }} 
            className="flex flex-row items-center h-full w-fit will-change-transform"
          >
            {campaigns.map((c, i) => (
              <CassetteCard key={c.id} campaign={c} onSelect={onSelect} index={i} dragX={x} cardWidth={metrics.cardWidth} cardHeight={metrics.cardHeight} step={metrics.step} />
            ))}
          </motion.div>
        </div>

        {currentIndex > 0 && <button onClick={() => snapTo(currentIndex - 1)} className="absolute left-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-cardboard-dark/20 text-ink/50 hover:text-ink/80"><ChevronLeft size={20} /></button>}
        {currentIndex < campaigns.length - 1 && <button onClick={() => snapTo(currentIndex + 1)} className="absolute right-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-cardboard-dark/20 text-ink/50 hover:text-ink/80"><ChevronRight size={20} /></button>}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center z-20"><TapeProgress total={campaigns.length} current={currentIndex} onChange={snapTo} /></div>
      </main>

      <footer className="px-5 py-3 flex justify-between items-center bg-cardboard/30 border-t border-cardboard-dark/40 relative z-30">
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest uppercase opacity-60"><div className="w-2 h-2 bg-analog-green rounded-full animate-pulse shadow-[0_0_8px_#378b44]" /> SINAL_ESTÁVEL</div>
        <div className="font-mono text-[9px] opacity-30">PORT_RM_84</div>
      </footer>

      <AnimatePresence>
        {overlays.menu && (
          <SecurityMenu 
            onClose={() => setOverlays(v => ({ ...v, menu: false }))} 
            onLogout={() => { setOverlays(v => ({ ...v, menu: false })); onLogout?.(); }} 
            onShowProfile={() => { setOverlays(v => ({ ...v, menu: false })); onShowProfile?.(); }}
            onChangeCharacter={() => { setOverlays(v => ({ ...v, menu: false })); onChangeCharacter?.(); }}
          />
        )}
        {overlays.metadata && <MetadataOverlay onClose={() => setOverlays(v => ({ ...v, metadata: false }))} agent={playerData ? { uid: playerData.uid, characterId: playerData.activeCharacterId, username: playerData.character.codinome, agentId: playerData.character.agentId, agentStatus: playerData.character.agentStatus, dangerLevel: playerData.character.dangerLevel, lastCampaignName: campaigns.find(c => c.id === playerData.character.campaignId)?.name || playerData.character.campaignId } : null} />}
      </AnimatePresence>
    </motion.div>
  );
}
