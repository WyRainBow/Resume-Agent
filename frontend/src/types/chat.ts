/**
 * Chat 相关类型定义
 */

export interface MessageMeta {
  /** 对话粘贴导入解析中 */
  pasteImportParsing?: boolean;
  parseStartedAt?: number;
  /** 解析完成后的总耗时（毫秒） */
  parseElapsedMs?: number;
  /** 简历导入/解析成功：渲染成功卡片而非纯文本 */
  importSuccess?: {
    name: string;
    /** 卡片下方的下一步建议 chip（点击填入输入框） */
    suggestions?: string[];
  };
  /** 优化对比全部处理完成：渲染收尾卡片（下载 PDF / 去编辑器） */
  applyDone?: {
    count: number;
    /** 单段应用后的一键微调 chip（点击即发送，继续打磨刚应用的那段） */
    /** @deprecated 2026-07-10 起收尾建议由 LLM 动态生成;仅为旧会话快照兼容保留 */
    refine?: { text: string; msg: string }[];
  };
  /** 导入解析失败：渲染「重试」按钮（重发同一份文件），失败不静默 */
  importRetry?: boolean;
  /** 通用「下一步」建议 chip（点击即发送），用于开场等主动引导单一动作 */
  suggestions?: string[];
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

