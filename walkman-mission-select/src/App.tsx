/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Menu, ArrowUpRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Screw({ className }: { className?: string }) {
  return <div className={cn("screw", className)}></div>;
}

function Barcode() {
  const lines = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 2];
  return (
    <div className="flex items-end h-8 gap-[2px] opacity-80">
      {lines.map((w, i) => (
        <div key={i} className="barcode-line" style={{ width: `${w * 1.5}px` }} />
      ))}
    </div>
  );
}

function AnalogLogo() {
  return (
    <div className="flex items-center gap-1 font-oswald text-2xl font-bold tracking-tight">
      <div className="flex items-center">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-orange mr-1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Leviathan inspired shape: eye and wave/tentacle */}
          <path d="M22 17c-2 0-3.5-1-5-1s-3 1-5 1-3.5-1-5-1-3 1-5 1" />
          <path d="M12 16c0-6 2-9 6-11" />
          <circle cx="15" cy="5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <span className="mt-1">ANALOG</span>
    </div>
  );
}

function CassetteCard({
  title,
  systemInfo,
  difficulty,
  progress,
  imageSrc,
  status,
}: {
  title: string;
  systemInfo: string;
  difficulty: 'ALTA' | 'MÉDIA' | 'MORTAL';
  progress: number;
  imageSrc: string;
  status: 'engage' | 'disabled' | 'replay';
}) {
  const difficultyColors = {
    ALTA: 'text-red',
    MÉDIA: 'text-ink',
    MORTAL: 'text-red',
  };

  return (
    <div className="relative w-[280px] h-[380px] sm:w-[300px] sm:h-[400px] shrink-0 snap-center">
      {/* Plastic Overlay */}
      <div className="cassette-plastic" />
      
      {/* Base Card */}
      <div className="cassette-base w-full h-full flex flex-col p-4 pb-6 items-center shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
        {/* Insert / Paper Background */}
        <div className="w-full bg-[#eeeae0] flex-1 flex flex-col p-3 border border-[#d2cab7] rounded-sm shadow-sm relative">
          
          <h3 className="font-oswald text-2xl sm:text-3xl uppercase tracking-wider text-center text-ink mb-2 mt-1 leading-none">{title}</h3>
          
          {/* Cover Art */}
          <div className="w-full aspect-[4/3] border-2 border-ink overflow-hidden bg-black mb-3 flex-shrink-0 relative group">
            <img src={imageSrc} alt={title} className="w-full h-full object-cover select-none brightness-90 group-hover:brightness-100 transition-all duration-300" draggable={false} />
            <div className="absolute inset-0 border border-white/20 pointer-events-none" />
          </div>
          
          {/* Metadata */}
          <div className="flex flex-col gap-0.5 text-sm sm:text-base text-ink flex-1">
            <div className="font-mono mt-1 opacity-80">{systemInfo}</div>
            <div className="flex gap-1 uppercase tracking-tight sm:tracking-normal">
              <span>Dificuldade:</span>
              <span className={cn(difficultyColors[difficulty], "font-bold")}>{difficulty}</span>
            </div>
            <div className="uppercase">
              <span>Sessão: {progress}</span>
            </div>
          </div>

          {(status === 'disabled' || difficulty === 'MORTAL') && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#d6ccbd] transform rotate-45 border-l border-t border-[#bbaea0]" style={{boxShadow: '-2px -2px 4px rgba(0,0,0,0.1)'}} />
          )}
        </div>

        {/* Action Button Container */}
        <div className="mt-5 flex justify-center w-full px-2 z-20">
          {status === 'engage' && (
            <button className="btn-sk-orange px-6 py-2 sm:py-2.5 w-full uppercase tracking-wider text-base sm:text-lg">
              Jogar
            </button>
          )}
          {status === 'disabled' && (
            <button className="btn-sk-disabled px-4 py-2 sm:py-2.5 w-full uppercase tracking-wide text-xs sm:text-sm leading-tight opacity-90 cursor-not-allowed">
              Desbloquear<br/>Para Jogar
            </button>
          )}
          {status === 'replay' && (
            <button className="btn-sk-orange px-6 py-2 sm:py-2.5 w-full uppercase tracking-wider text-base sm:text-lg flex items-center justify-center gap-1">
              Reviver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#111] sm:py-6 sm:px-4 flex items-center justify-center font-chakra text-ink overflow-hidden selection:bg-orange selection:text-white">
      
      {/* Main Walkman Device Container - Mobile Portrait Optimized */}
      <div className="bg-cardboard w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] max-w-[420px] sm:rounded-[12px] shadow-[0px_0px_0px_1px_rgba(255,255,255,0.1),0_20px_50px_rgba(0,0,0,0.8)] sm:border-2 border-[#bbaea0] relative flex flex-col mx-auto overflow-hidden">
        
        {/* Device Top Edge (Highlights) */}
        <div className="absolute top-0 inset-x-0 h-1 bg-white/40 z-10 hidden sm:block" />
        <div className="absolute bottom-0 inset-x-0 h-1 bg-black/30 z-10 hidden sm:block" />

        {/* Header */}
        <header className="flex justify-between items-center h-16 sm:h-18 border-b-2 border-[#bbaea0] px-4 relative z-20 bg-cardboard shadow-[0_2px_4px_rgba(0,0,0,0.05)] flex-shrink-0">
          <div className="flex items-center gap-2 -ml-1">
            <button className="p-1 hover:bg-black/5 rounded">
              <Menu size={26} className="opacity-80" />
            </button>
            <AnalogLogo />
          </div>
          <div className="text-right pb-1">
            <div className="text-[10px] sm:text-xs uppercase font-medium mt-2 leading-tight opacity-75">
              <span>Tayl Ericson</span>
              <br/>
              <span className="font-bold text-sm sm:text-base font-oswald tracking-wide">RUNNINGMAN™</span>
            </div>
          </div>
        </header>

        {/* Top Info Bar */}
        <div className="border-b-2 border-[#bbaea0] px-5 py-4 flex justify-between items-end relative bg-cardboard z-10 flex-shrink-0">
          <div className="flex flex-col">
            <div className="text-sm font-bold tracking-wider uppercase mb-1">
              Mestre-01
            </div>
            <div className="bg-ink text-white px-2.5 py-0.5 inline-block w-fit">
              <span className="font-oswald text-lg tracking-widest uppercase mb-0.5 inline-block">Campanhas</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1.5 mb-0.5">
            <Barcode />
            <div className="flex text-[9px] font-mono tracking-widest opacity-60">
              <span>09345</span><span className="ml-[8px]">97571</span>
            </div>
          </div>
        </div>

        {/* Main Content Area (Scrollable Vertically) */}
        <main className="flex-1 overflow-y-auto w-full relative flex flex-col bg-cardboard no-scrollbar shadow-[inset_0px_15px_15px_-15px_rgba(0,0,0,0.3)]">
          
          <Screw className="absolute top-5 right-5" />
          <Screw className="absolute top-5 left-5" />

          {/* Title Section */}
          <div className="px-6 mt-8 mb-8 relative w-full pr-12">
            <h2 className="font-mono text-5xl uppercase font-bold tracking-tighter leading-[0.9] mb-3 text-ink drop-shadow-sm" style={{fontFamily: "Oswald, sans-serif"}}>
              Seleção de<br/>Campanha
            </h2>
            
            <div className="flex justify-between items-end w-full">
              <div className="indented-box inline-block px-4 py-2 relative w-fit shadow-inner">
                <div className="text-sm font-mono uppercase tracking-tight font-semibold">
                  Status Global:<br/> <span className="text-green text-base">Ativo</span><br/>
                  <div className="mt-1 opacity-80 text-xs">Sincronia: 98.4%</div>
                </div>
                <div className="absolute -bottom-[1px] -right-[1px] w-4 h-4 bg-cardboard transform rotate-45 border-l border-t border-[#bbaea0]" />
              </div>
              
              <div className="stamp text-sm -rotate-12 py-0 border-ink bg-cardboard -mr-2 mb-2 absolute right-6 top-6 shadow-sm z-10">Frágil</div>
            </div>
          </div>

          {/* Cassette List */}
          <div className="flex flex-row overflow-x-auto items-center gap-6 px-4 pb-12 w-full pt-4 snap-x snap-mandatory no-scrollbar hide-scroll">
            <CassetteCard 
              title="Ecos de Neon"
              systemInfo="SISTEMA: CYBERPUNK RED"
              difficulty="ALTA"
              progress={12}
              imageSrc="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop"
              status="engage"
            />

            <CassetteCard 
              title="Marca do Vampiro"
              systemInfo="SISTEMA: VAMPIRO"
              difficulty="MÉDIA"
              progress={0}
              imageSrc="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=600&auto=format&fit=crop"
              status="disabled"
            />

            <CassetteCard 
              title="Chamado Cósmico"
              systemInfo="SISTEMA: CALL OF CTHULHU"
              difficulty="MORTAL"
              progress={24}
              imageSrc="https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=600&auto=format&fit=crop"
              status="replay"
            />
            {/* Add trailing padding relative to the list */}
            <div className="w-1 shrink-0" />
          </div>

        </main>

        {/* Bottom Controls / Status */}
        <div className="border-t-2 border-[#bbaea0] bg-cardboard p-5 flex flex-col gap-4 relative z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] flex-shrink-0">
          <button className="btn-sk-orange py-3 px-4 uppercase font-oswald text-2xl tracking-widest w-full">
            Ejetar Fita
          </button>

          <div className="flex items-center justify-between text-[11px] font-mono uppercase font-bold tracking-widest opacity-90 mt-1">
            <div className="flex gap-2.5 items-center">
              <div className="bg-ink text-white px-2 py-[2px] rounded-sm">
                Ativo
              </div>
              <span>COMM-77</span>
            </div>

            <div className="flex items-center gap-2">
              <span>Sinal</span>
              <div className="flex gap-[2px] items-end h-3">
                <div className="w-1.5 h-1 bg-ink" />
                <div className="w-1.5 h-1.5 bg-ink" />
                <div className="w-1.5 h-2 bg-ink" />
                <div className="w-1.5 h-3 bg-ink" />
              </div>
            </div>
          </div>
        </div>

      </div>
      
    </div>
  );
}
