import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { IntelBase, VisualIntel, TextIntel, AudioIntel, MetaIntel } from '../services/IntelEngine';

interface EvidenceReaderProps {
  evidence: IntelBase;
  onClose: () => void;
}

/**
 * Detects if text contains Zalgo/combining characters typical of corrupted data.
 */
function isCorruptedText(text: string): boolean {
  // Match combining diacritical marks (Zalgo chars)
  const zalgoPattern = /[\u0300-\u036f\u0489]/;
  return zalgoPattern.test(text);
}

/**
 * CorruptedTextRenderer — Renders corrupted/encrypted text with dramatic
 * glitch effects: chromatic aberration, flickering, scan distortion.
 */
function CorruptedTextRenderer({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [glitchOffset, setGlitchOffset] = useState(0);
  const [flickerOpacity, setFlickerOpacity] = useState(1);

  // Random glitch flicker effect
  useEffect(() => {
    const interval = setInterval(() => {
      // Random chromatic aberration offset
      setGlitchOffset(Math.random() > 0.7 ? (Math.random() * 4 - 2) : 0);
      // Random flicker
      setFlickerOpacity(Math.random() > 0.85 ? 0.3 + Math.random() * 0.4 : 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Split text into lines for per-line glitch offsets
  const lines = text.split('\n');

  return (
    <div
      ref={containerRef}
      className="relative py-4 overflow-hidden"
      style={{ opacity: flickerOpacity, transition: 'opacity 0.05s' }}
    >
      {/* Glitch CSS */}
      <style>{`
        @keyframes corrupted-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(calc(100% + 200px)); }
        }
        @keyframes corrupted-noise {
          0%, 100% { clip-path: inset(0 0 95% 0); }
          10% { clip-path: inset(40% 0 20% 0); }
          20% { clip-path: inset(10% 0 60% 0); }
          30% { clip-path: inset(80% 0 0% 0); }
          40% { clip-path: inset(5% 0 70% 0); }
          50% { clip-path: inset(50% 0 30% 0); }
          60% { clip-path: inset(20% 0 40% 0); }
          70% { clip-path: inset(70% 0 10% 0); }
          80% { clip-path: inset(30% 0 55% 0); }
          90% { clip-path: inset(60% 0 15% 0); }
        }
        @keyframes corrupted-jitter {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-2px); }
          20% { transform: translateX(1px); }
          30% { transform: translateX(-1px); }
          40% { transform: translateX(3px); }
          50% { transform: translateX(0); }
          60% { transform: translateX(-3px); }
          70% { transform: translateX(2px); }
          80% { transform: translateX(-1px); }
          90% { transform: translateX(1px); }
        }
        .corrupted-line {
          position: relative;
          animation: corrupted-jitter 3s step-end infinite;
          animation-delay: var(--jitter-delay);
        }
        .corrupted-glow {
          text-shadow:
            0 0 5px rgba(255, 0, 0, 0.4),
            0 0 10px rgba(255, 0, 0, 0.2),
            2px 0 2px rgba(0, 255, 255, 0.3),
            -2px 0 2px rgba(255, 0, 0, 0.3);
        }
        .corrupted-chromatic::before,
        .corrupted-chromatic::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .corrupted-chromatic::before {
          color: rgba(255, 0, 0, 0.5);
          animation: corrupted-noise 2s step-end infinite;
          left: 2px;
          z-index: -1;
        }
        .corrupted-chromatic::after {
          color: rgba(0, 255, 255, 0.5);
          animation: corrupted-noise 3s step-end infinite reverse;
          left: -2px;
          z-index: -1;
        }
      `}</style>

      {/* Corrupted scan bar */}
      <div
        className="absolute left-0 right-0 h-8 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(transparent, rgba(255, 0, 0, 0.08), rgba(0, 255, 255, 0.04), transparent)',
          animation: 'corrupted-scan 4s linear infinite',
        }}
      />

      {/* Noise overlay on the text */}
      <div
        className="absolute inset-0 pointer-events-none z-20 mix-blend-overlay opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Main corrupted text */}
      <div
        className="font-mono text-xs leading-loose tracking-wider whitespace-pre-wrap break-all relative z-5"
        style={{ transform: `translateX(${glitchOffset}px)` }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className="corrupted-line corrupted-glow"
            style={{
              '--jitter-delay': `${i * 0.15}s`,
              color: i % 3 === 0 ? '#ff3333' : i % 3 === 1 ? '#ff6633' : '#cc0000',
              opacity: 0.7 + Math.random() * 0.3,
            } as React.CSSProperties}
          >
            <span className="corrupted-chromatic" data-text={line}>
              {line}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom warning bar */}
      <div className="mt-4 flex items-center gap-2 text-red-500/60 text-[9px] font-mono uppercase tracking-[0.3em] animate-pulse">
        <span>⚠</span>
        <span>ERRO CRC — CHECKSUM INVÁLIDO — SETORES DANIFICADOS</span>
        <span>⚠</span>
      </div>
    </div>
  );
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
  const isVisual = evidence instanceof VisualIntel;
  const isText = evidence instanceof TextIntel;
  const isAudio = evidence instanceof AudioIntel;
  const isMeta = evidence instanceof MetaIntel;
  
  const levelLabel = evidence.getFormattedLevel();
  const details = evidence.getDetails();

  // Color scheme per type — corrupted text gets a red/danger scheme
  const isCorrupted = isText && (evidence as TextIntel).isCorrupted();
  
  const scheme = isVisual
    ? { bg: 'bg-[#0a0a0f]', text: 'text-cyan-400', border: 'border-cyan-400', accent: 'cyan', selBg: 'selection:bg-cyan-400', selText: 'selection:text-[#0a0a0f]', scrollThumb: '#22d3ee' }
    : isMeta
      ? { bg: 'bg-[#0f0a15]', text: 'text-purple-400', border: 'border-purple-400', accent: 'purple', selBg: 'selection:bg-purple-400', selText: 'selection:text-[#0f0a15]', scrollThumb: '#a855f7' }
      : isAudio
        ? { bg: 'bg-[#0d0a00]', text: 'text-amber-400', border: 'border-amber-400', accent: 'amber', selBg: 'selection:bg-amber-400', selText: 'selection:text-[#0d0a00]', scrollThumb: '#f59e0b' }
        : isCorrupted
          ? { bg: 'bg-[#0a0000]', text: 'text-red-500', border: 'border-red-500', accent: 'red', selBg: 'selection:bg-red-500', selText: 'selection:text-black', scrollThumb: '#ef4444' }
          : { bg: 'bg-[#0a0a0a]', text: 'text-[#00ff00]', border: 'border-[#00ff00]', accent: 'green', selBg: 'selection:bg-[#00ff00]', selText: 'selection:text-[#0a0a0a]', scrollThumb: '#00ff00' };

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
          <span className="text-2xl">{evidence.getTypeIcon()}</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest">{evidence.title}</h2>
            <p className="text-[10px] opacity-70 italic">
              {isVisual 
                ? `Categoria: ${details.category || 'Intel'}` 
                : isAudio
                  ? `Artista: ${details.artist || 'Desconhecido'}`
                  : isMeta
                    ? `Conquista: ${details.condition || 'Sistema'}`
                    : `Recuperado por: ${details.npc || 'Desconhecido'}`
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
        {isVisual && details.url ? (
          <div className="flex flex-col items-center py-4 gap-4">
            {details.isVideo ? (
              <video
                src={details.url}
                controls
                className="w-full max-h-[50vh] rounded-lg border border-cyan-500/30 bg-black"
                playsInline
              />
            ) : (
              <img
                src={details.url}
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
        ) : isAudio && details.source ? (
          /* AUDIO: Embedded player */
          <div className="flex flex-col items-center py-8 gap-6">
            <div className="w-24 h-24 rounded-2xl bg-amber-400/10 border-2 border-amber-400/30 flex items-center justify-center text-5xl animate-pulse">
              📼
            </div>
            <div className="w-full max-w-sm">
              <audio src={details.source} controls className="w-full" preload="metadata" />
            </div>
            {details.duration && (
              <p className="text-[10px] opacity-50 uppercase">
                Duração: {Math.floor(details.duration / 60)}:{String(details.duration % 60).padStart(2, '0')}
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
              {details.icon || '🏆'}
            </div>
            <h3 className="text-lg font-bold uppercase tracking-widest">{evidence.title}</h3>
            <p className={`text-sm leading-relaxed max-w-xs opacity-80 ${scheme.selBg} ${scheme.selText}`}>
              {evidence.description}
            </p>
            {details.hint && (
              <div className="mt-4 p-3 border border-purple-400/30 rounded-lg text-[11px] opacity-60">
                <span className="font-bold uppercase">Dica: </span>{details.hint}
              </div>
            )}
          </div>
        ) : (
          /* TEXT: Terminal-style text content — with corrupted rendering for damaged files */
          isCorrupted ? (
            <CorruptedTextRenderer text={details.body || ''} />
          ) : (
            <div className={`text-sm leading-relaxed whitespace-pre-wrap py-4 ${scheme.selBg} ${scheme.selText}`}>
              {details.body}
            </div>
          )
        )}
      </div>
      {/* Footer with enriched metadata */}
      <div className={`mt-4 pt-4 border-t ${scheme.border}/30 text-[9px] opacity-50 flex justify-between uppercase`}>
        <span>Setor: {evidence.metadata.chapter || 'Desconhecido'}</span>
        <span>Nível: {levelLabel}</span>
        <span>{details.npc ? `NPC: ${details.npc}` : 'Checksum: OK'}</span>
      </div>
    </motion.div>
  );
}
