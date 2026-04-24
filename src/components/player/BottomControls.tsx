import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Menu, Monitor } from 'lucide-react';
import { FaApple } from 'react-icons/fa';
import { motion, AnimatePresence } from 'motion/react';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { activityLogger } from '../../services/ActivityLogger';
import type { WalkmanStatus } from '../../types/player';

export default function BottomControls({ 
  status,
  setIsPlaying, 
  hasTape,
  onRewind,
  hasTerminalAccess,
  onTerminalOpen,
  hasMacAccess,
  onMacOpen
}: { 
  status: WalkmanStatus;
  setIsPlaying: (v: boolean) => void; 
  hasTape: boolean;
  onRewind?: () => void;
  hasTerminalAccess?: boolean;
  onTerminalOpen?: () => void;
  hasMacAccess?: boolean;
  onMacOpen?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  
  const isPlaying = status === 'PLAYING';
  const isRewinding = status === 'REWINDING';
  const terminalAccess = !!hasTerminalAccess;
  const macAccess = !!hasMacAccess;
  const appCount = (terminalAccess ? 1 : 0) + (macAccess ? 1 : 0);

  const handleAppClick = () => {
    analyticsTracker.incrementStat('fidgetClicks');
    if (appCount > 1) {
      if (!showMenu) activityLogger.logAction('menu', 'Aberto seletor de sistemas');
      setShowMenu(!showMenu);
    } else if (terminalAccess && onTerminalOpen) {
      onTerminalOpen();
    } else if (macAccess && onMacOpen) {
      onMacOpen();
    }
  };

  return (
    <div className="mt-4 flex justify-between items-center px-2 shrink-0 relative" style={{ touchAction: 'manipulation' }}>
      <AnimatePresence>
        {showMenu && appCount > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-14 right-2 w-40 bg-[#1a1a1a] border-2 border-[#333] shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden z-50 py-1"
          >
            <div className="px-3 py-1.5 border-b border-[#333] mb-1">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#555]">Sistemas</span>
            </div>
            {terminalAccess && (
              <button 
                onClick={() => { onTerminalOpen?.(); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#252525] active:bg-[#333] transition-colors text-[10px] font-black tracking-widest text-[#33FF33]"
              >
                <Monitor size={14} /> MH-DOS v6.22
              </button>
            )}
            {macAccess && (
              <button 
                onClick={() => { onMacOpen?.(); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#252525] active:bg-[#333] transition-colors text-[10px] font-black tracking-widest text-zinc-300"
              >
                <div className="w-3.5 flex justify-center"><FaApple size={14} /></div> MACOS v7.1
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => { 
          analyticsTracker.incrementStat('fidgetClicks');
          if (hasTape && onRewind && !isRewinding) {
            activityLogger.logAction('player', 'Retroceder fita');
            onRewind();
          }
        }}
        className={`w-16 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center transition-all ${(hasTape && !isRewinding) ? 'active:bg-[#444] active:scale-95' : 'opacity-40 cursor-not-allowed'}`}
      >
        <RotateCcw size={18} className={`text-orange-500 ${isRewinding ? 'animate-spin' : ''}`} />
      </button>

      <button onClick={() => {
        analyticsTracker.incrementStat('fidgetClicks');
        if (hasTape) {
          const nextPlaying = !isPlaying;
          activityLogger.logAction('player', nextPlaying ? 'Iniciado Play' : 'Pausado');
          setIsPlaying(nextPlaying);
        }
      }}
        className={`w-20 h-12 bg-[#333] rounded-xl border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center gap-1 transition-all ${hasTape ? 'active:bg-[#444] active:shadow-inner active:scale-95' : 'opacity-40 cursor-not-allowed'}`}>
        {isPlaying ? <Pause size={22} className="text-orange-500 fill-orange-500" /> : <Play size={22} className="text-orange-500 fill-orange-500" />}
      </button>

      <button 
        onClick={handleAppClick} 
        className={`w-16 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center transition-all ${appCount > 0 ? 'active:scale-95 active:bg-[#444] shadow-[0_0_15px_rgba(0,0,0,0.5)]' : 'opacity-40 cursor-not-allowed'}`}
      >
        <span className="flex items-center justify-center pointer-events-none">
          {appCount > 1 ? (
            <Menu size={18} className={`${showMenu ? 'text-white' : 'text-orange-500'} transition-colors`} />
          ) : terminalAccess ? (
            <span className="text-[#33FF33] text-[10px] font-black tracking-tighter drop-shadow-[0_0_5px_rgba(51,255,51,0.5)]">MH-DOS</span>
          ) : macAccess ? (
            <span className="text-zinc-300 drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
              <FaApple size={18} />
            </span>
          ) : (
            <span className="text-orange-500 text-xs font-bold">EQ</span>
          )}
        </span>
      </button>
    </div>
  );
}
