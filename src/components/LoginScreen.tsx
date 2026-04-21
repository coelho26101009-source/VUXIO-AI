import React from 'react';
import { Cpu, LogIn, UserCircle2 } from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
  onGuest: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onGuest }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-[#0e0e18] relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#12131f] via-[#0e0e18] to-[#0e0e18] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
          <Cpu size={28} className="text-amber-500" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-black tracking-widest text-amber-500 font-['Sora'] mb-1 drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
          Vimo AI
        </h1>
        <p className="text-xs text-amber-600/50 uppercase tracking-[0.35em] mb-10 text-center">
          Inteligência Artificial Avançada
        </p>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-amber-500/10 hover:bg-amber-500/18 border border-amber-500/25 hover:border-amber-500/45 text-amber-400 font-semibold text-sm tracking-wide transition-all duration-200 hover:shadow-[0_0_20px_rgba(245,158,11,0.12)]"
          >
            <LogIn size={16} />
            Entrar com Google
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-white/6" />
            <span className="text-xs text-white/20">ou</span>
            <div className="flex-1 h-px bg-white/6" />
          </div>

          <button
            onClick={onGuest}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/14 text-white/50 hover:text-white/70 font-medium text-sm tracking-wide transition-all duration-200"
          >
            <UserCircle2 size={16} />
            Continuar sem conta
          </button>
        </div>

        <p className="text-xs text-white/18 mt-6 text-center leading-relaxed">
          Sem conta, o histórico de conversas não é guardado.
        </p>
      </div>
    </div>
  );
};
