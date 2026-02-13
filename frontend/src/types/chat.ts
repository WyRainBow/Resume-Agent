/**
 * Chat 相关类型定义
 */

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  timestamp?: string;
  attachments?: {
    name: string;
    type: string;
    url?: string;
    size?: number;
  }[];
}

export interface ChatMessageProps {
  message: Message;
  isLatest?: boolean;
  isStreaming?: boolean;
  onTypewriterComplete?: () => void;
}

