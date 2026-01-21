/**
 * Storage Adapter Interface
 *
 * Provides an abstraction layer for storage operations, enabling cross-platform
 * game saves. This interface allows swapping storage backends (localStorage,
 * IndexedDB, Capacitor Preferences, etc.) without modifying the save system logic.
 *
 * All methods are async to support backends that require asynchronous operations.
 */

/**
 * Interface for storage adapters.
 * Mirrors the Web Storage API but with async methods.
 */
export interface StorageAdapter {
  /**
   * Retrieve a value from storage.
   *
   * @param key - The key to retrieve
   * @returns The stored value, or null if not found
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Store a value in storage.
   *
   * @param key - The key to store under
   * @param value - The value to store
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Remove a value from storage.
   *
   * @param key - The key to remove
   */
  removeItem(key: string): Promise<void>;
}
