/**
 * Channel Registry Implementation
 * 提供类型安全的频道管理和聚合能力
 *
 * 关键保护：文本内容的完整性
 * - reduce 函数必须保证文本内容原样，不进行任何修改
 */

import type { ChannelRegistration } from '../types/adapters';
import type { ContentCLChunk } from '../types/chunks';

/**
 * Channel Registry for managing channel registrations and operations
 */
export class ChannelRegistry<
  Payloads extends Record<string, any> = Record<string, any>,
> {
  private channels = new Map<string, ChannelRegistration<string, any>>();
  private partialCallbacks = new Map<string, Function[]>();
  private completeCallbacks = new Map<string, Function[]>();

  /**
   * Register a new channel
   * @param registration Channel registration object
   * @throws Error if channel is already registered
   */
  register<K extends keyof Payloads>(
    registration: ChannelRegistration<string, Payloads[K]>
  ): void {
    if (this.channels.has(registration.name)) {
      throw new Error(`Channel '${registration.name}' is already registered`);
    }
    this.channels.set(registration.name, registration);
  }

  /**
   * Get a channel registration by name
   * @param name Channel name
   * @returns Channel registration or undefined if not found
   */
  get<K extends keyof Payloads>(
    name: K
  ): ChannelRegistration<string, Payloads[K]> | undefined {
    return this.channels.get(name as string) as
      | ChannelRegistration<string, Payloads[K]>
      | undefined;
  }

  /**
   * Get initial value for a channel
   * @param name Channel name
   * @returns Initial value for the channel
   * @throws Error if channel not found
   */
  getInitialValue<K extends keyof Payloads>(name: K): Payloads[K] {
    const channel = this.channels.get(name as string);
    if (!channel) {
      throw new Error(`Channel '${name as string}' not found`);
    }
    return channel.initialValue as Payloads[K];
  }

  /**
   * Validate payload for a channel
   * @param name Channel name
   * @param payload Payload to validate
   * @throws Error if channel not found or validation fails
   */
  validate<K extends keyof Payloads>(
    name: K,
    payload: unknown
  ): asserts payload is Payloads[K] {
    const channel = this.channels.get(name as string);
    if (!channel) {
      throw new Error(`Channel '${name as string}' is not registered`);
    }
    const validateFn: (payload: unknown) => asserts payload is Payloads[K] =
      channel.validate as (payload: unknown) => asserts payload is Payloads[K];
    validateFn(payload);
  }

  /**
   * Reduce content chunks for a channel
   *
   * 关键：对于 plain 和 think 频道，reduce 函数必须保证文本内容原样
   *
   * @param name Channel name
   * @param prev Previous payload value
   * @param chunk Content chunk to reduce
   * @returns Reduced payload
   * @throws Error if channel not found
   */
  reduce<K extends keyof Payloads>(
    name: K,
    prev: Payloads[K],
    chunk: ContentCLChunk<Payloads>
  ): Payloads[K] {
    const channel = this.channels.get(name as string);
    if (!channel) {
      throw new Error(`Channel '${name as string}' not found`);
    }
    return channel.reduce(
      prev,
      chunk as ContentCLChunk<Record<string, any>>
    ) as Payloads[K];
  }

  /**
   * Handle partial chunk for a channel
   */
  onPartial<K extends keyof Payloads>(
    name: K,
    payload: Payloads[K],
    chunk: ContentCLChunk<Payloads>
  ): void {
    const callbacks = this.partialCallbacks.get(name as string) || [];
    callbacks.forEach(callback => {
      try {
        callback(payload, chunk);
      } catch (error) {
        console.error(
          `Error in partial callback for channel '${name as string}':`,
          error
        );
      }
    });
  }

  /**
   * Handle complete chunk for a channel
   */
  onComplete<K extends keyof Payloads>(
    name: K,
    payload: Payloads[K],
    chunk: ContentCLChunk<Payloads>
  ): void {
    const callbacks = this.completeCallbacks.get(name as string) || [];
    callbacks.forEach(callback => {
      try {
        callback(payload, chunk);
      } catch (error) {
        console.error(
          `Error in complete callback for channel '${name as string}':`,
          error
        );
      }
    });
  }

  /**
   * Add a callback for partial chunks
   * @param channelName Channel name
   * @param callback Callback function
   */
  addPartialCallback(channelName: string, callback: Function): void {
    if (!this.partialCallbacks.has(channelName)) {
      this.partialCallbacks.set(channelName, []);
    }
    this.partialCallbacks.get(channelName)!.push(callback);
  }

  /**
   * Add a callback for complete chunks
   * @param channelName Channel name
   * @param callback Callback function
   */
  addCompleteCallback(channelName: string, callback: Function): void {
    if (!this.completeCallbacks.has(channelName)) {
      this.completeCallbacks.set(channelName, []);
    }
    this.completeCallbacks.get(channelName)!.push(callback);
  }

  /**
   * Get all registered channel names
   * @returns Array of channel names
   */
  getRegisteredChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Clear all registrations and callbacks
   */
  clear(): void {
    this.channels.clear();
    this.partialCallbacks.clear();
    this.completeCallbacks.clear();
  }
}
