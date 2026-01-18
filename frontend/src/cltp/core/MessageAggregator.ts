/**
 * Message Aggregator Implementation
 * 处理 content chunk 的增量聚合，使用频道特定的聚合逻辑
 *
 * 关键保护：文本内容的完整性
 * - plain 和 think 频道的 reduce 函数必须保证文本内容原样
 */

import type { ContentCLChunk } from '../types/chunks';
import type { ContentMessage } from '../types/messages';
import type { AggregationWork } from '../types/session';
import { ChannelRegistry } from './ChannelRegistry';
import { createCLTPError } from '../utils/errors';
import { StateUpdater, StateQuery } from './StateManager';
import type { ErrorHandler } from './ErrorHandler';

/**
 * Message Aggregator for content chunk processing
 */
export class MessageAggregator<
  Payloads extends Record<string, any> = Record<string, any>,
> {
  private channelRegistry: ChannelRegistry<Payloads>;
  private stateUpdater: StateUpdater<Payloads>;
  private stateQuery: StateQuery<Payloads>;
  private errorHandler: ErrorHandler<Payloads>;
  private onPartialMessage?: (message: ContentMessage<Payloads>) => void;
  private onCompleteMessage?: (message: ContentMessage<Payloads>) => void;

  constructor(
    channelRegistry: ChannelRegistry<Payloads>,
    stateUpdater: StateUpdater<Payloads>,
    stateQuery: StateQuery<Payloads>,
    errorHandler: ErrorHandler<Payloads>,
    callbacks?: {
      onPartialMessage?: (message: ContentMessage<Payloads>) => void;
      onCompleteMessage?: (message: ContentMessage<Payloads>) => void;
    }
  ) {
    this.channelRegistry = channelRegistry;
    this.stateUpdater = stateUpdater;
    this.stateQuery = stateQuery;
    this.errorHandler = errorHandler;
    this.onPartialMessage = callbacks?.onPartialMessage;
    this.onCompleteMessage = callbacks?.onCompleteMessage;
  }

  /**
   * Process a content chunk and update aggregation state
   * @param chunk Content chunk to process
   */
  async processContentChunk(chunk: ContentCLChunk<Payloads>): Promise<void> {
    try {
      const { clmessageId } = chunk;

      // Check if message is already finalized
      if (this.stateQuery.getMessage(clmessageId)) {
        // Message already finalized, ignore additional chunks
        return;
      }

      // Get or create aggregation work
      let work = this.stateQuery.getAggregationWork(clmessageId);
      if (!work) {
        work = this.createAggregationWork(chunk);
        this.stateUpdater.setAggregationWork(work);
      }

      // Validate chunk consistency
      this.validateChunkConsistency(chunk, work);

      // Check for duplicate chunks
      const existingChunk = work.payloadPieces.find(p => p.id === chunk.id);
      if (existingChunk) {
        const error = this.errorHandler.handleError(
          new Error(`Duplicate chunk: ${chunk.id}`),
          'validation',
          {
            module: 'MessageAggregator',
            operation: 'processContentChunk',
            chunkId: chunk.id,
            messageId: clmessageId,
          }
        );
        throw error;
      }

      // Add chunk to aggregation
      work.payloadPieces.push(chunk);
      work.lastUpdatedAt = Date.now();

      // Sort chunks by sequence
      work.payloadPieces.sort((a, b) => a.sequence - b.sequence);

      // Update done status
      if (chunk.metadata.done) {
        work.done = true;
      }

      // Update aggregation work in state
      this.stateUpdater.setAggregationWork(work);

      // Perform channel-specific reduction with sorted chunks
      await this.performReductionFromSortedChunks(work);

      // Create and emit partial message
      const partialMessage = this.createMessage(work);
      this.emitPartialMessage(partialMessage);

      // If done, finalize the message
      if (work.done) {
        await this.finalizeMessage(clmessageId, 'normal');
      }
    } catch (error) {
      const cltpError = this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error'),
        'aggregation',
        {
          module: 'MessageAggregator',
          operation: 'processContentChunk',
          chunkId: chunk.id,
          messageId: chunk.clmessageId,
        }
      );
      throw cltpError;
    }
  }

  /**
   * Perform reduction from sorted chunks
   * 关键：对于 plain 和 think 频道，reduce 函数必须保证文本内容原样
   */
  private async performReductionFromSortedChunks(
    work: AggregationWork<Payloads>
  ): Promise<void> {
    // Start with initial value
    let reduced = this.channelRegistry.getInitialValue(work.channel);

    // Reduce all chunks in sequence order
    for (const chunk of work.payloadPieces) {
      // 关键：使用 ChannelRegistry 的 reduce 函数，保证文本内容原样
      reduced = this.channelRegistry.reduce(work.channel, reduced, chunk);
    }

    // Update reduced payload
    work.reducedPayload = reduced;
  }

  /**
   * Create message from aggregation work
   */
  private createMessage(work: AggregationWork<Payloads>): ContentMessage<Payloads> {
    const firstChunk = work.payloadPieces[0];
    if (!firstChunk) {
      throw new Error('Cannot create message from empty aggregation work');
    }

    return {
      type: 'content',
      id: work.clmessageId,
      parentCLSpanId: work.parentCLSpanId,
      timestamp: firstChunk.timestamp,
      metadata: {
        channel: work.channel,
        payload: work.reducedPayload,
        done: work.done,
      },
    };
  }

  /**
   * Emit partial message event
   */
  private emitPartialMessage(message: ContentMessage<Payloads>): void {
    this.onPartialMessage?.(message);
  }

  /**
   * Emit complete message event
   */
  private emitCompleteMessage(message: ContentMessage<Payloads>): void {
    this.onCompleteMessage?.(message);
  }

  /**
   * Finalize a message and move it from aggregations to messages
   * @param clmessageId Message ID to finalize
   * @param reason Finalization reason
   */
  async finalizeMessage(
    clmessageId: string,
    reason: 'normal' | 'interrupted' | 'closed' = 'normal'
  ): Promise<ContentMessage<Payloads>> {
    const work = this.stateQuery.getAggregationWork(clmessageId);
    if (!work) {
      throw createCLTPError(
        'AGGREGATION_CONFLICT',
        `Cannot finalize message: aggregation work not found for ${clmessageId}`,
        { clmessageId }
      );
    }

    // Update work with finalization reason
    work.reason = reason;
    work.done = true;

    // Update aggregation work in state
    this.stateUpdater.setAggregationWork(work);

    // Create final message
    const finalMessage = this.createMessage(work);
    finalMessage.metadata.done = true;

    // Finalize message (stores message and removes aggregation)
    await this.stateUpdater.finalizeMessage(finalMessage);

    // Emit complete message event
    this.emitCompleteMessage(finalMessage);

    return finalMessage;
  }

  /**
   * Finalize all pending aggregations (used for interruption)
   * @param reason Finalization reason
   */
  async finalizeAllPendingMessages(
    reason: 'interrupted' | 'closed' = 'interrupted'
  ): Promise<ContentMessage<Payloads>[]> {
    const finalizedMessages: ContentMessage<Payloads>[] = [];
    const pendingAggregations = this.stateQuery.getPendingAggregations();
    const pendingMessageIds = Object.keys(pendingAggregations);

    for (const clmessageId of pendingMessageIds) {
      try {
        const finalizedMessage = await this.finalizeMessage(
          clmessageId,
          reason
        );
        finalizedMessages.push(finalizedMessage);
      } catch (error) {
        this.errorHandler.handleError(
          error instanceof Error ? error : new Error('Unknown error'),
          'aggregation',
          {
            module: 'MessageAggregator',
            operation: 'finalizeAllPendingMessages',
            messageId: clmessageId,
          }
        );
        // Continue with other messages even if one fails
      }
    }

    return finalizedMessages;
  }

  /**
   * Create new aggregation work for a content chunk
   */
  private createAggregationWork(
    chunk: ContentCLChunk<Payloads>
  ): AggregationWork<Payloads> {
    const initialValue = this.channelRegistry.getInitialValue(
      chunk.metadata.channel
    );
    return {
      clmessageId: chunk.clmessageId,
      parentCLSpanId: chunk.parentCLSpanId,
      channel: chunk.metadata.channel,
      payloadPieces: [],
      reducedPayload: initialValue,
      done: false,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
  }

  /**
   * Validate chunk consistency with existing aggregation work
   */
  private validateChunkConsistency(
    chunk: ContentCLChunk<Payloads>,
    work: AggregationWork<Payloads>
  ): void {
    if (chunk.parentCLSpanId !== work.parentCLSpanId) {
      throw createCLTPError(
        'AGGREGATION_CONFLICT',
        `Chunk parent span mismatch: expected ${work.parentCLSpanId}, got ${chunk.parentCLSpanId}`,
        { chunk, work }
      );
    }

    if (chunk.metadata.channel !== work.channel) {
      throw createCLTPError(
        'AGGREGATION_CONFLICT',
        `Chunk channel mismatch: expected ${work.channel}, got ${chunk.metadata.channel}`,
        { chunk, work }
      );
    }
  }
}
