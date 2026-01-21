/**
 * Storage Adapter Interface
 *
 * Provides an abstraction layer for storage operations, enabling cross-platform
 * game saves. This interface allows swapping storage backends (localStorage,
 * IndexedDB, Capacitor Preferences, cloud sync, etc.) without modifying the
 * SaveManager logic.
 *
 * All methods are async to support backends that require asynchronous operations
 * (e.g., IndexedDB, network storage).
 *
 * Usage:
 *   import type { StorageAdapter } from './storage-adapter';
 *
 *   class MyStorageAdapter implements StorageAdapter {
 *     async getItem(key: string): Promise<string | null> { ... }
 *     async setItem(key: string, value: string): Promise<void> { ... }
 *     async removeItem(key: string): Promise<void> { ... }
 *     async keys(): Promise<string[]> { ... }
 *   }
 */

// ============================================================================
// Storage Adapter Interface
// ============================================================================

/**
 * Abstract interface for storage backends.
 *
 * Mirrors the Web Storage API with async methods for compatibility with
 * asynchronous storage backends. Each method returns a Promise to allow
 * for non-blocking operations.
 *
 * Implementations should handle their own error recovery and should not throw
 * unless the operation definitively failed. For read operations, returning null
 * on error is acceptable.
 */
export interface StorageAdapter {
  /**
   * Retrieve a value from storage.
   *
   * @param key - The key to retrieve
   * @returns The stored value as a string, or null if not found
   *
   * @example
   * ```typescript
   * const data = await adapter.getItem('save-slot-0');
   * if (data) {
   *   const state = JSON.parse(data);
   * }
   * ```
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Store a value in storage.
   *
   * @param key - The key to store under
   * @param value - The string value to store
   *
   * @example
   * ```typescript
   * const state = { version: '2.0.0', resources: { money: '1000' } };
   * await adapter.setItem('save-slot-0', JSON.stringify(state));
   * ```
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Remove a value from storage.
   *
   * @param key - The key to remove
   *
   * @example
   * ```typescript
   * await adapter.removeItem('save-slot-0');
   * ```
   */
  removeItem(key: string): Promise<void>;

  /**
   * Get all keys in storage.
   *
   * For adapters that use key prefixing, this should return all keys
   * (the SaveManager handles prefix filtering).
   *
   * @returns Array of all keys in storage
   *
   * @example
   * ```typescript
   * const allKeys = await adapter.keys();
   * const saveSlotKeys = allKeys.filter(k => k.startsWith('hacker-incremental-slot-'));
   * ```
   */
  keys(): Promise<string[]>;
}

// ============================================================================
// Storage Error Types
// ============================================================================

/**
 * Error type for storage operations.
 * Provides additional context about what operation failed.
 */
export class StorageError extends Error {
  /** The operation that failed */
  readonly operation: 'get' | 'set' | 'remove' | 'keys';
  /** The key involved, if any */
  readonly key: string | undefined;
  /** The underlying error, if any */
  readonly storageCause: Error | undefined;

  constructor(
    message: string,
    operation: 'get' | 'set' | 'remove' | 'keys',
    key?: string,
    cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
    this.operation = operation;
    this.key = key;
    this.storageCause = cause;
  }
}
