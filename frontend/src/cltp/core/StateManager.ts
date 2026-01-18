/**
 * State management system for CLTP sessions
 * 提供不可变状态更新和事件发射
 *
 * 简化版本：专注于 OpenManus 的核心功能，无需持久化存储
 */

import type {
  SessionState,
  SpanNode,
  AggregationWork,
  SpanTree,
} from '../types/session';
import type { CLMessage, SpanMessage, ContentMessage } from '../types/messages';
import type { SessionEventEmitter } from './SessionEventEmitter';
import type { ErrorHandler } from './ErrorHandler';
import { createCLTPError } from '../utils/errors';

/**
 * State updater interface for controlled state modifications
 */
export interface StateUpdater<Payloads = any> {
  /** Update span information */
  updateSpan(span: SpanMessage): Promise<void>;

  /** Update aggregation work */
  updateAggregation(work: AggregationWork<Payloads>): void;

  /** Finalize message and move from aggregations to messages */
  finalizeMessage(message: CLMessage<Payloads>): Promise<void>;

  /** Remove aggregation work (when finalized) */
  removeAggregation(clmessageId: string): void;

  /** Update last heartbeat timestamp */
  setLastHeartbeat(timestamp: number): void;

  /** Set aggregation work */
  setAggregationWork(work: AggregationWork<Payloads>): void;

  /** Remove aggregation work */
  removeAggregationWork(clmessageId: string): void;
}

/**
 * State query interface for read-only state access
 */
export interface StateQuery<Payloads = any> {
  /** Get current readonly state */
  getState(): Readonly<SessionState<Payloads>>;

  /** Get span tree structure */
  getSpanTree(): SpanTree;

  /** Get messages for a specific span */
  getMessagesBySpan(spanId: string): CLMessage<Payloads>[];

  /** Get span by ID */
  getSpanById(spanId: string): SpanNode | undefined;

  /** Get child spans of a parent span */
  getChildSpans(parentSpanId: string): SpanNode[];

  /** Get aggregation work for a message */
  getAggregationWork(
    clmessageId: string
  ): AggregationWork<Payloads> | undefined;

  /** Get message by ID */
  getMessage(clmessageId: string): CLMessage<Payloads> | undefined;

  /** Get most recent open span by name */
  getMostRecentOpenSpanId(name: string): string | null;
}

/**
 * State manager interface
 */
export interface StateManager<Payloads = any>
  extends StateQuery<Payloads>, StateUpdater<Payloads> {
  /** Add a finalized message */
  addMessage(message: CLMessage<Payloads>): Promise<void>;

  /** Update connection status */
  setConnectionStatus(connected: boolean): void;

  /** Clear all state */
  clear(): Promise<void>;
}

/**
 * State manager implementation with immutable updates
 * 简化版本：无需持久化存储，仅内存状态管理
 */
export class StateManagerImpl<
  Payloads = any,
> implements StateManager<Payloads> {
  private state: SessionState<Payloads>;
  private readonly eventEmitter: SessionEventEmitter<Payloads>;
  private readonly errorHandler: ErrorHandler<Payloads>;

  constructor(
    conversationId: string,
    eventEmitter: SessionEventEmitter<Payloads>,
    errorHandler: ErrorHandler<Payloads>,
    initialState?: Partial<SessionState<Payloads>>
  ) {
    this.eventEmitter = eventEmitter;
    this.errorHandler = errorHandler;

    // Initialize state with defaults
    this.state = {
      spans: {},
      spanChildren: {},
      messages: {},
      aggregations: {},
      spanMessageMapping: {},
      connected: false,
      ...initialState,
    };
  }

  /**
   * Get current readonly state
   */
  getState(): Readonly<SessionState<Payloads>> {
    return Object.freeze({ ...this.state });
  }

  /**
   * Update span information with immutable state update
   */
  async updateSpan(span: SpanMessage): Promise<void> {
    try {
      // Prevent self-nesting: a span cannot be its own parent
      const validatedParentId =
        span.parentCLSpanId && span.parentCLSpanId !== span.clspanId
          ? span.parentCLSpanId
          : null;

      // Create span node from span message
      const spanNode: SpanNode = {
        id: span.clspanId,
        parentCLSpanId: validatedParentId,
        name: span.metadata.name,
        status: span.status === 'start' ? 'open' : 'closed',
        outcome: span.metadata.outcome,
        error: span.metadata.error,
        startedAt:
          span.status === 'start'
            ? span.timestamp
            : this.state.spans[span.clspanId]?.startedAt,
        endedAt: span.status === 'end' ? span.timestamp : undefined,
      };

      // Update spans with immutable update
      const newSpans = { ...this.state.spans, [span.clspanId]: spanNode };

      // Update span children index
      const newSpanChildren = { ...this.state.spanChildren };
      if (validatedParentId) {
        const siblings = newSpanChildren[validatedParentId] || [];
        if (!siblings.includes(span.clspanId)) {
          newSpanChildren[validatedParentId] = [...siblings, span.clspanId];
        }
      }

      // Add span message to messages
      const newMessages = { ...this.state.messages, [span.id]: span };

      // Update span message mapping
      const newSpanMessageMapping = { ...this.state.spanMessageMapping };
      if (span.status === 'start') {
        const existing = newSpanMessageMapping[span.clspanId];
        newSpanMessageMapping[span.clspanId] = [
          span.id,
          existing ? existing[1] : undefined,
        ];
      } else if (span.status === 'end') {
        const existing = newSpanMessageMapping[span.clspanId];
        if (existing) {
          newSpanMessageMapping[span.clspanId] = [existing[0], span.id];
        } else {
          newSpanMessageMapping[span.clspanId] = [span.id, span.id];
        }
      }

      // Create new state
      this.state = {
        ...this.state,
        spans: newSpans,
        spanChildren: newSpanChildren,
        messages: newMessages,
        spanMessageMapping: newSpanMessageMapping,
      };

      // Emit state change event
      this.eventEmitter.emit('state:changed', this.getState());
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'state',
        {
          module: 'StateManager',
          operation: 'updateSpan',
          spanId: span.clspanId,
        }
      );
    }
  }

  /**
   * Update aggregation work
   */
  updateAggregation(work: AggregationWork<Payloads>): void {
    this.setAggregationWork(work);
  }

  /**
   * Set aggregation work
   */
  setAggregationWork(work: AggregationWork<Payloads>): void {
    this.state = {
      ...this.state,
      aggregations: {
        ...this.state.aggregations,
        [work.clmessageId]: work,
      },
    };
    this.eventEmitter.emit('state:changed', this.getState());
  }

  /**
   * Remove aggregation work
   */
  removeAggregationWork(clmessageId: string): void {
    const newAggregations = { ...this.state.aggregations };
    delete newAggregations[clmessageId];
    this.state = {
      ...this.state,
      aggregations: newAggregations,
    };
    this.eventEmitter.emit('state:changed', this.getState());
  }

  /**
   * Remove aggregation work (alias)
   */
  removeAggregation(clmessageId: string): void {
    this.removeAggregationWork(clmessageId);
  }

  /**
   * Finalize message and move from aggregations to messages
   */
  async finalizeMessage(message: CLMessage<Payloads>): Promise<void> {
    try {
      // Remove from aggregations
      this.removeAggregationWork(message.id);

      // Add to messages
      await this.addMessage(message);
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'state',
        {
          module: 'StateManager',
          operation: 'finalizeMessage',
          messageId: message.id,
        }
      );
    }
  }

  /**
   * Add a finalized message
   */
  async addMessage(message: CLMessage<Payloads>): Promise<void> {
    try {
      const newMessages = { ...this.state.messages, [message.id]: message };

      // Update span children if message has parent span
      const newSpanChildren = { ...this.state.spanChildren };
      if (message.parentCLSpanId) {
        const siblings = newSpanChildren[message.parentCLSpanId] || [];
        if (!siblings.includes(message.id)) {
          newSpanChildren[message.parentCLSpanId] = [...siblings, message.id];
        }
      }

      this.state = {
        ...this.state,
        messages: newMessages,
        spanChildren: newSpanChildren,
      };

      this.eventEmitter.emit('state:changed', this.getState());
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'state',
        {
          module: 'StateManager',
          operation: 'addMessage',
          messageId: message.id,
        }
      );
    }
  }

  /**
   * Update last heartbeat timestamp
   */
  setLastHeartbeat(timestamp: number): void {
    this.state = {
      ...this.state,
      lastHeartbeatAt: timestamp,
    };
  }

  /**
   * Update connection status
   */
  setConnectionStatus(connected: boolean): void {
    this.state = {
      ...this.state,
      connected,
    };
    this.eventEmitter.emit('state:changed', this.getState());
  }

  /**
   * Get span tree structure
   */
  getSpanTree(): SpanTree {
    const rootIds: string[] = [];
    const nodes: Record<string, SpanNode> = { ...this.state.spans };
    const children: Record<string, string[]> = { ...this.state.spanChildren };

    // Find root spans (no parent)
    for (const spanId in nodes) {
      if (!nodes[spanId].parentCLSpanId) {
        rootIds.push(spanId);
      }
    }

    return { rootIds, nodes, children };
  }

  /**
   * Get messages for a specific span
   */
  getMessagesBySpan(spanId: string): CLMessage<Payloads>[] {
    const childIds = this.state.spanChildren[spanId] || [];
    return childIds
      .map(id => this.state.messages[id])
      .filter((msg): msg is CLMessage<Payloads> => msg !== undefined);
  }

  /**
   * Get span by ID
   */
  getSpanById(spanId: string): SpanNode | undefined {
    return this.state.spans[spanId];
  }

  /**
   * Get child spans of a parent span
   */
  getChildSpans(parentSpanId: string): SpanNode[] {
    const childIds = this.state.spanChildren[parentSpanId] || [];
    return childIds
      .map(id => this.state.spans[id])
      .filter((span): span is SpanNode => span !== undefined);
  }

  /**
   * Get aggregation work for a message
   */
  getAggregationWork(
    clmessageId: string
  ): AggregationWork<Payloads> | undefined {
    return this.state.aggregations[clmessageId];
  }

  /**
   * Get message by ID
   */
  getMessage(clmessageId: string): CLMessage<Payloads> | undefined {
    return this.state.messages[clmessageId];
  }

  /**
   * Get most recent open span by name
   */
  getMostRecentOpenSpanId(name: string): string | null {
    const spans = Object.values(this.state.spans);
    const openSpans = spans.filter(
      span => span.name === name && span.status === 'open'
    );
    if (openSpans.length === 0) {
      return null;
    }
    // Sort by startedAt (most recent first)
    openSpans.sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return bTime - aTime;
    });
    return openSpans[0].id;
  }

  /**
   * Get all pending aggregations
   */
  getPendingAggregations(): Record<string, AggregationWork<Payloads>> {
    return { ...this.state.aggregations };
  }

  /**
   * Clear all state
   */
  async clear(): Promise<void> {
    this.state = {
      spans: {},
      spanChildren: {},
      messages: {},
      aggregations: {},
      spanMessageMapping: {},
      connected: false,
    };
    this.eventEmitter.emit('state:changed', this.getState());
  }
}
