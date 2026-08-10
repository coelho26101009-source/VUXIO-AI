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

export interface Settings {
  defaultMode: 'standard' | 'code';
  temperature: number;
  memoryEnabled: boolean;
}
