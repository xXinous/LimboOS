import React, { memo } from 'react';
import CassetteVisor from '../../components/player/CassetteVisor';
import TapeLibrary from '../../components/player/TapeLibrary';
import SideControls from '../../components/player/SideControls';
import BottomControls from '../../components/player/BottomControls';
import Screw from '../../components/player/Screw';
import { motion } from 'motion/react';
import type { IntelBase } from '../../services/IntelEngine';
import type { PlayerData, WalkmanStatus, DisplayMode } from '../../types/player';

const EMPTY_INTEL: IntelBase[] = [];

interface WalkmanShellProps {
  currentIntel: IntelBase | null;
  walkmanStatus: WalkmanStatus;
  isPlaying: boolean;
  displayMode: DisplayMode;
  volume: number;
  setVolume: (v: number) => void;
  intelItems: IntelBase[];
  playerData: PlayerData;
  onEject: () => void;
  onScanClick: () => void;
  onCancelScan: () => void;
  onQrDetected: (code: string) => void;
  onIntelSelect: (intel: IntelBase) => void;
  onModeChange: (dir: 'up' | 'down') => void;
  onProfileOpen: () => void;
  onCharacterSwitch: () => void;
  onSetIsPlaying: (playing: boolean) => void;
  onRewind: () => void;
  onTerminalOpen: () => void;
  onMacOpen: () => void;
}

function WalkmanShell({
  currentIntel,
  walkmanStatus,
  isPlaying,
  displayMode,
  volume,
  setVolume,
  intelItems,
  playerData,
  onEject,
  onScanClick,
  onCancelScan,
  onQrDetected,
  onIntelSelect,
  onModeChange,
  onProfileOpen,
  onCharacterSwitch,
  onSetIsPlaying,
  onRewind,
  onTerminalOpen,
  onMacOpen,
}: WalkmanShellProps) {
  return (
    <motion.div
      key="player"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="relative w-full max-w-sm h-full max-h-[750px] bg-surface-container-high rounded-[32px] border-8 border-[#1a1a1a] shadow-2xl flex flex-col p-3 sm:p-4 overflow-hidden z-10"
    >
      <Screw className="top-4 left-4" />
      <Screw className="top-4 right-4 -rotate-90" />
      <Screw className="bottom-4 left-4 -rotate-90" />
      <Screw className="bottom-4 right-4" />
      <CassetteVisor
        currentIntel={currentIntel}
        status={walkmanStatus}
        onEject={onEject}
        onScanClick={onScanClick}
        onCancelScan={onCancelScan}
        onQrDetected={onQrDetected}
      />
      <TapeLibrary
        intelItems={intelItems.length ? intelItems : EMPTY_INTEL}
        currentIntelId={currentIntel?.id ?? null}
        isPlaying={isPlaying}
        displayMode={displayMode}
        onIntelSelect={onIntelSelect}
      />
      <SideControls
        volume={volume}
        setVolume={setVolume}
        onModeChange={onModeChange}
        onProfileOpen={onProfileOpen}
        onCharacterSwitch={onCharacterSwitch}
      />
      <BottomControls
        status={walkmanStatus}
        setIsPlaying={onSetIsPlaying}
        hasTape={!!currentIntel}
        onRewind={onRewind}
        hasTerminalAccess={playerData.hasTerminalAccess}
        onTerminalOpen={onTerminalOpen}
        hasMacAccess={playerData.hasMacAccess}
        onMacOpen={onMacOpen}
      />
    </motion.div>
  );
}

export default memo(WalkmanShell);
