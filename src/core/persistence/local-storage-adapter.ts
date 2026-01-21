/**
 * LocalStorage Adapter
 *
 * Implements the StorageAdapter interface using browser localStorage.
 * Wraps the synchronous localStorage API with Promises for interface compliance.
 *
 * This is the default adapter for web browsers. The async wrapper allows the
 * SaveManager to work identically with both synchronous (localStorage) and
 * asynchronous (IndexedDB, cloud) storage backends.
 *
 * Usage:
 *   import { LocalStorageAdapter } from './local-storage-adapter';
 *
 *   const adapter = new LocalStorageAdapter();
 *   await adapter.setItem('key', 'value');
 *   const value = await adapter.getItem('key');
 */

import type { StorageAdapter } from './storage-adapter';
import { StorageError } from './storage-adapter';

// ============================================================================
// LocalStorage Adapter
// ============================================================================

/**
 * Storage adapter that wraps browser localStorage.
 *
 * Provides an async interface for consistency with other storage backends.
 * All operations complete synchronously but return Promises for API uniformity.
 *
 * Note: localStorage has a 5-10MB limit in most browsers. For games with
 * extensive save data, consider using IndexedDB instead.
 */
export class LocalStorageAdapter implements StorageAdapter {
  /**
   * Check if localStorage is available.
   * This handles cases where localStorage is disabled or unavailable
   * (e.g., private browsing mode in some browsers, sandboxed iframes).
   *
   * @returns true if localStorage is available
   */
  static isAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve a value from localStorage.
   *
   * @param key - The key to retrieve
   * @returns The stored value as a string, or null if not found
   * @throws StorageError if localStorage access fails
   */
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      throw new StorageError(
        `Failed to read from localStorage: ${key}`,
        'get',
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Store a value in localStorage.
   *
   * @param key - The key to store under
   * @param value - The string value to store
   * @throws StorageError if localStorage access fails (e.g., quota exceeded)
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      throw new StorageError(
        `Failed to write to localStorage: ${key}`,
        'set',
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Remove a value from localStorage.
   *
   * @param key - The key to remove
   * @throws StorageError if localStorage access fails
   */
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      throw new StorageError(
        `Failed to remove from localStorage: ${key}`,
        'remove',
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all keys in localStorage.
   *
   * @returns Array of all keys in localStorage
   * @throws StorageError if localStorage access fails
   */
  async keys(): Promise<string[]> {
    try {
      const result: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) {
          result.push(key);
        }
      }
      return result;
    } catch (error) {
      throw new StorageError(
        'Failed to enumerate localStorage keys',
        'keys',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clear all items from localStorage.
   * This is not part of the StorageAdapter interface but useful for testing.
   *
   * Note: This clears ALL localStorage items, not just game saves.
   * Use with caution in production.
   */
  async clear(): Promise<void> {
    try {
      // Use manual key removal for better compatibility with test environments
      // (jsdom's localStorage.clear() can be unreliable)
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) {
          keys.push(key);
        }
      }
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      throw new StorageError(
        'Failed to clear localStorage',
        'remove',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }
}
