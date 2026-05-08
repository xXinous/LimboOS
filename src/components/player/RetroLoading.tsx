import RetroSpinner from './RetroSpinner';

interface RetroLoadingProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export default function RetroLoading({ 
  message = "SINTONIZANDO...", 
  subMessage = "Buscando sinal na frequência 87.5 MHz",
  fullScreen = false 
}: RetroLoadingProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${fullScreen ? 'fixed inset-0 z-[100] bg-surface' : 'w-full h-full p-8'}`}>
      <div className="noise-overlay" />
      <div className="scanlines" />
      
      <RetroSpinner size="lg" />

      <div className="mt-6 flex flex-col items-center gap-2">
        <motion.div 
          animate={{ opacity: [0.4, 1, 0.4] }} 
          transition={{ repeat: Infinity, duration: 2 }} 
          className="text-retro-orange font-mono text-sm tracking-[0.3em] font-black uppercase text-center"
        >
          {message}
        </motion.div>
        
        {subMessage && (
          <div className="text-industrial-silver/40 font-mono text-[9px] uppercase tracking-widest text-center animate-pulse">
            {subMessage}
          </div>
        )}
      </div>

      {/* Retro Signal Bars */}
      <div className="mt-8 flex gap-1 items-end h-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            animate={{ height: [4, 12, 6, 12, 4][i-1] }}
            transition={{ 
              duration: 0.6, 
              repeat: Infinity, 
              delay: i * 0.1,
              ease: "easeInOut"
            }}
            className="w-1.5 bg-surface-bright rounded-t-sm"
            style={{ 
              backgroundColor: i <= 3 ? 'var(--color-retro-orange)' : 'var(--color-surface-bright)',
              opacity: i <= 3 ? 0.8 : 0.3
            }}
          />
        ))}
      </div>
    </div>
  );
}
