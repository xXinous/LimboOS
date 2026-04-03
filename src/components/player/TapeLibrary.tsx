import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Tape } from '../../data/tapes';
import type { DisplayMode } from '../../types/player';

export default function TapeLibrary({ tapes, currentTapeId, isPlaying, displayMode, onTapeSelect }: {
  tapes: Tape[]; currentTapeId: string | null; isPlaying: boolean; displayMode: DisplayMode;
  onTapeSelect: (tape: Tape) => void;
}) {
  const sorted = React.useMemo(() => {
    if (displayMode === 'title') return [...tapes].sort((a, b) => a.title.localeCompare(b.title));
    if (displayMode === 'chapter') return [...tapes].sort((a, b) => a.chapter.localeCompare(b.chapter));
    return tapes;
  }, [tapes, displayMode]);

  return (
    <div className="mt-6 flex-1 bg-[#1a1a1a] rounded-2xl border-2 border-[#333] overflow-hidden flex flex-col mr-[76px]">
      <div className="p-3 border-b border-[#333] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center"><span className="text-white font-black text-sm italic">R.</span></div>
          <h2 className="text-orange-500 text-sm font-bold tracking-tight">Fitas</h2>
        </div>
        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
          {displayMode === 'default' ? 'Original' : displayMode === 'title' ? 'A-Z' : 'Cap.'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <style>{`.tape-scroll::-webkit-scrollbar{width:4px}.tape-scroll::-webkit-scrollbar-track{background:#1a1a1a}.tape-scroll::-webkit-scrollbar-thumb{background:#ea580c;border-radius:4px}`}</style>
        <div className="tape-scroll overflow-y-auto h-full">
          {tapes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <span className="text-3xl mb-2">📼</span>
              <p className="text-gray-600 text-xs uppercase tracking-widest">Nenhuma fita</p>
              <p className="text-gray-700 text-[10px] mt-1">Escaneie um QR code para começar</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {sorted.map((tape) => (
                <motion.div layout key={tape.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => onTapeSelect(tape)}
                  className={`p-2 border-b border-[#222] cursor-pointer transition-colors flex justify-between items-center ${tape.id === currentTapeId ? 'bg-orange-900/20 border-orange-500/50' : 'hover:bg-[#222]'}`}>
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className={`text-xs font-bold truncate ${tape.id === currentTapeId ? 'text-orange-500' : 'text-gray-200'}`}>{tape.title}</span>
                    <span className="text-[10px] text-orange-400 opacity-80 truncate">{tape.chapter}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {tape.id === currentTapeId && isPlaying && (
                      <motion.div animate={{ opacity: [0, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}
                        className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-orange-500 border-b-4 border-b-transparent" />
                    )}
                    <div className="w-8 h-8 bg-[#222] rounded border border-[#333] flex items-center justify-center text-sm">📼</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
