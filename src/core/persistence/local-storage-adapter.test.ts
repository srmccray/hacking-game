/**
 * Tests for LocalStorageAdapter
 *
 * Note: These tests mock the global localStorage to avoid conflicts with
 * Node v25's built-in experimental localStorage which interferes with jsdom.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageAdapter } from './local-storage-adapter';
import { StorageError } from './storage-adapter';

// ============================================================================
// Mock localStorage Implementation
// ============================================================================

/**
 * Create a fully functional mock localStorage for testing.
 * This avoids issues with Node v25's built-in localStorage and jsdom conflicts.
 */
function createMockLocalStorage(): Storage {
  let store: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string): string | null {
      return store[key] ?? null;
    },
    key(index: number): string | null {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
    removeItem(key: string): void {
      delete store[key];
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let mockStorage: Storage;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    // Save original localStorage
    originalLocalStorage = globalThis.localStorage;

    // Create and install mock localStorage
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    adapter = new LocalStorageAdapter();
  });

  afterEach(() => {
    // Restore original localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when localStorage is available', () => {
      expect(LocalStorageAdapter.isAvailable()).toBe(true);
    });

    it('should return false when localStorage throws', () => {
      // Override with a storage that throws
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          setItem: () => {
            throw new Error('Access denied');
          },
          removeItem: () => {},
        },
        writable: true,
        configurable: true,
      });

      expect(LocalStorageAdapter.isAvailable()).toBe(false);
    });
  });

  describe('getItem', () => {
    it('should return null for non-existent key', async () => {
      const result = await adapter.getItem('non-existent');
      expect(result).toBeNull();
    });

    it('should return the stored value', async () => {
      mockStorage.setItem('test-key', 'test-value');

      const result = await adapter.getItem('test-key');
      expect(result).toBe('test-value');
    });

    it('should return empty string if stored', async () => {
      mockStorage.setItem('empty', '');

      const result = await adapter.getItem('empty');
      expect(result).toBe('');
    });
  });

  describe('setItem', () => {
    it('should store a value', async () => {
      await adapter.setItem('key', 'value');

      expect(mockStorage.getItem('key')).toBe('value');
    });

    it('should overwrite existing value', async () => {
      mockStorage.setItem('key', 'old-value');

      await adapter.setItem('key', 'new-value');

      expect(mockStorage.getItem('key')).toBe('new-value');
    });

    it('should handle JSON strings', async () => {
      const data = { name: 'test', value: 123 };
      const json = JSON.stringify(data);

      await adapter.setItem('json-key', json);

      const stored = mockStorage.getItem('json-key');
      expect(stored).toBe(json);
      expect(JSON.parse(stored!)).toEqual(data);
    });

    it('should handle empty strings', async () => {
      await adapter.setItem('empty', '');

      expect(mockStorage.getItem('empty')).toBe('');
    });
  });

  describe('removeItem', () => {
    it('should remove an existing item', async () => {
      mockStorage.setItem('key', 'value');

      await adapter.removeItem('key');

      expect(mockStorage.getItem('key')).toBeNull();
    });

    it('should not throw when removing non-existent item', async () => {
      await expect(adapter.removeItem('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('keys', () => {
    it('should return empty array when storage is empty', async () => {
      const keys = await adapter.keys();
      expect(keys).toEqual([]);
    });

    it('should return all keys', async () => {
      mockStorage.setItem('key1', 'value1');
      mockStorage.setItem('key2', 'value2');
      mockStorage.setItem('key3', 'value3');

      const keys = await adapter.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('clear', () => {
    it('should clear all items', async () => {
      mockStorage.setItem('key1', 'value1');
      mockStorage.setItem('key2', 'value2');

      await adapter.clear();

      expect(mockStorage.length).toBe(0);
    });

    it('should not throw when already empty', async () => {
      await expect(adapter.clear()).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw StorageError on getItem failure', async () => {
      // Create a storage that throws on getItem
      const throwingStorage = {
        ...mockStorage,
        getItem: () => {
          throw new Error('Access denied');
        },
      } as Storage;

      Object.defineProperty(globalThis, 'localStorage', {
        value: throwingStorage,
        writable: true,
        configurable: true,
      });

      const errorAdapter = new LocalStorageAdapter();
      await expect(errorAdapter.getItem('key')).rejects.toThrow(StorageError);
      await expect(errorAdapter.getItem('key')).rejects.toThrow('Failed to read from localStorage');
    });

    it('should throw StorageError on setItem failure', async () => {
      // Create a storage that throws on setItem (quota exceeded simulation)
      const throwingStorage = {
        ...mockStorage,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      } as Storage;

      Object.defineProperty(globalThis, 'localStorage', {
        value: throwingStorage,
        writable: true,
        configurable: true,
      });

      const errorAdapter = new LocalStorageAdapter();
      await expect(errorAdapter.setItem('key', 'value')).rejects.toThrow(StorageError);
      await expect(errorAdapter.setItem('key', 'value')).rejects.toThrow(
        'Failed to write to localStorage'
      );
    });

    it('should throw StorageError on removeItem failure', async () => {
      const throwingStorage = {
        ...mockStorage,
        removeItem: () => {
          throw new Error('Access denied');
        },
      } as Storage;

      Object.defineProperty(globalThis, 'localStorage', {
        value: throwingStorage,
        writable: true,
        configurable: true,
      });

      const errorAdapter = new LocalStorageAdapter();
      await expect(errorAdapter.removeItem('key')).rejects.toThrow(StorageError);
    });

    it('should include key in StorageError', async () => {
      const throwingStorage = {
        ...mockStorage,
        getItem: () => {
          throw new Error('Test error');
        },
      } as Storage;

      Object.defineProperty(globalThis, 'localStorage', {
        value: throwingStorage,
        writable: true,
        configurable: true,
      });

      const errorAdapter = new LocalStorageAdapter();

      try {
        await errorAdapter.getItem('test-key');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        const storageError = error as StorageError;
        expect(storageError.key).toBe('test-key');
        expect(storageError.operation).toBe('get');
      }
    });
  });

  describe('async behavior', () => {
    it('should resolve immediately (synchronous under the hood)', async () => {
      const start = Date.now();

      await adapter.setItem('key', 'value');
      await adapter.getItem('key');
      await adapter.removeItem('key');

      const elapsed = Date.now() - start;
      // Should be nearly instant since localStorage is synchronous
      expect(elapsed).toBeLessThan(50);
    });
  });
});
