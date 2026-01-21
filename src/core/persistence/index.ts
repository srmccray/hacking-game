/**
 * Persistence/save system exports
 *
 * This module provides the storage abstraction layer and save management:
 * - StorageAdapter: Interface for storage backends
 * - LocalStorageAdapter: Browser localStorage implementation
 * - SaveManager: Save/load logic with slots, versioning, auto-save
 */

// Storage adapter interface and error types
export { StorageError, type StorageAdapter } from './storage-adapter';

// localStorage implementation
export { LocalStorageAdapter } from './local-storage-adapter';

// Save manager
export {
  SaveManager,
  type SaveResult,
  type LoadResult,
} from './save-manager';
