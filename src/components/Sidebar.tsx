import React from 'react';
import { Plus, MessageSquare, LogOut, X, Cpu, LogIn } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Chat } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isGuest: boolean;
  chatList: Chat[];
  currentChatId: string | null;
  onNewChat: () => void;
  onLoadChat: (id: string) => void;
  onLogout: () => void;
  onLogin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onClose, user, isGuest, chatList,
  currentChatId, onNewChat, onLoadChat, onLogout, onLogin
}) => {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed top-0 left-0 h-full w-64 bg-[#13131f] border-r border-amber-500/10 z-50 flex flex-col transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:transition-none`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <Cpu size={15} className="text-amber-500" />
            <span className="font-bold tracking-widest text-amber-500 text-sm">Vimo</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/6 transition-all lg:hidden">
            <X size={15} />
          </button>
        </div>

        <div className="px-3 py-3 border-b border-white/5">
          {user ? (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-amber-500/5 border border-amber-500/10">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Perfil" className="w-8 h-8 rounded-full border border-amber-500/30" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold text-sm">
                  {user.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-amber-400 truncate">{user.displayName?.split(' ')[0] || 'Utilizador'}</span>
                <span className="text-xs text-white/30 truncate">{user.email}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/3 border border-white/6">
              <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/30">
                <MessageSquare size={14} />
              </div>
              <span className="text-sm text-white/40">Convidado</span>
            </div>
          )}
        </div>

        <div className="px-3 pt-3">
          <button onClick={() => { onNewChat(); onClose(); }} className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500/8 hover:bg-amber-500/14 border border-amber-500/18 hover:border-amber-500/35 text-amber-400 text-sm font-semibold transition-all duration-150">
            <Plus size={15} />
            Nova conversa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {user && chatList.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-white/20 font-medium px-2 pb-2 pt-1">Recentes</p>
              {chatList.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => { onLoadChat(chat.id); onClose(); }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-sm transition-all duration-150 border
                    ${currentChatId === chat.id ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'border-transparent text-white/40 hover:bg-white/4 hover:text-white/70'}`}
                >
                  <MessageSquare size={13} className="opacity-50 shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </button>
              ))}
            </>
          )}

          {isGuest && (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-white/25 mb-3 leading-relaxed">Entra com a tua conta para guardar o histórico de conversas.</p>
              <button onClick={onLogin} className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-amber-500/8 border border-amber-500/15 text-amber-500/70 hover:text-amber-400 text-xs font-semibold transition-all">
                <LogIn size={13} />
                Entrar com Google
              </button>
            </div>
          )}

          {user && chatList.length === 0 && (
            <p className="text-xs text-white/20 text-center px-2 py-4">Sem histórico ainda.</p>
          )}
        </div>

        {user && (
          <div className="px-3 pb-4 border-t border-white/5 pt-3">
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-red-500/50 hover:text-red-400 hover:bg-red-500/6 border border-transparent hover:border-red-500/15 text-sm font-medium transition-all">
              <LogOut size={14} />
              Terminar sessão
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
