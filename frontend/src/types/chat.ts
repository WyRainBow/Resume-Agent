/**
 * Chat 相关类型定义
 */

export interface MessageMeta {
  /** 对话粘贴导入解析中 */
  pasteImportParsing?: boolean;
  parseStartedAt?: number;
  /** 解析完成后的总耗时（毫秒） */
  parseElapsedMs?: number;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  timestamp?: string;
  meta?: MessageMeta;
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

