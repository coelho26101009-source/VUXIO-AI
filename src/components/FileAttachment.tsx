import React from 'react';
import { FileCode2, Download } from 'lucide-react';
import type { GeneratedFile } from '../types';
import { downloadFile } from '../hooks/useChat';

// Extension shown as the badge is the part after the last dot, uppercased --
// mirrors what the user actually typed as the filename, no language-name lookup needed.
const extOf = (filename: string) => filename.includes('.') ? filename.split('.').pop()!.toUpperCase() : 'FILE';

export const FileAttachment: React.FC<{ file: GeneratedFile; isCodeMode?: boolean; onOpen: () => void }> = ({
  file, isCodeMode = false, onOpen,
}) => (
  <button
    onClick={onOpen}
    className={`mt-3 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
      isCodeMode
        ? 'bg-green-950/20 border-green-500/15 hover:bg-green-950/30'
        : 'bg-black/20 border-white/10 hover:bg-black/30'
    }`}
  >
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
      isCodeMode ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-300'
    }`}>
      <FileCode2 size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-white">{file.filename}</p>
      <p className="text-xs text-white/40">{extOf(file.filename)}</p>
    </div>
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); downloadFile(file.filename, file.content); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); downloadFile(file.filename, file.content); } }}
      title="Descarregar ficheiro"
      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        isCodeMode
          ? 'border-green-500/25 text-green-400 hover:bg-green-500/10'
          : 'border-white/15 text-white/70 hover:bg-white/10'
      }`}
    >
      <Download size={12} />
      Download
    </span>
  </button>
);
