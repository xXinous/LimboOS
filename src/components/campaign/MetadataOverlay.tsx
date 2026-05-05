import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { generateAgentId } from '../../store/firestore';

interface AgentDossier {
  uid: string;
  characterId: string;
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
  vivo: { label: 'ATIVO', color: 'text-green-500', dot: 'bg-green-500' },
  morto: { label: 'ELIMINADO', color: 'text-red-500', dot: 'bg-red-500' },
  desaparecido: { label: 'DESAPARECIDO', color: 'text-yellow-500', dot: 'bg-yellow-500' },
} as const;

const DANGER_LABELS = ['—', 'BAIXO', 'MODERADO', 'ELEVADO', 'ALTO', 'CRÍTICO'] as const;

export const MetadataOverlay = ({ onClose, agent }: MetadataOverlayProps) => {
  const [agentCode, setAgentCode] = useState<string | null>(agent?.agentId || null);
  const [loading, setLoading] = useState(!agent?.agentId);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (agent?.uid && !agent.agentId) {
      setLoading(true);
      generateAgentId(agent.uid, agent.characterId)
        .then((id) => { setAgentCode(id); setLoading(false); })
        .catch(() => setLoading(false));
    } else if (agent?.agentId) {
      setAgentCode(agent.agentId);
      setLoading(false);
    }
  }, [agent?.uid, agent?.agentId]);

  useEffect(() => {
    if (!loading && agentCode) {
      const timer = setTimeout(() => setRevealed(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, agentCode]);

  const status = agent?.agentStatus || 'vivo';
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.vivo;
  const dangerLevel = agent?.dangerLevel || 0;
  const dangerLabel = DANGER_LABELS[dangerLevel] || '—';

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} 
        animate={{ scale: 1, y: 0 }} 
        className="bg-surface border-2 border-primary/30 p-8 shadow-2xl w-full max-w-[360px] relative overflow-hidden group"
        onClick={e => e.stopPropagation()}
      >
        <div className="noise-overlay" />
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rotate-45 translate-x-12 -translate-y-12 border-b-2 border-primary/10" />
        
        <header className="mb-8 border-b border-primary/10 pb-4 relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-display font-bold text-primary tracking-[0.4em] uppercase opacity-60">Metadados do Agente</span>
            <div className={`w-2 h-2 rounded-full ${statusCfg.dot} animate-pulse shadow-sm`} />
          </div>
          <h2 className="font-display text-2xl font-bold text-white uppercase tracking-tighter">{agent?.username || 'CARREGANDO...'}</h2>
        </header>

        <div className="space-y-6 relative z-10 font-display text-[11px] uppercase tracking-wider">
          <div className="grid grid-cols-2 gap-4 border-b border-primary/5 pb-4">
            <div className="space-y-1">
              <span className="text-industrial-silver/30 font-bold block">ID Registro</span>
              {loading ? (
                <span className="animate-pulse text-primary/40">SINC...</span>
              ) : (
                <span className="text-primary font-bold">RM-{agentCode}</span>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-industrial-silver/30 font-bold block">Status</span>
              <span className={statusCfg.color}>{statusCfg.label}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-industrial-silver/30 font-bold">Periculosidade</span>
              <span className={`font-black tracking-[0.2em] ${dangerLevel >= 4 ? 'text-red-500' : dangerLevel >= 2 ? 'text-primary' : 'text-industrial-silver/40'}`}>
                {dangerLabel}
              </span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={`h-2.5 flex-1 rounded-sm transition-all duration-700 ${i < dangerLevel ? 'bg-primary shadow-[0_0_8px_rgba(255,183,125,0.4)]' : 'bg-primary/5 border border-primary/10'}`} />
              ))}
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <span className="text-industrial-silver/30 font-bold block">Última Operação</span>
            <span className="text-white/80 block truncate">{agent?.lastCampaignName || 'NENHUM REGISTRO'}</span>
          </div>

          <div className="pt-4 opacity-30 italic border-t border-primary/5 mt-4 text-[9px] leading-relaxed tracking-normal lowercase font-sans">
            "Informação classificada nível OMEGA. Distribuição não autorizada resulta em eliminação imediata."
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-10 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 py-4 font-display font-bold text-[10px] uppercase tracking-[0.3em] transition-all relative z-10 active:scale-95 glow-orange"
        >
          Sincronizar e Sair
        </button>
      </motion.div>
    </motion.div>
  );
};
