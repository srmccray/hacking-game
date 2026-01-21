/**
 * Offline Progression System
 *
 * This module calculates and awards resources earned while the player was away,
 * providing the "idle" aspect of the incremental game experience.
 *
 * Features:
 * - Calculate elapsed time since last play session
 * - Cap offline time at 8 hours maximum
 * - Apply 50% efficiency multiplier (rewards active play)
 * - Support for enabling/disabling offline progression
 *
 * Usage:
 *   import { calculateOfflineProgress, applyOfflineProgress } from './offline-progress';
 *
 *   const result = calculateOfflineProgress(store, config);
 *   if (result.shouldShowModal) {
 *     // Show welcome-back modal with result.earnings
 *   }
 *   applyOfflineProgress(store, result);
 */

import { toDecimal, multiplyDecimals, ZERO } from '../resources/resource-manager';
import { getMoneyGenerationRate } from './auto-generation';
import type { GameStore } from '../state/game-store';
import type { GameConfig } from '../../game/GameConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of offline progress calculation.
 */
export interface OfflineProgressResult {
  /** Whether offline progression was calculated */
  wasCalculated: boolean;

  /** Whether the welcome-back modal should be shown */
  shouldShowModal: boolean;

  /** Total seconds away (uncapped) */
  totalSecondsAway: number;

  /** Effective seconds used for calculation (capped at max) */
  effectiveSeconds: number;

  /** Whether the time was capped at maximum */
  wasCapped: boolean;

  /** Resources earned while offline */
  earnings: {
    money: string;
    technique: string;
    renown: string;
  };

  /** Formatted time string for display */
  formattedTimeAway: string;

  /** Efficiency multiplier that was applied */
  efficiency: number;
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Format a duration in seconds to a human-readable string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2h 30m", "45m", "30s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  return `${minutes}m`;
}

/**
 * Format a timestamp as a relative time string.
 *
 * @param timestamp - Timestamp in milliseconds since epoch
 * @returns Formatted relative time string (e.g., "2h ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const elapsedMs = now - timestamp;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  if (elapsedSeconds < 60) {
    return 'Just now';
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) {
    return `${elapsedDays}d ago`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) {
    return `${elapsedMonths}mo ago`;
  }

  const elapsedYears = Math.floor(elapsedMonths / 12);
  return `${elapsedYears}y ago`;
}

// ============================================================================
// Offline Progress Calculation
// ============================================================================

/**
 * Calculate offline progress without applying it.
 *
 * This function determines how much time has passed since the last play session
 * and calculates potential earnings. It does NOT award the resources - use
 * applyOfflineProgress() for that.
 *
 * @param store - The game store
 * @param config - Game configuration
 * @returns OfflineProgressResult with calculation details
 */
export function calculateOfflineProgress(
  store: GameStore,
  config: GameConfig
): OfflineProgressResult {
  const state = store.getState();
  const gameplayConfig = config.gameplay;

  // Check if offline progression is enabled
  if (!state.settings.offlineProgressEnabled) {
    return createEmptyResult();
  }

  // Get last played timestamp
  const lastPlayed = state.lastPlayed;

  // No previous timestamp means first-time player
  if (lastPlayed === 0) {
    return createEmptyResult();
  }

  // Calculate time elapsed
  const now = Date.now();
  const elapsedMs = now - lastPlayed;
  const totalSecondsAway = elapsedMs / 1000;

  // Skip if too little time has passed (< 1 second)
  if (totalSecondsAway < 1) {
    return createEmptyResult();
  }

  // Cap at maximum offline time
  const maxSeconds = gameplayConfig.offlineMaxSeconds;
  const wasCapped = totalSecondsAway > maxSeconds;
  const effectiveSeconds = Math.min(totalSecondsAway, maxSeconds);

  // Get the current money generation rate
  const moneyRate = getMoneyGenerationRate(store, config);

  // Calculate earnings: rate * time * efficiency
  const efficiency = gameplayConfig.offlineEfficiency.toNumber();
  const rawMoneyEarnings = multiplyDecimals(moneyRate, effectiveSeconds);
  const moneyEarnings = multiplyDecimals(rawMoneyEarnings, efficiency);

  // Determine if modal should be shown
  const shouldShowModal = totalSecondsAway >= gameplayConfig.offlineMinSecondsForModal;

  return {
    wasCalculated: true,
    shouldShowModal,
    totalSecondsAway,
    effectiveSeconds,
    wasCapped,
    earnings: {
      money: moneyEarnings,
      technique: ZERO,
      renown: ZERO,
    },
    formattedTimeAway: formatDuration(totalSecondsAway),
    efficiency,
  };
}

/**
 * Create an empty result for when offline progress should not be calculated.
 */
function createEmptyResult(): OfflineProgressResult {
  return {
    wasCalculated: false,
    shouldShowModal: false,
    totalSecondsAway: 0,
    effectiveSeconds: 0,
    wasCapped: false,
    earnings: {
      money: ZERO,
      technique: ZERO,
      renown: ZERO,
    },
    formattedTimeAway: '',
    efficiency: 0,
  };
}

/**
 * Apply calculated offline progress to the game state.
 *
 * This awards the resources from offline progress. Should be called
 * after the player dismisses the welcome-back modal, or immediately
 * if no modal is shown.
 *
 * @param store - The game store
 * @param result - The result from calculateOfflineProgress()
 */
export function applyOfflineProgress(
  store: GameStore,
  result: OfflineProgressResult
): void {
  if (!result.wasCalculated) {
    return;
  }

  const state = store.getState();

  // Award money if any was earned
  if (toDecimal(result.earnings.money).gt(0)) {
    state.addResource('money', result.earnings.money);
    state.trackResourceEarned('money', result.earnings.money);
  }

  // Track offline time in stats
  state.addOfflineTime(result.effectiveSeconds * 1000);

  console.log('[OfflineProgress] Applied offline earnings:', {
    timeAway: result.formattedTimeAway,
    effectiveSeconds: result.effectiveSeconds,
    wasCapped: result.wasCapped,
    moneyEarned: result.earnings.money,
    efficiency: `${result.efficiency * 100}%`,
  });
}

/**
 * Calculate and apply offline progress in one step.
 *
 * This is a convenience function that combines calculation and application.
 * Use this when you don't need to show a modal.
 *
 * @param store - The game store
 * @param config - Game configuration
 * @returns The calculation result
 */
export function processOfflineProgress(
  store: GameStore,
  config: GameConfig
): OfflineProgressResult {
  const result = calculateOfflineProgress(store, config);

  // Apply immediately if no modal should be shown
  if (!result.shouldShowModal && result.wasCalculated) {
    applyOfflineProgress(store, result);
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if enough time has passed to show the welcome-back modal.
 *
 * @param store - The game store
 * @param config - Game configuration
 * @returns true if modal should be shown
 */
export function shouldShowWelcomeBackModal(
  store: GameStore,
  config: GameConfig
): boolean {
  const state = store.getState();

  if (!state.settings.offlineProgressEnabled) {
    return false;
  }

  const lastPlayed = state.lastPlayed;
  if (lastPlayed === 0) {
    return false;
  }

  const elapsedSeconds = (Date.now() - lastPlayed) / 1000;
  return elapsedSeconds >= config.gameplay.offlineMinSecondsForModal;
}

/**
 * Get the maximum offline time as a formatted string.
 *
 * @param config - Game configuration
 * @returns Formatted string (e.g., "8 hours")
 */
export function getMaxOfflineTimeString(config: GameConfig): string {
  const hours = config.gameplay.offlineMaxSeconds / 3600;
  return `${hours} hours`;
}

/**
 * Get the efficiency multiplier as a percentage string.
 *
 * @param config - Game configuration
 * @returns Percentage string (e.g., "50%")
 */
export function getEfficiencyPercentString(config: GameConfig): string {
  const percent = config.gameplay.offlineEfficiency.mul(100).toNumber();
  return `${percent}%`;
}

/**
 * Preview what earnings would be for a given duration.
 * Useful for UI displays or debugging.
 *
 * @param store - The game store
 * @param config - Game configuration
 * @param seconds - Duration in seconds
 * @returns Earnings preview
 */
export function previewOfflineEarnings(
  store: GameStore,
  config: GameConfig,
  seconds: number
): {
  money: string;
  moneyWithEfficiency: string;
} {
  const cappedSeconds = Math.min(seconds, config.gameplay.offlineMaxSeconds);
  const moneyRate = getMoneyGenerationRate(store, config);

  const rawMoney = multiplyDecimals(moneyRate, cappedSeconds);
  const moneyWithEfficiency = multiplyDecimals(
    rawMoney,
    config.gameplay.offlineEfficiency.toNumber()
  );

  return {
    money: rawMoney,
    moneyWithEfficiency,
  };
}
