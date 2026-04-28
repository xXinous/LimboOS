import React, { memo, useState } from 'react';
import { motion, useTransform, MotionValue } from 'motion/react';
import { Zap, Loader2 } from 'lucide-react';
import { Campaign } from '../../data/campaigns';

interface CassetteCardProps {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
  index: number;
  dragX: MotionValue<number>;
  cardWidth: number;
  cardHeight: number;
  step: number;
}

export const CassetteCard = memo(({ campaign, onSelect, index, dragX, cardWidth, cardHeight, step }: CassetteCardProps) => {
  const isLocked = campaign.status === 'Bloqueada';
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const range = [-(index + 1) * step, -index * step, -(index - 1) * step];
  const scale = useTransform(dragX, range, [0.9, 1, 0.9]);
  const opacity = useTransform(dragX, range, [0.55, 1, 0.55]);
  const rotateY = useTransform(dragX, range, [-3, 0, 3]);
  const y = useTransform(dragX, range, [12, 0, 12]);
  
  return (
    <motion.div
      style={{ scale, opacity, rotateY, y, width: cardWidth, height: cardHeight }}
      className="relative shrink-0 select-none origin-center will-change-transform"
    >
      <div className="cassette-plastic" />
      <div className="cassette-base w-full h-full flex flex-col p-4 pb-6 items-center">
        <div 
          onClick={() => !isLocked && setIsExpanded(!isExpanded)}
          className={`w-full bg-[#eeeae0] flex-1 flex flex-col p-3 border border-[#d2cab7] rounded-sm shadow-sm relative overflow-hidden transition-all ${!isLocked ? 'cursor-pointer hover:brightness-[1.02]' : ''}`}
        >
          <div className="h-10 sm:h-12 flex items-center justify-center mb-2">
            <h3 className="font-oswald text-lg sm:text-xl uppercase tracking-wider text-center text-ink leading-tight wrap-break-word px-1">{campaign.name}</h3>
          </div>
          
          <div className="w-full flex-1 min-h-0 border-2 border-ink overflow-hidden bg-zinc-950 mb-3 relative group shadow-inner">
            {!imageLoaded && <div className="absolute inset-0 flex items-center justify-center bg-zinc-900"><Loader2 className="w-6 h-6 text-analog-orange animate-spin opacity-20" /></div>}
            {campaign.imageUrl ? (
              <img 
                src={campaign.imageUrl} alt={campaign.name} 
                onLoad={() => setImageLoaded(true)}
                className={`w-full h-full object-contain transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} 
                draggable={false} 
              />
            ) : <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-700"><Zap size={40} /></div>}
            
            {isLocked && <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20"><div className="bg-red-600 text-white font-black px-3 py-1 rotate-[-10deg] shadow-2xl border-2 border-white text-sm uppercase tracking-tighter">BLOQUEADO</div></div>}
          </div>

          <div className="mb-2 shrink-0 overflow-hidden relative">
            <p className={`text-[10px] text-ink/80 leading-snug font-mono italic border-l-2 border-analog-orange/30 pl-2 text-justify ${isExpanded ? 'overflow-y-auto max-h-[80px]' : 'line-clamp-3'}`}>
              {campaign.description}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-ink mt-auto font-chakra border-t border-ink/10 pt-3">
            <div className="col-span-2 flex flex-col gap-0.5">
              <span className="font-mono opacity-50 text-[8px] uppercase font-bold tracking-widest">SISTEMA:</span>
              <span className="text-[10px] font-bold uppercase truncate">{campaign.rpgSystem}</span>
            </div>
            <div className="flex flex-col gap-0.5 overflow-hidden">
              <span className="font-mono opacity-50 text-[8px] uppercase font-bold tracking-widest">LOCAL:</span>
              <span className="text-[10px] font-bold truncate">{campaign.location}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono opacity-50 text-[8px] uppercase font-bold tracking-widest">ANO:</span>
              <span className="text-[10px] font-bold truncate">{campaign.year}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-center w-full px-2 z-20">
          {!isLocked ? (
            <button onClick={(e) => { e.stopPropagation(); onSelect(campaign); }} className="btn-sk-orange px-6 py-2.5 sm:py-3.5 w-full uppercase tracking-[0.2em] text-sm sm:text-base cursor-pointer">Acessar</button>
          ) : (
            <button className="btn-sk-disabled px-4 py-2.5 sm:py-3.5 w-full uppercase tracking-wide text-xs sm:text-sm leading-tight opacity-90 cursor-not-allowed">Indisponível</button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
