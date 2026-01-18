/**
 * Session event emitter implementation
 * 提供类型安全的事件发射和订阅功能
 */

import { EventEmitter } from './EventEmitter';
import type { SessionEventsMap } from '../types/events';

// Create a compatible event map type
type CompatibleEventMap<T> = T & Record<string, (...args: any[]) => void>;

export type Unsub = () => void;

/**
 * Session event emitter interface
 */
export interface SessionEvents<Payloads = any> {
  on<K extends keyof SessionEventsMap<Payloads>>(
    event: K,
    handler: SessionEventsMap<Payloads>[K]
  ): Unsub;

  off<K extends keyof SessionEventsMap<Payloads>>(
    event: K,
    handler: SessionEventsMap<Payloads>[K]
  ): void;

  emit<K extends keyof SessionEventsMap<Payloads>>(
    event: K,
    ...args: Parameters<SessionEventsMap<Payloads>[K]>
  ): void;

  once<K extends keyof SessionEventsMap<Payloads>>(
    event: K,
    handler: SessionEventsMap<Payloads>[K]
  ): Unsub;

  removeAllListeners<K extends keyof SessionEventsMap<Payloads>>(event?: K): void;

  listenerCount<K extends keyof SessionEventsMap<Payloads>>(event: K): number;

  eventNames(): Array<keyof SessionEventsMap<Payloads>>;

  hasListeners<K extends keyof SessionEventsMap<Payloads>>(event: K): boolean;

  dispose(): void;
}

/**
 * Session event emitter that implements the SessionEvents interface
 * @template Payloads - Channel payload types for type-safe content events
 */
export class SessionEventEmitter<
  Payloads = any,
> implements SessionEvents<Payloads> {
  private emitter: EventEmitter<CompatibleEventMap<SessionEventsMap<Payloads>>>;

  constructor() {
    this.emitter = new EventEmitter<
      CompatibleEventMap<SessionEventsMap<Payloads>>
    >();
  }

  // Implement the SessionEvents interface methods with proper typing
  on<K extends keyof SessionEventsMap<Payloads>>(
    event: K,
    handler: SessionEventsMap<Payloads>[K]
  ): Unsub {
    return this.emitter.on(event as string, handler as any);
  }

  off<K extends keyof SessionEventsMap<Payloads>>(
    event: K,
    handler: SessionEventsMap<Payloads>[K]
  ): void {
    return this.emitter.off(event as string, handler as any);
  }

  emit<K extends keyof SessionEventsMap<Payloads>>(
    event: K,
    ...args: Parameters<SessionEventsMap<Payloads>[K]>
  ): void {
    return this.emitter.emit(event as string, ...args);
  }

  once<K extends keyof SessionEventsMap<Payloads>>(
    event: K,
    handler: SessionEventsMap<Payloads>[K]
  ): Unsub {
    return this.emitter.once(event as string, handler as any);
  }

  removeAllListeners<K extends keyof SessionEventsMap<Payloads>>(
    event?: K
  ): void {
    return this.emitter.removeAllListeners(event as string);
  }

  listenerCount<K extends keyof SessionEventsMap<Payloads>>(event: K): number {
    return this.emitter.listenerCount(event as string);
  }

  eventNames(): Array<keyof SessionEventsMap<Payloads>> {
    return this.emitter.eventNames() as Array<keyof SessionEventsMap<Payloads>>;
  }

  hasListeners<K extends keyof SessionEventsMap<Payloads>>(event: K): boolean {
    return this.emitter.hasListeners(event as string);
  }

  dispose(): void {
    return this.emitter.dispose();
  }

  // Type marker for payload types
  _payloads?: Payloads;
}
