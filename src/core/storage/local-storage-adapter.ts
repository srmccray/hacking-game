/**
 * LocalStorage Adapter
 *
 * Implements the StorageAdapter interface using browser localStorage.
 * Wraps synchronous localStorage API with Promises for interface compliance.
 *
 * This is the default adapter for web browsers.
 */

import type { StorageAdapter } from './storage-adapter';

/**
 * Storage adapter that wraps browser localStorage.
 * Provides async interface for consistency with other adapters.
 */
export class LocalStorageAdapter implements StorageAdapter {
  /**
   * Retrieve a value from localStorage.
   *
   * @param key - The key to retrieve
   * @returns The stored value, or null if not found
   */
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  /**
   * Store a value in localStorage.
   *
   * @param key - The key to store under
   * @param value - The value to store
   */
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  /**
   * Remove a value from localStorage.
   *
   * @param key - The key to remove
   */
  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}
