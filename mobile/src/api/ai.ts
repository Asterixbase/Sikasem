import { api } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const aiApi = {
  chat: (message: string, history: ChatMessage[]) =>
    api.post<{ reply: string }>('/ai/chat', { message, history }),

  shiftSummary: () =>
    api.get<{ summary: string; date: string }>('/ai/shift-summary'),
};
