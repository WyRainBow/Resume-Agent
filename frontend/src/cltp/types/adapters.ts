// 适配器接口定义
// TransportAdapter, StorageAdapter 等接口

import type { CLChunk, ContentCLChunk } from './chunks';
import type { CLMessage, UserMessage } from './messages';
import type { SessionState, HistoryPayload } from './session';

/**
 * 频道注册接口
 */
export interface ChannelRegistration<
  Name extends string = string,
  Payload = any,
> {
  name: Name;
  initialValue: Payload;
  validate: (payload: unknown) => asserts payload is Payload;
  reduce: (
    prev: Payload,
    chunk: ContentCLChunk<Record<string, any>>
  ) => Payload;
}

/**
 * 传输适配器接口
 */
export interface TransportAdapter<Payloads = Record<string, any>> {
  /** 连接状态 */
  connected: boolean;

  /** 连接到传输层 */
  connect(): Promise<void>;

  /** 断开连接 */
  disconnect(): void;

  /** 发送用户消息 */
  sendUserMessage(message: UserMessage<Payloads>): Promise<void>;

  /** 监听 chunks */
  onChunk(callback: (chunk: CLChunk<Payloads>) => void): () => void;

  /** 监听错误 */
  onError(callback: (error: Error) => void): () => void;

  /** 监听连接状态变化 */
  onConnectionChange(
    callback: (connected: boolean) => void
  ): () => void;
}

/**
 * 存储适配器接口（可选，当前阶段不需要）
 */
export interface StorageAdapter<Payloads = any> {
  saveState(state: SessionState<Payloads>): Promise<void>;
  loadState(): Promise<SessionState<Payloads> | null>;
}

/**
 * 历史适配器接口（可选，当前阶段不需要）
 */
export interface HistoryAdapter<Payloads = any> {
  loadHistory(since?: string): Promise<HistoryPayload<Payloads>>;
}

/**
 * 用户消息传输接口
 */
export interface UserMessageTransport<Payloads = any> {
  send(message: UserMessage<Payloads>): Promise<void>;
}
