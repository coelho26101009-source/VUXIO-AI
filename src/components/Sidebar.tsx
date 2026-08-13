import React, { useState } from 'react';
import {
  Plus, MessageSquare, LogOut, LogIn, Mic, MicOff, Trash2,
  PanelLeft, Search, Home, Code2, Folder,
  ChevronDown,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Chat } from '../types';
import { t } from '../i18n';

const ChatItem: React.FC<{
  chat: Chat;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
}> = ({ chat, isActive, onLoad, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2500);
    }
  };

  return (
    <div
      className={`group flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
      }`}
      onClick={onLoad}
    >
      <MessageSquare size={15} className="shrink-0 text-white/35" strokeWidth={1.75} />
      <span className={`flex-1 text-[13.5px] truncate ${isActive ? 'text-white/90' : 'text-white/65'}`}>
        {chat.title}
      </span>
      <button
        onClick={handleDelete}
        className={`shrink-0 p-0.5 rounded transition-opacity opacity-0 group-hover:opacity-100 ${
          confirmDelete ? 'text-red-400 opacity-100' : 'text-white/30 hover:text-red-400'
        }`}
        title={confirmDelete ? t('common.confirmDelete') : t('sidebar.deleteChat')}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};

/** Sidebar row shared by the nav list -- one shape for both wired and
 *  not-yet-built destinations, so adding the real feature later is a
 *  matter of swapping onClick, not restyling the row. */
const NavRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors"
  >
    <span className="shrink-0 text-white/45">{icon}</span>
    <span className="text-[13.5px]">{label}</span>
  </button>
);

/** One icon in the collapsed rail. Same role as NavRow, square footprint. */
const RailButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon, title, active, onClick }) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
      active ? 'text-white bg-white/[0.09]' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.06]'
    }`}
  >
    {icon}
  </button>
);

interface SidebarProps {
  user: User | null;
  isGuest: boolean;
  chatList: Chat[];
  currentChatId: string | null;
  isConnected: boolean;
  isListening: boolean;
  isCodeMode?: boolean;
  collapsed?: boolean;
  onNewChat: () => void;
  onLoadChat: (chat: Chat) => void;
  onDeleteChat: (id: string) => void;
  onLogout: () => void;
  onLogin: () => void;
  onToggleMic: () => void;
  onOpenSettings: () => void;
  onSetCodeMode: (on: boolean) => void;
  onOpenConversas: () => void;
  onOpenProjects: () => void;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user, isGuest, chatList, currentChatId,
  isListening, isCodeMode = false, collapsed = false,
  onNewChat, onLoadChat, onDeleteChat, onLogout, onLogin, onToggleMic,
  onOpenSettings, onSetCodeMode, onOpenConversas, onOpenProjects, onToggleCollapse,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Code mode needs a project for its file context (see useProjects) -- a
  // guest can't create one, so the toggle is disabled rather than hidden:
  // hiding it would look like the feature doesn't exist, disabling it with
  // a tooltip tells a guest exactly why and what unlocks it.
  const codeModeLocked = isGuest;

  if (collapsed) {
    return (
      <aside className="w-[64px] shrink-0 h-full flex flex-col items-center bg-[#211f1d] py-3.5 gap-1">
        <RailButton icon={<PanelLeft size={17} strokeWidth={1.75} />} title={t('sidebar.expandPanel')} onClick={onToggleCollapse ?? (() => {})} />
        <div className="h-2" />
        <RailButton icon={<Plus size={18} strokeWidth={2} />} title={t('sidebar.new')} onClick={onNewChat} />
        <RailButton icon={<MessageSquare size={16} strokeWidth={1.75} />} title={t('sidebar.nav.conversas')} onClick={onOpenConversas} />
        <RailButton icon={<Folder size={16} strokeWidth={1.75} />} title={t('sidebar.nav.projetos')} onClick={onOpenProjects} />
        <div className="h-2" />
        <RailButton
          icon={<Code2 size={16} strokeWidth={1.75} />}
          title={codeModeLocked ? t('projects.needAccount') : t('sidebar.code')}
          active={isCodeMode}
          onClick={() => (codeModeLocked ? onOpenProjects() : onSetCodeMode(!isCodeMode))}
        />

        <div className="flex-1" />

        <RailButton
          icon={isListening ? <Mic size={16} className="text-red-400" /> : <MicOff size={16} strokeWidth={1.75} />}
          title={isListening ? t('sidebar.micOn') : t('sidebar.micOff')}
          onClick={onToggleMic}
        />
        <button
          onClick={user ? onLogout : onLogin}
          title={user?.displayName ?? t('sidebar.guest')}
          className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[12px] font-semibold text-[#2a1a12] overflow-hidden mt-1"
          style={{ background: '#d97757' }}
        >
          {user?.photoURL
            ? <img src={user.photoURL} className="w-full h-full object-cover" alt="" />
            : (user?.displayName?.charAt(0) ?? 'C')}
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[288px] shrink-0 h-full flex flex-col bg-[#211f1d] relative">
      {/* ── Wordmark ── */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3">
        <span className="text-[21px] leading-none text-white/95" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
          {t('sidebar.wordmark')}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={onToggleCollapse} title={t('sidebar.closePanel')} className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors">
            <PanelLeft size={17} strokeWidth={1.75} />
          </button>
          <button title={t('sidebar.search')} className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors">
            <Search size={17} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── Home / Código tabs ── */}
      <div className="px-3 pb-2.5">
        <div className="flex gap-1.5">
          <button
            onClick={() => onSetCodeMode(false)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-lg text-[13.5px] transition-colors ${
              !isCodeMode ? 'bg-white/[0.09] text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
            }`}
          >
            <Home size={15} strokeWidth={1.75} />
            {t('sidebar.home')}
          </button>
          <button
            onClick={() => (codeModeLocked ? onOpenProjects() : onSetCodeMode(true))}
            title={codeModeLocked ? t('projects.needAccount') : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-lg text-[13.5px] transition-colors ${
              isCodeMode ? 'bg-white/[0.09] text-white' : codeModeLocked ? 'text-white/25 hover:text-white/40' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
            }`}
          >
            <Code2 size={15} strokeWidth={1.75} />
            {t('sidebar.code')}
          </button>
        </div>
      </div>

      {/* ── New ── */}
      <div className="px-3 pb-1">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg bg-white/[0.07] hover:bg-white/[0.11] text-white text-[13.5px] transition-[background-color,transform] hover:-translate-y-px active:translate-y-0"
          style={{ transitionDuration: 'var(--dur-micro)', transitionTimingFunction: 'var(--ease-out)' }}
        >
          <Plus size={16} strokeWidth={2} />
          {t('sidebar.new')}
        </button>
      </div>

      {/* ── Nav ── */}
      <div className="px-3 pt-1">
        <NavRow icon={<MessageSquare size={15} strokeWidth={1.75} />} label={t('sidebar.nav.conversas')} onClick={onOpenConversas} />
        <NavRow icon={<Folder size={15} strokeWidth={1.75} />} label={t('sidebar.nav.projetos')} onClick={onOpenProjects} />
      </div>

      {/* ── Recentes ── */}
      <div className="px-3 pt-5 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-2.5 mb-1">
          <span className="text-[12.5px] text-white/40">{t('sidebar.recent')}</span>
        </div>

        <div className="flex-1 overflow-y-auto VUXIO-scroll -mx-0.5 px-0.5">
          {user && chatList.map(chat => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={currentChatId === chat.id}
              onLoad={() => onLoadChat(chat)}
              onDelete={() => onDeleteChat(chat.id)}
            />
          ))}

          {isGuest && (
            <button
              onClick={onLogin}
              className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
            >
              <LogIn size={15} strokeWidth={1.75} className="shrink-0" />
              <span className="text-[13.5px] text-left">{t('sidebar.signInForHistory')}</span>
            </button>
          )}

          {user && chatList.length === 0 && (
            <p className="px-2.5 py-[7px] text-[13.5px] text-white/30">{t('sidebar.noChatsYet')}</p>
          )}
        </div>
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-white/[0.07] relative">
        <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
          <button onClick={() => setUserMenuOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0">
            <span className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold text-[#2a1a12] overflow-hidden" style={{ background: '#d97757' }}>
              {user?.photoURL
                ? <img src={user.photoURL} className="w-full h-full object-cover" alt="" />
                : (user?.displayName?.charAt(0) ?? 'C')}
            </span>
            <span className="text-[13px] text-white/75 truncate">
              {user?.displayName?.split(' ')[0] ?? t('sidebar.guest')}
              <span className="text-white/35"> · {user ? t('sidebar.account') : t('sidebar.noAccount')}</span>
            </span>
            <ChevronDown size={14} className="text-white/35 shrink-0" />
          </button>
          <button
            onClick={onToggleMic}
            title={isListening ? t('sidebar.micOn') : t('sidebar.micOff')}
            className="p-1 rounded-md text-white/35 hover:text-white/75 transition-colors shrink-0"
          >
            {isListening ? <Mic size={15} className="text-red-400" /> : <MicOff size={15} />}
          </button>
        </div>

        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-white/10 bg-[#2b2926] py-1 shadow-xl animate-menu-pop-up">
            <button onClick={() => { onOpenSettings(); setUserMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[13px] text-white/75 hover:bg-white/[0.06] transition-colors">
              {t('sidebar.settings')}
            </button>
            {user ? (
              <button onClick={() => { onLogout(); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-white/75 hover:bg-white/[0.06] transition-colors">
                <LogOut size={14} /> {t('sidebar.logout')}
              </button>
            ) : (
              <button onClick={() => { onLogin(); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-white/75 hover:bg-white/[0.06] transition-colors">
                <LogIn size={14} /> {t('sidebar.login')}
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
