/**
 * Unified Game Configuration
 *
 * This module consolidates all game configuration into a single hierarchical
 * object for easier management and testing.
 *
 * Usage:
 *   import { DEFAULT_CONFIG, type GameConfig } from './GameConfig';
 *
 *   const game = await Game.create(DEFAULT_CONFIG);
 */

import Decimal from 'break_eternity.js';

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Canvas/rendering configuration.
 */
export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: number;
  containerId: string;
}

/**
 * Storage configuration.
 */
export interface StorageConfig {
  type: 'localStorage' | 'indexedDB';
  keyPrefix: string;
  maxSlots: number;
}

/**
 * Gameplay configuration.
 */
export interface GameplayConfig {
  /** Maximum offline time in seconds */
  offlineMaxSeconds: number;
  /** Efficiency multiplier for offline earnings (0-1) */
  offlineEfficiency: Decimal;
  /** Minimum offline seconds to show welcome-back modal */
  offlineMinSecondsForModal: number;
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs: number;
  /** Maximum delta time to prevent physics jumps */
  maxDeltaMs: number;
  /** HUD update interval in milliseconds */
  hudUpdateIntervalMs: number;
}

/**
 * Auto-generation configuration.
 */
export interface AutoGenerationConfig {
  /** Divisor for converting score sum to per-second rate */
  scoreToRateDivisor: number;
  /** Minigame IDs that contribute to money generation */
  moneyGeneratingMinigames: readonly string[];
}

/**
 * Code Breaker minigame configuration.
 */
export interface CodeBreakerConfig {
  /** Number of digits in each sequence */
  sequenceLength: number;
  /** Time limit in milliseconds */
  timeLimitMs: number;
  /** Base points for completing a sequence */
  baseSequencePoints: number;
  /** Points per digit matched correctly */
  pointsPerDigit: number;
  /** Score to Money conversion ratio */
  scoreToMoneyRatio: number;
  /** Maximum number of top scores to track */
  maxTopScores: number;
}

/**
 * Upgrade system configuration.
 */
export interface UpgradeSystemConfig {
  /** Default growth rate for exponential costs */
  defaultGrowthRate: Decimal;
}

/**
 * Debug configuration.
 */
export interface DebugConfig {
  /** Whether debug mode is enabled */
  enabled: boolean;
  /** Show FPS counter in HUD */
  showFps: boolean;
  /** Show collision boxes for debugging */
  showCollisionBoxes: boolean;
}

/**
 * UI animation configuration.
 */
export interface AnimationConfig {
  /** Flash duration for resource changes */
  flashDurationMs: number;
  /** Fade duration for modals */
  fadeDurationMs: number;
}

/**
 * Complete game configuration.
 */
export interface GameConfig {
  canvas: CanvasConfig;
  storage: StorageConfig;
  gameplay: GameplayConfig;
  autoGeneration: AutoGenerationConfig;
  minigames: {
    codeBreaker: CodeBreakerConfig;
  };
  upgrades: UpgradeSystemConfig;
  debug: DebugConfig;
  animation: AnimationConfig;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default game configuration.
 * This can be overridden partially when creating the Game instance.
 */
export const DEFAULT_CONFIG: GameConfig = {
  canvas: {
    width: 800,
    height: 600,
    backgroundColor: 0x0a0a0a,
    containerId: 'game-container',
  },

  storage: {
    type: 'localStorage',
    keyPrefix: 'hacker-incremental',
    maxSlots: 3,
  },

  gameplay: {
    offlineMaxSeconds: 8 * 60 * 60, // 8 hours
    offlineEfficiency: new Decimal(0.5),
    offlineMinSecondsForModal: 60, // 1 minute
    autoSaveIntervalMs: 30 * 1000, // 30 seconds
    maxDeltaMs: 1000,
    hudUpdateIntervalMs: 1000,
  },

  autoGeneration: {
    scoreToRateDivisor: 100,
    moneyGeneratingMinigames: ['code-breaker'],
  },

  minigames: {
    codeBreaker: {
      sequenceLength: 5,
      timeLimitMs: 60 * 1000, // 60 seconds
      baseSequencePoints: 100,
      pointsPerDigit: 10,
      scoreToMoneyRatio: 1,
      maxTopScores: 5,
    },
  },

  upgrades: {
    defaultGrowthRate: new Decimal(1.15),
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
};

/**
 * Create a configuration by merging partial config with defaults.
 *
 * @param partial - Partial configuration to merge
 * @returns Complete configuration
 */
export function createConfig(partial: Partial<GameConfig> = {}): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    canvas: { ...DEFAULT_CONFIG.canvas, ...partial.canvas },
    storage: { ...DEFAULT_CONFIG.storage, ...partial.storage },
    gameplay: { ...DEFAULT_CONFIG.gameplay, ...partial.gameplay },
    autoGeneration: { ...DEFAULT_CONFIG.autoGeneration, ...partial.autoGeneration },
    minigames: {
      ...DEFAULT_CONFIG.minigames,
      ...partial.minigames,
      codeBreaker: {
        ...DEFAULT_CONFIG.minigames.codeBreaker,
        ...partial.minigames?.codeBreaker,
      },
    },
    upgrades: { ...DEFAULT_CONFIG.upgrades, ...partial.upgrades },
    debug: { ...DEFAULT_CONFIG.debug, ...partial.debug },
    animation: { ...DEFAULT_CONFIG.animation, ...partial.animation },
  };
}
