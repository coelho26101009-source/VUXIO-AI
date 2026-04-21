import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Cpu, ChevronDown } from 'lucide-react';

import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useSpeech } from './hooks/useSpeech';

import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { VimoCore } from './components/VimoCore';
import { Terminal } from './components/Terminal';
import { InputBar } from './components/InputBar';
import { Attachment } from './types';

// ── Ecrã de boas-vindas ──────────────────────────────────────
const WelcomeScreen: React.FC<{
  questionCount: number;
  isSpeaking: boolean;
  isConnected: boolean;
  onSuggestion: (text: string) => void;
}> = ({ questionCount, isSpeaking, isConnected, onSuggestion }) => {
  const suggestions = [
    'Escreve código em Python',
    'Explica um conceito técnico',
    'Analisa um ficheiro',
    'Ajuda com um texto',
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 pb-8">
      <VimoCore
        isActive={isConnected}
        isSpeaking={isSpeaking}
        questionCount={questionCount}
        size={180}
      />
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-semibold text-[#ececec] mb-2 tracking-tight">
          Olá, sou o{' '}
          <span className="text-amber-500 font-bold">Vimo AI</span>
        </h2>
        <p className="text-sm text-white/40 font-light">Como posso ajudar-te hoje?</p>
      </div>
      <div className="flex flex-wrap gap-2.5 justify-center max-w-lg">
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            disabled={!isConnected}
            className="px-4 py-2.5 rounded-xl text-sm text-white/50 border border-amber-500/14 bg-[#1a1a28] hover:bg-amber-500/8 hover:border-amber-500/30 hover:text-amber-400 hover:shadow-[0_0_12px_rgba(245,158,11,0.07)] transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── App principal ─────────────────────────────────────────────
const App: React.FC = () => {
  const { user, authMode, login, logout, continueAsGuest } = useAuth();
  const { isSpeaking, isListening, isMuted, speak, toggleMic, toggleMute } = useSpeech();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [currentTime, setCurrentTime] = useState('--:--:--');
  const [currentDate, setCurrentDate] = useState('--/--');

  const { logs, chatList, currentChatId, isLoading, addLog, sendMessage, newChat, loadChat, subscribeToChats } =
    useChat(user, speak);

  const questionCount = logs.filter(l => l.source === 'USER').length;
  const hasMessages = logs.length > 0;

  // Relógio
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

  // Conectar quando autenticado ou em modo guest
  useEffect(() => {
    if (authMode === 'loading') return;
    setIsConnected(false);
    addLog('SYSTEM', 'A iniciar Vimo AI...');
    const t = setTimeout(() => {
      const name = user?.displayName?.split(' ')[0] || 'Comandante';
      addLog('SYSTEM', `Sistema Online. Bem-vindo${authMode === 'guest' ? '' : `, ${name}`}.`);
      setIsConnected(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [authMode]);

  // Subscrever chats do Firebase
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid);
    return () => unsub();
  }, [user, subscribeToChats]);

  const handleSend = useCallback((text: string, attachment: Attachment | null) => {
    const name = user?.displayName || 'Utilizador';
    sendMessage(text, attachment, name);
  }, [sendMessage, user]);

  const handleSuggestion = useCallback((text: string) => {
    handleSend(text, null);
  }, [handleSend]);

  const handleMicToggle = useCallback(() => {
    toggleMic((transcript) => {
      const evt = new CustomEvent('vimo-transcript', { detail: transcript });
      window.dispatchEvent(evt);
    });
  }, [toggleMic]);

  const handleNewChat = useCallback(() => {
    newChat();
  }, [newChat]);

  // Ecrã de login
  if (authMode === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0e0e18]">
        <div className="flex flex-col items-center gap-4">
          <Cpu size={32} className="text-amber-500 animate-pulse" />
          <p className="text-white/30 text-sm tracking-widest uppercase">A carregar...</p>
        </div>
      </div>
    );
  }

  if (authMode !== 'user' && authMode !== 'guest') {
    return <LoginScreen onLogin={login} onGuest={continueAsGuest} />;
  }

  return (
    <div className="flex h-screen bg-[#0e0e18] overflow-hidden" style={{ background: 'linear-gradient(160deg, #12131f 0%, #0e0e18 40%, #0e0e18 100%)' }}>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        isGuest={authMode === 'guest'}
        chatList={chatList}
        currentChatId={currentChatId}
        onNewChat={handleNewChat}
        onLoadChat={loadChat}
        onLogout={logout}
        onLogin={login}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#13131f]/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35 hover:text-white/70 hover:bg-white/6 transition-all lg:hidden"
            >
              <Menu size={18} />
            </button>
            {/* Desktop menu toggle */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="w-8 h-8 rounded-lg hidden lg:flex items-center justify-center text-white/35 hover:text-white/70 hover:bg-white/6 transition-all"
            >
              <Menu size={18} />
            </button>

            {/* Model chip */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a28] border border-amber-500/14 text-xs text-white/45 cursor-default select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80] animate-pulse" />
              <span className="font-medium tracking-wide">Vimo AI V4.0</span>
              <ChevronDown size={11} className="text-white/25" />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Clock */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a28] border border-amber-500/10">
              <div className="flex flex-col items-center">
                <span className="font-mono text-amber-500 text-xs font-medium leading-none">{currentTime}</span>
                <span className="text-white/20 text-[9px] uppercase tracking-wider mt-0.5">Hora</span>
              </div>
              <div className="w-px h-6 bg-white/6" />
              <div className="flex flex-col items-center">
                <span className="font-mono text-amber-500 text-xs font-medium leading-none">{currentDate}</span>
                <span className="text-white/20 text-[9px] uppercase tracking-wider mt-0.5">Hoje</span>
              </div>
            </div>

            {/* Terminal toggle */}
            <button
              onClick={() => setShowTerminal(o => !o)}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${showTerminal ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : 'bg-transparent border-white/6 text-white/30 hover:text-white/55'}`}
            >
              <span className="font-mono">&gt;_</span>
              Terminal
            </button>

            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-amber-500/12 border border-amber-500/20 flex items-center justify-center text-amber-500 text-xs font-bold cursor-pointer hover:bg-amber-500/18 transition-all">
              {user?.photoURL
                ? <img src={user.photoURL} alt="" className="w-full h-full rounded-full" />
                : (user?.displayName?.charAt(0) || (authMode === 'guest' ? '?' : 'U'))
              }
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* Chat column */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-900/15">
              {!hasMessages ? (
                <WelcomeScreen
                  questionCount={questionCount}
                  isSpeaking={isSpeaking}
                  isConnected={isConnected}
                  onSuggestion={handleSuggestion}
                />
              ) : (
                <div className="max-w-2xl mx-auto px-4 py-6">
                  {/* Show the VimoCore small above messages */}
                  <div className="flex justify-center mb-6">
                    <VimoCore
                      isActive={isConnected}
                      isSpeaking={isSpeaking}
                      questionCount={questionCount}
                      size={90}
                    />
                  </div>
                  {/* Messages */}
                  <div className="space-y-6">
                    {logs.map(log => {
                      if (log.source === 'SYSTEM') {
                        return (
                          <p key={log.id} className="text-center text-xs text-white/20 font-mono py-1">
                            {'// '}{log.text}
                          </p>
                        );
                      }
                      const isUser = log.source === 'USER';
                      const isErr = log.source === 'ERROR';
                      return (
                        <div key={log.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border ${
                            isUser ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' :
                            isErr ? 'bg-red-500/10 border-red-500/25 text-red-400' :
                            'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-500/40 text-white'
                          }`}>
                            {isUser ? 'TU' : isErr ? '!' : 'V'}
                          </div>
                          <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] text-white/25 font-mono px-1">
                              {log.timestamp}{!isUser && ' · Vimo AI'}
                            </span>
                            <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border ${
                              isUser
                                ? 'bg-[#1a1a28] border-amber-500/15 text-[#ececec] rounded-tr-sm'
                                : isErr
                                  ? 'bg-red-900/10 border-red-500/15 text-red-200 rounded-tl-sm'
                                  : 'bg-transparent border-transparent text-[#d4d0c8] rounded-tl-sm px-0'
                            }`}>
                              <div className="prose prose-sm prose-invert max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: log.text
                                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-200">$1</strong>')
                                    .replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 text-xs border border-amber-500/10">$1</code>')
                                    .replace(/\n/g, '<br/>')
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Typing indicator */}
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 border border-amber-500/40 text-white">V</div>
                        <div className="flex items-center gap-1 py-3 px-0">
                          {[0, 0.2, 0.4].map((d, i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-amber-500/60"
                              style={{ animation: `bounce 1.2s ease-in-out infinite ${d}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <InputBar
              onSend={handleSend}
              isLoading={isLoading}
              isConnected={isConnected}
              isMuted={isMuted}
              isListening={isListening}
              onToggleMute={toggleMute}
              onToggleMic={handleMicToggle}
            />
          </div>

          {/* Terminal panel */}
          {showTerminal && (
            <div className="hidden md:flex w-[400px] xl:w-[480px] shrink-0 border-l border-white/5 flex-col">
              <Terminal logs={logs} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes helios-rotate-cw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes helios-rotate-ccw { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes helios-nucleus-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes helios-star-tw {
          0%, 100% { opacity: 0.65; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.5); }
        }
        .scrollbar-none { scrollbar-width: none; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-thin { scrollbar-width: thin; scrollbar-color: rgba(245,158,11,0.1) transparent; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(245,158,11,0.1); border-radius: 4px; }
        .prose-invert strong { color: #fde68a; }
        .prose-invert code { color: #fcd34d; }
      `}</style>
    </div>
  );
};

export default App;
