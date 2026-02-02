/**
 * Core type definitions for the Hacker Incremental Game v2
 *
 * All Decimal values are stored as strings for JSON serialization compatibility.
 * Use break_eternity.js Decimal for calculations, convert to/from strings for storage.
 */

import type { Container } from 'pixi.js';

// ============================================================================
// Resource Types
// ============================================================================

/**
 * The three core resource types in the game.
 * - money: Primary currency, earned from hacking minigames, buys equipment
 * - technique: Skill currency, improves minigame abilities (future expansion)
 * - renown: Fame currency, unlocks new content (future expansion)
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
 * Persistent state for a single minigame.
 */
export interface MinigameState {
  /** Whether the player has unlocked this minigame */
  unlocked: boolean;
  /** Top scores as Decimal strings, sorted descending (max 5) */
  topScores: string[];
  /** Total number of times the minigame has been played */
  playCount: number;
  /** Minigame-specific upgrades, keyed by upgrade ID with level as value */
  upgrades: Record<string, number>;
}

/**
 * Collection of all minigame states, keyed by minigame ID.
 */
export type MinigamesState = Record<string, MinigameState>;

/**
 * Result from completing a minigame session.
 */
export interface MinigameResult {
  /** The minigame that was completed */
  minigameId: string;
  /** Final score achieved */
  score: number;
  /** Maximum combo achieved during the session */
  maxCombo: number;
  /** Duration of the session in milliseconds */
  durationMs: number;
  /** Resource rewards earned */
  rewards: Partial<Resources>;
}

// ============================================================================
// Upgrade Types
// ============================================================================

/**
 * Equipment upgrades have levels (can be purchased multiple times).
 * Key is upgrade ID, value is current level.
 */
export type EquipmentUpgrades = Record<string, number>;

/**
 * Apartment upgrades are boolean (unlocked or not).
 * Key is upgrade ID, value is whether it's been purchased.
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
// Automation Types
// ============================================================================

/**
 * State tracking for an automation.
 * Stores the last time the automation was triggered.
 */
export interface AutomationState {
  /** Whether the automation is enabled */
  enabled: boolean;
  /** Timestamp of last trigger (ms since epoch) */
  lastTriggered: number;
}

/**
 * Collection of all automation states, keyed by automation ID.
 */
export type AutomationsState = Record<string, AutomationState>;

// ============================================================================
// Stats Types
// ============================================================================

/**
 * Lifetime statistics tracking.
 */
export interface StatsState {
  /** Total play time in milliseconds */
  totalPlayTime: number;
  /** Total offline time accumulated in milliseconds */
  totalOfflineTime: number;
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
 * This is the shape of data that gets saved/loaded.
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
  automations: AutomationsState;
  settings: SettingsState;
  stats: StatsState;
}

// ============================================================================
// Store Action Types
// ============================================================================

/**
 * Actions available on the game store for state mutations.
 * All mutations should go through these actions for consistency.
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
   * Record a new score for a minigame. Maintains top 5 scores sorted descending.
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
   * Initialize a minigame state if it doesn't exist.
   * @param minigameId - The minigame identifier
   */
  ensureMinigameState: (minigameId: string) => void;

  // Equipment/upgrade actions
  /**
   * Purchase or upgrade an equipment upgrade.
   * @param upgradeId - The upgrade identifier
   * @returns The new level of the upgrade
   */
  purchaseEquipmentUpgrade: (upgradeId: string) => number;

  /**
   * Purchase an apartment upgrade.
   * @param upgradeId - The upgrade identifier
   * @returns true if the purchase was successful
   */
  purchaseApartmentUpgrade: (upgradeId: string) => boolean;

  /**
   * Purchase or upgrade a minigame-specific upgrade.
   * Stores the level in minigames[minigameId].upgrades[upgradeId].
   * @param minigameId - The minigame identifier
   * @param upgradeId - The upgrade identifier
   * @returns The new level of the upgrade
   */
  purchaseMinigameUpgrade: (minigameId: string, upgradeId: string) => number;

  // Stats actions
  /**
   * Add to total play time.
   * @param ms - Milliseconds to add
   */
  addPlayTime: (ms: number) => void;

  /**
   * Add to total offline time.
   * @param ms - Milliseconds to add
   */
  addOfflineTime: (ms: number) => void;

  /**
   * Track resources earned for lifetime stats.
   * @param resource - The resource type
   * @param amount - Amount as Decimal string
   */
  trackResourceEarned: (resource: ResourceType, amount: string) => void;

  // Automation actions
  /**
   * Enable an automation.
   * @param automationId - The automation identifier
   */
  enableAutomation: (automationId: string) => void;

  /**
   * Disable an automation.
   * @param automationId - The automation identifier
   */
  disableAutomation: (automationId: string) => void;

  /**
   * Update the last triggered time for an automation.
   * @param automationId - The automation identifier
   * @param timestamp - Timestamp when triggered (defaults to now)
   */
  updateAutomationTrigger: (automationId: string, timestamp?: number) => void;

  /**
   * Get the state of an automation.
   * @param automationId - The automation identifier
   * @returns The automation state or undefined if not found
   */
  getAutomationState: (automationId: string) => AutomationState | undefined;

  // Settings actions
  /**
   * Toggle offline progression setting.
   */
  toggleOfflineProgress: () => void;

  // Save/load actions
  /**
   * Update the lastSaved timestamp to current time.
   */
  updateLastSaved: () => void;

  /**
   * Update the lastPlayed timestamp to current time.
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
export type GameStoreState = GameState & GameActions;

// ============================================================================
// Scene Types
// ============================================================================

/**
 * Scene lifecycle interface.
 * Scenes are top-level containers for different game states (main menu, apartment, minigames).
 */
export interface Scene {
  /** Unique identifier for this scene */
  readonly id: string;

  /**
   * Called when the scene is entered (becomes active).
   * Can be async for loading resources.
   */
  onEnter(): void | Promise<void>;

  /**
   * Called when the scene is exited (about to be removed).
   * Clean up input contexts and subscriptions here.
   */
  onExit(): void;

  /**
   * Called every frame while the scene is active.
   * @param deltaMs - Time since last frame in milliseconds
   */
  onUpdate?(deltaMs: number): void;

  /**
   * Called when the scene is being destroyed.
   * Clean up all resources, remove display objects.
   */
  onDestroy(): void;

  /**
   * Get the PixiJS container for this scene.
   */
  getContainer(): Container;
}

/**
 * Factory function for creating scenes.
 */
export type SceneFactory = () => Scene;

// ============================================================================
// Minigame Definition Types
// ============================================================================

/**
 * Forward declaration for Game class to avoid circular imports.
 * The actual Game class will be defined in game/Game.ts.
 */
export interface GameInstance {
  readonly config: unknown;
  readonly store: unknown;
  readonly eventBus: unknown;
  readonly inputManager: unknown;
  readonly sceneManager: unknown;
}

/**
 * Definition for a minigame that can be registered with the MinigameRegistry.
 */
export interface MinigameDefinition {
  /** Unique identifier for the minigame */
  id: string;
  /** Display name */
  name: string;
  /** Short description for UI */
  description: string;
  /** Which resource this minigame primarily earns */
  primaryResource: ResourceType;
  /**
   * Factory function to create the minigame scene.
   * @param game - The game instance for accessing systems
   */
  createScene: (game: GameInstance) => Scene;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Current save format version.
 * Increment when making breaking changes to the save format.
 */
export const SAVE_VERSION = '2.1.0';

/**
 * Maximum number of top scores to keep per minigame.
 */
export const MAX_TOP_SCORES = 5;

/**
 * Default initial state for a new game.
 */
export function createInitialGameState(): GameState {
  return {
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
      'code-runner': {
        unlocked: true, // Testing - unlocked by default
        topScores: [],
        playCount: 0,
        upgrades: {},
      },
      'botnet-defense': {
        unlocked: true, // Testing - unlocked by default
        topScores: [],
        playCount: 0,
        upgrades: {},
      },
    },

    upgrades: {
      equipment: {},
      apartment: {},
    },

    automations: {},

    settings: {
      offlineProgressEnabled: true,
    },

    stats: {
      totalPlayTime: 0,
      totalOfflineTime: 0,
      totalResourcesEarned: {
        money: '0',
        technique: '0',
        renown: '0',
      },
    },
  };
}

/**
 * Create a default minigame state for a new minigame.
 */
export function createDefaultMinigameState(unlocked = false): MinigameState {
  return {
    unlocked,
    topScores: [],
    playCount: 0,
    upgrades: {},
  };
}
