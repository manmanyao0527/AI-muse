
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
  resultType?: AppMode; // Added to track result type
  attachments?: { name: string; type: string; url?: string }[];
  timestamp: number;
  feedback?: 'like' | 'dislike' | null;
  ratio?: string;
}

export interface DialogueSession {
  id: string;
  mode: AppMode;
  title: string;
  messages: Message[];
  params: AppConfig;
  timestamp: number;
}

export interface AppConfig {
  model: string;
  modelLabel?: string;
  ratio?: string;
  style?: string;
  duration?: string;
  imageSize?: string;
  videoResolution?: string;
  attachments?: File[];
  refImages?: File[];
  videoFirstFrame?: File | null;
  videoLastFrame?: File | null;
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
  previewUrl?: string;
}

// Analytics Types - Granular Tracking
export interface UserModeStat {
  pv: number;
  points: number;
}

export interface UserDailyStat {
  [mode: string]: UserModeStat;
}

export interface DateLog {
  date: string; // YYYY-MM-DD
  users: {
    [userId: string]: UserDailyStat;
  };
}
