/**
 * Typed Event Bus
 *
 * A lightweight event emitter for cross-system communication in the game.
 * Provides type-safe event emission and subscription with automatic cleanup.
 *
 * Usage:
 *   const eventBus = new EventBus();
 *
 *   // Subscribe to an event (returns unsubscribe function)
 *   const unsubscribe = eventBus.on('minigame:completed', (data) => {
 *     console.log('Minigame completed:', data.score);
 *   });
 *
 *   // Emit an event
 *   eventBus.emit('minigame:completed', { minigameId: 'code-breaker', score: 1000 });
 *
 *   // Unsubscribe when done
 *   unsubscribe();
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Callback type for event handlers.
 * @template T - The type of data passed to the handler
 */
export type EventCallback<T = unknown> = (data: T) => void;

/**
 * Base interface for typed event maps.
 * Event maps should extend this to define their own event types.
 *
 * @example
 * ```typescript
 * interface MyEvents extends EventMap {
 *   'user:login': { userId: string };
 *   'user:logout': void;
 * }
 *
 * const bus = new EventBus<MyEvents>();
 * bus.on('user:login', (data) => console.log(data.userId));
 * ```
 */
export interface EventMap {
  [key: string]: unknown;
}

// ============================================================================
// EventBus Class
// ============================================================================

/**
 * Generic typed event bus for pub/sub communication.
 *
 * @template T - Optional event map type for strict typing
 *
 * @example
 * ```typescript
 * // Untyped usage (any string event, unknown data)
 * const bus = new EventBus();
 *
 * // Typed usage (strict event names and data types)
 * interface GameEvents {
 *   'score:changed': { oldScore: number; newScore: number };
 *   'game:over': { finalScore: number };
 * }
 * const typedBus = new EventBus<GameEvents>();
 * ```
 */
export class EventBus<T extends EventMap = EventMap> {
  /**
   * Map of event names to their registered callbacks.
   */
  private readonly listeners: Map<keyof T, Set<EventCallback<unknown>>> = new Map();

  /**
   * Subscribe to an event.
   *
   * @param event - The event name to subscribe to
   * @param callback - The function to call when the event is emitted
   * @returns An unsubscribe function that removes this listener
   *
   * @example
   * ```typescript
   * const unsubscribe = eventBus.on('minigame:completed', (data) => {
   *   console.log('Score:', data.score);
   * });
   *
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   */
  on<K extends keyof T>(event: K, callback: EventCallback<T[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const callbacks = this.listeners.get(event)!;
    callbacks.add(callback as EventCallback<unknown>);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback as EventCallback<unknown>);
      // Clean up empty sets
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Subscribe to an event for only one emission.
   * The listener is automatically removed after being called once.
   *
   * @param event - The event name to subscribe to
   * @param callback - The function to call when the event is emitted
   * @returns An unsubscribe function (in case you want to cancel before emission)
   */
  once<K extends keyof T>(event: K, callback: EventCallback<T[K]>): () => void {
    const wrapper: EventCallback<T[K]> = (data) => {
      unsubscribe();
      callback(data);
    };

    const unsubscribe = this.on(event, wrapper);
    return unsubscribe;
  }

  /**
   * Emit an event, calling all registered listeners.
   *
   * @param event - The event name to emit
   * @param data - The data to pass to listeners
   *
   * @example
   * ```typescript
   * eventBus.emit('minigame:completed', {
   *   minigameId: 'code-breaker',
   *   score: 1000,
   *   maxCombo: 5,
   * });
   * ```
   */
  emit<K extends keyof T>(event: K, data: T[K]): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) {
      return;
    }

    // Iterate over a copy in case callbacks modify the set
    for (const callback of Array.from(callbacks)) {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventBus] Error in listener for '${String(event)}':`, error);
      }
    }
  }

  /**
   * Remove a specific listener or all listeners for an event.
   *
   * @param event - The event name
   * @param callback - Optional specific callback to remove. If omitted, removes all listeners for the event.
   */
  off<K extends keyof T>(event: K, callback?: EventCallback<T[K]>): void {
    if (!callback) {
      // Remove all listeners for this event
      this.listeners.delete(event);
      return;
    }

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Remove all listeners for all events.
   * Useful for cleanup when destroying the event bus.
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Check if an event has any listeners.
   *
   * @param event - The event name to check
   * @returns true if there are listeners for this event
   */
  hasListeners<K extends keyof T>(event: K): boolean {
    const callbacks = this.listeners.get(event);
    return callbacks !== undefined && callbacks.size > 0;
  }

  /**
   * Get the number of listeners for an event.
   *
   * @param event - The event name
   * @returns The number of listeners
   */
  listenerCount<K extends keyof T>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get all registered event names.
   *
   * @returns Array of event names that have listeners
   */
  getEventNames(): (keyof T)[] {
    return Array.from(this.listeners.keys());
  }
}
