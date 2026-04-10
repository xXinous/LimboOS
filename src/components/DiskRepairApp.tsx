import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GameEventsState, firestoreUnlockTape } from '../store/firestore';
import { analyticsTracker } from '../services/AnalyticsTracker';

interface DiskRepairAppProps {
  uid: string;
  onClose: () => void;
  onBackToTerminal?: () => void;
}

export const DISK_REPAIR_CORRUPTED_TEXT = `S̸e̵ ̸o̸n̵d̴a̷ ̶s̵o̵n̶o̶r̶a̷ ̷a̶t̶i̵n̷g̷e̸ ̴∇̸ ̴∞̵ ̵n̷o̵ ̵m̶i̶l̶i̴s̸s̶e̵g̷u̴n̸d̸o̵ ̴d̵o̵ ̷e̶r̵r̵o̸ ̶t̴e̵m̴p̴o̶r̵a̵l̴.̶.̶.̷
O̵ ̵█̶█̶█̶█̶█̶█̶█̶█̶█̶█̶ ̷n̵ã̷o̵ ̷é̴ ̵l̵i̶n̴h̷a̴.̵ ̶É̸ ̴u̶m̸ ̷l̶o̵o̵p̸ ̷d̵e̴ ̶c̵ó̸d̵i̴g̵o̵.̶
1̷9̶0̶0̶ ̶▒̶░̶▓̶ ̶E̷R̵R̴O̷ ̸S̷I̸N̸T̸A̶X̵E̴ ̴▓̸░̸▒̸ ̶2̶0̶0̶0̵
A̶c̶h̷a̸m̴ ̴q̴u̷e̷ ̵é̶ ̵b̴u̷g̷ ̸c̷a̵l̶e̷n̸d̸á̷r̸i̴o̷.̸ ̵I̵d̴i̷o̷t̶a̵s̸.̵
L̸I̶M̵B̶O̷_̴0̶1̵ ̶é̶ ̶f̵e̵n̶d̴a̷.̸ ̶█̶█̶█̶█̶█̶█̶█̶ ̸v̵i̵v̶e̵ ̵n̷o̴ ̶e̵s̶p̵a̶ç̶o̵ ̷e̷n̷t̸r̵e̷ ̷z̶e̶r̶o̴s̸.̵
S̵e̴ ̶a̶l̴i̵m̵e̵n̴t̶a̸ ̸d̷e̴ ̴s̶i̶n̵a̵l̵.̶ ̶O̴d̴e̷i̴a̸ ̶a̷n̷a̷l̸ó̵g̵i̶c̸o̸.̸ ̷F̸i̵t̸a̸ ̸é̶ ̸â̷n̶c̶o̸r̶a̶.̶
C̷á̴l̶c̶u̵l̸o̸ ̴t̵r̶a̷n̶s̴i̷ç̸ã̶o̴:̷
(̵E̶ ̸≠ ̷h̷*̸f̴)̷ ̶/̵ █̶▓̶▒̶░̵▄̵▀̶▒̵▓̶█̶ ̵∇̵∞̶ ̵∂̷Ω̶∑̸ ̶¥̸§̷ÿ̷¢̶¿̶ ̶█̶▀̶▄̷█̴▓̷▒̷ ̸R̸E̵A̷L̷I̴D̴A̶D̵E̴ ̸O̴U̵T̶R̶A̷ ̵▒̵▓̴█̸▄̵▀̴ ̷█̴▓̷▒̷ ̵S̵Ω̸Λ̷M̷∂̴ ̸█̶█̶█̶█̶█̶█̶█̶█̶ ̶▓̴▒̸░̷ ̶A̸ ̵C̸ ̸E̷ ̸S̴ ̵S̵ ̵O̵ ̶▓̴▒̷█̴▀̸▄̵ ̵█̶▓̶▒̸ ̴S̵Ω̷Λ̸M̸∂̶ ̸░̷▄̶▀̷▒̷▓̵█̸ ̴∇̷∞̴ ̵∂̸Ω̶∑̴ ̸¥̵§̸ÿ̸¢̸¿̵ ̴█̴▀̵▄̵█̴▓̶▒̶ ̷R̷E̸A̷L̵I̴D̴A̴D̵E̴ ̵O̵U̸T̵R̶A̶ ̸▒̸▓̸█̴▄̵▀̴ ̵
S̵e̷ ̴e̷u̷ ̶s̸u̷m̷i̴r̶,̴ ̶f̴r̶e̵q̵u̶ê̵n̵c̵i̶a̶ ̵f̶u̶n̶c̸i̶o̸n̶o̷u̷.̶
M̶e̷ ̷a̵c̵h̴e̶m̷ ̴n̶o̵ ̵z̴e̴r̶o̵.̶`;

export const DISK_REPAIR_REPAIRED_TEXT = `A Teoria das Cordas diz que existem 11 dimensões, mas todo mundo está ignorando o óbvio: o zero é a ponte.
Eu percebi que o que está acontecendo agora é uma colisão. É a minha frequência analógica (do walkman mesmo) batendo de frente com esse "reset" digital do Bug do Milênio. Se a onda sonora atingir o infinito no exato milisegundo em que o erro temporal acontecer... a gente vai ver a verdade.
O Multiverso não é uma linha reta, como ensinam na escola. É um loop de código. 1900 foi um erro de sintaxe. 2000 é o próximo.
O LIMBO_01 é a fenda que abriu. E o Malware... ele não é um vírus comum. Ele é algo que vive no espaço "entre" os zeros. Ele se alimenta de sinal, por isso ele odeia tudo o que é analógico. A fita cassete é a minha única âncora aqui.
Cálculo de transição: (E=h⋅f)/Y2K_Bug=ACESSO
Se eu sumir hoje, significa que a frequência funcionou. Não me procurem no futuro. Me achem no zero.`;

export default function DiskRepairApp({ uid, onClose, onBackToTerminal }: DiskRepairAppProps) {
  const [phase, setPhase] = useState<'intro' | 'loading' | 'viewer' | 'repairing' | 'result'>('intro');
  const [diskRepairAllowed, setDiskRepairAllowed] = useState(false);
  const [resultStatus, setResultStatus] = useState<'success' | 'fail' | null>(null);
  const [progress, setProgress] = useState(0);
  
  // Scrambled data generator
  const [scrambleText, setScrambleText] = useState("");

  useEffect(() => {
    analyticsTracker.grantAchievement('ACH-REPAIR-APP');
  }, []);

  // Listen to the global admin toggle
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'gameEvents'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GameEventsState;
        setDiskRepairAllowed(!!data.diskRepairAllowed);
      }
    });
    return () => unsub();
  }, []);

  const generateScramble = () => {
    return DISK_REPAIR_CORRUPTED_TEXT;
  };

  const handleInsertDisk = () => {
    setPhase('loading');
    setProgress(0);
    // Simulate floppy read
    let p = 0;
    const interval = setInterval(() => {
      p += 15 + Math.random() * 20;
      if (p >= 100) {
        clearInterval(interval);
        setScrambleText(generateScramble());
        setPhase('viewer');
        analyticsTracker.grantAchievement('ACH-REPAIR-FAIL');
        firestoreUnlockTape(uid, 'evidence-disk-01-corrupted').catch(console.error);
      } else {
        setProgress(p);
      }
    }, 400);
  };

  const handleRepair = () => {
    setPhase('repairing');
    setProgress(0);
    
    let p = 0;
    const interval = setInterval(() => {
      p += 5 + Math.random() * 10;
      
      // Update scramble to look like it's trying to fix it
      if (Math.random() > 0.5) setScrambleText(generateScramble());

      if (p >= 100) {
        clearInterval(interval);
        setPhase('result');
        const success = diskRepairAllowed;
        setResultStatus(success ? 'success' : 'fail');
        
        if (success) {
          analyticsTracker.grantAchievement('ACH-REPAIR-SUCCESS');
          // Unlock the evidence disk in the main library
          firestoreUnlockTape(uid, 'evidence-disk-01').catch(console.error);
          // User failed the repair (no achievement needed, already got the corrupt one)
        }
      } else {
        setProgress(p);
      }
    }, 300);
  };

  const handleRetry = () => {
    setPhase('intro');
    setResultStatus(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#008080] font-sans selection:bg-[#000080] selection:text-white touch-none select-none">
      
      {/* CRT Effects */}
      <div className="fixed inset-0 pointer-events-none mix-blend-overlay opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMyMjIiPjwvcmVjdD48cGF0aCBkPSJNMCAwTDIgMk0yIDBMMCAyIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')]" />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-[95%] max-w-lg bg-[#c0c0c0] shadow-[inset_1px_1px_#dfdfdf,inset_2px_2px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] border border-[#0a0a0a] flex flex-col relative z-10"
      >
        {/* Title Bar */}
        <div className="bg-linear-to-r from-[#000080] to-[#1084d0] p-1 flex items-center justify-between shadow-[inset_1px_1px_#dfdfdf,inset_-1px_-1px_#808080]">
          <div className="flex items-center gap-2 px-1">
            <span className="w-4 h-4 bg-white shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#fff] border border-[#0a0a0a] flex items-center justify-center text-[10px]">💾</span>
            <span className="text-white font-bold text-sm tracking-wide">Desmagnetizador de Disco v1.4</span>
          </div>
          <div className="flex gap-1">
             {onBackToTerminal && (
               <button onClick={onBackToTerminal} className="bg-[#c0c0c0] w-5 h-5 flex items-center justify-center font-bold text-xs shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] active:translate-y-px active:translate-x-px">
                 _
               </button>
             )}
             <button onClick={onClose} className="bg-[#c0c0c0] w-5 h-5 flex items-center justify-center font-bold text-xs shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] active:translate-y-px active:translate-x-px">
               X
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 flex flex-col gap-4 text-[#0a0a0a] text-sm">
          
          <AnimatePresence mode="wait">
            
            {phase === 'intro' && (
              <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 py-6 border border-[#808080] shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff] bg-white p-6">
                <div className="text-6xl">💾</div>
                <div className="text-center">
                  <h2 className="font-bold mb-2">Nenhum disco detectado no Drive A:</h2>
                  <p className="text-xs text-[#808080]">Por favor, insira o disquete magnético corrompido fisicamente no leitor para iniciar a análise.</p>
                </div>
                <button onClick={handleInsertDisk} className="px-6 py-2 bg-[#c0c0c0] border-2 border-transparent shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] font-bold outline-hidden focus:outline-black focus:outline-offset-2">
                  Inserir Disquete
                </button>
              </motion.div>
            )}

            {(phase === 'loading' || phase === 'repairing') && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4 py-8 px-4">
                <div className="flex items-center gap-4">
                   <div className="w-8 h-8 animate-spin border-4 border-[#000080] border-t-transparent rounded-full" />
                   <p className="font-bold">{phase === 'loading' ? 'Lendo setores do disco...' : 'Desmagnetizando MFT...'}</p>
                </div>

                <div className="h-6 w-full bg-white border border-[#808080] shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff] p-0.5 mt-4">
                   <div className="h-full bg-[#000080]" style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
              </motion.div>
            )}

            {phase === 'viewer' && (
              <motion.div key="viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                <div className="flex items-start gap-4 mb-2">
                  <div className="text-4xl">⚠️</div>
                  <div>
                    <h2 className="font-bold text-red-600">Erro de Leitura (Erro de redundância cíclica)</h2>
                    <p className="text-xs mt-1">O formato do volume é irreconhecível. Os cabeçários magnéticos estão desativados por exposição severa a ímãs.</p>
                  </div>
                </div>

                <div className="h-40 bg-black text-[#00ff00] font-mono text-[10px] p-2 overflow-hidden break-all border border-[#808080] shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff]">
                  {scrambleText}
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={handleRetry} className="px-4 py-1 bg-[#c0c0c0] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] outline-none">
                    Cancelar
                  </button>
                  <button onClick={handleRepair} className="px-4 py-1 bg-[#c0c0c0] font-bold shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] border-2 border-black active:border-transparent active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] outline-hidden focus:outline-black focus:outline-offset-2">
                    Arrumar Disquete
                  </button>
                </div>
              </motion.div>
            )}

            {phase === 'result' && resultStatus === 'fail' && (
             <motion.div key="fail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-6 border border-[#808080] shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff] bg-white p-6">
                <div className="text-5xl">🛑</div>
                <div className="text-center">
                  <h2 className="font-bold text-red-600 text-lg mb-2">Não é possível ler o disquete.</h2>
                  <p className="text-sm">Os danos magnéticos foram extensos e o hardware ejetou o disco para previnir travamentos na agulha.</p>
                  <p className="text-xs text-[#808080] mt-2">Tente limpar o disco com álcool isopropílico e tente novamente.</p>
                </div>
                <button onClick={handleRetry} className="mt-4 px-6 py-2 bg-[#c0c0c0] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] font-bold outline-none">
                  OK
                </button>
              </motion.div>
            )}

            {phase === 'result' && resultStatus === 'success' && (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                <div className="flex items-center gap-4 mb-2 p-2 bg-[#000080] text-white">
                  <div className="text-3xl">✅</div>
                  <div>
                    <h2 className="font-bold">Disquete Descorrompido com Sucesso!</h2>
                    <p className="text-xs">O Master File Table foi reconstruído.</p>
                  </div>
                </div>

                <div className="h-40 bg-white text-black font-mono text-xs p-3 overflow-y-auto border border-[#808080] shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff] whitespace-pre-wrap">
                   {DISK_REPAIR_REPAIRED_TEXT}
                </div>

                <div className="text-xs text-center border-t border-[#808080] pt-2 mt-2">
                  <p>O conteúdo do disquete agora pode ser copiado com segurança para a unidade central.</p>
                </div>

                {onBackToTerminal && (
                  <div className="flex justify-end gap-2">
                    <button onClick={onBackToTerminal} className="mt-2 px-4 py-1 bg-[#c0c0c0] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] outline-none">
                      Fechar
                    </button>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
