import React, { useState } from 'react';
import {
  X, Trash2, Plus, Code2, MessageSquare, SlidersHorizontal, Brain, Blocks,
  Download, Keyboard, ShieldCheck, KeyRound,
} from 'lucide-react';
import type { Settings, Memory, McpServer, LogMessage, GroqLimits } from '../types';
import { t } from '../i18n';
import { downloadFile } from '../hooks/useChat';
import { chatToJson, chatToMarkdown } from '../utils/exportChat';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isCodeMode?: boolean;
  isGuest: boolean;
  settings: Settings;
  onUpdateSettings: (partial: Partial<Settings>) => void;
  memories: Memory[];
  onDeleteMemory: (id: string) => void;
  mcpServers: McpServer[];
  onAddMcpServer: (name: string, url: string) => boolean;
  onDeleteMcpServer: (id: string) => void;
  onClearAllChats: () => void;
  maxMemories: number;
  maxMcpServers: number;
  currentChatLogs: LogMessage[];
  groqApiKey: string;
  onUpdateGroqApiKey: (key: string) => void;
  groqLimits: GroqLimits | null;
}

type Tab = 'general' | 'memory' | 'connectors' | 'export' | 'shortcuts' | 'advanced' | 'privacy';

// Groq's reset headers arrive already converted to seconds by the backend
// (see parseGroqResetDuration in api/chat.js) -- this just picks a human unit.
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const totalMinutes = Math.ceil(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

const Toggle: React.FC<{ on: boolean; onChange: () => void; accent: string }> = ({ on, onChange, accent }) => (
  <button
    onClick={onChange}
    className="relative w-10 h-5 rounded-full transition-colors shrink-0"
    style={{ background: on ? accent : 'rgba(255,255,255,0.1)', transitionDuration: 'var(--dur-short)' }}
  >
    {/* transform, not `left` -- animating a layout property here was a slop-test
        gate 14 violation (see hallmark/references/motion.md § Bans). */}
    <span
      className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
      style={{ transform: on ? 'translateX(18px)' : 'translateX(0)', transitionDuration: 'var(--dur-short)', transitionTimingFunction: 'var(--ease-in-out)' }}
    />
  </button>
);

const TabButton: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-colors ${
      active ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:text-white/85 hover:bg-white/[0.04]'
    }`}
  >
    <span className="shrink-0">{icon}</span>
    {label}
  </button>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen, onClose, isCodeMode = false, isGuest,
  settings, onUpdateSettings,
  memories, onDeleteMemory,
  mcpServers, onAddMcpServer, onDeleteMcpServer,
  onClearAllChats, maxMemories, maxMcpServers,
  currentChatLogs,
  groqApiKey, onUpdateGroqApiKey, groqLimits,
}) => {
  const [tab, setTab] = useState<Tab>('general');
  const [clearConfirm, setClearConfirm] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverError, setServerError] = useState('');

  if (!isOpen) return null;

  const accent = isCodeMode ? '#6b9080' : '#d97757';
  const hasChat = currentChatLogs.filter(l => l.source !== 'SYSTEM').length > 0;

  const handleClearAll = () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 2500); return; }
    setClearConfirm(false);
    onClearAllChats();
  };

  const handleAddServer = () => {
    if (!onAddMcpServer(serverName, serverUrl)) {
      setServerError(mcpServers.length >= maxMcpServers ? t('settings.mcp.maxServers', { max: maxMcpServers }) : t('settings.mcp.invalidUrl'));
      return;
    }
    setServerName('');
    setServerUrl('');
    setServerError('');
  };

  const exportJson = () => downloadFile('vuxio-chat.json', chatToJson(currentChatLogs));
  const exportMarkdown = () => downloadFile('vuxio-chat.md', chatToMarkdown(currentChatLogs));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl h-[560px] max-h-[85vh] flex rounded-2xl border border-white/10 bg-[#211f1d] overflow-hidden animate-menu-pop-down"
        style={{ transformOrigin: 'center' }}
      >
        {/* ── Tab rail ── */}
        <div className="w-[190px] shrink-0 border-r border-white/[0.07] p-3 flex flex-col">
          <p className="px-3 pt-1 pb-3 text-sm font-semibold text-white">{t('settings.title')}</p>
          <TabButton icon={<SlidersHorizontal size={15} strokeWidth={1.75} />} label={t('settings.tabs.general')} active={tab === 'general'} onClick={() => setTab('general')} />
          <TabButton icon={<Brain size={15} strokeWidth={1.75} />} label={t('settings.tabs.memory')} active={tab === 'memory'} onClick={() => setTab('memory')} />
          <TabButton icon={<Blocks size={15} strokeWidth={1.75} />} label={t('settings.tabs.connectors')} active={tab === 'connectors'} onClick={() => setTab('connectors')} />
          <TabButton icon={<Download size={15} strokeWidth={1.75} />} label={t('settings.tabs.export')} active={tab === 'export'} onClick={() => setTab('export')} />
          <TabButton icon={<Keyboard size={15} strokeWidth={1.75} />} label={t('settings.tabs.shortcuts')} active={tab === 'shortcuts'} onClick={() => setTab('shortcuts')} />
          <TabButton icon={<KeyRound size={15} strokeWidth={1.75} />} label={t('settings.tabs.advanced')} active={tab === 'advanced'} onClick={() => setTab('advanced')} />
          <TabButton icon={<ShieldCheck size={15} strokeWidth={1.75} />} label={t('settings.tabs.privacy')} active={tab === 'privacy'} onClick={() => setTab('privacy')} />
        </div>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-end px-4 py-3 border-b border-white/[0.07] shrink-0">
            <button onClick={onClose} title={t('settings.close')} className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto VUXIO-scroll px-5 py-5">
            {/* Only where account-vs-guest actually changes behaviour --
                Export/Shortcuts/Privacy work identically either way. */}
            {isGuest && (tab === 'general' || tab === 'memory' || tab === 'connectors') && (
              <div className="mb-5 p-3 rounded-xl text-xs leading-relaxed text-white/40" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {t('settings.guestNotice')}
              </div>
            )}

            {tab === 'general' && (
              <div className="space-y-6">
                <div>
                  <p className="text-[13px] font-medium text-white/85 mb-2">{t('settings.defaultMode.title')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onUpdateSettings({ defaultMode: 'standard' })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        settings.defaultMode === 'standard' ? 'text-white' : 'text-white/40 border-white/10 hover:text-white/70'
                      }`}
                      style={settings.defaultMode === 'standard' ? { background: `${accent}33`, borderColor: `${accent}66` } : undefined}
                    >
                      <MessageSquare size={13} /> {t('settings.defaultMode.normal')}
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ defaultMode: 'code' })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        settings.defaultMode === 'code' ? 'text-white' : 'text-white/40 border-white/10 hover:text-white/70'
                      }`}
                      style={settings.defaultMode === 'code' ? { background: `${accent}33`, borderColor: `${accent}66` } : undefined}
                    >
                      <Code2 size={13} /> {t('settings.defaultMode.code')}
                    </button>
                  </div>
                  <p className="text-[11px] text-white/25 mt-2">{t('settings.defaultMode.hint')}</p>
                </div>

                <div>
                  <p className="text-[13px] font-medium text-white/85 mb-2">{t('settings.temperature.title')}</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={1} step={0.1}
                      value={isCodeMode ? 0.3 : settings.temperature}
                      onChange={e => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
                      disabled={isCodeMode}
                      className="flex-1 accent-current disabled:opacity-40"
                      style={{ color: accent }}
                    />
                    <span className="text-xs font-mono text-white/50 w-8 text-right">{(isCodeMode ? 0.3 : settings.temperature).toFixed(1)}</span>
                  </div>
                  <p className="text-[11px] text-white/25 mt-2">
                    {isCodeMode ? t('settings.temperature.codeHint') : t('settings.temperature.hint')}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/[0.07]">
                  <p className="text-[13px] font-medium text-white/85 mb-2">{t('settings.data.title')}</p>
                  <button
                    onClick={handleClearAll}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                      clearConfirm ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-white/40 border-white/10 hover:text-red-400 hover:border-red-500/20'
                    }`}
                  >
                    <Trash2 size={13} /> {clearConfirm ? t('common.confirmDelete') : t('settings.data.clearAll')}
                  </button>
                </div>
              </div>
            )}

            {tab === 'memory' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] font-medium text-white/85">{t('settings.memory.use')}</p>
                    <p className="text-[11px] text-white/25">{t('settings.memory.hint')}</p>
                  </div>
                  <Toggle on={settings.memoryEnabled} onChange={() => onUpdateSettings({ memoryEnabled: !settings.memoryEnabled })} accent={accent} />
                </div>

                {isGuest ? (
                  <p className="text-xs text-white/25 text-center py-6">{t('settings.memory.needAccount')}</p>
                ) : memories.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-6">{t('settings.memory.empty')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {memories.map(memory => (
                      <div key={memory.id} className="group flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <p className="flex-1 text-xs text-white/60 leading-relaxed break-words">{memory.text}</p>
                        <button onClick={() => onDeleteMemory(memory.id)} className="shrink-0 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <p className="text-[10px] text-white/20 text-right pt-1">{memories.length} / {maxMemories}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'connectors' && (
              <div>
                <p className="text-[11px] text-white/25 mb-4 leading-relaxed">{t('settings.mcp.body')}</p>

                {isGuest ? (
                  <p className="text-xs text-white/25 text-center py-6">{t('settings.mcp.needAccount')}</p>
                ) : (
                  <>
                    {mcpServers.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {mcpServers.map(server => (
                          <div key={server.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white/70 truncate">{server.name}</p>
                              <p className="text-[10px] text-white/25 truncate">{server.url}</p>
                            </div>
                            <button onClick={() => onDeleteMcpServer(server.id)} className="shrink-0 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {mcpServers.length < maxMcpServers && (
                      <div className="space-y-2">
                        <input
                          value={serverName} onChange={e => setServerName(e.target.value)}
                          placeholder={t('settings.mcp.namePlaceholder')}
                          className="w-full px-3 py-2 rounded-lg text-xs bg-white/[0.03] border border-white/10 text-white/80 outline-none focus:border-white/25"
                        />
                        <input
                          value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                          placeholder={t('settings.mcp.urlPlaceholder')}
                          className="w-full px-3 py-2 rounded-lg text-xs bg-white/[0.03] border border-white/10 text-white/80 outline-none focus:border-white/25"
                        />
                        {serverError && <p className="text-[11px] text-red-400">{serverError}</p>}
                        <button
                          onClick={handleAddServer}
                          disabled={!serverUrl.trim()}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white/70 border border-white/10 hover:bg-white/5 disabled:opacity-40 transition-colors"
                        >
                          <Plus size={13} /> {t('settings.mcp.add')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'export' && (
              <div>
                <p className="text-[13px] font-medium text-white/85 mb-1">{t('settings.export.title')}</p>
                <p className="text-[11px] text-white/25 mb-4 leading-relaxed">{t('settings.export.body')}</p>
                {hasChat ? (
                  <div className="space-y-2">
                    <button onClick={exportJson} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white/70 border border-white/10 hover:bg-white/5 transition-colors">
                      <Download size={13} /> {t('settings.export.json')}
                    </button>
                    <button onClick={exportMarkdown} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white/70 border border-white/10 hover:bg-white/5 transition-colors">
                      <Download size={13} /> {t('settings.export.markdown')}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-white/25 text-center py-6">{t('settings.export.empty')}</p>
                )}
              </div>
            )}

            {tab === 'shortcuts' && (
              <div className="space-y-1">
                {[
                  ['settings.shortcuts.send', 'settings.shortcuts.sendKeys'],
                  ['settings.shortcuts.newline', 'settings.shortcuts.newlineKeys'],
                  ['settings.shortcuts.upload', 'settings.shortcuts.uploadKeys'],
                  ['settings.shortcuts.closeMenu', 'settings.shortcuts.closeMenuKeys'],
                ].map(([labelKey, keysKey]) => (
                  <div key={labelKey} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-xs text-white/70">{t(labelKey as Parameters<typeof t>[0])}</span>
                    <kbd className="text-[11px] font-mono text-white/50 px-2 py-1 rounded border border-white/10">{t(keysKey as Parameters<typeof t>[0])}</kbd>
                  </div>
                ))}
              </div>
            )}

            {tab === 'advanced' && (
              <div className="space-y-6">
                <div>
                  <p className="text-[13px] font-medium text-white/85 mb-2">{t('settings.advanced.apiKey.title')}</p>
                  <p className="text-[11px] text-white/25 mb-3 leading-relaxed">{t('settings.advanced.apiKey.body')}</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={groqApiKey}
                      onChange={e => onUpdateGroqApiKey(e.target.value)}
                      placeholder={t('settings.advanced.apiKey.placeholder')}
                      autoComplete="off"
                      spellCheck={false}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs font-mono bg-white/[0.03] border border-white/10 text-white/80 outline-none focus:border-white/25"
                    />
                    {groqApiKey && (
                      <button
                        onClick={() => onUpdateGroqApiKey('')}
                        className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium text-white/40 border border-white/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                      >
                        {t('settings.advanced.apiKey.clear')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.07]">
                  <p className="text-[13px] font-medium text-white/85 mb-2">{t('settings.advanced.limits.title')}</p>
                  {groqLimits?.limitRequests !== undefined && groqLimits?.remainingRequests !== undefined ? (
                    <>
                      <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, ((groqLimits.limitRequests - groqLimits.remainingRequests) / groqLimits.limitRequests) * 100))}%`,
                            background: accent,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-white/40">{groqLimits.remainingRequests} / {groqLimits.limitRequests}</span>
                        {groqLimits.resetRequestsSeconds !== undefined && (
                          <span className="text-[11px] text-white/25">{t('settings.advanced.limits.resetsIn', { time: formatDuration(groqLimits.resetRequestsSeconds) })}</span>
                        )}
                      </div>
                      {groqLimits.remainingTokens !== undefined && (
                        <p className="text-[11px] text-white/25 mt-2">{t('settings.advanced.limits.tokens', { n: groqLimits.remainingTokens })}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-white/25 text-center py-4">{t('settings.advanced.limits.empty')}</p>
                  )}
                </div>
              </div>
            )}

            {tab === 'privacy' && (
              <div className="space-y-4">
                <p className="text-[13px] leading-relaxed text-white/70">{isGuest ? t('settings.privacy.guest') : t('settings.privacy.account')}</p>
                <a
                  href="https://github.com/coelho26101009-source/VUXIO-AI/blob/main/PRIVACY.md"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-block text-[12.5px] text-[#d97757] hover:underline"
                >
                  {t('settings.privacy.link')}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
