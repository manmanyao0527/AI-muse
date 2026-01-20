
export enum AppMode {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video'
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  resultUrl?: string;
  timestamp: number;
}

export interface DialogueSession {
  id: string;
  mode: AppMode;
  title: string;
  messages: Message[];
  params: AppConfig;
  timestamp: number;
}

export interface UserRecord {
  id: string;
  type: AppMode;
  title: string;
  content: string;
  timestamp: number;
  params?: any;
  resultUrl?: string;
}

export interface AppConfig {
  model: string;
  ratio?: string;
  style?: string;
  duration?: string;
  attachments?: File[];
  refImage?: File | null;
  refVideo?: File | null;
}

export interface CaseItem {
  id: string;
  title: string;
  description: string;
  type: AppMode;
  prompt: string;
  icon: string;
  previewUrl?: string; // URL for image or video preview
}
