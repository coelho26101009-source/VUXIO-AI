export type MessageSource = 'USER' | 'VUXIO' | 'SYSTEM' | 'ERROR';

export interface SearchSource {
  title: string;
  url: string;
  content?: string;
}

export interface GeneratedFile {
  filename: string;
  content: string;
}

export interface LogMessage {
  id: string;
  source: MessageSource;
  text: string;
  timestamp: string;
  sources?: SearchSource[];
  file?: GeneratedFile;
  // Which Groq model actually answered -- only meaningful for VUXIO replies,
  // and always set (even under Auto routing) via the backend's `model` SSE event.
  usedModel?: string;
}

export interface Chat {
  id: string;
  title: string;
  isCodeMode?: boolean;
}

export interface Attachment {
  file: File;
  base64: string;
  // Set instead of base64 for code/text files -- read as plain text and
  // injected directly into the message rather than sent as image_url, since
  // a vision model can't meaningfully accept source code as an "image".
  text?: string;
}

export interface Memory {
  id: string;
  text: string;
  createdAt: number;
}

// Only remote HTTP MCP servers -- a browser can't spawn a stdio subprocess.
export interface McpServer {
  id: string;
  name: string;
  url: string;
}

// groq/compound and groq/compound-mini are deliberately excluded: they reject
// any request carrying custom tools (create_file, offered in every mode) with
// a 400 that fails the whole completion -- see api/chat.js's COMPOUND_MODEL guard.
export type SelectableModel = 'auto' | 'openai/gpt-oss-120b' | 'openai/gpt-oss-20b' | 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant';

export interface Settings {
  defaultMode: 'standard' | 'code';
  temperature: number;
  memoryEnabled: boolean;
  selectedModel: SelectableModel;
}
