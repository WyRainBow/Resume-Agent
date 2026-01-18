/**
 * Session event interfaces and types
 * 定义所有事件类型及其载荷结构，用于类型安全的事件发射
 */

import type { SpanCLChunk, ContentCLChunk, HeartbeatChunk } from './chunks';
import type { SpanMessage, ContentMessage, UserMessage } from './messages';
import type { SessionState } from './session';
import type { CLTPError } from './errors';

/**
 * Session event map defining all possible events and their handler signatures
 * @template Payloads - Channel payload types for type-safe content events
 */
export interface SessionEventsMap<Payloads = Record<string, unknown>> {
  // Connection lifecycle events
  'connection:connected': () => void;
  'connection:disconnected': () => void;
  'connection:connecting': () => void;

  // Heartbeat events
  heartbeat: (chunk: HeartbeatChunk) => void;

  // Raw chunk events (low-level protocol events)
  'chunk:span': (chunk: SpanCLChunk) => void;
  'chunk:content': (chunk: ContentCLChunk<Payloads>) => void;

  // Processed span events (high-level semantic events)
  'span:start': (span: SpanMessage) => void;
  'span:end': (span: SpanMessage) => void;

  // Message aggregation events
  'message:partial': (message: ContentMessage<Payloads>) => void;
  'message:complete': (message: ContentMessage<Payloads>) => void;

  // User action events
  'user:message:sent': (message: UserMessage) => void;
  'interrupt:started': () => void;
  'interrupt:completed': (result: { timestamp: string }) => void;

  // Session lifecycle events
  'session:initialized': (params: {
    conversationId: string;
    withHistory?: boolean;
    since?: string;
  }) => void;
  'session:closed': (params: {
    conversationId: string;
    timestamp: string;
  }) => void;
  'transport:connected': (params: { timestamp: string }) => void;

  // Heartbeat monitoring events
  'heartbeat:missed': (params: {
    missedCount: number;
    timeSinceLastHeartbeat: number;
    toleratedMisses: number;
  }) => void;
  'connection:unhealthy': (params: {
    missedHeartbeats: number;
    lastHeartbeatTime: number;
    timeSinceLastHeartbeat: number;
  }) => void;

  // Reconnection events
  'reconnection:started': (attempt: number, maxRetries: number) => void;
  'reconnection:success': (params: {
    attempts: number;
    totalTime: number;
  }) => void;
  'reconnection:attempt:failed': (params: {
    attempt: number;
    maxAttempts: number;
    error: string;
    nextRetryIn?: number;
  }) => void;
  'reconnection:failed': (params: {
    totalAttempts: number;
    maxAttempts: number;
    lastError: string;
  }) => void;

  // State change events
  'state:changed': (state: Readonly<SessionState<Payloads>>) => void;

  // History events
  'history:loaded': (state: Readonly<SessionState<Payloads>>) => void;

  // Error events
  error: (error: CLTPError) => void;
}

/**
 * Connection state for connection events
 */
export type ConnectionState =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'reconnecting';
