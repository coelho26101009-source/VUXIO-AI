import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Paperclip, Plus, X, ArrowUp, Mic, AudioLines, Globe,
  ImageUp, Camera, FolderPlus, Github, Sparkles, Blocks, Puzzle, Telescope,
  ChevronRight, ChevronDown, Check,
} from 'lucide-react';
import type { Attachment, SelectableModel } from '../types';
import { t } from '../i18n';

interface InputBarProps {
  onSend: (text: string, attachment: Attachment | null) => void;
  isLoading: boolean;
  isConnected: boolean;
  isCodeMode?: boolean;
  isWebMode?: boolean;
  isResearchMode?: boolean;
  isListening?: boolean;
  isGuest?: boolean;
  /** Empty state renders the notice itself, below the starter chips, so the
   *  chips sit directly under the composer as in the reference layout. */
  hideNotice?: boolean;
  model?: SelectableModel;
  onToggleWeb?: () => void;
  onToggleResearch?: () => void;
  onToggleMic?: () => void;
  onSelectModel?: (model: SelectableModel) => void;
  onOpenSettings?: () => void;
}

// Short labels for the model chip -- the raw ids ("openai/gpt-oss-120b") are
// too long for the toolbar row, and aren't user-facing text worth translating.
const MODEL_LABELS: Record<SelectableModel, string> = {
  'auto': 'Auto',
  'openai/gpt-oss-120b': 'GPT-OSS 120B',
  'openai/gpt-oss-20b': 'GPT-OSS 20B',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-3.7-flash': 'Gemini 3.7 Flash',
  'gemini-3.6-flash': 'Gemini 3.6 Flash',
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
  'nvidia/nemotron-3-ultra-550b-a55b:free': 'Nemotron 3 Ultra',
  'nvidia/nemotron-3-super-120b-a12b:free': 'Nemotron 3 Super',
  'poolside/laguna-s-2.1:free': 'Laguna S 2.1',
  'google/gemma-4-31b-it:free': 'Gemma 4 31B',
  'google/gemma-4-26b-a4b-it:free': 'Gemma 4 26B',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': 'Nemotron 3 Nano Omni',
  'poolside/laguna-xs-2.1:free': 'Laguna XS 2.1',
  'cohere/north-mini-code:free': 'North Mini Code',
  'nvidia/nemotron-3-nano-30b-a3b:free': 'Nemotron 3 Nano',
  'nvidia/nemotron-3.5-lightning:free': 'Nemotron 3.5 Lightning',
  'nvidia/nemotron-nano-12b-v2-vl:free': 'Nemotron Nano 12B VL',
  'nvidia/nemotron-nano-9b-v2:free': 'Nemotron Nano 9B',
  'liquid/lfm-2.5-2.6b:free': 'LFM2.5 2.6B',
  'openai/gpt-oss-20b:free': 'GPT-OSS 20B (OpenRouter)',
};

type HintKey = 'settings.model.auto.hint' | 'settings.model.120b.hint' | 'settings.model.20b.hint'
  | 'settings.model.gemini25Pro.hint' | 'settings.model.gemini37Flash.hint' | 'settings.model.gemini36Flash.hint' | 'settings.model.gemini35FlashLite.hint'
  | 'settings.model.nemotronUltra.hint' | 'settings.model.nemotronSuper.hint' | 'settings.model.lagunaS.hint'
  | 'settings.model.gemma31b.hint' | 'settings.model.gemma26b.hint' | 'settings.model.nemotronOmni.hint'
  | 'settings.model.lagunaXs.hint' | 'settings.model.northMiniCode.hint' | 'settings.model.nemotronNano.hint'
  | 'settings.model.nemotronLightning.hint' | 'settings.model.nemotronNanoVl.hint' | 'settings.model.nemotronNano9b.hint'
  | 'settings.model.lfm26b.hint' | 'settings.model.gptOss20bOpenrouter.hint';

const MODEL_HINTS: Record<Exclude<SelectableModel, 'auto'>, HintKey> = {
  'openai/gpt-oss-120b': 'settings.model.120b.hint',
  'openai/gpt-oss-20b': 'settings.model.20b.hint',
  'gemini-2.5-pro': 'settings.model.gemini25Pro.hint',
  'gemini-3.7-flash': 'settings.model.gemini37Flash.hint',
  'gemini-3.6-flash': 'settings.model.gemini36Flash.hint',
  'gemini-3.5-flash-lite': 'settings.model.gemini35FlashLite.hint',
  'nvidia/nemotron-3-ultra-550b-a55b:free': 'settings.model.nemotronUltra.hint',
  'nvidia/nemotron-3-super-120b-a12b:free': 'settings.model.nemotronSuper.hint',
  'poolside/laguna-s-2.1:free': 'settings.model.lagunaS.hint',
  'google/gemma-4-31b-it:free': 'settings.model.gemma31b.hint',
  'google/gemma-4-26b-a4b-it:free': 'settings.model.gemma26b.hint',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': 'settings.model.nemotronOmni.hint',
  'poolside/laguna-xs-2.1:free': 'settings.model.lagunaXs.hint',
  'cohere/north-mini-code:free': 'settings.model.northMiniCode.hint',
  'nvidia/nemotron-3-nano-30b-a3b:free': 'settings.model.nemotronNano.hint',
  'nvidia/nemotron-3.5-lightning:free': 'settings.model.nemotronLightning.hint',
  'nvidia/nemotron-nano-12b-v2-vl:free': 'settings.model.nemotronNanoVl.hint',
  'nvidia/nemotron-nano-9b-v2:free': 'settings.model.nemotronNano9b.hint',
  'liquid/lfm-2.5-2.6b:free': 'settings.model.lfm26b.hint',
  'openai/gpt-oss-20b:free': 'settings.model.gptOss20bOpenrouter.hint',
};

type ModelTier = 'strong' | 'medium' | 'economy';

/** Tiers span providers (a "Strong" pick is whichever model is actually the
 *  most capable, not "the best Groq one") and only list models confirmed
 *  free -- see GEMINI_MODELS/OPENROUTER_MODELS in api/chat.js for the same
 *  verification these ids were checked against.
 *
 *  gemini-3.7-flash sits in Strong, not Medium, on real benchmarks, not
 *  marketing copy: Google's own post (blog.google, "Introducing Gemini 3
 *  Flash", checked 2026-08-13) puts it at 90.4% GPQA Diamond and 78%
 *  SWE-bench Verified, both above gemini-2.5-pro (86.4% / 63.8%) and above
 *  Gemini 3 Pro on SWE-bench specifically -- cross-checked against
 *  independent aggregators (llm-stats.com, vellum.ai), not Google's claim
 *  alone. gemini-3.6-flash (previous-gen) has no such claim and stays in
 *  Medium. First pass had placed all Flash-named models below Pro-named
 *  ones purely by name, which this generation's benchmarks contradict.
 *
 *  OpenRouter tier placement is still INFERRED from parameter counts and
 *  descriptions on OpenRouter's own model pages (checked 2026-08-13), not
 *  independent benchmarks -- a reasonable-effort ranking, not a verified
 *  capability claim, and the same naming-vs-benchmark mismatch that moved
 *  gemini-3.7-flash could apply to any of them too.
 *
 *  accountOnly is a soft, client-side-only gate -- same pattern Memory and
 *  MCP connectors already use (SettingsPanel's isGuest checks), not a real
 *  security boundary; see ROADMAP.md's "Guest daily limit" entry for why
 *  actual server-side enforcement is deliberately separate, deferred work. */
const MODEL_TIERS: { tier: ModelTier; label: string; accountOnly: boolean; models: Exclude<SelectableModel, 'auto'>[] }[] = [
  {
    tier: 'strong', label: 'Strong', accountOnly: true,
    models: [
      'openai/gpt-oss-120b', 'gemini-2.5-pro', 'gemini-3.7-flash',
      'nvidia/nemotron-3-ultra-550b-a55b:free', 'nvidia/nemotron-3-super-120b-a12b:free',
    ],
  },
  {
    tier: 'medium', label: 'Medium', accountOnly: true,
    models: [
      'gemini-3.6-flash', 'poolside/laguna-s-2.1:free', 'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'poolside/laguna-xs-2.1:free', 'cohere/north-mini-code:free',
    ],
  },
  {
    tier: 'economy', label: 'Economy', accountOnly: false,
    models: [
      'openai/gpt-oss-20b', 'gemini-3.5-flash-lite', 'nvidia/nemotron-3-nano-30b-a3b:free',
      'nvidia/nemotron-3.5-lightning:free', 'nvidia/nemotron-nano-12b-v2-vl:free', 'nvidia/nemotron-nano-9b-v2:free',
      'liquid/lfm-2.5-2.6b:free', 'openai/gpt-oss-20b:free',
    ],
  },
];
const ALL_TIER_MODELS = MODEL_TIERS.flatMap(({ tier, accountOnly, models }) => models.map(value => ({ value, accountOnly, tier })));

type FilterView = 'root' | ModelTier | 'all';

/** Art. 50(1) AI Act: visible disclosure that replies are AI-generated.
 *  GDPR (Art. 13/14): where the conversation ends up -- signed-in and guest
 *  behaviour genuinely differ (useChat.ts skips the Firestore write when
 *  there's no uid), so the text must too. Exported because the empty state
 *  places it below the starter chips rather than directly under the composer. */
export const ComposerNotice: React.FC<{ isGuest: boolean }> = ({ isGuest }) => (
  <p className="text-center text-[11.5px] mt-2 text-white/25">
    {t('input.notice.disclosure')}
    {' · '}
    {isGuest ? t('input.notice.guest') : t('input.notice.account')}
  </p>
);

/** One row of the "+" menu. `submenu` only draws the affordance -- the nested
 *  panels don't exist yet, so those rows report "em breve" like the rest. */
const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  submenu?: boolean;
  checked?: boolean;
  onClick: () => void;
}> = ({ icon, label, shortcut, submenu, checked, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] text-white/80 hover:bg-white/[0.07] transition-colors"
  >
    <span className="shrink-0 text-white/55">{icon}</span>
    <span className="flex-1 text-left truncate">{label}</span>
    {shortcut && <span className="shrink-0 text-[11.5px] text-white/30">{shortcut}</span>}
    {submenu && <ChevronRight size={14} className="shrink-0 text-white/35" />}
    {checked && <Check size={14} className="shrink-0 text-[#d97757]" />}
  </button>
);

export const InputBar: React.FC<InputBarProps> = ({
  onSend, isLoading, isConnected,
  isCodeMode = false, isWebMode = false, isResearchMode = false, isListening = false, isGuest = false,
  hideNotice = false,
  model = 'auto', onToggleWeb, onToggleResearch, onToggleMic, onSelectModel, onOpenSettings,
}) => {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelFilterView, setModelFilterView] = useState<FilterView>('root');
  const closeModelMenu = () => { setModelMenuOpen(false); setModelFilterView('root'); };
  const [soon, setSoon] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const canSend = (text.trim().length > 0 || attachment !== null) && !isLoading && isConnected;

// Extensions read as plain text (source code + common text formats) rather than
// sent as an image -- browsers often report an empty or generic mimeType for
// these (e.g. .py as ''), so extension is the reliable signal, with a mimeType
// fallback for text files outside this list.
const TEXT_EXTENSIONS = new Set([
  'c', 'h', 'cpp', 'hpp', 'cc', 'cxx', 'py', 'js', 'jsx', 'ts', 'tsx', 'java',
  'go', 'rs', 'rb', 'php', 'sh', 'bash', 'json', 'yaml', 'yml', 'toml', 'xml',
  'html', 'htm', 'css', 'md', 'txt', 'sql', 'lua', 'pl', 'swift', 'kt', 'cs',
  'asm', 's', 'csv', 'ini', 'cfg', 'log',
]);
const isTextFile = (file: File) => {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  return TEXT_EXTENSIONS.has(ext) || file.type.startsWith('text/');
};

// Explicit extensions, not `image/*` / `text/*` wildcards: Linux's native file
// picker (GTK, via the portal Chromium/Electron use) turns each wildcard MIME
// group into its own named filter ("Images", "Text") and defaults the dialog
// to the first one -- so .c/.py files were hidden behind a manual switch to
// "All Files". Listing extensions directly keeps it a single combined filter.
const IMAGE_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg';
const CODE_EXTENSIONS = [...TEXT_EXTENSIONS].map(ext => `.${ext}`).join(',');

  // Listen for mic transcript
  useEffect(() => {
    const handler = (e: Event) => {
      const transcript = (e as CustomEvent<string>).detail;
      setText(prev => prev ? `${prev} ${transcript}` : transcript);
      textareaRef.current?.focus();
    };
    window.addEventListener('VUXIO-transcript', handler);
    return () => window.removeEventListener('VUXIO-transcript', handler);
  }, []);

  // Close the "+" menu on outside click or Escape, and wire the Ctrl+U
  // shortcut the menu advertises.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) closeModelMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); closeModelMenu(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        fileRef.current?.click();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const comingSoon = (label: string) => {
    setMenuOpen(false);
    setSoon(label);
    setTimeout(() => setSoon(null), 2000);
  };

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim(), attachment);
    setText('');
    setAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [canSend, text, attachment, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert(t('input.fileTooLarge'));
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      alert(t('input.fileReadError'));
      setAttachment(null);
    };
    if (isTextFile(file)) {
      reader.onload = ev => setAttachment({ file, base64: '', text: ev.target?.result as string });
      reader.readAsText(file);
    } else {
      reader.onload = ev => {
        const base64 = (ev.target?.result as string).split(',')[1];
        setAttachment({ file, base64 });
      };
      reader.readAsDataURL(file);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="w-full">
      {attachment && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04]">
          <Paperclip size={13} className="text-white/40 shrink-0" />
          <span className="text-xs text-white/60 truncate">{attachment.file.name}</span>
          <button onClick={() => setAttachment(null)} className="ml-auto text-white/30 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.09] bg-[#2b2926] px-3 pt-3 pb-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!isConnected || isLoading}
          placeholder={
            !isConnected ? t('input.connecting') :
            isLoading ? t('input.thinking') :
            t('input.placeholder')
          }
          className="w-full bg-transparent border-none outline-none resize-none text-[14.5px] leading-relaxed px-1 pb-2"
          style={{ color: '#f5f4ef', minHeight: '26px', maxHeight: '200px' }}
        />

        {/* Toolbar row */}
        <div className="flex items-center gap-2">
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              title={t('input.add')}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                menuOpen ? 'text-white bg-white/[0.09]' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.07]'
              }`}
            >
              <Plus size={17} strokeWidth={2} />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-[304px] rounded-xl border border-white/10 bg-[#302e2b] py-1.5 shadow-2xl z-30 animate-menu-pop-up">
                <MenuItem
                  icon={<ImageUp size={15} strokeWidth={1.75} />}
                  label={t('input.addFiles')}
                  shortcut="Ctrl+U"
                  onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}
                />
                <MenuItem icon={<Camera size={15} strokeWidth={1.75} />} label={t('input.screenshot')} onClick={() => comingSoon(t('input.screenshot'))} />
                <MenuItem icon={<FolderPlus size={15} strokeWidth={1.75} />} label={t('input.addToProject')} submenu onClick={() => comingSoon(t('input.addToProject'))} />
                <MenuItem icon={<Github size={15} strokeWidth={1.75} />} label={t('input.addFromGithub')} onClick={() => comingSoon(t('input.addFromGithub'))} />

                <div className="h-px bg-white/[0.08] my-1.5" />

                <MenuItem icon={<Sparkles size={15} strokeWidth={1.75} />} label={t('input.skills')} submenu onClick={() => comingSoon(t('input.skills'))} />
                <MenuItem
                  icon={<Blocks size={15} strokeWidth={1.75} />}
                  label={t('input.addConnector')}
                  submenu
                  onClick={() => { setMenuOpen(false); onOpenSettings?.(); }}
                />
                <MenuItem icon={<Puzzle size={15} strokeWidth={1.75} />} label={t('input.plugins')} submenu onClick={() => comingSoon(t('input.plugins'))} />

                <div className="h-px bg-white/[0.08] my-1.5" />

                <MenuItem
                  icon={<Telescope size={15} strokeWidth={1.75} />}
                  label={t('input.research')}
                  checked={isResearchMode}
                  onClick={() => { setMenuOpen(false); onToggleResearch?.(); }}
                />
                <MenuItem
                  icon={<Globe size={15} strokeWidth={1.75} />}
                  label={t('input.webSearch')}
                  checked={isWebMode}
                  onClick={() => { setMenuOpen(false); onToggleWeb?.(); }}
                />
              </div>
            )}

            {soon && (
              <div className="absolute bottom-full left-0 mb-2 px-3 py-1.5 rounded-lg bg-[#3a3733] text-[12.5px] text-white/85 whitespace-nowrap shadow-lg z-30">
                {t('common.comingSoon', { label: soon })}
              </div>
            )}
          </div>

          <button
            onClick={onToggleWeb}
            title={isWebMode ? t('input.webSearchOn') : t('input.webSearchOff')}
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              isWebMode ? 'text-[#d97757] bg-white/[0.07]' : 'text-white/40 hover:text-white/75 hover:bg-white/[0.07]'
            }`}
          >
            <Globe size={15} strokeWidth={1.75} />
          </button>

          {/* Research is slow and expensive compared to a normal turn, so it
              stays visible in the toolbar once armed rather than only being
              discoverable back inside the "+" menu. */}
          {isResearchMode && (
            <button
              onClick={onToggleResearch}
              title={t('input.researchOff')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md shrink-0 text-[12.5px] text-[#d97757] bg-[#d97757]/10 transition-colors"
            >
              <Telescope size={14} strokeWidth={1.75} />
              {t('input.research')}
            </button>
          )}

          <div className="flex-1" />

          <div className="relative shrink-0" ref={modelMenuRef}>
            <button
              onClick={() => setModelMenuOpen(o => !o)}
              title={t('input.chooseModel')}
              className="flex items-center gap-1 text-[12.5px] text-white/70 hover:text-white transition-colors"
            >
              {MODEL_LABELS[model]}
              <ChevronDown size={13} className={`transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} style={{ transitionDuration: 'var(--dur-micro)' }} />
            </button>

            {modelMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-[260px] max-h-[320px] overflow-y-auto VUXIO-scroll rounded-xl border border-white/10 bg-[#302e2b] py-1.5 shadow-2xl z-30 animate-menu-pop-up">
                {modelFilterView === 'root' ? (
                  <>
                    <button
                      onClick={() => { onSelectModel?.('auto'); closeModelMenu(); }}
                      className="w-full flex items-center gap-2 px-3 py-[7px] text-left hover:bg-white/[0.07] transition-colors"
                    >
                      <p className="flex-1 text-[13px] text-white/90">{MODEL_LABELS.auto}</p>
                      {model === 'auto' && <Check size={14} className="shrink-0 text-[#d97757]" />}
                    </button>
                    <div className="my-1.5 border-t border-white/[0.07]" />
                    <p className="px-3 pb-1 text-[10.5px] uppercase tracking-wide text-white/30">{t('input.model.filterBy')}</p>
                    {MODEL_TIERS.map(({ tier, label, accountOnly }) => (
                      <button
                        key={tier}
                        onClick={() => setModelFilterView(tier)}
                        className="w-full flex items-center gap-2 px-3 py-[7px] text-left hover:bg-white/[0.07] transition-colors"
                      >
                        <span className="flex-1 text-[13px] text-white/90">
                          {label}
                          {accountOnly && <span className="ml-1.5 text-[10.5px] text-white/30">{t('input.model.accountOnlyBadge')}</span>}
                        </span>
                        <ChevronRight size={13} className="shrink-0 text-white/30" />
                      </button>
                    ))}
                    <button
                      onClick={() => setModelFilterView('all')}
                      className="w-full flex items-center gap-2 px-3 py-[7px] text-left hover:bg-white/[0.07] transition-colors"
                    >
                      <span className="flex-1 text-[13px] text-white/90">{t('input.model.all')}</span>
                      <ChevronRight size={13} className="shrink-0 text-white/30" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setModelFilterView('root')}
                      className="w-full flex items-center gap-1.5 px-3 pb-1.5 text-left text-[11px] text-white/40 hover:text-white/70 transition-colors"
                    >
                      <ChevronRight size={12} className="rotate-180" />
                      {t('input.model.back')}
                    </button>
                    {(() => {
                      const currentTier = MODEL_TIERS.find(entry => entry.tier === modelFilterView);
                      const rows = modelFilterView === 'all' || !currentTier
                        ? ALL_TIER_MODELS
                        : currentTier.models.map(value => ({ value, accountOnly: currentTier.accountOnly, tier: currentTier.tier }));
                      return rows.map(({ value, accountOnly }) => {
                        const locked = accountOnly && isGuest;
                        return (
                          <button
                            key={value}
                            disabled={locked}
                            onClick={() => { if (locked) return; onSelectModel?.(value); closeModelMenu(); }}
                            className={`w-full flex items-start gap-2 px-3 py-[7px] text-left transition-colors ${locked ? 'cursor-default opacity-50' : 'hover:bg-white/[0.07]'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-white/90">{MODEL_LABELS[value]}</p>
                              <p className="text-[11px] text-white/40 mt-0.5">{locked ? t('input.model.accountOnlyNotice') : t(MODEL_HINTS[value])}</p>
                            </div>
                            {!locked && model === value && <Check size={14} className="shrink-0 text-[#d97757] mt-0.5" />}
                          </button>
                        );
                      });
                    })()}
                  </>
                )}
              </div>
            )}
          </div>

          {canSend ? (
            <button
              onClick={handleSend}
              title={t('input.send')}
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#d97757] text-[#2a1a12] hover:bg-[#e08865] transition-[background-color,transform] hover:-translate-y-px active:translate-y-0"
              style={{ transitionDuration: 'var(--dur-micro)', transitionTimingFunction: 'var(--ease-out)' }}
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          ) : (
            <>
              <button
                onClick={onToggleMic}
                title={isListening ? t('input.dictateOff') : t('input.dictateOn')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isListening ? 'text-red-400 bg-white/[0.07]' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.07]'
                }`}
              >
                <Mic size={15} strokeWidth={1.75} />
              </button>
              <button
                onClick={onToggleMic}
                title={t('input.voiceMode')}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white/45 hover:text-white/85 hover:bg-white/[0.07] transition-colors"
              >
                <AudioLines size={15} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      </div>

      {!hideNotice && <ComposerNotice isGuest={isGuest} />}

      <input
        ref={fileRef}
        type="file"
        accept={isCodeMode ? `${IMAGE_EXTENSIONS},.pdf,${CODE_EXTENSIONS}` : `${IMAGE_EXTENSIONS},${CODE_EXTENSIONS}`}
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
};
