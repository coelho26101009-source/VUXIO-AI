import React, { useState } from 'react';
import { X, Trash2, Plus, Code2, MessageSquare } from 'lucide-react';
import type { Settings, Memory, McpServer } from '../types';

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
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="px-5 py-5 border-b border-white/5 last:border-b-0">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">{title}</p>
    {children}
  </div>
);

const Toggle: React.FC<{ on: boolean; onChange: () => void; accent: string }> = ({ on, onChange, accent }) => (
  <button
    onClick={onChange}
    className="relative w-10 h-5 rounded-full transition-all duration-300 shrink-0"
    style={{ background: on ? accent : 'rgba(255,255,255,0.1)' }}
  >
    <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300" style={{ left: on ? '20px' : '2px' }} />
  </button>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen, onClose, isCodeMode = false, isGuest,
  settings, onUpdateSettings,
  memories, onDeleteMemory,
  mcpServers, onAddMcpServer, onDeleteMcpServer,
  onClearAllChats, maxMemories, maxMcpServers,
}) => {
  const [clearConfirm, setClearConfirm] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverError, setServerError] = useState('');

  const accent = isCodeMode ? '#16a34a' : '#7c3aed';

  const handleClearAll = () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 2500); return; }
    setClearConfirm(false);
    onClearAllChats();
  };

  const handleAddServer = () => {
    if (!onAddMcpServer(serverName, serverUrl)) {
      setServerError(mcpServers.length >= maxMcpServers ? `Máximo de ${maxMcpServers} servidores.` : 'URL inválido -- tem de começar por http:// ou https://.');
      return;
    }
    setServerName('');
    setServerUrl('');
    setServerError('');
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md transform flex-col border-l backdrop-blur-xl transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${isCodeMode ? 'bg-[#080f0b]/95 border-green-500/10' : 'bg-[#0b0b1a]/95 border-white/10'}`}
    >
      <div className={`flex h-[60px] shrink-0 items-center justify-between px-5 border-b ${isCodeMode ? 'border-green-500/10' : 'border-white/10'}`}>
        <p className="text-sm font-semibold text-white">Definições</p>
        <button onClick={onClose} title="Fechar" className="p-2 text-white/50 hover:text-white/80 transition-colors"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto VUXIO-scroll">
        {isGuest && (
          <div className="mx-5 mt-5 p-3 rounded-xl text-xs leading-relaxed text-white/40" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Em modo convidado, o modo e a temperatura aplicam-se só a esta sessão. Entra com a tua conta para guardares memórias, conectores e definições.
          </div>
        )}

        <Section title="Modo por omissão">
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateSettings({ defaultMode: 'standard' })}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition-colors ${
                settings.defaultMode === 'standard' ? 'text-white' : 'text-white/40 border-white/10 hover:text-white/70'
              }`}
              style={settings.defaultMode === 'standard' ? { background: `${accent}33`, borderColor: `${accent}66` } : undefined}
            >
              <MessageSquare size={13} /> Normal
            </button>
            <button
              onClick={() => onUpdateSettings({ defaultMode: 'code' })}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition-colors ${
                settings.defaultMode === 'code' ? 'text-white' : 'text-white/40 border-white/10 hover:text-white/70'
              }`}
              style={settings.defaultMode === 'code' ? { background: `${accent}33`, borderColor: `${accent}66` } : undefined}
            >
              <Code2 size={13} /> Código
            </button>
          </div>
          <p className="text-[11px] text-white/25 mt-2">Modo em que uma sessão nova começa.</p>
        </Section>

        <Section title="Temperatura">
          <div className="flex items-center gap-3">
            <input
              type="range" min={0} max={1} step={0.1}
              value={settings.temperature}
              onChange={e => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
              className="flex-1 accent-current"
              style={{ color: accent }}
            />
            <span className="text-xs font-mono text-white/50 w-8 text-right">{settings.temperature.toFixed(1)}</span>
          </div>
          <p className="text-[11px] text-white/25 mt-2">Mais baixo: respostas mais previsíveis. Mais alto: mais variadas.</p>
        </Section>

        <Section title="Memória">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-white/70">Usar memórias guardadas</p>
              <p className="text-[11px] text-white/25">Aplica-se ao que guardares com /remember no chat.</p>
            </div>
            <Toggle on={settings.memoryEnabled} onChange={() => onUpdateSettings({ memoryEnabled: !settings.memoryEnabled })} accent={accent} />
          </div>

          {isGuest ? (
            <p className="text-xs text-white/25 text-center py-3">Entra com a tua conta para guardares memórias.</p>
          ) : memories.length === 0 ? (
            <p className="text-xs text-white/25 text-center py-3">Sem memórias guardadas. Escreve "/remember algo" no chat.</p>
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
        </Section>

        <Section title="Conectores MCP">
          <p className="text-[11px] text-white/25 mb-3 leading-relaxed">
            Só servidores MCP remotos (HTTP) são suportados -- um browser não consegue arrancar um servidor MCP local (stdio), e cada pedido corre numa função sem estado, sem sessão persistente entre mensagens.
          </p>

          {isGuest ? (
            <p className="text-xs text-white/25 text-center py-3">Entra com a tua conta para configurares conectores.</p>
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
                    placeholder="Nome (opcional)"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/[0.03] border border-white/10 text-white/80 outline-none focus:border-white/25"
                  />
                  <input
                    value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                    placeholder="https://servidor-mcp.exemplo.com"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/[0.03] border border-white/10 text-white/80 outline-none focus:border-white/25"
                  />
                  {serverError && <p className="text-[11px] text-red-400">{serverError}</p>}
                  <button
                    onClick={handleAddServer}
                    disabled={!serverUrl.trim()}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white/70 border border-white/10 hover:bg-white/5 disabled:opacity-40 transition-colors"
                  >
                    <Plus size={13} /> Adicionar servidor
                  </button>
                </div>
              )}
            </>
          )}
        </Section>

        <Section title="Dados">
          <button
            onClick={handleClearAll}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
              clearConfirm ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-white/40 border-white/10 hover:text-red-400 hover:border-red-500/20'
            }`}
          >
            <Trash2 size={13} /> {clearConfirm ? 'Clica novamente para confirmar' : 'Apagar todas as conversas'}
          </button>
        </Section>
      </div>
    </div>
  );
};
