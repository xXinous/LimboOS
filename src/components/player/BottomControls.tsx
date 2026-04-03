import { Play, Pause, RotateCcw } from 'lucide-react';
import { analyticsTracker } from '../../services/AnalyticsTracker';

export default function BottomControls({ 
  isPlaying, 
  setIsPlaying, 
  hasTape,
  onRewind,
  isRewinding,
  hasTerminalAccess,
  onTerminalOpen
}: { 
  isPlaying: boolean; 
  setIsPlaying: (v: boolean) => void; 
  hasTape: boolean;
  onRewind?: () => void;
  isRewinding?: boolean;
  hasTerminalAccess?: boolean;
  onTerminalOpen?: () => void;
}) {
  return (
    <div className="mt-4 flex justify-between items-center px-2 shrink-0" style={{ touchAction: 'manipulation' }}>
      <button 
        onClick={() => { 
          analyticsTracker.incrementStat('fidgetClicks');
          if (hasTape && onRewind && !isRewinding) onRewind(); 
        }}
        className={`w-16 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center transition-all ${(hasTape && !isRewinding) ? 'active:bg-[#444] active:scale-95' : 'opacity-40 cursor-not-allowed'}`}
      >
        <RotateCcw size={18} className={`text-orange-500 ${isRewinding ? 'animate-spin' : ''}`} />
      </button>
      <button onClick={() => {
        analyticsTracker.incrementStat('fidgetClicks');
        if (hasTape) setIsPlaying(!isPlaying);
      }}
        className={`w-20 h-12 bg-[#333] rounded-xl border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center gap-1 transition-all ${hasTape ? 'active:bg-[#444] active:shadow-inner active:scale-95' : 'opacity-40 cursor-not-allowed'}`}>
        {isPlaying ? <Pause size={22} className="text-orange-500 fill-orange-500" /> : <Play size={22} className="text-orange-500 fill-orange-500" />}
      </button>
      <button 
        onClick={() => {
          analyticsTracker.incrementStat('fidgetClicks');
          if (hasTerminalAccess && onTerminalOpen) onTerminalOpen();
        }} 
        className={`w-16 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center transition-all ${hasTerminalAccess ? 'active:scale-95 active:bg-[#444] shadow-[0_0_15px_#33ff3320]' : 'opacity-40 cursor-not-allowed'}`}
      >
        <span className={`${hasTerminalAccess ? 'text-[#33FF33] drop-shadow-[0_0_5px_rgba(51,255,51,0.5)]' : 'text-orange-500'} text-xs font-bold transition-all`}>
          {hasTerminalAccess ? 'PC' : 'EQ'}
        </span>
      </button>
    </div>
  );
}
