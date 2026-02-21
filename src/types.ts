export enum TranslationStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ApiKey {
  id: string;
  key: string;
  label: string;
  isWorking: boolean;
  errorCount: number;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  translatedContent?: string;
  status: TranslationStatus;
  error?: string;
}

export interface TranslationConfig {
  prompt: string;
  targetLanguage: string;
  sourceLanguage: string;
  selectedModels: string[];
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
];
