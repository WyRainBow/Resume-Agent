/**
 * CLTPSession implementation
 * 主会话类，整合所有子系统
 *
 * 简化版本：无需 ReplayManager（需要 Redis），专注于核心功能
 */

import type { TransportAdapter, ChannelRegistration } from '../types/adapters';
import type { ConnectionState } from '../types/events';
import type { DefaultPayloads } from '../types/channels';

import { SessionEventEmitter } from './SessionEventEmitter';
import { StateManagerImpl } from './StateManager';
import { ChunkProcessorImpl } from './ChunkProcessor';
import { MessageAggregator } from './MessageAggregator';
import { SpanManager } from './SpanManager';
import { ChannelRegistry } from './ChannelRegistry';
import { ErrorHandler } from './ErrorHandler';
import { getBuiltInChannels } from './built-in-channels';

/**
 * Configuration options for CLTPSession
 */
export interface CLTPSessionConfig<Payloads extends Record<string, any> = DefaultPayloads> {
  /** Conversation ID for this session */
  conversationId: string;
  /** Transport adapter for connection management */
  transport: TransportAdapter<Payloads>;
  /** Registered channels for content processing */
  channels?: ChannelRegistration<string, Payloads[keyof Payloads]>[];
}

/**
 * CLTPSession implementation with integrated components
 * 简化版本：无需持久化存储和 ReplayManager
 */
export class CLTPSessionImpl<
  Payloads extends Record<string, any> = DefaultPayloads,
> {
  // Public interfaces
  public readonly events: SessionEventEmitter<Payloads>;

  // Core components
  private readonly eventEmitter: SessionEventEmitter<Payloads>;
  private readonly stateManager: StateManagerImpl<Payloads>;
  private readonly chunkProcessor: ChunkProcessorImpl<Payloads>;
  private readonly messageAggregator: MessageAggregator<Payloads>;
  private readonly spanManager: SpanManager;
  private readonly channelRegistry: ChannelRegistry<Payloads>;
  private readonly errorHandler: ErrorHandler;
  private readonly transport: TransportAdapter<Payloads>;

  // Configuration
  private readonly config: CLTPSessionConfig<Payloads>;
  private unsubscribeChunk?: () => void;
  private unsubscribeError?: () => void;
  private unsubscribeConnection?: () => void;

  constructor(config: CLTPSessionConfig<Payloads>) {
    this.config = config;
    this.transport = config.transport;

    // Initialize event emitter first (other components depend on it)
    this.eventEmitter = new SessionEventEmitter<Payloads>();
    this.events = this.eventEmitter;

    // Initialize error handler
    this.errorHandler = new ErrorHandler(this.eventEmitter);

    // Initialize channel registry
    this.channelRegistry = new ChannelRegistry<Payloads>();

    // Register built-in channels
    const builtInChannels = getBuiltInChannels();
    builtInChannels.forEach(channel => {
      this.channelRegistry.register(channel);
    });

    // Register custom channels if provided
    if (config.channels) {
      config.channels.forEach(channel => {
        this.channelRegistry.register(channel);
      });
    }

    // Initialize state manager (no storage/history adapters needed)
    this.stateManager = new StateManagerImpl<Payloads>(
      config.conversationId,
      this.eventEmitter,
      this.errorHandler
    );

    // Initialize span manager
    this.spanManager = new SpanManager(
      this.stateManager,
      this.stateManager,
      this.errorHandler
    );

    // Initialize message aggregator
    this.messageAggregator = new MessageAggregator<Payloads>(
      this.channelRegistry,
      this.stateManager,
      this.stateManager,
      this.errorHandler,
      {
        onPartialMessage: message =>
          this.eventEmitter.emit('message:partial', message),
        onCompleteMessage: message =>
          this.eventEmitter.emit('message:complete', message),
      }
    );

    // Initialize chunk processor
    this.chunkProcessor = new ChunkProcessorImpl<Payloads>(
      this.spanManager,
      this.messageAggregator,
      this.stateManager,
      this.stateManager,
      this.eventEmitter,
      this.errorHandler
    );
  }

  /**
   * Initialize the session
   */
  async initialize(): Promise<void> {
    try {
      // Emit session initialized event
      this.eventEmitter.emit('session:initialized', {
        conversationId: this.config.conversationId,
        withHistory: false,
      });
    } catch (error) {
      throw this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'state',
        {
          module: 'CLTPSession',
          operation: 'initialize',
        }
      );
    }
  }

  /**
   * Connect to the transport
   */
  async connect(): Promise<void> {
    try {
      // Set up transport listeners
      this.unsubscribeChunk = this.transport.onChunk((chunk) => {
        this.chunkProcessor.processChunk(chunk).catch((error) => {
          this.errorHandler.handleError(
            error instanceof Error ? error : new Error(String(error)),
            'processing',
            {
              module: 'CLTPSession',
              operation: 'processChunk',
              chunkId: chunk.id,
            }
          );
        });
      });

      this.unsubscribeError = this.transport.onError((error) => {
        this.errorHandler.handleError(error, 'network', {
          module: 'CLTPSession',
          operation: 'transportError',
        });
      });

      this.unsubscribeConnection = this.transport.onConnectionChange((connected) => {
        this.stateManager.setConnectionStatus(connected);
        if (connected) {
          this.eventEmitter.emit('connection:connected');
          this.eventEmitter.emit('transport:connected', {
            timestamp: new Date().toISOString(),
          });
        } else {
          this.eventEmitter.emit('connection:disconnected');
        }
      });

      // Connect to transport
      await this.transport.connect();
    } catch (error) {
      throw this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'network',
        {
          module: 'CLTPSession',
          operation: 'connect',
        }
      );
    }
  }

  /**
   * Close the session and cleanup resources
   */
  async close(): Promise<void> {
    try {
      // Finalize any pending messages
      await this.chunkProcessor.finalizePendingMessages('closed');

      // Disconnect from transport
      this.transport.disconnect();

      // Unsubscribe from transport events
      this.unsubscribeChunk?.();
      this.unsubscribeError?.();
      this.unsubscribeConnection?.();

      // Emit session closed event
      this.eventEmitter.emit('session:closed', {
        conversationId: this.config.conversationId,
        timestamp: new Date().toISOString(),
      });

      // Dispose event emitter
      this.eventEmitter.dispose();
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'state',
        {
          module: 'CLTPSession',
          operation: 'close',
        }
      );
      // Don't re-throw - we want to complete the close operation
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    const state = this.stateManager.getState();
    return state.connected ? 'connected' : 'disconnected';
  }

  /**
   * Check if session is connected
   */
  isConnected(): boolean {
    return this.stateManager.getState().connected;
  }

  /**
   * Get conversation ID
   */
  getConversationId(): string {
    return this.config.conversationId;
  }

  /**
   * Get state manager (for selectors)
   */
  getStateManager(): StateManagerImpl<Payloads> {
    return this.stateManager;
  }
}
