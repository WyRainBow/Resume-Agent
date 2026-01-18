/**
 * Chunk Processing Engine
 * 协调不同类型的 chunk 处理，使用策略模式
 *
 * 简化版本：专注于 OpenManus 的核心功能
 */

import type {
  CLChunk,
  SpanCLChunk,
  ContentCLChunk,
  HeartbeatChunk,
} from '../types/chunks';
import type { UserMessage } from '../types/messages';
import { SpanManager } from './SpanManager';
import { MessageAggregator } from './MessageAggregator';
import { StateUpdater, StateQuery } from './StateManager';
import { SessionEventEmitter } from './SessionEventEmitter';
import { ErrorHandler } from './ErrorHandler';

/**
 * Chunk processor interface
 */
export interface ChunkProcessor<Payloads = any> {
  /** Process a single chunk */
  processChunk(chunk: CLChunk<Payloads>): Promise<void>;

  /** Add a user message directly to state management */
  addUserMessage(message: UserMessage): Promise<void>;

  /** Finalize all pending messages (used for interruption) */
  finalizePendingMessages(reason: 'interrupted' | 'closed'): Promise<void>;

  /** Validate chunk structure and content */
  validateChunk(chunk: CLChunk<Payloads>): void;
}

/**
 * Chunk processor implementation with strategy pattern for chunk types
 */
export class ChunkProcessorImpl<
  Payloads extends Record<string, any> = Record<string, any>,
> implements ChunkProcessor<Payloads> {
  private spanManager: SpanManager;
  private messageAggregator: MessageAggregator<Payloads>;
  private stateUpdater: StateUpdater<Payloads>;
  private stateQuery: StateQuery<Payloads>;
  private eventEmitter: SessionEventEmitter<Payloads>;
  private errorHandler: ErrorHandler;
  private processedChunkIds = new Set<string>();

  constructor(
    spanManager: SpanManager,
    messageAggregator: MessageAggregator<Payloads>,
    stateUpdater: StateUpdater<Payloads>,
    stateQuery: StateQuery<Payloads>,
    eventEmitter: SessionEventEmitter<Payloads>,
    errorHandler: ErrorHandler
  ) {
    this.spanManager = spanManager;
    this.messageAggregator = messageAggregator;
    this.stateUpdater = stateUpdater;
    this.stateQuery = stateQuery;
    this.eventEmitter = eventEmitter;
    this.errorHandler = errorHandler;
  }

  /**
   * Process a single chunk
   */
  async processChunk(chunk: CLChunk<Payloads>): Promise<void> {
    try {
      // Validate chunk structure
      this.validateChunk(chunk);

      // Check for duplicates
      if (this.processedChunkIds.has(chunk.id)) {
        console.debug(`[CLTP] Duplicate chunk ignored: ${chunk.id} (${chunk.type})`);
        return;
      }

      // Mark chunk as processed
      this.processedChunkIds.add(chunk.id);

      // Process chunk based on type using strategy pattern
      switch (chunk.type) {
        case 'span':
          await this.processSpanChunk(chunk as SpanCLChunk);
          break;
        case 'content':
          await this.processContentChunk(chunk as ContentCLChunk<Payloads>);
          break;
        case 'heartbeat':
          await this.processHeartbeatChunk(chunk as HeartbeatChunk);
          break;
        default:
          this.errorHandler.handleError(
            new Error(`Unknown chunk type: ${(chunk as any).type}`),
            'validation',
            {
              module: 'ChunkProcessor',
              operation: 'processChunk',
              chunkId: chunk.id,
            }
          );
          return;
      }
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'processing',
        {
          module: 'ChunkProcessor',
          operation: 'processChunk',
          chunkId: chunk.id,
        }
      );
      throw error;
    }
  }

  /**
   * Process span chunk
   */
  private async processSpanChunk(chunk: SpanCLChunk): Promise<void> {
    await this.spanManager.processChunk(chunk);
    this.eventEmitter.emit('chunk:span', chunk);

    // Emit high-level span events for consumers (e.g., UI processing state)
    const spanMessage = this.stateQuery.getMessage(chunk.id) as any;
    if (spanMessage) {
      if (chunk.status === 'start') {
        this.eventEmitter.emit('span:start', spanMessage);
      } else if (chunk.status === 'end') {
        this.eventEmitter.emit('span:end', spanMessage);
      }
    }
  }

  /**
   * Process content chunk
   */
  private async processContentChunk(chunk: ContentCLChunk<Payloads>): Promise<void> {
    await this.messageAggregator.processContentChunk(chunk);
    this.eventEmitter.emit('chunk:content', chunk);
  }

  /**
   * Process heartbeat chunk
   */
  private async processHeartbeatChunk(chunk: HeartbeatChunk): Promise<void> {
    // Update last heartbeat timestamp
    this.stateUpdater.setLastHeartbeat(Date.now());
    this.eventEmitter.emit('heartbeat', chunk);
  }

  /**
   * Add a user message directly to state management
   */
  async addUserMessage(message: UserMessage): Promise<void> {
    try {
      // Add message to state
      await this.stateUpdater.addMessage(message);
      this.eventEmitter.emit('user:message:sent', message);
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'state',
        {
          module: 'ChunkProcessor',
          operation: 'addUserMessage',
          messageId: message.id,
        }
      );
      throw error;
    }
  }

  /**
   * Finalize all pending messages (used for interruption)
   */
  async finalizePendingMessages(
    reason: 'interrupted' | 'closed' = 'interrupted'
  ): Promise<void> {
    try {
      await this.messageAggregator.finalizeAllPendingMessages(reason);
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'processing',
        {
          module: 'ChunkProcessor',
          operation: 'finalizePendingMessages',
        }
      );
    }
  }

  /**
   * Validate chunk structure and content
   */
  validateChunk(chunk: CLChunk<Payloads>): void {
    if (!chunk || typeof chunk !== 'object') {
      throw new Error('Chunk must be an object');
    }

    if (!chunk.type) {
      throw new Error('Chunk must have a type');
    }

    if (!chunk.id || typeof chunk.id !== 'string') {
      throw new Error('Chunk must have a valid id');
    }

    if (!chunk.timestamp || typeof chunk.timestamp !== 'string') {
      throw new Error('Chunk must have a valid timestamp');
    }

    // Type-specific validation
    if (chunk.type === 'span') {
      this.validateSpanChunk(chunk as SpanCLChunk);
    } else if (chunk.type === 'content') {
      this.validateContentChunk(chunk as ContentCLChunk<Payloads>);
    } else if (chunk.type === 'heartbeat') {
      // Heartbeat chunks are simple, no additional validation needed
    } else {
      throw new Error(`Unknown chunk type: ${(chunk as any).type}`);
    }
  }

  /**
   * Validate span chunk structure
   */
  private validateSpanChunk(chunk: SpanCLChunk): void {
    if (!['start', 'end'].includes(chunk.status)) {
      throw new Error(`Invalid span status: ${chunk.status}`);
    }

    if (
      chunk.parentCLSpanId !== null &&
      typeof chunk.parentCLSpanId !== 'string'
    ) {
      throw new Error('parentCLSpanId must be string or null');
    }

    if (typeof chunk.clmessageId !== 'string') {
      throw new Error('clmessageId must be a string');
    }

    if (typeof chunk.clspanId !== 'string') {
      throw new Error('clspanId must be a string');
    }

    if (chunk.sequence !== 0) {
      throw new Error('Span chunk sequence must be 0');
    }

    if (!chunk.metadata || typeof chunk.metadata !== 'object') {
      throw new Error('Span chunk must have metadata object');
    }

    if (typeof chunk.metadata.name !== 'string') {
      throw new Error('Span metadata name must be a string');
    }
  }

  /**
   * Validate content chunk structure
   */
  private validateContentChunk(chunk: ContentCLChunk<Payloads>): void {
    if (
      chunk.parentCLSpanId !== null &&
      typeof chunk.parentCLSpanId !== 'string'
    ) {
      throw new Error('parentCLSpanId must be string or null');
    }

    if (typeof chunk.clmessageId !== 'string') {
      throw new Error('clmessageId must be a string');
    }

    if (typeof chunk.sequence !== 'number') {
      throw new Error('Content chunk sequence must be a number');
    }

    if (!chunk.metadata || typeof chunk.metadata !== 'object') {
      throw new Error('Content chunk must have metadata object');
    }

    if (typeof chunk.metadata.channel !== 'string') {
      throw new Error('Content chunk metadata channel must be a string');
    }

    if (typeof chunk.metadata.done !== 'boolean') {
      throw new Error('Content chunk metadata done must be a boolean');
    }
  }
}
