import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Copy, Check, RefreshCw, Globe, Settings as SettingsIcon, Code2, GraduationCap, Coffee, PenLine, Sparkles, Telescope, FileDown } from 'lucide-react';

import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useSpeech } from './hooks/useSpeech';
import { useSettings } from './hooks/useSettings';
import { useProjects } from './hooks/useProjects';

import { LoginScreen } from './components/LoginScreen';
import { AuthorProjectsPage } from './components/AuthorProjectsPage';
import { AboutPage } from './components/AboutPage';
import type { Author } from './authors';
import { Sidebar } from './components/Sidebar';
import { InputBar, ComposerNotice } from './components/InputBar';
import { FileAttachment } from './components/FileAttachment';
import { SettingsPanel } from './components/SettingsPanel';
import { ConversasView } from './components/ConversasView';
import { ProjectsView } from './components/ProjectsView';
import { openReportPdf } from './utils/reportPdf';
import { t } from './i18n';
import type { Attachment, GeneratedFile, LogMessage, Chat } from './types';

const MarkdownMessage = lazy(() => import('./components/MarkdownMessage').then(module => ({ default: module.MarkdownMessage })));
const FilePreviewPanel = lazy(() => import('./components/FilePreviewPanel').then(module => ({ default: module.FilePreviewPanel })));

const REMEMBER_PREFIX = '/remember';

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title={t('app.copyMessage')}
      className="flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md text-white/35 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span>{copied ? t('app.copied') : t('app.copy')}</span>
    </button>
  );
};

/** The question a report answers is the user turn right before it -- used as
 *  the PDF's subtitle so the file stands on its own once downloaded. */
const reportQuestion = (messages: LogMessage[], replyIndex: number) => {
  for (let i = replyIndex - 1; i >= 0; i--) {
    if (messages[i].source === 'USER') return messages[i].text;
  }
  return t('app.reportFallback');
};

// Starter prompts. Clicking one fills the composer through the same window
// event the mic transcript uses, so the input keeps owning its own text.
// A function, not a module-level constant: it must re-read t() after locale
// detection resolves, and the icons are cheap to recreate per render.
const starters = () => [
  { icon: <Code2 size={14} strokeWidth={1.75} />,         label: t('app.starter.code'),     prompt: t('app.starter.codePrompt') },
  { icon: <GraduationCap size={14} strokeWidth={1.75} />, label: t('app.starter.learn'),    prompt: t('app.starter.learnPrompt') },
  { icon: <Coffee size={14} strokeWidth={1.75} />,        label: t('app.starter.daily'),    prompt: t('app.starter.dailyPrompt') },
  { icon: <PenLine size={14} strokeWidth={1.75} />,       label: t('app.starter.write'),    prompt: t('app.starter.writePrompt') },
  { icon: <Sparkles size={14} strokeWidth={1.75} />,      label: t('app.starter.surprise'), prompt: t('app.starter.surprisePrompt') },
];

const App: React.FC = () => {
  const { user, authMode, isAuthBusy, authError, login, logout, continueAsGuest } = useAuth();
  const { isSpeaking, isListening, speak, toggleMic } = useSpeech();
  const [isConnected, setIsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMuted] = useState(false);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [isWebMode,  setIsWebMode]  = useState(false);
  const [isResearchMode, setIsResearchMode] = useState(false);
  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Settings > Advanced, bring-your-own-key. Deliberately plain state, not
  // routed through useSettings/Firestore or localStorage -- the disclosure
  // shown there promises it's never stored, so a reload must lose it.
  const [groqApiKey, setGroqApiKey] = useState('');
  const [activeView, setActiveView] = useState<'chat' | 'conversas' | 'projects' | 'author-projects' | 'about'>('chat');
  const [authorSlug, setAuthorSlug] = useState<Author['slug'] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { settings, memories, mcpServers, updateSettings, addMemory, deleteMemory, addMcpServer, deleteMcpServer, maxMemories, maxMcpServers } = useSettings(user);
  const { projectList, subscribeToProjects, createProject, deleteProject } = useProjects(user);

  const { logs, chatList, currentChatId, isLoading, isStreaming, isSearching, researchStep, groqLimits, sendMessage, regenerate, newChat, loadChat, deleteChat, subscribeToChats, addLocalMessage } =
    useChat(user, isMuted ? () => {} : speak, isCodeMode, isWebMode, isResearchMode, {
      temperature: settings.temperature,
      memories: settings.memoryEnabled ? memories.map(memory => memory.text) : [],
      mcpServers: mcpServers.map(({ name, url }) => ({ name, url })),
      selectedModel: settings.selectedModel,
      groqApiKey,
    });

  const hasMessages = logs.filter(l => l.source !== 'SYSTEM').length > 0;

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  useEffect(() => {
    if (authMode === 'loading') return;
    const id = window.setTimeout(() => setIsConnected(true), 800);
    return () => window.clearTimeout(id);
  }, [authMode]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid);
    return () => unsub();
  }, [user, subscribeToChats]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToProjects(user.uid);
    return () => unsub();
  }, [user, subscribeToProjects]);

  // /remember is intercepted before it ever reaches sendMessage: it's a
  // client-side command, not a chat turn -- no AI call, and nothing here
  // gets persisted to Firestore's chats/messages, only to the user's memory
  // list (see useSettings.addMemory).
  const handleSend = useCallback((text: string, attachment: Attachment | null) => {
    const trimmed = text.trim();
    if (trimmed.toLowerCase().startsWith(REMEMBER_PREFIX)) {
      addLocalMessage('USER', trimmed);
      const value = trimmed.slice(REMEMBER_PREFIX.length).trim();
      if (!user) {
        addLocalMessage('VUXIO', t('app.rememberNoAccount'));
      } else if (!value) {
        addLocalMessage('VUXIO', t('app.rememberEmpty'));
      } else if (addMemory(value)) {
        addLocalMessage('VUXIO', t('app.rememberSaved', { value }));
      } else {
        addLocalMessage('VUXIO', t('app.rememberFailed'));
      }
      return;
    }
    sendMessage(text, attachment, user?.displayName || t('app.defaultUserName'));
  }, [sendMessage, user, addMemory, addLocalMessage]);

  const handleClearAllChats = useCallback(() => {
    void Promise.all(chatList.map(chat => deleteChat(chat.id)));
  }, [chatList, deleteChat]);

  // Shared by the sidebar's own controls and the Conversas list, so picking a
  // chat from either place lands in the same state: chat view, that chat's
  // own mode, web mode cleared (a chat loaded mid-search shouldn't silently
  // keep searching).
  const handleNewChat = useCallback(() => {
    newChat();
    setIsCodeMode(settings.defaultMode === 'code');
    setActiveView('chat');
  }, [newChat, settings.defaultMode]);

  const handleLoadChat = useCallback((chat: Chat) => {
    loadChat(chat.id);
    setIsCodeMode(Boolean(chat.isCodeMode));
    setIsWebMode(false);
    setActiveView('chat');
  }, [loadChat]);

  // These two sit outside the auth flow entirely -- "what is this and who
  // built it" shouldn't wait on Firebase resolving, and stay reachable
  // whether or not the visitor ever signs in.
  if (activeView === 'about') return <AboutPage onBack={() => setActiveView('chat')} onViewProjects={(slug) => { setAuthorSlug(slug); setActiveView('author-projects'); }} />;
  if (activeView === 'author-projects' && authorSlug) return <AuthorProjectsPage author={authorSlug} onBack={() => setActiveView('about')} />;

  if (authMode === 'loading') return <div className="h-screen flex items-center justify-center bg-[#1a1917] text-white/20 text-xs tracking-widest uppercase">{t('app.loading')}</div>;
  if (authMode !== 'user' && authMode !== 'guest') {
    return (
      <LoginScreen
        onLogin={login}
        onGuest={continueAsGuest}
        onOpenAbout={() => setActiveView('about')}
        isAuthBusy={isAuthBusy}
        authError={authError}
      />
    );
  }

  const renderComposer = (hideNotice = false) => (
    <InputBar
      onSend={handleSend}
      isLoading={isLoading}
      isConnected={isConnected}
      isCodeMode={isCodeMode}
      isWebMode={isWebMode}
      isResearchMode={isResearchMode}
      isListening={isListening}
      isGuest={authMode === 'guest'}
      hideNotice={hideNotice}
      model={settings.selectedModel}
      onToggleWeb={() => { setIsWebMode(prev => !prev); setIsCodeMode(false); setIsResearchMode(false); }}
      onToggleResearch={() => { setIsResearchMode(prev => !prev); setIsCodeMode(false); setIsWebMode(false); }}
      onToggleMic={() => toggleMic((t) => window.dispatchEvent(new CustomEvent('VUXIO-transcript', { detail: t })))}
      onSelectModel={(selectedModel) => updateSettings({ selectedModel })}
      onOpenSettings={() => setIsSettingsOpen(true)}
    />
  );

  return (
    <div className={`flex h-screen overflow-hidden bg-[#1a1917] ${isCodeMode ? 'code-mode' : ''}`}>
      {/* Overlay (mobile apenas) */}
      {isSidebarOpen && <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setIsSidebarOpen(false)} />}

      {/* Mobile: full slide-in/out overlay. Desktop: always visible, never
          slides -- it collapses to an icon rail instead (see Sidebar's own
          `collapsed` rendering), matching the reference behaviour where the
          panel never fully vanishes on a real desktop layout. */}
      <div className={`fixed md:relative inset-y-0 left-0 z-50 shrink-0 transform transition-transform duration-200 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar
          user={user}
          isGuest={authMode === 'guest'}
          chatList={chatList}
          currentChatId={currentChatId}
          isConnected={isConnected}
          isSpeaking={isSpeaking}
          isListening={isListening}
          isCodeMode={isCodeMode}
          collapsed={!isSidebarOpen}
          onNewChat={handleNewChat}
          onLoadChat={handleLoadChat}
          onDeleteChat={deleteChat}
          onLogout={logout}
          onLogin={login}
          onToggleMic={() => toggleMic((t) => window.dispatchEvent(new CustomEvent('VUXIO-transcript', { detail: t })))}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSetCodeMode={(on) => { setIsCodeMode(on); if (on) setIsWebMode(false); }}
          onOpenConversas={() => setActiveView('conversas')}
          onOpenProjects={() => setActiveView('projects')}
          onToggleCollapse={() => setIsSidebarOpen(o => !o)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative">
        <button
          onClick={() => setIsSettingsOpen(true)}
          title={t('app.settings')}
          className="absolute top-3 right-4 z-20 p-1.5 rounded-md text-white/35 hover:text-white/85 hover:bg-white/[0.06] transition-colors"
        >
          <SettingsIcon size={18} strokeWidth={1.75} />
        </button>

        {activeView === 'conversas' ? (
          <ConversasView chatList={chatList} onLoadChat={handleLoadChat} onDeleteChat={deleteChat} onNewChat={handleNewChat} />
        ) : activeView === 'projects' ? (
          <ProjectsView
            isGuest={authMode === 'guest'}
            projectList={projectList}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
            onSignIn={login}
          />
        ) : !hasMessages ? (
          /* ── Empty state: mark + greeting + composer + starters ── */
          <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-up">
            <div className="w-full max-w-[680px] -mt-12">
              <div className="flex items-center justify-center gap-3 mb-6">
                <img src="/logojanelavuxio.png" alt="" width={34} height={34} className="shrink-0" />
                <h1 className="text-[38px] leading-none text-white/95" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                  {isCodeMode
                    ? t('app.greetingCode')
                    : user?.displayName
                      ? t('app.greetingBack', { name: user.displayName.split(' ')[0] })
                      : t('app.greetingBackNoName')}
                </h1>
              </div>

              {renderComposer(true)}

              <div className="flex items-center justify-center gap-2 flex-wrap mt-4">
                {starters().map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => window.dispatchEvent(new CustomEvent('VUXIO-transcript', { detail: s.prompt }))}
                    className="flex items-center gap-2 px-3 py-[7px] rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-white/75 text-[13px] transition-colors animate-fade-up animate-fade-up-stagger"
                    style={{ '--i': i } as React.CSSProperties}
                  >
                    <span className="text-white/45">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>

              <ComposerNotice isGuest={authMode === 'guest'} />
            </div>
          </div>
        ) : (
          <>
            <main className="flex-1 overflow-y-auto VUXIO-scroll px-6 pt-14 pb-4">
              <div className="max-w-[680px] mx-auto space-y-6">
                {logs.filter(l => l.source !== 'SYSTEM').map((log, idx, arr) => {
                  const isLast      = idx === arr.length - 1;
                  const isLastVuxio = isLast && log.source === 'VUXIO';
                  const isVuxio     = log.source === 'VUXIO';

                  // User turns sit in a bubble on the right; assistant turns are
                  // plain body text, the way a document reads.
                  return (
                    <div key={log.id} className={`group animate-fade-up flex flex-col ${log.source === 'USER' ? 'items-end' : 'items-start'}`}>
                      <div
                        data-ai-generated={isVuxio ? 'true' : undefined}
                        className={
                          log.source === 'USER'
                            ? 'max-w-[80%] px-4 py-2.5 rounded-2xl bg-white/[0.07] text-[14.5px] text-white/90'
                            : 'w-full text-[14.5px] leading-[1.7] text-white/85'
                        }
                      >
                        <Suspense fallback={<span className="whitespace-pre-wrap">{log.text}</span>}>
                          <MarkdownMessage text={log.text} isCodeMode={isCodeMode} />
                        </Suspense>

                        {log.sources && log.sources.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-white/10 text-xs space-y-1">
                            <p className="text-white/40">{t('app.sources')}</p>
                            {log.sources.map(source => (
                              <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[#d97757] hover:underline">
                                {source.title || source.url}
                              </a>
                            ))}
                          </div>
                        )}
                        {log.file && (
                          <FileAttachment file={log.file} isCodeMode={isCodeMode} onOpen={() => setPreviewFile(log.file!)} />
                        )}
                        {isStreaming && isLastVuxio && (
                          <span className="inline-block w-[2px] h-[1em] ml-0.5 align-middle bg-[#d97757]"
                            style={{ animation: 'VUXIO-cursor 0.8s ease-in-out infinite' }} />
                        )}
                      </div>

                      {isVuxio && log.text && (
                        <div className={`flex items-center gap-1 mt-1 transition-opacity ${
                          // The PDF export is the point of a research report --
                          // don't hide it behind a hover the way copy/regenerate are.
                          log.isReport ? '' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          {log.isReport && !isStreaming && (
                            <button
                              onClick={() => openReportPdf(log.text, log.sources, reportQuestion(arr, idx))}
                              className="flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md text-[#d97757] hover:bg-[#d97757]/10 transition-colors"
                            >
                              <FileDown size={12} />
                              {t('app.downloadPdf')}
                            </button>
                          )}
                          <CopyButton text={log.text} />
                          {isLastVuxio && !isLoading && !isStreaming && (
                            <button
                              onClick={() => regenerate(user?.displayName || t('app.defaultUserName'))}
                              className="flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md text-white/35 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                            >
                              <RefreshCw size={12} />
                              {t('app.regenerate')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && !isStreaming && (
                  <div className="flex items-center gap-2 text-[13.5px] animate-fade-up">
                    {researchStep
                      ? <Telescope size={14} className="shrink-0 text-[#d97757]" />
                      : isSearching && <Globe size={14} className="shrink-0 text-white/40" />}
                    <span className={researchStep ? 'text-[#d97757]' : 'text-white/40'}>
                      {researchStep?.detail ?? (isSearching ? t('app.searchingWeb') : t('app.thinking'))}
                    </span>
                    <span className="flex gap-1 items-center">
                      {[0, 1, 2].map(i => (
                        <span key={i} className={`w-1 h-1 rounded-full inline-block ${researchStep ? 'bg-[#d97757]' : 'bg-white/40'}`}
                          style={{ animation: `VUXIO-twinkle 1.1s ease-in-out ${i * 0.22}s infinite` }} />
                      ))}
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </main>

            <div className="px-6 pb-5">
              <div className="max-w-[680px] mx-auto">{renderComposer()}</div>
            </div>
          </>
        )}
      </div>

      {/* File preview panel + click-away backdrop */}
      {previewFile && <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={() => setPreviewFile(null)} />}
      <Suspense fallback={null}>
        <FilePreviewPanel file={previewFile} isCodeMode={isCodeMode} onClose={() => setPreviewFile(null)} />
      </Suspense>

      {/* Settings: a centered modal now (see SettingsPanel), so it owns its
          own backdrop + close-on-click-outside -- no separate overlay here. */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isCodeMode={isCodeMode}
        isGuest={authMode === 'guest'}
        settings={settings}
        onUpdateSettings={updateSettings}
        memories={memories}
        onDeleteMemory={deleteMemory}
        mcpServers={mcpServers}
        onAddMcpServer={addMcpServer}
        onDeleteMcpServer={deleteMcpServer}
        onClearAllChats={handleClearAllChats}
        currentChatLogs={logs}
        maxMemories={maxMemories}
        maxMcpServers={maxMcpServers}
        groqApiKey={groqApiKey}
        onUpdateGroqApiKey={setGroqApiKey}
        groqLimits={groqLimits}
      />
      <style>{`
        @keyframes VUXIO-twinkle { 0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        .VUXIO-scroll::-webkit-scrollbar { width: 4px; }
        .VUXIO-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
        @keyframes VUXIO-cursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default App;
