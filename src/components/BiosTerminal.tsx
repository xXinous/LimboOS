import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { checkTerminalClosed } from '../store/firestore';

interface BiosTerminalProps {
  onIpDetected: () => void;
  uid: string;
  onClose: () => void;
  onAppLaunch?: (app: string) => void;
}

export default function BiosTerminal({ onIpDetected, uid, onClose, onAppLaunch }: BiosTerminalProps) {
  const [history, setHistory] = useState<React.ReactNode[]>([]);
  const [currentLine, setCurrentLine] = useState('');
  const terminalRef = useRef<HTMLDivElement>(null);

  const processCommand = useCallback((cmd: string) => {
    const cleanCmd = cmd.toLowerCase().trim();
    const newHistory = [...history, <div key={`cmd-${Date.now()}`}>C:\&gt;{cmd}</div>];

    let response: React.ReactNode = null;

    if (cleanCmd === '212.45.01.01') {
      onIpDetected();
      return; 
    }

    if (cleanCmd === 'diskrepair') {
      if (onAppLaunch) onAppLaunch('diskRepair');
      return;
    }

    switch (cleanCmd) {
      case 'dir':
        response = (
          <div key={`res-${Date.now()}`}>
            Volume in drive C is MACROHARD_C<br/>
            Directory of C:\<br/><br/>
            COMMAND  COM    54.645 05-31-94<br/>
            CONFIG   SYS       256 01-01-94<br/>
            AUTOEXEC BAT       128 01-01-94<br/>
            LIMBO    EXE    88.000 12-31-99<br/>
            DISKREPAIR EXE  24.512 11-12-95<br/>
            5 file(s)    167.541 bytes
          </div>
        );
        break;
      case 'cls':
        setHistory([]);
        setCurrentLine('');
        return;
      case 'ver':
        response = <div key={`res-${Date.now()}`}>MH-DOS Version 6.22 [Parody Edition]</div>;
        break;
      case 'help':
        response = <div key={`res-${Date.now()}`}>COMMANDS: DIR, CLS, VER, HELP, TIME, MEM, EXIT</div>;
        break;
      case 'time':
        response = <div key={`res-${Date.now()}`}>{new Date().toLocaleTimeString()}</div>;
        break;
      case 'mem':
        response = <div key={`res-${Date.now()}`}>Total Memory: 640KB. Available: 512KB.</div>;
        break;
      case 'exit':
        handleClose();
        return;
      case '':
        break;
      default:
        response = <div key={`res-${Date.now()}`}>Bad command or file name. (Hint: Try typing an IP address)</div>;
    }

    if (response) {
      newHistory.push(response);
    }

    setHistory(newHistory);
    setCurrentLine('');
  }, [history, onIpDetected]);

  const handleKeyInput = useCallback((key: string) => {
    if (navigator.vibrate) navigator.vibrate(10);

    if (key === 'Enter') {
      processCommand(currentLine);
    } else if (key === 'Backspace' || key === 'DEL') {
      setCurrentLine(prev => prev.slice(0, -1));
    } else if (key.length === 1) {
      setCurrentLine(prev => (prev.length < 32 ? prev + key : prev));
    }
  }, [currentLine, processCommand]);

  const handleClose = async () => {
    await checkTerminalClosed(uid);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") e.preventDefault(); // Prevent scroll on space
      if (e.key === "Enter") handleKeyInput("Enter");
      else if (e.key === "Backspace") handleKeyInput("Backspace");
      else if (e.key.length === 1) handleKeyInput(e.key.toUpperCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyInput]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history, currentLine]);

  // Keys array for rendering
  const rows = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L', { label: 'DEL', val: 'Backspace', w: 'flex-[1.6]' }],
    ['Z','X','C','V','B','N','M','.', { label: 'EXE', val: 'Enter', w: 'flex-[1.6]' }],
    [{ label: 'ESPAÇO', val: ' ', w: 'flex-[6] max-w-[260px]' }]
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#050505] overflow-hidden text-[#33FF33] font-mono touch-none select-none"
      style={{ fontFamily: '"Terminal", "Fixedsys", "Lucida Console", monospace' }}
    >
      <style>{`
        @keyframes flicker {
          0% { opacity: 0.98; } 5% { opacity: 0.95; } 10% { opacity: 0.99; }
          15% { opacity: 0.97; } 30% { opacity: 0.99; } 50% { opacity: 0.98; }
          80% { opacity: 0.99; } 100% { opacity: 1.0; }
        }
        @keyframes blinker { 50% { opacity: 0; } }
        @keyframes scanlineMove {
          0% { top: -100%; } 100% { top: 100%; }
        }
      `}</style>

      {/* Header with Exit */}
      <div className="absolute top-0 right-0 p-4 z-50">
        <button onClick={handleClose} className="text-[#33FF33] font-bold text-xl hover:text-white transition-colors">
          [X]
        </button>
      </div>

      <div className="relative flex-1 flex flex-col overflow-hidden" style={{ animation: 'flicker 0.15s infinite' }}>
        {/* Scanlines & CRT filters */}
        <div className="absolute inset-0 pointer-events-none z-10" style={{
          background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))',
          backgroundSize: '100% 2px, 3px 100%'
        }} />
        <div className="absolute inset-0 pointer-events-none z-11" style={{
          background: 'radial-gradient(circle, transparent 75%, rgba(0,0,0,0.45) 100%)'
        }} />
        <div className="absolute w-full h-full pointer-events-none z-12" style={{
          background: 'linear-gradient(0deg, rgba(51,255,51,0) 0%, rgba(51,255,51,0.04) 50%, rgba(51,255,51,0) 100%)',
          animation: 'scanlineMove 12s linear infinite'
        }} />

        {/* Terminal Screen */}
        <div ref={terminalRef} className="flex-1 p-4 sm:p-6 text-sm sm:text-base leading-tight overflow-y-auto no-scrollbar" style={{ textShadow: '0 0 5px #33FF33' }}>
          <div>MH-BIOS (C) 1994 Macrohard System Corp.</div>
          <div>CPU: Macrohard 80486DX-50 at 50MHz</div>
          <div>Memory Test: 640K OK</div>
          <br/>
          <div>MH-DOS Version 6.22</div>
          <div>(C) Copyright Macrohard Corp 1981-1994.</div>
          <br/>
          {history}
          <div className="flex items-center">
            <span>C:\&gt;</span>
            <span>{currentLine}</span>
            <span className="inline-block w-2.5 h-4 bg-[#33FF33] ml-0.5" style={{ animation: 'blinker 1s linear infinite', boxShadow: '0 0 8px #33FF33' }} />
          </div>
        </div>

        {/* Keyboard area */}
        <div className="bg-transparent p-2 pb-6 flex flex-col gap-1.5 z-20">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-center gap-1">
              {row.map((keyObj, j) => {
                const isObj = typeof keyObj === 'object';
                const label = isObj ? keyObj.label : keyObj;
                const val = isObj ? keyObj.val : keyObj;
                const widthClass = isObj && keyObj.w ? keyObj.w : 'flex-1 max-w-[44px]';

                return (
                  <button
                    key={j}
                    onPointerDown={(e) => { e.preventDefault(); handleKeyInput(val); }}
                    className={`h-11 border border-[#33FF33] text-[#33FF33] flex items-center justify-center text-sm active:bg-[#33FF33] active:text-[#050505] active:shadow-[0_0_15px_#33ff33] rounded-none transition-colors ${widthClass}`}
                    style={{ textShadow: '0 0 3px #33FF33' }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
