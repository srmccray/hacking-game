/**
 * Offline Progression System for the Hacker Incremental Game
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
 *   import { calculateOfflineProgress, processOfflineProgress } from '@core/offline-progress';
 *
 *   // On game load, check and process offline progress
 *   const result = calculateOfflineProgress(lastPlayedTimestamp);
 *   if (result.shouldShowModal) {
 *     // Show welcome-back modal with result.earnings
 *   }
 */

import Decimal from 'break_eternity.js';
import { useGameStore } from './game-state';
import { getMoneyGenerationRate } from './auto-generation';
import {
  decimalToString,
  multiply,
  ZERO,
  MAX_OFFLINE_SECONDS,
  OFFLINE_EFFICIENCY,
} from './resource-manager';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Minimum offline time (in seconds) to trigger the welcome-back modal.
 * Absences shorter than this are silently processed.
 */
const MIN_OFFLINE_SECONDS_FOR_MODAL = 60; // 1 minute

/**
 * Maximum offline time in seconds (8 hours).
 * Re-exported from resource-manager for convenience.
 */
export const MAX_OFFLINE_TIME_SECONDS = MAX_OFFLINE_SECONDS;

/**
 * Efficiency multiplier for offline earnings (50%).
 * Re-exported from resource-manager for convenience.
 */
export const OFFLINE_EFFICIENCY_MULTIPLIER = OFFLINE_EFFICIENCY;

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

  /** Effective seconds used for calculation (capped at 8 hours) */
  effectiveSeconds: number;

  /** Whether the time was capped at maximum */
  wasCapped: boolean;

  /** Resources earned while offline */
  earnings: {
    money: Decimal;
  };

  /** Formatted time string for display */
  formattedTimeAway: string;
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
 * @param lastPlayedTimestamp - Timestamp (ms since epoch) of last play session
 * @returns OfflineProgressResult with calculation details
 */
export function calculateOfflineProgress(
  lastPlayedTimestamp: number | null
): OfflineProgressResult {
  // Check if offline progression is enabled
  const state = useGameStore.getState();
  if (!state.settings.offlineProgressEnabled) {
    return {
      wasCalculated: false,
      shouldShowModal: false,
      totalSecondsAway: 0,
      effectiveSeconds: 0,
      wasCapped: false,
      earnings: { money: ZERO },
      formattedTimeAway: '',
    };
  }

  // No previous timestamp means first-time player
  if (lastPlayedTimestamp === null || lastPlayedTimestamp === 0) {
    return {
      wasCalculated: false,
      shouldShowModal: false,
      totalSecondsAway: 0,
      effectiveSeconds: 0,
      wasCapped: false,
      earnings: { money: ZERO },
      formattedTimeAway: '',
    };
  }

  // Calculate time elapsed
  const now = Date.now();
  const elapsedMs = now - lastPlayedTimestamp;
  const totalSecondsAway = elapsedMs / 1000;

  // Skip if too little time has passed (< 1 second)
  if (totalSecondsAway < 1) {
    return {
      wasCalculated: false,
      shouldShowModal: false,
      totalSecondsAway: 0,
      effectiveSeconds: 0,
      wasCapped: false,
      earnings: { money: ZERO },
      formattedTimeAway: '',
    };
  }

  // Cap at maximum offline time
  const wasCapped = totalSecondsAway > MAX_OFFLINE_TIME_SECONDS;
  const effectiveSeconds = Math.min(totalSecondsAway, MAX_OFFLINE_TIME_SECONDS);

  // Get the current money generation rate
  const moneyRate = getMoneyGenerationRate();

  // Calculate earnings: rate * time * efficiency
  const rawMoneyEarnings = multiply(moneyRate, effectiveSeconds);
  const moneyEarnings = multiply(rawMoneyEarnings, OFFLINE_EFFICIENCY);

  // Determine if modal should be shown
  const shouldShowModal = totalSecondsAway >= MIN_OFFLINE_SECONDS_FOR_MODAL;

  return {
    wasCalculated: true,
    shouldShowModal,
    totalSecondsAway,
    effectiveSeconds,
    wasCapped,
    earnings: { money: moneyEarnings },
    formattedTimeAway: formatDuration(totalSecondsAway),
  };
}

/**
 * Apply calculated offline progress to the game state.
 *
 * This awards the resources from offline progress. Should be called
 * after the player dismisses the welcome-back modal, or immediately
 * if no modal is shown.
 *
 * @param result - The result from calculateOfflineProgress()
 */
export function applyOfflineProgress(result: OfflineProgressResult): void {
  if (!result.wasCalculated) {
    return;
  }

  const store = useGameStore.getState();

  // Award money if any was earned
  if (result.earnings.money.gt(0)) {
    store.addResource('money', decimalToString(result.earnings.money));
    store.trackResourceEarned('money', decimalToString(result.earnings.money));
  }

  console.log('[OfflineProgress] Applied offline earnings:', {
    timeAway: result.formattedTimeAway,
    effectiveSeconds: result.effectiveSeconds,
    wasCapped: result.wasCapped,
    moneyEarned: decimalToString(result.earnings.money),
  });
}

/**
 * Calculate and apply offline progress in one step.
 *
 * This is a convenience function that combines calculation and application.
 * Use this when you don't need to show a modal.
 *
 * @param lastPlayedTimestamp - Timestamp of last play session
 * @returns The calculation result
 */
export function processOfflineProgress(
  lastPlayedTimestamp: number | null
): OfflineProgressResult {
  const result = calculateOfflineProgress(lastPlayedTimestamp);

  // Apply immediately if no modal should be shown
  if (!result.shouldShowModal && result.wasCalculated) {
    applyOfflineProgress(result);
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if enough time has passed to show the welcome-back modal.
 *
 * @param lastPlayedTimestamp - Timestamp of last play session
 * @returns true if modal should be shown
 */
export function shouldShowWelcomeBackModal(
  lastPlayedTimestamp: number | null
): boolean {
  if (lastPlayedTimestamp === null || lastPlayedTimestamp === 0) {
    return false;
  }

  const state = useGameStore.getState();
  if (!state.settings.offlineProgressEnabled) {
    return false;
  }

  const elapsedSeconds = (Date.now() - lastPlayedTimestamp) / 1000;
  return elapsedSeconds >= MIN_OFFLINE_SECONDS_FOR_MODAL;
}

/**
 * Get the maximum offline time as a formatted string.
 *
 * @returns Formatted string (e.g., "8 hours")
 */
export function getMaxOfflineTimeString(): string {
  const hours = MAX_OFFLINE_TIME_SECONDS / 3600;
  return `${hours} hours`;
}

/**
 * Get the efficiency multiplier as a percentage string.
 *
 * @returns Percentage string (e.g., "50%")
 */
export function getEfficiencyPercentString(): string {
  const percent = OFFLINE_EFFICIENCY.mul(100).toNumber();
  return `${percent}%`;
}

/**
 * Preview what earnings would be for a given duration.
 * Useful for UI displays or debugging.
 *
 * @param seconds - Duration in seconds
 * @returns Earnings preview
 */
export function previewOfflineEarnings(seconds: number): {
  money: Decimal;
  moneyWithEfficiency: Decimal;
} {
  const cappedSeconds = Math.min(seconds, MAX_OFFLINE_TIME_SECONDS);
  const moneyRate = getMoneyGenerationRate();

  const rawMoney = multiply(moneyRate, cappedSeconds);
  const moneyWithEfficiency = multiply(rawMoney, OFFLINE_EFFICIENCY);

  return {
    money: rawMoney,
    moneyWithEfficiency,
  };
}
