import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion, useMotionValue, animate } from 'motion/react';
import { Menu, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Campaign } from '../data/campaigns';
import { campaignService } from '../services/CampaignService';

import { Barcode, AnalogLogo } from './campaign/Common';
import { CassetteCard } from './campaign/CassetteCard';
import { SecurityMenu } from './campaign/SecurityMenu';
import { MetadataOverlay } from './campaign/MetadataOverlay';
import { TapeProgress } from './campaign/TapeProgress';
import { getMetrics, SNAP_SPRING, DRAG_THRESHOLD } from './campaign/constants';

interface CampaignSelectionProps {
  onSelect: (campaign: Campaign) => void;
  onLogout?: () => void;
  onShowProfile?: () => void;
}

export default function CampaignSelection({ onSelect, onLogout, onShowProfile }: CampaignSelectionProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [overlays, setOverlays] = useState({ menu: false, metadata: false });

  // Dynamic container measurement
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(460);

  const metrics = useMemo(() => getMetrics(containerWidth), [containerWidth]);

  const x = useMotionValue(0);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);
  const wasDragging = useRef(false);

  // Observe the actual container width and re-derive metrics on resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return campaignService.subscribeToActiveCampaigns((list) => {
      setCampaigns(list);
      setLoading(false);
    });
  }, []);

  const snapTo = useCallback((index: number, velocity = 0) => {
    if (campaigns.length === 0) return;
    const clamped = Math.max(0, Math.min(campaigns.length - 1, index));
    animRef.current?.stop();
    animRef.current = animate(x, -clamped * metrics.step, { ...SNAP_SPRING, velocity });
    setCurrentIndex(clamped);
  }, [x, campaigns.length, metrics.step]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    animRef.current?.stop();
    wasDragging.current = false;

    const startX = e.clientX;
    const startMotionX = x.get();
    let prevX = e.clientX;
    let prevTime = performance.now();
    let velocity = 0;

    const onMove = (ev: PointerEvent) => {
      const now = performance.now();
      const dt = now - prevTime;
      if (dt > 0 && dt < 200) {
        const instantVel = ((ev.clientX - prevX) / dt) * 1000;
        velocity = velocity * 0.65 + instantVel * 0.35;
      }
      
      const delta = ev.clientX - startX;
      if (Math.abs(delta) > DRAG_THRESHOLD) wasDragging.current = true;
      
      let newX = startMotionX + delta;
      const minX = -(campaigns.length - 1) * metrics.step;
      if (newX > 0) newX *= 0.18;
      else if (newX < minX) newX = minX + (newX - minX) * 0.18;
      
      x.set(newX);
      prevX = ev.clientX;
      prevTime = now;
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (wasDragging.current) {
        const projectedX = x.get() + velocity * 0.35;
        snapTo(Math.round(-projectedX / metrics.step), velocity);
      } else {
        snapTo(currentIndex);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [x, campaigns.length, currentIndex, snapTo, metrics.step]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (overlays.menu || overlays.metadata) return;
      if (e.key === 'ArrowLeft') snapTo(currentIndex - 1);
      else if (e.key === 'ArrowRight') snapTo(currentIndex + 1);
      else if (e.key === 'Enter' || e.key === ' ') {
        const c = campaigns[currentIndex];
        if (c && c.status !== 'Bloqueada') onSelect(c);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, campaigns, overlays, snapTo, onSelect]);

  const toggleOverlay = (key: keyof typeof overlays, val: boolean) => () => setOverlays(prev => ({ ...prev, [key]: val }));

  if (loading) return (
    <div className="w-full h-full flex flex-col items-center justify-center font-mono p-8 text-center bg-cardboard text-ink">
      <Loader2 className="w-12 h-12 text-analog-orange animate-spin mb-4" />
      <span className="font-black tracking-widest animate-pulse uppercase">Sincronizando...</span>
    </div>
  );

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-cardboard w-full h-full max-w-[520px] rounded-none sm:rounded-[20px] shadow-[0_35px_100px_rgba(0,0,0,0.9)] border-0 sm:border-2 sm:border-cardboard-dark relative flex flex-col mx-auto overflow-hidden text-ink font-chakra shrink-0 backface-hidden"
    >
      <header className="flex justify-between items-center h-14 sm:h-16 px-5 relative z-40 border-b border-cardboard-dark/30 bg-cardboard/20">
        <button onClick={toggleOverlay('menu', true)} className="p-2 hover:bg-black/5 rounded-xl transition-all group">
          <Menu size={26} className="group-hover:scale-110 transition-transform" />
        </button>
        <AnalogLogo />
        <div className="text-[10px] font-mono font-bold opacity-30 hidden sm:block">TERMINAL_093</div>
      </header>

      <div className="px-6 py-2 flex justify-between items-center relative z-10 bg-cardboard/10">
        <div className="font-oswald text-xl tracking-widest uppercase">Campanhas_Ativas</div>
        <Barcode onClick={toggleOverlay('metadata', true)} />
      </div>

      <main className="flex-1 relative flex flex-col overflow-hidden shadow-[inset_0px_20px_40px_-20px_rgba(0,0,0,0.4)]">
        <div className="flex-1 relative cursor-grab active:cursor-grabbing select-none touch-none" onPointerDown={handlePointerDown} onClickCapture={e => { if (wasDragging.current) { e.stopPropagation(); e.preventDefault(); } }}>
          <motion.div style={{ x, paddingLeft: metrics.centerOffset, gap: metrics.gap }} className="flex flex-row items-center h-full w-fit will-change-transform translate-z-0">
            {campaigns.map((c, i) => (
              <div key={c.id} className="shrink-0">
                <CassetteCard campaign={c} onSelect={onSelect} index={i} dragX={x} cardWidth={metrics.cardWidth} cardHeight={metrics.cardHeight} step={metrics.step} />
              </div>
            ))}
          </motion.div>
        </div>

        {currentIndex > 0 && <button onClick={() => snapTo(currentIndex - 1)} className="absolute left-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-cardboard-dark/20 text-ink/50 hover:text-ink/80"><ChevronLeft size={20} /></button>}
        {currentIndex < campaigns.length - 1 && <button onClick={() => snapTo(currentIndex + 1)} className="absolute right-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-cardboard-dark/20 text-ink/50 hover:text-ink/80"><ChevronRight size={20} /></button>}

        <div className="absolute bottom-3 left-0 right-0 flex justify-center z-20">
          <TapeProgress total={campaigns.length} current={currentIndex} onChange={snapTo} />
        </div>
      </main>

      <footer className="px-5 py-3 flex justify-between items-center bg-cardboard/30 border-t border-cardboard-dark/40 relative z-40">
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-[0.2em] uppercase opacity-60">
          <div className="w-2 h-2 bg-analog-green rounded-full animate-pulse shadow-[0_0_8px_#378b44]" /> SINAL_ESTÁVEL
        </div>
        <div className="font-mono text-[9px] font-bold opacity-30">PORT_RM_84</div>
      </footer>

      <AnimatePresence>
        {overlays.menu && <SecurityMenu onClose={toggleOverlay('menu', false)} onLogout={() => { toggleOverlay('menu', false)(); onLogout?.(); }} onShowProfile={() => { toggleOverlay('menu', false)(); onShowProfile?.(); }} />}
        {overlays.metadata && <MetadataOverlay onClose={toggleOverlay('metadata', false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
