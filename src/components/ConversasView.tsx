import React, { useMemo, useState } from 'react';
import { Search, MessageSquare, Code2, Trash2, X } from 'lucide-react';
import type { Chat } from '../types';
import { t } from '../i18n';

type Filter = 'all' | 'chat' | 'code';

/**
 * "23 horas", "2 dias", "28 jul" -- coarse enough that it doesn't need a
 * re-render tick (unlike the header clock in the old design, which existed
 * only to demonstrate it could).
 */
const relativeTime = (ms: number | undefined): string => {
  if (!ms) return t('conversas.time.now');
  const diffMs = Date.now() - ms;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t('conversas.time.now');
  if (minutes < 60) return t('conversas.time.min', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t(hours === 1 ? 'conversas.time.hour' : 'conversas.time.hours', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t(days === 1 ? 'conversas.time.day' : 'conversas.time.days', { n: days });
  return new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

const ConversaRow: React.FC<{
  chat: Chat;
  selecting: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onLoad: () => void;
  onDelete: () => void;
}> = ({ chat, selecting, selected, onToggleSelected, onLoad, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) { onDelete(); return; }
    setConfirmDelete(true);
    setTimeout(() => setConfirmDelete(false), 2500);
  };

  return (
    <div
      onClick={() => (selecting ? onToggleSelected() : onLoad())}
      className="group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-white/[0.04] transition-colors"
    >
      {selecting && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          onClick={e => e.stopPropagation()}
          className="shrink-0 accent-[#d97757]"
        />
      )}
      {chat.isCodeMode
        ? <Code2 size={16} className="shrink-0 text-white/30" strokeWidth={1.75} />
        : <MessageSquare size={16} className="shrink-0 text-white/30" strokeWidth={1.75} />}
      <span className="flex-1 text-sm text-white/80 truncate">{chat.title}</span>
      <span className="shrink-0 text-[12px] text-white/30">{relativeTime(chat.updatedAt)}</span>
      {!selecting && (
        <button
          onClick={handleDelete}
          className={`shrink-0 p-1 rounded transition-[opacity,color] duration-150 ${
            confirmDelete ? 'opacity-100 text-red-400' : 'opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400'
          }`}
          title={confirmDelete ? t('common.confirmDelete') : t('sidebar.deleteChat')}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

interface ConversasViewProps {
  chatList: Chat[];
  onLoadChat: (chat: Chat) => void;
  onDeleteChat: (id: string) => void;
  onNewChat: () => void;
}

export const ConversasView: React.FC<ConversasViewProps> = ({ chatList, onLoadChat, onDeleteChat, onNewChat }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chatList
      .filter(chat => filter === 'all' || (filter === 'code') === Boolean(chat.isCodeMode))
      .filter(chat => !q || chat.title.toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt ?? Infinity) - (a.updatedAt ?? Infinity));
  }, [chatList, query, filter]);

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelecting = () => { setSelecting(false); setSelected(new Set()); setConfirmBulkDelete(false); };

  const handleBulkDelete = () => {
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); setTimeout(() => setConfirmBulkDelete(false), 2500); return; }
    selected.forEach(onDeleteChat);
    exitSelecting();
  };

  return (
    <div className="flex-1 overflow-y-auto VUXIO-scroll px-6 sm:px-10 pt-16 pb-10 animate-fade-up">
      <div className="max-w-[720px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[26px] text-white/95" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>{t('conversas.title')}</h1>
          <div className="flex items-center gap-2">
            {selecting ? (
              <>
                <span className="text-[12.5px] text-white/40">
                  {t(selected.size === 1 ? 'conversas.selected' : 'conversas.selected_other', { n: selected.size })}
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={selected.size === 0}
                  className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors disabled:opacity-40 ${
                    confirmBulkDelete ? 'bg-red-500/20 text-red-300' : 'bg-white/[0.06] text-white/70 hover:bg-red-500/15 hover:text-red-300'
                  }`}
                >
                  {confirmBulkDelete ? t('conversas.confirm') : t('conversas.delete')}
                </button>
                <button onClick={exitSelecting} className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors">
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelecting(true)}
                  disabled={chatList.length === 0}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30"
                >
                  {t('conversas.select')}
                </button>
                <button
                  onClick={onNewChat}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium bg-white text-[#1a1917] hover:bg-white/85 transition-[background-color,transform] hover:-translate-y-px active:translate-y-0"
                  style={{ transitionDuration: 'var(--dur-micro)', transitionTimingFunction: 'var(--ease-out)' }}
                >
                  {t('conversas.new')}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03]">
            <Search size={15} className="text-white/35 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('conversas.search')}
              className="flex-1 bg-transparent border-none outline-none text-sm text-white/85 placeholder:text-white/30"
            />
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl border border-white/10 shrink-0">
            {([['all', t('conversas.filter.all')], ['chat', t('conversas.filter.chat')], ['code', t('conversas.filter.code')]] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-2.5 py-1.5 rounded-lg text-[12.5px] transition-colors ${
                  filter === value ? 'bg-white/[0.1] text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-white/30 py-10 text-center">
            {chatList.length === 0 ? t('conversas.empty') : t('conversas.noMatch')}
          </p>
        ) : (
          <div className="space-y-0.5">
            {visible.map(chat => (
              <ConversaRow
                key={chat.id}
                chat={chat}
                selecting={selecting}
                selected={selected.has(chat.id)}
                onToggleSelected={() => toggleSelected(chat.id)}
                onLoad={() => onLoadChat(chat)}
                onDelete={() => onDeleteChat(chat.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
