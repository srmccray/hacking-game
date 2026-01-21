/**
 * Storage Abstraction Layer
 *
 * Provides platform-agnostic storage operations for save data.
 * Use createStorageAdapter() to get the appropriate adapter for the current platform.
 *
 * @example
 * ```ts
 * import { createStorageAdapter, type StorageAdapter } from '@core/storage';
 *
 * const storage = createStorageAdapter();
 * await storage.setItem('key', 'value');
 * const value = await storage.getItem('key');
 * ```
 */

export type { StorageAdapter } from './storage-adapter';
export { LocalStorageAdapter } from './local-storage-adapter';
export { createStorageAdapter } from './storage-factory';
