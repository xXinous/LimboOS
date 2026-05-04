import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { generateAgentId } from '../../store/firestore';

interface AgentDossier {
  uid: string;
  username: string;
  agentId?: string;
  agentStatus?: 'vivo' | 'morto' | 'desaparecido';
  dangerLevel?: number;
  lastCampaignName?: string;
}

interface MetadataOverlayProps {
  onClose: () => void;
  agent?: AgentDossier | null;
}

const STATUS_CONFIG = {
  vivo: { label: 'ATIVO', color: 'text-analog-green', dot: 'bg-analog-green', glow: 'shadow-[0_0_8px_#378b44]' },
  morto: { label: 'ELIMINADO', color: 'text-analog-red', dot: 'bg-analog-red', glow: 'shadow-[0_0_8px_#cc3021]' },
  desaparecido: { label: 'DESAPARECIDO', color: 'text-yellow-500', dot: 'bg-yellow-500', glow: 'shadow-[0_0_8px_#eab308]' },
} as const;

const DANGER_LABELS = ['—', 'BAIXO', 'MODERADO', 'ELEVADO', 'ALTO', 'CRÍTICO'] as const;

export const MetadataOverlay = ({ onClose, agent }: MetadataOverlayProps) => {
  const [agentCode, setAgentCode] = useState<string | null>(agent?.agentId || null);
  const [loading, setLoading] = useState(!agent?.agentId);
  const [revealed, setRevealed] = useState(false);

  // Generate agent ID if user doesn't have one yet
  useEffect(() => {
    if (agent?.uid && !agent.agentId) {
      setLoading(true);
      generateAgentId(agent.uid)
        .then((id) => { setAgentCode(id); setLoading(false); })
        .catch(() => setLoading(false));
    } else if (agent?.agentId) {
      setAgentCode(agent.agentId);
      setLoading(false);
    }
  }, [agent?.uid, agent?.agentId]);

  // Typewriter reveal animation
  useEffect(() => {
    if (!loading && agentCode) {
      const timer = setTimeout(() => setRevealed(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, agentCode]);

  const status = agent?.agentStatus || 'vivo';
  const statusCfg = STATUS_CONFIG[status];
  const dangerLevel = agent?.dangerLevel || 0;
  const dangerLabel = DANGER_LABELS[dangerLevel] || '—';

  // Danger level bar rendering
  const dangerBars = Array.from({ length: 5 }, (_, i) => {
    const active = i < dangerLevel;
    const colors = [
      'bg-analog-green',
      'bg-yellow-500',
      'bg-analog-orange',
      'bg-analog-red',
      'bg-red-700',
    ];
    return (
      <div
        key={i}
        className={`h-3 flex-1 rounded-sm transition-all duration-500 ${
          active ? colors[i] : 'bg-ink/15'
        }`}
        style={{ transitionDelay: revealed ? `${i * 100 + 400}ms` : '0ms' }}
      />
    );
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="absolute inset-0 z-[60] bg-black/75 backdrop-blur-md flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.8, y: 20 }} 
        animate={{ scale: 1, y: 0 }} 
        className="bg-cardboard p-8 rounded-3xl border-4 border-cardboard-dark shadow-2xl w-full max-w-[340px] relative overflow-hidden"
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none scanlines" />

        {/* CLASSIFIED header stamp */}
        <motion.div
          initial={{ opacity: 0, rotate: -15, scale: 1.5 }}
          animate={{ opacity: 0.12, rotate: -12, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5, type: 'spring' }}
          className="absolute top-12 right-4 text-analog-red font-oswald font-bold text-4xl tracking-[0.3em] pointer-events-none select-none z-0 border-4 border-analog-red/20 px-3 py-1 rounded-sm"
        >
          SECRETO
        </motion.div>

        <div className="indented-box p-6 mb-6 font-mono text-[11px] space-y-3 text-ink text-left relative z-10">
          <div className="text-analog-orange font-black border-b-2 border-ink/10 pb-2 mb-3 text-sm tracking-widest uppercase flex justify-between items-center">
            <span>Dossiê_Agente</span>
            <div className="flex gap-1">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${statusCfg.dot} ${statusCfg.glow}`} />
              <div className="w-1.5 h-1.5 bg-analog-orange/30 rounded-full" />
            </div>
          </div>

          {/* Agent ID */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="opacity-50 font-bold">AGENT_ID:</span>{' '}
            {loading ? (
              <span className="animate-pulse text-analog-orange">GERANDO...</span>
            ) : (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-black text-analog-orange tracking-[0.2em] text-sm"
              >
                RM-{agentCode}
              </motion.span>
            )}
          </motion.div>

          {/* Codename */}
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="opacity-50 font-bold">CODINOME:</span>{' '}
            <span className="uppercase font-bold tracking-wider">{agent?.username || 'UNKNOWN'}</span>
          </motion.p>

          {/* Status */}
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <span className="opacity-50 font-bold">STATUS:</span>{' '}
            <span className={`font-black ${statusCfg.color}`}>{statusCfg.label}</span>
          </motion.p>

          {/* Last Mission */}
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <span className="opacity-50 font-bold">ÚLTIMA_MISSÃO:</span>{' '}
            <span className="uppercase tracking-wide">{agent?.lastCampaignName || 'SEM REGISTRO'}</span>
          </motion.p>

          {/* Danger Level */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="pt-2"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="opacity-50 font-bold">PERICULOSIDADE:</span>
              <span className={`font-black text-[10px] tracking-widest ${
                dangerLevel >= 4 ? 'text-analog-red' : dangerLevel >= 2 ? 'text-analog-orange' : 'text-ink/50'
              }`}>
                {dangerLabel}
              </span>
            </div>
            <div className="flex gap-1">
              {dangerBars}
            </div>
          </motion.div>

          {/* Encrypted footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="pt-3 opacity-70 italic border-t border-ink/10 mt-3 font-chakra leading-snug text-[10px]"
          >
            "Informação classificada nível OMEGA. Distribuição não autorizada resulta em eliminação imediata do agente."
          </motion.div>
        </div>

        <button 
          onClick={onClose} 
          className="btn-sk-orange w-full py-4 uppercase font-black tracking-widest text-sm shadow-md active:translate-y-0.5 transition-transform"
        >
          Fechar_Dossiê
        </button>
      </motion.div>
    </motion.div>
  );
};
