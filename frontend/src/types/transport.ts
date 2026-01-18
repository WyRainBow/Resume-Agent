/**
 * Transport layer types for SSE communication
 *
 * Replaces websocket.ts types with SSE-compatible types
 */

/**
 * SSE Event types from backend
 */
export type SSEEventType =
  | 'thought'
  | 'answer'
  | 'tool_call'
  | 'tool_result'
  | 'agent_start'
  | 'agent_end'
  | 'agent_error'
  | 'status'
  | 'system'
  | 'heartbeat'
  | 'error';

/**
 * SSE Event from backend
 */
export interface SSEMessage {
  id: string;
  type: SSEEventType;
  data: SSEEventData;
  timestamp: string;
}

/**
 * Event data payload types
 */
export interface SSEEventData {
  content?: string;
  is_complete?: boolean;
  conversation_id?: string;

  // Tool events
  tool?: string;
  args?: Record<string, any>;
  result?: string;
  tool_call_id?: string;

  // Agent events
  agent_name?: string;
  task?: string;
  success?: boolean;

  // Error events
  error_message?: string;
  error_type?: string;

  // System events
  message?: string;
  level?: string;
}

/**
 * Connection status
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'idle' | 'processing';

/**
 * Normalized message for UI consumption
 * Converts SSE events to a common format
 */
export interface NormalizedMessage {
  type: 'thought' | 'answer' | 'status' | 'complete' | 'error' | 'agent_start' | 'agent_end' | 'system';
  content?: string;
  is_complete?: boolean;
  data?: any;
}

/**
 * Convert SSE event to normalized message for UI
 */
export function normalizeSSEEvent(event: SSEMessage): NormalizedMessage {
  const { type, data } = event;

  switch (type) {
    case 'thought':
      return {
        type: 'thought',
        content: data.content,
      };

    case 'answer':
      return {
        type: 'answer',
        content: data.content,
        is_complete: data.is_complete,
      };

    case 'status':
      return {
        type: 'status',
        content: data.content,
      };

    case 'agent_start':
      return {
        type: 'agent_start',
        data: data,
      };

    case 'agent_end':
      return {
        type: 'agent_end',
        data: data,
      };

    case 'agent_error':
    case 'error':
      return {
        type: 'error',
        content: data.error_message || data.content,
      };

    case 'system':
      return {
        type: 'system',
        content: data.message || data.content,
      };

    default:
      return {
        type: 'system',
        content: JSON.stringify(data),
      };
  }
}



