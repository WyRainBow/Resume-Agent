/**
 * SpanManager - Hierarchical span tracking and management
 *
 * 处理 span chunks 并提供 span 相关的业务逻辑
 * 不维护状态 - 将所有状态管理委托给 StateManager
 */

import { EventEmitter } from './EventEmitter';
import type { CLChunk, SpanCLChunk } from '../types/chunks';
import type { SpanMessage } from '../types/messages';
import type { SpanNode } from '../types/session';
import type { StateUpdater, StateQuery } from './StateManager';
import { ErrorHandler } from './ErrorHandler';

/**
 * Span processing result containing the span message to be stored
 */
export interface SpanProcessingResult {
  spanMessage: SpanMessage;
  spanNode: SpanNode;
}

export class SpanManager extends EventEmitter<Record<string, (...args: any[]) => void>> {
  private stateUpdater: StateUpdater;
  private stateQuery: StateQuery;
  private errorHandler: ErrorHandler;
  // De-dupe noisy nesting warnings in streaming/replay (out-of-order spans are common).
  private readonly reportedNestingWarnings = new Set<string>();

  constructor(
    stateUpdater: StateUpdater,
    stateQuery: StateQuery,
    errorHandler: ErrorHandler
  ) {
    super();
    this.stateUpdater = stateUpdater;
    this.stateQuery = stateQuery;
    this.errorHandler = errorHandler;
    this.reportedNestingWarnings = new Set();
  }

  /**
   * Get current session state from StateQuery
   */
  getState() {
    return this.stateQuery.getState();
  }

  /**
   * Process a chunk - delegates to appropriate handler based on chunk type
   */
  async processChunk(chunk: CLChunk): Promise<void> {
    try {
      this.validateChunk(chunk);

      if (chunk.type === 'span') {
        await this.processSpanChunk(chunk);
      }
    } catch (error) {
      throw this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'span',
        {
          module: 'SpanManager',
          operation: 'processChunk',
        }
      );
    }
  }

  /**
   * Process span chunks - handles span start and end
   */
  private async processSpanChunk(chunk: SpanCLChunk): Promise<void> {
    if (chunk.status === 'start') {
      await this.handleSpanStart(chunk);
    } else if (chunk.status === 'end') {
      await this.handleSpanEnd(chunk);
    }
  }

  /**
   * Handle span start chunk
   */
  private async handleSpanStart(chunk: SpanCLChunk): Promise<void> {
    const currentState = this.stateQuery.getState();

    // Check for duplicate span start - only error if span exists and is still open
    const existingSpan = currentState.spans[chunk.clspanId];
    if (existingSpan && existingSpan.status === 'open') {
      throw new Error(
        `Duplicate span start: ${chunk.clspanId} (span is already open)`
      );
    }

    // Validate parent exists if specified and prevent self-nesting
    let validatedParentId = chunk.parentCLSpanId;
    if (chunk.parentCLSpanId) {
      // Check for self-nesting
      if (chunk.parentCLSpanId === chunk.clspanId) {
        console.warn(
          `Warning: Span ${chunk.clspanId} attempting to set itself as parent. Skipping parent assignment.`
        );
        validatedParentId = null;
      } else if (!currentState.spans[chunk.parentCLSpanId]) {
        console.error(
          `Warning: Parent span ${chunk.parentCLSpanId} not found for span ${chunk.clspanId}`
        );
      }
    }

    // Create span message (using chunk id as message id)
    const spanMessage: SpanMessage = {
      id: chunk.id, // SpanMessage的id是chunk的id，不是clspanId
      type: 'span',
      status: 'start',
      clspanId: chunk.clspanId,
      parentCLSpanId: validatedParentId,
      timestamp: chunk.timestamp,
      metadata: chunk.metadata,
    };

    // Update state through StateUpdater
    await this.stateUpdater.updateSpan(spanMessage);

    // Get the updated span node from state
    const updatedState = this.stateQuery.getState();
    const spanNode = updatedState.spans[chunk.clspanId];

    // Emit events
    this.emit('span:start', spanNode, spanMessage);
    this.emit('chunk:span', chunk);
  }

  /**
   * Handle span end chunk with validation and error handling
   */
  private async handleSpanEnd(chunk: SpanCLChunk): Promise<void> {
    const currentState = this.stateQuery.getState();
    const existingSpan = currentState.spans[chunk.clspanId];

    if (!existingSpan) {
      throw this.errorHandler.handleError(
        new Error(`Cannot end non-existent span: ${chunk.clspanId}`),
        'span',
        {
          module: 'SpanManager',
          operation: 'handleSpanEnd',
        }
      );
    }

    const spanEndMessage: SpanMessage = {
      id: chunk.id,
      type: 'span',
      status: 'end',
      clspanId: chunk.clspanId,
      parentCLSpanId: chunk.parentCLSpanId,
      timestamp: chunk.timestamp,
      metadata: chunk.metadata,
    };
    await this.stateUpdater.updateSpan(spanEndMessage);

    // Get the updated span node from state
    const updatedState = this.stateQuery.getState();
    const updatedSpan = updatedState.spans[chunk.clspanId];
    const updatedSpanMessage = updatedState.messages[chunk.id];

    // Emit events
    this.emit('span:end', updatedSpan, updatedSpanMessage);
    this.emit('chunk:span', chunk);
  }

  /**
   * Validate chunk structure
   */
  private validateChunk(chunk: CLChunk): void {
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

    if (chunk.type === 'span') {
      this.validateSpanChunk(chunk as SpanCLChunk);
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
   * Get most recent open span by name
   */
  getMostRecentOpenSpanId(name: string): string | null {
    return this.stateQuery.getMostRecentOpenSpanId(name);
  }
}
