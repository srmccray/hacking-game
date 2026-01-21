/**
 * Storage Factory
 *
 * Factory function for creating the appropriate storage adapter
 * based on the current platform/environment.
 *
 * Currently supports:
 * - Web browsers (localStorage)
 *
 * Future support planned:
 * - Capacitor (mobile) - @capacitor/preferences
 * - Electron (desktop) - electron-store or file system
 * - IndexedDB - for larger save data
 */

import type { StorageAdapter } from './storage-adapter';
import { LocalStorageAdapter } from './local-storage-adapter';

/**
 * Create the appropriate storage adapter for the current platform.
 *
 * @returns A StorageAdapter instance for the current environment
 */
export function createStorageAdapter(): StorageAdapter {
  // TODO: Add platform detection for Capacitor, Electron, etc.
  // Example future implementation:
  //
  // if (Capacitor.isNativePlatform()) {
  //   return new CapacitorStorageAdapter();
  // }
  //
  // if (typeof window !== 'undefined' && window.process?.type === 'renderer') {
  //   return new ElectronStorageAdapter();
  // }

  // Default to localStorage for web browsers
  return new LocalStorageAdapter();
}
