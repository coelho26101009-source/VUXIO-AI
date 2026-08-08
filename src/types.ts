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
}
