/**
 * Auto-Generation Rate Calculator for the Hacker Incremental Game
 *
 * This module calculates the automatic resource generation rate based on
 * top minigame scores and upgrade multipliers.
 *
 * Formula per FRD:
 *   baseRate = sum of top 5 scores / 100 (per second)
 *   finalRate = baseRate * upgradeMultipliers
 *
 * Usage:
 *   import { calculateAutoGenerationRate, getMoneyGenerationRate } from '@core/auto-generation';
 *
 *   const rate = getMoneyGenerationRate(); // Rate per second as Decimal
 */

import Decimal from 'break_eternity.js';
import { useGameStore, selectTopScores } from './game-state';
import { getAutoGenerationMultiplier } from './upgrades';
import { ZERO, multiply, divide } from './resource-manager';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Divisor for converting score sum to per-second rate.
 * Higher value = slower generation. Tunable for balance.
 */
const SCORE_TO_RATE_DIVISOR = 100;

/**
 * Minigame IDs that contribute to money generation.
 * For MVP, only Code Breaker generates money.
 */
const MONEY_GENERATING_MINIGAMES = ['code-breaker'];

// ============================================================================
// Rate Calculation
// ============================================================================

/**
 * Calculate the base generation rate from top 5 scores of a minigame.
 * Does not include upgrade multipliers.
 *
 * @param minigameId - The minigame to calculate rate for
 * @returns Base rate per second as Decimal
 */
export function calculateBaseRateFromScores(minigameId: string): Decimal {
  const state = useGameStore.getState();
  const topScores = selectTopScores(state, minigameId);

  if (topScores.length === 0) {
    return ZERO;
  }

  // Sum all top scores
  const scoreSum = topScores.reduce(
    (sum, score) => sum.add(score),
    new Decimal(0)
  );

  // Convert to per-second rate
  return divide(scoreSum, SCORE_TO_RATE_DIVISOR);
}

/**
 * Calculate the total auto-generation rate for money.
 * Includes all contributing minigames and upgrade multipliers.
 *
 * @returns Money generation rate per second as Decimal
 */
export function getMoneyGenerationRate(): Decimal {
  // Calculate base rate from all money-generating minigames
  let baseRate = new Decimal(0);

  for (const minigameId of MONEY_GENERATING_MINIGAMES) {
    const minigameRate = calculateBaseRateFromScores(minigameId);
    baseRate = baseRate.add(minigameRate);
  }

  // Apply upgrade multiplier (auto-typer upgrade)
  const multiplier = getAutoGenerationMultiplier();

  return multiply(baseRate, multiplier);
}

/**
 * Get all auto-generation rates for display purposes.
 * Returns rates for all resource types.
 *
 * @returns Object with rates for each resource type
 */
export function getAllGenerationRates(): {
  money: Decimal;
  technique: Decimal;
  renown: Decimal;
} {
  return {
    money: getMoneyGenerationRate(),
    technique: ZERO, // Placeholder for MVP
    renown: ZERO, // Placeholder for MVP
  };
}

/**
 * Calculate how much of a resource would be generated over a time period.
 *
 * @param ratePerSecond - Generation rate per second
 * @param seconds - Time period in seconds
 * @returns Total amount generated
 */
export function calculateGenerationOverTime(
  ratePerSecond: Decimal,
  seconds: number
): Decimal {
  return multiply(ratePerSecond, seconds);
}

/**
 * Check if there is any active auto-generation.
 * Returns true if any minigame has recorded scores.
 *
 * @returns true if auto-generation is active
 */
export function hasActiveGeneration(): boolean {
  const rate = getMoneyGenerationRate();
  return rate.gt(0);
}

// ============================================================================
// Debug/Display Helpers
// ============================================================================

/**
 * Get a breakdown of generation rate contributions for debugging.
 *
 * @returns Object with breakdown of rate components
 */
export function getGenerationBreakdown(): {
  minigameContributions: Record<string, Decimal>;
  baseRate: Decimal;
  multiplier: number;
  finalRate: Decimal;
} {
  const contributions: Record<string, Decimal> = {};
  let baseRate = new Decimal(0);

  for (const minigameId of MONEY_GENERATING_MINIGAMES) {
    const rate = calculateBaseRateFromScores(minigameId);
    contributions[minigameId] = rate;
    baseRate = baseRate.add(rate);
  }

  const multiplier = getAutoGenerationMultiplier();
  const finalRate = multiply(baseRate, multiplier);

  return {
    minigameContributions: contributions,
    baseRate,
    multiplier,
    finalRate,
  };
}
