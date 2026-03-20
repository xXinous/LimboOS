import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, LogOut, Scroll, Trophy } from 'lucide-react';
import { resolveTapes } from '../data/tapes';
import { ALL_ACHIEVEMENTS } from '../data/achievements';

interface ProfileData {
  id: string;
  username: string;
  unlockedTapeIds: string[];
  achievementIds: string[];
}

interface ProfileScreenProps {
  profile: ProfileData;
  onBack: () => void;
  onLogout: () => void;
}

export default function ProfileScreen({ profile, onBack, onLogout }: ProfileScreenProps) {
  const tapes = resolveTapes(profile.unlockedTapeIds);
  const earnedIds = new Set(profile.achievementIds);

  const initials = profile.username
    .split(/[\s\-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 200 }}
      className="absolute inset-0 bg-[#1e1e1e] rounded-[36px] flex flex-col overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-[#333] shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#333] flex items-center justify-center hover:bg-[#444] transition-colors"
        >
          <ArrowLeft size={16} className="text-orange-500" />
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center shadow-lg glow-orange">
            <span className="text-black font-display font-bold text-sm tracking-tight">{initials || '?'}</span>
          </div>
          <span className="text-white font-bold text-sm tracking-tight uppercase">{profile.username}</span>
        </div>

        <button
          onClick={onLogout}
          className="w-9 h-9 rounded-full bg-[#333] flex items-center justify-center hover:bg-red-900/30 transition-colors"
        >
          <LogOut size={15} className="text-red-500" />
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex divide-x divide-[#333] bg-[#1a1a1a] shrink-0">
        <div className="flex-1 flex flex-col items-center py-3">
          <span className="text-orange-500 font-bold text-xl">{tapes.length}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Fitas</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-3">
          <span className="text-orange-500 font-bold text-xl">{profile.achievementIds.length}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Conquistas</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Tapes section */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <Scroll size={14} className="text-orange-500" />
            <h2 className="text-orange-500 text-xs font-bold uppercase tracking-widest">Fitas Desbloqueadas</h2>
          </div>

          {tapes.length === 0 ? (
            <div className="border border-dashed border-[#333] rounded-lg p-6 text-center">
              <p className="text-gray-600 text-xs uppercase tracking-widest">Nenhuma fita ainda.</p>
              <p className="text-gray-700 text-[10px] mt-1">Escaneie um QR code para começar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {tapes.map((tape, i) => (
                  <motion.div
                    key={tape.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-[#242424] border border-[#333] rounded-lg p-3 flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded bg-orange-900/30 border border-orange-800/40 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-orange-600 text-xs">📼</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-bold truncate">{tape.title}</p>
                      <p className="text-orange-400 text-[10px] opacity-80">{tape.chapter} · {tape.npc}</p>
                    </div>
                    {tape.isSecret && (
                      <span className="ml-auto text-[9px] text-red-400 font-bold uppercase tracking-wider shrink-0">SECRETO</span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Achievements section */}
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-orange-500" />
            <h2 className="text-orange-500 text-xs font-bold uppercase tracking-widest">Conquistas</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_ACHIEVEMENTS.map((ach) => {
              const earned = earnedIds.has(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`rounded-lg p-3 border flex flex-col gap-1 transition-all ${
                    earned
                      ? 'bg-orange-900/20 border-orange-800/50'
                      : 'bg-[#1a1a1a] border-[#2a2a2a] opacity-50'
                  }`}
                >
                  <span className="text-xl">{earned ? ach.icon : '🔒'}</span>
                  <p className={`text-[11px] font-bold leading-tight ${earned ? 'text-orange-400' : 'text-gray-600'}`}>
                    {earned ? ach.title : '???'}
                  </p>
                  <p className="text-[9px] text-gray-500 leading-tight">
                    {earned ? ach.description : ach.hint}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
