import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Menu, Volume2, VolumeX, User, Code2 } from 'lucide-react';
import { MarkdownMessage } from './components/MarkdownMessage';

import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useSpeech } from './hooks/useSpeech';

import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { VimoAvatar } from './components/VimoAvatar';
import { InputBar } from './components/InputBar';
import type { Attachment } from './types';

const VimoSphere: React.FC<{ isConnected: boolean; isSpeaking: boolean; isCodeMode: boolean }> = ({
  isConnected, isSpeaking, isCodeMode,
}) => {
  const dots = Array.from({ length: 80 });
  const dotColors = isCodeMode
    ? ['#22c55e', '#4ade80', '#86efac']
    : ['#a855f7', '#818cf8', '#ec4899'];
  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      <div
        className={`absolute inset-0 rounded-full border ${isCodeMode ? 'border-green-500/10' : 'border-purple-500/10'}`}
        style={{ animation: isConnected ? 'vimo-orbit 12s linear infinite' : 'none' }}
      />
      <div
        className={`absolute rounded-full border ${isCodeMode ? 'border-emerald-400/10' : 'border-indigo-400/8'}`}
        style={{ inset: '10%', animation: isConnected ? 'vimo-orbit-r 8s linear infinite' : 'none' }}
      />
      <div className="relative" style={{ width: 160, height: 160 }}>
        {dots.map((_, i) => {
          const phi = Math.acos(-1 + (2 * i) / dots.length);
          const theta = Math.sqrt(dots.length * Math.PI) * phi;
          const x = 80 + 65 * Math.sin(phi) * Math.cos(theta);
          const y = 80 + 65 * Math.sin(phi) * Math.sin(theta);
          const z = Math.cos(phi);
          const opacity = (z + 1) / 2 * 0.85 + 0.1;
          const r = 1.2 + (z + 1) * 1.2;
          const color = dotColors[i % 3];
          return (
            <div key={i} className="absolute rounded-full" style={{
                width: r * 2, height: r * 2, left: x - r, top: y - r,
                background: color, opacity,
                animation: isConnected ? `vimo-twinkle ${1.5 + (i % 5) * 0.4}s ease-in-out infinite` : 'none',
                boxShadow: z > 0.5 ? `0 0 ${r * 3}px ${color}` : 'none',
            }} />
          );
        })}
        <div className="absolute rounded-full transition-all duration-300" style={{
            width: isSpeaking ? 50 : 40, height: isSpeaking ? 50 : 40,
            left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            background: isCodeMode
              ? 'radial-gradient(circle, rgba(34,197,94,0.6) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(168,85,247,0.6) 0%, transparent 70%)',
        }} />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { user, authMode, login, logout, continueAsGuest } = useAuth();
  const { isSpeaking, isListening, speak, toggleMic } = useSpeech();
  const [isConnected, setIsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [currentTime, setCurrentTime] = useState('--:--:--');
  const [currentDate, setCurrentDate] = useState('--/--');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleMute = () => {
    window.speechSynthesis?.cancel();
    setIsMuted(prev => !prev);
  };

  const { logs, chatList, currentChatId, isLoading, sendMessage, newChat, loadChat, deleteChat, subscribeToChats } =
    useChat(user, isMuted ? () => {} : speak, isCodeMode);

  const hasMessages = logs.filter(l => l.source !== 'SYSTEM').length > 0;

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (authMode === 'loading') return;
    setIsConnected(false);
    setTimeout(() => setIsConnected(true), 800);
  }, [authMode]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid);
    return () => unsub();
  }, [user, subscribeToChats]);

  const handleSend = useCallback((text: string, attachment: Attachment | null) => {
    sendMessage(text, attachment, user?.displayName || 'Utilizador');
  }, [sendMessage, user]);

  if (authMode === 'loading') return <div className="h-screen flex items-center justify-center bg-[#0e0e18] text-white/20 uppercase tracking-widest text-xs">A carregar...</div>;
  if (authMode !== 'user' && authMode !== 'guest') return <LoginScreen onLogin={login} onGuest={continueAsGuest} />;

  return (
    <div className={`flex h-screen overflow-hidden ${isCodeMode ? 'code-mode bg-[#080f0b]' : 'bg-[#0b0b1a]'}`}>
      {/* Overlay (mobile apenas) */}
      {isSidebarOpen && <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar retrátil em todos os tamanhos */}
      <div className={`fixed md:relative inset-y-0 left-0 z-50 shrink-0 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0 md:block' : '-translate-x-full md:hidden'}`}>
        <Sidebar user={user} isGuest={authMode === 'guest'} chatList={chatList} currentChatId={currentChatId} isConnected={isConnected} isSpeaking={isSpeaking} isListening={isListening} onNewChat={() => { newChat(); setIsSidebarOpen(false); }} onLoadChat={(id) => { loadChat(id); setIsSidebarOpen(false); }} onDeleteChat={deleteChat} onLogout={logout} onLogin={login} onToggleMic={() => toggleMic((t) => window.dispatchEvent(new CustomEvent('vimo-transcript', { detail: t })))} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className={`h-[60px] flex items-center justify-between px-4 sm:px-6 backdrop-blur-xl border-b ${isCodeMode ? 'bg-[#080f0b]/80 border-green-500/10' : 'bg-[#0b0b1a]/80 border-white/5'}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white/50 hover:text-white/80 transition-colors"><Menu size={22} /></button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono ${isCodeMode ? 'bg-green-500/10 border-green-500/20 text-green-400/80' : 'bg-purple-500/10 border-purple-500/20 text-white/50'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shadow-[0_0_6px_#4ade80]" />
              <span className="font-medium">{isCodeMode ? 'VIMO::CODE' : 'VIMO V1.0'}</span>
              <ChevronDown size={11} />
            </div>
            <button onClick={toggleMute} title={isMuted ? 'Ativar voz' : 'Silenciar'} className="p-2 text-white/50 hover:text-white/80 transition-colors">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCodeMode(prev => !prev)}
              title={isCodeMode ? 'Mudar para modo normal' : 'Mudar para modo código'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 ${
                isCodeMode
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
              }`}
            >
              <Code2 size={14} />
              <span className="hidden sm:inline">MOD CODE</span>
            </button>
            <div className={`hidden sm:flex gap-3 px-4 py-2 rounded-xl border text-center ${isCodeMode ? 'bg-green-900/10 border-green-500/15' : 'bg-white/5 border-white/10'}`}>
              <div><p className={`font-mono text-xs leading-none ${isCodeMode ? 'text-green-400' : 'text-purple-400'}`}>{currentTime}</p><p className="text-[9px] text-white/20 mt-0.5">HORA</p></div>
              <div className="w-px h-6 bg-white/10" />
              <div><p className={`font-mono text-xs leading-none ${isCodeMode ? 'text-green-400' : 'text-purple-400'}`}>{currentDate}</p><p className="text-[9px] text-white/20 mt-0.5">HOJE</p></div>
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-bold">
              {user?.photoURL
                ? <img src={user.photoURL} className="w-full h-full object-cover rounded-full" alt="avatar" />
                : user?.displayName?.charAt(0)
                  ? user.displayName.charAt(0)
                  : <User size={14} />}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto vimo-scroll p-4 sm:p-6">
          {!hasMessages ? (
            <div className="h-full flex flex-col items-center justify-center gap-6">
              <VimoSphere isConnected={isConnected} isSpeaking={isSpeaking} isCodeMode={isCodeMode} />
              {isCodeMode ? (
                <div className="font-mono text-sm text-left space-y-1">
                  <p className="text-green-600/60">{'// vimo --mode=programmer --lang=pt-PT'}</p>
                  <p className="text-green-400/80">{'> Sistema inicializado.'}</p>
                  <p className="text-green-400/80">{'> Pronto para codificar.'}</p>
                  <p className="flex items-center gap-1 text-green-400">
                    <span>{'>'}</span>
                    <span className="w-2 h-4 bg-green-400 code-cursor inline-block" />
                  </p>
                </div>
              ) : (
                <div className="text-center"><h2 className="text-2xl font-bold text-white">Olá, eu sou o <span className="text-purple-500">VIMO.</span></h2><p className="text-sm text-white/40">Em que posso ajudar?</p></div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {logs.filter(l => l.source !== 'SYSTEM').map(log => (
                <div key={log.id} className={`flex gap-3 animate-fade-up ${log.source === 'USER' ? 'flex-row-reverse' : ''}`}>
                  {log.source !== 'USER' && <VimoAvatar size={36} isConnected={isConnected} isSpeaking={isSpeaking && log === logs[logs.length-1]} isCodeMode={isCodeMode} />}
                  <div className={`max-w-[85%] flex flex-col ${log.source === 'USER' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-white/20 mb-1">{log.timestamp}</span>
                    <div className={`px-4 py-3 text-sm rounded-2xl ${
                      log.source === 'USER'
                        ? isCodeMode
                          ? 'bg-green-600/15 border border-green-500/25 text-white font-mono'
                          : 'bg-purple-600/20 border border-purple-500/30 text-white'
                        : isCodeMode
                          ? 'bg-green-900/10 border border-green-500/15 text-green-50'
                          : 'bg-white/5 border border-white/10 text-gray-200'
                    }`}>
                      <MarkdownMessage text={log.text} isCodeMode={isCodeMode} />
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className={`flex gap-2 p-4 w-20 rounded-2xl animate-pulse ${isCodeMode ? 'bg-green-900/10' : 'bg-white/5'}`}>
                  <span className={`w-2 h-2 rounded-full ${isCodeMode ? 'bg-green-500' : 'bg-purple-500'}`} />
                  <span className={`w-2 h-2 rounded-full ${isCodeMode ? 'bg-green-500' : 'bg-purple-500'}`} />
                  <span className={`w-2 h-2 rounded-full ${isCodeMode ? 'bg-green-500' : 'bg-purple-500'}`} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>
        <div className="p-4 sm:p-6"><InputBar onSend={handleSend} isLoading={isLoading} isConnected={isConnected} /></div>
      </div>
      <style>{`
        @keyframes vimo-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes vimo-orbit-r { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes vimo-twinkle { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        .vimo-scroll::-webkit-scrollbar { width: 4px; }
        .vimo-scroll::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.2); border-radius: 4px; }
        .animate-fade-up { animation: fade-up 0.3s ease-out forwards; }
        @keyframes fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;