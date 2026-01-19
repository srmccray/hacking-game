/**
 * Save System for the Hacker Incremental Game
 *
 * Handles persistence using localStorage with:
 * - Auto-save every 30 seconds
 * - Save on tab blur and beforeunload
 * - Export/import as base64 for manual backup
 * - Version tracking for future migrations
 *
 * Usage:
 *   import { initializeSaveSystem, saveGame, loadGame } from '@core/save-system';
 *
 *   // On game start
 *   const savedState = loadGame();
 *   if (savedState) {
 *     useGameStore.getState().loadState(savedState);
 *   }
 *   initializeSaveSystem();
 */

import { useGameStore } from './game-state';
import { type GameState, SAVE_VERSION, DEFAULT_GAME_STATE } from './types';

// ============================================================================
// Constants
// ============================================================================

/** localStorage key for the save data */
const SAVE_KEY = 'hacker-incremental-save';

/** Auto-save interval in milliseconds (30 seconds) */
const AUTO_SAVE_INTERVAL_MS = 30_000;

// ============================================================================
// Internal State
// ============================================================================

/** Reference to the auto-save interval timer */
let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;

/** Flag to track if the save system has been initialized */
let isInitialized = false;

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
    resources: { ...store.resources },
    minigames: JSON.parse(JSON.stringify(store.minigames)),
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
 * Save the current game state to localStorage.
 *
 * Updates both lastSaved and lastPlayed timestamps before saving.
 *
 * @returns true if save was successful, false if it failed
 */
export function saveGame(): boolean {
  try {
    // Update timestamps in the store
    const store = useGameStore.getState();
    store.updateLastSaved();
    store.updateLastPlayed();

    // Get the updated state after timestamp updates
    const state = getSerializableState();

    // Serialize and save to localStorage
    const serialized = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, serialized);

    console.log('[SaveSystem] Game saved successfully');
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
 */
function isValidGameState(data: unknown): data is GameState {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required top-level fields
  if (typeof obj['version'] !== 'string') return false;
  if (typeof obj['lastSaved'] !== 'number') return false;
  if (typeof obj['lastPlayed'] !== 'number') return false;

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
 * Currently a pass-through since we're at version 1.0.0.
 *
 * @param state - The loaded state that may need migration
 * @returns The migrated state
 */
function migrateState(state: GameState): GameState {
  // Currently at version 1.0.0, no migrations needed
  // Future migrations would go here:
  //
  // if (state.version === '1.0.0') {
  //   // Migrate from 1.0.0 to 1.1.0
  //   state = migrateFrom1_0_0To1_1_0(state);
  // }

  // Ensure version is current after any migrations
  return {
    ...state,
    version: SAVE_VERSION,
  };
}

/**
 * Load the game state from localStorage.
 *
 * @returns The loaded GameState if found and valid, null otherwise
 */
export function loadGame(): GameState | null {
  try {
    const serialized = localStorage.getItem(SAVE_KEY);

    if (!serialized) {
      console.log('[SaveSystem] No save data found');
      return null;
    }

    const data = JSON.parse(serialized) as unknown;

    if (!isValidGameState(data)) {
      console.warn('[SaveSystem] Save data failed validation, ignoring');
      return null;
    }

    // Migrate if needed
    const migratedState = migrateState(data);

    console.log('[SaveSystem] Game loaded successfully (version: ' + migratedState.version + ')');
    return migratedState;
  } catch (error) {
    console.error('[SaveSystem] Failed to load game:', error);
    return null;
  }
}

/**
 * Check if a save exists in localStorage.
 *
 * @returns true if a save exists, false otherwise
 */
export function hasSaveData(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * Delete the save data from localStorage.
 * Use with caution - this permanently removes the player's progress.
 */
export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
  console.log('[SaveSystem] Save data deleted');
}

// ============================================================================
// Export/Import Functions
// ============================================================================

/**
 * Export the current game state as a base64-encoded string.
 * This can be used for manual backup or sharing.
 *
 * @returns A base64-encoded string of the save data
 */
export function exportSave(): string {
  // Save first to ensure we have the latest state
  saveGame();

  const state = getSerializableState();
  const serialized = JSON.stringify(state);

  // Encode to base64
  const base64 = btoa(serialized);

  console.log('[SaveSystem] Save exported');
  return base64;
}

/**
 * Import a game state from a base64-encoded string.
 * This will overwrite the current game state.
 *
 * @param base64String - The base64-encoded save data
 * @returns true if import was successful, false if it failed
 */
export function importSave(base64String: string): boolean {
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

    // Save to localStorage to persist the import
    saveGame();

    console.log('[SaveSystem] Save imported successfully');
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
    saveGame();
    console.log('[SaveSystem] Auto-save triggered');
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
    saveGame();
    console.log('[SaveSystem] Saved on tab blur');
  }
}

/**
 * Handler for beforeunload events.
 * Saves when the page is about to be closed.
 */
function handleBeforeUnload(): void {
  saveGame();
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
 * Get the timestamp of when the game was last played.
 * Useful for calculating offline progression.
 *
 * @returns The lastPlayed timestamp from the current state, or null if never played
 */
export function getLastPlayedTimestamp(): number | null {
  const savedState = loadGame();
  if (!savedState) {
    return null;
  }
  return savedState.lastPlayed;
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
 * Clears localStorage and resets the store.
 */
export function hardReset(): void {
  // Delete save data
  deleteSave();

  // Reset the store to defaults
  useGameStore.getState().resetGame();

  // Save the fresh state
  saveGame();

  console.log('[SaveSystem] Hard reset complete');
}

/**
 * Get a fresh copy of the default game state.
 * Useful for comparisons or testing.
 */
export function getDefaultState(): GameState {
  return JSON.parse(JSON.stringify(DEFAULT_GAME_STATE)) as GameState;
}
