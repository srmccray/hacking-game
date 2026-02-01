/**
 * Unified Game Configuration
 *
 * This module consolidates all game configuration into a single hierarchical
 * object. Configuration is immutable after creation - use createConfig() to
 * merge partial overrides with defaults.
 *
 * Usage:
 *   import { DEFAULT_CONFIG, createConfig, type GameConfig } from './GameConfig';
 *
 *   // Use defaults
 *   const game = await Game.create();
 *
 *   // Override specific values
 *   const game = await Game.create(createConfig({
 *     canvas: { width: 1024, height: 768 },
 *     debug: { enabled: true },
 *   }));
 */

import Decimal from 'break_eternity.js';

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Canvas/rendering configuration.
 */
export interface CanvasConfig {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Background color as hex number */
  backgroundColor: number;
  /** DOM element ID to mount canvas into */
  containerId: string;
}

/**
 * Storage/persistence configuration.
 */
export interface StorageConfig {
  /** Storage backend type */
  type: 'localStorage' | 'indexedDB';
  /** Prefix for storage keys to avoid collisions */
  keyPrefix: string;
  /** Maximum number of save slots */
  maxSlots: number;
}

/**
 * Core gameplay configuration.
 */
export interface GameplayConfig {
  /** Maximum offline time that counts for earnings (in seconds) */
  offlineMaxSeconds: number;
  /** Efficiency multiplier for offline earnings (0.0 to 1.0) */
  offlineEfficiency: Decimal;
  /** Minimum offline seconds before showing welcome-back modal */
  offlineMinSecondsForModal: number;
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs: number;
  /** Maximum delta time per frame to prevent physics jumps (milliseconds) */
  maxDeltaMs: number;
  /** How often to update the HUD rate display (milliseconds) */
  hudUpdateIntervalMs: number;
}

/**
 * Auto-generation (idle earnings) configuration.
 */
export interface AutoGenerationConfig {
  /** Divisor for converting score sum to per-second rate */
  scoreToRateDivisor: number;
  /** Minigame IDs that contribute to money auto-generation */
  moneyGeneratingMinigames: readonly string[];
}

/**
 * Code Breaker minigame configuration.
 */
export interface CodeBreakerConfig {
  /** Number of characters in the first code of a round */
  startingCodeLength: number;
  /** How many characters to add per subsequent code in a round */
  lengthIncrement: number;
  /** Time limit per individual code in milliseconds */
  perCodeTimeLimitMs: number;
  /** Base money earned per cracked code (multiplied by code length) */
  baseMoneyPerCode: number;
  /** Maximum number of top scores to track */
  maxTopScores: number;
  /** String of all valid characters that can appear in codes */
  characterSet: string;
  /** Duration in milliseconds to preview the code before the timer starts */
  previewDurationMs: number;
  /** Additional time in milliseconds per character beyond startingCodeLength */
  timePerExtraCharMs: number;
}

/**
 * Code Runner minigame configuration.
 * A fall-down style game where obstacles scroll down and the player moves left/right to avoid them.
 */
export interface CodeRunnerConfig {
  /** Speed at which obstacles scroll down in pixels per second */
  scrollSpeed: number;
  /** Speed at which the player moves horizontally in pixels per second */
  playerSpeed: number;
  /** Time between obstacle spawns in milliseconds */
  obstacleSpawnRate: number;
  /** Minimum gap width in pixels for the player to pass through */
  gapWidth: number;
  /** Player hitbox dimensions for collision detection */
  playerHitboxSize: { width: number; height: number };
  /** Money earned per wall passed */
  moneyPerWall: number;
  /** Delay in milliseconds before the first obstacle spawns */
  initialObstacleDelay: number;
}

/**
 * Upgrade system configuration.
 */
export interface UpgradeSystemConfig {
  /** Default exponential growth rate for upgrade costs */
  defaultGrowthRate: Decimal;
}

/**
 * Debug/development configuration.
 */
export interface DebugConfig {
  /** Whether debug mode is enabled (shows extra info, enables cheats) */
  enabled: boolean;
  /** Show FPS counter in HUD */
  showFps: boolean;
  /** Show collision boxes for visual debugging */
  showCollisionBoxes: boolean;
}

/**
 * UI animation timing configuration.
 */
export interface AnimationConfig {
  /** Duration of flash effects (e.g., resource gain) in milliseconds */
  flashDurationMs: number;
  /** Duration of fade in/out transitions in milliseconds */
  fadeDurationMs: number;
}

/**
 * Player movement configuration for apartment scene.
 */
export interface MovementConfig {
  /** Player movement speed in pixels per second */
  speed: number;
  /** Player sprite width for collision */
  playerWidth: number;
  /** Player sprite height for collision */
  playerHeight: number;
}

/**
 * Minigames sub-configuration container.
 */
export interface MinigamesConfig {
  codeBreaker: CodeBreakerConfig;
  codeRunner: CodeRunnerConfig;
}

/**
 * Complete game configuration object.
 */
export interface GameConfig {
  canvas: CanvasConfig;
  storage: StorageConfig;
  gameplay: GameplayConfig;
  autoGeneration: AutoGenerationConfig;
  minigames: MinigamesConfig;
  upgrades: UpgradeSystemConfig;
  debug: DebugConfig;
  animation: AnimationConfig;
  movement: MovementConfig;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default game configuration values.
 * These provide sensible defaults for all configuration options.
 */
export const DEFAULT_CONFIG: GameConfig = {
  canvas: {
    width: 800,
    height: 600,
    backgroundColor: 0x0a0a0a, // Near-black with slight color
    containerId: 'game-container',
  },

  storage: {
    type: 'localStorage',
    keyPrefix: 'hacker-incremental',
    maxSlots: 3,
  },

  gameplay: {
    offlineMaxSeconds: 8 * 60 * 60, // 8 hours
    offlineEfficiency: new Decimal(0.5), // 50% of online rate
    offlineMinSecondsForModal: 60, // 1 minute minimum to show modal
    autoSaveIntervalMs: 30 * 1000, // Save every 30 seconds
    maxDeltaMs: 1000, // Cap delta to 1 second
    hudUpdateIntervalMs: 1000, // Update rate display every second
  },

  autoGeneration: {
    scoreToRateDivisor: 100, // Sum of top scores / 100 = per second rate
    moneyGeneratingMinigames: ['code-breaker'],
  },

  minigames: {
    codeBreaker: {
      startingCodeLength: 5,
      lengthIncrement: 1,
      perCodeTimeLimitMs: 5000, // 5 seconds per code
      baseMoneyPerCode: 5, // money = baseMoneyPerCode * codeLength per cracked code
      maxTopScores: 5,
      characterSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*',
      previewDurationMs: 750, // 750ms preview before timer starts
      timePerExtraCharMs: 300, // +300ms per char beyond startingCodeLength
    },
    codeRunner: {
      scrollSpeed: 150, // pixels per second
      playerSpeed: 250, // pixels per second (faster than obstacles for dodging)
      obstacleSpawnRate: 1500, // spawn obstacle every 1.5 seconds
      gapWidth: 80, // minimum gap width in pixels
      playerHitboxSize: { width: 24, height: 32 },
      moneyPerWall: 10, // earn 10 money per wall passed
      initialObstacleDelay: 1000, // 1 second delay before first obstacle
    },
  },

  upgrades: {
    defaultGrowthRate: new Decimal(1.15), // 15% cost increase per level
  },

  debug: {
    enabled: import.meta.env?.DEV ?? false,
    showFps: false,
    showCollisionBoxes: false,
  },

  animation: {
    flashDurationMs: 200,
    fadeDurationMs: 300,
  },

  movement: {
    speed: 200, // pixels per second
    playerWidth: 32,
    playerHeight: 64,
  },
};

// ============================================================================
// Configuration Factory
// ============================================================================

/**
 * Partial configuration type for config overrides.
 * Each sub-config can be partially specified.
 */
export interface PartialGameConfig {
  canvas?: Partial<CanvasConfig>;
  storage?: Partial<StorageConfig>;
  gameplay?: Partial<GameplayConfig>;
  autoGeneration?: Partial<AutoGenerationConfig>;
  minigames?: {
    codeBreaker?: Partial<CodeBreakerConfig>;
    codeRunner?: Partial<CodeRunnerConfig>;
  };
  upgrades?: Partial<UpgradeSystemConfig>;
  debug?: Partial<DebugConfig>;
  animation?: Partial<AnimationConfig>;
  movement?: Partial<MovementConfig>;
}

/**
 * Create a complete GameConfig by merging partial overrides with defaults.
 *
 * This performs a shallow merge at each configuration level, allowing you to
 * override specific values while keeping defaults for unspecified options.
 *
 * @param partial - Partial configuration to merge with defaults
 * @returns Complete configuration object
 *
 * @example
 * ```typescript
 * const config = createConfig({
 *   canvas: { width: 1024 },  // Override just width, keep other canvas defaults
 *   debug: { enabled: true }, // Enable debug mode
 * });
 * ```
 */
export function createConfig(partial: PartialGameConfig = {}): GameConfig {
  return {
    canvas: {
      ...DEFAULT_CONFIG.canvas,
      ...partial.canvas,
    },
    storage: {
      ...DEFAULT_CONFIG.storage,
      ...partial.storage,
    },
    gameplay: {
      ...DEFAULT_CONFIG.gameplay,
      ...partial.gameplay,
    },
    autoGeneration: {
      ...DEFAULT_CONFIG.autoGeneration,
      ...partial.autoGeneration,
    },
    minigames: {
      codeBreaker: {
        ...DEFAULT_CONFIG.minigames.codeBreaker,
        ...partial.minigames?.codeBreaker,
      },
      codeRunner: {
        ...DEFAULT_CONFIG.minigames.codeRunner,
        ...partial.minigames?.codeRunner,
      },
    },
    upgrades: {
      ...DEFAULT_CONFIG.upgrades,
      ...partial.upgrades,
    },
    debug: {
      ...DEFAULT_CONFIG.debug,
      ...partial.debug,
    },
    animation: {
      ...DEFAULT_CONFIG.animation,
      ...partial.animation,
    },
    movement: {
      ...DEFAULT_CONFIG.movement,
      ...partial.movement,
    },
  };
}
