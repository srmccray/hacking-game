/**
 * Core type definitions for the Hacker Incremental Game
 *
 * All Decimal values are stored as strings for JSON serialization compatibility.
 * Use break_eternity.js Decimal for calculations, convert to/from strings for storage.
 */

// ============================================================================
// Resource Types
// ============================================================================

/**
 * The three core currencies in the game.
 * - money: Primary currency, buys equipment
 * - technique: Skill currency, improves minigame abilities (placeholder for MVP)
 * - renown: Fame currency, unlocks new content (placeholder for MVP)
 */
export type ResourceType = 'money' | 'technique' | 'renown';

/**
 * Resources stored as Decimal strings for serialization.
 */
export interface Resources {
  money: string;
  technique: string;
  renown: string;
}

// ============================================================================
// Minigame Types
// ============================================================================

/**
 * State for a single minigame instance.
 */
export interface MinigameState {
  unlocked: boolean;
  /** Top 5 scores as Decimal strings, sorted descending */
  topScores: string[];
  playCount: number;
  /** Minigame-specific upgrades, keyed by upgrade ID with level as value */
  upgrades: Record<string, number>;
}

/**
 * Collection of all minigame states, keyed by minigame ID.
 */
export type MinigamesState = Record<string, MinigameState>;

// ============================================================================
// Upgrade Types
// ============================================================================

/**
 * Equipment upgrades have levels (can be purchased multiple times).
 */
export type EquipmentUpgrades = Record<string, number>;

/**
 * Apartment upgrades are boolean (unlocked or not).
 */
export type ApartmentUpgrades = Record<string, boolean>;

/**
 * All upgrade categories.
 */
export interface UpgradesState {
  equipment: EquipmentUpgrades;
  apartment: ApartmentUpgrades;
}

// ============================================================================
// Stats Types
// ============================================================================

/**
 * Lifetime statistics tracking.
 */
export interface StatsState {
  /** Total play time in milliseconds */
  totalPlayTime: number;
  /** Total resources ever earned, keyed by resource type as Decimal strings */
  totalResourcesEarned: Record<ResourceType, string>;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Player-configurable settings.
 */
export interface SettingsState {
  /** Whether offline progression is enabled */
  offlineProgressEnabled: boolean;
}

// ============================================================================
// Save Slot Types
// ============================================================================

/**
 * Metadata for a save slot, used for displaying slot information
 * without loading the full game state.
 */
export interface SaveSlotMetadata {
  /** The slot index (0-2) */
  slotIndex: number;
  /** Whether the slot has no save data */
  isEmpty: boolean;
  /** The player's name/alias for this save */
  playerName: string;
  /** Timestamp of when the save was last played (ms since epoch) */
  lastPlayed: number;
  /** Total play time in milliseconds */
  totalPlayTime: number;
}

// ============================================================================
// Game State
// ============================================================================

/**
 * Complete game state structure for persistence.
 * This matches the FRD specification for save state.
 */
export interface GameState {
  /** Save format version for migrations */
  version: string;
  /** Timestamp of last save (ms since epoch) */
  lastSaved: number;
  /** Timestamp of last play session (ms since epoch) - used for offline calculation */
  lastPlayed: number;
  /** Player's chosen name/alias for this save */
  playerName: string;

  resources: Resources;
  minigames: MinigamesState;
  upgrades: UpgradesState;
  settings: SettingsState;
  stats: StatsState;
}

// ============================================================================
// Store Action Types
// ============================================================================

/**
 * Actions available on the game store for state mutations.
 */
export interface GameActions {
  // Resource actions
  /**
   * Add an amount to a resource.
   * @param resource - The resource type to add to
   * @param amount - Amount as Decimal string
   */
  addResource: (resource: ResourceType, amount: string) => void;

  /**
   * Subtract an amount from a resource. Will not go below zero.
   * @param resource - The resource type to subtract from
   * @param amount - Amount as Decimal string
   * @returns true if subtraction was successful, false if insufficient funds
   */
  subtractResource: (resource: ResourceType, amount: string) => boolean;

  /**
   * Set a resource to a specific value.
   * @param resource - The resource type to set
   * @param amount - Amount as Decimal string
   */
  setResource: (resource: ResourceType, amount: string) => void;

  // Minigame actions
  /**
   * Record a new score for a minigame. Maintains top 5 scores.
   * @param minigameId - The minigame identifier
   * @param score - Score as Decimal string
   */
  recordScore: (minigameId: string, score: string) => void;

  /**
   * Increment the play count for a minigame.
   * @param minigameId - The minigame identifier
   */
  incrementPlayCount: (minigameId: string) => void;

  /**
   * Unlock a minigame.
   * @param minigameId - The minigame identifier
   */
  unlockMinigame: (minigameId: string) => void;

  /**
   * Purchase or upgrade a minigame-specific upgrade.
   * @param minigameId - The minigame identifier
   * @param upgradeId - The upgrade identifier
   */
  upgradeMinigame: (minigameId: string, upgradeId: string) => void;

  // Equipment/upgrade actions
  /**
   * Purchase or upgrade an equipment upgrade.
   * @param upgradeId - The upgrade identifier
   */
  purchaseEquipmentUpgrade: (upgradeId: string) => void;

  /**
   * Purchase an apartment upgrade.
   * @param upgradeId - The upgrade identifier
   */
  purchaseApartmentUpgrade: (upgradeId: string) => void;

  // Stats actions
  /**
   * Add to total play time.
   * @param ms - Milliseconds to add
   */
  addPlayTime: (ms: number) => void;

  /**
   * Track resources earned for lifetime stats.
   * @param resource - The resource type
   * @param amount - Amount as Decimal string
   */
  trackResourceEarned: (resource: ResourceType, amount: string) => void;

  // Settings actions
  /**
   * Toggle offline progression setting.
   */
  toggleOfflineProgress: () => void;

  // Save/load actions
  /**
   * Update the lastSaved timestamp.
   */
  updateLastSaved: () => void;

  /**
   * Update the lastPlayed timestamp.
   */
  updateLastPlayed: () => void;

  /**
   * Set the player's name/alias.
   * @param name - The player's chosen name
   */
  setPlayerName: (name: string) => void;

  /**
   * Reset the game to initial state.
   */
  resetGame: () => void;

  /**
   * Load a complete game state (for save loading).
   * @param state - Complete game state to load
   */
  loadState: (state: GameState) => void;
}

/**
 * Complete store type combining state and actions.
 */
export type GameStore = GameState & GameActions;

// ============================================================================
// Constants
// ============================================================================

/**
 * Current save format version.
 * Increment when making breaking changes to the save format.
 */
export const SAVE_VERSION = '1.1.0';

/**
 * Default initial state for a new game.
 */
export const DEFAULT_GAME_STATE: GameState = {
  version: SAVE_VERSION,
  lastSaved: Date.now(),
  lastPlayed: Date.now(),
  playerName: '',

  resources: {
    money: '0',
    technique: '0',
    renown: '0',
  },

  minigames: {
    'code-breaker': {
      unlocked: true, // MVP minigame is unlocked by default
      topScores: [],
      playCount: 0,
      upgrades: {},
    },
  },

  upgrades: {
    equipment: {},
    apartment: {},
  },

  settings: {
    offlineProgressEnabled: true,
  },

  stats: {
    totalPlayTime: 0,
    totalResourcesEarned: {
      money: '0',
      technique: '0',
      renown: '0',
    },
  },
};
