import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, Power, Cpu, ShieldCheck, AlertTriangle, ChevronRight } from 'lucide-react';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);

    // Simulação de delay de processamento "industrial"
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (email === 'admin@industria.com' && password === '123456') {
      setIsSuccess(true);
    } else {
      setError('FALHA NA AUTENTICAÇÃO: CREDENCIAIS INVÁLIDAS');
    }
    setIsLoggingIn(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 overflow-hidden relative">
      <div className="noise-overlay" />
      <div className="scanlines" />
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 font-display text-[10vw] font-bold leading-none tracking-tighter">
          TAC-01
        </div>
        <div className="absolute bottom-10 right-10 font-display text-[10vw] font-bold leading-none tracking-tighter">
          SYS-86
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isSuccess ? (
          <motion.div
            key="login-panel"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -20 }}
            className="w-full max-max-w-md relative"
          >
            {/* Main Chassis */}
            <div className="bg-surface-container-low p-1 relative shadow-2xl">
              {/* Module Label */}
              <div className="absolute -top-3 right-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase z-10">
                MOD-AUTH-V4
              </div>

              <div className="bg-surface p-8 md:p-12">
                {/* Header Section - Asymmetric */}
                <div className="mb-12 border-l-4 border-primary pl-6">
                  <h1 className="font-display text-4xl font-bold text-white tracking-tight uppercase mb-2">
                    Acesso ao <span className="text-primary">Terminal</span>
                  </h1>
                  <p className="text-xs font-display uppercase tracking-[0.2em] text-industrial-silver/60">
                    Protocolo de Segurança Nível 04
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-8">
                  {/* Input Fields */}
                  <div className="space-y-6">
                    <div className="group">
                      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] mb-2 transition-colors group-focus-within:text-primary">
                        Identificação do Operador
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-industrial-silver/40 group-focus-within:text-primary transition-colors">
                          <User size={16} />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="EX: ADMIN@INDUSTRIA.COM"
                          className="w-full bg-surface-container-lowest border-none py-4 pl-12 pr-4 text-white font-sans text-sm tracking-wide focus:ring-0 placeholder:text-industrial-silver/20 transition-all outline-none"
                        />
                        <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] mb-2 transition-colors group-focus-within:text-primary">
                        Código de Encriptação
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-industrial-silver/40 group-focus-within:text-primary transition-colors">
                          <Lock size={16} />
                        </div>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-surface-container-lowest border-none py-4 pl-12 pr-4 text-white font-sans text-sm tracking-wide focus:ring-0 placeholder:text-industrial-silver/20 transition-all outline-none"
                        />
                        <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-900/20 border-l-2 border-red-500 p-3 flex items-center gap-3"
                      >
                        <AlertTriangle size={14} className="text-red-500 shrink-0" />
                        <span className="text-[10px] font-display font-bold text-red-500 uppercase tracking-wider">
                          {error}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action Buttons - Heavy Right Weighting */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4">
                    <button
                      type="button"
                      className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40 hover:text-primary transition-colors relative group"
                    >
                      Recuperar Acesso
                      <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all group-hover:w-1/2" />
                    </button>

                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full sm:w-auto bg-primary hover:bg-primary-container text-black font-display font-bold text-xs uppercase tracking-[0.2em] py-4 px-10 rounded-sm transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed glow-orange hover:glow-orange-strong active:scale-95"
                    >
                      {isLoggingIn ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          Iniciar Sessão
                          <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Decorative Footer Detail */}
              <div className="bg-surface-container-highest h-12 flex items-center px-8 justify-between">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-3 ${
                        isLoggingIn ? 'animate-pulse bg-primary' : 'bg-industrial-silver/20'
                      }`}
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
                <div className="text-[9px] font-display text-industrial-silver/30 uppercase tracking-widest">
                  Hardware Status: Nominal
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success-panel"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8"
          >
            <div className="relative inline-block">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12 }}
                className="w-24 h-24 bg-primary rounded-full flex items-center justify-center glow-orange-strong"
              >
                <ShieldCheck size={48} className="text-black" />
              </motion.div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-4 border border-dashed border-primary/30 rounded-full"
              />
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-5xl font-bold text-white uppercase tracking-tighter">
                Acesso <span className="text-primary">Concedido</span>
              </h2>
              <p className="text-sm font-display uppercase tracking-[0.3em] text-industrial-silver/60">
                Bem-vindo de volta, Operador
              </p>
            </div>

            <div className="pt-8">
              <button
                onClick={() => window.location.reload()}
                className="bg-surface-container-high hover:bg-surface-container-highest text-white font-display font-bold text-xs uppercase tracking-[0.2em] py-4 px-12 rounded-sm transition-all flex items-center gap-3 mx-auto"
              >
                <Power size={16} className="text-primary" />
                Encerrar Terminal
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side HUD Info - Desktop Only */}
      <div className="hidden lg:block absolute left-12 top-1/2 -translate-y-1/2 space-y-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Cpu size={14} className="text-primary" />
            <span className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver">Processador Central</span>
          </div>
          <div className="w-48 h-1 bg-surface-container-highest overflow-hidden">
            <motion.div
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-1/3 h-full bg-primary"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[9px] font-display text-industrial-silver/40 uppercase tracking-widest">Localização do Nó</div>
          <div className="text-xs font-display font-bold text-industrial-silver uppercase">Setor-7G // Grid-Delta</div>
        </div>

        <div className="space-y-2">
          <div className="text-[9px] font-display text-industrial-silver/40 uppercase tracking-widest">Uptime do Sistema</div>
          <div className="text-xs font-display font-bold text-industrial-silver uppercase">1.429:12:04</div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 opacity-30">
        <div className="h-px w-12 bg-industrial-silver" />
        <div className="text-[10px] font-display font-bold uppercase tracking-[0.4em]">Indústrias Smile © 2026</div>
        <div className="h-px w-12 bg-industrial-silver" />
      </div>
    </div>
  );
}
