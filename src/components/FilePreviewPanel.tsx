import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { X, Download } from 'lucide-react';
import type { GeneratedFile } from '../types';
import { downloadFile } from '../hooks/useChat';

// Extension -> Prism language name. Falls back to plain text for anything unlisted
// rather than guessing -- an unhighlighted file is harmless, a wrong language isn't.
const LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', php: 'php', java: 'java', kt: 'kotlin',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
  go: 'go', rs: 'rust', swift: 'swift', dart: 'dart',
  html: 'markup', xml: 'markup', svg: 'markup', css: 'css', scss: 'scss',
  sh: 'bash', bash: 'bash', sql: 'sql', json: 'json',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', md: 'markdown', graphql: 'graphql',
};

const languageOf = (filename: string) => {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  return LANG_MAP[ext] ?? 'text';
};

export const FilePreviewPanel: React.FC<{ file: GeneratedFile | null; isCodeMode?: boolean; onClose: () => void }> = ({
  file, isCodeMode = false, onClose,
}) => (
  <div
    className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl transform flex-col border-l backdrop-blur-xl transition-transform duration-300 ${
      file ? 'translate-x-0' : 'translate-x-full'
    } ${isCodeMode ? 'bg-[#080f0b]/95 border-green-500/10' : 'bg-[#0b0b1a]/95 border-white/10'}`}
  >
    {file && (
      <>
        <div className={`flex h-[60px] shrink-0 items-center justify-between px-4 border-b ${isCodeMode ? 'border-green-500/10' : 'border-white/10'}`}>
          <p className="truncate text-sm font-medium text-white">{file.filename}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadFile(file.filename, file.content)}
              title="Descarregar ficheiro"
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isCodeMode ? 'border-green-500/25 text-green-400 hover:bg-green-500/10' : 'border-white/15 text-white/70 hover:bg-white/10'
              }`}
            >
              <Download size={12} />
              Download
            </button>
            <button onClick={onClose} title="Fechar" className="p-2 text-white/50 hover:text-white/80 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto VUXIO-scroll">
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={languageOf(file.filename)}
            PreTag="div"
            showLineNumbers
            className="!bg-transparent !p-4 !m-0 text-sm !h-full"
          >
            {file.content}
          </SyntaxHighlighter>
        </div>
      </>
    )}
  </div>
);
