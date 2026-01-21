/**
 * Save System for the Hacker Incremental Game
 *
 * Handles persistence using a storage adapter abstraction with:
 * - Auto-save every 30 seconds
 * - Save on tab blur and beforeunload
 * - Export/import as base64 for manual backup
 * - Version tracking for future migrations
 *
 * Usage:
 *   import { initializeSaveSystem, saveGame, loadGame, initializeStorage } from '@core/save-system';
 *   import { createStorageAdapter } from '@core/storage';
 *
 *   // On game start
 *   initializeStorage(createStorageAdapter());
 *   const savedState = await loadGame(0);
 *   if (savedState) {
 *     useGameStore.getState().loadState(savedState);
 *   }
 *   initializeSaveSystem();
 */

import { useGameStore } from './game-state';
import { type GameState, type SaveSlotMetadata, SAVE_VERSION, DEFAULT_GAME_STATE } from './types';
import type { StorageAdapter } from './storage';

// ============================================================================
// Constants
// ============================================================================

/** Prefix for slot-based localStorage keys */
const SLOT_KEY_PREFIX = 'hacker-incremental-slot-';

/** Maximum number of save slots */
export const MAX_SLOTS = 3;

/** Auto-save interval in milliseconds (30 seconds) */
const AUTO_SAVE_INTERVAL_MS = 30_000;

// ============================================================================
// Internal State
// ============================================================================

/** Reference to the auto-save interval timer */
let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;

/** Flag to track if the save system has been initialized */
let isInitialized = false;

/** Currently active save slot index (null if no slot selected) */
let activeSlotIndex: number | null = null;

/** Storage adapter instance for persistence operations */
let storageAdapter: StorageAdapter | null = null;

/**
 * Initialize the storage adapter.
 * Must be called before any save/load operations.
 *
 * @param adapter - The storage adapter to use for persistence
 */
export function initializeStorage(adapter: StorageAdapter): void {
  storageAdapter = adapter;
  console.log('[SaveSystem] Storage adapter initialized');
}

/**
 * Get the storage adapter, throwing if not initialized.
 * Internal helper to ensure storage is available.
 */
function getStorage(): StorageAdapter {
  if (!storageAdapter) {
    throw new Error('[SaveSystem] Storage adapter not initialized. Call initializeStorage() first.');
  }
  return storageAdapter;
}

// ============================================================================
// Slot Management Functions
// ============================================================================

/**
 * Get the localStorage key for a specific save slot.
 *
 * @param slotIndex - The slot index (0-2)
 * @returns The localStorage key for that slot
 */
function getSlotKey(slotIndex: number): string {
  return `${SLOT_KEY_PREFIX}${slotIndex}`;
}

/**
 * Set the active save slot.
 * Must be called before saveGame() can save.
 *
 * @param slotIndex - The slot index (0-2) to activate
 */
export function setActiveSlot(slotIndex: number): void {
  if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
    console.error('[SaveSystem] Invalid slot index:', slotIndex);
    return;
  }
  activeSlotIndex = slotIndex;
  console.log('[SaveSystem] Active slot set to:', slotIndex);
}

/**
 * Get the currently active save slot index.
 *
 * @returns The active slot index, or null if no slot is active
 */
export function getActiveSlot(): number | null {
  return activeSlotIndex;
}

/**
 * Load metadata for a specific save slot without loading the full game state.
 *
 * @param slotIndex - The slot index (0-2)
 * @returns SaveSlotMetadata for the slot
 */
export async function loadSlotMetadata(slotIndex: number): Promise<SaveSlotMetadata> {
  const emptySlot: SaveSlotMetadata = {
    slotIndex,
    isEmpty: true,
    playerName: '',
    lastPlayed: 0,
    totalPlayTime: 0,
  };

  if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
    return emptySlot;
  }

  try {
    const storage = getStorage();
    const serialized = await storage.getItem(getSlotKey(slotIndex));
    if (!serialized) {
      return emptySlot;
    }

    const data = JSON.parse(serialized) as Record<string, unknown>;

    return {
      slotIndex,
      isEmpty: false,
      playerName: typeof data['playerName'] === 'string' ? data['playerName'] : '',
      lastPlayed: typeof data['lastPlayed'] === 'number' ? data['lastPlayed'] : 0,
      totalPlayTime: typeof data['stats'] === 'object' && data['stats'] !== null
        ? (typeof (data['stats'] as Record<string, unknown>)['totalPlayTime'] === 'number'
            ? (data['stats'] as Record<string, unknown>)['totalPlayTime'] as number
            : 0)
        : 0,
    };
  } catch (error) {
    console.error('[SaveSystem] Failed to load slot metadata:', slotIndex, error);
    return emptySlot;
  }
}

/**
 * List all save slots with their metadata.
 *
 * @returns Array of SaveSlotMetadata for all slots
 */
export async function listSaveSlots(): Promise<SaveSlotMetadata[]> {
  const slotPromises: Promise<SaveSlotMetadata>[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    slotPromises.push(loadSlotMetadata(i));
  }
  return Promise.all(slotPromises);
}

/**
 * Get the index of the first empty save slot.
 *
 * @returns The index of the first empty slot, or null if all slots are full
 */
export async function getFirstEmptySlot(): Promise<number | null> {
  for (let i = 0; i < MAX_SLOTS; i++) {
    const metadata = await loadSlotMetadata(i);
    if (metadata.isEmpty) {
      return i;
    }
  }
  return null;
}

/**
 * Get the index of the first occupied save slot.
 *
 * @returns The index of the first occupied slot, or null if all slots are empty
 */
export async function getFirstOccupiedSlot(): Promise<number | null> {
  for (let i = 0; i < MAX_SLOTS; i++) {
    const metadata = await loadSlotMetadata(i);
    if (!metadata.isEmpty) {
      return i;
    }
  }
  return null;
}

/**
 * Delete a specific save slot.
 *
 * @param slotIndex - The slot index (0-2) to delete
 */
export async function deleteSlot(slotIndex: number): Promise<void> {
  if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
    console.error('[SaveSystem] Invalid slot index for deletion:', slotIndex);
    return;
  }

  const storage = getStorage();
  await storage.removeItem(getSlotKey(slotIndex));

  // If deleting the active slot, clear the active slot
  if (activeSlotIndex === slotIndex) {
    activeSlotIndex = null;
  }

  console.log('[SaveSystem] Deleted save slot:', slotIndex);
}

// ============================================================================
// Save Functions
// ============================================================================

/**
 * Extract the serializable game state from the store.
 * This removes functions and only keeps the state data.
 */
function getSerializableState(): GameState {
  const store = useGameStore.getState();

  // Extract only the state properties, not the action methods
  const state: GameState = {
    version: store.version,
    lastSaved: store.lastSaved,
    lastPlayed: store.lastPlayed,
    playerName: store.playerName,
    resources: { ...store.resources },
    minigames: structuredClone(store.minigames),
    upgrades: {
      equipment: { ...store.upgrades.equipment },
      apartment: { ...store.upgrades.apartment },
    },
    settings: { ...store.settings },
    stats: {
      totalPlayTime: store.stats.totalPlayTime,
      totalResourcesEarned: { ...store.stats.totalResourcesEarned },
    },
  };

  return state;
}

/**
 * Save the current game state to storage.
 *
 * Updates both lastSaved and lastPlayed timestamps before saving.
 * Saves to the currently active slot.
 *
 * @returns true if save was successful, false if it failed (including if no slot is active)
 */
export async function saveGame(): Promise<boolean> {
  if (activeSlotIndex === null) {
    console.warn('[SaveSystem] Cannot save - no active slot set');
    return false;
  }

  try {
    // Update timestamps in the store
    const store = useGameStore.getState();
    store.updateLastSaved();
    store.updateLastPlayed();

    // Get the updated state after timestamp updates
    const state = getSerializableState();

    // Serialize and save to the active slot
    const serialized = JSON.stringify(state);
    const storage = getStorage();
    await storage.setItem(getSlotKey(activeSlotIndex), serialized);

    console.log('[SaveSystem] Game saved successfully to slot:', activeSlotIndex);
    return true;
  } catch (error) {
    console.error('[SaveSystem] Failed to save game:', error);
    return false;
  }
}

// ============================================================================
// Load Functions
// ============================================================================

/**
 * Validate that a loaded object has the expected GameState structure.
 * Performs basic shape validation to ensure data integrity.
 *
 * Exported for testing purposes.
 */
export function isValidGameState(data: unknown): data is GameState {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required top-level fields
  if (typeof obj['version'] !== 'string') return false;
  if (typeof obj['lastSaved'] !== 'number') return false;
  if (typeof obj['lastPlayed'] !== 'number') return false;
  // playerName is optional for backwards compatibility, but must be string if present
  if (obj['playerName'] !== undefined && typeof obj['playerName'] !== 'string') return false;

  // Check resources
  if (typeof obj['resources'] !== 'object' || obj['resources'] === null) return false;
  const resources = obj['resources'] as Record<string, unknown>;
  if (typeof resources['money'] !== 'string') return false;
  if (typeof resources['technique'] !== 'string') return false;
  if (typeof resources['renown'] !== 'string') return false;

  // Check minigames exists and is an object
  if (typeof obj['minigames'] !== 'object' || obj['minigames'] === null) return false;

  // Check upgrades
  if (typeof obj['upgrades'] !== 'object' || obj['upgrades'] === null) return false;
  const upgrades = obj['upgrades'] as Record<string, unknown>;
  if (typeof upgrades['equipment'] !== 'object' || upgrades['equipment'] === null) return false;
  if (typeof upgrades['apartment'] !== 'object' || upgrades['apartment'] === null) return false;

  // Check settings
  if (typeof obj['settings'] !== 'object' || obj['settings'] === null) return false;
  const settings = obj['settings'] as Record<string, unknown>;
  if (typeof settings['offlineProgressEnabled'] !== 'boolean') return false;

  // Check stats
  if (typeof obj['stats'] !== 'object' || obj['stats'] === null) return false;
  const stats = obj['stats'] as Record<string, unknown>;
  if (typeof stats['totalPlayTime'] !== 'number') return false;
  if (typeof stats['totalResourcesEarned'] !== 'object' || stats['totalResourcesEarned'] === null) return false;

  return true;
}

/**
 * Migrate save data from older versions to the current version.
 *
 * @param state - The loaded state that may need migration
 * @returns The migrated state
 */
function migrateState(state: GameState): GameState {
  let migratedState = { ...state };

  // Migrate from 1.0.0 to 1.1.0: add playerName field
  if (state.version === '1.0.0') {
    migratedState = {
      ...migratedState,
      playerName: migratedState.playerName ?? '',
    };
  }

  // Ensure version is current after any migrations
  return {
    ...migratedState,
    version: SAVE_VERSION,
  };
}

/**
 * Load the game state from a specific save slot.
 * Also sets the loaded slot as the active slot.
 *
 * @param slotIndex - The slot index (0-2) to load from
 * @returns The loaded GameState if found and valid, null otherwise
 */
export async function loadGame(slotIndex: number): Promise<GameState | null> {
  if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
    console.error('[SaveSystem] Invalid slot index for loading:', slotIndex);
    return null;
  }

  try {
    const storage = getStorage();
    const serialized = await storage.getItem(getSlotKey(slotIndex));

    if (!serialized) {
      console.log('[SaveSystem] No save data found in slot:', slotIndex);
      return null;
    }

    const data = JSON.parse(serialized) as unknown;

    if (!isValidGameState(data)) {
      console.warn('[SaveSystem] Save data in slot', slotIndex, 'failed validation, ignoring');
      return null;
    }

    // Migrate if needed
    const migratedState = migrateState(data);

    // Set this slot as active
    activeSlotIndex = slotIndex;

    console.log('[SaveSystem] Game loaded successfully from slot:', slotIndex, '(version:', migratedState.version + ')');
    return migratedState;
  } catch (error) {
    console.error('[SaveSystem] Failed to load game from slot:', slotIndex, error);
    return null;
  }
}

/**
 * Check if any save exists in any slot.
 *
 * @returns true if at least one slot has save data, false otherwise
 */
export async function hasSaveData(): Promise<boolean> {
  const occupiedSlot = await getFirstOccupiedSlot();
  return occupiedSlot !== null;
}

/**
 * Delete the currently active save slot.
 * Use with caution - this permanently removes the player's progress.
 *
 * @deprecated Use deleteSlot(slotIndex) instead for explicit slot management
 */
export async function deleteSave(): Promise<void> {
  if (activeSlotIndex !== null) {
    await deleteSlot(activeSlotIndex);
  } else {
    console.warn('[SaveSystem] Cannot delete - no active slot set');
  }
}

// ============================================================================
// Export/Import Functions
// ============================================================================

/**
 * Export the current game state as a base64-encoded string.
 * Exports from the currently active slot.
 *
 * @returns A base64-encoded string of the save data, or empty string if no active slot
 */
export async function exportSave(): Promise<string> {
  if (activeSlotIndex === null) {
    console.warn('[SaveSystem] Cannot export - no active slot set');
    return '';
  }

  // Save first to ensure we have the latest state
  await saveGame();

  const state = getSerializableState();
  const serialized = JSON.stringify(state);

  // Encode to base64
  const base64 = btoa(serialized);

  console.log('[SaveSystem] Save exported from slot:', activeSlotIndex);
  return base64;
}

/**
 * Import a game state from a base64-encoded string.
 * Imports to a specific slot, or the first empty slot if not specified.
 *
 * @param base64String - The base64-encoded save data
 * @param targetSlotIndex - Optional slot index to import into (uses first empty slot if not provided)
 * @returns true if import was successful, false if it failed
 */
export async function importSave(base64String: string, targetSlotIndex?: number): Promise<boolean> {
  // Determine target slot
  let slotIndex: number;
  if (targetSlotIndex !== undefined) {
    if (targetSlotIndex < 0 || targetSlotIndex >= MAX_SLOTS) {
      console.error('[SaveSystem] Invalid slot index for import:', targetSlotIndex);
      return false;
    }
    slotIndex = targetSlotIndex;
  } else {
    const emptySlot = await getFirstEmptySlot();
    if (emptySlot === null) {
      console.error('[SaveSystem] Cannot import - all slots are full');
      return false;
    }
    slotIndex = emptySlot;
  }

  try {
    // Decode from base64
    const serialized = atob(base64String.trim());
    const data = JSON.parse(serialized) as unknown;

    if (!isValidGameState(data)) {
      console.error('[SaveSystem] Imported data failed validation');
      return false;
    }

    // Migrate if needed
    const migratedState = migrateState(data);

    // Load into the store
    useGameStore.getState().loadState(migratedState);

    // Set active slot and save
    activeSlotIndex = slotIndex;
    await saveGame();

    console.log('[SaveSystem] Save imported successfully to slot:', slotIndex);
    return true;
  } catch (error) {
    console.error('[SaveSystem] Failed to import save:', error);
    return false;
  }
}

// ============================================================================
// Auto-Save System
// ============================================================================

/**
 * Start the auto-save interval.
 * Saves the game every AUTO_SAVE_INTERVAL_MS milliseconds.
 */
function startAutoSave(): void {
  if (autoSaveIntervalId !== null) {
    console.warn('[SaveSystem] Auto-save already running');
    return;
  }

  autoSaveIntervalId = setInterval(() => {
    saveGame().then(() => {
      console.log('[SaveSystem] Auto-save triggered');
    }).catch((error) => {
      console.error('[SaveSystem] Auto-save failed:', error);
    });
  }, AUTO_SAVE_INTERVAL_MS);

  console.log('[SaveSystem] Auto-save started (interval: ' + AUTO_SAVE_INTERVAL_MS / 1000 + 's)');
}

/**
 * Stop the auto-save interval.
 */
function stopAutoSave(): void {
  if (autoSaveIntervalId !== null) {
    clearInterval(autoSaveIntervalId);
    autoSaveIntervalId = null;
    console.log('[SaveSystem] Auto-save stopped');
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handler for visibility change events.
 * Saves when the tab becomes hidden.
 */
function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    saveGame().then(() => {
      console.log('[SaveSystem] Saved on tab blur');
    }).catch((error) => {
      console.error('[SaveSystem] Failed to save on tab blur:', error);
    });
  }
}

/**
 * Handler for beforeunload events.
 * Saves when the page is about to be closed.
 * Note: This uses fire-and-forget since beforeunload cannot wait for async.
 * The LocalStorageAdapter completes synchronously, so this works for web.
 */
function handleBeforeUnload(): void {
  // Fire-and-forget - beforeunload can't wait for promises
  // LocalStorageAdapter operations complete synchronously
  saveGame().catch((error) => {
    console.error('[SaveSystem] Failed to save on page unload:', error);
  });
  console.log('[SaveSystem] Saved on page unload');
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the save system.
 * Sets up auto-save, tab blur, and beforeunload handlers.
 *
 * This should be called once after the game store is ready.
 */
export function initializeSaveSystem(): void {
  if (isInitialized) {
    console.warn('[SaveSystem] Already initialized');
    return;
  }

  // Start auto-save
  startAutoSave();

  // Set up event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  isInitialized = true;
  console.log('[SaveSystem] Save system initialized');
}

/**
 * Clean up the save system.
 * Removes event listeners and stops auto-save.
 *
 * Call this when the game is being destroyed (e.g., hot module replacement).
 */
export function destroySaveSystem(): void {
  if (!isInitialized) {
    return;
  }

  // Stop auto-save
  stopAutoSave();

  // Remove event listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', handleBeforeUnload);

  isInitialized = false;
  console.log('[SaveSystem] Save system destroyed');
}

/**
 * Get the timestamp of when the game was last played from the active slot.
 * Useful for calculating offline progression.
 *
 * @returns The lastPlayed timestamp from the active slot, or null if no active slot or never played
 */
export async function getLastPlayedTimestamp(): Promise<number | null> {
  if (activeSlotIndex === null) {
    return null;
  }

  const metadata = await loadSlotMetadata(activeSlotIndex);
  if (metadata.isEmpty) {
    return null;
  }

  return metadata.lastPlayed || null;
}

/**
 * Get the auto-save interval in milliseconds.
 * Exposed for testing purposes.
 */
export function getAutoSaveInterval(): number {
  return AUTO_SAVE_INTERVAL_MS;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Force a reset of the game to default state.
 * Resets the store to defaults without modifying any save slots.
 * Call setActiveSlot() and saveGame() separately to persist.
 */
export function hardReset(): void {
  // Clear active slot (new game flow will set it)
  activeSlotIndex = null;

  // Reset the store to defaults
  useGameStore.getState().resetGame();

  console.log('[SaveSystem] Hard reset complete (no slot active, call setActiveSlot and saveGame to persist)');
}

/**
 * Get a fresh copy of the default game state.
 * Useful for comparisons or testing.
 * Uses structuredClone for better performance and safety.
 */
export function getDefaultState(): GameState {
  return structuredClone(DEFAULT_GAME_STATE);
}
