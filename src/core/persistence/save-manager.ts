/**
 * Save Manager
 *
 * Handles game state persistence with support for:
 * - Multiple save slots
 * - Auto-save on configurable interval
 * - Save versioning for future migrations
 * - Tab blur and page unload saves
 * - EventBus integration for save/load events
 *
 * The SaveManager uses a StorageAdapter abstraction, allowing it to work with
 * any storage backend (localStorage, IndexedDB, cloud storage).
 *
 * Usage:
 *   const saveManager = new SaveManager(store, eventBus, config.storage);
 *   await saveManager.init();
 *
 *   // Load from slot
 *   const loaded = await saveManager.load(0);
 *
 *   // Save to slot
 *   await saveManager.save(0);
 *
 *   // Start auto-save
 *   saveManager.startAutoSave(config.gameplay.autoSaveIntervalMs);
 *
 *   // Cleanup
 *   saveManager.destroy();
 */

import type { GameStore } from '../state/game-store';
import type { GameState, SaveSlotMetadata } from '../types';
import { SAVE_VERSION } from '../types';
import type { StorageAdapter } from './storage-adapter';
import { LocalStorageAdapter } from './local-storage-adapter';
import type { StorageConfig } from '../../game/GameConfig';
import type { GameEventBus } from '../../events/game-events';
import { GameEvents } from '../../events/game-events';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a save operation.
 */
export interface SaveResult {
  /** Whether the save was successful */
  success: boolean;
  /** Slot index that was saved to */
  slotIndex: number;
  /** Error message if save failed */
  error?: string;
}

/**
 * Result of a load operation.
 */
export interface LoadResult {
  /** Whether the load was successful */
  success: boolean;
  /** Slot index that was loaded from */
  slotIndex: number;
  /** The loaded state (if successful) */
  state?: GameState;
  /** Seconds since last play (for offline progress) */
  secondsSinceLastPlay: number;
  /** Error message if load failed */
  error?: string;
}

// ============================================================================
// SaveManager Class
// ============================================================================

/**
 * Manages game save/load operations with multiple slots, auto-save, and versioning.
 */
export class SaveManager {
  /** Storage adapter for persistence operations */
  private readonly adapter: StorageAdapter;

  /** Reference to the game store */
  private readonly store: GameStore;

  /** Reference to the event bus for emitting save/load events */
  private readonly eventBus: GameEventBus;

  /** Storage configuration */
  private readonly config: StorageConfig;

  /** Currently active save slot (-1 if none) */
  private activeSlot: number = -1;

  /** Auto-save interval timer ID */
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  /** Whether the manager has been initialized */
  private initialized: boolean = false;

  /** Whether the manager has been destroyed */
  private destroyed: boolean = false;

  /** Bound event handlers for cleanup */
  private readonly boundHandleVisibilityChange: () => void;
  private readonly boundHandleBeforeUnload: () => void;

  /**
   * Create a new SaveManager.
   *
   * @param store - The game store to save/load state from
   * @param eventBus - Event bus for emitting save/load events
   * @param config - Storage configuration
   * @param adapter - Optional storage adapter (defaults to LocalStorageAdapter)
   */
  constructor(
    store: GameStore,
    eventBus: GameEventBus,
    config: StorageConfig,
    adapter?: StorageAdapter
  ) {
    this.store = store;
    this.eventBus = eventBus;
    this.config = config;
    this.adapter = adapter ?? new LocalStorageAdapter();

    // Bind event handlers
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.boundHandleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the save manager.
   *
   * Sets up visibility change and beforeunload event listeners for
   * automatic saving when the player leaves the page.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      console.warn('[SaveManager] Already initialized');
      return;
    }

    // Register browser event listeners
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.boundHandleBeforeUnload);
    }

    this.initialized = true;
    console.log('[SaveManager] Initialized');
  }

  // ==========================================================================
  // Slot Key Generation
  // ==========================================================================

  /**
   * Generate the storage key for a save slot.
   */
  private getSlotKey(slotIndex: number): string {
    return `${this.config.keyPrefix}-slot-${slotIndex}`;
  }

  // Note: getMetadataKey was removed as it was unused.
  // If slot metadata indexing is needed in the future, add it back.

  // ==========================================================================
  // Slot Management
  // ==========================================================================

  /**
   * Get the currently active slot index.
   *
   * @returns The active slot index, or -1 if no slot is active
   */
  getActiveSlot(): number {
    return this.activeSlot;
  }

  /**
   * Set the active save slot.
   *
   * @param slotIndex - The slot index (0 to maxSlots-1)
   * @returns true if the slot was set successfully
   */
  setActiveSlot(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.config.maxSlots) {
      console.error(`[SaveManager] Invalid slot index: ${slotIndex}`);
      return false;
    }

    this.activeSlot = slotIndex;
    console.log(`[SaveManager] Active slot set to: ${slotIndex}`);
    return true;
  }

  /**
   * Get metadata for a specific save slot.
   *
   * @param slotIndex - The slot index
   * @returns Metadata for the slot
   */
  async getSlotMetadata(slotIndex: number): Promise<SaveSlotMetadata> {
    const emptySlot: SaveSlotMetadata = {
      slotIndex,
      isEmpty: true,
      playerName: '',
      lastPlayed: 0,
      totalPlayTime: 0,
    };

    if (slotIndex < 0 || slotIndex >= this.config.maxSlots) {
      return emptySlot;
    }

    try {
      const key = this.getSlotKey(slotIndex);
      const data = await this.adapter.getItem(key);

      if (!data) {
        return emptySlot;
      }

      const parsed = JSON.parse(data) as Record<string, unknown>;

      return {
        slotIndex,
        isEmpty: false,
        playerName: typeof parsed['playerName'] === 'string' ? parsed['playerName'] : '',
        lastPlayed: typeof parsed['lastPlayed'] === 'number' ? parsed['lastPlayed'] : 0,
        totalPlayTime: this.extractTotalPlayTime(parsed),
      };
    } catch (error) {
      console.error(`[SaveManager] Failed to load slot metadata: ${slotIndex}`, error);
      return emptySlot;
    }
  }

  /**
   * Extract total play time from parsed save data.
   */
  private extractTotalPlayTime(data: Record<string, unknown>): number {
    if (typeof data['stats'] !== 'object' || data['stats'] === null) {
      return 0;
    }
    const stats = data['stats'] as Record<string, unknown>;
    return typeof stats['totalPlayTime'] === 'number' ? stats['totalPlayTime'] : 0;
  }

  /**
   * Get metadata for all save slots.
   *
   * @returns Array of metadata for all slots
   */
  async getAllSlotMetadata(): Promise<SaveSlotMetadata[]> {
    const promises: Promise<SaveSlotMetadata>[] = [];
    for (let i = 0; i < this.config.maxSlots; i++) {
      promises.push(this.getSlotMetadata(i));
    }
    return Promise.all(promises);
  }

  /**
   * Check if a slot has save data.
   *
   * @param slotIndex - The slot index
   * @returns true if the slot contains save data
   */
  async hasSlotData(slotIndex: number): Promise<boolean> {
    const metadata = await this.getSlotMetadata(slotIndex);
    return !metadata.isEmpty;
  }

  /**
   * Delete a save slot.
   *
   * @param slotIndex - The slot index to delete
   */
  async deleteSlot(slotIndex: number): Promise<void> {
    if (slotIndex < 0 || slotIndex >= this.config.maxSlots) {
      console.error(`[SaveManager] Invalid slot index for deletion: ${slotIndex}`);
      return;
    }

    const key = this.getSlotKey(slotIndex);
    await this.adapter.removeItem(key);

    // If deleting the active slot, clear active slot
    if (this.activeSlot === slotIndex) {
      this.activeSlot = -1;
    }

    console.log(`[SaveManager] Deleted slot: ${slotIndex}`);
  }

  // ==========================================================================
  // Save Operations
  // ==========================================================================

  /**
   * Extract serializable state from the store.
   * This removes action functions and only keeps data.
   */
  private getSerializableState(): GameState {
    const state = this.store.getState();

    return {
      version: state.version,
      lastSaved: state.lastSaved,
      lastPlayed: state.lastPlayed,
      playerName: state.playerName,
      resources: { ...state.resources },
      minigames: structuredClone(state.minigames),
      upgrades: {
        equipment: { ...state.upgrades.equipment },
        apartment: { ...state.upgrades.apartment },
      },
      automations: structuredClone(state.automations),
      settings: { ...state.settings },
      stats: {
        totalPlayTime: state.stats.totalPlayTime,
        totalOfflineTime: state.stats.totalOfflineTime,
        totalResourcesEarned: { ...state.stats.totalResourcesEarned },
      },
    };
  }

  /**
   * Save the current game state to a specific slot.
   *
   * @param slotIndex - The slot to save to (defaults to active slot)
   * @returns Result of the save operation
   */
  async save(slotIndex?: number): Promise<SaveResult> {
    const targetSlot = slotIndex ?? this.activeSlot;

    if (targetSlot < 0 || targetSlot >= this.config.maxSlots) {
      return {
        success: false,
        slotIndex: targetSlot,
        error: `Invalid slot index: ${targetSlot}`,
      };
    }

    try {
      // Update timestamps before saving
      const storeState = this.store.getState();
      storeState.updateLastSaved();
      storeState.updateLastPlayed();

      // Get serializable state after timestamp updates
      const state = this.getSerializableState();

      // Serialize and save
      const key = this.getSlotKey(targetSlot);
      const serialized = JSON.stringify(state);
      await this.adapter.setItem(key, serialized);

      console.log(`[SaveManager] Saved to slot: ${targetSlot}`);

      return {
        success: true,
        slotIndex: targetSlot,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SaveManager] Failed to save to slot ${targetSlot}:`, error);

      return {
        success: false,
        slotIndex: targetSlot,
        error: errorMessage,
      };
    }
  }

  /**
   * Quick save to the active slot.
   * Convenience method for auto-save and manual quick save.
   *
   * @returns Result of the save operation
   */
  async quickSave(): Promise<SaveResult> {
    if (this.activeSlot < 0) {
      return {
        success: false,
        slotIndex: -1,
        error: 'No active slot set',
      };
    }

    return this.save(this.activeSlot);
  }

  // ==========================================================================
  // Load Operations
  // ==========================================================================

  /**
   * Validate that loaded data matches the GameState structure.
   *
   * @param data - The data to validate
   * @returns true if the data is a valid GameState
   */
  isValidGameState(data: unknown): data is GameState {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Check required top-level fields
    if (typeof obj['version'] !== 'string') {return false;}
    if (typeof obj['lastSaved'] !== 'number') {return false;}
    if (typeof obj['lastPlayed'] !== 'number') {return false;}

    // playerName can be missing in old saves
    if (obj['playerName'] !== undefined && typeof obj['playerName'] !== 'string') {
      return false;
    }

    // Check resources
    if (typeof obj['resources'] !== 'object' || obj['resources'] === null) {return false;}
    const resources = obj['resources'] as Record<string, unknown>;
    if (typeof resources['money'] !== 'string') {return false;}
    if (typeof resources['technique'] !== 'string') {return false;}
    if (typeof resources['renown'] !== 'string') {return false;}

    // Check minigames exists
    if (typeof obj['minigames'] !== 'object' || obj['minigames'] === null) {return false;}

    // Check upgrades
    if (typeof obj['upgrades'] !== 'object' || obj['upgrades'] === null) {return false;}
    const upgrades = obj['upgrades'] as Record<string, unknown>;
    if (typeof upgrades['equipment'] !== 'object' || upgrades['equipment'] === null) {return false;}
    if (typeof upgrades['apartment'] !== 'object' || upgrades['apartment'] === null) {return false;}

    // Check settings
    if (typeof obj['settings'] !== 'object' || obj['settings'] === null) {return false;}
    const settings = obj['settings'] as Record<string, unknown>;
    if (typeof settings['offlineProgressEnabled'] !== 'boolean') {return false;}

    // Check stats
    if (typeof obj['stats'] !== 'object' || obj['stats'] === null) {return false;}
    const stats = obj['stats'] as Record<string, unknown>;
    if (typeof stats['totalPlayTime'] !== 'number') {return false;}
    if (typeof stats['totalResourcesEarned'] !== 'object' || stats['totalResourcesEarned'] === null) {
      return false;
    }

    return true;
  }

  /**
   * Migrate save data from older versions to current version.
   *
   * @param state - The state to migrate
   * @returns The migrated state
   */
  private migrateState(state: GameState): GameState {
    let migratedState = { ...state };

    // Version 1.0.0 -> 2.0.0: Add playerName and totalOfflineTime
    if (state.version === '1.0.0' || state.version === '1.1.0') {
      migratedState = {
        ...migratedState,
        playerName: migratedState.playerName ?? '',
        stats: {
          ...migratedState.stats,
          totalOfflineTime: migratedState.stats.totalOfflineTime ?? 0,
        },
      };
    }

    // Ensure version is current after migrations
    return {
      ...migratedState,
      version: SAVE_VERSION,
    };
  }

  /**
   * Load game state from a specific slot.
   *
   * @param slotIndex - The slot to load from
   * @returns Result of the load operation
   */
  async load(slotIndex: number): Promise<LoadResult> {
    if (slotIndex < 0 || slotIndex >= this.config.maxSlots) {
      return {
        success: false,
        slotIndex,
        secondsSinceLastPlay: 0,
        error: `Invalid slot index: ${slotIndex}`,
      };
    }

    try {
      const key = this.getSlotKey(slotIndex);
      const data = await this.adapter.getItem(key);

      if (!data) {
        return {
          success: false,
          slotIndex,
          secondsSinceLastPlay: 0,
          error: 'No save data found',
        };
      }

      const parsed = JSON.parse(data) as unknown;

      if (!this.isValidGameState(parsed)) {
        return {
          success: false,
          slotIndex,
          secondsSinceLastPlay: 0,
          error: 'Save data failed validation',
        };
      }

      // Migrate if needed
      const migratedState = this.migrateState(parsed);

      // Calculate time since last play
      const now = Date.now();
      const secondsSinceLastPlay = Math.max(0, (now - migratedState.lastPlayed) / 1000);

      // Load into store
      this.store.getState().loadState(migratedState);

      // Set as active slot
      this.activeSlot = slotIndex;

      // Emit save loaded event
      this.eventBus.emit(GameEvents.SAVE_LOADED, {
        slotIndex,
        playerName: migratedState.playerName,
        secondsSinceLastPlay,
      });

      console.log(`[SaveManager] Loaded from slot: ${slotIndex} (version: ${migratedState.version})`);

      return {
        success: true,
        slotIndex,
        state: migratedState,
        secondsSinceLastPlay,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SaveManager] Failed to load from slot ${slotIndex}:`, error);

      return {
        success: false,
        slotIndex,
        secondsSinceLastPlay: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Start a new game in a specific slot.
   *
   * @param slotIndex - The slot to use for the new game
   * @param playerName - The player's chosen name
   * @returns Result of the save operation (saving the initial state)
   */
  async startNewGame(slotIndex: number, playerName: string): Promise<SaveResult> {
    if (slotIndex < 0 || slotIndex >= this.config.maxSlots) {
      return {
        success: false,
        slotIndex,
        error: `Invalid slot index: ${slotIndex}`,
      };
    }

    // Reset store to initial state
    this.store.getState().resetGame();

    // Set player name
    this.store.getState().setPlayerName(playerName);

    // Set as active slot
    this.activeSlot = slotIndex;

    // Save the initial state
    return this.save(slotIndex);
  }

  // ==========================================================================
  // Auto-Save
  // ==========================================================================

  /**
   * Start auto-save on an interval.
   *
   * @param intervalMs - Interval between saves in milliseconds
   */
  startAutoSave(intervalMs: number): void {
    if (this.autoSaveTimer !== null) {
      console.warn('[SaveManager] Auto-save already running');
      return;
    }

    this.autoSaveTimer = setInterval(() => {
      if (this.activeSlot >= 0 && !this.destroyed) {
        this.quickSave()
          .then((result) => {
            if (result.success) {
              console.log('[SaveManager] Auto-save completed');
            }
          })
          .catch((error) => {
            console.error('[SaveManager] Auto-save failed:', error);
          });
      }
    }, intervalMs);

    console.log(`[SaveManager] Auto-save started (interval: ${intervalMs / 1000}s)`);
  }

  /**
   * Stop auto-save.
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('[SaveManager] Auto-save stopped');
    }
  }

  // ==========================================================================
  // Browser Event Handlers
  // ==========================================================================

  /**
   * Handle visibility change events.
   * Saves when the tab becomes hidden.
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden' && this.activeSlot >= 0) {
      this.quickSave()
        .then((result) => {
          if (result.success) {
            console.log('[SaveManager] Saved on tab blur');
          }
        })
        .catch((error) => {
          console.error('[SaveManager] Failed to save on tab blur:', error);
        });
    }
  }

  /**
   * Handle beforeunload events.
   * Saves when the page is about to be closed.
   *
   * Note: This is fire-and-forget since beforeunload cannot wait for async.
   * LocalStorageAdapter operations complete synchronously, so this works for web.
   */
  private handleBeforeUnload(): void {
    if (this.activeSlot >= 0) {
      this.quickSave().catch((error) => {
        console.error('[SaveManager] Failed to save on page unload:', error);
      });
    }
  }

  // ==========================================================================
  // Export/Import
  // ==========================================================================

  /**
   * Export the current game state as a base64-encoded string.
   *
   * @returns Base64-encoded save data, or empty string if no active slot
   */
  async exportSave(): Promise<string> {
    if (this.activeSlot < 0) {
      console.warn('[SaveManager] Cannot export - no active slot');
      return '';
    }

    // Save first to ensure latest state
    await this.quickSave();

    const state = this.getSerializableState();
    const serialized = JSON.stringify(state);
    const base64 = btoa(serialized);

    console.log('[SaveManager] Save exported');
    return base64;
  }

  /**
   * Import a game state from a base64-encoded string.
   *
   * @param base64String - The base64-encoded save data
   * @param targetSlot - The slot to import into (defaults to first available)
   * @returns Result of the import operation
   */
  async importSave(base64String: string, targetSlot?: number): Promise<LoadResult> {
    let slotIndex: number;

    if (targetSlot !== undefined) {
      if (targetSlot < 0 || targetSlot >= this.config.maxSlots) {
        return {
          success: false,
          slotIndex: targetSlot,
          secondsSinceLastPlay: 0,
          error: `Invalid slot index: ${targetSlot}`,
        };
      }
      slotIndex = targetSlot;
    } else {
      // Find first empty slot
      const metadata = await this.getAllSlotMetadata();
      const emptySlot = metadata.find((m) => m.isEmpty);
      if (!emptySlot) {
        return {
          success: false,
          slotIndex: -1,
          secondsSinceLastPlay: 0,
          error: 'All slots are full',
        };
      }
      slotIndex = emptySlot.slotIndex;
    }

    try {
      const serialized = atob(base64String.trim());
      const parsed = JSON.parse(serialized) as unknown;

      if (!this.isValidGameState(parsed)) {
        return {
          success: false,
          slotIndex,
          secondsSinceLastPlay: 0,
          error: 'Imported data failed validation',
        };
      }

      // Migrate if needed
      const migratedState = this.migrateState(parsed);

      // Calculate time since last play
      const now = Date.now();
      const secondsSinceLastPlay = Math.max(0, (now - migratedState.lastPlayed) / 1000);

      // Load into store
      this.store.getState().loadState(migratedState);

      // Set as active slot and save
      this.activeSlot = slotIndex;
      await this.save(slotIndex);

      // Emit save loaded event
      this.eventBus.emit(GameEvents.SAVE_LOADED, {
        slotIndex,
        playerName: migratedState.playerName,
        secondsSinceLastPlay,
      });

      console.log(`[SaveManager] Save imported to slot: ${slotIndex}`);

      return {
        success: true,
        slotIndex,
        state: migratedState,
        secondsSinceLastPlay,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SaveManager] Failed to import save:', error);

      return {
        success: false,
        slotIndex,
        secondsSinceLastPlay: 0,
        error: errorMessage,
      };
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Destroy the save manager and clean up resources.
   *
   * Stops auto-save, removes event listeners, and performs a final save
   * if there's an active slot.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    // Stop auto-save
    this.stopAutoSave();

    // Remove event listeners
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.boundHandleBeforeUnload);
    }

    console.log('[SaveManager] Destroyed');
  }
}
