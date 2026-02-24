/**
 * SSE Transport Adapter for CLTP
 *
 * 将现有的 SSETransport 适配为 CLTP 的 TransportAdapter 接口
 * 将 SSE 事件转换为 CLTP chunks
 *
 * 关键保护：
 * - 确保转换后的内容格式与现有格式完全兼容
 * - 不影响 Markdown 渲染和打字机效果
 * - payload.text 字段必须包含完整的原始文本内容
 * - 不进行任何文本处理、格式化或修改
 */

import type { TransportAdapter, UserMessageTransport } from '../types/adapters';
import type { CLChunk, SpanCLChunk, ContentCLChunk, HeartbeatChunk } from '../types/chunks';
import type { UserMessage } from '../types/messages';
import type { DefaultPayloads } from '../types/channels';
import { SSETransport, type SSEEvent } from '@/transports/SSETransport';
import { generateChunkId, generateMessageId, generateSpanId } from '../utils/id';

/**
 * SSE Transport Adapter implementation
 * 适配现有的 SSETransport 为 CLTP TransportAdapter
 */
export class SSETransportAdapter<Payloads extends Record<string, any> = DefaultPayloads>
  implements TransportAdapter<Payloads>, UserMessageTransport<Payloads> {
  private sseTransport: SSETransport;
  private chunkListeners: Array<(chunk: CLChunk<Payloads>) => void> = [];
  private errorListeners: Array<(error: Error) => void> = [];
  private connectionListeners: Array<(connected: boolean) => void> = [];

  // Track current run span for agent lifecycle
  private currentRunSpanId: string | null = null;
  private currentRunStartMessageId: string | null = null;
  private sequenceCounters: Map<string, number> = new Map();
  // Track message IDs by channel for proper aggregation
  private messageIdsByChannel: Map<string, string> = new Map();
  private lastPlainText: string = '';
  private plainDone: boolean = false;
  private lastNonDeltaPlainText: string = '';
  private lastNonDeltaPlainDone: boolean = false;
  private lastAnswerEventSeq: number = 0;

  constructor(sseTransport: SSETransport) {
    this.sseTransport = sseTransport;

    // Set up SSE event listeners
    this.sseTransport.onMessage((event: SSEEvent) => {
      this.handleSSEEvent(event);
    });

    this.sseTransport.onError((error: Error) => {
      this.emitError(error);
    });
  }

  setResumeData(data: any): void {
    this.sseTransport.setResumeData(data);
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.sseTransport.connected;
  }

  /**
   * Connect to transport
   */
  async connect(): Promise<void> {
    // SSE transport connects automatically when send() is called
    // This is a no-op for SSE, but we emit connection events
    if (this.sseTransport.connected) {
      this.emitConnectionChange(true);
    }
  }

  /**
   * Disconnect from transport
   */
  disconnect(): void {
    this.sseTransport.disconnect();
    this.emitConnectionChange(false);
  }

  /**
   * Send user message
   */
  async sendUserMessage(message: UserMessage<Payloads>): Promise<void> {
    // Extract text from user message payload
    const payload = message.metadata.payload;
    const text = typeof payload === 'string' ? payload : (payload as any).text || '';

    // Send via SSE transport
    await this.sseTransport.send(text);
  }

  /**
   * Listen for chunks
   */
  onChunk(callback: (chunk: CLChunk<Payloads>) => void): () => void {
    this.chunkListeners.push(callback);
    return () => {
      this.chunkListeners = this.chunkListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Listen for errors
   */
  onError(callback: (error: Error) => void): () => void {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Listen for connection changes
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Handle SSE event and convert to CLTP chunks
   *
   * 关键适配逻辑：
   * - agent_start → span:start(name='run')
   * - thought → content(channel='think', payload={ text: content }) **保持文本内容原样**
   * - answer → content(channel='plain', payload={ text: content }) **保持文本内容原样**
   * - agent_end → span:end(name='run')
   * - heartbeat → heartbeat
   */
  private handleSSEEvent(event: SSEEvent): void {
    try {
      const timestamp = event.timestamp || new Date().toISOString();

      switch (event.type) {
        case 'agent_start':
          this.handleAgentStart(event, timestamp);
          break;

        case 'agent_end':
          this.handleAgentEnd(event, timestamp);
          break;

        case 'thought':
          this.handleThought(event, timestamp);
          break;

        case 'answer':
          this.handleAnswer(event, timestamp);
          break;

        case 'heartbeat':
          this.handleHeartbeat(event, timestamp);
          break;

        // Other event types are ignored for now
        default:
          break;
      }
    } catch (error) {
      console.error('[SSETransportAdapter] Error handling SSE event:', error);
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle agent_start event → span:start(name='run')
   */
  private handleAgentStart(event: SSEEvent, timestamp: string): void {
    const spanId = generateSpanId();
    const chunkId = generateChunkId();

    this.currentRunSpanId = spanId;
    this.currentRunStartMessageId = chunkId;
    this.lastPlainText = '';
    this.plainDone = false;
    this.lastNonDeltaPlainText = '';
    this.lastNonDeltaPlainDone = false;
    this.lastAnswerEventSeq = 0;

    const chunk: SpanCLChunk = {
      type: 'span',
      status: 'start',
      id: chunkId,
      parentCLSpanId: null,
      clmessageId: chunkId,
      clspanId: spanId,
      sequence: 0,
      timestamp,
      metadata: {
        name: 'run',
      },
    };

    this.emitChunk(chunk);
  }

  /**
   * Handle agent_end event → span:end(name='run')
   */
  private handleAgentEnd(event: SSEEvent, timestamp: string): void {
    if (!this.currentRunSpanId) {
      console.warn('[SSETransportAdapter] agent_end received without agent_start');
      return;
    }

    // Karis-like fallback: ensure plain channel emits a terminal done chunk.
    // This prevents UI from staying in "processing" when backend misses complete=true.
    if (!this.plainDone) {
      const messageId = this.getOrCreateMessageId('plain');
      const sequence = this.getNextSequence(messageId);
      const finalizeChunk: ContentCLChunk<Payloads> = {
        type: 'content',
        id: generateChunkId(),
        parentCLSpanId: this.currentRunSpanId,
        clmessageId: messageId,
        sequence,
        timestamp,
        metadata: {
          channel: 'plain',
          payload: {
            text: this.lastPlainText || '',
          } as Payloads['plain'],
          done: true,
        },
      };
      this.emitChunk(finalizeChunk);
      this.plainDone = true;
    }

    const chunkId = generateChunkId();

    const chunk: SpanCLChunk = {
      type: 'span',
      status: 'end',
      id: chunkId,
      parentCLSpanId: null,
      clmessageId: chunkId,
      clspanId: this.currentRunSpanId,
      sequence: 0,
      timestamp,
      metadata: {
        name: 'run',
      },
    };

    this.emitChunk(chunk);

    // Clean up: mark final chunks as done and reset state
    this.markFinalChunksAsDone();
    this.currentRunSpanId = null;
    this.currentRunStartMessageId = null;
    this.messageIdsByChannel.clear();
    this.sequenceCounters.clear();
  }

  /**
   * Mark final chunks as done when agent ends
   */
  private markFinalChunksAsDone(): void {
    // This will be handled by the final answer chunk with is_complete=true
    // No need to emit additional chunks here
  }

  /**
   * Handle thought event → content(channel='think', payload={ text: content })
   *
   * 关键：保持文本内容原样，不进行任何修改
   */
  private handleThought(event: SSEEvent, timestamp: string): void {
    const content =
      event.data?.content ??
      event.data?.data?.content ??
      '';

    // 关键：直接使用原始文本内容，不进行任何处理
    const messageId = this.getOrCreateMessageId('think');
    const sequence = this.getNextSequence(messageId);

    const chunk: ContentCLChunk<Payloads> = {
      type: 'content',
      id: generateChunkId(),
      parentCLSpanId: this.currentRunSpanId,
      clmessageId: messageId,
      sequence,
      timestamp,
      metadata: {
        channel: 'think',
        // 关键：payload.text 字段必须包含完整的原始文本内容
        payload: {
          text: content, // 保持原样，不进行任何修改
        } as Payloads['think'],
        done: false, // Thought 通常是流式的
      },
    };

    this.emitChunk(chunk);
  }

  /**
   * Handle answer event → content(channel='plain', payload={ text: content })
   *
   * 关键：保持文本内容原样，不进行任何修改
   */
  private handleAnswer(event: SSEEvent, timestamp: string): void {
    const eventSeqRaw =
      event.data?.event_seq ??
      event.data?.data?.event_seq;
    const eventSeq = typeof eventSeqRaw === 'number' ? eventSeqRaw : null;
    if (eventSeq !== null) {
      if (eventSeq <= this.lastAnswerEventSeq) {
        return;
      }
      this.lastAnswerEventSeq = eventSeq;
    }

    const rawDelta =
      event.data?.delta ??
      event.data?.data?.delta;
    // 仅当 delta 是字符串时，才按增量处理；null/undefined 不能算 delta。
    const hasDelta = typeof rawDelta === 'string';
    const rawSnapshot =
      event.data?.content ??
      event.data?.data?.content ??
      '';
    const isComplete =
      event.data?.is_complete ??
      event.data?.data?.is_complete ??
      false;

    const snapshot = this.sanitizePlainPrefix(rawSnapshot);
    let content = '';
    let emitAsDelta = hasDelta;

    if (hasDelta) {
      const deltaText = this.sanitizePlainPrefix(rawDelta as string);

      // Prefer snapshot alignment when provided, so replayed/duplicated deltas
      // do not append duplicated paragraphs.
      if (snapshot) {
        if (snapshot === this.lastPlainText) {
          content = '';
        } else if (snapshot.startsWith(this.lastPlainText)) {
          content = snapshot.slice(this.lastPlainText.length);
        } else if (this.lastPlainText.startsWith(snapshot)) {
          // stale snapshot, ignore this update
          content = '';
        } else if (deltaText && this.lastPlainText.endsWith(deltaText)) {
          content = '';
        } else {
          content = deltaText || snapshot;
        }
      } else {
        if (deltaText && !this.lastPlainText.endsWith(deltaText)) {
          content = deltaText;
        }
      }

      if (content) {
        this.lastPlainText += content;
      }

      // Keep completion signal even when final delta is empty.
      if (!content && isComplete) {
        emitAsDelta = false;
        content = this.lastPlainText;
      } else if (!content) {
        return;
      }
    } else {
      content = snapshot || (isComplete ? this.lastPlainText : '');
      if (!content && !isComplete) {
        return;
      }

      // In-memory idempotency guard (Redis-like dedupe idea, local only):
      // skip repeated non-delta snapshots with same done flag.
      if (
        content === this.lastNonDeltaPlainText &&
        isComplete === this.lastNonDeltaPlainDone
      ) {
        return;
      }

      this.lastNonDeltaPlainText = content;
      this.lastNonDeltaPlainDone = !!isComplete;
      this.lastPlainText = content || this.lastPlainText;
    }
    this.plainDone = !!isComplete;

    // 关键：直接使用原始文本内容，不进行任何处理
    const messageId = this.getOrCreateMessageId('plain');
    const sequence = this.getNextSequence(messageId);

    const chunk: ContentCLChunk<Payloads> = {
      type: 'content',
      id: generateChunkId(),
      parentCLSpanId: this.currentRunSpanId,
      clmessageId: messageId,
      sequence,
      timestamp,
      metadata: {
        channel: 'plain',
        // 关键：payload.text 字段必须包含完整的原始文本内容
        payload: {
          text: content, // 保持原样，不进行任何修改
          is_delta: emitAsDelta,
        } as Payloads['plain'],
        done: isComplete,
      },
    };

    this.emitChunk(chunk);
  }

  /**
   * Strip leaked Thought/Response labels from plain channel text.
   * This is a defensive UI-level fallback and does not change semantic body.
   */
  private sanitizePlainPrefix(text: string): string {
    if (!text) {
      return text;
    }

    let cleaned = text;
    cleaned = cleaned.replace(
      /^\s*(?:(?:\*\*)?(?:Thought|思考)(?:\*\*)?\s*[:：]?\s*)+/i,
      '',
    );
    cleaned = cleaned.replace(
      /^\s*(?:(?:\*\*)?(?:Response|回复|Answer|Final\s*Answer|最终回复)(?:\*\*)?\s*[:：]?\s*)+/i,
      '',
    );
    // Handle malformed concatenated labels like "ThoughtThoughtResponse"
    cleaned = cleaned.replace(
      /^\s*(?:(?:Thought|思考|Response|回复|Answer|Final\s*Answer|最终回复)\s*)+/i,
      '',
    );
    // Remove leaked leading punctuation after label stripping.
    cleaned = cleaned.replace(/^\s*[:：]+\s*/, '');

    return cleaned;
  }

  /**
   * Handle heartbeat event → heartbeat
   */
  private handleHeartbeat(event: SSEEvent, timestamp: string): void {
    const chunk: HeartbeatChunk = {
      type: 'heartbeat',
      id: generateChunkId(),
      timestamp,
    };

    this.emitChunk(chunk);
  }

  /**
   * Get or create message ID for a channel
   * 关键：同一个 channel 在同一个 run span 内应该使用相同的 messageId
   */
  private getOrCreateMessageId(channel: string): string {
    const key = `${channel}-${this.currentRunSpanId || 'default'}`;

    // If we already have a message ID for this channel, reuse it
    if (this.messageIdsByChannel.has(key)) {
      return this.messageIdsByChannel.get(key)!;
    }

    // Create new message ID for this channel
    const messageId = generateMessageId();
    this.messageIdsByChannel.set(key, messageId);
    this.sequenceCounters.set(messageId, 0);

    return messageId;
  }

  /**
   * Get next sequence number for a message
   */
  private getNextSequence(messageId: string): number {
    const current = this.sequenceCounters.get(messageId) ?? 0;
    this.sequenceCounters.set(messageId, current + 1);
    return current;
  }

  /**
   * Emit chunk to listeners
   */
  private emitChunk(chunk: CLChunk<Payloads>): void {
    for (const listener of this.chunkListeners) {
      try {
        listener(chunk);
      } catch (error) {
        console.error('[SSETransportAdapter] Error in chunk listener:', error);
      }
    }
  }

  /**
   * Emit error to listeners
   */
  private emitError(error: Error): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (err) {
        console.error('[SSETransportAdapter] Error in error listener:', err);
      }
    }
  }

  /**
   * Emit connection change to listeners
   */
  private emitConnectionChange(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected);
      } catch (error) {
        console.error('[SSETransportAdapter] Error in connection listener:', error);
      }
    }
  }

  /**
   * Send user message (implements UserMessageTransport)
   */
  async send(message: UserMessage<Payloads>): Promise<void> {
    await this.sendUserMessage(message);
  }
}

/**
 * Create SSE Transport Adapter from existing SSETransport
 */
export function createSSETransportAdapter<Payloads extends Record<string, any> = DefaultPayloads>(
  sseTransport: SSETransport
): SSETransportAdapter<Payloads> {
  return new SSETransportAdapter<Payloads>(sseTransport);
}
