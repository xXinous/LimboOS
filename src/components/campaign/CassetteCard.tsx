import React, { memo, useState, useMemo } from 'react';
import { motion, useTransform, MotionValue } from 'motion/react';
import { Zap, ChevronRight } from 'lucide-react';
import { Campaign } from '../../data/campaigns';
import RetroSpinner from '../player/RetroSpinner';

interface CassetteCardProps {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
  index: number;
  dragX: MotionValue<number>;
  cardWidth: number;
  cardHeight: number;
  step: number;
  isActive: boolean;
  onSnapToSelf: () => void;
}

export const CassetteCard = memo(({ campaign, onSelect, index, dragX, cardWidth, cardHeight, step, isActive, onSnapToSelf }: CassetteCardProps) => {
  const isLocked = campaign.status === 'Bloqueada';
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const cardX = useMemo(() => index * step, [index, step]);
  const relativePosition = useTransform(dragX, (val) => val + cardX);
  const distance = useTransform(relativePosition, Math.abs);
  
  const scale = useTransform(distance, [0, step, step * 2], [1, 0.85, 0.75], { clamp: true });
  const opacity = useTransform(distance, [0, step, step * 2], [1, 0.6, 0.3], { clamp: true });
  const rotateY = useTransform(relativePosition, [-step * 2, -step, 0, step, step * 2], [25, 15, 0, -15, -25], { clamp: true });
  const rotateX = useTransform(distance, [0, step], [0, 5], { clamp: true });
  const rotateZ = useTransform(relativePosition, [-step, 0, step], [-2, 0, 2], { clamp: true });
  const zIndex = useTransform(distance, [0, step], [10, 0]);
  const y = useTransform(distance, [0, step, step * 2], [0, 20, 35], { clamp: true });
  const filter = useTransform(distance, [0, step, step * 2], ['blur(0px) brightness(1)', 'blur(3px) brightness(0.6)', 'blur(6px) brightness(0.4)'], { clamp: true });
  
  return (
    <motion.div
      style={{ scale, opacity, rotateY, rotateX, rotateZ, zIndex, y, filter, width: cardWidth, height: cardHeight }}
      className="relative shrink-0 select-none origin-center will-change-transform"
      onClick={() => {
        if (!isActive) {
          onSnapToSelf();
        } else if (!isLocked) {
          setIsExpanded(!isExpanded);
        }
      }}
    >
      <div className="absolute inset-0 bg-primary/5 border-2 border-primary/20 rounded-sm -m-2 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="bg-surface-container-low border-2 border-industrial-silver/10 w-full h-full flex flex-col p-6 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rotate-45 translate-x-8 -translate-y-8 border-b-2 border-primary/10" />
        
        <div className={`w-full flex-1 flex flex-col min-h-0 transition-all ${(!isLocked || !isActive) ? 'cursor-pointer' : ''}`}>
          <div className="flex items-start justify-between mb-4 shrink-0">
            <div className="space-y-1">
              <span className="text-[8px] font-display font-bold text-primary tracking-[0.3em] uppercase opacity-60">Identificador de Missão</span>
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-white leading-tight group-hover:text-primary transition-colors">{campaign.name}</h3>
            </div>
            <div className="w-10 h-10 border border-primary/20 flex items-center justify-center text-primary/40 group-hover:text-primary group-hover:border-primary/50 transition-all">
              <Zap size={20} />
            </div>
          </div>
          
          <div className="w-full flex-1 min-h-0 border border-primary/10 overflow-hidden bg-black/40 mb-4 relative shadow-inner group-hover:border-primary/30 transition-colors">
            {!imageLoaded && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50"><RetroSpinner size="sm" className="opacity-20" /></div>}
            {campaign.imageUrl ? (
              <img 
                src={campaign.imageUrl} alt={campaign.name} 
                onLoad={() => setImageLoaded(true)}
                className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${imageLoaded ? 'opacity-70 group-hover:opacity-100' : 'opacity-0'}`} 
                draggable={false} 
              />
            ) : <div className="w-full h-full flex items-center justify-center bg-zinc-950/50 text-industrial-silver/10"><Zap size={48} /></div>}
            
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-linear-to-t from-black/80 via-transparent to-transparent opacity-60" />
            
            {isLocked && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-20">
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 font-display font-bold px-4 py-2 uppercase tracking-widest text-xs mb-2">ACESSO NEGADO</div>
                <div className="text-[9px] text-red-500/60 font-display uppercase tracking-[0.2em]">Nível de Autorização Insuficiente</div>
              </div>
            )}
          </div>

          <div className={`mb-4 transition-all duration-300 ${isExpanded ? 'h-24' : 'h-12'} shrink-0 relative overflow-hidden`}>
            <div className="text-[10px] text-industrial-silver/60 leading-relaxed font-sans text-justify border-l-2 border-primary/30 pl-4 py-1 h-full">
              <p className={`custom-scrollbar h-full overflow-y-auto ${!isExpanded ? 'line-clamp-2' : ''}`}>
                {campaign.description}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-industrial-silver font-display border-t border-white/5 pt-4 shrink-0">
            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-[8px] font-bold text-primary/40 uppercase tracking-[0.3em]">Sistema de Operação</span>
              <span className="text-[11px] font-bold uppercase text-white/80">{campaign.rpgSystem}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-primary/40 uppercase tracking-[0.3em]">Setor</span>
              <span className="text-[11px] font-bold text-white/80">{campaign.location}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-primary/40 uppercase tracking-[0.3em]">Registro Temporal</span>
              <span className="text-[11px] font-bold text-white/80">{campaign.year}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 w-full z-20 shrink-0">
          {!isLocked ? (
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!isActive) {
                  onSnapToSelf();
                } else {
                  onSelect(campaign); 
                }
              }} 
              className={`w-full font-display font-bold text-xs uppercase tracking-[0.3em] py-4 transition-all flex items-center justify-center gap-2 group/btn active:scale-95 ${
                isActive 
                  ? 'bg-primary hover:bg-primary-container text-black glow-orange' 
                  : 'bg-surface-container-highest/80 text-industrial-silver/50 hover:bg-primary/10 hover:text-primary border border-primary/20'
              }`}
            >
              {isActive ? 'Iniciar Missão' : 'Selecionar'}
              {isActive && <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />}
            </button>
          ) : (
            <button className="w-full bg-surface-container-highest/50 text-industrial-silver/20 font-display font-bold text-xs uppercase tracking-[0.3em] py-4 cursor-not-allowed border border-white/5">
              Protocolo Bloqueado
            </button>
          )}
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-2 right-4 flex gap-1 opacity-20">
          {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-primary rounded-full" />)}
        </div>
      </div>
    </motion.div>
  );
});
