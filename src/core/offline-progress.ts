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
import { decimalToString, multiply, ZERO } from './resource-manager';
import { OFFLINE_CONFIG } from './game-config';

// ============================================================================
// Configuration Re-exports
// ============================================================================

/**
 * Maximum offline time in seconds (8 hours).
 * Re-exported from game-config for convenience.
 */
export const MAX_OFFLINE_TIME_SECONDS = OFFLINE_CONFIG.maxSeconds;

/**
 * Efficiency multiplier for offline earnings (50%).
 * Re-exported from game-config for convenience.
 */
export const OFFLINE_EFFICIENCY_MULTIPLIER = OFFLINE_CONFIG.efficiencyMultiplier;

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

/**
 * Format a timestamp as a relative time string (e.g., "2h ago", "3d ago", "Just now").
 *
 * @param timestamp - Timestamp in milliseconds since epoch
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const elapsedMs = now - timestamp;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  // Less than 60 seconds
  if (elapsedSeconds < 60) {
    return 'Just now';
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  // Less than 60 minutes
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  // Less than 24 hours
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  // Less than 30 days
  if (elapsedDays < 30) {
    return `${elapsedDays}d ago`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);

  // Less than 12 months
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
  const moneyEarnings = multiply(rawMoneyEarnings, OFFLINE_CONFIG.efficiencyMultiplier);

  // Determine if modal should be shown
  const shouldShowModal = totalSecondsAway >= OFFLINE_CONFIG.minSecondsForModal;

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
  return elapsedSeconds >= OFFLINE_CONFIG.minSecondsForModal;
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
  const percent = OFFLINE_CONFIG.efficiencyMultiplier.mul(100).toNumber();
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
  const moneyWithEfficiency = multiply(rawMoney, OFFLINE_CONFIG.efficiencyMultiplier);

  return {
    money: rawMoney,
    moneyWithEfficiency,
  };
}
