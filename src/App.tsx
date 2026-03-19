import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Menu, 
  RotateCcw,
  Battery,
  Camera,
  X,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  fileSize: string;
  format: string;
  qualityHz: string;
}

const SONGS: Song[] = [
  { id: 1, title: "Midnight City", artist: "M83", album: "Hurry Up", thumbnail: "https://picsum.photos/seed/song1/100/100", fileSize: "8.4MB", format: "FLAC", qualityHz: "44.1kHz" },
  { id: 2, title: "Starboy", artist: "The Weeknd", album: "Starboy", thumbnail: "https://picsum.photos/seed/song2/100/100", fileSize: "7.2MB", format: "MP3", qualityHz: "48.0kHz" },
  { id: 3, title: "Blinding Lights", artist: "The Weeknd", album: "After Hours", thumbnail: "https://picsum.photos/seed/song3/100/100", fileSize: "9.1MB", format: "WAV", qualityHz: "96.0kHz" },
  { id: 4, title: "Levitating", artist: "Dua Lipa", album: "Future Nostalgia", thumbnail: "https://picsum.photos/seed/song4/100/100", fileSize: "6.8MB", format: "AAC", qualityHz: "44.1kHz" },
  { id: 5, title: "Stay", artist: "The Kid LAROI", album: "F*CK LOVE 3", thumbnail: "https://picsum.photos/seed/song5/100/100", fileSize: "5.5MB", format: "MP3", qualityHz: "44.1kHz" },
  { id: 6, title: "Heat Waves", artist: "Glass Animals", album: "Dreamland", thumbnail: "https://picsum.photos/seed/song6/100/100", fileSize: "7.9MB", format: "FLAC", qualityHz: "48.0kHz" },
  { id: 7, title: "Bad Habits", artist: "Ed Sheeran", album: "=", thumbnail: "https://picsum.photos/seed/song7/100/100", fileSize: "8.2MB", format: "WAV", qualityHz: "44.1kHz" },
  { id: 8, title: "Shivers", artist: "Ed Sheeran", album: "=", thumbnail: "https://picsum.photos/seed/song8/100/100", fileSize: "7.5MB", format: "MP3", qualityHz: "48.0kHz" },
  { id: 9, title: "Stay", artist: "Justin Bieber", album: "Justice", thumbnail: "https://picsum.photos/seed/song9/100/100", fileSize: "6.2MB", format: "AAC", qualityHz: "44.1kHz" },
  { id: 10, title: "Industry Baby", artist: "Lil Nas X", album: "MONTERO", thumbnail: "https://picsum.photos/seed/song10/100/100", fileSize: "8.8MB", format: "FLAC", qualityHz: "96.0kHz" },
];

// --- Components ---

const Screw = ({ className }: { className?: string }) => (
  <div className={`absolute w-4 h-4 rounded-full bg-[#1a1a1a] border border-[#3a3a3a] flex items-center justify-center ${className}`}>
    <div className="w-2 h-0.5 bg-[#3a3a3a] rotate-45"></div>
  </div>
);

const CassetteVisor = ({ 
  currentTrack, 
  isPlaying, 
  volume, 
  time,
  isCassetteInserted,
  onEject,
  onScanClick,
  isScanning,
  onCancelScan,
  isChangingTrack
}: { 
  currentTrack: Song, 
  isPlaying: boolean, 
  volume: number, 
  time: Date,
  isCassetteInserted: boolean,
  onEject: () => void,
  onScanClick: () => void,
  isScanning: boolean,
  onCancelScan: () => void,
  isChangingTrack?: boolean
}) => {
  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mt-4 mx-auto w-[310px] h-[190px] bg-[#222] rounded-xl border-4 border-[#1a1a1a] shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] flex flex-col items-center relative overflow-hidden shrink-0">
      {/* Cassette Screws */}
      <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[#111] flex items-center justify-center"><div className="w-1.5 h-px bg-[#333] rotate-45"></div></div>
      <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#111] flex items-center justify-center"><div className="w-1.5 h-px bg-[#333] -rotate-45"></div></div>
      <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-[#111] flex items-center justify-center"><div className="w-1.5 h-px bg-[#333] rotate-90"></div></div>
      <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-[#111] flex items-center justify-center"><div className="w-1.5 h-px bg-[#333]"></div></div>

      <AnimatePresence mode="wait">
        {isCassetteInserted ? (
          <motion.div 
            key="cassette"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={onEject}
            className="w-full h-full flex flex-col items-center cursor-pointer group"
          >
            {/* Cassette Label */}
            <div className="mt-4 w-[280px] h-[130px] bg-[#f4f1ea] rounded-md shadow-sm relative flex flex-col p-3 border-t-[12px] border-orange-600 transition-transform group-hover:scale-[1.01]">
              
              {/* Top Status Bar */}
              <div className="flex justify-between items-start text-[9px] font-bold text-gray-500 mb-1">
                <div className="flex items-center gap-1">
                  {isPlaying && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_4px_rgba(239,68,68,0.8)]"></div>}
                  <span className="uppercase tracking-tighter">{isPlaying ? 'PLAY' : 'STOP'}</span>
                </div>
                <div className="tracking-widest text-orange-600/80 font-black">TYPE I</div>
                <div className="flex items-center gap-1">
                  <span>{volume}%</span>
                  <Battery size={12} />
                </div>
              </div>

              {/* Metadata */}
              <div className="text-[8px] font-bold flex justify-center gap-4 text-gray-500 mb-2 border-b border-gray-300/50 pb-1">
                <span>{currentTrack.fileSize}</span>
                <span>{currentTrack.format}</span>
                <span>{currentTrack.qualityHz}</span>
              </div>

              {/* Track Info */}
              <div className="flex-1 flex flex-col text-center px-2">
                <div className="text-[13px] font-black uppercase tracking-tight text-gray-800 truncate leading-tight">
                  {currentTrack.title}
                </div>
                <div className="text-[10px] font-bold text-gray-600 truncate mt-0.5">
                  {currentTrack.artist}
                </div>
              </div>

              {/* Cutout for the window */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[180px] h-[50px] bg-[#222] rounded-t-lg border-t-2 border-l-2 border-r-2 border-[#111]"></div>
              
              {/* Eject Label (Visible on hover) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                CLICK TO EJECT
              </div>
            </div>

            {/* Cassette Window */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[170px] h-[46px] bg-black/40 rounded-md shadow-inner flex items-center justify-between px-4 overflow-hidden backdrop-blur-sm border border-white/5">
              <motion.div 
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="w-10 h-10 rounded-full bg-[#d4d4d4] flex items-center justify-center relative shadow-md"
              >
                <div className="absolute inset-0 rounded-full border-[8px] border-[#111] opacity-90"></div>
                <div className="w-4 h-4 rounded-full bg-[#222] flex items-center justify-center z-10">
                  <div className="w-full h-0.5 bg-[#d4d4d4] absolute"></div>
                  <div className="w-0.5 h-full bg-[#d4d4d4] absolute"></div>
                  <div className="w-full h-0.5 bg-[#d4d4d4] absolute rotate-45"></div>
                  <div className="w-0.5 h-full bg-[#d4d4d4] absolute rotate-45"></div>
                </div>
              </motion.div>

              <div className="absolute bottom-1 left-8 right-8 h-[3px] bg-[#111] shadow-sm"></div>

              <motion.div 
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="w-10 h-10 rounded-full bg-[#d4d4d4] flex items-center justify-center relative shadow-md"
              >
                <div className="absolute inset-0 rounded-full border-[5px] border-[#111] opacity-90"></div>
                <div className="w-4 h-4 rounded-full bg-[#222] flex items-center justify-center z-10">
                  <div className="w-full h-0.5 bg-[#d4d4d4] absolute"></div>
                  <div className="w-0.5 h-full bg-[#d4d4d4] absolute"></div>
                  <div className="w-full h-0.5 bg-[#d4d4d4] absolute rotate-45"></div>
                  <div className="w-0.5 h-full bg-[#d4d4d4] absolute rotate-45"></div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex flex-col items-center justify-center p-4"
          >
            {isScanning ? (
              <div className="w-full h-full bg-black rounded-lg relative overflow-hidden flex flex-col items-center justify-center">
                {/* Simulated Camera View */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#333_0%,_#000_100%)] opacity-50"></div>
                
                {/* Scanning Animation */}
                <motion.div 
                  animate={{ y: [-60, 60, -60] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] z-10"
                ></motion.div>

                <div className="z-20 flex flex-col items-center gap-3">
                  <div className="w-24 h-24 border-2 border-orange-500/50 rounded-lg flex items-center justify-center relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-orange-500"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-orange-500"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-orange-500"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-orange-500"></div>
                    <Camera className="text-orange-500/30" size={40} />
                  </div>
                  <p className="text-orange-500 text-[10px] font-bold tracking-widest animate-pulse">SCANNING QR CODE...</p>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); onCancelScan(); }}
                  className="absolute bottom-2 right-2 p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors"
                >
                  <X size={14} className="text-red-500" />
                </button>
              </div>
            ) : (
              <div 
                onClick={!isChangingTrack ? onScanClick : undefined}
                className={`w-[280px] h-[130px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 transition-all ${
                  isChangingTrack 
                    ? 'border-[#222] cursor-default' 
                    : 'border-[#444] hover:bg-white/5 cursor-pointer group'
                }`}
              >
                {!isChangingTrack && (
                  <>
                    <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="text-gray-500 group-hover:text-orange-500 transition-colors" size={24} />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest">Empty Compartment</p>
                      <p className="text-orange-500 text-[9px] font-bold uppercase tracking-tighter mt-1">Scan QR Code to Load Tape</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MusicLibrary = ({ 
  currentTrackIndex, 
  onTrackChange, 
  isPlaying,
  displayMode 
}: { 
  currentTrackIndex: number, 
  onTrackChange: (i: number) => void, 
  isPlaying: boolean,
  displayMode: 'default' | 'title' | 'artist'
}) => {
  const sortedSongs = React.useMemo(() => {
    const songsWithIndex = SONGS.map((song, index) => ({ ...song, originalIndex: index }));
    if (displayMode === 'title') {
      return [...songsWithIndex].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (displayMode === 'artist') {
      return [...songsWithIndex].sort((a, b) => a.artist.localeCompare(b.artist));
    }
    return songsWithIndex;
  }, [displayMode]);

  return (
    <div className="mt-6 flex-1 bg-[#1a1a1a] rounded-2xl border-2 border-[#333] overflow-hidden flex flex-col mr-[76px]">
      <div className="p-3 border-b border-[#333] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center">
            <span className="text-white font-black text-sm italic">W.</span>
          </div>
          <h2 className="text-orange-500 text-sm font-bold tracking-tight">Library</h2>
        </div>
        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
          {displayMode === 'default' ? 'Original' : displayMode === 'title' ? 'A-Z' : 'Artist'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-orange-600 scrollbar-track-[#1a1a1a]">
        <style>{`
          .scrollbar-thin::-webkit-scrollbar { width: 4px; }
          .scrollbar-thin::-webkit-scrollbar-track { background: #1a1a1a; }
          .scrollbar-thin::-webkit-scrollbar-thumb { background: #ea580c; border-radius: 4px; }
          .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #f97316; }
        `}</style>
        <AnimatePresence mode="popLayout">
          {sortedSongs.map((song) => (
            <motion.div 
              layout
              key={song.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onTrackChange(song.originalIndex)}
              className={`p-2 border-b border-[#222] cursor-pointer transition-colors flex justify-between items-center ${
                song.originalIndex === currentTrackIndex ? 'bg-orange-900/20 border-orange-500/50' : 'hover:bg-[#222]'
              }`}
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className={`text-xs font-bold truncate ${song.originalIndex === currentTrackIndex ? 'text-orange-500' : 'text-gray-200'}`}>
                  {song.title}
                </span>
                <span className="text-[10px] text-orange-400 opacity-80 truncate">{song.artist}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {song.originalIndex === currentTrackIndex && isPlaying && (
                  <motion.div
                    animate={{ opacity: [0, 1] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-orange-500 border-b-[4px] border-b-transparent"
                  />
                )}
                <div className="w-8 h-8 bg-[#222] rounded border border-[#333] overflow-hidden">
                  <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const SideControls = ({ 
  volume, 
  setVolume,
  onModeChange 
}: { 
  volume: number, 
  setVolume: (v: number) => void,
  onModeChange: (direction: 'up' | 'down') => void
}) => (
  <div className="absolute right-2 top-[240px] bottom-20 flex flex-col items-center justify-center gap-6 w-16">
    {/* Jog Dial Lever */}
    <motion.div 
      drag="y"
      dragConstraints={{ top: -20, bottom: 20 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y < -10) {
          onModeChange('up');
        } else if (info.offset.y > 10) {
          onModeChange('down');
        }
      }}
      dragSnapToOrigin
      className="relative w-14 h-14 rounded-full bg-[#333] border-4 border-[#1a1a1a] shadow-lg flex items-center justify-center group cursor-ns-resize shrink-0 z-20"
    >
      <div className="absolute inset-0 rounded-full border border-white/10"></div>
      <div className="w-10 h-10 rounded-full bg-[#444] border-2 border-[#222] flex items-center justify-center shadow-inner pointer-events-none">
        <div className="w-5 h-5 rounded-full bg-orange-600 border-2 border-[#1a1a1a]"></div>
      </div>
      <div className="absolute -top-4 text-gray-500 group-hover:text-orange-500 transition-colors pointer-events-none">
        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-current" />
      </div>
      <div className="absolute -bottom-4 text-gray-500 group-hover:text-orange-500 transition-colors pointer-events-none">
        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-current" />
      </div>
    </motion.div>

    {/* Volume Slider */}
    <div className="w-8 flex-1 max-h-40 bg-[#1a1a1a] rounded-full border-2 border-[#333] relative flex flex-col items-center py-2 shrink-0">
      <span className="text-[10px] text-gray-500 font-bold mb-1">+</span>
      <div className="flex-1 w-1 bg-[#222] rounded-full relative overflow-visible">
        <motion.div 
          className="absolute bottom-0 w-full bg-orange-600 rounded-full shadow-[0_0_8px_rgba(234,88,12,0.4)]"
          style={{ height: `${volume}%` }}
        />
        <motion.div 
          className="absolute left-1/2 -translate-x-1/2 w-6 h-8 bg-gradient-to-b from-stone-200 to-stone-400 rounded border-2 border-stone-600 shadow-lg cursor-ns-resize flex flex-col justify-center items-center gap-0.5 z-10"
          style={{ bottom: `calc(${volume}% - 16px)` }}
          onPointerDown={(e) => {
            const startY = e.clientY;
            const startVol = volume;
            const onPointerMove = (moveEvent: PointerEvent) => {
              const deltaY = startY - moveEvent.clientY;
              const deltaVol = (deltaY / 80) * 100; // approx track height
              setVolume(Math.max(0, Math.min(100, Math.round(startVol + deltaVol))));
            };
            const onPointerUp = () => {
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', onPointerUp);
            };
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
          }}
        >
          <div className="w-3 h-0.5 bg-stone-500 rounded-full shadow-inner"></div>
          <div className="w-3 h-0.5 bg-stone-500 rounded-full shadow-inner"></div>
          <div className="w-3 h-0.5 bg-stone-500 rounded-full shadow-inner"></div>
        </motion.div>
      </div>
      <span className="text-[10px] text-gray-500 font-bold mt-1">-</span>
    </div>
  </div>
);

const BottomControls = ({ isPlaying, setIsPlaying }: { isPlaying: boolean, setIsPlaying: (v: boolean) => void }) => (
  <div className="mt-4 flex justify-between items-center px-2 shrink-0">
    <button className="w-16 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center active:bg-[#444] active:shadow-inner transition-all">
      <RotateCcw size={18} className="text-orange-500" />
    </button>

    <button 
      onClick={() => setIsPlaying(!isPlaying)}
      className="w-20 h-12 bg-[#333] rounded-xl border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center gap-1 active:bg-[#444] active:shadow-inner transition-all"
    >
      {isPlaying ? (
        <Pause size={22} className="text-orange-500 fill-orange-500" />
      ) : (
        <Play size={22} className="text-orange-500 fill-orange-500" />
      )}
    </button>

    <button className="w-16 h-10 bg-[#333] rounded-full border-2 border-[#1a1a1a] shadow-lg flex items-center justify-center active:bg-[#444] active:shadow-inner transition-all">
      <Menu size={18} className="text-orange-500" />
    </button>
  </div>
);

// --- Main App ---

export default function App() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [time, setTime] = useState(new Date());
  const [isCassetteInserted, setIsCassetteInserted] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isChangingTrack, setIsChangingTrack] = useState(false);
  const [displayMode, setDisplayMode] = useState<'default' | 'title' | 'artist'>('default');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentTrack = SONGS[currentTrackIndex];

  const handleEject = () => {
    setIsPlaying(false);
    setIsCassetteInserted(false);
  };

  const handleScanClick = () => {
    setIsScanning(true);
    // Simulate a successful scan after 3 seconds
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * SONGS.length);
      setCurrentTrackIndex(randomIndex);
      setIsScanning(false);
      setIsCassetteInserted(true);
    }, 3000);
  };

  const handleTrackChange = (index: number) => {
    if (index === currentTrackIndex) return;
    
    // Trigger automated ejection animation
    setIsChangingTrack(true);
    setIsPlaying(false);
    setIsCassetteInserted(false);
    
    // Wait for ejection animation to complete, then swap and re-insert
    setTimeout(() => {
      setCurrentTrackIndex(index);
      setIsCassetteInserted(true);
      setIsChangingTrack(false);
    }, 400); // 400ms matches well with the exit animation
  };

  const handleModeChange = (direction: 'up' | 'down') => {
    const modes: ('default' | 'title' | 'artist')[] = ['default', 'title', 'artist'];
    const currentIndex = modes.indexOf(displayMode);
    let nextIndex;
    if (direction === 'up') {
      nextIndex = (currentIndex + 1) % modes.length;
    } else {
      nextIndex = (currentIndex - 1 + modes.length) % modes.length;
    }
    setDisplayMode(modes[nextIndex]);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-900 font-mono select-none overflow-hidden">
      <div className="relative w-[min(380px,90vw)] h-[min(680px,92vh)] bg-[#2a2a2a] rounded-[40px] shadow-2xl border-4 border-[#1a1a1a] flex flex-col p-4 overflow-hidden">
        
        <Screw className="top-4 left-4" />
        <Screw className="top-4 right-4 -rotate-90" />
        <Screw className="bottom-4 left-4 -rotate-90" />
        <Screw className="bottom-4 right-4" />

        <CassetteVisor 
          currentTrack={currentTrack} 
          isPlaying={isPlaying} 
          volume={volume} 
          time={time} 
          isCassetteInserted={isCassetteInserted}
          onEject={handleEject}
          onScanClick={handleScanClick}
          isScanning={isScanning}
          onCancelScan={() => setIsScanning(false)}
          isChangingTrack={isChangingTrack}
        />

        <MusicLibrary 
          currentTrackIndex={currentTrackIndex} 
          onTrackChange={handleTrackChange} 
          isPlaying={isPlaying} 
          displayMode={displayMode}
        />

        <SideControls 
          volume={volume} 
          setVolume={setVolume} 
          onModeChange={handleModeChange}
        />

        <BottomControls 
          isPlaying={isPlaying} 
          setIsPlaying={setIsPlaying} 
        />

        <div className="mt-auto pt-3 flex items-center justify-center gap-2 opacity-40 shrink-0">
          <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
          </div>
          <span className="text-[10px] font-bold text-gray-400 tracking-widest">Sony Ericsson</span>
        </div>

      </div>

      <div className="fixed inset-0 pointer-events-none opacity-5">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500 via-transparent to-transparent"></div>
      </div>
    </div>
  );
}
