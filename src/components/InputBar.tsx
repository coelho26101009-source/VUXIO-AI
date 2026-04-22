import React, { useRef, useState, useCallback } from 'react';
import { Paperclip, Mic, MicOff, Volume2, VolumeX, Send, X } from 'lucide-react';
import type { Attachment } from '../types';

interface InputBarProps {
  onSend: (text: string, attachment: Attachment | null) => void;
  isLoading: boolean;
  isConnected: boolean;
  isMuted: boolean;
  isListening: boolean;
  onToggleMute: () => void;
  onToggleMic: () => void;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSend, isLoading, isConnected, isMuted, isListening, onToggleMute, onToggleMic
}) => {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = (text.trim().length > 0 || attachment !== null) && !isLoading && isConnected;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim(), attachment);
    setText('');
    setAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSend, text, attachment, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      setAttachment({ file, base64 });
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="border-t border-white/5 px-4 py-4 bg-[#0e0e18]/80 backdrop-blur-sm">
      {attachment && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15 max-w-2xl mx-auto">
          <Paperclip size={13} className="text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300 truncate">{attachment.file.name}</span>
          <button onClick={() => setAttachment(null)} className="ml-auto text-white/30 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <div className="flex items-end gap-2 px-4 py-3 rounded-2xl bg-[#1a1a28] border border-amber-500/15 focus-within:border-amber-500/35 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.05)] transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!isConnected || isLoading}
            placeholder={
              !isConnected ? 'A conectar...' :
              isLoading ? 'Vimo está a pensar...' :
              'Pergunta ao Vimo algo...'
            }
            className="flex-1 bg-transparent border-none outline-none resize-none text-[#ececec] text-sm placeholder:text-white/20 leading-relaxed min-h-[22px] max-h-[140px] scrollbar-none disabled:opacity-50"
            style={{ fontFamily: "'Sora', sans-serif" }}
          />

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => fileRef.current?.click()} title="Anexar ficheiro" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/6 transition-all">
              <Paperclip size={16} />
            </button>
            <button onClick={onToggleMute} title={isMuted ? 'Ativar voz' : 'Mutar'} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isMuted ? 'text-red-400 bg-red-500/10' : 'text-white/25 hover:text-white/60 hover:bg-white/6'}`}>
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button onClick={onToggleMic} title={isListening ? 'Parar microfone' : 'Microfone'} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isListening ? 'text-red-400 bg-red-500/10 animate-pulse' : 'text-white/25 hover:text-white/60 hover:bg-white/6'}`}>
              {isListening ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
            <button onClick={handleSend} disabled={!canSend} title="Enviar" className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-black transition-all disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-amber-500 shadow-[0_2px_10px_rgba(245,158,11,0.25)] hover:shadow-[0_4px_16px_rgba(245,158,11,0.35)] hover:-translate-y-px active:translate-y-0">
              <Send size={15} />
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-white/15 mt-2.5">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>

      <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
    </div>
  );
};
