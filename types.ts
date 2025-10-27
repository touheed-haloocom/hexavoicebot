export enum BotStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  LISTENING = 'listening',
  THINKING = 'thinking',
  SPEAKING = 'speaking',
  ERROR = 'error',
  SINGING = 'singing',
  GENERATING_AUDIO = 'generating_audio',
}

export interface TranscriptionEntry {
  source: 'user' | 'bot';
  text: string;
  type?: 'message' | 'thinking' | 'summary' | 'capabilities' | 'song' | 'language';
}

export interface Conversation {
  id: string;
  timestamp: number;
  title: string;
  entries: TranscriptionEntry[];
}