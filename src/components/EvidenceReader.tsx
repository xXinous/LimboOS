import React from 'react';
import { motion } from 'motion/react';
import type { IntelItem } from '../types/intel';
import { ACCESS_LEVEL_LABELS } from '../types/intel';

interface EvidenceReaderProps {
  evidence: IntelItem;
  onClose: () => void;
}

/**
 * EvidenceReader — Visualizador unificado para todos os tipos de IntelItem.
 * 
 * Suporta:
 * - TEXT   → Renderiza textContent em estilo terminal verde
 * - VISUAL → Exibe imagem com descrição em estilo ciano
 * - AUDIO  → Exibe player de áudio embutido (caso acessado fora do walkman)
 * - META   → Exibe ícone e descrição de conquista/flag
 */
export default function EvidenceReader({ evidence, onClose }: EvidenceReaderProps) {
  const isVisual = evidence.type === 'VISUAL';
  const isText = evidence.type === 'TEXT';
  const isAudio = evidence.type === 'AUDIO';
  const isMeta = evidence.type === 'META';
  const levelLabel = ACCESS_LEVEL_LABELS[evidence.level];

  // Detect if mediaUrl is a video
  const isVideo = isVisual && evidence.mediaUrl && /\.(mp4|webm|ogg|mov)$/i.test(evidence.mediaUrl);

  // Color scheme per type
  const scheme = isVisual
    ? { bg: 'bg-[#0a0a0f]', text: 'text-cyan-400', border: 'border-cyan-400', accent: 'cyan', selBg: 'selection:bg-cyan-400', selText: 'selection:text-[#0a0a0f]', scrollThumb: '#22d3ee' }
    : isMeta
      ? { bg: 'bg-[#0f0a15]', text: 'text-purple-400', border: 'border-purple-400', accent: 'purple', selBg: 'selection:bg-purple-400', selText: 'selection:text-[#0f0a15]', scrollThumb: '#a855f7' }
      : isAudio
        ? { bg: 'bg-[#0d0a00]', text: 'text-amber-400', border: 'border-amber-400', accent: 'amber', selBg: 'selection:bg-amber-400', selText: 'selection:text-[#0d0a00]', scrollThumb: '#f59e0b' }
        : { bg: 'bg-[#0a0a0a]', text: 'text-[#00ff00]', border: 'border-[#00ff00]', accent: 'green', selBg: 'selection:bg-[#00ff00]', selText: 'selection:text-[#0a0a0a]', scrollThumb: '#00ff00' };

  const typeIcons: Record<string, string> = { AUDIO: '📼', VISUAL: '📷', TEXT: '💾', META: '🏆' };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`absolute inset-0 z-50 flex flex-col ${scheme.bg} ${scheme.text} font-mono p-4 sm:p-6 sm:rounded-[32px] overflow-hidden`}
    >
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-10" style={{
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02))',
        backgroundSize: '100% 2px, 3px 100%'
      }} />
      <div className="absolute inset-0 pointer-events-none z-20" style={{
        background: 'radial-gradient(circle, transparent 70%, rgba(0,0,0,0.3) 100%)'
      }} />
      {/* Header */}
      <div className={`flex items-center justify-between border-b ${scheme.border}/30 pb-4 mb-4 shrink-0`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{typeIcons[evidence.type] || '📄'}</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest">{evidence.title}</h2>
            <p className="text-[10px] opacity-70 italic">
              {isVisual 
                ? `Categoria: ${evidence.metadata?.visualCategory || 'Intel'}` 
                : isAudio
                  ? `Artista: ${evidence.metadata?.artist || 'Desconhecido'}`
                  : isMeta
                    ? `Conquista: ${evidence.metadata?.unlockCondition || 'Sistema'}`
                    : `Recuperado por: ${evidence.metadata?.artist || 'Desconhecido'}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 border rounded ${
            evidence.level >= 3 
              ? `${scheme.border}/50 ${scheme.text} ${scheme.bg.replace('bg-', 'bg-')}/10` 
              : 'border-current/30 opacity-50'
          }`}>
            {levelLabel}
          </span>
          <button 
            onClick={onClose}
            className={`px-3 py-1 border ${scheme.border} hover:${scheme.bg} text-[10px] transition-colors uppercase font-bold`}
          >
            [ FECHAR_ ]
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: ${scheme.scrollThumb}; border-radius: 2px; }
        `}</style>

        {/* VISUAL: Video or Image */}
        {isVisual && (evidence.mediaUrl || evidence.metadata?.imageUrl) ? (
          <div className="flex flex-col items-center py-4 gap-4">
            {isVideo ? (
              <video
                src={evidence.mediaUrl}
                controls
                className="w-full max-h-[50vh] rounded-lg border border-cyan-500/30 bg-black"
                playsInline
              />
            ) : (
              <img
                src={evidence.mediaUrl || evidence.metadata?.imageUrl}
                alt={evidence.title}
                className="w-full max-h-[50vh] object-contain rounded-lg border border-cyan-500/30"
              />
            )}
            {evidence.description && (
              <div className={`w-full text-sm leading-relaxed whitespace-pre-wrap ${scheme.selBg} ${scheme.selText} text-cyan-300/90`}>
                {evidence.description}
              </div>
            )}
          </div>
        ) : isAudio && evidence.mediaUrl ? (
          /* AUDIO: Embedded player */
          <div className="flex flex-col items-center py-8 gap-6">
            <div className="w-24 h-24 rounded-2xl bg-amber-400/10 border-2 border-amber-400/30 flex items-center justify-center text-5xl animate-pulse">
              📼
            </div>
            <div className="w-full max-w-sm">
              <audio src={evidence.mediaUrl} controls className="w-full" preload="metadata" />
            </div>
            {evidence.metadata?.duration && (
              <p className="text-[10px] opacity-50 uppercase">
                Duração: {Math.floor(evidence.metadata.duration / 60)}:{String(evidence.metadata.duration % 60).padStart(2, '0')}
              </p>
            )}
            {evidence.description && (
              <div className={`w-full text-sm leading-relaxed whitespace-pre-wrap ${scheme.selBg} ${scheme.selText} opacity-80`}>
                {evidence.description}
              </div>
            )}
          </div>
        ) : isMeta ? (
          /* META: Achievement/flag display */
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <div className="text-6xl">
              {evidence.metadata?.icon || '🏆'}
            </div>
            <h3 className="text-lg font-bold uppercase tracking-widest">{evidence.title}</h3>
            <p className={`text-sm leading-relaxed max-w-xs opacity-80 ${scheme.selBg} ${scheme.selText}`}>
              {evidence.description}
            </p>
            {evidence.metadata?.hint && (
              <div className="mt-4 p-3 border border-purple-400/30 rounded-lg text-[11px] opacity-60">
                <span className="font-bold uppercase">Dica: </span>{evidence.metadata.hint}
              </div>
            )}
          </div>
        ) : (
          /* TEXT: Terminal-style text content */
          <div className={`text-sm leading-relaxed whitespace-pre-wrap py-4 ${scheme.selBg} ${scheme.selText}`}>
            {evidence.textContent || evidence.description}
          </div>
        )}
      </div>
      {/* Footer with enriched metadata */}
      <div className={`mt-4 pt-4 border-t ${scheme.border}/30 text-[9px] opacity-50 flex justify-between uppercase`}>
        <span>Setor: {evidence.metadata?.chapter || 'Desconhecido'}</span>
        <span>Nível: {levelLabel}</span>
        <span>{evidence.metadata?.npc ? `NPC: ${evidence.metadata.npc}` : 'Checksum: OK'}</span>
      </div>
    </motion.div>
  );
}
