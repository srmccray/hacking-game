/**
 * Game Configuration and Balance Constants
 *
 * This module centralizes all game balance constants and configuration values.
 * Having a single source of truth makes tuning easier and provides clear
 * documentation of game mechanics.
 *
 * Usage:
 *   import { GAME_CONFIG } from '@core/game-config';
 *
 *   const timeLimit = GAME_CONFIG.minigames.codeBreaker.timeLimitMs;
 *   const offlineMax = GAME_CONFIG.offline.maxSeconds;
 */

import Decimal from 'break_eternity.js';

// ============================================================================
// Auto-Generation Configuration
// ============================================================================

export const AUTO_GENERATION_CONFIG = {
  /**
   * Divisor for converting score sum to per-second rate.
   * Formula: baseRate = sum of top 5 scores / scoreTorRateDivisor
   * Higher value = slower generation. Tunable for balance.
   */
  scoreToRateDivisor: 100,

  /**
   * Minigame IDs that contribute to money generation.
   * For MVP, only Code Breaker generates money.
   */
  moneyGeneratingMinigames: ['code-breaker'] as const,
} as const;

// ============================================================================
// Offline Progression Configuration
// ============================================================================

export const OFFLINE_CONFIG = {
  /**
   * Maximum offline time in seconds (8 hours).
   * Players can accumulate up to this much offline progress.
   */
  maxSeconds: 8 * 60 * 60, // 28,800 seconds

  /**
   * Efficiency multiplier for offline earnings (50%).
   * Rewards active play over idle progression.
   */
  efficiencyMultiplier: new Decimal(0.5),

  /**
   * Minimum offline time (in seconds) to trigger the welcome-back modal.
   * Absences shorter than this are silently processed.
   */
  minSecondsForModal: 60, // 1 minute
} as const;

// ============================================================================
// Code Breaker Minigame Configuration
// ============================================================================

export const CODE_BREAKER_CONFIG = {
  /** Number of digits in each sequence */
  sequenceLength: 5,

  /** Time limit in milliseconds */
  timeLimitMs: 60 * 1000, // 60 seconds

  /** Base points for completing a sequence */
  baseSequencePoints: 100,

  /** Points per digit matched correctly */
  pointsPerDigit: 10,

  /** Score to Money conversion ratio (score * ratio = money) */
  scoreToMoneyRatio: 1,

  /** Maximum number of top scores to track */
  maxTopScores: 5,
} as const;

// ============================================================================
// Upgrade System Configuration
// ============================================================================

export const UPGRADE_CONFIG = {
  /** Default growth rate for exponential costs (15% increase per level) */
  defaultGrowthRate: new Decimal(1.15),
} as const;

// ============================================================================
// Save System Configuration
// ============================================================================

export const SAVE_CONFIG = {
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs: 30 * 1000, // 30 seconds

  /** Number of save slots available */
  maxSaveSlots: 3,

  /** localStorage key for save data */
  storageKey: 'hacker-incremental-save',

  /** localStorage key for slot metadata */
  slotMetadataKey: 'hacker-incremental-slots',
} as const;

// ============================================================================
// Tick Engine Configuration
// ============================================================================

export const TICK_CONFIG = {
  /** Maximum delta time to prevent physics explosions after tab switch */
  maxDeltaMs: 1000,

  /** HUD update interval in milliseconds */
  hudUpdateIntervalMs: 1000,

  /** Target frame rate for calculations */
  targetFps: 60,
} as const;

// ============================================================================
// UI Configuration
// ============================================================================

export const UI_CONFIG = {
  /** Canvas dimensions */
  canvas: {
    width: 1024,
    height: 768,
  },

  /** Animation timing */
  animation: {
    /** Flash duration for resource changes */
    flashDurationMs: 200,
    /** Fade duration for modals */
    fadeDurationMs: 300,
  },
} as const;

// ============================================================================
// Combined Game Configuration
// ============================================================================

/**
 * Master configuration object containing all game settings.
 * Use this for easy access to any configuration value.
 */
export const GAME_CONFIG = {
  autoGeneration: AUTO_GENERATION_CONFIG,
  offline: OFFLINE_CONFIG,
  minigames: {
    codeBreaker: CODE_BREAKER_CONFIG,
  },
  upgrade: UPGRADE_CONFIG,
  save: SAVE_CONFIG,
  tick: TICK_CONFIG,
  ui: UI_CONFIG,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type GameConfig = typeof GAME_CONFIG;
export type AutoGenerationConfig = typeof AUTO_GENERATION_CONFIG;
export type OfflineConfig = typeof OFFLINE_CONFIG;
export type CodeBreakerConfig = typeof CODE_BREAKER_CONFIG;
export type UpgradeConfig = typeof UPGRADE_CONFIG;
export type SaveConfig = typeof SAVE_CONFIG;
export type TickConfig = typeof TICK_CONFIG;
export type UIConfig = typeof UI_CONFIG;
