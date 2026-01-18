/**
 * Generic EventEmitter class with TypeScript support
 * 提供类型安全的事件发射和订阅功能
 */

export type EventMap = Record<string, (...args: any[]) => void> & {
  [K: string]: (...args: any[]) => void;
};
export type EventKey<T extends EventMap> = string & keyof T;
export type EventReceiver<T> = T extends (...args: any[]) => void ? T : never;

export interface Unsubscribe {
  (): void;
}

/**
 * Generic EventEmitter with strong TypeScript support
 * @template T - Event map defining event names and their handler signatures
 */
export class EventEmitter<T extends EventMap> {
  private listeners: Map<keyof T, Set<EventReceiver<T[keyof T]>>> = new Map();
  private disposed: boolean = false;

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function for cleanup
   */
  on<K extends EventKey<T>>(
    event: K,
    handler: EventReceiver<T[K]>
  ): Unsubscribe {
    if (this.disposed) {
      return () => {}; // Return no-op unsubscribe function
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const eventListeners = this.listeners.get(event)!;
    eventListeners.add(handler as EventReceiver<T[keyof T]>);

    // Return unsubscribe function
    return () => {
      eventListeners.delete(handler as EventReceiver<T[keyof T]>);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  off<K extends EventKey<T>>(event: K, handler: EventReceiver<T[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(handler as EventReceiver<T[keyof T]>);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event name
   * @param args - Arguments to pass to event handlers
   */
  emit<K extends EventKey<T>>(event: K, ...args: Parameters<T[K]>): void {
    // Don't emit if disposed
    if (this.disposed) {
      return;
    }

    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      // Create a copy of the listeners set to avoid issues if handlers modify the set
      const listenersArray = Array.from(eventListeners);
      for (const handler of listenersArray) {
        try {
          (handler as any)(...args);
        } catch (error) {
          // Emit error events for handler errors, but don't let them break other handlers
          console.error(
            `Error in event handler for '${String(event)}':`,
            error
          );
        }
      }
    }
  }

  /**
   * Subscribe to an event only once
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function for cleanup
   */
  once<K extends EventKey<T>>(
    event: K,
    handler: EventReceiver<T[K]>
  ): Unsubscribe {
    const onceHandler = ((...args: Parameters<T[K]>) => {
      unsubscribe();
      (handler as any)(...args);
    }) as EventReceiver<T[K]>;

    const unsubscribe = this.on(event, onceHandler);
    return unsubscribe;
  }

  /**
   * Remove all listeners for a specific event or all events
   * @param event - Optional event name. If not provided, removes all listeners
   */
  removeAllListeners<K extends EventKey<T>>(event?: K): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for a specific event
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount<K extends EventKey<T>>(event: K): number {
    const eventListeners = this.listeners.get(event);
    return eventListeners ? eventListeners.size : 0;
  }

  /**
   * Get all event names that have listeners
   * @returns Array of event names
   */
  eventNames(): Array<keyof T> {
    return Array.from(this.listeners.keys());
  }

  /**
   * Check if there are any listeners for a specific event
   * @param event - Event name
   * @returns True if there are listeners
   */
  hasListeners<K extends EventKey<T>>(event: K): boolean {
    return this.listenerCount(event) > 0;
  }

  /**
   * Clean up all listeners and resources
   * Should be called when the EventEmitter is no longer needed
   */
  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}
